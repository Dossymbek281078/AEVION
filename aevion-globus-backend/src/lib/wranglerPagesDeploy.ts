import { spawn } from "child_process";
import { mkdtemp, writeFile, mkdir, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

/**
 * Cloudflare Pages deploy through wrangler — the only upload path CF still
 * supports. The raw REST multipart flow silently stopped storing assets
 * (deploy reports success, every page serves 500); discovered live
 * 2026-07-21 after months of "successful" deploys nobody could open.
 *
 * Project files are materialized into a temp dir and handed to
 * `wrangler pages deploy`; wrangler does the upload-token / missing-assets
 * negotiation that the raw API no longer honors.
 */

export type WranglerDeployResult =
  | { ok: true; url: string; output: string; skipped: string[] }
  | { ok: false; error: string; output: string; skipped: string[] };

const WRANGLER_TIMEOUT_MS = 180_000;

export async function deployViaWrangler(
  files: Array<{ path: string; content: string }>,
  projectName: string,
  opts: { accountId: string; apiToken: string; branch?: string }
): Promise<WranglerDeployResult> {
  /** Пути, отброшенные как попытка выйти за пределы папки сборки. */
  const skipped: string[] = [];
  const dir = await mkdtemp(path.join(tmpdir(), "devhub-pages-"));
  try {
    for (const f of files) {
      const safe = f.path.replace(/^\/+/, "");
      // The IDE stores repo-relative paths; anything trying to escape the
      // temp dir is dropped rather than written outside it.
      // Отбрасывать — верно, а делать это МОЛЧА было нельзя: файл исчезал из
      // выкатки, сборка отчитывалась успехом, и на сайте не хватало страницы
      // без единого следа. Решение не изменилось, изменилась видимость.
      if (safe.split(/[\\/]/).includes("..")) {
        skipped.push(f.path);
        continue;
      }
      const full = path.join(dir, safe);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, f.content, "utf8");
    }
    const output = await runWrangler(
      ["pages", "deploy", dir, `--project-name=${projectName}`, `--branch=${opts.branch ?? "main"}`, "--commit-dirty=true"],
      opts
    );
    const m = output.match(/https:\/\/[\w.-]+\.pages\.dev/);
    if (m) return { ok: true, url: m[0], output, skipped };
    return { ok: false, error: "wrangler finished without printing a deployment URL", output, skipped };
  } catch (e: any) {
    return { ok: false, error: e?.message || "wrangler deploy failed", output: String(e?.wranglerOutput || ""), skipped };
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Fire-and-forget first-run warm-up: npx resolution + wrangler's own init
 * cost seconds on a fresh pod — pay them at boot, not inside a user's deploy.
 * Never throws; failure just means the first deploy pays the cost instead. */
export function warmWrangler(): void {
  try {
    const child = spawn("npx", ["wrangler", "--version"], {
      env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" },
      shell: process.platform === "win32",
      stdio: "ignore",
    });
    child.on("error", () => { /* warm-up is best-effort */ });
  } catch { /* best-effort */ }
}

function runWrangler(args: string[], opts: { accountId: string; apiToken: string }): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["wrangler", ...args], {
      env: {
        ...process.env,
        CLOUDFLARE_API_TOKEN: opts.apiToken,
        CLOUDFLARE_ACCOUNT_ID: opts.accountId,
        // wrangler must never wait for a TTY answer inside a server process
        CI: "1",
        WRANGLER_SEND_METRICS: "false",
      },
      shell: process.platform === "win32",
    });
    let out = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      const err = new Error(`wrangler timed out after ${WRANGLER_TIMEOUT_MS / 1000}s`) as Error & { wranglerOutput?: string };
      err.wranglerOutput = out;
      reject(err);
    }, WRANGLER_TIMEOUT_MS);
    child.stdout.on("data", (d) => { out += String(d); });
    child.stderr.on("data", (d) => { out += String(d); });
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) return resolve(out);
      const err = new Error(`wrangler exited with code ${code}: ${out.slice(-400)}`) as Error & { wranglerOutput?: string };
      err.wranglerOutput = out;
      reject(err);
    });
  });
}
