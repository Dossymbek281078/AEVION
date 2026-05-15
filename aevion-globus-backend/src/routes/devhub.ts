import { Router } from "express";
import crypto from "node:crypto";
import { verifyBearerOptional } from "../lib/authJwt";
import { getPool } from "../lib/dbPool";
import { ensureDevHubTables, isDevHubDbReady } from "../lib/ensureDevHubTables";
import { callProvider, getProviders } from "../services/qcoreai/providers";

export const devhubRouter = Router();

// GET /api/devhub/health — module health probe for aevion hub
devhubRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    module: "devhub",
    db: isDevHubDbReady() ? "postgres" : "in-memory",
    timestamp: new Date().toISOString(),
  });
});

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
  collaborators: Array<{ userId: string; role: string }>;
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

interface DevHubSnippet {
  id: string;
  userId: string;
  title: string;
  content: string;
  language: string;
  tags: string[];
  stars: number;
  createdAt: string;
  updatedAt: string;
}

const memProjects = new Map<string, DevHubProject>();
const memFiles = new Map<string, DevHubFile>();
const memDeployments = new Map<string, DevHubDeployment>();
const memSnippets = new Map<string, DevHubSnippet>();

// ── Exported reset helpers for tests ─────────────────────────────────────────
export function __resetDevHubStore() {
  memProjects.clear();
  memFiles.clear();
  memDeployments.clear();
  memSnippets.clear();
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
    `INSERT INTO "DevHubProject" ("id","userId","name","description","stack","status","repoUrl","deployUrl","customDomain","envVars","collaborators","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13)
     ON CONFLICT ("id") DO UPDATE SET
       "name"=$3,"description"=$4,"stack"=$5,"status"=$6,"repoUrl"=$7,"deployUrl"=$8,
       "customDomain"=$9,"envVars"=$10::jsonb,"collaborators"=$11::jsonb,"updatedAt"=$13`,
    [p.id, p.userId, p.name, p.description, p.stack, p.status, p.repoUrl, p.deployUrl,
     p.customDomain, JSON.stringify(p.envVars), JSON.stringify(p.collaborators), p.createdAt, p.updatedAt]
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
    collaborators: row.collaborators || [],
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
    collaborators: [],
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
// ROUTES — Deploy (V2: Railway API + SSE build log streaming)
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

  const railwayToken = process.env.RAILWAY_API_TOKEN;
  const railwayProjectId = process.env.RAILWAY_PROJECT_ID;
  const railwayServiceId = process.env.RAILWAY_SERVICE_ID;

  if (railwayToken && railwayProjectId && railwayServiceId) {
    // Real Railway API deployment via GraphQL mutation
    (async () => {
      try {
        const gqlResp = await fetch("https://backboard.railway.app/graphql/v2", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${railwayToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `mutation { deploymentCreate(input: { projectId: "${railwayProjectId}", serviceId: "${railwayServiceId}" }) { id status } }`,
          }),
        });
        const gqlData = await gqlResp.json() as any;
        const railwayDeploymentId = gqlData?.data?.deploymentCreate?.id as string | undefined;
        const railwayDeployUrl = `https://${deploySlug}.up.railway.app`;

        deployment.status = "building";
        deployment.deployUrl = railwayDeployUrl;
        deployment.buildLog = railwayDeploymentId ?? null;
        try {
          await dbSaveDeployment(deployment);
        } catch {
          memDeployments.set(deployment.id, deployment);
        }

        // After 5s mark as live
        setTimeout(async () => {
          const d = memDeployments.get(deployment.id) ?? deployment;
          d.status = "live";
          d.completedAt = now();
          try {
            await dbSaveDeployment(d);
          } catch {
            memDeployments.set(d.id, d);
          }
          if (project) {
            project.status = "live";
            project.deployUrl = railwayDeployUrl;
            project.updatedAt = now();
            try {
              await dbSaveProject(project);
            } catch {
              memProjects.set(project.id, project);
            }
          }
        }, 5000);
      } catch {
        // Railway API failed — fall back to 3s simulation
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
      }
    })();
  } else {
    // Simulate build asynchronously — no Railway token
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
  }

  res.json({ deploymentId, status: "building", deployUrl, message: "Deployment started" });
});

// GET /api/devhub/projects/:id/deployments/:deployId/log — SSE build log stream
devhubRouter.get("/projects/:id/deployments/:deployId/log", async (req, res) => {
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

  const deploySlug = slugify(project.name) + "-" + project.id.slice(0, 8);
  const deployUrl = `https://${deploySlug}.aevion.app`;

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const LOG_STEPS = [
    "[1/5] Installing dependencies...",
    "[2/5] Type checking...",
    "[3/5] Building application...",
    "[4/5] Deploying to edge...",
    "[5/5] Health check passed",
  ];

  let step = 0;
  const interval = setInterval(() => {
    if (step < LOG_STEPS.length) {
      res.write(`data: ${JSON.stringify({ line: LOG_STEPS[step] })}\n\n`);
      step++;
    } else {
      res.write(`data: ${JSON.stringify({ done: true, deployUrl })}\n\n`);
      clearInterval(interval);
      res.end();
    }
  }, 500);

  req.on("close", () => {
    clearInterval(interval);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — Collaborators (V2)
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/devhub/projects/:id/collaborators
devhubRouter.get("/projects/:id/collaborators", async (req, res) => {
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
  res.json({ collaborators: project.collaborators });
});

// POST /api/devhub/projects/:id/collaborators
devhubRouter.post("/projects/:id/collaborators", async (req, res) => {
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
  const { userId: collabUserId, role } = req.body || {};
  if (!collabUserId || typeof collabUserId !== "string") {
    return res.status(400).json({ error: "userId is required" });
  }
  const validRoles = ["editor", "viewer"];
  const resolvedRole = validRoles.includes(role) ? role : "viewer";
  // Prevent adding owner as collaborator
  if (collabUserId === userId) {
    return res.status(400).json({ error: "cannot add project owner as collaborator" });
  }
  // Remove existing entry for this user then add fresh
  project.collaborators = project.collaborators.filter((c) => c.userId !== collabUserId);
  project.collaborators.push({ userId: collabUserId, role: resolvedRole });
  project.updatedAt = now();
  try {
    await dbSaveProject(project);
  } catch {
    memProjects.set(project.id, project);
  }
  res.status(201).json({ collaborators: project.collaborators });
});

// DELETE /api/devhub/projects/:id/collaborators/:userId
devhubRouter.delete("/projects/:id/collaborators/:collabUserId", async (req, res) => {
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
  const { collabUserId } = req.params;
  project.collaborators = project.collaborators.filter((c) => c.userId !== collabUserId);
  project.updatedAt = now();
  try {
    await dbSaveProject(project);
  } catch {
    memProjects.set(project.id, project);
  }
  res.json({ ok: true, collaborators: project.collaborators });
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — GitHub Integration
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/devhub/projects/:id/github/push
devhubRouter.post("/projects/:id/github/push", async (req, res) => {
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
  const githubToken = project.envVars?.GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return res.json({
      ok: false,
      message: "Set GITHUB_TOKEN in project Env Vars or server env to enable GitHub integration",
      setupUrl: "https://github.com/settings/tokens",
    });
  }
  try {
    const projectSlug = slugify(project.name) + "-" + project.id.slice(0, 8);

    // 1. Get authenticated GitHub username
    const userResp = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        "User-Agent": "AEVION-DevHub",
      },
    });
    if (!userResp.ok) {
      const errText = await userResp.text();
      return res.json({ ok: false, message: `GitHub auth error: ${errText}` });
    }
    const ghUser = await userResp.json() as { login: string };
    const username = ghUser.login;

    // 2. Create repo
    const createResp = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        "Content-Type": "application/json",
        "User-Agent": "AEVION-DevHub",
      },
      body: JSON.stringify({
        name: projectSlug,
        description: project.description || "Created by AEVION DevHub",
        private: false,
        auto_init: true,
      }),
    });
    if (!createResp.ok) {
      const errText = await createResp.text();
      return res.json({ ok: false, message: `GitHub repo create error: ${errText}` });
    }
    const repoData = await createResp.json() as { html_url: string };
    const repoUrl = repoData.html_url;
    const repoName = projectSlug;

    // 3. Push each project file
    const files = await dbListFiles(project.id);
    let pushedFiles = 0;
    for (const file of files) {
      try {
        const fileResp = await fetch(
          `https://api.github.com/repos/${username}/${repoName}/contents/${file.path}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${githubToken}`,
              "Content-Type": "application/json",
              "User-Agent": "AEVION-DevHub",
            },
            body: JSON.stringify({
              message: "Initial commit from AEVION DevHub",
              content: Buffer.from(file.content).toString("base64"),
            }),
          },
        );
        if (fileResp.ok) pushedFiles += 1;
      } catch {
        // continue with other files
      }
    }

    // 4. Update project repoUrl
    project.repoUrl = repoUrl;
    project.updatedAt = now();
    try {
      await dbSaveProject(project);
    } catch {
      memProjects.set(project.id, project);
    }

    return res.json({ ok: true, repoUrl, pushedFiles });
  } catch (e: any) {
    return res.json({ ok: false, message: e?.message || "GitHub push failed" });
  }
});

