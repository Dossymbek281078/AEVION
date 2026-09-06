import crypto from "node:crypto";
import { makeServiceCapture } from "./sentry/platform";

const captureException = makeServiceCapture("devhub-provenance");

/**
 * Провенанс ИИ-генераций DevHub: фиксация происхождения результата в QRight.
 *
 * По спеке Монетизации 06.09.2026 (05-DevHub/2026-09-06-СПЕКА-провенанс-
 * генераций.md): EU AI Act требует прозрачности ИИ-контента, и среда
 * разработки, где каждая генерация получает проверяемую отметку
 * происхождения, продаёт DevHub за $149 без конкуренции с бесплатными
 * таймстамперами.
 *
 * Отступление от спеки, названное вслух: флаг НА ВЫЗОВ (`provenance: true`
 * в теле генерации), а не на проект — v1 без миграции схемы; проектный флаг
 * добавляется сверху позже, не ломая этого.
 *
 * Правила, выведенные из платформенных уроков:
 * - помечаем ТОЛЬКО aiGenerated === true: отметка происхождения у заглушки
 *   была бы фальшивым провенансом (класс «заявление сильнее продукта»);
 * - промпт НАРУЖУ НЕ ВЫХОДИТ — только его sha256 (критерий 5 спеки);
 * - отказ фиксации НЕ роняет генерацию, но виден: Sentry + поле
 *   provenanceError в ответе (§16 — молчаливых отказов не бывает);
 * - вызов внутренний HTTP на себя — тот же установленный путь, что у
 *   multichat → qcoreai; Authorization пробрасывается, чтобы вошедший
 *   владелец привязался к записи (QRight сам верит JWT, а не полям).
 */

// База ИМЕННО БЭКЕНДА: живая проба 06.09.2026 показала, что сайт aevion.app
// НЕ проксирует /api/qright — verifyUrl на домене сайта отдавал 404 при
// живой странице на api.aevion.app. Страницу проверки обслуживает бэкенд.
const API_PUBLIC_BASE = (process.env.AEVION_API_PUBLIC_BASE_URL ?? "https://api.aevion.app").replace(/\/+$/, "");

export type ProvenanceStamp = { certId: string; verifyUrl: string };

export function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

/** Канонический хеш набора файлов: имена и содержимое, порядок не важен. */
export function filesHash(files: Array<{ path: string; content: string }>): string {
  const canonical = [...files]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((f) => `${f.path} ${sha256Hex(f.content)}`)
    .join("\n");
  return sha256Hex(canonical);
}

export async function stampGenerationProvenance(opts: {
  projectId: string;
  projectName: string;
  prompt: string;
  files: Array<{ path: string; content: string }>;
  provider?: string;
  model?: string;
  authHeader?: string;
}): Promise<{ ok: true; stamp: ProvenanceStamp } | { ok: false; error: string }> {
  const port = Number(process.env.PORT) || 4001;
  const internalBase = process.env.INTERNAL_API_BASE_URL || `http://127.0.0.1:${port}`;

  const meta = {
    source: "devhub-generation",
    projectId: opts.projectId,
    filesHash: filesHash(opts.files),
    fileCount: opts.files.length,
    promptSha256: sha256Hex(opts.prompt),
    provider: opts.provider ?? "unknown",
    model: opts.model ?? "unknown",
    generatedAt: new Date().toISOString(),
  };

  try {
    const r = await fetch(`${internalBase}/api/qright/objects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(opts.authHeader ? { Authorization: opts.authHeader } : {}),
      },
      body: JSON.stringify({
        title: `DevHub AI generation — ${opts.projectName}`.slice(0, 180),
        description: JSON.stringify(meta),
        kind: "code",
      }),
      signal: AbortSignal.timeout(8000),
    });
    const body = (await r.json().catch(() => null)) as { id?: string } | null;
    if (!r.ok || !body?.id) {
      const why = `qright ${r.status}`;
      captureException(new Error(`provenance stamp failed: ${why}`), {
        route: "devhub/provenance", projectId: opts.projectId,
      });
      return { ok: false, error: why };
    }
    return {
      ok: true,
      stamp: {
        certId: body.id,
        // Публичная страница проверки: открывается без входа, называет хеш и
        // время (критерий 2 спеки) — это embed-поверхность QRight.
        verifyUrl: `${API_PUBLIC_BASE}/api/qright/embed/${body.id}`,
      },
    };
  } catch (e) {
    const why = e instanceof Error ? e.message : "network";
    captureException(e, { route: "devhub/provenance", projectId: opts.projectId });
    return { ok: false, error: why.slice(0, 120) };
  }
}
