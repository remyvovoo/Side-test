"use client";

import { useEffect, useRef, useState } from "react";
import { autoDetectBounds, type Corner } from "@/lib/wizard/image-utils";
import { rectifyCard } from "@/lib/wizard/card-geometry";
import type { CropSource } from "./ProcessScreen";

interface CropScreenProps {
  /** La carte déjà détourée — ce qu'on garde si le vendeur ne touche à rien. */
  image: HTMLImageElement;
  /** La photo d'origine + les coins détectés, pour pouvoir tout rejouer. */
  cropSource: CropSource | null;
  title: string;
  onApply: (result: HTMLImageElement) => void;
  onRetake: () => void;
}

function sameCorners(a: Corner[], b: Corner[]): boolean {
  return a.every((p, i) => Math.abs(p.x - b[i].x) < 0.5 && Math.abs(p.y - b[i].y) < 0.5);
}

/**
 * Garde-fou sur le cadre DESSINÉ, pas sur la carte : la découpe étire ce
 * quadrilatère aux proportions d'une carte, donc un cadre aplati par un pouce
 * maladroit donnerait une carte étirée sans rien signaler. On refuse l'absurde,
 * et on laisse passer tout le reste — y compris un cadre plus large que la
 * détection, c'est justement à ça qu'il sert. Bornes volontairement lâches.
 */
function looksLikeACard(q: Corner[], photoW: number, photoH: number): boolean {
  const dist = (a: Corner, b: Corner) => Math.hypot(a.x - b.x, a.y - b.y);
  const w = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2;
  const h = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2;
  if (w < 24 || h < 24) return false;
  const ratio = h / w;
  if (ratio < 0.8 || ratio > 2.6) return false;
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const p = q[i];
    const n = q[(i + 1) % 4];
    area += p.x * n.y - n.x * p.y;
  }
  return Math.abs(area) / 2 >= photoW * photoH * 0.02;
}

