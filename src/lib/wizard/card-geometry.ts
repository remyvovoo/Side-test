import { loadImage } from "./image-utils";

/**
 * Détourage GÉOMÉTRIQUE : au lieu de découper la carte le long de la frontière
 * d'un masque calculé pixel par pixel (qui épouse ses propres imperfections —
 * d'où l'oscillation entre halo de fond et carte rognée), on exploite ce qu'on
 * sait de l'objet : une carte à collectionner est un RECTANGLE aux coins
 * arrondis, de proportions connues (63 × 88 mm).
 *
 * On ajuste donc les 4 droites de ses bords sur le nuage de points du contour,
 * on les intersecte pour obtenir les 4 coins exacts, puis on redresse le
 * quadrilatère vers un rectangle droit (correction de perspective offerte au
 * passage) avec des coins arrondis reconstruits proprement.
 *
 * Renvoie null si la forme trouvée n'est pas plausible : l'appelant garde
 * alors le détourage pixel classique.
 */

export interface Pt {
  x: number;
  y: number;
}

/** Proportions d'une carte standard (63 × 88 mm). */
const CARD_RATIO = 88 / 63;

/**
 * Marge de contexte rendue autour du rectangle nominal : c'est dans cette
 * bande qu'on va lire le VRAI bord de la carte (voir traceSilhouette).
 */
const PAD_RATIO = 0.05;
/** Creux maximal accepté vers l'intérieur : éclat, coin écorné, bord mordu. */
const MAX_BITE_RATIO = 0.07;
/** Débord maximal accepté vers l'extérieur : carte gondolée, bord bombé. */
const MAX_BULGE_RATIO = 0.02;
/** Marche de luminosité minimale pour croire à un bord quand la couleur ne dit rien. */
const EDGE_MIN_STEP = 10;

/** Droite sous forme (a,b,c) avec a·x + b·y = c, (a,b) unitaire. */
interface Line {
  a: number;
  b: number;
  c: number;
}

/**
 * Droite des moindres carrés « totale » (accepte les droites verticales,
 * contrairement à une régression y = f(x)) : on prend le centre de gravité et
 * la direction principale du nuage.
 */
function fitLine(pts: Pt[]): Line | null {
  const n = pts.length;
  if (n < 8) return null;
  let mx = 0;
  let my = 0;
  for (const p of pts) {
    mx += p.x;
    my += p.y;
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of pts) {
    const dx = p.x - mx;
    const dy = p.y - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  // Direction principale = vecteur propre dominant de la matrice de covariance.
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const dirX = Math.cos(theta);
  const dirY = Math.sin(theta);
  // Normale à la direction → forme a·x + b·y = c.
  const a = -dirY;
  const b = dirX;
  return { a, b, c: a * mx + b * my };
}

/** Rejette les points trop éloignés de la droite, puis réajuste (robustesse). */
function fitLineRobust(pts: Pt[]): Line | null {
  let line = fitLine(pts);
  if (!line) return null;
  for (let pass = 0; pass < 2; pass++) {
    const dists = pts.map((p) => Math.abs(line!.a * p.x + line!.b * p.y - line!.c));
    const sorted = [...dists].sort((u, v) => u - v);
    const median = sorted[Math.floor(sorted.length / 2)];
    const tol = Math.max(1.5, median * 2.5);
    const kept = pts.filter((_, i) => dists[i] <= tol);
    const next = fitLine(kept);
    if (!next) break;
    line = next;
  }
  return line;
}

function intersect(l1: Line, l2: Line): Pt | null {
  const det = l1.a * l2.b - l2.a * l1.b;
  if (Math.abs(det) < 1e-6) return null; // droites parallèles
  return {
    x: (l1.c * l2.b - l2.c * l1.b) / det,
    y: (l1.a * l2.c - l2.a * l1.c) / det,
  };
}

/**
 * Ajuste le quadrilatère de la carte sur un masque binaire.
 * Coordonnées renvoyées dans le repère du masque (à remettre à l'échelle).
 */
export function fitCardQuad(mask: Uint8Array, w: number, h: number): Pt[] | null {
  // Points de bord : pour chaque ligne, le premier et le dernier pixel de
  // carte ; idem pour chaque colonne. On IGNORE les extrémités (20 % de part
  // et d'autre) : c'est là que se trouvent les coins arrondis, qui tireraient
  // les droites vers l'intérieur.
  const left: Pt[] = [];
  const right: Pt[] = [];
  const top: Pt[] = [];
  const bottom: Pt[] = [];

  let minY = h;
  let maxY = -1;
  let minX = w;
  let maxX = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  if (maxY <= minY || maxX <= minX) return null;

  const marginY = (maxY - minY) * 0.2;
  const marginX = (maxX - minX) * 0.2;

  for (let y = Math.ceil(minY + marginY); y <= maxY - marginY; y++) {
    let first = -1;
    let last = -1;
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        if (first < 0) first = x;
        last = x;
      }
    }
    if (first >= 0) {
      left.push({ x: first, y });
      right.push({ x: last, y });
    }
  }
  for (let x = Math.ceil(minX + marginX); x <= maxX - marginX; x++) {
    let first = -1;
    let last = -1;
    for (let y = 0; y < h; y++) {
      if (mask[y * w + x]) {
        if (first < 0) first = y;
        last = y;
      }
    }
    if (first >= 0) {
      top.push({ x, y: first });
      bottom.push({ x, y: last });
    }
  }

  const lL = fitLineRobust(left);
  const lR = fitLineRobust(right);
  const lT = fitLineRobust(top);
  const lB = fitLineRobust(bottom);
  if (!lL || !lR || !lT || !lB) return null;

  const tl = intersect(lT, lL);
  const tr = intersect(lT, lR);
  const br = intersect(lB, lR);
  const bl = intersect(lB, lL);
  if (!tl || !tr || !br || !bl) return null;

  const quad = [tl, tr, br, bl];

  // Plausibilité : coins dans l'image (avec marge), angles proches de 90°,
  // proportions d'une carte. Sinon on laisse la main au détourage classique.
  const pad = Math.max(w, h) * 0.06;
  for (const p of quad) {
    if (p.x < -pad || p.y < -pad || p.x > w + pad || p.y > h + pad) return null;
  }
  const dist = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.y - q.y);
  const wTop = dist(tl, tr);
  const wBot = dist(bl, br);
  const hLeft = dist(tl, bl);
  const hRight = dist(tr, br);
  if (Math.min(wTop, wBot) / Math.max(wTop, wBot) < 0.8) return null;
  if (Math.min(hLeft, hRight) / Math.max(hLeft, hRight) < 0.8) return null;
  const ratio = ((hLeft + hRight) / 2) / ((wTop + wBot) / 2);
  if (ratio < 1.15 || ratio > 1.65) return null;
  for (let i = 0; i < 4; i++) {
    const prev = quad[(i + 3) % 4];
    const cur = quad[i];
    const next = quad[(i + 1) % 4];
    const v1x = prev.x - cur.x;
    const v1y = prev.y - cur.y;
    const v2x = next.x - cur.x;
    const v2y = next.y - cur.y;
    const cos =
      (v1x * v2x + v1y * v2y) / (Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y) || 1);
    if (Math.abs(cos) > 0.26) return null; // > ~15° d'écart à l'angle droit
  }
  return quad;
}

