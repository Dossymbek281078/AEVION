import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CATALOG, demoFurniture, demoPlacedSnapshots } from "./furniture";
import { demoPlan } from "./planModel";
import { MAX_FILE_BYTES } from "./_client";
import { findRooms } from "./rooms";
import { heatingPlan } from "./heating";
import { checkClearance, type Placed } from "./clearance";
import { checkPassage } from "./passage";

const placed = (): Placed[] =>
  demoFurniture().map((d, i) => {
    const item = CATALOG.find((c) => c.id === d.catalogId);
    if (!item) throw new Error(`нет в каталоге: ${d.catalogId}`);
    return { uid: i + 1, name: item.name, x: d.x, y: d.y, rotY: d.rotY, size: item.size };
  });

describe("демо-квартира обставлена", () => {
  it("каждый предмет есть в каталоге", () => {
    for (const d of demoFurniture()) {
      expect(CATALOG.some((c) => c.id === d.catalogId), `нет предмета ${d.catalogId}`).toBe(true);
    }
  });

  it("в расстановке есть все три вида: жильё, кухня-санузел, декор", () => {
    // Основатель просил «декор и мебель» третьим слоем — одна тумбочка это не
    // ракурс. Проверяем состав, а не количество.
    const groups = new Set(
      demoFurniture().map((d) => CATALOG.find((c) => c.id === d.catalogId)!.group),
    );
    for (const g of ["Гостиная", "Кухня", "Спальня", "Санузел", "Декор"]) {
      expect(groups, `в демо нет ничего из группы «${g}»`).toContain(g);
    }
  });

  it("предметы не налезают друг на друга и не перекрывают двери", () => {
    const issues = checkClearance(demoPlan(), placed());
    expect(issues.map((i) => i.text), "демо встречает гостя своими же замечаниями").toEqual([]);
  });

  it("по квартире можно пройти", () => {
    const r = checkPassage(demoPlan(), placed());
    expect(r.issues.map((i) => i.text)).toEqual([]);
  });

  it("контроль прибора: заведомо плохая расстановка ЛОВИТСЯ", () => {
    // без этого «ноль замечаний» неотличимо от «проверка ничего не смотрит»
    const two = placed().slice(0, 1);
    two.push({ ...two[0], uid: 999 }); // тот же предмет на том же месте
    expect(checkClearance(demoPlan(), two).length).toBeGreaterThan(0);
  });
});

describe("перевод в формат проекта не переставляет оси", () => {
  it("z снимка — это y плана, а x остаётся x", () => {
    const plan = demoFurniture();
    const snap = demoPlacedSnapshots();
    expect(snap.length).toBe(plan.length);
    for (let i = 0; i < plan.length; i++) {
      expect(snap[i].x, `предмет ${plan[i].catalogId}: x уехал`).toBe(plan[i].x);
      expect(snap[i].z, `предмет ${plan[i].catalogId}: z должен равняться y плана`).toBe(plan[i].y);
      expect(snap[i].rotY).toBe(plan[i].rotY);
      expect(snap[i].catalogId).toBe(plan[i].catalogId);
    }
  });

  it("оси РАЗЛИЧИМЫ: в демо есть предмет, у которого x и y не совпадают", () => {
    // без этого перестановка осей прошла бы незамеченной на симметричных точках
    expect(demoFurniture().some((d) => d.x !== d.y), "все точки на диагонали — тест слеп").toBe(true);
  });
});

describe("обещание страницы про демо подкреплено кодом", () => {
  const text = readFileSync(path.join(__dirname, "_client.tsx"), "utf8");

  it("если страница обещает расставленную мебель — она расставлена", () => {
    // Признак — ФРАЗА, а не слово: слово «мебель» встречается в подписи слоя,
    // в названии каталога и в прозе, и сторож зеленел бы от любого из них.
    const promises = text.includes("с расставленной мебелью");
    expect(promises, "фраза-обещание пропала из страницы — поправьте сторожа осознанно").toBe(true);
    expect(demoFurniture().length, "страница обещает мебель, а расстановка пуста").toBeGreaterThan(4);
  });

  it("слой декора сообщает, когда он ПУСТ", () => {
    // молчащий флажок неотличим от сломанного — это и был найденный дефект
    expect(text).toContain("пусто, добавьте из каталога");
  });
});

