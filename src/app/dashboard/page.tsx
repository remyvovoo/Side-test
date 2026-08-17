import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { THEMES } from "@/lib/render-engine";
import { CardGrid } from "@/components/dashboard/CardGrid";

export default async function DashboardHome() {
  const session = await auth();
  const userId = session!.user.id;

  const [user, cardCount, recentCards] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { defaultThemeId: true } }),
    prisma.card.count({ where: { userId } }),
    prisma.card.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, name: true, thumbnail: true, createdAt: true, hasVerso: true },
    }),
  ]);

  const themeName = THEMES.find((t) => t.id === user?.defaultThemeId)?.name ?? THEMES[0].name;

  return (
    <div>
      <h1 className="dash-title">Bonjour 👋</h1>
      <p className="dash-subtitle">Voici l&apos;activité de ton compte Cardshot.</p>

      <div className="dash-tiles">
        <div className="dash-tile">
          <i className="ti ti-cards" />
          <b>{cardCount}</b>
          <span>Carte{cardCount > 1 ? "s" : ""} créée{cardCount > 1 ? "s" : ""}</span>
        </div>
        <div className="dash-tile">
          <i className="ti ti-palette" />
          <b>{themeName}</b>
          <span>Univers par défaut</span>
        </div>
      </div>

      {cardCount === 0 ? (
        <div className="dash-cta-band">
          <div>
            <b>Lance ta première carte 📸</b>
            <span>Photographie une carte et obtiens ton annonce prête à publier en une minute.</span>
          </div>
          <Link href="/dashboard/nouvelle" className="btn btn-primary">
            <i className="ti ti-camera" /> Nouvelle carte
          </Link>
        </div>
      ) : (
        <>
          <div className="dash-section-head">
            <span className="dash-section-label">Cartes récentes</span>
            <Link href="/dashboard/nouvelle" className="dash-inline-link">
              <i className="ti ti-plus" /> Lancer une nouvelle carte
            </Link>
          </div>
          <CardGrid
            cards={recentCards.map((c) => ({
              ...c,
              createdAt: c.createdAt.toISOString(),
            }))}
          />
        </>
      )}
    </div>
  );
}
