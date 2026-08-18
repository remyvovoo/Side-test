"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { renderShot, THEMES, MOUNTS, type CardInfo } from "@/lib/render-engine";
import { buildShotList } from "@/lib/wizard/shot-list";
import { CARD_CONDITIONS } from "@/lib/wizard/types";
import { MountPreview, ThemeChipPreview } from "@/components/studio/previews";

interface CustomizeScreenProps {
  rectoImage: HTMLImageElement;
  versoImage: HTMLImageElement | null;
  mountIndex: number;
  themeIndex: number;
  reflect: number;
  halo: number;
  logoImage: HTMLImageElement | null;
  logoText: string;
  cardInfo: CardInfo;
  shotIndex: number;
  onMountChange: (i: number) => void;
  onThemeChange: (i: number) => void;
  onReflectChange: (v: number) => void;
  onHaloChange: (v: number) => void;
  onLogoImageChange: (img: HTMLImageElement | null) => void;
  onLogoTextChange: (v: string) => void;
  onCardInfoChange: (info: CardInfo) => void;
  onShotIndexChange: (i: number) => void;
  onContinue: () => void;
  /** Mode espace connecté : le studio est un aperçu, les réglages sont derrière « Ajuster ». */
  compact?: boolean;
  onSaveAsDefaults?: () => void;
  /** Identification des infos par l'IA (absente si non disponible). */
  aiStatus?: "idle" | "running" | "done" | "error";
  aiMessage?: string;
  onRunAi?: () => void;
}

