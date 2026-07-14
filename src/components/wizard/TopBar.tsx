"use client";

interface TopBarProps {
  showBack: boolean;
  onBack: () => void;
  onBrandClick: () => void;
  onProfileClick: () => void;
}

export function TopBar({ showBack, onBack, onBrandClick, onProfileClick }: TopBarProps) {
  return (
    <div className="topbar">
      <button className="brand" onClick={onBrandClick} type="button">
        <div className="brand-logo">CS</div>
        <span className="brand-name">Cardshot</span>
        <span className="brand-tag">Pokémon</span>
      </button>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="back-btn visible" onClick={onProfileClick} aria-label="Mon profil vendeur" type="button">
          <i className="ti ti-user-circle" />
        </button>
        <button
          className={`back-btn${showBack ? " visible" : ""}`}
          onClick={onBack}
          aria-label="Retour"
          type="button"
        >
          <i className="ti ti-arrow-left" />
        </button>
      </div>
    </div>
  );
}
