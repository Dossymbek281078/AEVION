import type { Metadata } from "next";

/* Только canonical, ничего больше.
 *
 * ЗАЧЕМ. Страница читает ШЕСТЬ фильтров из адреса — kind, set, sort, status,
 * tag, tier. Каждая их комбинация даёт новый адрес с почти тем же
 * содержимым, и без canonical поисковик вправе индексировать их как разные
 * страницы. Сотни почти одинаковых адресов делят между собой вес одной.
 *
 * Проверено на живом сайте 30.08.2026:
 *     /modules                      canonical НЕТ
 *     /modules?tier=pro             canonical НЕТ
 *     /modules?sort=price&kind=ai   canonical НЕТ
 *     /pricing                      canonical есть   <- контроль, проба различает
 *
 * Почему отдельным файлом, а не правкой page.tsx: ту страницу правят две
 * чужие ветки. Новый файл конфликтовать не может — проверено, что layout.tsx
 * здесь не существует.
 *
 * Заголовок и описание страница задаёт сама; здесь их намеренно НЕТ, чтобы не
 * спорить с ней. Next сливает метаданные сверху вниз, и page.tsx перекрывает
 * layout по объявленным полям; canonical она не объявляет — применится этот. */
export const metadata: Metadata = {
  alternates: { canonical: "/modules" },
};

export default function ModulesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