/* ------------------------------------------------------------------ *
 *  Affinage des 4 bords par MARCHE DE LUMINOSITÉ, avec vote sur toute
 *  la longueur du côté.
 * ------------------------------------------------------------------ */

/** Recherche vers l'extérieur, en fraction du petit côté de la carte. */
const REFINE_OUT_RATIO = 0.06;
/** Correction vers l'intérieur, volontairement faible : la piste issue du
 *  masque sous-estime presque toujours la carte, jamais l'inverse. */
const REFINE_IN_RATIO = 0.015;
/** Nombre de points de mesure répartis le long d'un côté. */
const REFINE_SAMPLES = 160;
/** Marche minimale (sur 255) pour qu'un bord soit crédible. */
const REFINE_MIN_STEP = 4;

interface EdgeCandidate {
  /** Décalage perpendiculaire par rapport à la droite de départ (négatif = vers l'extérieur). */
  t: number;
  /** Force de la marche, en niveaux de gris. */
  score: number;
}

/** Luminance échantillonnée en sous-pixel (bilinéaire). */
function sampleLum(lum: Float32Array, w: number, h: number, x: number, y: number): number {
  if (x < 0 || y < 0 || x > w - 2 || y > h - 2) return NaN;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * w + x0;
  const top = lum[i] * (1 - fx) + lum[i + 1] * fx;
  const bot = lum[i + w] * (1 - fx) + lum[i + w + 1] * fx;
  return top * (1 - fy) + bot * fy;
}

function medianOf(a: number[]): number {
  if (!a.length) return 0;
  const s = [...a].sort((p, q) => p - q);
  return s[s.length >> 1];
}

/**
 * Profil de « force de bord » le long d'un côté, offset par offset.
 *
 * Pour chaque décalage perpendiculaire, on mesure la marche de luminosité en
 * une centaine de points répartis sur le côté, et on en prend la MÉDIANE.
 * C'est tout le principe : un vrai bord de carte est une marche qui se répète
 * sur toute la longueur, alors qu'un reflet, une poussière ou le grain du
 * capteur ne se répètent nulle part. Un liseré argenté à peine plus sombre que
 * la table donne un signal faible en un point — mais massif une fois qu'un
 * millier de points disent la même chose.
 */
function edgeProfile(
  lum: Float32Array,
  w: number,
  h: number,
  p0: Pt,
  p1: Pt,
  tMin: number,
  tMax: number
): { t: number; score: number }[] {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy);
  if (len < 8) return [];
  const ux = dx / len;
  const uy = dy / len;
  // Normale sortante pour un quadrilatère parcouru TL→TR→BR→BL (y vers le bas).
  const nx = uy;
  const ny = -ux;

  const out: { t: number; score: number }[] = [];
  for (let t = tMin; t <= tMax; t += 0.5) {
    const steps: number[] = [];
    for (let s = 0; s < REFINE_SAMPLES; s++) {
      // On saute les extrémités : ce sont les coins, arrondis ou écornés.
      const f = 0.08 + (s / (REFINE_SAMPLES - 1)) * 0.84;
      const bx = p0.x + ux * len * f + nx * t;
      const by = p0.y + uy * len * f + ny * t;
      const a = sampleLum(lum, w, h, bx + nx * 1.5, by + ny * 1.5);
      const b = sampleLum(lum, w, h, bx - nx * 1.5, by - ny * 1.5);
      if (!Number.isNaN(a) && !Number.isNaN(b)) steps.push(Math.abs(a - b));
    }
    if (steps.length > REFINE_SAMPLES * 0.5) out.push({ t, score: medianOf(steps) });
  }
  return out;
}

/** Les meilleurs sommets du profil, séparés d'au moins `minGap` pixels. */
function topPeaks(profile: { t: number; score: number }[], count: number, minGap: number): EdgeCandidate[] {
  const peaks: EdgeCandidate[] = [];
  for (let i = 1; i < profile.length - 1; i++) {
    if (profile[i].score >= profile[i - 1].score && profile[i].score > profile[i + 1].score) {
      peaks.push({ t: profile[i].t, score: profile[i].score });
    }
  }
  peaks.sort((a, b) => b.score - a.score);
  const kept: EdgeCandidate[] = [];
  for (const p of peaks) {
    if (kept.length >= count) break;
    if (kept.every((k) => Math.abs(k.t - p.t) >= minGap)) kept.push(p);
  }
  return kept.length ? kept : [{ t: 0, score: 0 }];
}

