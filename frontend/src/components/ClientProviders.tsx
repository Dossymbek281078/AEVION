"use client";
import { usePathname } from "next/navigation";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/ToastProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AutoTranslate } from "@/components/AutoTranslate";

// Prefixes where standalone app shells take over — no global header/footer.
const APP_PREFIXES = ["/build", "/qright", "/qsign", "/qcoreai", "/multichat-engine", "/aevion-bank"];

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isApp = APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  return (
    <I18nProvider>
      <AutoTranslate>
        {!isApp && <SiteHeader />}
        <ToastProvider>
          <div style={{ flex: 1 }}>{children}</div>
        </ToastProvider>
        {!isApp && <SiteFooter />}
      </AutoTranslate>
    </I18nProvider>
  );
}