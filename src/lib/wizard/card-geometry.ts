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
 * Écart au fond insensible aux ombres : une ombre portée a la même teinte que
 * le fond, en plus sombre. On mesure surtout la différence de COULEUR, et on
 * ne compte l'écart de luminosité que s'il est plus CLAIR que le fond.
 */
function bgDistance(
  d: Uint8ClampedArray,
  i: number,
  r: number,
  g: number,
  b: number
): number {
  const dr = d[i] - r;
  const dg = d[i + 1] - g;
  const db = d[i + 2] - b;
  const dl = (dr + dg + db) / 3;
  const cr = dr - dl;
  const cg = dg - dl;
  const cb = db - dl;
  return Math.sqrt(cr * cr + cg * cg + cb * cb) + Math.max(0, dl) * 0.5;
}

/**
 * Efface les SAILLIES ÉTROITES vers l'extérieur.
 *
 * Le balayage s'arrête au premier pixel qui n'est plus le fond. Une poussière
 * sur la table, un éclat de lumière, une miette à deux millimètres du bord
 * l'arrêtent donc trop tôt : tout ce qui va de cette poussière jusqu'à la
 * carte est alors gardé, et il en sort une petite languette de fond accrochée
 * au bord. Sur fond clair elle est presque invisible, sauf la poussière
 * elle-même — c'est exactement ce que Remy a vu au coin haut-gauche du verso
 * de son Mewtwo (19 août 2026).
 *
 * Ce qui distingue la poussière du vrai bord, ce n'est pas l'amplitude mais la
 * LARGEUR : une carte gondolée bombe sur une longue portion du bord, une
 * poussière tient en quelques pixels. On ne rabote donc que les saillies
 * courtes, et JAMAIS les creux — les creux sont les éclats et les coins
 * écornés, qui font partie de l'état que l'acheteur doit voir.
 */
function rejectOutwardSpikes(border: Float32Array, tolerance: number, maxRun: number): void {
  const baseline = median(Array.from(border));
  const limit = baseline - tolerance; // plus petit = plus vers l'extérieur
  let i = 0;
  while (i < border.length) {
    if (border[i] >= limit) {
      i++;
      continue;
    }
    let j = i;
    while (j < border.length && border[j] < limit) j++;
    if (j - i <= maxRun) {
      for (let k = i; k < j; k++) border[k] = baseline;
    }
    i = j;
  }
}

/** Médiane glissante à 3 : efface le pixel isolé, garde le vrai défaut. */
function despeckle(border: Float32Array): void {
  const src = Float32Array.from(border);
  for (let i = 1; i < border.length - 1; i++) {
    const a = src[i - 1];
    const b = src[i];
    const c = src[i + 1];
    border[i] = Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));
  }
}

