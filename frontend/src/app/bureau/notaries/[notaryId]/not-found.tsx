import Link from "next/link";

/**
 * Ответ «такого нотариуса нет в реестре» с ЧЕСТНЫМ кодом 404.
 *
 * Раньше страница отвечала 200 и рисовала этот же текст. Для поисковика это
 * значило «страница существует», а выдуманных идентификаторов бесконечно
 * много — бесконечный индексируемый мусор на РЕЕСТРЕ, то есть там, где
 * доверие и есть продукт.
 *
 * Своя страница, а не общая: здесь проверяют запись в реестре, и «такого
 * нет» — это ОТВЕТ, за которым человек пришёл, а не ошибка навигации.
 *
 * Показывается ТОЛЬКО когда сервер авторитетно ответил 404; при
 * недоступности бэкенда страница остаётся с кодом 200 и прежним видом.
 * Текст английский — как и весь модуль Bureau.
 */
export default function NotaryNotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-400">
      <div className="text-5xl">⚖️</div>
      <p>Notary not found.</p>
      <p className="text-xs text-slate-500 max-w-sm text-center">
        No entry with this id in the AEVION Bureau notary registry. Check the
        link — the id may have been copied incompletely.
      </p>
      <Link href="/bureau/notaries" className="text-teal-400 underline text-sm">
        ← Notary Registry
      </Link>
    </div>
  );
}
