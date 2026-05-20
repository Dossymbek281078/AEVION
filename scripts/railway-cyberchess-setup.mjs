#!/usr/bin/env node
/**
 * railway-cyberchess-setup.mjs
 *
 * Purpose: configure CyberChess prod env on Railway via GraphQL API.
 *
 *  1) Generate random 32-byte hex CYBERCHESS_ADMIN_KEY and upsert it.
 *  2) Optionally upsert ELEVENLABS_API_KEY when SETUP_ELEVENLABS_KEY is set.
 *  3) Optionally upsert QCOREAI_BASE when SETUP_QCOREAI_BASE is set.
 *  4) Optionally upsert INTERNAL_TOKEN when SETUP_INTERNAL_TOKEN is set.
 *  5) Optionally create + attach Railway Volume to /app/aevion-globus-backend/data
 *     when SETUP_VOLUME=1 or --volume flag is passed.
 *  6) Trigger a redeploy of the backend service in production.
 *
 * Required env:
 *   RAILWAY_TOKEN                - Railway API token (account or team token)
 *
 * Optional env:
 *   RAILWAY_PROJECT_ID           - skip discovery, use this project id
 *   RAILWAY_SERVICE_ID           - skip discovery, use this service id
 *   RAILWAY_ENVIRONMENT_ID       - skip discovery, use this environment id
 *   SETUP_ELEVENLABS_KEY         - if set, also upsert ELEVENLABS_API_KEY=<value>
 *   SETUP_QCOREAI_BASE           - if set, also upsert QCOREAI_BASE=<value>
 *   SETUP_INTERNAL_TOKEN         - if set, also upsert INTERNAL_TOKEN=<value>
 *   SETUP_VOLUME                 - if "1", create + attach persistent volume
 *   SETUP_VOLUME_NAME            - volume name, default "cyberchess-data"
 *   SETUP_VOLUME_MOUNT_PATH      - mount path, default "/app/aevion-globus-backend/data"
 *   RAILWAY_PROJECT_NAME_MATCH   - substring (case-insensitive) for project name, default "aevion"
 *   RAILWAY_SERVICE_NAME_MATCH   - substring (case-insensitive) for service name, default "aevion"
 *   RAILWAY_ENVIRONMENT_NAME     - environment name to target, default "production"
 *
 * Flags:
 *   --volume                     - same as SETUP_VOLUME=1
 *   --no-redeploy                - skip the redeploy step (useful for dry-config)
 *   --help                       - print usage and exit
 *
 * Usage (PowerShell):
 *   $env:RAILWAY_TOKEN="..."; node scripts/railway-cyberchess-setup.mjs
 *   $env:RAILWAY_TOKEN="..."; $env:SETUP_VOLUME="1"; node scripts/railway-cyberchess-setup.mjs
 */

import { randomBytes } from "node:crypto";

const ENDPOINT = "https://backboard.railway.com/graphql/v2";

const argv = process.argv.slice(2);
const hasFlag = (f) => argv.includes(f);

