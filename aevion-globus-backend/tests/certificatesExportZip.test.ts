/*
 * 20.10.2026 (Продажи): бюро на пилоте спрашивает «а если уйдём?» — нужна
 * выгрузка всех записей аккаунта одним архивом, которая проверяется без нас.
 *
 * GET /api/pipeline/certificates/export.zip:
 *  - только с Bearer (401 без), только записи владельца;
 *  - <certId>/bundle.json байт-в-байт равен ответу /certificate/:certId/bundle.json;
 *  - index.json: account, count, records, howToVerify;
 *  - пустой аккаунт — 404 no_records, больше 500 — 413 too_many_records.
 *
 * Писатель zip свой (zlib), поэтому архив обязательно распаковывается СТОРОННИМ
 * инструментом (bsdtar; на Windows ещё и Expand-Archive) и сравнивается побайтно.
 * И каждый пакет из архива прогоняется офлайн-проверкой фронта (verifyAevionBundle)
 * — той самой, что работает на /verify без обращения к AEVION.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

const SECRET = "test-jwt-secret-export-zip";
process.env.NODE_ENV = "test";
process.env.AUTH_JWT_SECRET = SECRET;

type Obj = { id: string; ownerUserId: string | null; ownerEmail: string | null; createdAt: Date };
type Cert = Record<string, unknown>;
const { db } = vi.hoisted(() => ({ db: { objects: [] as Obj[], certs: [] as Cert[], sql: [] as string[], limit: undefined as unknown } }));

/*
 * Мини-база: фильтр владельца применяется ТОЛЬКО если он написан в SQL ручки.
 * Убери его из запроса — мок вернёт все строки, и тест увидит чужую запись.
 */
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      const s = String(sql);
      db.sql.push(s);
      if (s.includes('FROM "IPCertificate" c') && s.includes('JOIN "QRightObject" o')) {
        const ownerFilter = s.includes('o."ownerUserId" = $1');
        db.limit = params[2];
        const rows = db.certs
          .map((c) => ({ c, o: db.objects.find((o) => o.id === c.objectId) }))
          .filter(({ o }) => !!o)
          .filter(({ o }) =>
            !ownerFilter ||
            o!.ownerUserId === params[0] ||
            (o!.ownerUserId === null && o!.ownerEmail === params[1]),
          )
          .map(({ c, o }) => ({ ...c, objectCreatedAt: o!.createdAt }));
        return { rows };
      }
      if (s.includes('FROM "IPCertificate" WHERE "id" = $1')) {
        return { rows: db.certs.filter((c) => c.id === params[0]) };
      }
      return { rows: [] };
    }),
  }),
}));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));

const { pipelineRouter } = await import("../src/routes/pipeline");
const { canonicalContentHash } = await import("../src/lib/contentHash");
const { readZip, buildZip } = await import("../src/lib/zipWriter");
// Офлайн-проверка фронта — та, что на /verify проверяет пакет без AEVION.
const { verifyAevionBundle } = await import("../../frontend/src/lib/verifyBundle");

const app = () => {
  const a = express();
  a.use(express.json());
  a.use("/api/pipeline", pipelineRouter);
  return a;
};
const токен = (sub: string, email: string) =>
  jwt.sign({ sub, email, role: "user" }, SECRET, { algorithm: "HS256", expiresIn: "1h" });

