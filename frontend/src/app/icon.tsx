import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function AppIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0d9488 0%, #0ea5e9 60%, #6366f1 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
          fontSize: 320,
          fontWeight: 900,
          letterSpacing: -10,
        }}
      >
        ₳
      </div>
    ),
    { ...size },
  );
}
