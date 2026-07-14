"use client";

import { useEffect, useRef, useState } from "react";
import { autoDetectBounds, type Corner } from "@/lib/wizard/image-utils";

interface CropScreenProps {
  image: HTMLImageElement;
  title: string;
  onApply: (result: HTMLImageElement) => void;
  onRetake: () => void;
}

export function CropScreen({ image, title, onApply, onRetake }: CropScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [corners, setCorners] = useState<Corner[]>(() => autoDetectBounds(image));
  const [manual, setManual] = useState(false);
  const scaleRef = useRef(1);
  const dragRef = useRef(-1);

  function draw(current: Corner[], isManual: boolean) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = Math.min(700 / image.width, 1);
    scaleRef.current = s;
    const W = Math.round(image.width * s);
    const H = Math.round(image.height * s);
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(image, 0, 0, W, H);
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
      c.forEach((p) => {
        ctx.fillStyle = "#8b7cf8";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 9, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, 7);
        ctx.fill();
      });
    }
  }

  useEffect(() => {
    draw(corners, manual);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corners, manual, image]);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): Corner {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    const k = canvas.width / r.width;
    return { x: ((e.clientX - r.left) * k) / scaleRef.current, y: ((e.clientY - r.top) * k) / scaleRef.current };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!manual) return;
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
    next[dragRef.current] = {
      x: Math.max(0, Math.min(image.width, p.x)),
      y: Math.max(0, Math.min(image.height, p.y)),
    };
    setCorners(next);
  }

  function handlePointerUp() {
    dragRef.current = -1;
  }

  function applyCrop() {
    const c = corners;
    const minX = Math.min(c[0].x, c[3].x);
    const maxX = Math.max(c[1].x, c[2].x);
    const minY = Math.min(c[0].y, c[1].y);
    const maxY = Math.max(c[2].y, c[3].y);
    const w = Math.max(8, Math.round(maxX - minX));
    const h = Math.max(8, Math.round(maxY - minY));

    if (w >= image.width - 2 && h >= image.height - 2) {
      onApply(image);
      return;
    }
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    out.getContext("2d")!.drawImage(image, minX, minY, w, h, 0, 0, w, h);
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
        Ajuste les coins si le cadre déborde sur le toploader.
      </div>
      <div className="crop-toolbar">
        <button
          className={`crop-tool${!manual ? " active" : ""}`}
          onClick={() => {
            setCorners(autoDetectBounds(image));
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
        {manual ? "Fais glisser les 4 poignées pour ajuster." : "Le découpage automatique a détecté les contours de ta carte."}
      </div>
      <div className="stack-actions">
        <button className="btn btn-primary" onClick={applyCrop} type="button">
          <i className="ti ti-check" /> Valider
        </button>
        <button className="btn btn-ghost" onClick={onRetake} type="button">
          <i className="ti ti-camera" /> Reprendre la photo
        </button>
      </div>
    </div>
  );
}
