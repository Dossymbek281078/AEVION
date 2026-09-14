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
export async function текстPdf(bytes: Uint8Array): Promise<ТекстPdf> {
  try {
    const pdfjs = await import("pdfjs-dist");
    // Отдельный рабочий поток требует отдельного файла в сборке. Модуль
    // обработчика, загруженный в основной поток, pdf.js подхватывает сам
    // (globalThis.pdfjsWorker) — для одного листа этого достаточно.
    await import("pdfjs-dist/build/pdf.worker.min.mjs");
    // копия: pdf.js забирает буфер себе, а байты ещё нужны разбору линий
    const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true }).promise;
    try {
      const page = await doc.getPage(1);
      const tc = await page.getTextContent();
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
