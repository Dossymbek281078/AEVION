"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { PushSubscribeButton } from "@/components/build/PushSubscribeButton";

// ── permission helpers ────────────────────────────────────────────────────────

type PermissionStatus = "granted" | "denied" | "default" | "unsupported";

function readPermission(): PermissionStatus {
  if (typeof window === "undefined") return "default";
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission as PermissionStatus;
}

const PERMISSION_BADGE: Record<PermissionStatus, { label: string; classes: string }> = {
  granted: {
    label: "Allowed",
    classes: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },
  denied: {
    label: "Blocked",
    classes: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  },
  default: {
    label: "Not set",
    classes: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },
  unsupported: {
    label: "Not supported",
    classes: "border-white/10 bg-white/[0.04] text-slate-400",
  },
};

// ── page shell ────────────────────────────────────────────────────────────────

export default function PushSubscribePage() {
  return (
    <BuildShell>
      <RequireAuth>
        <Body />
      </RequireAuth>
    </BuildShell>
  );
}

// ── body ──────────────────────────────────────────────────────────────────────

function Body() {
  const [permission, setPermission] = useState<PermissionStatus>("default");

  // Read the real value on the client after hydration
  useEffect(() => {
    setPermission(readPermission());

    // Listen for changes (Chrome supports permissionchange on Notification)
    if (typeof window === "undefined" || !("permissions" in navigator)) return;
    let descriptor: PermissionDescriptor;
    try {
      descriptor = { name: "notifications" as PermissionName };
    } catch {
      return;
    }
    let cleanup: (() => void) | undefined;
    navigator.permissions.query(descriptor).then((status) => {
      const handler = () => setPermission(readPermission());
      status.addEventListener("change", handler);
      cleanup = () => status.removeEventListener("change", handler);
    });
    return () => cleanup?.();
  }, []);

  const badge = PERMISSION_BADGE[permission];

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="w-full max-w-md">
        {/* breadcrumb */}
        <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
          <Link href="/build/notifications" className="hover:text-slate-300">
            Notifications
          </Link>
          <span>/</span>
          <Link href="/build/notifications/preferences" className="hover:text-slate-300">
            Preferences
          </Link>
          <span>/</span>
          <span className="text-slate-300">Push</span>
        </div>

        {/* card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-7">
          {/* icon + title */}
          <div className="mb-5 flex flex-col items-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-2xl">
              &#x1F514;
            </div>
            <h1 className="text-xl font-bold text-white">Browser Push Notifications</h1>
            <p className="mt-1 text-sm text-slate-400">
              Get instant alerts for messages, application updates, and job matches — even when
              QBuild is not open in your browser.
            </p>
          </div>

          {/* permission status row */}
          <div className="mb-5 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-2.5">
            <span className="text-xs text-slate-400">Browser permission</span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badge.classes}`}
            >
              {badge.label}
            </span>
          </div>

          {/* denied help text */}
          {permission === "denied" && (
            <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3.5 py-3 text-xs text-rose-300">
              <strong className="font-semibold">Notifications are blocked.</strong> To enable them,
              click the lock icon in your browser&apos;s address bar and change the Notifications
              permission to &quot;Allow&quot;, then refresh this page.
            </div>
          )}

          {/* unsupported help text */}
          {permission === "unsupported" && (
            <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-3 text-xs text-slate-400">
              Your browser does not support push notifications. Try Chrome, Edge, or Firefox on
              desktop.
            </div>
          )}

          {/* PushSubscribeButton handles all states internally */}
          <div className="flex justify-center">
            <PushSubscribeButton />
          </div>

          {/* what you get */}
          {permission !== "unsupported" && (
            <ul className="mt-5 space-y-1.5 border-t border-white/10 pt-4">
              {[
                "New message from a recruiter or candidate",
                "Application status change (accepted / rejected / interview)",
                "New vacancy matching your skills",
                "Project update or review received",
              ].map((text) => (
                <li key={text} className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="mt-[1px] shrink-0 text-emerald-400">&#x2713;</span>
                  {text}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* back link */}
        <div className="mt-4 text-center">
          <Link
            href="/build/notifications/preferences"
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            ← Back to notification preferences
          </Link>
        </div>
      </div>
    </div>
  );
}
