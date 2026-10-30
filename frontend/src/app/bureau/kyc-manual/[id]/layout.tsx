import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiUrl } from "@/lib/apiBase";

/* Запрет индексации: страница ручной проверки личности для конкретной заявки.
 *
 * Требует входа и показывает загрузку документов владельца — роботу видна
 * пустая оболочка. Без своего правила она молча наследовала canonical "/bureau"
 * из макета раздела (сторож canonicalNotInherited, волна 8, 21.10.2026).
 * Образец — cert/[certId]/notarize/layout.tsx. */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

/**
 * 27.10.2026: честный 404 для несуществующей заявки.
 *
 * Сторож мягких 404 (soft404-2026-10-27.md): `/bureau/kyc-manual/qqq-no-such-987` отвечал 200 —
 * страница клиентская, она сама спрашивает бэкенд и рисует «не найдено», но статус ответа уже 200,
 * и поисковик с проверяющим видят «страница есть». Макет спрашивает бэкенд на сервере и для 404/400
 * отдаёт настоящий 404 (`notFound()`); сама страница не меняется — её тест рендерит её напрямую.
 *
 * Бэкенд не ответил (сеть, 5xx, таймаут) — пропускаем к странице: она покажет свой честный отказ,
 * а 404 на живую заявку из-за нашей же сети был бы ложью в обратную сторону.
 */
export const dynamic = "force-dynamic";

export default async function BureauKycManualLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id || id.length > 128) notFound();
  let status = 0;
  try {
    const r = await fetch(apiUrl(`/api/bureau/kyc-manual/${encodeURIComponent(id)}`), {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    status = r.status;
  } catch {
    status = 0;
  }
  if (status === 404 || status === 400) notFound();
  return <>{children}</>;
}
