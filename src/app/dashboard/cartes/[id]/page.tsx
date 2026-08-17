import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { CardEditor } from "@/components/dashboard/CardEditor";
import type { CardInfo } from "@/lib/render-engine";
import { EMPTY_CARD_INFO } from "@/lib/wizard/types";

export default async function CardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  const card = await prisma.card.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      name: true,
      thumbnail: true,
      cardInfo: true,
      description: true,
      hasVerso: true,
      createdAt: true,
    },
  });
  if (!card || card.userId !== session!.user.id) notFound();

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { sellerBoilerplate: true, titleTemplate: true, descriptionTemplate: true },
  });

  const cardInfo: CardInfo = { ...EMPTY_CARD_INFO, ...(card.cardInfo as Partial<CardInfo>) };

  return (
    <CardEditor
      id={card.id}
      thumbnail={card.thumbnail}
      hasVerso={card.hasVerso}
      createdAt={card.createdAt.toISOString()}
      initialCardInfo={cardInfo}
      initialDescription={card.description}
      profile={{
        boilerplate: user?.sellerBoilerplate ?? "",
        titleTemplate: user?.titleTemplate ?? "",
        descriptionTemplate: user?.descriptionTemplate ?? "",
      }}
    />
  );
}
