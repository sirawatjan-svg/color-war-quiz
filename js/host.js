// ============================================================
// Host — จอครู: สร้างห้อง → ล็อบบี้ → คัดกรอง → แบ่งทีม → เกม (เอนจินรันที่นี่) → สรุปรางวัล
// ============================================================
const Host = (() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = Engine.TEAMS;
  let code = null, R = null, meta = null, players = {}, screen = {}, stats = {};
  let unsubs = [];
  let cfg = { teams: 4, dur: 6, qt: 20, scr: 1, setId: null };
  let S = null, questions = [];
  let raf = null, lastFrame = 0, lastState = 0, lastHud = 0, started = false, ending = false;
  let processedActs = new Set();
  let feedN = 0;

  function show(id) { document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === id)); }
  function unsubAll() { unsubs.forEach(u => u && u()); unsubs = []; }
  function joinUrl() { return location.origin + location.pathname.replace(/host\.html$/, '') + 'play.html?room=' + code + (Net.isLocal ? '&local=1' : ''); }
  let fx = null;
  const EN = ['CRIMSON', 'MAGENTA', 'AZURE', 'LIME'];

  // ---------------- ตั้งค่า ----------------
  function initSetup() {
    const d = Bank.load();
    const sel = $('s-set');
    sel.innerHTML = d.sets.map(s => `<option value="${s.id}">${esc(s.name)} (${s.questions.length} ข้อ)</option>`).join('');
    const upd = () => { const s = d.sets.find(x => x.id === sel.value); cfg.setId = sel.value; $('s-set-info').textContent = s ? `${s.questions.length} ข้อ • แก้ไขได้ที่หน้าคลังคำถาม` : ''; };
    sel.onchange = upd; upd();
    for (const [gid, key] of [['s-teams', 'teams'], ['s-dur', 'dur'], ['s-qt', 'qt'], ['s-scr', 'scr']]) {
      $(gid).querySelectorAll('button').forEach(b => b.onclick = () => { $(gid).querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); cfg[key] = +b.dataset.v; if (key === 'teams') renderTP(); SFX.play('pop'); });
    }
    // ภาพตัวอย่างทีมที่จะได้เล่น
    $('tp').innerHTML = T.map((t, k) => `<div class="tp" id="tp${k}"><canvas></canvas><div class="n">${EN[k]}</div></div>`).join('');
    requestAnimationFrame(() => T.forEach((t, k) => Art.portrait($('tp' + k).querySelector('canvas'), k, { scale: 0.3 })));
    const renderTP = () => T.forEach((t, k) => $('tp' + k).classList.toggle('off', k >= cfg.teams));
    renderTP();
    $('s-mode').innerHTML = Net.isLocal
      ? 'โหมดทดลองในเครื่อง — สแกน QR ไม่ได้ ให้เปิดลิงก์นักเรียนในแท็บใหม่ของเบราว์เซอร์นี้ (เปิดหลายแท็บ = หลายคน)'
      : 'ห้องออนไลน์ (นักเรียนสแกน QR ด้วยมือถือ) · <a href="host.html?local=1" style="color:#fff">ทดลองในเครื่องนี้แทน</a>';
    SFX.ambient();
    $('btn-create').onclick = create;
    $('btn-mute1').onclick = $('btn-mute2').onclick = toggleMute;
  }
  function toggleMute() { SFX.setMuted(!SFX.isMuted()); const t = SFX.isMuted() ? '🔇' : '🔊'; $('btn-mute1').textContent = t; $('btn-mute2').textContent = t; }

  async function create() {
    const set = Bank.getSet(cfg.setId);
    if (!set || set.questions.length < 6) { alert('ชุดคำถามต้องมีอย่างน้อย 6 ข้อ'); return; }
    SFX.ensure();
    $('btn-create').disabled = true;
    await Net.ready();
    questions = set.questions.map(q => ({ text: q.text, a: q.a, b: q.b, c: q.c, d: q.d, correct: q.correct, explain: q.explain || '' }));
    code = String(Math.floor(100000 + Math.random() * 900000));
    R = 'cw/' + code;
    const idxs = shuffle(questions.map((_, i) => i)).slice(0, 3);
    try {
      // กันค้างเงียบ: ถ้า Firebase ไม่ตอบใน 8 วิ ถือว่าล้มเหลว
      await Promise.race([
        Net.set(R, {
          meta: { hostUid: Net.uid(), createdAt: Net.now(), phase: 'lobby', teamCount: cfg.teams, duration: cfg.dur * 60000, qTime: cfg.qt * 1000, screening: cfg.scr, setName: set.name, screenQ: idxs, round: 1 },
          questions,
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), 8000)),
      ]);
    } catch (e) {
      $('btn-create').disabled = false;
      const denied = /PERMISSION/i.test(e.message);
      $('s-mode').innerHTML = `<span style="color:var(--bad)">${denied ? 'สร้างห้องออนไลน์ไม่ได้: ฐานข้อมูลยังไม่อนุญาต (ต้องวางกฎ Firebase ส่วน cw/ ก่อน)' : 'เชื่อมต่อฐานข้อมูลไม่ได้ ลองเช็กอินเทอร์เน็ตแล้วกดใหม่'}</span><br><a class="btn btn-ghost btn-sm btn-th" style="margin-top:10px" href="host.html?local=1">ทดลองเล่นในเครื่องนี้แทน</a>`;
      SFX.play('wrong');
      return;
    }
    location.hash = 'h' + code;
    bindRoom();
    show('v-lobby');
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------------- ผูกข้อมูลห้อง ----------------
  function bindRoom() {
    unsubAll();
    unsubs.push(Net.on(R + '/meta', v => { meta = v || meta; }));
    unsubs.push(Net.on(R + '/players', v => { players = v || {}; onPlayers(); }));
    unsubs.push(Net.on(R + '/screen', v => { screen = v || {}; renderScreen(); }));
    unsubs.push(Net.on(R + '/stats', v => { stats = v || {}; }));
    $('l-code').textContent = code;
    $('l-url').textContent = joinUrl();
    $('qr-box').innerHTML = '';
    try { new QRCode($('qr-box'), { text: joinUrl(), width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M }); } catch (e) {}
    $('btn-screen').onclick = () => startScreening();
    $('btn-skip-screen').onclick = () => goTeams();
    $('btn-teams').onclick = () => goTeams();
    $('btn-close1').onclick = $('btn-close2').onclick = closeRoom;
    $('btn-redraft').onclick = () => { draft(true); renderTeams(); };
    $('btn-start').onclick = startGame;
    $('btn-endnow').onclick = () => { if (confirm('จบเกมตอนนี้?')) endGame(); };
    $('btn-fs').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); setTimeout(() => fx && fx.resize(), 400); };
    $('btn-rematch').onclick = () => rematch(false);
    $('btn-rematch-shuffle').onclick = () => rematch(true);
    $('btn-next-award').onclick = nextAward;
    document.addEventListener('keydown', (e) => { if (e.code === 'Space' && $('v-end').classList.contains('on')) { e.preventDefault(); nextAward(); } });
  }
  async function closeRoom() { if (confirm('ปิดห้องนี้? นักเรียนจะหลุดออกทั้งหมด')) { stopLoop(); await Net.remove(R); location.href = location.pathname; } }

  let seen = new Set();
  function onPlayers() {
    const list = Object.entries(players);
    $('l-count').textContent = list.length;
    $('l-chips').innerHTML = list.map(([pid, p]) => `<div class="chip ${seen.has(pid) ? '' : 'pop'}">${esc(p.name)}</div>`).join('');
    for (const [pid] of list) if (!seen.has(pid)) { seen.add(pid); if ($('v-lobby').classList.contains('on')) SFX.play('pop'); }
    renderScreen();
    // คนเข้าช้าหลังแบ่งทีมแล้ว → ใส่ทีมที่เล็กสุดให้อัตโนมัติ
    if (meta && (meta.phase === 'teams' || meta.phase === 'play')) {
      const sizes = teamSizes();
      for (const [pid, p] of list) if (p.team == null) { let m = 0; for (let k = 1; k < meta.teamCount; k++) if (sizes[k] < sizes[m]) m = k; sizes[m]++; Net.update(R + '/players/' + pid, { team: m }); }
      if (meta.phase === 'teams') renderTeams();
    }
  }
  function teamSizes() { const s = [0, 0, 0, 0]; for (const p of Object.values(players)) if (p.team != null) s[p.team]++; return s; }

  // ---------------- คัดกรอง ----------------
  let scrTimer = null, scrLeft = 75;
  async function startScreening() {
    await Net.update(R + '/meta', { phase: 'screen', screenStart: Net.now() });
    show('v-screen'); scrLeft = 75; SFX.play('go');
    scrTimer = setInterval(() => { scrLeft--; $('sc-timer').textContent = scrLeft; if (scrLeft <= 10) SFX.play('tick'); if (scrLeft <= 0) { clearInterval(scrTimer); goTeams(); } }, 1000);
  }
  function renderScreen() {
    if (!$('v-screen').classList.contains('on')) return;
    const list = Object.entries(players); const done = list.filter(([pid]) => screen[pid]).length;
    $('sc-done').textContent = done; $('sc-total').textContent = list.length;
    $('sc-bar').style.width = (list.length ? done / list.length * 100 : 0) + '%';
    $('sc-chips').innerHTML = list.map(([pid, p]) => `<div class="chip ${screen[pid] ? 'done' : ''}">${esc(p.name)}${screen[pid] ? '<small>' + screen[pid].correct + '/3</small>' : ''}</div>`).join('');
    if (list.length && done === list.length && scrTimer) { clearInterval(scrTimer); scrTimer = null; setTimeout(goTeams, 800); }
  }

  // ---------------- แบ่งทีม (snake draft) ----------------
  function draft(randomize) {
    const n = meta.teamCount;
    let list = Object.entries(players);
    if (!randomize && meta.screening && Object.keys(screen).length) {
      list.sort((a, b) => { const sa = screen[a[0]] || { correct: -1, ms: 1e9 }, sb = screen[b[0]] || { correct: -1, ms: 1e9 }; return (sb.correct - sa.correct) || (sa.ms - sb.ms); });
      // สุ่มเล็กน้อยในกลุ่มคะแนนเท่ากันเพื่อไม่ให้ซ้ำทุกครั้ง
    } else list = shuffle(list);
    const upd = {};
    list.forEach(([pid], i) => { const round = Math.floor(i / n), pos = i % n; const team = round % 2 === 0 ? pos : n - 1 - pos; upd[pid + '/team'] = team; players[pid].team = team; });
    Net.update(R + '/players', upd);
  }
  async function goTeams() {
    if (scrTimer) { clearInterval(scrTimer); scrTimer = null; }
    if (!Object.keys(players).length) { alert('ยังไม่มีนักเรียนในห้อง'); return; }
    draft(false);
    await Net.update(R + '/meta', { phase: 'teams' });
    show('v-teams'); renderTeams(); SFX.play('whoosh');
  }
  let selPid = null;
  function renderTeams() {
    const n = meta.teamCount; const cols = $('t-cols'); cols.innerHTML = '';
    for (let k = 0; k < n; k++) {
      const t = T[k];
      const members = Object.entries(players).filter(([, p]) => p.team === k).sort((a, b) => ((screen[b[0]] || {}).correct || 0) - ((screen[a[0]] || {}).correct || 0));
      const col = document.createElement('div'); col.className = 'team-col'; col.style.setProperty('--tc', t.color);
      col.innerHTML = `<div class="head"><canvas></canvas><div class="info"><div class="en">${EN[k]} · ${t.hero.toUpperCase()}</div><div class="th">ทีม${t.th}</div><div class="d">${t.heroDesc}<br>สกิล: <b style="color:#fff">${t.skill}</b></div><span class="tag" style="margin-top:10px">${members.length} PLAYERS</span></div></div><div class="list"></div>`;
      requestAnimationFrame(() => Art.portrait(col.querySelector('canvas'), k, { scale: 0.32 }));
      col.querySelector('.head').onclick = () => { if (selPid != null && players[selPid].team !== k) { Net.update(R + '/players/' + selPid, { team: k }); players[selPid].team = k; selPid = null; renderTeams(); } };
      const list = col.querySelector('.list');
      for (const [pid, p] of members) {
        const el = document.createElement('div'); el.className = 'pl' + (selPid === pid ? ' sel' : '');
        const sc = screen[pid];
        el.innerHTML = `<span>${esc(p.name)}</span><small>${sc ? sc.correct + '/3 · ' + (sc.ms / 1000).toFixed(0) + 'S' : '—'}</small>`;
        el.onclick = () => {
          if (selPid == null) { selPid = pid; }
          else if (selPid === pid) { selPid = null; }
          else { const a = players[selPid].team, b = players[pid].team; Net.update(R + '/players', { [selPid + '/team']: b, [pid + '/team']: a }); players[selPid].team = b; players[pid].team = a; selPid = null; SFX.play('pop'); }
          renderTeams();
        };
        list.appendChild(el);
      }
      cols.appendChild(col);
    }
  }

  // ---------------- เกม ----------------
  async function startGame() {
    const startAt = Net.now() + 3800;
    S = Engine.create({ teams: meta.teamCount, duration: meta.duration });
    for (const [pid, p] of Object.entries(players)) S.names[pid] = p.name;
    processedActs = new Set(); started = false; ending = false; feedN = 0; leader = -1; leaderSince = 0; lastSec = -1;
    $('feed').innerHTML = ''; $('sbadges').innerHTML = ''; $('final10').style.display = 'none'; $('vignette').classList.remove('on'); $('lead-slot').innerHTML = '';
    await Net.remove(R + '/acts'); await Net.remove(R + '/state');
    await Net.update(R + '/meta', { phase: 'play', startAt, endAt: startAt + meta.duration });
    show('v-play');
    $('hud-room').textContent = 'ROOM ' + code;
    if (fx) fx.destroy();
    fx = FX.create($('board'), { stage: $('stage') });
    buildHud();
    // นับถอยหลัง
    const ov = $('countdown'); ov.style.display = 'flex';
    const cdTick = () => {
      const left = startAt - Net.now();
      if (left <= 0) {
        $('cd-num').textContent = 'GO!'; $('cd-num').classList.remove('pop'); void $('cd-num').offsetWidth; $('cd-num').classList.add('pop');
        setTimeout(() => { ov.style.display = 'none'; }, 450);
        SFX.play('go'); fx.flash('#ffffff', 0.6); fx.shake(10); started = true; SFX.startMusic(118, "battle"); SFX.setMusic({ intensity: 0.3 }); return;
      }
      const n = Math.ceil(left / 1000); if ($('cd-num').textContent !== String(n)) { $('cd-num').textContent = n; $('cd-num').classList.remove('pop'); void $('cd-num').offsetWidth; $('cd-num').classList.add('pop'); SFX.play('count'); }
      setTimeout(cdTick, 50);
    };
    cdTick();
    unsubs.push(Net.on(R + '/acts', onActs));
    lastFrame = performance.now(); lastState = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
    if (simTimer) clearInterval(simTimer);
    simTimer = setInterval(() => { if (document.hidden) { simStep(); if (S && !S.ended) { Engine.drainEvents(S); const left = meta.duration - S.t; if (performance.now() - lastState > 1200) { lastState = performance.now(); pushState(left); } if (left <= 0 || S.ended) endGame(); } } }, 100);
  }
  function buildHud() {
    const n = meta.teamCount;
    $('tug').innerHTML = Array.from({ length: n }, (_, k) => `<i id="tug${k}" style="background:${T[k].color};width:${100 / n}%"></i>`).join('');
    $('tchips').innerHTML = Array.from({ length: n }, (_, k) => `<div class="tchip" id="tch${k}"><canvas></canvas><b id="tc${k}">0</b><span id="tl${k}">LOCK 0</span></div>`).join('');
    requestAnimationFrame(() => { for (let k = 0; k < n; k++) Art.portrait($('tch' + k).querySelector('canvas'), k, { scale: 0.36, glow: false }); });
  }
  let leader = -1, leaderSince = 0;
  function leadBanner(k) {
    const el = document.createElement('div'); el.className = 'lead-banner';
    el.innerHTML = `<i style="background:${T[k].color}"></i>ทีม${T[k].th} ขึ้นนำ!`;
    $('lead-slot').innerHTML = ''; $('lead-slot').appendChild(el);
    SFX.play('award');
  }
  function onActs(v) {
    if (!v || !S || S.ended) return;
    for (const [key, a] of Object.entries(v)) {
      if (processedActs.has(key)) continue;
      processedActs.add(key);
      Net.remove(R + '/acts/' + key);
      if (!started) continue;
      const p = players[a.pid]; if (!p || p.team == null) continue;
      if (a.type === 'spawn') Engine.spawn(S, p.team, a.pid, p.name);
      else if (a.type === 'skill') Engine.useSkill(S, p.team, a.pid, p.name);
      else if (a.type === 'shield' || a.type === 'freeze') Engine.useUniversal(S, p.team, a.pid, a.type, p.name);
    }
  }
  function feed(html, color) {
    const d = document.createElement('div'); d.innerHTML = `<span class="dot" style="background:${color || '#fff'}"></span>` + html;
    $('feed').prepend(d); feedN++;
    while ($('feed').children.length > 4) $('feed').lastChild.remove();
  }
  // จำลองยึดตามนาฬิกาจริง (ไม่ใช่เฟรม) — แท็บถูกย่อ/จอดับชั่วคราวก็ยังตรงกับเวลาบนมือถือนักเรียน
  let simTimer = null;
  function simStep() {
    if (!S || !started || S.ended) return;
    const target = Math.min(meta.duration, Net.now() - meta.startAt);
    let budget = 80; // ไล่ตามได้ไม่เกิน 2 วิต่อครั้ง กันค้าง
    while (S.t < target && budget-- > 0 && !S.ended) Engine.tick(S, 25);
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    lastFrame = now;
    if (!S) return;
    if (started && !S.ended) {
      simStep();
      const ev = Engine.drainEvents(S);
      fx.consume(ev);
      for (const e of ev) {
        if (e.type === 'spawn') feed(`<b>${esc(e.name)}</b> ปล่อย ${T[e.team].hero}${e.boost ? ' ▲' : ''}`, T[e.team].color);
        else if (e.type === 'skill') feed(`<b>${esc(e.name)}</b> ใช้ <b>${T[e.team].skill}</b>`, T[e.team].color);
        else if (e.type === 'universal') feed(`<b>${esc(e.name)}</b> ${Engine.UNIVERSAL[e.kind].name}`, T[e.team].color);
        else if (e.type === 'combo') feed(`คอมโบทีม<b>${T[e.team].th}</b>`, T[e.team].color);
        else if (e.type === 'instantwin') feed(`ทีม<b>${T[e.team].th}</b> ล็อกครบ ชนะขาด!`, T[e.team].color);
      }
      const left = meta.duration - S.t;
      if (now - lastHud > 150) { lastHud = now; updateHud(left); }
      if (now - lastState > 1200) { lastState = now; pushState(left); }
      if (left <= 0 || S.ended) endGame();
    }
    fx.draw(S, now);
  }
  let lastSec = -1;
  function updateHud(left) {
    const n = meta.teamCount;
    const sc = Engine.scores(S);
    const painted = Math.max(1, sc.reduce((a, x) => a + x.cells, 0));
    let best = 0; for (let k = 1; k < n; k++) if (sc[k].score > sc[best].score) best = k;
    for (let k = 0; k < n; k++) {
      $('tc' + k).textContent = S.counts[k]; $('tl' + k).textContent = 'LOCK ' + S.lockedCounts[k];
      $('tug' + k).style.width = (painted > n ? S.counts[k] / painted * 100 : 100 / n) + '%';
      $('tch' + k).classList.toggle('lead', k === best && sc[best].score > 0);
    }
    // เปลี่ยนผู้นำ (ต้องนำต่อเนื่อง 1.5 วิ กันกระพริบ)
    if (sc[best].score > 0) {
      if (best !== leader) { if (!leaderSince || leaderSince.k !== best) leaderSince = { k: best, t: performance.now() }; else if (performance.now() - leaderSince.t > 1500) { const first = leader < 0; leader = best; if (!first && S.t > 15000) leadBanner(best); } }
      else leaderSince = 0;
    }
    const sec = Math.max(0, Math.ceil(left / 1000));
    $('hud-timer').textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
    $('hud-timer').classList.toggle('hot', sec <= 30);
    if (sec !== lastSec) {
      lastSec = sec;
      // 10 วินาทีสุดท้าย: ตัวเลขยักษ์กลางจอ + ขอบจอแดงเต้น
      const f10 = sec <= 10 && sec > 0;
      $('final10').style.display = f10 ? 'flex' : 'none'; $('vignette').classList.toggle('on', sec <= 10 && sec > 0);
      if (f10) { $('f10').textContent = sec; $('f10').classList.remove('pop'); void $('f10').offsetWidth; $('f10').classList.add('pop'); }
      if (sec <= 10 && sec > 0) { SFX.play('ticklow'); fx.flash('#ffffff', 0.12); fx.shake(4); }
      else if (sec <= 30) SFX.play('tick');
      const frac = 1 - left / meta.duration;
      SFX.setMusic({ bpm: 118 + Math.round(frac * 30) + (sec <= 30 ? 20 : 0), intensity: Math.min(1, 0.3 + frac * 0.7 + (sec <= 30 ? 0.4 : 0)) });
    }
    // ป้ายสถานะ
    const b = [];
    for (let k = 0; k < n; k++) {
      if (S.t < S.frozenUntil[k]) b.push(`<span class="sb" style="border-color:#9be7ff;color:#9be7ff">${EN[k]} FROZEN</span>`);
      if (S.t < S.shieldUntil[k]) b.push(`<span class="sb" style="border-color:${T[k].color};color:${T[k].color}">${EN[k]} QUICK LOCK</span>`);
      if (S.t < S.speedUntil[k]) b.push(`<span class="sb" style="border-color:${T[k].color};color:${T[k].color}">${EN[k]} BOOST</span>`);
    }
    $('sbadges').innerHTML = b.join('');
  }
  function pushState(left) {
    const n = meta.teamCount;
    Net.set(R + '/state', {
      left: Math.max(0, left), counts: Array.from(S.counts).slice(0, n), locked: Array.from(S.lockedCounts).slice(0, n),
      board: Engine.encodeBoard(S), units: S.units.length,
      fx: { frozen: Array.from(S.frozenUntil).slice(0, n).map(v => v > S.t), shield: Array.from(S.shieldUntil).slice(0, n).map(v => v > S.t), speed: Array.from(S.speedUntil).slice(0, n).map(v => v > S.t) },
    });
  }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = null; if (simTimer) clearInterval(simTimer); simTimer = null; SFX.stopMusic(); }

  // ---------------- จบเกม ----------------
  let results = null, awardIdx = -1;
  async function endGame() {
    if (ending) return; ending = true;
    Engine.finish(S);
    fx.draw(S, performance.now());
    $('final10').style.display = 'none'; $('vignette').classList.remove('on');
    SFX.stopMusic(); SFX.play('drum');
    const latestStats = await Net.once(R + '/stats');
    const all = Awards.merge(players, latestStats || stats, S.stats);
    const comp = Awards.compute(all);
    const sc = Engine.scores(S).sort((a, b) => b.score - a.score);
    results = { winner: S.winner, instantWin: S.instantWin, teams: sc, awards: comp.awards, personal: comp.personal, ranked: comp.ranked.map(p => ({ pid: p.pid, name: p.name, team: p.team, points: p.points, correct: p.correct, answered: p.answered, captured: p.captured, locked: p.locked, spawns: p.spawns, skills: p.skills, bestStreak: p.bestStreak })) };
    await Net.set(R + '/results', results);
    await Net.update(R + '/meta', { phase: 'end' });
    setTimeout(() => { stopLoop(); showEnd(); }, 1200);
  }
  function showEnd() {
    show('v-end');
    const w = T[results.winner];
    $('winner').style.setProperty('--wc', w.color);
    $('e-w1').textContent = results.instantWin ? 'KNOCKOUT — ล็อกเกินครึ่งกระดาน' : 'AND THE WINNER IS';
    $('e-w2').textContent = ''; $('e-portrait').style.visibility = 'hidden';
    $('e-scores').innerHTML = ''; $('e-award').innerHTML = ''; $('e-board').style.display = 'none'; awardIdx = -1;
    $('e-acount').textContent = results.awards.length + ' AWARDS';
    $('btn-next-award').style.display = '';
    setTimeout(() => {
      $('e-w2').textContent = 'ทีม' + w.th; $('e-w2').classList.add('pop');
      $('e-portrait').style.visibility = ''; Art.portrait($('e-portrait'), results.winner, { scale: 0.34 }); $('e-portrait').classList.add('pop');
      SFX.play('win'); confetti(w.color); setTimeout(() => { if (!started || ending) SFX.startMusic(84, 'chill'); }, 4000);
    }, 900);
    setTimeout(() => {
      $('e-scores').innerHTML = results.teams.map((s, i) => `<div class="sc fadein ${i === 0 ? 'first' : ''}" style="--tc:${T[s.team].color};animation-delay:${i * .12}s"><span class="label">${i + 1} · ${EN[s.team]}</span><b>${s.score}</b><div class="muted" style="font-size:.85rem">ช่อง ${s.cells} · ล็อก ${s.locked}</div></div>`).join('');
    }, 1900);
  }
  function nextAward() {
    awardIdx++;
    if (awardIdx < results.awards.length) {
      const a = results.awards[awardIdx]; const t = T[a.team] || { color: '#ffffff', th: '' };
      $('e-award').innerHTML = `<div class="award pop" style="--tc:${Art.hexA(t.color, .55)}"><div class="art"><div class="em">${a.emoji}</div></div><div class="body"><div class="an"><span class="tag tag-solid">AWARD ${awardIdx + 1}/${results.awards.length}</span><span class="display" style="font-weight:800;font-size:1.25rem">${a.name}</span></div><div class="pn" style="color:${t.color}">${esc(a.pname)}</div><div class="ad">${esc(a.desc)}</div><div class="av"><span class="tag">${esc(a.value)}</span> <span class="tag">ทีม${t.th}</span></div></div></div>`;
      $('e-acount').textContent = ''; SFX.play('award'); confetti(t.color, 70);
    } else {
      $('e-award').innerHTML = ''; $('btn-next-award').style.display = 'none'; $('e-acount').textContent = '';
      $('e-board').style.display = '';
      $('e-table').innerHTML = `<tr><th>#</th><th>Name</th><th>Team</th><th>Points</th><th>Correct</th><th>Cells</th><th>Locked</th><th>Spawns</th><th>Skills</th><th>Streak</th></tr>` +
        results.ranked.map((p, i) => `<tr><td class="pixel">${i + 1}</td><td><b>${esc(p.name)}</b></td><td>${T[p.team] ? `<span class="dot" style="background:${T[p.team].color}"></span>${T[p.team].th}` : '-'}</td><td><b>${p.points}</b></td><td>${p.correct}/${p.answered}</td><td>${p.captured}</td><td>${p.locked}</td><td>${p.spawns}</td><td>${p.skills}</td><td>${p.bestStreak}</td></tr>`).join('');
    }
  }
  async function rematch(reshuffle) {
    const upd = {}; for (const pid in players) if (reshuffle) upd[pid + '/team'] = null;
    if (reshuffle) await Net.update(R + '/players', upd);
    await Net.remove(R + '/stats'); await Net.remove(R + '/acts'); await Net.remove(R + '/results'); await Net.remove(R + '/state');
    if (reshuffle) { await Net.remove(R + '/screen'); screen = {}; }
    await Net.update(R + '/meta', { round: (meta.round || 1) + 1, phase: 'teams' });
    for (const pid in players) if (reshuffle) players[pid].team = null;
    if (reshuffle) draft(true); // "ทีมเดิม" = ไม่จับทีมใหม่
    SFX.startMusic(84, 'chill');
    show('v-teams'); renderTeams();
  }

  // ---------------- คอนเฟตตี ----------------
  let confs = [], confRaf = null;
  function confetti(color, n) {
    const cv = $('confetti'); cv.width = innerWidth; cv.height = innerHeight; const c = cv.getContext('2d');
    const cols = [color, '#ffffff', '#ffd54a', color];
    for (let i = 0; i < (n || 180); i++) confs.push({ x: Math.random() * cv.width, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, r: 4 + Math.random() * 6, color: cols[i % cols.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3 });
    if (confRaf) return;
    const loop = () => {
      c.clearRect(0, 0, cv.width, cv.height);
      confs = confs.filter(p => p.y < cv.height + 20);
      for (const p of confs) { p.x += p.vx; p.y += p.vy; p.rot += p.vr; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.color; c.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); c.restore(); }
      if (confs.length) confRaf = requestAnimationFrame(loop); else { confRaf = null; }
    };
    confRaf = requestAnimationFrame(loop);
  }

  // ---------------- เริ่มต้น ----------------
  function boot() {
    Net.init();
    initSetup();
    // กลับเข้าห้องเดิมหลังรีเฟรช (เฉพาะล็อบบี้/ทีม — ระหว่างเกมเอนจินอยู่ในหน่วยความจำ กู้ไม่ได้)
    const m = location.hash.match(/^#h(\d{6})$/);
    if (m) {
      code = m[1]; R = 'cw/' + code;
      Net.once(R + '/meta').then(v => {
        if (!v) { location.hash = ''; return; }
        meta = v; Net.once(R + '/questions').then(q => { questions = q || []; });
        bindRoom();
        if (v.phase === 'lobby') show('v-lobby'); else if (v.phase === 'screen') { show('v-screen'); } else if (v.phase === 'teams') { setTimeout(() => { show('v-teams'); renderTeams(); }, 300); }
        else { show('v-lobby'); Net.update(R + '/meta', { phase: 'lobby' }); }
      });
    }
  }
  boot();
  return { get S() { return S; } };
})();
