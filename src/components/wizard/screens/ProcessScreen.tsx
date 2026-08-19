"use client";

import { useEffect, useState } from "react";
import { compressImage, loadImage, type Corner } from "@/lib/wizard/image-utils";
import { localRemoveBackground } from "@/lib/wizard/local-cutout";
import { computeSharpnessScore, computeResolutionScore } from "@/lib/quality/analyze-photo";
import { computeFramingScore } from "@/lib/quality/analyze-framing";
import { combineQuality } from "@/lib/quality/combine-quality";
import { hashBlob, readQualityCache, writeQualityCache } from "@/lib/quality/quality-cache";
import type { QualityResult } from "@/lib/quality/types";

/**
 * De quoi rejouer la découpe sur la photo d'ORIGINE depuis l'écran de
 * recadrage : sans ça, les poignées ne peuvent que rogner davantage, jamais
 * rattraper un bord que la détection aurait laissé de côté.
 */
export interface CropSource {
  image: HTMLImageElement;
  quad: Corner[];
}

/** Proportions supposées d'une carte, pour proposer un cadre de départ. */
const CARD_RATIO_GUESS = 88 / 63;

interface ProcessScreenProps {
  sourceBlob: Blob;
  onComplete: (result: PipelineResult) => void;
  onRetake: () => void;
}

export interface PipelineResult {
  /** Null quand la détection n'a rien donné : c'est au vendeur de cadrer. */
  image: HTMLImageElement | null;
  /** Null dans le même cas : la note se calcule une fois le cadre posé. */
  quality: QualityResult | null;
  cropSource: CropSource | null;
  /** Vrai si l'on rend la main faute d'avoir su trouver la carte. */
  uncertain?: boolean;
  /** Reportés pour pouvoir terminer la note après l'ajustement manuel. */
  resolution?: number;
  sourceHash?: string | null;
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

  onMessage("Analyse de la photo…");
  const sourceImage = await loadImage(previewUrl);
  // La résolution se juge sur le fichier d'origine : c'est la seule des trois
  // mesures qui parle du fichier et non de ce qu'on en voit.
  const resolution = cachedQuality ? cachedQuality.resolution : computeResolutionScore(sourceImage);

  onMessage("Préparation de l'image…");
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
  if (local?.rectified !== true || !local.quad) {
    // Détection impossible : plutôt qu'un cul-de-sac, on passe la main au
    // vendeur. Il voit sa photo, place les 4 coins à peu près, et la recherche
    // fine du bord repart de là — exactement le même traitement qu'en
    // automatique. Un aveu franc suivi d'un outil qui marche vaut mieux qu'un
    // message d'échec, et bien mieux qu'un détourage douteux affiché quand même.
    const bw = baseImage.naturalWidth || baseImage.width;
    const bh = baseImage.naturalHeight || baseImage.height;
    // Cadre de départ : un rectangle aux proportions d'une carte, centré.
    const gw = Math.min(bw * 0.7, ((bh * 0.7) / CARD_RATIO_GUESS));
    const gh = gw * CARD_RATIO_GUESS;
    const gx = (bw - gw) / 2;
    const gy = (bh - gh) / 2;
    return {
      image: null,
      quality: null,
      cropSource: {
        image: baseImage,
        quad: [
          { x: gx, y: gy },
          { x: gx + gw, y: gy },
          { x: gx + gw, y: gy + gh },
          { x: gx, y: gy + gh },
        ],
      },
      uncertain: true,
      resolution,
      sourceHash,
    };
  }
  // La carte sort déjà droite et bord à bord : la repasser au redressement ou
  // au recentrage pixel ne ferait que la dégrader.
  const straightened = local.image;
  const quad = local.quad;

  onMessage("Vérification de la netteté et du cadrage…");
  // Les deux mesures portent sur la photo TELLE QU'ELLE A ÉTÉ PRISE, en se
  // servant du quadrilatère de la carte : la netteté se juge sur la carte (le
  // fond n'a pas à être net) et le cadrage sur sa place dans le cadre. Les
  // mesurer sur l'image redressée reviendrait à noter notre propre sortie.
  const sharpness = cachedQuality ? cachedQuality.sharpness : computeSharpnessScore(baseImage, quad);
  const framed = computeFramingScore(quad, baseImage.naturalWidth || baseImage.width, baseImage.naturalHeight || baseImage.height);
  const framing = cachedQuality ? cachedQuality.framing : framed.score;

  const quality = cachedQuality ?? combineQuality(sharpness, resolution, framing, framed.issue);
  if (!cachedQuality && sourceHash) writeQualityCache(sourceHash, quality);

  return { image: straightened, quality, cropSource: { image: baseImage, quad }, resolution, sourceHash };
}

/**
 * Note de qualité calculée APRÈS un cadrage posé à la main : la détection
 * automatique n'ayant rien donné, on n'avait pas de quadrilatère sur lequel
 * mesurer la netteté ni le cadrage. Maintenant on l'a.
 */
export function qualityFromQuad(
  photo: HTMLImageElement,
  quad: Corner[],
  resolution: number,
  sourceHash?: string | null
): QualityResult {
  const w = photo.naturalWidth || photo.width;
  const h = photo.naturalHeight || photo.height;
  const framed = computeFramingScore(quad, w, h);
  const quality = combineQuality(computeSharpnessScore(photo, quad), resolution, framed.score, framed.issue);
  if (sourceHash) writeQualityCache(sourceHash, quality);
  return quality;
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
        onComplete(result);
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
