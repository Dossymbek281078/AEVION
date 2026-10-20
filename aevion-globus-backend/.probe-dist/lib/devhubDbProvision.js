"use strict";
/**
 * Real database provisioning for DevHub projects.
 *
 * Model: one PostgreSQL **schema + login role per project**, on an instance
 * dedicated to user projects — never the platform's own database. The role can
 * only touch its own schema, so one project cannot read another's data.
 *
 * Why not a database per project: creating databases needs a connection outside
 * any transaction and leaves orphans that are expensive to reap. Schema+role is
 * the isolation level a hosted builder actually needs (separate namespace,
 * separate credentials, revocable in one statement) without a per-project
 * server bill.
 *
 * Set DEVHUB_DB_ADMIN_URL to enable. Until it is set, the capability reports
 * needs_token and the route refuses honestly — no pretending, per the
 * "deploy = uploaded + serves" convention in CLAUDE.md §10.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.schemaNameFor = schemaNameFor;
exports.roleNameFor = roleNameFor;
exports.generatePassword = generatePassword;
exports.buildProjectUrl = buildProjectUrl;
exports.refusesPlatformDatabase = refusesPlatformDatabase;
exports.provisionProjectDatabase = provisionProjectDatabase;
exports.deprovisionProjectDatabase = deprovisionProjectDatabase;
exports.projectSchemaSizeBytes = projectSchemaSizeBytes;
const crypto_1 = __importDefault(require("crypto"));
/**
 * One project must not be able to exhaust the shared instance. Postgres has no
 * per-schema size quota, so the two levers that do exist are used: a hard
 * connection cap per role (a runaway pool in one generated app cannot starve
 * every other project of connections), and a measured size reported to the
 * caller so limits can be enforced above rather than guessed at.
 */
const CONNECTION_LIMIT = Number(process.env.DEVHUB_DB_CONNECTION_LIMIT) || 5;
/** Postgres identifiers are interpolated, never parameterised — so they are
 * generated here and validated, never taken from user input. */
const IDENT_RE = /^[a-z][a-z0-9_]{2,62}$/;
function schemaNameFor(projectId) {
    return "p_" + projectId.replace(/-/g, "").slice(0, 12).toLowerCase();
}
function roleNameFor(projectId) {
    return "u_" + projectId.replace(/-/g, "").slice(0, 12).toLowerCase();
}
function generatePassword() {
    // URL-safe: the credential ends up inside a connection string.
    return crypto_1.default.randomBytes(24).toString("base64url");
}
/** Build the project's own connection string from the admin one, swapping in
 * the project role and forcing its schema as the default search_path. */
function buildProjectUrl(adminUrl, role, password, schema) {
    const u = new URL(adminUrl);
    u.username = role;
    u.password = password;
    u.searchParams.set("options", `-c search_path=${schema}`);
    return u.toString();
}
/**
 * Guard against the catastrophic misconfiguration: pointing provisioning at
 * the platform's own database would hand every DevHub user a login role on
 * the database holding all AEVION data.
 */
