import { describe, expect, test } from "vitest";
import posixpath from "node:path/posix";

import { TEMPLATES } from "../src/routes/devhub";

// «Проект собирается с готового начала» — обещание посадочной DevHub. Проверяется не
// наличие начал, а их ЗАПУСКАЕМОСТЬ: начало без точки входа не начинается.
//
// Замер 19.08.2026 по каталогу с прода: у `react-spa` было три файла — src/App.tsx,
// src/main.tsx, package.json. Для Vite точка входа это index.html, без него
// `npm run dev` не стартует; выкатка отдаёт файлы как статику, и на корне нечего
// показать. Сборка при этом зовёт `tsc` без tsconfig.json. Ни в одной из шести ветвей,
// правящих devhub.ts, этого не починили.

type TFile = { path: string; content: string };
type T = { id: string; stack: string; files: TFile[] };

const templates = TEMPLATES as unknown as T[];

describe("готовые начала действительно начинаются", () => {
  test("каталог начал прочитан — иначе проверки ниже пусты", () => {
    expect(templates.length).toBeGreaterThanOrEqual(4);
  });

  test.each(templates.map((t) => [t.id, t] as const))("%s: есть точка входа своего стека", (_id, t) => {
    const paths = t.files.map((f) => f.path);
    const entry: Record<string, string[]> = {
      // Vite и статика стартуют с index.html; Next — со страницы; express — со скрипта.
      react: ["index.html"],
      static: ["index.html"],
      next: ["pages/index.tsx", "app/page.tsx"],
      express: ["src/index.ts", "index.js", "src/index.js"],
    };
    const wanted = entry[t.stack];
    expect(wanted, `неизвестный стек «${t.stack}» — добавьте его точку входа в проверку`).toBeTruthy();
    expect(
      wanted.some((p) => paths.includes(p)),
      `${t.id}: нет ни одного из ${wanted.join(", ")} — начало не начнётся. Файлы: ${paths.join(", ")}`,
    ).toBe(true);
  });

  test.each(templates.map((t) => [t.id, t] as const))("%s: чем собирается, то и настроено", (_id, t) => {
    const byPath = new Map(t.files.map((f) => [f.path, f.content]));
    const pkg = byPath.get("package.json");
    if (!pkg) return; // статике package.json не нужен
    const scripts = String(JSON.parse(pkg).scripts?.build ?? "");
    // Зовёт tsc — значит нужен tsconfig.json, иначе сборка не соберётся.
    if (/\btsc\b/.test(scripts)) {
      expect(byPath.has("tsconfig.json"), `${t.id}: build зовёт tsc, а tsconfig.json нет`).toBe(true);
    }
    // Объявил плагин Vite — значит нужен конфиг, иначе плагин не подключён.
    if (/@vitejs\/plugin-react/.test(pkg)) {
      expect(byPath.has("vite.config.ts") || byPath.has("vite.config.js"),
        `${t.id}: плагин Vite объявлен, а конфига нет — он не подключится`).toBe(true);
    }
  });

  test.each(templates.map((t) => [t.id, t] as const))("%s: команды зовут только объявленные инструменты", (_id, t) => {
    // Второй дефект express-api: dev зовёт ts-node-dev, которого не было в
    // devDependencies. «Команда не найдена» — и начало не начинается, хотя файлы на месте.
    const byPath = new Map(t.files.map((f) => [f.path, f.content]));
    const pkgRaw = byPath.get("package.json");
    if (!pkgRaw) return;
    const pkg = JSON.parse(pkgRaw);
    const declared = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);
    // Свои инструменты фреймворков приходят вместе с ними, поэтому next и vite
    // достаточно объявить один раз; tsc приходит с typescript.
    const owner: Record<string, string> = { tsc: "typescript", next: "next", vite: "vite", node: "", npm: "", npx: "" };
    const missing: string[] = [];
    for (const [name, cmd] of Object.entries(pkg.scripts ?? {})) {
      const bin = String(cmd).trim().split(/\s+/)[0];
      const need = owner[bin] === undefined ? bin : owner[bin];
      if (need && !declared.has(need)) missing.push(`${name}: «${bin}» требует «${need}», которого нет в зависимостях`);
    }
    expect(missing, `${t.id}: команды зовут необъявленное`).toEqual([]);
  });

  test.each(templates.map((t) => [t.id, t] as const))("%s: start ждёт то, что сборка создаёт", (_id, t) => {
    // Третий дефект express-api: start ждал dist/index.js, а tsc без tsconfig положил
    // бы результат рядом с исходником. Проверка сцепляет два шага, которые по
    // отдельности выглядят исправными.
    const byPath = new Map(t.files.map((f) => [f.path, f.content]));
    const pkgRaw = byPath.get("package.json");
    if (!pkgRaw) return;
    const start = String(JSON.parse(pkgRaw).scripts?.start ?? "");
    const m = /\b(dist|build|out)\//.exec(start);
    if (!m) return;
    const cfgRaw = byPath.get("tsconfig.json");
    expect(cfgRaw, `${t.id}: start ждёт ${m[1]}/, а tsconfig.json нет — каталог не появится`).toBeTruthy();
    const outDir = String(JSON.parse(cfgRaw as string).compilerOptions?.outDir ?? "");
    expect(outDir, `${t.id}: start ждёт ${m[1]}/, а сборка кладёт в «${outDir}»`).toBe(m[1]);
  });

  test.each(templates.map((t) => [t.id, t] as const))("%s: точка входа HTML ведёт на существующий файл", (_id, t) => {
    // Пробел в моём же тесте: проверка ниже смотрит ОТНОСИТЕЛЬНЫЕ ссылки, а
    // index.html ссылается на скрипт абсолютным путём от корня («/src/main.tsx»).
    // Эту связь не проверял никто, а именно она делает начало запускаемым: файл есть,
    // ссылка есть, но если они не совпадают — Vite отдаст пустую страницу.
    const paths = new Set(t.files.map((f) => f.path));
    const html = t.files.find((f) => f.path === "index.html");
    if (!html) return;
    const refs = [...html.content.matchAll(/(?:src|href)="\/([^"]+)"/g)].map((m) => m[1]);
    const missing = refs.filter((r) => !paths.has(r));
    expect(missing, `${t.id}: index.html ссылается на отсутствующее: ${missing.join(", ")}`).toEqual([]);
    // И обратный конец: если ссылок нет вовсе, проверка пуста — у Vite-начала
    // скрипт обязателен.
    if (t.stack === "react") {
      expect(refs.some((r) => /main\.(tsx|ts|jsx|js)$/.test(r)), `${t.id}: index.html не подключает точку входа`).toBe(true);
    }
  });

  test.each(templates.map((t) => [t.id, t] as const))("%s: относительные ссылки разрешаются внутри начала", (_id, t) => {
    const paths = new Set(t.files.map((f) => f.path));
    const missing: string[] = [];
    for (const f of t.files) {
      for (const m of f.content.matchAll(/(?:from|require\(|import\s+)['"](\.[^'"]+)['"]/g)) {
        const target = posixpath.normalize(posixpath.join(posixpath.dirname(f.path), m[1]));
        const ok = [target, `${target}.ts`, `${target}.tsx`, `${target}.js`, `${target}.jsx`, `${target}.css`,
                    posixpath.join(target, "index.ts"), posixpath.join(target, "index.tsx")].some((c) => paths.has(c));
        if (!ok) missing.push(`${f.path} → ${m[1]}`);
      }
    }
    expect(missing, `${t.id}: ссылки в никуда`).toEqual([]);
  });
});

