import { describe, expect, it } from "vitest";
import { MAX_SEGMENTS, planFromPdfSegments, readPdfSegments, type PdfSegments } from "./pdf";
import { findRooms } from "./rooms";

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

describe("PDF без слоёв: рамка листа и линии через весь лист — не стены", () => {
  // Замер 20.09.2026 на обмерном плане Belmont (56 тыс. линий, слоёв нет): рамка листа и
  // штамп становились «комнатами» на 48 и 41 м², выноска через весь лист резала план.
  it("комната 200×150 внутри рамки 1000×700 с диагональю через лист: комната одна, рамка — нет", async () => {
    const рамка = "0 0 1000 700 re S";
    const диагональ = "0 0 m 1000 700 l S";
    const комната = "400 300 200 150 re S";
    // у настоящего листа внутри рамки много линий (размеры, мебель): 60 коротких штрихов
    const штрихи = Array.from({ length: 60 }, (_, i) => `${420 + i * 2} 250 m ${421 + i * 2} 250 l`).join(" ") + " S";
    const src = await readPdfSegments(makePdf(`${рамка} ${диагональ} ${комната} ${штрихи}`));
    expect(src.segments.length).toBe(69);
    const r = planFromPdfSegments(src, 10);
    expect(r.warnings.join(" ")).toMatch(/Рамка листа: 4/);
    expect(r.warnings.join(" ")).toMatch(/длиннее листа/);
    expect(r.plan!.walls.length).toBe(4); // штрихи короче 5 см отпадают позже, как и раньше
    const rooms = findRooms(r.plan!);
    expect(rooms.rooms.length).toBe(1);
    expect(rooms.totalArea).toBeGreaterThan(1.8); // 2×1.5 м минус толщина стен на сетке 5 см
    expect(rooms.totalArea).toBeLessThan(3.1);
  });
});

/** Двухстраничный PDF: у каждой страницы свой поток содержимого. */
function makePdf2(p1: string, p2: string): Uint8Array {
  const NL = String.fromCharCode(10);
  const body = [
    "%PDF-1.4",
    "1 0 obj", "<< /Type /Pages /Kids [2 0 R 4 0 R] /Count 2 >>", "endobj",
    "2 0 obj", "<< /Type /Page /Parent 1 0 R /Contents 3 0 R >>", "endobj",
    "3 0 obj", "<< /Length " + p1.length + " >>", "stream", p1, "endstream", "endobj",
    "4 0 obj", "<< /Type /Page /Parent 1 0 R /Contents 5 0 R >>", "endobj",
    "5 0 obj", "<< /Length " + p2.length + " >>", "stream", p2, "endstream", "endobj",
    "trailer", "<< /Root 1 0 R >>", "%%EOF", "",
  ].join(NL);
  return new TextEncoder().encode(body);
}

describe("planFromPdfSegments с областью плана: линии вне прямоугольника не стены", () => {
  it("комната внутри области остаётся, таблица снаружи выпадает, и это сказано словами", async () => {
    const src = await readPdfSegments(makePdf("100 100 200 150 re S 600 100 100 50 re S"));
    const r = planFromPdfSegments(src, 8, "размеры", { x0: 90, y0: 90, x1: 310, y1: 260 });
    expect(r.plan!.walls.length).toBe(4);
    expect(r.warnings.join(" ")).toMatch(/вне их прямоугольника 4 линий/);
    expect(findRooms(r.plan!).rooms.length).toBe(1);
  });
  it("область не применяется, если внутри неё осталось меньше половины линий (числа не вокруг плана)", async () => {
    const src = await readPdfSegments(makePdf("100 100 200 150 re S 600 100 100 50 re S 700 300 100 50 re S"));
    const r = planFromPdfSegments(src, 8, "размеры", { x0: 90, y0: 90, x1: 310, y1: 260 });
    expect(r.plan!.walls.length).toBe(12);
    expect(r.warnings.join(" ")).not.toMatch(/вне их прямоугольника/);
  });
  it("со слоем стен область не применяется: стены точные, а цепочки не окружают весь план (LA VIE: кухня отрезалась)", async () => {
    const src = await readPdfSegments(makePdf("100 100 200 150 re S 600 100 100 50 re S"));
    const соСлоем: PdfSegments = { ...src, wallLayers: ["Стены"] };
    const r = planFromPdfSegments(соСлоем, 8, "размеры", { x0: 90, y0: 90, x1: 310, y1: 260 });
    expect(r.plan!.walls.length).toBe(8);
    expect(r.warnings.join(" ")).not.toMatch(/вне их прямоугольника/);
  });
});

