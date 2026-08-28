import type { Metadata } from "next";
import { getApiBase } from "@/lib/apiBase";
import { buildVerifyPreview, VERIFY_PREVIEW_FALLBACK } from "./verifyMetadata";

/**
 * Карточка пересланной ссылки на сертификат — разбор в verifyMetadata.ts.
 *
 * Данные берутся из ОФЛАЙН-ПАКЕТА, а не из ручки проверки: ручка проверки
 * наращивает публичный счётчик «verified N×», и тогда каждый показ карточки в
 * мессенджере накручивал бы число. Пакет только читает.
 *
 * Запрет индексации родительского макета сохранён намеренно и повторён здесь
 * явно: страница содержит имя автора, и решение её не индексировать принято до
 * меня. Предпросмотр ссылки работает независимо от индексации.
 */
async function fetchCert(id: string) {
  try {
    const res = await fetch(
      `${getApiBase()}/api/pipeline/certificate/${encodeURIComponent(id)}/bundle.json`,
      {
        // Таймаут обязателен: без него зависший API подвешивает ВЫДАЧУ
        // страницы — метаданные считаются до отправки ответа. Взято у
        // работающего образца (страница сертификата).
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as {
      certificate?: { title?: string; kind?: string; author?: string; protectedAt?: string };
      proofs?: { openTimestamps?: { status?: string | null; bitcoinBlockHeight?: number | null } | null };
    };
    const c = j?.certificate;
    if (!c) return null;
    return {
      title: c.title ?? null,
      kind: c.kind ?? null,
      author: c.author ?? null,
      protectedAt: c.protectedAt ?? null,
      bitcoinAnchor: j?.proofs?.openTimestamps ?? null,
    };
  } catch {
    // «Спросить не удалось» — не повод выдумывать: ниже будет общая карточка.
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const preview = buildVerifyPreview(await fetchCert(id));
  const generic = preview.title === VERIFY_PREVIEW_FALLBACK.title;

  return {
    title: preview.title,
    description: preview.description,
    robots: { index: false, follow: true },
    openGraph: {
      title: preview.title,
      description: preview.description,
      type: generic ? "website" : "article",
      siteName: "AEVION",
    },
    twitter: {
      // Крупная карточка: картинка у сегмента теперь есть (opengraph-image.tsx).
      // Без картинки крупный тип показывал бы пустоту — ровно то, что чинилось
      // у страницы сертификата.
      card: "summary_large_image",
      title: preview.title,
      description: preview.description,
    },
  };
}

export default function VerifyCertificateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
