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

/** Proportions d'une carte standard (88/63) et rayon de coin (~3 mm sur 63). */
const CARD_RATIO = 88 / 63;
const CORNER_RADIUS_RATIO = 0.048;

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
 * proportions d'une carte, avec des coins arrondis nets. C'est ici que la
 * correction de perspective se fait (une photo prise de biais redevient une
 * carte droite).
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

  const srcCanvas = document.createElement("canvas");
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  srcCanvas.width = sw;
  srcCanvas.height = sh;
  const sctx = srcCanvas.getContext("2d", { willReadFrequently: true })!;
  sctx.drawImage(img, 0, 0);
  const srcData = sctx.getImageData(0, 0, sw, sh).data;

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const octx = out.getContext("2d")!;
  const dstImage = octx.createImageData(outW, outH);
  const dst = dstImage.data;

  const [h0, h1, h2, h3, h4, h5, h6, h7] = H;
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const denom = h6 * x + h7 * y + 1;
      const u = (h0 * x + h1 * y + h2) / denom;
      const v = (h3 * x + h4 * y + h5) / denom;
      const i = (y * outW + x) * 4;
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
    }
  }
  octx.putImageData(dstImage, 0, 0);

  // Coins arrondis reconstruits : on découpe un rectangle arrondi parfait
  // plutôt que d'hériter des coins approximatifs du masque.
  const radius = outW * CORNER_RADIUS_RATIO;
  const rounded = document.createElement("canvas");
  rounded.width = outW;
  rounded.height = outH;
  const rctx = rounded.getContext("2d")!;
  rctx.beginPath();
  rctx.moveTo(radius, 0);
  rctx.lineTo(outW - radius, 0);
  rctx.quadraticCurveTo(outW, 0, outW, radius);
  rctx.lineTo(outW, outH - radius);
  rctx.quadraticCurveTo(outW, outH, outW - radius, outH);
  rctx.lineTo(radius, outH);
  rctx.quadraticCurveTo(0, outH, 0, outH - radius);
  rctx.lineTo(0, radius);
  rctx.quadraticCurveTo(0, 0, radius, 0);
  rctx.closePath();
  rctx.fill();
  rctx.globalCompositeOperation = "source-in";
  rctx.drawImage(out, 0, 0);

  return loadImage(rounded.toDataURL("image/png"));
}