describe("предметы демо действительно строят геометрию", () => {
  // «13 предметов расставлено» ничего не значит, если build() вернёт пустую
  // группу: слой снова покажет ничего, а счётчик будет говорить «13».
  // Проверяется тем же вызовом, которым пользуется страница.
  const meshCount = (g: { children: Array<{ children?: unknown[] }> }): number => {
    let n = 0;
    const walk = (o: { children?: unknown[] }) => {
      n++;
      for (const c of (o.children ?? []) as Array<{ children?: unknown[] }>) walk(c);
    };
    for (const c of g.children) walk(c);
    return n;
  };

  it("каждый предмет строит непустую группу", () => {
    for (const d of demoFurniture()) {
      const item = CATALOG.find((c) => c.id === d.catalogId)!;
      const g = item.build();
      expect(meshCount(g), `«${item.name}» строит пустую группу — слой покажет пустоту`)
        .toBeGreaterThan(0);
    }
  });

  it("ВЕСЬ каталог строит непустые группы, а не только демо", () => {
    // человек может поставить любой из них, и пустой предмет читался бы как
    // «нажал и ничего не появилось» — тот же класс, что пустой слой
    const пустые = CATALOG.filter((c) => meshCount(c.build()) === 0).map((c) => c.name);
    expect(пустые, "предметы каталога, которые ничего не рисуют").toEqual([]);
    expect(CATALOG.length, "каталог пуст — проверка ничего не смотрит").toBeGreaterThan(30);
  });

  it("у каждого предмета габарит — три положительных числа", () => {
    // нулевой габарит не падает: предмет рисуется, но проверка расстановки
    // считает его точкой и перестаёт видеть пересечения
    for (const c of CATALOG) {
      for (const [i, v] of c.size.entries()) {
        expect(v, `«${c.name}»: габарит ${i} равен ${v}`).toBeGreaterThan(0);
      }
    }
  });

  it("два одинаковых предмета — РАЗНЫЕ объекты", () => {
    // иначе поставленный дважды диван был бы одним и тем же телом, и второй
    // «переехал» бы вместе с первым
    const sofa = CATALOG.find((c) => c.id === "sofa")!;
    expect(sofa.build()).not.toBe(sofa.build());
  });

  it("контроль прибора: пустая группа НАХОДИТСЯ", () => {
    expect(meshCount({ children: [] })).toBe(0);
  });
});

describe("тёплый пол видит встроенную мебель", () => {
  // Параметр blockedAreaByRoom был у heatingPlan с самого начала и объяснён
  // комментарием — но НИКТО его не передавал. Пока мебели не было, это ничего
  // не меняло; с обставленной квартирой в санузле под ванной и унитазом около
  // трети площади считалось тёплой ошибочно.
  const blockedByRoom = () => {
    const plan = demoPlan();
    const { roomAt } = findRooms(plan);
    const blocked: Record<number, number> = {};
    for (const d of demoFurniture()) {
      const item = CATALOG.find((c) => c.id === d.catalogId)!;
      if (!item.blocksFloor) continue;
      const idx = roomAt(d.x, d.y);
      if (idx === null) continue;
      blocked[idx] = (blocked[idx] ?? 0) + item.size[0] * item.size[1];
    }
    return blocked;
  };

  it("в демо есть комнаты со встроенной мебелью", () => {
    const b = blockedByRoom();
    expect(Object.keys(b).length, "ни один предмет не отнесён к комнате").toBeGreaterThan(1);
  });

  it("площадь под мебелью УМЕНЬШАЕТ тёплую площадь и метры трубы", () => {
    const rooms = findRooms(demoPlan()).rooms;
    const без = heatingPlan(rooms, 0.15);
    const с = heatingPlan(rooms, 0.15, blockedByRoom());
    expect(с.totals.heatedArea, "мебель не повлияла — параметр снова не доехал")
      .toBeLessThan(без.totals.heatedArea);
    expect(с.totals.pipeLength).toBeLessThan(без.totals.pipeLength);
  });

  it("разница заметная, а не косметическая", () => {
    // если бы разница была в сотых, параметр не стоил бы проводки
    const rooms = findRooms(demoPlan()).rooms;
    const без = heatingPlan(rooms, 0.15).totals.heatedArea;
    const с = heatingPlan(rooms, 0.15, blockedByRoom()).totals.heatedArea;
    expect(без - с).toBeGreaterThan(2); // м²
  });

  it("предметы БЕЗ признака пол не занимают", () => {
    // контроль: диван и кровать не помечены сознательно — у них просвет
    for (const id of ["sofa", "bed", "coffee", "dining"]) {
      expect(CATALOG.find((c) => c.id === id)!.blocksFloor, `«${id}» помечен зря`).toBeFalsy();
    }
  });
});

