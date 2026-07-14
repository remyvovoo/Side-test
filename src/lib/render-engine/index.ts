import { renderShot } from "./render-shot";
import type { RenderEngine } from "./types";

export * from "./types";
export { THEMES } from "./themes";
export { MOUNTS } from "./mounts";
export { renderShot } from "./render-shot";

/**
 * Today's engine: draws directly on a canvas in the browser. A future
 * Blender engine implements the same `RenderEngine` interface — screens
 * depend on the interface, never on this specific implementation.
 */
export const canvasRenderEngine: RenderEngine = { renderShot };
