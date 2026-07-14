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
  cardInfo: CardInfo;
  size: number;
}

/** A render engine takes a request and draws it onto a canvas it is given. */
export interface RenderEngine {
  renderShot(canvas: HTMLCanvasElement, request: RenderRequest): void;
}
