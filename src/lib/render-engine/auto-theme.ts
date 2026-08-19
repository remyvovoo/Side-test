import type { StudioTheme } from "./types";

/**
 * ESSAI (suggestion de Remy, 19 août 2026) : fabriquer le décor À PARTIR de la
 * carte plutôt que de le choisir dans une liste fixe.
 *
 * L'idée : un fond dérivé de la carte est cohérent d'office, sans effort du
 * vendeur, et donne un visuel qui semble fait sur mesure.
 *
 * Le piège, et c'est lui qui gouverne tout le réglage ci-dessous : reprendre
 * les couleurs de la carte ferait DISPARAÎTRE la carte dans son fond. Ce qui
 * rend une photo produit lisible, c'est le contraste. La règle n'est donc pas
 * « mêmes couleurs » mais « même famille, valeur opposée » — on garde la
 * teinte dominante et on la pousse vers une version nettement plus sombre et
 * désaturée. Un Dracaufeu orange se détache sur un brun-braise profond, pas
 * sur de l'orange.
 *
 * Le résultat est DÉTERMINISTE : la même carte donne toujours le même décor.
 * Un fond qui changerait à chaque rendu serait insupportable à l'usage.
 *
 * Ne s'applique qu'aux décors DESSINÉS : les univers à plaque sont de vraies
 * photographies, qu'on ne peut pas recolorer sans que ça se voie.
 */

export const AUTO_THEME_ID = "auto";

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}

const hex = (rgb: [number, number, number]) =>
  "#" + rgb.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");

/**
 * Teinte dominante de la carte. On vote par secteur de teinte, pondéré par la
 * saturation : une carte est très majoritairement composée de gris et de
 * blancs (texte, cadre, fond d'illustration) qui n'ont pas de teinte propre et
 * ne doivent donc pas peser dans le résultat.
 */
export function dominantHue(img: CanvasImageSource): { h: number; s: number } | null {
  const W = 80;
  const H = 112;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;

  const BINS = 24;
  const weight = new Float64Array(BINS);
  const satSum = new Float64Array(BINS);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue; // hors de la carte détourée
    const [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
    // Ni les gris, ni les extrêmes de luminosité : ils n'ont pas de teinte
    // exploitable et tireraient le vote vers du bruit.
    if (s < 0.22 || l < 0.12 || l > 0.9) continue;
    const bin = Math.min(BINS - 1, Math.floor(h * BINS));
    weight[bin] += s;
    satSum[bin] += s;
  }
  let best = -1;
  let bestW = 0;
  for (let i = 0; i < BINS; i++) {
    // Secteurs voisins comptés ensemble : une teinte à cheval sur deux cases
    // ne doit pas se faire battre par du bruit isolé.
    const w = weight[i] + 0.5 * (weight[(i + 1) % BINS] + weight[(i + BINS - 1) % BINS]);
    if (w > bestW) {
      bestW = w;
      best = i;
    }
  }
  if (best < 0 || bestW < 40) return null; // carte sans teinte franche
  return { h: (best + 0.5) / BINS, s: Math.min(0.9, satSum[best] / Math.max(1, weight[best])) };
}

/**
 * Décor dérivé de la carte. Renvoie null si la carte n'a pas de teinte
 * franche : on garde alors le décor choisi, plutôt que d'inventer.
 */
export function autoThemeFromCard(img: CanvasImageSource, base: StudioTheme): StudioTheme | null {
  const dom = dominantHue(img);
  if (!dom) return null;
  const { h } = dom;
  // Saturation du décor plafonnée : au-delà, le fond réclame l'attention que
  // la carte devrait avoir.
  const s = Math.min(0.4, 0.18 + dom.s * 0.25);
  return {
    ...base,
    id: AUTO_THEME_ID,
    name: "Accordé à la carte",
    // Du plus sombre en haut au plus clair à l'horizon : la lumière vient du
    // fond de la pièce, comme dans nos autres décors.
    wallTop: hex(hslToRgb(h, s * 0.7, 0.05)),
    wallMid: hex(hslToRgb(h, s * 0.85, 0.11)),
    horizon: hex(hslToRgb(h, s, 0.2)),
    floor: hex(hslToRgb(h, s * 0.6, 0.04)),
    // Le projecteur, lui, garde la teinte vive de la carte : c'est le seul
    // endroit où elle s'exprime franchement.
    spot: hslToRgb(h, Math.min(0.75, dom.s), 0.72).join(","),
    fx: null,
    plate: undefined,
  };
}
