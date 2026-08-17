import Link from "next/link";

/** Logo Cardshot cliquable affiché sur les pages d'authentification — retour à l'accueil. */
export function AuthBrand() {
  return (
    <Link href="/" className="auth-brand" aria-label="Retour à l'accueil Cardshot">
      <span className="auth-brand-logo">CS</span>
      <span className="auth-brand-name">Cardshot</span>
    </Link>
  );
}
