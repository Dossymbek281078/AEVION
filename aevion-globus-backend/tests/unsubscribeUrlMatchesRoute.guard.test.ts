import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { unsubscribeUrl } from "../src/lib/waitlistUnsubToken";

// Ссылка в письме обязана попадать в существующий маршрут — 21.08.2026.
//
// Ровно этот разрыв и был дефектом дня: письма звали на
// `aevion.app/constitution/waitlist/unsubscribe`, а маршрута с таким путём не
// существовало вовсе. Дефект жил в СВЯЗИ трёх файлов — письмо, роутер, монтирование
// в index.ts, — и каждый по отдельности выглядел исправным.
//
// Поэтому проверка идёт по связи, а не по одному файлу: берём ссылку, которую
// СОБИРАЕТ помощник писем, и убеждаемся, что её путь = точка монтирования плюс путь
// маршрута.

const SRC = join(__dirname, "..", "src");

describe("ссылка отписки попадает в существующий маршрут", () => {
  const index = readFileSync(join(SRC, "index.ts"), "utf8");
  const route = readFileSync(join(SRC, "routes", "constitutionWaitlist.ts"), "utf8");

  test("прибор нашёл и монтирование, и маршрут", () => {
    // Контроль: без него «пути совпали» могло бы значить «я не нашёл ни одного».
    expect(index).toMatch(/app\.use\("\/api\/constitution\/waitlist",\s*constitutionWaitlistRouter\)/);
    expect(route).toMatch(/constitutionWaitlistRouter\.get\(\s*[\r\n\s]*"\/unsubscribe"/);
  });

  test("путь из письма = точка монтирования + путь маршрута", () => {
    process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET || "test-secret-at-least-16-chars-long";
    const url = unsubscribeUrl("kto@primer.test")!;
    const path = new URL(url).pathname;

    const mount = /app\.use\("([^"]+)",\s*constitutionWaitlistRouter\)/.exec(index)?.[1];
    expect(mount, "не нашёл, куда смонтирован роутер").toBeTruthy();
    expect(path, `ссылка ведёт на ${path}, а роутер живёт на ${mount}`).toBe(`${mount}/unsubscribe`);
  });

  test("прежний мёртвый путь не вернулся ни в один из трёх файлов", () => {
    // Он жил в двух письмах и в собственной копии сборщика ссылки. Проверяем текстом,
    // потому что вернуться он может любым из них.
    const brevo = readFileSync(join(SRC, "lib", "constitutionBrevo.ts"), "utf8");
    const launch = readFileSync(join(SRC, "lib", "launchAnnounce.ts"), "utf8");
    const DEAD = "aevion.app/constitution/waitlist/unsubscribe";
    for (const [name, text] of [["constitutionBrevo.ts", brevo], ["launchAnnounce.ts", launch]] as const) {
      // Упоминание в комментарии допустимо — там объясняется, что путь мёртв.
      const inCode = text
        .split(/\r?\n/)
        .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
        .join("\n");
      expect(inCode, `${name}: вернулся мёртвый путь`).not.toContain(DEAD);
    }
  });
});
