// SMM PRO — admin paneli
(() => {
  const main = document.getElementById('main');
  const modalRoot = document.getElementById('modalRoot');

  const NAV_ICONS = {
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/></svg>',
    course: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5v5l4-2.5z"/></svg>',
    stats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  };
  const MORE = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
  const EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  const TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>';
  const UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>';
  const DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

  const TABS = [
    { id: 'users', label: "O'quvchilar" },
    { id: 'course', label: 'Kurs tarkibi' },
    { id: 'stats', label: 'Statistika' },
    { id: 'settings', label: 'Sozlamalar' },
  ];
  let tab = (location.hash || '#users').slice(1);
  if (!TABS.some(t => t.id === tab)) tab = 'users';

  // ---------------- Yordamchilar ----------------
  function fmtDate(s) {
    if (!s) return '—';
    const d = new Date(s.replace(' ', 'T') + 'Z');
    if (isNaN(d)) return s;
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'hozirgina';
    if (diff < 3600) return `${Math.floor(diff / 60)} daq oldin`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} soat oldin`;
    if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} kun oldin`;
    return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function parseMmSs(v) {
    const s = String(v || '').trim();
    if (!s) return null;
    const parts = s.split(':').map(Number);
    if (parts.some(isNaN)) return null;
    return parts.reduce((acc, n) => acc * 60 + n, 0) || null;
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch { /* */ }
      ta.remove(); return ok;
    }
  }

  function credentialMessage(name, login, password) {
    return `Assalomu alaykum, ${name}!\n\nSMM PRO kursi platformasiga kirish ma'lumotlaringiz:\n\n🌐 Sayt: ${location.origin}/login\n👤 Login: ${login}\n🔑 Parol: ${password}\n\nMa'lumotlarni hech kimga bermang: hisobga yangi qurilmadan kirilsa, oldingi qurilmadagi sessiya yopiladi.`;
  }

  function openModal({ title, body, wide = false }) {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" style="${wide ? 'max-width:640px' : ''}">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Yopish">${ICONS.close}</button></div>
      <div class="modal-body">${body}</div></div>`;
    modalRoot.appendChild(back);
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); if (back._onClose) back._onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    back.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    const first = back.querySelector('input, select, textarea');
    if (first) setTimeout(() => first.focus(), 30);
    return { el: back, close };
  }

  function confirmModal({ title, text, okLabel = 'Tasdiqlash', danger = false }) {
    return new Promise(resolve => {
      const m = openModal({ title, body: `<p class="muted" style="margin:0 0 18px">${text}</p>
        <div class="modal-foot"><button class="btn" data-close>Bekor qilish</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="okBtn">${esc(okLabel)}</button></div>` });
      m.el._onClose = () => resolve(false);
      m.el.querySelector('#okBtn').addEventListener('click', () => { m.el._onClose = null; m.close(); resolve(true); });
    });
  }

  function showCredentials(name, login, password, title = "O'quvchi qo'shildi") {
    const msg = credentialMessage(name, login, password);
    const m = openModal({
      title,
      body: `<p class="muted small" style="margin:0 0 6px">${esc(name)} uchun kirish ma'lumotlari:</p>
        <div class="cred-box">
          <div class="cred-row"><span>Sayt</span><b style="font-size:13px">${esc(location.origin)}/login</b></div>
          <div class="cred-row"><span>Login</span><b>${esc(login)}</b></div>
          <div class="cred-row"><span>Parol</span><b>${esc(password)}</b></div>
        </div>
        <p class="warn-note">Parol faqat hozir ko'rsatiladi. Uni o'quvchiga yuboring yoki nusxa oling.</p>
        <div class="modal-foot"><button class="btn" data-close>Yopish</button><button class="btn btn-primary" id="copyBtn">Xabar matnini nusxalash</button></div>`,
    });
    m.el.querySelector('#copyBtn').addEventListener('click', async () => {
      const ok = await copyText(msg);
      toast(ok ? "Nusxalandi — Telegram'da o'quvchiga yuboring" : "Nusxalab bo'lmadi", ok ? 'ok' : 'err');
    });
  }

  function handleErr(e) {
    if (e.status === 401) { showLogin(); return; }
    toast(e.message, 'err');
  }

  // ---------------- Kirish ----------------
  function showLogin() {
    document.getElementById('appView').hidden = true;
    document.getElementById('loginView').hidden = false;
    modalRoot.innerHTML = '';
  }

  function showApp(admin) {
    document.getElementById('loginView').hidden = true;
    document.getElementById('appView').hidden = false;
    document.getElementById('adminName').textContent = admin.login;
    renderNav();
    renderTab();
  }

  document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('aErr');
    err.textContent = '';
    const login = document.getElementById('aLogin').value.trim();
    const password = document.getElementById('aPass').value;
    if (!login || !password) { err.textContent = 'Login va parolni kiriting'; return; }
    try {
      const { admin } = await api('/api/admin/login', { method: 'POST', body: { login, password } });
      showApp(admin);
    } catch (ex) { err.textContent = ex.message; }
  });

  document.getElementById('adminLogout').addEventListener('click', async () => {
    await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
    showLogin();
  });

  function renderNav() {
    const html = TABS.map(t => `<button data-tab="${t.id}" class="${t.id === tab ? 'active' : ''}">${NAV_ICONS[t.id]}${t.label}</button>`).join('');
    ['nav', 'navMobile'].forEach(id => {
      const nav = document.getElementById(id);
      nav.innerHTML = html;
      nav.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        tab = b.dataset.tab;
        history.replaceState(null, '', `#${tab}`);
        renderNav();
        renderTab();
      }));
    });
  }

  function renderTab() {
    main.innerHTML = '<div class="empty">Yuklanmoqda…</div>';
    ({ users: renderUsers, course: renderCourse, stats: renderStats, settings: renderSettings })[tab]();
  }

  // =====================================================================
  //                           O'QUVCHILAR
  // =====================================================================
  let usersCache = { users: [], total_lessons: 0 };
  let userSearch = '';

  async function renderUsers() {
    try { usersCache = await api('/api/admin/users'); } catch (e) { return handleErr(e); }
    const { users } = usersCache;
    main.innerHTML = `
      <div class="page-head">
        <div><h1>O'quvchilar</h1><p>${users.length} ta o'quvchi · ${users.filter(u => u.is_active).length} tasi faol</p></div>
        <div class="toolbar">
          <input class="input search" id="userSearch" placeholder="Ism, login yoki telefon bo'yicha qidirish" value="${esc(userSearch)}">
          <button class="btn btn-primary" id="addUserBtn">+ Yangi o'quvchi</button>
        </div>
      </div>
      <div id="usersTable"></div>`;
    document.getElementById('addUserBtn').addEventListener('click', addUserModal);
    const s = document.getElementById('userSearch');
    s.addEventListener('input', () => { userSearch = s.value; drawUsersTable(); });
    drawUsersTable();
  }

  function drawUsersTable() {
    const box = document.getElementById('usersTable');
    const { users, total_lessons } = usersCache;
    const q = userSearch.trim().toLowerCase();
    const list = q ? users.filter(u => [u.full_name, u.login, u.phone, u.note].some(v => String(v || '').toLowerCase().includes(q))) : users;
    if (!users.length) {
      box.innerHTML = `<div class="card empty"><h3>Hali o'quvchi yo'q</h3><p>Kursni sotib olgan o'quvchini qo'shing — tizim unga login va parol yaratadi.</p><button class="btn btn-primary" id="emptyAdd">+ Birinchi o'quvchini qo'shish</button></div>`;
      document.getElementById('emptyAdd').addEventListener('click', addUserModal);
      return;
    }
    if (!list.length) { box.innerHTML = `<div class="card empty"><p>"${esc(userSearch)}" bo'yicha hech narsa topilmadi</p></div>`; return; }
    box.innerHTML = `<div class="table-wrap"><table class="data">
      <thead><tr><th>O'quvchi</th><th>Login</th><th>Telefon</th><th>Progress</th><th>Oxirgi faollik</th><th>Faol</th><th></th></tr></thead>
      <tbody>${list.map(u => {
        const pct = total_lessons ? Math.round((u.done / total_lessons) * 100) : 0;
        return `<tr data-id="${u.id}">
          <td><div class="cell-user"><span class="avatar">${esc(initials(u.full_name))}</span><div><div class="nm">${esc(u.full_name)}</div>${u.note ? `<div class="sub">${esc(u.note)}</div>` : ''}</div></div></td>
          <td class="mono">${esc(u.login)}</td>
          <td>${esc(u.phone || '—')}</td>
          <td><div class="prog-cell"><div class="progress"><span style="width:${pct}%"></span></div><span>${u.done}/${total_lessons}</span></div></td>
          <td class="small muted">${fmtDate(u.last_activity_at || u.last_login_at)}</td>
          <td><button class="switch" role="switch" aria-checked="${u.is_active ? 'true' : 'false'}" aria-label="Hisob faolligi" data-act="toggle"></button></td>
          <td><div class="menu-wrap"><button class="icon-btn" data-act="menu" aria-label="Amallar">${MORE}</button></div></td>
        </tr>`;
      }).join('')}</tbody></table></div>`;

    box.querySelectorAll('tr[data-id]').forEach(tr => {
      const id = Number(tr.dataset.id);
      const u = users.find(x => x.id === id);
      tr.querySelector('[data-act="toggle"]').addEventListener('click', async (e) => {
        const next = !u.is_active;
        try {
          await api(`/api/admin/users/${id}`, { method: 'PATCH', body: { is_active: next } });
          u.is_active = next ? 1 : 0;
          e.currentTarget.setAttribute('aria-checked', String(next));
          toast(next ? 'Hisob faollashtirildi' : "Hisob to'xtatildi — o'quvchi tizimdan chiqarildi", 'ok');
        } catch (ex) { handleErr(ex); }
      });
      tr.querySelector('[data-act="menu"]').addEventListener('click', (e) => { e.stopPropagation(); openUserMenu(e.currentTarget, u); });
    });
  }

  function openUserMenu(anchor, u) {
    document.querySelectorAll('.menu').forEach(m => m.remove());
    const menu = document.createElement('div');
    menu.className = 'menu';
    menu.innerHTML = `
      <button data-a="progress">Progressni ko'rish</button>
      <button data-a="edit">Ma'lumotlarni tahrirlash</button>
      <button data-a="password">Yangi parol berish</button>
      <button data-a="logout">Barcha qurilmalardan chiqarish</button>
      <hr>
      <button data-a="reset" class="danger">Progressni nolga tushirish</button>
      <button data-a="delete" class="danger">O'quvchini o'chirish</button>`;
    anchor.parentElement.appendChild(menu);
    const off = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', off); } };
    setTimeout(() => document.addEventListener('click', off), 0);
    menu.querySelectorAll('button').forEach(b => b.addEventListener('click', async () => {
      menu.remove();
      document.removeEventListener('click', off);
      const a = b.dataset.a;
      try {
        if (a === 'progress') return userProgressModal(u);
        if (a === 'edit') return editUserModal(u);
        if (a === 'password') {
          if (!(await confirmModal({ title: 'Yangi parol', text: `${esc(u.full_name)} uchun yangi parol yaratilsinmi? Eski parol ishlamay qoladi.`, okLabel: 'Yaratish' }))) return;
          const r = await api(`/api/admin/users/${u.id}/reset-password`, { method: 'POST', body: {} });
          return showCredentials(u.full_name, r.login, r.password, 'Yangi parol yaratildi');
        }
        if (a === 'logout') {
          await api(`/api/admin/users/${u.id}/logout-all`, { method: 'POST' });
          return toast("O'quvchi barcha qurilmalardan chiqarildi", 'ok');
        }
        if (a === 'reset') {
          if (!(await confirmModal({ title: 'Progressni nolga tushirish', text: `${esc(u.full_name)}ning barcha ko'rilgan darslari o'chiriladi va kurs boshidan boshlanadi.`, okLabel: 'Nolga tushirish', danger: true }))) return;
          await api(`/api/admin/users/${u.id}/reset-progress`, { method: 'POST' });
          toast('Progress tozalandi', 'ok');
          return renderUsers();
        }
        if (a === 'delete') {
          if (!(await confirmModal({ title: "O'quvchini o'chirish", text: `${esc(u.full_name)} va uning barcha progressi butunlay o'chiriladi. Bu amalni qaytarib bo'lmaydi.`, okLabel: "O'chirish", danger: true }))) return;
          await api(`/api/admin/users/${u.id}`, { method: 'DELETE' });
          toast("O'quvchi o'chirildi", 'ok');
          return renderUsers();
        }
      } catch (ex) { handleErr(ex); }
    }));
  }

  function userFormFields(u = {}, withCreds = false) {
    return `
      <div class="field"><label for="fName">Ism-familiya</label><input class="input" id="fName" value="${esc(u.full_name || '')}" placeholder="Aziz Karimov"></div>
      <div class="row-2">
        <div class="field"><label for="fPhone">Telefon</label><input class="input" id="fPhone" value="${esc(u.phone || '')}" placeholder="+998 90 123 45 67"></div>
        <div class="field"><label for="fNote">Izoh</label><input class="input" id="fNote" value="${esc(u.note || '')}" placeholder="3-oqim, to'lov 100%"></div>
      </div>
      ${withCreds ? `
      <div class="row-2">
        <div class="field"><label for="fLogin">Login</label><input class="input" id="fLogin" autocapitalize="none" spellcheck="false" placeholder="avtomatik"><span class="hint">Bo'sh qoldirsangiz, ismdan yaratiladi</span></div>
        <div class="field"><label for="fPass">Parol</label><input class="input" id="fPass" placeholder="avtomatik"><span class="hint">Bo'sh qoldirsangiz, tasodifiy parol</span></div>
      </div>` : ''}
      <div class="error-text" id="fErr" role="alert"></div>`;
  }

  function addUserModal() {
    const m = openModal({ title: "Yangi o'quvchi", body: userFormFields({}, true) + `<div class="modal-foot"><button class="btn" data-close>Bekor qilish</button><button class="btn btn-primary" id="saveBtn">Qo'shish</button></div>` });
    const q = (id) => m.el.querySelector(id);
    const save = async () => {
      const full_name = q('#fName').value.trim();
      if (!full_name) { q('#fErr').textContent = 'Ism-familiyani kiriting'; q('#fName').focus(); return; }
      q('#saveBtn').disabled = true;
      try {
        const r = await api('/api/admin/users', { method: 'POST', body: { full_name, phone: q('#fPhone').value, note: q('#fNote').value, login: q('#fLogin').value, password: q('#fPass').value } });
        m.close();
        showCredentials(full_name, r.user.login, r.password);
        renderUsers();
      } catch (ex) {
        q('#saveBtn').disabled = false;
        if (ex.status === 401) return handleErr(ex);
        q('#fErr').textContent = ex.message;
      }
    };
    q('#saveBtn').addEventListener('click', save);
    m.el.querySelectorAll('input').forEach(i => {
      i.addEventListener('input', () => { q('#fErr').textContent = ''; });
      i.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    });
  }

  function editUserModal(u) {
    const m = openModal({ title: "Ma'lumotlarni tahrirlash", body: userFormFields(u) + `<div class="modal-foot"><button class="btn" data-close>Bekor qilish</button><button class="btn btn-primary" id="saveBtn">Saqlash</button></div>` });
    const q = (id) => m.el.querySelector(id);
    q('#saveBtn').addEventListener('click', async () => {
      const full_name = q('#fName').value.trim();
      if (!full_name) { q('#fErr').textContent = 'Ism-familiyani kiriting'; return; }
      try {
        await api(`/api/admin/users/${u.id}`, { method: 'PATCH', body: { full_name, phone: q('#fPhone').value, note: q('#fNote').value } });
        m.close(); toast('Saqlandi', 'ok'); renderUsers();
      } catch (ex) { if (ex.status === 401) return handleErr(ex); q('#fErr').textContent = ex.message; }
    });
  }

  async function userProgressModal(u) {
    let data;
    try { data = await api(`/api/admin/users/${u.id}/progress`); } catch (e) { return handleErr(e); }
    const done = data.lessons.filter(l => l.completed).length;
    let lastSec = null;
    openModal({
      title: u.full_name,
      wide: true,
      body: `<p class="muted small" style="margin:-8px 0 14px">${done}/${data.lessons.length} dars ko'rilgan</p>
        ${data.lessons.length ? `<div class="prog-list">${data.lessons.map(l => {
          const head = l.section_title !== lastSec ? `<div class="f-sec">${esc(l.section_title)}</div>` : '';
          lastSec = l.section_title;
          const state = l.completed ? `Ko'rildi · ${fmtDate(l.completed_at)}` : (l.unlocked ? (l.percent ? `${l.percent}% ko'rilgan` : 'Ochiq, boshlanmagan') : 'Yopiq');
          return `${head}<div class="prog-item ${l.completed ? 'done' : ''}"><span class="dot">${l.completed ? ICONS.check : ''}</span><span class="grow">${l.index}. ${esc(l.title)}</span><span class="when">${state}</span></div>`;
        }).join('')}</div>` : '<p class="muted">Kursda hali dars yo\'q.</p>'}
        <div class="modal-foot"><button class="btn" data-close>Yopish</button></div>`,
    });
  }

  // =====================================================================
  //                           KURS TARKIBI
  // =====================================================================
  let sectionsCache = [];

  async function renderCourse() {
    try { sectionsCache = (await api('/api/admin/sections')).sections; } catch (e) { return handleErr(e); }
    const totalLessons = sectionsCache.reduce((a, s) => a + s.lessons.length, 0);
    let counter = 0;
    main.innerHTML = `
      <div class="page-head">
        <div><h1>Kurs tarkibi</h1><p>${sectionsCache.length} ta bo'lim · ${totalLessons} ta dars. O'quvchilar darslarni aynan shu tartibda, birma-bir ochadi.</p></div>
        <div class="toolbar"><button class="btn" id="addSecBtn">+ Bo'lim</button><button class="btn btn-primary" id="addLesBtn" ${sectionsCache.length ? '' : 'disabled'}>+ Dars</button></div>
      </div>
      ${!sectionsCache.length ? `<div class="card empty"><h3>Kursni bo'limdan boshlang</h3><p>Masalan: "1-modul. SMM asoslari". Keyin bo'lim ichiga video darslarni qo'shasiz.</p><button class="btn btn-primary" id="emptySec">+ Birinchi bo'limni yaratish</button></div>` : ''}
      ${sectionsCache.map((s, si) => `
        <section class="card sec-card" data-sec="${s.id}">
          <div class="sec-head">
            <span class="num">${String(si + 1).padStart(2, '0')}</span>
            <h3>${esc(s.title)}</h3>
            <span class="small muted">${s.lessons.length} dars</span>
            <div class="actions">
              <button class="icon-btn" data-a="sec-up" aria-label="Yuqoriga" ${si === 0 ? 'disabled' : ''}>${UP}</button>
              <button class="icon-btn" data-a="sec-down" aria-label="Pastga" ${si === sectionsCache.length - 1 ? 'disabled' : ''}>${DOWN}</button>
              <button class="icon-btn" data-a="sec-edit" aria-label="Nomini o'zgartirish">${EDIT}</button>
              <button class="icon-btn" data-a="sec-del" aria-label="Bo'limni o'chirish">${TRASH}</button>
            </div>
          </div>
          ${s.lessons.length ? s.lessons.map((l, li) => {
            counter += 1;
            return `<div class="les-row" data-les="${l.id}">
              <span class="idx">${counter}</span>
              <span class="thumb" style="background-image:url(https://i.ytimg.com/vi/${esc(l.youtube_id)}/mqdefault.jpg)"></span>
              <div style="min-width:0"><div class="t">${esc(l.title)}</div><div class="s"><span>${l.duration_sec ? fmtTime(l.duration_sec) : 'Davomiyligi aniqlanmagan'}</span><span class="done-count">${l.completed_count} kishi ko'rgan</span></div></div>
              <span></span>
              <div class="actions">
                <button class="icon-btn" data-a="les-up" aria-label="Yuqoriga" ${li === 0 ? 'disabled' : ''}>${UP}</button>
                <button class="icon-btn" data-a="les-down" aria-label="Pastga" ${li === s.lessons.length - 1 ? 'disabled' : ''}>${DOWN}</button>
                <button class="icon-btn" data-a="les-edit" aria-label="Tahrirlash">${EDIT}</button>
                <button class="icon-btn" data-a="les-del" aria-label="O'chirish">${TRASH}</button>
              </div>
            </div>`;
          }).join('') : `<div class="sec-empty">Bu bo'limda hali dars yo'q.</div>`}
          <div class="sec-foot"><button class="btn btn-ghost btn-sm" data-a="sec-add-les">+ Shu bo'limga dars qo'shish</button></div>
        </section>`).join('')}`;

    const addSec = () => sectionModal();
    document.getElementById('addSecBtn').addEventListener('click', addSec);
    const es = document.getElementById('emptySec'); if (es) es.addEventListener('click', addSec);
    document.getElementById('addLesBtn').addEventListener('click', () => lessonModal({ section_id: sectionsCache[sectionsCache.length - 1]?.id }));

    main.querySelectorAll('[data-sec]').forEach(card => {
      const sid = Number(card.dataset.sec);
      const s = sectionsCache.find(x => x.id === sid);
      const idx = sectionsCache.indexOf(s);
      card.querySelector('[data-a="sec-up"]').addEventListener('click', () => reorderSections(idx, -1));
      card.querySelector('[data-a="sec-down"]').addEventListener('click', () => reorderSections(idx, 1));
      card.querySelector('[data-a="sec-edit"]').addEventListener('click', () => sectionModal(s));
      card.querySelector('[data-a="sec-add-les"]').addEventListener('click', () => lessonModal({ section_id: sid }));
      card.querySelector('[data-a="sec-del"]').addEventListener('click', async () => {
        const extra = s.lessons.length ? ` Ichidagi ${s.lessons.length} ta dars va o'quvchilarning shu darslardagi progressi ham o'chadi.` : '';
        if (!(await confirmModal({ title: "Bo'limni o'chirish", text: `"${esc(s.title)}" bo'limi o'chirilsinmi?${extra}`, okLabel: "O'chirish", danger: true }))) return;
        try { await api(`/api/admin/sections/${sid}`, { method: 'DELETE' }); toast("Bo'lim o'chirildi", 'ok'); renderCourse(); } catch (e) { handleErr(e); }
      });
      card.querySelectorAll('[data-les]').forEach(row => {
        const lid = Number(row.dataset.les);
        const l = s.lessons.find(x => x.id === lid);
        const li = s.lessons.indexOf(l);
        row.querySelector('[data-a="les-up"]').addEventListener('click', () => reorderLessons(s, li, -1));
        row.querySelector('[data-a="les-down"]').addEventListener('click', () => reorderLessons(s, li, 1));
        row.querySelector('[data-a="les-edit"]').addEventListener('click', () => lessonModal(l));
        row.querySelector('[data-a="les-del"]').addEventListener('click', async () => {
          if (!(await confirmModal({ title: "Darsni o'chirish", text: `"${esc(l.title)}" darsi o'chirilsinmi? O'quvchilarning shu darsdagi progressi ham o'chadi.`, okLabel: "O'chirish", danger: true }))) return;
          try { await api(`/api/admin/lessons/${lid}`, { method: 'DELETE' }); toast("Dars o'chirildi", 'ok'); renderCourse(); } catch (e) { handleErr(e); }
        });
      });
    });
  }

  async function reorderSections(idx, dir) {
    const ids = sectionsCache.map(s => s.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    try { await api('/api/admin/sections/reorder', { method: 'POST', body: { ids } }); renderCourse(); } catch (e) { handleErr(e); }
  }

  async function reorderLessons(section, idx, dir) {
    const ids = section.lessons.map(l => l.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    try { await api('/api/admin/lessons/reorder', { method: 'POST', body: { ids } }); renderCourse(); } catch (e) { handleErr(e); }
  }

  function sectionModal(s) {
    const m = openModal({
      title: s ? "Bo'lim nomini o'zgartirish" : "Yangi bo'lim",
      body: `<div class="field"><label for="sTitle">Bo'lim nomi</label><input class="input" id="sTitle" value="${esc(s ? s.title : '')}" placeholder="1-modul. SMM asoslari"></div>
        <div class="error-text" id="sErr" role="alert"></div>
        <div class="modal-foot"><button class="btn" data-close>Bekor qilish</button><button class="btn btn-primary" id="saveBtn">${s ? 'Saqlash' : 'Yaratish'}</button></div>`,
    });
    const input = m.el.querySelector('#sTitle');
    const save = async () => {
      const title = input.value.trim();
      if (!title) { m.el.querySelector('#sErr').textContent = "Bo'lim nomini kiriting"; return; }
      try {
        if (s) await api(`/api/admin/sections/${s.id}`, { method: 'PATCH', body: { title } });
        else await api('/api/admin/sections', { method: 'POST', body: { title } });
        m.close(); toast(s ? 'Saqlandi' : "Bo'lim yaratildi", 'ok'); renderCourse();
      } catch (e) { if (e.status === 401) return handleErr(e); m.el.querySelector('#sErr').textContent = e.message; }
    };
    m.el.querySelector('#saveBtn').addEventListener('click', save);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    input.addEventListener('input', () => { m.el.querySelector('#sErr').textContent = ''; });
  }

  // YouTube havolasidan video ID sini ajratib olish (serverdagi bilan bir xil qoida)
  function ytId(input) {
    const s = String(input || '').trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    const m = s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) || s.match(/[?&]v=([A-Za-z0-9_-]{11})/) || s.match(/youtube\.com\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  let ytApiPromise = null;
  function loadYtApi() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (ytApiPromise) return ytApiPromise;
    ytApiPromise = new Promise(resolve => {
      window.onYouTubeIframeAPIReady = resolve;
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    });
    return ytApiPromise;
  }

  // Videoning davomiyligini yashirin pleyer orqali aniqlash
  function detectDuration(videoId) {
    return loadYtApi().then(() => new Promise(resolve => {
      const holder = document.createElement('div');
      holder.style.cssText = 'position:fixed;left:-9999px;top:0;width:320px;height:180px;';
      const inner = document.createElement('div');
      holder.appendChild(inner);
      document.body.appendChild(holder);
      let done = false;
      const finish = (d) => { if (done) return; done = true; try { p.destroy(); } catch { /* */ } holder.remove(); resolve(d); };
      const p = new YT.Player(inner, {
        videoId, playerVars: { controls: 0, mute: 1, playsinline: 1 },
        events: {
          onReady: () => {
            const d = p.getDuration();
            if (d > 0) return finish(d);
            p.mute(); p.playVideo();
            let tries = 0;
            const iv = setInterval(() => {
              const dd = p.getDuration();
              if (dd > 0 || ++tries > 30) { clearInterval(iv); finish(dd > 0 ? dd : null); }
            }, 300);
          },
          onError: () => finish(-1),
        },
      });
      setTimeout(() => finish(null), 15000);
    }));
  }

  function lessonModal(l = {}) {
    const isEdit = !!l.id;
    const m = openModal({
      title: isEdit ? 'Darsni tahrirlash' : 'Yangi dars',
      wide: true,
      body: `
        <div class="field"><label for="lSec">Bo'lim</label><select class="select" id="lSec">${sectionsCache.map(s => `<option value="${s.id}" ${s.id === l.section_id ? 'selected' : ''}>${esc(s.title)}</option>`).join('')}</select></div>
        <div class="field"><label for="lTitle">Dars nomi</label><input class="input" id="lTitle" value="${esc(l.title || '')}" placeholder="Kontent reja qanday tuziladi"></div>
        <div class="field"><label for="lYt">YouTube havolasi</label><input class="input" id="lYt" value="${l.youtube_id ? `https://youtu.be/${esc(l.youtube_id)}` : ''}" placeholder="https://youtu.be/..." spellcheck="false"><span class="hint">Videoni YouTube'ga "Ro'yxatda yo'q" (Unlisted) holatida yuklang va havolani shu yerga qo'ying.</span></div>
        <div class="preview-box" id="lPreview" hidden></div>
        <div class="field"><label for="lDur">Davomiyligi (daq:son)</label><input class="input" id="lDur" value="${l.duration_sec ? fmtTime(l.duration_sec) : ''}" placeholder="avtomatik aniqlanadi" style="max-width:200px"><span class="hint">Havola qo'yilganda avtomatik to'ldiriladi. Kerak bo'lsa qo'lda to'g'rilang.</span></div>
        <div class="field"><label for="lDesc">Tavsif va materiallar (ixtiyoriy)</label><textarea class="textarea" id="lDesc" placeholder="Dars haqida qisqacha, uyga vazifa, foydali havolalar…">${esc(l.description || '')}</textarea></div>
        <div class="error-text" id="lErr" role="alert"></div>
        <div class="modal-foot"><button class="btn" data-close>Bekor qilish</button><button class="btn btn-primary" id="saveBtn">${isEdit ? 'Saqlash' : "Darsni qo'shish"}</button></div>`,
    });
    const q = (id) => m.el.querySelector(id);
    const preview = q('#lPreview');
    let lastId = l.youtube_id || null;

    async function onLink() {
      const id = ytId(q('#lYt').value);
      if (!id) { preview.hidden = true; return; }
      preview.hidden = false;
      preview.innerHTML = `<span class="thumb" style="background-image:url(https://i.ytimg.com/vi/${id}/mqdefault.jpg)"></span><span class="muted">Davomiyligi aniqlanmoqda…</span>`;
      if (id === lastId && q('#lDur').value) { preview.querySelector('.muted').textContent = 'Video topildi'; return; }
      lastId = id;
      const d = await detectDuration(id);
      if (ytId(q('#lYt').value) !== id) return;
      if (d === -1) {
        preview.querySelector('.muted').textContent = "Video ochilmadi. Havolani va video sozlamasini tekshiring (joylashtirishga ruxsat bo'lishi kerak).";
      } else if (d) {
        q('#lDur').value = fmtTime(d);
        preview.querySelector('.muted').textContent = `Video topildi · ${fmtTime(d)}`;
      } else {
        preview.querySelector('.muted').textContent = "Davomiylikni aniqlab bo'lmadi — qo'lda kiriting";
      }
    }
    q('#lYt').addEventListener('change', onLink);
    q('#lYt').addEventListener('paste', () => setTimeout(onLink, 50));
    if (l.youtube_id) onLink();
    m.el.querySelectorAll('input, textarea').forEach(i => i.addEventListener('input', () => { q('#lErr').textContent = ''; }));

    q('#saveBtn').addEventListener('click', async () => {
      const title = q('#lTitle').value.trim();
      const youtube = q('#lYt').value.trim();
      if (!title) { q('#lErr').textContent = 'Dars nomini kiriting'; return; }
      if (!ytId(youtube)) { q('#lErr').textContent = "YouTube havolasi noto'g'ri"; return; }
      const durRaw = q('#lDur').value.trim();
      const duration_sec = durRaw ? parseMmSs(durRaw) : null;
      if (durRaw && !duration_sec) { q('#lErr').textContent = "Davomiylikni 12:30 ko'rinishida kiriting"; return; }
      const body = { section_id: Number(q('#lSec').value), title, youtube, duration_sec, description: q('#lDesc').value };
      q('#saveBtn').disabled = true;
      try {
        if (isEdit) await api(`/api/admin/lessons/${l.id}`, { method: 'PATCH', body });
        else await api('/api/admin/lessons', { method: 'POST', body });
        m.close();
        toast(isEdit ? 'Dars saqlandi' : "Dars qo'shildi", 'ok');
        renderCourse();
      } catch (e) {
        q('#saveBtn').disabled = false;
        if (e.status === 401) return handleErr(e);
        q('#lErr').textContent = e.message;
      }
    });
  }

  // =====================================================================
  //                             STATISTIKA
  // =====================================================================
  async function renderStats() {
    let s;
    try { s = await api('/api/admin/stats'); } catch (e) { return handleErr(e); }
    const base = s.students.active || s.students.total || 0;
    const max = Math.max(1, ...s.funnel.map(f => f.completed), base);
    let lastSec = null;
    main.innerHTML = `
      <div class="page-head"><div><h1>Statistika</h1><p>O'quvchilar kursda qanchalik oldinga borayotganini kuzating.</p></div></div>
      <div class="stats-grid">
        <div class="card stat-tile"><div class="lbl">Jami o'quvchilar</div><div class="val">${s.students.total}</div><div class="hint">${s.students.active} tasi faol</div></div>
        <div class="card stat-tile"><div class="lbl">So'nggi 7 kunda faol</div><div class="val">${s.students.active_week}</div><div class="hint">kamida bitta dars ko'rgan</div></div>
        <div class="card stat-tile"><div class="lbl">Kursni tugatganlar</div><div class="val">${s.students.finished}</div><div class="hint">barcha darslarni ko'rgan</div></div>
        <div class="card stat-tile"><div class="lbl">Kurs hajmi</div><div class="val">${s.lessons_total}</div><div class="hint">${s.sections_total} ta bo'limdagi darslar</div></div>
      </div>
      <section class="card chart-card">
        <h3>Har bir darsni ko'rganlar soni</h3>
        <p class="desc">Ustun qayerda keskin qisqarsa — o'quvchilar o'sha darsda to'xtab qolmoqda. Foiz faol o'quvchilarga nisbatan.</p>
        ${s.funnel.length ? `<div class="funnel">${s.funnel.map(f => {
          const head = f.section_title !== lastSec ? `<div class="f-sec">${esc(f.section_title)}</div>` : '';
          lastSec = f.section_title;
          const pct = base ? Math.round((f.completed / base) * 100) : 0;
          return `${head}<div class="f-row" title="${esc(f.title)}: ${f.completed} kishi ko'rgan (${pct}%)">
            <div class="f-name"><b>${f.index}</b>${esc(f.title)}</div>
            <div class="f-bar"><span style="width:${(f.completed / max) * 100}%"></span></div>
            <div class="f-val">${f.completed}<small>${pct}%</small></div>
          </div>`;
        }).join('')}</div>` : '<p class="muted">Kursga dars qo\'shilgach, statistika shu yerda ko\'rinadi.</p>'}
      </section>`;
  }

  // =====================================================================
  //                             SOZLAMALAR
  // =====================================================================
  function renderSettings() {
    main.innerHTML = `
      <div class="page-head"><div><h1>Sozlamalar</h1><p>Admin hisobi xavfsizligi.</p></div></div>
      <section class="card" style="padding:20px;max-width:460px">
        <h3 style="font-size:16px;margin-bottom:14px">Admin parolini o'zgartirish</h3>
        <div class="field"><label for="pCur">Joriy parol</label><input class="input" type="password" id="pCur" autocomplete="current-password"></div>
        <div class="field"><label for="pNew">Yangi parol</label><input class="input" type="password" id="pNew" autocomplete="new-password"><span class="hint">Kamida 8 belgi</span></div>
        <div class="field"><label for="pNew2">Yangi parolni takrorlang</label><input class="input" type="password" id="pNew2" autocomplete="new-password"></div>
        <div class="error-text" id="pErr" role="alert"></div>
        <button class="btn btn-primary" id="pSave">Parolni o'zgartirish</button>
      </section>
      <section class="card" style="padding:20px;max-width:460px;margin-top:16px">
        <h3 style="font-size:16px;margin-bottom:8px">O'quvchilar uchun havola</h3>
        <p class="muted small" style="margin:0 0 12px">O'quvchilar shu manzil orqali kiradi:</p>
        <div class="cred-box" style="margin:0 0 12px"><b class="mono" style="color:var(--lime)">${esc(location.origin)}/login</b></div>
        <button class="btn btn-sm" id="copyLink">Havolani nusxalash</button>
      </section>`;
    const q = (id) => document.getElementById(id);
    ['pCur', 'pNew', 'pNew2'].forEach(id => q(id).addEventListener('input', () => { q('pErr').textContent = ''; }));
    q('copyLink').addEventListener('click', async () => toast((await copyText(`${location.origin}/login`)) ? 'Nusxalandi' : "Nusxalab bo'lmadi"));
    q('pSave').addEventListener('click', async () => {
      const current = q('pCur').value, next = q('pNew').value, next2 = q('pNew2').value;
      if (!current || !next) { q('pErr').textContent = "Barcha maydonlarni to'ldiring"; return; }
      if (next.length < 8) { q('pErr').textContent = "Yangi parol kamida 8 belgidan iborat bo'lsin"; return; }
      if (next !== next2) { q('pErr').textContent = 'Yangi parollar bir xil emas'; return; }
      try {
        await api('/api/admin/password', { method: 'POST', body: { current, next } });
        toast("Parol o'zgartirildi", 'ok');
        ['pCur', 'pNew', 'pNew2'].forEach(id => { q(id).value = ''; });
      } catch (e) { if (e.status === 401) return handleErr(e); q('pErr').textContent = e.message; }
    });
  }

  // ---------------- Ishga tushirish ----------------
  api('/api/admin/me').then(r => showApp(r.admin)).catch(() => showLogin());
})();
