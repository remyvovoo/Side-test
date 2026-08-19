"use client";

import { useEffect, useRef, useState } from "react";
import type { Face } from "@/lib/wizard/types";

interface CameraScreenProps {
  face: Face;
  onCapture: (blob: Blob) => void;
  onClose: () => void;
  onUnavailable: () => void;
}

export function CameraScreen({ face, onCapture, onClose, onUnavailable }: CameraScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      onUnavailable();
      return;
    }
    let cancelled = false;
    navigator.mediaDevices
      // On demande le plus grand capteur disponible : la photo finale n'est
      // qu'une portion 3/4 du champ filmé, et la carte n'occupe qu'une partie
      // de cette portion. En 1920 de large il ne restait qu'environ 810 px sur
      // la largeur utile — trop peu pour lire un numéro de carte.
      .getUserMedia({ video: { facingMode, width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        if (!cancelled) onClose();
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;

    // On enregistre EXACTEMENT ce que le vendeur voit. Le flux est affiché en
    // `object-fit: cover` : la caméra filme en paysage, la scène est en 3/4,
    // donc les côtés sont rognés à l'écran. Sans ce même rognage à la capture,
    // la photo contient tout le champ de la caméra — le cadre de guidage ne
    // veut alors plus rien dire, et la carte se retrouve minuscule au centre
    // d'un décor qu'on n'a jamais vu (cause des marges parasites signalées
    // sur mobile).
    const view = v.getBoundingClientRect();
    const viewAspect = view.width > 0 && view.height > 0 ? view.width / view.height : v.videoWidth / v.videoHeight;
    let sw = v.videoWidth;
    let sh = v.videoHeight;
    if (v.videoWidth / v.videoHeight > viewAspect) {
      sw = Math.round(v.videoHeight * viewAspect); // flux trop large → on rogne les côtés
    } else {
      sh = Math.round(v.videoWidth / viewAspect); // flux trop haut → on rogne haut et bas
    }
    const sx = Math.round((v.videoWidth - sw) / 2);
    const sy = Math.round((v.videoHeight - sh) / 2);

    const c = document.createElement("canvas");
    c.width = sw;
    c.height = sh;
    c.getContext("2d")!.drawImage(v, sx, sy, sw, sh, 0, 0, sw, sh);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    c.toBlob((b) => b && onCapture(b), "image/jpeg", 0.95);
  }

  return (
    <div className="screen" id="screen-camera">
      <div className="cam-stage">
        <video ref={videoRef} className="cam-feed" autoPlay playsInline muted />
        <div className="cam-overlay">
          <div className="cam-frame" />
        </div>
        <div className="cam-hint">
          {face === "recto" ? "Place ta carte dans le cadre" : "Place le verso dans le cadre"} — laisse le fond visible
          tout autour, c&apos;est lui qui sert à détourer.
        </div>
        <button className="cam-side cam-close" onClick={onClose} aria-label="Fermer" type="button">
          <i className="ti ti-x" />
        </button>
        <div className="cam-controls">
          <div style={{ width: 42 }} />
          <button className="cam-shutter" onClick={capture} aria-label="Prendre la photo" type="button" />
          <button
            className="cam-side"
            onClick={() => setFacingMode((m) => (m === "environment" ? "user" : "environment"))}
            aria-label="Changer de caméra"
            type="button"
          >
            <i className="ti ti-refresh" />
          </button>
        </div>
      </div>
    </div>
  );
}
