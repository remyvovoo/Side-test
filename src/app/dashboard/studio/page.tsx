import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { StudioDefaultsForm } from "@/components/dashboard/StudioDefaultsForm";

export default async function StudioPage() {
  const session = await auth();
  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: {
      defaultThemeId: true,
      defaultMountId: true,
      defaultReflect: true,
      defaultHalo: true,
      defaultLogoText: true,
      defaultLogoImage: true,
      defaultLogoX: true,
      defaultLogoY: true,
      defaultLogoScale: true,
    },
  });

  return (
    <div>
      <h1 className="dash-title">Mon studio</h1>
      <p className="dash-subtitle">
        Ton décor par défaut : présentoir, univers, logo et lumière. Chaque nouvelle carte arrive directement
        dans ce studio — plus rien à re-régler.
      </p>
      <StudioDefaultsForm
        initial={{
          themeId: user?.defaultThemeId ?? null,
          mountId: user?.defaultMountId ?? null,
          reflect: user?.defaultReflect ?? 0.5,
          halo: user?.defaultHalo ?? 0.7,
          logoText: user?.defaultLogoText ?? "",
          logoImage: user?.defaultLogoImage ?? "",
          logoX: user?.defaultLogoX ?? 0.5,
          logoY: user?.defaultLogoY ?? 0.14,
          logoScale: user?.defaultLogoScale ?? 1,
        }}
      />
    </div>
  );
}
