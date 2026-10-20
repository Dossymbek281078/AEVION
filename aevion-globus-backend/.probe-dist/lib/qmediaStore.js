"use strict";
/**
 * Хранилище QMedia: база, а не память процесса.
 *
 * Замер 27.08.2026, тремя способами:
 *   · в `routes/qmedia.ts` НОЛЬ вызовов pool.query на 31 маршрут;
 *   · четыре таблицы создаются при старте, и ни одну из них модуль не
 *     запрашивает (единственный читатель `QMediaTrack` — ecosystem.ts, ради
 *     счётчика);
 *   · прод: `/api/qmedia/health` перечисляет все четыре таблицы, а
 *     `/api/qmedia/tracks` и `/videos` отдают пустые списки.
 *
 * То есть модуль за $15/мес (входит в medium, full, enterprise; статус `live`)
 * терял всё загруженное при каждой выкатке, а ручка состояния при этом
 * обещала хранилище. Схема таблиц была написана полностью и правильно — её
 * просто не подключили.
 *
 * Идиома взята из qlearn, чтобы у платформы не появилось второго способа
 * делать то же самое: сначала база, память — только когда базы НЕТ ВОВСЕ;
 * `failed` отличает «ничего нет» от «спросить не удалось», и вызывающий
 * отвечает на второе отказом, а не пустотой.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.memLikes = exports.memVideos = exports.memPlaylists = exports.memTracks = void 0;
exports.listPublicTracks = listPublicTracks;
exports.allTracks = allTracks;
exports.listMyTracks = listMyTracks;
exports.getTrack = getTrack;
exports.saveTrack = saveTrack;
exports.deleteTrack = deleteTrack;
exports.bumpPlayCount = bumpPlayCount;
exports.listPublicPlaylists = listPublicPlaylists;
exports.listMyPlaylists = listMyPlaylists;
exports.getPlaylist = getPlaylist;
exports.savePlaylist = savePlaylist;
exports.deletePlaylist = deletePlaylist;
exports.listPublicVideos = listPublicVideos;
exports.listMyVideos = listMyVideos;
exports.getVideo = getVideo;
exports.saveVideo = saveVideo;
exports.deleteVideo = deleteVideo;
exports.bumpViewCount = bumpViewCount;
exports.toggleLike = toggleLike;
exports.listMyLikes = listMyLikes;
const dbPool_1 = require("./dbPool");
const ensureQMediaTables_1 = require("./ensureQMediaTables");
const pool = (0, dbPool_1.getPool)();
/** Память — хранилище ТОЛЬКО там, где базы нет вовсе (разработка, демо). */
exports.memTracks = new Map();
function iso(v) {
    if (v instanceof Date)
        return v.toISOString();
    const s = String(v ?? "");
    const ms = Date.parse(s);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : new Date(0).toISOString();
}
function rowToTrack(r) {
    return {
        id: String(r.id),
        userId: String(r.userId),
        title: String(r.title ?? ""),
        artist: String(r.artist ?? ""),
        genre: String(r.genre ?? "other"),
        duration: Number(r.duration ?? 0),
        url: r.url === null || r.url === undefined ? null : String(r.url),
        coverUrl: r.coverUrl === null || r.coverUrl === undefined ? null : String(r.coverUrl),
        lyrics: r.lyrics === null || r.lyrics === undefined ? null : String(r.lyrics),
        playCount: Number(r.playCount ?? 0),
        isPublic: Boolean(r.isPublic),
        tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
        createdAt: iso(r.createdAt),
        updatedAt: iso(r.updatedAt),
    };
}
const COLS = '"id","userId","title","artist","genre","duration","url","coverUrl","lyrics",' +
    '"playCount","isPublic","tags","createdAt","updatedAt"';
