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
              {/* Sur mobile, quatre éléments sur une ligne faisaient déborder
                  la page latéralement (constaté par Remy le 19 août 2026 sur
                  iPhone). « Se connecter » se réduit à une icône, et le
                  bouton d'essai à un libellé court : c'est l'action qu'on
                  veut garder visible, pas sa longueur. */}
              <Link href="/login" className="btn btn-ghost btn-sm topbar-link topbar-signin" aria-label="Se connecter">
                <span className="only-wide">Se connecter</span>
                <i className="ti ti-login only-narrow" />
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm topbar-link">
                <span className="only-wide">Essai gratuit 30 jours</span>
                <span className="only-narrow">Essai gratuit</span>
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