/** Droite passant par `p` et dirigée par `d`, sous forme a·x + b·y = c. */
function lineFrom(p: Pt, dx: number, dy: number): Line {
  const len = Math.hypot(dx, dy) || 1;
  const a = -dy / len;
  const b = dx / len;
  return { a, b, c: a * p.x + b * p.y };
}

/**
 * Repositionne les 4 bords du quadrilatère sur les vraies arêtes de la carte.
 *
 * POURQUOI. Jusqu'ici un pixel n'appartenait à la carte que si sa COULEUR
 * différait du fond. Mesuré sur le Zébibron de Remy (19 août 2026) : le liseré
 * argenté est à 6,5 d'écart de teinte avec la table — sous le plancher de 16 —
 * alors qu'il est 53 niveaux PLUS SOMBRE. Notre immunité aux ombres (« plus
 * sombre, même teinte → c'est une ombre, on ignore ») est exactement ce qui
 * nous rendait aveugles aux bordures grises, blanches ou noires. Le masque
 * s'arrêtait donc à la zone imprimée et le cadre rentrait DANS la carte.
 *
 * COMMENT. On ne demande plus « ce pixel est-il de la carte ? » mais « où est
 * la marche de luminosité qui se répète sur tout le côté ? ». La médiane des
 * marches le long du bord fait le tri toute seule : le grain du capteur et les
 * reflets ne s'alignent sur rien, un bord de carte s'aligne sur mille points.
 *
 * ARBITRAGE. Plusieurs marches peuvent coexister (bord de la zone imprimée,
 * bord de la carte, ligne d'ombre portée). On garde les meilleurs candidats de
 * chaque côté et on retient la combinaison qui donne les PROPORTIONS D'UNE
 * CARTE — le ratio départage, il n'impose rien.
 *
 * Ce qui sort d'ici n'est qu'une fenêtre de recherche : le contour final reste
 * relevé point par point sur l'image redressée (voir traceSilhouette), éclats
 * et coins écornés compris.
 */
export function refineQuadByGradient(img: HTMLImageElement, quad: Pt[], outRatio = REFINE_OUT_RATIO): Pt[] {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (quad.length !== 4 || w < 32 || h < 32) return quad;

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return quad;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    lum[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  }

  const dist = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.y - q.y);
  const side = Math.min(
    (dist(quad[0], quad[1]) + dist(quad[3], quad[2])) / 2,
    (dist(quad[0], quad[3]) + dist(quad[1], quad[2])) / 2
  );
  // La normale des côtés pointe vers l'EXTÉRIEUR : t positif éloigne du centre.
  // On cherche donc loin vers l'extérieur (le masque couleur sous-estime la
  // carte quand le liseré a le ton du fond) et à peine vers l'intérieur.
  const tMin = -Math.max(2, side * REFINE_IN_RATIO);
  const tMax = Math.max(6, side * outRatio);
  const minGap = Math.max(3, side * 0.012);

  // Un côté = deux coins consécutifs. Ordre TL→TR→BR→BL.
  const candidates: EdgeCandidate[][] = [];
  for (let i = 0; i < 4; i++) {
    const p0 = quad[i];
    const p1 = quad[(i + 1) % 4];
    const profile = edgeProfile(lum, w, h, p0, p1, tMin, tMax);
    candidates.push(profile.length ? topPeaks(profile, 3, minGap) : [{ t: 0, score: 0 }]);
  }

  // Aucun bord crédible nulle part : on ne touche à rien.
  if (candidates.every((cs) => cs[0].score < REFINE_MIN_STEP)) return quad;

  // LE LISERÉ FAIT LA MÊME LARGEUR SUR LES QUATRE CÔTÉS.
  //
  // Quand un côté ne présente aucune marche franche alors que les autres sont
  // nets, on n'a pas à deviner : la carte nous donne elle-même la réponse. Sur
  // le Zébibron de Remy, le bord haut hésitait entre la limite d'impression
  // (score 23) et l'arête réelle (20) pendant que gauche et droite tranchaient
  // sans ambiguïté à 39 — l'information était sous nos yeux, inutilisée.
  const strong = candidates
    .map((cs, i) => ({ i, t: cs[0].t, score: cs[0].score }))
    .filter((c) => c.score >= REFINE_MIN_STEP * 2.5);
  if (strong.length >= 2) {
    const widthRef = medianOf(strong.map((c) => c.t));
    for (let i = 0; i < 4; i++) {
      if (strong.some((c) => c.i === i)) continue;
      // Côté faible : on ne le laisse pas partir loin de la largeur mesurée
      // ailleurs. Le candidat le plus proche de cette largeur l'emporte ; s'il
      // n'y en a aucun de crédible, on adopte la largeur elle-même.
      const near = candidates[i].reduce((best, k) =>
        Math.abs(k.t - widthRef) < Math.abs(best.t - widthRef) ? k : best
      );
      candidates[i] = Math.abs(near.t - widthRef) <= side * 0.02 ? [near] : [{ t: widthRef, score: 0 }];
    }
  }

  const maxScore = candidates.map((cs) => Math.max(...cs.map((k) => k.score), 1e-6));

  // Pour chaque côté, la marche crédible la plus EXTÉRIEURE. Quand deux marches
  // coexistent — la frontière de la zone imprimée et l'arête de la carte —
  // c'est toujours la plus extérieure qui borde la carte : au-delà il n'y a que
  // du fond, en deçà c'est du décor imprimé. Sans ce repère, une carte à
  // illustration sombre cerclée d'un liseré clair se faisait amputer de son
  // liseré, la frontière interne étant la plus CONTRASTÉE des deux.
  const outermost = candidates.map((cs, i) => {
    const credible = cs.filter((k) => k.score >= maxScore[i] * 0.45);
    return credible.reduce((best, k) => (k.t > best.t ? k : best), credible[0]);
  });

  let bestQuad = quad;
  let bestValue = -Infinity;
  const idx = [0, 0, 0, 0];
  const total = candidates.reduce((n, cs) => n * cs.length, 1);
  for (let combo = 0; combo < total; combo++) {
    let rest = combo;
    for (let i = 0; i < 4; i++) {
      idx[i] = rest % candidates[i].length;
      rest = Math.floor(rest / candidates[i].length);
    }
    const lines: Line[] = [];
    for (let i = 0; i < 4; i++) {
      const p0 = quad[i];
      const p1 = quad[(i + 1) % 4];
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy) || 1;
      const t = candidates[i][idx[i]].t;
      const moved = { x: p0.x + (dy / len) * t, y: p0.y + (-dx / len) * t };
      lines.push(lineFrom(moved, dx, dy));
    }
    const corners: Pt[] = [];
    let ok = true;
    for (let i = 0; i < 4; i++) {
      const p = intersect(lines[(i + 3) % 4], lines[i]);
      if (!p) {
        ok = false;
        break;
      }
      corners.push(p);
    }
    if (!ok) continue;

    const wq = (dist(corners[0], corners[1]) + dist(corners[3], corners[2])) / 2;
    const hq = (dist(corners[0], corners[3]) + dist(corners[1], corners[2])) / 2;
    if (wq < 16 || hq < 16) continue;
    const ratio = hq / wq;
    if (ratio < 1.15 || ratio > 1.7) continue;

    // Trois juges, et il en faut bien trois.
    //
    // 1. La FORCE des marches, normalisée par côté.
    // 2. Les PROPORTIONS. Poids élevé : mesuré sur le Zébibron, le bord haut
    //    présente deux marches presque aussi franches — la limite de la zone
    //    imprimée (23) et l'arête réelle de la carte (20). À poids faible, la
    //    première gagnait d'un cheveu et la carte ressortait amputée de son
    //    liseré en haut seulement.
    // 3. La COHÉRENCE des quatre décalages. Le ratio contraint la forme, pas la
    //    position : une combinaison qui prend l'arête réelle à droite et la
    //    limite d'impression à gauche donne un rectangle aux bonnes proportions,
    //    simplement décalé — c'est exactement ce qui s'est produit au premier
    //    essai. Or un liseré fait la MÊME LARGEUR sur les quatre côtés : les
    //    quatre décalages doivent donc se ressembler. C'est ce juge-là qui
    //    ancre le rectangle au bon endroit.
    //
    // Aucun des trois n'invente quoi que ce soit : ils départagent des arêtes
    // réellement mesurées. Le contour final, lui, reste relevé point par point.
    let strength = 0;
    let tMinSel = Infinity;
    let tMaxSel = -Infinity;
    for (let i = 0; i < 4; i++) {
      const cand = candidates[i][idx[i]];
      strength += cand.score / maxScore[i];
      // Prime au bord crédible le plus extérieur (voir `outermost`).
      if (cand.t === outermost[i].t) strength += 0.6;
      if (cand.t < tMinSel) tMinSel = cand.t;
      if (cand.t > tMaxSel) tMaxSel = cand.t;
    }
    const spread = (tMaxSel - tMinSel) / side;
    const value = strength - 25 * Math.abs(ratio / CARD_RATIO - 1) - 30 * spread;
    if (value > bestValue) {
      bestValue = value;
      bestQuad = corners;
    }
  }

  return bestQuad;
}

