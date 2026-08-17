import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { THEMES, MOUNTS } from "@/lib/render-engine";
import { WizardApp } from "@/components/wizard/WizardApp";

export default async function NewCardPage() {
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
      sellerBoilerplate: true,
      titleTemplate: true,
      descriptionTemplate: true,
    },
  });

  const themeIdx = THEMES.findIndex((t) => t.id === user?.defaultThemeId);
  const mountIdx = MOUNTS.findIndex((m) => m.id === user?.defaultMountId);

  return (
    <WizardApp
      isAuthenticated
      embedded
      initialThemeIndex={themeIdx >= 0 ? themeIdx : 0}
      initialMountIndex={mountIdx >= 0 ? mountIdx : 0}
      initialReflect={user?.defaultReflect ?? 0.5}
      initialHalo={user?.defaultHalo ?? 0.7}
      initialLogoText={user?.defaultLogoText ?? ""}
      initialLogoImageUrl={user?.defaultLogoImage ?? ""}
      initialSellerBoilerplate={user?.sellerBoilerplate ?? ""}
      titleTemplate={user?.titleTemplate ?? ""}
      descriptionTemplate={user?.descriptionTemplate ?? ""}
    />
  );
}
