"use client";

import { useState } from "react";

interface GuideModalProps {
  open: boolean;
  ctaLabel: string;
  ctaIcon?: string;
  onProceed: (skipNextTime: boolean) => void;
  onClose: (skipNextTime: boolean) => void;
}

export function GuideModal({ open, ctaLabel, ctaIcon, onProceed, onClose }: GuideModalProps) {
  const [skip, setSkip] = useState(false);

  return (
    <div
      className={`modal${open ? " open" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(skip);
      }}
    >
      <div className="modal-sheet">
        <div className="modal-head">
          <div className="modal-title">4 conseils pour un rendu parfait</div>
          <button className="modal-close" onClick={() => onClose(skip)} aria-label="Fermer" type="button">
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="modal-sub">30 secondes qui changent tout</div>
        <div className="tip">
          <div className="tip-emoji">🃏</div>
          <div className="tip-text">
            <b>Retire la sleeve et le toploader</b> — le plastique crée des reflets. Garde la dalle si ta carte est
            gradée.
          </div>
        </div>
        <div className="tip">
          <div className="tip-emoji">☀️</div>
          <div className="tip-text">
            <b>Lumière naturelle</b> — près d&apos;une fenêtre. Jamais de flash sur les cartes brillantes.
          </div>
        </div>
        <div className="tip">
          <div className="tip-emoji">⬜</div>
          <div className="tip-text">
            <b>Fond uni contrasté</b> — feuille blanche sous une carte sombre, sombre sous une carte claire.
          </div>
        </div>
        <div className="tip">
          <div className="tip-emoji">📐</div>
          <div className="tip-text">
            <b>Vue de dessus</b> — carte bien à plat, les 4 coins visibles.
          </div>
        </div>
        <label className="modal-check">
          <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} />
          <span>Ne plus afficher</span>
        </label>
        <button className="btn btn-primary" onClick={() => onProceed(skip)} type="button">
          {ctaIcon && <i className={`ti ${ctaIcon}`} />} {ctaLabel}
        </button>
      </div>
    </div>
  );
}
