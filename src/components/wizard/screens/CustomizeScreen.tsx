"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { renderShot, THEMES, MOUNTS, type CardInfo } from "@/lib/render-engine";
import { drawBg } from "@/lib/render-engine/draw-background";
import { demoCard } from "@/lib/wizard/demo-card";
import { buildShotList } from "@/lib/wizard/shot-list";
import { EMPTY_CARD_INFO } from "@/lib/wizard/types";

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
}

function MountPreview({ mountIdx, angle }: { mountIdx: number; angle: -1 | 0 | 1 }) {
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

function ThemeChip({ themeIdx }: { themeIdx: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.width = 208;
    ref.current.height = 130;
    drawBg(ref.current.getContext("2d")!, 208, 130, THEMES[themeIdx], 0.8);
  }, [themeIdx]);
  return <canvas ref={ref} />;
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
}: CustomizeScreenProps) {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [openSection, setOpenSection] = useState<"info" | "logo" | "adv" | null>(null);

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

  return (
    <div className="screen" id="screen-customize">
      <div className="custo-layout">
        <div className="custo-preview">
          <canvas id="mainCanvas" ref={mainCanvasRef} />
          <div className="angle-nav">
            <button className="angle-btn" onClick={() => cycleShot(-1)} aria-label="Angle précédent" type="button">
              <i className="ti ti-chevron-left" />
            </button>
            <span className="angle-label">{currentShot.name}</span>
            <button className="angle-btn" onClick={() => cycleShot(1)} aria-label="Angle suivant" type="button">
              <i className="ti ti-chevron-right" />
            </button>
          </div>
        </div>

        <div className="custo-controls">
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
                <ThemeChip themeIdx={i} />
                <div className="theme-chip-name">{t.name}</div>
              </div>
            ))}
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
              <div className="field-grid" style={{ marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder="Nom (ex : Dracaufeu ex)"
                  value={cardInfo.name}
                  onChange={(e) => onCardInfoChange({ ...cardInfo, name: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="N° (ex : 228/197)"
                  value={cardInfo.number}
                  onChange={(e) => onCardInfoChange({ ...cardInfo, number: e.target.value })}
                />
              </div>
              <div className="field-grid">
                <input
                  type="text"
                  placeholder="Prix (ex : 35 €)"
                  value={cardInfo.price}
                  onChange={(e) => onCardInfoChange({ ...cardInfo, price: e.target.value })}
                />
                <select
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
                  placeholder="Série (ex : Évolutions Prismatiques)"
                  value={cardInfo.series}
                  onChange={(e) => onCardInfoChange({ ...cardInfo, series: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Langue (ex : Français)"
                  value={cardInfo.language}
                  onChange={(e) => onCardInfoChange({ ...cardInfo, language: e.target.value })}
                />
              </div>
            </div>
          </div>

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

          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={onContinue} type="button">
            Voir mes visuels <i className="ti ti-arrow-right" />
          </button>
        </div>
      </div>
    </div>
  );
}
