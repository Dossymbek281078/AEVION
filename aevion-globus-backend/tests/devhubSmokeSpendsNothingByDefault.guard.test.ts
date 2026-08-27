import { describe, test, expect } from "vitest";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import type { AddressInfo } from "node:net";

/**
 * Смоук DevHub по умолчанию не тратит деньги и ничего не шлёт наружу.
 *
 * Повод (28.08.2026). Файл называется `devhub-prod-smoke.js`, а строка запуска
 * в его же шапке предлагала боевой адрес первым. Каждая медиа-ручка
 * проверялась двумя запросами: с неполным телом (400, бесплатно) и с ПОЛНЫМ.
 * Второй на проде, где ключи заданы, выполняется по-настоящему — то есть
 * прогон тратил платную генерацию, отправлял письмо на несуществующий адрес,
 * слал SMS и WhatsApp на живой номер постороннего человека `+79001234567` и
 * создавал в БОЕВОМ магазине позицию «Smoke Item» за $9.99.
 *
 * Замер поведением подтвердил: по умолчанию наружу уходило 9 настоящих
 * действий. Теперь их ноль, а тратящая и пишущая половины включаются флагами.
 *
 * ПОЧЕМУ СТОРОЖ ПОВЕДЕНЧЕСКИЙ, а не по исходнику: разбор кода доказал бы
 * наличие условий, но не то, что за ними не осталось обходного пути. Здесь
 * поднимается приёмник, скрипт запускается против него, и считаются
 * ФАКТИЧЕСКИ ушедшие запросы.
 */

const SCRIPT = path.join(__dirname, "..", "scripts", "devhub-prod-smoke.js");

/** Признаки настоящих действий — ровно те тела, что уходили бы к провайдерам. */
const REAL_ACTION = [
  "+79001234567",            // SMS и WhatsApp живому номеру
  "test@example.com",        // письмо на несуществующий адрес
  "Smoke Item",              // позиция в боевом магазине
  "Hello from AEVION",       // озвучка
  "futuristic AEVION",       // картинка
  "door creak",              // звук
  "Calm background",         // музыка
];

type Seen = { method: string; url: string; body: string };

async function runSmoke(env: NodeJS.ProcessEnv): Promise<Seen[]> {
  const seen: Seen[] = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ method: req.method ?? "", url: req.url ?? "", body });
      res.setHeader("content-type", "application/json");
      // Отвечаем как живой бэкенд, чтобы скрипт дошёл до конца: на пустое тело
      // 400 (это и есть проверяемые ворота), иначе успех.
      const empty = body === "" || body === "{}";
      res.statusCode = req.method === "POST" && empty ? 400 : req.method === "POST" ? 201 : 200;
      res.end(
        JSON.stringify({
          ok: true, status: "ok", db: "up",
          projects: [], templates: [], capabilities: [], models: [], snippets: [], deployments: [], files: [],
          id: "x", project: { id: "x" }, snippet: { id: "s1" },
        }),
      );
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  try {
    await new Promise<void>((resolve) => {
      const p = spawn(process.execPath, [SCRIPT], {
        env: { ...process.env, BASE: `http://127.0.0.1:${port}`, ...env },
        stdio: "ignore",
      });
      p.on("close", () => resolve());
      p.on("error", () => resolve());
    });
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
  return seen;
}

function realActions(seen: Seen[]): string[] {
  const out: string[] = [];
  for (const s of seen) for (const m of REAL_ACTION) if (s.body.includes(m)) out.push(`${s.url} ← ${m}`);
  return out;
}

describe("devhub-prod-smoke", () => {
  test("прибор работает: скрипт доходит до конца и запросы считаются", async () => {
    const seen = await runSmoke({});
    // Если бы приёмник не отвечал, скрипт обрывался бы на health — и ноль
    // отправок читался бы как «безопасно», ничего не доказывая.
    expect(seen.length, "скрипт не дошёл до медиа-ручек — замер ничего не значит").toBeGreaterThan(15);
  }, 60_000);

  test("по умолчанию наружу не уходит ни одного настоящего действия", async () => {
    const seen = await runSmoke({});
    expect(realActions(seen), "смоук снова тратит деньги или шлёт наружу").toEqual([]);
  }, 60_000);

  test("по умолчанию ничего не пишется в боевую базу", async () => {
    const seen = await runSmoke({});
    const writes = seen.filter(
      (s) => ["POST", "PUT", "DELETE"].includes(s.method) && s.body.includes("Smoke-"),
    );
    expect(writes.map((w) => w.url), "смоук снова создаёт проекты на проде").toEqual([]);
  }, 60_000);

  test("контроль: с флагами действия ВОЗВРАЩАЮТСЯ", async () => {
    // Без этой проверки предыдущие три были бы зелёными и на сломанном
    // скрипте, который просто ничего не делает.
    const seen = await runSmoke({ DEVHUB_SMOKE_ALLOW_SPEND: "1", DEVHUB_SMOKE_ALLOW_WRITE: "1" });
    expect(realActions(seen).length, "флаг не включает тратящую половину").toBeGreaterThan(5);
  }, 60_000);
});
