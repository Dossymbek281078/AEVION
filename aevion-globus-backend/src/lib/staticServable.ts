/**
 * Может ли статический хостинг отдать этот проект.
 *
 * Cloudflare Pages отдаёт файлы КАК ЕСТЬ. Проект без `index.html` в корне
 * загружается успешно и честно отвечает 404 — публикация при этом выглядит
 * удавшейся. Замер на проде 24.09.2026: стек `next` (pages/index.jsx) →
 * «ok: true, liveUrl: …» и 404 через три минуты; тот же промпт на стеке
 * `static` → 200 за 20 секунд.
 *
 * Путь к файлу приходит из хранилища в разных написаниях: `index.html`,
 * `./index.html`, `/index.html`, иногда с обратными косыми от Windows.
 * Регистр в CF не важен для корня, поэтому сравниваем в нижнем.
 */
export function корневойIndexHtml(пути: readonly string[]): string | null {
  for (const сырой of пути) {
    const путь = String(сырой ?? "")
      .replace(/\\/g, "/")
      .replace(/^\.?\//, "")
      .trim();
    if (путь.toLowerCase() === "index.html") return сырой;
  }
  return null;
}

/** Короткая форма для ветвления в маршруте. */
export function можноСлужитьСтатикой(пути: readonly string[]): boolean {
  return корневойIndexHtml(пути) !== null;
}
