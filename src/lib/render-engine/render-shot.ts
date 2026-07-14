import { makeCam, cardCorners } from "./geometry";
import { drawBg } from "./draw-background";
import { drawStandBase, drawStandLegs, drawCase } from "./draw-stand";
import { drawGroundShadow, drawReflection, drawPerspective } from "./draw-effects";
import { drawLogoBadge, drawInfoTag } from "./draw-overlays";
import type { RenderRequest } from "./types";

/**
 * The Canvas render engine: draws one shot (one card, one angle, one studio)
 * onto the given canvas. This is the only entry point screens should call —
 * everything above is an implementation detail of "how", not "what".
 */
export function renderShot(canvas: HTMLCanvasElement, request: RenderRequest): void {
  const W = request.size || 1000;
  const H = W;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { theme, mount, shot } = request;
  drawBg(ctx, W, H, theme, request.halo);

  const img = shot.face === "verso" ? request.versoImage : request.rectoImage;
  if (!img) return;

  const iw = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width;
  const ih = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height;
  const ratio = ih / iw;
  const scale = W / 1000;
  let wCard = (mount.id === "case" ? 360 : 390) * scale;
  let hCard = wCard * ratio;
  if (hCard > H * 0.62) {
    hCard = H * 0.62;
    wCard = hCard / ratio;
  }

  const cam = makeCam(W, H, 1500 * scale, 1450 * scale, 5, -hCard * 0.42);
  const liftY = hCard * 0.42;
  const ang = (shot.angle * 16 * Math.PI) / 180;
  const q = cardCorners(cam, wCard, hCard, ang, liftY);

  const cx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4;
  const cy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4;
  const wpx = Math.abs(q[1].x - q[0].x);
  const rl = ctx.createRadialGradient(cx, cy, wpx * 0.4, cx, cy, wpx * 1.15);
  rl.addColorStop(0, `rgba(${theme.spot},${request.halo * 0.18})`);
  rl.addColorStop(1, `rgba(${theme.spot},0)`);
  ctx.fillStyle = rl;
  ctx.beginPath();
  ctx.ellipse(cx, cy, wpx * 1.0, wpx * 1.35, 0, 0, 7);
  ctx.fill();

  drawGroundShadow(ctx, q);
  drawReflection(ctx, cam, img, wCard, hCard, ang, liftY, request.reflect);
  drawStandBase(ctx, cam, mount.id === "case" ? wCard * 1.06 : wCard, liftY);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.72)";
  ctx.shadowBlur = 44 * scale;
  ctx.shadowOffsetY = 14 * scale;
  ctx.beginPath();
  ctx.moveTo(q[0].x, q[0].y);
  ctx.lineTo(q[1].x, q[1].y);
  ctx.lineTo(q[2].x, q[2].y);
  ctx.lineTo(q[3].x, q[3].y);
  ctx.closePath();
  ctx.fillStyle = "rgba(0,0,0,0.9)";
  ctx.fill();
  ctx.restore();

  drawPerspective(ctx, img, q, 110);

  if (shot.angle !== 0) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(q[0].x, q[0].y);
    ctx.lineTo(q[1].x, q[1].y);
    ctx.lineTo(q[2].x, q[2].y);
    ctx.lineTo(q[3].x, q[3].y);
    ctx.closePath();
    ctx.clip();
    const x0 = shot.angle > 0 ? q[0].x : q[1].x;
    const x1 = shot.angle > 0 ? q[1].x : q[0].x;
    const sg = ctx.createLinearGradient(x0, 0, x1, 0);
    sg.addColorStop(0, "rgba(0,0,0,0.30)");
    sg.addColorStop(0.55, "rgba(0,0,0,0.04)");
    sg.addColorStop(1, "rgba(255,255,255,0.05)");
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  if (mount.id === "case") drawCase(ctx, q, wCard);
  drawStandLegs(
    ctx,
    cam,
    mount.id === "case" ? wCard * 0.92 : wCard,
    mount.id === "case" ? hCard * 0.5 : hCard,
    ang,
    liftY
  );

  drawInfoTag(ctx, W, H, request.cardInfo);
  drawLogoBadge(ctx, W, H, request.logoImage, request.logoText);
}
