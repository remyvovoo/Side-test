"use client";

import { useEffect, useState } from "react";
import { compressImage, loadImage, autoDetectBounds } from "@/lib/wizard/image-utils";
import { removeBackground, RemoveBackgroundError } from "@/lib/wizard/remove-background";
import { computeSharpnessScore, computeResolutionScore } from "@/lib/quality/analyze-photo";
import { computeFramingScore } from "@/lib/quality/analyze-framing";
import { combineQuality } from "@/lib/quality/combine-quality";
import type { QualityResult } from "@/lib/quality/types";

interface ProcessScreenProps {
  sourceBlob: Blob;
  onComplete: (cutoutImage: HTMLImageElement, quality: QualityResult) => void;
  onRetake: () => void;
}

export function ProcessScreen({ sourceBlob, onComplete, onRetake }: ProcessScreenProps) {
  const [previewUrl] = useState(() => URL.createObjectURL(sourceBlob));
  const [message, setMessage] = useState("Analyse de la photo…");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setError(null);
        setMessage("Analyse de la netteté et de la résolution…");
        const sourceImage = await loadImage(previewUrl);
        const sharpness = computeSharpnessScore(sourceImage);
        const resolution = computeResolutionScore(sourceImage);

        setMessage("Compression avant envoi…");
        const compressed = await compressImage(sourceBlob);

        setMessage("Suppression du fond…");
        const cutoutBlob = await removeBackground(compressed);
        const cutoutImage = await loadImage(URL.createObjectURL(cutoutBlob));

        setMessage("Vérification du cadrage…");
        const bounds = autoDetectBounds(cutoutImage);
        const framing = computeFramingScore(bounds);

        if (cancelled) return;
        onComplete(cutoutImage, combineQuality(sharpness, resolution, framing));
      } catch (e) {
        if (cancelled) return;
        let m = "Le traitement a échoué.";
        if (e instanceof RemoveBackgroundError) {
          if (e.code === 402) m = "Service saturé. Réessaie dans un instant.";
          else if (e.code === 413) m = "Photo trop lourde. Réessaie avec une autre photo.";
          else if (e.code === 500) m = "Le service de détourage n'est pas configuré. Contacte le support.";
        }
        console.error("[cardshot]", e);
        setError(m);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // onComplete is intentionally excluded: it's a fresh callback each render
    // and only sourceBlob/attempt should ever re-trigger this pipeline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceBlob, previewUrl, attempt]);

  return (
    <div className="screen" id="screen-process">
      <div className="process-stage">
        {/* eslint-disable-next-line @next/next/no-img-element -- previewing a blob URL, not a static asset */}
        <img id="processImg" src={previewUrl} alt="Photo en cours de traitement" />
        {!error && <div className="scan-line" />}
      </div>
      {!error && (
        <div className="process-text">
          <div className="spinner" />
          <div className="process-msg">{message}</div>
        </div>
      )}
      {error && (
        <div className="error-box">
          <p>{error}</p>
          <div className="error-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setAttempt((a) => a + 1)} type="button">
              <i className="ti ti-refresh" /> Réessayer
            </button>
            <button className="btn btn-primary btn-sm" onClick={onRetake} type="button">
              <i className="ti ti-camera" /> Reprendre la photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
