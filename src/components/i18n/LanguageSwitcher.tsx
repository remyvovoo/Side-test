"use client";

import { useLocale } from "./LocaleProvider";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="lang-switch">
      <button
        type="button"
        className={locale === "fr" ? "active" : ""}
        onClick={() => setLocale("fr")}
      >
        FR
      </button>
      <span>/</span>
      <button
        type="button"
        className={locale === "en" ? "active" : ""}
        onClick={() => setLocale("en")}
      >
        EN
      </button>
    </div>
  );
}
