import type { Locale } from "./locales";
import fr from "./dictionaries/fr";
import en from "./dictionaries/en";

export type Dictionary = typeof fr;

const dictionaries: Record<Locale, Dictionary> = { fr, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
