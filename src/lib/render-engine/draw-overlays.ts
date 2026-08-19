import { roundRect } from "./geometry";
import type { CardInfo } from "./types";

/** Hauteur du logo mural et hauteur de sa ligne de texte, pour W = 1000. */
const MARK_H = 62;
const TEXT_H = 30;
/** Position du bloc sur le mur, en fraction de la hauteur du cadre. */
const WALL_Y = 0.085;

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
  logoText: string
) {
  const txt = logoText || "cardshot";
  const s = W / 1000;
  const markH = MARK_H * s;
  const gap = 18 * s;

  ctx.font = `600 ${TEXT_H * s}px -apple-system,sans-serif`;
  const tw = ctx.measureText(txt).width;
  const blockW = (logoImage ? markH + gap : 0) + tw;
  const x0 = (W - blockW) / 2;
  const y0 = H * WALL_Y;

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
  oc.font = `600 ${TEXT_H * s}px -apple-system,sans-serif`;
  oc.fillStyle = ink;
  oc.textBaseline = "middle";
  oc.fillText(txt, x0 + (logoImage ? markH + gap : 0), y0 + markH / 2);

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