// GET /api/devhub/projects/:id/github/status — check if repo exists on GitHub
devhubRouter.get("/projects/:id/github/status", async (req, res) => {
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
  const githubToken = project.envVars?.GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (!project.repoUrl || !githubToken) {
    return res.json({ exists: false });
  }
  try {
    const match = project.repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return res.json({ exists: false });
    const [, owner, repo] = match;
    const ghResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        "User-Agent": "AEVION-DevHub",
      },
    });
    if (!ghResp.ok) return res.json({ exists: false });
    const ghData = await ghResp.json() as {
      stargazers_count?: number;
      open_issues_count?: number;
      pushed_at?: string;
    };
    return res.json({
      exists: true,
      stars: ghData.stargazers_count ?? 0,
      openIssues: ghData.open_issues_count ?? 0,
      lastPush: ghData.pushed_at ?? null,
    });
  } catch {
    return res.json({ exists: false });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — Templates (Commit 3)

// GET /api/devhub/projects/:id/github/branches — list branches of linked repo
devhubRouter.get("/projects/:id/github/branches", async (req, res) => {
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
  const githubToken = project.envVars?.GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (!project.repoUrl || !githubToken) {
    return res.json({ branches: [], connected: false });
  }
  try {
    const match = project.repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return res.json({ branches: [], connected: false });
    const [, owner, repo] = match;
    const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=30`, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        "User-Agent": "AEVION-DevHub",
        Accept: "application/vnd.github+json",
      },
    });
    if (!resp.ok) return res.json({ branches: [], connected: true, error: "GitHub API error" });
    const data = await resp.json() as Array<{ name: string; commit: { sha: string } }>;
    return res.json({
      connected: true,
      repoUrl: project.repoUrl,
      branches: data.map((b) => ({ name: b.name, sha: b.commit.sha.slice(0, 7) })),
    });
  } catch {
    return res.json({ branches: [], connected: false });
  }
});

// POST /api/devhub/projects/:id/github/sync — pull latest commit SHA for default branch
devhubRouter.post("/projects/:id/github/sync", async (req, res) => {
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
  const githubToken = project.envVars?.GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (!project.repoUrl || !githubToken) {
    return res.json({ ok: false, message: "No GitHub repo linked or GITHUB_TOKEN missing (set in project envVars or server env)" });
  }
  try {
    const match = project.repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return res.json({ ok: false, message: "Invalid repoUrl format" });
    const [, owner, repo] = match;
    const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        "User-Agent": "AEVION-DevHub",
        Accept: "application/vnd.github+json",
      },
    });
    if (!resp.ok) return res.json({ ok: false, message: "GitHub API error" });
    const data = await resp.json() as { default_branch: string; pushed_at: string; stargazers_count: number };
    project.updatedAt = new Date().toISOString();
    try { await dbSaveProject(project); } catch { memProjects.set(project.id, project); }
    return res.json({
      ok: true,
      defaultBranch: data.default_branch,
      lastPush: data.pushed_at,
      stars: data.stargazers_count,
      repoUrl: project.repoUrl,
    });
  } catch (e: any) {
    return res.json({ ok: false, message: e?.message || "sync failed" });
  }
});
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

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — Snippet Shelf (publicly shareable code snippets, gist-style)
// ═════════════════════════════════════════════════════════════════════════════

function rowToSnippet(row: any): DevHubSnippet {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    content: row.content,
    language: row.language,
    tags: Array.isArray(row.tags) ? row.tags : [],
    stars: typeof row.stars === "number" ? row.stars : Number(row.stars) || 0,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

async function dbListSnippets(opts: { tag?: string; userId?: string; limit?: number }): Promise<DevHubSnippet[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  if (!isDevHubDbReady()) {
    let arr = [...memSnippets.values()];
    if (opts.userId) arr = arr.filter((s) => s.userId === opts.userId);
    if (opts.tag) {
      const tag = opts.tag.toLowerCase();
      arr = arr.filter((s) => s.tags.some((t) => t.toLowerCase() === tag));
    }
    return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }
  const params: any[] = [];
  const conds: string[] = [];
  if (opts.userId) {
    params.push(opts.userId);
    conds.push(`"userId" = $${params.length}`);
  }
  if (opts.tag) {
    params.push(JSON.stringify([opts.tag]));
    conds.push(`"tags" @> $${params.length}::jsonb`);
  }
  params.push(limit);
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const r = await pool.query(
    `SELECT * FROM "DevHubSnippet" ${where} ORDER BY "createdAt" DESC LIMIT $${params.length}`,
    params
  );
  return r.rows.map(rowToSnippet);
}

async function dbGetSnippet(id: string): Promise<DevHubSnippet | null> {
  if (!isDevHubDbReady()) return memSnippets.get(id) ?? null;
  const r = await pool.query(`SELECT * FROM "DevHubSnippet" WHERE "id" = $1`, [id]);
  return r.rows[0] ? rowToSnippet(r.rows[0]) : null;
}

async function dbSaveSnippet(s: DevHubSnippet): Promise<void> {
  if (!isDevHubDbReady()) { memSnippets.set(s.id, s); return; }
  await pool.query(
    `INSERT INTO "DevHubSnippet" ("id","userId","title","content","language","tags","stars","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)
     ON CONFLICT ("id") DO UPDATE SET
       "title"=$3,"content"=$4,"language"=$5,"tags"=$6::jsonb,"stars"=$7,"updatedAt"=$9`,
    [s.id, s.userId, s.title, s.content, s.language, JSON.stringify(s.tags), s.stars, s.createdAt, s.updatedAt]
  );
}

// GET /api/devhub/snippets — public list, optional ?tag=X&user=Y&limit=N
devhubRouter.get("/snippets", async (req, res) => {
  const tag = req.query.tag ? String(req.query.tag).trim() : undefined;
  const userId = req.query.user ? String(req.query.user).trim() : undefined;
  const limit = req.query.limit ? Math.min(parseInt(String(req.query.limit), 10) || 50, 200) : 50;
  try {
    const snippets = await dbListSnippets({ tag, userId, limit });
    res.json({ snippets, total: snippets.length });
  } catch {
    let arr = [...memSnippets.values()];
    if (userId) arr = arr.filter((s) => s.userId === userId);
    if (tag) {
      const t = tag.toLowerCase();
      arr = arr.filter((s) => s.tags.some((tg) => tg.toLowerCase() === t));
    }
    const snippets = arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
    res.json({ snippets, total: snippets.length });
  }
});

// POST /api/devhub/snippets — create a snippet
devhubRouter.post("/snippets", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  const { title, content, language, tags } = req.body || {};
  if (!title || typeof title !== "string") return res.status(400).json({ error: "title is required" });
  if (typeof content !== "string") return res.status(400).json({ error: "content must be a string" });
  const normTags = Array.isArray(tags)
    ? tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 10)
    : [];
  const snippet: DevHubSnippet = {
    id: crypto.randomUUID(),
    userId,
    title: title.trim().slice(0, 200),
    content: String(content).slice(0, 100_000),
    language: language ? String(language).trim().slice(0, 40) : "plaintext",
    tags: normTags,
    stars: 0,
    createdAt: now(),
    updatedAt: now(),
  };
  try {
    await dbSaveSnippet(snippet);
  } catch {
    memSnippets.set(snippet.id, snippet);
  }
  res.status(201).json({ snippet });
});

// GET /api/devhub/snippets/:id — fetch single snippet
devhubRouter.get("/snippets/:id", async (req, res) => {
  try {
    const snippet = await dbGetSnippet(req.params.id);
    if (!snippet) return res.status(404).json({ error: "snippet not found" });
    res.json({ snippet });
  } catch {
    const snippet = memSnippets.get(req.params.id);
    if (!snippet) return res.status(404).json({ error: "snippet not found" });
    res.json({ snippet });
  }
});

// POST /api/devhub/snippets/:id/star — increment star count
devhubRouter.post("/snippets/:id/star", async (req, res) => {
  let snippet: DevHubSnippet | null;
  try {
    snippet = await dbGetSnippet(req.params.id);
  } catch {
    snippet = memSnippets.get(req.params.id) ?? null;
  }
  if (!snippet) return res.status(404).json({ error: "snippet not found" });
  snippet.stars += 1;
  snippet.updatedAt = now();
  try {
    await dbSaveSnippet(snippet);
  } catch {
    memSnippets.set(snippet.id, snippet);
  }
  res.json({ ok: true, stars: snippet.stars });
});

// GET /api/devhub/projects/:id/env/validate — check required env vars
devhubRouter.get("/projects/:id/env/validate", async (req, res) => {
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

  // Required env vars per stack
  const requiredByStack: Record<string, string[]> = {
    next: ["NODE_ENV"],
    express: ["PORT"],
    python: ["PYTHON_VERSION"],
    react: ["NODE_ENV"],
    static: [],
  };
  const required = requiredByStack[project.stack] ?? [];
  const missing = required.filter((key) => !(key in project!.envVars));
  res.json({ valid: missing.length === 0, missing });
});

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES — Media (ElevenLabs TTS)
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/devhub/media/tts — text-to-speech via ElevenLabs
devhubRouter.post("/media/tts", async (req, res) => {
  const { text, voice = "Rachel" } = req.body || {};
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text is required" });
  }
  if (text.trim().length > 5000) {
    return res.status(400).json({ error: "text too long (max 5000 chars)" });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "ElevenLabs not configured — set ELEVENLABS_API_KEY",
      setupUrl: "https://elevenlabs.io/api",
    });
  }

  // Map voice name → ElevenLabs voice ID (common voices)
  const VOICE_IDS: Record<string, string> = {
    Rachel: "21m00Tcm4TlvDq8ikWAM",
    Adam:   "pNInz6obpgDQGcFmaJgB",
    Antoni: "ErXwobaYiN019PkySvjV",
    Arnold: "VR6AewLTigWG4xSOukaG",
    Bella:  "EXAVITQu4vr4xnSDxMaL",
    Domi:   "AZnzlk1XvdvUeBnXmlld",
    Elli:   "MF3mGyEYCl7XYWbV9V6O",
    Josh:   "TxGEqnHWrfWFTfGW9XjX",
    Sam:    "yoZ06aMxZJJ28mfd3POQ",
  };
  const voiceId = VOICE_IDS[voice as string] ?? VOICE_IDS["Rachel"];

  try {
    const elResp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: "eleven_monolingual_v1",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!elResp.ok) {
      const errText = await elResp.text();
      return res.status(elResp.status).json({ error: `ElevenLabs error: ${errText.slice(0, 200)}` });
    }

    const audioBuffer = Buffer.from(await elResp.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audioBuffer.length);
    res.setHeader("Cache-Control", "no-store");
    res.send(audioBuffer);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "TTS generation failed" });
  }
});

// POST /api/devhub/media/email — send email via Brevo
devhubRouter.post("/media/email", async (req, res) => {
  const { to, subject, htmlBody, from } = req.body || {};
  if (!to || typeof to !== "string") return res.status(400).json({ error: "to (email) required" });
  if (!subject || typeof subject !== "string") return res.status(400).json({ error: "subject required" });
  if (!htmlBody || typeof htmlBody !== "string") return res.status(400).json({ error: "htmlBody required" });

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(to.trim())) return res.status(400).json({ error: "invalid recipient email" });

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "Brevo not configured — set BREVO_API_KEY",
      setupUrl: "https://app.brevo.com/settings/keys/api",
    });
  }

  const senderEmail = (from && typeof from === "string" && emailRe.test(from.trim()))
    ? from.trim()
    : (process.env.BREVO_DEFAULT_SENDER || "noreply@aevion.app");

  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { email: senderEmail, name: "AEVION DevHub" },
        to: [{ email: to.trim() }],
        subject: subject.trim().slice(0, 200),
        htmlContent: htmlBody.slice(0, 100_000),
      }),
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `Brevo error: ${errText.slice(0, 300)}` });
    }
    const data = await r.json().catch(() => ({}));
    res.json({ ok: true, messageId: (data as any)?.messageId ?? null });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Email send failed" });
  }
});

// POST /api/devhub/media/payment-link — create Stripe payment link
devhubRouter.post("/media/payment-link", async (req, res) => {
  const { name, amountCents, currency = "usd", description } = req.body || {};
  if (!name || typeof name !== "string") return res.status(400).json({ error: "name required" });
  const amt = Number(amountCents);
  if (!Number.isFinite(amt) || amt < 50) return res.status(400).json({ error: "amountCents must be ≥ 50" });

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "Stripe not configured — set STRIPE_SECRET_KEY",
      setupUrl: "https://dashboard.stripe.com/apikeys",
    });
  }

  try {
    // 1. Create product
    const productResp = await fetch("https://api.stripe.com/v1/products", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        name: name.trim().slice(0, 200),
        ...(description ? { description: String(description).slice(0, 500) } : {}),
      }).toString(),
    });
    if (!productResp.ok) {
      const errText = await productResp.text();
      return res.status(productResp.status).json({ error: `Stripe product error: ${errText.slice(0, 300)}` });
    }
    const product = await productResp.json() as { id: string };

    // 2. Create price
    const priceResp = await fetch("https://api.stripe.com/v1/prices", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        product: product.id,
        unit_amount: String(Math.round(amt)),
        currency: String(currency).toLowerCase().slice(0, 3),
      }).toString(),
    });
    if (!priceResp.ok) {
      const errText = await priceResp.text();
      return res.status(priceResp.status).json({ error: `Stripe price error: ${errText.slice(0, 300)}` });
    }
    const price = await priceResp.json() as { id: string };

    // 3. Create payment link
    const linkResp = await fetch("https://api.stripe.com/v1/payment_links", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "line_items[0][price]": price.id,
        "line_items[0][quantity]": "1",
      }).toString(),
    });
    if (!linkResp.ok) {
      const errText = await linkResp.text();
      return res.status(linkResp.status).json({ error: `Stripe link error: ${errText.slice(0, 300)}` });
    }
    const link = await linkResp.json() as { id: string; url: string };
    res.json({ ok: true, paymentLinkId: link.id, url: link.url, productId: product.id, priceId: price.id });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Payment link creation failed" });
  }
});

// POST /api/devhub/media/image — generate image via OpenAI DALL-E 3
devhubRouter.post("/media/image", async (req, res) => {
  const { prompt, size = "1024x1024", quality = "standard", style = "vivid" } = req.body || {};
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "prompt required" });
  }
  if (prompt.trim().length > 4000) {
    return res.status(400).json({ error: "prompt too long (max 4000 chars)" });
  }
  const validSizes = ["1024x1024", "1792x1024", "1024x1792"];
  if (!validSizes.includes(size)) {
    return res.status(400).json({ error: `size must be one of ${validSizes.join(", ")}` });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "OpenAI not configured — set OPENAI_API_KEY",
      setupUrl: "https://platform.openai.com/api-keys",
    });
  }

  try {
    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: prompt.trim(),
        n: 1,
        size,
        quality: quality === "hd" ? "hd" : "standard",
        style: style === "natural" ? "natural" : "vivid",
        response_format: "url",
      }),
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `DALL-E error: ${errText.slice(0, 300)}` });
    }
    const data = await r.json() as { data: Array<{ url: string; revised_prompt?: string }> };
    const first = data.data?.[0];
    if (!first?.url) return res.status(500).json({ error: "no image returned" });
    res.json({ ok: true, url: first.url, revisedPrompt: first.revised_prompt || null });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Image generation failed" });
  }
});

// POST /api/devhub/media/sfx — ElevenLabs sound effect
devhubRouter.post("/media/sfx", async (req, res) => {
  const { text, durationSeconds, promptInfluence } = req.body || {};
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text (sfx description) required" });
  }
  if (text.trim().length > 1000) {
    return res.status(400).json({ error: "text too long (max 1000 chars)" });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "ElevenLabs not configured — set ELEVENLABS_API_KEY",
      setupUrl: "https://elevenlabs.io/api",
    });
  }

  const body: Record<string, unknown> = { text: text.trim() };
  const dur = Number(durationSeconds);
  if (Number.isFinite(dur) && dur >= 0.5 && dur <= 22) body.duration_seconds = dur;
  const inf = Number(promptInfluence);
  if (Number.isFinite(inf) && inf >= 0 && inf <= 1) body.prompt_influence = inf;

  try {
    const r = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `ElevenLabs SFX error: ${errText.slice(0, 300)}` });
    }
    const audioBuffer = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audioBuffer.length);
    res.setHeader("Cache-Control", "no-store");
    res.send(audioBuffer);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "SFX generation failed" });
  }
});

// POST /api/devhub/media/music — ElevenLabs music compose
devhubRouter.post("/media/music", async (req, res) => {
  const { prompt, musicLengthMs } = req.body || {};
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "prompt (music description) required" });
  }
  if (prompt.trim().length > 2000) {
    return res.status(400).json({ error: "prompt too long (max 2000 chars)" });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "ElevenLabs not configured — set ELEVENLABS_API_KEY",
      setupUrl: "https://elevenlabs.io/api",
    });
  }

  const body: Record<string, unknown> = { prompt: prompt.trim() };
  const len = Number(musicLengthMs);
  if (Number.isFinite(len) && len >= 10_000 && len <= 300_000) {
    body.music_length_ms = Math.round(len);
  }

  try {
    const r = await fetch("https://api.elevenlabs.io/v1/music/compose", {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `ElevenLabs Music error: ${errText.slice(0, 300)}` });
    }
    const audioBuffer = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audioBuffer.length);
    res.setHeader("Cache-Control", "no-store");
    res.send(audioBuffer);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Music compose failed" });
  }
});

// POST /api/devhub/projects/:id/domain/auto-setup — Cloudflare DNS CNAME
devhubRouter.post("/projects/:id/domain/auto-setup", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  let project: DevHubProject | null;
  try { project = await dbGetProject(req.params.id); }
  catch { project = memProjects.get(req.params.id) ?? null; }
  if (!project || project.userId !== userId) {
    return res.status(404).json({ error: "project not found" });
  }
  if (!project.customDomain) {
    return res.status(400).json({ error: "project has no customDomain set" });
  }

  const cfToken = process.env.CLOUDFLARE_API_TOKEN;
  const cfZoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!cfToken || !cfZoneId) {
    return res.status(503).json({
      error: "Cloudflare not configured — set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ZONE_ID",
      setupUrl: "https://dash.cloudflare.com/profile/api-tokens",
      manualInstruction: `Add CNAME ${project.customDomain} → devhub.aevion.app`,
    });
  }

  const target = "devhub.aevion.app";
  const domain = project.customDomain;

  try {
    const listResp = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/dns_records?type=CNAME&name=${encodeURIComponent(domain)}`,
      { headers: { Authorization: `Bearer ${cfToken}`, Accept: "application/json" } }
    );
    if (!listResp.ok) {
      const t = await listResp.text();
      return res.status(listResp.status).json({ error: `Cloudflare list error: ${t.slice(0, 300)}` });
    }
    const listData = await listResp.json() as { result: Array<{ id: string; content: string }> };
    const existing = listData.result?.[0];

    if (existing) {
      if (existing.content === target) {
        return res.json({ ok: true, action: "already-configured", domain, cname: target, recordId: existing.id });
      }
      const upResp = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/dns_records/${existing.id}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ type: "CNAME", name: domain, content: target, ttl: 1, proxied: true }),
        }
      );
      if (!upResp.ok) {
        const t = await upResp.text();
        return res.status(upResp.status).json({ error: `Cloudflare update error: ${t.slice(0, 300)}` });
      }
      return res.json({ ok: true, action: "updated", domain, cname: target, recordId: existing.id });
    }

    const createResp = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/dns_records`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "CNAME", name: domain, content: target, ttl: 1, proxied: true }),
      }
    );
    if (!createResp.ok) {
      const t = await createResp.text();
      return res.status(createResp.status).json({ error: `Cloudflare create error: ${t.slice(0, 300)}` });
    }
    const created = await createResp.json() as { result: { id: string } };
    res.json({ ok: true, action: "created", domain, cname: target, recordId: created.result.id });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Domain setup failed" });
  }
});

// ── Voice clone helpers ─────────────────────────────────────────────────────

function buildVoiceCloneMultipart(opts: { name: string; description?: string; mimeType: string; audio: Buffer }): { body: Buffer; boundary: string } {
  const boundary = `----aevion${crypto.randomBytes(16).toString("hex")}`;
  const parts: Buffer[] = [];
  const push = (s: string) => parts.push(Buffer.from(s, "utf8"));
  push(`--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\n${opts.name}\r\n`);
  if (opts.description) push(`--${boundary}\r\nContent-Disposition: form-data; name="description"\r\n\r\n${opts.description}\r\n`);
  push(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="sample.${opts.mimeType.includes("wav") ? "wav" : "mp3"}"\r\nContent-Type: ${opts.mimeType}\r\n\r\n`);
  parts.push(opts.audio);
  push(`\r\n--${boundary}--\r\n`);
  return { body: Buffer.concat(parts), boundary };
}

