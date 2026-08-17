"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CardInfo } from "@/lib/render-engine";
import { CARD_CONDITIONS, CARD_RARITIES } from "@/lib/wizard/types";
import { generateDescription, type AnnonceProfile } from "@/lib/wizard/generate-description";

interface CardEditorProps {
  id: string;
  thumbnail: string;
  hasVerso: boolean;
  createdAt: string;
  initialCardInfo: CardInfo;
  initialDescription: string;
  profile: AnnonceProfile;
}

export function CardEditor({
  id,
  thumbnail,
  hasVerso,
  createdAt,
  initialCardInfo,
  initialDescription,
  profile,
}: CardEditorProps) {
  const router = useRouter();
  const [info, setInfo] = useState<CardInfo>(initialCardInfo);
  const [description, setDescription] = useState(initialDescription);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function set<K extends keyof CardInfo>(key: K, value: string) {
    setInfo((i) => ({ ...i, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(false);
    try {
      const res = await fetch(`/api/cards/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: info.name || "Carte sans nom",
          cardInfo: { ...info },
          description,
        }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/cards/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/dashboard/cartes");
        router.refresh();
        return;
      }
      setError(true);
    } catch {
      setError(true);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <Link href="/dashboard/cartes" className="wizard-embedded-back">
        <i className="ti ti-arrow-left" /> Mes cartes
      </Link>
      <h1 className="dash-title">{info.name || "Carte sans nom"}</h1>
      <p className="dash-subtitle">
        Créée le{" "}
        {new Date(createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} ·{" "}
        {hasVerso ? "Recto + verso" : "Recto"}
      </p>

      <div className="dash-editor">
        <div className="dash-editor-side">
          {/* eslint-disable-next-line @next/next/no-img-element -- vignette data-URL générée par le moteur */}
          <img src={thumbnail} alt={info.name || "Carte"} className="dash-editor-thumb" />
          <p className="dash-editor-note">
            <i className="ti ti-info-circle" /> Le retéléchargement des visuels arrivera avec le stockage des
            photos — pour l&apos;instant, garde le ZIP téléchargé à la création.
          </p>
        </div>

        <div className="dash-editor-main">
          <div className="dash-panel">
            <div className="dash-panel-head">
              <b>Infos de la carte</b>
            </div>
            <div className="field-grid">
              <input type="text" placeholder="Nom" value={info.name} onChange={(e) => set("name", e.target.value)} />
              <input
                type="text"
                placeholder="N° (ex : 228/197)"
                value={info.number}
                onChange={(e) => set("number", e.target.value)}
              />
            </div>
            <div className="field-grid">
              <input
                type="text"
                placeholder="Prix (ex : 35 €)"
                value={info.price}
                onChange={(e) => set("price", e.target.value)}
              />
              <select value={info.rarity} onChange={(e) => set("rarity", e.target.value)}>
                <option value="">Rareté</option>
                {CARD_RARITIES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-grid">
              <input
                type="text"
                placeholder="Série"
                value={info.series}
                onChange={(e) => set("series", e.target.value)}
              />
              <input
                type="text"
                placeholder="Langue"
                value={info.language}
                onChange={(e) => set("language", e.target.value)}
              />
            </div>
            <div className="field-grid">
              <select value={info.condition} onChange={(e) => set("condition", e.target.value)}>
                <option value="">État de la carte</option>
                {CARD_CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="dash-panel">
            <div className="dash-panel-head">
              <b>Annonce</b>
              <span>Texte prêt à coller sur Vinted, eBay, Cardmarket…</span>
            </div>
            <textarea
              className="dash-textarea"
              rows={9}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
            />
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => setDescription(generateDescription(info, profile))}
            >
              <i className="ti ti-refresh" /> Régénérer depuis mes modèles
            </button>
          </div>

          {error && <div className="auth-error">Une erreur est survenue, réessaie.</div>}

          <div className="dash-editor-actions">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} type="button">
              <i className={`ti ${saved ? "ti-check" : "ti-device-floppy"}`} />{" "}
              {saving ? "Enregistrement…" : saved ? "Enregistré" : "Enregistrer"}
            </button>
            {confirmDelete ? (
              <>
                <button
                  className="btn btn-ghost btn-sm dash-danger"
                  onClick={handleDelete}
                  disabled={deleting}
                  type="button"
                >
                  {deleting ? "Suppression…" : "Confirmer la suppression"}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)} type="button">
                  Annuler
                </button>
              </>
            ) : (
              <button className="btn btn-ghost btn-sm dash-danger" onClick={() => setConfirmDelete(true)} type="button">
                <i className="ti ti-trash" /> Supprimer la carte
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
