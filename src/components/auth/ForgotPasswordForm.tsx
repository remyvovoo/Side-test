"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { AuthBrand } from "./AuthBrand";

export function ForgotPasswordForm() {
  const { dictionary: dict } = useLocale();
  const t = dict.auth.forgot;
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setSent(true);
    } catch {
      setError(t.errorGeneric);
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="auth-page">
        <AuthBrand />
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div className="auth-success-ring">
            <i className="ti ti-mail" />
          </div>
          <div className="auth-title">{t.sentTitle}</div>
          <div className="auth-subtitle">{t.sentSubtitle}</div>
          <button className="btn btn-primary" onClick={() => router.push("/login")} type="button" style={{ marginTop: 16 }}>
            {t.backToLogin}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <AuthBrand />
      <LanguageSwitcher />
      <div className="auth-card">
        <div className="auth-title">{t.title}</div>
        <div className="auth-subtitle">{t.subtitle}</div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="email">{t.emailLabel}</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ marginTop: 8 }}>
            {t.submit}
          </button>
        </form>

        <div className="auth-footer">
          <a onClick={() => router.push("/login")}>{t.backToLogin}</a>
        </div>
      </div>
    </div>
  );
}
