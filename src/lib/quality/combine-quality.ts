import type { FramingIssue } from "./analyze-framing";
import type { QualityIssue, QualityResult } from "./types";

const FRAMING_ADVICE: Record<NonNullable<FramingIssue>, string> = {
  far: "La carte est petite dans le cadre — rapproche-toi, sans utiliser le zoom.",
  edge: "La carte touche presque le bord — recule un peu pour laisser du fond visible tout autour.",
  skew: "La photo est prise de biais — place-toi bien au-dessus de la carte.",
};

export function combineQuality(
  sharpness: number,
  resolution: number,
  framing: number,
  framingIssue: FramingIssue = null
): QualityResult {
  const weighted = sharpness * 0.45 + resolution * 0.25 + framing * 0.3;

  // Une moyenne peut masquer un défaut rédhibitoire : une carte coupée au bord
  // reste inexploitable même si la photo est nette et bien définie. On plafonne
  // donc la note par son point le plus faible — sans quoi l'écran affichait
  // « Photo correcte » à côté d'un indicateur au plus bas (relevé par Remy le
  // 19 août 2026). La pastille doit toujours dire la même chose que les chiffres.
  const worst = Math.min(sharpness, resolution, framing);
  const score = Math.round(Math.min(weighted, worst + 25));

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
      message: framingIssue
        ? FRAMING_ADVICE[framingIssue]
        : "Le cadrage est perfectible — vise la carte bien à plat, avec du fond tout autour.",
    });
  }
  if (issues.length === 0) {
    issues.push({ id: "ok", message: "Belle photo, prête à être transformée." });
  }
  return { score, sharpness, resolution, framing, issues };
}
