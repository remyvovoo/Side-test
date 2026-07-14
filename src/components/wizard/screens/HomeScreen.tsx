"use client";

import { useEffect, useRef } from "react";
import { renderShot, THEMES, MOUNTS } from "@/lib/render-engine";
import { demoCard } from "@/lib/wizard/demo-card";
import { EMPTY_CARD_INFO } from "@/lib/wizard/types";

interface HomeScreenProps {
  onStart: () => void;
}

export function HomeScreen({ onStart }: HomeScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    renderShot(canvasRef.current, {
      shot: { face: "recto", angle: 1, name: "" },
      rectoImage: demoCard(),
      versoImage: null,
      mount: MOUNTS[0],
      theme: THEMES[0],
      reflect: 0.5,
      halo: 0.7,
      logoImage: null,
      logoText: "",
      cardInfo: EMPTY_CARD_INFO,
      size: 600,
    });
  }, []);

  return (
    <div className="screen" id="screen-home">
      <div className="home-grid">
        <div className="hero">
          <h1>
            Une photo. <em>Six visuels studio</em> prêts à publier.
          </h1>
          <p>
            Photographie ta carte, choisis son présentoir. Cardshot génère le recto, le verso et quatre angles —
            comme dans un vrai studio produit.
          </p>
          <div style={{ marginTop: "1.5rem" }}>
            <button className="cta-main" onClick={onStart} type="button">
              <i className="ti ti-sparkles" /> Créer mes photos
            </button>
            <div className="cta-sub">Gratuit · Sans inscription</div>
          </div>
        </div>
        <div className="hero-shot">
          <canvas ref={canvasRef} />
        </div>
      </div>
      <div className="how">
        <div className="how-title">Comment ça marche</div>
        <div className="how-steps">
          <div className="how-step">
            <i className="ti ti-camera" />
            <div>1. Photographie</div>
            <small>Recto, puis verso si tu veux</small>
          </div>
          <div className="how-step">
            <i className="ti ti-box" />
            <div>2. Présentoir</div>
            <small>Pied acrylique ou boîtier</small>
          </div>
          <div className="how-step">
            <i className="ti ti-download" />
            <div>3. Télécharge</div>
            <small>Tes 6 angles, ou ceux choisis</small>
          </div>
        </div>
      </div>
    </div>
  );
}
