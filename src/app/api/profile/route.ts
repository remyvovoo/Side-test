import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { THEMES, MOUNTS } from "@/lib/render-engine";

const ProfileSchema = z.object({
  sellerBoilerplate: z.string().max(2000).optional(),
  titleTemplate: z.string().max(300).optional(),
  descriptionTemplate: z.string().max(2000).optional(),
  // Réglages studio par défaut
  defaultThemeId: z.string().refine((v) => THEMES.some((t) => t.id === v), "unknown_theme").optional(),
  defaultMountId: z.string().refine((v) => MOUNTS.some((m) => m.id === v), "unknown_mount").optional(),
  defaultReflect: z.number().min(0).max(1).optional(),
  defaultHalo: z.number().min(0).max(1).optional(),
  defaultLogoText: z.string().max(40).optional(),
  defaultLogoImage: z
    .string()
    .max(300_000)
    .refine((v) => v === "" || v.startsWith("data:image/"), "invalid_logo")
    .optional(),
  // Placement du logo vendeur sur le mur : centre du bloc en fraction du
  // cadre, et facteur de taille. Bornés pour qu'il reste toujours attrapable.
  defaultLogoX: z.number().min(0).max(1).optional(),
  defaultLogoY: z.number().min(0).max(1).optional(),
  defaultLogoScale: z.number().min(0.3).max(3).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  // Zod a validé chaque champ ; on ne transmet que ceux réellement envoyés.
  const data = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
  await prisma.user.update({ where: { id: session.user.id }, data });

  return NextResponse.json({ ok: true });
}
