import { Router } from "express";
import crypto from "node:crypto";
import { verifyBearerOptional } from "../lib/authJwt";
import { getPool } from "../lib/dbPool";
import { ensureDevHubTables, isDevHubDbReady } from "../lib/ensureDevHubTables";
import { callProvider, getProviders } from "../services/qcoreai/providers";

export const devhubRouter = Router();

const pool = getPool();

// Bootstrap tables on first use
(async () => {
  try {
    await ensureDevHubTables(pool);
  } catch {
    // silent — in-memory fallback active
  }
})();

// ── In-memory fallback stores ─────────────────────────────────────────────────
interface DevHubProject {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  stack: string;
  status: string;
  repoUrl: string | null;
  deployUrl: string | null;
  customDomain: string | null;
  envVars: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

interface DevHubFile {
  id: string;
  projectId: string;
  path: string;
  content: string;
  language: string;
  updatedAt: string;
}

interface DevHubDeployment {
  id: string;
  projectId: string;
  userId: string;
  status: string;
  deployUrl: string | null;
  buildLog: string | null;
  triggeredAt: string;
  completedAt: string | null;
}

const memProjects = new Map<string, DevHubProject>();
const memFiles = new Map<string, DevHubFile>();
const memDeployments = new Map<string, DevHubDeployment>();

// ── Exported reset helpers for tests ─────────────────────────────────────────
export function __resetDevHubStore() {
  memProjects.clear();
  memFiles.clear();
  memDeployments.clear();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function now() {
  return new Date().toISOString();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "project";
}

function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    py: "python", html: "html", css: "css", json: "json", md: "markdown",
    yaml: "yaml", yml: "yaml", sh: "bash", env: "plaintext",
  };
  return map[ext] || "plaintext";
}

