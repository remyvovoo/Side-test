"use client";

import { PasswordField } from "./PasswordField";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { AuthBrand } from "./AuthBrand";
import { evaluatePasswordStrength, isPasswordStrongEnough } from "@/lib/auth/password";

export function ResetPasswordForm({ token }: { token: string }) {
  const { dictionary: dict } = useLocale();
  const t = dict.auth.reset;
  const tr = dict.auth.register;
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const rules = evaluatePasswordStrength(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isPasswordStrongEnough(password)) {
      setError(tr.errorWeakPassword);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error === "invalid_token" ? t.errorInvalidToken : t.errorGeneric);
        setSubmitting(false);
        return;
      }
      setSuccess(true);
    } catch {
      setError(t.errorGeneric);
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="auth-page">
        <AuthBrand />
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div className="auth-success-ring">
            <i className="ti ti-check" />
          </div>
          <div className="auth-title">{t.successTitle}</div>
          <div className="auth-subtitle">{t.successSubtitle}</div>
          <button className="btn btn-primary" onClick={() => router.push("/login")} type="button" style={{ marginTop: 16 }}>
            {t.goLogin}
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
          <div>
            <PasswordField
              id="password"
              label={t.passwordLabel}
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
            <div className="auth-rules">
              <div className={`auth-rule${rules.length ? " met" : ""}`}>
                <i className={`ti ${rules.length ? "ti-circle-check" : "ti-circle"}`} /> {tr.ruleLength}
              </div>
              <div className={`auth-rule${rules.uppercase ? " met" : ""}`}>
                <i className={`ti ${rules.uppercase ? "ti-circle-check" : "ti-circle"}`} /> {tr.ruleUppercase}
              </div>
              <div className={`auth-rule${rules.lowercase ? " met" : ""}`}>
                <i className={`ti ${rules.lowercase ? "ti-circle-check" : "ti-circle"}`} /> {tr.ruleLowercase}
              </div>
              <div className={`auth-rule${rules.number ? " met" : ""}`}>
                <i className={`ti ${rules.number ? "ti-circle-check" : "ti-circle"}`} /> {tr.ruleNumber}
              </div>
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ marginTop: 8 }}>
            {t.submit}
          </button>
        </form>
      </div>
    </div>
  );
}
