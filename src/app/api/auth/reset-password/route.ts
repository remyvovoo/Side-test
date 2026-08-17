import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, isPasswordStrongEnough } from "@/lib/auth/password";

const ResetSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(8),
});

const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = ResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const { token, password } = parsed.data;

  if (!isPasswordStrongEnough(password)) {
    return NextResponse.json({ error: "weak_password" }, { status: 400 });
  }

  const resetRequest = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  const expired = resetRequest && Date.now() - resetRequest.createdAt.getTime() > TOKEN_MAX_AGE_MS;
  if (!resetRequest || resetRequest.isUsed || expired) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: resetRequest.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetRequest.id }, data: { isUsed: true } }),
  ]);

  return NextResponse.json({ ok: true });
}