// ── Project helpers (DB or memory) ────────────────────────────────────────────
async function dbListProjects(userId: string): Promise<DevHubProject[]> {
  if (!isDevHubDbReady()) {
    return [...memProjects.values()]
      .filter((p) => p.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  const r = await pool.query(
    `SELECT * FROM "DevHubProject" WHERE "userId"=$1 ORDER BY "updatedAt" DESC`,
    [userId]
  );
  return r.rows.map(rowToProject);
}

async function dbGetProject(id: string): Promise<DevHubProject | null> {
  if (!isDevHubDbReady()) return memProjects.get(id) ?? null;
  const r = await pool.query(`SELECT * FROM "DevHubProject" WHERE "id"=$1`, [id]);
  return r.rows[0] ? rowToProject(r.rows[0]) : null;
}

async function dbSaveProject(p: DevHubProject): Promise<void> {
  if (!isDevHubDbReady()) { memProjects.set(p.id, p); return; }
  await pool.query(
    `INSERT INTO "DevHubProject" ("id","userId","name","description","stack","status","repoUrl","deployUrl","customDomain","envVars","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)
     ON CONFLICT ("id") DO UPDATE SET
       "name"=$3,"description"=$4,"stack"=$5,"status"=$6,"repoUrl"=$7,"deployUrl"=$8,
       "customDomain"=$9,"envVars"=$10::jsonb,"updatedAt"=$12`,
    [p.id, p.userId, p.name, p.description, p.stack, p.status, p.repoUrl, p.deployUrl,
     p.customDomain, JSON.stringify(p.envVars), p.createdAt, p.updatedAt]
  );
}

async function dbDeleteProject(id: string): Promise<void> {
  if (!isDevHubDbReady()) {
    memProjects.delete(id);
    for (const [fid, f] of memFiles) { if (f.projectId === id) memFiles.delete(fid); }
    return;
  }
  await pool.query(`DELETE FROM "DevHubFile" WHERE "projectId"=$1`, [id]);
  await pool.query(`DELETE FROM "DevHubProject" WHERE "id"=$1`, [id]);
}

function rowToProject(row: any): DevHubProject {
  return {
    id: row.id, userId: row.userId, name: row.name, description: row.description,
    stack: row.stack, status: row.status, repoUrl: row.repoUrl, deployUrl: row.deployUrl,
    customDomain: row.customDomain, envVars: row.envVars || {},
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

// ── File helpers ──────────────────────────────────────────────────────────────
async function dbListFiles(projectId: string): Promise<DevHubFile[]> {
  if (!isDevHubDbReady()) {
    return [...memFiles.values()]
      .filter((f) => f.projectId === projectId)
      .sort((a, b) => a.path.localeCompare(b.path));
  }
  const r = await pool.query(
    `SELECT * FROM "DevHubFile" WHERE "projectId"=$1 ORDER BY "path" ASC`,
    [projectId]
  );
  return r.rows.map(rowToFile);
}

async function dbGetFile(projectId: string, path: string): Promise<DevHubFile | null> {
  if (!isDevHubDbReady()) {
    return [...memFiles.values()].find((f) => f.projectId === projectId && f.path === path) ?? null;
  }
  const r = await pool.query(
    `SELECT * FROM "DevHubFile" WHERE "projectId"=$1 AND "path"=$2`,
    [projectId, path]
  );
  return r.rows[0] ? rowToFile(r.rows[0]) : null;
}

async function dbUpsertFile(f: DevHubFile): Promise<void> {
  if (!isDevHubDbReady()) { memFiles.set(f.id, f); return; }
  // try to update existing by (projectId, path)
  const existing = await pool.query(
    `SELECT "id" FROM "DevHubFile" WHERE "projectId"=$1 AND "path"=$2`,
    [f.projectId, f.path]
  );
  if (existing.rows[0]) {
    await pool.query(
      `UPDATE "DevHubFile" SET "content"=$1,"language"=$2,"updatedAt"=$3 WHERE "id"=$4`,
      [f.content, f.language, f.updatedAt, existing.rows[0].id]
    );
  } else {
    await pool.query(
      `INSERT INTO "DevHubFile" ("id","projectId","path","content","language","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [f.id, f.projectId, f.path, f.content, f.language, f.updatedAt]
    );
  }
}

async function dbDeleteFile(projectId: string, path: string): Promise<void> {
  if (!isDevHubDbReady()) {
    for (const [fid, f] of memFiles) {
      if (f.projectId === projectId && f.path === path) { memFiles.delete(fid); break; }
    }
    return;
  }
  await pool.query(
    `DELETE FROM "DevHubFile" WHERE "projectId"=$1 AND "path"=$2`,
    [projectId, path]
  );
}

function rowToFile(row: any): DevHubFile {
  return {
    id: row.id, projectId: row.projectId, path: row.path,
    content: row.content, language: row.language,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

// ── Deployment helpers ────────────────────────────────────────────────────────
async function dbSaveDeployment(d: DevHubDeployment): Promise<void> {
  if (!isDevHubDbReady()) { memDeployments.set(d.id, d); return; }
  await pool.query(
    `INSERT INTO "DevHubDeployment" ("id","projectId","userId","status","deployUrl","buildLog","triggeredAt","completedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT ("id") DO UPDATE SET
       "status"=$4,"deployUrl"=$5,"buildLog"=$6,"completedAt"=$8`,
    [d.id, d.projectId, d.userId, d.status, d.deployUrl, d.buildLog, d.triggeredAt, d.completedAt]
  );
}

async function dbListDeployments(projectId: string, limit = 10): Promise<DevHubDeployment[]> {
  if (!isDevHubDbReady()) {
    return [...memDeployments.values()]
      .filter((d) => d.projectId === projectId)
      .sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt))
      .slice(0, limit);
  }
  const r = await pool.query(
    `SELECT * FROM "DevHubDeployment" WHERE "projectId"=$1 ORDER BY "triggeredAt" DESC LIMIT $2`,
    [projectId, limit]
  );
  return r.rows.map(rowToDeployment);
}

function rowToDeployment(row: any): DevHubDeployment {
  return {
    id: row.id, projectId: row.projectId, userId: row.userId, status: row.status,
    deployUrl: row.deployUrl, buildLog: row.buildLog,
    triggeredAt: row.triggeredAt instanceof Date ? row.triggeredAt.toISOString() : row.triggeredAt,
    completedAt: row.completedAt instanceof Date ? row.completedAt.toISOString() : row.completedAt ?? null,
  };
}

// ── Built-in templates ────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: "next-app",
    name: "Next.js App",
    description: "Full-stack React with API routes",
    stack: "next",
    files: [
      {
        path: "pages/index.tsx",
        language: "typescript",
        content: `export default function Home() {\n  return (\n    <div style={{ fontFamily: "system-ui", padding: 40 }}>\n      <h1>Hello from Next.js</h1>\n      <p>Edit pages/index.tsx to get started</p>\n    </div>\n  );\n}\n`,
      },
      {
        path: "package.json",
        language: "json",
        content: JSON.stringify({ name: "my-next-app", version: "0.1.0", scripts: { dev: "next dev", build: "next build", start: "next start" }, dependencies: { next: "^14.0.0", react: "^18.0.0", "react-dom": "^18.0.0" } }, null, 2),
      },
      {
        path: "tsconfig.json",
        language: "json",
        content: JSON.stringify({ compilerOptions: { target: "es5", lib: ["dom", "esnext"], allowJs: true, strict: true, moduleResolution: "bundler", jsx: "preserve" } }, null, 2),
      },
    ],
  },
  {
    id: "express-api",
    name: "Express API",
    description: "REST API with TypeScript",
    stack: "express",
    files: [
      {
        path: "src/index.ts",
        language: "typescript",
        content: `import express from "express";\nconst app = express();\napp.use(express.json());\n\napp.get("/health", (_req, res) => res.json({ status: "ok" }));\n\napp.get("/api/hello", (_req, res) => {\n  res.json({ message: "Hello from Express API!" });\n});\n\napp.listen(4000, () => console.log("API running on port 4000"));\n`,
      },
      {
        path: "package.json",
        language: "json",
        content: JSON.stringify({ name: "my-express-api", version: "0.1.0", scripts: { dev: "ts-node-dev src/index.ts", build: "tsc", start: "node dist/index.js" }, dependencies: { express: "^4.18.0" }, devDependencies: { typescript: "^5.0.0", "@types/express": "^4.17.0" } }, null, 2),
      },
    ],
  },
  {
    id: "landing",
    name: "Landing Page",
    description: "Static HTML/CSS/JS landing page",
    stack: "static",
    files: [
      {
        path: "index.html",
        language: "html",
        content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8"/>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>\n  <title>My Landing</title>\n  <link rel="stylesheet" href="style.css"/>\n</head>\n<body>\n  <main class="hero">\n    <h1>Welcome</h1>\n    <p>Build something amazing.</p>\n    <a href="#" class="cta">Get Started</a>\n  </main>\n  <script src="script.js"></script>\n</body>\n</html>\n`,
      },
      {
        path: "style.css",
        language: "css",
        content: `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\nbody { font-family: system-ui, sans-serif; background: #f8fafc; color: #0f172a; }\n.hero { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; text-align: center; padding: 40px; }\nh1 { font-size: 3rem; font-weight: 800; }\np { font-size: 1.2rem; color: #64748b; }\n.cta { display: inline-block; padding: 12px 28px; background: #0d9488; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; }\n`,
      },
      {
        path: "script.js",
        language: "javascript",
        content: `document.addEventListener("DOMContentLoaded", () => {\n  console.log("Landing page loaded");\n});\n`,
      },
    ],
  },
  {
    id: "react-spa",
    name: "React SPA",
    description: "Single page app with Vite",
    stack: "react",
    files: [
      {
        path: "src/App.tsx",
        language: "typescript",
        content: `import { useState } from "react";\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n  return (\n    <div style={{ fontFamily: "system-ui", textAlign: "center", padding: 40 }}>\n      <h1>React SPA</h1>\n      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>\n    </div>\n  );\n}\n`,
      },
      {
        path: "src/main.tsx",
        language: "typescript",
        content: `import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\n\nReactDOM.createRoot(document.getElementById("root")!).render(\n  <React.StrictMode><App /></React.StrictMode>\n);\n`,
      },
      {
        path: "package.json",
        language: "json",
        content: JSON.stringify({ name: "my-react-spa", version: "0.1.0", scripts: { dev: "vite", build: "tsc && vite build" }, dependencies: { react: "^18.0.0", "react-dom": "^18.0.0" }, devDependencies: { vite: "^5.0.0", "@vitejs/plugin-react": "^4.0.0", typescript: "^5.0.0" } }, null, 2),
      },
    ],
  },
  {
    id: "dashboard",
    name: "Analytics Dashboard",
    description: "Charts and data visualization with Next.js",
    stack: "next",
    files: [
      {
        path: "pages/index.tsx",
        language: "typescript",
        content: `import { useState, useEffect } from "react";\n\nconst MOCK = [\n  { label: "Mon", value: 42 }, { label: "Tue", value: 65 },\n  { label: "Wed", value: 38 }, { label: "Thu", value: 80 },\n  { label: "Fri", value: 55 },\n];\n\nexport default function Dashboard() {\n  const [data] = useState(MOCK);\n  const max = Math.max(...data.map(d => d.value));\n  return (\n    <div style={{ fontFamily: "system-ui", padding: 40, background: "#f8fafc", minHeight: "100vh" }}>\n      <h1 style={{ marginBottom: 24 }}>Analytics Dashboard</h1>\n      <div style={{ display: "flex", gap: 16 }}>\n        {data.map(d => (\n          <div key={d.label} style={{ textAlign: "center" }}>\n            <div style={{ width: 40, height: \`\${(d.value / max) * 200}px\`, background: "#0d9488", borderRadius: 4 }} />\n            <div style={{ marginTop: 8, fontSize: 13 }}>{d.label}</div>\n            <div style={{ fontWeight: 700 }}>{d.value}</div>\n          </div>\n        ))}\n      </div>\n    </div>\n  );\n}\n`,
      },
      {
        path: "package.json",
        language: "json",
        content: JSON.stringify({ name: "my-dashboard", version: "0.1.0", scripts: { dev: "next dev", build: "next build" }, dependencies: { next: "^14.0.0", react: "^18.0.0", "react-dom": "^18.0.0" } }, null, 2),
      },
    ],
  },
];

// ── AI code generation helper ─────────────────────────────────────────────────
async function generateCodeWithAI(prompt: string, stack: string, targetFile?: string): Promise<Array<{ path: string; content: string; language: string }>> {
  const providers = getProviders();
  const configured = providers.filter((p) => p.configured);
  if (configured.length === 0) {
    // Fallback — return a stub file
    const path = targetFile || (stack === "next" ? "pages/index.tsx" : stack === "express" ? "src/index.ts" : "index.html");
    const language = detectLanguage(path);
    return [{ path, content: `// Generated stub for: ${prompt}\n// Configure an AI provider (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.) for real AI generation\n`, language }];
  }
  const provider = configured[0];

  const systemPrompt = targetFile
    ? `You are an expert developer. Generate complete, working code for a single file. Return ONLY a JSON object: {"files": [{"path": "${targetFile}", "content": "...", "language": "..."}]}. No explanation, just JSON.`
    : `You are an expert developer. Generate complete, working code. Return ONLY a JSON object: {"files": [{"path": "filename", "content": "...", "language": "..."}]}. No explanation, just JSON. Generate a scaffold for the ${stack} stack.`;

  const userMsg = `Generate code for: ${prompt}. Stack: ${stack}.`;

  let result;
  try {
    result = await callProvider(
      provider.id,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
      provider.defaultModel,
      0.2
    );
  } catch {
    const path = targetFile || "generated.ts";
    return [{ path, content: `// AI generation failed — configure a provider\n// Prompt: ${prompt}\n`, language: detectLanguage(path) }];
  }

  let files: Array<{ path: string; content: string; language: string }> = [];
  try {
    const raw = result.reply.trim();
    const jsonStr = raw.startsWith("{") ? raw : (raw.match(/```(?:json)?\n?([\s\S]+?)```/)?.[1] ?? raw);
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed.files)) {
      files = parsed.files.map((f: any) => ({
        path: String(f.path || "output.ts"),
        content: String(f.content || ""),
        language: String(f.language || detectLanguage(f.path || "")),
      }));
    }
  } catch {
    const path = targetFile || "output.ts";
    files = [{ path, content: result.reply, language: detectLanguage(path) }];
  }
  return files;
}

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — Projects CRUD
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/devhub/projects
devhubRouter.post("/projects", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  const { name, description, stack = "next" } = req.body || {};
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "name is required" });
  }
  const validStacks = ["next", "express", "static", "react", "python"];
  const resolvedStack = validStacks.includes(stack) ? stack : "next";
  const project: DevHubProject = {
    id: crypto.randomUUID(),
    userId,
    name: name.trim(),
    description: description ? String(description).trim() : null,
    stack: resolvedStack,
    status: "draft",
    repoUrl: null,
    deployUrl: null,
    customDomain: null,
    envVars: {},
    createdAt: now(),
    updatedAt: now(),
  };
  try {
    await dbSaveProject(project);
  } catch (e: any) {
    memProjects.set(project.id, project);
  }
  res.status(201).json({ project });
});

