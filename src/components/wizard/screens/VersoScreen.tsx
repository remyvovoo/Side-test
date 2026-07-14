"use client";

interface VersoScreenProps {
  onAddVerso: () => void;
  onSkip: () => void;
}

export function VersoScreen({ onAddVerso, onSkip }: VersoScreenProps) {
  return (
    <div className="screen" id="screen-verso">
      <div className="verso-card">
        <div className="verso-illu">
          <i className="ti ti-rotate-clockwise-2" />
        </div>
        <h3>Ajouter le verso ?</h3>
        <p>
          Les acheteurs le demandent presque toujours pour vérifier l&apos;état de la carte. Ça prend 20 secondes et
          ça double tes visuels.
        </p>
        <button className="btn btn-primary" onClick={onAddVerso} type="button">
          <i className="ti ti-camera" /> Photographier le verso
        </button>
        <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={onSkip} type="button">
          Passer, recto seulement
        </button>
      </div>
    </div>
  );
}
