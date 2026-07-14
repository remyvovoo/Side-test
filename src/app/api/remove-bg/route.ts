import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

/**
 * Proxies a card photo to remove.bg. The API key lives only in the
 * REMOVE_BG_KEY environment variable — there is intentionally no
 * hardcoded fallback (a previous version leaked a real key this way).
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.REMOVE_BG_KEY;
  if (!apiKey) {
    console.error("[cardshot] REMOVE_BG_KEY is not configured");
    return NextResponse.json({ error: "service_not_configured" }, { status: 500 });
  }

  const formData = await req.formData();
  const imageFile = formData.get("image_file");
  if (!imageFile) {
    return NextResponse.json({ error: "image_file manquant" }, { status: 400 });
  }

  const rbForm = new FormData();
  rbForm.append("image_file", imageFile);
  rbForm.append("size", "auto");

  const response = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-Api-Key": apiKey },
    body: rbForm,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[cardshot] remove.bg error", response.status, error);
    return NextResponse.json({ error: "removal_failed" }, { status: response.status });
  }

  const imageBuffer = await response.arrayBuffer();
  return new NextResponse(imageBuffer, {
    status: 200,
    headers: { "Content-Type": "image/png" },
  });
}
