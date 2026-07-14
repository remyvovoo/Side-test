"use client";

import { useEffect, useMemo, useRef } from "react";
import { renderShot } from "@/lib/render-engine";
import type { RenderRequest, ShotDescriptor } from "@/lib/render-engine";
import { buildShotList } from "@/lib/wizard/shot-list";
import type { ExportFormat } from "@/lib/wizard/types";

interface ExportScreenProps {
  baseRequest: Omit<RenderRequest, "shot" | "size">;
  hasVerso: boolean;
  selected: Record<number, boolean>;
  onSelectedChange: (next: Record<number, boolean>) => void;
  format: ExportFormat;
  onFormatChange: (f: ExportFormat) => void;
  onDownloadClick: () => void;
  onEdit: () => void;
  onNewCard: () => void;
}

function ShotThumb({ shot, baseRequest }: { shot: ShotDescriptor; baseRequest: Omit<RenderRequest, "shot" | "size"> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    renderShot(ref.current, { ...baseRequest, shot, size: 420 });
  }, [shot, baseRequest]);
  return <canvas ref={ref} />;
}

export function ExportScreen({
  baseRequest,
  hasVerso,
  selected,
  onSelectedChange,
  format,
  onFormatChange,
  onDownloadClick,
  onEdit,
  onNewCard,
}: ExportScreenProps) {
  const shots = useMemo(() => buildShotList(hasVerso), [hasVerso]);
  const selectedCount = shots.reduce((n, _s, i) => n + (selected[i] ? 1 : 0), 0);
  const allSelected = selectedCount === shots.length;

  function toggle(i: number) {
    onSelectedChange({ ...selected, [i]: !selected[i] });
  }

  function toggleAll() {
    const next: Record<number, boolean> = {};
    shots.forEach((_s, i) => (next[i] = !allSelected));
    onSelectedChange(next);
  }

  return (
    <div className="screen" id="screen-export">
      <div className="screen-title">Tes visuels</div>
      <div className="screen-sub">Coche ceux que tu veux télécharger.</div>
      <div className="export-bar">
        <span className="export-count">
          {selectedCount} sur {shots.length} sélectionné{selectedCount > 1 ? "s" : ""}
        </span>
        <button className="select-all" onClick={toggleAll} type="button">
          {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
        </button>
      </div>
      <div className="shots-grid">
        {shots.map((shot, i) => (
          <div key={shot.name} className={`shot${selected[i] ? " checked" : ""}`} onClick={() => toggle(i)}>
            <ShotThumb shot={shot} baseRequest={baseRequest} />
            <div className="shot-check">
              <i className="ti ti-check" />
            </div>
            <div className="shot-name">{shot.name}</div>
          </div>
        ))}
      </div>
      <span className="section-label">Format</span>
      <div className="format-row">
        <div
          className={`format-pill${format === "jpg" ? " selected" : ""}`}
          onClick={() => onFormatChange("jpg")}
        >
          <b>JPG</b>
          <span>Vinted, Leboncoin</span>
        </div>
        <div
          className={`format-pill${format === "png" ? " selected" : ""}`}
          onClick={() => onFormatChange("png")}
        >
          <b>PNG</b>
          <span>Qualité max</span>
        </div>
      </div>
      <button className="btn btn-primary" onClick={onDownloadClick} disabled={selectedCount === 0} type="button">
        <i className="ti ti-download" /> Télécharger
      </button>
      <div className="btn-row">
        <button className="btn btn-ghost btn-sm" onClick={onEdit} type="button">
          <i className="ti ti-pencil" /> Modifier
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onNewCard} type="button">
          <i className="ti ti-plus" /> Nouvelle carte
        </button>
      </div>
    </div>
  );
}
