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

import { getPool } from "./dbPool";
import { isQMediaDbReady } from "./ensureQMediaTables";

const pool = getPool();

export type TrackRow = {
  id: string;
  userId: string;
  title: string;
  artist: string;
  genre: string;
  duration: number;
  url: string | null;
  coverUrl: string | null;
  lyrics: string | null;
  playCount: number;
  isPublic: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

/** Память — хранилище ТОЛЬКО там, где базы нет вовсе (разработка, демо). */
export const memTracks = new Map<string, TrackRow>();

function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  const s = String(v ?? "");
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : new Date(0).toISOString();
}

function rowToTrack(r: Record<string, unknown>): TrackRow {
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
    tags: Array.isArray(r.tags) ? (r.tags as string[]).map(String) : [],
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

const COLS =
  '"id","userId","title","artist","genre","duration","url","coverUrl","lyrics",' +
  '"playCount","isPublic","tags","createdAt","updatedAt"';

/**
 * Публичные треки. Фильтры уходят В SQL, а не применяются после выборки:
 * иначе LIMIT отрезал бы записи ДО фильтрации, и жанр с редкими треками
 * возвращал бы пустоту при полной базе. Порядок — по числу прослушиваний,
 * как было в маршруте до переноса: поведение здесь не меняется.
 */
export async function listPublicTracks(
  limit: number,
  opts: { genre?: string | null; q?: string | null } = {},
): Promise<{ rows: TrackRow[]; failed: boolean }> {
  const genre = opts.genre ?? null;
  const q = opts.q ?? null;
  if (isQMediaDbReady()) {
    try {
      const params: unknown[] = [];
      const where = ['"isPublic" = TRUE'];
      if (genre) { params.push(genre); where.push(`"genre" = $${params.length}`); }
      if (q) {
        params.push(`%${q}%`);
        where.push(`("title" ILIKE $${params.length} OR "artist" ILIKE $${params.length})`);
      }
      params.push(limit);
      const { rows } = await pool.query(
        `SELECT ${COLS} FROM "QMediaTrack" WHERE ${where.join(" AND ")}
          ORDER BY "playCount" DESC LIMIT $${params.length}`,
        params,
      );
      return { rows: rows.map(rowToTrack), failed: false };
    } catch (e) {
      console.error("[QMedia] список публичных треков не прочитан", e);
      return { rows: [], failed: true };
    }
  }
  const needle = q ? q.toLowerCase() : null;
  const rows = [...memTracks.values()]
    .filter((t) => t.isPublic)
    .filter((t) => (genre ? t.genre === genre : true))
    .filter((t) =>
      needle
        ? t.title.toLowerCase().includes(needle) || t.artist.toLowerCase().includes(needle)
        : true,
    )
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
export async function allTracks(): Promise<{ rows: TrackRow[]; failed: boolean }> {
  if (isQMediaDbReady()) {
    try {
      const { rows } = await pool.query(`SELECT ${COLS} FROM "QMediaTrack"`);
      return { rows: rows.map(rowToTrack), failed: false };
    } catch (e) {
      console.error("[QMedia] полный список треков не прочитан", e);
      return { rows: [], failed: true };
    }
  }
  return { rows: [...memTracks.values()], failed: false };
}

/** Мои треки — и публичные, и черновики. */
export async function listMyTracks(
  userId: string,
): Promise<{ rows: TrackRow[]; failed: boolean }> {
  if (isQMediaDbReady()) {
    try {
      const { rows } = await pool.query(
        `SELECT ${COLS} FROM "QMediaTrack" WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
        [userId],
      );
      return { rows: rows.map(rowToTrack), failed: false };
    } catch (e) {
      console.error("[QMedia] список моих треков не прочитан", e);
      return { rows: [], failed: true };
    }
  }
  const rows = [...memTracks.values()]
    .filter((t) => t.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { rows, failed: false };
}

export async function getTrack(
  id: string,
): Promise<{ track: TrackRow | null; failed: boolean }> {
  if (isQMediaDbReady()) {
    try {
      const { rows } = await pool.query(`SELECT ${COLS} FROM "QMediaTrack" WHERE "id" = $1`, [id]);
      return { track: rows[0] ? rowToTrack(rows[0]) : null, failed: false };
    } catch (e) {
      console.error("[QMedia] трек не прочитан", e);
      return { track: null, failed: true };
    }
  }
  return { track: memTracks.get(id) ?? null, failed: false };
}

export async function saveTrack(t: TrackRow): Promise<{ failed: boolean }> {
  if (isQMediaDbReady()) {
    try {
      await pool.query(
        `INSERT INTO "QMediaTrack" (${COLS})
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT ("id") DO UPDATE SET
           "title"=$3,"artist"=$4,"genre"=$5,"duration"=$6,"url"=$7,"coverUrl"=$8,
           "lyrics"=$9,"playCount"=$10,"isPublic"=$11,"tags"=$12,"updatedAt"=$14`,
        [t.id, t.userId, t.title, t.artist, t.genre, t.duration, t.url, t.coverUrl,
         t.lyrics, t.playCount, t.isPublic, t.tags, t.createdAt, t.updatedAt],
      );
      return { failed: false };
    } catch (e) {
      console.error("[QMedia] трек не сохранён", e);
      return { failed: true };
    }
  }
  memTracks.set(t.id, t);
  return { failed: false };
}

export async function deleteTrack(
  id: string,
  userId: string,
): Promise<{ removed: boolean; failed: boolean }> {
  if (isQMediaDbReady()) {
    try {
      const r = await pool.query(
        `DELETE FROM "QMediaTrack" WHERE "id" = $1 AND "userId" = $2`,
        [id, userId],
      );
      return { removed: (r.rowCount ?? 0) > 0, failed: false };
    } catch (e) {
      console.error("[QMedia] трек не удалён", e);
      return { removed: false, failed: true };
    }
  }
  const t = memTracks.get(id);
  if (!t || t.userId !== userId) return { removed: false, failed: false };
  memTracks.delete(id);
  return { removed: true, failed: false };
}

/**
 * Прослушивание. Счётчик наращивается В БАЗЕ одним запросом, а не чтением с
 * последующей записью: два слушателя одновременно потеряли бы один показ.
 */
export async function bumpPlayCount(
  id: string,
): Promise<{ playCount: number | null; failed: boolean }> {
  if (isQMediaDbReady()) {
    try {
      const { rows } = await pool.query(
        `UPDATE "QMediaTrack" SET "playCount" = "playCount" + 1, "updatedAt" = NOW()
          WHERE "id" = $1 RETURNING "playCount"`,
        [id],
      );
      if (!rows[0]) return { playCount: null, failed: false };
      return { playCount: Number(rows[0].playCount), failed: false };
    } catch (e) {
      console.error("[QMedia] прослушивание не засчитано", e);
      return { playCount: null, failed: true };
    }
  }
  const t = memTracks.get(id);
  if (!t) return { playCount: null, failed: false };
  t.playCount += 1;
  t.updatedAt = new Date().toISOString();
  return { playCount: t.playCount, failed: false };
}


/* ── Плейлисты ────────────────────────────────────────────────────────── */

export type PlaylistCollaborator = { userId: string; canEdit: boolean };

export type PlaylistRow = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  trackIds: string[];
  collaborators?: PlaylistCollaborator[];
  createdAt: string;
  updatedAt: string;
};

export const memPlaylists = new Map<string, PlaylistRow>();

const PL_COLS =
  '"id","userId","name","description","isPublic","trackIds","collaborators","createdAt","updatedAt"';

function asArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  // JSONB приходит объектом; строкой — только если колонку объявили TEXT.
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function rowToPlaylist(r: Record<string, unknown>): PlaylistRow {
  return {
    id: String(r.id),
    userId: String(r.userId),
    name: String(r.name ?? ""),
    description: r.description === null || r.description === undefined ? null : String(r.description),
    isPublic: Boolean(r.isPublic),
    trackIds: asArray<string>(r.trackIds).map(String),
    collaborators: asArray<PlaylistCollaborator>(r.collaborators),
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

export async function listPublicPlaylists(): Promise<{ rows: PlaylistRow[]; failed: boolean }> {
  if (isQMediaDbReady()) {
    try {
      const { rows } = await pool.query(
        `SELECT ${PL_COLS} FROM "QMediaPlaylist" WHERE "isPublic" = TRUE ORDER BY "updatedAt" DESC`,
      );
      return { rows: rows.map(rowToPlaylist), failed: false };
    } catch (e) {
      console.error("[QMedia] публичные плейлисты не прочитаны", e);
      return { rows: [], failed: true };
    }
  }
  const rows = [...memPlaylists.values()]
    .filter((p) => p.isPublic)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { rows, failed: false };
}

export async function listMyPlaylists(userId: string): Promise<{ rows: PlaylistRow[]; failed: boolean }> {
  if (isQMediaDbReady()) {
    try {
      const { rows } = await pool.query(
        `SELECT ${PL_COLS} FROM "QMediaPlaylist" WHERE "userId" = $1 ORDER BY "updatedAt" DESC`,
        [userId],
      );
      return { rows: rows.map(rowToPlaylist), failed: false };
    } catch (e) {
      console.error("[QMedia] мои плейлисты не прочитаны", e);
      return { rows: [], failed: true };
    }
  }
  const rows = [...memPlaylists.values()]
    .filter((p) => p.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { rows, failed: false };
}

export async function getPlaylist(id: string): Promise<{ playlist: PlaylistRow | null; failed: boolean }> {
  if (isQMediaDbReady()) {
    try {
      const { rows } = await pool.query(`SELECT ${PL_COLS} FROM "QMediaPlaylist" WHERE "id" = $1`, [id]);
      return { playlist: rows[0] ? rowToPlaylist(rows[0]) : null, failed: false };
    } catch (e) {
      console.error("[QMedia] плейлист не прочитан", e);
      return { playlist: null, failed: true };
    }
  }
  return { playlist: memPlaylists.get(id) ?? null, failed: false };
}

export async function savePlaylist(p0: PlaylistRow): Promise<{ failed: boolean }> {
  if (isQMediaDbReady()) {
    try {
      await pool.query(
        `INSERT INTO "QMediaPlaylist" (${PL_COLS})
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)
         ON CONFLICT ("id") DO UPDATE SET
           "name"=$3,"description"=$4,"isPublic"=$5,"trackIds"=$6::jsonb,
           "collaborators"=$7::jsonb,"updatedAt"=$9`,
        [p0.id, p0.userId, p0.name, p0.description, p0.isPublic,
         JSON.stringify(p0.trackIds), JSON.stringify(p0.collaborators ?? []),
         p0.createdAt, p0.updatedAt],
      );
      return { failed: false };
    } catch (e) {
      console.error("[QMedia] плейлист не сохранён", e);
      return { failed: true };
    }
  }
  memPlaylists.set(p0.id, p0);
  return { failed: false };
}

export async function deletePlaylist(
  id: string,
  userId: string,
): Promise<{ removed: boolean; failed: boolean }> {
  if (isQMediaDbReady()) {
    try {
      const r = await pool.query(
        `DELETE FROM "QMediaPlaylist" WHERE "id" = $1 AND "userId" = $2`, [id, userId]);
      return { removed: (r.rowCount ?? 0) > 0, failed: false };
    } catch (e) {
      console.error("[QMedia] плейлист не удалён", e);
      return { removed: false, failed: true };
    }
  }
  const pl = memPlaylists.get(id);
  if (!pl || pl.userId !== userId) return { removed: false, failed: false };
  memPlaylists.delete(id);
  return { removed: true, failed: false };
}


/* ── Видео ────────────────────────────────────────────────────────────── */

export type VideoRow = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  url: string | null;
  thumbnailUrl: string | null;
  duration: number;
  viewCount: number;
  isPublic: boolean;
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export const memVideos = new Map<string, VideoRow>();

const V_COLS =
  '"id","userId","title","description","url","thumbnailUrl","duration",' +
  '"viewCount","isPublic","category","tags","createdAt","updatedAt"';

function rowToVideo(r: Record<string, unknown>): VideoRow {
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
    tags: Array.isArray(r.tags) ? (r.tags as string[]).map(String) : [],
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

/** Публичные видео. Фильтры — в SQL, порядок по просмотрам, как было. */
export async function listPublicVideos(
  limit: number,
  opts: { category?: string | null; q?: string | null } = {},
): Promise<{ rows: VideoRow[]; failed: boolean }> {
  const category = opts.category ?? null;
  const q = opts.q ?? null;
  if (isQMediaDbReady()) {
    try {
      const params: unknown[] = [];
      const where = ['"isPublic" = TRUE'];
      if (category) { params.push(category); where.push(`"category" = $${params.length}`); }
      if (q) { params.push(`%${q}%`); where.push(`"title" ILIKE $${params.length}`); }
      params.push(limit);
      const { rows } = await pool.query(
        `SELECT ${V_COLS} FROM "QMediaVideo" WHERE ${where.join(" AND ")}
          ORDER BY "viewCount" DESC LIMIT $${params.length}`,
        params,
      );
      return { rows: rows.map(rowToVideo), failed: false };
    } catch (e) {
      console.error("[QMedia] публичные видео не прочитаны", e);
      return { rows: [], failed: true };
    }
  }
  const needle = q ? q.toLowerCase() : null;
  const rows = [...memVideos.values()]
    .filter((v) => v.isPublic)
    .filter((v) => (category ? v.category === category : true))
    .filter((v) => (needle ? v.title.toLowerCase().includes(needle) : true))
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, limit);
  return { rows, failed: false };
}

export async function listMyVideos(userId: string): Promise<{ rows: VideoRow[]; failed: boolean }> {
  if (isQMediaDbReady()) {
    try {
      const { rows } = await pool.query(
        `SELECT ${V_COLS} FROM "QMediaVideo" WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
        [userId],
      );
      return { rows: rows.map(rowToVideo), failed: false };
    } catch (e) {
      console.error("[QMedia] мои видео не прочитаны", e);
      return { rows: [], failed: true };
    }
  }
  const rows = [...memVideos.values()]
    .filter((v) => v.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { rows, failed: false };
}

export async function getVideo(id: string): Promise<{ video: VideoRow | null; failed: boolean }> {
  if (isQMediaDbReady()) {
    try {
      const { rows } = await pool.query(`SELECT ${V_COLS} FROM "QMediaVideo" WHERE "id" = $1`, [id]);
      return { video: rows[0] ? rowToVideo(rows[0]) : null, failed: false };
    } catch (e) {
      console.error("[QMedia] видео не прочитано", e);
      return { video: null, failed: true };
    }
  }
  return { video: memVideos.get(id) ?? null, failed: false };
}

export async function saveVideo(v: VideoRow): Promise<{ failed: boolean }> {
  if (isQMediaDbReady()) {
    try {
      await pool.query(
        `INSERT INTO "QMediaVideo" (${V_COLS})
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT ("id") DO UPDATE SET
           "title"=$3,"description"=$4,"url"=$5,"thumbnailUrl"=$6,"duration"=$7,
           "viewCount"=$8,"isPublic"=$9,"category"=$10,"tags"=$11,"updatedAt"=$13`,
        [v.id, v.userId, v.title, v.description, v.url, v.thumbnailUrl, v.duration,
         v.viewCount, v.isPublic, v.category, v.tags, v.createdAt, v.updatedAt],
      );
      return { failed: false };
    } catch (e) {
      console.error("[QMedia] видео не сохранено", e);
      return { failed: true };
    }
  }
  memVideos.set(v.id, v);
  return { failed: false };
}

export async function deleteVideo(
  id: string,
  userId: string,
): Promise<{ removed: boolean; failed: boolean }> {
  if (isQMediaDbReady()) {
    try {
      const r = await pool.query(
        `DELETE FROM "QMediaVideo" WHERE "id" = $1 AND "userId" = $2`, [id, userId]);
      return { removed: (r.rowCount ?? 0) > 0, failed: false };
    } catch (e) {
      console.error("[QMedia] видео не удалено", e);
      return { removed: false, failed: true };
    }
  }
  const v = memVideos.get(id);
  if (!v || v.userId !== userId) return { removed: false, failed: false };
  memVideos.delete(id);
  return { removed: true, failed: false };
}

/** Просмотр: счётчик растёт В БАЗЕ одним запросом, как и у прослушиваний. */
export async function bumpViewCount(
  id: string,
): Promise<{ viewCount: number | null; failed: boolean }> {
  if (isQMediaDbReady()) {
    try {
      const { rows } = await pool.query(
        `UPDATE "QMediaVideo" SET "viewCount" = "viewCount" + 1, "updatedAt" = NOW()
          WHERE "id" = $1 RETURNING "viewCount"`,
        [id],
      );
      if (!rows[0]) return { viewCount: null, failed: false };
      return { viewCount: Number(rows[0].viewCount), failed: false };
    } catch (e) {
      console.error("[QMedia] просмотр не засчитан", e);
      return { viewCount: null, failed: true };
    }
  }
  const v = memVideos.get(id);
  if (!v) return { viewCount: null, failed: false };
  v.viewCount += 1;
  v.updatedAt = new Date().toISOString();
  return { viewCount: v.viewCount, failed: false };
}


/* ── Лайки ────────────────────────────────────────────────────────────── */

export const memLikes = new Map<string, boolean>();

/**
 * Переключить лайк. Возвращает НОВОЕ состояние.
 *
 * Ключ составной (человек, ресурс, тип) — он и есть первичный ключ таблицы,
 * поэтому повторное нажатие не рождает вторую строку.
 */
export async function toggleLike(
  userId: string,
  resourceId: string,
  resourceType: string,
): Promise<{ liked: boolean; failed: boolean }> {
  if (isQMediaDbReady()) {
    try {
      const del = await pool.query(
        `DELETE FROM "QMediaLike"
          WHERE "userId" = $1 AND "resourceId" = $2 AND "resourceType" = $3`,
        [userId, resourceId, resourceType],
      );
      if ((del.rowCount ?? 0) > 0) return { liked: false, failed: false };
      await pool.query(
        `INSERT INTO "QMediaLike" ("userId","resourceId","resourceType")
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [userId, resourceId, resourceType],
      );
      return { liked: true, failed: false };
    } catch (e) {
      console.error("[QMedia] лайк не сохранён", e);
      return { liked: false, failed: true };
    }
  }
  const key = `${userId}:${resourceType}:${resourceId}`;
  const liked = !memLikes.get(key);
  if (liked) memLikes.set(key, true);
  else memLikes.delete(key);
  return { liked, failed: false };
}

export async function listMyLikes(
  userId: string,
): Promise<{ rows: Array<{ type: string; id: string }>; failed: boolean }> {
  if (isQMediaDbReady()) {
    try {
      const { rows } = await pool.query(
        `SELECT "resourceType","resourceId" FROM "QMediaLike"
          WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
        [userId],
      );
      return {
        rows: rows.map((r: { resourceType: unknown; resourceId: unknown }) => ({
          type: String(r.resourceType),
          id: String(r.resourceId),
        })),
        failed: false,
      };
    } catch (e) {
      console.error("[QMedia] мои лайки не прочитаны", e);
      return { rows: [], failed: true };
    }
  }
  const prefix = `${userId}:`;
  const rows = [...memLikes.keys()]
    .filter((k) => k.startsWith(prefix))
    .map((k) => {
      const parts = k.split(":");
      return { type: parts[1], id: parts.slice(2).join(":") };
    });
  return { rows, failed: false };
}
