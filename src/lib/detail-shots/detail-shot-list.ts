import type { Face } from "@/lib/render-engine";
import type { DetailKind } from "./render-detail-shot";

export interface DetailShotDescriptor {
  id: string;
  face: Face;
  kind: DetailKind;
  label: string;
  /** File name suffix used both for on-screen labels and the ZIP export. */
  slug: string;
}

function forFace(face: Face, faceLabel: string): DetailShotDescriptor[] {
  return [
    { id: `${face}-coin-hg`, face, kind: "corner-tl", label: `${faceLabel} — coin haut gauche`, slug: "coin-haut-gauche" },
    { id: `${face}-coin-hd`, face, kind: "corner-tr", label: `${faceLabel} — coin haut droit`, slug: "coin-haut-droit" },
    { id: `${face}-coin-bg`, face, kind: "corner-bl", label: `${faceLabel} — coin bas gauche`, slug: "coin-bas-gauche" },
    { id: `${face}-coin-bd`, face, kind: "corner-br", label: `${faceLabel} — coin bas droit`, slug: "coin-bas-droit" },
    { id: `${face}-surface`, face, kind: "surface", label: `${faceLabel} — surface complète`, slug: "surface" },
  ];
}

export function buildDetailShotList(hasVerso: boolean): DetailShotDescriptor[] {
  return hasVerso ? [...forFace("recto", "Recto"), ...forFace("verso", "Verso")] : forFace("recto", "Recto");
}
