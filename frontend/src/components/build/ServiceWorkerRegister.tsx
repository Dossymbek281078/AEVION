"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    // Registration is best-effort; failures are silent because the SW is
    // a progressive enhancement, not a hard dependency.
    const onLoad = () => {
      navigator.serviceWorker
        .register("/build-sw.js", { scope: "/build" })
        .catch(() => {
          /* ignore — SW unsupported or blocked */
        });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    return () => {
      window.removeEventListener("load", onLoad);
    };
  }, []);

  return null;
}
