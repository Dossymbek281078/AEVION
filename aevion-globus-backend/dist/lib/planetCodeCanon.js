"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.canonicalizeCodeFiles = canonicalizeCodeFiles;
const crypto_1 = __importDefault(require("crypto"));
const stableStringify_1 = require("./stableStringify");
function sha256Hex(s) {
    return crypto_1.default.createHash("sha256").update(s).digest("hex");
}
function normalizeCodeText(s) {
    // Normalize line endings and remove trailing spaces to make hashing stable.
    return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").map((l) => l.replace(/\s+$/g, "")).join("\n");
}
function canonicalizeCodeFiles(codeFiles, opts) {
    const blockSizeLines = opts?.blockSizeLines ?? 20;
    const normalizedFiles = [...codeFiles]
        .filter((f) => f?.path && typeof f.content === "string")
        .map((f) => ({
        path: f.path.replace(/\\/g, "/"),
        content: normalizeCodeText(f.content),
    }))
        .sort((a, b) => a.path.localeCompare(b.path));
    const files = normalizedFiles.map((f) => {
        const lines = f.content.length ? f.content.split("\n") : [""];
        const blocks = [];
        for (let i = 0; i < lines.length; i += blockSizeLines) {
            const startLine = i + 1;
            const endLine = Math.min(i + blockSizeLines, lines.length);
            const chunk = lines.slice(i, endLine).join("\n");
            const blockHash = sha256Hex(chunk);
            blocks.push({ startLine, endLine, blockHash });
        }
        const fileHash = sha256Hex(`${f.path}\n${f.content}`);
        return { path: f.path, fileHash, blocks };
    });
    const inputSetHash = sha256Hex((0, stableStringify_1.stableStringify)({
        kind: "code",
        blockSizeLines,
        files: files.map((ff) => ({ path: ff.path, fileHash: ff.fileHash })),
    }));
    const codeIndex = { blockSizeLines, files };
    return {
        inputSetHash,
        codeIndex,
        fileHashes: files.map((ff) => ({ path: ff.path, fileHash: ff.fileHash })),
    };
}