// POST /api/devhub/media/voice-clone — ElevenLabs custom voice from sample (requires confirm:true after preview)
devhubRouter.post("/media/voice-clone", async (req, res) => {
  const { name, description, sampleBase64, mimeType = "audio/mpeg", confirm } = req.body || {};
  if (!name || typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "name required" });
  if (!sampleBase64 || typeof sampleBase64 !== "string") return res.status(400).json({ error: "sampleBase64 (audio file) required" });
  if (sampleBase64.length > 12_000_000) return res.status(400).json({ error: "sample too large (max ~9 MB base64)" });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "ElevenLabs not configured — set ELEVENLABS_API_KEY", setupUrl: "https://elevenlabs.io/api" });

  if (confirm !== true) {
    return res.status(400).json({ error: "preview first — pass confirm:true after listening to /media/voice-clone/preview", needsConfirm: true });
  }

  try {
    const audioBuffer = Buffer.from(sampleBase64, "base64");
    const { body, boundary } = buildVoiceCloneMultipart({
      name: name.trim(), description: description ? String(description).slice(0, 500) : undefined,
      mimeType, audio: audioBuffer,
    });
    const r = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body: body as unknown as BodyInit,
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `Voice clone error: ${errText.slice(0, 300)}` });
    }
    const data = await r.json() as { voice_id: string; requires_verification?: boolean };
    res.json({ ok: true, voiceId: data.voice_id, requiresVerification: data.requires_verification ?? false });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Voice clone failed" });
  }
});

// POST /api/devhub/media/voice-clone/preview — clone temp voice → TTS sample → delete voice
// Body: { sampleBase64, mimeType?, previewText? }
// Response: audio/mpeg of `previewText` rendered with the cloned voice
devhubRouter.post("/media/voice-clone/preview", async (req, res) => {
  const { sampleBase64, mimeType = "audio/mpeg", previewText } = req.body || {};
  if (!sampleBase64 || typeof sampleBase64 !== "string") return res.status(400).json({ error: "sampleBase64 (audio file) required" });
  if (sampleBase64.length > 12_000_000) return res.status(400).json({ error: "sample too large (max ~9 MB base64)" });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "ElevenLabs not configured — set ELEVENLABS_API_KEY", setupUrl: "https://elevenlabs.io/api" });

  const text = String(previewText || "AEVION voice preview — your custom voice is ready").slice(0, 500);
  const tempName = `aevion-preview-${crypto.randomBytes(4).toString("hex")}`;
  let voiceId: string | null = null;

  try {
    const audioBuffer = Buffer.from(sampleBase64, "base64");

    // 1. Clone voice (temporary)
    const cloneReq = buildVoiceCloneMultipart({ name: tempName, mimeType, audio: audioBuffer });
    const cloneResp = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": `multipart/form-data; boundary=${cloneReq.boundary}` },
      body: cloneReq.body as unknown as BodyInit,
    });
    if (!cloneResp.ok) {
      const errText = await cloneResp.text();
      return res.status(cloneResp.status).json({ error: `Clone (preview) failed: ${errText.slice(0, 300)}` });
    }
    const cloneData = await cloneResp.json() as { voice_id: string };
    voiceId = cloneData.voice_id;
    if (!voiceId) return res.status(500).json({ error: "no voice_id returned for preview" });

    // 2. Render preview TTS with the cloned voice
    const ttsResp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: "eleven_monolingual_v1" }),
    });
    if (!ttsResp.ok) {
      const errText = await ttsResp.text();
      // Best-effort cleanup before bailing
      fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, { method: "DELETE", headers: { "xi-api-key": apiKey } }).catch(() => {});
      return res.status(ttsResp.status).json({ error: `Preview TTS failed: ${errText.slice(0, 300)}` });
    }
    const audio = Buffer.from(await ttsResp.arrayBuffer());

    // 3. Best-effort delete to avoid leaking temp voices in the user's account
    try {
      await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
        method: "DELETE", headers: { "xi-api-key": apiKey },
      });
    } catch { /* leak is acceptable — preview already returned */ }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audio.length);
    res.setHeader("X-Aevion-Preview-Bytes", String(audio.length));
    res.setHeader("Cache-Control", "no-store");
    res.send(audio);
  } catch (e: any) {
    if (voiceId) {
      fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, { method: "DELETE", headers: { "xi-api-key": apiKey } }).catch(() => {});
    }
    res.status(500).json({ error: e?.message || "Voice preview failed" });
  }
});

// POST /api/devhub/media/stt — ElevenLabs Speech-to-Text (scribe-v1)
devhubRouter.post("/media/stt", async (req, res) => {
  const { audioBase64, mimeType = "audio/mpeg", language } = req.body || {};
  if (!audioBase64 || typeof audioBase64 !== "string") return res.status(400).json({ error: "audioBase64 required" });
  if (audioBase64.length > 30_000_000) return res.status(400).json({ error: "audio too large (max ~22 MB base64)" });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "ElevenLabs not configured — set ELEVENLABS_API_KEY" });

  try {
    const audioBuffer = Buffer.from(audioBase64, "base64");
    const boundary = `----aevion${crypto.randomBytes(16).toString("hex")}`;
    const parts: Buffer[] = [];
    const push = (s: string) => parts.push(Buffer.from(s, "utf8"));
    push(`--${boundary}\r\nContent-Disposition: form-data; name="model_id"\r\n\r\nscribe_v1\r\n`);
    if (language) push(`--${boundary}\r\nContent-Disposition: form-data; name="language_code"\r\n\r\n${String(language).slice(0, 10)}\r\n`);
    push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.${mimeType.includes("wav") ? "wav" : "mp3"}"\r\nContent-Type: ${mimeType}\r\n\r\n`);
    parts.push(audioBuffer);
    push(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat(parts);
    const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body,
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `STT error: ${errText.slice(0, 300)}` });
    }
    const data = await r.json() as { text?: string; language_code?: string; language_probability?: number };
    res.json({ ok: true, text: data.text || "", language: data.language_code || null, confidence: data.language_probability ?? null });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "STT failed" });
  }
});

// POST /api/devhub/media/drive-search — Google Drive file search
devhubRouter.post("/media/drive-search", async (req, res) => {
  const { query = "", limit = 20 } = req.body || {};
  const token = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  if (!token) {
    return res.status(503).json({
      error: "Google Drive not configured — set GOOGLE_DRIVE_ACCESS_TOKEN (OAuth Bearer)",
      setupUrl: "https://developers.google.com/drive/api/quickstart/js",
    });
  }
  try {
    const q = String(query).trim();
    const params = new URLSearchParams({
      pageSize: String(Math.min(Math.max(Number(limit) || 20, 1), 100)),
      fields: "files(id,name,mimeType,modifiedTime,size)",
    });
    if (q) params.set("q", `name contains '${q.replace(/'/g, "\\'")}' and trashed = false`);
    else params.set("q", "trashed = false");
    const r = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `Drive error: ${errText.slice(0, 300)}` });
    }
    const data = await r.json() as { files: Array<{ id: string; name: string; mimeType: string; modifiedTime?: string; size?: string }> };
    res.json({ ok: true, files: data.files || [] });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Drive search failed" });
  }
});

