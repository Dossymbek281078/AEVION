import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { можноСлужитьСтатикой } from "../src/lib/staticServable";

/**
 * Выбрал React — получи живой адрес, а не 409.
 *
 * ЗАМЕР НА ПРОДЕ 05.10.2026 (гость, стек react, коммит 6aae42521af4):
 *   генерация  → 200, 4 файла, $0.001053, provider gemini
 *   раскладка  → public/index.html, src/index.jsx, src/App.jsx, src/style.css
 *   выкатка    → 409 "project is not static — nothing to serve"
 *
 * Отказ ЧЕСТНЫЙ и трогать его нельзя: такая публикация «удалась бы» и отдавала
 * бы 404 (правило «deploy = uploaded + serves»). Дефект был ВЫШЕ: вход
 * предлагает пять стеков, а опубликовать можно только тот, у которого
 * index.html лежит в корне — то есть человек получал файлы, которые нельзя
 * опубликовать, и узнавал об этом последним шагом.
 *
 * Сторож делает ЗАПРОС К РУЧКЕ и смотрит, что реально ушло модели, а не какие
 * слова лежат в файле: прежняя его версия проверяла только помощника, и правка
 * «убрать указание из промта» прошла бы мимо (наш класс «тест охранял
 * помощника, а не вывод»).
 */
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: async () => { throw new Error("нет базы"); } }),
  getPoolStats: () => null,
}));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));

const { промты } = vi.hoisted(() => ({ промты: [] as string[] }));
vi.mock("../src/services/qcoreai/providers", () => ({
  getProviders: () => [
    { id: "gemini", name: "G", models: [], defaultModel: "m", envKey: "GEMINI_API_KEY", configured: true },
  ],
  callProvider: async (_id: string, messages: Array<{ role: string; content: string }>) => {
    промты.push(messages.filter((m) => m.role === "user").map((m) => m.content).join(" "));
    return {
      reply: JSON.stringify({ files: [{ path: "index.html", content: "<h1>x</h1>", language: "html" }] }),
      model: "m",
      usage: {},
    };
  },
}));

// eslint-disable-next-line import/first
import { devhubRouter, __resetDevHubStore, __указаниеПоСтекуForTest as указание } from "../src/routes/devhub";

function приложение() {
  const a = express();
  a.use(express.json());
  // ЛИЧНОСТЬ ЭТОГО ФАЙЛА. Без заголовка x-devhub-guest создание даёт
  // собственную метку (devhub.ts, 06.10.2026: безметочные проекты больше не
  // лежат в общем ящике "anonymous", откуда их удалял любой посторонний), и
  // следующий запрос без метки получал бы 404 на свой же проект. Тесты про
  // владение этим не занимаются — даём им одну устойчивую личность на файл.
  a.use((req, _res, next) => { req.headers["x-devhub-guest"] = "t-reactprojectispublishable-guard"; next(); });
  a.use("/api/devhub", devhubRouter);
  return a;
}

async function перваяГенерация(stack: string) {
  промты.length = 0;
  const cr = await request(приложение()).post("/api/devhub/projects").send({ name: "P-" + stack, stack });
  const id = cr.body.project.id;
  await request(приложение())
    .post("/api/devhub/projects/" + id + "/generate")
    .send({ prompt: "landing page with a button" });
  return промты.join(" ");
}

beforeEach(() => { промты.length = 0; __resetDevHubStore?.(); });

describe("проект на React можно опубликовать", () => {
  it("прибор исправен: гейт различает две раскладки", () => {
    // Ровно та раскладка, что пришла с прода, — не проходит.
    expect(можноСлужитьСтатикой(["public/index.html", "src/index.jsx", "src/App.jsx", "src/style.css"])).toBe(false);
    // Требуемая — проходит.
    expect(можноСлужитьСтатикой(["index.html", "app.js"])).toBe(true);
  });

  it("ЖИВОЙ ПУТЬ: указание доходит до модели при стеке react", async () => {
    const промт = await перваяГенерация("react");
    expect(промт.length, "модель не вызвана — мерить нечего").toBeGreaterThan(20);
    expect(промт, "корень не потребован").toContain("PROJECT ROOT");
    expect(промт, "public/index.html не запрещён").toContain("public/index.html");
    expect(промт, "про отсутствие сборки не сказано").toMatch(/NO build step/i);
  });

  it("ЖИВОЙ ПУТЬ, КОНТРОЛЬ: при стеке static указания в промте НЕТ", async () => {
    // Без этого контроля правило могло бы стоять всегда и ничего не означать.
    const промт = await перваяГенерация("static");
    expect(промт.length, "модель не вызвана — контроль пуст").toBeGreaterThan(20);
    expect(промт, "указание ушло и на static").not.toContain("PROJECT ROOT");
  });

  it("КОНТРОЛЬ: next / express / python указания не получают — им нужен сервер", () => {
    for (const s of ["next", "express", "python"]) expect(указание(s), s).toBe("");
  });

  it("КОНТРОЛЬ: начатый проект не переезжает посреди работы", () => {
    expect(указание("react", 7, 0), "применилось к проекту с файлами").toBe("");
    expect(указание("react", 0, 1), "применилось к правке одного файла").toBe("");
  });

  it("регистр и пробелы в имени стека правило не отменяют", () => {
    expect(указание(" React ").length).toBeGreaterThan(80);
  });
});
