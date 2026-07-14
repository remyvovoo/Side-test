import type { Corner } from "@/lib/wizard/image-utils";

/** A standard trading card is ~63×88mm, i.e. width/height ≈ 0.716 when upright. */
const EXPECTED_CARD_RATIO = 0.716;

/**
 * Compares the detected card silhouette (after background removal) to the
 * expected card proportions. Catches a rotated card, a steep camera angle,
 * or a background-removal cutout that clipped part of the card.
 */
export function computeFramingScore(bounds: Corner[]): number {
  const w = bounds[1].x - bounds[0].x;
  const h = bounds[3].y - bounds[0].y;
  if (w <= 0 || h <= 0) return 50;
  const ratio = w / h;
  const diff = Math.abs(ratio - EXPECTED_CARD_RATIO) / EXPECTED_CARD_RATIO;
  return Math.max(0, Math.min(100, Math.round(100 - diff * 140)));
}
