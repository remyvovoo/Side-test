export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

type EmailLocale = "fr" | "en";

/** Gabarit visuel commun : carte sombre, accent violet, bouton d'action. */
function layout(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#0b0a12;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#16151f;border:1px solid #2a2938;border-radius:16px;padding:32px 28px;">
      <div style="display:inline-block;background:#8b7cf8;color:#fff;font-weight:700;font-size:14px;border-radius:10px;padding:8px 12px;">CS</div>
      <span style="color:#fff;font-weight:700;font-size:16px;margin-left:8px;">Cardshot</span>
      <h1 style="color:#ffffff;font-size:22px;margin:24px 0 8px;">${title}</h1>
      <div style="color:#b6b3c7;font-size:14px;line-height:1.6;">${bodyHtml}</div>
      ${
        cta
          ? `<a href="${cta.url}" style="display:block;text-align:center;background:#8b7cf8;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:12px;padding:14px 20px;margin-top:24px;">${cta.label}</a>`
          : ""
      }
      <p style="color:#6c6980;font-size:12px;margin-top:28px;margin-bottom:0;">Cardshot — tes cartes, prêtes à vendre.</p>
    </div>
  </body>
</html>`;
}

export function welcomeEmail(locale: EmailLocale, appUrl: string): EmailContent {
  if (locale === "en") {
    return {
      subject: "Welcome to Cardshot — your 30-day free trial has started",
      text: `Welcome to Cardshot!\n\nYour 30-day free trial has started — no credit card needed.\nPhotograph a card and get studio-quality visuals plus a ready-to-publish listing in under a minute.\n\nStart now: ${appUrl}`,
      html: layout(
        "Welcome to Cardshot 👋",
        `<p>Your <b style="color:#fff;">30-day free trial</b> has started — no credit card needed.</p>
         <p>Photograph a card and get studio-quality visuals plus a ready-to-publish listing in under a minute.</p>`,
        { label: "Create my first card", url: appUrl }
      ),
    };
  }
  return {
    subject: "Bienvenue sur Cardshot — ton essai gratuit de 30 jours a commencé",
    text: `Bienvenue sur Cardshot !\n\nTon essai gratuit de 30 jours a commencé — sans carte bancaire.\nPhotographie une carte et obtiens des visuels studio et une annonce prête à publier en moins d'une minute.\n\nCommencer : ${appUrl}`,
    html: layout(
      "Bienvenue sur Cardshot 👋",
      `<p>Ton <b style="color:#fff;">essai gratuit de 30 jours</b> a commencé — sans carte bancaire.</p>
       <p>Photographie une carte et obtiens des visuels studio et une annonce prête à publier en moins d'une minute.</p>`,
      { label: "Créer ma première carte", url: appUrl }
    ),
  };
}

export function resetPasswordEmail(locale: EmailLocale, resetUrl: string): EmailContent {
  if (locale === "en") {
    return {
      subject: "Reset your Cardshot password",
      text: `Someone requested a password reset for your Cardshot account.\n\nReset it here (link valid for 24 hours, single use): ${resetUrl}\n\nIf you didn't ask for this, you can safely ignore this email.`,
      html: layout(
        "Reset your password",
        `<p>Someone requested a password reset for your Cardshot account.</p>
         <p>The link below is valid for <b style="color:#fff;">24 hours</b> and can be used once.</p>
         <p>If you didn't ask for this, you can safely ignore this email — your password stays unchanged.</p>`,
        { label: "Choose a new password", url: resetUrl }
      ),
    };
  }
  return {
    subject: "Réinitialise ton mot de passe Cardshot",
    text: `Une demande de réinitialisation de mot de passe a été faite pour ton compte Cardshot.\n\nRéinitialise-le ici (lien valable 24 h, à usage unique) : ${resetUrl}\n\nSi tu n'es pas à l'origine de cette demande, ignore simplement cet e-mail.`,
    html: layout(
      "Réinitialise ton mot de passe",
      `<p>Une demande de réinitialisation de mot de passe a été faite pour ton compte Cardshot.</p>
       <p>Le lien ci-dessous est valable <b style="color:#fff;">24 heures</b> et ne peut servir qu'une fois.</p>
       <p>Si tu n'es pas à l'origine de cette demande, ignore simplement cet e-mail — ton mot de passe reste inchangé.</p>`,
      { label: "Choisir un nouveau mot de passe", url: resetUrl }
    ),
  };
}
