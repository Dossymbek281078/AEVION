"use strict";
/**
 * agentRuntime — remote MCP client (Streamable HTTP transport).
 *
 * Lets our agent runtime speak the Model Context Protocol to REMOTE HTTP MCP
 * servers (e.g. Higgsfield at https://mcp.higgsfield.ai/mcp) and borrow their
 * tools as if they were our own. This is the honest way to "bring their MCP
 * into ours": the backend becomes an MCP *client*, not a mock.
 *
 * Only remote HTTP servers are reachable from the backend — local stdio MCP
 * servers (filesystem, playwright, …) live on the developer's machine and are
 * out of scope here.
 *
 * The transport is JSON-RPC 2.0 over HTTP POST. A server may answer either with
 * `application/json` or with a `text/event-stream` (SSE) frame; we handle both.
 * `fetch` is injectable so the client is exercised deterministically in tests.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpHttpClient = void 0;
exports.parseRpcBody = parseRpcBody;
exports.flattenContent = flattenContent;
const PROTOCOL_VERSION = "2025-06-18";
/**
 * Parse a Streamable-HTTP response body into a JSON-RPC object. Handles both a
 * plain JSON body and an SSE stream (one or more `data:` lines).
 */
function parseRpcBody(bodyText, contentType) {
    const isSse = /text\/event-stream/i.test(contentType);
    if (!isSse) {
        return JSON.parse(bodyText);
    }
    // SSE: collect every `data:` payload, return the first that carries a JSON-RPC
    // result or error (the others are progress/notification frames).
    const datas = [];
    for (const rawLine of bodyText.split(/\r?\n/)) {
        const line = rawLine.trimStart();
        if (line.startsWith("data:"))
            datas.push(line.slice(5).trim());
    }
    for (const d of datas) {
        if (!d)
            continue;
        try {
            const obj = JSON.parse(d);
            if (obj && (obj.result !== undefined || obj.error !== undefined))
                return obj;
        }
        catch {
            /* skip non-JSON keep-alive frames */
        }
    }
    throw new Error("No JSON-RPC result found in SSE response.");
}
/** Flatten an MCP tool-call `content` array into a compact, model-friendly value. */
function flattenContent(content) {
    if (!Array.isArray(content))
        return content;
    const texts = [];
    const others = [];
    for (const block of content) {
        if (block && block.type === "text" && typeof block.text === "string")
            texts.push(block.text);
        else
            others.push(block);
    }
    if (others.length === 0)
        return texts.join("\n");
    return { text: texts.join("\n"), blocks: others };
}
class McpHttpClient {
    constructor(cfg, fetchImpl = fetch) {
        this.nextId = 1;
        this.initialized = false;
        this.cfg = cfg;
        this.doFetch = fetchImpl;
    }
    headers() {
        const h = {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
            "mcp-protocol-version": PROTOCOL_VERSION,
        };
        if (this.cfg.token)
            h["authorization"] = `Bearer ${this.cfg.token}`;
        if (this.sessionId)
            h["mcp-session-id"] = this.sessionId;
        return h;
    }
    /** Send a JSON-RPC request and return its `result` (throws on JSON-RPC error). */
    async rpc(method, params) {
        const id = this.nextId++;
        const r = await this.doFetch(this.cfg.url, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
        });
        // The session id is minted on the initialize response.
        const sid = r.headers?.get?.("mcp-session-id");
        if (sid)
            this.sessionId = sid;
        if (!r.ok) {
            const t = await r.text().catch(() => "");
            throw new Error(`MCP ${this.cfg.name} ${method} HTTP ${r.status}: ${t.slice(0, 200)}`);
        }
        const bodyText = await r.text();
        const ct = r.headers?.get?.("content-type") || "application/json";
        const parsed = parseRpcBody(bodyText, ct);
        if (parsed.error)
            throw new Error(`MCP ${this.cfg.name} ${method} error ${parsed.error.code}: ${parsed.error.message}`);
        return parsed.result;
    }
    /** Fire-and-forget JSON-RPC notification (no id, no result expected). */
    async notify(method) {
        await this.doFetch(this.cfg.url, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify({ jsonrpc: "2.0", method }),
        }).catch(() => undefined);
    }
    async initialize() {
        if (this.initialized)
            return;
        await this.rpc("initialize", {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: "aevion-agent-runtime", version: "0.1.0" },
        });
        await this.notify("notifications/initialized");
        this.initialized = true;
    }
    async listTools() {
        await this.initialize();
        const result = (await this.rpc("tools/list", {}));
        return Array.isArray(result?.tools) ? result.tools : [];
    }
    async callTool(name, args) {
        await this.initialize();
        const result = (await this.rpc("tools/call", { name, arguments: args }));
        return {
            isError: Boolean(result?.isError),
            content: flattenContent(result?.content),
        };
    }
}
exports.McpHttpClient = McpHttpClient;
