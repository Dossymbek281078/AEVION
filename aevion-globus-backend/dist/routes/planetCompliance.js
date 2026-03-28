"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.planetComplianceRouter = void 0;
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const planetCodeCanon_1 = require("../lib/planetCodeCanon");
const planetMediaCanon_1 = require("../lib/planetMediaCanon");
const dbPool_1 = require("../lib/dbPool");
const stableStringify_1 = require("../lib/stableStringify");
const merkle_1 = require("../lib/merkle");
exports.planetComplianceRouter = (0, express_1.Router)();
const pool = (0, dbPool_1.getPool)();
let ensuredTables = false;
async function ensurePlanetTables() {
    if (ensuredTables)
        return;
    // We use raw SQL bootstrapping because current backend is raw-pg + express (no Prisma in this module).
    await pool.query(`
    CREATE TABLE IF NOT EXISTS "PlanetSubmission" (
      "id" TEXT PRIMARY KEY,
      "ownerId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "artifactType" TEXT NOT NULL,
      "productKey" TEXT NOT NULL,
      "tier" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "PlanetArtifactVersion" (
      "id" TEXT PRIMARY KEY,
      "submissionId" TEXT NOT NULL,
      "versionNo" INT NOT NULL,
      "ownerId" TEXT NOT NULL,
      "artifactType" TEXT NOT NULL,
      "productKey" TEXT NOT NULL,
      "tier" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "inputSetHash" TEXT NOT NULL,
      "generationParamsHash" TEXT NOT NULL,
      "canonicalArtifactHash" TEXT NOT NULL,
      "evidenceRoot" TEXT,
      "certificateId" TEXT,
      "validatorResultsJson" JSONB,
      "codeIndexJson" JSONB,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "PlanetCertificate" (
      "id" TEXT PRIMARY KEY,
      "artifactVersionId" TEXT NOT NULL,
      "ownerId" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "publicPayloadJson" JSONB NOT NULL,
      "privatePayloadJson" JSONB NOT NULL,
      "policyManifestHash" TEXT NOT NULL,
      "evidenceRoot" TEXT NOT NULL,
      "signature" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "revokedAt" TIMESTAMPTZ,
      "revokeReason" TEXT
    );

    CREATE TABLE IF NOT EXISTS "PlanetCodeSymbolHistory" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "codeSymbol" TEXT NOT NULL,
      "validFrom" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "validUntil" TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS "PlanetVote" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "artifactVersionId" TEXT NOT NULL,
      "categoryId" TEXT NOT NULL DEFAULT 'general',
      "score" INT NOT NULL,
      "codeSymbol" TEXT NOT NULL,
      "leafHash" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("userId", "artifactVersionId", "categoryId")
    );

    CREATE TABLE IF NOT EXISTS "PlanetVoteSnapshot" (
      "id" TEXT PRIMARY KEY,
      "artifactVersionId" TEXT NOT NULL,
      "seasonId" TEXT NOT NULL,
      "publicSalt" TEXT NOT NULL,
      "rootHash" TEXT NOT NULL,
      "voteCount" INT NOT NULL,
      "leavesOrderedJson" JSONB NOT NULL,
      "signature" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("artifactVersionId", "seasonId")
    );
  `);
    await pool.query(`
    ALTER TABLE "PlanetArtifactVersion" ADD COLUMN IF NOT EXISTS "parentVersionId" TEXT;
  `);
    await pool.query(`
    ALTER TABLE "PlanetArtifactVersion" ADD COLUMN IF NOT EXISTS "mediaIndexJson" JSONB;
  `);
    ensuredTables = true;
}
function sha256Hex(s) {
    return crypto_1.default.createHash("sha256").update(s).digest("hex");
}
function hmacSha256Hex(secret, s) {
    return crypto_1.default.createHmac("sha256", secret).update(s).digest("hex");
}
function normalizeJson(value) {
    // jsonb may arrive already parsed; keep it stable for stableStringify usage.
    return value;
}
function stableH(value) {
    return sha256Hex((0, stableStringify_1.stableStringify)(value));
}
function jsonbMaybeParse(v) {
    if (v == null)
        return v;
    if (typeof v === "string") {
        try {
            return JSON.parse(v);
        }
        catch {
            return v;
        }
    }
    return v;
}
function requireAuth(req, res) {
    const header = req.headers?.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
        res.status(401).json({ error: "missing bearer token" });
        return null;
    }
    const secret = process.env.AUTH_JWT_SECRET || "dev-auth-secret";
    try {
        return jsonwebtoken_1.default.verify(token, secret);
    }
    catch (e) {
        res.status(401).json({ error: "invalid token", details: e?.message });
        return null;
    }
}
const VALID_ARTIFACT_TYPES = new Set(["movie", "music", "code", "web"]);
function productSecretFor(productKey) {
    const base = process.env.QSIGN_SECRET || "dev-qsign-secret";
    return `${base}:${productKey}`;
}
function defaultLicensePolicy(artifactType, productKey, tier) {
    // MVP: simple allow/deny by declared license string.
    // Later: real SBOM / dependency license scanning.
    const disallowed = ["GPL", "AGPL", "LGPL"];
    const allowed = ["MIT", "Apache", "BSD", "ISC"];
    return {
        artifactType,
        productKey,
        tier,
        allowedLicensesKeywords: allowed,
        disallowedLicensesKeywords: disallowed,
        evidenceRequired: ["license_declared", "policy_manifest_signed"],
    };
}
function policyManifest(artifactType, productKey, tier) {
    return {
        bureau: "AEVION-PLANET-ELECTRONIC-BUREAU",
        version: "v1",
        artifactType,
        productKey,
        tier,
        allowedActions: ["publish_in_portal", "export_signed_bundle"],
        evidence: ["integrity_binding", "validator_results", "evidence_root"],
        moderation: {
            plagiarism: { resubmitAllowed: true },
        },
        createdAt: new Date().toISOString(),
    };
}
function computeEvidenceRoot(params) {
    return stableH({
        kind: "planet_evidence_root",
        pipelineVersion: params.pipelineVersion,
        inputSetHash: params.inputSetHash,
        generationParamsHash: params.generationParamsHash,
        canonicalArtifactHash: params.canonicalArtifactHash,
        validatorResults: normalizeJson(params.validatorResults),
    });
}
function decideOverallStatus(validatorResults) {
    if (validatorResults.some((v) => v.status === "rejected"))
        return "rejected";
    if (validatorResults.some((v) => v.status === "flagged"))
        return "flagged";
    return "passed";
}
function riskScanTextForSecrets(code) {
    const patterns = [
        { id: "private_key_pem", re: /-----BEGIN (RSA|EC|DSA|) PRIVATE KEY-----/i },
        { id: "aws_access_key", re: /\bAKIA[0-9A-Z]{16}\b/ },
        { id: "gcp_service_account", re: /"type"\s*:\s*"service_account"/i },
        { id: "jwt_like", re: /\beyJ[A-Za-z0-9_-]{10,}\b/ },
        { id: "shell_exec_like", re: /\bexecSync\s*\(|\bspawn\s*\(|\bchild_process\b/i },
        { id: "eval_like", re: /\beval\s*\(|new Function\s*\(/i },
    ];
    const hits = [];
    for (const p of patterns) {
        if (p.re.test(code))
            hits.push(p.id);
    }
    return hits;
}
function similarityJaccard(aSet, bSet) {
    if (aSet.size === 0 && bSet.size === 0)
        return 1;
    if (aSet.size === 0 || bSet.size === 0)
        return 0;
    let inter = 0;
    for (const x of aSet)
        if (bSet.has(x))
            inter++;
    const uni = aSet.size + bSet.size - inter;
    return uni === 0 ? 0 : inter / uni;
}
function computeMaxSegmentScore(newIndex, refIndex) {
    // Per-file block overlap ratio; then take max.
    const refBlockSet = new Set();
    for (const f of refIndex.files)
        for (const b of f.blocks)
            refBlockSet.add(b.blockHash);
    let best = 0;
    for (const f of newIndex.files) {
        if (!f.blocks.length)
            continue;
        let matched = 0;
        for (const b of f.blocks)
            if (refBlockSet.has(b.blockHash))
                matched++;
        const ratio = matched / f.blocks.length;
        if (ratio > best)
            best = ratio;
    }
    return best;
}
function selectSegmentsForCurrentVersion(newIndex, refBlockSet) {
    const segments = [];
    const segmentThreshold = 0.01; // explained by UI; real threshold driven by validator decision.
    for (const f of newIndex.files) {
        for (const b of f.blocks) {
            if (!refBlockSet.has(b.blockHash))
                continue;
            segments.push({
                filePath: f.path,
                startLine: b.startLine,
                endLine: b.endLine,
                segmentScore: 1,
                segmentThreshold,
            });
        }
    }
    return segments;
}
function extractPackageJsonLicense(codeFiles) {
    if (!codeFiles?.length)
        return undefined;
    const pj = codeFiles.find((f) => f.path.replace(/\\/g, "/").toLowerCase().endsWith("package.json"));
    if (!pj?.content || typeof pj.content !== "string")
        return undefined;
    try {
        const j = JSON.parse(pj.content);
        if (typeof j.license === "string")
            return j.license;
        const lic = j.license;
        if (lic && typeof lic.type === "string")
            return lic.type;
    }
    catch {
        /* ignore invalid JSON */
    }
    return undefined;
}
function effectiveDeclaredLicense(declared, codeFiles) {
    const d = (declared || "").trim();
    if (d)
        return d;
    return (extractPackageJsonLicense(codeFiles) || "").trim();
}
function buildPublicComplianceSummary(validators) {
    const list = Array.isArray(validators) ? validators : [];
    const pick = (id) => {
        const v = list.find((x) => x?.validatorId === id);
        if (!v)
            return null;
        return {
            validatorId: v.validatorId,
            status: v.status,
            metrics: v.metrics,
            threshold: v.threshold,
            publicExplanation: v.publicExplanation,
            evidenceRefs: v.evidenceRefs,
            resubmitPolicy: v.resubmitPolicy,
        };
    };
    return {
        plagiarism: pick("plagiarism_code_similarity") || pick("plagiarism_media_similarity"),
        license: pick("license_compliance"),
        risk: pick("risk_safety_static_scan"),
    };
}
function computeVoteStats(rows) {
    const n = rows.length;
    if (!n)
        return { count: 0, average: null, histogram: {} };
    let sum = 0;
    const histogram = {};
    for (const r of rows) {
        sum += r.score;
        const k = String(r.score);
        histogram[k] = (histogram[k] || 0) + 1;
    }
    return { count: n, average: Math.round((sum / n) * 100) / 100, histogram };
}
function computeVoteStatsByCategory(rows) {
    const buckets = {};
    for (const r of rows) {
        const k = String(r.categoryId ?? "general");
        if (!buckets[k])
            buckets[k] = [];
        buckets[k].push(r.score);
    }
    const out = {};
    for (const [k, scores] of Object.entries(buckets)) {
        const sum = scores.reduce((a, b) => a + b, 0);
        out[k] = {
            count: scores.length,
            average: scores.length === 0 ? null : Math.round((sum / scores.length) * 100) / 100,
        };
    }
    return out;
}
function safeProductKeyPrefix(raw) {
    if (typeof raw !== "string" || !raw.length)
        return null;
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(raw))
        return null;
    return raw;
}
/** Публичные агрегаты для витрин премий и «X из Y» (MVP). */
exports.planetComplianceRouter.get("/stats", async (req, res) => {
    try {
        await ensurePlanetTables();
        const [sym, voters, subs, versions, certified] = await Promise.all([
            pool.query(`SELECT COUNT(DISTINCT "userId")::int AS n FROM "PlanetCodeSymbolHistory" WHERE "validUntil" IS NULL`),
            pool.query(`SELECT COUNT(DISTINCT "userId")::int AS n FROM "PlanetVote"`),
            pool.query(`SELECT COUNT(*)::int AS n FROM "PlanetSubmission"`),
            pool.query(`SELECT COUNT(*)::int AS n FROM "PlanetArtifactVersion"`),
            pool.query(`SELECT COUNT(*)::int AS n FROM "PlanetArtifactVersion" WHERE "certificateId" IS NOT NULL`),
        ]);
        const eligibleParticipants = Number(sym.rows[0]?.n ?? 0);
        const distinctVotersAllTime = Number(voters.rows[0]?.n ?? 0);
        const pfx = safeProductKeyPrefix(req.query?.productKeyPrefix);
        let scoped = null;
        if (pfx) {
            const like = `${pfx}%`;
            const [ss, vv, cc] = await Promise.all([
                pool.query(`SELECT COUNT(*)::int AS n FROM "PlanetSubmission" WHERE "productKey" LIKE $1`, [like]),
                pool.query(`
          SELECT COUNT(*)::int AS n
          FROM "PlanetArtifactVersion" v
          JOIN "PlanetSubmission" s ON s."id" = v."submissionId"
          WHERE s."productKey" LIKE $1
          `, [like]),
                pool.query(`
          SELECT COUNT(*)::int AS n
          FROM "PlanetArtifactVersion" v
          JOIN "PlanetSubmission" s ON s."id" = v."submissionId"
          WHERE s."productKey" LIKE $1 AND v."certificateId" IS NOT NULL
          `, [like]),
            ]);
            scoped = {
                productKeyPrefix: pfx,
                submissions: Number(ss.rows[0]?.n ?? 0),
                artifactVersions: Number(vv.rows[0]?.n ?? 0),
                certifiedArtifactVersions: Number(cc.rows[0]?.n ?? 0),
            };
        }
        res.json({
            eligibleParticipants,
            distinctVotersAllTime,
            submissions: Number(subs.rows[0]?.n ?? 0),
            artifactVersions: Number(versions.rows[0]?.n ?? 0),
            certifiedArtifactVersions: Number(certified.rows[0]?.n ?? 0),
            scopedToProductKeyPrefix: scoped,
            definitions: {
                eligibleParticipants: "Пользователи с активным Planet CodeSymbol (запись в PlanetCodeSymbolHistory с validUntil IS NULL). Кандидат на метрику Y для «проголосовало X из Y».",
                distinctVotersAllTime: "Уникальные userId, хотя бы раз голосовавшие по любому артефакту Planet.",
                scopedToProductKeyPrefix: "Если передан query productKeyPrefix (безопасный префикс), дополнительно считаются submission/versions только с PlanetSubmission.productKey LIKE prefix||'%'.",
            },
            generatedAt: new Date().toISOString(),
        });
    }
    catch (e) {
        res.status(500).json({ error: e?.message || "stats failed" });
    }
});
exports.planetComplianceRouter.post("/submissions", async (req, res) => {
    await ensurePlanetTables();
    const payload = req.body || {};
    const auth = requireAuth(req, res);
    if (!auth)
        return;
    const ownerId = payload.ownerId || auth.sub;
    const artifactType = payload.artifactType;
    const title = payload.title;
    const productKey = payload.productKey;
    const tier = payload.tier || "standard";
    const declaredLicense = payload.declaredLicense;
    const generationParams = payload.generationParams || {};
    const pipelineVersion = "planet-compliance-pipeline-v0.1";
    if (!VALID_ARTIFACT_TYPES.has(artifactType)) {
        return res.status(400).json({ error: "invalid artifactType" });
    }
    if (!title || !productKey) {
        return res.status(400).json({ error: "title and productKey are required" });
    }
    // Canonicalize inputs
    let inputSetHash = "";
    let canonicalArtifactHash = "";
    let codeIndex = null;
    let mediaIndex = null;
    if ((artifactType === "code" || artifactType === "web") && Array.isArray(payload.codeFiles)) {
        const codeFiles = payload.codeFiles;
        const canon = (0, planetCodeCanon_1.canonicalizeCodeFiles)(codeFiles);
        inputSetHash = canon.inputSetHash;
        codeIndex = canon.codeIndex;
        canonicalArtifactHash = sha256Hex((0, stableStringify_1.stableStringify)({ artifactType, inputSetHash }));
    }
    else {
        const mediaFingerprint = payload.mediaFingerprint;
        const mediaDescriptor = payload.mediaDescriptor;
        if (!mediaFingerprint) {
            return res.status(400).json({
                error: "For movie/music, provide mediaFingerprint; for code/web provide codeFiles.",
            });
        }
        try {
            const canon = (0, planetMediaCanon_1.canonicalizeMediaInput)({
                artifactType: artifactType,
                mediaFingerprint,
                mediaDescriptor,
                submissionTitle: title,
            });
            inputSetHash = canon.inputSetHash;
            mediaIndex = canon.mediaIndex;
        }
        catch (e) {
            return res.status(400).json({ error: e?.message || "invalid movie/music input" });
        }
        canonicalArtifactHash = sha256Hex((0, stableStringify_1.stableStringify)({ artifactType, inputSetHash }));
    }
    const generationParamsHash = stableH({
        artifactType,
        productKey,
        tier,
        generationParams,
    });
    const submissionId = crypto_1.default.randomUUID();
    const artifactVersionId = crypto_1.default.randomUUID();
    const versionNo = 1;
    await pool.query(`
      INSERT INTO "PlanetSubmission" ("id","ownerId","title","artifactType","productKey","tier")
      VALUES ($1,$2,$3,$4,$5,$6)
    `, [submissionId, ownerId, title, artifactType, productKey, tier]);
    // Run compliance validators (sync for MVP)
    const validatorResults = [];
    // 1) Integrity binding (MVP)
    validatorResults.push({
        validatorId: "integrity_binding",
        validatorVersion: "v0.1",
        status: inputSetHash && generationParamsHash ? "passed" : "rejected",
        publicExplanation: { ok: true },
    });
    // 2) License compliance
    const licensePolicy = defaultLicensePolicy(artifactType, productKey, tier);
    const codeFilesOpt = (artifactType === "code" || artifactType === "web") && Array.isArray(payload.codeFiles)
        ? payload.codeFiles
        : undefined;
    if (artifactType === "code" || artifactType === "web") {
        const resolved = effectiveDeclaredLicense(declaredLicense, codeFilesOpt);
        const lp = resolved.toUpperCase();
        const licenseSource = (declaredLicense || "").trim()
            ? "request_declaredLicense"
            : extractPackageJsonLicense(codeFilesOpt)
                ? "package.json"
                : "none";
        if (!lp.trim()) {
            validatorResults.push({
                validatorId: "license_compliance",
                validatorVersion: "v0.1",
                status: "flagged",
                score: 0.0,
                threshold: 1.0,
                metrics: { licenseSource },
                publicExplanation: {
                    byType: [{ type: "declared_license", score: 0, threshold: 1, status: "flagged" }],
                    bySegmentsSummary: "Не предоставлена декларация лицензии (ни в запросе, ни в package.json).",
                },
                resubmitPolicy: {
                    allowed: true,
                    requiredChangeDescription: "Укажите declaredLicense или добавьте валидный package.json с полем license.",
                    minChangeRules: [{ field: "declaredLicense", minCount: 1 }],
                },
            });
        }
        else {
            const hasDisallowed = licensePolicy.disallowedLicensesKeywords.some((k) => lp.includes(k));
            if (hasDisallowed) {
                validatorResults.push({
                    validatorId: "license_compliance",
                    validatorVersion: "v0.1",
                    status: "rejected",
                    metrics: { licenseSource, resolvedLicense: resolved },
                    publicExplanation: {
                        byType: [
                            { type: "license_disallowed_keyword", score: 1, threshold: 0.5, status: "rejected" },
                        ],
                        bySegmentsSummary: `Обнаружены запрещенные ключевые слова лицензии: ${licensePolicy.disallowedLicensesKeywords.join(", ")}`,
                    },
                });
            }
            else {
                validatorResults.push({
                    validatorId: "license_compliance",
                    validatorVersion: "v0.1",
                    status: "passed",
                    metrics: { licenseSource, resolvedLicense: resolved },
                    publicExplanation: {
                        byType: [{ type: "declared_license", score: 1, threshold: 0.5, status: "passed" }],
                        bySegmentsSummary: `Принята лицензия: ${resolved} (источник: ${licenseSource}).`,
                    },
                });
            }
        }
    }
    else {
        // MVP: accept.
        validatorResults.push({
            validatorId: "license_compliance",
            validatorVersion: "v0.1",
            status: "passed",
            publicExplanation: { byType: [{ type: "license", score: 1, threshold: 0.5, status: "passed" }] },
        });
    }
    // 3) Risk & Safety (static scan for code/web)
    if (codeIndex) {
        const allText = payload.codeFiles
            .map((f) => (typeof f?.content === "string" ? f.content : ""))
            .join("\n");
        const hits = riskScanTextForSecrets(allText);
        if (hits.length) {
            validatorResults.push({
                validatorId: "risk_safety_static_scan",
                validatorVersion: "v0.1",
                status: "rejected",
                metrics: { hits },
                publicExplanation: {
                    byType: [{ type: "secrets/safety", score: 1, threshold: 0.1, status: "rejected" }],
                    bySegmentsSummary: `Обнаружены риск-паттерны: ${hits.join(", ")}`,
                },
            });
        }
        else {
            validatorResults.push({
                validatorId: "risk_safety_static_scan",
                validatorVersion: "v0.1",
                status: "passed",
                publicExplanation: { byType: [{ type: "secrets/safety", score: 0, threshold: 0.1, status: "passed" }] },
            });
        }
    }
    else {
        validatorResults.push({
            validatorId: "risk_safety_static_scan",
            validatorVersion: "v0.1",
            status: "passed",
            publicExplanation: { byType: [{ type: "mvp", score: 0, threshold: 0.1, status: "passed" }] },
        });
    }
    // 4) Plagiarism / similarity for code/web (multi-metric)
    if (codeIndex) {
        const recent = await pool.query(`
        SELECT "id","codeIndexJson"
        FROM "PlanetArtifactVersion"
        WHERE "artifactType"=$1 AND "codeIndexJson" IS NOT NULL
          AND "submissionId" <> $2
        ORDER BY "createdAt" DESC
        LIMIT 25
      `, [artifactType, submissionId]);
        const newBlockSet = new Set();
        for (const f of codeIndex.files)
            for (const b of f.blocks)
                newBlockSet.add(b.blockHash);
        let best = {
            refVersionId: null,
            overallScore: 0,
            maxSegmentScore: 0,
            refBlockSet: new Set(),
        };
        for (const row of recent.rows) {
            const refCodeIndex = jsonbMaybeParse(row.codeIndexJson);
            if (!refCodeIndex || !Array.isArray(refCodeIndex.files))
                continue;
            const refIndex = refCodeIndex;
            const refBlockSet = new Set();
            for (const f of refIndex.files)
                for (const b of f.blocks)
                    refBlockSet.add(b.blockHash);
            const overallScore = similarityJaccard(newBlockSet, refBlockSet);
            const maxSegmentScore = computeMaxSegmentScore(codeIndex, refIndex);
            if (overallScore > best.overallScore) {
                best = {
                    refVersionId: row.id,
                    overallScore,
                    maxSegmentScore,
                    refBlockSet,
                };
            }
        }
        // Multi-metric thresholds (v1 defaults)
        const overallFlagT = 0.75;
        const overallRejectT = 0.92;
        const maxSegmentFlagT = 0.40;
        const maxSegmentRejectT = 0.55;
        if (best.overallScore >= overallFlagT || best.maxSegmentScore >= maxSegmentFlagT) {
            const overallStatus = best.overallScore >= overallRejectT && best.maxSegmentScore >= maxSegmentRejectT ? "rejected" : "flagged";
            const segments = selectSegmentsForCurrentVersion(codeIndex, best.refBlockSet);
            validatorResults.push({
                validatorId: "plagiarism_code_similarity",
                validatorVersion: "v0.1",
                status: overallStatus,
                metrics: {
                    overallScore: best.overallScore,
                    maxSegmentScore: best.maxSegmentScore,
                    comparedRecentCount: recent.rowCount ?? recent.rows.length,
                    excludesSameSubmission: true,
                },
                threshold: {
                    overallFlagT,
                    overallRejectT,
                    maxSegmentFlagT,
                    maxSegmentRejectT,
                },
                evidenceRefs: {
                    segments: segments.slice(0, 40).map((s) => ({
                        filePath: s.filePath,
                        startLine: s.startLine,
                        endLine: s.endLine,
                        segmentScore: s.segmentScore,
                        segmentThreshold: s.segmentThreshold,
                    })),
                },
                publicExplanation: {
                    byType: [
                        {
                            type: "overall_block_jaccard",
                            score: best.overallScore,
                            threshold: overallStatus === "rejected" ? overallRejectT : overallFlagT,
                            status: overallStatus,
                        },
                        {
                            type: "max_segment_block_overlap",
                            score: best.maxSegmentScore,
                            threshold: overallStatus === "rejected" ? maxSegmentRejectT : maxSegmentFlagT,
                            status: overallStatus,
                        },
                    ],
                    bySegmentsSummary: overallStatus === "rejected"
                        ? "Сходство критически высокое по мульти-метрикам."
                        : "Похоже на заимствование/копирование: в версии найдены участки совпадений выше порогов.",
                },
                resubmitPolicy: {
                    allowed: true,
                    requiredChangeDescription: "Для пересдачи при плагиате необходимо заменить входные компоненты (например: изменить хотя бы один файл/модуль или блок исходника), после чего проверки выполняются заново.",
                    minChangeRules: [{ field: "changedInputFiles", minCount: 1 }],
                },
            });
        }
        else {
            validatorResults.push({
                validatorId: "plagiarism_code_similarity",
                validatorVersion: "v0.1",
                status: "passed",
                metrics: {
                    overallScore: best.overallScore,
                    maxSegmentScore: best.maxSegmentScore,
                    comparedRecentCount: recent.rowCount ?? recent.rows.length,
                    excludesSameSubmission: true,
                },
                publicExplanation: {
                    byType: [
                        { type: "overall_block_jaccard", score: best.overallScore, threshold: overallFlagT, status: "passed" },
                        { type: "max_segment_block_overlap", score: best.maxSegmentScore, threshold: maxSegmentFlagT, status: "passed" },
                    ],
                },
            });
        }
    }
    // 4b) Plagiarism / similarity for movie/music (metadata shingles + normalized fingerprint hash)
    if (mediaIndex) {
        const recentMedia = await pool.query(`
        SELECT "id","mediaIndexJson"
        FROM "PlanetArtifactVersion"
        WHERE "artifactType"=$1 AND "mediaIndexJson" IS NOT NULL
          AND "submissionId" <> $2
        ORDER BY "createdAt" DESC
        LIMIT 25
      `, [artifactType, submissionId]);
        let bestMedia = {
            refVersionId: null,
            overallScore: 0,
            maxSegmentScore: 0,
        };
        for (const row of recentMedia.rows) {
            const ref = jsonbMaybeParse(row.mediaIndexJson);
            if (!ref || ref.kind !== "planet_media_index_v1" || !Array.isArray(ref.shingles))
                continue;
            const fpDup = mediaIndex.fingerprintNormHash === ref.fingerprintNormHash;
            const shingleScore = (0, planetMediaCanon_1.jaccardStringSets)(mediaIndex.shingles, ref.shingles);
            const overallScore = fpDup ? Math.max(shingleScore, 0.99) : shingleScore;
            const maxSegmentScore = fpDup ? 1 : 0;
            if (overallScore > bestMedia.overallScore) {
                bestMedia = { refVersionId: row.id, overallScore, maxSegmentScore };
            }
        }
        const mOverallFlagT = 0.75;
        const mOverallRejectT = 0.92;
        const mMaxSegmentFlagT = 0.4;
        const mMaxSegmentRejectT = 0.55;
        if (bestMedia.overallScore >= mOverallFlagT || bestMedia.maxSegmentScore >= mMaxSegmentFlagT) {
            const overallStatus = bestMedia.overallScore >= mOverallRejectT && bestMedia.maxSegmentScore >= mMaxSegmentRejectT
                ? "rejected"
                : "flagged";
            validatorResults.push({
                validatorId: "plagiarism_media_similarity",
                validatorVersion: "v0.1",
                status: overallStatus,
                metrics: {
                    overallScore: bestMedia.overallScore,
                    maxSegmentScore: bestMedia.maxSegmentScore,
                    fingerprintMatch: bestMedia.maxSegmentScore >= 1,
                    comparedRecentCount: recentMedia.rowCount ?? recentMedia.rows.length,
                    excludesSameSubmission: true,
                    refArtifactVersionId: bestMedia.refVersionId,
                },
                threshold: {
                    overallFlagT: mOverallFlagT,
                    overallRejectT: mOverallRejectT,
                    maxSegmentFlagT: mMaxSegmentFlagT,
                    maxSegmentRejectT: mMaxSegmentRejectT,
                },
                evidenceRefs: {
                    media: {
                        method: "char_5gram_jaccard_plus_fingerprint_hash",
                        refArtifactVersionId: bestMedia.refVersionId,
                    },
                },
                publicExplanation: {
                    byType: [
                        {
                            type: "media_shingle_jaccard",
                            score: bestMedia.overallScore,
                            threshold: overallStatus === "rejected" ? mOverallRejectT : mOverallFlagT,
                            status: overallStatus,
                        },
                        {
                            type: "fingerprint_id_duplicate",
                            score: bestMedia.maxSegmentScore,
                            threshold: overallStatus === "rejected" ? mMaxSegmentRejectT : mMaxSegmentFlagT,
                            status: overallStatus,
                        },
                    ],
                    bySegmentsSummary: overallStatus === "rejected"
                        ? "Критически высокое сходство медиа-метаданных или дубликат нормализованного fingerprint."
                        : "Похоже на дубликат или сильное пересечение метаданных (шинглы + fingerprint).",
                },
                resubmitPolicy: {
                    allowed: true,
                    requiredChangeDescription: "Измените нормализованный fingerprint и/или метаданные (title/artist/ISRC/externalId), чтобы отличить выпуск.",
                    minChangeRules: [{ field: "mediaFingerprintOrDescriptor", minCount: 1 }],
                },
            });
        }
        else {
            validatorResults.push({
                validatorId: "plagiarism_media_similarity",
                validatorVersion: "v0.1",
                status: "passed",
                metrics: {
                    overallScore: bestMedia.overallScore,
                    maxSegmentScore: bestMedia.maxSegmentScore,
                    comparedRecentCount: recentMedia.rowCount ?? recentMedia.rows.length,
                    excludesSameSubmission: true,
                },
                publicExplanation: {
                    byType: [
                        { type: "media_shingle_jaccard", score: bestMedia.overallScore, threshold: mOverallFlagT, status: "passed" },
                        { type: "fingerprint_id_duplicate", score: bestMedia.maxSegmentScore, threshold: mMaxSegmentFlagT, status: "passed" },
                    ],
                },
            });
        }
    }
    // 5) Style/policy conformance (MVP: declared only)
    validatorResults.push({
        validatorId: "style_policy_conformance",
        validatorVersion: "v0.1",
        status: "passed",
        publicExplanation: { byType: [{ type: "declared_metadata", score: 1, threshold: 0.5, status: "passed" }] },
    });
    // 6) Full CI verification (MVP: static verification bundle for now)
    validatorResults.push({
        validatorId: "full_ci_verification_static",
        validatorVersion: "v0.1",
        status: "passed",
        publicExplanation: {
            byType: [{ type: "static-ci-bundle", score: 1, threshold: 0.5, status: "passed" }],
            bySegmentsSummary: "В MVP выполняются статические проверки целостности/безопасности/структуры пакета.",
        },
    });
    const overallStatus = decideOverallStatus(validatorResults);
    const evidenceRoot = computeEvidenceRoot({
        inputSetHash,
        generationParamsHash,
        pipelineVersion,
        validatorResults,
        canonicalArtifactHash,
    });
    const validatorResultsJson = validatorResults;
    const codeIndexJson = codeIndex ? codeIndex : null;
    await pool.query(`
      INSERT INTO "PlanetArtifactVersion"
        ("id","submissionId","versionNo","ownerId","artifactType","productKey","tier","status","inputSetHash","generationParamsHash","canonicalArtifactHash","evidenceRoot","validatorResultsJson","codeIndexJson","mediaIndexJson","parentVersionId")
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    `, [
        artifactVersionId,
        submissionId,
        versionNo,
        ownerId,
        artifactType,
        productKey,
        tier,
        overallStatus,
        inputSetHash,
        generationParamsHash,
        canonicalArtifactHash,
        evidenceRoot,
        validatorResultsJson,
        codeIndexJson ? codeIndexJson : null,
        mediaIndex ? mediaIndex : null,
        null,
    ]);
    let certificate = null;
    if (overallStatus === "passed") {
        const certificateId = crypto_1.default.randomUUID();
        const manifest = policyManifest(artifactType, productKey, tier);
        const policyManifestHash = sha256Hex((0, stableStringify_1.stableStringify)(manifest));
        const signaturePayload = {
            bureau: manifest.bureau,
            policyManifestHash,
            evidenceRoot,
            certificateId,
            artifactVersionId,
        };
        const signature = hmacSha256Hex(productSecretFor(productKey), (0, stableStringify_1.stableStringify)(signaturePayload));
        const publicPayloadJson = {
            certificateId,
            artifactVersionId,
            submissionId,
            status: "issued",
            artifactType,
            productKey,
            tier,
            evidenceRoot,
            policyManifestHash,
            signatureAlgo: "HMAC-SHA256",
        };
        const privatePayloadJson = {
            evidenceRoot,
            validatorResultsJson,
            pipelineVersion,
            signaturePayload,
        };
        await pool.query(`
        INSERT INTO "PlanetCertificate"
          ("id","artifactVersionId","ownerId","status","publicPayloadJson","privatePayloadJson","policyManifestHash","evidenceRoot","signature","revokedAt","revokeReason")
        VALUES
          ($1,$2,$3,'issued',$4,$5,$6,$7,$8,NULL,NULL)
      `, [
            certificateId,
            artifactVersionId,
            ownerId,
            publicPayloadJson,
            privatePayloadJson,
            policyManifestHash,
            evidenceRoot,
            signature,
        ]);
        await pool.query(`
        UPDATE "PlanetArtifactVersion"
        SET "certificateId"=$1
        WHERE "id"=$2
      `, [certificateId, artifactVersionId]);
        certificate = { certificateId, publicPayloadJson, signature };
    }
    return res.json({
        submissionId,
        artifactVersionId,
        status: overallStatus,
        evidenceRoot,
        validators: validatorResults,
        certificate,
    });
});
exports.planetComplianceRouter.post("/submissions/:submissionId/resubmit", async (req, res) => {
    await ensurePlanetTables();
    const auth = requireAuth(req, res);
    if (!auth)
        return;
    const payload = req.body || {};
    const submissionId = req.params.submissionId;
    const ownerId = payload.ownerId || auth.sub;
    const recent = await pool.query(`
      SELECT *
      FROM "PlanetArtifactVersion"
      WHERE "submissionId"=$1 AND "ownerId"=$2
      ORDER BY "versionNo" DESC
      LIMIT 1
    `, [submissionId, ownerId]);
    if (!recent.rows?.[0]) {
        return res.status(404).json({ error: "submission latest version not found" });
    }
    const latest = recent.rows[0];
    const subTitle = await pool.query(`SELECT "title" FROM "PlanetSubmission" WHERE "id"=$1`, [submissionId]);
    const submissionTitleFromDb = subTitle.rows?.[0]?.title;
    const parentVersionIdForInsert = latest.id;
    const artifactType = latest.artifactType;
    const productKey = latest.productKey;
    const tier = latest.tier;
    const nextVersionNo = Number(latest.versionNo || 0) + 1;
    // Canonicalize new inputs
    let inputSetHash = "";
    let canonicalArtifactHash = "";
    let codeIndex = null;
    let mediaIndex = null;
    if ((artifactType === "code" || artifactType === "web") && Array.isArray(payload.codeFiles)) {
        const codeFiles = payload.codeFiles;
        const canon = (0, planetCodeCanon_1.canonicalizeCodeFiles)(codeFiles);
        inputSetHash = canon.inputSetHash;
        codeIndex = canon.codeIndex;
        canonicalArtifactHash = sha256Hex((0, stableStringify_1.stableStringify)({ artifactType, inputSetHash }));
        // Enforce “changed inputs” policy for plagiarism resubmit.
        const prevCodeIndex = jsonbMaybeParse(latest.codeIndexJson);
        const prevFileHashes = new Map();
        if (prevCodeIndex?.files?.length) {
            for (const f of prevCodeIndex.files)
                prevFileHashes.set(f.path, f.fileHash);
        }
        const newFileHashes = new Map();
        if (canon.fileHashes?.length) {
            for (const fh of canon.fileHashes)
                newFileHashes.set(fh.path, fh.fileHash);
        }
        let changedCount = 0;
        for (const [path, newHash] of newFileHashes.entries()) {
            if (prevFileHashes.get(path) !== newHash)
                changedCount++;
        }
        if (changedCount < 1) {
            return res.status(400).json({
                error: "resubmit rejected: insufficient input changes (need at least 1 changed file hash)",
                changedCount,
            });
        }
    }
    else {
        const mediaFingerprint = payload.mediaFingerprint;
        const mediaDescriptor = payload.mediaDescriptor;
        const title = payload.title || submissionTitleFromDb;
        if (!mediaFingerprint) {
            return res.status(400).json({
                error: "For movie/music, provide mediaFingerprint; for code/web provide codeFiles.",
            });
        }
        try {
            const canon = (0, planetMediaCanon_1.canonicalizeMediaInput)({
                artifactType: artifactType,
                mediaFingerprint,
                mediaDescriptor,
                submissionTitle: title,
            });
            inputSetHash = canon.inputSetHash;
            mediaIndex = canon.mediaIndex;
        }
        catch (e) {
            return res.status(400).json({ error: e?.message || "invalid movie/music input" });
        }
        if (inputSetHash === latest.inputSetHash) {
            return res.status(400).json({
                error: "resubmit rejected: media inputs unchanged (fingerprint/descriptor vs previous version)",
            });
        }
        canonicalArtifactHash = sha256Hex((0, stableStringify_1.stableStringify)({ artifactType, inputSetHash }));
    }
    const generationParams = payload.generationParams || {};
    const generationParamsHash = stableH({
        artifactType,
        productKey,
        tier,
        generationParams,
    });
    const pipelineVersion = "planet-compliance-pipeline-v0.1";
    const validatorResults = [];
    validatorResults.push({
        validatorId: "integrity_binding",
        validatorVersion: "v0.1",
        status: inputSetHash && generationParamsHash ? "passed" : "rejected",
        publicExplanation: { ok: true },
    });
    // License compliance (same logic as create)
    const declaredLicense = payload.declaredLicense;
    const licensePolicy = defaultLicensePolicy(artifactType, productKey, tier);
    const codeFilesOptResubmit = (artifactType === "code" || artifactType === "web") && Array.isArray(payload.codeFiles)
        ? payload.codeFiles
        : undefined;
    if (artifactType === "code" || artifactType === "web") {
        const resolved = effectiveDeclaredLicense(declaredLicense, codeFilesOptResubmit);
        const lp = resolved.toUpperCase();
        const licenseSource = (declaredLicense || "").trim()
            ? "request_declaredLicense"
            : extractPackageJsonLicense(codeFilesOptResubmit)
                ? "package.json"
                : "none";
        if (!lp.trim()) {
            validatorResults.push({
                validatorId: "license_compliance",
                validatorVersion: "v0.1",
                status: "flagged",
                metrics: { licenseSource },
                publicExplanation: {
                    byType: [{ type: "declared_license", score: 0, threshold: 1, status: "flagged" }],
                    bySegmentsSummary: "Не предоставлена декларация лицензии (ни в запросе, ни в package.json).",
                },
                resubmitPolicy: {
                    allowed: true,
                    requiredChangeDescription: "Укажите declaredLicense или добавьте валидный package.json с полем license.",
                    minChangeRules: [{ field: "declaredLicense", minCount: 1 }],
                },
            });
        }
        else {
            const hasDisallowed = licensePolicy.disallowedLicensesKeywords.some((k) => lp.includes(k));
            if (hasDisallowed) {
                validatorResults.push({
                    validatorId: "license_compliance",
                    validatorVersion: "v0.1",
                    status: "rejected",
                    metrics: { licenseSource, resolvedLicense: resolved },
                    publicExplanation: { byType: [{ type: "license_disallowed_keyword", score: 1, threshold: 0.5, status: "rejected" }] },
                });
            }
            else {
                validatorResults.push({
                    validatorId: "license_compliance",
                    validatorVersion: "v0.1",
                    status: "passed",
                    metrics: { licenseSource, resolvedLicense: resolved },
                    publicExplanation: {
                        byType: [{ type: "declared_license", score: 1, threshold: 0.5, status: "passed" }],
                        bySegmentsSummary: `Принята лицензия: ${resolved} (источник: ${licenseSource}).`,
                    },
                });
            }
        }
    }
    else {
        validatorResults.push({
            validatorId: "license_compliance",
            validatorVersion: "v0.1",
            status: "passed",
            publicExplanation: { byType: [{ type: "license", score: 1, threshold: 0.5, status: "passed" }] },
        });
    }
    if (codeIndex) {
        const allText = payload.codeFiles
            .map((f) => (typeof f?.content === "string" ? f.content : ""))
            .join("\n");
        const hits = riskScanTextForSecrets(allText);
        if (hits.length) {
            validatorResults.push({
                validatorId: "risk_safety_static_scan",
                validatorVersion: "v0.1",
                status: "rejected",
                metrics: { hits },
                publicExplanation: {
                    byType: [{ type: "secrets/safety", score: 1, threshold: 0.1, status: "rejected" }],
                    bySegmentsSummary: `Обнаружены риск-паттерны: ${hits.join(", ")}`,
                },
            });
        }
        else {
            validatorResults.push({
                validatorId: "risk_safety_static_scan",
                validatorVersion: "v0.1",
                status: "passed",
                publicExplanation: { byType: [{ type: "secrets/safety", score: 0, threshold: 0.1, status: "passed" }] },
            });
        }
    }
    else {
        validatorResults.push({
            validatorId: "risk_safety_static_scan",
            validatorVersion: "v0.1",
            status: "passed",
            publicExplanation: { byType: [{ type: "mvp", score: 0, threshold: 0.1, status: "passed" }] },
        });
    }
    // Plagiarism similarity (exclude other versions of the same submission)
    if (codeIndex) {
        const recent = await pool.query(`
        SELECT "id","codeIndexJson"
        FROM "PlanetArtifactVersion"
        WHERE "artifactType"=$1 AND "codeIndexJson" IS NOT NULL
          AND "submissionId" <> $2
        ORDER BY "createdAt" DESC
        LIMIT 25
      `, [artifactType, submissionId]);
        const newBlockSet = new Set();
        for (const f of codeIndex.files)
            for (const b of f.blocks)
                newBlockSet.add(b.blockHash);
        let best = {
            refVersionId: null,
            overallScore: 0,
            maxSegmentScore: 0,
            refBlockSet: new Set(),
        };
        for (const row of recent.rows) {
            const refCodeIndex = jsonbMaybeParse(row.codeIndexJson);
            if (!refCodeIndex || !Array.isArray(refCodeIndex.files))
                continue;
            const refIndex = refCodeIndex;
            const refBlockSet = new Set();
            for (const f of refIndex.files)
                for (const b of f.blocks)
                    refBlockSet.add(b.blockHash);
            const overallScore = similarityJaccard(newBlockSet, refBlockSet);
            const maxSegmentScore = computeMaxSegmentScore(codeIndex, refIndex);
            if (overallScore > best.overallScore) {
                best = { refVersionId: row.id, overallScore, maxSegmentScore, refBlockSet };
            }
        }
        const overallFlagT = 0.75;
        const overallRejectT = 0.92;
        const maxSegmentFlagT = 0.40;
        const maxSegmentRejectT = 0.55;
        if (best.overallScore >= overallFlagT || best.maxSegmentScore >= maxSegmentFlagT) {
            const overallStatus = best.overallScore >= overallRejectT && best.maxSegmentScore >= maxSegmentRejectT ? "rejected" : "flagged";
            const segments = selectSegmentsForCurrentVersion(codeIndex, best.refBlockSet);
            validatorResults.push({
                validatorId: "plagiarism_code_similarity",
                validatorVersion: "v0.1",
                status: overallStatus,
                metrics: {
                    overallScore: best.overallScore,
                    maxSegmentScore: best.maxSegmentScore,
                    comparedRecentCount: recent.rowCount ?? recent.rows.length,
                    excludesSameSubmission: true,
                },
                threshold: { overallFlagT, overallRejectT, maxSegmentFlagT, maxSegmentRejectT },
                evidenceRefs: {
                    segments: segments.slice(0, 40).map((s) => ({
                        filePath: s.filePath,
                        startLine: s.startLine,
                        endLine: s.endLine,
                        segmentScore: s.segmentScore,
                        segmentThreshold: s.segmentThreshold,
                    })),
                },
                publicExplanation: {
                    byType: [
                        { type: "overall_block_jaccard", score: best.overallScore, threshold: overallStatus === "rejected" ? overallRejectT : overallFlagT, status: overallStatus },
                        { type: "max_segment_block_overlap", score: best.maxSegmentScore, threshold: overallStatus === "rejected" ? maxSegmentRejectT : maxSegmentFlagT, status: overallStatus },
                    ],
                    bySegmentsSummary: overallStatus === "rejected"
                        ? "Сходство критически высокое по мульти-метрикам."
                        : "Похоже на заимствование/копирование: в версии найдены участки совпадений выше порогов.",
                },
                resubmitPolicy: {
                    allowed: true,
                    requiredChangeDescription: "Для пересдачи при плагиате необходимо заменить входные компоненты (изменить хотя бы один файл/модуль), после чего проверки выполняются заново.",
                    minChangeRules: [{ field: "changedInputFiles", minCount: 1 }],
                },
            });
        }
        else {
            validatorResults.push({
                validatorId: "plagiarism_code_similarity",
                validatorVersion: "v0.1",
                status: "passed",
                metrics: {
                    overallScore: best.overallScore,
                    maxSegmentScore: best.maxSegmentScore,
                    comparedRecentCount: recent.rowCount ?? recent.rows.length,
                    excludesSameSubmission: true,
                },
                publicExplanation: {
                    byType: [
                        { type: "overall_block_jaccard", score: best.overallScore, threshold: overallFlagT, status: "passed" },
                        { type: "max_segment_block_overlap", score: best.maxSegmentScore, threshold: maxSegmentFlagT, status: "passed" },
                    ],
                },
            });
        }
    }
    if (mediaIndex) {
        const recentMedia = await pool.query(`
        SELECT "id","mediaIndexJson"
        FROM "PlanetArtifactVersion"
        WHERE "artifactType"=$1 AND "mediaIndexJson" IS NOT NULL
          AND "submissionId" <> $2
        ORDER BY "createdAt" DESC
        LIMIT 25
      `, [artifactType, submissionId]);
        let bestMedia = {
            refVersionId: null,
            overallScore: 0,
            maxSegmentScore: 0,
        };
        for (const row of recentMedia.rows) {
            const ref = jsonbMaybeParse(row.mediaIndexJson);
            if (!ref || ref.kind !== "planet_media_index_v1" || !Array.isArray(ref.shingles))
                continue;
            const fpDup = mediaIndex.fingerprintNormHash === ref.fingerprintNormHash;
            const shingleScore = (0, planetMediaCanon_1.jaccardStringSets)(mediaIndex.shingles, ref.shingles);
            const overallScore = fpDup ? Math.max(shingleScore, 0.99) : shingleScore;
            const maxSegmentScore = fpDup ? 1 : 0;
            if (overallScore > bestMedia.overallScore) {
                bestMedia = { refVersionId: row.id, overallScore, maxSegmentScore };
            }
        }
        const mOverallFlagT = 0.75;
        const mOverallRejectT = 0.92;
        const mMaxSegmentFlagT = 0.4;
        const mMaxSegmentRejectT = 0.55;
        if (bestMedia.overallScore >= mOverallFlagT || bestMedia.maxSegmentScore >= mMaxSegmentFlagT) {
            const overallStatus = bestMedia.overallScore >= mOverallRejectT && bestMedia.maxSegmentScore >= mMaxSegmentRejectT
                ? "rejected"
                : "flagged";
            validatorResults.push({
                validatorId: "plagiarism_media_similarity",
                validatorVersion: "v0.1",
                status: overallStatus,
                metrics: {
                    overallScore: bestMedia.overallScore,
                    maxSegmentScore: bestMedia.maxSegmentScore,
                    fingerprintMatch: bestMedia.maxSegmentScore >= 1,
                    comparedRecentCount: recentMedia.rowCount ?? recentMedia.rows.length,
                    excludesSameSubmission: true,
                    refArtifactVersionId: bestMedia.refVersionId,
                },
                threshold: {
                    overallFlagT: mOverallFlagT,
                    overallRejectT: mOverallRejectT,
                    maxSegmentFlagT: mMaxSegmentFlagT,
                    maxSegmentRejectT: mMaxSegmentRejectT,
                },
                evidenceRefs: {
                    media: {
                        method: "char_5gram_jaccard_plus_fingerprint_hash",
                        refArtifactVersionId: bestMedia.refVersionId,
                    },
                },
                publicExplanation: {
                    byType: [
                        {
                            type: "media_shingle_jaccard",
                            score: bestMedia.overallScore,
                            threshold: overallStatus === "rejected" ? mOverallRejectT : mOverallFlagT,
                            status: overallStatus,
                        },
                        {
                            type: "fingerprint_id_duplicate",
                            score: bestMedia.maxSegmentScore,
                            threshold: overallStatus === "rejected" ? mMaxSegmentRejectT : mMaxSegmentFlagT,
                            status: overallStatus,
                        },
                    ],
                    bySegmentsSummary: overallStatus === "rejected"
                        ? "Критически высокое сходство медиа-метаданных или дубликат нормализованного fingerprint."
                        : "Похоже на дубликат или сильное пересечение метаданных (шинглы + fingerprint).",
                },
                resubmitPolicy: {
                    allowed: true,
                    requiredChangeDescription: "Измените нормализованный fingerprint и/или метаданные (title/artist/ISRC/externalId), чтобы отличить выпуск.",
                    minChangeRules: [{ field: "mediaFingerprintOrDescriptor", minCount: 1 }],
                },
            });
        }
        else {
            validatorResults.push({
                validatorId: "plagiarism_media_similarity",
                validatorVersion: "v0.1",
                status: "passed",
                metrics: {
                    overallScore: bestMedia.overallScore,
                    maxSegmentScore: bestMedia.maxSegmentScore,
                    comparedRecentCount: recentMedia.rowCount ?? recentMedia.rows.length,
                    excludesSameSubmission: true,
                },
                publicExplanation: {
                    byType: [
                        { type: "media_shingle_jaccard", score: bestMedia.overallScore, threshold: mOverallFlagT, status: "passed" },
                        { type: "fingerprint_id_duplicate", score: bestMedia.maxSegmentScore, threshold: mMaxSegmentFlagT, status: "passed" },
                    ],
                },
            });
        }
    }
    validatorResults.push({
        validatorId: "style_policy_conformance",
        validatorVersion: "v0.1",
        status: "passed",
        publicExplanation: { byType: [{ type: "declared_metadata", score: 1, threshold: 0.5, status: "passed" }] },
    });
    validatorResults.push({
        validatorId: "full_ci_verification_static",
        validatorVersion: "v0.1",
        status: "passed",
        publicExplanation: {
            byType: [{ type: "static-ci-bundle", score: 1, threshold: 0.5, status: "passed" }],
            bySegmentsSummary: "В MVP выполняются статические проверки.",
        },
    });
    const overallStatus = decideOverallStatus(validatorResults);
    const evidenceRoot = computeEvidenceRoot({
        inputSetHash,
        generationParamsHash,
        pipelineVersion,
        validatorResults,
        canonicalArtifactHash,
    });
    const artifactVersionId = crypto_1.default.randomUUID();
    await pool.query(`
      INSERT INTO "PlanetArtifactVersion"
        ("id","submissionId","versionNo","ownerId","artifactType","productKey","tier","status","inputSetHash","generationParamsHash","canonicalArtifactHash","evidenceRoot","validatorResultsJson","codeIndexJson","mediaIndexJson","parentVersionId")
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    `, [
        artifactVersionId,
        submissionId,
        nextVersionNo,
        ownerId,
        artifactType,
        productKey,
        tier,
        overallStatus,
        inputSetHash,
        generationParamsHash,
        canonicalArtifactHash,
        evidenceRoot,
        validatorResults,
        codeIndex ? codeIndex : null,
        mediaIndex ? mediaIndex : null,
        parentVersionIdForInsert,
    ]);
    let certificate = null;
    if (overallStatus === "passed") {
        const certificateId = crypto_1.default.randomUUID();
        const manifest = policyManifest(artifactType, productKey, tier);
        const policyManifestHash = sha256Hex((0, stableStringify_1.stableStringify)(manifest));
        const signaturePayload = {
            bureau: manifest.bureau,
            policyManifestHash,
            evidenceRoot,
            certificateId,
            artifactVersionId,
        };
        const signature = hmacSha256Hex(productSecretFor(productKey), (0, stableStringify_1.stableStringify)(signaturePayload));
        const publicPayloadJson = {
            certificateId,
            artifactVersionId,
            submissionId,
            status: "issued",
            artifactType,
            productKey,
            tier,
            evidenceRoot,
            policyManifestHash,
            signatureAlgo: "HMAC-SHA256",
        };
        const privatePayloadJson = {
            evidenceRoot,
            validatorResultsJson: validatorResults,
            pipelineVersion,
            signaturePayload,
        };
        await pool.query(`
        INSERT INTO "PlanetCertificate"
          ("id","artifactVersionId","ownerId","status","publicPayloadJson","privatePayloadJson","policyManifestHash","evidenceRoot","signature","revokedAt","revokeReason")
        VALUES
          ($1,$2,$3,'issued',$4,$5,$6,$7,$8,NULL,NULL)
      `, [
            certificateId,
            artifactVersionId,
            ownerId,
            publicPayloadJson,
            privatePayloadJson,
            policyManifestHash,
            evidenceRoot,
            signature,
        ]);
        await pool.query(`
        UPDATE "PlanetArtifactVersion"
        SET "certificateId"=$1
        WHERE "id"=$2
      `, [certificateId, artifactVersionId]);
        certificate = { certificateId, publicPayloadJson, signature };
    }
    return res.json({
        submissionId,
        artifactVersionId,
        status: overallStatus,
        evidenceRoot,
        validators: validatorResults,
        certificate,
    });
});
exports.planetComplianceRouter.get("/submissions/:submissionId/latest", async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth)
        return;
    await ensurePlanetTables();
    const submissionId = req.params.submissionId;
    const ownerId = auth.sub;
    const r = await pool.query(`
      SELECT *
      FROM "PlanetArtifactVersion"
      WHERE "submissionId"=$1 AND "ownerId"=$2
      ORDER BY "versionNo" DESC
      LIMIT 1
    `, [submissionId, ownerId]);
    if (!r.rows?.[0])
        return res.status(404).json({ error: "not found" });
    return res.json({ item: r.rows[0] });
});
// --- CodeSymbol (псевдоним для публичного аудита голосов) ---
function genCodeSymbol() {
    const raw = crypto_1.default.randomBytes(8).toString("hex").toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}
async function getOrCreateActiveCodeSymbol(userId) {
    await ensurePlanetTables();
    const cur = await pool.query(`
      SELECT "codeSymbol" FROM "PlanetCodeSymbolHistory"
      WHERE "userId"=$1 AND "validUntil" IS NULL
      ORDER BY "validFrom" DESC
      LIMIT 1
    `, [userId]);
    if (cur.rows?.[0]?.codeSymbol)
        return cur.rows[0].codeSymbol;
    const id = crypto_1.default.randomUUID();
    const sym = genCodeSymbol();
    await pool.query(`
      INSERT INTO "PlanetCodeSymbolHistory" ("id","userId","codeSymbol","validFrom","validUntil")
      VALUES ($1,$2,$3,NOW(),NULL)
    `, [id, userId, sym]);
    return sym;
}
exports.planetComplianceRouter.get("/me/code-symbol", async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth)
        return;
    try {
        const codeSymbol = await getOrCreateActiveCodeSymbol(auth.sub);
        res.json({ codeSymbol, userId: auth.sub });
    }
    catch (e) {
        res.status(500).json({ error: "code_symbol_failed", details: e?.message });
    }
});
exports.planetComplianceRouter.post("/me/code-symbol/rotate", async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth)
        return;
    try {
        await ensurePlanetTables();
        await pool.query(`
      UPDATE "PlanetCodeSymbolHistory"
      SET "validUntil" = NOW()
      WHERE "userId"=$1 AND "validUntil" IS NULL
      `, [auth.sub]);
        const id = crypto_1.default.randomUUID();
        const sym = genCodeSymbol();
        await pool.query(`
      INSERT INTO "PlanetCodeSymbolHistory" ("id","userId","codeSymbol","validFrom","validUntil")
      VALUES ($1,$2,$3,NOW(),NULL)
    `, [id, auth.sub, sym]);
        res.json({
            codeSymbol: sym,
            warning: "Прошлые голоса в снапшотах остаются привязаны к прежнему символу на момент голосования; новый символ используется только для новых действий.",
        });
    }
    catch (e) {
        res.status(500).json({ error: "rotate_failed", details: e?.message });
    }
});
function computeVoteLeafHash(v) {
    return sha256Hex((0, stableStringify_1.stableStringify)({
        kind: "planet_vote_leaf",
        v: 1,
        voteId: v.voteId,
        codeSymbol: v.codeSymbol,
        artifactVersionId: v.artifactVersionId,
        categoryId: v.categoryId,
        score: v.score,
        createdAt: v.createdAt,
    }));
}
/** Публичная лента сертифицированных работ (витрины, демо, инвесторы). */
exports.planetComplianceRouter.get("/artifacts/recent", async (req, res) => {
    try {
        await ensurePlanetTables();
        const limRaw = req.query?.limit;
        let limit = 8;
        if (typeof limRaw === "string") {
            const n = parseInt(limRaw, 10);
            if (Number.isFinite(n) && n >= 1 && n <= 50)
                limit = n;
        }
        const sortRaw = req.query?.sort;
        const sort = sortRaw === "rating" || sortRaw === "votes" || sortRaw === "created"
            ? sortRaw
            : "created";
        const pfx = safeProductKeyPrefix(req.query?.productKeyPrefix);
        const typeRaw = req.query?.artifactType;
        const artifactType = typeof typeRaw === "string" && VALID_ARTIFACT_TYPES.has(typeRaw) ? typeRaw : null;
        const params = [];
        let idx = 1;
        let where = `v."certificateId" IS NOT NULL`;
        if (pfx) {
            params.push(`${pfx}%`);
            where += ` AND s."productKey" LIKE $${idx++}`;
        }
        if (artifactType) {
            params.push(artifactType);
            where += ` AND v."artifactType" = $${idx++}`;
        }
        params.push(limit);
        const orderBy = sort === "rating"
            ? `vt."avg" DESC NULLS LAST, v."createdAt" DESC`
            : sort === "votes"
                ? `COALESCE(vt."cnt", 0) DESC, v."createdAt" DESC`
                : `v."createdAt" DESC`;
        const r = await pool.query(`
      SELECT
        v."id",
        v."artifactType",
        v."versionNo",
        v."createdAt",
        s."title" AS "submissionTitle",
        s."productKey",
        COALESCE(vt."cnt", 0)::int AS "voteCount",
        vt."avg" AS "voteAverage"
      FROM "PlanetArtifactVersion" v
      JOIN "PlanetSubmission" s ON s."id" = v."submissionId"
      LEFT JOIN (
        SELECT "artifactVersionId",
          COUNT(*)::int AS "cnt",
          ROUND(AVG("score")::numeric, 2) AS "avg"
        FROM "PlanetVote"
        GROUP BY "artifactVersionId"
      ) vt ON vt."artifactVersionId" = v."id"
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT $${idx}
      `, params);
        res.json({
            items: r.rows,
            sort,
            generatedAt: new Date().toISOString(),
        });
    }
    catch (e) {
        res.status(500).json({ error: e?.message || "recent failed" });
    }
});
exports.planetComplianceRouter.post("/artifacts/:artifactVersionId/vote", async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth)
        return;
    await ensurePlanetTables();
    const { artifactVersionId } = req.params;
    const { score, categoryId = "general" } = req.body || {};
    const s = Number(score);
    if (!Number.isFinite(s) || s < 1 || s > 5) {
        return res.status(400).json({ error: "score must be 1..5" });
    }
    const av = await pool.query(`SELECT "id","certificateId" FROM "PlanetArtifactVersion" WHERE "id"=$1`, [artifactVersionId]);
    if (!av.rows?.[0])
        return res.status(404).json({ error: "artifact version not found" });
    if (!av.rows[0].certificateId) {
        return res.status(403).json({ error: "voting allowed only for certified (passed) artifacts" });
    }
    const codeSymbol = await getOrCreateActiveCodeSymbol(auth.sub);
    const voteId = crypto_1.default.randomUUID();
    const createdAt = new Date().toISOString();
    const leafHash = computeVoteLeafHash({
        voteId,
        codeSymbol,
        artifactVersionId,
        categoryId: String(categoryId),
        score: s,
        createdAt,
    });
    try {
        await pool.query(`
      INSERT INTO "PlanetVote" ("id","userId","artifactVersionId","categoryId","score","codeSymbol","leafHash","createdAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz)
      `, [voteId, auth.sub, artifactVersionId, String(categoryId), s, codeSymbol, leafHash, createdAt]);
    }
    catch (e) {
        if (e?.code === "23505") {
            return res.status(409).json({ error: "already voted for this artifact/category" });
        }
        throw e;
    }
    res.status(201).json({
        voteId,
        codeSymbol,
        leafHash,
        score: s,
        categoryId: String(categoryId),
        artifactVersionId,
        createdAt,
    });
});
exports.planetComplianceRouter.get("/artifacts/:artifactVersionId/public", async (req, res) => {
    await ensurePlanetTables();
    const { artifactVersionId } = req.params;
    const av = await pool.query(`
    SELECT v.*, s."title" as "submissionTitle"
    FROM "PlanetArtifactVersion" v
    JOIN "PlanetSubmission" s ON s."id" = v."submissionId"
    WHERE v."id"=$1
    `, [artifactVersionId]);
    if (!av.rows?.[0])
        return res.status(404).json({ error: "not found" });
    const row = av.rows[0];
    if (!row.certificateId) {
        return res.status(404).json({ error: "not published (no certificate)" });
    }
    const cert = await pool.query(`SELECT * FROM "PlanetCertificate" WHERE "id"=$1`, [row.certificateId]);
    const votes = await pool.query(`
    SELECT "codeSymbol","score","categoryId","createdAt","leafHash"
    FROM "PlanetVote"
    WHERE "artifactVersionId"=$1
    ORDER BY "createdAt" ASC
    `, [artifactVersionId]);
    const snap = await pool.query(`
    SELECT * FROM "PlanetVoteSnapshot"
    WHERE "artifactVersionId"=$1
    ORDER BY "createdAt" DESC
    LIMIT 1
    `, [artifactVersionId]);
    const validatorsParsed = jsonbMaybeParse(row.validatorResultsJson);
    const voteRows = votes.rows.map((r) => ({
        codeSymbol: r.codeSymbol,
        score: r.score,
        categoryId: r.categoryId,
        createdAt: r.createdAt,
        leafHash: r.leafHash,
    }));
    let parentVersion = null;
    if (row.parentVersionId) {
        const pv = await pool.query(`
      SELECT "id","versionNo","status","evidenceRoot","canonicalArtifactHash","certificateId","createdAt"
      FROM "PlanetArtifactVersion"
      WHERE "id"=$1
      `, [row.parentVersionId]);
        parentVersion = pv.rows?.[0] || null;
    }
    res.json({
        artifact: {
            id: row.id,
            submissionId: row.submissionId,
            submissionTitle: row.submissionTitle,
            artifactType: row.artifactType,
            status: row.status,
            evidenceRoot: row.evidenceRoot,
            versionNo: row.versionNo,
            parentVersionId: row.parentVersionId || null,
        },
        certificate: cert.rows?.[0] || null,
        validators: validatorsParsed,
        complianceSummary: buildPublicComplianceSummary(validatorsParsed),
        versionLineage: {
            parentVersionId: row.parentVersionId || null,
            parentVersion,
        },
        votes: voteRows,
        voteStats: computeVoteStats(voteRows),
        voteStatsByCategory: computeVoteStatsByCategory(voteRows),
        latestSnapshot: snap.rows?.[0] || null,
    });
});
exports.planetComplianceRouter.post("/artifacts/:artifactVersionId/votes/snapshot", async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth)
        return;
    await ensurePlanetTables();
    const { artifactVersionId } = req.params;
    const { seasonId } = req.body || {};
    if (!seasonId || typeof seasonId !== "string") {
        return res.status(400).json({ error: "seasonId required" });
    }
    const av = await pool.query(`SELECT "id","ownerId","certificateId" FROM "PlanetArtifactVersion" WHERE "id"=$1`, [artifactVersionId]);
    if (!av.rows?.[0])
        return res.status(404).json({ error: "artifact not found" });
    if (!av.rows[0].certificateId) {
        return res.status(403).json({ error: "snapshot only for certified artifacts" });
    }
    if (av.rows[0].ownerId !== auth.sub) {
        return res.status(403).json({ error: "only artifact owner can finalize snapshot (MVP)" });
    }
    const voteRows = await pool.query(`SELECT "leafHash" FROM "PlanetVote" WHERE "artifactVersionId"=$1 ORDER BY "leafHash" ASC`, [artifactVersionId]);
    const leaves = voteRows.rows.map((r) => r.leafHash);
    const { root } = (0, merkle_1.buildMerkleTree)(leaves);
    const publicSalt = crypto_1.default.randomBytes(16).toString("hex");
    const snapId = crypto_1.default.randomUUID();
    const sigPayload = {
        kind: "planet_vote_snapshot",
        artifactVersionId,
        seasonId,
        publicSalt,
        rootHash: root,
        voteCount: leaves.length,
    };
    const signature = hmacSha256Hex(process.env.QSIGN_SECRET || "dev-qsign-secret", (0, stableStringify_1.stableStringify)(sigPayload));
    try {
        await pool.query(`
      INSERT INTO "PlanetVoteSnapshot"
        ("id","artifactVersionId","seasonId","publicSalt","rootHash","voteCount","leavesOrderedJson","signature")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [snapId, artifactVersionId, seasonId, publicSalt, root, leaves.length, JSON.stringify(leaves), signature]);
    }
    catch (e) {
        if (e?.code === "23505") {
            return res.status(409).json({ error: "snapshot for this season already exists" });
        }
        throw e;
    }
    res.status(201).json({
        snapshotId: snapId,
        seasonId,
        artifactVersionId,
        publicSalt,
        rootHash: root,
        voteCount: leaves.length,
        signature,
        sigPayload,
    });
});
exports.planetComplianceRouter.get("/artifacts/:artifactVersionId/votes/snapshot/latest", async (req, res) => {
    await ensurePlanetTables();
    const { artifactVersionId } = req.params;
    const r = await pool.query(`
    SELECT * FROM "PlanetVoteSnapshot"
    WHERE "artifactVersionId"=$1
    ORDER BY "createdAt" DESC
    LIMIT 1
    `, [artifactVersionId]);
    if (!r.rows?.[0])
        return res.status(404).json({ error: "no snapshot" });
    res.json({ snapshot: r.rows[0] });
});
exports.planetComplianceRouter.get("/artifacts/:artifactVersionId/votes/my-proof", async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth)
        return;
    await ensurePlanetTables();
    const { artifactVersionId } = req.params;
    const seasonId = req.query.seasonId;
    if (!seasonId)
        return res.status(400).json({ error: "seasonId query required" });
    const categoryId = typeof req.query.categoryId === "string" && req.query.categoryId.length > 0
        ? req.query.categoryId
        : "general";
    const snapR = await pool.query(`
    SELECT * FROM "PlanetVoteSnapshot"
    WHERE "artifactVersionId"=$1 AND "seasonId"=$2
    `, [artifactVersionId, seasonId]);
    if (!snapR.rows?.[0])
        return res.status(404).json({ error: "snapshot not found" });
    const voteR = await pool.query(`
    SELECT * FROM "PlanetVote"
    WHERE "artifactVersionId"=$1 AND "userId"=$2 AND "categoryId"=$3
    LIMIT 1
    `, [artifactVersionId, auth.sub, categoryId]);
    if (!voteR.rows?.[0])
        return res.status(404).json({ error: "no vote from this user" });
    const snap = snapR.rows[0];
    const leaves = jsonbMaybeParse(snap.leavesOrderedJson);
    if (!Array.isArray(leaves))
        return res.status(500).json({ error: "invalid snapshot data" });
    const leafHash = voteR.rows[0].leafHash;
    const idx = (0, merkle_1.sortedIndex)(leaves, leafHash);
    if (idx < 0)
        return res.status(404).json({ error: "leaf not in snapshot (vote after snapshot?)" });
    const proof = (0, merkle_1.merkleProofForLeaf)(leaves, leafHash);
    if (!proof)
        return res.status(500).json({ error: "proof failed" });
    const ok = (0, merkle_1.verifyMerkleProof)(leafHash, proof, snap.rootHash, idx);
    res.json({
        seasonId,
        categoryId,
        artifactVersionId,
        rootHash: snap.rootHash,
        publicSalt: snap.publicSalt,
        leafHash,
        leafIndex: idx,
        proof,
        verifyOk: ok,
        codeSymbol: voteR.rows[0].codeSymbol,
    });
});
