"use client";

import { useEffect, useState } from "react";
import QRCodeLib from "qrcode";

/**
 * Holographic QR — renders a standard QR core wrapped in a shimmer overlay
 * and a slowly rotating conic halo. Screenshots of the QR lose the motion,
 * so a "live" rendering is visually distinct from a recycled image — a small
 * but real anti-phishing signal.
 *
 * prefers-reduced-motion disables both animations.
 */
export function QRCodeView({
  value,
  size = 160,
}: {
  value: string;
  size?: number;
}) {
  const [svg, setSvg] = useState<string>("");
  const [prm, setPrm] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    QRCodeLib.toString(value, {
      type: "svg",
      margin: 1,
      width: size,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((s) => {
        if (!cancelled) setSvg(s);
      })
      .catch(() => {
        if (!cancelled) setSvg("");
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrm(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  if (!svg) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          background: "rgba(15,23,42,0.04)",
        }}
      />
    );
  }

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: 14,
        padding: 3,
        background: prm
          ? "linear-gradient(135deg,#0ea5e9,#7c3aed)"
          : "conic-gradient(from 0deg, #0ea5e9, #7c3aed, #d97706, #059669, #0ea5e9)",
        animation: prm ? "none" : "aevion-qr-halo 7s linear infinite",
        boxShadow: "0 4px 14px rgba(15,23,42,0.12)",
      }}
      aria-label="AEVION holographic QR"
    >
      <style>{`
        @keyframes aevion-qr-halo {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes aevion-qr-shimmer {
          0%   { transform: translate(-100%, -100%); opacity: 0; }
          25%  { opacity: 0.65; }
          100% { transform: translate(100%, 100%); opacity: 0; }
        }
      `}</style>
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: 11,
          overflow: "hidden",
          background: "#fff",
          padding: 6,
          animation: prm ? "none" : "aevion-qr-halo 7s linear infinite reverse",
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {!prm ? (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 3,
            top: 3,
            right: 3,
            bottom: 3,
            borderRadius: 11,
            pointerEvents: "none",
            background:
              "linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)",
            mixBlendMode: "screen",
            animation: "aevion-qr-shimmer 3.4s ease-in-out infinite",
            overflow: "hidden",
          }}
        />
      ) : null}
    </div>
  );
}
