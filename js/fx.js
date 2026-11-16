// ============================================================
// FX — ตัวเรนเดอร์กระดาน (สร้างได้หลายอัน: จอครู / ฉากหน้าแรก)
//   FX.create(canvas, { stage, labels:true, cutins:true, fit:'contain'|'cover', bloom:true, sound:true })
//   .consume(events)  .draw(S, now)  .resize()  .flash(color,a)  .shake(v)
// เลเยอร์: พื้น → กระเบื้อง (สไปรต์แคช) → คลื่น/โล่ → หางแสง → ตัวละคร → เลเซอร์/วง → อนุภาค → bloom → แฟลช
// ป้ายชื่อคนปล่อย + คัตอินสกิล เป็น DOM ซ้อนบนแคนวาส (คมชัดทุกขนาดจอ)
// ============================================================
const FX = (() => {
  const E = () => window.Engine;
  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SKILL_EN = ['LASER STORM', 'SWARM', 'MEGA BLAST', 'TIDAL WAVE'];
  const play = (o, name) => { if (o.sound !== false && window.SFX) SFX.play(name); };

  function create(canvas, opts) {
    opts = Object.assign({ labels: true, cutins: true, fit: 'contain', bloom: true, sound: true }, opts || {});
    const cv = canvas, cx = cv.getContext('2d');
    const stage = opts.stage || cv.parentElement;
    let W = 0, H = 0, cell = 10, dpr = 1, ox = 0, oy = 0, BW = 0, BH = 0;
    let effects = [], particles = [], trails = new Map(), labels = [], cutQ = [], cutBusy = false;
    let shake = 0, flash = { a: 0, color: '#fff' }, nowMs = 0;
    let bgCache = null, tiles = [];
    const glow = document.createElement('canvas'), gx = glow.getContext('2d');
    const glow2 = document.createElement('canvas'), g2 = glow2.getContext('2d');
    const GS = 0.25; // ความละเอียดชั้นแสง

    // ชั้น DOM สำหรับป้ายชื่อ/คัตอิน
    let labelLayer = null, cutLayer = null;
    if (opts.labels) { labelLayer = document.createElement('div'); labelLayer.className = 'fx-labels'; stage.appendChild(labelLayer); }
    if (opts.cutins) { cutLayer = document.createElement('div'); cutLayer.className = 'fx-cutins'; stage.appendChild(cutLayer); }

    const team = (k) => E().TEAMS[k];

    function resize() {
      const COLS = E().COLS, ROWS = E().ROWS;
      const box = stage.getBoundingClientRect();
      W = Math.max(50, box.width); H = Math.max(50, box.height);
      cell = opts.fit === 'cover' ? Math.max(W / COLS, H / ROWS) : Math.min(W / COLS, H / ROWS);
      BW = COLS * cell; BH = ROWS * cell; ox = (W - BW) / 2; oy = (H - BH) / 2;
      dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr || 2);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      glow.width = Math.max(1, Math.round(W * GS)); glow.height = Math.max(1, Math.round(H * GS));
      glow2.width = glow.width; glow2.height = glow.height;
      buildCaches();
    }

    // ---------- สไปรต์แคช ----------
    function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
    function buildCaches() {
      const COLS = E().COLS, ROWS = E().ROWS;
      // พื้นหลังกระดาน
      bgCache = mk(W * dpr, H * dpr); const b = bgCache.getContext('2d'); b.scale(dpr, dpr);
      b.fillStyle = '#060709'; b.fillRect(0, 0, W, H);
      b.fillStyle = '#0c0d11'; b.fillRect(ox, oy, BW, BH);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        b.fillStyle = (r + c) % 2 ? '#101217' : '#0e1014';
        b.fillRect(ox + c * cell + 0.5, oy + r * cell + 0.5, cell - 1, cell - 1);
      }
      const vg = b.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); b.fillStyle = vg; b.fillRect(0, 0, W, H);
      if (opts.fit !== 'cover') { b.strokeStyle = 'rgba(255,255,255,.08)'; b.lineWidth = 1; b.strokeRect(ox - 0.5, oy - 0.5, BW + 1, BH + 1); }
      // กระเบื้องต่อทีม: [ทา, ล็อก, ล็อกร้าว1, ล็อกร้าว2]
      const s = Math.ceil(cell * dpr);
      tiles = E().TEAMS.map(T => {
        const paint = mk(s, s), p = paint.getContext('2d');
        p.fillStyle = T.color; p.fillRect(s * 0.06, s * 0.06, s * 0.88, s * 0.88);
        p.fillStyle = 'rgba(255,255,255,.16)'; p.fillRect(s * 0.06, s * 0.06, s * 0.88, s * 0.2);
        const lock = mk(s, s), l = lock.getContext('2d');
        l.fillStyle = T.dark; l.fillRect(0, 0, s, s);
        l.fillStyle = T.color; l.fillRect(s * 0.06, s * 0.06, s * 0.88, s * 0.88);
        const g = l.createLinearGradient(0, 0, s, s); g.addColorStop(0, 'rgba(255,255,255,.38)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.28)');
        l.fillStyle = g; l.fillRect(s * 0.06, s * 0.06, s * 0.88, s * 0.88);
        l.fillStyle = 'rgba(0,0,0,.25)'; l.fillRect(s * 0.36, s * 0.36, s * 0.28, s * 0.28);
        l.fillStyle = 'rgba(255,255,255,.55)'; l.fillRect(s * 0.42, s * 0.42, s * 0.16, s * 0.16);
        // เกราะเสียหาย: ไม่วาดรอยร้าวเป็นเส้น (ดูเหมือนตัวอักษร) แต่หรี่สี + ขอบด้านในบางลง
        const crack = (n) => { const k = mk(s, s), q = k.getContext('2d'); q.drawImage(lock, 0, 0); q.fillStyle = `rgba(0,0,0,${n > 1 ? 0.38 : 0.2})`; q.fillRect(s * 0.06, s * 0.06, s * 0.88, s * 0.88); return k; };
        return { paint, lock, crack1: crack(1), crack2: crack(2) };
      });
    }

    // ---------- ตัวช่วยเอฟเฟกต์ ----------
    function burst(x, y, color, n, speed, life, size) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = (0.3 + Math.random()) * speed;
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, t0: nowMs, life: life * (0.6 + Math.random() * 0.6), size: size * (0.5 + Math.random()), g: 1 });
      }
    }
    function doShake(v) { shake = Math.max(shake, v); }
    function doFlash(color, a) { flash = { color, a: Math.max(flash.a, a) }; }
    function punch(k) { if (cv.animate) cv.animate([{ transform: `scale(${1 + k})` }, { transform: 'scale(1)' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' }); }

    // ---------- ป้ายชื่อตัวใหญ่ ณ จุดปล่อย (โชว์ ~3 วิ) ----------
    const LABEL_MS = 3000;
    function spawnLabel(e) {
      if (!labelLayer || !e.name) return;
      const T = team(e.team);
      let px = ox + e.x * cell, py = oy + e.y * cell;
      const el = document.createElement('div'); el.className = 'spawn-tag';
      const fs = Math.max(20, Math.min(46, cell * 1.35));
      el.style.setProperty('--tc', T.color); el.style.setProperty('--fs', fs + 'px');
      el.innerHTML = `<div class="st-pill"><span class="st-name">${esc(e.name)}</span><span class="st-meta">${T.hero}${e.boost ? ' ▲' : ''}</span></div><div class="st-stem"></div>`;
      labelLayer.appendChild(el);
      const w = el.offsetWidth, h = el.offsetHeight;
      // หลบป้ายที่ยังโชว์อยู่ (เลื่อนขึ้นทีละขั้น)
      let lx = Math.max(6, Math.min(W - w - 6, px - w / 2)), ly = py - h;
      const live = labels.filter(l => nowMs - l.t0 < LABEL_MS);
      for (let tries = 0; tries < 6; tries++) {
        const hit = live.find(l => lx < l.x + l.w + 6 && lx + w + 6 > l.x && ly < l.y + l.h + 4 && ly + h + 4 > l.y);
        if (!hit) break;
        ly = hit.y - h - 4;
      }
      if (ly < 4) ly = Math.min(H - h - 4, py + 16); // ชิดขอบบนเกิน → ไปไว้ใต้จุดแทน
      el.style.left = lx + 'px'; el.style.top = ly + 'px';
      el.querySelector('.st-stem').style.left = Math.max(10, Math.min(w - 10, px - lx)) + 'px';
      el.querySelector('.st-stem').style.height = Math.max(0, py - (ly + h)) + 'px';
      labels.push({ el, t0: nowMs, x: lx, y: ly, w, h });
      setTimeout(() => { el.remove(); labels = labels.filter(l => l.el !== el); }, LABEL_MS + 50);
      // จำกัดจำนวนป้ายพร้อมกัน
      if (labelLayer.children.length > 10) { labelLayer.firstChild.remove(); labels.shift(); }
    }

    // ---------- คัตอินสกิล (แถบทแยงเต็มจอ) ----------
    function cutin(c) {
      if (!cutLayer) return;
      cutQ.push(c); if (cutQ.length > 3) cutQ.splice(0, cutQ.length - 3);
      if (!cutBusy) nextCut();
    }
    function nextCut() {
      const c = cutQ.shift(); if (!c) { cutBusy = false; return; }
      cutBusy = true;
      const T = team(c.team);
      const el = document.createElement('div'); el.className = 'cutin ' + (c.small ? 'small' : '');
      el.style.setProperty('--tc', T.color); el.style.setProperty('--td', T.dark);
      el.innerHTML = `<div class="ci-band"><div class="ci-stripes"></div></div>
        <canvas class="ci-portrait"></canvas>
        <div class="ci-text"><div class="ci-en">${esc(c.en || '')}</div><div class="ci-title">${esc(c.title)}</div><div class="ci-who"><b>${esc(c.name || '')}</b>${c.sub ? ' • ' + esc(c.sub) : ''}</div></div>`;
      cutLayer.appendChild(el);
      const pc = el.querySelector('.ci-portrait'); if (window.Art) requestAnimationFrame(() => Art.portrait(pc, c.team, { scale: 0.34, t: nowMs }));
      const dur = c.small ? 1500 : (cutQ.length ? 1300 : 1700);
      el.style.setProperty('--dur', dur + 'ms');
      setTimeout(() => { el.remove(); nextCut(); }, dur);
    }

    // ---------- แปลงเหตุการณ์เอนจิน → ภาพ + เสียง ----------
    function consume(events) {
      for (const e of events) {
        const T = e.team != null ? team(e.team) : null;
        switch (e.type) {
          case 'spawn':
            effects.push({ kind: 'beam', x: e.x, y: e.y, color: T.color, t0: nowMs, dur: 520 });
            effects.push({ kind: 'ring', x: e.x, y: e.y, color: T.color, t0: nowMs + 120, dur: 650, r: 4.5 });
            effects.push({ kind: 'ring', x: e.x, y: e.y, color: '#ffffff', t0: nowMs + 220, dur: 500, r: 2.6 });
            setTimeout(() => burst(e.x, e.y, T.color, 30, 11, 700, 0.24), 120);
            spawnLabel(e);
            play(opts, 'spawn'); doShake(3);
            break;
          case 'laser': effects.push({ kind: 'laser', segs: e.segs, color: T.color, t0: nowMs, dur: 420, w: 0.2 }); for (let i = 0; i < e.segs.length - 1; i++) burst(e.segs[i][2], e.segs[i][3], T.color, 5, 6, 300, 0.14); play(opts, 'laser'); break;
          case 'blast': effects.push({ kind: 'ring', x: e.x, y: e.y, color: T.color, t0: nowMs, dur: 380, r: e.radius + 1, w: 4 }); effects.push({ kind: 'glowdot', x: e.x, y: e.y, color: T.color, t0: nowMs, dur: 260, r: e.radius + 1 }); burst(e.x, e.y, T.color, 8, 7, 350, 0.16); play(opts, 'blast'); break;
          case 'split': burst(e.x, e.y, T.color, 7, 5, 400, 0.14); effects.push({ kind: 'ring', x: e.x, y: e.y, color: T.color, t0: nowMs, dur: 300, r: 1.4 }); play(opts, 'split'); break;
          case 'lock': if (Math.random() < 0.18) burst(e.c + 0.5, e.r + 0.5, '#ffffff', 2, 2.5, 380, 0.1); play(opts, 'lock'); break;
          case 'crack': play(opts, 'crack'); break;
          case 'break': if (Math.random() < 0.3) burst(e.c + 0.5, e.r + 0.5, team(e.prev).color, 5, 6, 450, 0.16); play(opts, 'break'); break;
          case 'bite': if (Math.random() < 0.6) { burst(e.x, e.y, '#ffffff', 4, 6, 260, 0.12); effects.push({ kind: 'glowdot', x: e.x, y: e.y, color: '#ffffff', t0: nowMs, dur: 160, r: 0.9 }); } play(opts, 'bite'); break;
          case 'die': burst(e.x, e.y, T.color, e.kind === 'hero' ? 22 : 4, e.kind === 'hero' ? 7 : 4, 600, 0.17); if (e.kind === 'hero') { effects.push({ kind: 'ring', x: e.x, y: e.y, color: T.color, t0: nowMs, dur: 420, r: 2.2 }); play(opts, 'die'); } break;
          case 'skill': {
            doShake(e.kind === 'megablast' ? 22 : 13); doFlash(T.color, e.kind === 'megablast' ? 0.55 : 0.35); punch(e.kind === 'megablast' ? 0.045 : 0.03);
            cutin({ team: e.team, title: T.skill, en: SKILL_EN[e.team], name: e.name, sub: 'ทีม' + T.th });
            if (e.kind === 'laserstorm') { for (const segs of e.rays) effects.push({ kind: 'laser', segs, color: T.color, t0: nowMs, dur: 1000, w: 0.42 }); effects.push({ kind: 'shock', x: e.x, y: e.y, color: T.color, t0: nowMs, dur: 700, r: 8 }); burst(e.x, e.y, T.color, 80, 16, 900, 0.26); play(opts, 'laserstorm'); }
            else if (e.kind === 'swarm') { for (const [x, y] of e.pts) { effects.push({ kind: 'beam', x, y, color: T.color, t0: nowMs + Math.random() * 250, dur: 450 }); burst(x, y, T.color, 10, 7, 600, 0.16); } play(opts, 'swarm'); }
            else if (e.kind === 'megablast') { effects.push({ kind: 'shock', x: e.x, y: e.y, color: T.color, t0: nowMs, dur: 1200, r: e.radius + 4 }); effects.push({ kind: 'glowdot', x: e.x, y: e.y, color: '#ffffff', t0: nowMs, dur: 420, r: e.radius * 0.9 }); burst(e.x, e.y, T.color, 150, 22, 1300, 0.32); burst(e.x, e.y, '#ffffff', 50, 12, 900, 0.22); play(opts, 'megablast'); }
            else if (e.kind === 'wave') { effects.push({ kind: 'wave', r0: e.r0, r1: e.r1, dir: e.dir, color: T.color, t0: nowMs, dur: E().COLS / 60 * 1000 + 200 }); play(opts, 'wave'); }
            break;
          }
          case 'universal': {
            const U = E().UNIVERSAL[e.kind];
            cutin({ team: e.team, title: U.name, en: e.kind === 'freeze' ? 'FREEZE' : 'QUICK LOCK', name: e.name, sub: 'ทีม' + T.th, small: true });
            if (e.kind === 'freeze') { effects.push({ kind: 'freeze', t0: nowMs, dur: U.dur, team: e.team }); doFlash('#bfe9ff', 0.55); }
            else if (e.kind === 'shield') effects.push({ kind: 'shield', t0: nowMs, dur: U.dur, team: e.team, color: T.color });
            play(opts, e.kind); doShake(6);
            break;
          }
          case 'combo': cutin({ team: e.team, title: 'คอมโบทีม!', en: 'TEAM COMBO', name: (e.names || []).slice(-3).join(' • '), sub: 'เร่งเครื่อง 6 วิ', small: true }); play(opts, 'combo'); doShake(7); doFlash(T.color, 0.25); break;
          case 'instantwin': doShake(24); doFlash('#ffffff', 0.9); break;
        }
      }
    }

    // ---------- วาดทั้งเฟรม ----------
    function draw(S, now) {
      nowMs = now;
      const COLS = E().COLS, ROWS = E().ROWS, t = S.t, LMS = E().LOCK_MS;
      const P = (x) => ox + x * cell;
      const Q = (y) => oy + y * cell;
      cx.save();
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (shake > 0.3) { cx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake); shake *= 0.86; } else shake = 0;
      cx.drawImage(bgCache, 0, 0, W, H);

      // ---- กระเบื้อง ----
      const sz = cell;
      for (let i = 0, N = COLS * ROWS; i < N; i++) {
        const o = S.owner[i]; if (o < 0) continue;
        const c = i % COLS, r = (i / COLS) | 0, x = ox + c * cell, y = oy + r * cell;
        const tl = tiles[o]; const age = t - S.held[i];
        if (S.locked[i]) {
          const a = S.armor[i];
          cx.drawImage(a >= E().ARMOR - 1 ? tl.lock : a === 2 ? tl.crack1 : tl.crack2, x, y, sz, sz);
          const since = age - LMS; // ประกายตอนเพิ่งล็อก
          if (since >= 0 && since < 320) { cx.fillStyle = `rgba(255,255,255,${0.55 * (1 - since / 320)})`; cx.fillRect(x, y, sz, sz); }
        } else {
          const hold = Math.min(1, age / LMS);
          if (age < 240) { // เด้งตอนยึด
            const k = age / 240, s = sz * (0.35 + 0.75 * k - 0.1 * Math.sin(k * Math.PI));
            cx.globalAlpha = 0.95; cx.drawImage(tl.paint, x + (sz - s) / 2, y + (sz - s) / 2, s, s);
            cx.fillStyle = `rgba(255,255,255,${0.5 * (1 - k)})`; cx.fillRect(x + (sz - s) / 2, y + (sz - s) / 2, s, s);
          } else {
            cx.globalAlpha = 0.42 + hold * 0.4; cx.drawImage(tl.paint, x, y, sz, sz);
            if (hold > 0.6) { cx.globalAlpha = (hold - 0.6) * 2; cx.fillStyle = '#fff'; cx.fillRect(x + sz * 0.42, y + sz * 0.42, sz * 0.16, sz * 0.16); }
          }
          cx.globalAlpha = 1;
        }
      }

      // ---- เอฟเฟกต์ชั้นล่าง ----
      effects = effects.filter(e => now - e.t0 < e.dur);
      for (const e of effects) {
        const p = (now - e.t0) / e.dur; if (p < 0) continue;
        if (e.kind === 'wave') {
          const x = P((e.dir > 0 ? p : 1 - p) * COLS), y0 = Q(e.r0), hh = (e.r1 - e.r0 + 1) * cell, len = cell * 9;
          const g = cx.createLinearGradient(x - len * e.dir, 0, x, 0); g.addColorStop(0, hexA(e.color, 0)); g.addColorStop(1, hexA(e.color, 0.9));
          cx.fillStyle = g; cx.fillRect(Math.min(x, x - len * e.dir), y0 - cell * 0.6, len, hh + cell * 1.2);
          cx.fillStyle = '#fff'; cx.fillRect(x - 3, y0 - cell * 0.6, 6, hh + cell * 1.2);
          if (Math.random() < 0.8) burst((x - ox) / cell, e.r0 + Math.random() * (e.r1 - e.r0 + 1), Math.random() < 0.5 ? '#ffffff' : e.color, 3, 6, 450, 0.16);
        } else if (e.kind === 'freeze') {
          cx.fillStyle = `rgba(150,215,255,${0.14 * (1 - p)})`; cx.fillRect(ox, oy, BW, BH);
          if (Math.random() < 0.6) particles.push({ x: Math.random() * COLS, y: -1, vx: (Math.random() - 0.5) * 0.6, vy: 3, color: '#e8f8ff', t0: now, life: 3000, size: 0.14, g: 0 });
        } else if (e.kind === 'shield') {
          cx.strokeStyle = hexA(e.color, 0.45 + 0.35 * Math.sin(now / 90)); cx.lineWidth = Math.max(4, cell * 0.3); cx.strokeRect(ox + 3, oy + 3, BW - 6, BH - 6);
        }
      }

      // ---- หางแสงตัวละคร ----
      const alive = new Set();
      cx.globalCompositeOperation = 'lighter'; cx.lineCap = 'round';
      for (const u of S.units) {
        alive.add(u.id);
        let tr = trails.get(u.id); if (!tr) { tr = []; trails.set(u.id, tr); }
        const last = tr[tr.length - 1];
        if (!last || Math.abs(last[0] - u.x) + Math.abs(last[1] - u.y) > 0.18) { tr.push([u.x, u.y]); if (tr.length > (u.kind === 'hero' ? 16 : 7)) tr.shift(); }
        if (tr.length < 2) continue;
        const col = team(u.team).color, wmax = u.r * cell * (u.team === 3 && u.kind === 'hero' ? 2.2 : 1.3);
        for (let k = 1; k < tr.length; k++) {
          const f = k / tr.length;
          cx.strokeStyle = hexA(col, 0.32 * f); cx.lineWidth = wmax * f;
          cx.beginPath(); cx.moveTo(P(tr[k - 1][0]), Q(tr[k - 1][1])); cx.lineTo(P(tr[k][0]), Q(tr[k][1])); cx.stroke();
        }
      }
      cx.globalCompositeOperation = 'source-over';
      if (trails.size > alive.size + 20) for (const id of trails.keys()) if (!alive.has(id)) trails.delete(id);

      // ---- ตัวละคร ----
      for (const u of S.units) {
        const frozen = t < S.frozenUntil[u.team];
        const fade = Math.max(0, Math.min(1, (u.life - (t - u.born)) / 1500));
        cx.globalAlpha = 0.3 + 0.7 * fade;
        const spawnK = Math.min(1, (t - u.born) / 260); // ตกลงมาแล้วเด้ง
        const sc = spawnK < 1 ? 0.4 + 0.75 * spawnK - 0.15 * Math.sin(spawnK * Math.PI) : 1;
        const rr = u.r * cell * (u.kind === 'hero' ? 1.25 : 1.15) * sc;
        Art.hero(cx, u.team, P(u.x), Q(u.y), rr, { t: now + u.id * 37, ang: Math.atan2(u.vy, u.vx), child: u.kind === 'child', frozen, cd: u.team === 2 ? Math.max(0, 1 - u.cd / 1400) : null });
        if (u.kind === 'hero' && u.hp < u.maxHp) { // แถบเลือด
          const w = rr * 2.2; cx.fillStyle = 'rgba(0,0,0,.6)'; cx.fillRect(P(u.x) - w / 2, Q(u.y) - rr - 9, w, 4); cx.fillStyle = team(u.team).color; cx.fillRect(P(u.x) - w / 2, Q(u.y) - rr - 9, w * Math.max(0, u.hp / u.maxHp), 4);
        }
        if (u.boost && u.kind === 'hero') { cx.fillStyle = '#d7f36a'; cx.font = `700 ${Math.max(9, cell * 0.6)}px Silkscreen, monospace`; cx.textAlign = 'center'; cx.fillText('▲', P(u.x), Q(u.y) - rr - 12); }
        cx.globalAlpha = 1;
      }

      // ---- เลเซอร์ / วง / ลำแสงปล่อย ----
      for (const e of effects) {
        const p = (now - e.t0) / e.dur; if (p < 0) continue;
        if (e.kind === 'laser') {
          cx.lineCap = 'round'; cx.globalCompositeOperation = 'lighter';
          cx.strokeStyle = hexA(e.color, 0.9 * (1 - p)); cx.lineWidth = e.w * cell * (1 - p * 0.5) + 3;
          cx.beginPath(); for (const [x0, y0, x1, y1] of e.segs) { cx.moveTo(P(x0), Q(y0)); cx.lineTo(P(x1), Q(y1)); } cx.stroke();
          cx.strokeStyle = `rgba(255,255,255,${1 - p})`; cx.lineWidth = Math.max(1.5, e.w * cell * 0.35); cx.stroke();
          cx.globalCompositeOperation = 'source-over';
        } else if (e.kind === 'ring') {
          const ease = 1 - Math.pow(1 - p, 3);
          cx.strokeStyle = hexA(e.color, 1 - p); cx.lineWidth = (e.w || 3) * (1 - p) + 1;
          cx.beginPath(); cx.arc(P(e.x), Q(e.y), e.r * cell * ease, 0, Math.PI * 2); cx.stroke();
        } else if (e.kind === 'shock') {
          for (let k = 0; k < 3; k++) {
            const pp = Math.max(0, p - k * 0.1), ease = 1 - Math.pow(1 - pp, 3);
            cx.strokeStyle = hexA(k === 1 ? '#ffffff' : e.color, (1 - pp) * 0.95); cx.lineWidth = cell * 0.9 * (1 - pp) + 2;
            cx.beginPath(); cx.arc(P(e.x), Q(e.y), e.r * cell * ease, 0, Math.PI * 2); cx.stroke();
          }
        } else if (e.kind === 'beam') { // ลำแสงตกจากฟ้า → กระแทก
          const k = Math.min(1, p / 0.35), fade = p < 0.35 ? 1 : 1 - (p - 0.35) / 0.65;
          const x = P(e.x), y = Q(e.y), w = cell * (1.1 - 0.6 * k);
          const g = cx.createLinearGradient(0, oy, 0, y); g.addColorStop(0, hexA(e.color, 0)); g.addColorStop(1, hexA(e.color, 0.85 * fade));
          cx.globalCompositeOperation = 'lighter';
          cx.fillStyle = g; cx.fillRect(x - w, oy, w * 2, (y - oy) * k);
          cx.fillStyle = `rgba(255,255,255,${0.8 * fade})`; cx.fillRect(x - w * 0.22, oy + (y - oy) * Math.max(0, k - 0.4), w * 0.44, (y - oy) * Math.min(k, 0.4) + 1);
          cx.globalCompositeOperation = 'source-over';
        }
      }

      // ---- อนุภาค (สี่เหลี่ยมพิกเซล) ----
      particles = particles.filter(q => now - q.t0 < q.life);
      if (particles.length > 1400) particles.splice(0, particles.length - 1400);
      cx.globalCompositeOperation = 'lighter';
      for (const q of particles) {
        q.x += q.vx * 0.016; q.y += q.vy * 0.016; q.vy += 7 * 0.016 * q.g; q.vx *= 0.97; q.vy *= 0.97;
        const a = 1 - (now - q.t0) / q.life, s = q.size * cell;
        cx.fillStyle = hexA(q.color, a); cx.fillRect(P(q.x) - s / 2, Q(q.y) - s / 2, s, s);
      }
      cx.globalCompositeOperation = 'source-over';

      // ---- BLOOM: วาดแหล่งแสงลงแคนวาสเล็ก แล้วเบลอ ซ้อนแบบ lighter ----
      if (opts.bloom) {
        gx.setTransform(GS, 0, 0, GS, 0, 0); gx.clearRect(0, 0, W, H);
        gx.globalCompositeOperation = 'lighter';
        // แสงรอบตัวละครเป็นวงแหวน (ไม่ทับตัว) เพื่อให้หน้าตาตัวละครยังชัด
        gx.lineWidth = cell * 0.55;
        for (const u of S.units) { const c = team(u.team).color; gx.strokeStyle = hexA(c, u.kind === 'hero' ? 0.7 : 0.35); gx.beginPath(); gx.arc(P(u.x), Q(u.y), u.r * cell * (u.kind === 'hero' ? 1.75 : 1.3), 0, 7); gx.stroke(); }
        for (const e of effects) {
          const p = (now - e.t0) / e.dur; if (p < 0) continue;
          if (e.kind === 'laser') { gx.strokeStyle = hexA(e.color, 1 - p); gx.lineWidth = e.w * cell * 3 + 6; gx.lineCap = 'round'; gx.beginPath(); for (const [x0, y0, x1, y1] of e.segs) { gx.moveTo(P(x0), Q(y0)); gx.lineTo(P(x1), Q(y1)); } gx.stroke(); }
          else if (e.kind === 'glowdot') { gx.fillStyle = hexA(e.color, 1 - p); gx.beginPath(); gx.arc(P(e.x), Q(e.y), e.r * cell * (1 + p), 0, 7); gx.fill(); }
          else if (e.kind === 'shock' || e.kind === 'ring') { gx.strokeStyle = hexA(e.color, (1 - p) * 0.9); gx.lineWidth = cell * (e.kind === 'shock' ? 2.4 : 1) * (1 - p); gx.beginPath(); gx.arc(P(e.x), Q(e.y), e.r * cell * (1 - Math.pow(1 - p, 3)), 0, 7); gx.stroke(); }
          else if (e.kind === 'beam') { gx.fillStyle = hexA(e.color, 0.9 * (1 - p)); gx.fillRect(P(e.x) - cell * 1.5, oy, cell * 3, Q(e.y) - oy); }
          else if (e.kind === 'wave') { const x = P((e.dir > 0 ? p : 1 - p) * COLS); gx.fillStyle = hexA(e.color, 0.9); gx.fillRect(x - cell * 2, Q(e.r0) - cell, cell * 4, (e.r1 - e.r0 + 3) * cell); }
        }
        gx.globalCompositeOperation = 'source-over';
        g2.clearRect(0, 0, glow2.width, glow2.height); g2.filter = 'blur(5px)'; g2.drawImage(glow, 0, 0); g2.filter = 'none';
        cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 0.75;
        cx.drawImage(glow2, 0, 0, W, H); cx.globalAlpha = 0.35; cx.drawImage(glow, 0, 0, W, H);
        cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
      }

      if (flash.a > 0.01) { cx.fillStyle = hexA(flash.color, flash.a); cx.fillRect(0, 0, W, H); flash.a *= 0.86; }
      cx.restore();
    }

    resize();
    // ปรับขนาดตามกล่องจริง (ไม่ใช่แค่หน้าต่าง) — HUD/เต็มจอ/แถบเลื่อน เปลี่ยนขนาดได้ทุกเมื่อ
    let rzT = null;
    const onR = () => { clearTimeout(rzT); rzT = setTimeout(() => { const b = stage.getBoundingClientRect(); if (Math.abs(b.width - W) > 1 || Math.abs(b.height - H) > 1) resize(); }, 60); };
    window.addEventListener('resize', onR);
    const ro = window.ResizeObserver ? new ResizeObserver(onR) : null; if (ro) ro.observe(stage);
    return {
      consume, draw, resize, flash: doFlash, shake: doShake, cutin,
      destroy() { window.removeEventListener('resize', onR); ro && ro.disconnect(); labelLayer && labelLayer.remove(); cutLayer && cutLayer.remove(); },
      geom: () => ({ W, H, cell, ox, oy }),
    };
  }

  return { create };
})();
