import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { SellerProfileForm } from "@/components/dashboard/SellerProfileForm";

export default async function SellerProfilePage() {
  const session = await auth();
  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { sellerBoilerplate: true, titleTemplate: true, descriptionTemplate: true },
  });

  return (
    <div>
      <h1 className="dash-title">Mon profil vendeur</h1>
      <p className="dash-subtitle">
        Tes modèles d&apos;annonce et tes conditions de vente. Tu les écris une fois : chaque carte photographiée
        génère ensuite son annonce toute seule.
      </p>
      <SellerProfileForm
        initialBoilerplate={user?.sellerBoilerplate ?? ""}
        initialTitleTemplate={user?.titleTemplate ?? ""}
        initialDescriptionTemplate={user?.descriptionTemplate ?? ""}
      />
    </div>
  );
}
