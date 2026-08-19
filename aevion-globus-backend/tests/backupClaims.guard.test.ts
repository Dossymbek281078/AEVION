import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Инстансов Postgres два, резервируется один — и документация обещала оба.
 *
 * Платформенная база живёт под `DATABASE_URL`. Проектные базы пользователей
 * DevHub — под `DEVHUB_DB_ADMIN_URL`, на ОТДЕЛЬНОМ сервере, и это выбор в коде:
 * `lib/devhubDbProvision.ts` отказывается провизионить, если admin-URL указывает
 * на платформенную базу. Значит дамп `DATABASE_URL` не содержит проектных данных
 * ни частично, ни вовсе.
 *
 * У проектного инстанса резервного копирования нет никакого вида (issue #957).
 * Проекты всех пользователей делят его, разделённые лишь схемой и ролью, — то
 * есть потеря забирает не один проект, а все сразу.
 *
 * При этом § 1 RUNBOOK'а до 14.08.2026 писал «Postgres (all modules)» одной
 * строкой, а § 2.1 дампил ровно одну строку подключения. Человек, читающий
 * инструкцию В МОМЕНТ АВАРИИ, заключал бы, что данные проектов покрыты.
 *
 * Молчание в интерфейсе вылечено раньше (`c5dae3446`): пользователь видит
 * приписку в тот момент, когда получает базу. Этот сторож — про документацию:
 * она читается, когда что-то уже случилось, и потому врать ей нельзя.
 *
 * Сторож статический по той же причине, что и qsignClaims.guard: он краснеет до
 * того, как текст попадёт к читателю.
 */

// Путь от файла теста, а не от process.cwd(): в полном прогоне достаточно одного
// теста, сменившего рабочую папку в том же воркере, чтобы сканировать не тот
// каталог. На этом уже спотыкался соседний сторож.
const REPO = join(__dirname, "..", "..");
const DOCS = join(REPO, "docs");

const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  {
    // Смысловой, а не буквальный. Замер мутацией 19.08.2026: подмена честной строки
    // «the project instance has no backup of any kind» на «the project instance is
    // fully backed up» сторожа НЕ разбудила — в списке стояло «project DATABASES are
    // backed up», и разницы в одном слове хватило, чтобы обещание прошло. Сторож,
    // ловящий формулировку вместо смысла, обходится случайно, без злого умысла.
    //
    // Требуется УТВЕРЖДАЮЩАЯ форма («backed up», «резервируется»), а не просто
    // близость слов. Первая версия шаблона делала «ed» необязательным — и
    // покраснела на инструкции «Railway → project → service devhub-projects-db →
    // Backups», то есть на тексте, который объясняет, КАК проверить состояние.
    // Сторож, краснеющий на честном тексте, будет отключён первым.
    pattern: /(project|devhub|проект)[^.\n]{0,60}\bbacked\s*up\b|(project|devhub|проект)[^.\n]{0,60}резервиру/i,
    why: "утверждает покрытие проектного инстанса — он не резервируется (issue #957)",
  },
  {
    pattern: /Postgres\s*\(\s*all modules\s*\)/i,
    why: "«Postgres (all modules)» — читается как покрытие обоих инстансов, а проектный не резервируется",
  },
  {
    pattern: /all databases[^.\n]{0,40}backed up/i,
    why: "«all databases backed up» — проектный инстанс не покрыт (issue #957)",
  },
  {
    pattern: /все базы[^.\n]{0,40}резервир/i,
    why: "«все базы резервируются» — проектный инстанс не покрыт",
  },
  {
    pattern: /project databases[^.\n]{0,30}are backed up/i,
    why: "прямое утверждение, что проектные базы резервируются",
  },
];

