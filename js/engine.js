// ============================================================
// Engine — เอนจิน "สงครามสี" (ทำงานทั้งในเบราว์เซอร์และ Node สำหรับทดสอบบาลานซ์)
// กระดาน COLS×ROWS ช่อง, ตัวละครวิ่งชนกำแพงเด้ง ทาสีช่องที่ผ่าน
// ถือช่องครบ LOCK_MS → ล็อก (เกราะ 3) ศัตรูต้องทุบ 3 ครั้งถึงแย่งคืนได้
// ============================================================
(function (root) {
  const COLS = 64, ROWS = 36, N = COLS * ROWS;
  const LOCK_MS = 5000, FAST_LOCK_MS = 2000, ARMOR = 4;
  const CHILD_PAINT_P = 0.35;    // ลูกแตก "แทะ" ทาสีแค่บางช่องที่ผ่าน (หน้าที่หลักคือกัด)
  const TEAM_CAP = 22;           // ตัวละครสูงสุดต่อทีม (รวมตัวแตก)
  const HERO = { r: 0.62, speed: 7, life: 22000, hp: 10 };
  const CHILD = { r: 0.36, speed: 10, life: 6000, hp: 2 };
  const INSTANT_WIN_FRAC = 0.65; // ล็อก ≥ 65% ของกระดาน = ชนะขาด (หลังผ่านครึ่งเกมแล้วเท่านั้น)
  // ค่าจูนบาลานซ์ (แก้ที่เดียว — test/power.js และ test/fair.js ใช้ชุดนี้)
  const TUNE = {
    kidsPerHero: 3, childPaintP: 0.35, splitCd: 3000,
    ricochetCd: 1300, ricochetLen: 14, ricochetBounces: 2, ricochetPower: 2,
    blasterCd: 1400, blasterPower: 2, blasterSpeed: 1.12,
    surgerWide: true, surgerSpeed: 0.8,
    heroBite: 1, childBite: 1,
    swarmLife: 9000, swarmPower: 4, swarmPaintP: 0.32, megaRadius: 11, waveRows: 2,
  };

  const TEAMS = [
    { id: 0, key: 'crimson', name: 'CRIMSON', th: 'คริมสัน', color: '#ff2d55', dark: '#8a0f2a', hero: 'Ricochet', heroTh: 'ริโคเชต์', heroDesc: 'ทุกครั้งที่ยึดช่อง ยิงเลเซอร์เด้งกำแพง', skill: 'พายุเลเซอร์', skillDesc: 'ยิงเลเซอร์ 10 ทิศ เด้งกำแพง 3 ครั้ง ทะลุช่องล็อก', emoji: '🔴' },
    { id: 1, key: 'magenta', name: 'MAGENTA', th: 'มาเจนตา', color: '#e040fb', dark: '#6a1280', hero: 'Splitter', heroTh: 'สปลิตเตอร์', heroDesc: 'แตกตัวเป็นชิ้นเล็กที่กัดศัตรูเอง', skill: 'ฝูงแตกตัว', skillDesc: 'แตกเป็น 12 ตัวกระจายทั่วกระดานทันที', emoji: '🟣' },
    { id: 2, key: 'azure', name: 'AZURE', th: 'อาซัวร์', color: '#2ec4ff', dark: '#0b4f6e', hero: 'Blaster', heroTh: 'บลาสเตอร์', heroDesc: 'ระเบิดกากบาทรอบตัวเป็นระยะ ทุบช่องล็อกได้แรง', skill: 'ระเบิดมหาประลัย', skillDesc: 'ระเบิดวงใหญ่ตรงจุดที่ศัตรูแน่นที่สุด', emoji: '🔵' },
    { id: 3, key: 'lime', name: 'LIME', th: 'ไลม์', color: '#a3ff3b', dark: '#3f6e0b', hero: 'Surger', heroTh: 'เซอร์เจอร์', heroDesc: 'ทิ้งทางสีกว้าง 3 ช่องตามเส้นทางที่วิ่ง', skill: 'คลื่นยักษ์', skillDesc: 'คลื่นกวาด 5 แถว ล้างสีศัตรูและทุบช่องล็อก', emoji: '🟢' },
  ];

  const UNIVERSAL = {
    shield: { name: 'โล่ล็อกเร็ว', desc: 'ช่องของทีมล็อกใน 2 วิ นาน 10 วิ', streak: 5, emoji: '🛡️', dur: 10000 },
    freeze: { name: 'แช่แข็ง', desc: 'ตัวละครศัตรูทั้งกระดานหยุดนิ่ง 4 วิ', streak: 8, emoji: '❄️', dur: 4000 },
    speed: { name: 'เร่งเครื่อง', desc: 'ทีมวิ่งเร็ว 2 เท่า 6 วิ (คอมโบทีม)', emoji: '⚡', dur: 6000 },
  };

  function create(opts) {
    opts = opts || {};
    const teamCount = Math.max(2, Math.min(4, opts.teams || 4));
    const rng = opts.rng || Math.random;
    const S = {
      teamCount, t: 0, rng, duration: opts.duration || 360000,
      owner: new Int8Array(N).fill(-1),
      held: new Float64Array(N),
      locked: new Uint8Array(N),
      armor: new Uint8Array(N),
      by: new Array(N).fill(null),      // pid ที่ทาช่องนี้ล่าสุด (สำหรับสถิติ)
      units: [], nextId: 1,
      events: [],
      stats: {},                         // pid → {captured, locked, skillCells, comeback}
      frozenUntil: new Float64Array(4),
      shieldUntil: new Float64Array(4),
      speedUntil: new Float64Array(4),
      spawnLog: [[], [], [], []],        // เวลาปล่อยล่าสุดของแต่ละทีม (ตรวจคอมโบ)
      comebackWatch: [],                 // {pid, team, t, before}
      counts: [0, 0, 0, 0], lockedCounts: [0, 0, 0, 0],
      lockScan: 0, ended: false, winner: -1, instantWin: false,
      names: {},                         // pid → ชื่อ (ไว้ใส่ใน event)
    };
    return S;
  }

  const idx = (c, r) => r * COLS + c;
  const inB = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS;
  function st(S, pid) {
    if (!pid) pid = '_';
    return S.stats[pid] || (S.stats[pid] = { captured: 0, locked: 0, skillCells: 0, comeback: 0, bites: 0 });
  }

  // ทาช่อง — คืน true ถ้าสีเปลี่ยน; power = แรงทุบเกราะ (1 ปกติ, 3 = สกิลพิเศษ)
  function paint(S, c, r, team, pid, power, src) {
    if (!inB(c, r)) return false;
    const i = idx(c, r);
    if (S.owner[i] === team) {
      if (S.locked[i] && S.armor[i] < ARMOR) S.armor[i] = ARMOR; // ซ่อมเกราะของตัวเอง
      return false;
    }
    if (S.locked[i]) {
      S.armor[i] = Math.max(0, S.armor[i] - (power || 1));
      if (S.armor[i] > 0) { if (S.rng() < 0.25) S.events.push({ type: 'crack', c, r, team }); return false; }
      // เกราะแตก → ปลดล็อก
      S.lockedCounts[S.owner[i]]--;
      S.locked[i] = 0;
      S.events.push({ type: 'break', c, r, team, prev: S.owner[i] });
    }
    if (S.owner[i] >= 0) S.counts[S.owner[i]]--;
    S.owner[i] = team; S.counts[team]++;
    S.held[i] = S.t; S.by[i] = pid || null;
    const ss = st(S, pid);
    ss.captured++;
    if (src === 'skill') ss.skillCells++;
    return true;
  }

  function lockMs(S, team) { return S.t < S.shieldUntil[team] ? FAST_LOCK_MS : LOCK_MS; }

  function scanLocks(S) {
    for (let i = 0; i < N; i++) {
      const o = S.owner[i];
      if (o < 0 || S.locked[i]) continue;
      if (S.t - S.held[i] >= lockMs(S, o)) {
        S.locked[i] = 1; S.armor[i] = ARMOR; S.lockedCounts[o]++;
        st(S, S.by[i]).locked++;
        S.events.push({ type: 'lock', c: i % COLS, r: (i / COLS) | 0, team: o });
      }
    }
  }

  // ---------------- ตัวละคร ----------------
  // นับแบบถ่วงน้ำหนัก: ลูกแตกตัวเล็กนับ 1/3 ตัว (ไม่งั้นมาเจนตาชนเพดานเร็วกว่าทีมอื่นจนเสียเปรียบ)
  function unitCount(S, team) { let n = 0; for (const u of S.units) if (u.team === team) n += u.kind === 'child' ? 0.34 : 1; return n; }
  function enforceCap(S, team) {
    while (unitCount(S, team) >= TEAM_CAP) {
      let victim = null;
      for (const u of S.units) if (u.team === team && u.kind === 'child' && (!victim || u.born < victim.born)) victim = u;
      if (!victim) for (const u of S.units) if (u.team === team && (!victim || u.born < victim.born)) victim = u;
      if (!victim) break;
      S.units.splice(S.units.indexOf(victim), 1);
    }
  }
  function trailing(S) { // ทีมที่มีช่องน้อยสุด (ไว้ให้โบนัสตามหลัง)
    let m = 0; for (let i = 1; i < S.teamCount; i++) if (S.counts[i] < S.counts[m]) m = i; return m;
  }
  function leading(S) { let m = 0; for (let i = 1; i < S.teamCount; i++) if (S.counts[i] > S.counts[m]) m = i; return m; }

  function addUnit(S, team, pid, kind, x, y, ang) {
    const P = kind === 'child' ? CHILD : HERO;
    const u = {
      id: S.nextId++, team, pid: pid || null, kind,
      x, y, r: P.r, speed: P.speed, life: P.life, hp: P.hp, maxHp: P.hp,
      born: S.t, cd: 0, lastCell: -1, bite: kind === 'child' ? TUNE.childBite : TUNE.heroBite,
      hitCd: {},
    };
    if (ang == null) ang = S.rng() * Math.PI * 2;
    u.vx = Math.cos(ang); u.vy = Math.sin(ang);
    // ตามทัน (rubber band): ทีมที่มีช่องน้อยกว่าผู้นำมาก ฮีโร่ใหม่จะอึดขึ้นและทุบช่องล็อกได้ไวขึ้น
    if (kind === 'hero') {
      const lead = S.counts[leading(S)] || 1, ratio = S.counts[team] / lead;
      if (ratio < 0.5) { u.hp += 3; u.maxHp += 3; u.power = 3; u.boost = true; }
      else if (ratio < 0.8) { u.hp += 2; u.maxHp += 2; u.power = 2; u.boost = true; }
    }
    S.units.push(u);
    return u;
  }

  // ปล่อยตัวละครประจำทีม (จากการตอบถูก 3 ข้อ)
  function spawn(S, team, pid, name) {
    if (S.ended) return null;
    if (name) S.names[pid] = name;
    enforceCap(S, team);
    // เกิดสุ่มทั่วกระดาน (ยุติธรรมทุกทีม — เกิดตามขอบทำให้ทีมขอบยาวได้เปรียบ) เลี่ยงจุดที่ทีมตัวเองถืออยู่แล้ว
    const m = 2; let x = 0, y = 0;
    for (let tries = 0; tries < 6; tries++) {
      x = m + S.rng() * (COLS - 2 * m); y = m + S.rng() * (ROWS - 2 * m);
      if (S.owner[idx(x | 0, y | 0)] !== team) break;
    }
    const u = addUnit(S, team, pid, 'hero', x, y, null);
    if (team === 2) u.speed *= TUNE.blasterSpeed; // Blaster วิ่งไวหน่อยชดเชยพลังทาที่น้อยกว่า
    if (team === 3) u.speed *= TUNE.surgerSpeed;
    S.events.push({ type: 'spawn', x, y, team, pid, name: S.names[pid] || '', boost: !!u.boost });
    // คอมโบทีม: 3 คนปล่อยภายใน 3 วิ → เร่งเครื่อง
    const log = S.spawnLog[team]; log.push({ t: S.t, pid });
    while (log.length && S.t - log[0].t > 3000) log.shift();
    const distinct = new Set(log.map(e => e.pid)).size;
    if (distinct >= 3 && S.t >= S.speedUntil[team]) {
      S.speedUntil[team] = S.t + UNIVERSAL.speed.dur;
      for (const v of S.units) if (v.team === team) { v.hp = Math.min(v.maxHp + 3, v.hp + 3); }
      S.events.push({ type: 'combo', team, names: log.map(e => S.names[e.pid] || '').filter(Boolean) });
      log.length = 0;
    }
    // เฝ้าดูการพลิกเกม
    if (team !== leading(S)) S.comebackWatch.push({ pid, team, t: S.t, before: S.counts[team] });
    return u;
  }

  // ---------------- สกิลพิเศษประจำทีม ----------------
  function laser(S, x, y, ang, maxLen, bounces, team, pid, power, src) {
    const segs = []; let cx = x, cy = y, dx = Math.cos(ang), dy = Math.sin(ang), len = 0;
    const step = 0.5;
    let sx = cx, sy = cy;
    while (len < maxLen) {
      cx += dx * step; cy += dy * step; len += step;
      let bounced = false;
      if (cx < 0) { cx = -cx; dx = -dx; bounced = true; } else if (cx > COLS) { cx = 2 * COLS - cx; dx = -dx; bounced = true; }
      if (cy < 0) { cy = -cy; dy = -dy; bounced = true; } else if (cy > ROWS) { cy = 2 * ROWS - cy; dy = -dy; bounced = true; }
      paint(S, cx | 0, cy | 0, team, pid, power, src);
      if (bounced) {
        segs.push([sx, sy, cx, cy]); sx = cx; sy = cy;
        if (bounces-- <= 0) break;
      }
    }
    segs.push([sx, sy, cx, cy]);
    return segs;
  }

  function useSkill(S, team, pid, name) {
    if (S.ended) return false;
    if (name) S.names[pid] = name;
    const nm = S.names[pid] || '';
    const heroes = S.units.filter(u => u.team === team && u.kind === 'hero');
    const src = heroes.length ? heroes[(S.rng() * heroes.length) | 0] : { x: COLS / 2, y: ROWS / 2 };
    if (team === 0) { // พายุเลเซอร์
      const rays = [];
      for (let k = 0; k < 10; k++) rays.push(laser(S, src.x, src.y, (k / 10) * Math.PI * 2 + S.rng() * 0.3, 34, 3, team, pid, ARMOR, 'skill'));
      S.events.push({ type: 'skill', team, pid, name: nm, kind: 'laserstorm', x: src.x, y: src.y, rays });
    } else if (team === 1) { // ฝูงแตกตัว
      const pts = [];
      for (let k = 0; k < 12; k++) {
        enforceCap(S, team);
        const x = 1 + S.rng() * (COLS - 2), y = 1 + S.rng() * (ROWS - 2);
        // ลูกจากสกิล: อยู่นาน กัดทะลุเกราะ (ทุบช่องล็อกได้ทันทีเหมือนสกิลสีอื่น) และทาถี่กว่า
        const u = addUnit(S, team, pid, 'child', x, y); u.life = TUNE.swarmLife; u.hp = 4; u.maxHp = 4; u.skill = true; u.power = TUNE.swarmPower; u.paintP = TUNE.swarmPaintP;
        pts.push([x, y]);
      }
      S.events.push({ type: 'skill', team, pid, name: nm, kind: 'swarm', pts });
    } else if (team === 2) { // ระเบิดมหาประลัย — หาจุดที่ศัตรูแน่นที่สุด
      let best = null, bestV = -1;
      for (let r = 4; r < ROWS - 4; r += 3) for (let c = 4; c < COLS - 4; c += 3) {
        let v = 0;
        for (let dr = -5; dr <= 5; dr++) for (let dc = -5; dc <= 5; dc++) {
          if (!inB(c + dc, r + dr)) continue; const i = idx(c + dc, r + dr);
          if (S.owner[i] >= 0 && S.owner[i] !== team) v += S.locked[i] ? 3 : 1;
        }
        if (v > bestV) { bestV = v; best = [c, r]; }
      }
      const [bc, br] = best; const R = TUNE.megaRadius, RR = Math.ceil(R);
      for (let r = br - RR; r <= br + RR; r++) for (let c = bc - RR; c <= bc + RR; c++) {
        if ((c - bc) * (c - bc) + (r - br) * (r - br) <= R * R) paint(S, c, r, team, pid, ARMOR, 'skill');
      }
      S.events.push({ type: 'skill', team, pid, name: nm, kind: 'megablast', x: bc + 0.5, y: br + 0.5, radius: R });
    } else { // คลื่นยักษ์ — แถวที่ศัตรูแน่นที่สุด 5 แถว กวาดจากฝั่งทีม
      const W = TUNE.waveRows; let bestR = W, bestV = -1;
      for (let r = W; r < ROWS - W; r++) {
        let v = 0; for (let rr = r - W; rr <= r + W; rr++) for (let c = 0; c < COLS; c++) { const i = idx(c, rr); if (S.owner[i] >= 0 && S.owner[i] !== team) v += S.locked[i] ? 2 : 1; }
        if (v > bestV) { bestV = v; bestR = r; }
      }
      const dir = S.rng() < 0.5 ? 1 : -1;
      S.waves = S.waves || [];
      S.waves.push({ team, pid, r0: bestR - W, r1: bestR + W, x: dir > 0 ? 0 : COLS - 1, dir, t0: S.t, speed: 60 });
      S.events.push({ type: 'skill', team, pid, name: nm, kind: 'wave', r0: bestR - W, r1: bestR + W, dir });
    }
    return true;
  }

  function useUniversal(S, team, pid, kind, name) {
    if (S.ended) return false;
    if (name) S.names[pid] = name;
    const nm = S.names[pid] || '';
    if (kind === 'shield') S.shieldUntil[team] = S.t + UNIVERSAL.shield.dur;
    else if (kind === 'freeze') { for (let k = 0; k < S.teamCount; k++) if (k !== team) S.frozenUntil[k] = S.t + UNIVERSAL.freeze.dur; }
    else if (kind === 'speed') S.speedUntil[team] = S.t + UNIVERSAL.speed.dur;
    else return false;
    S.events.push({ type: 'universal', team, pid, name: nm, kind });
    return true;
  }

  // ---------------- ลูปจำลอง ----------------
  function tick(S, dtMs) {
    if (S.ended) return;
    const dt = Math.min(dtMs, 50) / 1000;
    S.t += Math.min(dtMs, 50);
    const t = S.t;

    // คลื่นยักษ์
    if (S.waves && S.waves.length) {
      for (const w of S.waves) {
        const nx = w.x + w.dir * w.speed * dt;
        const a = Math.min(w.x, nx), b = Math.max(w.x, nx);
        for (let c = Math.floor(a); c <= Math.ceil(b); c++) for (let r = w.r0; r <= w.r1; r++) paint(S, c, r, w.team, w.pid, ARMOR, 'skill');
        w.x = nx;
      }
      S.waves = S.waves.filter(w => w.x >= -1 && w.x <= COLS + 1);
    }

    for (let k = S.units.length - 1; k >= 0; k--) {
      const u = S.units[k];
      if (t - u.born > u.life || u.hp <= 0) {
        S.events.push({ type: 'die', x: u.x, y: u.y, team: u.team, kind: u.kind });
        S.units.splice(k, 1); continue;
      }
      if (t < S.frozenUntil[u.team]) continue;
      const sp = u.speed * (t < S.speedUntil[u.team] ? 2 : 1);
      u.x += u.vx * sp * dt; u.y += u.vy * sp * dt;
      if (u.x < u.r) { u.x = u.r; u.vx = Math.abs(u.vx); } else if (u.x > COLS - u.r) { u.x = COLS - u.r; u.vx = -Math.abs(u.vx); }
      if (u.y < u.r) { u.y = u.r; u.vy = Math.abs(u.vy); } else if (u.y > ROWS - u.r) { u.y = ROWS - u.r; u.vy = -Math.abs(u.vy); }
      const c = u.x | 0, r = u.y | 0, ci = idx(c, r);
      let painted = false;
      if (ci !== u.lastCell) {
        if (u.kind === 'child') { if (S.rng() < (u.paintP || TUNE.childPaintP)) paint(S, c, r, u.team, u.pid, u.power || 1, u.skill ? 'skill' : undefined); }
        else painted = paint(S, c, r, u.team, u.pid, u.power || 1);
        u.lastCell = ci;
        if (u.kind === 'hero' && u.team === 3 && TUNE.surgerWide) { // Surger: ทางกว้าง 3 ช่อง
          const pw = u.power || 1;
          if (Math.abs(u.vx) > Math.abs(u.vy)) { paint(S, c, r - 1, u.team, u.pid, pw); paint(S, c, r + 1, u.team, u.pid, pw); }
          else { paint(S, c - 1, r, u.team, u.pid, pw); paint(S, c + 1, r, u.team, u.pid, pw); }
        }
      }
      u.cd -= dtMs;
      if (u.kind === 'hero') {
        if (u.team === 0 && painted && u.cd <= 0) { // Ricochet: เลเซอร์สั้น เด้ง 1 ครั้ง
          u.cd = TUNE.ricochetCd;
          const segs = laser(S, u.x, u.y, Math.atan2(u.vy, u.vx) + (S.rng() - 0.5) * 1.2, TUNE.ricochetLen, TUNE.ricochetBounces, u.team, u.pid, TUNE.ricochetPower);
          S.events.push({ type: 'laser', team: u.team, segs });
        } else if (u.team === 1 && u.cd <= 0) { // Splitter: ลูกไม่เกิน kidsPerHero ต่อฮีโร่
          u.cd = TUNE.splitCd;
          let kids = 0; for (const v of S.units) if (v.parent === u.id) kids++;
          if (kids < TUNE.kidsPerHero && unitCount(S, 1) < TEAM_CAP) {
            const ch = addUnit(S, 1, u.pid, 'child', u.x, u.y); ch.parent = u.id;
            S.events.push({ type: 'split', x: u.x, y: u.y, team: 1 });
          }
        } else if (u.team === 2 && u.cd <= 0) { // Blaster: ระเบิดกากบาท 5×5 แรงทุบ 2 (ถนัดทุบช่องล็อก)
          u.cd = TUNE.blasterCd; const bp = TUNE.blasterPower;
          for (let d = -2; d <= 2; d++) { paint(S, c + d, r, u.team, u.pid, bp); paint(S, c, r + d, u.team, u.pid, bp); }
          paint(S, c - 1, r - 1, u.team, u.pid, bp); paint(S, c + 1, r - 1, u.team, u.pid, bp); paint(S, c - 1, r + 1, u.team, u.pid, bp); paint(S, c + 1, r + 1, u.team, u.pid, bp);
          S.events.push({ type: 'blast', x: u.x, y: u.y, team: 2, radius: 2.2 });
        }
      }
    }

    // กัดกัน: ตัวละครต่างทีมชนกัน
    const us = S.units;
    for (let a = 0; a < us.length; a++) {
      const A = us[a];
      for (let b = a + 1; b < us.length; b++) {
        const B = us[b];
        if (A.team === B.team) continue;
        const dx = A.x - B.x, dy = A.y - B.y, rr = A.r + B.r;
        if (dx * dx + dy * dy < rr * rr) {
          const key = A.id < B.id ? A.id + ':' + B.id : B.id + ':' + A.id;
          if ((A.hitCd[key] || 0) > t) continue;
          A.hitCd[key] = t + 400; B.hitCd[key] = t + 400;
          const fa = t < S.frozenUntil[A.team], fb = t < S.frozenUntil[B.team];
          if (!fa) { B.hp -= A.bite; st(S, A.pid).bites++; }
          if (!fb) { A.hp -= B.bite; st(S, B.pid).bites++; }
          S.events.push({ type: 'bite', x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, team: A.team, team2: B.team });
          // เด้งออกจากกัน
          const d = Math.sqrt(dx * dx + dy * dy) || 0.001, nx = dx / d, ny = dy / d;
          A.vx = nx; A.vy = ny; B.vx = -nx; B.vy = -ny;
        }
      }
    }

    // สแกนล็อกทุก 100ms
    S.lockScan += dtMs;
    if (S.lockScan >= 100) { S.lockScan = 0; scanLocks(S); }

    // การพลิกเกม: ดูผล 6 วิหลังปล่อย
    if (S.comebackWatch.length) {
      const keep = [];
      for (const w of S.comebackWatch) {
        if (t - w.t >= 6000) { const gain = S.counts[w.team] - w.before; const ss = st(S, w.pid); if (gain > ss.comeback) ss.comeback = gain; }
        else keep.push(w);
      }
      S.comebackWatch = keep;
    }

    // ชนะขาด: ล็อกได้ ≥ 65% ของกระดาน และผ่านครึ่งเกมแล้ว (ไม่ให้เกมจบตั้งแต่นาทีแรก)
    const winFrac = S.teamCount === 2 ? 0.75 : INSTANT_WIN_FRAC;
    if (t >= S.duration / 2) for (let k = 0; k < S.teamCount; k++) if (S.lockedCounts[k] >= N * winFrac) { S.ended = true; S.winner = k; S.instantWin = true; S.events.push({ type: 'instantwin', team: k }); break; }
  }

  function scores(S) {
    const out = [];
    for (let k = 0; k < S.teamCount; k++) out.push({ team: k, cells: S.counts[k], locked: S.lockedCounts[k], score: S.counts[k] + S.lockedCounts[k] * 2 });
    return out;
  }
  function finish(S) {
    S.ended = true;
    if (S.winner < 0) { const sc = scores(S).sort((a, b) => b.score - a.score); S.winner = sc[0].team; }
    return S.winner;
  }
  // สตริงกระดานแบบย่อสำหรับส่งให้มือถือ: '.'=ว่าง, 'a'-'d'=ทาแล้ว, 'A'-'D'=ล็อก
  function encodeBoard(S) {
    let s = '';
    for (let i = 0; i < N; i++) { const o = S.owner[i]; s += o < 0 ? '.' : String.fromCharCode((S.locked[i] ? 65 : 97) + o); }
    return s;
  }
  function drainEvents(S) { const e = S.events; S.events = []; return e; }

  const API = { COLS, ROWS, N, LOCK_MS, ARMOR, TEAM_CAP, INSTANT_WIN_FRAC, TUNE, TEAMS, UNIVERSAL, HERO, CHILD, create, tick, spawn, useSkill, useUniversal, scores, finish, encodeBoard, drainEvents, idx, trailing, leading };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Engine = API;
})(typeof window !== 'undefined' ? window : globalThis);