export function CustomizeScreen({
  rectoImage,
  versoImage,
  mountIndex,
  themeIndex,
  reflect,
  halo,
  logoImage,
  logoText,
  cardInfo,
  shotIndex,
  onMountChange,
  onThemeChange,
  onReflectChange,
  onHaloChange,
  onLogoImageChange,
  onLogoTextChange,
  onCardInfoChange,
  onShotIndexChange,
  onContinue,
  compact = false,
  onSaveAsDefaults,
  aiStatus = "idle",
  aiMessage = "",
  onRunAi,
}: CustomizeScreenProps) {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [openSection, setOpenSection] = useState<"info" | "logo" | "adv" | null>(compact ? "info" : null);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const shots = useMemo(() => buildShotList(!!versoImage), [versoImage]);
  const currentShotIndex = shotIndex >= shots.length ? 0 : shotIndex;
  const currentShot = shots[currentShotIndex];

  useEffect(() => {
    if (!mainCanvasRef.current) return;
    renderShot(mainCanvasRef.current, {
      shot: currentShot,
      rectoImage,
      versoImage,
      mount: MOUNTS[mountIndex],
      theme: THEMES[themeIndex],
      reflect,
      halo,
      logoImage,
      logoText,
      cardInfo,
      size: 1000,
    });
  }, [currentShot, rectoImage, versoImage, mountIndex, themeIndex, reflect, halo, logoImage, logoText, cardInfo]);

  function cycleShot(dir: number) {
    const n = shots.length;
    onShotIndexChange((currentShotIndex + dir + n) % n);
  }

  function handleLogoFile(file: File | null) {
    if (!file) return;
    const img = new Image();
    img.onload = () => onLogoImageChange(img);
    img.src = URL.createObjectURL(file);
  }

  /** Un champ ne « respire » que si l'IA tourne et qu'il n'a pas déjà de valeur. */
  function aiTargetClass(value: string): string | undefined {
    return aiStatus === "running" && !value.trim() ? "cs-ai-target" : undefined;
  }

  return (
    <div className="screen" id="screen-customize">
      <div className="custo-layout">
        <div className="custo-preview">
          <div className="cs-canvas-wrap">
            <canvas id="mainCanvas" ref={mainCanvasRef} />
            {aiStatus === "running" && (
              <div className="cs-ai-scan" aria-hidden="true">
                <div className="cs-ai-scan-line" />
                <span className="cs-ai-scan-label">
                  <i className="ti ti-sparkles" /> Identification de la carte…
                </span>
              </div>
            )}
          </div>
          <div className="angle-nav">
            {shots.length > 1 && (
              <button className="angle-btn" onClick={() => cycleShot(-1)} aria-label="Vue précédente" type="button">
                <i className="ti ti-chevron-left" />
              </button>
            )}
            <span className="angle-label">{currentShot.name}</span>
            {shots.length > 1 && (
              <button className="angle-btn" onClick={() => cycleShot(1)} aria-label="Vue suivante" type="button">
                <i className="ti ti-chevron-right" />
              </button>
            )}
          </div>
        </div>

        <div className="custo-controls">
          <div className={compact && !adjustOpen ? "cs-hidden" : undefined}>
          <span className="section-label">Présentoir</span>
          <div className="opt-grid">
            {MOUNTS.map((m, i) => (
              <div
                key={m.id}
                className={`opt-card${mountIndex === i ? " selected" : ""}`}
                onClick={() => onMountChange(i)}
              >
                <MountPreview mountIdx={i} angle={i === 0 ? 0 : 1} />
                <b>{m.name}</b>
                <span>{m.sub}</span>
              </div>
            ))}
          </div>

          <span className="section-label" style={{ marginTop: "1rem" }}>
            Univers
          </span>
          <div className="themes-scroll">
            {THEMES.map((t, i) => (
              <div
                key={t.id}
                className={`theme-chip${themeIndex === i ? " selected" : ""}`}
                onClick={() => onThemeChange(i)}
              >
                <ThemeChipPreview themeIdx={i} />
                <div className="theme-chip-name">{t.name}</div>
              </div>
            ))}
          </div>
          </div>

          <div className={`cs-collapse${openSection === "info" ? " open" : ""}`}>
            <div className="cs-collapse-head" onClick={() => setOpenSection(openSection === "info" ? null : "info")}>
              <span>
                <i className="ti ti-tag" style={{ fontSize: 14, marginRight: 6 }} />
                Infos de ma carte
              </span>
              <i className="ti ti-chevron-down chev" />
            </div>
            <div className="cs-collapse-body">
              {onRunAi && (
                <div className={`cs-ai-row cs-ai-${aiStatus}`}>
                  {aiStatus === "running" ? (
                    <>
                      <span className="cs-ai-spin" aria-hidden="true" />
                      <span>Lecture de la carte par l&apos;IA…</span>
                    </>
                  ) : (
                    <>
                      <i className={`ti ${aiStatus === "error" ? "ti-alert-triangle" : "ti-sparkles"}`} />
                      <span>{aiMessage || "Laisse l'IA lire le nom, le numéro et la série sur ta photo."}</span>
                      <button className="cs-ai-btn" onClick={onRunAi} type="button">
                        {aiStatus === "idle" ? "Identifier" : "Relancer"}
                      </button>
                    </>
                  )}
                </div>
              )}
              <div className="field-grid" style={{ marginBottom: 8 }}>
                <input
                  type="text"
                  className={aiTargetClass(cardInfo.name)}
                  placeholder="Nom (ex : Dracaufeu ex)"
                  value={cardInfo.name}
                  onChange={(e) => onCardInfoChange({ ...cardInfo, name: e.target.value })}
                />
                <input
                  type="text"
                  className={aiTargetClass(cardInfo.number)}
                  placeholder="N° (ex : 228/197)"
                  value={cardInfo.number}
                  onChange={(e) => onCardInfoChange({ ...cardInfo, number: e.target.value })}
                />
              </div>
              <div className="field-grid">
                <div className="field-suffix">
                  <input
                    type="text"
                    placeholder="Prix (ex : 35)"
                    value={cardInfo.price}
                    onChange={(e) => onCardInfoChange({ ...cardInfo, price: e.target.value })}
                  />
                </div>
                <select
                  className={aiTargetClass(cardInfo.rarity)}
                  value={cardInfo.rarity}
                  onChange={(e) => onCardInfoChange({ ...cardInfo, rarity: e.target.value })}
                >
                  <option value="">Rareté</option>
                  <option value="✦ Hors-série">✦ Hors-série</option>
                  <option value="★★★ SAR">★★★ SAR</option>
                  <option value="★★ Ultra Rare">★★ Ultra Rare</option>
                  <option value="★ Rare">★ Rare</option>
                  <option value="⬡ Promo">⬡ Promo</option>
                  <option value="◆◆ Peu commune">◆◆ Peu commune</option>
                  <option value="◆ Commune">◆ Commune</option>
                </select>
              </div>
              <div className="field-grid" style={{ marginTop: 8 }}>
                <input
                  type="text"
                  className={aiTargetClass(cardInfo.series)}
                  placeholder="Série (ex : Évolutions Prismatiques)"
                  value={cardInfo.series}
                  onChange={(e) => onCardInfoChange({ ...cardInfo, series: e.target.value })}
                />
                <input
                  type="text"
                  className={aiTargetClass(cardInfo.language)}
                  placeholder="Langue (ex : Français)"
                  value={cardInfo.language}
                  onChange={(e) => onCardInfoChange({ ...cardInfo, language: e.target.value })}
                />
              </div>
              <div className="field-grid" style={{ marginTop: 8 }}>
                <select
                  value={cardInfo.condition}
                  onChange={(e) => onCardInfoChange({ ...cardInfo, condition: e.target.value })}
                >
                  <option value="">État de la carte</option>
                  {CARD_CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {compact && (
            <button
              className="btn btn-ghost btn-sm cs-adjust-toggle"
              onClick={() => setAdjustOpen((o) => !o)}
              type="button"
            >
              <i className={`ti ${adjustOpen ? "ti-chevron-up" : "ti-adjustments"}`} />{" "}
              {adjustOpen ? "Masquer les réglages du studio" : "Ajuster le studio"}
            </button>
          )}

          <div className={compact && !adjustOpen ? "cs-hidden" : undefined}>
          <div className={`cs-collapse${openSection === "logo" ? " open" : ""}`}>
            <div className="cs-collapse-head" onClick={() => setOpenSection(openSection === "logo" ? null : "logo")}>
              <span>
                <i className="ti ti-photo-star" style={{ fontSize: 14, marginRight: 6 }} />
                Mon logo
              </span>
              <i className="ti ti-chevron-down chev" />
            </div>
            <div className="cs-collapse-body">
              <div className="logo-row">
                <div className="logo-preview">
                  {logoImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- previewing a user-picked blob, not a static asset
                    <img src={logoImage.src} alt="Logo" />
                  ) : (
                    <span className="dflt">CS</span>
                  )}
                </div>
                <div className="logo-btns">
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => logoInputRef.current?.click()}
                    type="button"
                  >
                    <i className="ti ti-upload" /> Importer
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => {
                      onLogoImageChange(null);
                      onLogoTextChange("");
                    }}
                    type="button"
                  >
                    <i className="ti ti-restore" /> Défaut
                  </button>
                </div>
              </div>
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
              <input
                type="text"
                placeholder="Nom affiché (ex : Ma Boutique)"
                value={logoText}
                onChange={(e) => onLogoTextChange(e.target.value)}
                style={{ marginTop: 8 }}
              />
            </div>
          </div>

          <div className={`cs-collapse${openSection === "adv" ? " open" : ""}`}>
            <div className="cs-collapse-head" onClick={() => setOpenSection(openSection === "adv" ? null : "adv")}>
              <span>
                <i className="ti ti-adjustments" style={{ fontSize: 14, marginRight: 6 }} />
                Réglages avancés
              </span>
              <i className="ti ti-chevron-down chev" />
            </div>
            <div className="cs-collapse-body">
              <div className="slider-row">
                <div className="slider-head">
                  <span>Reflet au sol</span>
                  <span>{Math.round(reflect * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(reflect * 100)}
                  onChange={(e) => onReflectChange(parseInt(e.target.value, 10) / 100)}
                />
              </div>
              <div className="slider-row">
                <div className="slider-head">
                  <span>Éclairage</span>
                  <span>{Math.round(halo * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(halo * 100)}
                  onChange={(e) => onHaloChange(parseInt(e.target.value, 10) / 100)}
                />
              </div>
            </div>
          </div>

          {compact && onSaveAsDefaults && (
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={onSaveAsDefaults} type="button">
              <i className="ti ti-star" /> Définir comme mes réglages par défaut
            </button>
          )}
          </div>

          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={onContinue} type="button">
            Voir mes visuels <i className="ti ti-arrow-right" />
          </button>
        </div>
      </div>
    </div>
  );
}
