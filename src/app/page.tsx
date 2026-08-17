import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { WizardApp } from "@/components/wizard/WizardApp";

export default async function Home() {
  const session = await auth();
  // Connecté → l'espace dédié ; l'accueil public est réservé aux visiteurs.
  if (session?.user) redirect("/dashboard");

  return <WizardApp isAuthenticated={false} />;
}