function collectDocs(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules") continue;
      out.push(...collectDocs(full));
    } else if (entry.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

describe("сторож: документация не обещает бэкап, которого нет", () => {
  const files = collectDocs(DOCS);

  test("сканер нашёл документацию — иначе зелёный ничего не значит", () => {
    // Без этой проверки переезд каталога дал бы вечнозелёный сторож при нулевом
    // охвате. Отдельно убеждаемся, что RUNBOOK — тот самый файл — в наборе.
    expect(files.length).toBeGreaterThan(3);
    expect(files.some((f) => f.endsWith("RUNBOOK.md")), "RUNBOOK.md не попал в набор").toBe(true);
  });

  test("ни один документ не утверждает покрытие обоих инстансов", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      for (const { pattern, why } of FORBIDDEN) {
        const lines = text.split("\n");
        lines.forEach((line, i) => {
          // Строки, где формулировка приведена КАК ЗАПРЕЩЁННАЯ (в кавычках, с
          // пометкой «used to say»), — это объяснение, а не обещание. Иначе
          // сторож краснеет на тексте, который сам же и требует.
          if (/used to say|раньше писал|запрещ|forbidden|«/i.test(line)) return;
          // Строка С ОТРИЦАНИЕМ — это признание, а не обещание: «not backed up»,
          // «no backup», «нет бэкапа». Без этого пропуска смысловой шаблон ниже
          // краснел бы на самом честном тексте документа.
          const denies = /\b(no|not|never|without)\b|\bнет\b|не\s+резервир/i.test(line);
          if (denies) return;
          if (pattern.test(line)) {
            offenders.push(`${f.replace(REPO, ".")}:${i + 1} — ${why}`);
          }
        });
      }
    }
    expect(offenders, `ложные обещания о бэкапе:\n${offenders.join("\n")}`).toEqual([]);
  });

  test("RUNBOOK называет второй инстанс и его состояние", () => {
    // Положительное требование, а не только запрет: убрать ложную строку и не
    // сказать правду — то же молчание, только тише.
    const runbook = readFileSync(join(DOCS, "RUNBOOK.md"), "utf8");
    expect(runbook, "второй инстанс не назван").toMatch(/DEVHUB_DB_ADMIN_URL/);
    expect(runbook, "не сказано, что бэкапа нет").toMatch(/no backup|not backed up|нет бэкапа/i);
    expect(runbook, "нет ссылки на issue, по которой отслеживается состояние").toMatch(/#957/);
  });
});

describe("сторож: каталоги с данными не уезжают наружу", () => {
  // Дыру открыла собственная починка. Пока команда npm run backup была потеряна,
  // каталог .aevion-backups/ не создавался, и правил для него не было ни в
  // .gitignore, ни в .railwayignore. Команду вернули 14.08.2026 — и проверка
  // показала 8 файлов копий как untracked, то есть они уехали бы и в образ при
  // заливке, и в коммит при git add -A. А в копиях лежат кошельки и реестр AEV.
  //
  // Отдельным правилом, а не расширением шаблона: каталоги называются
  // по-разному, и **/.aevion-data/ второй не покрывает.
  const MUST_BE_EXCLUDED = [".aevion-data", ".aevion-backups"];

  test(".gitignore бэкенда исключает и хранилище, и его снимки", () => {
    const gi = readFileSync(join(__dirname, "..", ".gitignore"), "utf8");
    for (const dir of MUST_BE_EXCLUDED) {
      expect(gi, `${dir} не исключён в .gitignore — копии попадут в репозиторий`).toContain(`${dir}/`);
    }
  });

  test("список для заливки исключает их же — иначе данные уедут в образ", () => {
    const ri = readFileSync(join(REPO, ".railwayignore"), "utf8");
    for (const dir of MUST_BE_EXCLUDED) {
      expect(ri, `${dir} не исключён в списке заливки`).toContain(`${dir}/`);
    }
    // Охват: файл должен содержать хотя бы известные каталоги фронтенда, иначе
    // «содержит .aevion-data» могло бы пройти на огрызке.
    expect(ri).toContain("frontend/");
  });
});