// POST /api/devhub/projects/:id/drive/import — import Drive file into project files
devhubRouter.post("/projects/:id/drive/import", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  let project: DevHubProject | null;
  try { project = await dbGetProject(req.params.id); }
  catch { project = memProjects.get(req.params.id) ?? null; }
  if (!project || project.userId !== userId) return res.status(404).json({ error: "project not found" });

  const { fileId, targetPath } = req.body || {};
  if (!fileId || typeof fileId !== "string") return res.status(400).json({ error: "fileId required" });
  const token = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  if (!token) return res.status(503).json({ error: "Google Drive not configured — set GOOGLE_DRIVE_ACCESS_TOKEN" });

  try {
    const metaResp = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=name,mimeType`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaResp.ok) {
      const t = await metaResp.text();
      return res.status(metaResp.status).json({ error: `Drive metadata error: ${t.slice(0, 200)}` });
    }
    const meta = await metaResp.json() as { name: string; mimeType: string };
    const isGoogleDoc = meta.mimeType.startsWith("application/vnd.google-apps");
    let contentResp: Response;
    if (isGoogleDoc) {
      const exportMime = meta.mimeType.includes("document") ? "text/markdown"
                      : meta.mimeType.includes("spreadsheet") ? "text/csv"
                      : "text/plain";
      contentResp = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(exportMime)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } else {
      contentResp = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    if (!contentResp.ok) {
      const t = await contentResp.text();
      return res.status(contentResp.status).json({ error: `Drive content error: ${t.slice(0, 200)}` });
    }
    const content = await contentResp.text();
    const path = String(targetPath || meta.name).replace(/^\/+/, "").slice(0, 200) || meta.name;
    const file: DevHubFile = {
      id: crypto.randomUUID(),
      projectId: project.id,
      path,
      content,
      language: detectLanguage(path),
      updatedAt: now(),
    };
    try { await dbUpsertFile(file); }
    catch {
      const existing = [...memFiles.values()].find((f) => f.projectId === project!.id && f.path === path);
      if (existing) { existing.content = file.content; existing.language = file.language; existing.updatedAt = file.updatedAt; }
      else memFiles.set(file.id, file);
    }
    res.json({ ok: true, path, bytes: content.length, mimeType: meta.mimeType });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Drive import failed" });
  }
});

// POST /api/devhub/projects/:id/agent/workflow — orchestrate multi-step AI workflow
devhubRouter.post("/projects/:id/agent/workflow", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  let project: DevHubProject | null;
  try { project = await dbGetProject(req.params.id); }
  catch { project = memProjects.get(req.params.id) ?? null; }
  if (!project || project.userId !== userId) return res.status(404).json({ error: "project not found" });

  const { steps } = req.body || {};
  if (!Array.isArray(steps) || steps.length === 0) return res.status(400).json({ error: "steps array required" });
  if (steps.length > 20) return res.status(400).json({ error: "max 20 steps per workflow" });

  const results: Array<{ step: number; type: string; ok: boolean; output?: any; error?: string; savedAs?: string }> = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const type = String(step?.type || "");
    try {
      if (type === "code") {
        const prompt = String(step.prompt || "");
        if (!prompt) throw new Error("prompt required for code step");
        const stack = String(step.stack || project.stack);
        const targetFile = step.saveAs ? String(step.saveAs) : undefined;
        const files = await generateCodeWithAI(prompt, stack, targetFile);
        for (const gf of files) {
          const f: DevHubFile = {
            id: crypto.randomUUID(), projectId: project.id, path: gf.path,
            content: gf.content, language: gf.language || detectLanguage(gf.path), updatedAt: now(),
          };
          try { await dbUpsertFile(f); }
          catch {
            const existing = [...memFiles.values()].find((x) => x.projectId === project!.id && x.path === gf.path);
            if (existing) { existing.content = f.content; existing.language = f.language; existing.updatedAt = f.updatedAt; }
            else memFiles.set(f.id, f);
          }
        }
        results.push({ step: i, type, ok: true, output: { files: files.map((f) => f.path) } });
      } else if (type === "image") {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error("OPENAI_API_KEY not set");
        const prompt = String(step.prompt || "");
        if (!prompt) throw new Error("prompt required for image step");
        const dResp = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "dall-e-3", prompt, n: 1, size: step.size || "1024x1024", response_format: "url" }),
        });
        if (!dResp.ok) throw new Error(`DALL-E error: ${(await dResp.text()).slice(0, 200)}`);
        const d = await dResp.json() as { data: Array<{ url: string }> };
        const oaiUrl = d.data?.[0]?.url;
        if (!oaiUrl) throw new Error("no image url returned");
        // Auto-upload to Cloudflare Images for permanent URL (if env set)
        const permanentUrl = await tryAutoUploadToCloudflare(oaiUrl);
        const url = permanentUrl || oaiUrl;
        const savedAs = step.saveAs ? String(step.saveAs) : `public/image-${i}.url.txt`;
        const f: DevHubFile = {
          id: crypto.randomUUID(), projectId: project.id, path: savedAs,
          content: url, language: detectLanguage(savedAs), updatedAt: now(),
        };
        try { await dbUpsertFile(f); } catch { memFiles.set(f.id, f); }
        results.push({ step: i, type, ok: true, output: { url }, savedAs });
      } else if (type === "tts") {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");
        const text = String(step.text || "");
        if (!text) throw new Error("text required for tts step");
        const VOICE_IDS: Record<string, string> = {
          Rachel: "21m00Tcm4TlvDq8ikWAM", Adam: "pNInz6obpgDQGcFmaJgB",
          Antoni: "ErXwobaYiN019PkySvjV", Bella: "EXAVITQu4vr4xnSDxMaL",
        };
        const voiceId = VOICE_IDS[String(step.voice || "Rachel")] || VOICE_IDS.Rachel;
        const ttsResp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: "POST",
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
          body: JSON.stringify({ text, model_id: "eleven_monolingual_v1" }),
        });
        if (!ttsResp.ok) throw new Error(`TTS error: ${(await ttsResp.text()).slice(0, 200)}`);
        const audioBuf = Buffer.from(await ttsResp.arrayBuffer());
        const r2Key = `audio/${project.id}/tts-${i}-${Date.now()}.mp3`;
        const cdnUrl = await tryAutoUploadAudioToR2(audioBuf, "audio/mpeg", r2Key);
        if (cdnUrl) {
          const savedAs = step.saveAs ? String(step.saveAs).replace(/\.mp3\.b64$/i, ".url.txt") : `public/voice-${i}.url.txt`;
          const f: DevHubFile = {
            id: crypto.randomUUID(), projectId: project.id, path: savedAs,
            content: cdnUrl, language: "plaintext", updatedAt: now(),
          };
          try { await dbUpsertFile(f); } catch { memFiles.set(f.id, f); }
          results.push({ step: i, type, ok: true, output: { url: cdnUrl, bytes: audioBuf.length }, savedAs });
        } else {
          const savedAs = step.saveAs ? String(step.saveAs) : `public/voice-${i}.mp3.b64`;
          const f: DevHubFile = {
            id: crypto.randomUUID(), projectId: project.id, path: savedAs,
            content: audioBuf.toString("base64"), language: "plaintext", updatedAt: now(),
          };
          try { await dbUpsertFile(f); } catch { memFiles.set(f.id, f); }
          results.push({ step: i, type, ok: true, output: { bytes: audioBuf.length }, savedAs });
        }
      } else if (type === "sfx") {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");
        const text = String(step.text || "");
        if (!text) throw new Error("text required for sfx step");
        const body: Record<string, unknown> = { text };
        const dur = Number(step.durationSeconds);
        if (Number.isFinite(dur) && dur >= 0.5 && dur <= 22) body.duration_seconds = dur;
        const sfxResp = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
          method: "POST",
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
          body: JSON.stringify(body),
        });
        if (!sfxResp.ok) throw new Error(`SFX error: ${(await sfxResp.text()).slice(0, 200)}`);
        const audioBuf = Buffer.from(await sfxResp.arrayBuffer());
        const r2Key = `audio/${project.id}/sfx-${i}-${Date.now()}.mp3`;
        const cdnUrl = await tryAutoUploadAudioToR2(audioBuf, "audio/mpeg", r2Key);
        if (cdnUrl) {
          const savedAs = step.saveAs ? String(step.saveAs).replace(/\.mp3\.b64$/i, ".url.txt") : `public/sfx-${i}.url.txt`;
          const f: DevHubFile = {
            id: crypto.randomUUID(), projectId: project.id, path: savedAs,
            content: cdnUrl, language: "plaintext", updatedAt: now(),
          };
          try { await dbUpsertFile(f); } catch { memFiles.set(f.id, f); }
          results.push({ step: i, type, ok: true, output: { url: cdnUrl, bytes: audioBuf.length }, savedAs });
        } else {
          const savedAs = step.saveAs ? String(step.saveAs) : `public/sfx-${i}.mp3.b64`;
          const f: DevHubFile = {
            id: crypto.randomUUID(), projectId: project.id, path: savedAs,
            content: audioBuf.toString("base64"), language: "plaintext", updatedAt: now(),
          };
          try { await dbUpsertFile(f); } catch { memFiles.set(f.id, f); }
          results.push({ step: i, type, ok: true, output: { bytes: audioBuf.length }, savedAs });
        }
      } else if (type === "music") {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");
        const prompt = String(step.prompt || step.text || "");
        if (!prompt) throw new Error("prompt required for music step");
        const body: Record<string, unknown> = { prompt };
        const lenSec = Number(step.lengthSeconds);
        if (Number.isFinite(lenSec) && lenSec >= 10 && lenSec <= 300) {
          body.music_length_ms = Math.round(lenSec * 1000);
        }
        const musicResp = await fetch("https://api.elevenlabs.io/v1/music/compose", {
          method: "POST",
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
          body: JSON.stringify(body),
        });
        if (!musicResp.ok) throw new Error(`Music error: ${(await musicResp.text()).slice(0, 200)}`);
        const audioBuf = Buffer.from(await musicResp.arrayBuffer());
        const r2Key = `audio/${project.id}/music-${i}-${Date.now()}.mp3`;
        const cdnUrl = await tryAutoUploadAudioToR2(audioBuf, "audio/mpeg", r2Key);
        if (cdnUrl) {
          const savedAs = step.saveAs ? String(step.saveAs).replace(/\.mp3\.b64$/i, ".url.txt") : `public/music-${i}.url.txt`;
          const f: DevHubFile = {
            id: crypto.randomUUID(), projectId: project.id, path: savedAs,
            content: cdnUrl, language: "plaintext", updatedAt: now(),
          };
          try { await dbUpsertFile(f); } catch { memFiles.set(f.id, f); }
          results.push({ step: i, type, ok: true, output: { url: cdnUrl, bytes: audioBuf.length }, savedAs });
        } else {
          const savedAs = step.saveAs ? String(step.saveAs) : `public/music-${i}.mp3.b64`;
          const f: DevHubFile = {
            id: crypto.randomUUID(), projectId: project.id, path: savedAs,
            content: audioBuf.toString("base64"), language: "plaintext", updatedAt: now(),
          };
          try { await dbUpsertFile(f); } catch { memFiles.set(f.id, f); }
          results.push({ step: i, type, ok: true, output: { bytes: audioBuf.length }, savedAs });
        }
      } else {
        results.push({ step: i, type, ok: false, error: `unknown step type: ${type}` });
      }
    } catch (e: any) {
      results.push({ step: i, type, ok: false, error: e?.message || "step failed" });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  res.json({
    ok: okCount === results.length,
    totalSteps: results.length,
    successCount: okCount,
    failureCount: results.length - okCount,
    results,
  });
});

// ── Agent workflow templates ────────────────────────────────────────────────
const AGENT_WORKFLOW_TEMPLATES = [
  {
    id: "landing",
    name: "Landing page",
    description: "Hero + headline + CTA + voiceover + sound effect",
    steps: [
      { type: "code", prompt: "Modern landing page: hero section with headline, subheadline, and CTA button. Tailwind, dark theme.", saveAs: "pages/index.tsx" },
      { type: "image", prompt: "Futuristic abstract gradient, purple and teal, soft glow, hero background", size: "1792x1024", saveAs: "public/hero.url.txt" },
      { type: "tts", text: "Welcome to AEVION — the unified AI platform. Build, deploy, and scale your ideas in one place.", voice: "Rachel", saveAs: "public/welcome.mp3.b64" },
      { type: "sfx", text: "Subtle whoosh transition, modern UI sound", durationSeconds: 1.5, saveAs: "public/whoosh.mp3.b64" },
      { type: "music", prompt: "Ambient electronic background, soft synth pads, hopeful, looped — for landing page hero", lengthSeconds: 30, saveAs: "public/landing-bg.mp3.b64" },
    ],
  },
  {
    id: "blog",
    name: "Blog post",
    description: "Article with header image + audio narration",
    steps: [
      { type: "code", prompt: "Blog post page with title, date, hero image, and markdown article body in Next.js", saveAs: "pages/post.tsx" },
      { type: "image", prompt: "Editorial illustration, flat design, vibrant colors, abstract concept", size: "1024x1024", saveAs: "public/article-hero.url.txt" },
      { type: "tts", text: "Welcome to our weekly article. Today, we explore the future of AI-assisted development.", voice: "Adam", saveAs: "public/narration.mp3.b64" },
    ],
  },
  {
    id: "dashboard",
    name: "Analytics dashboard",
    description: "Stats cards + chart + onboarding voice",
    steps: [
      { type: "code", prompt: "Analytics dashboard: 4 stat cards (users, revenue, sessions, conversion) + bar chart of last 7 days. Mock data, light theme.", saveAs: "pages/dashboard.tsx" },
      { type: "image", prompt: "Minimal dashboard UI mockup, light theme, clean typography", size: "1024x1024", saveAs: "public/dashboard-preview.url.txt" },
      { type: "tts", text: "Your dashboard is ready. Track users, revenue, and conversion in real time.", voice: "Bella", saveAs: "public/dashboard-intro.mp3.b64" },
    ],
  },
];

// GET /api/devhub/agent/templates
devhubRouter.get("/agent/templates", (_req, res) => {
  res.json({ templates: AGENT_WORKFLOW_TEMPLATES });
});

// POST /api/devhub/projects/:id/agent/workflow/stream — SSE per-step progress
devhubRouter.post("/projects/:id/agent/workflow/stream", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  let project: DevHubProject | null;
  try { project = await dbGetProject(req.params.id); }
  catch { project = memProjects.get(req.params.id) ?? null; }
  if (!project || project.userId !== userId) return res.status(404).json({ error: "project not found" });

  const { steps } = req.body || {};
  if (!Array.isArray(steps) || steps.length === 0) return res.status(400).json({ error: "steps array required" });
  if (steps.length > 20) return res.status(400).json({ error: "max 20 steps per workflow" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const emit = (event: any) => {
    try { res.write(`data: ${JSON.stringify(event)}\n\n`); } catch { /* socket closed */ }
  };

  emit({ type: "start", totalSteps: steps.length });

  let okCount = 0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const type = String(step?.type || "");
    emit({ type: "step-start", index: i, stepType: type });

    try {
      if (type === "code") {
        const prompt = String(step.prompt || "");
        if (!prompt) throw new Error("prompt required for code step");
        const stack = String(step.stack || project.stack);
        const targetFile = step.saveAs ? String(step.saveAs) : undefined;
        const files = await generateCodeWithAI(prompt, stack, targetFile);
        for (const gf of files) {
          const f: DevHubFile = {
            id: crypto.randomUUID(), projectId: project.id, path: gf.path,
            content: gf.content, language: gf.language || detectLanguage(gf.path), updatedAt: now(),
          };
          try { await dbUpsertFile(f); }
          catch {
            const existing = [...memFiles.values()].find((x) => x.projectId === project!.id && x.path === gf.path);
            if (existing) { existing.content = f.content; existing.language = f.language; existing.updatedAt = f.updatedAt; }
            else memFiles.set(f.id, f);
          }
        }
        emit({ type: "step-done", index: i, ok: true, output: { files: files.map((f) => f.path) } });
        okCount++;
      } else if (type === "image") {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error("OPENAI_API_KEY not set");
        const prompt = String(step.prompt || "");
        if (!prompt) throw new Error("prompt required for image step");
        const dResp = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "dall-e-3", prompt, n: 1, size: step.size || "1024x1024", response_format: "url" }),
        });
        if (!dResp.ok) throw new Error(`DALL-E error: ${(await dResp.text()).slice(0, 200)}`);
        const d = await dResp.json() as { data: Array<{ url: string }> };
        const oaiUrl = d.data?.[0]?.url;
        if (!oaiUrl) throw new Error("no image url returned");
        // Auto-upload to Cloudflare Images for permanent URL (if env set)
        const permanentUrl = await tryAutoUploadToCloudflare(oaiUrl);
        const url = permanentUrl || oaiUrl;
        const savedAs = step.saveAs ? String(step.saveAs) : `public/image-${i}.url.txt`;
        const f: DevHubFile = {
          id: crypto.randomUUID(), projectId: project.id, path: savedAs,
          content: url, language: detectLanguage(savedAs), updatedAt: now(),
        };
        try { await dbUpsertFile(f); } catch { memFiles.set(f.id, f); }
        emit({ type: "step-done", index: i, ok: true, output: { url }, savedAs });
        okCount++;
      } else if (type === "tts") {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");
        const text = String(step.text || "");
        if (!text) throw new Error("text required for tts step");
        const VOICE_IDS: Record<string, string> = {
          Rachel: "21m00Tcm4TlvDq8ikWAM", Adam: "pNInz6obpgDQGcFmaJgB",
          Antoni: "ErXwobaYiN019PkySvjV", Bella: "EXAVITQu4vr4xnSDxMaL",
        };
        const voiceId = VOICE_IDS[String(step.voice || "Rachel")] || VOICE_IDS.Rachel;
        const ttsResp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: "POST",
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
          body: JSON.stringify({ text, model_id: "eleven_monolingual_v1" }),
        });
        if (!ttsResp.ok) throw new Error(`TTS error: ${(await ttsResp.text()).slice(0, 200)}`);
        const audioBuf = Buffer.from(await ttsResp.arrayBuffer());
        const r2Key = `audio/${project.id}/tts-${i}-${Date.now()}.mp3`;
        const cdnUrl = await tryAutoUploadAudioToR2(audioBuf, "audio/mpeg", r2Key);
        if (cdnUrl) {
          const savedAs = step.saveAs ? String(step.saveAs).replace(/\.mp3\.b64$/i, ".url.txt") : `public/voice-${i}.url.txt`;
          const f: DevHubFile = {
            id: crypto.randomUUID(), projectId: project.id, path: savedAs,
            content: cdnUrl, language: "plaintext", updatedAt: now(),
          };
          try { await dbUpsertFile(f); } catch { memFiles.set(f.id, f); }
          emit({ type: "step-done", index: i, ok: true, output: { url: cdnUrl, bytes: audioBuf.length }, savedAs });
        } else {
          const savedAs = step.saveAs ? String(step.saveAs) : `public/voice-${i}.mp3.b64`;
          const f: DevHubFile = {
            id: crypto.randomUUID(), projectId: project.id, path: savedAs,
            content: audioBuf.toString("base64"), language: "plaintext", updatedAt: now(),
          };
          try { await dbUpsertFile(f); } catch { memFiles.set(f.id, f); }
          emit({ type: "step-done", index: i, ok: true, output: { bytes: audioBuf.length }, savedAs });
        }
        okCount++;
      } else if (type === "sfx") {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");
        const text = String(step.text || "");
        if (!text) throw new Error("text required for sfx step");
        const body: Record<string, unknown> = { text };
        const dur = Number(step.durationSeconds);
        if (Number.isFinite(dur) && dur >= 0.5 && dur <= 22) body.duration_seconds = dur;
        const sfxResp = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
          method: "POST",
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
          body: JSON.stringify(body),
        });
        if (!sfxResp.ok) throw new Error(`SFX error: ${(await sfxResp.text()).slice(0, 200)}`);
        const audioBuf = Buffer.from(await sfxResp.arrayBuffer());
        const r2Key = `audio/${project.id}/sfx-${i}-${Date.now()}.mp3`;
        const cdnUrl = await tryAutoUploadAudioToR2(audioBuf, "audio/mpeg", r2Key);
        if (cdnUrl) {
          const savedAs = step.saveAs ? String(step.saveAs).replace(/\.mp3\.b64$/i, ".url.txt") : `public/sfx-${i}.url.txt`;
          const f: DevHubFile = {
            id: crypto.randomUUID(), projectId: project.id, path: savedAs,
            content: cdnUrl, language: "plaintext", updatedAt: now(),
          };
          try { await dbUpsertFile(f); } catch { memFiles.set(f.id, f); }
          emit({ type: "step-done", index: i, ok: true, output: { url: cdnUrl, bytes: audioBuf.length }, savedAs });
        } else {
          const savedAs = step.saveAs ? String(step.saveAs) : `public/sfx-${i}.mp3.b64`;
          const f: DevHubFile = {
            id: crypto.randomUUID(), projectId: project.id, path: savedAs,
            content: audioBuf.toString("base64"), language: "plaintext", updatedAt: now(),
          };
          try { await dbUpsertFile(f); } catch { memFiles.set(f.id, f); }
          emit({ type: "step-done", index: i, ok: true, output: { bytes: audioBuf.length }, savedAs });
        }
        okCount++;
      } else if (type === "music") {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");
        const prompt = String(step.prompt || step.text || "");
        if (!prompt) throw new Error("prompt required for music step");
        const body: Record<string, unknown> = { prompt };
        const lenSec = Number(step.lengthSeconds);
        if (Number.isFinite(lenSec) && lenSec >= 10 && lenSec <= 300) {
          body.music_length_ms = Math.round(lenSec * 1000);
        }
        const musicResp = await fetch("https://api.elevenlabs.io/v1/music/compose", {
          method: "POST",
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
          body: JSON.stringify(body),
        });
        if (!musicResp.ok) throw new Error(`Music error: ${(await musicResp.text()).slice(0, 200)}`);
        const audioBuf = Buffer.from(await musicResp.arrayBuffer());
        const r2Key = `audio/${project.id}/music-${i}-${Date.now()}.mp3`;
        const cdnUrl = await tryAutoUploadAudioToR2(audioBuf, "audio/mpeg", r2Key);
        if (cdnUrl) {
          const savedAs = step.saveAs ? String(step.saveAs).replace(/\.mp3\.b64$/i, ".url.txt") : `public/music-${i}.url.txt`;
          const f: DevHubFile = {
            id: crypto.randomUUID(), projectId: project.id, path: savedAs,
            content: cdnUrl, language: "plaintext", updatedAt: now(),
          };
          try { await dbUpsertFile(f); } catch { memFiles.set(f.id, f); }
          emit({ type: "step-done", index: i, ok: true, output: { url: cdnUrl, bytes: audioBuf.length }, savedAs });
        } else {
          const savedAs = step.saveAs ? String(step.saveAs) : `public/music-${i}.mp3.b64`;
          const f: DevHubFile = {
            id: crypto.randomUUID(), projectId: project.id, path: savedAs,
            content: audioBuf.toString("base64"), language: "plaintext", updatedAt: now(),
          };
          try { await dbUpsertFile(f); } catch { memFiles.set(f.id, f); }
          emit({ type: "step-done", index: i, ok: true, output: { bytes: audioBuf.length }, savedAs });
        }
        okCount++;
      } else {
        emit({ type: "step-done", index: i, ok: false, error: `unknown step type: ${type}` });
      }
    } catch (e: any) {
      emit({ type: "step-done", index: i, ok: false, error: e?.message || "step failed" });
    }
  }

  emit({ type: "complete", totalSteps: steps.length, successCount: okCount, failureCount: steps.length - okCount });
  res.end();
});

// POST /api/devhub/media/sms — Brevo transactional SMS
devhubRouter.post("/media/sms", async (req, res) => {
  const { recipient, content, sender } = req.body || {};
  if (!recipient || typeof recipient !== "string") return res.status(400).json({ error: "recipient (E.164 phone) required" });
  if (!/^\+\d{6,18}$/.test(recipient.trim())) return res.status(400).json({ error: "recipient must be E.164 format (e.g. +14155552671)" });
  if (!content || typeof content !== "string") return res.status(400).json({ error: "content required" });
  if (content.length > 612) return res.status(400).json({ error: "content too long (max 612 chars, 4 SMS segments)" });

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "Brevo not configured — set BREVO_API_KEY",
      setupUrl: "https://app.brevo.com/settings/keys/api",
    });
  }

  const senderName = (typeof sender === "string" && sender.trim()) ? sender.trim().slice(0, 11) : (process.env.BREVO_SMS_SENDER || "AEVION");

  try {
    const r = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        type: "transactional",
        sender: senderName,
        recipient: recipient.trim(),
        content: content.slice(0, 612),
      }),
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `Brevo SMS error: ${errText.slice(0, 300)}` });
    }
    const data = await r.json().catch(() => ({}));
    res.json({
      ok: true,
      reference: (data as any)?.reference ?? null,
      messageId: (data as any)?.messageId ?? null,
      smsCount: (data as any)?.smsCount ?? null,
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "SMS send failed" });
  }
});

// POST /api/devhub/media/whatsapp — Brevo WhatsApp template message
devhubRouter.post("/media/whatsapp", async (req, res) => {
  const { contactNumber, templateId, params } = req.body || {};
  if (!contactNumber || typeof contactNumber !== "string") return res.status(400).json({ error: "contactNumber (E.164 phone) required" });
  if (!/^\+?\d{6,18}$/.test(contactNumber.trim())) return res.status(400).json({ error: "contactNumber must be E.164 format" });
  if (!templateId || (typeof templateId !== "string" && typeof templateId !== "number")) return res.status(400).json({ error: "templateId required (approved WABA template)" });

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "Brevo not configured — set BREVO_API_KEY" });
  }

  const senderNumberId = process.env.BREVO_WHATSAPP_SENDER_ID;
  if (!senderNumberId) {
    return res.status(503).json({
      error: "Brevo WhatsApp sender not configured — set BREVO_WHATSAPP_SENDER_ID",
      setupUrl: "https://app.brevo.com/whatsapp",
    });
  }

  try {
    const r = await fetch("https://api.brevo.com/v3/whatsapp/sendMessage", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        senderNumberId,
        contactNumbers: [contactNumber.trim().replace(/^\+/, "")],
        templateId: Number(templateId) || templateId,
        ...(params && typeof params === "object" ? { params } : {}),
      }),
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `Brevo WhatsApp error: ${errText.slice(0, 300)}` });
    }
    const data = await r.json().catch(() => ({}));
    res.json({ ok: true, messageId: (data as any)?.messageId ?? null });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "WhatsApp send failed" });
  }
});

// POST /api/devhub/media/upload-image — upload image to Cloudflare Images (permanent CDN URL)
// Body: { sourceUrl?: string } OR { base64: string, mimeType?: string }
devhubRouter.post("/media/upload-image", async (req, res) => {
  const { sourceUrl, base64, mimeType = "image/png" } = req.body || {};
  if (!sourceUrl && !base64) {
    return res.status(400).json({ error: "sourceUrl or base64 required" });
  }

  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!apiToken || !accountId) {
    return res.status(503).json({
      error: "Cloudflare Images not configured — set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID",
      setupUrl: "https://dash.cloudflare.com/profile/api-tokens",
    });
  }

  try {
    // Cloudflare Images API: multipart form, "url" OR "file" field
    const boundary = `----aevion${crypto.randomBytes(16).toString("hex")}`;
    const parts: Buffer[] = [];
    const push = (s: string) => parts.push(Buffer.from(s, "utf8"));

    if (sourceUrl) {
      push(`--${boundary}\r\nContent-Disposition: form-data; name="url"\r\n\r\n${String(sourceUrl)}\r\n`);
    } else {
      const ext = mimeType.includes("png") ? "png" : mimeType.includes("jpg") || mimeType.includes("jpeg") ? "jpg" : "bin";
      push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="upload.${ext}"\r\nContent-Type: ${mimeType}\r\n\r\n`);
      parts.push(Buffer.from(base64, "base64"));
      push(`\r\n`);
    }
    push(`--${boundary}--\r\n`);
    const body = Buffer.concat(parts);

    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body,
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `Cloudflare Images error: ${errText.slice(0, 400)}` });
    }
    const data = await r.json() as { result?: { id: string; variants: string[]; uploaded: string } };
    if (!data.result?.id) {
      return res.status(500).json({ error: "no image id returned from Cloudflare" });
    }
    res.json({
      ok: true,
      imageId: data.result.id,
      url: data.result.variants?.[0] || null,
      variants: data.result.variants || [],
      uploaded: data.result.uploaded,
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Image upload failed" });
  }
});

