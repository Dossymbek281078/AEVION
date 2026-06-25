import type { Metadata } from "next";
import type { ReactNode } from "react";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

export const metadata: Metadata = {
  title: "AEVION Constitution Academy — 8 lessons · Free Course",
  description:
    "Бесплатный интерактивный курс по 4 опорам политэкономии: пол снизу, закон над верхом, ротация + множественные статусы, растущий пирог. Теория + исторический пример + практическое задание на каждый из 8 ползунков. Сертификат после прохождения.",
  alternates: { canonical: `${SITE}/constitution/learn` },
  openGraph: {
    title: "AEVION Constitution Academy — 8 уроков",
    description:
      "Курс по политэкономии: 8 уроков, по одному на каждую опору устройства мира. Прогресс + сертификат.",
    url: `${SITE}/constitution/learn`,
    type: "website",
  },
};

export default function LearnLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
