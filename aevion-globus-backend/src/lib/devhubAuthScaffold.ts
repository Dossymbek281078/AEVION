/**
 * Шаблон ВХОДА ПОЛЬЗОВАТЕЛЕЙ для приложений, которые собирает DevHub.
 *
 * ПОЧЕМУ ШАБЛОН, А НЕ ГЕНЕРАЦИЯ. Вход — единственная часть приложения, где ошибка
 * стоит не «некрасиво», а «утекли пароли чужих людей». Модель каждый раз пишет его
 * заново: то пароль в открытом виде, то ответ «такого пользователя нет», по которому
 * перебирают почты, то cookie без httpOnly. Поэтому вход даётся готовым и проверенным,
 * а модель получает указание пользоваться им, а не писать свой.
 *
 * ЧЕГО ЗДЕСЬ НЕТ НАМЕРЕННО: подтверждения почты и восстановления пароля. Их нельзя
 * сделать честно без настроенной почты у КОНЕЧНОГО приложения, а обещать письмо,
 * которое не уйдёт, хуже, чем не обещать.
 */

export interface ФайлШаблона {
  path: string;
  content: string;
  language: string;
}

/** Зависимости, без которых шаблон не заработает. */
export const ЗАВИСИМОСТИ_ВХОДА: Record<string, string> = {
  bcryptjs: "^2.4.3",
  pg: "^8.11.3",
};

