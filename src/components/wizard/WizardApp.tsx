"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "./TopBar";
import { StepsBar } from "./StepsBar";
import { Toast } from "./Toast";
import { GuideModal } from "./GuideModal";
import { EmailModal } from "./EmailModal";
import { SellerProfileModal } from "./SellerProfileModal";
import { HomeScreen } from "./screens/HomeScreen";
import { SourceScreen } from "./screens/SourceScreen";
import { CameraScreen } from "./screens/CameraScreen";
import { ProcessScreen } from "./screens/ProcessScreen";
import { QualityScreen } from "./screens/QualityScreen";
import { CropScreen } from "./screens/CropScreen";
import { VersoScreen } from "./screens/VersoScreen";
import { CustomizeScreen } from "./screens/CustomizeScreen";
import { ExportScreen } from "./screens/ExportScreen";
import { renderShot, THEMES, MOUNTS, type RenderRequest } from "@/lib/render-engine";
import { STEP, BACK, EMPTY_CARD_INFO, type ScreenName, type Face, type ExportFormat } from "@/lib/wizard/types";
import { buildShotList } from "@/lib/wizard/shot-list";
import { buildDetailShotList } from "@/lib/detail-shots/detail-shot-list";
import { buildAndDownloadZip } from "@/lib/wizard/export-zip";
import { loadSellerBoilerplate, saveSellerBoilerplate } from "@/lib/wizard/seller-profile";
import { generateDescription } from "@/lib/wizard/generate-description";
import { analyzeCard, mergeFacts, AnalyzeCardError } from "@/lib/wizard/analyze-card";
import type { QualityResult } from "@/lib/quality/types";

type GuideTarget = "camera" | "gallery" | "tips";
export type AiStatus = "idle" | "running" | "done" | "error";

function aiErrorMessage(e: unknown): string {
  if (e instanceof AnalyzeCardError) {
    switch (e.code) {
      case "quota_exceeded":
        return `Limite d'essai atteinte (${e.limit ?? 30} identifications).`;
      case "overloaded":
        return "Le service d'IA est saturé. Réessaie dans quelques secondes.";
      case "not_configured":
        return "Identification IA pas encore configurée.";
      case "unauthorized":
        return "Session expirée — reconnecte-toi.";
      case "refused":
        return "L'IA n'a pas pu analyser cette photo.";
    }
  }
  return "L'identification a échoué. Réessaie.";
}

interface WizardAppProps {
  isAuthenticated: boolean;
  initialThemeIndex?: number;
  /** Mode espace connecté : pas de header public, démarre à la prise de photo,
   *  sauvegarde la carte en base après l'export. */
  embedded?: boolean;
  initialSellerBoilerplate?: string;
  /** Modèles d'annonce du vendeur (vides = modèles par défaut). */
  titleTemplate?: string;
  descriptionTemplate?: string;
  /** Réglages studio par défaut (page « Mon studio »). */
  initialMountIndex?: number;
  initialReflect?: number;
  initialHalo?: number;
  initialLogoText?: string;
  initialLogoImageUrl?: string;
}

