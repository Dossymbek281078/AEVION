/**
 * Разбор SSE принимает CR, LF и CRLF — иначе поток молча пуст.
 *
 * 🔴 ПОВОД 30.09.2026, день запуска шахмат. Ручка тренера отдавала 31 байт —
 * один message_stop и ни одного кадра текста, — при том что тот же поставщик
 * по обычному пути отвечал полным разбором. Ошибок не было, поток закрывался
 * штатно: неисправность выглядела как исправная работа.
 *
 * Причина в разборе: границей блока считалось только "\n\n". У потока,
 * обрамлённого по CRLF, такой последовательности нет — между переводами строк
 * стоит возврат каретки. Границы не находились, весь ответ доезжал одним
 * куском в хвостовую ветку, строки data склеивались и JSON.parse их отвергал.
 *
 * Тест гоняет НАСТОЯЩИЙ адаптер (streamProvider), подменяя только сеть, и
 * сравнивает два обрамления одного и того же ответа. Разница между ними и
 * есть доказательство: одинаковые данные, разный разделитель.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { streamProvider, границаБлока } from "../src/services/qcoreai/providers";

function поток(текст: string): ReadableStream<Uint8Array> {
  const байты = new TextEncoder().encode(текст);
  return new ReadableStream({ start(c) { c.enqueue(байты); c.close(); } });
}

function ответГемини(разделитель: string): string {
  const кадр = (t: string) =>
    "data: " + JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] });
  return кадр("Привет") + разделитель + кадр(", мир") + разделитель;
}

async function собрать(разделитель: string): Promise<string> {
  process.env.GEMINI_API_KEY = "проба";
  vi.stubGlobal("fetch", async () => ({
    ok: true, status: 200, body: поток(ответГемини(разделитель)), text: async () => "",
  }));
  let acc = "";
  for await (const ev of streamProvider("gemini", [{ role: "user", content: "x" }], "gemini-2.5-flash", 0.7)) {
    if (ev.kind === "text" && ev.text) acc += ev.text;
  }
  return acc;
}

afterEach(() => vi.unstubAllGlobals());

describe("обрамление потока", () => {
  test("LF: текст доходит", async () => {
    expect(await собрать("\n\n")).toBe("Привет, мир");
  });

  test("🔴 CRLF: текст доходит ТОЖЕ", async () => {
    expect(
      await собрать("\r\n\r\n"),
      "поток, обрамлённый по CRLF, разобран как пустой — именно так молчал тренер",
    ).toBe("Привет, мир");
  });

  test("одинокий CR тоже разделитель", async () => {
    expect(await собрать("\r\r")).toBe("Привет, мир");
  });

  test("прибор исправен: граница ищется САМАЯ РАННЯЯ", () => {
    // Если искать разделители по очереди, поздний съест несколько блоков.
    const b = "a" + "\n\n" + "b" + "\r\n\r\n" + "c";
    const г = границаБлока(b);
    expect(г).not.toBeNull();
    expect(г!.начало).toBe(1);
    expect(b.slice(0, г!.начало)).toBe("a");
  });

  test("контроль: без пустой строки границы нет", () => {
    expect(границаБлока("data: {}")).toBeNull();
  });
});
