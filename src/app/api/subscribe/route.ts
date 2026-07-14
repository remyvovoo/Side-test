import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// V1 : les emails sont visibles dans les logs Vercel (onglet Logs du projet).
// V2 : brancher un vrai outil d'emailing (Brevo, etc.).
export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({ email: undefined }));
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  console.log("[cardshot] SUBSCRIBE:", email, new Date().toISOString());
  return NextResponse.json({ ok: true });
}