describe("PDF без слоёв: размерные цепочки и фигуры", () => {
  it("линия, вдоль которой стоят размерные числа, — не стена; стены без чисел остаются", async () => {
    // коробка 400×300 и размерная линия под ней (y=40) с числами вдоль неё
    const src = await readPdfSegments(makePdf("100 100 400 300 re S 100 40 m 500 40 l S"));
    const числа = [150, 250, 350, 450, 200, 300].map((x) => ({ x, y: 44 }));
    const r = planFromPdfSegments(src, 8, "размеры", null, числа);
    expect(r.plan!.walls.length).toBe(4);
    expect(r.warnings.join(" ")).toMatch(/Размерные цепочки \(1 линий/);
    // контроль: без чисел линия остаётся
    expect(planFromPdfSegments(src, 8).plan!.walls.length).toBe(5);
  });
  it("короткие косые штрихи (штриховка, засечки) — не стены, длинная косая стена остаётся", async () => {
    // коробка 400×300 (8 м на 1000 пт → 100 пт = 0.8 м), косая стена 200 пт (1.6 м) и 8 штрихов по 30 пт (0.24 м)
    const штрихи = Array.from({ length: 8 }, (_, i) => `${120 + i * 30} 120 m ${140 + i * 30} 140 l`).join(" ") + " S";
    const src = await readPdfSegments(makePdf(`100 100 400 300 re S 100 100 m 300 300 l S ${штрихи}`));
    const числа = [150, 250, 350, 450, 200, 300].map((x) => ({ x, y: 40 }));
    const r = planFromPdfSegments(src, 8, "размеры", null, числа);
    expect(r.warnings.join(" ")).toMatch(/Короткие косые штрихи \(8/);
    expect(r.plan!.walls.length).toBe(5);
    // контроль: без размерных чисел правило молчит — штрихи остаются
    expect(planFromPdfSegments(src, 8).plan!.walls.length).toBe(13);
  });
  it("выносные линии размеров (короткие, упёртые в цепочку) — не стены; план получает looseWalls", async () => {
    // коробка (8 м на 400 пт), размерная линия y=40 с числами и две выносные линии от неё вверх по 20 пт (0.4 м)
    const src = await readPdfSegments(makePdf("100 100 400 300 re S 100 40 m 500 40 l S 100 40 m 100 60 l S 500 40 m 500 60 l S"));
    const числа = [150, 250, 350, 450, 200, 300].map((x) => ({ x, y: 44 }));
    const r = planFromPdfSegments(src, 8, "размеры", null, числа);
    expect(r.warnings.join(" ")).toMatch(/Выносные линии размеров \(2\)/);
    expect(r.plan!.walls.length).toBe(4);
    expect(r.plan!.looseWalls).toBe(true);
    // контроль: без размерных чисел флага нет и линии остаются
    const без = planFromPdfSegments(src, 8);
    expect(без.plan!.looseWalls).toBeUndefined();
    expect(без.plan!.walls.length).toBe(7);
    // одиночная линия после чистки — грань стены: 0.10 м; без чистки — прежние 0.15
    expect(r.plan!.walls.every((w) => Math.abs(w.thickness - 0.1) < 1e-9)).toBe(true);
    expect(без.plan!.walls.every((w) => Math.abs(w.thickness - 0.15) < 1e-9)).toBe(true);
  });
  it("одиночная короткая линия внутри комнаты (значок) — не стена; короткая, упёртая в стену, — остаётся", async () => {
    // коробка 400×300 (8 м / 400 пт = 2 см/пт): значок радиатора 30 пт (0.6 м) посреди комнаты и
    // простенок 30 пт, упёртый в левую стену; цепочка с числами — чтобы чистка включилась
    const src = await readPdfSegments(makePdf("100 100 400 300 re S 250 250 m 280 250 l S 100 200 m 130 200 l S 100 40 m 500 40 l S"));
    const числа = [150, 250, 350, 450, 200, 300].map((x) => ({ x, y: 44 }));
    const r = planFromPdfSegments(src, 8, "размеры", null, числа);
    expect(r.warnings.join(" ")).toMatch(/Одиночные короткие линии \(1/);
    expect(r.plan!.walls.length).toBe(5);
    // начало координат — по всем линиям файла (включая цепочку y=40), поэтому проверяем форму, а не y
    expect(r.plan!.walls.some((w) => Math.abs(w.y1 - w.y2) < 1e-6 && Math.min(w.x1, w.x2) < 0.01 && Math.abs(Math.abs(w.x2 - w.x1) - 0.6) < 0.02), "простенок у стены остался").toBe(true);
  });
  it("отрезки одного пути несут общий номер, контур заливки помечен fill", async () => {
    const src = await readPdfSegments(makePdf("0 0 m 100 0 l 100 50 l h B 200 0 m 300 0 l S"));
    const пути = new Set(src.segments.map((s) => s.path));
    expect(пути.size).toBe(2);
    expect(src.segments.filter((s) => s.fill).length).toBe(3);
    expect(src.segments.filter((s) => !s.fill).length).toBe(1);
  });
  it("тридцать узких замкнутых прямоугольников — стены с толщиной по короткой стороне", async () => {
    const прямоугольники = Array.from({ length: 30 }, (_, i) => `${100 + i * 30} 100 10 200 re S`).join(" ");
    const src = await readPdfSegments(makePdf(`${прямоугольники} 50 50 m 60 50 l S`));
    const r = planFromPdfSegments(src, 20); // 20 м на 1000 пт → 10 пт = 0.2 м
    expect(r.warnings.join(" ")).toMatch(/30 перегородок-прямоугольников/);
    expect(r.plan!.walls.length).toBe(30);
    expect(r.plan!.walls.every((w) => Math.abs(w.thickness - 0.2) < 0.02)).toBe(true);
  });
});

describe("многостраничный PDF (альбом дизайн-проекта) разбирается по страницам", () => {
  // Замер 20.09.2026: альбомы на 15 и 45 страниц ложились друг на друга — 0 и 1 комната.
  const стр1 = "0 0 400 300 re S";                                // коробка, 4 линии
  const стр2 = "0 0 400 300 re S 200 0 m 200 300 l S 50 50 m 60 50 l S"; // та же коробка + перегородка + штрих: 6 линий
  it("без указания берётся страница с наибольшим числом линий, и это сказано словами", async () => {
    const src = await readPdfSegments(makePdf2(стр1, стр2));
    expect(src.pages).toBe(2);
    expect(src.page).toBe(2);
    expect(src.pageSegmentCounts).toEqual([4, 6]);
    expect(src.segments.length).toBe(6);
    expect(src.warnings.join(" ")).toMatch(/В файле 2 страниц — взята страница 2/);
  });
  it("указанная страница берётся целиком и без чужих линий", async () => {
    const src = await readPdfSegments(makePdf2(стр1, стр2), { page: 1 });
    expect(src.page).toBe(1);
    expect(src.segments.length).toBe(4);
    expect(findRooms(planFromPdfSegments(src, 8).plan!).rooms.length).toBe(1);
  });
  it("одностраничный файл страниц не объявляет и предупреждения о выборе не даёт", async () => {
    const src = await readPdfSegments(makePdf("0 0 400 300 re S"));
    expect(src.pages ?? 1).toBe(1);
    expect(src.warnings.join(" ")).not.toMatch(/страниц/);
  });
});

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
    expect(r.segments[0]).toMatchObject({ x1: 10, y1: 10, x2: 110, y2: 10 });
    // h возвращает в стартовую точку
    expect(r.segments[2]).toMatchObject({ x1: 110, y1: 60, x2: 10, y2: 10 });
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

  // Порог 0.2 пункта ЛИСТА: после матрицы cm план в масштабе ~42 мм/пт делает
  // короткие торцы перегородок длиной в доли пункта, и прежний 1 пт их выбрасывал.
  it("отрезки короче 0.2 пункта отбрасываются как мусор оформления, 0.4 — остаются", async () => {
    const r = await readPdfSegments(makePdf("0 0 m 0.1 0 l 0 0 m 0.4 0 l 0 0 m 100 0 l S"));
    expect(r.segments.length).toBe(2);
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

describe("PDF честно признаёт, что не отличает стену от размерной линии", () => {
  // Разбор DXF отбирает отрезки по слою стен и предупреждает, когда такого
  // слоя нет. У PDF отбора нет вовсе — слоёв в потоке содержимого не видно, —
  // и путь PDF об этом МОЛЧАЛ. Два пути делали одинаково рискованную вещь, а
  // признавался только один.
  const прямоугольник: PdfSegments = {
    segments: [
      { x1: 0, y1: 0, x2: 400, y2: 0 },
      { x1: 400, y1: 0, x2: 400, y2: 300 },
      { x1: 400, y1: 300, x2: 0, y2: 300 },
      { x1: 0, y1: 300, x2: 0, y2: 0 },
    ],
    warnings: [],
    extentPt: 400,
  };

  it("говорит, сколько линий взято и почему это риск", () => {
    const w = planFromPdfSegments(прямоугольник, 8).warnings.join(" ");
    expect(w).toMatch(/Взяты ВСЕ 4 линий/);
    expect(w, "не названо, чем это грозит").toMatch(/размер|мебель|рамка/);
    expect(w, "не сказано, что делать").toMatch(/глазами/);
  });

  it("контроль: число в предупреждении — настоящее, а не постоянное", () => {
    // иначе «Взяты ВСЕ N» неотличимо от текста с зашитым числом
    const шесть: PdfSegments = {
      segments: [
        ...прямоугольник.segments,
        { x1: 100, y1: 0, x2: 100, y2: 300 },
        { x1: 200, y1: 0, x2: 200, y2: 300 },
      ],
      warnings: [],
      extentPt: 400,
    };
    expect(planFromPdfSegments(шесть, 8).warnings.join(" ")).toMatch(/Взяты ВСЕ 6 линий/);
  });
});

describe("стены двумя линиями сводятся и в PDF", () => {
  // PDF приходит из той же CAD-программы, что и DXF, — просто напечатан. Значит
  // и манера черчения та же: у стены рисуют две грани. Путь PDF оставался без
  // сведения после того, как его получил DXF, и это ровно тот случай, когда
  // «починили аналог, а не все места».
  const пара = (t: number): PdfSegments => ({
    // 400 пт = 8 м, значит 1 пт = 0.02 м; зазор t пт = t*0.02 м
    segments: [
      { x1: 0, y1: 0, x2: 400, y2: 0 },
      { x1: 0, y1: -t, x2: 400, y2: -t },
      { x1: 400, y1: 0, x2: 400, y2: 300 },
      { x1: 400 + t, y1: 0, x2: 400 + t, y2: 300 },
      { x1: 0, y1: 300, x2: 400, y2: 300 },
      { x1: 0, y1: 0, x2: 0, y2: 300 },
    ],
    warnings: [],
    extentPt: 400,
  });

  it("пара граней становится одной стеной, толщина из чертежа", () => {
    // зазор 10 пт × 0.02 = 0.2 м — правдоподобная толщина стены
    const r = planFromPdfSegments(пара(10), 8);
    expect(r.plan, "план не построился").not.toBeNull();
    expect(r.plan!.walls.length, "грани не сведены").toBe(4);
    const сведённые = r.plan!.walls.filter((w) => Math.abs(w.thickness - 0.2) < 1e-6);
    expect(сведённые.length, "толщина не взята из чертежа").toBe(2);
    expect(r.warnings.join(" ")).toMatch(/двумя линиями/);
  });

  it("контроль: одиночные линии НЕ сводятся и сообщения нет", () => {
    const r = planFromPdfSegments({
      segments: [
        { x1: 0, y1: 0, x2: 400, y2: 0 },
        { x1: 400, y1: 0, x2: 400, y2: 300 },
        { x1: 0, y1: 300, x2: 400, y2: 300 },
        { x1: 0, y1: 0, x2: 0, y2: 300 },
      ],
      warnings: [],
      extentPt: 400,
    }, 8);
    expect(r.plan!.walls.length).toBe(4);
    expect(r.warnings.join(" ")).not.toMatch(/двумя линиями/);
    for (const w of r.plan!.walls) expect(w.thickness).toBeCloseTo(0.15, 6);
  });

  it("план из PDF называет себя pdf, а не dxf", () => {
    // поле уезжает в сохранённый файл проекта — то есть врёт в том, что
    // человек уносит с собой и отдаёт подрядчику
    const r = planFromPdfSegments(пара(10), 8);
    expect(r.plan!.source).toBe("pdf");
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
      segments: Array.from({ length: MAX_SEGMENTS + 50 }, (_, i) => ({ x1: 0, y1: i, x2: 400, y2: i })),
      warnings: [],
      extentPt: MAX_SEGMENTS + 50,
    };
    const r = planFromPdfSegments(many, 9);
    expect(r.truncated).toBe(50);
    expect(r.plan!.walls.length).toBe(MAX_SEGMENTS);
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

/**
 * Разрыв в геометрии — самая дорогая тихая ошибка из возможных у PDF.
 *
 * Габарит в пунктах это ЕДИНСТВЕННОЕ, к чему привязан масштаб: человек называет
 * длину большей стороны, и по ней считаются все размеры и вся смета. Если в
 * файле не один лист, а два (план и штамп, план и экспликация, две страницы),
 * габарит охватывает оба.
 *
 * Замер до проверки:
 *
 *     один лист 400 пт                   габарит  400 пт, предупреждений 0
 *     лист 400 пт + штамп в стороне      габарит 2400 пт, предупреждений 0
 *
 * Вторая строка означала бы: человек вводит «12 м по большей стороне», план
 * становится 2 м вместо 12, смета врёт в ШЕСТЬ раз — и ни одного признака.
 *
 * Признак структурный: пустой промежуток, где чертежа нет вовсе. Считается по
 * ПОКРЫТИЮ отрезками, а не по их серединам — первая редакция брала середины и
 * давала «разрыв 50 %» на обычном прямоугольнике, потому что у четырёх сторон
 * середины естественно разнесены. Поймал контроль на одном листе.
 */
describe("разрыв в геометрии PDF", () => {
  const пдф = (потоки: string[]): Uint8Array => {
    let t = "%PDF-1.4\n";
    for (const p of потоки) {
      t += `1 0 obj\n<< /Length ${p.length} >>\nstream\n${p}\nendstream\nendobj\n`;
    }
    return new TextEncoder().encode(t + "%%EOF\n");
  };
  const лист = "0 0 m 400 0 l 400 300 l 0 300 l h S";

  it("контроль: один лист молчит — обычный прямоугольник не разрыв", async () => {
    const r = await readPdfSegments(пдф([лист]));
    expect(r.segments.length).toBeGreaterThan(0);
    expect(r.warnings.join(" "), "ложная тревога на обычном плане").not.toMatch(/промежуток/);
  });

  it("контроль: две комнаты рядом с проходом молчат", async () => {
    // Промежуток между комнатами ~9 % листа: так выглядит настоящая квартира.
    const две = "0 0 m 400 0 l 400 300 l 0 300 l h S 440 0 m 840 0 l 840 300 l 440 300 l h S";
    const r = await readPdfSegments(пдф([две]));
    expect(r.warnings.join(" "), "проход между комнатами принят за разные листы")
      .not.toMatch(/промежуток/);
  });

  it("лист со штампом в стороне — назван, а не проглочен", async () => {
    const штамп = "2000 0 m 2400 0 l 2400 100 l h S";
    const r = await readPdfSegments(пдф([лист, штамп]));
    const текст = r.warnings.join(" ");
    expect(текст, "две части слились молча — масштаб будет неверным").toMatch(/промежуток/);
    // Сообщение обязано назвать ПОСЛЕДСТВИЕ, а не только факт.
    expect(текст).toMatch(/мельче|масштаб|длин/i);
  });
});
