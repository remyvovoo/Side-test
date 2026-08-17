"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

interface DashboardShellProps {
  email: string;
  isAdmin: boolean;
  trialDaysLeft: number;
  children: React.ReactNode;
}

const NAV = [
  { href: "/dashboard", label: "Vue d'ensemble", icon: "ti-home" },
  { href: "/dashboard/cartes", label: "Mes cartes", icon: "ti-cards" },
  { href: "/dashboard/studio", label: "Mon studio", icon: "ti-palette" },
  { href: "/dashboard/profil", label: "Mon profil vendeur", icon: "ti-user-circle" },
];

export function DashboardShell({ email, isAdmin, trialDaysLeft, children }: DashboardShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const nav = (
    <>
      <nav className="dash-nav">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`dash-nav-link${active ? " active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              <i className={`ti ${item.icon}`} /> {item.label}
            </Link>
          );
        })}
        {isAdmin && (
          <Link href="/admin" className="dash-nav-link" onClick={() => setMenuOpen(false)}>
            <i className="ti ti-shield" /> Admin
          </Link>
        )}
      </nav>

      <Link
        href="/dashboard/nouvelle"
        className={`dash-new-cta${pathname === "/dashboard/nouvelle" ? " active" : ""}`}
        onClick={() => setMenuOpen(false)}
      >
        <i className="ti ti-camera-plus" /> Nouvelle carte
      </Link>

      <div className="dash-trial">
        <b>
          {trialDaysLeft > 0
            ? `Essai gratuit — ${trialDaysLeft} jour${trialDaysLeft > 1 ? "s" : ""} restant${trialDaysLeft > 1 ? "s" : ""}`
            : "Essai terminé"}
        </b>
        <span>Photographie tes cartes, vends plus vite.</span>
      </div>

      <div className="dash-side-bottom">
        <div className="dash-user">
          <span className="dash-user-avatar">{email[0]?.toUpperCase()}</span>
          <span className="dash-user-email">{email}</span>
        </div>
        <button className="dash-nav-link" onClick={() => signOut({ callbackUrl: "/" })} type="button">
          <i className="ti ti-logout" /> Déconnexion
        </button>
      </div>
    </>
  );

  return (
    <div className="dash">
      {/* Barre mobile : logo + hamburger */}
      <div className="dash-mobilebar">
        <Link href="/dashboard" className="brand" style={{ textDecoration: "none" }}>
          <span className="brand-logo">CS</span>
          <span className="brand-name">Cardshot</span>
        </Link>
        <button
          className="dash-burger"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={menuOpen}
          type="button"
        >
          <i className={`ti ${menuOpen ? "ti-x" : "ti-menu-2"}`} />
        </button>
      </div>

      {/* Sidebar desktop / panneau mobile */}
      <aside className={`dash-side${menuOpen ? " open" : ""}`}>
        <Link href="/dashboard" className="brand dash-side-brand" style={{ textDecoration: "none" }}>
          <span className="brand-logo">CS</span>
          <span className="brand-name">Cardshot</span>
        </Link>
        {nav}
      </aside>

      <main className="dash-main">{children}</main>
    </div>
  );
}
