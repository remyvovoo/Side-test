import { loadImage } from "./image-utils";

/**
 * Détourage maison, gratuit et instantané — zéro service externe.
 *
 * Principe : nos consignes photo demandent une carte sur fond uni contrasté.
 * On échantillonne donc la couleur du fond sur les bords de la photo, on
 * classe chaque pixel selon sa distance à ce fond, puis on ne garde que la
 * plus grande zone connexe (la carte) dont on rebouche les trous internes
 * (les zones de la carte qui ressemblent au fond).
 *
 * Retourne null si le résultat ne ressemble pas à une carte plausible —
 * l'appelant peut alors basculer sur un service externe en secours.
 */

const ANALYSIS_MAX = 720; // résolution d'analyse du masque
const MIN_AREA_RATIO = 0.08; // une carte occupe au moins ~8 % de la photo
const MAX_AREA_RATIO = 0.95; // …et pas toute la photo

interface MaskResult {
  mask: Uint8Array;
  w: number;
  h: number;
  areaRatio: number;
  /** Rapport hauteur/largeur du rectangle englobant du masque. */
  aspect: number;
  /** Part du rectangle englobant réellement couverte par le masque. */
  fill: number;
  /** Le masque est-il plus haut que large ? (une carte se photographie en portrait) */
  portrait: boolean;
}

