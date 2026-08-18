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
  // L'intensité varie le long de l'anneau : plus brillant côté caméra, plus
  // faible derrière l'objet — comme une vraie source lumineuse au sol.
  const ringGlow = Math.max(0.25, intensity);
  const N = 72;
  [1.5, 1.92].forEach((k, idx) => {
    const ring = projEllipse(cam, 0, 0, R * k, R * k * 0.66, groundY + thick, N);
    const base = (idx === 0 ? 0.58 : 0.34) * ringGlow;
    ctx.save();
    ctx.lineCap = "round";
    for (let pass = 0; pass < 2; pass++) {
      ctx.filter = pass === 0 ? `blur(${wCard * 0.012}px)` : "none";
      ctx.lineWidth = pass === 0 ? wCard * 0.03 : wCard * 0.008;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        const frontness = (1 - Math.sin(a)) / 2; // 1 = face caméra, 0 = derrière
        const alpha = base * (0.3 + 0.7 * frontness) * (pass === 0 ? 0.4 : 1);
        const p0 = ring[i];
        const p1 = ring[(i + 1) % N];
        ctx.strokeStyle = `rgba(${theme.spot},${alpha})`;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  });

  // --- Tranche du podium : dégradé horizontal, cœur légèrement éclairé ---
  const top = projEllipse(cam, 0, 0, R, R * 0.66, groundY, 64);
  const bot = projEllipse(cam, 0, 0, R, R * 0.66, groundY + thick, 64);
  let eMinX = Infinity,
    eMaxX = -Infinity;
  for (const p of top) {
    if (p.x < eMinX) eMinX = p.x;
    if (p.x > eMaxX) eMaxX = p.x;
  }
  const edge = ctx.createLinearGradient(eMinX, 0, eMaxX, 0);
  edge.addColorStop(0, "rgba(2,2,6,0.8)");
  edge.addColorStop(0.5, `rgba(${theme.spot},${0.14 * intensity})`);
  edge.addColorStop(1, "rgba(2,2,6,0.8)");
  ctx.beginPath();
  ctx.moveTo(top[0].x, top[0].y);
  for (let i = 1; i < top.length; i++) ctx.lineTo(top[i].x, top[i].y);
  for (let j = bot.length - 1; j >= 0; j--) ctx.lineTo(bot[j].x, bot[j].y);
  ctx.closePath();
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.fill();
  ctx.fillStyle = edge;
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
