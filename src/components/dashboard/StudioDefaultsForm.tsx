"use client";

import { useEffect, useRef, useState } from "react";
import { renderShot, THEMES, MOUNTS } from "@/lib/render-engine";
import { getCardBox } from "@/lib/render-engine/render-shot";
import { wallLogoRect, clampLogoPos, logoAspectOf } from "@/lib/render-engine/draw-overlays";
import { demoCard } from "@/lib/wizard/demo-card";
import { loadImage } from "@/lib/wizard/image-utils";
import { EMPTY_CARD_INFO } from "@/lib/wizard/types";
import { MountPreview, ThemeChipPreview } from "@/components/studio/previews";

export interface StudioDefaults {
  themeId: string | null;
  mountId: string | null;
  reflect: number;
  halo: number;
  logoText: string;
  logoImage: string; // data URL, vide = logo Cardshot
  logoX: number;
  logoY: number;
  logoScale: number;
}

export function StudioDefaultsForm({ initial }: { initial: StudioDefaults }) {
  const [themeIndex, setThemeIndex] = useState(() => {
    const i = THEMES.findIndex((t) => t.id === initial.themeId);
    return i >= 0 ? i : 0;
  });
  const [mountIndex, setMountIndex] = useState(() => {
    const i = MOUNTS.findIndex((m) => m.id === initial.mountId);
    return i >= 0 ? i : 0;
  });
  const [reflect, setReflect] = useState(initial.reflect);
  const [halo, setHalo] = useState(initial.halo);
  const [logoText, setLogoText] = useState(initial.logoText);
  const [logoDataUrl, setLogoDataUrl] = useState(initial.logoImage);
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  const [logoPos, setLogoPos] = useState({ x: initial.logoX, y: initial.logoY });
  const [logoScale, setLogoScale] = useState(initial.logoScale);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  const previewRef = useRef<HTMLCanvasElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Le logo importé (data URL) devient une image utilisable par le moteur.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const img = logoDataUrl ? await loadImage(logoDataUrl) : null;
      if (!cancelled) setLogoImage(img);
    })();
    return () => {
      cancelled = true;
    };
  }, [logoDataUrl]);

  useEffect(() => {
    if (!previewRef.current) return;
    renderShot(previewRef.current, {
      shot: { face: "recto", angle: 0, name: "" },
      rectoImage: demoCard(),
      versoImage: null,
      mount: MOUNTS[mountIndex],
      theme: THEMES[themeIndex],
      reflect,
      halo,
      logoImage,
      logoText,
      logoPos,
      logoScale,
      cardInfo: EMPTY_CARD_INFO,
      size: 640,
    });
    // Cadre de sélection — APERÇU SEULEMENT. Ce canvas ne part jamais à
    // l'export : il sert à faire comprendre que le logo s'attrape et se
    // redimensionne, comme le fait CarBox avec ses poignées.
    if (!logoImage && !logoText) return;
    const c = previewRef.current;
    const g = c.getContext("2d")!;
    const b = wallLogoRect(c.width, c.height, logoImage ? logoAspectOf(logoImage) : 0, logoText, logoPos, logoScale);
    const pad = 8;
    g.save();
    g.strokeStyle = "#a78bfa";
    g.lineWidth = 1.5;
    g.setLineDash([5, 4]);
    g.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
    g.setLineDash([]);
    g.fillStyle = "#a78bfa";
    for (const [hx, hy] of [
      [b.x - pad, b.y - pad],
      [b.x + b.w + pad, b.y - pad],
      [b.x - pad, b.y + b.h + pad],
      [b.x + b.w + pad, b.y + b.h + pad],
    ]) {
      g.beginPath();
      g.arc(hx, hy, 5, 0, 7);
      g.fill();
    }
    g.restore();
  }, [themeIndex, mountIndex, reflect, halo, logoImage, logoText, logoPos, logoScale]);

  /**
   * Déplacement et redimensionnement du logo directement dans l'aperçu, à la
   * façon de CarBox : on attrape le bloc pour le déplacer, sa poignée en bas
   * à droite pour l'agrandir. Sans logo vendeur, il n'y a rien à manipuler —
   * le filigrane Cardshot a une place fixe, en bas à droite.
   */
  const hasSellerLogo = !!logoImage || !!logoText;
  const dragRef = useRef<{ mode: "move" | "resize"; dx: number; dy: number; scale0: number; d0: number } | null>(null);

  /** Coordonnées du pointeur dans le repère du canvas (et non de l'écran). */
  function toCanvas(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!hasSellerLogo) return;
    const c = e.currentTarget;
    const p = toCanvas(e);
    const box = wallLogoRect(c.width, c.height, logoImage ? logoAspectOf(logoImage) : 0, logoText, logoPos, logoScale);
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const grab = Math.max(18, box.h * 0.45);
    const onHandle = Math.hypot(p.x - (box.x + box.w), p.y - (box.y + box.h)) <= grab;
    const inside = p.x >= box.x - grab && p.x <= box.x + box.w + grab && p.y >= box.y - grab && p.y <= box.y + box.h + grab;
    if (!onHandle && !inside) return;
    c.setPointerCapture(e.pointerId);
    dragRef.current = onHandle
      ? { mode: "resize", dx: 0, dy: 0, scale0: logoScale, d0: Math.max(1, Math.hypot(p.x - cx, p.y - cy)) }
      : { mode: "move", dx: p.x - cx, dy: p.y - cy, scale0: logoScale, d0: 1 };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const g = dragRef.current;
    if (!g) return;
    const c = e.currentTarget;
    const p = toCanvas(e);
    if (g.mode === "move") {
      // Placement libre, sauf sur la carte et sa bordure de respect.
      const box = wallLogoRect(c.width, c.height, logoImage ? logoAspectOf(logoImage) : 0, logoText, logoPos, logoScale);
      setLogoPos(
        clampLogoPos(
          { x: (p.x - g.dx) / c.width, y: (p.y - g.dy) / c.height },
          { w: box.w / c.width, h: box.h / c.height },
          getCardBox(c)
        )
      );
    } else {
      const box = wallLogoRect(c.width, c.height, logoImage ? logoAspectOf(logoImage) : 0, logoText, logoPos, logoScale);
      const d = Math.hypot(p.x - (box.x + box.w / 2), p.y - (box.y + box.h / 2));
      setLogoScale(Math.min(3, Math.max(0.3, (g.scale0 * d) / g.d0)));
    }
  }

  function endDrag() {
    dragRef.current = null;
  }

  function handleLogoFile(file: File | null) {
    if (!file) return;
    // Le logo est ré-échantillonné à 600 px de côté au plus. C'était 200 px,
    // ce qui suffisait à la pastille d'origine mais pixelisait dès qu'on
    // agrandissait le logo mural (signalé par Remy). Le PNG conserve la
    // transparence ; à terme ces fichiers iront dans Vercel Blob plutôt que
    // dans une colonne de la base.
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 600;
      const s = Math.min(MAX / img.width, MAX / img.height, 1);
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * s));
      c.height = Math.max(1, Math.round(img.height * s));
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      // Un logo importé REMPLACE le nom de boutique : on n'affiche jamais les
      // deux (même règle que pour le filigrane Cardshot).
      setLogoDataUrl(c.toDataURL("image/png"));
      setLogoText("");
    };
    img.src = url;
  }

  async function handleSave() {
    setSaving(true);
    setError(false);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultThemeId: THEMES[themeIndex].id,
          defaultMountId: MOUNTS[mountIndex].id,
          defaultReflect: reflect,
          defaultHalo: halo,
          defaultLogoText: logoText,
          defaultLogoImage: logoDataUrl,
          defaultLogoX: logoPos.x,
          defaultLogoY: logoPos.y,
          defaultLogoScale: logoScale,
        }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dash-studio">
      <div className="dash-studio-preview">
        <canvas
          ref={previewRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{ touchAction: hasSellerLogo ? "none" : undefined, cursor: hasSellerLogo ? "move" : undefined }}
        />
        <span className="dash-studio-preview-note">
          {hasSellerLogo
            ? "Glisse ton logo pour le placer, tire son coin bas droit pour l’agrandir."
            : "Aperçu en direct avec la carte de démonstration"}
        </span>
      </div>

      <div className="dash-studio-controls">
        <div className="dash-panel">
          <div className="dash-panel-head">
            <b>Présentoir</b>
          </div>
          <div className="opt-grid">
            {MOUNTS.map((m, i) => (
              <button
                key={m.id}
                type="button"
                className={`opt-card${mountIndex === i ? " selected" : ""}`}
                onClick={() => setMountIndex(i)}
              >
                <MountPreview mountIdx={i} angle={i === 0 ? 0 : 1} />
                <b>{m.name}</b>
                <span>{m.sub}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="dash-panel">
          <div className="dash-panel-head">
            <b>Univers</b>
          </div>
          <div className="themes-scroll">
            {THEMES.map((t, i) => (
              <button
                key={t.id}
                type="button"
                className={`theme-chip${themeIndex === i ? " selected" : ""}`}
                onClick={() => setThemeIndex(i)}
              >
                <ThemeChipPreview themeIdx={i} />
                <div className="theme-chip-name">{t.name}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="dash-panel">
          <div className="dash-panel-head">
            <b>Mon logo</b>
            <span>Affiché discrètement sur chaque visuel.</span>
          </div>
          <div className="logo-row">
            <div className="logo-preview">
              {logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- aperçu d'un data URL choisi par l'utilisateur
                <img src={logoDataUrl} alt="Logo" />
              ) : (
                <span className="dflt">CS</span>
              )}
            </div>
            <div className="logo-btns">
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => logoInputRef.current?.click()} type="button">
                <i className="ti ti-upload" /> Importer
              </button>
              <button
                className="btn btn-ghost btn-sm"
                style={{ flex: 1 }}
                onClick={() => {
                  // Retirer son logo rend sa place au filigrane Cardshot, en
                  // bas à droite — et remet le placement à zéro pour le jour
                  // où un autre logo sera importé.
                  setLogoDataUrl("");
                  setLogoText("");
                  setLogoPos({ x: 0.5, y: 0.14 });
                  setLogoScale(1);
                }}
                type="button"
                disabled={!logoDataUrl && !logoText}
              >
                <i className="ti ti-trash" /> Retirer mon logo
              </button>
            </div>
          </div>
          <p className="logo-hint">
            Un PNG à fond transparent donne le meilleur résultat : le logo épouse le mur au lieu
            d&apos;apparaître dans un rectangle.
          </p>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              handleLogoFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          {/* Le nom de boutique est l'ALTERNATIVE au logo, pas son complément :
              il ne sert que si rien n'a été importé. */}
          <input
            type="text"
            placeholder={logoDataUrl ? "Remplacé par ton logo" : "Nom affiché (ex : Ma Boutique)"}
            value={logoText}
            onChange={(e) => setLogoText(e.target.value)}
            maxLength={40}
            disabled={!!logoDataUrl}
          />
        </div>

        <div className="dash-panel">
          <div className="dash-panel-head">
            <b>Lumière</b>
          </div>
          <div className="slider-row" style={{ width: "100%" }}>
            <div className="slider-head">
              <span>Reflet au sol</span>
              <span>{Math.round(reflect * 100)}%</span>
            </div>
            <input type="range" min={0} max={100} value={Math.round(reflect * 100)} onChange={(e) => setReflect(parseInt(e.target.value, 10) / 100)} />
          </div>
          <div className="slider-row" style={{ width: "100%" }}>
            <div className="slider-head">
              <span>Éclairage</span>
              <span>{Math.round(halo * 100)}%</span>
            </div>
            <input type="range" min={0} max={100} value={Math.round(halo * 100)} onChange={(e) => setHalo(parseInt(e.target.value, 10) / 100)} />
          </div>
        </div>

        {error && <div className="auth-error">L&apos;enregistrement a échoué, réessaie.</div>}
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} type="button">
          <i className={`ti ${saved ? "ti-check" : "ti-device-floppy"}`} />{" "}
          {saving ? "Enregistrement…" : saved ? "Enregistré" : "Enregistrer mon studio"}
        </button>
      </div>
    </div>
  );
}
