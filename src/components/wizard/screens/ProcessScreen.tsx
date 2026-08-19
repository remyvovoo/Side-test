"use client";

import { useEffect, useState } from "react";
import {
  compressImage,
  loadImage,
  autoDetectBounds,
} from "@/lib/wizard/image-utils";
import { localRemoveBackground } from "@/lib/wizard/local-cutout";
import { computeSharpnessScore, computeResolutionScore } from "@/lib/quality/analyze-photo";
import { computeFramingScore } from "@/lib/quality/analyze-framing";
import { combineQuality } from "@/lib/quality/combine-quality";
import { hashBlob, readQualityCache, writeQualityCache } from "@/lib/quality/quality-cache";
import type { QualityResult } from "@/lib/quality/types";

interface ProcessScreenProps {
  sourceBlob: Blob;
  onComplete: (cutoutImage: HTMLImageElement, quality: QualityResult) => void;
  onRetake: () => void;
}

interface PipelineResult {
  image: HTMLImageElement;
  quality: QualityResult;
}

// Déduplication : en dev, React monte les effets deux fois — les deux montages
// partagent la MÊME promesse de traitement (un seul détourage, un seul appel
// éventuel au service de secours payant), et le montage encore vivant livre
// le résultat. En cas d'échec, l'entrée est purgée pour permettre un réessai.
const pipelines = new Map<Blob, Promise<PipelineResult>>();

/** Aucun détourage fiable : c'est presque toujours le fond qui est en cause. */
export class LowContrastError extends Error {
  constructor(public reason?: unknown) {
    super("low_contrast");
    this.name = "LowContrastError";
  }
}

async function runPipeline(
  sourceBlob: Blob,
  previewUrl: string,
  onMessage: (m: string) => void
): Promise<PipelineResult> {
  // Même photo déjà analysée → on ressort exactement le même score.
  const sourceHash = await hashBlob(sourceBlob);
  const cachedQuality = sourceHash ? readQualityCache(sourceHash) : null;

  onMessage("Analyse de la netteté et de la résolution…");
  const sourceImage = await loadImage(previewUrl);
  const sharpness = cachedQuality ? cachedQuality.sharpness : computeSharpnessScore(sourceImage);
  const resolution = cachedQuality ? cachedQuality.resolution : computeResolutionScore(sourceImage);

  onMessage("Compression avant envoi…");
  const compressed = await compressImage(sourceBlob);

  onMessage("Suppression du fond…");
  const baseImage = await loadImage(URL.createObjectURL(compressed));

  // Détourage maison, gratuit et instantané : c'est le SEUL chemin.
  //
  // La voie géométrique (ajustement des 4 droites puis redressement) est la
  // seule à laquelle on fasse confiance. Le détourage au pixel produisait des
  // silhouettes déchirées sur fond peu contrasté, et le service de secours
  // payant ne faisait pas mieux tout en coûtant à chaque photo. Règle de Remy
  // le 19 août 2026 : afficher directement « fond uni » plutôt que tenter un
  // rattrapage. Un échec nommé vaut mieux qu'un résultat douteux.
  const local = await localRemoveBackground(baseImage);
  if (local?.rectified !== true) throw new LowContrastError();
  // La carte sort déjà droite et bord à bord : la repasser au redressement ou
  // au recentrage pixel ne ferait que la dégrader.
  const straightened = local.image;

  onMessage("Vérification du cadrage…");
  // Le cadrage est mesuré AVANT recentrage : il évalue la photo d'origine.
  const bounds = autoDetectBounds(straightened);
  const framing = cachedQuality ? cachedQuality.framing : computeFramingScore(bounds);

  const quality = cachedQuality ?? combineQuality(sharpness, resolution, framing);
  if (!cachedQuality && sourceHash) writeQualityCache(sourceHash, quality);

  return { image: straightened, quality };
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
        let pipeline = pipelines.get(sourceBlob);
        if (!pipeline) {
          pipeline = runPipeline(sourceBlob, previewUrl, (m) => setMessage(m));
          pipelines.set(sourceBlob, pipeline);
          pipeline.catch(() => pipelines.delete(sourceBlob));
        }
        const result = await pipeline;
        if (cancelled) return;
        onComplete(result.image, result.quality);
      } catch (e) {
        if (cancelled) return;
        let m = "Le traitement a échoué.";
        if (e instanceof LowContrastError) {
          m = "Le fond ne se distingue pas assez de la carte. Pose-la sur un fond uni et contrasté, puis reprends la photo.";
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