describe("успешная проверка расстановки видна человеку", () => {
  const client = readFileSync(path.join(__dirname, "_client.tsx"), "utf8");

  it("есть ветка, показывающая отчёт при НУЛЕ замечаний", () => {
    // Прежде раздел появлялся только при замечаниях: возможность была
    // невидима ровно тогда, когда она отработала успешно, и «проверено,
    // всё хорошо» не отличалось от «проверка не запускалась».
    expect(client).toContain("issues.length === 0");
    expect(client).toMatch(/Замечаний нет/);
  });

  it("отчёт называет, ЧТО именно проверено, а не «всё в порядке»", () => {
    // общая похвала без перечня не даёт человеку понять границу проверки
    for (const признак of ["не пересекаются", "перед\n                дверью", "в стену", "дойти"]) {
      expect(client.replace(/\s+/g, " "), `в отчёте не назван признак: ${признак}`)
        .toMatch(new RegExp(признак.replace(/\s+/g, " ")));
    }
  });

  it("отчёт не показывается, когда ставить ещё нечего", () => {
    // «замечаний нет» при пустой сцене было бы враньём о проделанной работе
    expect(client).toMatch(/placed\.length > 0 && issues\.length === 0/);
  });
});

describe("признак «стоит на полу» сверен с геометрией", () => {
  // Найдено вычиткой: водонагреватель помечен как стоящий на полу, а он
  // ВИСИТ на стене (его тело построено на высоте 1.2 м). Признак ставился по
  // интуиции, а проверяться должен по модели — иначе из тёплой площади
  // вычитается 0.4 м² под предметом, который пола не касается.
  const низ = (id: string): number => {
    const g = CATALOG.find((c) => c.id === id)!.build();
    const box = new THREE.Box3().setFromObject(g);
    return box.min.y;
  };

  it("контроль прибора: заведомо напольный предмет касается пола", () => {
    // без этого «все касаются» неотличимо от «замер всегда даёт ноль»
    expect(низ("sofa")).toBeLessThan(0.05);
  });

  it("контроль прибора: заведомо настенный предмет пола НЕ касается", () => {
    expect(низ("split"), "сплит-система построена на полу — замер не различает").toBeGreaterThan(0.5);
  });

  it("каждый помеченный предмет действительно стоит на полу", () => {
    const вранье = CATALOG.filter((c) => c.blocksFloor && низ(c.id) > 0.05).map((c) => c.name);
    expect(вранье, "помечены как напольные, а висят").toEqual([]);
  });

  it("каждый крупный напольный предмет либо помечен, либо назван исключением", () => {
    // Порог из воздуха («не больше N штук») ничего не охраняет и меняется при
    // каждом пополнении каталога. Здесь список исключений ИМЕНОВАННЫЙ: новый
    // напольный предмет заставит автора принять решение, а не пройдёт молча.
    const ИСКЛЮЧЕНИЯ = new Set([
      // у всех перечисленных есть просвет под корпусом: трубу под ними кладут
      "Диван", "Угловой диван", "Кресло", "Журнальный стол",
      "ТВ-тумба + телевизор", "Книжный шкаф", "Кровать двуспальная",
      "Кровать односпальная", "Комод", "Письменный стол",
      "Обеденный стол", "Круглый стол",
      // не мебель: лежит на полу и не мешает теплу
      "Ковёр", "Растение",
    ]);
    const неучтённые = CATALOG
      .filter((c) => !c.blocksFloor && низ(c.id) < 0.05 && c.size[0] * c.size[1] >= 0.35)
      .map((c) => c.name)
      .filter((n) => !ИСКЛЮЧЕНИЯ.has(n));
    expect(неучтённые, "новый напольный предмет: пометьте blocksFloor или впишите сюда с причиной")
      .toEqual([]);
  });
});

describe("отказ сохранения показывается отказом, а не зелёной плашкой", () => {
  // Ворота запуска, пункт 4. Прежде отказ («браузер не даёт сохранять данные
  // сайта») выводился в ТОЙ ЖЕ зелёной рамке, что и успех: зелёное читается
  // как «всё хорошо» раньше, чем читается текст, и человек уходил уверенным,
  // что проект сохранён.
  const client = readFileSync(path.join(__dirname, "_client.tsx"), "utf8");

  it("у отказа отдельный стиль и роль alert", () => {
    expect(client, "нет отдельного оформления отказа").toContain("saveFail");
    expect(client, "отказ не объявлен как alert").toMatch(/failed \? "alert" : "status"/);
  });

  it("признак отказа приходит ИЗ результата сохранения, а не угадывается", () => {
    // «покрасить по словам в тексте» сломалось бы при первой правке формулировки
    expect(client).toMatch(/скажи\(r\.reason, true\)/);
  });

  it("успешные сообщения отказом НЕ помечены", () => {
    // иначе всё станет красным и признак потеряет смысл
    const красных = [...client.matchAll(/скажи\([^)]*,\s*true\)/g)].length;
    expect(красных, "отказом помечено больше одного места — проверьте, все ли это отказы")
      .toBe(1);
  });
});

