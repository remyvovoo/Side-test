import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { CARD_RARITIES } from "@/lib/wizard/types";

// Prisma tourne en Node, pas en Edge.
export const runtime = "nodejs";
// L'analyse d'une image prend quelques secondes ; la limite Vercel par défaut est courte.
export const maxDuration = 60;

/** Nombre d'identifications offertes par compte pendant l'essai. */
const ANALYSIS_LIMIT = Number(process.env.AI_ANALYSIS_LIMIT ?? 30);

/**
 * Modèle utilisé pour la lecture de la photo et la recherche en ligne. Voir la
 * note de coût dans CLAUDE.md avant de changer la valeur par défaut.
 * Réglable sans redéploiement via ANTHROPIC_MODEL (utile si le modèle par
 * défaut est temporairement saturé côté Anthropic).
 */
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

const BodySchema = z.object({
  // data URL JPEG produite côté navigateur (~1500 px, qualité 0.85)
  image: z
    .string()
    .regex(/^data:image\/(jpeg|png|webp);base64,/, "image_format")
    .max(6_000_000, "image_too_large"),
});

/**
 * Champs renvoyés par le modèle. Tout est obligatoire dans le schéma (sortie
 * structurée), mais une chaîne vide signifie « je ne sais pas » — c'est la
 * réponse attendue quand l'information n'est pas lisible sur la photo.
 */
