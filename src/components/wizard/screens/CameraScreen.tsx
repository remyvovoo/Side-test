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
      .getUserMedia({ video: { facingMode, width: { ideal: 1920 } }, audio: false })
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
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    c.toBlob((b) => b && onCapture(b), "image/jpeg", 0.95);
  }

  return (
    <div className="screen" id="screen-camera">
      <div className="cam-stage">
        <video ref={videoRef} autoPlay playsInline muted />
        <div className="cam-overlay">
          <div className="cam-frame" />
        </div>
        <div className="cam-hint">{face === "recto" ? "Aligne ta carte dans le cadre" : "Aligne le verso dans le cadre"}</div>
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
