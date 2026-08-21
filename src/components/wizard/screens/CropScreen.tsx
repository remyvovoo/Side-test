"use client";

import { useEffect, useRef, useState } from "react";
import { autoDetectBounds, type Corner } from "@/lib/wizard/image-utils";
import { rectifyCard, refineQuadByGradient } from "@/lib/wizard/card-geometry";
import type { CropSource } from "./ProcessScreen";

interface CropScreenProps {
  /** La carte déjà détourée — ce qu'on garde si le vendeur ne touche à rien.
   *  Null quand la détection a échoué : c'est alors à lui de poser le cadre. */
  image: HTMLImageElement | null;
  /** La photo d'origine + les coins détectés, pour pouvoir tout rejouer. */
  cropSource: CropSource | null;
  /** Vrai quand on n'a pas su trouver la carte et qu'on le dit franchement. */
  uncertain?: boolean;
  title: string;
  onApply: (result: HTMLImageElement, quad: Corner[]) => void;
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

export function CropScreen({ image, cropSource, uncertain, title, onApply, onRetake }: CropScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // On travaille sur la photo D'ORIGINE quand on l'a : tirer une poignée vers
  // l'extérieur doit pouvoir aller RECHERCHER de la carte que la détection
  // aurait manquée. Sur l'image détourée, au-delà du contour, il n'y a plus
  // que du vide — les poignées y étaient prisonnières du cadre automatique
  // (défaut signalé par Remy le 19 août 2026).
  const stageImage = cropSource?.image ?? image!;
  const detected = cropSource?.quad ?? null;
  const [corners, setCorners] = useState<Corner[]>(() => detected ?? autoDetectBounds(image!));
  // Détection ratée : on ouvre d'emblée les poignées, c'est là qu'est le travail.
  const [manual, setManual] = useState(!!uncertain);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scaleRef = useRef(1);
  const dragRef = useRef(-1);
  /** Coin en cours de déplacement, en coordonnées photo : cible de la loupe. */
  const magRef = useRef<Corner | null>(null);

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
    if (magRef.current) drawMagnifier(ctx, W, H, s, current, magRef.current);
  }

  /**
   * Loupe sous le doigt.
   *
   * Un pouce couvre une bonne centaine de pixels : impossible de poser un coin
   * au pixel près en voyant seulement ce qui dépasse autour de l'ongle. La
   * loupe montre la zone agrandie, avec une croix sur le point exact et les
   * deux droites du cadre — c'est le repère qui permet de coller vraiment à
   * l'arête. Elle se place dans le coin opposé au doigt pour ne rien masquer.
   */
  function drawMagnifier(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    s: number,
    quad: Corner[],
    target: Corner
  ) {
    const R = Math.round(Math.min(W, H) * 0.2);
    const M = Math.round(R * 0.25);
    const tx = target.x * s;
    const ty = target.y * s;
    // Coin opposé au doigt, pour que la loupe ne tombe jamais sous la main.
    const cx = tx < W / 2 ? W - R - M : R + M;
    const cy = ty < H / 2 ? H - R - M : R + M;
    const Z = 4;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 7);
    ctx.closePath();
    ctx.fillStyle = "#0b0a14";
    ctx.fill();
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    // La photo agrandie, centrée sur le coin visé.
    ctx.drawImage(
      stageImage,
      cx - tx * Z,
      cy - ty * Z,
      stageImage.width * s * Z,
      stageImage.height * s * Z
    );
    // Les deux droites du cadre qui se rejoignent sur ce coin.
    ctx.strokeStyle = "rgba(139,124,248,0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    quad.forEach((p, i) => {
      const q = { x: cx + (p.x * s - tx) * Z, y: cy + (p.y * s - ty) * Z };
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.closePath();
    ctx.stroke();
    // Croix de visée : le point exact, sans rien masquer autour.
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.28, cy);
    ctx.lineTo(cx - 5, cy);
    ctx.moveTo(cx + 5, cy);
    ctx.lineTo(cx + R * 0.28, cy);
    ctx.moveTo(cx, cy - R * 0.28);
    ctx.lineTo(cx, cy - 5);
    ctx.moveTo(cx, cy + 5);
    ctx.lineTo(cx, cy + R * 0.28);
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 7);
    ctx.stroke();
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
      magRef.current = corners[best];
      (e.target as Element).setPointerCapture(e.pointerId);
      draw(corners, manual);
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
    magRef.current = next[dragRef.current];
    setCorners(next);
  }

  function handlePointerUp() {
    if (dragRef.current < 0) return;
    dragRef.current = -1;
    magRef.current = null;
    draw(corners, manual);
  }

  async function applyCrop() {
    if (busy) return;
    setError(null);

    // Rien n'a bougé : on garde le détourage déjà calculé, au pixel près.
    if (image && detected && sameCorners(corners, detected)) {
      onApply(image, detected);
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
        // Le cadre posé à la main est repassé par la MÊME recherche fine que la
        // détection automatique : le vendeur place les 4 coins à peu près, et
        // les bords sont recalés au pixel sur la vraie arête, éclats et coins
        // écornés compris. Corridor de recherche plus étroit qu'en automatique
        // — il est déjà tout près, on ne veut pas que le cadre lui échappe.
        const refined = refineQuadByGradient(cropSource.image, corners, 0.03);
        onApply(await rectifyCard(cropSource.image, refined), refined);
      } catch {
        setError("Ce cadre ne ressemble pas à une carte. Reprends les 4 coins, ou reviens au découpage automatique.");
      } finally {
        setBusy(false);
      }
      return;
    }

    // Chemin de repli (pas de photo d'origine disponible) : découpe au
    // quadrilatère tracé, sans redressement.
    if (!image) return;
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
    res.onload = () => onApply(res, corners);
    res.src = out.toDataURL("image/png");
  }

  return (
    <div className="screen" id="screen-crop">
      <div className="screen-title" style={{ textAlign: "center" }}>
        {title}
      </div>
      <div className="screen-sub" style={{ textAlign: "center" }}>
        {uncertain
          ? "Je n'ai pas réussi à trouver les bords tout seul. Place les 4 coins à peu près : je m'occupe du réglage fin."
          : "Le cadre doit suivre les bords de la carte, coins compris."}
      </div>
      <div className="crop-toolbar">
        <button
          className={`crop-tool${!manual ? " active" : ""}`}
          onClick={() => {
            setCorners(detected ?? autoDetectBounds(image!));
            setError(null);
            setManual(false);
          }}
          type="button"
          disabled={!!uncertain}
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
          style={{ touchAction: "none" }}
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
            ? "Fais glisser les 4 poignées — pas besoin d'être précis, les bords sont recalés à la validation."
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
