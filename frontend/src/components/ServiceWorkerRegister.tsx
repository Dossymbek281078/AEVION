"use client";

import { useEffect } from "react";

// Регистрирует /sw.js на mount только в production. В dev hot-reload Next.js
// + SW caching = сильно мешают friction'у — поэтому skip.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    // Register после load чтобы не блокировать initial render
    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {/* silently ignore — not critical */});
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
