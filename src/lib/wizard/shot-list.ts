import type { ShotDescriptor } from "@/lib/render-engine";

export function buildShotList(hasVerso: boolean): ShotDescriptor[] {
  const shots: ShotDescriptor[] = [
    { face: "recto", angle: 0, name: "Recto — de face" },
    { face: "recto", angle: -1, name: "Recto — pivoté gauche" },
    { face: "recto", angle: 1, name: "Recto — pivoté droite" },
  ];
  if (hasVerso) {
    shots.push(
      { face: "verso", angle: 0, name: "Verso — de face" },
      { face: "verso", angle: -1, name: "Verso — pivoté gauche" },
      { face: "verso", angle: 1, name: "Verso — pivoté droite" }
    );
  }
  return shots;
}
