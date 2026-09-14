import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { findWallSegments } from "./raster";

/** Рисует белое полотно и даёт кисть для чёрных прямоугольников. */
function canvas(w: number, h: number) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
  }
  const rect = (x0: number, y0: number, rw: number, rh: number) => {
    for (let y = y0; y < y0 + rh; y++) {
      for (let x = x0; x < x0 + rw; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = (y * w + x) * 4;
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0;
      }
    }
  };
  return { data, rect, w, h };
}

describe("распознавание стен на растровом плане", () => {
  it("прямоугольная комната даёт четыре стены, а не сорок полос пикселей", () => {
    const c = canvas(400, 300);
    // рамка толщиной 6 px — так стены и рисуют
    c.rect(40, 40, 320, 6);    // верх
    c.rect(40, 254, 320, 6);   // низ
    c.rect(40, 40, 6, 220);    // лево
    c.rect(354, 40, 6, 220);   // право

    const r = findWallSegments(c.data, c.w, c.h);
    // без слияния было бы ~24 линии (по 6 строк на стену)
    expect(r.segments.length).toBe(4);
    expect(r.segments.filter((s) => s.axis === "h").length).toBe(2);
    expect(r.segments.filter((s) => s.axis === "v").length).toBe(2);
    // толщина стены распознана, а не выдумана
    for (const s of r.segments) expect(s.weight).toBeGreaterThanOrEqual(5);
  });

  it("мелкие подписи и штрихи не становятся стенами", () => {
    const c = canvas(400, 300);
    c.rect(40, 40, 320, 6);          // настоящая стена
    for (let i = 0; i < 12; i++) c.rect(60 + i * 8, 120, 4, 4); // «буквы»
    c.rect(100, 200, 10, 2);         // короткая выноска

    const r = findWallSegments(c.data, c.w, c.h);
    expect(r.segments.length).toBe(1);
    expect(r.segments[0].axis).toBe("h");
  });

  it("длина найденной стены совпадает с нарисованной", () => {
    const c = canvas(400, 300);
    c.rect(50, 100, 300, 4);
    const r = findWallSegments(c.data, c.w, c.h);
    expect(r.segments.length).toBe(1);
    const s = r.segments[0];
    expect(Math.abs(s.x2 - s.x1) + 1).toBe(300);
  });

  it("две стены на расстоянии НЕ сливаются в одну", () => {
    const c = canvas(400, 300);
    c.rect(40, 40, 320, 5);
    c.rect(40, 200, 320, 5); // 160 px ниже — это другая стена
    const r = findWallSegments(c.data, c.w, c.h);
    expect(r.segments.length).toBe(2);
  });

  it("пустая (белая) картинка честно говорит, что линий нет", () => {
    const c = canvas(400, 300);
    const r = findWallSegments(c.data, c.w, c.h);
    expect(r.segments.length).toBe(0);
    expect(r.warnings.join(" ")).toMatch(/почти нет тёмных линий/);
  });

  it("фотография (почти всё тёмное) отвергается объяснением, а не пустотой", () => {
    const c = canvas(200, 200);
    c.rect(0, 0, 200, 160); // 80 % тёмного
    const r = findWallSegments(c.data, c.w, c.h);
    expect(r.segments.length).toBe(0);
    expect(r.warnings.join(" ")).toMatch(/фотографию|инверсный/);
  });

  it("прозрачный фон PNG не считается чернилами", () => {
    const w = 200, h = 200;
    const data = new Uint8ClampedArray(w * h * 4); // всё нули: чёрный, но альфа 0
    const r = findWallSegments(data, w, h);
    expect(r.inkFraction).toBe(0);
    expect(r.segments.length).toBe(0);
  });

  it("результат назван ПРЕДПОЛОЖЕНИЕМ — человек обязан его проверить", () => {
    const c = canvas(400, 300);
    c.rect(40, 40, 320, 6);
    const r = findWallSegments(c.data, c.w, c.h);
    expect(r.warnings.join(" ")).toContain("ПРЕДПОЛОЖЕНИЕ");
  });

  it("порог чувствительности действительно управляет результатом", () => {
    const c = canvas(400, 300);
    // серая линия яркостью ~150: при пороге 128 не видна, при 200 видна
    for (let y = 100; y < 106; y++) {
      for (let x = 50; x < 350; x++) {
        const i = (y * c.w + x) * 4;
        c.data[i] = 150; c.data[i + 1] = 150; c.data[i + 2] = 150;
      }
    }
    expect(findWallSegments(c.data, c.w, c.h, { darkThreshold: 128 }).segments.length).toBe(0);
    expect(findWallSegments(c.data, c.w, c.h, { darkThreshold: 200 }).segments.length).toBe(1);
  });

  it("картинка-марка отвергается, а не обрабатывается как план", () => {
    const r = findWallSegments(new Uint8ClampedArray(10 * 10 * 4), 10, 10);
    expect(r.segments.length).toBe(0);
    expect(r.warnings[0]).toContain("20×20");
  });
});