describe("сообщения объявляются экранному диктору", () => {
  // Предупреждения появляются В ОТВЕТ на действие: «мимо стены», «файл не
  // разобрался», «масштаб не задан». Человек в этот момент смотрит на то
  // место, куда нажал; без роли диктор промолчит, и отказ останется невидимым
  // для того, кто не видит экрана.
  const client = readFileSync(path.join(__dirname, "_client.tsx"), "utf8");

  it("у списка предупреждений есть роль", () => {
    const кусок = client.slice(client.indexOf("{warnings.length > 0 && ("),
                               client.indexOf("{pdfPending && ("));
    expect(кусок, "список предупреждений без role").toMatch(/role="status"/);
  });

  it("у плашки восстановления и у отказа сохранения роли тоже есть", () => {
    expect(client).toMatch(/restoreNote[\s\S]{0,200}role="status"/);
    expect(client).toMatch(/failed \? "alert" : "status"/);
  });

  it("контроль прибора: срез действительно вырезан, а не пуст", () => {
    const кусок = client.slice(client.indexOf("{warnings.length > 0 && ("),
                               client.indexOf("{pdfPending && ("));
    expect(кусок.length, "срез пуст — проверка смотрит в пустоту").toBeGreaterThan(80);
    expect(кусок).toContain("warnings.map");
  });
});

describe("огромный файл отвергается ДО чтения в память", () => {
  // По всем трём веткам загрузки файл читается целиком (f.text(),
  // f.arrayBuffer()). Без предела вкладка на гигабайтном скане повисла бы
  // молча — а зависание хуже отказа: человек не знает, ждать ему или нет.
  const client = readFileSync(path.join(__dirname, "_client.tsx"), "utf8");
  // ⚠️ Комментарии ВЫРЕЗАЮТСЯ: мой же пояснительный текст рядом с проверкой
  // упоминает `f.text()` и `f.arrayBuffer()` — и первая версия сторожа нашла
  // «чтение файла» в собственном объяснении, раньше самой проверки. Четвёртый
  // случай этого за день; сторож обязан судить о КОДЕ, а не о рассказе о нём.
  const голова = client
    .slice(client.indexOf("const onFile = useCallback"),
           client.indexOf("const applyPdfScale"))
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  it("проверка размера стоит ПЕРЕД чтением файла", () => {
    const iРазмер = голова.indexOf("f.size > MAX_FILE_BYTES");
    const iЧтение = Math.min(
      ...["f.text()", "f.arrayBuffer()", "createObjectURL(f)"]
        .map((k) => голова.indexOf(k))
        .filter((i) => i >= 0),
    );
    expect(iРазмер, "проверки размера нет вовсе").toBeGreaterThan(0);
    expect(iРазмер, "файл читается раньше, чем проверен его размер")
      .toBeLessThan(iЧтение);
  });

  it("предел разумен: план в него влезает, подшивка — нет", () => {
    expect(MAX_FILE_BYTES).toBeGreaterThan(15 * 1024 * 1024); // скан 300 dpi
    expect(MAX_FILE_BYTES).toBeLessThan(100 * 1024 * 1024);
  });

  it("отказ называет и размер файла, и предел", () => {
    // «файл слишком большой» без чисел не говорит человеку, что делать
    expect(голова).toMatch(/МБ — это больше предела/);
    expect(голова).toMatch(/f\.size \/ 1024 \/ 1024/);
  });

  it("контроль прибора: вырезалка комментариев не съела сам код", () => {
    // иначе «проверка стоит первой» могло бы держаться на пустом срезе
    expect(голова, "срез пуст — сторож смотрит в пустоту").toContain("f.text()");
    expect(голова).toContain("MAX_FILE_BYTES");
    expect(голова, "комментарии не вырезаны").not.toMatch(/\/\/ /);
  });
});

