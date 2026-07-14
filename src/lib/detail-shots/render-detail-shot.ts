export type DetailKind = "corner-tl" | "corner-tr" | "corner-bl" | "corner-br" | "surface";

/** How much of the card's width/height each corner close-up covers. */
const CORNER_FRACTION = 0.34;

function cornerOrigin(kind: DetailKind, iw: number, ih: number, sw: number, sh: number) {
  switch (kind) {
    case "corner-tl":
      return { sx: 0, sy: 0 };
    case "corner-tr":
      return { sx: iw - sw, sy: 0 };
    case "corner-bl":
      return { sx: 0, sy: ih - sh };
    case "corner-br":
      return { sx: iw - sw, sy: ih - sh };
    case "surface":
      return { sx: 0, sy: 0 };
  }
}

/**
 * Renders a real, unstyled close-up of the card (a corner or the full
 * surface) on a plain white background — no studio, no perspective. These
 * are meant to reassure a buyer about the card's actual condition, so
 * nothing here is allowed to alter what the photo actually shows.
 */
export function renderDetailShot(
  canvas: HTMLCanvasElement,
  source: HTMLImageElement,
  kind: DetailKind,
  size = 900
) {
  const iw = source.naturalWidth || source.width;
  const ih = source.naturalHeight || source.height;

  const sw = kind === "surface" ? iw : iw * CORNER_FRACTION;
  const sh = kind === "surface" ? ih : ih * CORNER_FRACTION;
  const { sx, sy } = cornerOrigin(kind, iw, ih, sw, sh);

  const ratio = sh / sw;
  let outW = size;
  let outH = size * ratio;
  if (outH > size) {
    outH = size;
    outW = size / ratio;
  }
  const padX = (size - outW) / 2;
  const padY = (size - outH) / 2;

  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(source, sx, sy, sw, sh, padX, padY, outW, outH);
}
