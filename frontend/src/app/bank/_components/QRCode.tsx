"use client";

import { useEffect, useState } from "react";
import QRCodeLib from "qrcode";

export function QRCodeView({
  value,
  size = 160,
}: {
  value: string;
  size?: number;
}) {
  const [svg, setSvg] = useState<string>("");

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
        width: size,
        height: size,
        borderRadius: 10,
        overflow: "hidden",
        background: "#fff",
        padding: 6,
        border: "1px solid rgba(15,23,42,0.08)",
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
