/**
 * Real, no-ML quality checks that run entirely in the browser. Nothing here
 * is faked — the previous prototype only showed a spinner with generic
 * text at this step.
 */

/** Classic "variance of Laplacian" blur estimator, scaled to a 0-100 score. */
export function computeSharpnessScore(image: HTMLImageElement): number {
  const MAX = 240;
  const s = Math.min(MAX / image.width, MAX / image.height, 1);
  const w = Math.max(2, Math.round(image.width * s));
  const h = Math.max(2, Math.round(image.height * s));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(image, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }

  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const lap = 4 * gray[idx] - gray[idx - 1] - gray[idx + 1] - gray[idx - w] - gray[idx + w];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;

  // Empirically, a sharp phone photo of a glossy card lands well above 800;
  // a visibly blurry one lands well under 200.
  return Math.max(0, Math.min(100, Math.round((variance / 800) * 100)));
}

/** Rewards photos with enough pixels to crop/zoom without turning to mush. */
export function computeResolutionScore(image: HTMLImageElement): number {
  const longSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const MIN_GOOD = 1400;
  return Math.max(0, Math.min(100, Math.round((longSide / MIN_GOOD) * 100)));
}
