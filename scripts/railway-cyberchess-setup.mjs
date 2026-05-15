#!/usr/bin/env node
/**
 * railway-cyberchess-setup.mjs
 *
 * Purpose: configure CyberChess prod env on Railway via GraphQL API.
 *
 *  1) Generate random 32-byte hex CYBERCHESS_ADMIN_KEY and upsert it.
 *  2) Optionally upsert ELEVENLABS_API_KEY when SETUP_ELEVENLABS_KEY is set.
 *  3) Trigger a redeploy of the backend service in production.
 *
 * Required env:
 *   RAILWAY_TOKEN                - Railway API token (account or team token)
 *
 * Optional env:
 *   RAILWAY_PROJECT_ID           - skip discovery, use this project id
 *   RAILWAY_SERVICE_ID           - skip discovery, use this service id
 *   RAILWAY_ENVIRONMENT_ID       - skip discovery, use this environment id
 *   SETUP_ELEVENLABS_KEY         - if set, also upsert ELEVENLABS_API_KEY=<value>
 *   RAILWAY_PROJECT_NAME_MATCH   - substring (case-insensitive) for project name, default "aevion"
 *   RAILWAY_SERVICE_NAME_MATCH   - substring (case-insensitive) for service name, default "aevion"
 *   RAILWAY_ENVIRONMENT_NAME     - environment name to target, default "production"
 *
 * Usage (PowerShell):
 *   $env:RAILWAY_TOKEN="..."; node scripts/railway-cyberchess-setup.mjs
 */

import { randomBytes } from "node:crypto";

const ENDPOINT = "https://backboard.railway.com/graphql/v2";

const token = process.env.RAILWAY_TOKEN;
if (!token) {
  console.error("❌ Ошибка: RAILWAY_TOKEN не задан в окружении.");
  process.exit(1);
}

const projectNameMatch = (process.env.RAILWAY_PROJECT_NAME_MATCH || "aevion").toLowerCase();
const serviceNameMatch = (process.env.RAILWAY_SERVICE_NAME_MATCH || "aevion").toLowerCase();
const environmentName = process.env.RAILWAY_ENVIRONMENT_NAME || "production";

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

async function main() {
  console.log("=== Railway CyberChess prod setup ===");

  const { projectId, serviceId, environmentId } = await discoverIds();

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
  } else {
    console.log("→ SETUP_ELEVENLABS_KEY не задан — пропускаю ELEVENLABS_API_KEY.");
  }

  // Step 3: redeploy
  await redeploy({ serviceId, environmentId });

  console.log("");
  console.log("✅ Готово");
  console.log("   project:     " + projectId);
  console.log("   service:     " + serviceId);
  console.log("   environment: " + environmentId);
  console.log("   CYBERCHESS_ADMIN_KEY (сохрани в безопасном месте):");
  console.log("   " + adminKey);
}

main().catch((err) => {
  console.error("❌ Ошибка: " + (err?.message || String(err)));
  if (err?.stack && process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
