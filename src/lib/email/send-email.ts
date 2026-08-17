import type { EmailContent } from "./templates";

/**
 * Envoi d'e-mails transactionnels via l'API Mailjet (même service que Vovoo).
 * Sans clés configurées (dev local), l'e-mail est journalisé en console à la
 * place — le lien de réinitialisation y reste utilisable pour tester.
 */
export async function sendEmail(to: string, content: EmailContent): Promise<void> {
  const apiKey = process.env.MAILJET_API_KEY;
  const apiSecret = process.env.MAILJET_API_SECRET;
  const fromEmail = process.env.MAILJET_FROM_EMAIL;
  const fromName = process.env.MAILJET_FROM_NAME ?? "Cardshot";

  if (!apiKey || !apiSecret || !fromEmail) {
    console.log(
      `[email non configuré — MAILJET_* manquant]\n  À: ${to}\n  Sujet: ${content.subject}\n  Texte: ${content.text}`
    );
    return;
  }

  try {
    const res = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`,
      },
      body: JSON.stringify({
        Messages: [
          {
            From: { Email: fromEmail, Name: fromName },
            To: [{ Email: to }],
            Subject: content.subject,
            TextPart: content.text,
            HTMLPart: content.html,
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error(`[email] Mailjet a répondu ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error("[email] Échec d'envoi Mailjet:", err);
  }
}
