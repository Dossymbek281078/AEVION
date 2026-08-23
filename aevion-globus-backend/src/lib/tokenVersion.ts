import { getPool } from "./dbPool";

/**
 * Счётчик версий токена — механизм «выйти со всех устройств».
 *
 * Что было до 21.08.2026. Колонка `AEVIONUser.tokenVersion` заведена
 * миграцией, поле `tv` подробно описано в типе токена, ручка
 * `POST /api/auth/sign-out-everywhere` опубликована в нашей спецификации API —
 * и НИ ОДНА строка кода счётчик не читала и не увеличивала. Обещание было
 * подтверждено четырьмя артефактами, механизма не существовало. Проба на
 * проде: ручка отдавала 404, а отзыв сессий смотрели 2 проверки входа из 97.
 *
 * Почему счётчик держится В ПАМЯТИ. Проверка токена (`verifyBearerOptional`)
 * синхронная и зовётся из 41 файла; сделать её асинхронной значит переписать
 * шесть реализаций `requireAuth` и все их вызовы. Обращение к базе на КАЖДЫЙ
 * запрос с токеном — тоже не вариант. Поэтому карта грузится целиком и
 * обновляется при изменении.
 *
 * Почему это не «защита на честном слове». Карта грузится ПОЛНОСТЬЮ, поэтому
 * отсутствие пользователя в ней — это факт «такого пользователя нет», а не
 * «не знаю»: токен отвергается. Пока карта НЕ загружена, проверка не
 * применяется вовсе — но об этом кричат в журнал, а состояние видно снаружи
 * (`enforcing` в /api/health/deep). Молчаливого пропуска нет: это правило
 * §14 — направление отказа выбирается по цене, видимость не выбирается.
 */

type State = {
  versions: Map<string, number>;
  loadedAt: number | null;
  lastError: string | null;
};

const state: State = { versions: new Map(), loadedAt: null, lastError: null };

/** Проверка применяется только когда карта реально загружена. */
export function isEnforcing(): boolean {
  return state.loadedAt !== null;
}

export function tokenVersionStatus(): {
  enforcing: boolean;
  users: number;
  loadedAt: string | null;
  lastError: string | null;
} {
  return {
    enforcing: isEnforcing(),
    users: state.versions.size,
    loadedAt: state.loadedAt ? new Date(state.loadedAt).toISOString() : null,
    lastError: state.lastError,
  };
}

/** Полная загрузка. Частичной быть не должно: она превратила бы «нет такого
 *  пользователя» в ложный отказ живым людям. */
export async function loadTokenVersions(): Promise<boolean> {
  try {
    const { rows } = await getPool().query(
      `SELECT "id", COALESCE("tokenVersion", 0) AS "tv" FROM "AEVIONUser"`,
    );
    const next = new Map<string, number>();
    for (const r of rows as { id: string; tv: number | string }[]) {
      next.set(String(r.id), Number(r.tv) || 0);
    }
    state.versions = next;
    state.loadedAt = Date.now();
    state.lastError = null;
    return true;
  } catch (e) {
    state.lastError = String((e as Error)?.message ?? e).slice(0, 200);
    // Громко: слепота защиты не имеет права быть незаметной (§14).
    console.error("[tokenVersion] карта НЕ загружена, проверка отключена:", state.lastError);
    return false;
  }
}

/**
 * Синхронная проверка для горячего пути.
 * Три исхода, а не два: «подходит», «не подходит» и «проверка не применяется».
 */
export function tokenVersionAccepted(sub: unknown, tv: unknown): boolean {
  if (!isEnforcing()) return true;
  if (typeof sub !== "string" || !sub) return false;
  const expected = state.versions.get(sub);
  // Карта полная, значит отсутствие — это «пользователя нет».
  if (expected === undefined) return false;
  const got = typeof tv === "number" && Number.isFinite(tv) ? tv : 0;
  return got === expected;
}

/** Текущая версия — нужна при выпуске токена. */
export function currentTokenVersion(sub: string): number {
  return state.versions.get(sub) ?? 0;
}

/**
 * Увеличить счётчик: все ранее выпущенные токены этого пользователя
 * перестают подходить, включая ТЕКУЩИЙ. Именно это обещает кнопка.
 */
export async function bumpTokenVersion(sub: string): Promise<number> {
  const { rows } = await getPool().query(
    `UPDATE "AEVIONUser" SET "tokenVersion" = COALESCE("tokenVersion", 0) + 1
      WHERE "id" = $1 RETURNING "tokenVersion"`,
    [sub],
  );
  if (!rows.length) throw new Error("user not found");
  const next = Number((rows[0] as { tokenVersion: number }).tokenVersion) || 0;
  // Обновляем карту сразу: иначе между записью в базу и следующей полной
  // загрузкой старый токен продолжал бы работать — то есть кнопка сработала
  // бы «потом», а человек считал бы, что защитился сейчас.
  state.versions.set(sub, next);
  return next;
}

/** Для тестов: вернуть модуль в незагруженное состояние. */
export function __resetTokenVersionsForTests(): void {
  state.versions = new Map();
  state.loadedAt = null;
  state.lastError = null;
}
