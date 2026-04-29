import type { NextConfig } from "next";
import path from "node:path";

// Прокси API на бэкенд: браузер бьёт в same-origin `/api-backend/...` → без CORS.
// В проде задайте BACKEND_PROXY_TARGET на сборке (URL без завершающего слэша).
const backendProxyTarget =
  process.env.BACKEND_PROXY_TARGET?.trim() || "http://127.0.0.1:4001";

// При корневом `aevion-core/package-lock.json` Next иначе поднимает workspace root вверх.
// При `npm run build` из каталога `frontend` `process.cwd()` — корень приложения.
const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(process.cwd()),
  },

  async headers() {
    return [
      {
        // All paths: full Cross-Origin Isolation for SharedArrayBuffer (Stockfish 18).
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
      {
        // Studio hosts cross-origin iframes (Twitch / YouTube / Lichess).
        // unsafe-none = no isolation = full third-party iframe support
        // including cookies/storage that Twitch needs. Stockfish in the
        // chess-internal iframe loses SharedArrayBuffer here — user can
        // open the standalone /cyberchess tab via the pane "↗" button.
        // NOTE: declared AFTER the catch-all so its values override.
        source: "/cyberchess/studio",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "unsafe-none" },
          { key: "Cross-Origin-Embedder-Policy", value: "unsafe-none" },
        ],
      },
      {
        source: "/cyberchess/studio/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "unsafe-none" },
          { key: "Cross-Origin-Embedder-Policy", value: "unsafe-none" },
        ],
      },
      {
        // QSign embed widget — must be embeddable cross-origin in any iframe.
        // Disable COOP/COEP isolation here and allow framing from anywhere.
        source: "/qsign/embed/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "unsafe-none" },
          { key: "Cross-Origin-Embedder-Policy", value: "unsafe-none" },
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: "/api-backend/:path*",
        destination: `${backendProxyTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;