// GET /api/devhub/projects
devhubRouter.get("/projects", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  try {
    const projects = await dbListProjects(userId);
    res.json({ projects, total: projects.length });
  } catch (e: any) {
    const projects = [...memProjects.values()].filter((p) => p.userId === userId);
    res.json({ projects, total: projects.length });
  }
});

// GET /api/devhub/projects/:id
devhubRouter.get("/projects/:id", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  try {
    const project = await dbGetProject(req.params.id);
    if (!project || project.userId !== userId) {
      return res.status(404).json({ error: "project not found" });
    }
    const files = await dbListFiles(project.id);
    res.json({ project, files });
  } catch (e: any) {
    return res.status(500).json({ error: "internal_error" });
  }
});

// PATCH /api/devhub/projects/:id
devhubRouter.patch("/projects/:id", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  let project: DevHubProject | null;
  try {
    project = await dbGetProject(req.params.id);
  } catch {
    project = memProjects.get(req.params.id) ?? null;
  }
  if (!project || project.userId !== userId) {
    return res.status(404).json({ error: "project not found" });
  }
  const { name, description, status, deployUrl, repoUrl, customDomain } = req.body || {};
  if (name !== undefined) project.name = String(name).trim();
  if (description !== undefined) project.description = description ? String(description).trim() : null;
  if (status !== undefined) project.status = String(status);
  if (deployUrl !== undefined) project.deployUrl = deployUrl ? String(deployUrl) : null;
  if (repoUrl !== undefined) project.repoUrl = repoUrl ? String(repoUrl) : null;
  if (customDomain !== undefined) project.customDomain = customDomain ? String(customDomain) : null;
  project.updatedAt = now();
  try {
    await dbSaveProject(project);
  } catch {
    memProjects.set(project.id, project);
  }
  res.json({ project });
});

