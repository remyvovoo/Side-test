import type { ShotDescriptor } from "@/lib/render-engine";

export function buildShotList(hasVerso: boolean): ShotDescriptor[] {
  // Décision Remy (18 août 2026) : vues de face uniquement, le temps de
  // stabiliser le rendu. Les pivots (±16°) exposaient trop les limites du
  // compositing 2D (carte plate, perspective simulée) — ils reviendront
  // quand le rendu de face sera au niveau, pas avant.
  const shots: ShotDescriptor[] = [{ face: "recto", angle: 0, name: "Recto — de face" }];
  if (hasVerso) {
    shots.push({ face: "verso", angle: 0, name: "Verso — de face" });
  }
  return shots;
}
