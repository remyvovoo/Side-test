"use client";

interface StepsBarProps {
  step: 1 | 2 | 3 | undefined;
}

const NAMES = ["Photos", "Studio", "Export"];

export function StepsBar({ step }: StepsBarProps) {
  return (
    <div className={`steps${step ? " visible" : ""}`}>
      {[1, 2, 3].map((i, idx) => (
        <div key={i} style={{ display: "contents" }}>
          <div className="step">
            <div className={`step-dot ${!step ? "todo" : i < step ? "done" : i === step ? "active" : "todo"}`}>
              {i}
            </div>
            <span className={`step-name${i === step ? " active" : ""}`}>{NAMES[idx]}</span>
          </div>
          {i < 3 && <div className="step-line" />}
        </div>
      ))}
    </div>
  );
}
