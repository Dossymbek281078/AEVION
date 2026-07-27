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

      // Verified against the real API before enabling any of this: Railway
      // ACCEPTS source.repo and returns a service id even when it cannot
      // actually attach the repository — the service then exists and builds
      // nothing. Check the trigger rather than trusting the mutation, or we
      // ship another "the API said yes" deploy that never runs.
      const check = await gql(
        `query S($id: String!) { service(id: $id) { repoTriggers { edges { node { repository } } } } }`,
        { id: serviceId }
      ).catch(() => null);
      const attached = check?.service?.repoTriggers?.edges?.length > 0;
      if (!attached) {
        return {
          ok: false,
          error:
            `Railway created the service but did not attach ${slug} — install the Railway GitHub App on that repository (railway.com/account/integrations), then deploy again. Without the link the service would build nothing.`,
        };
      }
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

/**
 * Delete a project's Railway service.
 *
 * Deleting a DevHub project already drops its database schema and login role,
 * for a stated reason: credentials pointing at data nobody owns any more, with
 * nothing left in the UI to clean them up with. Its service is the same thing
 * with a bill attached — a running container built from the user's repo,
 * carrying that project's env (DATABASE_URL included), on a live domain.
 *
 * Three guards, because the id comes out of stored project state and this
 * mutation is not reversible:
 *  - never the platform's own service (that is the "Deploy restarted our own
 *    backend" defect, one mutation further along),
 *  - the deploy project must be a dedicated one, same check as creating,
 *  - the service is asked which project it belongs to, and a service outside
 *    the deploy project is refused rather than deleted on trust.
 */
export async function deleteProjectService(args: {
  serviceId: string;
  token?: string;
  deployProjectId?: string;
  platformProjectId?: string;
  platformServiceIds?: Array<string | undefined>;
  gql?: Gql;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = args.token ?? process.env.RAILWAY_API_TOKEN;
  const deployProjectId = args.deployProjectId ?? process.env.RAILWAY_DEPLOY_PROJECT_ID;
  const platformProjectId = args.platformProjectId ?? process.env.RAILWAY_PROJECT_ID;
  const platformServiceIds = (
    args.platformServiceIds ?? [process.env.RAILWAY_SERVICE_ID, process.env.RAILWAY_SELF_SERVICE_ID]
  ).filter(Boolean) as string[];

  if (!args.serviceId) return { ok: false, error: "no service id" };
  if (!token) return { ok: false, error: "RAILWAY_API_TOKEN is not set" };
  if (platformServiceIds.includes(args.serviceId)) {
    return { ok: false, error: "refusing to delete the AEVION platform's own Railway service" };
  }
  if (!isSafeDeployTarget(deployProjectId, platformProjectId)) {
    return {
      ok: false,
      error:
        "RAILWAY_DEPLOY_PROJECT_ID must be set to a Railway project dedicated to user deploys, and must differ from the platform's own project",
    };
  }

  const gql = args.gql ?? makeGql(token);
  try {
    const owner = await gql(`query S($id: String!) { service(id: $id) { projectId } }`, { id: args.serviceId });
    const ownerProjectId = owner?.service?.projectId;
    if (!ownerProjectId) {
      // Already gone is the outcome we wanted; nothing to clean up.
      return { ok: true };
    }
    if (ownerProjectId !== deployProjectId) {
      return { ok: false, error: `service ${args.serviceId} lives in Railway project ${ownerProjectId}, not the user-deploy project — refusing to delete it` };
    }
    await gql(`mutation D($id: String!) { serviceDelete(id: $id) }`, { id: args.serviceId });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
