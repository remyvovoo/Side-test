export type Face = "recto" | "verso";

export interface ShotDescriptor {
  face: Face;
  angle: -1 | 0 | 1;
  name: string;
}

export interface StudioTheme {
  id: string;
  name: string;
  wallTop: string;
  wallMid: string;
  horizon: string;
  floor: string;
  /** "r,g,b" spotlight color, used inside rgba() */
  spot: string;
  fx: "stars" | "embers" | "rays" | null;
  /**
   * « Plaque » : URL d'une VRAIE photographie de scène vide utilisée comme
   * décor à la place des dégradés dessinés. C'est le levier réalisme n°1 :
   * une photo sur une photo, plutôt qu'une photo sur un dessin. Les couleurs
   * ci-dessus restent utilisées par les vignettes de choix d'univers et comme
   * décor de repli pendant le chargement de la plaque.
   */
  plate?: string;
  /** Ligne de pose (0..1 de la hauteur) : où repose le bas de la carte sur la plaque. */
  plateGround?: number;
}

export type MountId = "stand" | "case";

export interface Mount {
  id: MountId;
  name: string;
  sub: string;
}

export interface CardInfo {
  name: string;
  number: string;
  price: string;
  rarity: string;
  series: string;
  language: string;
  /** État de la carte (Near Mint, Excellent…) — alimente le modèle d'annonce. */
  condition: string;
}

/**
 * Everything needed to produce one image. This is the "recipe" that today
 * the Canvas engine turns into a picture in the browser, and that a future
 * Blender engine will turn into a picture on a render server. Screens only
 * ever build one of these — they never call drawing code directly.
 */
export interface RenderRequest {
  shot: ShotDescriptor;
  rectoImage: CanvasImageSource | null;
  versoImage: CanvasImageSource | null;
  mount: Mount;
  theme: StudioTheme;
  /** 0..1 */
  reflect: number;
  /** 0..1 */
  halo: number;
  logoImage: CanvasImageSource | null;
  logoText: string;
  /**
   * Placement du logo VENDEUR sur le mur : centre du bloc en fraction du
   * cadre, et facteur de taille. Sans logo vendeur, c'est le filigrane
   * Cardshot qui s'affiche en bas à droite et ces valeurs ne servent pas.
   */
  logoPos?: { x: number; y: number };
  logoScale?: number;
  cardInfo: CardInfo;
  size: number;
}

/** A render engine takes a request and draws it onto a canvas it is given. */
export interface RenderEngine {
  renderShot(canvas: HTMLCanvasElement, request: RenderRequest): void;
}
