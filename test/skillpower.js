// วัดผลของสกิลพิเศษแต่ละสี บนกระดานที่ศัตรูล็อกไว้ทั้งหมด (สถานการณ์จริงช่วงกลาง-ท้ายเกม)
// node test/skillpower.js
const Engine = require('../js/engine.js');
function measure(team, seeds) {
  let total = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    let s = seed * 7 + team * 131; const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const S = Engine.create({ teams: 4, rng });
    const enemy = (team + 1) % 4;
    for (let i = 0; i < Engine.N; i++) { S.owner[i] = enemy; S.held[i] = 1e12; S.locked[i] = 1; S.armor[i] = Engine.ARMOR; }
    S.counts[enemy] = Engine.N; S.lockedCounts[enemy] = Engine.N;
    // ฮีโร่ 1 ตัวเป็นจุดยิง — นับเฉพาะส่วนที่สกิลทำ (ลบส่วนที่ฮีโร่ธรรมดาทำออก)
    Engine.spawn(S, team, 'h');
    Engine.useSkill(S, team, 'x');
    for (let t = 0; t < 12000; t += 25) { Engine.tick(S, 25); Engine.drainEvents(S); }
    total += (S.stats['x'] ? S.stats['x'].captured : 0);
  }
  return total / seeds;
}
console.log('ช่องที่สกิลพิเศษยึดได้จากกระดานล็อกของศัตรู (เฉลี่ย 20 รอบ, นับ 12 วิหลังใช้)');
const r = [];
for (let k = 0; k < 4; k++) { const v = measure(k, 20); r.push(v); console.log(` ${Engine.TEAMS[k].skill.padEnd(16)} ${v.toFixed(0).padStart(5)} ช่อง`); }
const avg = r.reduce((a, b) => a + b, 0) / 4; console.log(' เฉลี่ย', avg.toFixed(0), '• ส่วนต่างสูงสุด', (Math.max(...r.map(v => Math.abs(v - avg))) / avg * 100).toFixed(0) + '%');
