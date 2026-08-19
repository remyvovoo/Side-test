import type { StudioTheme } from "./types";

/**
 * Studio lighting presets. Today this data drives the Canvas engine below;
 * later, the same ids/names will map to Blender scenes built by the 3D
 * artist, so this list is the seed of the future "Studio" asset table.
 */
export const THEMES: StudioTheme[] = [
  // ESSAI — décor fabriqué à partir de la carte elle-même (voir auto-theme.ts).
  // Les couleurs ci-dessous ne servent qu'à la vignette de choix : au rendu,
  // renderShot les remplace par celles dérivées de la carte affichée.
  {
    id: "auto",
    name: "Accordé à la carte",
    wallTop: "#0a0810",
    wallMid: "#1a1526",
    horizon: "#332a44",
    floor: "#060409",
    spot: "190,170,240",
    fx: null,
  },
  // Premier univers sur photographie réelle : scène vide tirée de la photo de
  // Remy « support acrylique sur fond noir » (droits confirmés par lui le
  // 18 août 2026 — c'est sa propre photo). Carte, support et mention légale
  // effacés par retouche ; la vraie brillance du sol vient de la photo.
  {
    id: "studio-noir-photo",
    name: "Studio Photo",
    wallTop: "#0a0a0c",
    wallMid: "#131316",
    horizon: "#2a2a2e",
    floor: "#050506",
    spot: "215,220,235",
    fx: null,
    plate: "/studio-plates/noir-acrylique.jpg",
    plateGround: 0.79,
  },
  { id: "studio-noir", name: "Studio Noir", wallTop: "#08080d", wallMid: "#12121c", horizon: "#1e1e2a", floor: "#040407", spot: "205,215,240", fx: null },
  { id: "brasier-eternel", name: "Brasier Éternel", wallTop: "#160402", wallMid: "#4e1400", horizon: "#a03c0c", floor: "#0e0301", spot: "255,150,70", fx: "embers" },
  { id: "abysses-profondes", name: "Abysses Profondes", wallTop: "#01080f", wallMid: "#062244", horizon: "#0f5490", floor: "#010a14", spot: "110,200,255", fx: null },
  { id: "eveil-psychique", name: "Éveil Psychique", wallTop: "#0a0014", wallMid: "#2c0658", horizon: "#6c22a8", floor: "#08040f", spot: "200,130,255", fx: null },
  { id: "foudre-sauvage", name: "Foudre Sauvage", wallTop: "#100c00", wallMid: "#443600", horizon: "#9a7c00", floor: "#0b0802", spot: "255,225,90", fx: null },
  { id: "nuit-etoilee", name: "Nuit Étoilée", wallTop: "#02030a", wallMid: "#0c1228", horizon: "#1e2f5c", floor: "#02030a", spot: "170,190,255", fx: "stars" },
  { id: "jungle-ancestrale", name: "Jungle Ancestrale", wallTop: "#030c00", wallMid: "#123006", horizon: "#316016", floor: "#030b02", spot: "150,230,90", fx: null },
  { id: "aube-legendaire", name: "Aube Légendaire", wallTop: "#120702", wallMid: "#5c3006", horizon: "#b87c24", floor: "#100804", spot: "255,215,130", fx: "rays" },
];
