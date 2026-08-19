import { describe, it, expect } from "vitest";
import { clampLogoPos, LOGO_BOUNDS } from "./draw-overlays";

/**
 * Placement du logo vendeur. Deux règles s'y sont succédé au fil des retours
 * de Remy, et elles se contredisaient en apparence : pouvoir poser le logo
 * partout (côté, dessous), mais jamais sur la carte ni collé à elle. Ces
 * tests figent la synthèse pour qu'on ne refasse pas l'aller-retour.
 */

const block = { w: 0.2, h: 0.06 };
/** Zone de la carte, telle que le moteur la calcule (marge comprise). */
const card = { x0: 0.32, y0: 0.2, x1: 0.68, y1: 0.82 };

describe("clampLogoPos", () => {
  it("garde le logo dans le cadre", () => {
    expect(clampLogoPos({ x: -3, y: 2 })).toEqual({ x: LOGO_BOUNDS.minX, y: LOGO_BOUNDS.maxY });
  });

  it("laisse le logo sur le CÔTÉ de la carte", () => {
    const p = clampLogoPos({ x: 0.14, y: 0.5 }, block, card);
    expect(p).toEqual({ x: 0.14, y: 0.5 });
  });

  it("laisse le logo EN DESSOUS de la carte", () => {
    const p = clampLogoPos({ x: 0.5, y: 0.92 }, block, card);
    expect(p).toEqual({ x: 0.5, y: 0.92 });
  });

  it("repousse le logo hors de la carte quand il la chevauche", () => {
    const p = clampLogoPos({ x: 0.5, y: 0.5 }, block, card);
    const overlapX = p.x + block.w / 2 > card.x0 && p.x - block.w / 2 < card.x1;
    const overlapY = p.y + block.h / 2 > card.y0 && p.y - block.h / 2 < card.y1;
    expect(overlapX && overlapY).toBe(false);
  });

  it("repousse par le côté le plus proche : un logo près du haut ressort par le haut", () => {
    const p = clampLogoPos({ x: 0.5, y: 0.22 }, block, card);
    expect(p.y).toBeLessThan(0.22);
    expect(p.x).toBe(0.5);
  });

  it("sans zone interdite, ne fait que borner au cadre", () => {
    expect(clampLogoPos({ x: 0.5, y: 0.5 }, block)).toEqual({ x: 0.5, y: 0.5 });
  });
});
