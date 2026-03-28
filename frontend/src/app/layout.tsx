import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ToastProvider } from "@/components/ToastProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AEVION — IP-инфраструктура, реестр и compliance",
    template: "%s · AEVION",
  },
  description:
    "Платформа для реестра цифровых объектов (QRight), криптоподписи (QSign), патентного бюро и слоя соответствия (Planet). Интерактивная карта экосистемы Globus — 27 узлов. Демонстрируемый MVP для инвесторов и интеграторов.",
  openGraph: {
    title: "AEVION — IP-инфраструктура и Globus",
    description:
      "Реестр, подпись, бюро, compliance и карта продуктов. Живой продуктовый контур.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
      >
        <SiteHeader />
        <ToastProvider>
          <div style={{ flex: 1 }}>{children}</div>
        </ToastProvider>
        <SiteFooter />
      </body>
    </html>
  );
}
