import type { Camera, Point2D } from "./geometry";
import { projEllipse, pathPts, rotY, expandQuad } from "./geometry";

export function drawStandBase(ctx: CanvasRenderingContext2D, cam: Camera, wCard: number, liftY: number) {
  const rx = wCard * 0.46;
  const rz = wCard * 0.3;
  const thick = wCard * 0.028;
  const top = projEllipse(cam, 0, 0, rx, rz, liftY, 48);
  const bot = projEllipse(cam, 0, 0, rx, rz, liftY + thick, 48);

  ctx.save();
  let lowest = -Infinity;
  for (let i = 0; i < bot.length; i++) if (bot[i].y > lowest) lowest = bot[i].y;
  const cxs = cam.proj(0, liftY + thick, 0);
  const half = Math.abs(top[0].x - top[24].x) * 0.5;
  const sh = ctx.createRadialGradient(cxs.x, lowest - 4, 0, cxs.x, lowest - 4, half * 1.7);
  sh.addColorStop(0, "rgba(0,0,0,0.72)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.ellipse(cxs.x, lowest - 5, half * 1.75, thick * 3.6, 0, 0, 7);
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(top[0].x, top[0].y);
  for (let i = 1; i < top.length; i++) ctx.lineTo(top[i].x, top[i].y);
  for (let j = bot.length - 1; j >= 0; j--) ctx.lineTo(bot[j].x, bot[j].y);
  ctx.closePath();
  ctx.fillStyle = "rgba(200,215,235,0.14)";
  ctx.fill();

  pathPts(ctx, top);
  ctx.fillStyle = "rgba(215,228,245,0.13)";
  ctx.fill();
  ctx.strokeStyle = "rgba(240,250,255,0.4)";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  pathPts(ctx, bot);
  ctx.strokeStyle = "rgba(240,250,255,0.22)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawStandLegs(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  wCard: number,
  hCard: number,
  ang: number,
  liftY: number
) {
  const legH = hCard * 0.3;
  const legW = wCard * 0.045;
  const thick = wCard * 0.02;
  const spread = wCard * 0.24;

  [-1, 1].forEach((s) => {
    const base = rotY({ x: s * spread * 0.92, y: 0, z: -wCard * 0.13 }, ang * 0.5);
    const apexL = rotY({ x: s * spread - legW * 0.35, y: -legH, z: 0 }, ang);
    const apexR = rotY({ x: s * spread + legW * 0.35, y: -legH, z: 0 }, ang);
    const b0 = cam.proj(base.x - legW / 2, liftY, base.z);
    const b1 = cam.proj(base.x + legW / 2, liftY, base.z);
    const a0 = cam.proj(apexL.x, apexL.y + liftY, apexL.z);
    const a1 = cam.proj(apexR.x, apexR.y + liftY, apexR.z);
    const bz0 = cam.proj(base.x - legW / 2, liftY, base.z + thick);
    const az0 = cam.proj(apexL.x, apexL.y + liftY, apexL.z + thick);

    ctx.beginPath();
    ctx.moveTo(b0.x, b0.y);
    ctx.lineTo(a0.x, a0.y);
    ctx.lineTo(az0.x, az0.y);
    ctx.lineTo(bz0.x, bz0.y);
    ctx.closePath();
    ctx.fillStyle = "rgba(190,208,230,0.20)";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(b0.x, b0.y);
    ctx.lineTo(a0.x, a0.y);
    ctx.lineTo(a1.x, a1.y);
    ctx.lineTo(b1.x, b1.y);
    ctx.closePath();
    const lg = ctx.createLinearGradient(b0.x, 0, b1.x, 0);
    lg.addColorStop(0, "rgba(240,248,255,0.46)");
    lg.addColorStop(0.3, "rgba(175,195,220,0.13)");
    lg.addColorStop(0.72, "rgba(235,245,255,0.32)");
    lg.addColorStop(1, "rgba(150,172,200,0.10)");
    ctx.fillStyle = lg;
    ctx.fill();

    ctx.strokeStyle = "rgba(250,253,255,0.62)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(b0.x, b0.y);
    ctx.lineTo(a0.x, a0.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b1.x, b1.y);
    ctx.lineTo(a1.x, a1.y);
    ctx.stroke();

    ctx.strokeStyle = "rgba(250,253,255,0.30)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a0.x, a0.y);
    ctx.lineTo(a1.x, a1.y);
    ctx.stroke();
  });
}

export function drawCase(ctx: CanvasRenderingContext2D, corners: Point2D[], wCard: number) {
  const m = wCard * 0.075;
  const q = expandQuad(corners, m * 0.9);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(q[0].x, q[0].y);
  ctx.lineTo(q[1].x, q[1].y);
  ctx.lineTo(q[2].x, q[2].y);
  ctx.lineTo(q[3].x, q[3].y);
  ctx.closePath();
  ctx.fillStyle = "rgba(220,232,248,0.085)";
  ctx.fill();
  ctx.strokeStyle = "rgba(242,250,255,0.55)";
  ctx.lineWidth = 2.2;
  ctx.stroke();

  const qi = expandQuad(corners, m * 0.42);
  ctx.beginPath();
  ctx.moveTo(qi[0].x, qi[0].y);
  ctx.lineTo(qi[1].x, qi[1].y);
  ctx.lineTo(qi[2].x, qi[2].y);
  ctx.lineTo(qi[3].x, qi[3].y);
  ctx.closePath();
  ctx.strokeStyle = "rgba(242,250,255,0.24)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(q[0].x, q[0].y);
  ctx.lineTo(q[1].x, q[1].y);
  ctx.lineTo(q[2].x, q[2].y);
  ctx.lineTo(q[3].x, q[3].y);
  ctx.closePath();
  ctx.clip();
  const minX = Math.min(q[0].x, q[3].x);
  const minY = Math.min(q[0].y, q[1].y);
  const maxX = Math.max(q[1].x, q[2].x);
  const maxY = Math.max(q[2].y, q[3].y);
  const gl = ctx.createLinearGradient(minX, minY, minX + (maxX - minX) * 0.75, maxY);
  gl.addColorStop(0, "rgba(255,255,255,0.14)");
  gl.addColorStop(0.32, "rgba(255,255,255,0.015)");
  gl.addColorStop(0.52, "rgba(255,255,255,0.10)");
  gl.addColorStop(0.72, "rgba(255,255,255,0.01)");
  gl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gl;
  ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
  ctx.restore();

  const ccx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4;
  const ccy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4;
  q.forEach((p) => {
    const px = p.x + (ccx - p.x) * 0.075;
    const py = p.y + (ccy - p.y) * 0.075;
    const r = m * 0.3;
    const sg = ctx.createRadialGradient(px - r * 0.3, py - r * 0.3, 0, px, py, r);
    sg.addColorStop(0, "rgba(255,255,255,0.85)");
    sg.addColorStop(0.55, "rgba(205,222,242,0.32)");
    sg.addColorStop(1, "rgba(150,172,205,0.14)");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, 7);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 0.9;
    ctx.stroke();
  });
}
