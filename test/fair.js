// ทดสอบความยุติธรรมของสี: ทุกทีมได้อินพุตเท่ากัน (ความแม่น/ความเร็วเท่ากันทุกคน) รันหลาย seed
// node test/fair.js [teams] [seeds] [minutes]
const Engine = require('../js/engine.js');
const teams = +process.argv[2] || 4, seeds = +process.argv[3] || 12, minutes = +process.argv[4] || 6;
const wins = [0, 0, 0, 0], share = [0, 0, 0, 0], lockShare = [0, 0, 0, 0]; let instant = 0, totalLocksEv = 0, maxUnits = 0, empties = 0;
for (let seed = 1; seed <= seeds; seed++) {
  let s = seed * 7919; const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const S = Engine.create({ teams, rng, duration: minutes * 60000 });
  const ps = [];
  for (let i = 0; i < 32; i++) ps.push({ pid: 'p' + i, team: i % teams, acc: 0.65, speed: 10000, next: 3000 + rng() * 3000, since: 0, sinceSkill: 0, charges: 0, streak: 0 });
  const dur = minutes * 60000, DT = 25;
  for (let t = 0; t < dur && !S.ended; t += DT) {
    for (const p of ps) {
      if (t < p.next) continue;
      const ms = p.speed * (0.6 + rng() * 0.8); p.next = t + ms + 900;
      if (rng() < p.acc) {
        p.streak++; p.since++;
        if (p.since >= 3) { p.since = 0; p.sinceSkill++; Engine.spawn(S, p.team, p.pid); if (p.sinceSkill >= 3) { p.sinceSkill = 0; p.charges++; } }
        if (p.streak === 5) Engine.useUniversal(S, p.team, p.pid, 'shield');
        if (p.streak === 8) Engine.useUniversal(S, p.team, p.pid, 'freeze');
        if (p.charges > 0 && rng() < 0.7) { p.charges--; Engine.useSkill(S, p.team, p.pid); }
      } else { p.streak = 0; p.next += 900; }
    }
    Engine.tick(S, DT);
    for (const e of Engine.drainEvents(S)) if (e.type === 'lock') totalLocksEv++;
    maxUnits = Math.max(maxUnits, S.units.length);
  }
  Engine.finish(S);
  if (S.instantWin) instant++;
  const sc = Engine.scores(S); const tot = sc.reduce((a, x) => a + x.score, 0) || 1; const totL = sc.reduce((a, x) => a + x.locked, 0) || 1;
  wins[S.winner]++;
  sc.forEach(x => { share[x.team] += x.score / tot; lockShare[x.team] += x.locked / totL; });
  empties += Engine.N - S.counts.reduce((a, b) => a + b, 0);
}
console.log(`== ยุติธรรม? ${teams} ทีม • ${seeds} รอบ • ${minutes} นาที ==`);
for (let k = 0; k < teams; k++) console.log(` ${Engine.TEAMS[k].th.padEnd(8)} ชนะ ${wins[k]}/${seeds}  ส่วนแบ่งคะแนนเฉลี่ย ${(share[k] / seeds * 100).toFixed(1)}%  ส่วนแบ่งล็อก ${(lockShare[k] / seeds * 100).toFixed(1)}%`);
console.log(` ชนะขาด ${instant}/${seeds} • ล็อกเฉลี่ย ${(totalLocksEv / seeds).toFixed(0)} ครั้ง/เกม • ตัวละครสูงสุดพร้อมกัน ${maxUnits} • ช่องว่างเฉลี่ยตอนจบ ${(empties / seeds).toFixed(0)}`);
