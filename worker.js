// SMM PRO — online kurs platformasi (Cloudflare Workers + D1)
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { ensureDb, getSecret, orderedLessons, seedAdmin } from './db.js';
import { hashPassword, verifyPassword, burnPasswordTime, signJwt, verifyJwt, genPassword } from './auth.js';

// Video "oldinga sakrab o'tish"ga qarshi: har hisobotda real vaqtga mos siljishgina qabul qilinadi
const MAX_SPEED = 2.1;          // 2x tezlikkacha ruxsat
const MAX_ELAPSED_COUNTED = 30; // soniya (pleyer har 15 soniyada hisobot yuboradi)
const GRACE_SEC = 5;

const app = new Hono();

// ---------- Yordamchilar ----------
const bad = (c, status, error) => c.json({ error }, status);
const cleanStr = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const ratio = (env) => Number(env.COMPLETE_RATIO || 0.9);

function cookieOpts(c) {
  return {
    httpOnly: true,
    sameSite: 'Lax',
    secure: new URL(c.req.url).protocol === 'https:',
    path: '/',
    maxAge: 30 * 24 * 3600,
  };
}

async function body(c) {
  try { return await c.req.json(); } catch { return {}; }
}

function parseYoutubeId(input) {
  const s = String(input || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtube\.com\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return m[1];
  }
  return null;
}