/** Homographie envoyant le rectangle destination (w×h) sur le quadrilatère source. */
function homography(quad: Pt[], w: number, h: number): number[] {
  // Résout H tel que H·(x,y,1) = source, pour les 4 coins du rectangle.
  const [p0, p1, p2, p3] = quad; // TL, TR, BR, BL
  const x0 = 0,
    y0 = 0,
    x1 = w,
    y1 = 0,
    x2 = w,
    y2 = h,
    x3 = 0,
    y3 = h;
  const A: number[][] = [];
  const b: number[] = [];
  const src = [p0, p1, p2, p3];
  const dst = [
    { x: x0, y: y0 },
    { x: x1, y: y1 },
    { x: x2, y: y2 },
    { x: x3, y: y3 },
  ];
  for (let i = 0; i < 4; i++) {
    const { x: X, y: Y } = dst[i];
    const { x: u, y: v } = src[i];
    A.push([X, Y, 1, 0, 0, 0, -X * u, -Y * u]);
    b.push(u);
    A.push([0, 0, 0, X, Y, 1, -X * v, -Y * v]);
    b.push(v);
  }
  // Élimination de Gauss sur le système 8×8.
  const n = 8;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col];
    if (Math.abs(d) < 1e-12) return [1, 0, 0, 0, 1, 0, 0, 0];
    for (let c = col; c <= n; c++) M[col][c] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (!f) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row) => row[n]);
}

/**
 * Redresse la carte : le quadrilatère source devient un rectangle droit aux
 * proportions d'une carte. C'est ici que la correction de perspective se fait
 * (une photo prise de biais redevient une carte droite).
 *
 * RÈGLE PRODUIT (Remy, 19 août 2026) : on corrige l'ANGLE DE PRISE DE VUE,
 * jamais la carte. La silhouette est une donnée d'ÉTAT — coins carrés des
 * anciennes séries, coins écornés, bords mordus : l'acheteur doit les voir.
 * On ne découpe donc PAS un rectangle aux coins arrondis idéaux : les droites
 * ajustées disent seulement OÙ CHERCHER le bord, et le contour final est lu
 * sur l'image redressée, à pleine résolution (voir traceSilhouette).
 */
