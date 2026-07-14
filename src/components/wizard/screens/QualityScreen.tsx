"use client";

import type { QualityResult } from "@/lib/quality/types";

interface QualityScreenProps {
  quality: QualityResult;
  onContinue: () => void;
  onRetake: () => void;
}

function scoreColor(score: number): string {
  if (score >= 70) return "#6fcf97";
  if (score >= 40) return "#ffc44d";
  return "#ef6461";
}

function scoreLabel(score: number): string {
  if (score >= 70) return "Bonne photo";
  if (score >= 40) return "Photo correcte";
  return "Photo à reprendre";
}

export function QualityScreen({ quality, onContinue, onRetake }: QualityScreenProps) {
  const color = scoreColor(quality.score);

  return (
    <div className="screen" id="screen-quality">
      <div className="screen-title">Vérification qualité</div>
      <div className="screen-sub">Voici ce que Cardshot a détecté sur ta photo, avant de générer les visuels.</div>

      <div className="quality-card">
        <div className="quality-head">
          <div
            className="quality-ring"
            style={{
              background: `conic-gradient(${color} ${quality.score * 3.6}deg, var(--surface2) 0deg)`,
              color,
            }}
          >
            {quality.score}
          </div>
          <div>
            <div className="quality-label">{scoreLabel(quality.score)}</div>
            <div className="quality-sub">
              Netteté {quality.sharpness}% · Résolution {quality.resolution}% · Cadrage {quality.framing}%
            </div>
          </div>
        </div>
        <div className="quality-tips">
          {quality.issues.map((issue) => (
            <div className="quality-tip" key={issue.id}>
              <i className={`ti ${issue.id === "ok" ? "ti-circle-check" : "ti-alert-triangle"}`} style={{ color }} />
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="stack-actions">
        <button className="btn btn-primary" onClick={onContinue} type="button">
          Continuer <i className="ti ti-arrow-right" />
        </button>
        <button className="btn btn-ghost" onClick={onRetake} type="button">
          <i className="ti ti-camera" /> Reprendre la photo
        </button>
      </div>
    </div>
  );
}
