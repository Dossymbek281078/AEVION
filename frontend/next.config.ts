import type { NextConfig } from "next";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

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
        // Cross-Origin Isolation — нужно чтобы браузер разрешил SharedArrayBuffer,
        // без которого Stockfish 18 (multi-threaded WASM) не запускается.
        // Применяется ко всем страницам.
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
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

// Sentry wrapper. Без NEXT_PUBLIC_SENTRY_DSN init/upload не выполняются,
// но wrapper резервирует hooks для server/edge instrumentation.
// Bundle analyzer (ANALYZE=true npm run build) — outermost wrap.
export default withBundleAnalyzer(withSentryConfig(nextConfig, {
  silent: true,
}));