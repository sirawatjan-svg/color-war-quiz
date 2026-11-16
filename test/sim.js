// จำลองบาลานซ์: node test/sim.js [teams] [players] [minutes] [seed]
const Engine = require('../js/engine.js');
const Awards = require('../js/awards.js');
const teams = +process.argv[2] || 4, nPlayers = +process.argv[3] || 32, minutes = +process.argv[4] || 6, seed = +process.argv[5] || 1;
let s = seed; const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
const S = Engine.create({ teams, rng });
const qTime = 20000;
// นักเรียน: ความแม่น 0.35–0.95, เวลาตอบเฉลี่ย 6–15 วิ, แบ่งทีมแบบ snake ตามความแม่น (เหมือนคัดกรอง)
const ps = [];
for (let i = 0; i < nPlayers; i++) ps.push({ pid: 'p' + i, name: 'น.' + i, acc: 0.35 + rng() * 0.6, speed: 6000 + rng() * 9000, next: 2000 + rng() * 4000, st: { answered: 0, correct: 0, wrong: 0, streak: 0, bestStreak: 0, sumMs: 0, fastestMs: 0, spawns: 0, skills: 0, h1c: 0, h2c: 0 }, since: 0, sinceSkill: 0, charges: 0 });
ps.sort((a, b) => b.acc - a.acc).forEach((p, i) => { const r = Math.floor(i / teams), pos = i % teams; p.team = r % 2 === 0 ? pos : teams - 1 - pos; S.names[p.pid] = p.name; });
const dur = minutes * 60000; const DT = 25;
const timeline = [];
let evCount = {};
for (let t = 0; t < dur && !S.ended; t += DT) {
  for (const p of ps) {
    if (t < p.next) continue;
    const ms = Math.min(qTime, p.speed * (0.6 + rng() * 0.8));
    p.next = t + ms + 900;
    p.st.answered++;
    if (rng() < p.acc) {
      p.st.correct++; p.st.streak++; p.st.bestStreak = Math.max(p.st.bestStreak, p.st.streak); p.st.sumMs += ms; if (t < dur / 2) p.st.h1c++; else p.st.h2c++;
      p.since++;
      if (p.since >= 3) { p.since = 0; p.st.spawns++; p.sinceSkill++; Engine.spawn(S, p.team, p.pid, p.name); if (p.sinceSkill >= 3) { p.sinceSkill = 0; p.charges++; } }
      if (p.st.streak === 5) Engine.useUniversal(S, p.team, p.pid, 'shield', p.name);
      if (p.st.streak === 8) Engine.useUniversal(S, p.team, p.pid, 'freeze', p.name);
      // ใช้สกิลทันทีที่ได้ 70% / เก็บไว้ท้ายเกม 30%
      if (p.charges > 0 && (rng() < 0.7 || t > dur - 40000)) { p.charges--; p.st.skills++; Engine.useSkill(S, p.team, p.pid, p.name); }
    } else { p.st.wrong++; p.st.streak = 0; p.next += 900; }
  }
  Engine.tick(S, DT);
  for (const e of Engine.drainEvents(S)) evCount[e.type] = (evCount[e.type] || 0) + 1;
  if (t % 30000 === 0) timeline.push({ t: t / 1000, counts: Array.from(S.counts).slice(0, teams), locked: Array.from(S.lockedCounts).slice(0, teams), units: S.units.length, perTeam: [0, 1, 2, 3].slice(0, teams).map(k => S.units.filter(u => u.team === k).length) });
}
Engine.finish(S);
console.log(`== ${teams} ทีม • ${nPlayers} คน • ${minutes} นาที • seed ${seed} ==`);
console.log('เวลา(วิ) | ช่องต่อทีม | ล็อกต่อทีม | ตัวละครต่อทีม');
for (const r of timeline) console.log(String(r.t).padStart(5), '|', r.counts.join('/').padEnd(18), '|', r.locked.join('/').padEnd(18), '|', r.perTeam.join('/'));
const sc = Engine.scores(S).sort((a, b) => b.score - a.score);
console.log('ผล:', sc.map(x => `${Engine.TEAMS[x.team].th} ${x.score} (ช่อง ${x.cells} ล็อก ${x.locked})`).join(' | '), S.instantWin ? '← ชนะขาด' : '', 'จบที่', (S.t / 1000).toFixed(0), 'วิ');
console.log('ว่าง:', Engine.N - S.counts.reduce((a, b) => a + b, 0), 'ช่อง • เหตุการณ์:', JSON.stringify(evCount));
const teamAcc = [0, 1, 2, 3].slice(0, teams).map(k => (ps.filter(p => p.team === k).reduce((a, p) => a + p.acc, 0) / ps.filter(p => p.team === k).length).toFixed(2));
console.log('ความแม่นเฉลี่ยต่อทีม:', teamAcc.join('/'), '• ปล่อยต่อทีม:', [0, 1, 2, 3].slice(0, teams).map(k => ps.filter(p => p.team === k).reduce((a, p) => a + p.st.spawns, 0)).join('/'), '• สกิลต่อทีม:', [0, 1, 2, 3].slice(0, teams).map(k => ps.filter(p => p.team === k).reduce((a, p) => a + p.st.skills, 0)).join('/'));
const players = {}, stats = {}; for (const p of ps) { players[p.pid] = { name: p.name, team: p.team }; stats[p.pid] = p.st; }
const comp = Awards.compute(Awards.merge(players, stats, S.stats));
console.log('รางวัล:'); for (const a of comp.awards) console.log(' ', a.emoji, a.name, '→', a.pname, '(' + Engine.TEAMS[a.team].th + ')', a.value);
const noAward = Object.values(comp.personal).filter(p => !p.awards.length).length;
console.log('คนไม่ได้รางวัล', noAward, 'คน (ได้ป้ายแทน) • ตอบเฉลี่ย', (ps.reduce((a, p) => a + p.st.answered, 0) / ps.length).toFixed(1), 'ข้อ/คน • ปล่อยเฉลี่ย', (ps.reduce((a, p) => a + p.st.spawns, 0) / ps.length).toFixed(1));
