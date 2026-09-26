// D1 (SQLite) jadvallari. Birinchi so'rovda avtomatik yaratiladi — qo'lda migratsiya shart emas.
import { hashPassword, randomToken } from './auth.js';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    token_version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    login TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    phone TEXT,
    note TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    token_version INTEGER NOT NULL DEFAULT 0,
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    youtube_id TEXT NOT NULL,
    duration_sec INTEGER,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS progress (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    max_position REAL NOT NULL DEFAULT 0,
    last_report_at INTEGER,
    completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, lesson_id)
  )`,
  `CREATE TABLE IF NOT EXISTS login_attempts (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    first_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_lessons_section ON lessons(section_id, position)`,
  `CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id)`,
];

let ready = null; // har bir Worker nusxasida bir marta tekshiriladi
let cachedSecret = null;

export function ensureDb(env) {
  if (!ready) {
    ready = (async () => {
      await env.DB.batch(SCHEMA.map(sql => env.DB.prepare(sql)));
      await seedAdmin(env);
    })().catch(err => { ready = null; throw err; });
  }
  return ready;
}

export async function seedAdmin(env) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS c FROM admins').first();
  if (row.c > 0 || !env.ADMIN_PASSWORD) return;
  const login = env.ADMIN_LOGIN || 'admin';
  await env.DB.prepare('INSERT OR IGNORE INTO admins (login, password_hash) VALUES (?, ?)')
    .bind(login, await hashPassword(env.ADMIN_PASSWORD)).run();
}

// Sessiya kaliti: JWT_SECRET berilgan bo'lsa shu, aks holda bazada bir marta yaratilib saqlanadi
export async function getSecret(env) {
  if (env.JWT_SECRET) return env.JWT_SECRET;
  if (cachedSecret) return cachedSecret;
  let row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'jwt_secret'").first();
  if (!row) {
    await env.DB.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('jwt_secret', ?)").bind(randomToken(48)).run();
    row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'jwt_secret'").first();
  }
  cachedSecret = row.value;
  return cachedSecret;
}

// Barcha darslar kurs tartibida
export async function orderedLessons(env) {
  const { results } = await env.DB.prepare(`
    SELECT l.id, l.section_id, l.title, l.description, l.youtube_id, l.duration_sec, l.position,
           s.title AS section_title
    FROM lessons l JOIN sections s ON s.id = l.section_id
    ORDER BY s.position, s.id, l.position, l.id
  `).all();
  return results;
}
