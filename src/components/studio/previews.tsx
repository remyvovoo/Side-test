"use client";

import { useEffect, useRef } from "react";
import { renderShot, THEMES, MOUNTS } from "@/lib/render-engine";
import { drawBg } from "@/lib/render-engine/draw-background";
import { demoCard } from "@/lib/wizard/demo-card";
import { EMPTY_CARD_INFO } from "@/lib/wizard/types";

/** Vignette d'un présentoir : la carte de démo rendue sur ce support. */
export function MountPreview({ mountIdx, angle }: { mountIdx: number; angle: -1 | 0 | 1 }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    renderShot(ref.current, {
      shot: { face: "recto", angle, name: "" },
      rectoImage: demoCard(),
      versoImage: null,
      mount: MOUNTS[mountIdx],
      theme: THEMES[0],
      reflect: 0.5,
      halo: 0.7,
      logoImage: null,
      logoText: "",
      cardInfo: EMPTY_CARD_INFO,
      size: 300,
    });
  }, [mountIdx, angle]);
  return <canvas ref={ref} />;
}

/** Pastille d'un univers : son fond seul. */
export function ThemeChipPreview({ themeIdx }: { themeIdx: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.width = 208;
    ref.current.height = 130;
    drawBg(ref.current.getContext("2d")!, 208, 130, THEMES[themeIdx], 0.8);
  }, [themeIdx]);
  return <canvas ref={ref} />;
}
