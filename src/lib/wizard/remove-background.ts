export class RemoveBackgroundError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

export async function removeBackground(blob: Blob): Promise<Blob> {
  const fd = new FormData();
  fd.append("image_file", blob, "card.jpg");
  const r = await fetch("/api/remove-bg", { method: "POST", body: fd });
  if (!r.ok) throw new RemoveBackgroundError(r.status, `HTTP ${r.status}`);
  return r.blob();
}
