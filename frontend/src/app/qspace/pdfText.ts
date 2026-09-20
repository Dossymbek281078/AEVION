import type { ЭлементТекста } from "./dimensionScale";

export type ТекстPdf =
  | { ok: true; items: ЭлементТекста[] }
  | { ok: false; reason: string };

/**
 * Надписи первой страницы PDF — через pdf.js (Mozilla).
 *
 * Свой разбор (pdf.ts) текст не читает: числа CAD-чертежа лежат во встроенных
 * шрифтах Identity-H с таблицей ToUnicode, и корректное чтение — это отдельный
 * движок. pdf.js грузится ЛЕНИВО, только когда человек открыл PDF в QSpace:
 * остальные страницы сайта не тяжелеют.
 *
 * Отказ возвращается отказом с причиной, а не пустым списком: «надписей нет» и
 * «прочитать не удалось» — разные исходы, и второй человеку надо назвать.
 */
export async function текстPdf(bytes: Uint8Array, page = 1): Promise<ТекстPdf> {
  try {
    const pdfjs = await import("pdfjs-dist");
    // Отдельный рабочий поток требует отдельного файла в сборке. Модуль
    // обработчика, загруженный в основной поток, pdf.js подхватывает сам
    // (globalThis.pdfjsWorker) — для одного листа этого достаточно.
    await import("pdfjs-dist/build/pdf.worker.min.mjs");
    // копия: pdf.js забирает буфер себе, а байты ещё нужны разбору линий
    const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true }).promise;
    try {
      const pg = await doc.getPage(Math.min(Math.max(1, page), doc.numPages));
      const tc = await pg.getTextContent();
      const items: ЭлементТекста[] = [];
      for (const it of tc.items) {
        if ("str" in it) items.push({ str: it.str, transform: it.transform, width: it.width });
      }
      return { ok: true, items };
    } finally {
      await doc.destroy();
    }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Надписи КАЖДОЙ страницы одной строкой (первые maxItems элементов) — чтобы найти
 * в альбоме дизайн-проекта лист «обмерный план» / «план стен», а не брать
 * страницу розеток. Отказ — пустой список: выбор тогда делает счёт линий.
 * ⚠️ Порядок страниц здесь — как у pdf.js (по дереву /Kids), а в pdf.ts — по
 * порядку объектов в файле; у обычных генераторов они совпадают, поэтому клиент
 * принимает найденную страницу, только если на ней в разборе линий не пусто.
 */
export async function текстСтраниц(bytes: Uint8Array, maxItems = 200): Promise<string[]> {
  try {
    const pdfjs = await import("pdfjs-dist");
    await import("pdfjs-dist/build/pdf.worker.min.mjs");
    const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true }).promise;
    try {
      const out: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const tc = await (await doc.getPage(i)).getTextContent();
        out.push(tc.items.slice(0, maxItems).map((it) => ("str" in it ? it.str : "")).join(" "));
      }
      return out;
    } finally {
      await doc.destroy();
    }
  } catch {
    return [];
  }
}
