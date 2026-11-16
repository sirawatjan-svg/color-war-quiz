// ============================================================
// Awards — คำนวณรางวัลท้ายเกมจากสถิติการตอบ (จากมือถือ) + สถิติบนกระดาน (จากเอนจิน)
// กติกา: 1 คนรับได้สูงสุด 2 รางวัล; คนที่ไม่ได้รางวัลได้ "ป้าย" จากสถิติตัวเอง
// ============================================================
const Awards = (() => {
  const DEFS = [
    { key: 'fast', emoji: '⚡', name: 'สายฟ้าแลบ', desc: 'ตอบถูกเร็วที่สุดโดยเฉลี่ย (ถูกอย่างน้อย 5 ข้อ)', pick: (p) => p.correct >= 5 ? -(p.sumMs / p.correct) : null, fmt: (p) => 'เฉลี่ย ' + (p.sumMs / p.correct / 1000).toFixed(1) + ' วิ/ข้อ' },
    { key: 'acc', emoji: '🎯', name: 'แม่นปืน', desc: 'ความแม่นยำสูงสุด (ตอบอย่างน้อย 8 ข้อ)', pick: (p) => p.answered >= 8 ? p.correct / p.answered + p.correct / 10000 : null, fmt: (p) => 'แม่น ' + Math.round(p.correct / p.answered * 100) + '% (' + p.correct + '/' + p.answered + ')' },
    { key: 'machine', emoji: '🔥', name: 'เครื่องจักร', desc: 'ตอบถูกจำนวนมากที่สุด', pick: (p) => p.correct >= 3 ? p.correct : null, fmt: (p) => 'ถูก ' + p.correct + ' ข้อ' },
    { key: 'conq', emoji: '⚔️', name: 'ผู้ปล่อยตัวสังหาร', desc: 'ตัวละครที่ตัวเองปล่อยยึดช่องได้มากที่สุด', pick: (p) => p.captured >= 20 ? p.captured : null, fmt: (p) => 'ยึด ' + p.captured + ' ช่อง' },
    { key: 'lock', emoji: '🔒', name: 'ช่างล็อกช่อง', desc: 'ช่องที่ตัวเองทาแล้วถูกล็อกถาวรมากที่สุด', pick: (p) => p.locked >= 5 ? p.locked : null, fmt: (p) => 'ล็อก ' + p.locked + ' ช่อง' },
    { key: 'skill', emoji: '💥', name: 'ราชาสกิล', desc: 'ใช้สกิลพิเศษสำเร็จมากที่สุด', pick: (p) => p.skills >= 1 ? p.skills + p.skillCells / 100000 : null, fmt: (p) => 'สกิล ' + p.skills + ' ครั้ง • ทา ' + p.skillCells + ' ช่อง' },
    { key: 'comeback', emoji: '🦸', name: 'ผู้พลิกเกม', desc: 'ปล่อยตอนทีมตามหลังแล้วทีมได้ช่องเพิ่มมากที่สุดใน 6 วิ', pick: (p) => p.comeback >= 25 ? p.comeback : null, fmt: (p) => '+' + p.comeback + ' ช่องใน 6 วิ' },
    { key: 'streak', emoji: '🧊', name: 'สุขุมนิ่ง', desc: 'ตอบถูกติดต่อกันยาวที่สุด', pick: (p) => p.bestStreak >= 4 ? p.bestStreak : null, fmt: (p) => 'ถูกติดกัน ' + p.bestStreak + ' ข้อ' },
    { key: 'growth', emoji: '📈', name: 'ก้าวกระโดด', desc: 'ครึ่งหลังตอบถูกมากกว่าครึ่งแรกมากที่สุด', pick: (p) => (p.h2c - p.h1c) >= 3 ? (p.h2c - p.h1c) : null, fmt: (p) => 'ครึ่งแรก ' + p.h1c + ' → ครึ่งหลัง ' + p.h2c },
  ];

  // รวมสถิติ: stats (จากมือถือ) + engineStats (จากกระดาน) + players (ชื่อ/ทีม)
  function merge(players, stats, engineStats) {
    const out = {};
    for (const pid in players) {
      const s = (stats && stats[pid]) || {}, e = (engineStats && engineStats[pid]) || {};
      out[pid] = {
        pid, name: players[pid].name || '?', team: players[pid].team,
        answered: s.answered || 0, correct: s.correct || 0, wrong: s.wrong || 0, bestStreak: s.bestStreak || 0,
        sumMs: s.sumMs || 0, fastestMs: s.fastestMs || 0, spawns: s.spawns || 0, skills: s.skills || 0, h1c: s.h1c || 0, h2c: s.h2c || 0,
        captured: e.captured || 0, locked: e.locked || 0, skillCells: e.skillCells || 0, comeback: e.comeback || 0, bites: e.bites || 0,
      };
      const p = out[pid];
      // คะแนนส่วนตัว: เน้นการตอบ (เกมการศึกษา) — ผลบนกระดานเป็นโบนัส
      p.points = p.correct * 25 + p.bestStreak * 5 + p.spawns * 10 + p.skills * 30 + Math.round(p.captured * 0.1) + Math.round(p.locked * 0.3);
    }
    return out;
  }

  function compute(all) {
    const list = Object.values(all);
    const got = {}; // pid → จำนวนรางวัล
    const awards = [];
    for (const d of DEFS) {
      const cands = list.map(p => ({ p, v: d.pick(p) })).filter(x => x.v != null && !isNaN(x.v)).sort((a, b) => b.v - a.v);
      const w = cands.find(x => (got[x.p.pid] || 0) < 2);
      if (!w) continue;
      got[w.p.pid] = (got[w.p.pid] || 0) + 1;
      awards.push({ key: d.key, emoji: d.emoji, name: d.name, desc: d.desc, pid: w.p.pid, pname: w.p.name, team: w.p.team, value: d.fmt(w.p) });
    }
    // ป้ายปลอบใจ/ประจำตัว
    const personal = {};
    const ranked = list.slice().sort((a, b) => b.points - a.points);
    ranked.forEach((p, i) => {
      const mine = awards.filter(a => a.pid === p.pid);
      let badge;
      if (mine.length) badge = null;
      else if (p.answered >= 6 && p.wrong >= p.correct) badge = { emoji: '💪', name: 'กล้าลอง', desc: 'ตอบผิดเยอะแต่ไม่ยอมหยุด — นี่แหละนักสู้' };
      else if (p.spawns >= 3) badge = { emoji: '🚀', name: 'นักปล่อย', desc: 'ปล่อยตัวละครลงสนาม ' + p.spawns + ' ครั้ง' };
      else if (p.bites >= 5) badge = { emoji: '🦷', name: 'นักกัด', desc: 'ตัวละครของคุณกัดศัตรู ' + p.bites + ' ครั้ง' };
      else if (p.correct >= 1) badge = { emoji: '🌱', name: 'เริ่มต้นดี', desc: 'ตอบถูก ' + p.correct + ' ข้อ — รอบหน้าเอาใหม่!' };
      else badge = { emoji: '👀', name: 'ผู้สังเกตการณ์', desc: 'รอบหน้าลองตอบดู ทีมต้องการคุณ' };
      personal[p.pid] = { rank: i + 1, points: p.points, awards: mine.map(a => ({ emoji: a.emoji, name: a.name, value: a.value })), badge, correct: p.correct, answered: p.answered, bestStreak: p.bestStreak, captured: p.captured, locked: p.locked, spawns: p.spawns, skills: p.skills };
    });
    return { awards, personal, ranked };
  }

  const API = { DEFS, merge, compute };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  return API;
})();
