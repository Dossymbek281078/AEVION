"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

// Camera-based QR scanner. When a /bank/pay link is detected, decode the
// query string and route the user into /bank with prefilled SendForm
// hints. Works on Chromium-based browsers (Android Chrome, Edge, desktop
// Chrome) which expose the BarcodeDetector API; gracefully degrades on
// Safari / Firefox to a "paste link" fallback.

type Status =
  | "idle"
  | "requesting"
  | "ready"
  | "denied"
  | "unsupported"
  | "error"
  | "decoded";

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor;
  }
}

type BarcodeDetectorCtor = new (init?: { formats?: string[] }) => {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
};

export default function QrScanPage() {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [decoded, setDecoded] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pasted, setPasted] = useState<string>("");

  // Stop camera + RAF on unmount or when we leave scanning state.
  useEffect(() => {
    return () => {
      stopScanning();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopScanning() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  async function startScanning() {
    setErrorMsg(null);
    if (typeof window === "undefined") return;
    if (!window.BarcodeDetector) {
      setStatus("unsupported");
      return;
    }
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (!v) {
        stream.getTracks().forEach((tr) => tr.stop());
        setStatus("error");
        return;
      }
      v.srcObject = stream;
      await v.play();
      setStatus("ready");

      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            const raw = codes[0].rawValue;
            handleDecoded(raw);
            return;
          }
        } catch {
          // ignore frame-level decode errors
        }
        rafRef.current = requestAnimationFrame(() => {
          // Throttle to ~3 fps to save battery.
          window.setTimeout(tick, 320);
        });
      };
      tick();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/Permission|denied|NotAllowed/i.test(msg)) {
        setStatus("denied");
      } else {
        setErrorMsg(msg);
        setStatus("error");
      }
      stopScanning();
    }
  }

  function handleDecoded(raw: string) {
    stopScanning();
    setDecoded(raw);
    setStatus("decoded");
  }

  // Try to convert a /bank/pay URL into /bank?to=&amount=&note= deep-link.
  function deepLinkFor(raw: string): string | null {
    try {
      const url = new URL(raw, typeof window !== "undefined" ? window.location.origin : "https://aevion.app");
      // Accept aevion.app/bank/pay?... or any-origin /bank/pay?...
      if (!url.pathname.endsWith("/bank/pay")) return null;
      const out = new URLSearchParams();
      const to = url.searchParams.get("to");
      const amount = url.searchParams.get("amount");
      const note = url.searchParams.get("note");
      if (to) out.set("to", to);
      if (amount) out.set("amount", amount);
      if (note) out.set("note", note);
      out.set("from", "qr");
      return `/bank?${out.toString()}`;
    } catch {
      return null;
    }
  }

  const dl = decoded ? deepLinkFor(decoded) : null;

  function tryPasted() {
    if (!pasted.trim()) return;
    handleDecoded(pasted.trim());
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#f8fafc",
        padding: "32px 16px 56px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <Link
        href="/bank"
        style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", textDecoration: "none", fontWeight: 700, marginBottom: 18 }}
      >
        ← {t("scan.backToBank")}
      </Link>

      <section
        style={{
          width: "100%",
          maxWidth: 480,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 18,
          padding: 22,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 6, color: "#5eead4", textTransform: "uppercase" }}>
          {t("scan.kicker")}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, textAlign: "center" }}>
          {t("scan.title")}
        </h1>

        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "1 / 1",
            borderRadius: 14,
            overflow: "hidden",
            background: "#000",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: status === "ready" ? "block" : "none",
            }}
          />
          {status === "ready" ? (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: "20%",
                border: "2px solid rgba(94,234,212,0.85)",
                borderRadius: 14,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.40)",
                pointerEvents: "none",
              }}
            />
          ) : null}
          {status !== "ready" ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#cbd5e1",
                fontSize: 12,
                textAlign: "center",
                padding: 24,
                gap: 10,
              }}
            >
              <div style={{ fontSize: 36, opacity: 0.5 }} aria-hidden="true">▢</div>
              {status === "idle" ? t("scan.idle") : null}
              {status === "requesting" ? t("scan.requesting") : null}
              {status === "denied" ? t("scan.denied") : null}
              {status === "unsupported" ? t("scan.unsupported") : null}
              {status === "error" ? (errorMsg ?? t("scan.error")) : null}
              {status === "decoded" ? t("scan.decoded") : null}
            </div>
          ) : null}
        </div>

        <canvas ref={canvasRef} style={{ display: "none" }} />

        {status === "decoded" && decoded ? (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(94,234,212,0.10)",
                border: "1px solid rgba(94,234,212,0.40)",
                fontSize: 11,
                fontFamily: "ui-monospace, monospace",
                wordBreak: "break-all",
                color: "#5eead4",
              }}
            >
              {decoded}
            </div>
            {dl ? (
              <Link
                href={dl}
                style={{
                  padding: "12px 18px",
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 800,
                  textDecoration: "none",
                  textAlign: "center",
                }}
              >
                {t("scan.cta.openInWallet")}
              </Link>
            ) : (
              <a
                href={decoded}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "12px 18px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.10)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: "none",
                  textAlign: "center",
                  border: "1px solid rgba(255,255,255,0.18)",
                }}
              >
                {t("scan.cta.openExternal")}
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                setDecoded(null);
                setStatus("idle");
              }}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                background: "transparent",
                color: "#cbd5e1",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              {t("scan.cta.again")}
            </button>
          </div>
        ) : null}

        {status === "idle" ? (
          <button
            type="button"
            onClick={startScanning}
            style={{
              padding: "12px 22px",
              borderRadius: 12,
              background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 800,
              border: "none",
              cursor: "pointer",
              width: "100%",
              boxShadow: "0 6px 18px rgba(14,165,233,0.30)",
            }}
          >
            {t("scan.cta.start")}
          </button>
        ) : null}

        {status === "unsupported" || status === "denied" ? (
          <div style={{ width: "100%" }}>
            <label htmlFor="paste-url" style={{ display: "block", fontSize: 11, color: "#94a3b8", fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
              {t("scan.paste.label")}
            </label>
            <input
              id="paste-url"
              type="url"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="https://aevion.app/bank/pay?to=acc_…"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.20)",
                background: "rgba(255,255,255,0.06)",
                color: "#fff",
                fontFamily: "ui-monospace, monospace",
                fontSize: 12,
              }}
            />
            <button
              type="button"
              onClick={tryPasted}
              disabled={!pasted.trim()}
              style={{
                marginTop: 8,
                padding: "10px 16px",
                borderRadius: 10,
                background: pasted.trim() ? "#0d9488" : "rgba(255,255,255,0.10)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 800,
                border: "none",
                cursor: pasted.trim() ? "pointer" : "not-allowed",
                width: "100%",
              }}
            >
              {t("scan.paste.cta")}
            </button>
          </div>
        ) : null}

        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", textAlign: "center", lineHeight: 1.55 }}>
          {t("scan.hint")}
        </div>
      </section>
    </main>
  );
}
