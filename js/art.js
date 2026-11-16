// ============================================================
// Art — วาดตัวละครทั้ง 4 สี (ใช้ทั้งในเกม จอครู มือถือ และหน้าแรก)
//   Ricochet (แดง)  : หุ่นเพชรปลายแหลม ตาเป็นแถบเลเซอร์
//   Splitter (ม่วง) : ก้อนวุ้นดุ๊กดิ๊ก ตาโต มีเขี้ยว
//   Blaster (ฟ้า)   : หุ่นหกเหลี่ยม เตาปฏิกรณ์เต้นเป็นจังหวะ
//   Surger (เขียว)  : ดาวหางหยดน้ำ ตาเดียวคิ้วขมวด
// ============================================================
const Art = (() => {
  const TEAMS = () => (window.Engine ? Engine.TEAMS : []);
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
  function lighten(hex, k) { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.round(v + (255 - v) * k); return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`; }

  function bodyFill(c, color, r) {
    const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.3);
    g.addColorStop(0, lighten(color, 0.55)); g.addColorStop(0.45, color); g.addColorStop(1, hexA(color, 0.92));
    return g;
  }
  function eyes(c, r, look, spread, size, angry) {
    for (const s of [-1, 1]) {
      const ex = s * r * spread, ey = -r * 0.12;
      c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex, ey, r * size, r * size * 1.15, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#0a0a0a'; c.beginPath(); c.arc(ex + look[0] * r * size * 0.42, ey + look[1] * r * size * 0.42, r * size * 0.55, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(ex + look[0] * r * size * 0.42 - r * size * 0.18, ey + look[1] * r * size * 0.42 - r * size * 0.2, r * size * 0.18, 0, Math.PI * 2); c.fill();
      if (angry) { c.strokeStyle = '#0a0a0a'; c.lineWidth = Math.max(1.2, r * 0.12); c.lineCap = 'round'; c.beginPath(); c.moveTo(ex - s * r * size * 1.1, ey - r * size * 1.45); c.lineTo(ex + s * r * size * 0.9, ey - r * size * 1.05); c.stroke(); }
    }
  }

  // วาดตัวละคร ณ (x,y) รัศมี r — opts: {t, ang(ทิศวิ่ง), child, frozen, hp(0..1), cd(0..1 พลังสะสม), outline}
  function hero(c, team, x, y, r, o) {
    o = o || {};
    const T = TEAMS()[team]; if (!T) return;
    const t = o.t || 0, ang = o.ang || 0;
    const look = [Math.cos(ang), Math.sin(ang)];
    const color = o.frozen ? '#bfe9ff' : T.color, dark = o.frozen ? '#3a7da3' : T.dark;
    c.save(); c.translate(x, y);
    c.lineJoin = 'round';
    const ow = Math.max(1.5, r * 0.14);

    if (o.child) { // ลูกแตก (Splitter) ตัวจิ๋ว
      const wob = 1 + Math.sin(t / 90 + x) * 0.08;
      c.fillStyle = bodyFill(c, color, r); c.strokeStyle = dark; c.lineWidth = ow;
      c.beginPath(); c.ellipse(0, 0, r * wob, r / wob, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(-r * 0.32 + look[0] * r * 0.1, -r * 0.1 + look[1] * r * 0.1, r * 0.22, 0, Math.PI * 2); c.arc(r * 0.32 + look[0] * r * 0.1, -r * 0.1 + look[1] * r * 0.1, r * 0.22, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#000'; c.beginPath(); c.arc(-r * 0.32 + look[0] * r * 0.16, -r * 0.1 + look[1] * r * 0.16, r * 0.11, 0, Math.PI * 2); c.arc(r * 0.32 + look[0] * r * 0.16, -r * 0.1 + look[1] * r * 0.16, r * 0.11, 0, Math.PI * 2); c.fill();
      c.restore(); return;
    }

    if (team === 0) { // ---------- RICOCHET ----------
      c.rotate(ang);
      const p = [[r * 1.45, 0], [r * 0.25, -r * 0.62], [-r * 0.2, -r * 1.05], [-r * 0.55, -r * 0.42], [-r * 1.05, 0], [-r * 0.55, r * 0.42], [-r * 0.2, r * 1.05], [r * 0.25, r * 0.62]];
      c.beginPath(); p.forEach(([a, b], i) => i ? c.lineTo(a, b) : c.moveTo(a, b)); c.closePath();
      c.rotate(-ang); c.fillStyle = bodyFill(c, color, r); c.rotate(ang); c.fill();
      c.strokeStyle = dark; c.lineWidth = ow; c.stroke();
      // แผงไฟข้าง
      c.fillStyle = hexA('#ffffff', 0.35); c.beginPath(); c.moveTo(r * 0.9, -r * 0.08); c.lineTo(r * 0.2, -r * 0.45); c.lineTo(r * 0.1, -r * 0.2); c.closePath(); c.fill();
      // ตาแถบเลเซอร์
      const pulse = 0.65 + 0.35 * Math.sin(t / 120);
      c.fillStyle = '#1a0006'; roundRect(c, -r * 0.15, -r * 0.2, r * 0.95, r * 0.4, r * 0.18); c.fill();
      c.fillStyle = `rgba(255,255,255,${pulse})`; roundRect(c, r * 0.05, -r * 0.09, r * 0.68, r * 0.18, r * 0.09); c.fill();
    } else if (team === 1) { // ---------- SPLITTER ----------
      const N = 28; c.beginPath();
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const rr = r * (1 + 0.09 * Math.sin(a * 5 + t / 110) + 0.05 * Math.sin(a * 3 - t / 170));
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr * 0.95;
        i ? c.lineTo(px, py) : c.moveTo(px, py);
      }
      c.closePath(); c.fillStyle = bodyFill(c, color, r); c.fill(); c.strokeStyle = dark; c.lineWidth = ow; c.stroke();
      // จุดด่าง
      c.fillStyle = hexA('#ffffff', 0.22); c.beginPath(); c.arc(r * 0.45, r * 0.42, r * 0.14, 0, 7); c.arc(-r * 0.55, r * 0.3, r * 0.1, 0, 7); c.fill();
      eyes(c, r, look, 0.36, 0.27, false);
      // ปาก + เขี้ยว
      c.fillStyle = '#2a0033'; c.beginPath(); c.ellipse(0, r * 0.42, r * 0.36, r * 0.17, 0, 0, Math.PI); c.fill();
      c.fillStyle = '#fff'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * r * 0.24, r * 0.42); c.lineTo(s * r * 0.12, r * 0.42); c.lineTo(s * r * 0.18, r * 0.62); c.closePath(); c.fill(); }
    } else if (team === 2) { // ---------- BLASTER ----------
      const rot = t / 1400;
      c.save(); c.rotate(rot);
      c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; i ? c.lineTo(Math.cos(a) * r * 1.12, Math.sin(a) * r * 1.12) : c.moveTo(Math.cos(a) * r * 1.12, Math.sin(a) * r * 1.12); } c.closePath();
      c.rotate(-rot); c.fillStyle = bodyFill(c, color, r); c.rotate(rot); c.fill(); c.strokeStyle = dark; c.lineWidth = ow; c.stroke();
      // หมุดเกราะ
      c.fillStyle = dark; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; c.beginPath(); c.arc(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85, r * 0.08, 0, 7); c.fill(); }
      c.restore();
      // เตาปฏิกรณ์ (สว่างขึ้นเมื่อใกล้ระเบิด)
      const charge = o.cd == null ? (0.5 + 0.5 * Math.sin(t / 160)) : o.cd;
      c.fillStyle = '#04263a'; c.beginPath(); c.arc(0, 0, r * 0.58, 0, 7); c.fill();
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r * 0.55);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.35 + charge * 0.25, lighten(color, 0.4)); g.addColorStop(1, hexA(color, 0));
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * (0.32 + charge * 0.22), 0, 7); c.fill();
      // ตาเล็กสองดวงบนเตา
      c.fillStyle = '#04263a'; c.beginPath(); c.arc(-r * 0.17 + look[0] * r * 0.06, -r * 0.05 + look[1] * r * 0.06, r * 0.08, 0, 7); c.arc(r * 0.17 + look[0] * r * 0.06, -r * 0.05 + look[1] * r * 0.06, r * 0.08, 0, 7); c.fill();
    } else { // ---------- SURGER ----------
      c.rotate(ang);
      c.beginPath(); c.moveTo(-r * 1.7, 0);
      c.quadraticCurveTo(-r * 0.6, -r * 1.05, r * 0.25, -r * 0.98);
      c.arc(r * 0.25, 0, r * 0.98, -Math.PI / 2, Math.PI / 2);
      c.quadraticCurveTo(-r * 0.6, r * 1.05, -r * 1.7, 0); c.closePath();
      c.rotate(-ang); c.fillStyle = bodyFill(c, color, r); c.rotate(ang); c.fill(); c.strokeStyle = dark; c.lineWidth = ow; c.stroke();
      // ลายความเร็ว
      c.strokeStyle = hexA('#ffffff', 0.4); c.lineWidth = Math.max(1, r * 0.1); c.lineCap = 'round';
      c.beginPath(); c.moveTo(-r * 1.1, -r * 0.25); c.lineTo(-r * 0.35, -r * 0.42); c.moveTo(-r * 1.0, r * 0.28); c.lineTo(-r * 0.3, r * 0.45); c.stroke();
      // ตาเดียว (หันไปข้างหน้าเสมอ)
      c.rotate(-ang); const ex = Math.cos(ang) * r * 0.42, ey = Math.sin(ang) * r * 0.42 - r * 0.05; c.translate(ex, ey);
      c.fillStyle = '#fff'; c.beginPath(); c.ellipse(0, 0, r * 0.38, r * 0.42, 0, 0, 7); c.fill();
      c.fillStyle = '#0a0a0a'; c.beginPath(); c.arc(look[0] * r * 0.15, look[1] * r * 0.15, r * 0.2, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(look[0] * r * 0.15 - r * 0.07, look[1] * r * 0.15 - r * 0.08, r * 0.07, 0, 7); c.fill();
      c.strokeStyle = '#0a0a0a'; c.lineWidth = Math.max(1.4, r * 0.13); c.lineCap = 'round'; c.beginPath(); c.moveTo(-r * 0.4, -r * 0.5); c.lineTo(r * 0.35, -r * 0.36); c.stroke();
    }

    if (o.frozen) { c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.5; c.setLineDash([3, 3]); c.beginPath(); c.arc(0, 0, r * 1.35, 0, 7); c.stroke(); c.setLineDash([]); }
    c.restore();
  }

  function roundRect(c, x, y, w, h, rad) { c.beginPath(); c.moveTo(x + rad, y); c.arcTo(x + w, y, x + w, y + h, rad); c.arcTo(x + w, y + h, x, y + h, rad); c.arcTo(x, y + h, x, y, rad); c.arcTo(x, y, x + w, y, rad); c.closePath(); }

  // ภาพประจำตัว (สำหรับ UI) — วาดลงแคนวาสที่ให้มา มีแสงเรืองรอบตัว
  function portrait(canvas, team, opts) {
    opts = opts || {};
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const c = canvas.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    const T = TEAMS()[team]; const r = Math.min(w, h) * (opts.scale || 0.3);
    if (opts.glow !== false) { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.55); g.addColorStop(0, hexA(T.color, 0.45)); g.addColorStop(1, hexA(T.color, 0)); c.fillStyle = g; c.fillRect(0, 0, w, h); }
    hero(c, team, w / 2 + (team === 3 ? r * 0.25 : 0), h / 2, team === 3 ? r * 0.82 : r, { t: opts.t || 400, ang: opts.ang != null ? opts.ang : (team === 0 || team === 3 ? -0.35 : 0.3) });
  }

  // ภาพปกการ์ด — ฉากเล็กๆ ของตัวละคร/สกิล บนพื้นกระเบื้องสีทีม
  function cover(canvas, spec) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const c = canvas.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const T = TEAMS()[spec.team != null ? spec.team : 0];
    const other = TEAMS()[(spec.team + 1 + (spec.alt || 0)) % 4];
    // พื้นไล่สี
    const bg = c.createLinearGradient(0, 0, w, h); bg.addColorStop(0, lighten(T.dark, 0.05)); bg.addColorStop(1, '#07080b');
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    // กระเบื้องสองสีแย่งพื้นที่
    const cs = Math.max(10, Math.round(w / 18));
    let seed = (spec.seed || 1) * 9301; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let y = 0; y < h; y += cs) for (let x = 0; x < w; x += cs) {
      const d = (x / w) + (y / h) * 0.5 + (rnd() - 0.5) * 0.35;
      const mine = d < 0.85;
      const v = rnd();
      if (v < 0.12) continue;
      const col = mine ? T.color : other.color;
      c.fillStyle = hexA(col, v < 0.55 ? 0.9 : 0.4);
      c.fillRect(x + 1, y + 1, cs - 2, cs - 2);
      if (v < 0.55) { c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x + 3, y + 3, cs - 6, Math.max(2, cs * 0.16)); }
    }
    // แสงกลางภาพ
    const g = c.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, w * 0.6); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    const cxp = w * 0.5, cyp = h * 0.4, r = Math.min(w, h) * 0.16;
    c.save(); c.globalCompositeOperation = 'lighter';
    if (spec.fx === 'laser') { c.lineWidth = r * 0.22; c.lineCap = 'round'; for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 + 0.2; c.strokeStyle = hexA(T.color, 0.8); c.beginPath(); c.moveTo(cxp, cyp); c.lineTo(cxp + Math.cos(a) * w, cyp + Math.sin(a) * w); c.stroke(); } c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = r * 0.07; for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 + 0.2; c.beginPath(); c.moveTo(cxp, cyp); c.lineTo(cxp + Math.cos(a) * w, cyp + Math.sin(a) * w); c.stroke(); } }
    if (spec.fx === 'blast') { for (let k = 0; k < 4; k++) { c.strokeStyle = hexA(k % 2 ? '#ffffff' : T.color, 0.8 - k * 0.15); c.lineWidth = r * (0.35 - k * 0.06); c.beginPath(); c.arc(cxp, cyp, r * (1.6 + k * 0.9), 0, 7); c.stroke(); } }
    if (spec.fx === 'wave') { const gg = c.createLinearGradient(0, 0, w, 0); gg.addColorStop(0, hexA(T.color, 0)); gg.addColorStop(0.75, hexA(T.color, 0.85)); gg.addColorStop(0.78, '#ffffff'); gg.addColorStop(0.8, hexA(T.color, 0)); c.fillStyle = gg; c.fillRect(0, cyp - r * 1.6, w, r * 3.2); }
    if (spec.fx === 'freeze') { c.fillStyle = 'rgba(160,225,255,.25)'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(220,245,255,.8)'; c.lineWidth = 2; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI; c.beginPath(); c.moveTo(cxp - Math.cos(a) * r * 2.4, cyp - Math.sin(a) * r * 2.4); c.lineTo(cxp + Math.cos(a) * r * 2.4, cyp + Math.sin(a) * r * 2.4); c.stroke(); } }
    if (spec.fx === 'shield') { c.strokeStyle = hexA(T.color, 0.9); c.lineWidth = r * 0.18; c.beginPath(); c.moveTo(cxp, cyp - r * 2); c.lineTo(cxp + r * 1.7, cyp - r * 1.3); c.lineTo(cxp + r * 1.4, cyp + r * 1.1); c.lineTo(cxp, cyp + r * 2); c.lineTo(cxp - r * 1.4, cyp + r * 1.1); c.lineTo(cxp - r * 1.7, cyp - r * 1.3); c.closePath(); c.stroke(); }
    if (spec.fx === 'speed') { c.strokeStyle = hexA(T.color, 0.8); c.lineCap = 'round'; for (let k = 0; k < 9; k++) { c.lineWidth = 2 + rnd() * 4; const y = cyp - r * 1.5 + k * r * 0.38; c.beginPath(); c.moveTo(w * 0.05, y); c.lineTo(cxp - r * 1.1, y); c.stroke(); } }
    const glow = c.createRadialGradient(cxp, cyp, 0, cxp, cyp, r * 2.6); glow.addColorStop(0, hexA(T.color, 0.6)); glow.addColorStop(1, hexA(T.color, 0)); c.fillStyle = glow; c.fillRect(0, 0, w, h);
    c.restore();
    if (spec.fx === 'swarm') { for (let k = 0; k < 11; k++) { const a = k / 11 * Math.PI * 2, d = r * (1.8 + rnd() * 1.1); hero(c, 1, cxp + Math.cos(a) * d, cyp + Math.sin(a) * d * 0.8, r * 0.38, { child: true, t: k * 70, ang: a }); } }
    if (spec.emoji) { c.font = `${r * 2.4}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(spec.emoji, cxp, cyp); }
    else hero(c, spec.team, cxp + (spec.team === 3 ? r * 0.3 : 0), cyp, r * (spec.fx === 'swarm' ? 0.9 : spec.team === 3 ? 0.92 : 1.15), { t: 500 + (spec.seed || 0) * 97, ang: spec.team === 0 || spec.team === 3 ? -0.3 : 0.25 });
  }

  return { hero, portrait, cover, hexA, lighten, roundRect };
})();
