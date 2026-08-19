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

/**
 * Tranche de la carte : sans elle, une carte pivotée est un plan parfait
 * d'épaisseur nulle — impossible à distinguer d'un rectangle plat, quelle que
 * soit la qualité du détourage. On dessine les 2 bords latéraux (gauche et
 * droit) entre la face avant `qFront` et un second plan `qBack` légèrement
 * décalé en profondeur (voir cardCorners). Appelé AVANT la face avant : elle
 * la recouvre, seul le bord qui dépasse réellement en dehors de la silhouette
 * (celui qui s'éloigne de la caméra) reste visible — inutile de calculer quel
 * côté c'est, l'occlusion s'en charge toute seule.
 */
export function drawCardEdge(ctx: CanvasRenderingContext2D, qFront: Point2D[], qBack: Point2D[]) {
  const [TLf, TRf, BRf, BLf] = qFront;
  const [TLb, TRb, BRb, BLb] = qBack;

  function side(top: Point2D, topBack: Point2D, bottomBack: Point2D, bottom: Point2D) {
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(topBack.x, topBack.y);
    ctx.lineTo(bottomBack.x, bottomBack.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.closePath();
    // Tranche de carton : crème côté lumière, sombre côté arrière — la même
    // logique que la pellicule de papier qu'on aperçoit sur une vraie carte
    // inclinée, sans se caler sur l'âme noire spécifique à certaines éditions
    // (pas générique à tous les jeux).
    const g = ctx.createLinearGradient(top.x, top.y, topBack.x, topBack.y);
    g.addColorStop(0, "#f5f0e2");
    g.addColorStop(0.5, "#cfc8b4");
    g.addColorStop(1, "#332f26");
    ctx.fillStyle = g;
    ctx.fill();
  }

  side(TRf, TRb, BRb, BRf); // tranche droite
  side(TLf, TLb, BLb, BLf); // tranche gauche
}

export function drawGroundShadow(ctx: CanvasRenderingContext2D, corners: Point2D[]) {
  const BL = corners[3];
  const BR = corners[2];
  const cxm = (BL.x + BR.x) / 2;
  const cym = (BL.y + BR.y) / 2;
  const w = Math.abs(BR.x - BL.x);
  ctx.save();
  // Pénombre large et douce…
  const sh = ctx.createRadialGradient(cxm, cym, 0, cxm, cym, w * 0.72);
  sh.addColorStop(0, "rgba(0,0,0,0.55)");
  sh.addColorStop(0.55, "rgba(0,0,0,0.26)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.ellipse(cxm, cym + 3, w * 0.68, w * 0.075, 0, 0, 7);
  ctx.fill();
  // …et un cœur dense collé sous l'objet : c'est lui qui « pose » la carte au sol.
  const core = ctx.createRadialGradient(cxm, cym, 0, cxm, cym, w * 0.34);
  core.addColorStop(0, "rgba(0,0,0,0.85)");
  core.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.ellipse(cxm, cym + 1.5, w * 0.4, w * 0.034, 0, 0, 7);
  ctx.fill();
  ctx.restore();
}

/** Grain photographique seul : soude carte et décor sous un même bruit. */
export function applyGrain(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const g = ctx.getImageData(0, 0, W, H);
  const d = g.data;
  for (let k = 0; k < d.length; k += 4) {
    const n = (Math.random() - 0.5) * 6;
    d[k] += n;
    d[k + 1] += n;
    d[k + 2] += n;
  }
  ctx.putImageData(g, 0, 0);
}

/**
 * Traitement « photo » appliqué à l'image finale ENTIÈRE (carte comprise) :
 * grain, vignettage et voile colorimétrique de l'univers. C'est ce traitement
 * commun qui soude l'objet et le décor en une seule et même photo.
 * (Décors dessinés uniquement — une plaque photo a déjà son vignettage et sa
 * dominante propres : elle ne reçoit que le grain, via applyGrain.)
 */
export function applyPhotoGrade(ctx: CanvasRenderingContext2D, W: number, H: number, spot: string) {
  ctx.fillStyle = `rgba(${spot},0.04)`;
  ctx.fillRect(0, 0, W, H);

  applyGrain(ctx, W, H);

  const vg = ctx.createRadialGradient(W / 2, H * 0.44, W * 0.18, W / 2, H * 0.5, W * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
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

  // Le reflet ne doit jamais atteindre le bas du cadre. Son dégradé propre
  // s'éteint à `bot`, mais quand la carte est posée bas dans l'image, `bot`
  // tombe SOUS le canvas : le reflet est alors encore visible au dernier
  // pixel et le bord le tranche net (repéré par Remy le 19 août 2026, sur
  // le rendu de face). Ce second évanouissement, ancré sur le cadre et non
  // sur la carte, garantit un alpha nul au bord quelle que soit la position.
  const H = off.height;
  const fadeFrom = H * 0.82;
  if (bot > fadeFrom) {
    const edge = oc.createLinearGradient(0, fadeFrom, 0, H);
    edge.addColorStop(0, "rgba(0,0,0,1)");
    edge.addColorStop(1, "rgba(0,0,0,0)");
    // Plein cadre : en destination-in, toute zone non peinte serait effacée.
    // Un dégradé prolonge sa première teinte au-dessus de son point de
    // départ, donc le haut du reflet reste intact.
    oc.fillStyle = edge;
    oc.fillRect(0, 0, off.width, H);
  }

  ctx.drawImage(off, 0, 0);
}