/**
 * Trouve le VRAI bord de la carte et l'écrit dans le canal alpha.
 *
 * L'image reçue est déjà redressée : les 4 bords de la carte sont donc des
 * droites quasi parfaites, situées à `pad` pixels de chaque côté. On balaie
 * chaque ligne (et chaque colonne) depuis le fond vers l'intérieur et on
 * s'arrête au premier pixel qui n'est plus le fond. Ce que ça préserve, et
 * qu'un rectangle arrondi idéal détruisait :
 *   - les coins CARRÉS des anciennes séries (on ne présume plus de la forme) ;
 *   - les ÉCLATS et coins écornés, qui font partie de l'état de la carte ;
 *   - les bords blanchis par l'usure, que la contraction du bord rabotait.
 *
 * Les droites ajustées ne servent que de fenêtre de recherche : le bord ne
 * peut ni rentrer au-delà d'un éclat plausible (MAX_BITE_RATIO), ni déborder
 * au-delà d'un léger gondolement (MAX_BULGE_RATIO). Hors de cette fenêtre, on
 * retombe sur la droite — jamais sur du fond.
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
  const bulge = Math.round(Math.min(cardW, cardH) * MAX_BULGE_RATIO);

  // Couleur du fond, mesurée sur la bande extérieure de chaque côté.
  const strip = Math.max(2, Math.round(pad * 0.5));
  const sampleBg = (
    x0: number,
    x1: number,
    y0: number,
    y1: number
  ): [number, number, number] => {
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

  /**
   * Balayage d'un côté. `read(line, step)` donne l'index du pixel à `step`
   * pixels de profondeur sur la ligne `line`. Renvoie la position du bord,
   * en sous-pixel, dans le repère de profondeur.
   */
  const scanSide = (
    lines: number,
    bg: [number, number, number],
    read: (line: number, step: number) => number
  ): Float32Array => {
    const depth = pad + bite;
    const start = Math.max(0, pad - bulge);
    // Seuil adaptatif : proportionnel au contraste carte/fond réellement
    // observé, avec un plancher pour ne pas suivre le bruit du capteur.
    const peaks: number[] = [];
    for (let line = 0; line < lines; line += 8) {
      let mx = 0;
      for (let step = start; step < depth; step++) {
        const p = read(line, step);
        if (!valid[p]) continue;
        const v = bgDistance(d, p * 4, bg[0], bg[1], bg[2]);
        if (v > mx) mx = v;
      }
      peaks.push(mx);
    }
    const threshold = Math.max(18, median(peaks) * 0.4);

    // Même seuil adaptatif, pour la MARCHE DE LUMINOSITÉ cette fois.
    const gPeaks: number[] = [];
    for (let line = 0; line < lines; line += 8) {
      let mx = 0;
      for (let step = start + 1; step < depth - 1; step++) {
        const a = read(line, step + 1);
        const b = read(line, step - 1);
        if (!valid[a] || !valid[b]) continue;
        const g = Math.abs(
          0.299 * d[a * 4] + 0.587 * d[a * 4 + 1] + 0.114 * d[a * 4 + 2] -
            (0.299 * d[b * 4] + 0.587 * d[b * 4 + 1] + 0.114 * d[b * 4 + 2])
        );
        if (g > mx) mx = g;
      }
      gPeaks.push(mx);
    }
    const gThreshold = Math.max(EDGE_MIN_STEP, median(gPeaks) * 0.3);

    const border = new Float32Array(lines);
    const prof = new Float32Array(depth); // luminance le long du balayage
    for (let line = 0; line < lines; line++) {
      let found = -1;
      let prev = 0;
      for (let step = start; step < depth; step++) {
        const p = read(line, step);
        const ok = valid[p] === 1;
        prof[step] = ok ? 0.299 * d[p * 4] + 0.587 * d[p * 4 + 1] + 0.114 * d[p * 4 + 2] : NaN;
        const v = ok ? bgDistance(d, p * 4, bg[0], bg[1], bg[2]) : 0;
        if (found < 0 && v > threshold) {
          // Deux pixels d'affilée : un pixel isolé est du bruit, pas un bord.
          const q = read(line, Math.min(depth - 1, step + 1));
          const v2 = valid[q] ? bgDistance(d, q * 4, bg[0], bg[1], bg[2]) : 0;
          if (v2 > threshold) {
            const t = v > prev ? (threshold - prev) / (v - prev) : 0;
            found = step - 1 + Math.min(1, Math.max(0, t));
          }
        }
        prev = v;
      }

      // Deuxième lecture, par MARCHE DE LUMINOSITÉ.
      //
      // Elle n'est pas un simple repli : sur une carte à liseré argenté posée
      // sur une feuille claire, le critère de couleur ne se tait pas, il se
      // TROMPE. Le liseré ne se distingue pas du fond par la teinte, donc le
      // balayage file au travers et s'arrête au premier pixel vraiment coloré :
      // la zone imprimée. Le liseré tombait ainsi hors de la découpe alors même
      // que le cadre, lui, était juste (constaté par Remy le 19 août 2026 —
      // « au détourage c'est correct, mais le rendu final retire le contour »).
      //
      // On retient la PREMIÈRE marche crédible en venant de l'extérieur, et non
      // la plus forte. Mesuré sur le Zébibron : à l'intérieur du liseré, la
      // frontière avec l'illustration sombre présente une marche PLUS FRANCHE
      // (~90) que l'arête de la carte elle-même (~60). Chercher la plus forte
      // ramenait donc la découpe à la zone imprimée sur un tiers du côté — le
      // liseré survivait par endroits et disparaissait ailleurs. Or l'arête
      // d'une carte est par définition la marche la plus EXTÉRIEURE : au-delà,
      // il n'y a plus que du fond.
      let gStep = -1;
      for (let step = start + 1; step < depth - 1; step++) {
        const a = prof[step + 1];
        const b = prof[step - 1];
        if (Number.isNaN(a) || Number.isNaN(b)) continue;
        if (Math.abs(a - b) > gThreshold) {
          gStep = step;
          break;
        }
      }
      // La plus extérieure des deux lectures l'emporte : elle ne peut
      // qu'ajouter de la matière, jamais rogner la carte. Et la fenêtre,
      // bornée par MAX_BULGE_RATIO, empêche d'aller chercher une ombre loin
      // du bord.
      if (gStep >= 0 && (found < 0 || gStep < found)) found = gStep;

      // Toujours rien (côté hors cadre, fond indiscernable) : on s'en remet à
      // la droite ajustée, jamais au fond.
      border[line] = found < 0 ? pad : found;
    }
    despeckle(border);
    // Tolérance : 3 px ou 0,4 % du petit côté — en dessous, c'est le grain du
    // capteur. Longueur maximale rabotée : 4 % du bord, très au-delà d'une
    // poussière et très en deçà d'un gondolement.
    rejectOutwardSpikes(
      border,
      Math.max(3, Math.round(Math.min(cardW, cardH) * 0.004)),
      Math.round(lines * 0.04)
    );
    return border;
  };

  const left = scanSide(PH, sampleBg(0, strip, 0, PH), (y, s) => y * PW + s);
  const right = scanSide(PH, sampleBg(PW - strip, PW, 0, PH), (y, s) => y * PW + (PW - 1 - s));
  const top = scanSide(PW, sampleBg(0, PW, 0, strip), (x, s) => s * PW + x);
  const bottom = scanSide(PW, sampleBg(0, PW, PH - strip, PH), (x, s) => (PH - 1 - s) * PW + x);

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
