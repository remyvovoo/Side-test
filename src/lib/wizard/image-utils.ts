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

/** Finds the bounding box of non-transparent pixels — a cheap auto-crop for a cut-out PNG. */
export function autoDetectBounds(img: HTMLImageElement): Corner[] {
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
      if (d[(y * w + x) * 4 + 3] > 24) {
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
