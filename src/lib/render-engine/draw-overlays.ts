import { roundRect } from "./geometry";
import type { CardInfo } from "./types";

/** Rapport largeur/hauteur d'un logo, quelle que soit sa nature. */
export function logoAspectOf(img: CanvasImageSource): number {
  const w = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width || 1;
  const h = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height || 1;
  return w / h;
}

/** Hauteur du logo mural et hauteur de sa ligne de texte, pour W = 1000. */
const MARK_H = 62;
const TEXT_H = 30;

/**
 * Filigrane Cardshot, en bas à droite. C'est NOTRE marque, pas celle du
 * vendeur : elle reste discrète, à une place fixe, et disparaît dès que le
 * vendeur importe son propre logo — les deux ne cohabitent jamais.
 */
export function drawCardshotWatermark(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const s = W / 1000;
  const txt = "cardshot";
  ctx.save();
  ctx.font = `600 ${26 * s}px -apple-system,sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  const x = W - 34 * s;
  const y = H - 34 * s;
  // Léger halo sombre pour rester lisible sur un décor clair comme sur un
  // décor sombre, sans le cadre opaque de l'ancienne pastille.
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 10 * s;
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fillText(txt, x, y);
  ctx.restore();
}

/**
 * Encombrement du logo vendeur dans le cadre, en pixels. Sert au rendu ET à
 * l'interface qui permet de le déplacer et de le redimensionner : les deux
 * doivent placer le bloc exactement au même endroit, sans quoi on attrape à
 * côté de ce qu'on voit.
 */
export function wallLogoRect(
  W: number,
  H: number,
  /** Rapport largeur/hauteur du logo importé ; 0 s'il n'y en a pas. */
  logoAspect: number,
  logoText: string,
  pos: { x: number; y: number },
  userScale: number
): { x: number; y: number; w: number; h: number; markW: number } {
  const s = (W / 1000) * userScale;
  const markH = MARK_H * s;
  // Le logo garde SES proportions. Avant, il était forcé dans un carré : un
  // logo large s'y retrouvait rogné (signalé par Remy le 19 août 2026).
  const markW = logoAspect > 0 ? markH * logoAspect : 0;
  const gap = logoText && markW ? 18 * s : 0;
  let tw = 0;
  if (logoText) {
    const m = document.createElement("canvas").getContext("2d")!;
    m.font = `600 ${TEXT_H * s}px -apple-system,sans-serif`;
    tw = m.measureText(logoText).width;
  }
  const w = markW + gap + tw;
  // `pos` désigne le CENTRE du bloc : c'est ce qu'on manipule à la souris.
  return { x: pos.x * W - w / 2, y: pos.y * H - markH / 2, w, h: markH, markW };
}

/**
 * Zone où le logo mural peut se trouver : tout le cadre, à une marge près.
 *
 * Historique, pour ne pas refaire l'aller-retour : cette zone a d'abord été
 * limitée au haut du cadre parce que Remy ne voulait pas voir le logo
 * « autour et sous l'objet ». Il a ensuite demandé à pouvoir le placer sur le
 * CÔTÉ de la carte et EN DESSOUS. Les deux demandes sont compatibles : ce
 * qu'il refusait, c'est que le logo se retrouve à moitié masqué par la carte
 * — pas qu'on puisse le poser ailleurs qu'en haut. Le placement est donc
 * libre, et c'est le vendeur qui décide ; la carte reste devant, ce qui est
 * physiquement juste pour une enseigne au fond de la pièce.
 */
export const LOGO_BOUNDS = { minX: 0.04, maxX: 0.96, minY: 0.04, maxY: 0.96 };
export const clampLogoPos = (p: { x: number; y: number }) => ({
  x: Math.min(LOGO_BOUNDS.maxX, Math.max(LOGO_BOUNDS.minX, p.x)),
  y: Math.min(LOGO_BOUNDS.maxY, Math.max(LOGO_BOUNDS.minY, p.y)),
});

/**
 * Le logo du vendeur, POSÉ SUR LE MUR de la scène.
 *
 * Avant, c'était une pastille d'interface (rectangle sombre, liseré, coin bas
 * droit) apposée sur l'image finie : elle ne pouvait qu'avoir l'air collée,
 * puisqu'elle n'appartenait pas à la scène. Remy l'a signalé comme le point
 * faible du rendu, et c'est aussi ce que fait CarBox, dont il nous a montré
 * l'interface : le logo va sur la paroi, pas par-dessus la photo.
 *
 * Deux choses le font appartenir à la scène :
 *   1. il est dessiné AVANT la carte — celle-ci, son ombre et son reflet
 *      passent donc devant, ce qui crée la profondeur à peu de frais ;
 *   2. il prend la lumière du mur au lieu de la masquer. Sur un décor
 *      sombre, on le compose en « screen » : il se comporte comme une
 *      enseigne rétroéclairée, et le dégradé du mur transparaît. Sur un
 *      décor clair (une plaque photographique), on bascule en « multiply »
 *      et il se comporte comme une impression. Dans les deux cas le mur
 *      module le logo, et l'ombre propre de la paroi le traverse.
 *
 * Décision produit maintenue (Remy) : il doit rester NETTEMENT visible.
 * L'intégration ne doit pas devenir de l'effacement.
 */
export function drawWallLogo(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  logoImage: CanvasImageSource | null,
  logoText: string,
  pos: { x: number; y: number } = { x: 0.5, y: 0.14 },
  userScale = 1
) {
  // Rien du vendeur : c'est le filigrane Cardshot qui prend la place, mais il
  // se dessine en fin de rendu (voir renderShot) puisqu'il passe DEVANT la
  // carte. Les deux marques ne s'affichent JAMAIS ensemble (Remy, 19 août
  // 2026) : le logo importé REMPLACE le nôtre, et le retirer nous le rend.
  if (!logoImage && !logoText) return;

  const txt = logoText;
  const s = (W / 1000) * userScale;
  const markH = MARK_H * s;
  const aspect = logoImage ? logoAspectOf(logoImage) : 0;
  const { x: x0, y: y0, w: blockW, markW } = wallLogoRect(W, H, aspect, txt, clampLogoPos(pos), userScale);
  const gap = txt && markW ? 18 * s : 0;

  // Luminosité du mur là où le logo va se poser : c'est elle qui décide si le
  // logo doit s'allumer (mur sombre) ou s'imprimer (mur clair).
  const px = Math.max(0, Math.round(x0));
  const py = Math.max(0, Math.round(y0));
  const pw = Math.min(W - px, Math.round(blockW) || 1);
  const ph = Math.min(H - py, Math.round(markH) || 1);
  let wall = 0;
  const d = ctx.getImageData(px, py, Math.max(1, pw), Math.max(1, ph)).data;
  for (let i = 0; i < d.length; i += 4) wall += (d[i] + d[i + 1] + d[i + 2]) / 3;
  wall /= d.length / 4;
  const darkWall = wall < 128;

  const off = document.createElement("canvas");
  off.width = W;
  off.height = H;
  const oc = off.getContext("2d")!;
  const ink = darkWall ? "#ffffff" : "#0b0a14";

  // Aucun masque : le logo est dessiné tel quel, à ses proportions. Un PNG
  // à fond transparent se fond donc dans le mur — d'où le conseil affiché
  // dans « Mon studio ».
  if (logoImage) oc.drawImage(logoImage, x0, y0, markW, markH);
  if (txt) {
    oc.font = `600 ${TEXT_H * s}px -apple-system,sans-serif`;
    oc.fillStyle = ink;
    oc.textBaseline = "middle";
    oc.fillText(txt, x0 + markW + gap, y0 + markH / 2);
  }

  ctx.save();
  ctx.globalCompositeOperation = darkWall ? "screen" : "multiply";
  ctx.globalAlpha = 0.78;
  ctx.drawImage(off, 0, 0);
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
