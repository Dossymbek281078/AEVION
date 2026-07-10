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
- **Ollama**: not embedded — the app starts it if present and guides the user to
  install it otherwise. Bundling model weights would make the installer many GB;
  pulling on first run is the pragmatic default.

### Building on Windows — the winCodeSign gotcha

`electron-builder --dir` **works** and produces `out/win-unpacked/` (a directly
runnable app). But the **NSIS installer** (`--win nsis`) fetches the
`winCodeSign` package, which contains macOS `*.dylib` **symlinks**. Extracting a
symlink on Windows needs the symlink privilege, so without **admin** or
**Developer Mode** the extraction fails (`Cannot create symbolic link … client
does not have the required privilege`) and the installer build aborts.
electron-builder re-downloads winCodeSign to a fresh cache path each run, so
editing the cached archive doesn't help. Fixes, in order of preference:
  1. Enable **Windows Developer Mode** (Settings → For developers), then rebuild.
  2. Run the build shell **as Administrator**.

### Signing

- **Real distribution** needs an **OV/EV code-signing certificate** from a CA
  (`CSC_LINK` = path to the `.pfx`, `CSC_KEY_PASSWORD` = its password). Only a
  CA-issued cert removes SmartScreen warnings on machines you don't control.
- **Self-signed (dev/internal)**: generate a cert and sign the built exe without
  electron-builder (bypasses the winCodeSign blocker):
  ```powershell
  $c = New-SelfSignedCertificate -Type CodeSigningCert -Subject 'CN=AEVION' `
        -CertStoreLocation Cert:\CurrentUser\My -KeyExportPolicy Exportable
  Set-AuthenticodeSignature 'out\win-unpacked\AEVION Council.exe' -Certificate $c `
        -TimestampServer 'http://timestamp.digicert.com' -HashAlgorithm SHA256
  ```
  The signature is **Valid only where the cert is trusted** — import the public
  `.cer` into `Cert:\CurrentUser\Root` + `Cert:\CurrentUser\TrustedPublisher` on
  each target machine (no admin needed for the CurrentUser stores). Other
  machines still see it as untrusted — that's the self-signed limitation.

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