export function CropScreen({ image, cropSource, title, onApply, onRetake }: CropScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // On travaille sur la photo D'ORIGINE quand on l'a : tirer une poignée vers
  // l'extérieur doit pouvoir aller RECHERCHER de la carte que la détection
  // aurait manquée. Sur l'image détourée, au-delà du contour, il n'y a plus
  // que du vide — les poignées y étaient prisonnières du cadre automatique
  // (défaut signalé par Remy le 19 août 2026).
  const stageImage = cropSource?.image ?? image;
  const detected = cropSource?.quad ?? null;
  const [corners, setCorners] = useState<Corner[]>(() => detected ?? autoDetectBounds(image));
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scaleRef = useRef(1);
  const dragRef = useRef(-1);

  function draw(current: Corner[], isManual: boolean) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = Math.min(700 / stageImage.width, 1);
    scaleRef.current = s;
    const W = Math.round(stageImage.width * s);
    const H = Math.round(stageImage.height * s);
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(stageImage, 0, 0, W, H);
    const c = current.map((p) => ({ x: p.x * s, y: p.y * s }));
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.moveTo(c[0].x, c[0].y);
    ctx.lineTo(c[3].x, c[3].y);
    ctx.lineTo(c[2].x, c[2].y);
    ctx.lineTo(c[1].x, c[1].y);
    ctx.closePath();
    ctx.fill("evenodd");
    ctx.restore();
    ctx.strokeStyle = "#8b7cf8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c[0].x, c[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(c[i].x, c[i].y);
    ctx.closePath();
    ctx.stroke();
    if (isManual) {
      // Rayon exprimé en pixels RÉELLEMENT affichés : sur un téléphone le
      // canvas est réduit par le CSS, et des poignées dessinées « 9 px »
      // devenaient trop petites pour le pouce.
      const rect = canvas.getBoundingClientRect();
      const k = rect.width > 0 ? canvas.width / rect.width : 1;
      c.forEach((p) => {
        ctx.fillStyle = "#8b7cf8";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 13 * k, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5 * k, 0, 7);
        ctx.fill();
      });
    }
  }

  useEffect(() => {
    draw(corners, manual);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corners, manual, stageImage]);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): Corner {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    const k = canvas.width / r.width;
    return { x: ((e.clientX - r.left) * k) / scaleRef.current, y: ((e.clientY - r.top) * k) / scaleRef.current };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!manual || busy) return;
    e.preventDefault();
    const p = pointFromEvent(e);
    let best = -1;
    let bd = Infinity;
    corners.forEach((c, i) => {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (bd < 60 / scaleRef.current) {
      dragRef.current = best;
      (e.target as Element).setPointerCapture(e.pointerId);
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (dragRef.current < 0) return;
    e.preventDefault();
    const p = pointFromEvent(e);
    const next = corners.slice();
    // Seule limite : la photo elle-même. Le quadrilatère détecté n'est plus
    // une borne — c'est justement quand la détection a pris TROP PEU qu'on
    // vient ajuster.
    next[dragRef.current] = {
      x: Math.max(0, Math.min(stageImage.width, p.x)),
      y: Math.max(0, Math.min(stageImage.height, p.y)),
    };
    setCorners(next);
  }

  function handlePointerUp() {
    dragRef.current = -1;
  }

  async function applyCrop() {
    if (busy) return;
    setError(null);

    // Rien n'a bougé : on garde le détourage déjà calculé, au pixel près.
    if (detected && sameCorners(corners, detected)) {
      onApply(image);
      return;
    }

    if (cropSource) {
      if (!looksLikeACard(corners, stageImage.width, stageImage.height)) {
        setError("Ce cadre ne ressemble pas à une carte. Reprends les 4 coins, ou reviens au découpage automatique.");
        return;
      }
      // Les coins ont bougé : on rejoue la découpe sur la photo d'origine.
      // C'est le même chemin que la détection automatique — redressement de
      // perspective compris, et contour RÉEL relevé sur l'image redressée
      // (ni coins arrondis inventés, ni éclats effacés).
      setBusy(true);
      try {
        onApply(await rectifyCard(cropSource.image, corners));
      } catch {
        setError("Ce cadre ne ressemble pas à une carte. Reprends les 4 coins, ou reviens au découpage automatique.");
      } finally {
        setBusy(false);
      }
      return;
    }

    // Chemin de repli (pas de photo d'origine disponible) : découpe au
    // quadrilatère tracé, sans redressement.
    const c = corners;
    const minX = Math.min(c[0].x, c[1].x, c[2].x, c[3].x);
    const maxX = Math.max(c[0].x, c[1].x, c[2].x, c[3].x);
    const minY = Math.min(c[0].y, c[1].y, c[2].y, c[3].y);
    const maxY = Math.max(c[0].y, c[1].y, c[2].y, c[3].y);
    const w = Math.max(8, Math.round(maxX - minX));
    const h = Math.max(8, Math.round(maxY - minY));
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const ctx2 = out.getContext("2d")!;
    ctx2.translate(-minX, -minY);
    ctx2.beginPath();
    ctx2.moveTo(c[0].x, c[0].y);
    ctx2.lineTo(c[1].x, c[1].y);
    ctx2.lineTo(c[2].x, c[2].y);
    ctx2.lineTo(c[3].x, c[3].y);
    ctx2.closePath();
    ctx2.clip();
    ctx2.drawImage(image, 0, 0);
    const res = new Image();
    res.onload = () => onApply(res);
    res.src = out.toDataURL("image/png");
  }

  return (
    <div className="screen" id="screen-crop">
      <div className="screen-title" style={{ textAlign: "center" }}>
        {title}
      </div>
      <div className="screen-sub" style={{ textAlign: "center" }}>
        Le cadre doit suivre les bords de la carte, coins compris.
      </div>
      <div className="crop-toolbar">
        <button
          className={`crop-tool${!manual ? " active" : ""}`}
          onClick={() => {
            setCorners(detected ?? autoDetectBounds(image));
            setError(null);
            setManual(false);
          }}
          type="button"
        >
          <i className="ti ti-wand" /> Auto
        </button>
        <button className={`crop-tool${manual ? " active" : ""}`} onClick={() => setManual(true)} type="button">
          <i className="ti ti-crop" /> Ajuster les coins
        </button>
      </div>
      <div className="crop-stage">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>
      <div className="crop-hint">
        {error
          ? error
          : manual
            ? "Fais glisser les 4 poignées — tu peux les emmener au-delà du cadre détecté."
            : "Découpage automatique. Si un bord est mordu, passe par « Ajuster les coins »."}
      </div>
      <div className="stack-actions">
        <button className="btn btn-primary" onClick={applyCrop} type="button" disabled={busy}>
          {busy ? (
            <>
              <span className="spinner" style={{ width: 16, height: 16, margin: 0, display: "inline-block" }} /> Découpe
              en cours…
            </>
          ) : (
            <>
              <i className="ti ti-check" /> Valider
            </>
          )}
        </button>
        <button className="btn btn-ghost" onClick={onRetake} type="button" disabled={busy}>
          <i className="ti ti-camera" /> Reprendre la photo
        </button>
      </div>
    </div>
  );
}
