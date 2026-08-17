/** Downscales a blob to a reasonable max dimension before sending it anywhere. */
export function compressImage(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const MAX = 1500;
      let w = img.width;
      let h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) {
          h = Math.round((h * MAX) / w);
          w = MAX;
        } else {
          w = Math.round((w * MAX) / h);
          h = MAX;
        }
      }
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("compress"))), "image/jpeg", 0.88);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("load"));
    };
    img.src = url;
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("load"));
    img.src = src;
  });
}

export interface Corner {
  x: number;
  y: number;
}

/**
 * Recadre l'image sur ses pixels visibles (avec une petite marge) : après
 * détourage + redressement, la carte est recentrée au lieu de flotter dans
 * les marges transparentes de la photo d'origine.
 */
export function cropToVisible(img: HTMLImageElement, padRatio = 0.03): Promise<HTMLImageElement> {
  const b = autoDetectBounds(img, 128);
  const minX = Math.min(b[0].x, b[3].x);
  const maxX = Math.max(b[1].x, b[2].x);
  const minY = Math.min(b[0].y, b[1].y);
  const maxY = Math.max(b[2].y, b[3].y);
  const w = maxX - minX;
  const h = maxY - minY;
  if (w <= 8 || h <= 8) return Promise.resolve(img);
  // Déjà bord à bord : rien à recadrer.
  if (minX <= 2 && minY <= 2 && maxX >= img.width - 2 && maxY >= img.height - 2) {
    return Promise.resolve(img);
  }
  const pad = Math.round(Math.max(w, h) * padRatio);
  const sx = Math.max(0, Math.round(minX - pad));
  const sy = Math.max(0, Math.round(minY - pad));
  const sw = Math.min(img.width - sx, Math.round(w + 2 * pad));
  const sh = Math.min(img.height - sy, Math.round(h + 2 * pad));
  const c = document.createElement("canvas");
  c.width = sw;
  c.height = sh;
  c.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return loadImage(c.toDataURL("image/png"));
}

/**
 * Redresse automatiquement une carte détourée légèrement de travers.
 * Principe : une carte est un rectangle, donc sa boîte englobante est minimale
 * quand elle est parfaitement droite. On teste de petits angles et on garde
 * celui qui donne la boîte la plus serrée, puis on tourne l'image d'autant.
 */
export function autoStraighten(img: HTMLImageElement, maxAngleDeg = 12): Promise<HTMLImageElement> {
  const MAX = 260;
  const s = Math.min(MAX / img.width, MAX / img.height, 1);
  const w = Math.max(2, Math.round(img.width * s));
  const h = Math.max(2, Math.round(img.height * s));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;

  // Points de contour : pixels opaques ayant au moins un voisin transparent.
  const pts: number[] = [];
  const alphaAt = (x: number, y: number) => d[(y * w + x) * 4 + 3] > 24;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (alphaAt(x, y) && (!alphaAt(x - 1, y) || !alphaAt(x + 1, y) || !alphaAt(x, y - 1) || !alphaAt(x, y + 1))) {
        pts.push(x, y);
      }
    }
  }
  if (pts.length < 40) return Promise.resolve(img);

  let bestAngle = 0;
  let bestArea = Infinity;
  for (let deg = -maxAngleDeg; deg <= maxAngleDeg; deg += 0.25) {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      const u = pts[i] * cos + pts[i + 1] * sin;
      const v = -pts[i] * sin + pts[i + 1] * cos;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const area = (maxU - minU) * (maxV - minV);
    if (area < bestArea) {
      bestArea = area;
      bestAngle = deg;
    }
  }

  // Déjà droite (ou presque) : on ne touche à rien.
  if (Math.abs(bestAngle) < 0.3) return Promise.resolve(img);

  const rad = (-bestAngle * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const outW = Math.ceil(img.width * cos + img.height * sin);
  const outH = Math.ceil(img.width * sin + img.height * cos);
  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const octx = out.getContext("2d")!;
  octx.translate(outW / 2, outH / 2);
  octx.rotate(rad);
  octx.drawImage(img, -img.width / 2, -img.height / 2);

  return loadImage(out.toDataURL("image/png"));
}

/** Finds the bounding box of non-transparent pixels — a cheap auto-crop for a cut-out PNG.
 *  `alphaMin` : seuil d'opacité — élevé (ex. 128), il ignore le liseré
 *  semi-transparent que remove.bg laisse parfois en bordure de carte. */
export function autoDetectBounds(img: HTMLImageElement, alphaMin = 24): Corner[] {
  const MAX = 320;
  const s = Math.min(MAX / img.width, MAX / img.height, 1);
  const w = Math.max(1, Math.round(img.width * s));
  const h = Math.max(1, Math.round(img.height * s));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;

  let minX = w,
    minY = h,
    maxX = 0,
    maxY = 0,
    found = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > alphaMin) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) {
    return [
      { x: 0, y: 0 },
      { x: img.width, y: 0 },
      { x: img.width, y: img.height },
      { x: 0, y: img.height },
    ];
  }
  const k = 1 / s;
  return [
    { x: minX * k, y: minY * k },
    { x: (maxX + 1) * k, y: minY * k },
    { x: (maxX + 1) * k, y: (maxY + 1) * k },
    { x: minX * k, y: (maxY + 1) * k },
  ];
}
