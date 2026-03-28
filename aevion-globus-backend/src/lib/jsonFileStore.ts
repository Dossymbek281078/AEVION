import fs from "fs";
import path from "path";

/**
 * Локальное хранилище MVP-модулей (QTrade и т.д.).
 * Переопределите AEVION_DATA_DIR для Docker/прода.
 */
export function getAevionDataDir(): string {
  const raw = process.env.AEVION_DATA_DIR;
  if (raw && raw.trim()) return path.resolve(raw.trim());
  return path.join(process.cwd(), ".aevion-data");
}

export async function readJsonFile<T>(relativePath: string, fallback: T): Promise<T> {
  const full = path.join(getAevionDataDir(), relativePath);
  try {
    const raw = await fs.promises.readFile(full, "utf8");
    try {
      return JSON.parse(raw) as T;
    } catch {
      console.error(`[jsonFileStore] повреждён JSON, сброс к fallback: ${relativePath}`);
      return fallback;
    }
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e && typeof (e as { code: unknown }).code === "string"
        ? (e as { code: string }).code
        : "";
    if (code === "ENOENT") return fallback;
    throw e;
  }
}

/** Атомарная запись: temp → rename (один файл на модуль). */
export async function writeJsonFile(relativePath: string, data: unknown): Promise<void> {
  const dir = getAevionDataDir();
  const full = path.join(dir, relativePath);
  await fs.promises.mkdir(dir, { recursive: true });
  const tmp = `${full}.${process.pid}.${Date.now()}.tmp`;
  const json = JSON.stringify(data);
  await fs.promises.writeFile(tmp, json, "utf8");
  await fs.promises.rename(tmp, full);
}