export async function rectifyCard(
  img: HTMLImageElement,
  quad: Pt[]
): Promise<HTMLImageElement> {
  const dist = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.y - q.y);
  const [tl, tr, br, bl] = quad;
  // Largeur cible = plus grand bord mesuré (on ne perd pas de définition),
  // hauteur déduite des proportions officielles : la perspective est corrigée.
  const outW = Math.round(Math.max(dist(tl, tr), dist(bl, br)));
  const outH = Math.round(outW * CARD_RATIO);
  const H = homography(quad, outW, outH);
  // On rend un peu PLUS que le rectangle nominal : cette marge de fond est ce
  // qui permet ensuite de retrouver le vrai bord, y compris s'il déborde
  // (carte gondolée) ou s'il rentre (éclat).
  const pad = Math.max(6, Math.round(outW * PAD_RATIO));
  const PW = outW + pad * 2;
  const PH = outH + pad * 2;

  const srcCanvas = document.createElement("canvas");
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  srcCanvas.width = sw;
  srcCanvas.height = sh;
  const sctx = srcCanvas.getContext("2d", { willReadFrequently: true })!;
  sctx.drawImage(img, 0, 0);
  const srcData = sctx.getImageData(0, 0, sw, sh).data;

  const out = document.createElement("canvas");
  out.width = PW;
  out.height = PH;
  const octx = out.getContext("2d")!;
  const dstImage = octx.createImageData(PW, PH);
  const dst = dstImage.data;
  // Pixels réellement échantillonnés dans la photo source (le reste est hors
  // cadre : ni carte, ni fond mesurable).
  const valid = new Uint8Array(PW * PH);

  const [h0, h1, h2, h3, h4, h5, h6, h7] = H;
  for (let py = 0; py < PH; py++) {
    for (let px = 0; px < PW; px++) {
      const x = px - pad;
      const y = py - pad;
      const denom = h6 * x + h7 * y + 1;
      const u = (h0 * x + h1 * y + h2) / denom;
      const v = (h3 * x + h4 * y + h5) / denom;
      const i = (py * PW + px) * 4;
      if (u < 0 || v < 0 || u >= sw - 1 || v >= sh - 1) {
        dst[i + 3] = 0;
        continue;
      }
      // Échantillonnage bilinéaire : bords lisses, texte net.
      const x0 = Math.floor(u);
      const y0 = Math.floor(v);
      const fx = u - x0;
      const fy = v - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + sw * 4;
      const i11 = i01 + 4;
      for (let c = 0; c < 3; c++) {
        const top = srcData[i00 + c] * (1 - fx) + srcData[i10 + c] * fx;
        const bot = srcData[i01 + c] * (1 - fx) + srcData[i11 + c] * fx;
        dst[i + c] = top * (1 - fy) + bot * fy;
      }
      dst[i + 3] = 255;
      valid[py * PW + px] = 1;
    }
  }

  // Le contour réel, lu sur l'image redressée à pleine résolution.
  traceSilhouette(dst, valid, PW, PH, pad);
  octx.putImageData(dstImage, 0, 0);

  return loadImage(cropToAlpha(out).toDataURL("image/png"));
}

/** Médiane sur une petite fenêtre (tolère les tableaux vides). */
function median(a: number[]): number {
  if (!a.length) return 0;
  const s = [...a].sort((p, q) => p - q);
  return s[s.length >> 1];
}

/**
 * Poids de la CONTINUITÉ du bord, en unités de preuve par pixel d'écart entre
 * deux lignes voisines. Trop bas : le contour tremble. Trop haut : un éclat se
 * fait raboter. Réglé au banc d'essai sur un éclat de 26 px.
 */
const CONTOUR_STIFFNESS = 0.42;

/** Coût de l'écart à la droite ajustée, à pleine profondeur d'éclat. */
const STRAIGHT_PULL = 2.6;

/**
 * Relève le contour d'un côté EN UNE SEULE FOIS, et non ligne par ligne.
 *
 * POURQUOI CETTE RÉÉCRITURE (19 août 2026). Chaque ligne décidait seule où
 * était le bord : mille lignes, mille décisions indépendantes. Quand le signal
 * est faible — un liseré argenté sur une table claire, à 6,5 d'écart de teinte
 * quand le seuil de bruit est à 16 — une ligne sur trois se trompait, et comme
 * les erreurs étaient indépendantes elles ne se compensaient pas : elles se
 * voyaient. Le peigne en haut du rendu, la marche sur le bord droit, le contour
 * dentelé : trois symptômes de la MÊME faute de méthode. Les cinq rustines
 * successives (médiane à 3, rejet des saillies, consensus, interpolation,
 * lissage médian) tentaient de recoller après coup des décisions qui n'auraient
 * jamais dû être prises séparément — et l'une d'elles a créé la marche.
 *
 * CE QU'ON FAIT MAINTENANT. On cherche le contour, sur tout le côté, qui
 * maximise la somme des preuves tout en restant CONTINU. Deux forces en
 * tension, et une seule optimisation qui les arbitre :
 *   - ce que disent les pixels à chaque profondeur possible ;
 *   - le fait qu'un bord de carte ne saute pas de 30 px d'une ligne à l'autre.
 * Un éclat a une preuve forte et localisée : il l'emporte sur la continuité,
 * donc il est CONSERVÉ. Le bruit, faible et isolé, perd. Rien n'est lissé après
 * coup : la régularité fait partie de la question posée.
 *
 * Résolu exactement par programmation dynamique, en une passe par côté.
 */
