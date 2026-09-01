import type { Metadata } from "next";

/*
 * Печатная копия глоссария — то же содержимое в другой обёртке.
 * Для дубля правильный ответ не запрет показа, а указание на исходную страницу:
 * вес ссылок достаётся глоссарию, а в выдаче не соревнуются две копии одного текста.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/smeta-trainer/glossary" },
};

export default function SmetaGlossaryPrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
