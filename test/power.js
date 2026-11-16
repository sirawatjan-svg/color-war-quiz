// วัดพลังทาสีของฮีโร่ 1 ตัวต่อสี บนกระดานที่ศัตรูทาไว้แล้ว (ยังไม่ล็อก) — ไม่มีตัวละครศัตรูมารบกวน
// node test/power.js   (แก้ค่าใน Engine.TUNE ที่ engine.js แล้วรันซ้ำ)
const Engine = require('../js/engine.js');
function measure(team, seeds, lockedBoard) {
  let total = 0, totalArmorHits = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    let s = seed * 104729 + team; const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const S = Engine.create({ teams: 4, rng });
    const enemy = (team + 1) % 4;
    // held = อนาคตไกลๆ → ช่องศัตรูจะไม่ล็อกเองระหว่างวัด (วัดการทาล้วนๆ)
    for (let i = 0; i < Engine.N; i++) { S.owner[i] = enemy; S.held[i] = 1e12; if (lockedBoard) { S.locked[i] = 1; S.armor[i] = Engine.ARMOR; } }
    S.counts[enemy] = Engine.N; if (lockedBoard) S.lockedCounts[enemy] = Engine.N;
    Engine.spawn(S, team, 'x');
    const before = S.counts[team];
    for (let t = 0; t < 22000; t += 25) { Engine.tick(S, 25); Engine.drainEvents(S); }
    total += S.stats['x'].captured;
  }
  return total / seeds;
}
console.log('พลังทาสีต่อฮีโร่ 1 ตัว ตลอดอายุ 22 วิ (เฉลี่ย 20 รอบ)');
const res = [];
for (let k = 0; k < 4; k++) { const open = measure(k, 20, false), lock = measure(k, 20, true); res.push([k, open, lock]); console.log(` ${Engine.TEAMS[k].th.padEnd(8)} กระดานเปิด ${open.toFixed(0).padStart(4)} ช่อง | กระดานล็อก ${lock.toFixed(0).padStart(4)} ช่อง`); }
const avg = res.reduce((a, r) => a + r[1], 0) / 4;
console.log(' ค่าเฉลี่ยเปิด', avg.toFixed(0), '• ส่วนต่างสูงสุด', (Math.max(...res.map(r => Math.abs(r[1] - avg))) / avg * 100).toFixed(0) + '%');
