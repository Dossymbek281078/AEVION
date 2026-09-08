import { describe, expect, it } from "vitest";
import { planFromPdfSegments, readPdfSegments, type PdfSegments } from "./pdf";

/** Собирает минимальный НЕсжатый PDF с потоком содержимого. */
function makePdf(content: string): Uint8Array {
  const body =
    "%PDF-1.4\n" +
    "1 0 obj\n<< /Length " + content.length + " >>\nstream\n" +
    content +
    "\nendstream\nendobj\n" +
    "trailer\n<< /Root 1 0 R >>\n%%EOF\n";
  return new TextEncoder().encode(body);
}

describe("readPdfSegments — что нашлось в файле", () => {
  it("прямоугольник (re) даёт четыре отрезка и габарит в пунктах", async () => {
    // 0,0 размером 400×300 пунктов
    const r = await readPdfSegments(makePdf("0 0 400 300 re S"));
    expect(r.segments.length).toBe(4);
    expect(r.extentPt).toBe(400);
    expect(r.warnings).toEqual([]);
  });

  it("moveto/lineto строит ломаную, замыкание h добавляет последний отрезок", async () => {
    const r = await readPdfSegments(makePdf("10 10 m 110 10 l 110 60 l h S"));
    expect(r.segments.length).toBe(3);
    expect(r.segments[0]).toEqual({ x1: 10, y1: 10, x2: 110, y2: 10 });
    // h возвращает в стартовую точку
    expect(r.segments[2]).toEqual({ x1: 110, y1: 60, x2: 10, y2: 10 });
  });

  it("не-PDF отвергается объяснением, а не пустым успехом", async () => {
    const r = await readPdfSegments(new TextEncoder().encode("это просто текст"));
    expect(r.segments.length).toBe(0);
    expect(r.warnings[0]).toContain("%PDF-");
  });

  it("зашифрованный PDF назван зашифрованным, а не пустым", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.6\n<< /Encrypt 9 0 R >>\ntrailer\n%%EOF");
    const r = await readPdfSegments(bytes);
    expect(r.segments.length).toBe(0);
    expect(r.warnings[0]).toContain("паролем");
  });

  it("PDF-скан (картинка внутри) назван сканом — самая частая ошибка пользователя", async () => {
    const pdf =
      "%PDF-1.4\n1 0 obj\n<< /Filter /DCTDecode /Length 4 >>\nstream\nAAAA\nendstream\nendobj\n%%EOF\n";
    const r = await readPdfSegments(new TextEncoder().encode(pdf));
    expect(r.segments.length).toBe(0);
    expect(r.warnings.join(" ")).toMatch(/СКАН|картинка/);
  });

  it("отрезки короче пункта отбрасываются как мусор оформления", async () => {
    const r = await readPdfSegments(makePdf("0 0 m 0.4 0 l 0 0 m 100 0 l S"));
    expect(r.segments.length).toBe(1);
  });

  // Главный настоящий случай: AutoCAD/Revit пишут поток СЖАТЫМ (FlateDecode).
  // Без этой проверки весь разбор был бы зелёным на игрушечных несжатых
  // файлах и молчал бы на всех настоящих.
  it("Flate-сжатый поток распаковывается и даёт те же отрезки", async () => {
    const content = "0 0 400 300 re S";
    const raw = new TextEncoder().encode(content);
    const cs = new CompressionStream("deflate");
    const writer = cs.writable.getWriter();
    void writer.write(raw).then(() => writer.close());
    const reader = cs.readable.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) { chunks.push(value); total += value.length; }
    }
    const packed = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) { packed.set(c, at); at += c.length; }

    const head = new TextEncoder().encode(
      "%PDF-1.4\n1 0 obj\n<< /Filter /FlateDecode /Length " + packed.length + " >>\nstream\n",
    );
    const tail = new TextEncoder().encode("\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
    const bytes = new Uint8Array(head.length + packed.length + tail.length);
    bytes.set(head, 0);
    bytes.set(packed, head.length);
    bytes.set(tail, head.length + packed.length);

    const r = await readPdfSegments(bytes);
    expect(r.segments.length).toBe(4);
    expect(r.extentPt).toBe(400);
  });

  // В настоящих PDF /Length сплошь и рядом КОСВЕННАЯ ссылка: «/Length 12 0 R»
  // — это номер объекта, а не размер. Взяв его за длину, разбор обрезал бы
  // поток до 12 байт и объявил обычный чертёж сканом.
  it("косвенная ссылка /Length N 0 R не принимается за размер потока", async () => {
    const content = "0 0 400 300 re S";
    const NL = String.fromCharCode(10);
    const pdf =
      "%PDF-1.4" + NL + "1 0 obj" + NL + "<< /Length 12 0 R >>" + NL + "stream" + NL +
      content + NL + "endstream" + NL + "endobj" + NL + "%%EOF" + NL;
    const r = await readPdfSegments(new TextEncoder().encode(pdf));
    // содержимое длиной 16 символов; взяли бы 12 — «re» не разобралось бы
    expect(r.segments.length).toBe(4);
    expect(r.extentPt).toBe(400);
  });

  // Отрицательный контроль прибора: если бы распаковка «работала» на любом
  // мусоре, предыдущая проверка ничего не доказывала бы.
  it("битый Flate-поток не выдаётся за успешный разбор", async () => {
    const junk = new TextEncoder().encode("нисколько не deflate");
    const head = new TextEncoder().encode(
      "%PDF-1.4\n1 0 obj\n<< /Filter /FlateDecode /Length " + junk.length + " >>\nstream\n",
    );
    const tail = new TextEncoder().encode("\nendstream\nendobj\n%%EOF\n");
    const bytes = new Uint8Array(head.length + junk.length + tail.length);
    bytes.set(head, 0);
    bytes.set(junk, head.length);
    bytes.set(tail, head.length + junk.length);

    const r = await readPdfSegments(bytes);
    expect(r.segments.length).toBe(0);
    expect(r.warnings.length).toBeGreaterThanOrEqual(1);
  });
});

