import { renderShot } from "@/lib/render-engine";
import type { RenderRequest, ShotDescriptor } from "@/lib/render-engine";
import type { ExportFormat } from "@/lib/wizard/types";

interface DownloadParams {
  shots: ShotDescriptor[];
  baseRequest: Omit<RenderRequest, "shot" | "size">;
  baseName: string;
  format: ExportFormat;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9à-ÿ]+/gi, "-")
    .replace(/^-|-$/g, "");
}

/** Renders each selected shot at export resolution and triggers a browser download for each. */
export function downloadShots({ shots, baseRequest, baseName, format }: DownloadParams) {
  const base = slugify(baseName) || "carte";
  shots.forEach((shot, i) => {
    setTimeout(() => {
      const canvas = document.createElement("canvas");
      renderShot(canvas, { ...baseRequest, shot, size: 1600 });
      const suffix = shot.face + (shot.angle === 0 ? "-face" : shot.angle < 0 ? "-gauche" : "-droite");
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `cardshot-${base}-${suffix}.${format}`;
          document.body.appendChild(a);
          a.click();
          a.remove();
        },
        format === "png" ? "image/png" : "image/jpeg",
        0.95
      );
    }, i * 450);
  });
}
