import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { THEMES } from "@/lib/render-engine";

const OnboardingSchema = z.object({
  defaultThemeId: z.string().optional(),
  monthlyVolume: z.number().int().min(1).max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = OnboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const { defaultThemeId, monthlyVolume } = parsed.data;

  if (defaultThemeId && !THEMES.some((t) => t.id === defaultThemeId)) {
    return NextResponse.json({ error: "unknown_theme" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(defaultThemeId ? { defaultThemeId } : {}),
      ...(monthlyVolume ? { monthlyVolume } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