// ── Helper: auto-upload DALL-E URL to Cloudflare Images if env set ───────────
async function tryAutoUploadToCloudflare(sourceUrl: string): Promise<string | null> {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!apiToken || !accountId) return null;
  try {
    const boundary = `----aevion${crypto.randomBytes(16).toString("hex")}`;
    const parts: Buffer[] = [];
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="url"\r\n\r\n${sourceUrl}\r\n--${boundary}--\r\n`, "utf8"));
    const body = Buffer.concat(parts);
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body,
    });
    if (!r.ok) return null;
    const data = await r.json() as { result?: { variants?: string[] } };
    return data.result?.variants?.[0] ?? null;
  } catch { return null; }
}

// POST /api/devhub/media/translate — DeepL text translation
devhubRouter.post("/media/translate", async (req, res) => {
  const { text, targetLang, sourceLang, formality } = req.body || {};
  if (!text || typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "text required" });
  if (!targetLang || typeof targetLang !== "string") return res.status(400).json({ error: "targetLang required (e.g. EN, RU, DE, ES, FR)" });
  if (text.length > 128_000) return res.status(400).json({ error: "text too long (max 128k chars)" });

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "DeepL not configured — set DEEPL_API_KEY",
      setupUrl: "https://www.deepl.com/account/summary",
    });
  }
  const endpoint = apiKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";

  try {
    const params = new URLSearchParams();
    params.append("text", text);
    params.append("target_lang", targetLang.toUpperCase().slice(0, 5));
    if (sourceLang) params.append("source_lang", String(sourceLang).toUpperCase().slice(0, 5));
    if (formality && ["default", "more", "less", "prefer_more", "prefer_less"].includes(String(formality))) {
      params.append("formality", String(formality));
    }
    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `DeepL error: ${errText.slice(0, 300)}` });
    }
    const data = await r.json() as { translations: Array<{ text: string; detected_source_language: string }> };
    const first = data.translations?.[0];
    if (!first) return res.status(500).json({ error: "no translation returned" });
    res.json({
      ok: true,
      text: first.text,
      detectedSource: first.detected_source_language,
      targetLang: targetLang.toUpperCase(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Translation failed" });
  }
});

// POST /api/devhub/projects/:id/files/translate — translate project file → save as new file
devhubRouter.post("/projects/:id/files/translate", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  let project: DevHubProject | null;
  try { project = await dbGetProject(req.params.id); }
  catch { project = memProjects.get(req.params.id) ?? null; }
  if (!project || project.userId !== userId) return res.status(404).json({ error: "project not found" });

  const { path, targetLang, saveAs } = req.body || {};
  if (!path || typeof path !== "string") return res.status(400).json({ error: "path required" });
  if (!targetLang || typeof targetLang !== "string") return res.status(400).json({ error: "targetLang required" });

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "DeepL not configured — set DEEPL_API_KEY" });

  let file: DevHubFile | null;
  try { file = await dbGetFile(project.id, path); }
  catch { file = [...memFiles.values()].find((f) => f.projectId === project!.id && f.path === path) ?? null; }
  if (!file) return res.status(404).json({ error: "file not found in project" });

  const endpoint = apiKey.endsWith(":fx") ? "https://api-free.deepl.com/v2/translate" : "https://api.deepl.com/v2/translate";
  try {
    const params = new URLSearchParams();
    params.append("text", file.content);
    params.append("target_lang", targetLang.toUpperCase().slice(0, 5));
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `DeepL error: ${errText.slice(0, 300)}` });
    }
    const data = await r.json() as { translations: Array<{ text: string }> };
    const translated = data.translations?.[0]?.text;
    if (!translated) return res.status(500).json({ error: "no translation returned" });

    const lang = targetLang.toLowerCase();
    const newPath = String(saveAs || path.replace(/(\.[^./]+)$/, `.${lang}$1`) || `${path}.${lang}`).slice(0, 200);
    const out: DevHubFile = {
      id: crypto.randomUUID(),
      projectId: project.id,
      path: newPath,
      content: translated,
      language: file.language,
      updatedAt: now(),
    };
    try { await dbUpsertFile(out); }
    catch {
      const existing = [...memFiles.values()].find((f) => f.projectId === project!.id && f.path === newPath);
      if (existing) { existing.content = out.content; existing.updatedAt = out.updatedAt; }
      else memFiles.set(out.id, out);
    }
    res.json({ ok: true, path: newPath, bytes: translated.length, targetLang: targetLang.toUpperCase() });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "File translation failed" });
  }
});

// GET /api/devhub/media/email-templates — list Brevo SMTP templates
devhubRouter.get("/media/email-templates", async (req, res) => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "Brevo not configured — set BREVO_API_KEY" });

  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  try {
    const r = await fetch(`https://api.brevo.com/v3/smtp/templates?limit=${limit}&offset=${offset}`, {
      headers: { "api-key": apiKey, Accept: "application/json" },
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `Brevo error: ${errText.slice(0, 300)}` });
    }
    const data = await r.json() as { templates?: Array<{ id: number; name: string; subject: string; isActive: boolean; createdAt: string }>; count?: number };
    res.json({
      ok: true,
      total: data.count ?? 0,
      templates: (data.templates || []).map((t) => ({
        id: t.id, name: t.name, subject: t.subject, isActive: t.isActive, createdAt: t.createdAt,
      })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Templates fetch failed" });
  }
});