describe("у экспорта модели нет пути молчаливого отказа", () => {
  // В успешной ветке экспорта не было catch: если сборка файла или скачивание
  // упадёт (не хватило памяти на большую сцену, браузер запретил загрузку),
  // ожидание снималось бы в finally, а человек оставался без файла И без
  // слова — нажал, подождал, ничего не произошло.
  const client = readFileSync(path.join(__dirname, "_client.tsx"), "utf8");
  const кусок = client
    .slice(client.indexOf("const exportGlb = useCallback"),
           client.indexOf("const screenshot") >= 0
             ? client.indexOf("const screenshot")
             : client.indexOf("const downloadPlanSvg"))
    .replace(/\/\/[^\n]*/g, "");

  it("обе ветки — успех и падение — что-то говорят человеку", () => {
    expect(кусок, "срез пуст").toContain("GLTFExporter");
    expect(кусок, "в успешной ветке нет обработки падения").toMatch(/\}\s*catch/);
    // и ожидание снимается в любом случае
    expect(кусок).toMatch(/finally\s*\{\s*setExporting\(false\)/);
  });

  it("сообщение объясняет, что делать, а не только что случилось", () => {
    expect(кусок).toMatch(/Выключите лишние слои/);
  });
});

describe("на экране нет ни жаргона, ни сырых ошибок", () => {
  // «Холст» и «GLB» — наши слова. Хуже: в сообщение об отказе экспорта
  // подставлялся String(err) — сырой текст исключения, не по-русски и без
  // объяснения, выглядящий как поломка сайта.
  const файлы = ["_client.tsx", "RasterReview.tsx", "HeatingPanel.tsx",
                 "CoolingPanel.tsx", "VentilationPanel.tsx"];
  const тексты = файлы.flatMap((f) => {
    const s = readFileSync(path.join(__dirname, f), "utf8").replace(/\/\/[^\n]*/g, "");
    return [...s.matchAll(/setWarnings\(\[([\s\S]{0,400}?)\]\)/g)].map((m) => m[1]);
  });

  // ⚠️ БЕЗ границ слова: в JS граница опирается на ASCII-класс, и с
  // кириллицей не совпадает НИКОГДА — шаблон был бы мёртв, а сторож вечно
  // зелёным. Поймал собственный контроль ниже. Тот же дефект мы сегодня
  // чинили в голосовых командах шахмат.
  const жаргон = /холст|канвас|стектрейс|парсер|дамп/i;

  it("сообщений найдено достаточно — проверка не пуста", () => {
    expect(тексты.length, "не найдено ни одного сообщения").toBeGreaterThan(8);
  });

  it("ни одно сообщение не подставляет сырую ошибку", () => {
    for (const t of тексты) {
      expect(t, `в сообщение подставляется исключение: ${t.slice(0, 70)}`)
        .not.toMatch(/String\(err|\$\{err|\+ err\b|error\.message/);
    }
  });

  it("в сообщениях нет наших внутренних слов", () => {
    for (const t of тексты) {
      expect(t, `внутреннее слово на экране: ${t.slice(0, 70)}`).not.toMatch(жаргон);
    }
  });

  it("контроль прибора: шаблоны НАХОДЯТ то, что ищут", () => {
    expect(/String\(err/.test('setWarnings(["Ошибка: " + String(err)])')).toBe(true);
    expect(жаргон.test("Браузер не дал холст для разбора")).toBe(true);
    expect(жаргон.test("Модель собралась, но файл сохранить не удалось")).toBe(false);
  });
});

describe("экран правки распознанного плана не молчит на отказе", () => {
  // Кнопка «принять» имела два молчаливых return: неверный габарит и «не
  // осталось линий». Человек нажимал, ничего не происходило — со стороны это
  // неотличимо от «кнопка не работает», и жать её будут снова.
  const src = readFileSync(path.join(__dirname, "RasterReview.tsx"), "utf8")
    .replace(/\/\/[^\n]*/g, "");
  const accept = src.slice(src.indexOf("const accept = useCallback"),
                           src.indexOf("const walls: Wall[]"));

  it("срез найден — проверка не смотрит в пустоту", () => {
    expect(accept.length).toBeGreaterThan(100);
    expect(accept).toContain("extentM");
  });

  it("ни одного возврата без объяснения", () => {
    const возвраты = [...accept.matchAll(/return;/g)].length;
    const сообщения = [...accept.matchAll(/setWarnings\(/g)].length;
    expect(возвраты, "в кнопке «принять» нет ни одного выхода — срез не тот")
      .toBeGreaterThan(1);
    expect(сообщения, `выходов ${возвраты}, а объяснений ${сообщения}`)
      .toBeGreaterThanOrEqual(возвраты);
  });
});
