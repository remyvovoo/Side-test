import type { CardInfo } from "@/lib/render-engine";

/**
 * Génération de l'annonce à partir des modèles à variables du vendeur.
 * Une annonce = titre (modèle) + corps (modèle) + conditions de vente.
 * Les lignes dont toutes les variables sont vides disparaissent : pas de
 * « Prix : » orphelin dans l'annonce.
 */

export interface AnnonceProfile {
  titleTemplate: string;
  descriptionTemplate: string;
  boilerplate: string;
}

/** Variables proposées dans l'éditeur de modèles (profil vendeur). */
export const ANNONCE_VARIABLES = [
  { token: "{nom}", label: "Nom" },
  { token: "{numéro}", label: "Numéro" },
  { token: "{série}", label: "Série" },
  { token: "{état}", label: "État" },
  { token: "{rareté}", label: "Rareté" },
  { token: "{langue}", label: "Langue" },
  { token: "{prix}", label: "Prix" },
] as const;

export const DEFAULT_TITLE_TEMPLATE = "{nom} – {série} – {état}";

/**
 * Modèle par défaut : une phrase d'accroche naturelle (une seule variable —
 * disparaît proprement si le nom est vide), puis la liste habituelle pour le
 * reste. Le champ est un texte 100 % libre (voir SellerProfileForm) : rien
 * n'empêche un vendeur de tout réécrire en prose s'il préfère.
 */
export const DEFAULT_DESCRIPTION_TEMPLATE = [
  "Je mets en vente cette carte {nom}.",
  "Numéro : {numéro}",
  "Série : {série}",
  "Rareté : {rareté}",
  "État : {état}",
  "Langue : {langue}",
  "Prix : {prix}",
].join("\n");

function tokenValues(info: CardInfo): Record<string, string> {
  return {
    "{nom}": info.name,
    "{numéro}": info.number,
    "{série}": info.series,
    "{état}": info.condition,
    "{rareté}": info.rarity,
    "{langue}": info.language,
    "{prix}": info.price,
  };
}

/** Remplace les variables ; supprime les lignes dont toutes les variables sont vides. */
export function renderTemplate(template: string, info: CardInfo): string {
  const values = tokenValues(info);
  const lines = template.split("\n").map((line) => {
    const tokensInLine = Object.keys(values).filter((t) => line.includes(t));
    if (tokensInLine.length > 0 && tokensInLine.every((t) => !values[t].trim())) {
      return null; // ligne entièrement vide une fois remplie → on la retire
    }
    let out = line;
    for (const [token, value] of Object.entries(values)) {
      out = out.split(token).join(value.trim());
    }
    // Nettoie les séparateurs orphelins laissés par des variables vides ("A –  – B").
    return out.replace(/\s+([–\-|·])\s+(?=[–\-|·]|$)/g, " ").replace(/\s{2,}/g, " ").trim();
  });
  return lines.filter((l): l is string => l !== null).join("\n").trim();
}

export function renderTitle(info: CardInfo, profile: AnnonceProfile): string {
  const tpl = profile.titleTemplate.trim() || DEFAULT_TITLE_TEMPLATE;
  return renderTemplate(tpl, info);
}

export function generateDescription(info: CardInfo, profile: AnnonceProfile): string {
  const title = renderTitle(info, profile);
  const bodyTpl = profile.descriptionTemplate.trim() || DEFAULT_DESCRIPTION_TEMPLATE;
  const body = renderTemplate(bodyTpl, info);
  const conditions = profile.boilerplate.trim();
  return [title, body, conditions].filter(Boolean).join("\n\n");
}
