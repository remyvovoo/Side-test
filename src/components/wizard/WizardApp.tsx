"use client";

import { useRef, useState } from "react";
import { TopBar } from "./TopBar";
import { StepsBar } from "./StepsBar";
import { Toast } from "./Toast";
import { GuideModal } from "./GuideModal";
import { EmailModal } from "./EmailModal";
import { HomeScreen } from "./screens/HomeScreen";
import { SourceScreen } from "./screens/SourceScreen";
import { CameraScreen } from "./screens/CameraScreen";
import { ProcessScreen } from "./screens/ProcessScreen";
import { QualityScreen } from "./screens/QualityScreen";
import { CropScreen } from "./screens/CropScreen";
import { VersoScreen } from "./screens/VersoScreen";
import { CustomizeScreen } from "./screens/CustomizeScreen";
import { ExportScreen } from "./screens/ExportScreen";
import { THEMES, MOUNTS, type RenderRequest } from "@/lib/render-engine";
import { STEP, BACK, EMPTY_CARD_INFO, type ScreenName, type Face, type ExportFormat } from "@/lib/wizard/types";
import { downloadShots } from "@/lib/wizard/export-shots";
import { buildShotList } from "@/lib/wizard/shot-list";
import type { QualityResult } from "@/lib/quality/types";

type GuideTarget = "camera" | "gallery" | "tips";