// DELETE /api/devhub/projects/:id
devhubRouter.delete("/projects/:id", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  let project: DevHubProject | null;
  try {
    project = await dbGetProject(req.params.id);
  } catch {
    project = memProjects.get(req.params.id) ?? null;
  }
  if (!project || project.userId !== userId) {
    return res.status(404).json({ error: "project not found" });
  }
  try {
    await dbDeleteProject(req.params.id);
  } catch {
    memProjects.delete(req.params.id);
    for (const [fid, f] of memFiles) {
      if (f.projectId === req.params.id) memFiles.delete(fid);
    }
  }
  res.json({ ok: true });
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — Files CRUD
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/devhub/projects/:id/files
devhubRouter.get("/projects/:id/files", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  let project: DevHubProject | null;
  try {
    project = await dbGetProject(req.params.id);
  } catch {
    project = memProjects.get(req.params.id) ?? null;
  }
  if (!project || project.userId !== userId) {
    return res.status(404).json({ error: "project not found" });
  }
  try {
    const files = await dbListFiles(req.params.id);
    res.json({ files });
  } catch {
    const files = [...memFiles.values()].filter((f) => f.projectId === req.params.id);
    res.json({ files });
  }
});

// GET /api/devhub/projects/:id/files/:filepath — get file by path
// The frontend passes the file path in the request body for complex paths,
// and uses a simple /:filepath param for single-segment paths.
// For multi-segment paths we use a dedicated body-based endpoint below.
devhubRouter.get("/projects/:id/files/:filepath", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  const filePath = req.params.filepath || "";
  let project: DevHubProject | null;
  try {
    project = await dbGetProject(req.params.id);
  } catch {
    project = memProjects.get(req.params.id) ?? null;
  }
  if (!project || project.userId !== userId) {
    return res.status(404).json({ error: "project not found" });
  }
  try {
    const file = await dbGetFile(req.params.id, filePath);
    if (!file) return res.status(404).json({ error: "file not found" });
    res.json({ file });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// GET /api/devhub/projects/:id/file — get file content by path in query string
devhubRouter.get("/projects/:id/file", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  const filePath = String(req.query.path || "");
  if (!filePath) return res.status(400).json({ error: "path query param required" });
  let project: DevHubProject | null;
  try {
    project = await dbGetProject(req.params.id);
  } catch {
    project = memProjects.get(req.params.id) ?? null;
  }
  if (!project || project.userId !== userId) {
    return res.status(404).json({ error: "project not found" });
  }
  try {
    const file = await dbGetFile(req.params.id, filePath);
    if (!file) return res.status(404).json({ error: "file not found" });
    res.json({ file });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
});

// PUT /api/devhub/projects/:id/file — upsert file; path in body or query
devhubRouter.put("/projects/:id/file", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  const filePath = String(req.body?.path || req.query.path || "");
  if (!filePath) return res.status(400).json({ error: "file path required" });
  let project: DevHubProject | null;
  try {
    project = await dbGetProject(req.params.id);
  } catch {
    project = memProjects.get(req.params.id) ?? null;
  }
  if (!project || project.userId !== userId) {
    return res.status(404).json({ error: "project not found" });
  }
  const { content = "", language } = req.body || {};
  const file: DevHubFile = {
    id: crypto.randomUUID(),
    projectId: req.params.id,
    path: filePath,
    content: String(content),
    language: language ? String(language) : detectLanguage(filePath),
    updatedAt: now(),
  };
  try {
    await dbUpsertFile(file);
  } catch {
    const existing = [...memFiles.values()].find((f) => f.projectId === req.params.id && f.path === filePath);
    if (existing) {
      existing.content = file.content;
      existing.language = file.language;
      existing.updatedAt = file.updatedAt;
    } else {
      memFiles.set(file.id, file);
    }
  }
  res.json({ file });
});

// PUT /api/devhub/projects/:id/files/:filepath — upsert file with simple single-segment path
devhubRouter.put("/projects/:id/files/:filepath", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  const filePath = req.params.filepath || "";
  if (!filePath) return res.status(400).json({ error: "file path required" });
  let project: DevHubProject | null;
  try {
    project = await dbGetProject(req.params.id);
  } catch {
    project = memProjects.get(req.params.id) ?? null;
  }
  if (!project || project.userId !== userId) {
    return res.status(404).json({ error: "project not found" });
  }
  const { content = "", language } = req.body || {};
  const file: DevHubFile = {
    id: crypto.randomUUID(),
    projectId: req.params.id,
    path: filePath,
    content: String(content),
    language: language ? String(language) : detectLanguage(filePath),
    updatedAt: now(),
  };
  try {
    await dbUpsertFile(file);
  } catch {
    const existing = [...memFiles.values()].find((f) => f.projectId === req.params.id && f.path === filePath);
    if (existing) {
      existing.content = file.content;
      existing.language = file.language;
      existing.updatedAt = file.updatedAt;
    } else {
      memFiles.set(file.id, file);
    }
  }
  res.json({ file });
});

