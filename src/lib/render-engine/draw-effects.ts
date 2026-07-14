import type { Camera, Point2D } from "./geometry";
import { rotY } from "./geometry";

/** Warps an image onto a quadrilateral using an approximated homography (vertical strips). */
export function drawPerspective(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  q: Point2D[],
  slices?: number
) {
  const N = slices || 110;
  const [TL, TR, , BL] = q;
  const BR = q[2];
  const iw = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width;
  const ih = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(TL.x, TL.y);
  ctx.lineTo(TR.x, TR.y);
  ctx.lineTo(BR.x, BR.y);
  ctx.lineTo(BL.x, BL.y);
  ctx.closePath();
  ctx.clip();

  for (let i = 0; i < N; i++) {
    const t0 = i / N;
    const t1 = (i + 1) / N;
    const w0 = 1 / ((1 - t0) / TL.w! + t0 / TR.w!);
    const w1 = 1 / ((1 - t1) / TL.w! + t1 / TR.w!);
    const u0 = (t0 / TR.w!) * w0;
    const u1 = (t1 / TR.w!) * w1;
    const xt0 = TL.x + (TR.x - TL.x) * t0;
    const yt0 = TL.y + (TR.y - TL.y) * t0;
    const yb0 = BL.y + (BR.y - BL.y) * t0;
    const xt1 = TL.x + (TR.x - TL.x) * t1;
    const sx0 = u0 * iw;
    const sx1 = u1 * iw;
    const sw = Math.max(0.5, sx1 - sx0);
    const dw = Math.max(0.6, xt1 - xt0) + 0.7;
    const dh = yb0 - yt0;
    if (dh > 0) ctx.drawImage(img, sx0, 0, sw, ih, xt0, yt0, dw, dh);
  }
  ctx.restore();
}

export function drawGroundShadow(ctx: CanvasRenderingContext2D, corners: Point2D[]) {
  const BL = corners[3];
  const BR = corners[2];
  const cxm = (BL.x + BR.x) / 2;
  const cym = (BL.y + BR.y) / 2;
  const w = Math.abs(BR.x - BL.x);
  ctx.save();
  const sh = ctx.createRadialGradient(cxm, cym, 0, cxm, cym, w * 0.72);
  sh.addColorStop(0, "rgba(0,0,0,0.8)");
  sh.addColorStop(0.55, "rgba(0,0,0,0.3)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.ellipse(cxm, cym + 3, w * 0.68, w * 0.075, 0, 0, 7);
  ctx.fill();
  ctx.restore();
}

export function drawReflection(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  img: CanvasImageSource,
  wCard: number,
  hCard: number,
  ang: number,
  liftY: number,
  strength: number
) {
  if (strength <= 0) return;
  const hw = wCard / 2;
  const pts = [
    { x: -hw, y: 0, z: 0 },
    { x: hw, y: 0, z: 0 },
    { x: hw, y: hCard * 0.55, z: 0 },
    { x: -hw, y: hCard * 0.55, z: 0 },
  ];
  const sc: Point2D[] = pts.map((p) => {
    const r = rotY(p, ang);
    const s = cam.proj(r.x, r.y + liftY, r.z);
    return { x: s.x, y: s.y, w: 1 / s.zc };
  });

  const iw = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width;
  const ih = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height;
  const mir = document.createElement("canvas");
  mir.width = iw;
  mir.height = ih;
  const mc = mir.getContext("2d")!;
  mc.save();
  mc.scale(1, -1);
  mc.drawImage(img, 0, -ih);
  mc.restore();

  const off = document.createElement("canvas");
  off.width = ctx.canvas.width;
  off.height = ctx.canvas.height;
  const oc = off.getContext("2d")!;
  drawPerspective(oc, mir, sc, 70);

  const top = Math.min(sc[0].y, sc[1].y);
  const bot = Math.max(sc[2].y, sc[3].y);
  const mask = oc.createLinearGradient(0, top, 0, bot);
  mask.addColorStop(0, `rgba(0,0,0,${0.5 * strength})`);
  mask.addColorStop(1, "rgba(0,0,0,0)");
  oc.globalCompositeOperation = "destination-in";
  oc.fillStyle = mask;
  oc.fillRect(0, 0, off.width, off.height);

  ctx.drawImage(off, 0, 0);
}
