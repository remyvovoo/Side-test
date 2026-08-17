"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface CardSummary {
  id: string;
  name: string;
  thumbnail: string;
  createdAt: string;
  hasVerso: boolean;
}

interface CardGridProps {
  cards: CardSummary[];
  /** Grille interactive : poubelle, sélection multiple. La navigation au clic est toujours active. */
  interactive?: boolean;
}

export function CardGrid({ cards, interactive = false }: CardGridProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState(false);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setBulkConfirm(false);
  }

  async function deleteIds(ids: string[]) {
    setDeleting(true);
    try {
      await Promise.all(ids.map((id) => fetch(`/api/cards/${id}`, { method: "DELETE" })));
      setSelected(new Set());
      setConfirming(null);
      setBulkConfirm(false);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      {interactive && selected.size > 0 && (
        <div className="dash-bulkbar">
          <span>
            {selected.size} carte{selected.size > 1 ? "s" : ""} sélectionnée{selected.size > 1 ? "s" : ""}
          </span>
          <div className="dash-bulkbar-actions">
            {bulkConfirm ? (
              <>
                <button
                  className="btn btn-ghost btn-sm dash-danger"
                  onClick={() => deleteIds([...selected])}
                  disabled={deleting}
                  type="button"
                >
                  {deleting ? "Suppression…" : `Confirmer (${selected.size})`}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setBulkConfirm(false)} type="button">
                  Annuler
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-ghost btn-sm dash-danger" onClick={() => setBulkConfirm(true)} type="button">
                  <i className="ti ti-trash" /> Supprimer
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())} type="button">
                  Tout désélectionner
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="dash-cards-grid">
        {cards.map((card) => {
          const isSelected = selected.has(card.id);
          return (
            <div className={`dash-card${isSelected ? " selected" : ""}`} key={card.id}>
              <Link href={`/dashboard/cartes/${card.id}`} className="dash-card-link" aria-label={`Ouvrir ${card.name}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- vignette data-URL générée par le moteur */}
                <img src={card.thumbnail} alt={card.name} />
                <div className="dash-card-body">
                  <div className="dash-card-head">
                    <b>{card.name}</b>
                    <span className="dash-card-badge">{card.hasVerso ? "Recto + verso" : "Recto"}</span>
                  </div>
                  <span className="dash-card-date">
                    {new Date(card.createdAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </Link>

              {interactive && (
                <>
                  <button
                    className={`dash-card-check${isSelected ? " on" : ""}`}
                    onClick={() => toggleSelect(card.id)}
                    aria-label={isSelected ? "Désélectionner" : "Sélectionner"}
                    aria-pressed={isSelected}
                    type="button"
                  >
                    <i className="ti ti-check" />
                  </button>
                  {confirming === card.id ? (
                    <div className="dash-card-confirm">
                      <span>Supprimer ?</span>
                      <button
                        className="btn btn-ghost btn-sm dash-danger"
                        onClick={() => deleteIds([card.id])}
                        disabled={deleting}
                        type="button"
                      >
                        {deleting ? "…" : "Oui"}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(null)} type="button">
                        Non
                      </button>
                    </div>
                  ) : (
                    <button
                      className="dash-card-trash"
                      onClick={() => setConfirming(card.id)}
                      aria-label={`Supprimer ${card.name}`}
                      type="button"
                    >
                      <i className="ti ti-trash" />
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
