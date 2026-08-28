import type { Metadata } from "next";
import { getApiBase } from "@/lib/apiBase";
import { buildAuthorPreview } from "./authorMetadata";

/**
 * Карточка пересланной ссылки на страницу автора — разбор в authorMetadata.ts.
 *
 * Ручка авторов только читает (проверено по коду: 0 записей на её 60 строках,
 * с контролем, что поиск вообще находит нужное место), поэтому показ карточки
 * в мессенджере ничего не меняет в данных.
 *
 * Индексацию НЕ включаю и не выключаю: у этого раздела своих указаний нет, и
 * менять поведение раздела заодно с починкой предпросмотра — не моё решение.
 */
async function fetchAuthor(slug: string) {
  try {
    const res = await fetch(
      `${getApiBase()}/api/pipeline/authors/${encodeURIComponent(slug)}`,
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
      name?: string;
      stats?: { certificates?: number; verifications?: number; countries?: string[] };
    };
    return { name: j?.name ?? null, stats: j?.stats ?? null };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const preview = buildAuthorPreview(await fetchAuthor(slug));
  return {
    title: preview.title,
    description: preview.description,
    openGraph: {
      title: preview.title,
      description: preview.description,
      type: "profile",
      siteName: "AEVION",
    },
    twitter: { card: "summary", title: preview.title, description: preview.description },
  };
}

export default function AuthorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
