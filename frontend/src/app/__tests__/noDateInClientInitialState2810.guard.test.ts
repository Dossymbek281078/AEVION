import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/sourceCode";

/**
 * 27–28.10.2026, класс ошибки гидратации (React #418): дата в НАЧАЛЬНОМ состоянии
 * клиентского компонента. Статический HTML собран в день сборки, клиент считает
 * «сегодня» в свой день — разметка расходится, React перерисовывает всё дерево.
 * Так падали /cyberchess/daily и /training (06e31273b), так же был устроен
 * /launch-status (useState(Date.now())). Правило: дату ставить в useEffect после
 * монтирования; начальное состояние — 0 / null / значение, не зависящее от часов.
 *
 * Сторож смотрит только файлы с "use client" (серверные компоненты рендерятся один
 * раз и гидратации не проходят) и только useState: new Date()/Date.now() внутри
 * обработчиков и эффектов законны.
 */
const КОРЕНЬ = join(process.cwd(), "src", "app");
const ДАТА_В_НАЧАЛЬНОМ = /useState(?:<[^>]*>)?\(\s*(?:\(\)\s*=>\s*)?(?:new Date\(|Date\.now\()/;

function файлы(каталог: string, acc: string[] = []): string[] {
  for (const имя of readdirSync(каталог)) {
    const полный = join(каталог, имя);
    if (statSync(полный).isDirectory()) {
      if (имя === "__tests__" || имя === "node_modules") continue;
      файлы(полный, acc);
    } else if (/\.tsx?$/.test(имя) && !/\.test\.tsx?$/.test(имя)) acc.push(полный);
  }
  return acc;
}

describe("дата не живёт в начальном состоянии клиентских компонентов", () => {
  const все = файлы(КОРЕНЬ);
  const клиентские = все.filter((f) => /^\s*["']use client["']/m.test(readFileSync(f, "utf8")));

  it("контроль прибора: клиентские файлы найдены, правило ловит образец", () => {
    expect(все.length).toBeGreaterThan(200);
    expect(клиентские.length).toBeGreaterThan(50);
    expect(ДАТА_В_НАЧАЛЬНОМ.test("const [now, setNow] = useState(Date.now());")).toBe(true);
    expect(ДАТА_В_НАЧАЛЬНОМ.test("const [d, setD] = useState<Date>(() => new Date());")).toBe(true);
    expect(ДАТА_В_НАЧАЛЬНОМ.test("const [now, setNow] = useState(0);")).toBe(false);
    expect(ДАТА_В_НАЧАЛЬНОМ.test("useEffect(() => { setNow(Date.now()); }, []);")).toBe(false);
  });

  /**
   * Замер 28.10.2026 этим же правилом: 9 файлов уже так устроены. Список заморожен —
   * расти не может, тает по мере починки (вторая проверка требует вычёркивать починенное).
   * У большинства «now» — часы/обратный отсчёт, которые тикают в useEffect; первый рендер
   * от них отличается на миллисекунды, но при статической сборке — на дни.
   */
  const ЖДУТ = new Set([
    "auth/page.tsx",
    "bank/gift/[id]/page.tsx",
    "bank/_components/AecVault.tsx",
    "bank/_components/GiftMode.tsx",
    "bank/_components/SpendingChallenges.tsx",
    "cyberchess/economy/page.tsx",
    "cyberchess/spectator/page.tsx",
    "lifebox/components/Countdown.tsx",
    "qcoreai/audit-log/page.tsx",
  ]);
  const нарушители = клиентские
    .filter((f) => ДАТА_В_НАЧАЛЬНОМ.test(stripComments(readFileSync(f, "utf8"))))
    .map((f) => f.slice(КОРЕНЬ.length + 1).split("\\").join("/"));

  it("новых useState с датой в клиентских компонентах не появилось", () => {
    expect(
      нарушители.filter((f) => !ЖДУТ.has(f)),
      "дата в начальном состоянии — разметка сборки и клиента разойдутся (React #418). Ставьте её в useEffect",
    ).toEqual([]);
  });

  it("список ожидающих не протух: починенное вычёркивается", () => {
    expect([...ЖДУТ].filter((f) => !нарушители.includes(f)), "уже починены — уберите из ЖДУТ").toEqual([]);
  });

  it("/launch-status: «сейчас» ставится после монтирования, подпись ждёт первого тика", () => {
    const src = stripComments(readFileSync(join(КОРЕНЬ, "launch-status", "page.tsx"), "utf8"));
    expect(src).toContain("useState(0)");
    expect(src).toContain("setNow(Date.now());");
    expect(src).toContain("{now > 0 && (");
  });
});