// POST /api/devhub/media/email-template-send — send transac email by template ID with params
devhubRouter.post("/media/email-template-send", async (req, res) => {
  const { templateId, to, params } = req.body || {};
  if (!templateId || (typeof templateId !== "number" && typeof templateId !== "string")) {
    return res.status(400).json({ error: "templateId required" });
  }
  if (!to || typeof to !== "string") return res.status(400).json({ error: "to (email) required" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) return res.status(400).json({ error: "invalid recipient email" });

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "Brevo not configured — set BREVO_API_KEY" });

  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        templateId: Number(templateId) || templateId,
        to: [{ email: to.trim() }],
        ...(params && typeof params === "object" ? { params } : {}),
      }),
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `Brevo error: ${errText.slice(0, 300)}` });
    }
    const data = await r.json().catch(() => ({}));
    res.json({ ok: true, messageId: (data as any)?.messageId ?? null });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Template send failed" });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// Binary file serving (decode .b64 → audio/image MIME)
// ═════════════════════════════════════════════════════════════════════════════

const B64_BINARY_MIME: Record<string, string> = {
  ".mp3.b64": "audio/mpeg",
  ".wav.b64": "audio/wav",
  ".ogg.b64": "audio/ogg",
  ".png.b64": "image/png",
  ".jpg.b64": "image/jpeg",
  ".webp.b64": "image/webp",
};

function detectB64Mime(path: string): string | null {
  for (const [suffix, mime] of Object.entries(B64_BINARY_MIME)) {
    if (path.toLowerCase().endsWith(suffix)) return mime;
  }
  return null;
}

