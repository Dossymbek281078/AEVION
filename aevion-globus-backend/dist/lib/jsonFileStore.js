"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAevionDataDir = getAevionDataDir;
exports.readJsonFile = readJsonFile;
exports.writeJsonFile = writeJsonFile;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Локальное хранилище MVP-модулей (QTrade и т.д.).
 * Переопределите AEVION_DATA_DIR для Docker/прода.
 */
function getAevionDataDir() {
    const raw = process.env.AEVION_DATA_DIR;
    if (raw && raw.trim())
        return path_1.default.resolve(raw.trim());
    return path_1.default.join(process.cwd(), ".aevion-data");
}
async function readJsonFile(relativePath, fallback) {
    const full = path_1.default.join(getAevionDataDir(), relativePath);
    try {
        const raw = await fs_1.default.promises.readFile(full, "utf8");
        try {
            return JSON.parse(raw);
        }
        catch {
            console.error(`[jsonFileStore] повреждён JSON, сброс к fallback: ${relativePath}`);
            return fallback;
        }
    }
    catch (e) {
        const code = e && typeof e === "object" && "code" in e && typeof e.code === "string"
            ? e.code
            : "";
        if (code === "ENOENT")
            return fallback;
        throw e;
    }
}
/** Атомарная запись: temp → rename (один файл на модуль). */
async function writeJsonFile(relativePath, data) {
    const dir = getAevionDataDir();
    const full = path_1.default.join(dir, relativePath);
    await fs_1.default.promises.mkdir(dir, { recursive: true });
    const tmp = `${full}.${process.pid}.${Date.now()}.tmp`;
    const json = JSON.stringify(data);
    await fs_1.default.promises.writeFile(tmp, json, "utf8");
    await fs_1.default.promises.rename(tmp, full);
}