function refusesPlatformDatabase(adminUrl, platformUrl) {
    if (!platformUrl)
        return false;
    try {
        const a = new URL(adminUrl);
        const p = new URL(platformUrl);
        return a.host === p.host && a.pathname === p.pathname;
    }
    catch {
        // Адрес не разобрался — сравнить не с чем. Раньше здесь стояло `false`,
        // то есть «не возражаем», и провижининг шёл дальше: сторож, поставленный
        // ПРОТИВ создания схем на боевой базе платформы, при кривом адресе молча
        // отходил в сторону.
        //
        // Направление отказа выбирается по цене (правило из разбора сторожей
        // 18.08). Здесь цены такие: отказать — DevHub не создаст базу и человек
        // увидит внятную причину; пропустить — можем начать создавать схемы и роли
        // в боевой базе всей платформы. Разница на порядки, поэтому отказываем.
        //
        // Ложных отказов это почти не даёт: `new URL` не разбирает только заведомо
        // сломанную настройку, а с ней провижининг всё равно не состоится — просто
        // теперь он остановится ДО первой команды, а не после.
        console.error("[devhub/db] адрес базы не разобрался — отказываю в провижининге, " +
            "чтобы не создать схемы на боевой базе платформы");
        return true;
    }
}
/** Injectable so tests never need a live server. */
async function provisionProjectDatabase(args) {
    const adminUrl = args.adminUrl ?? process.env.DEVHUB_DB_ADMIN_URL;
    if (!adminUrl) {
        return { ok: false, error: "database provisioning is not configured — set DEVHUB_DB_ADMIN_URL on the server" };
    }
    if (refusesPlatformDatabase(adminUrl, args.platformUrl ?? process.env.DATABASE_URL)) {
        return {
            ok: false,
            error: "refusing to provision on the platform's own database — DEVHUB_DB_ADMIN_URL must point at an instance dedicated to user projects",
        };
    }
    const schema = schemaNameFor(args.projectId);
    const role = roleNameFor(args.projectId);
    if (!IDENT_RE.test(schema) || !IDENT_RE.test(role)) {
        return { ok: false, error: "could not derive safe identifiers for this project id" };
    }
    const password = generatePassword();
    let query = args.query;
    let close = null;
    if (!query) {
        const { Client } = await Promise.resolve().then(() => __importStar(require("pg")));
        const client = new Client({ connectionString: adminUrl });
        await client.connect();
        query = ((sql, params) => client.query(sql, params));
        close = () => client.end();
    }
    try {
        // Role first: the schema is created owned by it, so the project owns every
        // table it later creates without further grants.
        const existing = await query("SELECT 1 FROM pg_roles WHERE rolname = $1", [role]);
        if (existing.rows.length === 0) {
            await query(`CREATE ROLE ${role} LOGIN PASSWORD '${password.replace(/'/g, "''")}' CONNECTION LIMIT ${CONNECTION_LIMIT}`);
        }
        else {
            // Re-provisioning rotates the credential rather than failing.
            await query(`ALTER ROLE ${role} WITH LOGIN PASSWORD '${password.replace(/'/g, "''")}' CONNECTION LIMIT ${CONNECTION_LIMIT}`);
        }
        await query(`CREATE SCHEMA IF NOT EXISTS ${schema} AUTHORIZATION ${role}`);
        // Deny the public schema so a project cannot scatter tables outside its
        // namespace, and pin its search_path so plain CREATE TABLE lands inside.
        await query(`REVOKE ALL ON SCHEMA public FROM ${role}`);
        await query(`ALTER ROLE ${role} SET search_path = ${schema}`);
        let appliedSchemaSql = false;
        if (args.schemaSql && args.schemaSql.trim()) {
            // Applied as the project role inside its own schema — DDL written by the
            // model cannot reach anything else even if it names another schema.
            await query(`SET ROLE ${role}`);
            await query(`SET search_path = ${schema}`);
            try {
                await query(args.schemaSql);
                appliedSchemaSql = true;
            }
            finally {
                await query("RESET ROLE");
            }
        }
        return { ok: true, schema, role, databaseUrl: buildProjectUrl(adminUrl, role, password, schema), appliedSchemaSql };
    }
    catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    finally {
        if (close)
            await close().catch(() => { });
    }
}
/** Tear down: drop the schema with everything in it, then the role. */
async function deprovisionProjectDatabase(args) {
    const adminUrl = args.adminUrl ?? process.env.DEVHUB_DB_ADMIN_URL;
    if (!adminUrl)
        return { ok: false, error: "database provisioning is not configured" };
    const schema = schemaNameFor(args.projectId);
    const role = roleNameFor(args.projectId);
    if (!IDENT_RE.test(schema) || !IDENT_RE.test(role)) {
        return { ok: false, error: "could not derive safe identifiers for this project id" };
    }
    let query = args.query;
    let close = null;
    if (!query) {
        const { Client } = await Promise.resolve().then(() => __importStar(require("pg")));
        const client = new Client({ connectionString: adminUrl });
        await client.connect();
        query = ((sql, params) => client.query(sql, params));
        close = () => client.end();
    }
    try {
        await query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
        // Objects outside the schema (there should be none) must be gone before
        // the role can be dropped; DROP OWNED makes that explicit rather than
        // failing with a dependency error the user cannot act on.
        await query(`DROP OWNED BY ${role} CASCADE`).catch(() => undefined);
        await query(`DROP ROLE IF EXISTS ${role}`);
        return { ok: true };
    }
    catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    finally {
        if (close)
            await close().catch(() => { });
    }
}
/** Bytes currently used by a project's schema — for quota display and
 * enforcement. Reported, never guessed. */
async function projectSchemaSizeBytes(args) {
    const adminUrl = args.adminUrl ?? process.env.DEVHUB_DB_ADMIN_URL;
    if (!adminUrl)
        return { ok: false, error: "database provisioning is not configured" };
    const schema = schemaNameFor(args.projectId);
    if (!IDENT_RE.test(schema))
        return { ok: false, error: "could not derive a safe schema name" };
    let query = args.query;
    let close = null;
    if (!query) {
        const { Client } = await Promise.resolve().then(() => __importStar(require("pg")));
        const client = new Client({ connectionString: adminUrl });
        await client.connect();
        query = ((sql, params) => client.query(sql, params));
        close = () => client.end();
    }
    try {
        const r = await query(`SELECT COALESCE(SUM(pg_total_relation_size(c.oid)), 0)::bigint AS bytes,
              COUNT(*)::int AS tables
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relkind = 'r'`, [schema]);
        const row = r.rows[0] || {};
        return { ok: true, bytes: Number(row.bytes ?? 0), tables: Number(row.tables ?? 0) };
    }
    catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    finally {
        if (close)
            await close().catch(() => { });
    }
}
