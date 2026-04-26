"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { clearDemoSeed, hasDemoSeed, seedDemo } from "../_lib/demoSeed";
import { resetTour } from "../_lib/onboarding";

type Notify = (msg: string, type?: "success" | "error" | "info") => void;

export function HelpMenu({
  accountId,
  notify,
}: {
  accountId: string;
  notify: Notify;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState<boolean>(false);
  const [demoActive, setDemoActive] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isMac =
    typeof navigator !== "undefined" &&
    /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent || "");

  useEffect(() => {
    setDemoActive(hasDemoSeed());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const toggleDemo = () => {
    if (demoActive) {
      clearDemoSeed();
      setDemoActive(false);
      notify(t("helpmenu.toast.demoCleared"), "info");
    } else {
      seedDemo(accountId);
      setDemoActive(true);
      notify(t("helpmenu.toast.demoLoaded"), "success");
    }
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("aevion:signatures-changed"));
    setOpen(false);
  };

  const relaunchTour = () => {
    resetTour();
    setOpen(false);
    // Use location.replace to force tour auto-open cleanly.
    const url = new URL(window.location.href);
    url.searchParams.set("tour", "1");
    url.searchParams.delete("demo");
    if (demoActive) url.searchParams.set("demo", "1");
    window.location.replace(url.toString());
  };

  return (
    <div
      ref={menuRef}
      className="aevion-bank-helpmenu-offset"
      style={{
        position: "fixed" as const,
        right: 20,
        bottom: 20,
        zIndex: 60,
        display: "flex",
        flexDirection: "column-reverse",
        alignItems: "flex-end",
        gap: 10,
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t("helpmenu.aria.close") : t("helpmenu.aria.open")}
        aria-expanded={open}
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "none",
          background: open
            ? "#0f172a"
            : "linear-gradient(135deg, #0d9488, #0ea5e9)",
          color: "#fff",
          fontSize: 20,
          fontWeight: 900,
          cursor: "pointer",
          boxShadow: "0 8px 24px rgba(14,165,233,0.35)",
          transition: "transform 200ms ease",
          transform: open ? "rotate(90deg)" : "none",
        }}
      >
        {open ? "×" : "?"}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={t("helpmenu.aria.menu")}
          style={{
            width: 240,
            background: "#fff",
            borderRadius: 14,
            boxShadow: "0 12px 32px rgba(15,23,42,0.16)",
            border: "1px solid rgba(15,23,42,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#64748b",
              background: "rgba(15,23,42,0.02)",
              borderBottom: "1px solid rgba(15,23,42,0.06)",
            }}
          >
            {t("helpmenu.section.quickActions")}
          </div>
          <MenuItem
            icon="⌘"
            label={t("helpmenu.item.palette.label")}
            hint={t("helpmenu.item.palette.hint", { key: isMac ? "⌘" : "Ctrl" })}
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(
                new KeyboardEvent("keydown", {
                  key: "k",
                  code: "KeyK",
                  metaKey: isMac,
                  ctrlKey: !isMac,
                  bubbles: true,
                }),
              );
            }}
          />
          <MenuItem icon="↻" label={t("helpmenu.item.tour.label")} hint={t("helpmenu.item.tour.hint")} onClick={relaunchTour} />
          <MenuItem
            icon={demoActive ? "✓" : "⟡"}
            label={demoActive ? t("helpmenu.item.demoClear.label") : t("helpmenu.item.demoLoad.label")}
            hint={demoActive ? t("helpmenu.item.demoClear.hint") : t("helpmenu.item.demoLoad.hint")}
            onClick={toggleDemo}
          />
          <MenuItem
            icon="↓"
            label={t("helpmenu.item.snapshot.label")}
            hint={t("helpmenu.item.snapshot.hint")}
            onClick={() => {
              setOpen(false);
              const el = document.getElementById("snapshot-heading");
              el?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
          <MenuItem
            icon="➤"
            label={t("helpmenu.item.invite.label")}
            hint={t("helpmenu.item.invite.hint")}
            onClick={() => {
              setOpen(false);
              const el = document.getElementById("referrals-heading");
              el?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
          <MenuItemLink
            icon="↗"
            label={t("helpmenu.item.portal.label")}
            hint={t("helpmenu.item.portal.hint")}
            href="/"
            onNavigate={() => setOpen(false)}
          />
          <div
            style={{
              padding: "8px 14px",
              fontSize: 10,
              color: "#94a3b8",
              borderTop: "1px solid rgba(15,23,42,0.06)",
              lineHeight: 1.45,
            }}
          >
            {t("helpmenu.footer.stuck")} <kbd style={{ fontFamily: "ui-monospace, monospace" }}>Esc</kbd> {t("helpmenu.footer.toClose")}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: string;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "28px 1fr",
        gap: 10,
        alignItems: "center",
        width: "100%",
        padding: "10px 14px",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        textAlign: "left" as const,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(14,165,233,0.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          background: "rgba(14,165,233,0.1)",
          color: "#0369a1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 900,
        }}
      >
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{label}</div>
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 1 }}>{hint}</div>
      </div>
    </button>
  );
}

function MenuItemLink({
  icon,
  label,
  hint,
  href,
  onNavigate,
}: {
  icon: string;
  label: string;
  hint: string;
  href: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      role="menuitem"
      href={href}
      onClick={onNavigate}
      style={{
        display: "grid",
        gridTemplateColumns: "28px 1fr",
        gap: 10,
        alignItems: "center",
        width: "100%",
        padding: "10px 14px",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          background: "rgba(15,23,42,0.06)",
          color: "#334155",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 900,
        }}
      >
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{label}</div>
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 1 }}>{hint}</div>
      </div>
    </Link>
  );
}
