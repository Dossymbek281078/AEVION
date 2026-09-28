import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Отметку сборки писали ДВА механизма в один файл, и побеждал тот, кто знает
 * меньше.
 *
 * scripts/railway-deploy.sh кладёт build-info.json перед загрузкой — там ещё
 * есть .git и настоящий коммит. Потом на Railway идёт `npm run build`, ПОСЛЕДНИМ
 * шагом которого стоит write-build-info.js. Внутри образа .git отсутствует и
 * переменных нет, поэтому он записывал поверх «unknown».
 *
 * Проверено на живой выкатке 14.08.2026 (f0c1620ceac2): код доехал, поля branch
 * и commitSource появились — а commit остался "unknown". То есть механизм,
 * написанный специально ради ответа «какой код на проде», сам же этот ответ и
 * стирал, и снаружи это выглядело как «отметка опять не работает».
 *
 * Тест гоняет НАСТОЯЩИЙ скрипт в отдельном каталоге без .git — то есть ровно в
 * тех условиях, что и на Railway.
 */

const SCRIPT = join(__dirname, "..", "scripts", "write-build-info.js");
let dir = "";

function runBuildStep(env: Record<string, string | undefined> = {}) {
  const clean = { ...process.env, ...env };
  // Условия образа: ни одной готовой метки в окружении.
  delete clean.RAILWAY_GIT_COMMIT_SHA;
  delete clean.GIT_SHA;
  delete clean.SOURCE_VERSION;
  delete clean.RAILWAY_GIT_BRANCH;
  for (const [k, v] of Object.entries(env)) if (v !== undefined) clean[k] = v;

  execFileSync(process.execPath, [join(dir, "scripts", "write-build-info.js")], {
    cwd: dir,
    env: clean,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(readFileSync(join(dir, "build-info.json"), "utf8")) as {
    commit?: string;
    branch?: string;
    source?: string;
  };
}

beforeEach(() => {
  // Каталог вне репозитория: иначе `git rev-parse` найдёт наш же .git и
  // подставит коммит, то есть тест мерил бы не то, что происходит на Railway.
  dir = mkdtempSync(join(tmpdir(), "aevion-build-info-"));
  mkdirSync(join(dir, "scripts"));
  copyFileSync(SCRIPT, join(dir, "scripts", "write-build-info.js"));
});

afterEach(() => {
  if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe("шаг сборки не стирает отметку выкатки", () => {
  test("отметка с настоящим коммитом переживает сборку в образе", () => {
    writeFileSync(
      join(dir, "build-info.json"),
      JSON.stringify({ commit: "f0c1620ceac2", branch: "deploy/combined", source: "railway-deploy.sh" }),
    );

    const after = runBuildStep();

    expect(after.commit).toBe("f0c1620ceac2");
    expect(after.branch).toBe("deploy/combined");
    expect(after.source).toBe("railway-deploy.sh");
  });

  test("отметки нет — шаг сборки пишет свою, честно называя unknown", () => {
    const after = runBuildStep();

    expect(after.commit).toBe("unknown");
    expect(after.source).toBe("none");
  });

  test("свой источник известен — он и побеждает, отметка не главнее факта", () => {
    // Сборка ИЗ git-репозитория знает коммит точно. Тогда сохранять чужую
    // старую отметку нельзя: она была бы враньём про уже другой код.
    writeFileSync(join(dir, "build-info.json"), JSON.stringify({ commit: "aaaaaaaaaaaa", branch: "старая" }));

    const after = runBuildStep({ GIT_SHA: "bbbbbbbbbbbb" });

    expect(after.commit).toBe("bbbbbbbbbbbb");
    expect(after.source).toBe("GIT_SHA");
  });

  test("отметка со словом unknown не считается ценной и перезаписывается", () => {
    writeFileSync(join(dir, "build-info.json"), JSON.stringify({ commit: "unknown", branch: "unknown" }));

    const after = runBuildStep();

    expect(after.commit).toBe("unknown");
    expect(after.source).toBe("none");
  });

  test("битый файл не роняет сборку", () => {
    writeFileSync(join(dir, "build-info.json"), "{это не json");

    const after = runBuildStep();

    expect(after.commit).toBe("unknown");
  });
});

describe("отметка сборки бэкенда не уезжает в git", () => {
  // ⚠️ ПОПРАВКА 28.09.2026. Утверждение перевёрнуто: с 24.09 (коммит 27a1af94b) файл
  // ОТСЛЕЖИВАЕТСЯ намеренно. Причина той починки: архив сборки терял неотслеживаемый
  // файл, отметка не доезжала, и `/health` четвёртый час отдавал `commit unknown` — из-за
  // чего проверка выкатки честно отказывала ВСЕМ окнам. В репозитории теперь лежит
  // заглушка `commit:"unknown"`, а скрипт подменяет её перед загрузкой и возвращает
  // обратно (trap с `git checkout --`).
  //
  // Прежний текст требовал обратного и краснел у каждого, кто взял ту починку, —
  // то есть сторож кричал на исправное состояние (контроль 28.09: blob файла одинаков
  // в чужой ветке deploy/devhub-static, мой мерж его не менял). Опасность, ради которой
  // сторож писался, никуда не делась и проверяется ПО СОДЕРЖИМОМУ: в индексе обязана
  // лежать заглушка, а не чей-то настоящий sha. То же самое, только с нужной стороны,
  // стережёт tests/buildStampFileIsTracked.guard.ts.
  test("в индексе лежит отслеживаемая ЗАГЛУШКА, а не чужая отметка", () => {
    // 29.08.2026: у САЙТА ровно это и случилось — в `buildStamp.ts` попала
    // настоящая отметка чужой выкатки, потому что процесс убили жёстко и
    // обработчик выхода не вернул заглушки. У бэкенда носитель другой
    // (build-info.json), а щель та же, и проверки на неё не было.
    //
    // Цена: закоммиченный файл читается при старте, и прод вечно называет
    // коммит, которого на нём нет. В игнор класть НЕЛЬЗЯ — загрузка образа
    // уважает .gitignore, и тогда отметка просто не доедет.
    const root = join(__dirname, "..", "..");
    const tracked = execFileSync(
      "git",
      ["-C", root, "ls-files", "aevion-globus-backend/build-info.json"],
      { encoding: "utf8" },
    ).trim();
    expect(
      tracked,
      "отметка сборки ПРОПАЛА из индекса: с 24.09 она отслеживается намеренно, иначе не доезжает в образ",
    ).toBe("aevion-globus-backend/build-info.json");

    // И главное: в индексе именно заглушка. Настоящий sha здесь означал бы, что прод
    // будет вечно называть коммит, которого на нём нет.
    const вИндексе = execFileSync(
      "git",
      ["-C", root, "show", ":aevion-globus-backend/build-info.json"],
      { encoding: "utf8" },
    );
    const j = JSON.parse(вИндексе) as { commit?: string; source?: string };
    expect(j.commit, "в индексе обязан лежать 'unknown', а не настоящий sha").toBe("unknown");
    expect(j.source, "заглушка обязана называть себя заглушкой").toBe("stub");

    // И на ДИСКЕ тоже: загрузка образа берёт рабочую копию, а не индекс. Отметка чужой
    // выкатки, пережившая скрипт (процесс убили — обработчик выхода не отработал), уехала
    // бы в образ и заставила прод называть коммит, которого на нём нет. Проверено мутацией
    // 28.09: без этой пары строк подмена sha в файле на диске проходила незамеченной.
    const наДиске = JSON.parse(
      readFileSync(join(root, "aevion-globus-backend", "build-info.json"), "utf8"),
    ) as { commit?: string; source?: string };
    expect(наДиске.commit, "в рабочей копии лежит настоящий sha — отметка пережила выкатку").toBe("unknown");
    expect(наДиске.source, "заглушка на диске обязана называть себя заглушкой").toBe("stub");
  });
});
