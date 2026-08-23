import type { Metadata } from "next";

// Заголовок живёт здесь, а не на странице, потому что страница клиентская
// ("use client"), а клиентский компонент в App Router не может экспортировать
// metadata. Без этого файла страница наследовала title корневого layout —
// замер 21.08.2026: шесть разделов отдавали ОДИН и тот же заголовок
// «AEVION — Trust infrastructure…», то есть во вкладке браузера, в закладках,
// в истории и в выдаче были неотличимы друг от друга. Шаблон "%s · AEVION"
// в корневом layout заведён ровно под это — оставалось подставить имя.
export const metadata: Metadata = {
  title: "Status",
  description: "Live health of every AEVION product, polled every 30 seconds.",
};

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
