"use client";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/ToastProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AutoTranslate } from "@/components/AutoTranslate";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { WebVitals } from "@/components/WebVitals";
import { InstallPrompt } from "@/components/InstallPrompt";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <AutoTranslate>
        <SiteHeader />
        <ToastProvider>
          <div style={{ flex: 1 }}>{children}</div>
        </ToastProvider>
        <SiteFooter />
        <ServiceWorkerRegister />
        <WebVitals />
        <InstallPrompt />
      </AutoTranslate>
    </I18nProvider>
  );
}