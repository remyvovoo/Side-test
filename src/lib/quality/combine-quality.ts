import type { QualityIssue, QualityResult } from "./types";

export function combineQuality(sharpness: number, resolution: number, framing: number): QualityResult {
  const score = Math.round(sharpness * 0.45 + resolution * 0.25 + framing * 0.3);
  const issues: QualityIssue[] = [];
  if (sharpness < 55) {
    issues.push({
      id: "blur",
      message: "La photo semble un peu floue — stabilise ton téléphone et vise un endroit bien éclairé.",
    });
  }
  if (resolution < 55) {
    issues.push({
      id: "resolution",
      message: "La résolution est un peu basse — rapproche-toi de la carte plutôt que d'utiliser le zoom.",
    });
  }
  if (framing < 55) {
    issues.push({
      id: "framing",
      message: "Le cadrage ne correspond pas aux proportions d'une carte — vérifie l'orientation et les 4 coins.",
    });
  }
  if (issues.length === 0) {
    issues.push({ id: "ok", message: "Belle photo, prête à être transformée." });
  }
  return { score, sharpness, resolution, framing, issues };
}
