import type { Metadata } from "next";

/* Значок модуля: страница для ВСТРАИВАНИЯ, а не для чтения.
 *
 * Её адрес дают, чтобы вставить значок к себе на сайт или в README; человек
 * по нему не приходит и в поиске её не ищет. В выдаче она соревновалась бы со
 * страницей самого модуля, показывая при этом одну картинку.
 *
 * Заведено 30.08.2026 при разборе дочерних страниц каталога: когда каталог
 * получает свой canonical, все дочерние начинают наследовать его адрес.
 * Двум другим (`modules/[id]` и `modules/tags/[tag]`) дан СВОЙ динамический
 * canonical; этой он не нужен — ей нужен запрет показа.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function ModuleBadgeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
