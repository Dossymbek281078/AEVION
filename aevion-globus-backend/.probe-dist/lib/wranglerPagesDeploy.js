"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployViaWrangler = deployViaWrangler;
exports.warmWrangler = warmWrangler;
const child_process_1 = require("child_process");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = __importDefault(require("path"));
const WRANGLER_TIMEOUT_MS = 180000;
async function deployViaWrangler(files, projectName, opts) {
    /** Пути, отброшенные как попытка выйти за пределы папки сборки. */
    const skipped = [];
    const dir = await (0, promises_1.mkdtemp)(path_1.default.join((0, os_1.tmpdir)(), "devhub-pages-"));
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
            const full = path_1.default.join(dir, safe);
            await (0, promises_1.mkdir)(path_1.default.dirname(full), { recursive: true });
            await (0, promises_1.writeFile)(full, f.content, "utf8");
        }
        const output = await runWrangler(["pages", "deploy", dir, `--project-name=${projectName}`, `--branch=${opts.branch ?? "main"}`, "--commit-dirty=true"], opts);
        const m = output.match(/https:\/\/[\w.-]+\.pages\.dev/);
        if (m)
            return { ok: true, url: m[0], output, skipped };
        return { ok: false, error: "wrangler finished without printing a deployment URL", output, skipped };
    }
    catch (e) {
        return { ok: false, error: e?.message || "wrangler deploy failed", output: String(e?.wranglerOutput || ""), skipped };
    }
    finally {
        (0, promises_1.rm)(dir, { recursive: true, force: true }).catch(() => { });
    }
}
/** Fire-and-forget first-run warm-up: npx resolution + wrangler's own init
 * cost seconds on a fresh pod — pay them at boot, not inside a user's deploy.
 * Never throws; failure just means the first deploy pays the cost instead. */
function warmWrangler() {
    try {
        const child = (0, child_process_1.spawn)("npx", ["wrangler", "--version"], {
            env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" },
            shell: process.platform === "win32",
            stdio: "ignore",
        });
        child.on("error", () => { });
    }
    catch { /* best-effort */ }
}
function runWrangler(args, opts) {
    return new Promise((resolve, reject) => {
        const child = (0, child_process_1.spawn)("npx", ["wrangler", ...args], {
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
            const err = new Error(`wrangler timed out after ${WRANGLER_TIMEOUT_MS / 1000}s`);
            err.wranglerOutput = out;
            reject(err);
        }, WRANGLER_TIMEOUT_MS);
        child.stdout.on("data", (d) => { out += String(d); });
        child.stderr.on("data", (d) => { out += String(d); });
        child.on("error", (e) => { clearTimeout(timer); reject(e); });
        child.on("close", (code) => {
            clearTimeout(timer);
            if (code === 0)
                return resolve(out);
            const err = new Error(`wrangler exited with code ${code}: ${out.slice(-400)}`);
            err.wranglerOutput = out;
            reject(err);
        });
    });
}