function solveContour(
  evidence: Float32Array,
  lines: number,
  depths: number,
  stiffness: number
): Float32Array {
  const cost = new Float32Array(lines * depths);
  const from = new Int32Array(lines * depths);
  const row = new Float32Array(depths);

  for (let d = 0; d < depths; d++) cost[d] = -evidence[d];

  for (let i = 1; i < lines; i++) {
    const prev = (i - 1) * depths;
    const cur = i * depths;
    // Enveloppe inférieure du coût précédent pénalisé en |Δ| : deux passes
    // suffisent (aller puis retour), d'où un coût linéaire et non quadratique.
    for (let d = 0; d < depths; d++) {
      row[d] = cost[prev + d];
      from[cur + d] = d;
    }
    for (let d = 1; d < depths; d++) {
      const alt = row[d - 1] + stiffness;
      if (alt < row[d]) {
        row[d] = alt;
        from[cur + d] = from[cur + d - 1];
      }
    }
    for (let d = depths - 2; d >= 0; d--) {
      const alt = row[d + 1] + stiffness;
      if (alt < row[d]) {
        row[d] = alt;
        from[cur + d] = from[cur + d + 1];
      }
    }
    for (let d = 0; d < depths; d++) cost[cur + d] = row[d] - evidence[cur + d];
  }

  // Meilleure fin, puis remontée du chemin.
  const last = (lines - 1) * depths;
  let best = 0;
  for (let d = 1; d < depths; d++) if (cost[last + d] < cost[last + best]) best = d;

  const border = new Float32Array(lines);
  let d = best;
  for (let i = lines - 1; i >= 0; i--) {
    border[i] = d;
    if (i > 0) d = from[i * depths + d];
  }
  return border;
}

/**
 * Trouve le VRAI bord de la carte et l'écrit dans le canal alpha.
 *
 * L'image reçue est déjà redressée : les 4 bords de la carte sont donc des
 * droites quasi parfaites, situées à `pad` pixels de chaque côté. Ce que le
 * relevé préserve, et qu'un rectangle arrondi idéal détruisait :
 *   - les coins CARRÉS des anciennes séries (on ne présume plus de la forme) ;
 *   - les ÉCLATS et coins écornés, qui font partie de l'état de la carte ;
 *   - les bords blanchis par l'usure, que la contraction du bord rabotait.
 *
 * Les droites ajustées ne servent que de fenêtre de recherche : le bord ne peut
 * ni rentrer au-delà d'un éclat plausible (MAX_BITE_RATIO), ni déborder au-delà
 * d'un léger gondolement (MAX_BULGE_RATIO).
 */
