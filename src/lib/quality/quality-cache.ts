import type { QualityResult } from "./types";

/**
 * Mémorise le score qualité par empreinte (SHA-256) du fichier importé :
 * réimporter exactement la même photo réaffiche exactement le même score.
 * Sans ça, la part du score qui dépend du détourage (service externe non
 * déterministe) peut bouger de quelques % entre deux analyses et troubler
 * l'utilisateur.
 */

const STORE_KEY = "cs_quality_cache_v1";
const MAX_ENTRIES = 20;

type CacheShape = Record<string, QualityResult>;

export async function hashBlob(blob: Blob): Promise<string | null> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

function readStore(): CacheShape {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}") as CacheShape;
  } catch {
    return {};
  }
}

export function readQualityCache(hash: string): QualityResult | null {
  return readStore()[hash] ?? null;
}

export function writeQualityCache(hash: string, result: QualityResult): void {
  try {
    const store = readStore();
    store[hash] = result;
    const keys = Object.keys(store);
    // On borne la taille : les plus anciens sortent (ordre d'insertion des clés).
    while (keys.length > MAX_ENTRIES) {
      delete store[keys.shift()!];
    }
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // localStorage indisponible ou plein : tant pis, pas bloquant.
  }
}