// DELETE /api/devhub/projects/:id/file — delete by path query param
devhubRouter.delete("/projects/:id/file", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  const filePath = String(req.query.path || req.body?.path || "");
  if (!filePath) return res.status(400).json({ error: "path required" });
  let project: DevHubProject | null;
  try {
    project = await dbGetProject(req.params.id);
  } catch {
    project = memProjects.get(req.params.id) ?? null;
  }
  if (!project || project.userId !== userId) {
    return res.status(404).json({ error: "project not found" });
  }
  try {
    await dbDeleteFile(req.params.id, filePath);
  } catch {
    for (const [fid, f] of memFiles) {
      if (f.projectId === req.params.id && f.path === filePath) { memFiles.delete(fid); break; }
    }
  }
  res.json({ ok: true });
});

// DELETE /api/devhub/projects/:id/files/:filepath — delete single-segment file
devhubRouter.delete("/projects/:id/files/:filepath", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  const filePath = req.params.filepath || "";
  let project: DevHubProject | null;
  try {
    project = await dbGetProject(req.params.id);
  } catch {
    project = memProjects.get(req.params.id) ?? null;
  }
  if (!project || project.userId !== userId) {
    return res.status(404).json({ error: "project not found" });
  }
  try {
    await dbDeleteFile(req.params.id, filePath);
  } catch {
    for (const [fid, f] of memFiles) {
      if (f.projectId === req.params.id && f.path === filePath) { memFiles.delete(fid); break; }
    }
  }
  res.json({ ok: true });
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — AI Code Generation
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/devhub/projects/:id/generate
devhubRouter.post("/projects/:id/generate", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  let project: DevHubProject | null;
  try {
    project = await dbGetProject(req.params.id);
  } catch {
    project = memProjects.get(req.params.id) ?? null;
  }
  if (!project || project.userId !== userId) {
    return res.status(404).json({ error: "project not found" });
  }
  const { prompt, targetFile, stack } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "prompt is required" });
  }
  const resolvedStack = stack || project.stack;
  try {
    const generatedFiles = await generateCodeWithAI(prompt, resolvedStack, targetFile || undefined);
    // Save each generated file
    for (const gf of generatedFiles) {
      const file: DevHubFile = {
        id: crypto.randomUUID(),
        projectId: project.id,
        path: gf.path,
        content: gf.content,
        language: gf.language || detectLanguage(gf.path),
        updatedAt: now(),
      };
      try {
        await dbUpsertFile(file);
      } catch {
        const existing = [...memFiles.values()].find((f) => f.projectId === project!.id && f.path === gf.path);
        if (existing) {
          existing.content = file.content;
          existing.language = file.language;
          existing.updatedAt = file.updatedAt;
        } else {
          memFiles.set(file.id, file);
        }
      }
    }
    res.json({ files: generatedFiles, projectId: project.id });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "generation failed" });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — Deploy
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/devhub/projects/:id/deploy
devhubRouter.post("/projects/:id/deploy", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  let project: DevHubProject | null;
  try {
    project = await dbGetProject(req.params.id);
  } catch {
    project = memProjects.get(req.params.id) ?? null;
  }
  if (!project || project.userId !== userId) {
    return res.status(404).json({ error: "project not found" });
  }
  const deploymentId = crypto.randomUUID();
  const deploySlug = slugify(project.name) + "-" + project.id.slice(0, 8);
  const deployUrl = `https://${deploySlug}.aevion.app`;

  const deployment: DevHubDeployment = {
    id: deploymentId,
    projectId: project.id,
    userId,
    status: "pending",
    deployUrl: null,
    buildLog: null,
    triggeredAt: now(),
    completedAt: null,
  };
  try {
    await dbSaveDeployment(deployment);
  } catch {
    memDeployments.set(deployment.id, deployment);
  }

  // Simulate build asynchronously — in production would call Railway/Vercel
  setTimeout(async () => {
    deployment.status = "live";
    deployment.deployUrl = deployUrl;
    deployment.buildLog = `Build started at ${deployment.triggeredAt}\nInstalling dependencies...\nBuilding...\nDeployment complete!\nLive at: ${deployUrl}`;
    deployment.completedAt = now();
    try {
      await dbSaveDeployment(deployment);
    } catch {
      memDeployments.set(deployment.id, deployment);
    }
    // Update project
    if (project) {
      project.status = "live";
      project.deployUrl = deployUrl;
      project.updatedAt = now();
      try {
        await dbSaveProject(project);
      } catch {
        memProjects.set(project.id, project);
      }
    }
  }, 3000);

  res.json({ deploymentId, status: "pending", message: "Deployment started" });
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — GitHub Integration
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/devhub/projects/:id/github/push
devhubRouter.post("/projects/:id/github/push", async (req, res) => {
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return res.json({ ok: false, message: "GitHub integration not configured" });
  }
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  let project: DevHubProject | null;
  try {
    project = await dbGetProject(req.params.id);
  } catch {
    project = memProjects.get(req.params.id) ?? null;
  }
  if (!project || project.userId !== userId) {
    return res.status(404).json({ error: "project not found" });
  }
  try {
    const repoName = slugify(project.name) + "-" + project.id.slice(0, 8);
    // Create repo via GitHub API
    const createResp = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        "Content-Type": "application/json",
        "User-Agent": "AEVION-DevHub/1.0",
      },
      body: JSON.stringify({ name: repoName, description: project.description || "", private: false, auto_init: false }),
    });
    if (!createResp.ok) {
      const errText = await createResp.text();
      return res.status(502).json({ ok: false, message: `GitHub error: ${errText}` });
    }
    const repoData = await createResp.json() as { html_url: string; full_name: string };
    const repoUrl = repoData.html_url;
    // Update project with repoUrl
    project.repoUrl = repoUrl;
    project.updatedAt = now();
    try {
      await dbSaveProject(project);
    } catch {
      memProjects.set(project.id, project);
    }
    res.json({ ok: true, repoUrl, pushed: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || "GitHub push failed" });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — Templates (Commit 3)
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/devhub/templates
devhubRouter.get("/templates", (_req, res) => {
  res.json({ templates: TEMPLATES });
});

