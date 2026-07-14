"use client";

import { useState } from "react";

interface SellerProfileModalProps {
  open: boolean;
  initialText: string;
  onSave: (text: string) => void;
  onClose: () => void;
}

export function SellerProfileModal({ open, initialText, onSave, onClose }: SellerProfileModalProps) {
  const [text, setText] = useState(initialText);

  return (
    <div
      className={`modal${open ? " open" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-sheet">
        <div className="modal-head">
          <div className="modal-title">Mon profil vendeur</div>
          <button className="modal-close" onClick={onClose} aria-label="Fermer" type="button">
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="modal-sub">
          Ce texte est ajouté automatiquement à chaque description générée — écris-le une fois pour toutes.
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            "Ex : Toutes mes cartes sont protégées dès l'ouverture.\nExpédition sous sleeve et toploader.\nEnvoi sous 24h.\nMerci pour votre confiance."
          }
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
          }}
        />
        <button
          className="btn btn-primary"
          style={{ marginTop: 12 }}
          onClick={() => {
            onSave(text);
            onClose();
          }}
          type="button"
        >
          <i className="ti ti-check" /> Enregistrer
        </button>
      </div>
    </div>
  );
}
