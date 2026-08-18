import { CARD_RARITIES } from "@/lib/wizard/types";

/**
 * Retrouve la série et la rareté d'une carte Pokémon à partir du seul code
 * imprimé (« 052/196 »), via TCGdex (https://tcgdex.dev) — une base publique
 * gratuite, sans clé, qui couvre toutes les éditions Pokémon dans plusieurs
 * langues. Deux requêtes REST, pas de modèle : quasi instantané, contrairement
 * à une recherche web confiée à un LLM.
 *
 * Portée volontairement limitée aux cartes Pokémon numérotées « n/total »
 * (l'écrasante majorité des cartes de Cardshot). Les codes promo (« SWSH009 »)
 * ne correspondent à aucun set connu à l'avance : on laisse alors la série et
 * la rareté à la saisie manuelle plutôt que de deviner.
 *
 * Interrogé dans la langue de l'ANNONCE (le paramètre `lang`), pas dans la
 * langue d'impression de la carte physique : le nom relevé en amont est déjà
 * normalisé dans la langue cible (« Dracaufeu », pas « Charizard », si la
 * cible est le français) — voir LOCALE_TARGET / buildSystemPrompt dans
 * route.ts. Une carte japonaise vendue en français est donc bien recherchée
 * côté TCGdex en français.
 */

interface TcgdexLookupResult {
  series: string;
  rarity: string;
  /** Nom de la source, pour trace/diagnostic uniquement. */
  source: string;
}

const TCGDEX_BASE = "https://api.tcgdex.net/v2";
/** Langue par défaut si l'appelant n'en précise pas (le produit est 100 % français aujourd'hui). */
const DEFAULT_LANG = "fr";

/**
 * Table d'approximation : les libellés de rareté TCGdex (variés selon les
 * éditions et la langue) sont ramenés aux 7 paliers du produit. Les motifs les
 * plus spécifiques sont vérifiés en premier (« peu commune » contient
 * « commune »). Aucune correspondance → chaîne vide, jamais un pari.
 */
const RARITY_PATTERNS: { pattern: RegExp; bucket: (typeof CARD_RARITIES)[number] }[] = [
  { pattern: /promo/i, bucket: "⬡ Promo" },
  { pattern: /secr[eè]t|secret|rainbow|arc-en-ciel|hyper|gold|special illustration|illustration sp[eé]ciale/i, bucket: "★★★ SAR" },
  { pattern: /ultra|double rare/i, bucket: "★★ Ultra Rare" },
  { pattern: /peu commune|uncommon/i, bucket: "◆◆ Peu commune" },
  { pattern: /\bcommune?\b|\bcommon\b/i, bucket: "◆ Commune" },
  { pattern: /rare/i, bucket: "★ Rare" },
];

function mapRarity(raw: string): string {
  for (const { pattern, bucket } of RARITY_PATTERNS) {
    if (pattern.test(raw)) return bucket;
  }
  return "";
}

interface TcgdexCardSummary {
  id: string;
  localId: string;
  name: string;
}

/** Normalise pour comparer sans accent ni casse (« Dracaufeu » ≈ « dracaufeu »). */
function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
}

interface TcgdexCardDetail {
  name?: string;
  rarity?: string;
  set?: { name?: string };
}

/** Requête TCGdex avec un délai de garde : ne doit jamais ralentir la carte. */
async function tcgdexFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function lookupCardOnTcgdex(
  facts: { name: string; number: string },
  lang: string = DEFAULT_LANG
): Promise<TcgdexLookupResult | null> {
  const match = facts.number.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return null; // code promo ou format non standard : on ne devine pas
  const [, localIdStr, total] = match;
  const localIdNum = parseInt(localIdStr, 10);
  const name = facts.name.trim();

  let chosenId: string | null = null;

  // 1) nom + total : filtre fiable côté API, retombe en général sur une seule carte.
  if (name) {
    const byName = await tcgdexFetch<TcgdexCardSummary[]>(
      `${TCGDEX_BASE}/${lang}/cards?${new URLSearchParams({ name, "set.cardCount.official": total })}`
    );
    if (byName?.length === 1) chosenId = byName[0].id;
  }

  // 2) repli — le numéro (n/total) identifie la carte à lui seul. Le filtre
  //    localId de l'API n'est PAS une égalité stricte (« 52 » matche aussi
  //    « 152 »), donc on revérifie nous-mêmes l'égalité exacte avant de faire
  //    confiance au résultat ; en cas d'ambiguïté persistante, le nom départage.
  if (!chosenId) {
    const byNumber = await tcgdexFetch<TcgdexCardSummary[]>(
      `${TCGDEX_BASE}/${lang}/cards?${new URLSearchParams({ localId: localIdStr, "set.cardCount.official": total })}`
    );
    const exact = (byNumber ?? []).filter((c) => parseInt(c.localId, 10) === localIdNum);
    if (exact.length === 1) {
      chosenId = exact[0].id;
    } else if (exact.length > 1 && name) {
      const byNameMatch = exact.filter((c) => normalize(c.name) === normalize(name));
      if (byNameMatch.length === 1) chosenId = byNameMatch[0].id;
    }
  }

  if (!chosenId) return null;

  const detail = await tcgdexFetch<TcgdexCardDetail>(`${TCGDEX_BASE}/${lang}/cards/${chosenId}`);
  if (!detail) return null;

  return {
    series: detail.set?.name?.trim() ?? "",
    rarity: detail.rarity ? mapRarity(detail.rarity) : "",
    source: "TCGdex",
  };
}
