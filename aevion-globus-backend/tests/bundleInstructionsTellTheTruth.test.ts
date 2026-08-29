// Пакет везёт инструкцию по проверке — это то, чему следует третья сторона:
// суд, площадка, работодатель. Инструкция врала дважды, и оба раза в сторону
// «доказано больше, чем на самом деле».
//
//   шаг 2: велел проверить подпись ключом ИЗ ЭТОГО ЖЕ ФАЙЛА и не говорил, что
//          это доказывает целостность, а не происхождение;
//   шаг 5: «если в поле написано bitcoin-confirmed, существование
//          математически привязано к блоку» — но поле пишем МЫ. Следуя этому
//          шагу, проверяющий доверял бы нашему утверждению вместо байтов.
//
// Инструкция опаснее кода: код проверяют тесты, а инструкции верят.
import { describe, test, expect, vi } from "vitest";
import request from "supertest";
import express from "express";

const rows = [
  {
    id: "cert-x",
    title: "Работа",
    description: "Описание",
    kind: "text",
    contentHash: "a".repeat(64),
    signatureHmac: "b".repeat(64),
    signatureEd25519: "c".repeat(128),
    publicKeyEd25519: "302a300506032b6570032100" + "d".repeat(64),
    signedAt: new Date("2026-08-29T00:00:00Z"),
  },
];

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string) =>
      String(sql).includes('FROM "IPCertificate"') ? { rows } : { rows: [] },
    ),
  }),
}));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));

// eslint-disable-next-line import/first
import { pipelineRouter } from "../src/routes/pipeline";

const app = () => {
  const a = express();
  a.use(express.json());
  a.use("/api/pipeline", pipelineRouter);
  return a;
};

async function howTo(): Promise<string[]> {
  const r = await request(app()).get("/api/pipeline/certificate/cert-x/bundle.json");
  expect(r.status).toBe(200);
  const steps = r.body?.verification?.howTo;
  expect(Array.isArray(steps), "инструкции в пакете нет вовсе").toBe(true);
  return steps as string[];
}

describe("инструкция в пакете не обещает лишнего", () => {
  test("шаг про подпись говорит, чего он НЕ доказывает", async () => {
    const s = (await howTo()).join("\n");
    expect(s, "подпись выдана за доказательство происхождения").toMatch(
      /NOT who signed it/i,
    );
  });

  test("есть шаг про заверение платформы и он ведёт за ключом НАРУЖУ", async () => {
    const s = (await howTo()).join("\n");
    expect(s, "слой, отличающий наш сертификат от чужого, не упомянут").toMatch(
      /platformAttestation/,
    );
    expect(s, "не сказано, где взять ключ независимо").toMatch(/qsign\/v2\/keys/);
  });

  test("про якорь сказано не доверять полю статуса", async () => {
    const s = (await howTo()).join("\n");
    expect(s, "поле, которое пишем мы, выдано за доказательство").toMatch(
      /Do not rely on the status field/i,
    );
  });

  test("шаги пронумерованы подряд, без дублей и пропусков", async () => {
    // Нумерацию я уже сбил один раз при вставке нового шага: получилось два
    // «3» и ни одного «4». Читающий инструкцию в суде такого не простит.
    const nums = (await howTo()).map((x) => Number(String(x).match(/^(\d+)\./)?.[1]));
    expect(nums).toEqual(nums.map((_, i) => i + 1));
  });
});
