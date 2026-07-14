import type { CardInfo } from "@/lib/render-engine";

export type ScreenName =
  | "home"
  | "source"
  | "camera"
  | "process"
  | "quality"
  | "crop"
  | "verso"
  | "customize"
  | "export";

export type Face = "recto" | "verso";

export const STEP: Partial<Record<ScreenName, 1 | 2 | 3>> = {
  source: 1,
  camera: 1,
  process: 1,
  quality: 1,
  crop: 1,
  verso: 1,
  customize: 2,
  export: 3,
};

export const BACK: Record<ScreenName, ScreenName> = {
  home: "home",
  source: "home",
  camera: "source",
  process: "source",
  quality: "source",
  crop: "quality",
  verso: "crop",
  customize: "verso",
  export: "customize",
};

export const EMPTY_CARD_INFO: CardInfo = {
  name: "",
  number: "",
  price: "",
  rarity: "",
  series: "",
  language: "",
};

export type ExportFormat = "jpg" | "png";
