"use client";

import { useRef, useState } from "react";
import {
  ANNONCE_VARIABLES,
  DEFAULT_TITLE_TEMPLATE,
  DEFAULT_DESCRIPTION_TEMPLATE,
} from "@/lib/wizard/generate-description";

const CONDITIONS_PLACEHOLDER = `Ex : Toutes mes cartes sont protégées dès l'ouverture.
Expédition sous sleeve et toploader.
Envoi sous 24h.
Merci pour votre confiance.`;

interface SellerProfileFormProps {
  initialBoilerplate: string;
  initialTitleTemplate: string;
  initialDescriptionTemplate: string;
}

/** Pastilles de variables : un clic insère la variable à la position du curseur. */
function VariableChips({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div className="dash-var-chips">
      {ANNONCE_VARIABLES.map((v) => (
        <button key={v.token} type="button" className="dash-var-chip" onClick={() => onInsert(v.token)}>
          {v.token}
        </button>
      ))}
    </div>
  );
}

export function SellerProfileForm({
  initialBoilerplate,
  initialTitleTemplate,
  initialDescriptionTemplate,
}: SellerProfileFormProps) {
  const [title, setTitle] = useState(initialTitleTemplate || DEFAULT_TITLE_TEMPLATE);
  const [desc, setDesc] = useState(initialDescriptionTemplate || DEFAULT_DESCRIPTION_TEMPLATE);
  const [boilerplate, setBoilerplate] = useState(initialBoilerplate);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  function insertAtCursor(
    el: HTMLInputElement | HTMLTextAreaElement | null,
    value: string,
    setValue: (v: string) => void,
    token: string
  ) {
    if (!el) {
      setValue(value + token);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(false);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerBoilerplate: boilerplate,
          titleTemplate: title,
          descriptionTemplate: desc,
        }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dash-profile-blocks">
      <div className="dash-panel">
        <div className="dash-panel-head">
          <b>Modèle de titre</b>
          <span>Le titre de chaque annonce. Clique une variable pour l&apos;insérer.</span>
        </div>
        <input
          ref={titleRef}
          type="text"
          className="dash-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={300}
        />
        <VariableChips onInsert={(t) => insertAtCursor(titleRef.current, title, setTitle, t)} />
      </div>

      <div className="dash-panel">
        <div className="dash-panel-head">
          <b>Modèle de description</b>
          <span>
            Le corps de l&apos;annonce. Les lignes dont les variables sont vides disparaissent automatiquement.
          </span>
        </div>
        <textarea
          ref={descRef}
          className="dash-textarea"
          rows={7}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          maxLength={2000}
        />
        <VariableChips onInsert={(t) => insertAtCursor(descRef.current, desc, setDesc, t)} />
      </div>

      <div className="dash-panel">
        <div className="dash-panel-head">
          <b>Mes conditions de vente</b>
          <span>Ajoutées à la fin de chaque annonce : protection, envoi, délais…</span>
        </div>
        <textarea
          className="dash-textarea"
          rows={5}
          placeholder={CONDITIONS_PLACEHOLDER}
          value={boilerplate}
          onChange={(e) => setBoilerplate(e.target.value)}
          maxLength={2000}
        />
      </div>

      {error && <div className="auth-error">L&apos;enregistrement a échoué, réessaie.</div>}
      <button className="btn btn-primary" onClick={handleSave} disabled={saving} type="button">
        <i className={`ti ${saved ? "ti-check" : "ti-device-floppy"}`} />{" "}
        {saving ? "Enregistrement…" : saved ? "Enregistré" : "Enregistrer"}
      </button>
    </div>
  );
}
