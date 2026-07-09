# AEVION QCoreAI — run the Council **offline**

Run the whole multi-agent Council on your own machine, with the internet fully
off. A crowd of **local** models drafts in parallel; a **local** chair fuses
them into one answer. No cloud keys, no per-token cost, nothing leaves the box.

This is the same Council you get online — just with the crowd and the chair
drawn from local runtimes instead of cloud models.

---

## What "offline" means here

| Layer | Online Council | **Offline Council** |
|---|---|---|
| Crowd (proposers) | free cloud fleet (OpenRouter, Groq, …) | **local runtimes** (Ollama / LM Studio / Jan / LocalAI / llama.cpp) |
| Chair (Synthesizer) | Opus 4.8 (premium) | **best local model** you've pulled |
| Internet required | yes | **no** (after models are downloaded once) |
| Cost / privacy | cents per answer / cloud | **$0 / never leaves your machine** |

The offline switch is a hard guarantee: even if cloud keys are present, a run
with `offline: true` uses **local runtimes only**.

---

## Fastest path (Windows, Ollama)

From the repo root (`aevion-core`):

```powershell
powershell -ExecutionPolicy Bypass -File deploy\local\run-local.ps1
```

The script: checks/starts Ollama → pulls `llama3.2`, `qwen2.5:7b`, `gemma2:2b`
→ writes `aevion-globus-backend\.env` + `frontend\.env.local` → runs
`npm run dev`.

Then open **http://localhost:3000/qcoreai/multi**, pick **Council ✦**, and flip
the **`Offline (local)`** toggle. Pull your network cable — it still answers.

> First run needs internet to *download* the models (a few GB). After that,
> fully offline.

---

## Manual setup (any OS / any runtime)

1. **Start a local runtime** and note its OpenAI-compatible base URL:

   | Runtime | Get it | Base URL |
   |---|---|---|
   | **Ollama** | https://ollama.com → `ollama serve` + `ollama pull llama3.2` | `http://127.0.0.1:11434/v1` |
   | **LM Studio** | https://lmstudio.ai → enable "Local Server" | `http://127.0.0.1:1234/v1` |
   | **Jan** | https://jan.ai → enable API server | `http://127.0.0.1:1337/v1` |
   | **LocalAI** | https://localai.io | `http://127.0.0.1:8080/v1` |
   | **llama.cpp** | `llama-server` | `http://127.0.0.1:8080/v1` |

2. **Point the backend at it** — in `aevion-globus-backend/.env` set the matching
   base URL (see `deploy/local/.env.local.example` for every variable). E.g.:

   ```env
   OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
   OLLAMA_MODEL=llama3.2
   PORT=4001
   ```

   Configure **two or more** runtimes (or rely on one runtime's multiple models)
   for a genuinely diverse crowd.

3. **Point the frontend proxy at your local backend** — in `frontend/.env.local`:

   ```env
   BACKEND_PROXY_TARGET=http://127.0.0.1:4001
   ```

4. **Run** from the repo root: `npm run dev`. Open the multi-agent page, choose
   **Council**, toggle **Offline (local)**.

### Prefer Docker for the models?

```bash
docker compose -f deploy/local/docker-compose.ollama.yml up -d
```

Runs Ollama + auto-pulls the model set, then set
`OLLAMA_BASE_URL=http://127.0.0.1:11434/v1` in the backend env.

---

## API (headless)

The offline flag is just a request field on the existing endpoint:

```bash
curl -N http://127.0.0.1:4001/api/qcoreai/multi-agent \
  -H "Content-Type: application/json" \
  -d '{"input":"Explain B-trees simply.","strategy":"council","offline":true,"councilSize":3,"councilLayers":1}'
```

`GET /api/qcoreai/providers` returns `localCount` — how many local runtimes are
configured. `> 0` means the offline Council is available. The `plan` SSE event
carries `localOnly: true` for an offline run.

If no local runtime is configured, an offline run fails fast with a message
listing the env vars to set (`OLLAMA_BASE_URL`, `LMSTUDIO_BASE_URL`, …).

---

## Notes & limits

- **Quality** tracks your local models. A 3B crowd with a 7B chair is a real,
  useful assistant, but it won't match the online Opus-chaired Council — that's
  the honest trade for $0 + full privacy + offline.
- **Diversity**: more distinct local models = a better crowd. Mixing two runtimes
  (e.g. Ollama + LM Studio) gives more genuine variety than one runtime alone.
- **A member failing** (runtime busy) is non-fatal — the Council proceeds on the
  rest, and falls back to the longest draft if the chair itself fails.
- This packages a **local dev run**, not a signed desktop installer. A one-click
  Electron/Tauri bundle is the next step on the roadmap.
