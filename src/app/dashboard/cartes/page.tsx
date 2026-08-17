import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { CardGrid } from "@/components/dashboard/CardGrid";

export default async function MyCardsPage() {
  const session = await auth();
  const cards = await prisma.card.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, thumbnail: true, createdAt: true, hasVerso: true },
  });

  return (
    <div>
      <h1 className="dash-title">Mes cartes</h1>
      <p className="dash-subtitle">
        Toutes tes annonces créées. La vignette est là pour t&apos;y retrouver — les visuels complets sont dans les
        ZIP téléchargés.
      </p>

      {cards.length === 0 ? (
        <div className="dash-empty">
          <i className="ti ti-cards" />
          <b>Aucune carte pour l&apos;instant</b>
          <span>Photographie ta première carte : elle apparaîtra ici automatiquement après l&apos;export.</span>
          <Link href="/dashboard/nouvelle" className="btn btn-primary" style={{ marginTop: 14 }}>
            <i className="ti ti-camera" /> Créer ma première carte
          </Link>
        </div>
      ) : (
        <CardGrid
          cards={cards.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
          interactive
        />
      )}
    </div>
  );
}
