import type { CardInfo } from "@/lib/render-engine";

/**
 * Builds a ready-to-paste listing description from the card's own info and
 * the seller's saved boilerplate — the goal is that the seller almost never
 * has to type a description by hand again.
 */
export function generateDescription(cardInfo: CardInfo, boilerplate: string): string {
  const titleParts = [cardInfo.name, cardInfo.number].filter(Boolean);
  const lines: string[] = [];
  if (titleParts.length) lines.push(titleParts.join(" "));
  if (cardInfo.series) lines.push(`Série : ${cardInfo.series}`);
  if (cardInfo.language) lines.push(`Langue : ${cardInfo.language}`);

  const header = lines.join("\n");
  const body = boilerplate.trim();
  return [header, body].filter(Boolean).join("\n\n");
}
