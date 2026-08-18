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
      // Toujours un univers DESSINÉ ici : en mode plaque, le socle n'est pas
      // dessiné (la scène est déjà dans la photo) — or cette vignette sert
      // précisément à montrer le support.
      theme: THEMES.find((t) => !t.plate) ?? THEMES[0],
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

/** Pastille d'un univers : sa photo de scène s'il en a une, sinon son fond dessiné. */
export function ThemeChipPreview({ themeIdx }: { themeIdx: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = 208;
    canvas.height = 130;
    const ctx = canvas.getContext("2d")!;
    const theme = THEMES[themeIdx];
    // Fond dessiné tout de suite (et en repli le temps du chargement)…
    drawBg(ctx, 208, 130, theme, 0.8);
    if (!theme.plate) return;
    // …puis la vraie photo de la scène, rognée en « cover ».
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const s = Math.max(208 / img.naturalWidth, 130 / img.naturalHeight);
      const dw = img.naturalWidth * s;
      const dh = img.naturalHeight * s;
      ctx.drawImage(img, (208 - dw) / 2, (130 - dh) / 2, dw, dh);
    };
    img.src = theme.plate;
    return () => {
      cancelled = true;
    };
  }, [themeIdx]);
  return <canvas ref={ref} />;
}
