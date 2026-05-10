import { Router } from "express";
import { buildPool as pool, ok, fail, requireBuildAuth } from "../../lib/build";

export const contractsRouter = Router();

// POST /api/build/applications/:id/contract — generate a signable contract
// via QSign v2. Creates a payload with both parties' details and returns
// a pre-filled QSign sign URL. No DB row needed — the signed artifact
// lives in QSign.
contractsRouter.post("/:id/contract", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const appId = String(req.params.id);

    // Fetch application + vacancy + profiles of both parties
    const data = await pool.query(
      `SELECT
         a."id" AS "applicationId",
         a."userId" AS "workerId",
         a."status",
         v."title" AS "vacancyTitle",
         v."salary",
         v."salaryCurrency",
         p."title" AS "projectTitle",
         p."clientId",
         wp."name" AS "workerName",
         wp."city" AS "workerCity",
         cp."name" AS "clientName",
         cp."city" AS "clientCity"
       FROM "BuildApplication" a
       LEFT JOIN "BuildVacancy" v ON v."id" = a."vacancyId"
       LEFT JOIN "BuildProject" p ON p."id" = v."projectId"
       LEFT JOIN "BuildProfile" wp ON wp."userId" = a."userId"
       LEFT JOIN "BuildProfile" cp ON cp."userId" = p."clientId"
       WHERE a."id" = $1 LIMIT 1`,
      [appId],
    );

    if (data.rowCount === 0) return fail(res, 404, "application_not_found");
    const d = data.rows[0];

    if (d.clientId !== auth.sub && d.workerId !== auth.sub && auth.role !== "ADMIN") {
      return fail(res, 403, "only_parties_can_generate_contract");
    }
    if (d.status !== "ACCEPTED") {
      return fail(res, 400, "contract_requires_accepted_application");
    }

    const contractPayload = {
      type: "QBuild_ServiceContract_v1",
      applicationId: appId,
      client: {
        name: d.clientName || "—",
        city: d.clientCity || "—",
      },
      worker: {
        name: d.workerName || "—",
        city: d.workerCity || "—",
      },
      vacancy: {
        title: d.vacancyTitle,
        salary: d.salary,
        currency: d.salaryCurrency || "RUB",
        project: d.projectTitle,
      },
      generatedAt: new Date().toISOString(),
      platform: "AEVION QBuild",
    };

    // Build a QSign deep-link: prefill the payload as a JSON string.
    // The /qsign page accepts ?payload=<json> to prefill the sign form.
    const encoded = encodeURIComponent(JSON.stringify(contractPayload));
    const qsignUrl = `/qsign?payload=${encoded}&title=${encodeURIComponent(`Договор: ${d.vacancyTitle}`)}`;

    return ok(res, {
      contractPayload,
      qsignUrl,
      hint: "Open qsignUrl in the browser — both parties sign with QSign v2",
    });
  } catch (err: unknown) {
    return fail(res, 500, "contract_generation_failed", { details: (err as Error).message });
  }
});