const SCHEMA_SQL = "-- Таблицы входа пользователей. Выполняются один раз при первом запуске.\nCREATE TABLE IF NOT EXISTS users (\n  id            BIGSERIAL PRIMARY KEY,\n  email         TEXT NOT NULL UNIQUE,\n  -- ХЕШ, а не пароль: обратно не восстанавливается, так и задумано.\n  password_hash TEXT NOT NULL,\n  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()\n);\n\nCREATE TABLE IF NOT EXISTS sessions (\n  token      TEXT PRIMARY KEY,\n  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  expires_at TIMESTAMPTZ NOT NULL,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n);\n\nCREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);\n";
const LIB_AUTH = "// Вход пользователей: хеширование, сессии, текущий пользователь.\n// Файл дан шаблоном AEVION DevHub и проверен. Меняйте осознанно.\nconst bcrypt = require('bcryptjs');\nconst crypto = require('node:crypto');\nconst { Pool } = require('pg');\n\nconst pool = new Pool({ connectionString: process.env.DATABASE_URL });\n\n// Стоимость подбирается так, чтобы проверка занимала десятки миллисекунд:\n// быстрый хеш дёшево перебирается на чужой видеокарте.\nconst COST = 10;\nconst SESSION_DAYS = 30;\nconst MIN_PASSWORD = 8;\n\nconst normEmail = (raw) => String(raw || '').trim().toLowerCase();\nconst passwordOk = (p) => typeof p === 'string' && p.length >= MIN_PASSWORD;\n\nasync function createUser(email, password) {\n  const hash = await bcrypt.hash(password, COST);\n  const r = await pool.query(\n    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',\n    [normEmail(email), hash],\n  );\n  return r.rows[0];\n}\n\nasync function checkPassword(email, password) {\n  const r = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [normEmail(email)]);\n  const row = r.rows[0];\n  // Хеш считаем ДАЖЕ когда пользователя нет: иначе по времени ответа видно,\n  // какие почты у нас зарегистрированы.\n  const hash = row ? row.password_hash : '$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';\n  const ok = await bcrypt.compare(String(password || ''), hash);\n  return row && ok ? { id: row.id, email: row.email } : null;\n}\n\nasync function issueSession(userId) {\n  const token = crypto.randomBytes(32).toString('base64url');\n  const until = new Date(Date.now() + SESSION_DAYS * 864e5);\n  await pool.query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)', [token, userId, until]);\n  return { token, until };\n}\n\nasync function userBySession(token) {\n  if (!token) return null;\n  const r = await pool.query(\n    'SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = $1 AND s.expires_at > NOW()',\n    [token],\n  );\n  return r.rows[0] || null;\n}\n\nasync function endSession(token) {\n  if (token) await pool.query('DELETE FROM sessions WHERE token = $1', [token]);\n}\n\n// httpOnly — чтобы куку не прочитал чужой скрипт на странице;\n// SameSite=Lax — чтобы её не отправил чужой сайт от имени человека;\n// Secure — чтобы она не ушла по открытому http.\nfunction sessionCookie(token, until) {\n  const parts = ['session=' + token, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Expires=' + until.toUTCString()];\n  if (process.env.NODE_ENV === 'production') parts.push('Secure');\n  return parts.join('; ');\n}\n\nfunction tokenFromRequest(req) {\n  const raw = (req.headers && req.headers.cookie) || '';\n  const pair = raw.split(';').map((s) => s.trim()).find((s) => s.startsWith('session='));\n  return pair ? pair.slice('session='.length) : null;\n}\n\nmodule.exports = {\n  passwordOk, normEmail, createUser, checkPassword, issueSession,\n  userBySession, endSession, sessionCookie, tokenFromRequest, MIN_PASSWORD,\n};\n";
const API_REGISTER = "const auth = require('../../../lib/auth');\n\nmodule.exports = async function handler(req, res) {\n  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });\n  const { email, password } = req.body || {};\n  if (!auth.normEmail(email).includes('@')) return res.status(400).json({ error: 'нужна почта' });\n  if (!auth.passwordOk(password)) return res.status(400).json({ error: 'пароль от ' + auth.MIN_PASSWORD + ' знаков' });\n  try {\n    const user = await auth.createUser(email, password);\n    const { token, until } = await auth.issueSession(user.id);\n    res.setHeader('Set-Cookie', auth.sessionCookie(token, until));\n    return res.status(201).json({ user: { id: user.id, email: user.email } });\n  } catch (e) {\n    // 23505 — нарушение UNIQUE: почта уже занята.\n    if (e && e.code === '23505') return res.status(409).json({ error: 'почта уже занята' });\n    console.error('[auth/register]', e && e.message);\n    return res.status(500).json({ error: 'не удалось создать пользователя' });\n  }\n};\n";
const API_LOGIN = "const auth = require('../../../lib/auth');\n\nmodule.exports = async function handler(req, res) {\n  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });\n  const { email, password } = req.body || {};\n  const user = await auth.checkPassword(email, password);\n  // ОДИН И ТОТ ЖЕ ответ на «нет такой почты» и «неверный пароль»:\n  // иначе по нему перебирают, кто у нас зарегистрирован.\n  if (!user) return res.status(401).json({ error: 'почта или пароль не подходят' });\n  const { token, until } = await auth.issueSession(user.id);\n  res.setHeader('Set-Cookie', auth.sessionCookie(token, until));\n  return res.json({ user });\n};\n";
const API_ME = "const auth = require('../../../lib/auth');\n\nmodule.exports = async function handler(req, res) {\n  const user = await auth.userBySession(auth.tokenFromRequest(req));\n  if (!user) return res.status(401).json({ user: null });\n  return res.json({ user });\n};\n";
const API_LOGOUT = "const auth = require('../../../lib/auth');\n\nmodule.exports = async function handler(req, res) {\n  await auth.endSession(auth.tokenFromRequest(req));\n  res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');\n  return res.json({ ok: true });\n};\n";

/** Файлы шаблона входа; пути — относительно корня проекта. */
export function файлыВхода(): ФайлШаблона[] {
  return [
    { path: "db/schema.sql", content: SCHEMA_SQL, language: "sql" },
    { path: "lib/auth.js", content: LIB_AUTH, language: "javascript" },
    { path: "pages/api/auth/register.js", content: API_REGISTER, language: "javascript" },
    { path: "pages/api/auth/login.js", content: API_LOGIN, language: "javascript" },
    { path: "pages/api/auth/me.js", content: API_ME, language: "javascript" },
    { path: "pages/api/auth/logout.js", content: API_LOGOUT, language: "javascript" },
  ];
}

/**
 * Указание модели: вход уже есть, свой не писать. Без этой строки модель
 * добросовестно напишет ВТОРОЙ вход рядом — и дырявым окажется именно он.
 */
export const УКАЗАНИЕ_ПРО_ВХОД =
  "Sign-in is ALREADY implemented in lib/auth.js and pages/api/auth/*. Do NOT write your own authentication, password hashing or session handling. Call POST /api/auth/register, POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout, and read the current user from GET /api/auth/me.";
