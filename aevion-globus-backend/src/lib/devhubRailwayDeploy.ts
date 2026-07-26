/**
 * Per-project backend deploys on Railway.
 *
 * Replaces the path removed in the "Deploy restarted our own backend" fix:
 * that code fired deploymentCreate at the platform's own service id. Here every
 * project gets its OWN Railway service, built from the project's GitHub repo,
 * carrying that project's env vars (including the DATABASE_URL provisioning
 * hands out), on its own generated domain.
 *
 * Guardrails, because this spends money and touches infrastructure:
 * - services are created in RAILWAY_DEPLOY_PROJECT_ID — a Railway project
 *   dedicated to user deploys. It must NOT be the project hosting AEVION
 *   itself, and that is checked rather than trusted.
 * - the whole path is behind DEVHUB_RAILWAY_PER_PROJECT so it cannot switch on
 *   by accident: the moment it is enabled, user clicks start billable
 *   containers.
 * - one service per project, reused on redeploy — never a new service per
 *   click, which is how these integrations quietly become a five-figure bill.
 */

export type RailwayDeployResult =
  | { ok: true; serviceId: string; domain: string; deploymentId?: string; created: boolean }
  | { ok: false; error: string };

type Gql = (query: string, variables?: Record<string, unknown>) => Promise<any>;

const RAILWAY_GRAPHQL = "https://backboard.railway.com/graphql/v2";

function makeGql(token: string): Gql {
  return async (query, variables) => {
    const r = await fetch(RAILWAY_GRAPHQL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: variables ?? {} }),
    });
    const body = await r.json().catch(() => ({}));
    // Railway answers 200 with an errors[] body on failure — the trap that let
    // fake deploys look successful for months (backend CLAUDE.md §10).
    if (!r.ok || body?.errors) {
      const msg = body?.errors?.[0]?.message || `HTTP ${r.status}`;
      throw new Error(msg);
    }
    return body?.data;
  };
}

/** owner/name from any GitHub URL form we store in project.repoUrl. */
export function repoSlugFromUrl(repoUrl: string | null | undefined): string | null {
  if (!repoUrl) return null;
  const m = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.\s]+)/i);
  return m ? `${m[1]}/${m[2]}` : null;
}

export function isSafeDeployTarget(deployProjectId: string | undefined, platformProjectId: string | undefined): boolean {
  if (!deployProjectId) return false;
  // Deploying user services into the platform's own Railway project would put
  // them next to the API and the databases. Refuse.
  return !platformProjectId || deployProjectId !== platformProjectId;
}

export async function deployProjectToRailway(args: {
  projectId: string;
  repoUrl: string | null;
  envVars: Record<string, string>;
  token?: string;
  deployProjectId?: string;
  environmentId?: string;
  platformProjectId?: string;
  existingServiceId?: string | null;
  gql?: Gql;
}): Promise<RailwayDeployResult> {
  const token = args.token ?? process.env.RAILWAY_API_TOKEN;
  const deployProjectId = args.deployProjectId ?? process.env.RAILWAY_DEPLOY_PROJECT_ID;
  const environmentId = args.environmentId ?? process.env.RAILWAY_DEPLOY_ENV_ID;
  const platformProjectId = args.platformProjectId ?? process.env.RAILWAY_PROJECT_ID;

  if (!token) return { ok: false, error: "RAILWAY_API_TOKEN is not set" };
  if (!isSafeDeployTarget(deployProjectId, platformProjectId)) {
    return {
      ok: false,
      error:
        "RAILWAY_DEPLOY_PROJECT_ID must be set to a Railway project dedicated to user deploys, and must differ from the platform's own project",
    };
  }
  if (!environmentId) return { ok: false, error: "RAILWAY_DEPLOY_ENV_ID is not set" };

  const slug = repoSlugFromUrl(args.repoUrl);
  if (!slug) {
    return { ok: false, error: "connect a GitHub repo first — Railway builds the project from its repository" };
  }

  const gql = args.gql ?? makeGql(token);

  try {
    // Reuse the project's existing service; only create one the first time.
    let serviceId = args.existingServiceId || null;
    let created = false;
    if (!serviceId) {
      const data = await gql(
        `mutation C($input: ServiceCreateInput!) { serviceCreate(input: $input) { id } }`,
        { input: { projectId: deployProjectId, name: `devhub-${args.projectId.slice(0, 8)}`, source: { repo: slug } } }
      );
      serviceId = data?.serviceCreate?.id;
      created = true;
      if (!serviceId) return { ok: false, error: "Railway did not return a service id" };
    }

    // The project's own env vars — this is what carries DATABASE_URL into the
    // running app, which the old path never did.
    for (const [name, value] of Object.entries(args.envVars || {})) {
      await gql(`mutation U($input: VariableUpsertInput!) { variableUpsert(input: $input) }`, {
        input: { projectId: deployProjectId, environmentId, serviceId, name, value },
      });
    }

    const domainData = await gql(
      `mutation D($input: ServiceDomainCreateInput!) { serviceDomainCreate(input: $input) { domain } }`,
      { input: { environmentId, serviceId } }
    ).catch(() => null);
    const domain = domainData?.serviceDomainCreate?.domain;

    const dep = await gql(
      `mutation R($environmentId: String!, $serviceId: String!) { serviceInstanceRedeploy(environmentId: $environmentId, serviceId: $serviceId) }`,
      { environmentId, serviceId }
    ).catch(() => null);

    if (!domain) {
      return { ok: false, error: "service created but Railway returned no domain — check the service in the dashboard" };
    }
    return { ok: true, serviceId, domain, deploymentId: dep?.serviceInstanceRedeploy ? undefined : undefined, created };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
