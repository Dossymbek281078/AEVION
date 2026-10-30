// Отпечаток файла (fileHash, SHA-256 сырых байтов, считается в браузере автора)
// хранится в IPCertificate и показывается на /verify — но до этой правки НЕ
// попадал ни в пакет проверки (bundle.json), ни в PDF. Витрина /qright при этом
// обещает: «сохраним рядом с сертификатом как доказательство, что именно этот
// файл существовал на эту метку времени» и «пакет работает, даже если AEVION
// погаснет». Без отпечатка в пакете офлайн-доказательство ПРО ФАЙЛ не существует.
//
// Честность: fileHash не входит в contentHash, подписи и якорь OpenTimestamps —
// пакет обязан сказать это прямо, иначе поле прочитают как «подписано».
import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { inflateSync } from "zlib";

let rows: Array<Record<string, unknown>> = [];

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string) => {
      if (String(sql).includes('FROM "IPCertificate"')) return { rows };
      return { rows: [] };
    }),
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

const FILE_HASH = "a1c92f08828b1e0b89b9b6ffd3ea01f409dd15dd4551e5fdc85203efb21295af";

function cert(extra: Record<string, unknown> = {}) {
  return {
    id: "cert-test",
    title: "Работа",
    description: "Описание",
    kind: "text",
    contentHash: "a".repeat(64),
    signatureHmac: "h".repeat(64),
    signatureEd25519: "b".repeat(128),
    publicKeyEd25519: "302a300506032b6570032100" + "c".repeat(64),
    algorithm: "SHA-256 + HMAC + Ed25519",
    shardCount: 5,
    shardThreshold: 3,
    status: "active",
    protectedAt: new Date("2026-08-29T00:00:00Z"),
    signedAt: new Date("2026-08-29T00:00:00Z"),
    ...extra,
  };
}

beforeEach(() => {
  rows = [];
});

describe("пакет проверки везёт отпечаток файла", () => {
  test("fileHash есть — он в certificate и в proofs, с честной оговоркой", async () => {
    rows = [cert({ fileHash: FILE_HASH })];
    const r = await request(app()).get("/api/pipeline/certificate/cert-test/bundle.json");
    expect(r.status).toBe(200);
    expect(r.body?.certificate?.fileHash, "fileHash не доехал до certificate").toBe(FILE_HASH);
    const fh = r.body?.proofs?.fileHash;
    expect(fh, "fileHash не доехал до proofs").toBeTruthy();
    expect(fh.algo).toBe("SHA-256");
    expect(fh.value).toBe(FILE_HASH);
    // Отпечаток НЕ покрыт подписями и якорем — пакет обязан сказать это сам.
    expect(fh.covered).toBe(false);
    expect(String(fh.note)).toMatch(/not covered|NOT covered/i);
    // В инструкции проверяющему — шаг про файл.
    expect(JSON.stringify(r.body?.verification?.howTo ?? [])).toMatch(/fileHash/);
  });

  test("fileHash нет — честный null, а не пропущенное поле", async () => {
    rows = [cert()];
    const r = await request(app()).get("/api/pipeline/certificate/cert-test/bundle.json");
    expect(r.status).toBe(200);
    expect("fileHash" in (r.body?.certificate ?? {})).toBe(true);
    expect(r.body.certificate.fileHash).toBeNull();
    expect("fileHash" in (r.body?.proofs ?? {})).toBe(true);
    expect(r.body.proofs.fileHash).toBeNull();
  });
});

/** Текст всех FlateDecode-потоков PDF (pdfkit сжимает содержимое страниц). */
function pdfText(buf: Buffer): string {
  const s = buf.toString("latin1");
  let out = "";
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const raw = Buffer.from(m[1], "latin1");
    try {
      out += inflateSync(raw).toString("latin1");
    } catch {
      out += m[1];
    }
  }
  // pdfkit пишет текст шестнадцатеричными строками <…> Tj — раскодируем и их (стандартные шрифты = WinAnsi ≈ latin1).
  const hex = out.match(/<[0-9a-fA-F]+>/g) ?? [];
  const decoded = hex.map((h) => Buffer.from(h.slice(1, -1), "hex").toString("latin1")).join("\n");
  return out + "\n" + decoded;
}

describe("PDF печатает отпечаток файла", () => {
  test("fileHash есть — в PDF строка FILE и сам отпечаток", async () => {
    rows = [cert({ fileHash: FILE_HASH })];
    const r = await request(app()).get("/api/pipeline/certificate/cert-test/pdf").buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(r.status).toBe(200);
    const text = pdfText(r.body as Buffer);
    expect(text, "в PDF нет подписи поля FILE").toMatch(/FILE/);
    expect(text, "в PDF нет самого отпечатка файла").toContain(FILE_HASH);
  });

  test("fileHash нет — PDF без поля FILE (не печатать пустоту)", async () => {
    rows = [cert()];
    const r = await request(app()).get("/api/pipeline/certificate/cert-test/pdf").buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(r.status).toBe(200);
    expect(pdfText(r.body as Buffer)).not.toMatch(/FILE HASH/);
  });
});