function buildMask(img: HTMLImageElement, thresholdScale: number): MaskResult | null {
  const s = Math.min(ANALYSIS_MAX / img.width, ANALYSIS_MAX / img.height, 1);
  const w = Math.max(8, Math.round(img.width * s));
  const h = Math.max(8, Math.round(img.height * s));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;

  // 1. Couleur du fond : médiane des pixels des 4 bandes de bord (3 % du côté).
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.03));
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const sample = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    rs.push(d[i]);
    gs.push(d[i + 1]);
    bs.push(d[i + 2]);
  };
  for (let x = 0; x < w; x += 2) {
    for (let y = 0; y < band; y++) {
      sample(x, y);
      sample(x, h - 1 - y);
    }
  }
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < band; x++) {
      sample(x, y);
      sample(w - 1 - x, y);
    }
  }
  const median = (a: number[]) => a.sort((p, q) => p - q)[Math.floor(a.length / 2)];
  const bgR = median(rs);
  const bgG = median(gs);
  const bgB = median(bs);

  // 2. Distance de chaque pixel au fond + seuil adaptatif (vallée d'histogramme).
  const dist = new Float32Array(w * h);
  const hist = new Uint32Array(64);
  for (let i = 0; i < w * h; i++) {
    const dr = d[i * 4] - bgR;
    const dg = d[i * 4 + 1] - bgG;
    const db = d[i * 4 + 2] - bgB;
    // Distance insensible aux ombres : une ombre portée a la même teinte que
    // le fond, en plus sombre. On sépare la composante « chrominance » (vraie
    // différence de couleur) de la composante « luminance » — et on ignore
    // presque totalement un simple assombrissement.
    const dl = (dr + dg + db) / 3;
    const cr = dr - dl;
    const cg = dg - dl;
    const cb = db - dl;
    const chroma = Math.sqrt(cr * cr + cg * cg + cb * cb);
    const v = chroma + Math.max(0, dl) * 0.5;
    dist[i] = v;
    hist[Math.min(63, Math.floor(v / 7))]++;
  }
  // Otsu simplifié sur l'histogramme des distances.
  const total = w * h;
  let sumAll = 0;
  for (let t = 0; t < 64; t++) sumAll += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let bestVar = -1;
  for (let t = 0; t < 64; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > bestVar) {
      bestVar = between;
      best = t;
    }
  }
  const threshold = Math.max(16, best * 7 * 0.9 * thresholdScale);

  const raw = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) raw[i] = dist[i] > threshold ? 1 : 0;

  // 3. Plus grande composante connexe (la carte).
  const label = new Int32Array(w * h).fill(-1);
  let bestLabel = -1;
  let bestSize = 0;
  let current = 0;
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (raw[start] === 0 || label[start] !== -1) continue;
    let size = 0;
    stack.push(start);
    label[start] = current;
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const px = p % w;
      const py = (p / w) | 0;
      if (px > 0 && raw[p - 1] === 1 && label[p - 1] === -1) {
        label[p - 1] = current;
        stack.push(p - 1);
      }
      if (px < w - 1 && raw[p + 1] === 1 && label[p + 1] === -1) {
        label[p + 1] = current;
        stack.push(p + 1);
      }
      if (py > 0 && raw[p - w] === 1 && label[p - w] === -1) {
        label[p - w] = current;
        stack.push(p - w);
      }
      if (py < h - 1 && raw[p + w] === 1 && label[p + w] === -1) {
        label[p + w] = current;
        stack.push(p + w);
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestLabel = current;
    }
    current++;
  }
  if (bestLabel === -1) return null;

  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = label[i] === bestLabel ? 1 : 0;

  // 4. Rebouchage des trous : tout ce qui n'est pas atteignable depuis
  // l'extérieur fait partie de la carte.
  const outside = new Uint8Array(w * h);
  const flood: number[] = [];
  const pushIfBg = (i: number) => {
    if (mask[i] === 0 && outside[i] === 0) {
      outside[i] = 1;
      flood.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    pushIfBg(x);
    pushIfBg((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    pushIfBg(y * w);
    pushIfBg(y * w + w - 1);
  }
  while (flood.length) {
    const p = flood.pop()!;
    const px = p % w;
    const py = (p / w) | 0;
    if (px > 0) pushIfBg(p - 1);
    if (px < w - 1) pushIfBg(p + 1);
    if (py > 0) pushIfBg(p - w);
    if (py < h - 1) pushIfBg(p + w);
  }
  let area = 0;
  let bx0 = w,
    bx1 = 0,
    by0 = h,
    by1 = 0;
  for (let i = 0; i < w * h; i++) {
    if (outside[i] === 0) {
      mask[i] = 1; // trou interne → carte
    }
    if (mask[i] === 1) {
      area++;
      const px = i % w;
      const py = (i / w) | 0;
      if (px < bx0) bx0 = px;
      if (px > bx1) bx1 = px;
      if (py < by0) by0 = py;
      if (py > by1) by1 = py;
    }
  }
  const bw = Math.max(1, bx1 - bx0 + 1);
  const bh = Math.max(1, by1 - by0 + 1);

  return {
    mask,
    w,
    h,
    areaRatio: area / (w * h),
    aspect: Math.max(bw, bh) / Math.min(bw, bh),
    fill: area / (bw * bh),
    portrait: bh >= bw,
  };
}

/**
 * Applique le masque à la photo pleine résolution, avec un bord net.
 *
 * Histoire du réglage (ne pas re-basculer sans mesurer) : sans traitement, la
 * frontière du masque basse résolution agrandie ~3× déborde HORS de la carte
 * → halo de fond gris (1er retour de Remy). Une érosion entière à la
 * résolution d'analyse corrige trop fort : 1 px d'analyse ≈ 3 px pleine
 * résolution, la carte semble « rognée » (2e retour de Remy). D'où la version
 * actuelle : contraction fine À LA PLEINE RÉSOLUTION (~2 px) par intersection
 * de copies décalées, qui raidit le bord en même temps qu'elle le rentre.
 */
function applyMask(img: HTMLImageElement, m: MaskResult): Promise<HTMLImageElement> {
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = m.w;
  maskCanvas.height = m.h;
  const mctx = maskCanvas.getContext("2d")!;
  const mi = mctx.createImageData(m.w, m.h);
  for (let i = 0; i < m.w * m.h; i++) {
    mi.data[i * 4 + 3] = m.mask[i] ? 255 : 0;
  }
  mctx.putImageData(mi, 0, 0);

  const W = img.naturalWidth || img.width;
  const H = img.naturalHeight || img.height;
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const octx = out.getContext("2d")!;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  // Masque agrandi avec un très léger flou (anti-crénelage du bord)…
  octx.filter = `blur(${Math.max(1, W / 2200)}px)`;
  octx.drawImage(maskCanvas, 0, 0, W, H);
  octx.filter = "none";
  // …puis contraction fine : l'alpha final est le produit du masque et de ses
  // 4 copies décalées de ~2 px — le bord rentre de ~2 px dans la carte et la
  // pénombre du flou s'écrase (produit de 5 alphas), donc contour net.
  const snap = document.createElement("canvas");
  snap.width = W;
  snap.height = H;
  snap.getContext("2d")!.drawImage(out, 0, 0);
  const r = Math.max(1.5, W / 1100);
  octx.globalCompositeOperation = "destination-in";
  for (const [dx, dy] of [
    [r, 0],
    [-r, 0],
    [0, r],
    [0, -r],
  ]) {
    octx.drawImage(snap, dx, dy);
  }
  octx.globalCompositeOperation = "source-in";
  octx.drawImage(img, 0, 0, W, H);
  return loadImage(out.toDataURL("image/png"));
}

/** Une carte à collectionner : rectangle plein, proportions ~63×88 mm (ratio ≈ 1,4). */
function isPlausibleCard(m: MaskResult): boolean {
  if (m.areaRatio < MIN_AREA_RATIO || m.areaRatio > MAX_AREA_RATIO) return false;
  if (!m.portrait) return false; // une carte se photographie en portrait
  if (m.aspect < 1.15 || m.aspect > 1.7) return false; // ni carré, ni bandeau
  if (m.fill < 0.82) return false; // un rectangle plein, pas une forme trouée
  return true;
}

export async function localRemoveBackground(img: HTMLImageElement): Promise<HTMLImageElement | null> {
  // Plusieurs passes : si le premier seuil isole un sous-élément de la carte
  // (ex. le cadre de l'illustration, plus contrasté que la carte entière),
  // on abaisse le seuil jusqu'à retrouver un rectangle plausible.
  for (const scale of [1, 0.45, 0.28]) {
    const m = buildMask(img, scale);
    if (m && isPlausibleCard(m)) return applyMask(img, m);
  }
  return null;
}
