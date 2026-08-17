"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

interface TopBarProps {
  showBack: boolean;
  onBack: () => void;
  onBrandClick: () => void;
  onProfileClick: () => void;
}

export function TopBar({ showBack, onBack, onBrandClick, onProfileClick }: TopBarProps) {
  const { data: session, status } = useSession();
  const authed = status === "authenticated";

  return (
    <div className="topbar">
      <button className="brand" onClick={onBrandClick} type="button">
        <div className="brand-logo">CS</div>
        <span className="brand-name">Cardshot</span>
        <span className="brand-tag">Pokémon</span>
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {authed && session.user.role === "ADMIN" && (
          <Link href="/admin" className="btn btn-ghost btn-sm topbar-link">
            Admin
          </Link>
        )}
        {authed ? (
          <>
            {/* Icône profil vendeur : temporaire ici, rejoindra l'espace connecté (phase 2). */}
            <button className="back-btn visible" onClick={onProfileClick} aria-label="Mon profil vendeur" type="button">
              <i className="ti ti-user-circle" />
            </button>
            <button
              className="back-btn visible"
              onClick={() => signOut({ callbackUrl: "/" })}
              aria-label="Se déconnecter"
              type="button"
            >
              <i className="ti ti-logout" />
            </button>
          </>
        ) : (
          status !== "loading" && (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm topbar-link">
                Se connecter
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm topbar-link">
                Essai gratuit 30 jours
              </Link>
            </>
          )
        )}
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