// ПРОПУСК СДЕЛАН ВИДИМЫМ.
//
// Две проверки выше начинаются с `if (!pkgRaw) return;` — шаблон без
// package.json молча проходит их обе. Для `landing` это законно: он
// статический, npm ему не нужен. Но пропуск невидим: потеряй завтра
// next-app свой package.json, проверки перестали бы его смотреть и
// остались бы зелёными — «шаблоны запускаются» продолжало бы
// утверждаться о шаблоне, который уже не собирается.
//
// Храповик закрепляет РАЗДЕЛЕНИЕ, а не число: список слева должен
// совпасть точь-в-точь. Появится новый шаблон — тест покраснеет и
// заставит решить, к какой половине он относится.
describe("охват проверок шаблонов не сужается молча", () => {
  test("package.json есть ровно у тех шаблонов, у которых должен", () => {
    const sPkg = templates
      .filter((t) => t.files.some((f) => f.path === "package.json"))
      .map((t) => t.id)
      .sort();
    const bezPkg = templates
      .filter((t) => !t.files.some((f) => f.path === "package.json"))
      .map((t) => t.id)
      .sort();

    expect(sPkg, "шаблон потерял package.json — проверки запускаемости его молча пропустят").toEqual(
      ["dashboard", "express-api", "next-app", "react-spa"],
    );
    // Отрицательный контроль: без него первое утверждение прошло бы и
    // на пустом списке шаблонов — тогда «ровно те» означало бы «ни одного».
    expect(bezPkg, "статическим считается только landing").toEqual(["landing"]);
    expect(templates.length, "шаблоны пропали из каталога").toBe(sPkg.length + bezPkg.length);
  });
});
