/**
 * Contrôles qualité réels, sans modèle, entièrement dans le navigateur.
 */

import type { Corner } from "@/lib/wizard/image-utils";

/** Largeur de travail : on juge la netteté à la taille où la carte servira. */
const WORK_WIDTH = 900;

/**
 * Netteté — méthode « re-flouter pour voir ce qu'on perd ».
 *
 * Pourquoi pas la variance du laplacien (version précédente) : elle était
 * calculée après réduction de TOUTE la photo à 240 px de côté. Réduire une
 * photo de téléphone de 4000 px, c'est en moyenner 17×17 pixels — le détail
 * fin disparaît, et d'autant plus que le capteur est bon. Une photo mobile
 * parfaitement nette ressortait à « Netteté 0 % » (constaté par Remy le
 * 19 août 2026) pendant qu'une petite image importée passait, parce que le
 * seuil avait été calibré sur ces dernières. La mesure dépendait donc de la
 * définition du fichier, pas de la netteté.
 *
 * Ici on mesure sur la CARTE (le fond n'a aucune raison d'être net) ramenée à
 * une largeur FIXE, puis on compare l'image à une version volontairement
 * floutée : une image déjà floue change peu, une image nette perd beaucoup.
 * Le résultat est un rapport — insensible à l'exposition, au contraste et à la
 * définition du fichier (méthode de Crete et al., « The Blur Effect »).
 *
 * @param quad Coins de la carte dans la photo, si déjà connus. À défaut, on
 *             mesure le centre du cadre — là où on demande de poser la carte.
 */
export function computeSharpnessScore(image: HTMLImageElement, quad?: Corner[]): number {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (iw < 16 || ih < 16) return 50;

  let bx: number;
  let by: number;
  let bw: number;
  let bh: number;
  if (quad && quad.length === 4) {
    const xs = quad.map((p) => p.x);
    const ys = quad.map((p) => p.y);
    bx = Math.max(0, Math.floor(Math.min(...xs)));
    by = Math.max(0, Math.floor(Math.min(...ys)));
    bw = Math.min(iw - bx, Math.ceil(Math.max(...xs)) - bx);
    bh = Math.min(ih - by, Math.ceil(Math.max(...ys)) - by);
  } else {
    bw = Math.round(iw * 0.6);
    bh = Math.round(ih * 0.6);
    bx = Math.round((iw - bw) / 2);
    by = Math.round((ih - bh) / 2);
  }
  if (bw < 16 || bh < 16) return 50;

  // On réduit jusqu'à la largeur de travail, jamais on n'agrandit : agrandir
  // n'ajoute aucun détail et ferait payer deux fois une photo peu définie,
  // déjà sanctionnée par l'indicateur de résolution.
  const s = Math.min(WORK_WIDTH / bw, 1);
  const w = Math.max(16, Math.round(bw * s));
  const h = Math.max(16, Math.round(bh * s));

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, bx, by, bw, bh, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }

  const blurH = boxBlur(gray, w, h, true);
  const blurV = boxBlur(gray, w, h, false);

  const bh_ = blurRatio(gray, blurH, w, h, true);
  const bv_ = blurRatio(gray, blurV, w, h, false);
  const blur = Math.max(bh_, bv_); // 0 = franc, 1 = complètement flou

  // Bornes calibrées sur banc d'essai (19 août 2026, visuel Pikachu 1600 px
  // ramené à la largeur de travail) : image franche → 0,40 ; même image
  // floutée de 1 px → 0,54 ; de 2 px → 0,69 ; de 4 px → 0,80. On place donc le
  // « à reprendre » à 0,68 et le « franchement net » à 0,32. À revoir sur de
  // vraies prises de vue mobiles — c'est le seul réglage à l'œil qui reste.
  const score = ((0.68 - blur) / (0.68 - 0.32)) * 100;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Moyenne glissante sur 9 pixels, horizontale ou verticale. */
function boxBlur(src: Float32Array, w: number, h: number, horizontal: boolean): Float32Array {
  const out = new Float32Array(w * h);
  const R = 4; // 9 pixels au total
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -R; k <= R; k++) {
        const xx = horizontal ? Math.min(w - 1, Math.max(0, x + k)) : x;
        const yy = horizontal ? y : Math.min(h - 1, Math.max(0, y + k));
        sum += src[yy * w + xx];
      }
      out[y * w + x] = sum / (R * 2 + 1);
    }
  }
  return out;
}

/**
 * Part de la variation locale que le floutage NE fait PAS disparaître :
 * proche de 1, l'image était déjà floue ; proche de 0, elle était franche.
 */
function blurRatio(src: Float32Array, blurred: Float32Array, w: number, h: number, horizontal: boolean): number {
  let sumD = 0;
  let sumV = 0;
  const x0 = horizontal ? 1 : 0;
  const y0 = horizontal ? 0 : 1;
  for (let y = y0; y < h; y++) {
    for (let x = x0; x < w; x++) {
      const i = y * w + x;
      const j = horizontal ? i - 1 : i - w;
      const d = Math.abs(src[i] - src[j]);
      const db = Math.abs(blurred[i] - blurred[j]);
      sumD += d;
      sumV += Math.max(0, d - db);
    }
  }
  if (sumD < 1e-6) return 1; // aucune variation : rien de net à voir
  return (sumD - sumV) / sumD;
}

/** Récompense les photos qui ont assez de pixels pour zoomer sans bouillie. */
export function computeResolutionScore(image: HTMLImageElement): number {
  const longSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const MIN_GOOD = 1400;
  return Math.max(0, Math.min(100, Math.round((longSide / MIN_GOOD) * 100)));
}