export function WizardApp() {
  const [screen, setScreen] = useState<ScreenName>("home");
  const [face, setFace] = useState<Face>("recto");

  const [rectoImage, setRectoImage] = useState<HTMLImageElement | null>(null);
  const [versoImage, setVersoImage] = useState<HTMLImageElement | null>(null);
  const [pendingImage, setPendingImage] = useState<HTMLImageElement | null>(null);

  const [mountIndex, setMountIndex] = useState(0);
  const [themeIndex, setThemeIndex] = useState(0);
  const [reflect, setReflect] = useState(0.5);
  const [halo, setHalo] = useState(0.7);
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  const [logoText, setLogoText] = useState("");
  const [cardInfo, setCardInfo] = useState(EMPTY_CARD_INFO);
  const [shotIndex, setShotIndex] = useState(0);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [format, setFormat] = useState<ExportFormat>("jpg");

  const [sourceBlob, setSourceBlob] = useState<Blob | null>(null);
  const [quality, setQuality] = useState<QualityResult | null>(null);

  const [guideOpen, setGuideOpen] = useState(false);
  const [guideTarget, setGuideTarget] = useState<GuideTarget | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string) {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2600);
  }

  function go(next: ScreenName) {
    setScreen(next);
  }
  function goBack() {
    go(BACK[screen]);
  }

  function startFlow() {
    setFace("recto");
    go("source");
  }
  function startVerso() {
    setFace("verso");
    go("source");
  }
  function restartFlow() {
    setRectoImage(null);
    setVersoImage(null);
    setPendingImage(null);
    setShotIndex(0);
    setSelected({});
    setCardInfo(EMPTY_CARD_INFO);
    startFlow();
  }

  // ----- Source / guide -----
  function launchSource(target: GuideTarget) {
    if (target === "camera") go("camera");
    else if (target === "gallery") fileInputRef.current?.click();
  }

  function openGuide(target: GuideTarget) {
    let skip = false;
    try {
      skip = localStorage.getItem("cs_skip_guide") === "1";
    } catch {}
    if (skip && target !== "tips") {
      launchSource(target);
      return;
    }
    setGuideTarget(target);
    setGuideOpen(true);
  }

  function handleGuideProceed(skipNextTime: boolean) {
    if (skipNextTime) {
      try {
        localStorage.setItem("cs_skip_guide", "1");
      } catch {}
    }
    setGuideOpen(false);
    if (guideTarget && guideTarget !== "tips") launchSource(guideTarget);
  }
  function handleGuideClose(skipNextTime: boolean) {
    if (skipNextTime) {
      try {
        localStorage.setItem("cs_skip_guide", "1");
      } catch {}
    }
    setGuideOpen(false);
  }

  function handleFileChosen(file: File | null) {
    if (!file) return;
    setSourceBlob(file);
    go("process");
  }

  function handleCameraCapture(blob: Blob) {
    setSourceBlob(blob);
    go("process");
  }
  function handleCameraUnavailable() {
    showToast("Caméra indisponible");
    go("source");
    setTimeout(() => fileInputRef.current?.click(), 300);
  }

  function handleProcessComplete(cutoutImage: HTMLImageElement, q: QualityResult) {
    setPendingImage(cutoutImage);
    setQuality(q);
    go("quality");
  }

  function handleCropApply(result: HTMLImageElement) {
    if (face === "recto") {
      setRectoImage(result);
      go("verso");
    } else {
      setVersoImage(result);
      setShotIndex(0);
      go("customize");
    }
    setPendingImage(null);
  }

  // ----- Export -----
  function buildBaseRequest(): Omit<RenderRequest, "shot" | "size"> {
    return {
      rectoImage,
      versoImage,
      mount: MOUNTS[mountIndex],
      theme: THEMES[themeIndex],
      reflect,
      halo,
      logoImage,
      logoText,
      cardInfo,
    };
  }

  function performDownload() {
    const shots = buildShotList(!!versoImage).filter((_shot, i) => selected[i]);
    if (!shots.length) return;
    showToast(`Téléchargement de ${shots.length} visuel${shots.length > 1 ? "s" : ""}`);
    downloadShots({ shots, baseRequest: buildBaseRequest(), baseName: cardInfo.name || "carte", format });
  }

  function handleDownloadClick() {
    let done = false;
    try {
      done = localStorage.getItem("cs_email_done") === "1";
    } catch {}
    if (done) performDownload();
    else setEmailModalOpen(true);
  }
  function handleEmailSubmit(email: string) {
    fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    try {
      localStorage.setItem("cs_email_done", "1");
    } catch {}
    setEmailModalOpen(false);
    performDownload();
  }
  function handleEmailSkip() {
    try {
      localStorage.setItem("cs_email_done", "1");
    } catch {}
    setEmailModalOpen(false);
    performDownload();
  }

  const step = STEP[screen];
  const isWide = screen === "customize" || screen === "export";

  return (
    <div className={`app${isWide ? " wide" : ""}`}>
      <TopBar showBack={screen !== "home"} onBack={goBack} onBrandClick={() => go("home")} />
      <StepsBar step={step} />

      {screen === "home" && <HomeScreen onStart={startFlow} />}

      {screen === "source" && <SourceScreen face={face} onOpenGuide={openGuide} />}

      {screen === "camera" && (
        <CameraScreen
          face={face}
          onCapture={handleCameraCapture}
          onClose={() => go("source")}
          onUnavailable={handleCameraUnavailable}
        />
      )}

      {screen === "process" && sourceBlob && (
        <ProcessScreen sourceBlob={sourceBlob} onComplete={handleProcessComplete} onRetake={() => go("source")} />
      )}

      {screen === "quality" && quality && (
        <QualityScreen quality={quality} onContinue={() => go("crop")} onRetake={() => go("source")} />
      )}

      {screen === "crop" && pendingImage && (
        <CropScreen
          image={pendingImage}
          title={face === "recto" ? "Vérifie le découpage" : "Vérifie le verso"}
          onApply={handleCropApply}
          onRetake={() => go("source")}
        />
      )}

      {screen === "verso" && <VersoScreen onAddVerso={startVerso} onSkip={() => go("customize")} />}

      {screen === "customize" && rectoImage && (
        <CustomizeScreen
          rectoImage={rectoImage}
          versoImage={versoImage}
          mountIndex={mountIndex}
          themeIndex={themeIndex}
          reflect={reflect}
          halo={halo}
          logoImage={logoImage}
          logoText={logoText}
          cardInfo={cardInfo}
          shotIndex={shotIndex}
          onMountChange={setMountIndex}
          onThemeChange={setThemeIndex}
          onReflectChange={setReflect}
          onHaloChange={setHalo}
          onLogoImageChange={setLogoImage}
          onLogoTextChange={setLogoText}
          onCardInfoChange={setCardInfo}
          onShotIndexChange={setShotIndex}
          onContinue={() => go("export")}
        />
      )}

      {screen === "export" && rectoImage && (
        <ExportScreen
          baseRequest={buildBaseRequest()}
          hasVerso={!!versoImage}
          selected={selected}
          onSelectedChange={setSelected}
          format={format}
          onFormatChange={setFormat}
          onDownloadClick={handleDownloadClick}
          onEdit={() => go("customize")}
          onNewCard={restartFlow}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          handleFileChosen(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      <GuideModal
        open={guideOpen}
        ctaLabel={guideTarget === "camera" ? "Ouvrir la caméra" : guideTarget === "gallery" ? "Choisir une photo" : "Compris"}
        ctaIcon={guideTarget === "camera" ? "ti-camera" : guideTarget === "gallery" ? "ti-photo" : undefined}
        onProceed={handleGuideProceed}
        onClose={handleGuideClose}
      />
      <EmailModal open={emailModalOpen} onSubmit={handleEmailSubmit} onSkip={handleEmailSkip} />
      <Toast message={toastMsg} visible={toastVisible} />
    </div>
  );
}
