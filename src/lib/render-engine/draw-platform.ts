import type { Camera } from "./geometry";
import { projEllipse, pathPts } from "./geometry";
import type { StudioTheme } from "./types";

/**
 * Podium de présentation sous l'objet, façon studio produit : un disque en
 * perspective avec une tranche visible, cerné d'anneaux lumineux aux couleurs
 * de l'univers. C'est l'élément qui ancre la carte dans un vrai lieu au lieu
 * de la laisser flotter sur un dégradé.
 */
export function drawPlatform(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  wCard: number,
  liftY: number,
  theme: StudioTheme,
  intensity: number
) {
  const groundY = liftY + wCard * 0.03;
  const R = wCard * 0.92;
  const thick = wCard * 0.05;

  // --- Anneaux lumineux au sol, autour du podium ---
  const ringGlow = Math.max(0.25, intensity);
  [1.35, 1.62].forEach((k, idx) => {
    const ring = projEllipse(cam, 0, 0, R * k, R * k * 0.66, groundY + thick, 72);
    const alpha = (idx === 0 ? 0.5 : 0.28) * ringGlow;
    ctx.save();
    // halo diffus
    ctx.strokeStyle = `rgba(${theme.spot},${alpha * 0.4})`;
    ctx.lineWidth = wCard * 0.03;
    ctx.filter = `blur(${wCard * 0.012}px)`;
    pathPts(ctx, ring);
    ctx.stroke();
    // cœur net
    ctx.filter = "none";
    ctx.strokeStyle = `rgba(${theme.spot},${alpha})`;
    ctx.lineWidth = wCard * 0.008;
    pathPts(ctx, ring);
    ctx.stroke();
    ctx.restore();
  });

  // --- Tranche du podium ---
  const top = projEllipse(cam, 0, 0, R, R * 0.66, groundY, 64);
  const bot = projEllipse(cam, 0, 0, R, R * 0.66, groundY + thick, 64);
  ctx.beginPath();
  ctx.moveTo(top[0].x, top[0].y);
  for (let i = 1; i < top.length; i++) ctx.lineTo(top[i].x, top[i].y);
  for (let j = bot.length - 1; j >= 0; j--) ctx.lineTo(bot[j].x, bot[j].y);
  ctx.closePath();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fill();

  // --- Plateau du podium ---
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of top) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const disc = ctx.createRadialGradient(cx, cy, 0, cx, cy, (maxX - minX) / 2);
  disc.addColorStop(0, `rgba(${theme.spot},${0.1 * intensity})`);
  disc.addColorStop(0.55, "rgba(30,30,40,0.55)");
  disc.addColorStop(1, "rgba(8,8,14,0.85)");
  pathPts(ctx, top);
  ctx.fillStyle = disc;
  ctx.fill();

  // Liseré du bord supérieur, éclairé côté spot
  pathPts(ctx, top);
  ctx.strokeStyle = `rgba(${theme.spot},${0.4 * ringGlow})`;
  ctx.lineWidth = Math.max(1, wCard * 0.004);
  ctx.stroke();

  // Rainure de plateau tournant
  const groove = projEllipse(cam, 0, 0, R * 0.72, R * 0.72 * 0.66, groundY, 64);
  pathPts(ctx, groove);
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = Math.max(1, wCard * 0.003);
  ctx.stroke();
}
