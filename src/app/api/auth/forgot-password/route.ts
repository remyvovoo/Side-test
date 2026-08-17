import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send-email";
import { resetPasswordEmail } from "@/lib/email/templates";

const ForgotSchema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = ForgotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });

  // Réponse identique que l'e-mail existe ou non : on ne révèle jamais
  // si une adresse est inscrite (même principe que Vovoo).
  if (user) {
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, isUsed: false },
      data: { isUsed: true },
    });

    const token = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({ data: { token, userId: user.id } });

    const resetUrl = `${req.nextUrl.origin}/reset-password/${token}`;
    await sendEmail(user.email, resetPasswordEmail(user.locale, resetUrl));
  }

  return NextResponse.json({ ok: true });
}