const CARD_FACTS_SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description:
        "Nom du personnage ou de la carte, tel qu'imprimé en haut de la carte (ex : « Dracaufeu ex »). Chaîne vide si illisible.",
    },
    number: {
      type: "string",
      description:
        "Numéro de collection imprimé, généralement en bas à gauche ou en bas à droite, au format « 228/197 » ou « SV107 ». Chaîne vide si illisible.",
    },
    series: {
      type: "string",
      description:
        "Nom de l'extension / du bloc si visible sur la carte (ex : « Évolutions Prismatiques »). Chaîne vide si absent ou incertain.",
    },
    language: {
      type: "string",
      description:
        "Langue d'impression de la carte, en français : « Français », « Anglais », « Japonais », « Allemand »… Chaîne vide si indéterminable.",
    },
    rarity: {
      type: "string",
      enum: ["", ...CARD_RARITIES],
      description:
        "Rareté déduite du symbole imprimé à côté du numéro. Chaîne vide en cas de doute.",
    },
  },
  required: ["name", "number", "series", "language", "rarity"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `Tu identifies les informations imprimées sur une photo de carte à collectionner (Pokémon, Yu-Gi-Oh!, Magic, sport…), pour préremplir une annonce de vente.

Règles absolues :
- Tu ne rapportes QUE ce qui est réellement lisible sur la photo. Tu ne complètes jamais de mémoire : si tu reconnais la carte mais que le texte n'est pas lisible, laisse le champ vide.
- Dans le doute, la chaîne vide est la bonne réponse. Un champ vide sera rempli à la main par le vendeur ; un champ inventé fait une annonce mensongère.
- Tu ne juges jamais l'état de la carte ni son prix : ce n'est pas ton rôle.
- Le nom et la série sont recopiés tels qu'imprimés, dans la langue de la carte, en respectant les accents.
- Le numéro est recopié exactement, séparateur compris (« 228/197 », pas « 228 sur 197 »).`;

interface CardFacts {
  name: string;
  number: string;
  series: string;
  language: string;
  rarity: string;
}

const FactsSchema = z.object({
  name: z.string().max(120),
  number: z.string().max(40),
  series: z.string().max(120),
  language: z.string().max(40),
  rarity: z.string().max(40),
});

/**
 * Étape 2 — le code imprimé (« 052/196 ») identifie la carte de façon unique
 * dans les bases de vendeurs. On l'utilise pour retrouver en ligne l'extension
 * et la rareté, qui ne sont presque jamais écrites sur la carte elle-même.
 */
const LOOKUP_SCHEMA = {
  type: "object",
  properties: {
    series: {
      type: "string",
      description:
        "Nom de l'extension (set) à laquelle appartient la carte, dans la langue de la carte. Chaîne vide si les recherches ne permettent pas de conclure.",
    },
    rarity: {
      type: "string",
      enum: ["", ...CARD_RARITIES],
      description: "Niveau de rareté correspondant. Chaîne vide en cas de doute.",
    },
    source: {
      type: "string",
      description: "URL de la page qui a servi de référence. Chaîne vide si aucune.",
    },
  },
  required: ["series", "rarity", "source"],
  additionalProperties: false,
} as const;

const LOOKUP_SYSTEM_PROMPT = `Tu complètes la fiche d'une carte à collectionner mise en vente, à partir des informations imprimées relevées sur la photo.

Le code d'identification (ex : « 052/196 ») et le nom suffisent en général à retrouver la carte dans les bases de vendeurs (Cardmarket, boutiques spécialisées, bases de données de cartes). Utilise la recherche web pour identifier l'extension et la rareté.

Règles absolues :
- Tu ne conclus que si les résultats concordent. Si tu ne trouves pas, ou si les résultats se contredisent, renvoie des chaînes vides : le vendeur complétera à la main.
- Le nom de l'extension est donné dans la langue de la carte (une carte française → le nom français de l'extension).
- Tu ne cherches ni le prix ni l'état : ce n'est pas ton rôle.`;

const LookupSchema = z.object({
  series: z.string().max(120),
  rarity: z.string().max(40),
  source: z.string().max(500),
});

/** Dernier bloc texte exploitable d'une réponse (une réponse outillée en contient plusieurs). */
function readJsonBlocks<T>(
  blocks: Anthropic.ContentBlock[],
  schema: z.ZodType<T>
): T | null {
  const texts = blocks.filter((b) => b.type === "text").map((b) => b.text);
  for (const text of texts.reverse()) {
    try {
      return schema.parse(JSON.parse(text));
    } catch {
      // bloc de commentaire du modèle, on regarde le précédent
    }
  }
  return null;
}

/**
 * Cherche en ligne l'extension et la rareté à partir du code imprimé. Renvoie
 * null si la recherche est inutile (pas de code lu, rien à compléter) ou si
 * elle échoue : l'identification de la photo reste acquise dans tous les cas.
 */
async function lookupFromCode(
  client: Anthropic,
  facts: CardFacts
): Promise<z.infer<typeof LookupSchema> | null> {
  const needsSeries = !facts.series.trim();
  const needsRarity = !facts.rarity.trim();
  if (!facts.number.trim() || (!needsSeries && !needsRarity)) return null;

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Carte à identifier :
- nom imprimé : ${facts.name || "non lisible"}
- code imprimé : ${facts.number}
- langue : ${facts.language || "non déterminée"}

Trouve l'extension à laquelle elle appartient et son niveau de rareté.`,
    },
  ];

  try {
    // La recherche web enchaîne plusieurs tours : le modèle peut rendre la main
    // avec « pause_turn », on le relance en lui repassant son propre travail.
    for (let round = 0; round < 4; round++) {
      const response = await client.messages.create(
        {
          model: MODEL,
          max_tokens: 4096,
          system: LOOKUP_SYSTEM_PROMPT,
          output_config: { effort: "medium", format: { type: "json_schema", schema: LOOKUP_SCHEMA } },
          tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
          messages,
        },
        // Plafond de temps : au-delà, on préfère livrer l'extraction seule.
        { timeout: 30_000 }
      );
      if (response.stop_reason === "refusal") return null;
      if (response.stop_reason !== "pause_turn") {
        const lookup = readJsonBlocks(response.content, LookupSchema);
        if (lookup?.source) {
          console.info("[cardshot] analyze-card: extension trouvée via", lookup.source);
        }
        return lookup;
      }
      messages.push({ role: "assistant", content: response.content });
    }
  } catch (e) {
    console.warn("[cardshot] analyze-card: recherche en ligne indisponible", e);
  }
  return null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[cardshot] ANTHROPIC_API_KEY is not configured");
    return NextResponse.json({ error: "service_not_configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { aiAnalysisCount: true },
  });
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (user.aiAnalysisCount >= ANALYSIS_LIMIT) {
    return NextResponse.json(
      { error: "quota_exceeded", limit: ANALYSIS_LIMIT },
      { status: 429 }
    );
  }

  const [header, data] = parsed.data.image.split(",", 2);
  const mediaType = header.slice("data:".length, header.indexOf(";")) as
    | "image/jpeg"
    | "image/png"
    | "image/webp";

  // L'API peut renvoyer un 529 « saturé » passager : le SDK réessaie tout seul,
  // avec attente progressive, avant de nous rendre la main.
  const client = new Anthropic({ apiKey, maxRetries: 3 });

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      output_config: {
        // Extraction courte : pas besoin de réflexion approfondie, on privilégie
        // la latence et le coût.
        effort: "low",
        format: { type: "json_schema", schema: CARD_FACTS_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data } },
            {
              type: "text",
              text: "Relève les informations imprimées sur cette carte. Laisse vide tout ce qui n'est pas lisible.",
            },
          ],
        },
      ],
    });
  } catch (e) {
    console.error("[cardshot] analyze-card: appel Claude en échec", e);
    // Saturation passagère (529) ou débit dépassé (429) : ce n'est pas la photo
    // qui est en cause, réessayer dans quelques secondes suffit.
    if (e instanceof Anthropic.APIError && (e.status === 529 || e.status === 429)) {
      return NextResponse.json({ error: "overloaded" }, { status: 503 });
    }
    return NextResponse.json({ error: "analysis_failed" }, { status: 502 });
  }

  // Un refus (classificateurs de sécurité) renvoie un 200 avec un contenu vide :
  // toujours vérifier stop_reason avant de lire content.
  if (response.stop_reason === "refusal") {
    console.warn("[cardshot] analyze-card: réponse refusée", response.stop_details);
    return NextResponse.json({ error: "analysis_refused" }, { status: 422 });
  }

  const facts = readJsonBlocks<CardFacts>(response.content, FactsSchema);
  if (!facts) {
    console.error("[cardshot] analyze-card: réponse illisible");
    return NextResponse.json({ error: "analysis_failed" }, { status: 502 });
  }

  // Étape 2 : l'extension et la rareté se déduisent du code imprimé. Recherche
  // best-effort — si elle échoue ou traîne, on renvoie quand même ce que la
  // photo a donné.
  const enrichment = await lookupFromCode(client, facts);
  if (enrichment) {
    if (!facts.series.trim()) facts.series = enrichment.series;
    if (!facts.rarity.trim()) facts.rarity = enrichment.rarity;
  }

  // On ne décompte qu'une analyse réellement aboutie.
  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: { aiAnalysisCount: { increment: 1 } },
    select: { aiAnalysisCount: true },
  });

  return NextResponse.json({
    ok: true,
    facts,
    // Vrai quand la série ou la rareté vient d'une recherche en ligne et non de
    // la photo : le vendeur doit le savoir pour vérifier en priorité ces champs.
    enrichedOnline: !!enrichment && !!(enrichment.series || enrichment.rarity),
    source: enrichment?.source ?? "",
    usage: { used: updated.aiAnalysisCount, limit: ANALYSIS_LIMIT },
  });
}
