import { describe, test, expect } from "vitest";
import { buildRunInstructions } from "../src/lib/devhubRunInstructions";

/**
 * The note is only worth shipping if it tells the truth about the project it
 * is packed with — a confident "npm install && npm run dev" next to a folder
 * with no manifest is the same class of lie the rest of DevHub spent the day
 * removing.
 */
describe("buildRunInstructions", () => {
  test("reads the run command out of the project's own manifest", () => {
    const out = buildRunInstructions({
      projectName: "Pomodoro",
      stack: "react",
      files: [
        { path: "src/App.jsx", content: "export default () => null;" },
        {
          path: "package.json",
          content: JSON.stringify({
            scripts: { dev: "vite", build: "vite build" },
            dependencies: { react: "^18.0.0", "react-dom": "^18.0.0" },
          }),
        },
      ],
    });
    expect(out).toContain("npm install");
    expect(out).toContain("npm run dev");
    expect(out).toContain("npm run build");
    expect(out).toContain("react");
  });

  test("falls back to start when there is no dev script", () => {
    const out = buildRunInstructions({
      projectName: "Api",
      stack: "express",
      files: [{ path: "package.json", content: JSON.stringify({ scripts: { start: "node server.js" } }) }],
    });
    expect(out).toContain("npm run start");
    expect(out).not.toContain("npm run dev");
  });

  test("says a project without a manifest cannot be run, instead of printing a command that fails", () => {
    const out = buildRunInstructions({
      projectName: "NoManifest",
      stack: "react",
      files: [{ path: "src/App.jsx", content: "export default () => null;" }],
    });
    expect(out).toMatch(/нет `package\.json`/);
    expect(out).not.toContain("npm install");
  });

  test("a static site is told to just open the page", () => {
    const out = buildRunInstructions({
      projectName: "Landing",
      stack: "static",
      files: [{ path: "index.html", content: "<h1>hi</h1>" }],
    });
    expect(out).toContain("index.html");
    expect(out).toContain("npx serve .");
    expect(out).not.toContain("npm install");
  });

  test("an unparseable manifest is named as broken rather than used", () => {
    const out = buildRunInstructions({
      projectName: "Broken",
      stack: "next",
      files: [{ path: "package.json", content: "{ not json" }],
    });
    expect(out).toMatch(/не разбирается как JSON/);
    expect(out).not.toContain("npm run");
  });

  test("mentions the database and the env files the archive actually contains", () => {
    const out = buildRunInstructions({
      projectName: "Tasks",
      stack: "next",
      files: [
        { path: "package.json", content: JSON.stringify({ scripts: { dev: "next dev" } }) },
        { path: "db/schema.sql", content: "create table tasks();" },
        { path: ".env.local", content: "SECRET=1" },
      ],
    });
    expect(out).toContain("db/schema.sql");
    expect(out).toContain("DATABASE_URL");
    expect(out).toContain(".env.local");
  });
});
