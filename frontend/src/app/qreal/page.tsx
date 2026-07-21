import type { Metadata } from "next";
import QRealClient from "./_client";

const TITLE = "QReal Studio — полностью живое AI-видео без съёмки";
const DESCRIPTION =
  "Люди, дети, животные, птицы, природа и звук — сгенерированы и неотличимы от съёмки, "
  + "без актёра и без референс-видео. Бриф → раскадровка → рендер с директивами реализма → "
  + "QC-петля из 14 критериев → неотключаемая AI-маркировка (C2PA-style, EU AI Act art. 50).";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "AI video", "generative video", "photorealistic", "text to video", "no actor",
    "realism QC", "provenance", "C2PA", "AEVION", "QReal",
  ],
  alternates: { canonical: "/qreal" },
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", url: "/qreal", siteName: "AEVION" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function Page() {
  return <QRealClient />;
}