/**
 * Публичные треки. Фильтры уходят В SQL, а не применяются после выборки:
 * иначе LIMIT отрезал бы записи ДО фильтрации, и жанр с редкими треками
 * возвращал бы пустоту при полной базе. Порядок — по числу прослушиваний,
 * как было в маршруте до переноса: поведение здесь не меняется.
 */
async function listPublicTracks(limit, opts = {}) {
    const genre = opts.genre ?? null;
    const q = opts.q ?? null;
    if ((0, ensureQMediaTables_1.isQMediaDbReady)()) {
        try {
            const params = [];
            const where = ['"isPublic" = TRUE'];
            if (genre) {
                params.push(genre);
                where.push(`"genre" = $${params.length}`);
            }
            if (q) {
                params.push(`%${q}%`);
                where.push(`("title" ILIKE $${params.length} OR "artist" ILIKE $${params.length})`);
            }
            params.push(limit);
            const { rows } = await pool.query(`SELECT ${COLS} FROM "QMediaTrack" WHERE ${where.join(" AND ")}
          ORDER BY "playCount" DESC LIMIT $${params.length}`, params);
            return { rows: rows.map(rowToTrack), failed: false };
        }
        catch (e) {
            console.error("[QMedia] список публичных треков не прочитан", e);
            return { rows: [], failed: true };
        }
    }
    const needle = q ? q.toLowerCase() : null;
    const rows = [...exports.memTracks.values()]
        .filter((t) => t.isPublic)
        .filter((t) => (genre ? t.genre === genre : true))
        .filter((t) => needle
        ? t.title.toLowerCase().includes(needle) || t.artist.toLowerCase().includes(needle)
        : true)
        .sort((a, b) => b.playCount - a.playCount)
        .slice(0, limit);
    return { rows, failed: false };
}
/**
 * Все треки — для производных выборок: рекомендации, тренды, радио, похожие,
 * умные плейлисты. Они считают по всему набору, а не по странице, поэтому
 * пагинация здесь была бы неверной: топ по жанру нельзя собрать из первых N
 * записей.
 *
 * ⚠️ Честная граница: это выборка БЕЗ предела. Сегодня в модуле ноль треков,
 * и цена нулевая; при росте эти пять маршрутов надо переписать на агрегаты в
 * SQL, а не наращивать лимит. Пишу прямо, чтобы это не всплыло сюрпризом.
 */
