import JSZip from "jszip";
import { renderShot } from "@/lib/render-engine";
import type { RenderRequest, ShotDescriptor } from "@/lib/render-engine";
import { renderDetailShot } from "@/lib/detail-shots/render-detail-shot";
import type { DetailShotDescriptor } from "@/lib/detail-shots/detail-shot-list";
import type { ExportFormat } from "@/lib/wizard/types";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9à-ÿ]+/gi, "-")
    .replace(/^-|-$/g, "");
}

function canvasToBlob(canvas: HTMLCanvasElement, format: ExportFormat): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      format === "png" ? "image/png" : "image/jpeg",
      0.92
    );
  });
}

function shotSuffix(shot: ShotDescriptor): string {
  if (shot.angle === 0) return `${shot.face}-face`;
  return shot.angle < 0 ? `${shot.face}-3-4-gauche` : `${shot.face}-3-4-droite`;
}

interface BuildZipParams {
  shots: ShotDescriptor[];
  detailShots: DetailShotDescriptor[];
  rectoImage: HTMLImageElement;
  versoImage: HTMLImageElement | null;
  baseRequest: Omit<RenderRequest, "shot" | "size">;
  description: string;
  baseName: string;
  format: ExportFormat;
  /**
   * Photos telles qu'elles sortent de l'appareil, avant tout traitement.
   *
   * Jointes au dossier parce qu'une photo prise DANS l'application n'atterrit
   * pas dans la pellicule du téléphone : quand un détourage se passe mal, le
   * vendeur n'a plus d'original à montrer et le défaut n'est pas reproductible.
   * Elles servent aussi de sauvegarde à qui veut refaire ses visuels plus tard.
   */
  sourcePhotos?: { face: string; blob: Blob }[];
}

/**
 * Builds the seller's complete listing package — commercial visuals, real
 * detail shots, a thumbnail and the description — as a single ZIP, matching
 * what a seller actually needs to publish, not just a folder of pictures.
 */
export async function buildAndDownloadZip({
  shots,
  detailShots,
  rectoImage,
  versoImage,
  baseRequest,
  description,
  baseName,
  format,
  sourcePhotos = [],
}: BuildZipParams): Promise<void> {
  const zip = new JSZip();
  const slug = slugify(baseName) || "carte";
  const folder = zip.folder(slug)!;
  const ext = format === "png" ? "png" : "jpg";

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const canvas = document.createElement("canvas");
    renderShot(canvas, { ...baseRequest, shot, size: 1600 });
    const blob = await canvasToBlob(canvas, format);
    const num = String(i + 1).padStart(2, "0");
    folder.file(`${num}-${shotSuffix(shot)}.${ext}`, blob);
  }

  for (const d of detailShots) {
    const sourceImage = d.face === "recto" ? rectoImage : versoImage;
    if (!sourceImage) continue;
    const canvas = document.createElement("canvas");
    renderDetailShot(canvas, sourceImage, d.kind, 1200);
    const blob = await canvasToBlob(canvas, format);
    folder.file(`detail-${d.face}-${d.slug}.${ext}`, blob);
  }

  // Pas de miniature : c'était le MÊME visuel que le recto de face, re-rendu
  // à 500 px. Un doublon en moins bonne qualité, donc inexploitable pour une
  // annonce — les marchands fabriquent eux-mêmes leurs vignettes à partir de
  // la photo principale. Retiré à la demande de Remy le 19 août 2026.

  for (const p of sourcePhotos) {
    folder.file(`photo-origine-${p.face}.${p.blob.type === "image/png" ? "png" : "jpg"}`, p.blob);
  }

  folder.file("description.txt", description || "");

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(zipBlob);
  a.download = `cardshot-${slug}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
