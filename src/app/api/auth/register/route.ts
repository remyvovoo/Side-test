import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, isPasswordStrongEnough } from "@/lib/auth/password";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  locale: z.enum(["fr", "en"]).default("fr"),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const { email, password, locale } = parsed.data;

  if (!isPasswordStrongEnough(password)) {
    return NextResponse.json({ error: "weak_password" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "email_taken" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email: normalizedEmail, passwordHash, locale },
  });

  return NextResponse.json({ ok: true, userId: user.id });
}
