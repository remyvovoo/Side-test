"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { renderShot } from "@/lib/render-engine";
import type { RenderRequest, ShotDescriptor } from "@/lib/render-engine";
import { buildShotList } from "@/lib/wizard/shot-list";
import { buildDetailShotList, type DetailShotDescriptor } from "@/lib/detail-shots/detail-shot-list";
import { renderDetailShot } from "@/lib/detail-shots/render-detail-shot";
import type { ExportFormat } from "@/lib/wizard/types";

interface ExportScreenProps {
  baseRequest: Omit<RenderRequest, "shot" | "size">;
  rectoImage: HTMLImageElement;
  versoImage: HTMLImageElement | null;
  selected: Record<number, boolean>;
  onSelectedChange: (next: Record<number, boolean>) => void;
  selectedDetail: Record<string, boolean>;
  onSelectedDetailChange: (next: Record<string, boolean>) => void;
  format: ExportFormat;
  onFormatChange: (f: ExportFormat) => void;
  description: string;
  onDescriptionChange: (text: string) => void;
  onDownloadClick: () => void;
  isDownloading: boolean;
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

function DetailThumb({
  detail,
  rectoImage,
  versoImage,
}: {
  detail: DetailShotDescriptor;
  rectoImage: HTMLImageElement;
  versoImage: HTMLImageElement | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const source = detail.face === "recto" ? rectoImage : versoImage;
    if (!ref.current || !source) return;
    renderDetailShot(ref.current, source, detail.kind, 420);
  }, [detail, rectoImage, versoImage]);
  return <canvas ref={ref} />;
}

export function ExportScreen({
  baseRequest,
  rectoImage,
  versoImage,
  selected,
  onSelectedChange,
  selectedDetail,
  onSelectedDetailChange,
  format,
  onFormatChange,
  description,
  onDescriptionChange,
  onDownloadClick,
  isDownloading,
  onEdit,
  onNewCard,
}: ExportScreenProps) {
  const hasVerso = !!versoImage;
  const shots = useMemo(() => buildShotList(hasVerso), [hasVerso]);
  const detailShots = useMemo(() => buildDetailShotList(hasVerso), [hasVerso]);
  const [copied, setCopied] = useState(false);

  const selectedCount = shots.reduce((n, _s, i) => n + (selected[i] ? 1 : 0), 0);
  const allSelected = selectedCount === shots.length;
  const selectedDetailCount = detailShots.reduce((n, d) => n + (selectedDetail[d.id] ? 1 : 0), 0);

  function toggle(i: number) {
    onSelectedChange({ ...selected, [i]: !selected[i] });
  }
  function toggleAll() {
    const next: Record<number, boolean> = {};
    shots.forEach((_s, i) => (next[i] = !allSelected));
    onSelectedChange(next);
  }
  function toggleDetail(id: string) {
    onSelectedDetailChange({ ...selectedDetail, [id]: !selectedDetail[id] });
  }

  async function copyDescription() {
    try {
      await navigator.clipboard.writeText(description);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — no big deal, the text is still selectable/editable above.
    }
  }

  return (
    <div className="screen" id="screen-export">
      <div className="screen-title">Tes visuels</div>
      <div className="screen-sub">Coche ceux que tu veux inclure dans ton ZIP.</div>

      <span className="section-label">Visuels commerciaux</span>
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

      <span className="section-label">Photos de détail (pour rassurer l&apos;acheteur)</span>
      <div className="export-bar">
        <span className="export-count">
          {selectedDetailCount} sur {detailShots.length} sélectionnée{selectedDetailCount > 1 ? "s" : ""}
        </span>
      </div>
      <div className="shots-grid">
        {detailShots.map((detail) => (
          <div
            key={detail.id}
            className={`shot${selectedDetail[detail.id] ? " checked" : ""}`}
            onClick={() => toggleDetail(detail.id)}
          >
            <DetailThumb detail={detail} rectoImage={rectoImage} versoImage={versoImage} />
            <div className="shot-check">
              <i className="ti ti-check" />
            </div>
            <div className="shot-name">{detail.label}</div>
          </div>
        ))}
      </div>

      <span className="section-label">Description de l&apos;annonce</span>
      <textarea
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        rows={6}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: "var(--radius)",
          border: ".5px solid var(--border-strong)",
          background: "var(--surface2)",
          color: "var(--text)",
          fontSize: 13,
          fontFamily: "inherit",
          resize: "vertical",
          marginBottom: 10,
        }}
      />
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }} onClick={copyDescription} type="button">
        <i className={`ti ${copied ? "ti-check" : "ti-copy"}`} /> {copied ? "Copié" : "Copier la description"}
      </button>

      <span className="section-label">Format des images</span>
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
      <button
        className="btn btn-primary"
        onClick={onDownloadClick}
        disabled={selectedCount === 0 || isDownloading}
        type="button"
      >
        <i className="ti ti-download" /> {isDownloading ? "Préparation du ZIP…" : "Télécharger le ZIP"}
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
