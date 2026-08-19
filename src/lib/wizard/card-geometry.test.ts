import { describe, it, expect } from "vitest";
import { fitCardQuad } from "./card-geometry";

/**
 * Le détourage géométrique est le cœur du produit : c'est lui qui décide de
 * la silhouette, donc de ce que l'acheteur voit de l'état de la carte. Ces
 * tests verrouillent les GARDE-FOUS — ce que la fonction doit REFUSER — plus
 * que sa précision, qui se mesure à l'écran.
 */

/** Masque d'une carte rectangulaire posée droit, aux proportions demandées. */
function rectMask(w: number, h: number, x0: number, y0: number, cw: number, ch: number) {
  const mask = new Uint8Array(w * h);
  for (let y = y0; y < y0 + ch; y++) {
    for (let x = x0; x < x0 + cw; x++) mask[y * w + x] = 1;
  }
  return mask;
}

describe("fitCardQuad", () => {
  it("retrouve les 4 coins d'une carte droite, au pixel près", () => {
    const W = 300;
    const H = 400;
    const quad = fitCardQuad(rectMask(W, H, 60, 40, 140, 196), W, H);
    expect(quad).not.toBeNull();
    const [tl, tr, br, bl] = quad!;
    expect(tl.x).toBeCloseTo(60, 0);
    expect(tl.y).toBeCloseTo(40, 0);
    expect(tr.x).toBeCloseTo(199, 0);
    expect(bl.y).toBeCloseTo(235, 0);
    expect(br.x).toBeCloseTo(199, 0);
  });

  it("tolère un éclat sur un bord : un défaut ne doit pas faire échouer l'ajustement", () => {
    const W = 300;
    const H = 400;
    const mask = rectMask(W, H, 60, 40, 140, 196);
    // On retire une encoche de 6 px de profondeur sur le bord droit.
    for (let y = 120; y < 150; y++) {
      for (let x = 194; x < 200; x++) mask[y * W + x] = 0;
    }
    const quad = fitCardQuad(mask, W, H);
    expect(quad).not.toBeNull();
    // Le bord reste ajusté sur la matière saine, pas tiré par l'encoche.
    expect(quad![1].x).toBeCloseTo(199, 0);
  });

  it("refuse une forme carrée (proportions hors carte)", () => {
    const W = 300;
    const H = 300;
    expect(fitCardQuad(rectMask(W, H, 50, 50, 180, 180), W, H)).toBeNull();
  });

  it("refuse un bandeau trop allongé", () => {
    const W = 300;
    const H = 400;
    expect(fitCardQuad(rectMask(W, H, 40, 40, 60, 320), W, H)).toBeNull();
  });

  it("refuse un masque vide", () => {
    expect(fitCardQuad(new Uint8Array(300 * 400), 300, 400)).toBeNull();
  });
});
