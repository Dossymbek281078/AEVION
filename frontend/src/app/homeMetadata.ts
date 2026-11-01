import type { Metadata } from "next";
import type { Lang } from "@/lib/i18n-data";

/**
 * Заголовок и описание главной — на языке гостя.
 *
 * Замер Науки 1.11.2026 (прод dc4a968f8, curl): h1 главной шёл по Accept-Language
 * (ru/en/kk), а <title> и lang="en" — всегда английские: русский гость и русский
 * робот видели русскую страницу с английским заголовком. Корневой макет оставлен
 * как есть (его metadata — умолчание для всех страниц), главная объявляет своё.
 */
export type HomeLang = "ru" | "en" | "kk";

export function homeLang(lang: Lang): HomeLang {
  return lang === "ru" || lang === "kk" ? lang : "en";
}

const TEXT: Record<HomeLang, { title: string; description: string }> = {
  ru: {
    title: "AEVION — доверенная инфраструктура для цифровых активов и ИС",
    description:
      "Платформа: регистрация прав (QRight), криптографические подписи (QSign), бюро авторства и приоритета, сертификация соответствия (Planet), премии, цифровой банк. DevHub пишет код и публикует сайт по одному предложению.",
  },
  en: {
    title: "AEVION — Trust infrastructure for digital assets & IP",
    description:
      "Global platform for IP registration (QRight), cryptographic signatures (QSign), authorship & prior-art bureau, compliance certification (Planet), awards and digital banking. DevHub writes the code and publishes a working site from one sentence.",
  },
  kk: {
    title: "AEVION — цифрлық активтер мен зияткерлік меншікке арналған сенім инфрақұрылымы",
    description:
      "Платформа: құқықтарды тіркеу (QRight), криптографиялық қолтаңбалар (QSign), авторлық және басымдық бюросы, сәйкестік сертификаты (Planet), сыйлықтар, цифрлық банк. DevHub бір сөйлем бойынша кодты жазып, сайтты жариялайды.",
  },
};

export function homeMetadata(lang: HomeLang): Metadata {
  const t = TEXT[lang];
  return {
    title: { absolute: t.title },
    description: t.description,
    openGraph: { title: t.title, description: t.description, type: "website", siteName: "AEVION" },
    twitter: { card: "summary_large_image", title: t.title, description: t.description },
    alternates: { canonical: "/" },
  };
}