function printUsage() {
  const lines = [
    "",
    "=== Railway CyberChess prod setup ===",
    "",
    "Required:",
    "  RAILWAY_TOKEN=<token>            Railway API token (dashboard → account → tokens)",
    "",
    "Optional env (upsert variables):",
    "  SETUP_ELEVENLABS_KEY=<value>     also upsert ELEVENLABS_API_KEY",
    "  SETUP_QCOREAI_BASE=<url>         also upsert QCOREAI_BASE (voice coach)",
    "  SETUP_INTERNAL_TOKEN=<token>     also upsert INTERNAL_TOKEN (tournament→matchmaking)",
    "",
    "Optional env (volume):",
    "  SETUP_VOLUME=1                   create + attach persistent volume",
    "  SETUP_VOLUME_NAME=<name>         default: cyberchess-data",
    "  SETUP_VOLUME_MOUNT_PATH=<path>   default: /app/aevion-globus-backend/data",
    "",
    "Optional env (IDs — skip auto-discovery):",
    "  RAILWAY_PROJECT_ID, RAILWAY_SERVICE_ID, RAILWAY_ENVIRONMENT_ID",
    "  RAILWAY_PROJECT_NAME_MATCH (default: aevion)",
    "  RAILWAY_SERVICE_NAME_MATCH (default: aevion)",
    "  RAILWAY_ENVIRONMENT_NAME   (default: production)",
    "",
    "Flags:",
    "  --volume        equivalent to SETUP_VOLUME=1",
    "  --no-redeploy   skip the final redeploy step",
    "  --help          print this usage and exit",
    "",
    "Examples (PowerShell):",
    "  $env:RAILWAY_TOKEN='...'; node scripts/railway-cyberchess-setup.mjs",
    "  $env:RAILWAY_TOKEN='...'; node scripts/railway-cyberchess-setup.mjs --volume",
    "  $env:RAILWAY_TOKEN='...'; $env:SETUP_ELEVENLABS_KEY='11labs_xxx'; node scripts/railway-cyberchess-setup.mjs",
    "",
  ];
  console.log(lines.join("\n"));
}

if (hasFlag("--help") || hasFlag("-h")) {
  printUsage();
  process.exit(0);
}

const token = process.env.RAILWAY_TOKEN;
if (!token) {
  printUsage();
  console.error("❌ Ошибка: RAILWAY_TOKEN не задан в окружении.");
  process.exit(1);
}

// Print usage block at the start (informational) so user sees all knobs in the log.
printUsage();

const projectNameMatch = (process.env.RAILWAY_PROJECT_NAME_MATCH || "aevion").toLowerCase();
const serviceNameMatch = (process.env.RAILWAY_SERVICE_NAME_MATCH || "aevion").toLowerCase();
const environmentName = process.env.RAILWAY_ENVIRONMENT_NAME || "production";

const wantVolume = hasFlag("--volume") || process.env.SETUP_VOLUME === "1";
const skipRedeploy = hasFlag("--no-redeploy");

const volumeName = process.env.SETUP_VOLUME_NAME || "cyberchess-data";
const volumeMountPath = process.env.SETUP_VOLUME_MOUNT_PATH || "/app/aevion-globus-backend/data";

const summary = {
  projectId: null,
  serviceId: null,
  environmentId: null,
  adminKeyUpserted: false,
  adminKeyValue: null,
  elevenLabsUpserted: false,
  qcoreaiBaseUpserted: false,
  internalTokenUpserted: false,
  volumeRequested: wantVolume,
  volumeAction: "skipped", // "skipped" | "exists" | "created" | "error"
  volumeId: null,
  redeployRequested: false,
  errors: [],
};

