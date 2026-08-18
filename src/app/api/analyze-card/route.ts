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

/** Modèle de vision utilisé. Voir la note de coût dans CLAUDE.md avant de changer. */
const MODEL = "claude-opus-5";

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

  const client = new Anthropic({ apiKey });

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
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    return NextResponse.json({ error: "analysis_failed" }, { status: 502 });
  }

  // Un refus (classificateurs de sécurité) renvoie un 200 avec un contenu vide :
  // toujours vérifier stop_reason avant de lire content.
  if (response.stop_reason === "refusal") {
    console.warn("[cardshot] analyze-card: réponse refusée", response.stop_details);
    return NextResponse.json({ error: "analysis_refused" }, { status: 422 });
  }

  const textBlock = response.content.find((b) => b.type === "text");
  let facts: CardFacts;
  try {
    facts = FactsSchema.parse(JSON.parse(textBlock?.text ?? ""));
  } catch (e) {
    console.error("[cardshot] analyze-card: réponse illisible", e);
    return NextResponse.json({ error: "analysis_failed" }, { status: 502 });
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
    usage: { used: updated.aiAnalysisCount, limit: ANALYSIS_LIMIT },
  });
}
