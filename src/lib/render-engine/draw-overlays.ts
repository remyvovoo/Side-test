import { roundRect } from "./geometry";
import type { CardInfo } from "./types";

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
  hasImage: boolean,
  logoText: string,
  pos: { x: number; y: number },
  userScale: number
): { x: number; y: number; w: number; h: number } {
  const s = (W / 1000) * userScale;
  const markH = MARK_H * s;
  const gap = logoText && hasImage ? 18 * s : 0;
  let tw = 0;
  if (logoText) {
    const m = document.createElement("canvas").getContext("2d")!;
    m.font = `600 ${TEXT_H * s}px -apple-system,sans-serif`;
    tw = m.measureText(logoText).width;
  }
  const w = (hasImage ? markH : 0) + gap + tw;
  // `pos` désigne le CENTRE du bloc : c'est ce qu'on manipule à la souris.
  return { x: pos.x * W - w / 2, y: pos.y * H - markH / 2, w, h: markH };
}

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
  const gap = txt && logoImage ? 18 * s : 0;
  const { x: x0, y: y0, w: blockW } = wallLogoRect(W, H, !!logoImage, txt, pos, userScale);

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

  if (logoImage) {
    oc.save();
    roundRect(oc, x0, y0, markH, markH, 14 * s);
    oc.clip();
    oc.drawImage(logoImage, x0, y0, markH, markH);
    oc.restore();
  }
  if (txt) {
    oc.font = `600 ${TEXT_H * s}px -apple-system,sans-serif`;
    oc.fillStyle = ink;
    oc.textBaseline = "middle";
    oc.fillText(txt, x0 + (logoImage ? markH + gap : 0), y0 + markH / 2);
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
