import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as fs from "node:fs";
import * as path from "node:path";

import { writeSubscription, readLatestSubscription } from "../src/routes/provisioning";

// Куда пишутся подписки, решалось ОДИН раз при импорте и от текущего каталога
// процесса: `join(process.cwd(), "data", "subscriptions.jsonl")`. Оба свойства
// били по-настоящему (10.08.2026):
//
//  • Прогон тестов не из каталога бэкенда клал записи в `data/subscriptions.jsonl`
//    в корне репозитория. Корневой путь не закрыт `.gitignore` (закрыт
//    внутрипакетный, как PII) — и записи уехали в коммиты 0ff550de6 и 7b292af6e.
//  • Вычисление на импорте означало, что `SUBSCRIPTIONS_FILE`, выставленный
//    тестом, применялся, только если этот тест импортировал модуль первым в
//    своём воркере. Иначе тест работал с общим файлом и видел записи чужих
//    прогонов: `paywallProvisionFlow` падал на «до покупки должно быть 402»,
//    потому что покупатель был «оплачен» неделей раньше другим прогоном. Это
//    списывали на нестабильность набора.
//
// Тесты ниже держат оба свойства: путь считается на каждый вызов и не зависит
// от cwd.

const ORIGINAL = process.env.SUBSCRIPTIONS_FILE;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.SUBSCRIPTIONS_FILE;
  else process.env.SUBSCRIPTIONS_FILE = ORIGINAL;
});

describe("хранилище подписок: путь считается на вызов и не зависит от cwd", () => {
  it("SUBSCRIPTIONS_FILE, выставленный ПОСЛЕ импорта, всё равно применяется", () => {
    const dir = mkdtempSync(join(tmpdir(), "aevion-subs-path-"));
    const file = join(dir, "subscriptions.jsonl");
    try {
      // Ключевой момент: модуль уже импортирован (см. import выше), env меняем
      // только сейчас. При вычислении на импорте запись ушла бы мимо.
      process.env.SUBSCRIPTIONS_FILE = file;

      const email = "store-path@test.aevion.dev";
      writeSubscription({
        id: "sub_store_path",
        ts: new Date().toISOString(),
        email,
        tierId: "medium",
        period: "monthly",
        seats: 1,
        modules: [],
        trialDays: 0,
      });

      expect(existsSync(file)).toBe(true);
      expect(readFileSync(file, "utf8")).toContain(email);
      expect(readLatestSubscription(email)?.id).toBe("sub_store_path");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("путь по умолчанию привязан к каталогу пакета, а не к process.cwd()", () => {
    const src = fs
      .readFileSync(path.join(__dirname, "..", "src", "routes", "provisioning.ts"), "utf8")
      .replace(/^\s*\*.*$/gm, ""); // строки JSDoc: там cwd упомянут как разбор инцидента
    expect(src).not.toMatch(/process\.cwd\(\)/);
  });

  it("в репозитории нет отслеживаемого git рабочего состояния QTrade", () => {
    // Тот же класс и из того же коммита 0ff550de6, что и подписки: прогон
    // тестов из корня оставил там `.aevion-data/` со счетами вида
    // `credit-test-…@example.com` и временный `.tmp`, а корневой путь не был
    // закрыт `.gitignore` — закрыт только внутрипакетный.
    const root = path.join(__dirname, "..", "..", ".aevion-data");
    const tracked = fs.existsSync(root)
      ? fs.readdirSync(root).filter((f) => /\.json(\.\d+\.\d+\.tmp)?$/.test(f))
      : [];
    // Файлы на диске — норма, это рабочее состояние. Проверяем, что путь закрыт
    // от git: иначе следующий прогон снова принесёт их в коммит.
    const gitignore = fs.readFileSync(path.join(__dirname, "..", "..", ".gitignore"), "utf8");
    expect(
      gitignore,
      `.aevion-data закрыт только внутри пакета, а на диске лежит: ${tracked.join(", ")}`,
    ).toMatch(/^\*\*\/\.aevion-data\/$/m);
  });

  it("в репозитории нет отслеживаемого git хранилища подписок", () => {
    // Корневой `data/subscriptions.jsonl` появлялся ровно от прогона не из той
    // папки. Файл с записями о подписках не должен лежать в git ни по какому
    // пути — не потому, что эти адреса реальные, а потому что защита от PII не
    // может зависеть от того, откуда запустили тесты.
    const rootStore = path.join(__dirname, "..", "..", "data", "subscriptions.jsonl");
    expect(fs.existsSync(rootStore)).toBe(false);
  });
});
