import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

const CardSchema = z.object({
  name: z.string().min(1).max(120),
  thumbnail: z
    .string()
    .startsWith("data:image/")
    .max(300_000, "thumbnail_too_large"),
  cardInfo: z.record(z.string(), z.string()),
  description: z.string().max(5000),
  themeId: z.string().max(60),
  mountId: z.string().max(60),
  hasVerso: z.boolean(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = CardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const card = await prisma.card.create({
    data: { ...parsed.data, userId: session.user.id },
  });

  return NextResponse.json({ ok: true, cardId: card.id });
}
