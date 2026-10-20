"use strict";
/**
 * mcpDemo — a REAL, first-party MCP server hosted inside AEVION.
 *
 * It speaks the same Streamable-HTTP JSON-RPC that our agent-runtime MCP bridge
 * (services/agentRuntime/mcpClient.ts) consumes, so it proves the full path
 * "runtime → MCP bridge → external MCP server → tool result" end to end using
 * only our own zone — no third-party client-gating (unlike Higgsfield).
 *
 * Tools are not toys and not only reads: alongside registry lookups it can
 * perform real ecosystem OPERATIONS (QSign HMAC signing; optionally QRight
 * object creation) by internal-fetching the existing endpoints — the same reuse
 * pattern as the DevHub tool executors, with no coupling to their code.
 *
 * Safety: write tools (create_qright_object) are exposed only when
 * MCP_DEMO_WRITES is truthy, so an open endpoint can't create prod records by
 * default. Read + no-persistence tools (list_modules, module_info, qsign_sign)
 * are always available.
 *
 * Protocol handling is a function (handleDemoMcp) driven by an injected
 * ToolContext (baseUrl + fetch + allowWrites), so it is unit tested without a
 * live server; the router is a thin wrapper that adds optional bearer auth.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpDemoRouter = void 0;
exports.toolsFor = toolsFor;
exports.runDemoTool = runDemoTool;
exports.handleDemoMcp = handleDemoMcp;
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const rateLimit_1 = require("../lib/rateLimit");
const projects_1 = require("../data/projects");
const PROTOCOL_VERSION = "2025-06-18";
const READ_TOOLS = [
    {
        name: "list_modules",
        description: "List AEVION product modules with their id, code and status.",
        inputSchema: {
            type: "object",
            properties: { status: { type: "string", description: "Optional filter, e.g. 'live', 'mvp', 'idea'." } },
        },
    },
    {
        name: "module_info",
        description: "Get one AEVION module's code, name, status, kind and description by id.",
        inputSchema: {
            type: "object",
            properties: { id: { type: "string", description: "Module id, e.g. 'qright'." } },
            required: ["id"],
        },
    },
    {
        name: "qsign_sign",
        description: "Sign a JSON payload with AEVION QSign (HMAC-SHA256, no persistence). Real cryptographic operation.",
        inputSchema: {
            type: "object",
            properties: { payload: { type: "object", description: "Any JSON object to sign." } },
            required: ["payload"],
        },
    },
];
const WRITE_TOOLS = [
    {
        name: "create_qright_object",
        description: "Register an intellectual-property object in AEVION QRight (creates a real record).",
        inputSchema: {
            type: "object",
            properties: {
                title: { type: "string" },
                description: { type: "string" },
                kind: { type: "string", description: "e.g. 'idea', 'work', 'brand'." },
            },
            required: ["title"],
        },
    },
];
/** Tools visible to the client, gated by write-permission. */
function toolsFor(allowWrites) {
    return allowWrites ? [...READ_TOOLS, ...WRITE_TOOLS] : READ_TOOLS;
}
function textContent(value) {
    return [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }];
}
/** Execute a demo tool. Read tools use the registry; operation tools internal-fetch. */
async function runDemoTool(name, args, ctx) {
    if (name === "list_modules") {
        const status = typeof args.status === "string" ? args.status.toLowerCase() : "";
        const list = projects_1.projects
            .filter((p) => !status || p.status.toLowerCase() === status)
            .map((p) => ({ id: p.id, code: p.code, status: p.status }));
        return { content: textContent({ count: list.length, modules: list }), isError: false };
    }
    if (name === "module_info") {
        const id = typeof args.id === "string" ? args.id : "";
        const p = projects_1.projects.find((x) => x.id === id || x.code.toLowerCase() === id.toLowerCase());
        if (!p)
            return { content: textContent(`No module with id "${id}".`), isError: true };
        return {
            content: textContent({ id: p.id, code: p.code, name: p.name, status: p.status, kind: p.kind, description: p.description }),
            isError: false,
        };
    }
    if (name === "qsign_sign") {
        if (args.payload === undefined || args.payload === null) {
            return { content: textContent("payload is required"), isError: true };
        }
        try {
            const r = await ctx.fetchImpl(`${ctx.baseUrl}/api/qsign/sign`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(args.payload),
            });
            const data = await r.json().catch(() => ({}));
            return { content: textContent(data), isError: !r.ok };
        }
        catch (e) {
            return { content: textContent(e.message), isError: true };
        }
    }
    if (name === "create_qright_object") {
        if (!ctx.allowWrites) {
            return { content: textContent("create_qright_object is disabled (set MCP_DEMO_WRITES=1 to enable)."), isError: true };
        }
        const title = typeof args.title === "string" ? args.title : "";
        if (!title.trim())
            return { content: textContent("title is required"), isError: true };
        try {
            const r = await ctx.fetchImpl(`${ctx.baseUrl}/api/qright/objects`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    description: typeof args.description === "string" ? args.description : "",
                    kind: typeof args.kind === "string" ? args.kind : "idea",
                }),
            });
            const data = await r.json().catch(() => ({}));
            return { content: textContent(data), isError: !r.ok };
        }
        catch (e) {
            return { content: textContent(e.message), isError: true };
        }
    }
    return { content: textContent(`Unknown tool: ${name}`), isError: true };
}
/** Handle one JSON-RPC MCP request. Notifications (no id) yield 202/no body. */
async function handleDemoMcp(msg, ctx) {
    const isNotification = msg.id === undefined || msg.id === null;
    if (msg.method === "initialize") {
        return {
            status: 200,
            body: {
                jsonrpc: "2.0",
                id: msg.id,
                result: {
                    protocolVersion: PROTOCOL_VERSION,
                    capabilities: { tools: {} },
                    serverInfo: { name: "aevion-registry", version: "0.2.0" },
                },
            },
        };
    }
    if (msg.method === "notifications/initialized" || isNotification) {
        return { status: 202, body: null };
    }
    if (msg.method === "tools/list") {
        return { status: 200, body: { jsonrpc: "2.0", id: msg.id, result: { tools: toolsFor(ctx.allowWrites) } } };
    }
    if (msg.method === "tools/call") {
        const name = typeof msg.params?.name === "string" ? msg.params.name : "";
        const args = msg.params?.arguments || {};
        const r = await runDemoTool(name, args, ctx);
        return { status: 200, body: { jsonrpc: "2.0", id: msg.id, result: r } };
    }
    return {
        status: 200,
        body: { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` } },
    };
}
exports.mcpDemoRouter = (0, express_1.Router)();
/**
 * Потолок для всех, кто пришёл БЕЗ годного токена — одна общая корзина.
 *
 * Предел «на адрес» здесь был бы сторожем, который никогда не срабатывает:
 * по замеру 28.08.2026 в lib/rateLimit.ts на Railway один посетитель получает
 * СЕМЬ ключей, а X-Forwarded-For подделывает сам клиент. Поэтому ключ один для
 * всех (keyFn), и обойти его сменой адреса нельзя. Наши зовущие (agentRuntime
 * шлёт токен: routes/agentRuntime.ts) в эту корзину не попадают вовсе.
 */
const потолокБезТокена = (0, rateLimit_1.rateLimit)({
    windowMs: 60000,
    max: 60,
    keyPrefix: "mcp-demo-anon",
    keyFn: () => "все",
    message: "Too many unauthenticated MCP requests",
});
/** Сравнение за постоянное время: токен сравнивается целиком, а не до первого расхождения. */
function токеныРавны(a, b) {
    const x = Buffer.from(a, "utf8");
    const y = Buffer.from(b, "utf8");
    if (x.length !== y.length)
        return false;
    return crypto_1.default.timingSafeEqual(x, y);
}
/**
 * Проверка входа стоит на УРОВНЕ РОУТЕРА, а не внутри обработчика POST.
 *
 * Внутри POST она охраняла бы ровно один метод: ветка deps/batch-bump-2026-07-27
 * добавляет этому же адресу обработчик GET, который печатает список инструментов
 * и сам факт «authentication: none» — и мимо проверки, стоявшей в POST, он прошёл
 * бы свободно. Здесь закрыт КЛАСС: любой метод этого роутера.
 */
exports.mcpDemoRouter.use((req, res, next) => {
    const required = process.env.MCP_DEMO_TOKEN?.trim();
    const got = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (required && got && токеныРавны(got, required))
        return next();
    потолокБезТокена(req, res, () => {
        if (required) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        next();
    });
});
exports.mcpDemoRouter.post("/", async (req, res) => {
    const port = process.env.PORT || "4001";
    const ctx = {
        baseUrl: process.env.SELF_BASE_URL || `http://127.0.0.1:${port}`,
        fetchImpl: fetch,
        allowWrites: /^(1|true|yes)$/i.test(process.env.MCP_DEMO_WRITES || ""),
    };
    const outcome = await handleDemoMcp((req.body || {}), ctx);
    res.setHeader("Mcp-Session-Id", "aevion-demo");
    if (outcome.body === null)
        return res.status(outcome.status).end();
    res.status(outcome.status).json(outcome.body);
});