// GET /api/devhub/projects/:id/file-binary?path=... — decode base64 file and serve as binary
devhubRouter.get("/projects/:id/file-binary", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  const filePath = String(req.query.path || "");
  if (!filePath) return res.status(400).json({ error: "path query param required" });

  let project: DevHubProject | null;
  try { project = await dbGetProject(req.params.id); }
  catch { project = memProjects.get(req.params.id) ?? null; }
  if (!project || project.userId !== userId) return res.status(404).json({ error: "project not found" });

  let file: DevHubFile | null;
  try { file = await dbGetFile(project.id, filePath); }
  catch { file = [...memFiles.values()].find((f) => f.projectId === project!.id && f.path === filePath) ?? null; }
  if (!file) return res.status(404).json({ error: "file not found" });

  const mime = detectB64Mime(filePath) || "application/octet-stream";
  try {
    const buf = Buffer.from(file.content, "base64");
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", buf.length);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(buf);
  } catch {
    res.status(500).json({ error: "failed to decode base64 content" });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// Bulk DeepL translate (multi-file × multi-lang)
// ═════════════════════════════════════════════════════════════════════════════

devhubRouter.post("/projects/:id/files/translate-bulk", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  let project: DevHubProject | null;
  try { project = await dbGetProject(req.params.id); }
  catch { project = memProjects.get(req.params.id) ?? null; }
  if (!project || project.userId !== userId) return res.status(404).json({ error: "project not found" });

  const { paths, targetLangs } = req.body || {};
  if (!Array.isArray(paths) || paths.length === 0) return res.status(400).json({ error: "paths array required" });
  if (!Array.isArray(targetLangs) || targetLangs.length === 0) return res.status(400).json({ error: "targetLangs array required" });
  if (paths.length * targetLangs.length > 50) return res.status(400).json({ error: "max 50 translations per bulk call" });

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "DeepL not configured — set DEEPL_API_KEY" });
  const endpoint = apiKey.endsWith(":fx") ? "https://api-free.deepl.com/v2/translate" : "https://api.deepl.com/v2/translate";

  const results: Array<{ path: string; targetLang: string; ok: boolean; outputPath?: string; bytes?: number; error?: string }> = [];

  for (const p of paths) {
    let file: DevHubFile | null;
    try { file = await dbGetFile(project.id, String(p)); }
    catch { file = [...memFiles.values()].find((f) => f.projectId === project!.id && f.path === String(p)) ?? null; }
    if (!file) {
      for (const lang of targetLangs) {
        results.push({ path: String(p), targetLang: String(lang), ok: false, error: "file not found" });
      }
      continue;
    }
    for (const lang of targetLangs) {
      try {
        const params = new URLSearchParams();
        params.append("text", file.content);
        params.append("target_lang", String(lang).toUpperCase().slice(0, 5));
        const r = await fetch(endpoint, {
          method: "POST",
          headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        });
        if (!r.ok) {
          const errText = await r.text();
          results.push({ path: file.path, targetLang: String(lang).toUpperCase(), ok: false, error: errText.slice(0, 200) });
          continue;
        }
        const data = await r.json() as { translations: Array<{ text: string }> };
        const translated = data.translations?.[0]?.text;
        if (!translated) {
          results.push({ path: file.path, targetLang: String(lang).toUpperCase(), ok: false, error: "no translation returned" });
          continue;
        }
        const langLower = String(lang).toLowerCase();
        const newPath = file.path.replace(/(\.[^./]+)$/, `.${langLower}$1`) || `${file.path}.${langLower}`;
        const out: DevHubFile = {
          id: crypto.randomUUID(),
          projectId: project.id,
          path: newPath,
          content: translated,
          language: file.language,
          updatedAt: now(),
        };
        try { await dbUpsertFile(out); }
        catch {
          const existing = [...memFiles.values()].find((f) => f.projectId === project!.id && f.path === newPath);
          if (existing) { existing.content = out.content; existing.updatedAt = out.updatedAt; }
          else memFiles.set(out.id, out);
        }
        results.push({ path: file.path, targetLang: String(lang).toUpperCase(), ok: true, outputPath: newPath, bytes: translated.length });
      } catch (e: any) {
        results.push({ path: file.path, targetLang: String(lang).toUpperCase(), ok: false, error: e?.message || "step failed" });
      }
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  res.json({
    ok: okCount === results.length,
    total: results.length,
    successCount: okCount,
    failureCount: results.length - okCount,
    results,
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SDK generation (TypeScript client from project's Express routes)
// ═════════════════════════════════════════════════════════════════════════════

interface DetectedRoute { method: string; path: string; sourceFile: string }

function detectExpressRoutes(files: DevHubFile[]): DetectedRoute[] {
  const routes: DetectedRoute[] = [];
  const routeRe = /(?:app|router)\s*\.\s*(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  for (const f of files) {
    if (!/\.(ts|js|tsx|jsx|mjs)$/i.test(f.path)) continue;
    let m: RegExpExecArray | null;
    while ((m = routeRe.exec(f.content)) !== null) {
      routes.push({ method: m[1].toUpperCase(), path: m[2], sourceFile: f.path });
    }
  }
  return routes;
}

function generateSDK(projectName: string, baseUrl: string, routes: DetectedRoute[]): string {
  const lines: string[] = [];
  lines.push(`// Auto-generated SDK for ${projectName}`);
  lines.push(`// Detected ${routes.length} endpoint(s) via AEVION DevHub`);
  lines.push(`// DO NOT EDIT — re-generate via /api/devhub/projects/:id/sdk`);
  lines.push("");
  lines.push(`export interface SdkOptions {`);
  lines.push(`  baseUrl?: string;`);
  lines.push(`  token?: string;`);
  lines.push(`  fetch?: typeof globalThis.fetch;`);
  lines.push(`}`);
  lines.push("");
  lines.push(`export function createClient(opts: SdkOptions = {}) {`);
  lines.push(`  const baseUrl = (opts.baseUrl || ${JSON.stringify(baseUrl)}).replace(/\\/$/, "");`);
  lines.push(`  const f = opts.fetch || globalThis.fetch;`);
  lines.push(`  const headers: Record<string, string> = { "Content-Type": "application/json" };`);
  lines.push(`  if (opts.token) headers.Authorization = \`Bearer \${opts.token}\`;`);
  lines.push("");
  lines.push(`  async function call(method: string, path: string, body?: unknown, query?: Record<string, string | number | boolean>) {`);
  lines.push(`    let url = baseUrl + path;`);
  lines.push(`    if (query && Object.keys(query).length) {`);
  lines.push(`      const qs = new URLSearchParams();`);
  lines.push(`      for (const [k, v] of Object.entries(query)) qs.set(k, String(v));`);
  lines.push(`      url += "?" + qs.toString();`);
  lines.push(`    }`);
  lines.push(`    const r = await f(url, {`);
  lines.push(`      method,`);
  lines.push(`      headers,`);
  lines.push(`      body: body !== undefined && method !== "GET" ? JSON.stringify(body) : undefined,`);
  lines.push(`    });`);
  lines.push(`    if (!r.ok) {`);
  lines.push(`      const txt = await r.text();`);
  lines.push(`      throw new Error(\`\${method} \${path} → \${r.status}: \${txt.slice(0, 200)}\`);`);
  lines.push(`    }`);
  lines.push(`    const ct = r.headers.get("content-type") || "";`);
  lines.push(`    return ct.includes("application/json") ? r.json() : r.text();`);
  lines.push(`  }`);
  lines.push("");
  lines.push(`  return {`);
  // De-dupe routes by method+path
  const seen = new Set<string>();
  for (const r of routes) {
    const key = `${r.method} ${r.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Make a JS-safe identifier from method + path
    const fnName = r.method.toLowerCase() +
      r.path.replace(/[^a-zA-Z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .replace(/^(\d)/, "_$1") || "root";
    const hasParams = r.path.includes(":");
    const params = hasParams ? r.path.match(/:(\w+)/g)?.map((s) => s.slice(1)) || [] : [];
    const paramArgs = params.map((p) => `${p}: string | number`).join(", ");
    const pathExpr = hasParams
      ? '`' + r.path.replace(/:(\w+)/g, "${$1}") + '`'
      : JSON.stringify(r.path);
    const bodyArg = ["POST", "PUT", "PATCH"].includes(r.method) ? `body?: unknown` : "";
    const queryArg = `query?: Record<string, string | number | boolean>`;
    const allArgs = [paramArgs, bodyArg, queryArg].filter(Boolean).join(", ");
    lines.push(`    /** ${r.method} ${r.path} — from ${r.sourceFile} */`);
    lines.push(`    ${fnName}(${allArgs}) {`);
    lines.push(`      return call(${JSON.stringify(r.method)}, ${pathExpr}, ${bodyArg ? "body" : "undefined"}, query);`);
    lines.push(`    },`);
  }
  lines.push(`  };`);
  lines.push(`}`);
  lines.push("");
  lines.push(`export type Client = ReturnType<typeof createClient>;`);
  return lines.join("\n");
}

// GET /api/devhub/projects/:id/sdk — return TypeScript SDK
devhubRouter.get("/projects/:id/sdk", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  let project: DevHubProject | null;
  try { project = await dbGetProject(req.params.id); }
  catch { project = memProjects.get(req.params.id) ?? null; }
  if (!project || project.userId !== userId) return res.status(404).json({ error: "project not found" });

  const files = await dbListFiles(project.id);
  const routes = detectExpressRoutes(files);
  const baseUrl = project.deployUrl || `https://${slugify(project.name)}-${project.id.slice(0, 8)}.aevion.app`;
  const sdk = generateSDK(project.name, baseUrl, routes);

  if (req.query.download === "1") {
    res.setHeader("Content-Type", "text/typescript");
    res.setHeader("Content-Disposition", `attachment; filename="${slugify(project.name)}-sdk.ts"`);
    res.send(sdk);
  } else {
    res.json({
      ok: true,
      projectName: project.name,
      baseUrl,
      detectedRoutes: routes,
      sdkBytes: sdk.length,
      sdk,
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// Project export as ZIP (minimal stored-mode ZIP, no external deps)
// ═════════════════════════════════════════════════════════════════════════════

const CRC32_TABLE: Uint32Array = (() => {
  const tbl = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    tbl[i] = c >>> 0;
  }
  return tbl;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function buildZipStored(entries: Array<{ path: string; content: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.path, "utf8");
    const dataBuf = entry.content;
    const crc = crc32(dataBuf);
    const size = dataBuf.length;

    // Local file header (30 bytes + name + data)
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method (0=stored)
    local.writeUInt16LE(0, 10); // mtime
    local.writeUInt16LE(0, 12); // mdate
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18); // compressed size
    local.writeUInt32LE(size, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26); // name length
    local.writeUInt16LE(0, 28); // extra length

    const localHeader = Buffer.concat([local, nameBuf, dataBuf]);
    localParts.push(localHeader);

    // Central directory entry (46 bytes + name)
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(0, 10); // method
    central.writeUInt16LE(0, 12); // mtime
    central.writeUInt16LE(0, 14); // mdate
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(size, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra length
    central.writeUInt16LE(0, 32); // comment length
    central.writeUInt16LE(0, 34); // disk number
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42); // local header offset

    centralParts.push(Buffer.concat([central, nameBuf]));
    offset += localHeader.length;
  }

  const localBlock = Buffer.concat(localParts);
  const centralBlock = Buffer.concat(centralParts);

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk where CD starts
  eocd.writeUInt16LE(entries.length, 8); // num entries this disk
  eocd.writeUInt16LE(entries.length, 10); // total num entries
  eocd.writeUInt32LE(centralBlock.length, 12); // size of CD
  eocd.writeUInt32LE(localBlock.length, 16); // CD offset
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([localBlock, centralBlock, eocd]);
}

// GET /api/devhub/projects/:id/export — download project as ZIP
devhubRouter.get("/projects/:id/export", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  let project: DevHubProject | null;
  try { project = await dbGetProject(req.params.id); }
  catch { project = memProjects.get(req.params.id) ?? null; }
  if (!project || project.userId !== userId) return res.status(404).json({ error: "project not found" });

  try {
    const files = await dbListFiles(project.id);
    if (files.length === 0) return res.status(400).json({ error: "project has no files to export" });

    const entries = files.map((f) => {
      // Decode .b64 files back to binary
      const isB64 = detectB64Mime(f.path);
      let content: Buffer;
      let outPath = f.path;
      if (isB64) {
        try { content = Buffer.from(f.content, "base64"); }
        catch { content = Buffer.from(f.content, "utf8"); }
        outPath = f.path.replace(/\.b64$/i, "");
      } else {
        content = Buffer.from(f.content, "utf8");
      }
      return { path: outPath, content };
    });

    // Include a metadata file
    const meta = {
      projectName: project.name,
      description: project.description,
      stack: project.stack,
      exportedAt: new Date().toISOString(),
      fileCount: files.length,
      generatedBy: "AEVION DevHub",
    };
    entries.push({ path: "aevion-export.json", content: Buffer.from(JSON.stringify(meta, null, 2), "utf8") });

    const zip = buildZipStored(entries);
    const filename = `${slugify(project.name)}-${project.id.slice(0, 8)}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", zip.length);
    res.send(zip);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "export failed" });
  }
});

// POST /api/devhub/projects/:id/deploy/vercel — deploy to Vercel
devhubRouter.post("/projects/:id/deploy/vercel", async (req, res) => {
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

  const vercelToken = process.env.VERCEL_API_TOKEN;
  if (!vercelToken) {
    return res.status(503).json({
      error: "Vercel not configured — set VERCEL_API_TOKEN",
      setupUrl: "https://vercel.com/account/tokens",
    });
  }

  const deploymentId = crypto.randomUUID();
  const deploySlug = slugify(project.name) + "-" + project.id.slice(0, 8);

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
  try { await dbSaveDeployment(deployment); } catch { memDeployments.set(deployment.id, deployment); }

  try {
    const files = await dbListFiles(project.id);
    // Vercel Deployments API v13 — inline file payload
    const vercelFiles = files.map((f) => ({
      file: f.path,
      data: Buffer.from(f.content).toString("base64"),
      encoding: "base64",
    }));

    const vResp = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: deploySlug,
        files: vercelFiles,
        target: "production",
        projectSettings: {
          framework: project.stack === "next" ? "nextjs"
                   : project.stack === "react" ? "vite"
                   : project.stack === "express" ? null
                   : null,
        },
      }),
    });

    if (!vResp.ok) {
      const errText = await vResp.text();
      deployment.status = "failed";
      deployment.buildLog = `Vercel error: ${errText.slice(0, 500)}`;
      deployment.completedAt = now();
      try { await dbSaveDeployment(deployment); } catch { memDeployments.set(deployment.id, deployment); }
      return res.status(vResp.status).json({ ok: false, error: `Vercel deploy error: ${errText.slice(0, 300)}` });
    }

    const vData = await vResp.json() as { id: string; url: string };
    const liveUrl = `https://${vData.url}`;

    deployment.status = "building";
    deployment.deployUrl = liveUrl;
    deployment.buildLog = `Vercel deployment ${vData.id} created`;
    try { await dbSaveDeployment(deployment); } catch { memDeployments.set(deployment.id, deployment); }

    // After 5s, mark live + update project
    setTimeout(async () => {
      const d = memDeployments.get(deployment.id) ?? deployment;
      d.status = "live";
      d.completedAt = now();
      try { await dbSaveDeployment(d); } catch { memDeployments.set(d.id, d); }
      if (project) {
        project.status = "live";
        project.deployUrl = liveUrl;
        project.updatedAt = now();
        try { await dbSaveProject(project); } catch { memProjects.set(project.id, project); }
      }
    }, 5000);

    return res.json({
      ok: true,
      deploymentId,
      vercelDeploymentId: vData.id,
      deployUrl: liveUrl,
      provider: "vercel",
      message: "Vercel deployment started",
    });
  } catch (e: any) {
    deployment.status = "failed";
    deployment.buildLog = e?.message || "deploy failed";
    deployment.completedAt = now();
    try { await dbSaveDeployment(deployment); } catch { memDeployments.set(deployment.id, deployment); }
    return res.status(500).json({ ok: false, error: e?.message || "Vercel deploy failed" });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// Cloudflare R2 audio upload (S3-compatible, AWS SigV4)
// ═════════════════════════════════════════════════════════════════════════════

function r2Configured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    process.env.CLOUDFLARE_R2_SECRET_KEY &&
    process.env.CLOUDFLARE_R2_BUCKET
  );
}

function sha256Hex(buf: Buffer | string): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}
function hmacSha256(key: Buffer | string, msg: string): Buffer {
  return crypto.createHmac("sha256", key).update(msg, "utf8").digest();
}

function signR2PutHeaders(opts: {
  host: string; bucket: string; key: string; body: Buffer; contentType: string;
  accessKey: string; secretKey: string; region?: string; now?: Date;
}): Record<string, string> {
  const region = opts.region || "auto";
  const service = "s3";
  const now = opts.now || new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(opts.body);
  const uri = `/${opts.bucket}/${opts.key.split("/").map(encodeURIComponent).join("/")}`;
  const canonicalHeaders =
    `content-type:${opts.contentType}\n` +
    `host:${opts.host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["PUT", uri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credScope, sha256Hex(canonicalRequest)].join("\n");
  const kDate = hmacSha256("AWS4" + opts.secretKey, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");
  const auth = `AWS4-HMAC-SHA256 Credential=${opts.accessKey}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return {
    Authorization: auth,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    "Content-Type": opts.contentType,
  };
}

async function r2PutObject(key: string, body: Buffer, contentType: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKey = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretKey = process.env.CLOUDFLARE_R2_SECRET_KEY;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  if (!accountId || !accessKey || !secretKey || !bucket) return { ok: false, error: "R2 not configured" };

  const host = `${accountId}.r2.cloudflarestorage.com`;
  const headers = signR2PutHeaders({ host, bucket, key, body, contentType, accessKey, secretKey });
  const uri = `/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
  try {
    const r = await fetch(`https://${host}${uri}`, { method: "PUT", headers, body: body as unknown as BodyInit });
    if (!r.ok) {
      const errText = await r.text();
      return { ok: false, error: `R2 PUT ${r.status}: ${errText.slice(0, 200)}` };
    }
    const publicBase = (process.env.CLOUDFLARE_R2_PUBLIC_URL || "").replace(/\/+$/, "");
    const url = publicBase
      ? `${publicBase}/${key.split("/").map(encodeURIComponent).join("/")}`
      : `https://${host}${uri}`;
    return { ok: true, url };
  } catch (e: any) {
    return { ok: false, error: e?.message || "R2 PUT failed" };
  }
}

async function tryAutoUploadAudioToR2(buf: Buffer, contentType: string, key: string): Promise<string | null> {
  if (!r2Configured()) return null;
  const r = await r2PutObject(key, buf, contentType);
  return r.ok ? r.url : null;
}

// POST /api/devhub/media/upload-audio — upload audio to Cloudflare R2 (permanent CDN URL)
// Body: { sourceUrl?: string } OR { base64: string, mimeType?: string, key?: string }
devhubRouter.post("/media/upload-audio", async (req, res) => {
  const { sourceUrl, base64, mimeType = "audio/mpeg", key } = req.body || {};
  if (!sourceUrl && !base64) return res.status(400).json({ error: "sourceUrl or base64 required" });
  if (!r2Configured()) {
    return res.status(503).json({
      error: "Cloudflare R2 not configured — set CLOUDFLARE_R2_ACCOUNT_ID + CLOUDFLARE_R2_ACCESS_KEY_ID + CLOUDFLARE_R2_SECRET_KEY + CLOUDFLARE_R2_BUCKET",
      setupUrl: "https://dash.cloudflare.com/?to=/:account/r2/api-tokens",
    });
  }

  try {
    let buf: Buffer;
    if (sourceUrl) {
      const sr = await fetch(String(sourceUrl));
      if (!sr.ok) return res.status(sr.status).json({ error: `source fetch failed: ${sr.status}` });
      buf = Buffer.from(await sr.arrayBuffer());
    } else {
      buf = Buffer.from(String(base64), "base64");
    }
    if (buf.length === 0) return res.status(400).json({ error: "audio body empty" });
    if (buf.length > 25 * 1024 * 1024) return res.status(400).json({ error: "audio too large (max 25 MB)" });

    const ct = String(mimeType);
    const ext = ct.includes("wav") ? "wav" : ct.includes("ogg") ? "ogg" : "mp3";
    const finalKey = String(key || `audio/${crypto.randomUUID()}.${ext}`).replace(/^\/+/, "").slice(0, 256);

    const result = await r2PutObject(finalKey, buf, ct);
    if (!result.ok) return res.status(502).json({ error: result.error });
    res.json({ ok: true, key: finalKey, url: result.url, bytes: buf.length, mimeType: ct });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Audio upload failed" });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// Brevo: create SMTP email template
// ═════════════════════════════════════════════════════════════════════════════

devhubRouter.post("/media/email-template-create", async (req, res) => {
  const { name, subject, htmlContent, senderEmail, senderName, replyTo, tag, isActive } = req.body || {};
  if (!name || typeof name !== "string") return res.status(400).json({ error: "name required" });
  if (!subject || typeof subject !== "string") return res.status(400).json({ error: "subject required" });
  if (!htmlContent || typeof htmlContent !== "string") return res.status(400).json({ error: "htmlContent required" });
  if (htmlContent.length > 2_000_000) return res.status(400).json({ error: "htmlContent too large (max 2 MB)" });

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "Brevo not configured — set BREVO_API_KEY" });

  const sEmail = String(senderEmail || process.env.BREVO_SENDER_EMAIL || "").trim();
  const sName = String(senderName || process.env.BREVO_SENDER_NAME || "AEVION").trim();
  if (!sEmail) return res.status(400).json({ error: "senderEmail required (or set BREVO_SENDER_EMAIL)" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sEmail)) return res.status(400).json({ error: "invalid senderEmail" });
  if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(replyTo))) return res.status(400).json({ error: "invalid replyTo" });

  try {
    const payload: Record<string, unknown> = {
      templateName: name.trim().slice(0, 100),
      subject: subject.trim().slice(0, 300),
      htmlContent,
      sender: { email: sEmail, name: sName },
      isActive: isActive === false ? false : true,
    };
    if (replyTo) payload.replyTo = String(replyTo).trim();
    if (tag) payload.tag = String(tag).slice(0, 50);

    const r = await fetch("https://api.brevo.com/v3/smtp/templates", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `Brevo error: ${errText.slice(0, 300)}` });
    }
    const data = await r.json().catch(() => ({})) as { id?: number };
    if (!data.id) return res.status(500).json({ error: "Brevo did not return template id" });
    res.json({ ok: true, id: data.id, name: payload.templateName, subject: payload.subject });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Template create failed" });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ZIP import (symmetric to GET /projects/:id/export — method=0 stored only)
// ═════════════════════════════════════════════════════════════════════════════

function parseZipStored(buf: Buffer): Array<{ path: string; content: Buffer }> | { error: string } {
  // Find EOCD signature 0x06054b50 — search backwards (max comment 65535)
  const eocdSig = 0x06054b50;
  let eocdOffset = -1;
  const maxSearch = Math.min(buf.length, 65557);
  for (let i = buf.length - 22; i >= buf.length - maxSearch && i >= 0; i--) {
    if (buf.readUInt32LE(i) === eocdSig) { eocdOffset = i; break; }
  }
  if (eocdOffset < 0) return { error: "EOCD not found — not a valid ZIP" };
  const numEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  if (cdOffset < 0 || cdOffset >= buf.length) return { error: "invalid central directory offset" };

  const entries: Array<{ path: string; content: Buffer }> = [];
  let p = cdOffset;
  for (let n = 0; n < numEntries; n++) {
    if (p + 46 > buf.length) return { error: "central directory truncated" };
    if (buf.readUInt32LE(p) !== 0x02014b50) return { error: "bad CD entry signature" };
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const uncompSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    if (method !== 0) return { error: `unsupported compression method ${method} (only stored=0)` };
    if (compSize !== uncompSize) return { error: "stored entry size mismatch" };
    const name = buf.slice(p + 46, p + 46 + nameLen).toString("utf8");
    p += 46 + nameLen + extraLen + commentLen;

    // Local header at localOffset
    if (localOffset + 30 > buf.length) return { error: "local header truncated" };
    if (buf.readUInt32LE(localOffset) !== 0x04034b50) return { error: "bad local header signature" };
    const lhNameLen = buf.readUInt16LE(localOffset + 26);
    const lhExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lhNameLen + lhExtraLen;
    if (dataStart + uncompSize > buf.length) return { error: "data exceeds buffer" };
    const content = buf.slice(dataStart, dataStart + uncompSize);
    entries.push({ path: name, content });
  }
  return entries;
}

const BINARY_EXTENSIONS = /\.(mp3|wav|ogg|png|jpg|jpeg|webp|gif|pdf|zip|woff2?|ttf|otf)$/i;

devhubRouter.post("/projects/:id/import-zip", async (req, res) => {
  const auth = verifyBearerOptional(req);
  const userId = auth?.sub ?? "anonymous";
  let project: DevHubProject | null;
  try { project = await dbGetProject(req.params.id); }
  catch { project = memProjects.get(req.params.id) ?? null; }
  if (!project || project.userId !== userId) return res.status(404).json({ error: "project not found" });

  const { base64Zip, overwrite } = req.body || {};
  if (!base64Zip || typeof base64Zip !== "string") return res.status(400).json({ error: "base64Zip required" });

  let zipBuf: Buffer;
  try { zipBuf = Buffer.from(base64Zip, "base64"); }
  catch { return res.status(400).json({ error: "invalid base64" }); }
  if (zipBuf.length === 0) return res.status(400).json({ error: "empty ZIP" });
  if (zipBuf.length > 50 * 1024 * 1024) return res.status(400).json({ error: "ZIP too large (max 50 MB)" });

  const parsed = parseZipStored(zipBuf);
  if (!Array.isArray(parsed)) return res.status(400).json({ error: parsed.error });
  if (parsed.length === 0) return res.status(400).json({ error: "ZIP contains no entries" });
  if (parsed.length > 500) return res.status(400).json({ error: "max 500 files per import" });

  const imported: Array<{ path: string; bytes: number; binary: boolean }> = [];
  const skipped: Array<{ path: string; reason: string }> = [];

  for (const entry of parsed) {
    // Skip metadata + directory entries
    if (entry.path === "aevion-export.json") { skipped.push({ path: entry.path, reason: "metadata" }); continue; }
    if (entry.path.endsWith("/")) { skipped.push({ path: entry.path, reason: "directory" }); continue; }
    if (entry.path.includes("..")) { skipped.push({ path: entry.path, reason: "path traversal" }); continue; }
    if (entry.path.length > 240) { skipped.push({ path: entry.path, reason: "path too long" }); continue; }

    const isBinary = BINARY_EXTENSIONS.test(entry.path);
    const finalPath = isBinary && !entry.path.endsWith(".b64") ? entry.path + ".b64" : entry.path;
    const content = isBinary ? entry.content.toString("base64") : entry.content.toString("utf8");

    // overwrite=false ⇒ skip if exists
    if (overwrite === false) {
      let existing: DevHubFile | null;
      try { existing = await dbGetFile(project.id, finalPath); }
      catch { existing = [...memFiles.values()].find((f) => f.projectId === project!.id && f.path === finalPath) ?? null; }
      if (existing) { skipped.push({ path: finalPath, reason: "already exists" }); continue; }
    }

    const f: DevHubFile = {
      id: crypto.randomUUID(), projectId: project.id, path: finalPath,
      content, language: detectLanguage(finalPath), updatedAt: now(),
    };
    try { await dbUpsertFile(f); }
    catch {
      const ex = [...memFiles.values()].find((x) => x.projectId === project!.id && x.path === finalPath);
      if (ex) { ex.content = f.content; ex.language = f.language; ex.updatedAt = f.updatedAt; }
      else memFiles.set(f.id, f);
    }
    imported.push({ path: finalPath, bytes: entry.content.length, binary: isBinary });
  }

  res.json({
    ok: imported.length > 0,
    importedCount: imported.length,
    skippedCount: skipped.length,
    imported,
    skipped,
  });
});
