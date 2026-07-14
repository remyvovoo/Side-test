"use client";

import { useState } from "react";

interface EmailModalProps {
  open: boolean;
  onSubmit: (email: string) => void;
  onSkip: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailModal({ open, onSubmit, onSkip }: EmailModalProps) {
  const [email, setEmail] = useState("");
  const [invalid, setInvalid] = useState(false);

  function submit() {
    if (!EMAIL_RE.test(email)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onSubmit(email);
  }

  return (
    <div
      className={`modal${open ? " open" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSkip();
      }}
    >
      <div className="modal-sheet">
        <div className="modal-head" style={{ marginBottom: 0 }}>
          <div />
          <button className="modal-close" onClick={onSkip} aria-label="Fermer" type="button">
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="email-body">
          <div className="email-illu">
            <i className="ti ti-mail" />
          </div>
          <h3>Reçois tes photos par email</h3>
          <p>Et sois prévenu en avant-première des nouveaux présentoirs et univers.</p>
          <input
            type="email"
            placeholder="ton@email.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={invalid ? { borderColor: "#dc3c3c" } : undefined}
          />
          <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={submit} type="button">
            <i className="ti ti-send" /> Recevoir mes photos
          </button>
          <button className="email-skip" onClick={onSkip} type="button">
            Passer et télécharger directement
          </button>
        </div>
      </div>
    </div>
  );
}
