import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

// Mise à jour partielle : le wizard envoie tout, la fiche carte seulement ce qui change.
const CardUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  thumbnail: z.string().startsWith("data:image/").max(300_000).optional(),
  cardInfo: z.record(z.string(), z.string()).optional(),
  description: z.string().max(5000).optional(),
  themeId: z.string().max(60).optional(),
  mountId: z.string().max(60).optional(),
  hasVerso: z.boolean().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const card = await prisma.card.findUnique({ where: { id }, select: { userId: true } });
  if (!card || card.userId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = CardUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  await prisma.card.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ ok: true, cardId: id });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const card = await prisma.card.findUnique({ where: { id }, select: { userId: true } });
  if (!card || card.userId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.card.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
