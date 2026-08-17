import { roundRect } from "./geometry";
import type { CardInfo } from "./types";

export function drawLogoBadge(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  logoImage: CanvasImageSource | null,
  logoText: string
) {
  const txt = logoText || "cardshot";
  const s = W / 1000;
  ctx.font = `600 ${15 * s}px -apple-system,sans-serif`;
  const tw = ctx.measureText(txt).width;
  const bw = tw + 58 * s;
  const bh = 40 * s;
  const x = W - bw - 24 * s;
  const y = H - bh - 22 * s;

  ctx.save();
  ctx.fillStyle = "rgba(8,6,16,0.6)";
  roundRect(ctx, x, y, bw, bh, 20 * s);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, bw, bh, 20 * s);
  ctx.stroke();

  if (logoImage) {
    ctx.save();
    roundRect(ctx, x + 8 * s, y + 8 * s, 24 * s, 24 * s, 7 * s);
    ctx.clip();
    ctx.drawImage(logoImage, x + 8 * s, y + 8 * s, 24 * s, 24 * s);
    ctx.restore();
  } else {
    ctx.fillStyle = "#8b7cf8";
    roundRect(ctx, x + 8 * s, y + 8 * s, 24 * s, 24 * s, 7 * s);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `700 ${11 * s}px -apple-system,sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("CS", x + 20 * s, y + 24 * s);
    ctx.textAlign = "left";
  }

  ctx.font = `600 ${15 * s}px -apple-system,sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillText(txt, x + 40 * s, y + 25 * s);
  ctx.restore();
}

// Décision produit (Remy) : le prix ne doit jamais apparaître sur les photos —
// il vit dans l'annonce, pas sur les visuels.
export function drawInfoTag(ctx: CanvasRenderingContext2D, W: number, H: number, info: CardInfo) {
  const { name, number, rarity } = info;
  if (!(name || number || rarity)) return;
  const s = W / 1000;
  const l1 = name || "Ma carte";
  const l2 = [number, rarity].filter(Boolean).join("  ·  ");

  ctx.font = `600 ${22 * s}px -apple-system,sans-serif`;
  const w1 = ctx.measureText(l1).width;
  ctx.font = `${14 * s}px -apple-system,sans-serif`;
  const w2 = l2 ? ctx.measureText(l2).width : 0;
  const tw = Math.max(w1, w2) + 40 * s;
  const th = (l2 ? 78 : 58) * s;
  const tx = 26 * s;
  const ty = H - th - 24 * s;

  ctx.fillStyle = "rgba(7,5,22,0.85)";
  roundRect(ctx, tx, ty, tw, th, 13 * s);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `600 ${22 * s}px -apple-system,sans-serif`;
  ctx.fillText(l1, tx + 18 * s, ty + (l2 ? 35 : 37) * s);
  if (l2) {
    ctx.font = `${14 * s}px -apple-system,sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText(l2, tx + 18 * s, ty + 61 * s);
  }
}
