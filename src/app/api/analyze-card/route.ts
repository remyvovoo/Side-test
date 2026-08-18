import { NextRequest, NextResponse } from "next/server";
import Anthropic, { APIError } from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Locale } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { CARD_RARITIES } from "@/lib/wizard/types";
import { lookupCardOnTcgdex } from "@/lib/wizard/tcgdex-lookup";

// Prisma tourne en Node, pas en Edge.
export const runtime = "nodejs";
// L'analyse d'une image prend quelques secondes ; la limite Vercel par défaut est courte.
export const maxDuration = 60;

/** Nombre d'identifications offertes par compte pendant l'essai. */
const ANALYSIS_LIMIT = Number(process.env.AI_ANALYSIS_LIMIT ?? 30);

/**
 * Modèle utilisé pour la lecture de la photo. Voir la note de coût dans
 * CLAUDE.md avant de changer la valeur par défaut. Réglable sans redéploiement
 * via ANTHROPIC_MODEL.
 */
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

/**
 * Repli automatique si MODEL est temporairement saturé côté Anthropic (déjà
 * rencontré : Opus 5 en panne sur les requêtes image + sortie structurée
 * précisément, alors qu'un simple appel texte passait — vraisemblablement une
 * capacité serveur spécifique à cette combinaison, distincte d'une panne
 * générale du modèle). Sonnet 5 gère la même requête de façon fiable.
 */
const FALLBACK_MODEL = process.env.ANTHROPIC_FALLBACK_MODEL || "claude-sonnet-5";

function isOverloadOrServerError(e: unknown): e is APIError {
  return e instanceof APIError && !!e.status && (e.status === 429 || e.status >= 500);
}

const BodySchema = z.object({
  // data URL JPEG produite côté navigateur (~1500 px, qualité 0.85)
  image: z
    .string()
    .regex(/^data:image\/(jpeg|png|webp);base64,/, "image_format")
    .max(6_000_000, "image_too_large"),
});

/**
 * Langue de rédaction de l'annonce, pilotée par User.locale (déjà en base,
 * pas encore branché ailleurs dans le produit — voir CLAUDE.md). Détermine à
 * la fois la langue du nom relevé par l'IA et le jeu de données TCGdex
 * interrogé pour l'extension/la rareté. La LANGUE D'IMPRESSION de la carte
 * physique (champ `language` ci-dessous) est indépendante : une carte
 * imprimée en anglais dans une annonce en français donne toujours le nom
 * français (« Dracaufeu »), jamais l'anglais (« Charizard »).
 */
const LOCALE_TARGET: Record<Locale, { tcgdexLang: string; label: string }> = {
  fr: { tcgdexLang: "fr", label: "français" },
  en: { tcgdexLang: "en", label: "anglais" },
};

/**
 * Champs renvoyés par le modèle. Tout est obligatoire dans le schéma (sortie
 * structurée), mais une chaîne vide signifie « je ne sais pas » — c'est la
 * réponse attendue quand l'information n'est pas lisible sur la photo.
 */
