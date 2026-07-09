"use strict";
/**
 * Process orchestration for the AEVION Council desktop app.
 *
 * Owns the three child processes that make the offline Council work and the
 * health-probing/teardown around them:
 *
 *   1. Ollama   — local model runtime (started if installed & not already up).
 *   2. Backend  — the Express API (dist/index.js) on 127.0.0.1:BACKEND_PORT,
 *                 run with no DATABASE_URL so it uses its in-memory store, and
 *                 with OLLAMA_BASE_URL set so the offline council has a crowd.
 *   3. Frontend — the Next.js server on 127.0.0.1:FRONTEND_PORT, proxying
 *                 /api-backend/* to the backend.
 *
 * In a packaged build the backend + frontend live under process.resourcesPath;
 * in `npm start` (dev) they resolve to the sibling repo folders. Nothing here
 * is Electron-specific, so it can be unit-smoked with plain Node.
 */

const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");

const BACKEND_PORT = Number(process.env.AEVION_BACKEND_PORT || 4001);
const FRONTEND_PORT = Number(process.env.AEVION_FRONTEND_PORT || 3000);
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.AEVION_OLLAMA_MODEL || "llama3.2";

/** Resolve where the bundled backend/frontend live (packaged vs dev checkout). */
function resolvePaths() {
  const packagedBackend = path.join(process.resourcesPath || "", "backend");
  const packagedFrontend = path.join(process.resourcesPath || "", "frontend");
  if (fs.existsSync(packagedBackend) && fs.existsSync(packagedFrontend)) {
    return { backend: packagedBackend, frontend: packagedFrontend, packaged: true };
  }
  // Dev: this file is desktop/lib/orchestrator.js → repo root is two levels up.
  const repo = path.resolve(__dirname, "..", "..");
  return {
    backend: path.join(repo, "aevion-globus-backend"),
    frontend: path.join(repo, "frontend"),
    packaged: false,
  };
}

/** GET a URL, resolve true on any HTTP response, false on network error. */
function probe(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(true);
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(false); });
    req.on("error", () => resolve(false));
  });
}

/** Poll `url` until it answers or `timeoutMs` elapses. */
async function waitFor(url, { timeoutMs = 60000, intervalMs = 800, signal } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) return false;
    if (await probe(url)) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

function nodeBin() {
  // In a packaged Electron app, ELECTRON_RUN_AS_NODE lets us reuse the bundled
  // node runtime (process.execPath). In dev, plain "node" from PATH is fine.
  return process.execPath;
}

/** Spawn a Node script with the Electron binary acting as a plain Node. */
function spawnNode(scriptPath, { cwd, env, label, onLog, args = [] }) {
  const child = spawn(nodeBin(), [scriptPath, ...args], {
    cwd,
    env: { ...process.env, ...env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const tag = (buf) => onLog?.(`[${label}] ${buf.toString().trimEnd()}`);
  child.stdout.on("data", tag);
  child.stderr.on("data", tag);
  return child;
}

class Orchestrator {
  constructor({ onLog } = {}) {
    this.onLog = onLog || (() => {});
    this.children = [];
    this.paths = resolvePaths();
    this.ollamaOwned = false;
  }

  log(msg) { this.onLog(msg); }

  /** Start Ollama if it isn't already reachable and the CLI is installed. */
  async ensureOllama() {
    if (await probe(`${OLLAMA_HOST}/api/tags`)) {
      this.log("[ollama] already running");
      return true;
    }
    this.log("[ollama] not running — attempting to start `ollama serve`");
    try {
      const child = spawn("ollama", ["serve"], { detached: false, stdio: "ignore" });
      child.on("error", () => this.log("[ollama] CLI not found — install from https://ollama.com"));
      this.ollamaOwned = true;
      this.children.push(child);
    } catch {
      this.log("[ollama] could not spawn — is Ollama installed?");
      return false;
    }
    const up = await waitFor(`${OLLAMA_HOST}/api/tags`, { timeoutMs: 15000 });
    this.log(up ? "[ollama] up" : "[ollama] did not come up in time");
    return up;
  }

  /** Start the Express backend in offline / in-memory mode. */
  startBackend() {
    const entry = path.join(this.paths.backend, "dist", "index.js");
    if (!fs.existsSync(entry)) {
      throw new Error(`backend build missing: ${entry} (run the backend build / stage step first)`);
    }
    const env = {
      PORT: String(BACKEND_PORT),
      NODE_ENV: "production",
      OLLAMA_BASE_URL: `${OLLAMA_HOST}/v1`,
      OLLAMA_MODEL,
      // No DATABASE_URL → the qcoreai store uses its in-memory fallback.
      DATABASE_URL: "",
    };
    this.log(`[backend] starting on :${BACKEND_PORT} (in-memory, ollama=${OLLAMA_MODEL})`);
    this.children.push(spawnNode(entry, { cwd: this.paths.backend, env, label: "backend", onLog: this.onLog }));
  }

  /** Start the Next.js frontend server, proxying to the local backend. */
  startFrontend() {
    // Prefer a standalone server if present (smaller, self-contained); else the
    // installed next CLI. Standalone is produced by `output: "standalone"`.
    const standalone = path.join(this.paths.frontend, ".next", "standalone", "server.js");
    const env = {
      PORT: String(FRONTEND_PORT),
      NODE_ENV: "production",
      BACKEND_PROXY_TARGET: `http://127.0.0.1:${BACKEND_PORT}`,
      HOSTNAME: "127.0.0.1",
    };
    if (fs.existsSync(standalone)) {
      this.log(`[frontend] starting standalone server on :${FRONTEND_PORT}`);
      this.children.push(spawnNode(standalone, { cwd: this.paths.frontend, env, label: "frontend", onLog: this.onLog }));
      return;
    }
    const nextCli = path.join(this.paths.frontend, "node_modules", "next", "dist", "bin", "next");
    if (!fs.existsSync(nextCli)) {
      throw new Error("frontend not built: no .next/standalone/server.js and no node_modules/next");
    }
    this.log(`[frontend] starting "next start" on :${FRONTEND_PORT}`);
    this.children.push(spawnNode(nextCli, {
      cwd: this.paths.frontend,
      env,
      label: "frontend",
      onLog: this.onLog,
      args: ["start", "-p", String(FRONTEND_PORT), "-H", "127.0.0.1"],
    }));
  }

  /** Full bring-up. Returns the URL to load once the frontend is ready. */
  async start() {
    await this.ensureOllama();
    this.startBackend();
    const backendUp = await waitFor(`http://127.0.0.1:${BACKEND_PORT}/health`, { timeoutMs: 30000 });
    this.log(backendUp ? "[backend] healthy" : "[backend] health timeout (continuing)");
    this.startFrontend();
    const frontendUp = await waitFor(`http://127.0.0.1:${FRONTEND_PORT}`, { timeoutMs: 60000 });
    if (!frontendUp) throw new Error("frontend did not become ready");
    return `http://127.0.0.1:${FRONTEND_PORT}/qcoreai/multi`;
  }

  /** Kill every child we started. */
  stop() {
    for (const c of this.children) {
      try { c.kill(); } catch { /* already gone */ }
    }
    this.children = [];
  }
}

module.exports = { Orchestrator, resolvePaths, probe, waitFor, BACKEND_PORT, FRONTEND_PORT };
