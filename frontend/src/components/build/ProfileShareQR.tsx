"use client";

import { useState } from "react";
import { useToast } from "./Toast";

// Lightweight QR-share modal. The QR image is rendered by api.qrserver.com
// (free, no API key, no install). A native Web Share button is offered when
// the browser supports it; otherwise we fall back to copy-link.
//
// We deliberately avoid pulling in a heavy QR library — this component is
// rendered on every public profile page and we don't want to ship 50kB of
// JS just for a modal nobody opens 99% of the time.
export function ProfileShareQR({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/build/u/${encodeURIComponent(userId)}`
      : `https://aevion.tech/build/u/${encodeURIComponent(userId)}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(
    url,
  )}`;

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Clipboard blocked");
    }
  }

  async function nativeShare() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: `${name} on AEVION QBuild`, url });
      } catch {
        /* user cancelled */
      }
    } else {
      copyUrl();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-semibold text-fuchsia-200 hover:bg-fuchsia-500/20"
        title="QR + share link"
      >
        ⊞ QR
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Share profile"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-slate-900 p-5 text-center shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-fuchsia-200">
                ⊞ Profile QR
              </span>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-200">
                ×
              </button>
            </div>
            <div className="mx-auto inline-block rounded-lg bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt={`QR code for ${name}'s QBuild profile`} width={240} height={240} />
            </div>
            <p className="mt-3 break-all text-[11px] text-slate-400">{url}</p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={nativeShare}
                className="rounded-md bg-fuchsia-500 px-3 py-1.5 text-xs font-semibold text-fuchsia-950 hover:bg-fuchsia-400"
              >
                Share
              </button>
              <button
                onClick={copyUrl}
                className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
              >
                Copy link
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