function buildFactsSchema(targetLabel: string) {
  return {
    type: "object",
    properties: {
      name: {
        type: "string",
        description:
          `Nom du personnage ou de la carte, TOUJOURS en ${targetLabel} — même si la carte est imprimée dans une autre langue (ex : une carte imprimée « Charizard » en anglais donne le nom français « Dracaufeu » si la cible est le français). Traduis uniquement si tu reconnais le personnage/la carte avec certitude ; chaîne vide plutôt qu'une traduction incertaine.`,
      },
      number: {
        type: "string",
        description:
          "Numéro de collection imprimé, généralement en bas à gauche ou en bas à droite, au format « 228/197 » ou « SV107 ». Chaîne vide si illisible.",
      },
      series: {
        type: "string",
        description:
          `Nom de l'extension / du bloc, UNIQUEMENT s'il est littéralement imprimé sur la carte dans la langue cible (${targetLabel}). Ne traduis jamais un nom d'extension de mémoire — laisse vide, une recherche dédiée s'en charge séparément.`,
      },
      language: {
        type: "string",
        description:
          "Langue d'IMPRESSION réelle de la carte physique (indépendante de la langue de l'annonce) : « Français », « Anglais », « Japonais », « Chinois », « Allemand », « Coréen »… Chaîne vide si indéterminable. N'influence jamais les autres champs.",
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
}

function buildSystemPrompt(targetLabel: string) {
  return `Tu identifies les informations imprimées sur une photo de carte à collectionner (Pokémon, Yu-Gi-Oh!, Magic, sport…), pour préremplir une annonce de vente rédigée en ${targetLabel}.

Règles absolues :
- Le numéro et la langue d'impression sont une transcription pure : tu ne rapportes que ce qui est réellement lisible sur la photo, jamais de mémoire.
- Le nom du personnage/de la carte fait exception : il est toujours donné en ${targetLabel}, quelle que soit la langue d'impression de la carte (traduction vers un nom officiel bien connu, jamais une invention — si tu n'es pas sûr de reconnaître la carte, laisse le champ vide).
- La série n'est remplie que si elle est littéralement imprimée sur la carte dans la langue cible ; ne la traduis jamais toi-même.
- Dans le doute, la chaîne vide est la bonne réponse. Un champ vide sera rempli à la main par le vendeur ; un champ inventé fait une annonce mensongère.
- Tu ne juges jamais l'état de la carte ni son prix : ce n'est pas ton rôle.
- Le numéro est recopié exactement, séparateur compris (« 228/197 », pas « 228 sur 197 »).`;
}

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

/** Dernier bloc texte exploitable d'une réponse. */
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
    select: { aiAnalysisCount: true, locale: true },
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
  const target = LOCALE_TARGET[user.locale] ?? LOCALE_TARGET.fr;

  const [header, data] = parsed.data.image.split(",", 2);
  const mediaType = header.slice("data:".length, header.indexOf(";")) as
    | "image/jpeg"
    | "image/png"
    | "image/webp";

  const client = new Anthropic({ apiKey, maxRetries: 2 });

  const visionParams = {
    max_tokens: 1024,
    system: buildSystemPrompt(target.label),
    output_config: {
      // Extraction courte : pas besoin de réflexion approfondie, on privilégie
      // la latence et le coût.
      effort: "low" as const,
      format: { type: "json_schema" as const, schema: buildFactsSchema(target.label) },
    },
    messages: [
      {
        role: "user" as const,
        content: [
          { type: "image" as const, source: { type: "base64" as const, media_type: mediaType, data } },
          {
            type: "text" as const,
            text: "Relève les informations imprimées sur cette carte. Laisse vide tout ce qui n'est pas lisible.",
          },
        ],
      },
    ],
  };

  let response;
  try {
    // Un seul essai rapide sur le modèle principal : en cas de saturation, le
    // ré-essayer en boucle ne sert à rien (la même capacité reste indisponible)
    // — mieux vaut basculer tout de suite sur le modèle de repli.
    response = await client.messages.create(
      { model: MODEL, ...visionParams },
      { maxRetries: 0 }
    );
  } catch (e) {
    if (!isOverloadOrServerError(e)) {
      console.error("[cardshot] analyze-card: appel Claude en échec", e);
      return NextResponse.json({ error: "analysis_failed" }, { status: 502 });
    }
    console.warn(
      `[cardshot] analyze-card: ${MODEL} saturé (${e.status}), repli sur ${FALLBACK_MODEL}`
    );
    try {
      response = await client.messages.create({ model: FALLBACK_MODEL, ...visionParams });
    } catch (e2) {
      console.error("[cardshot] analyze-card: repli aussi en échec", e2);
      if (isOverloadOrServerError(e2)) {
        return NextResponse.json({ error: "overloaded" }, { status: 503 });
      }
      return NextResponse.json({ error: "analysis_failed" }, { status: 502 });
    }
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

  // Étape 2 : l'extension et la rareté se déduisent du code imprimé, via
  // TCGdex (base publique, quasi instantané) — best-effort, ne bloque jamais
  // l'extraction de la photo si elle échoue ou ne trouve rien.
  const needsLookup = !facts.series.trim() || !facts.rarity.trim();
  const enrichment = needsLookup
    ? await lookupCardOnTcgdex(facts, target.tcgdexLang)
    : null;
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
