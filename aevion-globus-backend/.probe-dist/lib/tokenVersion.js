"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEnforcing = isEnforcing;
exports.tokenVersionStatus = tokenVersionStatus;
exports.loadTokenVersions = loadTokenVersions;
exports.tokenVersionAccepted = tokenVersionAccepted;
exports.rememberIssuedUser = rememberIssuedUser;
exports.currentTokenVersion = currentTokenVersion;
exports.bumpTokenVersion = bumpTokenVersion;
exports.__resetTokenVersionsForTests = __resetTokenVersionsForTests;
const dbPool_1 = require("./dbPool");
const state = { versions: new Map(), loadedAt: null, lastError: null };
/** Проверка применяется только когда карта реально загружена. */
function isEnforcing() {
    return state.loadedAt !== null;
}
function tokenVersionStatus() {
    return {
        enforcing: isEnforcing(),
        users: state.versions.size,
        loadedAt: state.loadedAt ? new Date(state.loadedAt).toISOString() : null,
        lastError: state.lastError,
    };
}
/** Полная загрузка. Частичной быть не должно: она превратила бы «нет такого
 *  пользователя» в ложный отказ живым людям. */
async function loadTokenVersions() {
    try {
        const { rows } = await (0, dbPool_1.getPool)().query(`SELECT "id", COALESCE("tokenVersion", 0) AS "tv" FROM "AEVIONUser"`);
        const next = new Map();
        for (const r of rows) {
            next.set(String(r.id), Number(r.tv) || 0);
        }
        state.versions = next;
        state.loadedAt = Date.now();
        state.lastError = null;
        return true;
    }
    catch (e) {
        state.lastError = String(e?.message ?? e).slice(0, 200);
        // Громко: слепота защиты не имеет права быть незаметной (§14).
        console.error("[tokenVersion] карта НЕ загружена, проверка отключена:", state.lastError);
        return false;
    }
}
/**
 * Синхронная проверка для горячего пути.
 * Три исхода, а не два: «подходит», «не подходит» и «проверка не применяется».
 */
function tokenVersionAccepted(sub, tv) {
    if (!isEnforcing())
        return true;
    if (typeof sub !== "string" || !sub)
        return false;
    const expected = state.versions.get(sub);
    // Карта полная, значит отсутствие — это «пользователя нет».
    if (expected === undefined)
        return false;
    const got = typeof tv === "number" && Number.isFinite(tv) ? tv : 0;
    return got === expected;
}
/**
 * Запомнить пользователя в момент выпуска ему токена.
 *
 * 🔴 Замер на проде 12.10.2026 (окно Приложения-31.12): только что
 * зарегистрированный человек нажал «Подписать» в QSign и получил 401
 * «invalid bearer token»; тот же токен через пару минут прошёл. Причина —
 * строка «отсутствие в карте = пользователя нет»: карта перечитывается раз в
 * 5 минут, а регистрация в неё не пишет. Значит, ДО 5 МИНУТ после регистрации
 * (и после первого входа через OAuth) каждая закрытая ручка платформы
 * отказывала новому человеку — включая купившего, которого касса только что
 * завела.
 *
 * Выпуск токена доказывает, что строка пользователя есть: её только что
 * вставили или прочитали. Поэтому отсутствующего кладём с версией, с которой
 * токен выпущен. Уже известного НЕ трогаем: иначе свежий вход мог бы откатить
 * поднятую «выйти со всех устройств» версию в этой копии процесса.
 */
function rememberIssuedUser(sub, tv = 0) {
    if (!sub || state.versions.has(sub))
        return;
    state.versions.set(sub, Number.isFinite(tv) ? tv : 0);
}
/** Текущая версия — нужна при выпуске токена. */
function currentTokenVersion(sub) {
    return state.versions.get(sub) ?? 0;
}
/**
 * Увеличить счётчик: все ранее выпущенные токены этого пользователя
 * перестают подходить, включая ТЕКУЩИЙ. Именно это обещает кнопка.
 */
async function bumpTokenVersion(sub) {
    const { rows } = await (0, dbPool_1.getPool)().query(`UPDATE "AEVIONUser" SET "tokenVersion" = COALESCE("tokenVersion", 0) + 1
      WHERE "id" = $1 RETURNING "tokenVersion"`, [sub]);
    if (!rows.length)
        throw new Error("user not found");
    const next = Number(rows[0].tokenVersion) || 0;
    // Обновляем карту сразу: иначе между записью в базу и следующей полной
    // загрузкой старый токен продолжал бы работать — то есть кнопка сработала
    // бы «потом», а человек считал бы, что защитился сейчас.
    state.versions.set(sub, next);
    return next;
}
/** Для тестов: вернуть модуль в незагруженное состояние. */
function __resetTokenVersionsForTests() {
    state.versions = new Map();
    state.loadedAt = null;
    state.lastError = null;
}
