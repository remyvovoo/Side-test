import type { Corner } from "@/lib/wizard/image-utils";

/**
 * Ce que « cadrage » veut dire, et pourquoi cette mesure a été refaite.
 *
 * La version précédente comparait les proportions de la silhouette détourée à
 * celles d'une carte (63×88 mm). Depuis le détourage géométrique, cette
 * silhouette est le résultat d'un REDRESSEMENT : ses proportions sont imposées
 * par nous, jamais par la photo. On mesurait donc notre propre sortie, et le
 * score valait ~99 % quoi qu'il arrive — Remy l'a relevé le 19 août 2026 sur
 * des photos manifestement mal cadrées. Un indicateur qui désinforme est pire
 * qu'un indicateur absent.
 *
 * On mesure maintenant le cadrage là où il existe vraiment : le quadrilatère
 * de la carte DANS LA PHOTO D'ORIGINE. Trois questions, toutes vérifiables :
 *   1. la carte est-elle assez grande dans le cadre (sinon peu de pixels utiles) ;
 *   2. reste-t-il du fond tout autour (sinon la carte est coupée, et le
 *      détourage — qui échantillonne le fond aux 4 coins — n'a plus de repère) ;
 *   3. la photo est-elle prise de face (l'angle est corrigé, mais un angle
 *      extrême étire la texture et abîme la lecture du numéro).
 */

export type FramingIssue = "far" | "edge" | "skew" | null;

export interface FramingResult {
  score: number;
  issue: FramingIssue;
}

/** Aire d'un quadrilatère quelconque (formule du lacet). */
function quadArea(q: Corner[]): number {
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const p = q[i];
    const n = q[(i + 1) % 4];
    a += p.x * n.y - n.x * p.y;
  }
  return Math.abs(a) / 2;
}

/** Interpolation linéaire bornée : renvoie 0 en `lo`, 100 en `hi`. */
function ramp(v: number, lo: number, hi: number): number {
  if (hi === lo) return 100;
  return Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
}

/** Écart maximal des 4 angles à l'angle droit, en degrés. */
function maxSkewDegrees(q: Corner[]): number {
  let worst = 0;
  for (let i = 0; i < 4; i++) {
    const prev = q[(i + 3) % 4];
    const cur = q[i];
    const next = q[(i + 1) % 4];
    const ax = prev.x - cur.x;
    const ay = prev.y - cur.y;
    const bx = next.x - cur.x;
    const by = next.y - cur.y;
    const na = Math.hypot(ax, ay);
    const nb = Math.hypot(bx, by);
    if (na < 1e-6 || nb < 1e-6) continue;
    const cos = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (na * nb)));
    worst = Math.max(worst, Math.abs((Math.acos(cos) * 180) / Math.PI - 90));
  }
  return worst;
}

/**
 * @param quad  Les 4 coins de la carte, en coordonnées de la photo d'origine.
 * @param width Largeur de cette photo.
 * @param height Hauteur de cette photo.
 */
export function computeFramingScore(quad: Corner[], width: number, height: number): FramingResult {
  if (quad.length !== 4 || width <= 0 || height <= 0) return { score: 50, issue: null };

  // 1. Occupation du cadre. Une carte qui remplit tout n'est pas un bon
  //    cadrage : il FAUT du fond autour (le détourage l'échantillonne).
  const coverage = quadArea(quad) / (width * height);
  const coverageScore =
    coverage < 0.3 ? ramp(coverage, 0.04, 0.3) : coverage <= 0.72 ? 100 : ramp(coverage, 0.97, 0.72);

  // 2. Marge de fond : distance du coin le plus proche d'un bord de la photo,
  //    rapportée au petit côté. Zéro = carte tronquée, défaut rédhibitoire.
  const shortSide = Math.min(width, height);
  let margin = Infinity;
  for (const p of quad) {
    margin = Math.min(margin, p.x, p.y, width - p.x, height - p.y);
  }
  const marginScore = ramp(margin / shortSide, 0.002, 0.05);

  // 3. Angle de prise de vue.
  const skew = maxSkewDegrees(quad);
  const skewScore = ramp(skew, 20, 3);

  // La moyenne seule laissait passer l'inacceptable : une carte occupant 4 %
  // du cadre, ou collée au bord, ressortait encore autour de 60 %. On plafonne
  // par le point le plus faible — un cadrage ne vaut pas mieux que son pire
  // défaut. (Vérifié sur banc d'essai : carte qui remplit tout → 20, carte qui
  // touche un bord → 20, carte minuscule → 22, bien cadrée → 96.)
  const worst = Math.min(coverageScore, marginScore, skewScore);
  const score = Math.round(Math.min(coverageScore * 0.35 + marginScore * 0.4 + skewScore * 0.25, worst + 20));

  // On nomme le défaut dominant, pour pouvoir donner un conseil utile plutôt
  // qu'un pourcentage sec.
  let issue: FramingIssue = null;
  if (worst < 60) {
    if (worst === marginScore) issue = "edge";
    else if (worst === coverageScore) issue = coverage < 0.3 ? "far" : "edge";
    else issue = "skew";
  }

  return { score: Math.max(0, Math.min(100, score)), issue };
}
