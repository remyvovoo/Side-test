import type { CardInfo } from "@/lib/render-engine";

/** Informations réellement lisibles sur la carte (le reste reste vide). */
export type CardFacts = Pick<CardInfo, "name" | "number" | "series" | "language" | "rarity">;

export type AnalyzeErrorCode =
  | "unauthorized"
  | "not_configured"
  | "quota_exceeded"
  | "refused"
  | "failed";

export class AnalyzeCardError extends Error {
  code: AnalyzeErrorCode;
  limit?: number;
  constructor(code: AnalyzeErrorCode, limit?: number) {
    super(code);
    this.name = "AnalyzeCardError";
    this.code = code;
    this.limit = limit;
  }
}

export interface AnalyzeCardResult {
  facts: CardFacts;
  usage: { used: number; limit: number };
}

/**
 * Réduit la photo détourée avant l'envoi. 1500 px sur le grand côté suffit à
 * lire le numéro en bas de carte tout en gardant l'appel léger.
 */
function toDataUrl(image: HTMLImageElement, maxSize = 1500): string {
  const scale = Math.min(maxSize / image.naturalWidth, maxSize / image.naturalHeight, 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  // Fond blanc : la carte est détourée (PNG transparent), et un fond noir par
  // défaut écraserait le texte sombre des bords.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

/** Envoie la photo à l'IA et renvoie les informations lues sur la carte. */
export async function analyzeCard(image: HTMLImageElement): Promise<AnalyzeCardResult> {
  const res = await fetch("/api/analyze-card", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: toDataUrl(image) }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: string; limit?: number }
      | null;
    const error = body?.error;
    if (res.status === 401) throw new AnalyzeCardError("unauthorized");
    if (res.status === 503) throw new AnalyzeCardError("not_configured");
    if (error === "quota_exceeded") throw new AnalyzeCardError("quota_exceeded", body?.limit);
    if (error === "analysis_refused") throw new AnalyzeCardError("refused");
    throw new AnalyzeCardError("failed");
  }

  return (await res.json()) as AnalyzeCardResult;
}

/**
 * Fusionne ce que l'IA a lu dans les infos de la carte : on ne remplit que les
 * champs encore vides — ce que le vendeur a saisi n'est jamais écrasé.
 */
export function mergeFacts(current: CardInfo, facts: CardFacts): CardInfo {
  const merged = { ...current };
  (Object.keys(facts) as (keyof CardFacts)[]).forEach((key) => {
    const value = facts[key].trim();
    if (value && !merged[key].trim()) merged[key] = value;
  });
  return merged;
}
