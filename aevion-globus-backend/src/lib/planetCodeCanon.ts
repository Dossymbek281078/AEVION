import crypto from "crypto";
import { stableStringify } from "./stableStringify";

export type CodeFileInput = { path: string; content: string };

export type CodeBlock = {
  startLine: number;
  endLine: number;
  blockHash: string;
};

export type CodeFileIndex = {
  path: string;
  fileHash: string;
  blocks: CodeBlock[];
};

export type CodeIndex = {
  blockSizeLines: number;
  files: CodeFileIndex[];
};

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function normalizeCodeText(s: string): string {
  // Normalize line endings and remove trailing spaces to make hashing stable.
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").map((l) => l.replace(/\s+$/g, "")).join("\n");
}

export function canonicalizeCodeFiles(codeFiles: CodeFileInput[], opts?: { blockSizeLines?: number }) {
  const blockSizeLines = opts?.blockSizeLines ?? 20;

  const normalizedFiles = [...codeFiles]
    .filter((f) => f?.path && typeof f.content === "string")
    .map((f) => ({
      path: f.path.replace(/\\/g, "/"),
      content: normalizeCodeText(f.content),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  const files: CodeFileIndex[] = normalizedFiles.map((f) => {
    const lines = f.content.length ? f.content.split("\n") : [""];
    const blocks: CodeBlock[] = [];
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

  const inputSetHash = sha256Hex(
    stableStringify({
      kind: "code",
      blockSizeLines,
      files: files.map((ff) => ({ path: ff.path, fileHash: ff.fileHash })),
    }),
  );

  const codeIndex: CodeIndex = { blockSizeLines, files };

  return {
    inputSetHash,
    codeIndex,
    fileHashes: files.map((ff) => ({ path: ff.path, fileHash: ff.fileHash })),
  };
}