async function allTracks() {
    if ((0, ensureQMediaTables_1.isQMediaDbReady)()) {
        try {
            const { rows } = await pool.query(`SELECT ${COLS} FROM "QMediaTrack"`);
            return { rows: rows.map(rowToTrack), failed: false };
        }
        catch (e) {
            console.error("[QMedia] полный список треков не прочитан", e);
            return { rows: [], failed: true };
        }
    }
    return { rows: [...exports.memTracks.values()], failed: false };
}
/** Мои треки — и публичные, и черновики. */
async function listMyTracks(userId) {
    if ((0, ensureQMediaTables_1.isQMediaDbReady)()) {
        try {
            const { rows } = await pool.query(`SELECT ${COLS} FROM "QMediaTrack" WHERE "userId" = $1 ORDER BY "createdAt" DESC`, [userId]);
            return { rows: rows.map(rowToTrack), failed: false };
        }
        catch (e) {
            console.error("[QMedia] список моих треков не прочитан", e);
            return { rows: [], failed: true };
        }
    }
    const rows = [...exports.memTracks.values()]
        .filter((t) => t.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { rows, failed: false };
}
async function getTrack(id) {
    if ((0, ensureQMediaTables_1.isQMediaDbReady)()) {
        try {
            const { rows } = await pool.query(`SELECT ${COLS} FROM "QMediaTrack" WHERE "id" = $1`, [id]);
            return { track: rows[0] ? rowToTrack(rows[0]) : null, failed: false };
        }
        catch (e) {
            console.error("[QMedia] трек не прочитан", e);
            return { track: null, failed: true };
        }
    }
    return { track: exports.memTracks.get(id) ?? null, failed: false };
}
async function saveTrack(t) {
    if ((0, ensureQMediaTables_1.isQMediaDbReady)()) {
        try {
            await pool.query(`INSERT INTO "QMediaTrack" (${COLS})
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT ("id") DO UPDATE SET
           "title"=$3,"artist"=$4,"genre"=$5,"duration"=$6,"url"=$7,"coverUrl"=$8,
           "lyrics"=$9,"playCount"=$10,"isPublic"=$11,"tags"=$12,"updatedAt"=$14`, [t.id, t.userId, t.title, t.artist, t.genre, t.duration, t.url, t.coverUrl,
                t.lyrics, t.playCount, t.isPublic, t.tags, t.createdAt, t.updatedAt]);
            return { failed: false };
        }
        catch (e) {
            console.error("[QMedia] трек не сохранён", e);
            return { failed: true };
        }
    }
    exports.memTracks.set(t.id, t);
    return { failed: false };
}
async function deleteTrack(id, userId) {
    if ((0, ensureQMediaTables_1.isQMediaDbReady)()) {
        try {
            const r = await pool.query(`DELETE FROM "QMediaTrack" WHERE "id" = $1 AND "userId" = $2`, [id, userId]);
            return { removed: (r.rowCount ?? 0) > 0, failed: false };
        }
        catch (e) {
            console.error("[QMedia] трек не удалён", e);
            return { removed: false, failed: true };
        }
    }
    const t = exports.memTracks.get(id);
    if (!t || t.userId !== userId)
        return { removed: false, failed: false };
    exports.memTracks.delete(id);
    return { removed: true, failed: false };
}
/**
 * Прослушивание. Счётчик наращивается В БАЗЕ одним запросом, а не чтением с
 * последующей записью: два слушателя одновременно потеряли бы один показ.
 */
async function bumpPlayCount(id) {
    if ((0, ensureQMediaTables_1.isQMediaDbReady)()) {
        try {
            const { rows } = await pool.query(`UPDATE "QMediaTrack" SET "playCount" = "playCount" + 1, "updatedAt" = NOW()
          WHERE "id" = $1 RETURNING "playCount"`, [id]);
            if (!rows[0])
                return { playCount: null, failed: false };
            return { playCount: Number(rows[0].playCount), failed: false };
        }
        catch (e) {
            console.error("[QMedia] прослушивание не засчитано", e);
            return { playCount: null, failed: true };
        }
    }
    const t = exports.memTracks.get(id);
    if (!t)
        return { playCount: null, failed: false };
    t.playCount += 1;
    t.updatedAt = new Date().toISOString();
    return { playCount: t.playCount, failed: false };
}
exports.memPlaylists = new Map();
const PL_COLS = '"id","userId","name","description","isPublic","trackIds","collaborators","createdAt","updatedAt"';
function asArray(v) {
    if (Array.isArray(v))
        return v;
    // JSONB приходит объектом; строкой — только если колонку объявили TEXT.
    if (typeof v === "string") {
        try {
            const parsed = JSON.parse(v);
            return Array.isArray(parsed) ? parsed : [];
        }
        catch {
            return [];
        }
    }
    return [];
}
function rowToPlaylist(r) {
    return {
        id: String(r.id),
        userId: String(r.userId),
        name: String(r.name ?? ""),
        description: r.description === null || r.description === undefined ? null : String(r.description),
        isPublic: Boolean(r.isPublic),
        trackIds: asArray(r.trackIds).map(String),
        collaborators: asArray(r.collaborators),
        createdAt: iso(r.createdAt),
        updatedAt: iso(r.updatedAt),
    };
}
async function listPublicPlaylists() {
    if ((0, ensureQMediaTables_1.isQMediaDbReady)()) {
        try {
            const { rows } = await pool.query(`SELECT ${PL_COLS} FROM "QMediaPlaylist" WHERE "isPublic" = TRUE ORDER BY "updatedAt" DESC`);
            return { rows: rows.map(rowToPlaylist), failed: false };
        }
        catch (e) {
            console.error("[QMedia] публичные плейлисты не прочитаны", e);
            return { rows: [], failed: true };
        }
    }
    const rows = [...exports.memPlaylists.values()]
        .filter((p) => p.isPublic)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { rows, failed: false };
}
async function listMyPlaylists(userId) {
    if ((0, ensureQMediaTables_1.isQMediaDbReady)()) {
        try {
            const { rows } = await pool.query(`SELECT ${PL_COLS} FROM "QMediaPlaylist" WHERE "userId" = $1 ORDER BY "updatedAt" DESC`, [userId]);
            return { rows: rows.map(rowToPlaylist), failed: false };
        }
        catch (e) {
            console.error("[QMedia] мои плейлисты не прочитаны", e);
            return { rows: [], failed: true };
        }
    }
    const rows = [...exports.memPlaylists.values()]
        .filter((p) => p.userId === userId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { rows, failed: false };
}
async function getPlaylist(id) {
    if ((0, ensureQMediaTables_1.isQMediaDbReady)()) {
        try {
            const { rows } = await pool.query(`SELECT ${PL_COLS} FROM "QMediaPlaylist" WHERE "id" = $1`, [id]);
            return { playlist: rows[0] ? rowToPlaylist(rows[0]) : null, failed: false };
        }
        catch (e) {
            console.error("[QMedia] плейлист не прочитан", e);
            return { playlist: null, failed: true };
        }
    }
    return { playlist: exports.memPlaylists.get(id) ?? null, failed: false };
}
async function savePlaylist(p0) {
    if ((0, ensureQMediaTables_1.isQMediaDbReady)()) {
        try {
            await pool.query(`INSERT INTO "QMediaPlaylist" (${PL_COLS})
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)
         ON CONFLICT ("id") DO UPDATE SET
           "name"=$3,"description"=$4,"isPublic"=$5,"trackIds"=$6::jsonb,
           "collaborators"=$7::jsonb,"updatedAt"=$9`, [p0.id, p0.userId, p0.name, p0.description, p0.isPublic,
                JSON.stringify(p0.trackIds), JSON.stringify(p0.collaborators ?? []),
                p0.createdAt, p0.updatedAt]);
            return { failed: false };
        }
        catch (e) {
            console.error("[QMedia] плейлист не сохранён", e);
            return { failed: true };
        }
    }
    exports.memPlaylists.set(p0.id, p0);
    return { failed: false };
}
async function deletePlaylist(id, userId) {
    if ((0, ensureQMediaTables_1.isQMediaDbReady)()) {
        try {
            const r = await pool.query(`DELETE FROM "QMediaPlaylist" WHERE "id" = $1 AND "userId" = $2`, [id, userId]);
            return { removed: (r.rowCount ?? 0) > 0, failed: false };
        }
        catch (e) {
            console.error("[QMedia] плейлист не удалён", e);
            return { removed: false, failed: true };
        }
    }
    const pl = exports.memPlaylists.get(id);
    if (!pl || pl.userId !== userId)
        return { removed: false, failed: false };
    exports.memPlaylists.delete(id);
    return { removed: true, failed: false };
}
exports.memVideos = new Map();
const V_COLS = '"id","userId","title","description","url","thumbnailUrl","duration",' +
    '"viewCount","isPublic","category","tags","createdAt","updatedAt"';
function rowToVideo(r) {
    return {
        id: String(r.id),
        userId: String(r.userId),
        title: String(r.title ?? ""),
        description: r.description === null || r.description === undefined ? null : String(r.description),
        url: r.url === null || r.url === undefined ? null : String(r.url),
        thumbnailUrl: r.thumbnailUrl === null || r.thumbnailUrl === undefined ? null : String(r.thumbnailUrl),
        duration: Number(r.duration ?? 0),
        viewCount: Number(r.viewCount ?? 0),
        isPublic: Boolean(r.isPublic),
        category: String(r.category ?? "other"),
        tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
        createdAt: iso(r.createdAt),
        updatedAt: iso(r.updatedAt),
    };
}
/** Публичные видео. Фильтры — в SQL, порядок по просмотрам, как было. */
async function listPublicVideos(limit, opts = {}) {
    const category = opts.category ?? null;
    const q = opts.q ?? null;
    if ((0, ensureQMediaTables_1.isQMediaDbReady)()) {
        try {
            const params = [];
            const where = ['"isPublic" = TRUE'];
            if (category) {
                params.push(category);
                where.push(`"category" = $${params.length}`);
            }
            if (q) {
                params.push(`%${q}%`);
                where.push(`"title" ILIKE $${params.length}`);
            }
            params.push(limit);
            const { rows } = await pool.query(`SELECT ${V_COLS} FROM "QMediaVideo" WHERE ${where.join(" AND ")}
          ORDER BY "viewCount" DESC LIMIT $${params.length}`, params);
            return { rows: rows.map(rowToVideo), failed: false };
        }
        catch (e) {
            console.error("[QMedia] публичные видео не прочитаны", e);
            return { rows: [], failed: true };
        }
    }
    const needle = q ? q.toLowerCase() : null;
    const rows = [...exports.memVideos.values()]
        .filter((v) => v.isPublic)
        .filter((v) => (category ? v.category === category : true))
        .filter((v) => (needle ? v.title.toLowerCase().includes(needle) : true))
        .sort((a, b) => b.viewCount - a.viewCount)
        .slice(0, limit);
    return { rows, failed: false };
}
async function listMyVideos(userId) {
    if ((0, ensureQMediaTables_1.isQMediaDbReady)()) {
        try {
            const { rows } = await pool.query(`SELECT ${V_COLS} FROM "QMediaVideo" WHERE "userId" = $1 ORDER BY "createdAt" DESC`, [userId]);
            return { rows: rows.map(rowToVideo), failed: false };
        }
        catch (e) {
            console.error("[QMedia] мои видео не прочитаны", e);
            return { rows: [], failed: true };
        }
    }
    const rows = [...exports.memVideos.values()]
        .filter((v) => v.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { rows, failed: false };
}
async function getVideo(id) {
    if ((0, ensureQMediaTables_1.isQMediaDbReady)()) {
        try {
            const { rows } = await pool.query(`SELECT ${V_COLS} FROM "QMediaVideo" WHERE "id" = $1`, [id]);
            return { video: rows[0] ? rowToVideo(rows[0]) : null, failed: false };
        }
        catch (e) {
            console.error("[QMedia] видео не прочитано", e);
            return { video: null, failed: true };
        }
    }
    return { video: exports.memVideos.get(id) ?? null, failed: false };
}
async function saveVideo(v) {
    if ((0, ensureQMediaTables_1.isQMediaDbReady)()) {
        try {
            await pool.query(`INSERT INTO "QMediaVideo" (${V_COLS})
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT ("id") DO UPDATE SET
           "title"=$3,"description"=$4,"url"=$5,"thumbnailUrl"=$6,"duration"=$7,
           "viewCount"=$8,"isPublic"=$9,"category"=$10,"tags"=$11,"updatedAt"=$13`, [v.id, v.userId, v.title, v.description, v.url, v.thumbnailUrl, v.duration,
                v.viewCount, v.isPublic, v.category, v.tags, v.createdAt, v.updatedAt]);
            return { failed: false };
        }
        catch (e) {
            console.error("[QMedia] видео не сохранено", e);
            return { failed: true };
        }
    }
    exports.memVideos.set(v.id, v);
    return { failed: false };
}
async function deleteVideo(id, userId) {
    if ((0, ensureQMediaTables_1.isQMediaDbReady)()) {
        try {
            const r = await pool.query(`DELETE FROM "QMediaVideo" WHERE "id" = $1 AND "userId" = $2`, [id, userId]);
            return { removed: (r.rowCount ?? 0) > 0, failed: false };
        }
        catch (e) {
            console.error("[QMedia] видео не удалено", e);
            return { removed: false, failed: true };
        }
    }
    const v = exports.memVideos.get(id);
    if (!v || v.userId !== userId)
        return { removed: false, failed: false };
    exports.memVideos.delete(id);
    return { removed: true, failed: false };
}
/** Просмотр: счётчик растёт В БАЗЕ одним запросом, как и у прослушиваний. */
async function bumpViewCount(id) {
    if ((0, ensureQMediaTables_1.isQMediaDbReady)()) {
        try {
            const { rows } = await pool.query(`UPDATE "QMediaVideo" SET "viewCount" = "viewCount" + 1, "updatedAt" = NOW()
          WHERE "id" = $1 RETURNING "viewCount"`, [id]);
            if (!rows[0])
                return { viewCount: null, failed: false };
            return { viewCount: Number(rows[0].viewCount), failed: false };
        }
        catch (e) {
            console.error("[QMedia] просмотр не засчитан", e);
            return { viewCount: null, failed: true };
        }
    }
    const v = exports.memVideos.get(id);
    if (!v)
        return { viewCount: null, failed: false };
    v.viewCount += 1;
    v.updatedAt = new Date().toISOString();
    return { viewCount: v.viewCount, failed: false };
}
/* ── Лайки ────────────────────────────────────────────────────────────── */
exports.memLikes = new Map();
/**
 * Переключить лайк. Возвращает НОВОЕ состояние.
 *
 * Ключ составной (человек, ресурс, тип) — он и есть первичный ключ таблицы,
 * поэтому повторное нажатие не рождает вторую строку.
 */
async function toggleLike(userId, resourceId, resourceType) {
    if ((0, ensureQMediaTables_1.isQMediaDbReady)()) {
        try {
            const del = await pool.query(`DELETE FROM "QMediaLike"
          WHERE "userId" = $1 AND "resourceId" = $2 AND "resourceType" = $3`, [userId, resourceId, resourceType]);
            if ((del.rowCount ?? 0) > 0)
                return { liked: false, failed: false };
            await pool.query(`INSERT INTO "QMediaLike" ("userId","resourceId","resourceType")
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [userId, resourceId, resourceType]);
            return { liked: true, failed: false };
        }
        catch (e) {
            console.error("[QMedia] лайк не сохранён", e);
            return { liked: false, failed: true };
        }
    }
    const key = `${userId}:${resourceType}:${resourceId}`;
    const liked = !exports.memLikes.get(key);
    if (liked)
        exports.memLikes.set(key, true);
    else
        exports.memLikes.delete(key);
    return { liked, failed: false };
}
async function listMyLikes(userId) {
    if ((0, ensureQMediaTables_1.isQMediaDbReady)()) {
        try {
            const { rows } = await pool.query(`SELECT "resourceType","resourceId" FROM "QMediaLike"
          WHERE "userId" = $1 ORDER BY "createdAt" DESC`, [userId]);
            return {
                rows: rows.map((r) => ({
                    type: String(r.resourceType),
                    id: String(r.resourceId),
                })),
                failed: false,
            };
        }
        catch (e) {
            console.error("[QMedia] мои лайки не прочитаны", e);
            return { rows: [], failed: true };
        }
    }
    const prefix = `${userId}:`;
    const rows = [...exports.memLikes.keys()]
        .filter((k) => k.startsWith(prefix))
        .map((k) => {
        const parts = k.split(":");
        return { type: parts[1], id: parts.slice(2).join(":") };
    });
    return { rows, failed: false };
}
