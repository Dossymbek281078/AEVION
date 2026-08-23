import type { Metadata } from "next";

// Заголовок живёт здесь, а не на странице, потому что страница клиентская
// ("use client"), а клиентский компонент в App Router не может экспортировать
// metadata. Без этого файла страница наследовала title корневого layout —
// замер 21.08.2026: шесть разделов отдавали ОДИН и тот же заголовок
// «AEVION — Trust infrastructure…», то есть во вкладке браузера, в закладках,
// в истории и в выдаче были неотличимы друг от друга. Шаблон "%s · AEVION"
// в корневом layout заведён ровно под это — оставалось подставить имя.
export const metadata: Metadata = {
  title: "Reconstruct a key from 2 shards",
  description: "Live demo against the real AEVION backend: an ephemeral Ed25519 key is split and rebuilt from two shards in your browser.",
};

export default function ReconstructDemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
