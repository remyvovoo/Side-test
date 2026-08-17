import { roundRect } from "./geometry";
import type { CardInfo } from "./types";

export function drawLogoBadge(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  logoImage: CanvasImageSource | null,
  logoText: string
) {
  // Décision produit (Remy) : le logo doit être nettement visible sur le visuel.
  const txt = logoText || "cardshot";
  const s = W / 1000;
  ctx.font = `600 ${22 * s}px -apple-system,sans-serif`;
  const tw = ctx.measureText(txt).width;
  const bw = tw + 82 * s;
  const bh = 56 * s;
  const x = W - bw - 26 * s;
  const y = H - bh - 26 * s;

  ctx.save();
  ctx.fillStyle = "rgba(8,6,16,0.74)";
  roundRect(ctx, x, y, bw, bh, 28 * s);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = Math.max(1, 1.2 * s);
  roundRect(ctx, x, y, bw, bh, 28 * s);
  ctx.stroke();

  if (logoImage) {
    ctx.save();
    roundRect(ctx, x + 10 * s, y + 10 * s, 36 * s, 36 * s, 10 * s);
    ctx.clip();
    ctx.drawImage(logoImage, x + 10 * s, y + 10 * s, 36 * s, 36 * s);
    ctx.restore();
  } else {
    ctx.fillStyle = "#8b7cf8";
    roundRect(ctx, x + 10 * s, y + 10 * s, 36 * s, 36 * s, 10 * s);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `700 ${16 * s}px -apple-system,sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("CS", x + 28 * s, y + 33.5 * s);
    ctx.textAlign = "left";
  }

  ctx.font = `600 ${22 * s}px -apple-system,sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.fillText(txt, x + 56 * s, y + 36 * s);
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