async function slugLogin(env, fullName) {
  let base = String(fullName || '').toLowerCase().replace(/[‘’ʻʼ`]/g, "'").replace(/'/g, '');
  base = base.replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 20) || 'student';
  let login = base;
  for (let n = 2; ; n++) {
    const taken = await env.DB.prepare('SELECT 1 FROM users WHERE login = ?').bind(login).first();
    if (!taken) return login;
    login = `${base}${n}`;
  }
}

// Login urinishlarini cheklash: 15 daqiqada 10 ta xato (bazada saqlanadi, chunki Worker nusxalari ko'p)
const WINDOW_MS = 15 * 60 * 1000;
async function tooManyAttempts(env, key) {
  const row = await env.DB.prepare('SELECT count, first_at FROM login_attempts WHERE key = ?').bind(key).first();
  if (!row) return false;
  if (Date.now() - row.first_at > WINDOW_MS) return false;
  return row.count >= 10;
}
async function noteFailure(env, key) {
  const now = Date.now();
  await env.DB.prepare(`
    INSERT INTO login_attempts (key, count, first_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN ? - first_at > ? THEN 1 ELSE count + 1 END,
      first_at = CASE WHEN ? - first_at > ? THEN ? ELSE first_at END
  `).bind(key, now, now, WINDOW_MS, now, WINDOW_MS, now).run();
}
async function clearFailures(env, key) {
  await env.DB.prepare('DELETE FROM login_attempts WHERE key = ?').bind(key).run();
}
const clientIp = (c) => c.req.header('cf-connecting-ip') || 'local';

// ---------- Umumiy middleware ----------
app.use('/api/*', async (c, next) => {
  await ensureDb(c.env);
  await next();
  c.header('Cache-Control', 'no-store');
});

async function requireUser(c, next) {
  const payload = await verifyJwt(getCookie(c, 'sid'), await getSecret(c.env));
  const user = payload && payload.kind === 'user'
    ? await c.env.DB.prepare('SELECT id, full_name, login, is_active, token_version FROM users WHERE id = ?').bind(payload.sub).first()
    : null;
  if (!user || !user.is_active || user.token_version !== payload.v) {
    deleteCookie(c, 'sid', { path: '/' });
    return bad(c, 401, 'Tizimga kiring');
  }
  c.set('user', user);
  await next();
}

async function requireAdmin(c, next) {
  const payload = await verifyJwt(getCookie(c, 'aid'), await getSecret(c.env));
  const admin = payload && payload.kind === 'admin'
    ? await c.env.DB.prepare('SELECT id, login, token_version FROM admins WHERE id = ?').bind(payload.sub).first()
    : null;
  if (!admin || admin.token_version !== payload.v) {
    deleteCookie(c, 'aid', { path: '/' });
    return bad(c, 401, 'Admin sifatida kiring');
  }
  c.set('admin', admin);
  await next();
}

// ---------- Kurs holati: qaysi dars ochiq, qaysi yopiq ----------
async function courseStateFor(env, userId) {
  const [lessonsRes, progRes] = await env.DB.batch([
    env.DB.prepare(`
      SELECT l.id, l.section_id, l.title, l.description, l.youtube_id, l.duration_sec, s.title AS section_title
      FROM lessons l JOIN sections s ON s.id = l.section_id
      ORDER BY s.position, s.id, l.position, l.id`),
    env.DB.prepare('SELECT lesson_id, max_position, completed, completed_at FROM progress WHERE user_id = ?').bind(userId),
  ]);
  const lessons = lessonsRes.results;
  const prog = new Map(progRes.results.map(p => [p.lesson_id, p]));
  let prevCompleted = true; // birinchi dars doim ochiq
  const states = lessons.map((l, idx) => {
    const p = prog.get(l.id);
    const completed = !!(p && p.completed);
    const unlocked = completed || prevCompleted;
    const percent = completed ? 100
      : (p && l.duration_sec ? Math.min(99, Math.floor((p.max_position / l.duration_sec) * 100)) : 0);
    prevCompleted = completed;
    return {
      id: l.id, section_id: l.section_id, section_title: l.section_title, title: l.title,
      duration_sec: l.duration_sec, index: idx + 1, completed, unlocked, percent,
      completed_at: p ? p.completed_at : null,
    };
  });
  return { lessons, states, prog };
}

// =====================================================================
//                              O'QUVCHI API
// =====================================================================
app.post('/api/login', async (c) => {
  const env = c.env;
  const key = `u:${clientIp(c)}`;
  if (await tooManyAttempts(env, key)) return bad(c, 429, "Juda ko'p urinish. 15 daqiqadan so'ng qayta urinib ko'ring.");
  const b = await body(c);
  const login = cleanStr(b.login, 60);
  const password = String(b.password || '');
  const user = await env.DB.prepare('SELECT * FROM users WHERE login = ?').bind(login).first();
  const ok = user ? await verifyPassword(password, user.password_hash) : (await burnPasswordTime(password), false);
  if (!ok) {
    await noteFailure(env, key);
    return bad(c, 401, "Login yoki parol noto'g'ri");
  }
  if (!user.is_active) return bad(c, 403, 'Hisobingiz faol emas. Administratorga murojaat qiling.');
  // Yangi kirish — boshqa qurilmalardagi sessiyalar yopiladi (bitta hisob = bitta qurilma)
  const fresh = await env.DB.prepare(`UPDATE users SET token_version = token_version + 1, last_login_at = datetime('now')
    WHERE id = ? RETURNING id, full_name, login, token_version`).bind(user.id).first();
  await clearFailures(env, key);
  setCookie(c, 'sid', await signJwt({ sub: fresh.id, kind: 'user', v: fresh.token_version }, await getSecret(env)), cookieOpts(c));
  return c.json({ ok: true, user: { id: fresh.id, full_name: fresh.full_name, login: fresh.login } });
});

app.post('/api/logout', (c) => {
  deleteCookie(c, 'sid', { path: '/' });
  return c.json({ ok: true });
});

app.get('/api/me', requireUser, (c) => {
  const u = c.get('user');
  return c.json({ user: { id: u.id, full_name: u.full_name, login: u.login } });
});

app.get('/api/course', requireUser, async (c) => {
  const { states } = await courseStateFor(c.env, c.get('user').id);
  const { results: secs } = await c.env.DB.prepare('SELECT id, title, position FROM sections ORDER BY position, id').all();
  const sections = secs
    .map(s => ({ ...s, lessons: states.filter(l => l.section_id === s.id).map(({ completed_at, ...l }) => l) }))
    .filter(s => s.lessons.length > 0);
  const total = states.length;
  const done = states.filter(s => s.completed).length;
  const next = states.find(s => s.unlocked && !s.completed) || null;
  return c.json({
    sections,
    summary: { total, done, percent: total ? Math.round((done / total) * 100) : 0, next_lesson_id: next ? next.id : null },
  });
});

app.get('/api/lessons/:id', requireUser, async (c) => {
  const id = Number(c.req.param('id'));
  const { lessons, states, prog } = await courseStateFor(c.env, c.get('user').id);
  const idx = lessons.findIndex(l => l.id === id);
  if (idx === -1) return bad(c, 404, 'Dars topilmadi');
  const st = states[idx];
  if (!st.unlocked) return bad(c, 403, "Bu dars hali yopiq. Avval oldingi darsni oxirigacha ko'ring.");
  const l = lessons[idx];
  const p = prog.get(id);
  const prev = idx > 0 ? states[idx - 1] : null;
  const next = idx < states.length - 1 ? states[idx + 1] : null;
  return c.json({
    lesson: {
      id: l.id, title: l.title, description: l.description || '', youtube_id: l.youtube_id,
      duration_sec: l.duration_sec, section_title: l.section_title, index: idx + 1, total: lessons.length,
    },
    progress: { max_position: p ? p.max_position : 0, completed: !!(p && p.completed) },
    complete_ratio: ratio(c.env),
    prev: prev ? { id: prev.id, title: prev.title } : null,
    next: next ? { id: next.id, title: next.title, unlocked: next.unlocked || st.completed } : null,
  });
});

// Video ko'rish jarayoni haqida hisobot (pleyerdan har 15 soniyada keladi).
// Bepul limitni tejash uchun: odatda faqat 2–3 ta qatorni o'qiydi va bitta qatorni yozadi.
app.post('/api/lessons/:id/progress', requireUser, async (c) => {
  const env = c.env;
  const userId = c.get('user').id;
  const id = Number(c.req.param('id'));
  const b = await body(c);

  const [lessonRes, rowRes] = await env.DB.batch([
    env.DB.prepare('SELECT id, duration_sec FROM lessons WHERE id = ?').bind(id),
    env.DB.prepare('SELECT max_position, last_report_at, completed FROM progress WHERE user_id = ? AND lesson_id = ?').bind(userId, id),
  ]);
  let lesson = lessonRes.results[0];
  if (!lesson) return bad(c, 404, 'Dars topilmadi');
  let row = rowRes.results[0];
  const now = Date.now();

  if (!row) {
    // Birinchi hisobot — dars haqiqatan ochiqligini tekshiramiz
    const { lessons, states } = await courseStateFor(env, userId);
    const idx = lessons.findIndex(l => l.id === id);
    if (idx === -1 || !states[idx].unlocked) return bad(c, 403, 'Dars yopiq');
    await env.DB.prepare('INSERT OR IGNORE INTO progress (user_id, lesson_id, max_position, last_report_at) VALUES (?, ?, 0, ?)')
      .bind(userId, id, now).run();
    row = { max_position: 0, last_report_at: now, completed: 0 };
  }

  const reportedDuration = Number(b.duration);
  if (!lesson.duration_sec && reportedDuration > 5 && reportedDuration < 6 * 3600) {
    lesson = { ...lesson, duration_sec: Math.round(reportedDuration) };
    await env.DB.prepare('UPDATE lessons SET duration_sec = ? WHERE id = ? AND duration_sec IS NULL').bind(lesson.duration_sec, id).run();
  }

  const position = Math.max(0, Number(b.position) || 0);
  const elapsed = row.last_report_at ? Math.min(MAX_ELAPSED_COUNTED, Math.max(0, (now - row.last_report_at) / 1000)) : 0;
  const allowedMax = row.max_position + elapsed * MAX_SPEED + GRACE_SEC;
  let newMax = Math.max(row.max_position, Math.min(position, allowedMax));
  if (lesson.duration_sec) newMax = Math.min(newMax, lesson.duration_sec);

  const wasCompleted = !!row.completed;
  const completed = wasCompleted || !!(lesson.duration_sec && newMax >= lesson.duration_sec * ratio(env));

  await env.DB.prepare(`
    UPDATE progress SET max_position = ?, last_report_at = ?, completed = ?,
      completed_at = CASE WHEN ? = 1 AND completed_at IS NULL THEN datetime('now') ELSE completed_at END,
      updated_at = datetime('now')
    WHERE user_id = ? AND lesson_id = ?
  `).bind(newMax, now, completed ? 1 : 0, completed ? 1 : 0, userId, id).run();

  let nextLessonId = null;
  if (completed && !wasCompleted) {
    const lessons = await orderedLessons(env);
    const idx = lessons.findIndex(l => l.id === id);
    nextLessonId = idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1].id : null;
  }
  return c.json({ max_position: newMax, completed, duration_sec: lesson.duration_sec, next_lesson_id: nextLessonId });
});

// =====================================================================
//                               ADMIN API
// =====================================================================
app.post('/api/admin/login', async (c) => {
  const env = c.env;
  const key = `a:${clientIp(c)}`;
  if (await tooManyAttempts(env, key)) return bad(c, 429, "Juda ko'p urinish. 15 daqiqadan so'ng qayta urinib ko'ring.");
  let hasAdmin = await env.DB.prepare('SELECT COUNT(*) AS c FROM admins').first();
  if (!hasAdmin.c && env.ADMIN_PASSWORD) {
    await seedAdmin(env);
    hasAdmin = await env.DB.prepare('SELECT COUNT(*) AS c FROM admins').first();
  }
  if (!hasAdmin.c) {
    return bad(c, 503, "Admin hisobi hali yaratilmagan: Cloudflare'da ADMIN_PASSWORD maxfiy o'zgaruvchisini qo'shing va sahifani yangilang.");
  }
  const b = await body(c);
  const admin = await env.DB.prepare('SELECT * FROM admins WHERE login = ?').bind(cleanStr(b.login, 60)).first();
  const ok = admin ? await verifyPassword(String(b.password || ''), admin.password_hash) : (await burnPasswordTime(String(b.password || '')), false);
  if (!ok) {
    await noteFailure(env, key);
    return bad(c, 401, "Login yoki parol noto'g'ri");
  }
  await clearFailures(env, key);
  setCookie(c, 'aid', await signJwt({ sub: admin.id, kind: 'admin', v: admin.token_version }, await getSecret(env)), cookieOpts(c));
  return c.json({ ok: true, admin: { login: admin.login } });
});

app.post('/api/admin/logout', (c) => {
  deleteCookie(c, 'aid', { path: '/' });
  return c.json({ ok: true });
});

app.use('/api/admin/*', async (c, next) => {
  if (c.req.path === '/api/admin/login' || c.req.path === '/api/admin/logout') return next();
  return requireAdmin(c, next);
});

app.get('/api/admin/me', (c) => c.json({ admin: { login: c.get('admin').login } }));

app.post('/api/admin/password', async (c) => {
  const env = c.env;
  const b = await body(c);
  const admin = await env.DB.prepare('SELECT * FROM admins WHERE id = ?').bind(c.get('admin').id).first();
  if (!(await verifyPassword(String(b.current || ''), admin.password_hash))) return bad(c, 400, "Joriy parol noto'g'ri");
  const next = String(b.next || '');
  if (next.length < 8) return bad(c, 400, "Yangi parol kamida 8 belgidan iborat bo'lsin");
  const fresh = await env.DB.prepare('UPDATE admins SET password_hash = ?, token_version = token_version + 1 WHERE id = ? RETURNING id, token_version')
    .bind(await hashPassword(next), admin.id).first();
  setCookie(c, 'aid', await signJwt({ sub: fresh.id, kind: 'admin', v: fresh.token_version }, await getSecret(env)), cookieOpts(c));
  return c.json({ ok: true });
});

// ---------- O'quvchilar ----------
app.get('/api/admin/users', async (c) => {
  const env = c.env;
  const [totalRes, usersRes] = await env.DB.batch([
    env.DB.prepare('SELECT COUNT(*) AS c FROM lessons'),
    env.DB.prepare(`
      SELECT u.id, u.full_name, u.login, u.phone, u.note, u.is_active, u.last_login_at, u.created_at,
        (SELECT COUNT(*) FROM progress p WHERE p.user_id = u.id AND p.completed = 1) AS done,
        (SELECT MAX(p.updated_at) FROM progress p WHERE p.user_id = u.id) AS last_activity_at
      FROM users u ORDER BY u.created_at DESC, u.id DESC`),
  ]);
  return c.json({ users: usersRes.results, total_lessons: totalRes.results[0].c });
});

app.post('/api/admin/users', async (c) => {
  const env = c.env;
  const b = await body(c);
  const full_name = cleanStr(b.full_name, 120);
  if (!full_name) return bad(c, 400, 'Ism-familiya kiritilmagan');
  let login = cleanStr(b.login, 40).toLowerCase();
  if (login && !/^[a-z0-9._-]{3,40}$/.test(login)) return bad(c, 400, "Login faqat lotin harflari, raqam, nuqta va chiziqchadan iborat bo'lsin (kamida 3 belgi)");
  if (login && await env.DB.prepare('SELECT 1 FROM users WHERE login = ?').bind(login).first()) return bad(c, 409, 'Bu login band');
  if (!login) login = await slugLogin(env, full_name);
  let password = String(b.password || '').trim();
  if (password && password.length < 6) return bad(c, 400, "Parol kamida 6 belgidan iborat bo'lsin");
  if (!password) password = genPassword();
  const row = await env.DB.prepare('INSERT INTO users (full_name, login, password_hash, phone, note) VALUES (?, ?, ?, ?, ?) RETURNING id')
    .bind(full_name, login, await hashPassword(password), cleanStr(b.phone, 40) || null, cleanStr(b.note, 300) || null).first();
  return c.json({ ok: true, user: { id: row.id, full_name, login }, password });
});

app.patch('/api/admin/users/:id', async (c) => {
  const env = c.env;
  const id = Number(c.req.param('id'));
  const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!u) return bad(c, 404, "O'quvchi topilmadi");
  const b = await body(c);
  const full_name = b.full_name !== undefined ? cleanStr(b.full_name, 120) : u.full_name;
  if (!full_name) return bad(c, 400, 'Ism-familiya kiritilmagan');
  const phone = b.phone !== undefined ? (cleanStr(b.phone, 40) || null) : u.phone;
  const note = b.note !== undefined ? (cleanStr(b.note, 300) || null) : u.note;
  const is_active = b.is_active !== undefined ? (b.is_active ? 1 : 0) : u.is_active;
  await env.DB.prepare(`UPDATE users SET full_name = ?, phone = ?, note = ?, is_active = ?,
      token_version = token_version + CASE WHEN ? = 0 THEN 1 ELSE 0 END WHERE id = ?`)
    .bind(full_name, phone, note, is_active, is_active, id).run();
  return c.json({ ok: true });
});

app.post('/api/admin/users/:id/reset-password', async (c) => {
  const env = c.env;
  const id = Number(c.req.param('id'));
  const u = await env.DB.prepare('SELECT id, login FROM users WHERE id = ?').bind(id).first();
  if (!u) return bad(c, 404, "O'quvchi topilmadi");
  const b = await body(c);
  let password = String(b.password || '').trim();
  if (password && password.length < 6) return bad(c, 400, "Parol kamida 6 belgidan iborat bo'lsin");
  if (!password) password = genPassword();
  await env.DB.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?')
    .bind(await hashPassword(password), id).run();
  return c.json({ ok: true, login: u.login, password });
});

app.post('/api/admin/users/:id/logout-all', async (c) => {
  await c.env.DB.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').bind(Number(c.req.param('id'))).run();
  return c.json({ ok: true });
});

app.post('/api/admin/users/:id/reset-progress', async (c) => {
  await c.env.DB.prepare('DELETE FROM progress WHERE user_id = ?').bind(Number(c.req.param('id'))).run();
  return c.json({ ok: true });
});

app.delete('/api/admin/users/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM progress WHERE user_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id),
  ]);
  return c.json({ ok: true });
});

app.get('/api/admin/users/:id/progress', async (c) => {
  const id = Number(c.req.param('id'));
  const u = await c.env.DB.prepare('SELECT id, full_name, login FROM users WHERE id = ?').bind(id).first();
  if (!u) return bad(c, 404, "O'quvchi topilmadi");
  const { states } = await courseStateFor(c.env, id);
  return c.json({ user: u, lessons: states });
});

// ---------- Bo'limlar ----------
app.get('/api/admin/sections', async (c) => {
  const [secRes, lesRes] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT * FROM sections ORDER BY position, id'),
    c.env.DB.prepare(`SELECT l.*, (SELECT COUNT(*) FROM progress p WHERE p.lesson_id = l.id AND p.completed = 1) AS completed_count
      FROM lessons l ORDER BY l.position, l.id`),
  ]);
  const lessons = lesRes.results;
  return c.json({ sections: secRes.results.map(s => ({ ...s, lessons: lessons.filter(l => l.section_id === s.id) })) });
});

app.post('/api/admin/sections', async (c) => {
  const title = cleanStr((await body(c)).title, 150);
  if (!title) return bad(c, 400, "Bo'lim nomi kiritilmagan");
  const row = await c.env.DB.prepare('INSERT INTO sections (title, position) VALUES (?, (SELECT COALESCE(MAX(position), 0) + 1 FROM sections)) RETURNING id')
    .bind(title).first();
  return c.json({ ok: true, id: row.id });
});

app.patch('/api/admin/sections/:id', async (c) => {
  const title = cleanStr((await body(c)).title, 150);
  if (!title) return bad(c, 400, "Bo'lim nomi kiritilmagan");
  await c.env.DB.prepare('UPDATE sections SET title = ? WHERE id = ?').bind(title, Number(c.req.param('id'))).run();
  return c.json({ ok: true });
});

app.delete('/api/admin/sections/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM progress WHERE lesson_id IN (SELECT id FROM lessons WHERE section_id = ?)').bind(id),
    c.env.DB.prepare('DELETE FROM lessons WHERE section_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM sections WHERE id = ?').bind(id),
  ]);
  return c.json({ ok: true });
});

app.post('/api/admin/sections/reorder', async (c) => {
  const b = await body(c);
  const ids = Array.isArray(b.ids) ? b.ids.map(Number) : [];
  if (ids.length) await c.env.DB.batch(ids.map((id, i) => c.env.DB.prepare('UPDATE sections SET position = ? WHERE id = ?').bind(i + 1, id)));
  return c.json({ ok: true });
});

// ---------- Darslar ----------
app.post('/api/admin/lessons', async (c) => {
  const env = c.env;
  const b = await body(c);
  const section_id = Number(b.section_id);
  if (!(await env.DB.prepare('SELECT 1 FROM sections WHERE id = ?').bind(section_id).first())) return bad(c, 400, "Bo'lim tanlanmagan");
  const title = cleanStr(b.title, 200);
  if (!title) return bad(c, 400, 'Dars nomi kiritilmagan');
  const youtube_id = parseYoutubeId(b.youtube);
  if (!youtube_id) return bad(c, 400, "YouTube havolasi noto'g'ri");
  const duration = Number(b.duration_sec) > 0 ? Math.round(Number(b.duration_sec)) : null;
  const row = await env.DB.prepare(`INSERT INTO lessons (section_id, title, description, youtube_id, duration_sec, position)
      VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM lessons WHERE section_id = ?)) RETURNING id`)
    .bind(section_id, title, cleanStr(b.description, 5000) || null, youtube_id, duration, section_id).first();
  return c.json({ ok: true, id: row.id });
});

app.patch('/api/admin/lessons/:id', async (c) => {
  const env = c.env;
  const id = Number(c.req.param('id'));
  const l = await env.DB.prepare('SELECT * FROM lessons WHERE id = ?').bind(id).first();
  if (!l) return bad(c, 404, 'Dars topilmadi');
  const b = await body(c);
  const title = b.title !== undefined ? cleanStr(b.title, 200) : l.title;
  if (!title) return bad(c, 400, 'Dars nomi kiritilmagan');
  let youtube_id = l.youtube_id;
  if (b.youtube !== undefined) {
    youtube_id = parseYoutubeId(b.youtube);
    if (!youtube_id) return bad(c, 400, "YouTube havolasi noto'g'ri");
  }
  let section_id = l.section_id;
  let position = l.position;
  if (b.section_id !== undefined && Number(b.section_id) !== l.section_id) {
    section_id = Number(b.section_id);
    if (!(await env.DB.prepare('SELECT 1 FROM sections WHERE id = ?').bind(section_id).first())) return bad(c, 400, "Bo'lim topilmadi");
    position = (await env.DB.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM lessons WHERE section_id = ?').bind(section_id).first()).p;
  }
  const description = b.description !== undefined ? (cleanStr(b.description, 5000) || null) : l.description;
  let duration = l.duration_sec;
  if (b.duration_sec !== undefined) duration = Number(b.duration_sec) > 0 ? Math.round(Number(b.duration_sec)) : null;
  if (youtube_id !== l.youtube_id && b.duration_sec === undefined) duration = null;
  await env.DB.prepare('UPDATE lessons SET section_id = ?, title = ?, description = ?, youtube_id = ?, duration_sec = ?, position = ? WHERE id = ?')
    .bind(section_id, title, description, youtube_id, duration, position, id).run();
  return c.json({ ok: true });
});

app.delete('/api/admin/lessons/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM progress WHERE lesson_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM lessons WHERE id = ?').bind(id),
  ]);
  return c.json({ ok: true });
});

app.post('/api/admin/lessons/reorder', async (c) => {
  const b = await body(c);
  const ids = Array.isArray(b.ids) ? b.ids.map(Number) : [];
  if (ids.length) await c.env.DB.batch(ids.map((id, i) => c.env.DB.prepare('UPDATE lessons SET position = ? WHERE id = ?').bind(i + 1, id)));
  return c.json({ ok: true });
});

// ---------- Statistika ----------
app.get('/api/admin/stats', async (c) => {
  const env = c.env;
  const [studentsRes, perLessonRes, activeRes, sectionsRes] = await env.DB.batch([
    env.DB.prepare('SELECT COUNT(*) AS total, COALESCE(SUM(is_active), 0) AS active FROM users'),
    env.DB.prepare('SELECT lesson_id, COUNT(*) AS c FROM progress WHERE completed = 1 GROUP BY lesson_id'),
    env.DB.prepare("SELECT COUNT(DISTINCT user_id) AS c FROM progress WHERE updated_at >= datetime('now', '-7 days')"),
    env.DB.prepare('SELECT COUNT(*) AS c FROM sections'),
  ]);
  const lessons = await orderedLessons(env);
  const map = new Map(perLessonRes.results.map(r => [r.lesson_id, r.c]));
  let finished = 0;
  if (lessons.length) {
    const r = await env.DB.prepare(`SELECT COUNT(*) AS c FROM (
        SELECT p.user_id FROM progress p JOIN lessons l ON l.id = p.lesson_id
        WHERE p.completed = 1 GROUP BY p.user_id HAVING COUNT(*) >= ?)`).bind(lessons.length).first();
    finished = r.c;
  }
  const s = studentsRes.results[0];
  return c.json({
    students: { total: s.total || 0, active: s.active || 0, finished, active_week: activeRes.results[0].c },
    lessons_total: lessons.length,
    sections_total: sectionsRes.results[0].c,
    funnel: lessons.map((l, i) => ({ index: i + 1, id: l.id, title: l.title, section_title: l.section_title, completed: map.get(l.id) || 0 })),
  });
});

app.all('/api/*', (c) => bad(c, 404, 'Topilmadi'));

// ---------- Sahifalar ----------
// /lesson/123 — statik lesson.html sahifasini qaytaradi (dars raqamini sahifa o'zi o'qiydi)
app.get('/lesson/:id', (c) => c.env.ASSETS.fetch(new Request(new URL('/lesson', c.req.url), c.req.raw)));
app.get('/healthz', (c) => c.json({ ok: true }));
app.all('*', (c) => c.redirect('/', 302));

app.onError((err, c) => {
  console.error(err);
  return bad(c, 500, 'Serverda xatolik yuz berdi');
});

export default app;