/** Send a GraphQL request and throw on errors. */
async function gql(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${res.status} non-JSON response: ${text.slice(0, 500)}`);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  if (json.errors && json.errors.length) {
    const msg = json.errors.map((e) => e.message).join("; ");
    throw new Error(`GraphQL error: ${msg}`);
  }
  return json.data;
}

/** Discover project / service / environment IDs from `me` query when not provided. */
async function discoverIds() {
  let projectId = process.env.RAILWAY_PROJECT_ID || null;
  let serviceId = process.env.RAILWAY_SERVICE_ID || null;
  let environmentId = process.env.RAILWAY_ENVIRONMENT_ID || null;

  if (projectId && serviceId && environmentId) {
    console.log("→ Используем переданные IDs из окружения (project/service/environment).");
    return { projectId, serviceId, environmentId };
  }

  console.log("→ Запрашиваю `me { projects ... }` для discovery...");
  const data = await gql(`
    query Me {
      me {
        projects {
          edges {
            node {
              id
              name
              services {
                edges { node { id name } }
              }
              environments {
                edges { node { id name } }
              }
            }
          }
        }
      }
    }
  `);

  const projects = (data?.me?.projects?.edges || []).map((e) => e.node);
  if (!projects.length) {
    throw new Error("В аккаунте нет проектов (me.projects пуст).");
  }

  let project = null;
  if (projectId) {
    project = projects.find((p) => p.id === projectId) || null;
    if (!project) throw new Error(`Project с id=${projectId} не найден в аккаунте.`);
  } else {
    project =
      projects.find((p) => (p.name || "").toLowerCase().includes(projectNameMatch)) ||
      projects[0];
    projectId = project.id;
  }
  console.log(`   ✔ project: "${project.name}" (${projectId})`);

  const services = (project.services?.edges || []).map((e) => e.node);
  if (!services.length) throw new Error(`У проекта "${project.name}" нет services.`);
  let service = null;
  if (serviceId) {
    service = services.find((s) => s.id === serviceId) || null;
    if (!service) throw new Error(`Service с id=${serviceId} не найден в проекте.`);
  } else {
    service =
      services.find((s) => (s.name || "").toLowerCase().includes(serviceNameMatch)) ||
      services[0];
    serviceId = service.id;
  }
  console.log(`   ✔ service: "${service.name}" (${serviceId})`);

  const envs = (project.environments?.edges || []).map((e) => e.node);
  if (!envs.length) throw new Error(`У проекта "${project.name}" нет environments.`);
  let env = null;
  if (environmentId) {
    env = envs.find((e) => e.id === environmentId) || null;
    if (!env) throw new Error(`Environment с id=${environmentId} не найден в проекте.`);
  } else {
    env =
      envs.find((e) => (e.name || "").toLowerCase() === environmentName.toLowerCase()) ||
      envs.find((e) => (e.name || "").toLowerCase().includes(environmentName.toLowerCase())) ||
      envs[0];
    environmentId = env.id;
  }
  console.log(`   ✔ environment: "${env.name}" (${environmentId})`);

  return { projectId, serviceId, environmentId };
}

/** Upsert a variable for project/service/environment. */
async function upsertVariable({ projectId, serviceId, environmentId, name, value }) {
  console.log(`→ variableUpsert: ${name}`);
  await gql(
    `
    mutation VariableUpsert($input: VariableUpsertInput!) {
      variableUpsert(input: $input)
    }
    `,
    {
      input: { projectId, serviceId, environmentId, name, value },
    },
  );
  console.log(`   ✔ ${name} установлен.`);
}

/**
 * Query existing volumes for the project.
 * Returns array of { id, name, mountPath, serviceId, environmentId } (best-effort,
 * since Railway schema for volumes has evolved — we attempt the canonical shape
 * and tolerate missing edges fields).
 */
async function listVolumes({ projectId, serviceId, environmentId }) {
  // Try project.volumes edges with volumeInstances → matches current Railway schema.
  try {
    const data = await gql(
      `
      query ProjectVolumes($projectId: String!) {
        project(id: $projectId) {
          volumes {
            edges {
              node {
                id
                name
                volumeInstances {
                  edges {
                    node {
                      id
                      mountPath
                      serviceId
                      environmentId
                    }
                  }
                }
              }
            }
          }
        }
      }
      `,
      { projectId },
    );
    const edges = data?.project?.volumes?.edges || [];
    const out = [];
    for (const e of edges) {
      const v = e.node;
      const instances = (v?.volumeInstances?.edges || []).map((ie) => ie.node);
      if (!instances.length) {
        out.push({ id: v.id, name: v.name, mountPath: null, serviceId: null, environmentId: null });
        continue;
      }
      for (const inst of instances) {
        out.push({
          id: v.id,
          name: v.name,
          mountPath: inst.mountPath || null,
          serviceId: inst.serviceId || null,
          environmentId: inst.environmentId || null,
        });
      }
    }
    return out;
  } catch (err) {
    // Schema may differ; fall back to empty list and log soft warning.
    console.log(`   ⚠ Не удалось получить список volumes: ${err?.message || err}`);
    return [];
  }
}

/** Create + attach a Railway Volume to the service/environment at mountPath. */
async function createVolume({ projectId, serviceId, environmentId, name, mountPath }) {
  console.log(`→ volumeCreate: name="${name}" mountPath="${mountPath}"`);
  const data = await gql(
    `
    mutation VolumeCreate($input: VolumeCreateInput!) {
      volumeCreate(input: $input) {
        id
        name
      }
    }
    `,
    {
      input: { projectId, serviceId, environmentId, mountPath },
    },
  );
  const volume = data?.volumeCreate;
  console.log(`   ✔ volume создан: id=${volume?.id} name=${volume?.name}`);
  return volume;
}

/** Ensure that a volume exists for the requested mountPath on this service/environment. */
async function ensureVolume({ projectId, serviceId, environmentId }) {
  console.log("");
  console.log("=== Volume setup ===");
  const existing = await listVolumes({ projectId, serviceId, environmentId });
  console.log(`   найдено volumes: ${existing.length}`);
  for (const v of existing) {
    console.log(
      `     - ${v.name} (${v.id}) mount=${v.mountPath || "-"} svc=${v.serviceId || "-"} env=${v.environmentId || "-"}`,
    );
  }

  const matched = existing.find(
    (v) =>
      v.mountPath &&
      v.mountPath === volumeMountPath &&
      (!v.serviceId || v.serviceId === serviceId) &&
      (!v.environmentId || v.environmentId === environmentId),
  );

  if (matched) {
    console.log(
      `   ✔ Volume для "${volumeMountPath}" уже существует (id=${matched.id}, name=${matched.name}). Пропускаю create.`,
    );
    summary.volumeAction = "exists";
    summary.volumeId = matched.id;
    return matched;
  }

  try {
    const created = await createVolume({
      projectId,
      serviceId,
      environmentId,
      name: volumeName,
      mountPath: volumeMountPath,
    });
    summary.volumeAction = "created";
    summary.volumeId = created?.id || null;
    return created;
  } catch (err) {
    console.error(`   ❌ Не удалось создать volume: ${err?.message || err}`);
    summary.volumeAction = "error";
    summary.errors.push(`volumeCreate: ${err?.message || err}`);
    throw err;
  }
}

/** Trigger a redeploy of the service in the given environment. */
async function redeploy({ serviceId, environmentId }) {
  console.log("→ serviceInstanceRedeploy: запускаю передеплой...");
  await gql(
    `
    mutation Redeploy($serviceId: String!, $environmentId: String!) {
      serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
    }
    `,
    { serviceId, environmentId },
  );
  console.log("   ✔ редеплой запрошен.");
}

function printSummary() {
  console.log("");
  console.log("================ SUMMARY ================");
  console.log(`  project:           ${summary.projectId}`);
  console.log(`  service:           ${summary.serviceId}`);
  console.log(`  environment:       ${summary.environmentId}`);
  console.log(`  ADMIN_KEY upsert:  ${summary.adminKeyUpserted ? "yes" : "no"}`);
  if (summary.adminKeyValue) {
    console.log(`    value:           ${summary.adminKeyValue}`);
  }
  console.log(`  ELEVENLABS upsert: ${summary.elevenLabsUpserted ? "yes" : "no"}`);
  console.log(`  QCOREAI_BASE:      ${summary.qcoreaiBaseUpserted ? "yes" : "no"}`);
  console.log(`  INTERNAL_TOKEN:    ${summary.internalTokenUpserted ? "yes" : "no"}`);
  console.log(`  volume requested:  ${summary.volumeRequested ? "yes" : "no"}`);
  console.log(`  volume action:     ${summary.volumeAction}`);
  if (summary.volumeId) {
    console.log(`  volume id:         ${summary.volumeId}`);
  }
  console.log(`  redeploy:          ${summary.redeployRequested ? "yes" : "no"}`);
  if (summary.errors.length) {
    console.log(`  errors:`);
    for (const e of summary.errors) console.log(`    - ${e}`);
  }
  console.log("=========================================");
}

async function main() {
  console.log("=== Railway CyberChess prod setup ===");

  const { projectId, serviceId, environmentId } = await discoverIds();
  summary.projectId = projectId;
  summary.serviceId = serviceId;
  summary.environmentId = environmentId;

  // Step 1: CYBERCHESS_ADMIN_KEY (random 32-byte hex => 64 hex chars)
  const adminKey = randomBytes(32).toString("hex");
  console.log("→ Сгенерирован CYBERCHESS_ADMIN_KEY (32 байта hex).");
  console.log(`   значение: ${adminKey}`);
  await upsertVariable({
    projectId,
    serviceId,
    environmentId,
    name: "CYBERCHESS_ADMIN_KEY",
    value: adminKey,
  });
  summary.adminKeyUpserted = true;
  summary.adminKeyValue = adminKey;

  // Step 2: optional ELEVENLABS_API_KEY
  const elevenLabs = process.env.SETUP_ELEVENLABS_KEY;
  if (elevenLabs && elevenLabs.trim().length > 0) {
    await upsertVariable({
      projectId,
      serviceId,
      environmentId,
      name: "ELEVENLABS_API_KEY",
      value: elevenLabs,
    });
    summary.elevenLabsUpserted = true;
  } else {
    console.log("→ SETUP_ELEVENLABS_KEY не задан — пропускаю ELEVENLABS_API_KEY.");
  }

  // Step 2b: optional QCOREAI_BASE (voice coach standalone)
  const qcoreaiBase = process.env.SETUP_QCOREAI_BASE;
  if (qcoreaiBase && qcoreaiBase.trim().length > 0) {
    await upsertVariable({
      projectId,
      serviceId,
      environmentId,
      name: "QCOREAI_BASE",
      value: qcoreaiBase,
    });
    summary.qcoreaiBaseUpserted = true;
  } else {
    console.log("→ SETUP_QCOREAI_BASE не задан — пропускаю QCOREAI_BASE.");
  }

  // Step 2c: optional INTERNAL_TOKEN (tournament → matchmaking pre-match endpoint)
  const internalToken = process.env.SETUP_INTERNAL_TOKEN;
  if (internalToken && internalToken.trim().length > 0) {
    await upsertVariable({
      projectId,
      serviceId,
      environmentId,
      name: "INTERNAL_TOKEN",
      value: internalToken,
    });
    summary.internalTokenUpserted = true;
  } else {
    console.log("→ SETUP_INTERNAL_TOKEN не задан — пропускаю INTERNAL_TOKEN.");
  }

  // Step 3: optional volume create+attach
  if (wantVolume) {
    try {
      await ensureVolume({ projectId, serviceId, environmentId });
    } catch (err) {
      // ensureVolume already pushed to summary.errors; continue to allow redeploy of envs.
      console.error(`   ⚠ volume step не удался: ${err?.message || err}`);
    }
  } else {
    console.log("→ SETUP_VOLUME не задан и нет --volume — пропускаю volume create.");
  }

  // Step 4: redeploy (unless --no-redeploy)
  if (skipRedeploy) {
    console.log("→ --no-redeploy: пропускаю передеплой.");
  } else {
    await redeploy({ serviceId, environmentId });
    summary.redeployRequested = true;
  }

  printSummary();
  console.log("");
  console.log("✅ Готово");
  console.log("   CYBERCHESS_ADMIN_KEY (сохрани в безопасном месте):");
  console.log("   " + adminKey);

  // exit code: 0 on success, 1 if any non-fatal error was recorded
  if (summary.errors.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Ошибка: " + (err?.message || String(err)));
  if (err?.stack && process.env.DEBUG) console.error(err.stack);
  summary.errors.push(err?.message || String(err));
  try {
    printSummary();
  } catch {}
  process.exit(1);
});
