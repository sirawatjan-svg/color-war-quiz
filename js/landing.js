// ============================================================
// Landing — หน้าแรก: เกมจำลองเล่นเอง (hero + กรอบสื่อ), แท็บความสามารถ,
//           แครูเซลหน้าจอจำลอง, แกลเลอรีตัวละคร
// ============================================================
(() => {
  const $ = (id) => document.getElementById(id);
  const T = Engine.TEAMS;
  const NAMES = ['ฟ้า', 'บอส', 'มายด์', 'ต้น', 'แพรว', 'กัปตัน', 'ข้าวหอม', 'ปลื้ม', 'ภูมิ', 'น้ำใส', 'แบงค์', 'มิว', 'โอ๊ต', 'ใบเตย', 'ปัน', 'จีน'];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- เกมจำลองที่เล่นเอง ----------
  function demo(stage, o) {
    const cv = document.createElement('canvas'); stage.appendChild(cv);
    const fx = FX.create(cv, { stage, fit: o.fit, labels: o.labels, cutins: o.cutins, sound: false, maxDpr: 1.5, bloom: true });
    let S, acc, skillAcc, last = performance.now(), visible = false, raf = null;
    function reset() {
      S = Engine.create({ teams: 4, duration: 1e12 });
      acc = [0, 0, 0, 0].map(() => Math.random() * 800); skillAcc = 2500;
      NAMES.forEach((n, i) => { S.names['d' + i] = n; });
      // เริ่มด้วยตัวละครทีมละ 2 ตัว ให้ภาพมีชีวิตทันที
      for (let k = 0; k < 4; k++) for (let j = 0; j < 2; j++) Engine.spawn(S, k, 'd' + (k * 4 + j));
      Engine.drainEvents(S);
    }
    reset();
    function frame(now) {
      raf = visible ? requestAnimationFrame(frame) : null;
      const dt = Math.min(50, now - last); last = now;
      // AI ปล่อยตัวละครเป็นระยะ
      for (let k = 0; k < 4; k++) {
        acc[k] -= dt;
        if (acc[k] <= 0) { acc[k] = o.spawnEvery * (0.6 + Math.random() * 0.9); Engine.spawn(S, k, 'd' + (k * 4 + ((Math.random() * 4) | 0))); }
      }
      if (o.skills) { skillAcc -= dt; if (skillAcc <= 0) { skillAcc = 6500 + Math.random() * 3500; const k = (Math.random() * 4) | 0; if (Math.random() < 0.8) Engine.useSkill(S, k, 'd' + (k * 4 + 1)); else Engine.useUniversal(S, k, 'd' + (k * 4 + 2), Math.random() < 0.5 ? 'freeze' : 'shield'); } }
      Engine.tick(S, dt);
      fx.consume(Engine.drainEvents(S));
      fx.draw(S, now);
      if (S.t > o.resetAfter) reset();
    }
    // เล่นเฉพาะตอนมองเห็น (ประหยัดเครื่อง)
    new IntersectionObserver((ents) => {
      visible = ents[0].isIntersecting;
      if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    }, { threshold: 0.05 }).observe(stage);
    if (reduced) { for (let i = 0; i < 400; i++) { Engine.tick(S, 25); } Engine.drainEvents(S); fx.draw(S, 0); }
    return fx;
  }
  demo($('hero-stage'), { fit: 'cover', labels: false, cutins: false, skills: false, spawnEvery: 1300, resetAfter: 70000 });
  demo($('media-stage'), { fit: 'contain', labels: true, cutins: true, skills: true, spawnEvery: 1700, resetAfter: 80000 });

  // ---------- แท็บความสามารถ ----------
  const TABS = [
    { kpis: ['3 CORRECT = 1 RELEASE', 'NAME TAG 3s'], html: `<p><b>ตอบ → ชาร์จ → ปล่อย.</b> นักเรียนตอบคำถามบนมือถือของตัวเอง ทุกข้อที่ถูกเติมพลัง 1 ขีด ครบ 3 ขีดกดปล่อยนักรบประจำสีลงกระดานบนจอครู ชื่อคนปล่อยเด้งขึ้นตัวใหญ่ตรงจุดที่นักรบตกลงมา ครูเห็นทันทีว่าใครกำลังช่วยทีม</p><p>ตอบผิดไม่ตัดพลัง แต่จะเห็นคำอธิบายเฉลย แล้วได้ข้อใหม่ทันที — เด็กที่ตอบช้าก็ยังมีส่วนร่วมได้</p><a href="host.html">เปิดห้องทดลอง</a>` },
    { kpis: ['3 RELEASES = 1 SKILL', 'STREAK 5 · 8'], html: `<p><b>สกิลพิเศษประจำสี.</b> ปล่อยครบ 3 ครั้งได้สกิลใหญ่ 1 ครั้ง: <b>พายุเลเซอร์</b> ยิง 10 ทิศ, <b>ฝูงแตกตัว</b> ปล่อยลูกสมุนทั่วกระดาน, <b>ระเบิดมหาประลัย</b> ถล่มจุดที่ศัตรูแน่นที่สุด, <b>คลื่นยักษ์</b> กวาดล้าง 5 แถว ทุกสกิลทุบช่องที่ล็อกแล้วได้ และขึ้นคัตอินเต็มจอพร้อมชื่อคนใช้</p><p>ตอบถูกติดกัน 5 ข้อ ทีมได้ <b>โล่ล็อกเร็ว</b> · ติดกัน 8 ข้อ <b>แช่แข็ง</b>ศัตรูทั้งกระดาน · เพื่อน 3 คนปล่อยภายใน 3 วินาที ได้ <b>คอมโบทีม</b></p><a href="#discover">ดูสกิลทั้งหมด</a>` },
    { kpis: ['AUTO-BALANCE', '9 AWARDS'], html: `<p><b>ทีมสูสี รางวัลทั่วถึง.</b> ก่อนเริ่ม นักเรียนตอบฟรี 3 ข้อ ระบบจัดทีมแบบสลับเก่ง-อ่อนให้แต่ละสีแข็งพอกัน ครูคลิกสลับคนเองได้ ระหว่างเกม ทีมที่ตามหลังมากจะได้นักรบที่อึดขึ้นเพื่อพลิกเกม</p><p>จบเกมเปิดรางวัลทีละใบ 9 รางวัล คนละไม่เกิน 2 — สายฟ้าแลบ แม่นปืน เครื่องจักร ผู้พลิกเกม ราชาสกิล ฯลฯ ใครไม่ได้รางวัลก็ได้ป้ายประจำตัวจากสถิติของตัวเอง</p><a href="bank.html">จัดการคลังคำถาม</a>` },
  ];
  function setTab(i) {
    document.querySelectorAll('.tabbtn').forEach(b => b.classList.toggle('on', +b.dataset.tab === i));
    const t = TABS[i];
    $('tabtext').innerHTML = `<div class="tp"><div class="kpis">${t.kpis.map(k => `<span class="tag">${k}</span>`).join('')}</div>${t.html}</div>`;
  }
  document.querySelectorAll('.tabbtn').forEach(b => b.onclick = () => setTab(+b.dataset.tab));
  setTab(0);

  // ---------- แครูเซล ----------
  const slides = [...document.querySelectorAll('.slide')], dots = [...$('dots').children];
  let cur = 0, carTimer = null;
  function go(i) { cur = (i + slides.length) % slides.length; slides.forEach((s, k) => s.classList.toggle('on', k === cur)); dots.forEach((d, k) => d.classList.toggle('on', k === cur)); }
  dots.forEach((d, k) => d.onclick = () => { go(k); restart(); });
  function restart() { clearInterval(carTimer); if (!reduced) carTimer = setInterval(() => go(cur + 1), 5000); }
  restart();
  requestAnimationFrame(() => { Art.portrait($('mock-ph-art'), 0, { scale: 0.32 }); Art.portrait($('mock-ph-art2'), 1, { scale: 0.32 }); });
  // QR จำลอง (ลวดลายสุ่ม + มุมตำแหน่ง 3 จุด) — ไม่ใช่ลิงก์จริง
  (() => {
    const c = $('qrfake').getContext('2d'), n = 29; let s = 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    c.fillStyle = '#fff'; c.fillRect(0, 0, n, n); c.fillStyle = '#000';
    for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) if (rnd() < 0.48) c.fillRect(x, y, 1, 1);
    const finder = (x, y) => { c.fillStyle = '#fff'; c.fillRect(x - 1, y - 1, 9, 9); c.fillStyle = '#000'; c.fillRect(x, y, 7, 7); c.fillStyle = '#fff'; c.fillRect(x + 1, y + 1, 5, 5); c.fillStyle = '#000'; c.fillRect(x + 2, y + 2, 3, 3); };
    finder(1, 1); finder(n - 8, 1); finder(1, n - 8);
  })();

  // ---------- แกลเลอรี ----------
  const CARDS = [
    [
      { tag: 'HERO', team: 0, meta: 'CRIMSON · ตอบถูก 3 ข้อ', title: 'Ricochet', desc: 'ยึดช่องทีไร ยิงเลเซอร์เด้งกำแพงทุกที', handle: 'ทีมคริมสัน' },
      { tag: 'HERO', team: 1, meta: 'MAGENTA · ตอบถูก 3 ข้อ', title: 'Splitter', desc: 'แตกตัวเป็นลูกสมุนที่ไล่กัดศัตรูเอง', handle: 'ทีมมาเจนตา' },
      { tag: 'HERO', team: 2, meta: 'AZURE · ตอบถูก 3 ข้อ', title: 'Blaster', desc: 'ระเบิดกากบาทรอบตัว ทุบช่องล็อกได้แรง', handle: 'ทีมอาซัวร์' },
      { tag: 'HERO', team: 3, meta: 'LIME · ตอบถูก 3 ข้อ', title: 'Surger', desc: 'พุ่งทิ้งทางสีกว้าง 3 ช่อง ตัดพื้นที่ศัตรู', handle: 'ทีมไลม์' },
      { tag: 'BONUS', team: 2, fx: 'shield', meta: 'ถูกติดกัน 5 ข้อ', title: 'Quick lock', desc: 'ช่องของทีมล็อกใน 2 วินาที นาน 10 วินาที', handle: 'ทุกทีม' },
      { tag: 'BONUS', team: 2, fx: 'freeze', alt: 1, meta: 'ถูกติดกัน 8 ข้อ', title: 'Freeze', desc: 'ศัตรูทั้งกระดานหยุดนิ่ง 4 วินาที', handle: 'ทุกทีม' },
      { tag: 'BONUS', team: 3, fx: 'speed', meta: '3 คนปล่อยใน 3 วิ', title: 'Team combo', desc: 'ทั้งทีมวิ่งเร็ว 2 เท่า + ฟื้นพลัง', handle: 'ทุกทีม' },
    ],
    [
      { tag: 'SKILL', team: 0, fx: 'laser', meta: 'ปล่อยครบ 3 ครั้ง', title: 'Laser storm', desc: 'เลเซอร์ 10 ทิศ เด้งกำแพง 3 ครั้ง', handle: 'พายุเลเซอร์' },
      { tag: 'SKILL', team: 1, fx: 'swarm', meta: 'ปล่อยครบ 3 ครั้ง', title: 'Swarm', desc: 'ลูกสมุน 12 ตัวโผล่ทั่วกระดานพร้อมกัน', handle: 'ฝูงแตกตัว' },
      { tag: 'SKILL', team: 2, fx: 'blast', meta: 'ปล่อยครบ 3 ครั้ง', title: 'Mega blast', desc: 'ระเบิดวงใหญ่ตรงจุดที่ศัตรูแน่นที่สุด', handle: 'ระเบิดมหาประลัย' },
      { tag: 'SKILL', team: 3, fx: 'wave', meta: 'ปล่อยครบ 3 ครั้ง', title: 'Tidal wave', desc: 'คลื่นกวาด 5 แถว ทุบช่องที่ล็อกแล้ว', handle: 'คลื่นยักษ์' },
      { tag: 'AWARD', team: 2, emoji: '⚡', meta: 'ถูกอย่างน้อย 5 ข้อ', title: 'Lightning', desc: 'ตอบถูกเร็วที่สุดโดยเฉลี่ย', handle: 'สายฟ้าแลบ' },
      { tag: 'AWARD', team: 3, emoji: '🦸', meta: 'ตอนทีมตามหลัง', title: 'Comeback', desc: 'ปล่อยแล้วทีมได้ช่องเพิ่มมากที่สุดใน 6 วิ', handle: 'ผู้พลิกเกม' },
      { tag: 'AWARD', team: 0, emoji: '💥', meta: 'สกิลพิเศษ', title: 'Skill king', desc: 'ใช้สกิลพิเศษสำเร็จมากที่สุด', handle: 'ราชาสกิล' },
    ],
  ];
  const gal = $('gallery');
  CARDS.forEach((row, ri) => {
    const r = document.createElement('div'); r.className = 'grow-row' + (ri ? ' offset' : '');
    row.forEach((c, ci) => {
      const el = document.createElement('article'); el.className = 'gcard';
      el.innerHTML = `<canvas></canvas><span class="tag tag-glass">${c.tag}</span><div class="gcap glass" style="text-align:left"><div class="meta">${c.meta}</div><div class="ttl">${c.title}</div><div class="desc">${c.desc}</div><div class="handle"><i style="background:${T[c.team].color}"></i>${c.handle}</div></div>`;
      r.appendChild(el);
      c.seed = ri * 10 + ci + 1;
    });
    gal.appendChild(r);
  });
  // วาดปกทันที (clientWidth บังคับเลย์เอาต์ให้แล้ว) — ไม่รอ rAF เพราะ rAF หยุดตอนแท็บถูกซ่อน
  const drawCovers = () => { const cards = gal.querySelectorAll('.gcard canvas'); let i = 0; CARDS.flat().forEach(c => Art.cover(cards[i++], c)); };
  drawCovers();
  if (document.fonts) document.fonts.ready.then(drawCovers);
  let rz = null; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(drawCovers, 200); });

  // ---------- เมนูนำทาง: ไฮไลต์ส่วนที่กำลังดู ----------
  const links = [...document.querySelectorAll('.nav a.lnk')];
  const io = new IntersectionObserver((ents) => ents.forEach(e => { if (e.isIntersecting) links.forEach(l => l.classList.toggle('on', l.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
  ['overview', 'capabilities', 'discover', 'access'].forEach(id => io.observe($(id)));
})();

// เพลงชิลหน้าแรก + ปุ่มเปิด/ปิดเสียง
(function () {
  if (typeof SFX === "undefined") return;
  SFX.ambient();
  const b = document.createElement("button");
  b.textContent = "🔊 เพลง"; b.setAttribute("aria-label", "เปิด/ปิดเพลง");
  b.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:99;padding:10px 16px;border-radius:999px;border:0;background:#fff;color:#0a0a0a;font:600 14px Kanit,sans-serif;cursor:pointer";
  b.onclick = (e) => { e.stopPropagation(); SFX.ensure(); SFX.setMuted(!SFX.isMuted()); b.textContent = SFX.isMuted() ? "🔇 เพลง" : "🔊 เพลง"; };
  document.body.appendChild(b);
})();