describe("planFromPdfSegments — масштаб задаёт человек", () => {
  const src: PdfSegments = {
    segments: [
      { x1: 0, y1: 0, x2: 400, y2: 0 },
      { x1: 400, y1: 0, x2: 400, y2: 300 },
      { x1: 400, y1: 300, x2: 0, y2: 300 },
      { x1: 0, y1: 300, x2: 0, y2: 0 },
    ],
    warnings: [],
    extentPt: 400,
  };

  it("габарит 400 пт при заданных 8 м даёт стену ровно 8 м", () => {
    const r = planFromPdfSegments(src, 8);
    expect(r.plan).not.toBeNull();
    expect(r.metersPerPt).toBeCloseTo(0.02, 9);
    const w = r.plan!.walls[0];
    expect(Math.hypot(w.x2 - w.x1, w.y2 - w.y1)).toBeCloseTo(8, 9);
    // вторая сторона пропорциональна: 300 пт × 0.02 = 6 м
    const w2 = r.plan!.walls[1];
    expect(Math.hypot(w2.x2 - w2.x1, w2.y2 - w2.y1)).toBeCloseTo(6, 9);
  });

  it("без габарита плана НЕТ — молча угадывать масштаб нельзя", () => {
    for (const bad of [0, -1, NaN, 0.2, 1000]) {
      const r = planFromPdfSegments(src, bad);
      expect(r.plan, `габарит ${bad} не должен давать план`).toBeNull();
      expect(r.warnings.join(" ")).toContain("масштаб");
    }
  });

  it("выбранный габарит назван в предупреждении — человек видит, из чего построено", () => {
    const r = planFromPdfSegments(src, 12);
    expect(r.warnings.join(" ")).toContain("12 м");
  });

  it("координаты нормируются к нулю независимо от смещения в PDF", () => {
    const shifted: PdfSegments = {
      ...src,
      segments: src.segments.map((s) => ({ x1: s.x1 + 500, y1: s.y1 + 700, x2: s.x2 + 500, y2: s.y2 + 700 })),
    };
    const r = planFromPdfSegments(shifted, 8);
    const xs = r.plan!.walls.flatMap((w) => [w.x1, w.x2]);
    const ys = r.plan!.walls.flatMap((w) => [w.y1, w.y2]);
    expect(Math.min(...xs)).toBeCloseTo(0, 9);
    expect(Math.min(...ys)).toBeCloseTo(0, 9);
  });

  it("обрезка длинного чертежа называет число отброшенных", () => {
    const many: PdfSegments = {
      segments: Array.from({ length: 450 }, (_, i) => ({ x1: 0, y1: i, x2: 400, y2: i })),
      warnings: [],
      extentPt: 450,
    };
    const r = planFromPdfSegments(many, 9);
    expect(r.truncated).toBe(50);
    expect(r.plan!.walls.length).toBe(400);
    expect(r.warnings.join(" ")).toContain("отброшено 50");
  });
});

describe("порог отсева мусора не съедает настоящие стены", () => {
  // Порог «короче 5 см — мусор оформления» никем не охранялся: подними его до
  // метров, и стены обычной квартиры тихо исчезнут, а план окажется пустым
  // или обрезанным. Человек увидит модель без половины перегородок и не
  // поймёт, что часть чертежа выбросили.
  const комната = (): PdfSegments => ({
    // прямоугольник 4 × 3 м плюс перегородка 2 м — самые короткие стены
    // настоящей квартиры, а не синтетика с длинными линиями
    segments: [
      { x1: 0, y1: 0, x2: 400, y2: 0 },
      { x1: 400, y1: 0, x2: 400, y2: 300 },
      { x1: 400, y1: 300, x2: 0, y2: 300 },
      { x1: 0, y1: 300, x2: 0, y2: 0 },
      { x1: 200, y1: 0, x2: 200, y2: 200 },
      // ⚠️ Простенок 30 см — НАСТОЯЩАЯ стена: край ниши, выступ у двери,
      // угол пилона. Без него порог проверялся только двухметровой стеной, и
      // мутация «отсеивать всё короче 0.5 м» проходила молча: такой фильтр
      // выбросил бы все простенки квартиры, а план выглядел бы правдоподобно.
      { x1: 200, y1: 250, x2: 230, y2: 250 },
    ],
    warnings: [], extentPt: 400, truncated: 0,
  });

  it("стена длиной 2 м остаётся в плане", () => {
    const r = planFromPdfSegments(комната(), 4); // 400 пунктов = 4 м
    expect(r.plan, "план не построился").not.toBeNull();
    const длины = r.plan!.walls.map((w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1));
    expect(r.plan!.walls.length, `осталось стен: ${r.plan!.walls.length} из 6`).toBe(6);
    expect(Math.min(...длины), "простенок 30 см выброшен как мусор").toBeGreaterThan(0.2);
  });

  it("контроль прибора: настоящий мусор всё ещё отсеивается", () => {
    // иначе «стены на месте» неотличимо от «фильтр вообще не работает»
    const с_мусором = комната();
    с_мусором.segments.push({ x1: 10, y1: 10, x2: 11, y2: 10 }); // 1 пункт = 1 см
    const r = planFromPdfSegments(с_мусором, 4);
    expect(r.plan!.walls.length, "штрих в 1 см попал в план как стена").toBe(6);
  });
});
