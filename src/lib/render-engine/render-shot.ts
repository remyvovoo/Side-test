import { makeCam, cardCorners } from "./geometry";
import { drawBg } from "./draw-background";
import { drawPlatform } from "./draw-platform";
import { drawStandBase, drawCase } from "./draw-stand";
import { drawGroundShadow, drawReflection, drawPerspective, applyPhotoGrade } from "./draw-effects";
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

  // Podium de présentation : dessiné avant l'objet, il pose la scène.
  drawPlatform(ctx, cam, wCard, liftY, theme, request.halo);

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

  // --- Calque carte hors écran : la silhouette réelle de la carte détourée
  // (coins arrondis compris) sert pour l'ombre ET reçoit la lumière — plus
  // aucun rectangle noir qui dépasse aux coins.
  const cardLayer = document.createElement("canvas");
  cardLayer.width = W;
  cardLayer.height = H;
  const cctx = cardLayer.getContext("2d")!;
  drawPerspective(cctx, img, q, 110);

  // Toute la lumière est appliquée « source-atop » : seuls les pixels de la
  // carte sont touchés, jamais les zones transparentes.
  cctx.globalCompositeOperation = "source-atop";
  if (shot.angle !== 0) {
    const x0 = shot.angle > 0 ? q[0].x : q[1].x;
    const x1 = shot.angle > 0 ? q[1].x : q[0].x;
    const sg = cctx.createLinearGradient(x0, 0, x1, 0);
    sg.addColorStop(0, "rgba(0,0,0,0.30)");
    sg.addColorStop(0.55, "rgba(0,0,0,0.04)");
    sg.addColorStop(1, "rgba(255,255,255,0.05)");
    cctx.fillStyle = sg;
    cctx.fillRect(0, 0, W, H);
  }
  // Balance des blancs + exposition adaptatives : la carte adopte la
  // température de couleur de l'univers (chaude dans Brasier, froide dans
  // Abysses) et perd un peu de luminosité — sa photo d'origine est prise en
  // plein jour, la scène est une pièce sombre.
  {
    const [sr, sg2, sb] = theme.spot.split(",").map((v) => parseInt(v.trim(), 10));
    const k = 0.32; // force du virage colorimétrique
    const mr = Math.round(255 - (255 - sr) * k);
    const mg = Math.round(255 - (255 - sg2) * k);
    const mb = Math.round(255 - (255 - sb) * k);
    // Le mode « multiply » déborde sur les zones transparentes : on garde la
    // silhouette d'origine pour restaurer l'alpha juste après.
    const alphaRef = document.createElement("canvas");
    alphaRef.width = W;
    alphaRef.height = H;
    alphaRef.getContext("2d")!.drawImage(cardLayer, 0, 0);
    cctx.globalCompositeOperation = "multiply";
    cctx.fillStyle = `rgba(${mr},${mg},${mb},0.55)`;
    cctx.fillRect(0, 0, W, H);
    cctx.globalCompositeOperation = "destination-in";
    cctx.drawImage(alphaRef, 0, 0);
    cctx.globalCompositeOperation = "source-atop";
  }
  const topY = Math.min(q[0].y, q[1].y);
  const botY = Math.max(q[2].y, q[3].y);
  const tint = cctx.createLinearGradient(0, topY, 0, botY);
  tint.addColorStop(0, `rgba(${theme.spot},${0.06 * request.halo})`);
  tint.addColorStop(0.55, `rgba(${theme.spot},0.02)`);
  tint.addColorStop(1, "rgba(4,4,12,0.16)");
  cctx.fillStyle = tint;
  cctx.fillRect(0, 0, W, H);
  const sheen = cctx.createLinearGradient(q[0].x, q[0].y, q[2].x, q[2].y);
  sheen.addColorStop(0.3, "rgba(255,255,255,0)");
  sheen.addColorStop(0.42, `rgba(255,255,255,${0.035 * request.halo})`);
  sheen.addColorStop(0.47, `rgba(255,255,255,${0.08 * request.halo})`);
  sheen.addColorStop(0.54, `rgba(255,255,255,${0.03 * request.halo})`);
  sheen.addColorStop(0.64, "rgba(255,255,255,0)");
  cctx.fillStyle = sheen;
  cctx.fillRect(0, 0, W, H);
  cctx.globalCompositeOperation = "source-over";

  // Ombre portée : la silhouette exacte de la carte, floutée et décalée.
  const sil = document.createElement("canvas");
  sil.width = W;
  sil.height = H;
  const sctx = sil.getContext("2d")!;
  sctx.drawImage(cardLayer, 0, 0);
  sctx.globalCompositeOperation = "source-in";
  sctx.fillStyle = "#000";
  sctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.filter = `blur(${26 * scale}px)`;
  ctx.drawImage(sil, 0, 12 * scale);
  ctx.restore();

  ctx.drawImage(cardLayer, 0, 0);

  if (mount.id === "case") drawCase(ctx, q, wCard);

  // Traitement photo final commun (grain, vignettage, voile) : carte + décor
  // reçoivent la même « pellicule » — c'est ce qui soude l'ensemble.
  applyPhotoGrade(ctx, W, H, theme.spot);

  drawInfoTag(ctx, W, H, request.cardInfo);
  drawLogoBadge(ctx, W, H, request.logoImage, request.logoText);
}