/** Настоящий сертификат: честный хеш содержимого и настоящая подпись Ed25519. */
function realCert(id: string, objectId: string, title: string, extra: Cert = {}): Cert {
  const inputs = { title, description: `Описание ${title}`, kind: "text", country: "KZ", city: "Astana" };
  const contentHash = canonicalContentHash(inputs);
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const spki = publicKey.export({ type: "spki", format: "der" }) as Buffer;
  const signedAt = new Date("2026-10-01T10:00:00Z");
  const signatureHmac = crypto.createHmac("sha256", "k").update(contentHash).digest("hex");
  const payload = JSON.stringify({
    objectId,
    title,
    contentHash,
    signatureHmac,
    publicKeyRawHex: spki.subarray(12).toString("hex"),
    signedAt: signedAt.toISOString(),
  });
  const signatureEd25519 = crypto.sign(null, Buffer.from(payload, "utf8"), privateKey).toString("hex");
  return {
    id,
    objectId,
    shieldId: null,
    title,
    kind: inputs.kind,
    description: inputs.description,
    authorName: "Owner",
    country: inputs.country,
    city: inputs.city,
    contentHash,
    algorithm: "SHA-256",
    protectedAt: new Date("2026-10-01T10:00:00Z"),
    status: "active",
    publicKeyEd25519: spki.toString("hex"),
    signatureEd25519,
    signatureHmac,
    signedAt,
    otsStatus: null,
    otsProof: null,
    ...extra,
  };
}

const OWNER = { sub: "u-owner", email: "owner@bureau.kz" };
const MY_IDS = ["cert-a", "cert-b", "cert-c"];
const FOREIGN = "cert-foreign";

function seed() {
  db.objects = [
    { id: "obj-a", ownerUserId: OWNER.sub, ownerEmail: OWNER.email, createdAt: new Date("2026-10-01T09:00:00Z") },
    { id: "obj-b", ownerUserId: OWNER.sub, ownerEmail: OWNER.email, createdAt: new Date("2026-10-02T09:00:00Z") },
    // старая запись без ownerUserId — своя по почте, как в /api/qright/objects?mine=1
    { id: "obj-c", ownerUserId: null, ownerEmail: OWNER.email, createdAt: new Date("2026-10-03T09:00:00Z") },
    { id: "obj-x", ownerUserId: "u-other", ownerEmail: "other@x.test", createdAt: new Date("2026-10-04T09:00:00Z") },
  ];
  db.certs = [
    realCert("cert-a", "obj-a", "Патент А"),
    realCert("cert-b", "obj-b", "Work B"),
    realCert("cert-c", "obj-c", "Тұжырым C"),
    realCert(FOREIGN, "obj-x", "Чужая работа"),
  ];
}

function binaryParser(res: request.Response, cb: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
  res.on("end", () => cb(null, Buffer.concat(chunks)));
}
const exportZip = (bearer?: string, q = "") => {
  const r = request(app()).get(`/api/pipeline/certificates/export.zip${q}`).buffer(true).parse(binaryParser as never);
  return bearer ? r.set("Authorization", `Bearer ${bearer}`) : r;
};

/** Сторонний распаковщик: bsdtar (на Windows — System32\tar.exe, он читает zip). */
function extractWithTar(zip: Buffer): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aevion-zip-tar-"));
  const file = path.join(dir, "a.zip");
  fs.writeFileSync(file, zip);
  const out = path.join(dir, "out");
  fs.mkdirSync(out);
  const tar = process.platform === "win32" ? "C:\\Windows\\System32\\tar.exe" : "bsdtar";
  execFileSync(tar, ["-xf", file, "-C", out]);
  return out;
}
function extractWithExpandArchive(zip: Buffer): string | null {
  if (process.platform !== "win32") return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aevion-zip-ps-"));
  const file = path.join(dir, "a.zip");
  fs.writeFileSync(file, zip);
  const out = path.join(dir, "out");
  execFileSync("powershell", ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${file}' -DestinationPath '${out}'`]);
  return out;
}
function listFiles(root: string, rel = ""): string[] {
  const res: string[] = [];
  for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) res.push(...listFiles(root, r));
    else res.push(r);
  }
  return res.sort();
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-20T06:30:00Z"));
  db.sql = [];
  seed();
});
afterEach(() => vi.useRealTimers());