function traceSilhouette(
  d: Uint8ClampedArray,
  valid: Uint8Array,
  PW: number,
  PH: number,
  pad: number
): void {
  const cardW = PW - pad * 2;
  const cardH = PH - pad * 2;
  const bite = Math.round(Math.min(cardW, cardH) * MAX_BITE_RATIO);
  // La fenêtre vers l'extérieur va jusqu'au bord de la marge rendue. Bornée à
  // 2 % comme avant, elle ne pouvait PAS atteindre l'arête quand la droite
  // ajustée s'était posée sur la frontière de la zone imprimée, 27 px plus
  // dedans : le vrai bord tombait hors de portée, et le relevé n'avait d'autre
  // choix que de rogner le liseré (marches vues par Remy le 21 août 2026).
  const bulge = Math.max(Math.round(Math.min(cardW, cardH) * MAX_BULGE_RATIO), pad - 2);

  const strip = Math.max(2, Math.round(pad * 0.5));
  const sampleBg = (x0: number, x1: number, y0: number, y1: number): [number, number, number] => {
    const rs: number[] = [];
    const gs: number[] = [];
    const bs: number[] = [];
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const p = y * PW + x;
        if (!valid[p]) continue;
        rs.push(d[p * 4]);
        gs.push(d[p * 4 + 1]);
        bs.push(d[p * 4 + 2]);
      }
    }
    return [median(rs), median(gs), median(bs)];
  };

  const lum = (p: number) => 0.299 * d[p * 4] + 0.587 * d[p * 4 + 1] + 0.114 * d[p * 4 + 2];
  const dist3 = (p: number, c: [number, number, number]) =>
    Math.abs(d[p * 4] - c[0]) + Math.abs(d[p * 4 + 1] - c[1]) + Math.abs(d[p * 4 + 2] - c[2]);

  /**
   * Distance au fond qui TOLÈRE L'OMBRE — réservée à ce qu'on trouve DEHORS.
   *
   * Une ombre portée, c'est le fond en plus sombre : même teinte, moins de
   * lumière. Si on la compte comme de la matière, le contour la garde et la
   * carte se retrouve cernée d'un liseré sombre (constaté par Remy le 21 août
   * 2026 en haut à droite de son Mamanbo). On ne mesure donc, dehors, que
   * l'écart de TEINTE et l'excès de clarté ; l'assombrissement seul ne compte
   * pas. Le DEDANS, lui, garde la distance complète : à l'intérieur de la
   * carte il n'y a pas d'ombre portée, et un liseré gris se distingue
   * justement du fond par sa luminosité.
   */
  const distBgSoft = (p: number, bg: [number, number, number]) => {
    const dr = d[p * 4] - bg[0];
    const dg = d[p * 4 + 1] - bg[1];
    const db = d[p * 4 + 2] - bg[2];
    const m = (dr + dg + db) / 3;
    return Math.abs(dr - m) + Math.abs(dg - m) + Math.abs(db - m) + Math.max(0, m) * 1.5;
  };

  const scanSide = (
    lines: number,
    bgAt: (line: number) => [number, number, number],
    read: (line: number, step: number) => number
  ): Float32Array => {
    const start = Math.max(0, pad - bulge);
    const depth = pad + bite;
    const depths = depth - start;
    if (depths < 3) return new Float32Array(lines).fill(pad);

    // Couleur du LISERÉ de la carte, apprise sur place.
    //
    // On ne compare plus seulement « ce pixel ressemble-t-il au fond ? » — sur
    // un liseré gris posé sur une table grise, la réponse est trop incertaine.
    // On compare « ressemble-t-il davantage au FOND ou au LISERÉ ? », et le
    // liseré, on le mesure : la grande majorité des lignes tombent juste, donc
    // la médiane de la bande juste à l'intérieur de la droite ajustée EST sa
    // couleur. Une différence de 6,5 suffit largement à trancher entre deux
    // références connues, là où elle ne suffisait pas contre un seuil fixe.
    // Couleur du liseré, apprise PAR TRANCHES le long du côté — comme le fond.
    //
    // Une couleur unique pour tout le côté échoue pour la même raison : le
    // liseré change de teinte avec l'éclairage. Mesuré sur la photo mobile de
    // Remy (Mamanbo, 21 août 2026), au niveau d'une encoche : le liseré vaut
    // rgb(155,158,151) à cet endroit, mais la moyenne du côté donnait
    // rgb(122,127,122) — assez sombre pour que le liseré paraisse plus proche
    // du fond que de la carte. La preuve au VRAI bord devenait négative
    // (−0,62) et celle de la frontière imprimée positive (+0,91) : le contour
    // n'avait aucune raison de choisir le bon bord.
    const CARD_BLOCKS = 10;
    const cardSpan = Math.max(24, Math.ceil(lines / CARD_BLOCKS));
    const learnCard = (at: (line: number) => number): [number, number, number][] => {
      const blocks: [number, number, number][] = [];
      for (let b = 0; b * cardSpan < lines; b++) {
        const cr: number[] = [];
        const cg: number[] = [];
        const cb: number[] = [];
        for (let line = b * cardSpan; line < Math.min(lines, (b + 1) * cardSpan); line++) {
          const base = at(line);
          for (let s = base + 3; s < Math.min(base + 12, depth); s++) {
            const p = read(line, Math.max(0, s));
            if (!valid[p]) continue;
            cr.push(d[p * 4]);
            cg.push(d[p * 4 + 1]);
            cb.push(d[p * 4 + 2]);
          }
        }
        blocks.push(cr.length ? [median(cr), median(cg), median(cb)] : [NaN, NaN, NaN]);
      }
      // Une tranche vide (hors carte, aux extrémités) reprend sa voisine.
      for (let i = 0; i < blocks.length; i++) {
        if (!Number.isNaN(blocks[i][0])) continue;
        const near = blocks.find((b, j) => !Number.isNaN(b[0]) && Math.abs(j - i) <= 3) ?? blocks.find((b) => !Number.isNaN(b[0]));
        blocks[i] = near ?? [0, 0, 0];
      }
      return blocks;
    };
    const cardAt = (line: number) => cardBlocks[Math.min(cardBlocks.length - 1, Math.floor(line / cardSpan))];
    // Première estimation depuis la droite ajustée, corrigée ensuite (voir plus
    // bas) : si la droite s'est posée sur la frontière imprimée, cette bande
    // n'est pas le liseré mais l'illustration, et tout le raisonnement
    // s'inverse — la mauvaise arête devient la mieux notée.
    let cardBlocks = learnCard(() => pad);
    // Écart entre les deux références : c'est l'unité dans laquelle on mesure
    // « plutôt liseré » ou « plutôt fond ». Un plancher évite de diviser par
    // presque rien quand les deux se ressemblent vraiment trop.
    const sepOf = (c: [number, number, number], b: [number, number, number]) =>
      Math.max(12, Math.abs(c[0] - b[0]) + Math.abs(c[1] - b[1]) + Math.abs(c[2] - b[2]));

    // Référence de marche : l'amplitude typique du bord sur ce côté.
    const peaks: number[] = [];
    for (let line = 0; line < lines; line += 8) {
      let mx = 0;
      for (let s = start + 1; s < depth - 1; s++) {
        const a = read(line, s + 1);
        const b = read(line, s - 1);
        if (!valid[a] || !valid[b]) continue;
        const g = Math.abs(lum(a) - lum(b));
        if (g > mx) mx = g;
      }
      peaks.push(mx);
    }
    const gRef = Math.max(EDGE_MIN_STEP, median(peaks));

    // Preuve, pour chaque ligne et chaque profondeur : « la frontière est ICI ».
    // Trois indices additionnés — la marche de luminosité, la matière au-dedans
    // qui ressemble au liseré, la matière au-dehors qui ressemble au fond.
    const evidence = new Float32Array(lines * depths);
    const fillEvidence = () => {
    for (let line = 0; line < lines; line++) {
      const base = line * depths;
      // Fond mesuré À CETTE HAUTEUR-LÀ, pas une couleur unique pour tout le
      // côté. L'éclairage varie le long du bord : là où la table s'assombrit,
      // elle ressemble au liseré, « dehors = fond » devient faux, et le contour
      // battait en retraite vers la frontière imprimée. Vérifié sur la photo de
      // Remy : son bord haut est parfaitement droit, les encoches étaient les
      // nôtres.
      const bgL = bgAt(line);
      const cardL = cardAt(line);
      const sepL = sepOf(cardL, bgL);
      for (let k = 0; k < depths; k++) {
        const s = start + k;
        const pa = read(line, Math.min(depth - 1, s + 1));
        const pb = read(line, Math.max(start, s - 1));
        const grad = valid[pa] && valid[pb] ? Math.abs(lum(pa) - lum(pb)) : 0;

        let inScore = 0;
        let inN = 0;
        for (let t = 0; t < 4; t++) {
          const p = read(line, Math.min(depth - 1, s + t));
          if (!valid[p]) continue;
          inScore += dist3(p, bgL) - dist3(p, cardL);
          inN++;
        }
        // Le DEHORS est sondé PROFONDÉMENT, le dedans non.
        //
        // Mesuré sur l'export mobile de Remy (Mamanbo, liseré argenté sur fond
        // clair, 21 août 2026) : sur une portion du bord gauche, le contour
        // s'installait 30 px À L'INTÉRIEUR, sur la frontière de la zone
        // imprimée — le liseré était rogné là, conservé ailleurs, d'où les
        // marches grises visibles dans le rendu. Les deux positions offraient
        // une marche de luminosité comparable, et quatre pixels de sonde ne
        // suffisaient pas à les départager.
        //
        // Ce qui les sépare vraiment : au-delà du VRAI bord il n'y a plus que
        // du fond, sur toute la profondeur ; au-delà de la frontière imprimée,
        // il y a encore 30 px de LISERÉ, c'est-à-dire de la carte. Sonder loin
        // vers l'extérieur rend donc la frontière interne franchement coûteuse,
        // là où quatre pixels la laissaient passer.
        let outScore = 0;
        let outN = 0;
        for (let t = 1; t <= 16; t += 2) {
          const p = read(line, Math.max(0, s - t));
          if (!valid[p]) continue;
          outScore += dist3(p, cardL) - distBgSoft(p, bgL);
          outN++;
        }
        const inside = inN ? inScore / inN / sepL : 0;
        const outside = outN ? outScore / outN / sepL : 0;
        // Les deux conditions doivent tenir ENSEMBLE, d'où le minimum et non la
        // somme. Une somme se laisse acheter par un seul terme : dans le fond,
        // « dehors = fond » était vrai et payait plus cher que « dedans =
        // carte » ne coûtait, donc le contour dérivait vers l'extérieur ; sur
        // la frontière imprimée, « dedans = carte » était vrai et compensait le
        // dehors qui, lui, était encore du liseré. Le minimum ferme les deux
        // portes à la fois : il faut du fond dehors ET de la matière dedans.
        const both = Math.min(
          Math.max(-1, Math.min(1, inside)),
          Math.max(-1, Math.min(1, outside))
        );
        // RAPPEL À LA DROITE. Un côté de carte EST une droite : les défauts
        // physiques sont locaux (un choc, un coin corné), jamais une ondulation
        // répartie sur toute la longueur. S'écarter de la droite ajustée doit
        // donc se PAYER, et seule une preuve locale forte peut le justifier —
        // c'est ce qui rend les côtés francs au lieu de légèrement tremblants.
        // Le rappel est plafonné : au-delà, un éclat profond ne serait plus
        // jamais atteignable.
        const ecart = Math.min(Math.abs(s - pad), bite) / bite;
        evidence[base + k] = Math.min(1.6, grad / gRef) + 2.2 * both - STRAIGHT_PULL * ecart;
      }
    }
    };

    const border = new Float32Array(lines);
    for (let pass = 0; pass < 2; pass++) {
      fillEvidence();
      const path = solveContour(evidence, lines, depths, CONTOUR_STIFFNESS);
      for (let i = 0; i < lines; i++) border[i] = start + path[i];
      if (pass === 1) break;
      // La couleur du liseré est réapprise SUR LE CONTOUR OBTENU, ligne par
      // ligne — plus sur la droite ajustée. Même si une portion du contour s'est
      // trompée, la médiane du côté reste celle de la majorité, donc la vraie
      // couleur du liseré. C'est cette référence corrigée qui permet à la
      // seconde passe de rejeter la frontière imprimée.
      cardBlocks = learnCard((line) => Math.round(border[line]));
    }
    return border;
  };

  // Fond échantillonné par tranches le long de chaque côté, puis interpolé :
  // il suit les variations d'éclairage au lieu de les moyenner.
  const localBg = (
    lines: number,
    band: (from: number, to: number) => [number, number, number]
  ): ((line: number) => [number, number, number]) => {
    const STEPS = 12;
    const span = Math.max(8, Math.ceil(lines / STEPS));
    const cache: [number, number, number][] = [];
    for (let i = 0; i * span < lines; i++) {
      cache.push(band(i * span, Math.min(lines, (i + 1) * span)));
    }
    return (line) => cache[Math.min(cache.length - 1, Math.floor(line / span))];
  };

  const left = scanSide(
    PH,
    localBg(PH, (a, b) => sampleBg(0, strip, a, b)),
    (y, s) => y * PW + s
  );
  const right = scanSide(
    PH,
    localBg(PH, (a, b) => sampleBg(PW - strip, PW, a, b)),
    (y, s) => y * PW + (PW - 1 - s)
  );
  const top = scanSide(
    PW,
    localBg(PW, (a, b) => sampleBg(a, b, 0, strip)),
    (x, s) => s * PW + x
  );
  const bottom = scanSide(
    PW,
    localBg(PW, (a, b) => sampleBg(a, b, PH - strip, PH)),
    (x, s) => (PH - 1 - s) * PW + x
  );

  // Alpha = intersection des 4 contraintes, en couverture sous-pixel (bord
  // net mais non crénelé). Un coin, arrondi ou carré, sort naturellement de
  // cette intersection : on n'a plus rien à présumer de sa forme.
  const cover = (v: number) => (v <= 0 ? 0 : v >= 1 ? 1 : v);
  for (let py = 0; py < PH; py++) {
    for (let px = 0; px < PW; px++) {
      const i = (py * PW + px) * 4;
      const a =
        cover(px - left[py] + 1) *
        cover(PW - 1 - right[py] - px + 1) *
        cover(py - top[px] + 1) *
        cover(PH - 1 - bottom[px] - py + 1);
      dst4(d, i, a);
    }
  }
}

function dst4(d: Uint8ClampedArray, i: number, a: number): void {
  d[i + 3] = Math.round(d[i + 3] * a);
}

/** Recadre sur la matière : la carte entière, ses défauts compris, rien de plus. */
function cropToAlpha(src: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = src.getContext("2d", { willReadFrequently: true })!;
  const { width: W, height: H } = src;
  const d = ctx.getImageData(0, 0, W, H).data;
  let x0 = W;
  let x1 = -1;
  let y0 = H;
  let y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < x0 || y1 < y0) return src;
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext("2d")!.drawImage(src, -x0, -y0);
  return out;
}
