"use client";

import { useId, useState } from "react";

/**
 * Champ de mot de passe avec œil de révélation.
 *
 * Demandé par Remy le 19 août 2026 : sans lui, on saisit à l'aveugle et on se
 * trompe — d'autant plus sur mobile, où le clavier bascule entre lettres,
 * chiffres et symboles. Un mot de passe refusé sans savoir pourquoi est l'un
 * des meilleurs moyens de perdre quelqu'un à l'inscription.
 *
 * Le bouton est explicitement exclu de la navigation au clavier par tabulation
 * (tabIndex -1) : il ne doit pas s'intercaler entre le champ et le bouton
 * d'envoi du formulaire.
 */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  minLength,
  required = true,
  hint,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  hint?: string;
}) {
  const auto = useId();
  const fieldId = id ?? auto;
  const [shown, setShown] = useState(false);

  return (
    <div className="auth-field">
      <label htmlFor={fieldId}>{label}</label>
      <div className="pw-wrap">
        <input
          id={fieldId}
          type={shown ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="pw-eye"
          onClick={() => setShown((s) => !s)}
          tabIndex={-1}
          aria-label={shown ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={shown}
        >
          <i className={shown ? "ti ti-eye-off" : "ti ti-eye"} />
        </button>
      </div>
      {hint && <small className="auth-hint">{hint}</small>}
    </div>
  );
}
