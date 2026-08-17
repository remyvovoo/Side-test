"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { AuthBrand } from "./AuthBrand";

export function LoginForm() {
  const { dictionary: dict } = useLocale();
  const t = dict.auth.login;
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setError(t.errorInvalid);
      setSubmitting(false);
      return;
    }
    router.push("/dashboard");
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
          <div className="auth-field">
            <label htmlFor="password">{t.passwordLabel}</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <a className="auth-forgot-link" onClick={() => router.push("/forgot-password")}>
              {t.forgotLink}
            </a>
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ marginTop: 8 }}>
            {t.submit}
          </button>
        </form>

        <div className="auth-footer">
          {t.noAccount} <a onClick={() => router.push("/register")}>{t.registerLink}</a>
        </div>
      </div>
    </div>
  );
}
