import type { StudioTheme } from "./types";

export function drawBg(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: StudioTheme,
  spotAlpha: number
) {
  const DS = 8;
  const lw = Math.ceil(W / DS);
  const lh = Math.ceil(H / DS);
  const low = document.createElement("canvas");
  low.width = lw;
  low.height = lh;
  const lc = low.getContext("2d")!;
  const hz = lh * 0.63;

  const wall = lc.createLinearGradient(0, 0, 0, hz * 1.2);
  wall.addColorStop(0, t.wallTop);
  wall.addColorStop(0.6, t.wallMid);
  wall.addColorStop(1, t.horizon);
  lc.fillStyle = wall;
  lc.fillRect(0, 0, lw, hz + 1);

  const fg = lc.createLinearGradient(0, hz, 0, lh);
  fg.addColorStop(0, t.horizon);
  fg.addColorStop(0.18, t.wallTop);
  fg.addColorStop(1, t.floor);
  lc.fillStyle = fg;
  lc.fillRect(0, hz, lw, lh - hz);

  // Plafonnier de showroom : nappe de lumière douce qui tombe du haut du mur.
  const ceil = lc.createRadialGradient(lw / 2, -lh * 0.22, 0, lw / 2, -lh * 0.22, lw * 0.75);
  ceil.addColorStop(0, `rgba(235,240,255,${spotAlpha * 0.22})`);
  ceil.addColorStop(0.5, `rgba(235,240,255,${spotAlpha * 0.07})`);
  ceil.addColorStop(1, "rgba(235,240,255,0)");
  lc.fillStyle = ceil;
  lc.fillRect(0, 0, lw, lh);

  // Spot principal derrière l'objet : un cœur net dans un halo large.
  const sp = lc.createRadialGradient(lw / 2, lh * 0.3, 0, lw / 2, lh * 0.3, lw * 0.48);
  sp.addColorStop(0, `rgba(${t.spot},${spotAlpha * 0.26})`);
  sp.addColorStop(1, `rgba(${t.spot},0)`);
  lc.fillStyle = sp;
  lc.fillRect(0, 0, lw, lh);
  const spCore = lc.createRadialGradient(lw / 2, lh * 0.32, 0, lw / 2, lh * 0.32, lw * 0.2);
  spCore.addColorStop(0, `rgba(${t.spot},${spotAlpha * 0.2})`);
  spCore.addColorStop(1, `rgba(${t.spot},0)`);
  lc.fillStyle = spCore;
  lc.fillRect(0, 0, lw, lh);

  // Sol brillant : le spot se reflète en nappe douce sous la ligne d'horizon.
  lc.save();
  lc.beginPath();
  lc.rect(0, hz, lw, lh - hz);
  lc.clip();
  const sheen = lc.createRadialGradient(lw / 2, hz + (lh - hz) * 0.35, 0, lw / 2, hz + (lh - hz) * 0.35, lw * 0.42);
  sheen.addColorStop(0, `rgba(${t.spot},${spotAlpha * 0.16})`);
  sheen.addColorStop(1, `rgba(${t.spot},0)`);
  lc.fillStyle = sheen;
  lc.fillRect(0, hz, lw, lh - hz);
  lc.restore();

  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(low, 0, 0, W, H);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(0, 0, W, H);

  if (t.fx === "stars") {
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = `rgba(220,228,255,${0.1 + Math.random() * 0.26})`;
      ctx.beginPath();
      ctx.arc(W * Math.random(), H * 0.5 * Math.random(), Math.random() * 1.1 + 0.3, 0, 7);
      ctx.fill();
    }
  }
  if (t.fx === "embers") {
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = `rgba(255,170,80,${0.08 + Math.random() * 0.18})`;
      ctx.beginPath();
      ctx.arc(W * Math.random(), H * (0.12 + Math.random() * 0.42), Math.random() * 1.3 + 0.4, 0, 7);
      ctx.fill();
    }
  }
  if (t.fx === "rays") {
    for (let i = -2; i <= 2; i++) {
      const rx = W / 2 + i * W * 0.13;
      const ray = ctx.createLinearGradient(rx, 0, rx + W * 0.05, H * 0.6);
      ray.addColorStop(0, "rgba(255,220,150,0.05)");
      ray.addColorStop(1, "rgba(255,220,150,0)");
      ctx.fillStyle = ray;
      ctx.fillRect(rx, 0, W * 0.035, H * 0.6);
    }
  }

  const g = ctx.getImageData(0, 0, W, H);
  const d = g.data;
  for (let k = 0; k < d.length; k += 4) {
    const n = (Math.random() - 0.5) * 6;
    d[k] += n;
    d[k + 1] += n;
    d[k + 2] += n;
  }
  ctx.putImageData(g, 0, 0);

  const vg = ctx.createRadialGradient(W / 2, H * 0.44, W * 0.18, W / 2, H * 0.5, W * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.62)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}