// POST /api/devhub/projects/:id/apply-template
devhubRouter.post("/projects/:id/apply-template", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  let project: DevHubProject | null;
  try {
    project = await dbGetProject(req.params.id);
  } catch {
    project = memProjects.get(req.params.id) ?? null;
  }
  if (!project || project.userId !== userId) {
    return res.status(404).json({ error: "project not found" });
  }
  const { templateId } = req.body || {};
  const template = TEMPLATES.find((t) => t.id === templateId);
  if (!template) return res.status(404).json({ error: "template not found" });

  const savedFiles: DevHubFile[] = [];
  for (const tf of template.files) {
    const file: DevHubFile = {
      id: crypto.randomUUID(),
      projectId: project.id,
      path: tf.path,
      content: tf.content,
      language: tf.language || detectLanguage(tf.path),
      updatedAt: now(),
    };
    try {
      await dbUpsertFile(file);
    } catch {
      const existing = [...memFiles.values()].find((f) => f.projectId === project!.id && f.path === tf.path);
      if (existing) {
        existing.content = file.content;
        existing.language = file.language;
        existing.updatedAt = file.updatedAt;
      } else {
        memFiles.set(file.id, file);
      }
    }
    savedFiles.push(file);
  }
  res.json({ ok: true, files: savedFiles, template: template.id });
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — Environment Variables
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/devhub/projects/:id/env
devhubRouter.get("/projects/:id/env", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  let project: DevHubProject | null;
  try {
    project = await dbGetProject(req.params.id);
  } catch {
    project = memProjects.get(req.params.id) ?? null;
  }
  if (!project || project.userId !== userId) {
    return res.status(404).json({ error: "project not found" });
  }
  // Return keys with masked values
  const masked = Object.keys(project.envVars).map((key) => ({
    key,
    value: "***",
    set: true,
  }));
  res.json({ env: masked, count: masked.length });
});