export function WizardApp({
  isAuthenticated,
  initialThemeIndex = 0,
  embedded = false,
  initialSellerBoilerplate,
  titleTemplate = "",
  descriptionTemplate = "",
  initialMountIndex = 0,
  initialReflect = 0.5,
  initialHalo = 0.7,
  initialLogoText = "",
  initialLogoImageUrl = "",
}: WizardAppProps) {
  const router = useRouter();
  const [screen, setScreen] = useState<ScreenName>(embedded ? "source" : "home");
  const [face, setFace] = useState<Face>("recto");
  /** Chemin choisi pour le recto (appareil ou galerie) ; le verso le reprend. */
  const [lastSource, setLastSource] = useState<"camera" | "gallery">("camera");

  const [rectoImage, setRectoImage] = useState<HTMLImageElement | null>(null);
  const [versoImage, setVersoImage] = useState<HTMLImageElement | null>(null);
  const [pendingImage, setPendingImage] = useState<HTMLImageElement | null>(null);

  const [mountIndex, setMountIndex] = useState(initialMountIndex);
  const [themeIndex, setThemeIndex] = useState(initialThemeIndex);
  const [reflect, setReflect] = useState(initialReflect);
  const [halo, setHalo] = useState(initialHalo);
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  const [logoText, setLogoText] = useState(initialLogoText);

  // Logo par défaut du compte (data URL) → image utilisable par le moteur.
  useEffect(() => {
    if (!initialLogoImageUrl) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setLogoImage(img);
    };
    img.src = initialLogoImageUrl;
    return () => {
      cancelled = true;
    };
  }, [initialLogoImageUrl]);
  const [cardInfo, setCardInfo] = useState(EMPTY_CARD_INFO);
  const [shotIndex, setShotIndex] = useState(0);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [selectedDetail, setSelectedDetail] = useState<Record<string, boolean>>({});
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState<ExportFormat>("jpg");
  const [isDownloading, setIsDownloading] = useState(false);

  const [sellerBoilerplate, setSellerBoilerplate] = useState(() =>
    initialSellerBoilerplate !== undefined ? initialSellerBoilerplate : loadSellerBoilerplate()
  );
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileModalOpenCount, setProfileModalOpenCount] = useState(0);

  const [sourceBlob, setSourceBlob] = useState<Blob | null>(null);
  const [quality, setQuality] = useState<QualityResult | null>(null);

  // Identification des infos de la carte par l'IA (chantier C).
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [aiMessage, setAiMessage] = useState("");
  const aiBusyRef = useRef(false);
  // Une seule analyse automatique par carte ; les suivantes sont manuelles.
  const aiAutoDoneRef = useRef(false);

  const [guideOpen, setGuideOpen] = useState(false);
  const [guideTarget, setGuideTarget] = useState<GuideTarget | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Carte déjà enregistrée pour ce parcours (mode connecté) : évite les doublons
  // quand on revient en arrière puis re-valide, et permet la mise à jour.
  const savedCardIdRef = useRef<string | null>(null);

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
    const prev = BACK[screen];
    // En mode espace connecté, « retour » depuis le premier écran ramène au dashboard.
    if (embedded && prev === "home" && screen === "source") {
      router.push("/dashboard");
      return;
    }
    go(prev);
  }

  function startFlow() {
    // Le parcours de création est réservé aux comptes (essai gratuit 30 jours).
    if (!isAuthenticated) {
      router.push("/register");
      return;
    }
    setFace("recto");
    go("source");
  }
  function startVerso() {
    setFace("verso");
    // Le verso suit le chemin choisi pour le recto : qui a importé sa première
    // photo n'a aucune raison de se voir proposer l'appareil pour la seconde
    // (les deux faces d'une carte se photographient dans la même foulée).
    openGuide(lastSource);
  }
  function restartFlow() {
    setRectoImage(null);
    setVersoImage(null);
    setPendingImage(null);
    setShotIndex(0);
    setSelected({});
    setSelectedDetail({});
    setDescription("");
    setCardInfo(EMPTY_CARD_INFO);
    savedCardIdRef.current = null;
    setAiStatus("idle");
    setAiMessage("");
    aiAutoDoneRef.current = false;
    startFlow();
  }

  /**
   * Lit les informations imprimées sur la photo (nom, numéro, série…) et
   * préremplit les champs encore vides. Ce que le vendeur a saisi lui-même
   * n'est jamais écrasé.
   */
  async function identifyCard(image: HTMLImageElement) {
    if (!isAuthenticated || aiBusyRef.current) return;
    aiBusyRef.current = true;
    setAiStatus("running");
    setAiMessage("");
    try {
      const { facts, enrichedOnline } = await analyzeCard(image);
      const foundSomething = Object.values(facts).some((v) => v.trim());
      setCardInfo((info) => mergeFacts(info, facts));
      setAiStatus("done");
      setAiMessage(
        !foundSomething
          ? "Rien de lisible sur cette photo : saisis les infos à la main."
          : enrichedOnline
            ? "Champs préremplis — série et rareté retrouvées en ligne d'après le code de la carte. Vérifie avant de publier."
            : "Champs préremplis par l'IA — vérifie-les avant de publier."
      );
    } catch (e) {
      console.error("[cardshot] identification IA", e);
      setAiStatus("error");
      setAiMessage(aiErrorMessage(e));
    } finally {
      aiBusyRef.current = false;
    }
  }

  // ----- Source / guide -----
  function launchSource(target: GuideTarget) {
    if (target === "camera") {
      setLastSource("camera");
      go("camera");
    } else if (target === "gallery") {
      setLastSource("gallery");
      fileInputRef.current?.click();
    }
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
      // L'IA lit la carte en tâche de fond pendant que le vendeur enchaîne sur
      // le verso : les champs sont déjà remplis quand il arrive au studio.
      if (!aiAutoDoneRef.current) {
        aiAutoDoneRef.current = true;
        void identifyCard(result);
      }
      go("verso");
    } else {
      setVersoImage(result);
      setShotIndex(0);
      go("customize");
    }
    setPendingImage(null);
  }

  function handleContinueToExport() {
    const generated = generateDescription(cardInfo, {
      titleTemplate,
      descriptionTemplate,
      boilerplate: sellerBoilerplate,
    });
    setDescription(generated);
    const allShots: Record<number, boolean> = {};
    buildShotList(!!versoImage).forEach((_shot, i) => (allShots[i] = true));
    setSelected(allShots);
    const allDetail: Record<string, boolean> = {};
    buildDetailShotList(!!versoImage).forEach((d) => (allDetail[d.id] = true));
    setSelectedDetail(allDetail);
    go("export");
    // La carte entre dans « Mes cartes » dès cet écran — télécharger ou non.
    if (embedded) void saveCardToAccount(generated);
  }

  function handleProfileSave(text: string) {
    setSellerBoilerplate(text);
    saveSellerBoilerplate(text);
    if (embedded) {
      fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerBoilerplate: text }),
      }).catch(() => {});
    }
  }

  /** Capture les réglages studio actuels comme défauts du compte (« Mon studio »). */
  async function saveStudioAsDefaults() {
    let logoDataUrl = "";
    if (logoImage) {
      if (logoImage.src.startsWith("data:")) {
        logoDataUrl = logoImage.src;
      } else {
        try {
          const c = document.createElement("canvas");
          const MAX = 200;
          const s = Math.min(MAX / logoImage.width, MAX / logoImage.height, 1);
          c.width = Math.max(1, Math.round(logoImage.width * s));
          c.height = Math.max(1, Math.round(logoImage.height * s));
          c.getContext("2d")!.drawImage(logoImage, 0, 0, c.width, c.height);
          logoDataUrl = c.toDataURL("image/png");
        } catch {}
      }
    }
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
        }),
      });
      if (!res.ok) throw new Error();
      showToast("Réglages enregistrés comme défauts ⭐");
    } catch {
      showToast("⚠️ Impossible d'enregistrer les défauts");
    }
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

  /** Vignette JPEG (~300 px) du premier visuel, pour la galerie « Mes cartes ». */
  function buildThumbnail(): string | null {
    if (!rectoImage) return null;
    try {
      const canvas = document.createElement("canvas");
      renderShot(canvas, {
        ...buildBaseRequest(),
        shot: buildShotList(!!versoImage)[0],
        size: 300,
      });
      return canvas.toDataURL("image/jpeg", 0.72);
    } catch {
      return null;
    }
  }

  async function saveCardToAccount(desc: string) {
    const thumbnail = buildThumbnail();
    if (!thumbnail) {
      showToast("Sauvegarde impossible (aperçu non généré)");
      return;
    }
    const payload = {
      name: cardInfo.name || "Carte sans nom",
      thumbnail,
      cardInfo: { ...cardInfo },
      description: desc,
      themeId: THEMES[themeIndex].id,
      mountId: MOUNTS[mountIndex].id,
      hasVerso: !!versoImage,
    };
    try {
      const existingId = savedCardIdRef.current;
      const res = await fetch(existingId ? `/api/cards/${existingId}` : "/api/cards", {
        method: existingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`save failed (${res.status})`);
      const body = (await res.json()) as { cardId?: string };
      if (body.cardId) savedCardIdRef.current = body.cardId;
      if (!existingId) showToast("Carte ajoutée dans « Mes cartes »");
    } catch (e) {
      console.error("[cardshot] card save failed", e);
      showToast("⚠️ Sauvegarde dans « Mes cartes » impossible");
    }
  }

  async function performDownload() {
    if (!rectoImage) return;
    const shots = buildShotList(!!versoImage).filter((_shot, i) => selected[i]);
    const details = buildDetailShotList(!!versoImage).filter((d) => selectedDetail[d.id]);
    if (!shots.length) return;
    setIsDownloading(true);
    try {
      await buildAndDownloadZip({
        shots,
        detailShots: details,
        rectoImage,
        versoImage,
        baseRequest: buildBaseRequest(),
        description,
        baseName: cardInfo.name || "carte",
        format,
      });
      showToast("ZIP téléchargé");
      // Met à jour la carte avec la description telle qu'éditée avant téléchargement
      // (ou la crée si la première sauvegarde avait échoué).
      if (embedded) await saveCardToAccount(description);
    } catch (e) {
      console.error("[cardshot] zip export failed", e);
      showToast("Le ZIP a échoué, réessaie");
    } finally {
      setIsDownloading(false);
    }
  }

  function handleDownloadClick() {
    // Connecté : on a déjà son e-mail, pas de fenêtre de collecte.
    if (embedded) {
      performDownload();
      return;
    }
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
    <div className={`app${isWide ? " wide" : ""}${embedded ? " embedded" : ""}`}>
      {!embedded && (
        <TopBar
          showBack={screen !== "home"}
          onBack={goBack}
          onBrandClick={() => go("home")}
          onProfileClick={() => {
            setProfileModalOpenCount((n) => n + 1);
            setProfileModalOpen(true);
          }}
        />
      )}
      {embedded && (
        <button className="wizard-embedded-back" onClick={goBack} type="button">
          <i className="ti ti-arrow-left" /> Retour
        </button>
      )}
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

      {screen === "verso" && (
        <VersoScreen onAddVerso={startVerso} onSkip={() => go("customize")} sourceMode={lastSource} />
      )}

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
          onContinue={handleContinueToExport}
          compact={embedded}
          onSaveAsDefaults={embedded ? saveStudioAsDefaults : undefined}
          aiStatus={aiStatus}
          aiMessage={aiMessage}
          onRunAi={isAuthenticated ? () => void identifyCard(rectoImage) : undefined}
        />
      )}

      {screen === "export" && rectoImage && (
        <ExportScreen
          baseRequest={buildBaseRequest()}
          rectoImage={rectoImage}
          versoImage={versoImage}
          selected={selected}
          onSelectedChange={setSelected}
          selectedDetail={selectedDetail}
          onSelectedDetailChange={setSelectedDetail}
          format={format}
          onFormatChange={setFormat}
          description={description}
          onDescriptionChange={setDescription}
          onDownloadClick={handleDownloadClick}
          isDownloading={isDownloading}
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
      <SellerProfileModal
        key={profileModalOpenCount}
        open={profileModalOpen}
        initialText={sellerBoilerplate}
        onSave={handleProfileSave}
        onClose={() => setProfileModalOpen(false)}
      />
      <Toast message={toastMsg} visible={toastVisible} />
    </div>
  );
}
