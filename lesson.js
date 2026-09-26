// Dars sahifasi: YouTube pleyer, oldinga o'tkazib yuborishni cheklash, progressni serverga yuborish
(() => {
  const app = document.getElementById('app');
  const lessonId = Number(location.pathname.split('/').filter(Boolean).pop() || new URLSearchParams(location.search).get('id'));

  const REPORT_EVERY_MS = 15000; // bepul limitni tejash uchun har 15 soniyada
  const SEEK_TOLERANCE = 2.5; // soniya

  let lesson, player, ready = false;
  let duration = 0;
  let localMax = 0;          // o'quvchi shu nuqtagacha ketma-ket ko'rgan
  let completed = false;
  let completeRatio = 0.9;
  let nextInfo = null;
  let lastReport = 0;
  let reportChain = Promise.resolve();
  let pendingReports = 0;
  let startReported = false;
  let hasPlayed = false;
  let playWhenReady = false;
  let els = {};

  if (!lessonId) { location.replace('/'); return; }

  async function init() {
    try {
      const { user } = await api('/api/me');
      document.getElementById('userName').textContent = user.full_name;
      document.getElementById('avatar').textContent = initials(user.full_name);
    } catch (e) {
      if (e.status === 401) return location.replace('/login');
    }
    let data;
    try {
      data = await api(`/api/lessons/${lessonId}`);
    } catch (e) {
      if (e.status === 401) return location.replace('/login');
      app.innerHTML = `
        <a class="crumb" href="/">${ICONS.back} Barcha darslar</a>
        <div class="empty card">
          <h3>${e.status === 403 ? 'Bu dars hali yopiq' : 'Darsni ochib bo\'lmadi'}</h3>
          <p>${esc(e.message)}</p>
          <a class="btn btn-primary" href="/">Darslar ro'yxatiga qaytish</a>
        </div>`;
      return;
    }
    lesson = data.lesson;
    completed = data.progress.completed;
    localMax = data.progress.max_position || 0;
    duration = lesson.duration_sec || 0;
    completeRatio = data.complete_ratio || 0.9;
    nextInfo = data.next;
    document.title = `${lesson.title} — SMM PRO`;
    render(data);
    loadOutline();
    loadYouTube();
  }

  function render(data) {
    const { prev, next } = data;
    app.innerHTML = `
      <a class="crumb" href="/">${ICONS.back} Barcha darslar</a>
      <div class="lesson-layout">
        <div>
          <div class="player-shell" id="shell">
            <div class="player-ratio"><div id="yt"></div></div>
            <div class="player-guard" id="guard" aria-hidden="true"></div>
            <div class="end-screen" id="endScreen" hidden></div>
            <div class="controls">
              <button class="icon-btn" id="playBtn" aria-label="Ijro etish">${ICONS.play}</button>
              <span class="time" id="time">0:00 / ${fmtTime(duration)}</span>
              <div class="seek" id="seek" role="slider" tabindex="0" aria-label="Video vaqti" aria-valuemin="0" aria-valuemax="${Math.round(duration)}" aria-valuenow="0">
                <div class="seek-track">
                  <div class="seek-allowed" id="seekAllowed"></div>
                  <div class="seek-played" id="seekPlayed"></div>
                </div>
                <div class="seek-knob" id="seekKnob" style="left:0%"></div>
              </div>
              <select class="speed-select" id="speed" aria-label="Tezlik">
                <option value="1">1x</option><option value="1.25">1.25x</option><option value="1.5">1.5x</option><option value="2">2x</option>
              </select>
              <button class="icon-btn" id="muteBtn" aria-label="Ovozni o'chirish">${ICONS.volume}</button>
              <button class="icon-btn" id="fsBtn" aria-label="To'liq ekran">${ICONS.expand}</button>
            </div>
          </div>

          <div class="status-bar" id="statusBar"></div>

          <div class="lesson-kicker">${esc(lesson.section_title)} · ${lesson.index}/${lesson.total}-dars</div>
          <h1 class="lesson-title">${esc(lesson.title)}</h1>
          ${lesson.description ? `<div class="lesson-desc">${linkify(lesson.description)}</div>` : ''}

          <div class="lesson-nav">
            ${prev ? `<a class="btn" href="/lesson/${prev.id}">${ICONS.back} Oldingi dars</a>` : '<span></span>'}
            ${next ? `<a class="btn btn-primary" id="nextBtn" href="/lesson/${next.id}">Keyingi dars ${ICONS.next}</a>` : ''}
          </div>
        </div>
        <aside class="card side-card" id="outline"><h3>Kurs tarkibi</h3><div class="small muted">Yuklanmoqda…</div></aside>
      </div>`;

    els = {
      shell: document.getElementById('shell'),
      guard: document.getElementById('guard'),
      end: document.getElementById('endScreen'),
      play: document.getElementById('playBtn'),
      time: document.getElementById('time'),
      seek: document.getElementById('seek'),
      allowed: document.getElementById('seekAllowed'),
      played: document.getElementById('seekPlayed'),
      knob: document.getElementById('seekKnob'),
      speed: document.getElementById('speed'),
      mute: document.getElementById('muteBtn'),
      fs: document.getElementById('fsBtn'),
      status: document.getElementById('statusBar'),
      next: document.getElementById('nextBtn'),
    };
    updateStatus();
    updateNextButton();
    bindControls();
  }

  function updateStatus() {
    if (!els.status) return;
    if (completed) {
      els.status.className = 'status-bar done';
      els.status.innerHTML = `<span>${ICONS.check.replace('<svg', '<svg width="16" height="16" style="vertical-align:-3px;margin-right:6px"')}Dars ko'rildi${nextInfo ? ' — keyingi dars ochiq' : ''}</span>`;
      return;
    }
    const pct = duration ? Math.min(99, Math.floor((localMax / duration) * 100)) : 0;
    const need = Math.round(completeRatio * 100);
    els.status.className = 'status-bar';
    els.status.innerHTML = `
      <span class="small muted">Keyingi dars ochilishi uchun videoni oxirigacha ko'ring</span>
      <div class="progress" title="Ko'rilgan qism: ${pct}%"><span style="width:${Math.min(100, pct / need * 100)}%"></span></div>`;
  }

  function updateNextButton() {
    if (!els.next) return;
    const open = completed || (nextInfo && nextInfo.unlocked);
    if (open) {
      els.next.classList.remove('locked-link');
      els.next.removeAttribute('aria-disabled');
      els.next.onclick = null;
      els.next.innerHTML = `Keyingi dars ${ICONS.next}`;
    } else {
      els.next.setAttribute('aria-disabled', 'true');
      els.next.innerHTML = `${ICONS.lock.replace('<svg', '<svg width="16" height="16"')} Keyingi dars`;
      els.next.classList.remove('btn-primary');
      els.next.onclick = (e) => { e.preventDefault(); toast("Avval shu darsni oxirigacha ko'ring"); };
    }
    if (open && !els.next.classList.contains('btn-primary')) els.next.classList.add('btn-primary');
  }

  async function loadOutline() {
    try {
      const { sections } = await api('/api/course');
      const box = document.getElementById('outline');
      box.innerHTML = '<h3>Kurs tarkibi</h3>' + sections.map(s => `
        <div class="side-sec">${esc(s.title)}</div>
        ${s.lessons.map(l => {
          const cls = [l.completed ? 'done' : '', l.id === lessonId ? 'active' : '', !l.unlocked ? 'locked' : ''].join(' ');
          const dot = `<span class="dot">${l.completed ? ICONS.check : (!l.unlocked ? '' : '')}</span>`;
          return l.unlocked
            ? `<a class="side-item ${cls}" href="/lesson/${l.id}">${dot}<span>${esc(l.title)}</span></a>`
            : `<div class="side-item ${cls}" title="Yopiq">${dot}<span>${esc(l.title)}</span></div>`;
        }).join('')}`).join('');
    } catch { /* yon panel ixtiyoriy */ }
  }

  // ---------------- YouTube pleyer ----------------
  function loadYouTube() {
    window.onYouTubeIframeAPIReady = createPlayer;
    if (window.YT && window.YT.Player) return createPlayer();
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  }

  function createPlayer() {
    const resumeAt = !completed && duration && localMax > 5 && localMax < duration - 5 ? Math.floor(localMax) : 0;
    player = new YT.Player('yt', {
      videoId: lesson.youtube_id,
      host: 'https://www.youtube-nocookie.com',
      playerVars: {
        controls: 0, disablekb: 1, fs: 0, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3,
        start: resumeAt, origin: location.origin,
      },
      events: {
        onReady: () => {
          ready = true;
          const d = player.getDuration();
          if (d > 0) duration = d;
          tick();
          if (playWhenReady) togglePlay();
        },
        onStateChange: onState,
        onError: () => {
          els.end.hidden = false;
          els.end.innerHTML = `<div><h3>Video yuklanmadi</h3><p>Sahifani yangilab ko'ring. Muammo takrorlansa, administratorga xabar bering.</p><div class="end-actions"><button class="btn" onclick="location.reload()">Yangilash</button></div></div>`;
        },
      },
    });
    setInterval(tick, 250);
    setInterval(() => { if (isPlaying()) report(); }, REPORT_EVERY_MS);
  }

  const isPlaying = () => ready && player.getPlayerState && player.getPlayerState() === YT.PlayerState.PLAYING;

  function onState(e) {
    const S = YT.PlayerState;
    if (e.data === S.PLAYING) {
      hasPlayed = true;
      els.guard.classList.remove('inactive');
      els.end.hidden = true;
      els.play.innerHTML = ICONS.pause;
      els.play.setAttribute('aria-label', "To'xtatish");
      const d = player.getDuration();
      if (d > 0) duration = d;
      lastReport = Date.now();
      // Birinchi ijroda darhol hisobot: server vaqt hisobini shu paytdan boshlaydi (qisqa videolar uchun muhim)
      if (!startReported) { startReported = true; report(); }
    } else {
      els.play.innerHTML = ICONS.play;
      els.play.setAttribute('aria-label', 'Ijro etish');
    }
    if (e.data === S.PAUSED) report();
    if (e.data === S.ENDED) {
      localMax = Math.max(localMax, duration);
      report(true).then(showEnd);
    }
  }

  function tick() {
    if (!ready || !player.getCurrentTime) return;
    const t = player.getCurrentTime() || 0;
    const d = duration || player.getDuration() || 0;
    if (isPlaying()) {
      if (t > localMax + SEEK_TOLERANCE && !completed) {
        player.seekTo(localMax, true);
      } else {
        localMax = Math.max(localMax, t);
      }
    }
    const shownMax = completed ? d : localMax;
    els.time.textContent = `${fmtTime(t)} / ${fmtTime(d)}`;
    if (d) {
      els.played.style.width = `${Math.min(100, (t / d) * 100)}%`;
      els.allowed.style.width = `${Math.min(100, (shownMax / d) * 100)}%`;
      els.knob.style.left = `${Math.min(100, (t / d) * 100)}%`;
      els.seek.setAttribute('aria-valuenow', Math.round(t));
      els.seek.setAttribute('aria-valuemax', Math.round(d));
    }
  }

  // Hisobotlar navbat bilan yuboriladi: oraliq hisobot kutib turgan bo'lsa, yangisi o'tkazib yuboriladi,
  // lekin video oxiridagi yakuniy hisobot hech qachon yo'qolmaydi.
  function report(final = false) {
    if (!ready) return reportChain;
    if (pendingReports > 0 && !final) return reportChain;
    pendingReports += 1;
    reportChain = reportChain.then(() => sendReport(final)).finally(() => { pendingReports -= 1; });
    return reportChain;
  }

  async function sendReport(final) {
    const t = final ? duration : (player.getCurrentTime() || 0);
    try {
      const res = await api(`/api/lessons/${lessonId}/progress`, {
        method: 'POST',
        body: { position: Math.min(t, localMax + SEEK_TOLERANCE), duration: player.getDuration() || duration },
      });
      lastReport = Date.now();
      if (res.duration_sec) duration = res.duration_sec;
      const becameCompleted = res.completed && !completed;
      completed = res.completed;
      if (becameCompleted) {
        if (nextInfo) nextInfo.unlocked = true;
        toast(nextInfo ? "Dars ko'rildi! Keyingi dars ochildi" : "Tabriklaymiz! Kursning oxirgi darsini ko'rdingiz", 'ok');
        updateNextButton();
        loadOutline();
      }
      updateStatus();
    } catch (e) {
      if (e.status === 401) location.replace('/login');
    }
  }

  function sendBeaconReport() {
    if (!ready || !player.getCurrentTime) return;
    const body = JSON.stringify({ position: Math.min(player.getCurrentTime() || 0, localMax + SEEK_TOLERANCE), duration });
    try { navigator.sendBeacon(`/api/lessons/${lessonId}/progress`, new Blob([body], { type: 'application/json' })); } catch { /* ixtiyoriy */ }
  }

  function showEnd() {
    exitFullscreen();
    els.end.hidden = false;
    if (completed) {
      els.end.innerHTML = `<div>
        <h3>${nextInfo ? 'Dars yakunlandi' : 'Kurs yakunlandi!'}</h3>
        <p>${nextInfo ? `Keyingi dars: ${esc(nextInfo.title)}` : "Siz barcha darslarni ko'rib chiqdingiz."}</p>
        <div class="end-actions">
          <button class="btn" id="replayBtn">Qayta ko'rish</button>
          ${nextInfo ? `<a class="btn btn-primary" href="/lesson/${nextInfo.id}">Keyingi dars ${ICONS.next}</a>` : '<a class="btn btn-primary" href="/">Bosh sahifa</a>'}
        </div></div>`;
    } else {
      els.end.innerHTML = `<div><h3>Video to'liq ko'rilmadi</h3><p>Keyingi dars ochilishi uchun videoni o'tkazib yubormasdan ko'ring.</p>
        <div class="end-actions"><button class="btn btn-primary" id="replayBtn">Qayta ko'rish</button></div></div>`;
    }
    const r = document.getElementById('replayBtn');
    if (r) r.onclick = () => { els.end.hidden = true; player.seekTo(0, true); player.playVideo(); };
  }

  // ---------------- Boshqaruv tugmalari ----------------
  function togglePlay() {
    if (!ready) { playWhenReady = true; return; } // pleyer yuklanishidan oldin bosilsa — tayyor bo'lganda boshlanadi
    if (isPlaying()) { player.pauseVideo(); return; }
    player.playVideo();
    // Ba'zi telefonlarda (iOS) birinchi ijro faqat videoning o'ziga bosilganda boshlanadi
    if (!hasPlayed) {
      setTimeout(() => {
        const st = player.getPlayerState();
        if (!hasPlayed && st !== YT.PlayerState.BUFFERING && st !== YT.PlayerState.PLAYING) {
          els.guard.classList.add('inactive');
          toast('Videoni boshlash uchun videoning o\'ziga bosing');
        }
      }, 1200);
    }
  }

  function seekToRatio(ratio) {
    if (!ready || !duration) return;
    let target = Math.max(0, Math.min(1, ratio)) * duration;
    const limit = completed ? duration : localMax;
    if (target > limit + 0.5) {
      target = limit;
      toast("Hali ko'rilmagan qismga o'tib bo'lmaydi");
    }
    player.seekTo(target, true);
    els.end.hidden = true;
    tick();
  }

  function isFs() { return document.fullscreenElement === els.shell || els.shell.classList.contains('fs'); }
  function exitFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    els.shell && els.shell.classList.remove('fs');
  }
  function toggleFs() {
    if (isFs()) return exitFullscreen();
    if (els.shell.requestFullscreen) {
      els.shell.requestFullscreen().catch(() => els.shell.classList.add('fs'));
    } else {
      els.shell.classList.add('fs');
    }
  }

  function bindControls() {
    els.play.addEventListener('click', togglePlay);
    els.guard.addEventListener('click', togglePlay);
    els.guard.addEventListener('dblclick', toggleFs);
    els.fs.addEventListener('click', toggleFs);
    els.mute.addEventListener('click', () => {
      if (!ready) return;
      if (player.isMuted()) { player.unMute(); els.mute.innerHTML = ICONS.volume; els.mute.setAttribute('aria-label', "Ovozni o'chirish"); }
      else { player.mute(); els.mute.innerHTML = ICONS.mute; els.mute.setAttribute('aria-label', 'Ovozni yoqish'); }
    });
    els.speed.addEventListener('change', () => ready && player.setPlaybackRate(Number(els.speed.value)));
    els.seek.addEventListener('click', (e) => {
      const r = els.seek.getBoundingClientRect();
      seekToRatio((e.clientX - r.left) / r.width);
    });
    els.seek.addEventListener('keydown', (e) => {
      if (!ready || !duration) return;
      const t = player.getCurrentTime();
      if (e.key === 'ArrowLeft') { e.preventDefault(); seekToRatio((t - 10) / duration); }
      if (e.key === 'ArrowRight') { e.preventDefault(); seekToRatio((t + 10) / duration); }
    });
    document.addEventListener('keydown', (e) => {
      if (e.target.closest('input, select, textarea, .seek')) return;
      if (e.code === 'Space' || e.key === 'k') { e.preventDefault(); togglePlay(); }
      if (e.key === 'ArrowLeft' && ready) { e.preventDefault(); seekToRatio((player.getCurrentTime() - 10) / duration); }
      if (e.key === 'f') toggleFs();
      if (e.key === 'Escape' && els.shell.classList.contains('fs')) exitFullscreen();
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') sendBeaconReport(); });
    window.addEventListener('pagehide', sendBeaconReport);
    // Kontekst menyusini o'chirish (video havolasini nusxalashni qiyinlashtirish)
    els.shell.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  init();
})();
