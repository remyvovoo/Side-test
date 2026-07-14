"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { evaluatePasswordStrength, isPasswordStrongEnough } from "@/lib/auth/password";

export function RegisterForm() {
  const { dictionary: dict, locale } = useLocale();
  const t = dict.auth.register;
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const rules = evaluatePasswordStrength(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isPasswordStrongEnough(password)) {
      setError(t.errorWeakPassword);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, locale }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error === "email_taken" ? t.errorEmailTaken : t.errorGeneric);
        setSubmitting(false);
        return;
      }

      await signIn("credentials", { email, password, redirect: false });
      setSuccess(true);
      setTimeout(() => router.push("/"), 1400);
    } catch {
      setError(t.errorGeneric);
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div className="auth-success-ring">
            <i className="ti ti-check" />
          </div>
          <div className="auth-title">{t.successTitle}</div>
          <div className="auth-subtitle">{t.successSubtitle}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <LanguageSwitcher />
      <div className="auth-card">
        <span className="auth-badge">
          <i className="ti ti-gift" /> {dict.auth.trialBadge}
        </span>
        <div className="auth-title">{t.title}</div>
        <div className="auth-subtitle">{t.subtitle}</div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="email">{t.emailLabel}</label>
            <input
              id="email"
              type="email"
              placeholder={t.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="auth-field">
            <label htmlFor="password">{t.passwordLabel}</label>
            <input
              id="password"
              type="password"
              placeholder={t.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <div className="auth-rules">
              <div className={`auth-rule${rules.length ? " met" : ""}`}>
                <i className={`ti ${rules.length ? "ti-circle-check" : "ti-circle"}`} /> {t.ruleLength}
              </div>
              <div className={`auth-rule${rules.uppercase ? " met" : ""}`}>
                <i className={`ti ${rules.uppercase ? "ti-circle-check" : "ti-circle"}`} /> {t.ruleUppercase}
              </div>
              <div className={`auth-rule${rules.lowercase ? " met" : ""}`}>
                <i className={`ti ${rules.lowercase ? "ti-circle-check" : "ti-circle"}`} /> {t.ruleLowercase}
              </div>
              <div className={`auth-rule${rules.number ? " met" : ""}`}>
                <i className={`ti ${rules.number ? "ti-circle-check" : "ti-circle"}`} /> {t.ruleNumber}
              </div>
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ marginTop: 8 }}>
            {t.submit}
          </button>
        </form>

        <div className="auth-footer">
          {t.hasAccount} <a onClick={() => router.push("/login")}>{t.loginLink}</a>
        </div>
      </div>
    </div>
  );
}
