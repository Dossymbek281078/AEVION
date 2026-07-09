# AEVION Council — desktop app (Electron)

One-click, offline **AEVION QCoreAI Council** for Windows. The app bundles the
backend + frontend and orchestrates a local **Ollama** runtime, so the whole
multi-agent Council runs on the user's machine — no terminal, no cloud, no keys.

It is the packaged sibling of `deploy/local/` (which runs the same thing via
`npm run dev`). Same offline Council; this wraps it in an installer.

## What it does at launch

A splash window streams progress while the orchestrator brings up, in order:

1. **Ollama** — starts `ollama serve` if it's installed and not already running.
2. **Backend** — the Express API on `127.0.0.1:4001`, with **no `DATABASE_URL`**
   (in-memory store) and `OLLAMA_BASE_URL` set so the offline Council has a crowd.
3. **Frontend** — the Next.js server on `127.0.0.1:3000`, proxying
   `/api-backend/*` to the backend.

Then it loads `http://127.0.0.1:3000/qcoreai/multi`. Pick **Council ✦**, toggle
**Offline (local)** — it answers with the internet off. On quit, all three child
processes are killed.

## Status (honest)

- ✅ **Orchestration + app shell**: `main.js`, `lib/orchestrator.js`, splash, preload
  — implemented and smoke-tested (`node smoke.js`).
- ✅ **Runs today in dev**: with the repo's backend + frontend already built,
  `npm install && npm start` launches the full app against the local checkout.
- ⏳ **Distributable installer**: `stage-resources.ps1` + `electron-builder` config
  are in place, but producing and **code-signing** the `.exe` is a machine-side
  step (heavy download; a signing cert is needed for a warning-free install).
  This is the remaining work before shipping to end-users.

## Run in dev (against the local checkout)

Prereqs: Node 20+, Ollama installed (https://ollama.com), backend + frontend
built once (`npm run build` in each), and a model pulled (`ollama pull llama3.2`).

```powershell
cd desktop
npm install
npm start
```

## Build a Windows installer

```powershell
cd desktop
npm install
npm run stage      # builds backend + frontend, stages them into resources/
npm run dist       # electron-builder -> out/AEVION-Council-Setup-<version>.exe
```

Notes:
- `stage-resources.ps1` copies the built backend (`dist` + `node_modules`) and
  frontend (`.next` [+ `node_modules` for `next start`]) into `resources/`.
- **Leaner build**: set Next's `output: "standalone"` and the stager bundles the
  self-contained server instead of the full `node_modules` — much smaller `.exe`.
- **Signing**: add an EV/OV code-signing cert (`CSC_LINK` / `CSC_KEY_PASSWORD`)
  so Windows SmartScreen doesn't warn on install. Unsigned builds run but warn.
- **Ollama**: not embedded — the app starts it if present and guides the user to
  install it otherwise. Bundling model weights would make the installer many GB;
  pulling on first run is the pragmatic default.

## Files

| File | Role |
|---|---|
| `main.js` | Electron main: window, splash, lifecycle, teardown |
| `lib/orchestrator.js` | Starts/health-checks/stops Ollama + backend + frontend |
| `preload.js` | Safe log bridge to the splash renderer |
| `splash.html` | Startup screen with live logs |
| `stage-resources.ps1` | Build + stage backend/frontend into `resources/` |
| `smoke.js` | Pure-Node smoke for the orchestrator helpers |

## Roadmap

- Standalone Next build wired into the stager by default (smaller installer).
- Bundled/downloaded Ollama with a first-run model picker.
- macOS (`.dmg`) + Linux (`AppImage`) targets.
- Auto-update channel.
