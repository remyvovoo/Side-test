"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { AuthBrand } from "./AuthBrand";
import { evaluatePasswordStrength, isPasswordStrongEnough } from "@/lib/auth/password";
import { renderShot, THEMES, MOUNTS } from "@/lib/render-engine";
import { demoCard } from "@/lib/wizard/demo-card";
import { EMPTY_CARD_INFO } from "@/lib/wizard/types";

type Step = "account" | "universe" | "volume" | "preparing" | "ready";

/**
 * Paliers de volume mensuel. `value` est la borne haute stockée en base
 * (2000 = « plus de 1 000 ») ; le libellé est neutre en langue.
 */
const VOLUME_TIERS = [
  { value: 10, label: "< 10" },
  { value: 100, label: "10–100" },
  { value: 500, label: "100–500" },
  { value: 1000, label: "500–1000" },
  { value: 2000, label: "1000+" },
];
const PREPARING_SECONDS = 5;

function OnboardingStepper({
  labels,
  currentIdx,
  compact = false,
}: {
  labels: string[];
  currentIdx: number;
  compact?: boolean;
}) {
  return (
    <div className={`onb-stepper${compact ? " compact" : ""}`}>
      {labels.map((label, i) => {
        const done = currentIdx > i;
        const active = currentIdx === i;
        return (
          <div className="onb-step" key={label}>
            <span className={`onb-step-dot${active ? " active" : ""}${done ? " done" : ""}`}>
              {done ? <i className="ti ti-check" /> : i + 1}
            </span>
            <span className={`onb-step-label${active ? " active" : ""}`}>{label}</span>
            {i < labels.length - 1 && <span className="onb-step-line" />}
          </div>
        );
      })}
    </div>
  );
}

/** Aperçu d'un univers : la carte de démo rendue par le moteur, dans ce thème. */
function UniversePreview({ themeIndex }: { themeIndex: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    renderShot(ref.current, {
      shot: { face: "recto", angle: 0, name: "" },
      rectoImage: demoCard(),
      versoImage: null,
      mount: MOUNTS[0],
      theme: THEMES[themeIndex],
      reflect: 0.5,
      halo: 0.7,
      logoImage: null,
      logoText: "",
      cardInfo: EMPTY_CARD_INFO,
      size: 320,
    });
  }, [themeIndex]);
  return <canvas ref={ref} />;
}

export function OnboardingFlow() {
  const { dictionary: dict, locale } = useLocale();
  const t = dict.auth.register;
  const ob = dict.auth.onboarding;
  const router = useRouter();

  const [step, setStep] = useState<Step>("account");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [themeIndex, setThemeIndex] = useState(0);
  const [volume, setVolume] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(PREPARING_SECONDS);

  const rules = evaluatePasswordStrength(password);

  async function handleAccountSubmit(e: React.FormEvent) {
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
      setSubmitting(false);
      setStep("universe");
    } catch {
      setError(t.errorGeneric);
      setSubmitting(false);
    }
  }

  async function saveOnboarding(withVolume: number | null) {
    try {
      await fetch("/api/auth/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultThemeId: THEMES[themeIndex].id,
          ...(withVolume ? { monthlyVolume: withVolume } : {}),
        }),
      });
    } catch {
      // Non bloquant : les choix restent modifiables plus tard dans le studio.
    }
  }

  function finishVolume(chosen: number | null) {
    void saveOnboarding(chosen);
    setCountdown(PREPARING_SECONDS);
    setStep("preparing");
  }

  useEffect(() => {
    if (step !== "preparing") return;
    const id = setTimeout(() => {
      if (countdown <= 1) setStep("ready");
      else setCountdown(countdown - 1);
    }, 1000);
    return () => clearTimeout(id);
  }, [step, countdown]);

  const stepLabels = [ob.stepAccount, ob.stepUniverse, ob.stepVolume];
  const stepOrder: Step[] = ["account", "universe", "volume"];
  const currentIdx = stepOrder.indexOf(step);

  if (step === "preparing") {
    const progress = ((PREPARING_SECONDS - countdown) / PREPARING_SECONDS) * 100;
    return (
      <div className="auth-page">
      <AuthBrand />
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div className="auth-title">{ob.preparingTitle}</div>
          <div className="auth-subtitle">{ob.preparingSubtitle}</div>
          <div
            className="onb-countdown"
            style={{ background: `conic-gradient(var(--accent) ${progress * 3.6}deg, var(--surface2) 0deg)` }}
          >
            <div className="onb-countdown-inner">{countdown}</div>
          </div>
          <div className="onb-preparing-status">
            <span className="onb-pulse" /> {ob.preparingStatus}
          </div>
        </div>
      </div>
    );
  }

  if (step === "ready") {
    return (
      <div className="auth-page">
      <AuthBrand />
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div className="auth-success-ring">
            <i className="ti ti-check" />
          </div>
          <div className="auth-title">{ob.readyTitle}</div>
          <div className="auth-subtitle">{ob.readySubtitle}</div>
          <button
            className="btn btn-primary"
            onClick={() => router.push("/dashboard")}
            type="button"
            style={{ marginTop: 16 }}
          >
            {ob.readyCta} <i className="ti ti-arrow-right" />
          </button>
        </div>
      </div>
    );
  }

  if (step === "universe") {
    return (
      <div className="auth-page">
      <AuthBrand />
        <div className="auth-card onb-card-wide">
          <OnboardingStepper labels={stepLabels} currentIdx={currentIdx} />
          <div className="auth-title">{ob.universeTitle}</div>
          <div className="auth-subtitle">{ob.universeSubtitle}</div>
          <div className="onb-universe-grid">
            {THEMES.map((theme, i) => (
              <button
                key={theme.id}
                type="button"
                className={`onb-universe${themeIndex === i ? " selected" : ""}`}
                onClick={() => setThemeIndex(i)}
              >
                <UniversePreview themeIndex={i} />
                <span className="onb-universe-name">{theme.name}</span>
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => setStep("volume")} type="button" style={{ marginTop: 16 }}>
            {ob.universeCta} <i className="ti ti-arrow-right" />
          </button>
        </div>
      </div>
    );
  }

  if (step === "volume") {
    return (
      <div className="auth-page">
      <AuthBrand />
        <div className="auth-card onb-card-wide">
          <OnboardingStepper labels={stepLabels} currentIdx={currentIdx} />
          <div className="auth-title">{ob.volumeTitle}</div>
          <div className="auth-subtitle">{ob.volumeSubtitle}</div>
          <div className="onb-volume-grid">
            {VOLUME_TIERS.map((tier) => (
              <button
                key={tier.value}
                type="button"
                className={`onb-volume${volume === tier.value ? " selected" : ""}`}
                onClick={() => setVolume(tier.value)}
              >
                <b>{tier.label}</b>
                <span>{ob.volumeUnit}</span>
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => finishVolume(volume)} type="button" style={{ marginTop: 16 }}>
            {ob.volumeCta} <i className="ti ti-arrow-right" />
          </button>
          <div className="auth-footer">
            <a onClick={() => finishVolume(null)}>{ob.volumeSkip}</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <AuthBrand />
      <LanguageSwitcher />
      <div className="auth-card">
        <OnboardingStepper labels={stepLabels} currentIdx={currentIdx} compact />
        <span className="auth-badge">
          <i className="ti ti-gift" /> {dict.auth.trialBadge}
        </span>
        <div className="auth-title">{t.title}</div>
        <div className="auth-subtitle">{t.subtitle}</div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleAccountSubmit}>
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
