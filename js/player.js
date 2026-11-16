// ============================================================
// Player — มือถือนักเรียน: เข้าห้อง → คัดกรอง → ดูทีม → ตอบคำถาม/ปล่อย/สกิล → ผลส่วนตัว
// ============================================================
const Player = (() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = Engine.TEAMS;
  let code = null, R = null, pid = null, name = '', meta = null, me = null, questions = [], state = null, players = {};
  let unsubs = [], phase = null, round = 0;
  // สถิติรอบนี้ (ส่งขึ้น stats/{pid})
  let st = null, order = [], qi = 0, qStart = 0, qTimer = null, locked = false, sinceSpawn = 0, spawnsSinceSkill = 0, skillCharges = 0, pendingSpawn = 0, spawnAuto = null;
  let shieldSent = false, freezeSent = false;

  function show(id) { document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === id)); window.scrollTo(0, 0); }
  function toast(t, ms) { const el = $('toast'); el.textContent = t; el.style.display = ''; clearTimeout(el._t); el._t = setTimeout(() => el.style.display = 'none', ms || 1800); }
  function vib(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
  const KEY = () => 'cw-pid-' + code;
  const EN = ['CRIMSON', 'MAGENTA', 'AZURE', 'LIME'];
  const KEYC = ['#fff', '#fff', '#fff', '#fff']; // ปุ่มตัวเลือกโทนขาวดำตามระบบดีไซน์ (สีสดเก็บไว้ในภาพเกม)
  // โหมดทดสอบในเครื่อง: หลายแท็บในเบราว์เซอร์เดียวต้องเป็นคนละคน → ใช้ sessionStorage (แยกต่อแท็บ)
  const store = Net.isLocal ? sessionStorage : localStorage;

  // ---------------- เข้าห้อง ----------------
  function initJoin() {
    const u = new URL(location.href); const rc = u.searchParams.get('room');
    if (rc) $('j-code').value = rc;
    $('j-name').value = localStorage.getItem('cw-name') || '';
    $('btn-join').onclick = join;
    $('j-name').onkeydown = (e) => { if (e.key === 'Enter') join(); };
    $('btn-sound').onclick = () => { SFX.ensure(); SFX.play('correct'); $('btn-sound').textContent = '🔊 เสียงเปิดแล้ว'; };
  }
  async function join() {
    code = $('j-code').value.trim(); name = $('j-name').value.trim();
    if (!/^\d{6}$/.test(code)) { $('j-msg').textContent = 'รหัสห้องต้องเป็นตัวเลข 6 หลัก'; return; }
    if (!name) { $('j-msg').textContent = 'ใส่ชื่อเล่นก่อนนะ'; return; }
    SFX.ensure();
    $('btn-join').disabled = true; $('j-msg').textContent = 'กำลังเข้าห้อง…';
    R = 'cw/' + code;
    await Net.ready();
    const m = await Net.once(R + '/meta');
    if (!m) { $('j-msg').textContent = 'ไม่พบห้องนี้ ลองเช็กรหัสอีกครั้ง'; $('btn-join').disabled = false; return; }
    localStorage.setItem('cw-name', name);
    pid = store.getItem(KEY());
    const existing = pid ? await Net.once(R + '/players/' + pid) : null;
    if (!existing) { pid = 'p' + Math.random().toString(36).slice(2, 10); store.setItem(KEY(), pid); await Net.set(R + '/players/' + pid, { name, joinedAt: Net.now(), uid: Net.uid() || null, team: null }); }
    else if (existing.name !== name) await Net.update(R + '/players/' + pid, { name });
    location.hash = 'p' + code;
    bind();
  }

  function bind() {
    unsubs.forEach(u => u()); unsubs = [];
    $('lb-code').textContent = code; $('lb-name').textContent = name; $('sc-name').textContent = name; $('p-name').textContent = name;
    unsubs.push(Net.on(R + '/meta', v => { if (!v) { alert('ครูปิดห้องแล้ว'); location.href = location.pathname; return; } meta = v; onMeta(); }));
    unsubs.push(Net.on(R + '/players', v => { players = v || {}; me = players[pid] || me; $('lb-count').textContent = Object.keys(players).length + ' คนในห้อง'; if (phase === 'teams' && me && me.team != null) renderTeam(); if (phase === 'play' && me && me.team != null && !$('p-team').dataset.set) renderPlayHead(); }));
    unsubs.push(Net.on(R + '/state', v => { state = v; renderState(); }));
    unsubs.push(Net.on(R + '/results', v => { if (v && phase === 'end') renderEnd(v); }));
    Net.once(R + '/questions').then(q => { questions = q || []; });
  }

  // ---------------- เปลี่ยนเฟส ----------------
  function onMeta() {
    if (meta.round !== round) { round = meta.round; resetRound(); }
    if (meta.phase === phase) return;
    phase = meta.phase;
    if (phase === 'lobby') show('v-lobby');
    else if (phase === 'screen') startScreening();
    else if (phase === 'teams') { resetRound(); show('v-team'); renderTeam(); SFX.play('whoosh'); }
    else if (phase === 'play') startPlay();
    else if (phase === 'end') { stopQuestion(); show('v-end'); Net.once(R + '/results').then(v => v && renderEnd(v)); }
  }
  function resetRound() {
    st = { answered: 0, correct: 0, wrong: 0, streak: 0, bestStreak: 0, sumMs: 0, fastestMs: 0, spawns: 0, skills: 0, h1c: 0, h2c: 0 };
    sinceSpawn = 0; spawnsSinceSkill = 0; skillCharges = 0; pendingSpawn = 0; shieldSent = false; freezeSent = false; qi = 0;
    $('p-team').dataset.set = '';
  }

  // ---------------- คัดกรอง ----------------
  let scI = 0, scCorrect = 0, scStart = 0, scT0 = 0;
  async function startScreening() {
    const done = await Net.once(R + '/screen/' + pid);
    if (done) { $('sw-correct').textContent = done.correct; show('v-screen-wait'); return; }
    if (!questions.length) questions = (await Net.once(R + '/questions')) || [];
    scI = 0; scCorrect = 0; scT0 = Date.now(); show('v-screen'); renderScreenQ();
  }
  function renderScreenQ() {
    const q = questions[meta.screenQ[scI]]; if (!q) { finishScreening(); return; }
    $('sc-prog').textContent = (scI + 1) + '/3'; $('sc-qt').textContent = q.text;
    scStart = Date.now();
    $('sc-choices').innerHTML = ''; let answered = false;
    ['a', 'b', 'c', 'd'].forEach((k, i) => {
      const b = document.createElement('button'); b.className = 'choice'; b.innerHTML = `<span class="k" style="background:${KEYC[i]}">${'ABCD'[i]}</span><span>${esc(q[k])}</span>`;
      b.onclick = () => { if (answered) return; answered = true; const ok = i === q.correct; if (ok) { scCorrect++; SFX.play('correct'); b.classList.add('ok'); } else { SFX.play('wrong'); b.classList.add('no'); $('sc-choices').children[q.correct].classList.add('ok'); } setTimeout(() => { scI++; renderScreenQ(); }, 700); };
      $('sc-choices').appendChild(b);
    });
    animateQTime($('sc-qtime'), 20000, () => { if (!answered) { answered = true; scI++; renderScreenQ(); } });
  }
  function finishScreening() {
    stopQTime();
    Net.set(R + '/screen/' + pid, { correct: scCorrect, ms: Date.now() - scT0 });
    $('sw-correct').textContent = scCorrect; show('v-screen-wait');
  }
  let qtRaf = null;
  function animateQTime(bar, ms, onEnd) {
    stopQTime(); const t0 = performance.now();
    const loop = (now) => { const p = Math.max(0, 1 - (now - t0) / ms); bar.style.width = (p * 100) + '%'; if (p > 0) qtRaf = requestAnimationFrame(loop); else { qtRaf = null; onEnd && onEnd(); } };
    qtRaf = requestAnimationFrame(loop);
  }
  function stopQTime() { if (qtRaf) cancelAnimationFrame(qtRaf); qtRaf = null; }

  // ---------------- ทีม ----------------
  function renderTeam() {
    if (!me || me.team == null) { $('tm-name').textContent = 'กำลังแบ่งทีม…'; return; }
    const t = T[me.team];
    if ($('tm-card').dataset.team !== String(me.team)) { $('tm-card').dataset.team = me.team; $('tm-card').style.setProperty('--tc', t.color); requestAnimationFrame(() => Art.portrait($('tm-portrait'), me.team, { scale: 0.34, glow: false })); }
    $('tm-name').textContent = 'ทีม' + t.th; $('tm-hero').textContent = EN[me.team] + ' · ' + t.hero.toUpperCase();
    $('tm-desc').textContent = t.heroDesc; $('tm-skill').textContent = t.skill; $('tm-skilldesc').textContent = t.skillDesc;
    if (!$('tm-card').dataset.shown) { $('tm-card').dataset.shown = '1'; SFX.play('skillready'); vib([60, 40, 60]); }
  }

  // ---------------- เล่น ----------------
  function seededShuffle(arr, seed) {
    let h = 2166136261; for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    const rnd = () => { h += 0x6D2B79F5; let t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a;
  }
  async function startPlay() {
    if (!questions.length) questions = (await Net.once(R + '/questions')) || [];
    order = seededShuffle(questions.map((_, i) => i), pid + ':' + round);
    // ข้อคัดกรองไว้ท้ายๆ จะได้ไม่เจอซ้ำทันที
    if (meta.screenQ) { const sq = new Set(meta.screenQ); order = order.filter(i => !sq.has(i)).concat(order.filter(i => sq.has(i))); }
    qi = 0; show('v-play'); renderPlayHead(); renderProgress();
    $('btn-spawn').onclick = doSpawn; $('btn-skill').onclick = doSkill;
    // นับถอยหลัง
    const ov = $('p-countdown'); ov.style.display = 'flex';
    const tick = () => {
      const left = meta.startAt - Net.now();
      if (left <= 0) { ov.style.display = 'none'; SFX.play('go'); vib(80); nextQuestion(); return; }
      const n = Math.ceil(left / 1000); if ($('p-cd').textContent !== String(n)) { $('p-cd').textContent = n; SFX.play('count'); }
      setTimeout(tick, 60);
    };
    tick();
  }
  function renderPlayHead() {
    if (!me || me.team == null) return;
    $('p-team-en').textContent = EN[me.team]; $('p-team').style.borderColor = T[me.team].color; $('p-team').dataset.set = '1';
    requestAnimationFrame(() => Art.portrait($('p-team-art'), me.team, { scale: 0.38, glow: false }));
    $('p-tbars').innerHTML = Array.from({ length: meta.teamCount }, (_, k) => `<i id="mb${k}" style="background:${T[k].color};width:${100 / meta.teamCount}%"></i>`).join('');
  }
  function renderProgress() {
    for (let i = 0; i < 3; i++) $('pg' + i).classList.toggle('on', i < sinceSpawn);
    $('sp-n').textContent = pendingSpawn > 0 ? '×' + pendingSpawn : '';
    $('btn-spawn').disabled = pendingSpawn <= 0; $('btn-spawn').classList.toggle('pulse', pendingSpawn > 0);
    $('sk-n').textContent = skillCharges; $('btn-skill').disabled = skillCharges <= 0; $('btn-skill').classList.toggle('ready-glow', skillCharges > 0);
    $('p-score').textContent = st.correct + '/' + st.answered + ' ✓';
    $('p-streak').textContent = st.streak >= 2 ? 'STREAK ' + st.streak + (st.streak < 5 ? ' · 5 = QUICK LOCK' : st.streak < 8 ? ' · 8 = FREEZE' : ' · MAX!') : '';
  }
  function gameLeft() { return meta.endAt ? meta.endAt - Net.now() : 1; }
  function nextQuestion() {
    if (phase !== 'play' || gameLeft() <= 0) return;
    const q = questions[order[qi % order.length]]; qi++;
    locked = false; qStart = Date.now();
    $('p-qt').textContent = q.text; $('p-explain').textContent = '';
    $('p-choices').innerHTML = '';
    ['a', 'b', 'c', 'd'].forEach((k, i) => {
      const b = document.createElement('button'); b.className = 'choice'; b.innerHTML = `<span class="k" style="background:${KEYC[i]}">${'ABCD'[i]}</span><span>${esc(q[k])}</span>`;
      b.onclick = () => answer(q, i);
      $('p-choices').appendChild(b);
    });
    animateQTime($('p-qtime'), meta.qTime || 20000, () => { if (!locked) answer(q, -1); });
  }
  function stopQuestion() { stopQTime(); locked = true; }
  function answer(q, i) {
    if (locked) return; locked = true; stopQTime();
    const ms = Date.now() - qStart; const ok = i === q.correct;
    const ch = $('p-choices').children;
    for (let k = 0; k < 4; k++) { if (k === q.correct) ch[k].classList.add('ok'); else if (k === i) ch[k].classList.add('no'); else ch[k].classList.add('dim'); }
    st.answered++;
    const half2 = meta.startAt && Net.now() > meta.startAt + meta.duration / 2;
    if (ok) {
      st.correct++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); st.sumMs += ms; if (!st.fastestMs || ms < st.fastestMs) st.fastestMs = ms;
      if (half2) st.h2c++; else st.h1c++;
      sinceSpawn++; SFX.play('correct'); vib(40); $('qbox').classList.remove('flashok'); void $('qbox').offsetWidth; $('qbox').classList.add('flashok');
      if (sinceSpawn >= 3) { sinceSpawn = 0; pendingSpawn++; SFX.play('spawn'); vib([50, 30, 120]); toast('🚀 พร้อมปล่อย! กดปุ่ม "ปล่อย!"'); clearTimeout(spawnAuto); spawnAuto = setTimeout(() => { if (pendingSpawn > 0) doSpawn(); }, 6000); }
      else SFX.play('progress', { n: sinceSpawn });
      if (st.streak === 5 && !shieldSent) { shieldSent = true; sendAct('shield'); toast('🛡️ โล่ล็อกเร็วให้ทีม!'); SFX.play('shield'); }
      if (st.streak === 8 && !freezeSent) { freezeSent = true; sendAct('freeze'); toast('❄️ แช่แข็งศัตรูทั้งกระดาน!'); SFX.play('freeze'); }
      if (st.streak > 8 && st.streak % 8 === 0) { sendAct('freeze'); toast('❄️ แช่แข็งอีกครั้ง!'); }
      else if (st.streak > 5 && st.streak % 5 === 0 && st.streak % 8 !== 0) { sendAct('shield'); toast('🛡️ โล่อีกครั้ง!'); }
    } else {
      st.wrong++; st.streak = 0; SFX.play('wrong'); vib([30, 30, 30]); $('qbox').classList.remove('flashno'); void $('qbox').offsetWidth; $('qbox').classList.add('flashno');
      if (q.explain) $('p-explain').textContent = '💡 ' + q.explain;
    }
    renderProgress(); pushStats();
    setTimeout(nextQuestion, ok ? 700 : 1600);
  }
  let statsT = null;
  function pushStats() { clearTimeout(statsT); statsT = setTimeout(() => Net.set(R + '/stats/' + pid, Object.assign({}, st, { name, team: me ? me.team : null, at: Net.now() })), 250); }
  function sendAct(type) { Net.push(R + '/acts', { pid, type, t: Net.now() }); }
  function doSpawn() {
    if (pendingSpawn <= 0 || phase !== 'play') return;
    clearTimeout(spawnAuto);
    pendingSpawn--; st.spawns++; spawnsSinceSkill++;
    sendAct('spawn'); SFX.play('spawn'); vib(60);
    if (spawnsSinceSkill >= 3) { spawnsSinceSkill = 0; skillCharges = Math.min(3, skillCharges + 1); SFX.play('skillready'); vib([40, 30, 40, 30, 150]); toast('💥 ได้สกิลพิเศษ! กดใช้ได้เลยหรือเก็บไว้จังหวะเด็ด'); }
    renderProgress(); pushStats();
  }
  function doSkill() {
    if (skillCharges <= 0 || phase !== 'play') return;
    skillCharges--; st.skills++;
    sendAct('skill'); SFX.play(['laserstorm', 'swarm', 'megablast', 'wave'][me.team] || 'megablast'); vib([100, 50, 200]);
    toast('💥 ' + T[me.team].skill + '!');
    renderProgress(); pushStats();
  }

  // ---------------- สถานะจากจอครู (มินิบอร์ด) ----------------
  function renderState() {
    if (!state || phase !== 'play') return;
    const sec = Math.max(0, Math.ceil(state.left / 1000));
    $('p-time').innerHTML = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0') + '<small>TIME LEFT</small>';
    $('p-time').style.color = sec <= 30 ? 'var(--bad)' : '';
    const counts = state.counts || [], painted = counts.reduce((a, b) => a + b, 0);
    counts.forEach((c, k) => { const el = $('mb' + k); if (el) el.style.width = (painted ? c / painted * 100 : 100 / counts.length) + '%'; });
    const cv = $('mini'), c = cv.getContext('2d'); const b = state.board || ''; const cw = cv.width / Engine.COLS, chh = cv.height / Engine.ROWS;
    c.fillStyle = '#08090b'; c.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < b.length; i++) { const ch = b[i]; if (ch === '.') continue; const up = ch < 'a'; const k = ch.charCodeAt(0) - (up ? 65 : 97); c.globalAlpha = up ? 1 : 0.5; c.fillStyle = T[k].color; c.fillRect((i % Engine.COLS) * cw, Math.floor(i / Engine.COLS) * chh, cw + 0.5, chh + 0.5); }
    c.globalAlpha = 1;
    if (state.fx && me && me.team != null) {
      if (state.fx.frozen && state.fx.frozen[me.team]) { c.fillStyle = 'rgba(150,220,255,.35)'; c.fillRect(0, 0, cv.width, cv.height); }
    }
    if (sec === 0 && state.left === 0) stopQuestion();
  }

  // ---------------- ผลส่วนตัว ----------------
  function renderEnd(res) {
    const w = T[res.winner]; $('e-win').textContent = 'ทีม' + w.th; $('e-win').style.color = w.color;
    const p = res.personal && res.personal[pid];
    if (!p) { $('e-me').innerHTML = '<p class="muted">ไม่มีข้อมูลของคุณในรอบนี้</p>'; return; }
    const mine = me && me.team === res.winner;
    let h = `<div class="card" style="text-align:center"><span class="label">${mine ? 'YOUR TEAM WON' : 'GOOD GAME'}</span><div class="display" style="font-size:3.2rem;margin:6px 0">#${p.rank}<span class="muted" style="font-size:1.1rem;font-weight:600"> / ${Object.keys(res.personal).length}</span></div><span class="tag">${p.points} PTS</span></div>`;
    h += `<div class="stats"><div><b>${p.correct}/${p.answered}</b><span>CORRECT</span></div><div><b>${p.bestStreak}</b><span>STREAK</span></div><div><b>${p.spawns}</b><span>SPAWNS</span></div><div><b>${p.skills}</b><span>SKILLS</span></div><div><b>${p.captured}</b><span>CELLS</span></div><div><b>${p.locked}</b><span>LOCKED</span></div></div>`;
    for (const a of p.awards) h += `<div class="aw gold pop"><div class="em">${a.emoji}</div><div><span class="label" style="color:var(--accent)">AWARD</span><div class="display" style="font-size:1.3rem;font-weight:800">${a.name}</div><div class="muted">${esc(a.value)}</div></div></div>`;
    if (p.badge) h += `<div class="aw"><div class="em">${p.badge.emoji}</div><div><span class="label">BADGE</span><div class="display" style="font-size:1.2rem;font-weight:700">${p.badge.name}</div><div class="muted">${esc(p.badge.desc)}</div></div></div>`;
    $('e-me').innerHTML = h;
    if (p.awards.length) { SFX.play('win'); vib([80, 40, 80, 40, 200]); } else SFX.play('award');
  }

  // ---------------- เริ่ม ----------------
  function boot() {
    Net.init(); initJoin();
    const m = location.hash.match(/^#p(\d{6})$/);
    if (m) { code = m[1]; R = 'cw/' + code; pid = store.getItem(KEY()); name = localStorage.getItem('cw-name') || '';
      if (pid && name) Net.ready().then(() => Net.once(R + '/players/' + pid)).then(p => { if (p) { me = p; bind(); } else { location.hash = ''; $('j-code').value = code; } });
    }
  }
  boot();
  return {};
})();
