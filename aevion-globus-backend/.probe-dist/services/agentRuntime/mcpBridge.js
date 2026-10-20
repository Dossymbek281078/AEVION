"use strict";
/**
 * agentRuntime — remote MCP bridge.
 *
 * Turns configured remote HTTP MCP servers into agent-runtime tools: connect,
 * list each server's tools, and expose them (namespaced) alongside our native
 * DevHub tools, with a matching executor that routes a call back to the right
 * server. This is what makes "Higgsfield & co.'s MCP work inside AEVION".
 *
 * Configuration is env-driven and OPTIONAL — with nothing configured the bridge
 * contributes zero tools and the runtime behaves exactly as before. No mock: if
 * a server is unreachable or unauthorised it is reported in `errors`, its tools
 * are simply absent, and the rest keep working (graceful per-server degradation).
 *
 *   AGENT_RUNTIME_MCP_SERVERS='[{"name":"higgsfield","url":"https://mcp.higgsfield.ai/mcp","token":"..."}]'
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.namespaceToolName = namespaceToolName;
exports.parseMcpConfig = parseMcpConfig;
exports.loadMcpBridge = loadMcpBridge;
const mcpClient_1 = require("./mcpClient");
/** Anthropic tool names must match ^[a-zA-Z0-9_-]{1,64}$ — sanitise + namespace. */
function namespaceToolName(server, tool) {
    const clean = (s) => s.replace(/[^a-zA-Z0-9_-]/g, "_");
    return `mcp_${clean(server)}_${clean(tool)}`.slice(0, 64);
}
/** Parse and validate the AGENT_RUNTIME_MCP_SERVERS env value. */
function parseMcpConfig(raw) {
    if (!raw || !raw.trim())
        return [];
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new Error("AGENT_RUNTIME_MCP_SERVERS is not valid JSON.");
    }
    if (!Array.isArray(parsed))
        throw new Error("AGENT_RUNTIME_MCP_SERVERS must be a JSON array.");
    const out = [];
    for (const entry of parsed) {
        const e = entry;
        if (!e || typeof e.name !== "string" || typeof e.url !== "string")
            continue;
        if (!/^https?:\/\//i.test(e.url))
            continue; // remote HTTP only
        out.push({ name: e.name, url: e.url, ...(e.token ? { token: e.token } : {}) });
    }
    return out;
}
/**
 * Connect to every configured server, list its tools and build the combined
 * spec list + executor. Never throws for a single bad server — that server's
 * failure is recorded and the others still load.
 */
async function loadMcpBridge(opts) {
    const fetchImpl = opts.fetchImpl ?? fetch;
    const makeClient = opts.makeClient ?? ((cfg, f) => new mcpClient_1.McpHttpClient(cfg, f));
    const specs = [];
    const owns = new Set();
    const servers = [];
    // namespaced tool name -> { client, remoteName }
    const registry = new Map();
    for (const cfg of opts.config) {
        const client = makeClient(cfg, fetchImpl);
        try {
            const tools = await client.listTools();
            let count = 0;
            for (const t of tools) {
                const ns = namespaceToolName(cfg.name, t.name);
                if (owns.has(ns))
                    continue; // name collision — first wins
                registry.set(ns, { client, remoteName: t.name, server: cfg.name });
                owns.add(ns);
                specs.push({
                    name: ns,
                    description: `[${cfg.name}] ${t.description ?? t.name}`,
                    inputSchema: t.inputSchema ?? { type: "object", properties: {} },
                });
                count++;
            }
            servers.push({ name: cfg.name, url: cfg.url, toolCount: count });
        }
        catch (e) {
            servers.push({ name: cfg.name, url: cfg.url, toolCount: 0, error: e.message });
        }
    }
    const exec = async (call) => {
        const hit = registry.get(call.name);
        if (!hit)
            return { ok: false, content: `Unknown MCP tool: ${call.name}` };
        try {
            const r = await hit.client.callTool(hit.remoteName, call.input || {});
            return { ok: !r.isError, content: r.content };
        }
        catch (e) {
            return { ok: false, content: e.message };
        }
    };
    return { specs, exec, owns, servers };
}