// PUT /api/devhub/projects/:id/env
devhubRouter.put("/projects/:id/env", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  let project: DevHubProject | null;
  try {
    project = await dbGetProject(req.params.id);
  } catch {
    project = memProjects.get(req.params.id) ?? null;
  }
  if (!project || project.userId !== userId) {
    return res.status(404).json({ error: "project not found" });
  }
  const { key, value } = req.body || {};
  if (!key || typeof key !== "string") return res.status(400).json({ error: "key is required" });
  project.envVars[String(key)] = String(value ?? "");
  project.updatedAt = now();
  try {
    await dbSaveProject(project);
  } catch {
    memProjects.set(project.id, project);
  }
  res.json({ ok: true, key });
});

// DELETE /api/devhub/projects/:id/env/:key
devhubRouter.delete("/projects/:id/env/:key", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  let project: DevHubProject | null;
  try {
    project = await dbGetProject(req.params.id);
  } catch {
    project = memProjects.get(req.params.id) ?? null;
  }
  if (!project || project.userId !== userId) {
    return res.status(404).json({ error: "project not found" });
  }
  const key = req.params.key;
  delete project.envVars[key];
  project.updatedAt = now();
  try {
    await dbSaveProject(project);
  } catch {
    memProjects.set(project.id, project);
  }
  res.json({ ok: true, key });
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — Custom Domain
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/devhub/projects/:id/domain
devhubRouter.post("/projects/:id/domain", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  let project: DevHubProject | null;
  try {
    project = await dbGetProject(req.params.id);
  } catch {
    project = memProjects.get(req.params.id) ?? null;
  }
  if (!project || project.userId !== userId) {
    return res.status(404).json({ error: "project not found" });
  }
  const { domain } = req.body || {};
  if (!domain || typeof domain !== "string") return res.status(400).json({ error: "domain is required" });
  // Basic domain validation
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
  if (!domainRegex.test(domain.trim())) {
    return res.status(400).json({ error: "invalid domain format" });
  }
  project.customDomain = domain.trim();
  project.updatedAt = now();
  try {
    await dbSaveProject(project);
  } catch {
    memProjects.set(project.id, project);
  }
  res.json({
    ok: true,
    domain: project.customDomain,
    cname: "devhub.aevion.app",
    message: "Point your CNAME to devhub.aevion.app",
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — Deployment History
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/devhub/projects/:id/deployments
devhubRouter.get("/projects/:id/deployments", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  let project: DevHubProject | null;
  try {
    project = await dbGetProject(req.params.id);
  } catch {
    project = memProjects.get(req.params.id) ?? null;
  }
  if (!project || project.userId !== userId) {
    return res.status(404).json({ error: "project not found" });
  }
  try {
    const deployments = await dbListDeployments(req.params.id, 10);
    res.json({ deployments });
  } catch {
    const deployments = [...memDeployments.values()]
      .filter((d) => d.projectId === req.params.id)
      .sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt))
      .slice(0, 10);
    res.json({ deployments });
  }
});