describe("GET /api/pipeline/certificates/export.zip", () => {
  test("владелец с 3 записями + 1 чужая: в архиве ровно 3 пакета и index.json, пакеты байт-в-байт", async () => {
    const r = await exportZip(токен(OWNER.sub, OWNER.email));
    expect(r.status, String(r.body)).toBe(200);
    expect(r.headers["content-type"]).toBe("application/zip");
    expect(r.headers["content-disposition"]).toBe('attachment; filename="aevion-records-2026-10-20.zip"');
    const files = readZip(r.body as Buffer);
    const names = [...files.keys()].sort();
    console.log(`[export.zip] файлов в архиве: ${names.length} (ожидалось 4): ${names.join(", ")}`);
    expect(names).toEqual(["cert-a/bundle.json", "cert-b/bundle.json", "cert-c/bundle.json", "index.json"]);
    expect(names.some((n) => n.includes(FOREIGN))).toBe(false);

    const index = JSON.parse(files.get("index.json")!.toString("utf8"));
    expect(index.count).toBe(3);
    expect(index.account).toBe(OWNER.email);
    expect(index.exportedAt).toBe("2026-10-20T06:30:00.000Z");
    expect(index.records.map((x: { certId: string }) => x.certId).sort()).toEqual(MY_IDS);
    expect(index.records.length).toBe(index.count);
    expect(index.records[0]).toEqual({
      certId: "cert-a",
      title: "Патент А",
      createdAt: "2026-10-01T09:00:00.000Z",
      verifyUrl: "https://aevion.app/verify/cert-a",
    });
    expect(typeof index.howToVerify).toBe("string");
    expect(index.howToVerify.length).toBeGreaterThan(40);

    let равны = 0;
    for (const id of MY_IDS) {
      const one = await request(app()).get(`/api/pipeline/certificate/${id}/bundle.json`);
      expect(one.status).toBe(200);
      const fromZip = files.get(`${id}/bundle.json`)!;
      expect(fromZip.equals(Buffer.from(one.text, "utf8")), `${id}: пакет в архиве отличается от bundle.json`).toBe(true);
      равны++;
    }
    console.log(`[export.zip] пакетов, байт-в-байт равных /bundle.json: ${равны}/${MY_IDS.length}`);
    expect(равны).toBe(3);
  });

  test("сторонняя распаковка (bsdtar, Expand-Archive) даёт те же байты", async () => {
    const r = await exportZip(токен(OWNER.sub, OWNER.email));
    expect(r.status).toBe(200);
    const mine = readZip(r.body as Buffer);
    const outs = [["bsdtar", extractWithTar(r.body as Buffer)], ["Expand-Archive", extractWithExpandArchive(r.body as Buffer)]] as const;
    for (const [tool, out] of outs) {
      if (!out) continue;
      const onDisk = listFiles(out);
      expect(onDisk, tool).toEqual([...mine.keys()].sort());
      let same = 0;
      for (const f of onDisk) {
        if (fs.readFileSync(path.join(out, f)).equals(mine.get(f)!)) same++;
      }
      console.log(`[export.zip] ${tool}: файлов ${onDisk.length}, побайтно совпало ${same}/${onDisk.length}`);
      expect(same).toBe(onDisk.length);
    }
  });

  test("писатель zip: кириллица в имени (флаг UTF-8), store и deflate — читаются bsdtar", () => {
    const entries = [
      { name: "папка/файл.txt", data: "привет ".repeat(200) }, // сожмётся → deflate
      { name: "rand.bin", data: crypto.randomBytes(300) }, // не сожмётся → store
      { name: "empty.txt", data: "" },
    ];
    const zip = buildZip(entries);
    const out = extractWithTar(zip);
    const onDisk = listFiles(out);
    expect(onDisk).toEqual(["empty.txt", "rand.bin", "папка/файл.txt"]);
    let same = 0;
    for (const e of entries) {
      const want = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, "utf8");
      if (fs.readFileSync(path.join(out, e.name)).equals(want)) same++;
    }
    console.log(`[zipWriter] bsdtar: побайтно совпало ${same}/${entries.length}`);
    expect(same).toBe(3);
  });

  test("ПОРОГ: каждый пакет из архива проходит офлайн-проверку фронта", async () => {
    const r = await exportZip(токен(OWNER.sub, OWNER.email));
    const out = extractWithTar(r.body as Buffer);
    let ok = 0;
    for (const id of MY_IDS) {
      const bundle = JSON.parse(fs.readFileSync(path.join(out, id, "bundle.json"), "utf8"));
      const v = await verifyAevionBundle(bundle);
      console.log(
        `[offline verify] ${id}: overall=${v.overall} contentHash=${v.contentHash.status} aevionSignature=${v.aevionSignature.status} bitcoin=${v.bitcoinAnchor.status}`,
      );
      if (v.overall === "pass" && v.contentHash.status === "pass" && v.aevionSignature.status === "pass") ok++;
    }
    console.log(`[offline verify] целостность ок: ${ok}/${MY_IDS.length}`);
    expect(ok).toBe(3);
  });

  test("КОНТРОЛЬ офлайн-проверки: подделанный заголовок в пакете из архива — не pass", async () => {
    const r = await exportZip(токен(OWNER.sub, OWNER.email));
    const b = JSON.parse(readZip(r.body as Buffer).get("cert-a/bundle.json")!.toString("utf8"));
    b.proofs.contentHash.canonicalInputs.title = "Подменено";
    const v = await verifyAevionBundle(b);
    expect(v.contentHash.status).toBe("fail");
    expect(v.overall).toBe("fail");
  });

  test("без токена — 401; битый токен — 401", async () => {
    const a = await exportZip();
    expect(a.status).toBe(401);
    const b = await exportZip(jwt.sign({ sub: OWNER.sub, email: OWNER.email }, "other-secret", { algorithm: "HS256" }));
    expect(b.status).toBe(401);
    expect(db.sql.some((s) => s.includes('JOIN "QRightObject" o'))).toBe(false);
  });

  test("чужие id в адресе игнорируются: архив только своих", async () => {
    const r = await exportZip(токен(OWNER.sub, OWNER.email), `?ids=${FOREIGN}&certId=${FOREIGN}`);
    expect(r.status).toBe(200);
    const names = [...readZip(r.body as Buffer).keys()];
    expect(names.length).toBe(4);
    expect(names.some((n) => n.includes(FOREIGN))).toBe(false);
  });

  test("владелец чужой записи получает только её", async () => {
    const r = await exportZip(токен("u-other", "other@x.test"));
    expect(r.status).toBe(200);
    const files = readZip(r.body as Buffer);
    expect([...files.keys()].sort()).toEqual([`${FOREIGN}/bundle.json`, "index.json"]);
    expect(JSON.parse(files.get("index.json")!.toString("utf8")).count).toBe(1);
  });

  test("пустой аккаунт — 404 no_records, а не пустой архив", async () => {
    const r = await request(app()).get("/api/pipeline/certificates/export.zip").set("Authorization", `Bearer ${токен("u-new", "new@x.test")}`);
    expect(r.status).toBe(404);
    expect(r.body.error).toBe("no_records");
    expect(String(r.body.message)).toMatch(/no protected records/);
  });

  test("больше 500 записей — 413 too_many_records", async () => {
    db.objects.push({ id: "obj-many", ownerUserId: "u-many", ownerEmail: "m@x.test", createdAt: new Date() });
    for (let i = 0; i < 501; i++) db.certs.push({ id: `m-${i}`, objectId: "obj-many", title: "t" });
    const r = await request(app()).get("/api/pipeline/certificates/export.zip").set("Authorization", `Bearer ${токен("u-many", "m@x.test")}`);
    expect(r.status).toBe(413);
    expect(r.body.error).toBe("too_many_records");
    expect(r.body.limit).toBe(500);
    expect(db.sql.find((s) => s.includes('JOIN "QRightObject" o'))).toMatch(/LIMIT \$3/);
    expect(db.limit).toBe(501);
  });
});