describe("порог яркости работает на СЕРОМ, как на настоящем скане", () => {
  // Мутация «порог 128 -> 250» не ловилась ничем: тестовые картинки чисто
  // чёрно-белые, а на них любой порог от 1 до 254 даёт один результат. Порог
  // проявляется только на полутонах — то есть ровно на сканах и фотографиях
  // чертежа, ради которых он и написан.
  function серое(w: number, h: number) {
    const data = new Uint8ClampedArray(w * h * 4);
    const залить = (v: number) => {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
      }
    };
    залить(210); // светло-серый фон бумаги
    const полоса = (x0: number, y0: number, rw: number, rh: number, v: number) => {
      for (let y = y0; y < y0 + rh; y++) {
        for (let x = x0; x < x0 + rw; x++) {
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const i = (y * w + x) * 4;
          data[i] = v; data[i + 1] = v; data[i + 2] = v;
        }
      }
    };
    return { data, полоса, w, h };
  }

  it("тёмные линии распознаются, светло-серая сетка чертежа — нет", () => {
    const c = серое(120, 120);
    c.полоса(10, 10, 100, 5, 40);    // стена: тёмная
    c.полоса(10, 60, 100, 5, 40);    // вторая стена
    c.полоса(10, 35, 100, 3, 170);   // сетка/подложка: светлее порога 128
    const r = findWallSegments(c.data, c.w, c.h);
    const y = r.segments.map((s) => Math.round((s.y1 + s.y2) / 2)).sort((a, b) => a - b);
    expect(r.segments.length, "тёмные линии не распознались вовсе").toBeGreaterThan(1);
    expect(y.some((v) => Math.abs(v - 36) <= 3),
      `светло-серая линия принята за стену: найдены полосы на ${y.join(", ")}`).toBe(false);
  });

  it("бледная линия карандашом всё ещё распознаётся", () => {
    // Вторая сторона порога: слишком НИЗКИЙ отсеет бледный чертёж — снимок
    // телефоном или карандашный набросок, — и человек увидит пустую модель
    // без объяснения. Линия 100 при пороге 128 обязана пройти.
    const c = серое(120, 120);
    c.полоса(10, 10, 100, 5, 100);
    c.полоса(10, 60, 100, 5, 100);
    const r = findWallSegments(c.data, c.w, c.h);
    expect(r.segments.length, "бледные линии перестали распознаваться").toBeGreaterThan(1);
  });

  it("контроль прибора: подними порог — светло-серая линия станет стеной", () => {
    // доказывает, что предыдущая проверка чувствительна к самому порогу, а не
    // проходит по другой причине
    const c = серое(120, 120);
    c.полоса(10, 10, 100, 5, 40);
    c.полоса(10, 60, 100, 5, 40);
    c.полоса(10, 35, 100, 3, 170);
    const r = findWallSegments(c.data, c.w, c.h, { darkThreshold: 200 });
    const y = r.segments.map((s) => Math.round((s.y1 + s.y2) / 2));
    expect(y.some((v) => Math.abs(v - 36) <= 3),
      "при пороге 200 светло-серая линия обязана распознаться").toBe(true);
  });
});

/**
 * Граница по наклону скана — закреплена ЧИСЛАМИ, а не обещанием.
 *
 * Фото плана никогда не выходит строго по осям, а разбор ищет горизонтальные и
 * вертикальные прогоны тёмных точек. Замер 13.09.2026 на повёрнутом
 * прямоугольнике:
 *
 *     0-2°    4 стены из 4 — верно
 *     5°      8 отрезков вместо 4, «толщина» раздута с 3 до 13 точек
 *     10°     линий не найдено, и это сказано прямым текстом
 *
 * Детектор наклона намеренно не написан: единственный доступный признак —
 * раздутая толщина — неотличим от чертежа с настоящими толстыми стенами.
 * Граница названа человеку словами на странице; тест держит её честной.
 */
describe("наклон скана: граница названа числами", () => {
  function полотно2(w: number, h: number) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
    }
    const точка = (x: number, y: number) => {
      const xi = Math.round(x), yi = Math.round(y);
      if (xi < 0 || yi < 0 || xi >= w || yi >= h) return;
      const i = (yi * w + xi) * 4;
      data[i] = 0; data[i + 1] = 0; data[i + 2] = 0;
    };
    const линия = (x1: number, y1: number, x2: number, y2: number) => {
      const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
        for (let d = -1; d <= 1; d++) { точка(x + d, y); точка(x, y + d); }
      }
    };
    return { data, линия, w, h };
  }
  const повёрнутый = (угол: number) => {
    const c = полотно2(400, 300);
    const a = (угол * Math.PI) / 180;
    const углы = ([[-150, -100], [150, -100], [150, 100], [-150, 100]] as const).map(
      ([x, y]) => [200 + x * Math.cos(a) - y * Math.sin(a), 150 + x * Math.sin(a) + y * Math.cos(a)] as const,
    );
    for (let k = 0; k < 4; k++) {
      const [x1, y1] = углы[k], [x2, y2] = углы[(k + 1) % 4];
      c.линия(x1, y1, x2, y2);
    }
    return c;
  };

  it("ровный и почти ровный скан дают ровно четыре стены", () => {
    for (const угол of [0, 1, 2]) {
      const c = повёрнутый(угол);
      const r = findWallSegments(c.data, c.w, c.h);
      expect(r.segments.length, `наклон ${угол}° перестал давать 4 стены`).toBe(4);
    }
  });

  it("сильный наклон НЕ выдаётся за успех и называет причину", () => {
    const c = повёрнутый(10);
    const r = findWallSegments(c.data, c.w, c.h);
    expect(r.segments.length, "при 10° что-то «нашлось» — это была бы выдумка").toBe(0);
    expect(r.warnings.join(" "), "причина не названа, человек не поймёт, что делать")
      .toMatch(/под углом|от руки/);
  });

  it("страница честно предупреждает о наклоне — иначе граница есть, а человек о ней не знает", () => {
    const client = readFileSync(path.join(__dirname, "_client.tsx"), "utf8");
    expect(client, "на странице нет ни слова про выравнивание скана").toMatch(/выровнен/i);
  });
});
