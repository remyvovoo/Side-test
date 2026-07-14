"use client";

import type { Face } from "@/lib/wizard/types";

interface SourceScreenProps {
  face: Face;
  onOpenGuide: (target: "camera" | "gallery" | "tips") => void;
}

export function SourceScreen({ face, onOpenGuide }: SourceScreenProps) {
  const recto = face === "recto";
  return (
    <div className="screen" id="screen-source">
      <div className="face-badge">
        <i className="ti ti-photo" /> <span>{recto ? "Recto de la carte" : "Verso de la carte"}</span>
      </div>
      <div className="screen-title">{recto ? "Ta carte, en photo" : "Retourne ta carte"}</div>
      <div className="screen-sub">Prends une nouvelle photo ou importe-en une depuis ta galerie.</div>
      <div className="source-grid">
        <button className="source-card primary" onClick={() => onOpenGuide("camera")} type="button">
          <div className="source-icon">
            <i className="ti ti-camera" />
          </div>
          <div className="source-text">
            <b>Prendre la photo</b>
            <span>Avec le cadre de guidage</span>
          </div>
          <span className="source-reco">Recommandé</span>
        </button>
        <button className="source-card" onClick={() => onOpenGuide("gallery")} type="button">
          <div className="source-icon">
            <i className="ti ti-photo" />
          </div>
          <div className="source-text">
            <b>Ma galerie</b>
            <span>Importer une photo existante</span>
          </div>
        </button>
      </div>
      <button className="tips-link" onClick={() => onOpenGuide("tips")} type="button">
        <i className="ti ti-bulb" /> Voir les conseils photo
      </button>
    </div>
  );
}
