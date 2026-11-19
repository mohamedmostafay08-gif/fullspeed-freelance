// Full Speed Network — Freelancer app
import {
  sb, $, $$, esc, money, fmtDate, today, daysBetween, normMobile, authEmailFor, waLink, logoImg, logoSrc, toast, modal, errMsg, busy,
  GOVS, VEHICLES, CAND_STATUS, WD_STATUS, chip,
} from './shared/common.js';

const S = { summary: null, companies: [], rules: [], jobs: null, cands: null, ledger: null, view: 'home', cStatus: '', walletTab: 'earn' };
const T0 = performance.now();
const show = (id) => { ['auth', 'waiting', 'app'].forEach((x) => $('#' + x).classList.toggle('hidden', x !== id)); hideSplash(); };
function hideSplash() {
  const el = $('#splash');
  if (!el || el.dataset.out) return;
  el.dataset.out = '1';
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 900); }, Math.max(0, 1100 - (performance.now() - T0)));
}
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } },
};
const ukey = (k) => `fsf-${k}-${S.summary?.freelancer?.id || 'x'}`;

function applyTheme(v) {
  if (v === 'dark' || v === 'light') document.documentElement.dataset.theme = v; else delete document.documentElement.dataset.theme;
  const dark = v === 'dark' || (!v && matchMedia('(prefers-color-scheme: dark)').matches);
  $('meta[name=theme-color]').content = dark ? '#0e1411' : '#f6f7f3';
}
applyTheme(store.get('fsf-theme', ''));
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme(store.get('fsf-theme', '')));

// Hide the floating dock while the on-screen keyboard is up.
const isTextField = (el) => el?.matches?.('input:not([type=radio]):not([type=checkbox]),select,textarea');
document.addEventListener('focusin', (e) => { if (isTextField(e.target)) document.body.classList.add('kb'); });
document.addEventListener('focusout', () => setTimeout(() => { if (!isTextField(document.activeElement)) document.body.classList.remove('kb'); }, 120));

let installEvt = null;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); installEvt = e;
  if (S.view === 'home' && !$('#installCard') && $('.level')) { $('.level').insertAdjacentHTML('afterend', installCard()); bindInstall(); }
});
function installCard() {
  if (standalone() || store.get('fsf-install-x', 0) || (!installEvt && !isIOS)) return '';
  return `<div class="install rise" id="installCard"><img src="brand/fs-icon-192.png" alt="">
    <div class="grow"><b>ثبّت التطبيق على موبايلك</b><span>${installEvt ? 'يفتح بسرعة وعلى الشاشة كلها زي أي تطبيق' : 'من زرار المشاركة ⬆️ في Safari اختار "إضافة إلى الشاشة الرئيسية"'}</span></div>
    ${installEvt ? '<button class="btn pri sm" data-install>ثبّت</button>' : ''}<button class="x" data-install-x aria-label="إخفاء">×</button></div>`;
}
function bindInstall() {
  const c = $('#installCard'); if (!c) return;
  const b = $('[data-install]', c);
  if (b) b.onclick = async () => {
    installEvt.prompt();
    const r = await installEvt.userChoice.catch(() => null);
    installEvt = null; c.remove();
    if (r?.outcome === 'accepted') { confetti(); toast('تم تثبيت التطبيق 🎉', 'ok'); }
  };
  $('[data-install-x]', c).onclick = () => { store.set('fsf-install-x', 1); c.remove(); };
}
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const buzz = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* unsupported */ } };

// ------------------------------------------------------------------ ui helpers
const svg = (p, w = 1.9) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const IC = {
  plus: svg('<path d="M12 5v14M5 12h14"/>', 2.2),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-6 6.5-6s5.9 2.4 6.5 6"/><circle cx="17" cy="9" r="2.6"/><path d="M17 14c2.5 0 4.3 1.8 4.8 4.5"/>'),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 2.4),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  gift: svg('<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7M12 8v13M12 8S10.5 3 8 3.5 7 8 12 8Zm0 0s1.5-5 4-4.5S17 8 12 8Z"/>'),
  pin: svg('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  share: svg('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  cash: svg('<rect x="2" y="6" width="20" height="12" rx="3"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>'),
  doc: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
  star: svg('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
  trend: svg('<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>'),
  chat: svg('<path d="M20 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.2A8.5 8.5 0 1 1 20 11.5Z"/>'),
  chev: svg('<path d="M15 6l-6 6 6 6"/>', 2.2),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5"/>'),
  lock: svg('<rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  logout: svg('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>'),
  send: svg('<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>'),
};
const VEH_EMOJI = { 'موتوسيكل': '🏍️', 'سيارة': '🚗', 'دراجة / اسكوتر': '🛴', 'تروسيكل': '🛺', 'مترجل (بدون مركبة)': '🚶' };
const METHODS = [['فودافون كاش', '#e60000'], ['اتصالات كاش', '#6fae1c'], ['أورنج كاش', '#ff7900'], ['وي باي', '#6b2fa0'], ['إنستاباي InstaPay', '#3b2a8c'], ['تحويل بنكي', '#1f6feb']];
const LEVELS = [
  { n: 'مبتدئ', min: 0, c: '#8a86a8', i: '🌱' }, { n: 'برونزي', min: 1, c: '#c8661b', i: '🥉' },
  { n: 'فضي', min: 5, c: '#64748b', i: '🥈' }, { n: 'ذهبي', min: 15, c: '#c99400', i: '🥇' }, { n: 'ماسي', min: 30, c: '#7b5cff', i: '💎' },
];

const hue = (s) => { let h = 7; for (const ch of String(s || '')) h = (h * 31 + ch.codePointAt(0)) % 360; return h; };
const initials = (name) => String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('') || '؟';
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'صباح الخير ☀️' : h < 18 ? 'يومك سعيد 🌤️' : 'مساء الخير 🌙'; };
function level(hired) {
  let i = 0; LEVELS.forEach((l, k) => { if (hired >= l.min) i = k; });
  const cur = LEVELS[i], next = LEVELS[i + 1];
  return { ...cur, next, left: next ? next.min - hired : 0, pct: next ? Math.round(((hired - cur.min) / (next.min - cur.min)) * 100) : 100 };
}
const empty = (ic, title, text, cta = '') => `<div class="empty-s rise"><span class="e-ic">${ic}</span><b>${esc(title)}</b><p>${esc(text)}</p>${cta ? `<button class="btn pri" data-empty-cta>${IC.plus} ${esc(cta)}</button>` : ''}</div>`;

// Bonus tiers are cumulative: the partner is owed the highest reached tier's amount (see accrue_candidate in the DB).
function ladderOf(companyId) {
  const rs = S.rules.filter((r) => r.company_id === companyId);
  const paper = Number(rs.find((r) => r.kind === 'paper')?.amount) || 0;
  let cum = 0;
  const tiers = rs.filter((r) => r.kind === 'days').sort((a, b) => a.min_days - b.min_days).map((r) => {
    const total = Math.max(cum, Number(r.amount) || 0), inc = total - cum; cum = total;
    return { days: r.min_days, inc, total };
  }).filter((t) => t.inc > 0);
  return { paper, tiers, max: paper + cum };
}
const ageDays = (d) => (d ? daysBetween(String(d).slice(0, 10), today()) : 0);
function stallOf(c) {
  if (c.status === 'rejected' || c.status === 'suspended') return null;
  if (!c.paper_date && ageDays(c.created_at) >= 5) return `بقاله ${ageDays(c.created_at)} يوم من غير ورق`;
  if (c.paper_date && !c.start_date && ageDays(c.paper_date) >= 5) return `خلّص ورقه من ${ageDays(c.paper_date)} يوم ولسه مبدأش شغل`;
  return null;
}
function earnedByCand() {
  const m = {};
  (S.ledger || []).filter((l) => !l.reversed_at && l.candidate_id).forEach((l) => { m[l.candidate_id] = (m[l.candidate_id] || 0) + Number(l.amount); });
  return m;
}
// Egyptian work week starts Saturday.
function weekStats() {
  if (!S.cands) return null;
  const now = new Date(), start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 1) % 7));
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const s0 = iso(start), s1 = iso(new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7));
  const inW = (d, a, b) => d && String(d).slice(0, 10) >= a && (!b || String(d).slice(0, 10) < b);
  const calc = (a, b) => ({
    earned: (S.ledger || []).filter((l) => !l.reversed_at && inW(l.earned_on, a, b)).reduce((t, l) => t + Number(l.amount), 0),
    sent: S.cands.filter((c) => inW(c.created_at, a, b)).length,
    started: S.cands.filter((c) => inW(c.start_date, a, b)).length,
  });
  return { cur: calc(s0), prev: calc(s1, s0) };
}
function forecast() {
  if (!S.cands) return null;
  const earned = earnedByCand(); const f = { active: 0, pending: 0, na: 0, np: 0 };
  S.cands.forEach((c) => {
    const rest = Math.max(0, ladderOf(c.company_id).max - (earned[c.id] || 0));
    if (!rest) return;
    if (c.status === 'hired' && !(c.end_date && c.end_date < today())) { f.active += rest; f.na++; }
    else if (c.status === 'submitted' || c.status === 'new') { f.pending += rest; f.np++; }
  });
  return f;
}
const jobIsNew = (j, seen) => !!(seen && j.created_at && new Date(j.created_at) > new Date(seen));
function updateJobsBadge() {
  const seen = store.get(ukey('seen'), null), n = (S.jobs || []).filter((j) => jobIsNew(j, seen)).length;
  const b = $('#jobsBadge'); b.textContent = n > 9 ? '9+' : n; b.hidden = !n;
}

function maybeTour(force) {
  if (!force && store.get(ukey('tour'), 0)) return;
  setTimeout(tour, force ? 0 : 1300);
}
function tour() {
  if ($('.tour')) return;
  const maxP = Math.max(0, ...S.companies.filter((c) => c.active).map((c) => ladderOf(c.id).max));
  const slides = [
    { c: 'var(--g)', ic: '🚀', t: 'أهلاً بيك في Full Speed Partners', d: 'رشّح مناديب للشركات اللي بنشتغل معاها، واكسب بونص عن كل مندوب يتعيّن ويكمّل شغل.' },
    { c: 'var(--orange)', ic: '➕', t: 'رشّح في ثواني', d: 'دوس على الزرار الكبير اللي في النص تحت، اكتب اسم المندوب ورقمه وابعت. أو رشّح على وظيفة معينة من تبويب الوظائف.' },
    { c: 'var(--sun)', ic: '💰', t: 'بونصك بيكبر مع كل يوم', d: `بتاخد بونص أول ما المندوب يخلّص ورقه، وبونص أكبر كل ما يكمّل أيام شغل${maxP ? ` — لحد ${money(maxP)} للمندوب الواحد` : ''}.` },
    { c: 'var(--sky)', ic: '💸', t: 'اسحب فلوسك وقت ما تحب', d: 'من المحفظة اطلب سحب على فودافون كاش أو إنستاباي أو حسابك البنكي، وتابع طلبك خطوة بخطوة.' },
  ];
  let i = 0;
  const el = document.createElement('div');
  el.className = 'tour';
  el.innerHTML = `<div class="tour-card" role="dialog" aria-modal="true" aria-label="جولة تعريفية">
    <button class="tour-skip" data-skip>تخطي</button><div class="tour-stage"></div>
    <div class="tour-dots">${slides.map(() => '<i></i>').join('')}</div><button class="btn pri block" data-next></button></div>`;
  document.body.appendChild(el);
  const render = () => {
    const s = slides[i];
    $('.tour-stage', el).innerHTML = `<div class="tour-slide" style="--c:${s.c}"><div class="tour-art">${s.ic}</div><h2>${esc(s.t)}</h2><p>${esc(s.d)}</p></div>`;
    $$('.tour-dots i', el).forEach((d, k) => d.classList.toggle('on', k === i));
    $('[data-next]', el).textContent = i === slides.length - 1 ? 'يلا نبدأ 🚀' : 'التالي';
  };
  const step = (dir) => { const n = i + dir; if (n < 0 || n >= slides.length) return; i = n; buzz(5); render(); };
  const close = (done) => { store.set(ukey('tour'), 1); el.classList.add('out'); setTimeout(() => el.remove(), 300); if (done) confetti(); };
  $('[data-next]', el).onclick = () => (i < slides.length - 1 ? step(1) : close(true));
  $('[data-skip]', el).onclick = () => close(false);
  let x0 = null;
  el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) step(dx > 0 ? 1 : -1);
  });
  render();
}

function countUps(root) {
  $$('[data-count]', root).forEach((el) => {
    const to = Number(el.dataset.count) || 0, isMoney = 'money' in el.dataset;
    const fmt = (v) => (isMoney ? money(v) : Math.round(v).toLocaleString('en-US'));
    if (reduceMotion || !to) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = 950;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = p < 1 ? fmt(isMoney ? Math.round(to * e) : to * e) : fmt(to);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
function animateIn(root) {
  countUps(root);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$('[data-w]', root).forEach((e) => { e.style.width = e.dataset.w + '%'; });
    $$('[data-hh]', root).forEach((e) => { e.style.height = e.dataset.hh + '%'; });
    $$('[data-off]', root).forEach((e) => { e.style.strokeDashoffset = e.dataset.off; });
  }));
}
function confetti() {
  if (reduceMotion) return;
  const c = document.createElement('canvas'); c.className = 'confetti'; document.body.appendChild(c);
  const dpr = devicePixelRatio || 1, W = (c.width = innerWidth * dpr), H = (c.height = innerHeight * dpr), x = c.getContext('2d');
  const cols = ['#12b981', '#7b5cff', '#f0478a', '#f97c2c', '#1aa9ec', '#f5b70a'];
  const P = Array.from({ length: 150 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.4, vx: (Math.random() - 0.5) * 18 * dpr, vy: (Math.random() * -15 - 6) * dpr,
    s: (Math.random() * 6 + 5) * dpr, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.35, c: cols[(Math.random() * cols.length) | 0],
  }));
  const t0 = performance.now();
  (function frame(t) {
    x.clearRect(0, 0, W, H);
    P.forEach((p) => {
      p.vy += 0.42 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore();
    });
    if (t - t0 < 2400) requestAnimationFrame(frame); else c.remove();
  })(t0);
}

// ------------------------------------------------------------------ auth
$$('[data-govs]').forEach((sel) => { sel.innerHTML = '<option value="">اختار...</option>' + GOVS.map((g) => `<option>${g}</option>`).join(''); });
$$('.seg button').forEach((b) => b.onclick = () => {
  $$('.seg button').forEach((x) => x.classList.toggle('on', x === b));
  $('.seg').dataset.on = b.dataset.tab;
  $('#loginForm').classList.toggle('hidden', b.dataset.tab !== 'login');
  $('#regForm').classList.toggle('hidden', b.dataset.tab !== 'register');
});

$('#loginForm').onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target, err = $('[data-err]', f);
  err.textContent = '';
  await busy($('button', f), async () => {
    if (f.id.value.includes('@')) { err.textContent = 'الدخول برقم الموبايل اللي سجلت بيه.'; return; }
    const mob = normMobile(f.id.value);
    if (mob.length < 9) { err.textContent = 'اكتب رقم موبايل صحيح.'; return; }
    const { error } = await sb.auth.signInWithPassword({ email: authEmailFor(mob), password: f.pw.value });
    if (error) { err.textContent = errMsg(error); return; }
    await boot();
  });
};

$('#regForm').onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target, err = $('[data-err]', f);
  err.textContent = '';
  const mobile = normMobile(f.mobile.value);
  if (!/^1[0125]\d{8}$/.test(mobile)) { err.textContent = 'اكتب رقم موبايل مصري صحيح (11 رقم يبدأ بـ 01).'; return; }
  if (f.pw.value !== f.pw2.value) { err.textContent = 'كلمتين المرور مش متطابقين.'; return; }
  await busy($('button', f), async () => {
    const { error } = await sb.auth.signUp({
      email: authEmailFor(mobile), password: f.pw.value,
      options: { data: { kind: 'freelancer', name: f.name.value.trim(), mobile: f.mobile.value.trim(), email: f.email.value.trim(), gov: f.gov.value, region: f.region.value.trim() } },
    });
    if (error) { err.textContent = errMsg(error); return; }
    const { data } = await sb.auth.getSession();
    if (!data.session) { await sb.auth.signInWithPassword({ email: authEmailFor(mobile), password: f.pw.value }); }
    toast('تم إنشاء حسابك ✅', 'ok');
    await boot();
  });
};

const logout = async () => { await sb.auth.signOut(); location.reload(); };
$$('[data-logout]').forEach((b) => b.onclick = logout);
$('#waitRefresh').onclick = () => boot();

// ------------------------------------------------------------------ boot
async function boot() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return show('auth');
  const { data: sum, error } = await sb.rpc('my_summary');
  if (error) { toast(errMsg(error), 'bad'); return show('auth'); }
  if (!sum?.freelancer) {
    await sb.auth.signOut();
    toast('الحساب ده مش حساب شريك.', 'bad');
    return show('auth');
  }
  S.summary = sum;
  const st = sum.freelancer.status;
  if (st !== 'Active') {
    $('#waitTitle').textContent = st === 'Pending' ? 'حسابك قيد المراجعة' : st === 'Hold' ? 'حسابك معلّق مؤقتاً' : 'حسابك موقوف';
    $('#waitText').textContent = st === 'Pending' ? 'الإدارة هتراجع بياناتك وتفعّل حسابك قريب.' : 'لو محتاج تفاصيل كلم الإدارة.';
    return show('waiting');
  }
  $('#greet').textContent = greeting();
  $('#hello').textContent = (sum.freelancer.name || '').split(' ')[0] || 'أهلاً';
  $('#av').textContent = initials(sum.freelancer.name);
  updateLevelChip();
  show('app');
  const [c, r] = await Promise.all([
    sb.from('companies').select('id,name,logo_url,full_amount,target_days,active').order('name'),
    sb.from('bonus_rules').select('company_id,kind,min_days,amount').eq('active', true),
  ]);
  S.companies = c.data ?? []; S.rules = r.data ?? [];
  S.jobs = S.cands = S.ledger = null;
  go(S.view);
  maybeTour();
}
function updateLevelChip() {
  const lv = level(S.summary?.counts?.hired || 0);
  const el = $('#lvChip'); el.textContent = `${lv.i} ${lv.n}`; el.style.setProperty('--lc', lv.c);
}

// ------------------------------------------------------------------ nav
$$('.dock [data-go]').forEach((b) => b.onclick = () => { buzz(5); go(b.dataset.go); });
$('#fab').onclick = () => addCourier();
$('#meBtn').onclick = () => go('me');
$('#lvChip').onclick = () => go('me');
function go(v) {
  S.view = v;
  $$('.dock [data-go]').forEach((b) => b.classList.toggle('on', b.dataset.go === v));
  window.scrollTo(0, 0);
  ({ home, jobs, couriers, wallet, me })[v]();
}
const view = (html) => {
  const el = $('#view');
  el.innerHTML = html;
  el.classList.remove('page'); void el.offsetWidth; el.classList.add('page');
  animateIn(el);
};
const loading = () => { $('#view').innerHTML = '<div class="sk-wrap"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div>'; };

async function refreshSummary() {
  const { data } = await sb.rpc('my_summary');
  if (data?.freelancer) { S.summary = data; updateLevelChip(); }
}
async function loadJobs() {
  if (S.jobs) return null;
  const { data, error } = await sb.rpc('list_open_jobs');
  if (error) return error;
  S.jobs = data;
  return null;
}
async function loadCands(force) {
  if (S.cands && !force) return;
  const [a, b] = await Promise.all([
    sb.from('candidates').select('id,code,name,mobile,company_id,company_name,job_id,vehicle,gov,region,status,paper_date,start_date,end_date,created_at').order('created_at', { ascending: false }),
    sb.from('bonus_ledger').select('id,candidate_id,kind,tier_days,amount,earned_on,reversed_at,note').order('created_at', { ascending: false }),
  ]);
  if (a.error) throw a.error;
  S.cands = a.data; S.ledger = b.data ?? [];
}
const compName = (c) => S.companies.find((x) => x.id === c.company_id)?.name || c.company_name || '—';
const targetDays = (companyId) => {
  const t = S.rules.filter((r) => r.company_id === companyId && r.kind === 'days').map((r) => r.min_days);
  return t.length ? Math.max(...t) : 26;
};
const findJob = (id) => S.jobs?.find((j) => String(j.id) === id);
function bindJobActions(root) {
  $$('[data-apply]', root).forEach((b) => b.onclick = () => addCourier(findJob(b.dataset.apply)));
  $$('[data-share]', root).forEach((b) => b.onclick = () => shareSheet(findJob(b.dataset.share)));
  $$('.calc', root).forEach((c) => c.onclick = (e) => {
    const b = e.target.closest('[data-d]'); if (!b) return;
    const n = Math.min(20, Math.max(1, Number(c.dataset.n) + Number(b.dataset.d)));
    c.dataset.n = n; $('b', c).textContent = n;
    const s = $('strong', c); s.textContent = money(n * Number(c.dataset.max));
    s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump'); buzz(4);
  });
}
function bindPills(root, st, render) {
  $$('.pills', root).forEach((p) => p.onclick = (e) => {
    const b = e.target.closest('.pill'); if (!b) return;
    $$('.pill', p).forEach((x) => x.classList.toggle('on', x === b));
    st[p.dataset.f] = b.dataset.v; buzz(4); render();
  });
}

// ------------------------------------------------------------------ home
async function home() {
  if (!S.summary) loading();
  await Promise.all([refreshSummary(), loadJobs(), loadCands().catch(() => {})]);
  updateJobsBadge();
  const s = S.summary, b = s.balance || {}, n = s.counts || {};
  const fc = forecast();
  const stalled = (S.cands || []).map((c) => ({ c, why: stallOf(c) })).filter((x) => x.why);
  const fcBig = fc ? fc.active || fc.pending : 0;
  const wk = weekStats();
  const delta = (a, b, isMoney) => (a === b ? '<i class="wk-d eq">= زي اللي فات</i>'
    : `<i class="wk-d ${a > b ? 'up' : 'down'}">${a > b ? '▲' : '▼'} ${isMoney ? money(Math.abs(a - b)) : Math.abs(a - b)}</i>`);
  const lv = level(n.hired || 0);
  const bonusTotal = (Number(b.paper_earned) || 0) + (Number(b.days_earned) || 0);
  const top = (S.jobs || []).slice(0, 6);
  const tile = (c, ic, val, lbl, nav, opts = '') => `<button class="tile rise" style="--c:${c};--i:${opts.i || 2}" data-nav="${nav}"><span class="t-ic">${ic}</span>${val}<div class="t-lbl">${lbl}</div>${opts.sub || ''}</button>`;
  view(`
    <section class="wallet">
      <span class="orb o1"></span><span class="orb o2"></span><span class="orb o3"></span>
      <div class="w-head"><span class="w-lbl">رصيدك المتاح للسحب</span><button class="glass-btn" data-nav="wallet">${IC.cash} اسحب</button></div>
      <div class="w-big" data-count="${Number(b.balance) || 0}" data-money>${money(0)}</div>
      <div class="w-pills">
        <div><span>إجمالي أرباحك</span><b data-count="${Number(b.total_earned) || 0}" data-money>${money(0)}</b></div>
        <div><span>اتصرف لك</span><b data-count="${Number(b.paid) || 0}" data-money>${money(0)}</b></div>
        <div><span>قيد المراجعة</span><b data-count="${Number(b.pending) || 0}" data-money>${money(0)}</b></div>
      </div>
    </section>

    <button class="level rise" style="--i:1;--lc:${lv.c}" data-nav="me">
      <span class="lv-medal">${lv.i}</span>
      <span class="grow">
        <span class="lv-top"><span>مستواك</span><b>${lv.n}</b></span>
        <span class="lv-bar" style="display:block"><i data-w="${lv.pct}"></i></span>
        <span class="lv-txt" style="display:block">${lv.next
          ? `فاضل <b>${lv.left}</b> ${lv.left === 1 ? 'مندوب شغال' : 'مناديب شغالين'} وتوصل لـ ${lv.next.i} ${lv.next.n}`
          : 'وصلت لأعلى مستوى 👑 كمّل كده!'}</span>
      </span>
    </button>
    ${installCard()}

    ${fcBig ? `<button class="fcast rise" style="--i:2" data-nav="couriers:${fc.active ? 'hired' : ''}">
      <span class="fc-ic">🚀</span>
      <span class="grow">
        <span class="fc-l">${fc.active ? 'أرباح جاية في السكة' : 'ممكن تكسب'}</span>
        <b data-count="${fcBig}" data-money>${money(0)}</b>
        <span class="fc-s">${fc.active
          ? `من ${fc.na} ${fc.na === 1 ? 'مندوب شغال' : 'مناديب شغالين'} لو كمّلوا لآخر شريحة${fc.pending ? ` · و<b>${money(fc.pending)}</b> كمان لو اللي تحت المراجعة اتعيّنوا` : ''}`
          : `لو الـ ${fc.np} ${fc.np === 1 ? 'مندوب' : 'مناديب'} اللي تحت المراجعة اتعيّنوا وكمّلوا`}</span>
      </span>
    </button>` : ''}

    ${wk ? `<section class="week rise" style="--i:3">
      <div class="wk-h"><b>📊 أسبوعك</b><span>من السبت لحد النهارده</span></div>
      <div class="wk-g">
        <div><span>كسبت</span><b>${money(wk.cur.earned)}</b>${delta(wk.cur.earned, wk.prev.earned, true)}</div>
        <div><span>رشّحت</span><b>${wk.cur.sent}</b>${delta(wk.cur.sent, wk.prev.sent)}</div>
        <div><span>بدأوا شغل</span><b>${wk.cur.started}</b>${delta(wk.cur.started, wk.prev.started)}</div>
      </div>
      ${!wk.cur.sent && !wk.cur.earned ? '<p class="wk-tip">الأسبوع لسه في أوله 💪 رشّح مندوب النهارده وابدأ بقوة.</p>' : ''}
    </section>` : ''}

    ${stalled.length ? `<section class="follow rise" style="--i:3">
      <div class="fl-h"><b>⚠️ محتاجين متابعة منك</b><button class="link" data-nav="couriers:">الكل ${IC.chev}</button></div>
      ${stalled.slice(0, 3).map(({ c, why }) => `<div class="fl-row">
        <div class="cav sm" style="--h:${hue(c.name)}">${esc(initials(c.name))}</div>
        <div class="grow"><b>${esc(c.name)}</b><span>${esc(why)}</span></div>
        <a class="ibtn wa" href="${waLink(c.mobile)}" target="_blank" rel="noopener" aria-label="كلّم ${esc(c.name)} واتساب">${IC.chat}</a>
      </div>`).join('')}
      ${stalled.length > 3 ? `<div class="fl-more">و${stalled.length - 3} كمان محتاجين متابعة</div>` : ''}
    </section>` : ''}

    <div class="tiles">
      ${tile('var(--sky)', IC.users, `<div class="t-val" data-count="${n.total ?? 0}">0</div>`, 'مناديب رشّحتهم', 'couriers:', { i: 2 })}
      ${tile('var(--g)', IC.check, `<div class="t-val" data-count="${n.hired ?? 0}">0</div>`, 'اتعيّنوا وشغالين', 'couriers:hired', { i: 3 })}
      ${tile('var(--orange)', IC.clock, `<div class="t-val" data-count="${n.pending ?? 0}">0</div>`, 'تحت المراجعة', 'couriers:submitted', { i: 4 })}
      ${tile('var(--sun)', IC.gift, `<div class="t-val sm" data-count="${bonusTotal}" data-money>${money(0)}</div>`, 'أرباح البونص', 'wallet',
        { i: 5, sub: `<span class="t-sub">ورق ${money(b.paper_earned)} · أيام ${money(b.days_earned)}</span>` })}
    </div>

    ${top.length ? `
      <div class="sec-h rise" style="--i:6"><h3>وظائف مستنياك 🔥</h3><button class="link" data-nav="jobs">شوف الكل ${IC.chev}</button></div>
      <div class="carousel">${top.map((j, i) => miniJob(j, i)).join('')}</div>` : ''}

    <div class="sec-h"><h3>إزاي بتكسب؟</h3></div>
    <ol class="journey rise" style="--i:7">
      <li style="--c:var(--orange)"><i>1</i><div><b>رشّح مندوب</b><span>اختار وظيفة وابعت بيانات المندوب في ثواني.</span></div></li>
      <li style="--c:var(--sky)"><i>2</i><div><b>بونص الورق</b><span>أول ما المندوب يكمّل ورقه بتاخد بونص.</span></div></li>
      <li style="--c:var(--sun)"><i>3</i><div><b>بونص الأيام</b><span>كل ما يكمّل أيام شغل بونصك يكبر لحد البونص الكامل للشركة.</span></div></li>
      <li style="--c:var(--g)"><i>4</i><div><b>اسحب فلوسك</b><span>فودافون كاش، إنستاباي أو تحويل بنكي.</span></div></li>
    </ol>
    ${partnersStrip()}`);
  $$('[data-nav]').forEach((el) => el.onclick = () => {
    buzz(5);
    const [v, st] = el.dataset.nav.split(':');
    if (v === 'couriers') S.cStatus = st || '';
    go(v);
  });
  bindJobActions($('#view'));
  bindInstall();
}
function jobLogo(j) {
  const txt = (j.company || '?').slice(0, 2);
  return `<div class="jlogo">${j.logo_url ? logoImg(j.logo_url, txt) : esc(txt)}</div>`;
}
function partnersStrip() {
  const cs = S.companies.filter((c) => c.active && c.logo_url);
  if (cs.length < 3) return '';
  const row = cs.map((c) => `<span class="pl" title="${esc(c.name)}">${logoImg(c.logo_url, c.name.slice(0, 2))}</span>`).join('');
  return `<div class="sec-h"><h3>بنشتغل مع أكبر الشركات 🤝</h3></div>
    <div class="marquee" aria-label="الشركات"><div class="mq-track">${row}${row}</div></div>`;
}
function miniJob(j, i) {
  return `<article class="mjob rise" style="--h:${hue(j.company)};--i:${6 + Math.min(i, 3)}">
    <div class="mj-top">${jobLogo(j)}<div class="mj-t"><b>${esc(j.title)}</b><span>${esc(j.company)}</span></div></div>
    <div class="mj-loc">${IC.pin}<span>${esc(j.gov || '—')}${j.region ? ' — ' + esc(j.region) : ''}</span></div>
    <div class="mj-bonus">${IC.gift}<span>${esc(j.bonus_text || 'بونص للشريك')}</span></div>
    <button class="btn pri sm block" data-apply="${esc(j.id)}">${IC.plus} رشّح مندوب</button>
  </article>`;
}

// ------------------------------------------------------------------ jobs
async function jobs() {
  if (!S.jobs) loading();
  const err = await loadJobs();
  if (err) return view(empty('⚠️', 'مقدرناش نحمّل الوظائف', errMsg(err)));
  const govs = [...new Set(S.jobs.map((j) => j.gov).filter(Boolean))];
  const st = { q: '', gov: '', veh: '', only: '' };
  JOBCTX.seen = store.get(ukey('seen'), null);
  JOBCTX.fav = new Set(store.get(ukey('fav'), []));
  const myGov = S.summary.freelancer.gov;
  const nNew = S.jobs.filter((j) => jobIsNew(j, JOBCTX.seen)).length;
  const nMine = S.jobs.filter((j) => j.gov === myGov).length;
  view(`
    <div class="page-h"><div><h2>الوظائف المتاحة</h2><p>${S.jobs.length} وظيفة — رشّح عليها واكسب بونص</p></div></div>
    <label class="search">${IC.search}<input placeholder="ابحث بالشركة، المنطقة أو الوظيفة..." data-q></label>
    <div class="pills" data-f="only">
      <button class="pill on" data-v="">كل الوظايف</button>
      ${nNew ? `<button class="pill" data-v="new">✨ الجديدة <em>${nNew}</em></button>` : ''}
      ${nMine ? `<button class="pill" data-v="mine">📍 في ${esc(myGov)} <em>${nMine}</em></button>` : ''}
      <button class="pill" data-v="fav">❤️ المفضلة <em data-favn>${S.jobs.filter((j) => JOBCTX.fav.has(String(j.id))).length}</em></button>
    </div>
    ${govs.length > 1 ? `<div class="pills" data-f="gov"><button class="pill on" data-v="">كل المحافظات</button>${govs.map((g) => `<button class="pill" data-v="${esc(g)}">${esc(g)}</button>`).join('')}</div>` : ''}
    <div class="pills" data-f="veh"><button class="pill on" data-v="">كل المركبات</button>${VEHICLES.map((v) => `<button class="pill" data-v="${esc(v)}">${VEH_EMOJI[v] || ''} ${esc(v)}</button>`).join('')}</div>
    <div class="list" id="jobList"></div>`);
  const render = () => {
    const q = st.q.toLowerCase();
    const list = S.jobs.filter((j) => (!st.gov || j.gov === st.gov) && (!st.veh || j.vehicle === st.veh) &&
      (st.only !== 'new' || jobIsNew(j, JOBCTX.seen)) && (st.only !== 'mine' || j.gov === myGov) &&
      (st.only !== 'fav' || JOBCTX.fav.has(String(j.id))) &&
      (!q || [j.company, j.title, j.gov, j.region, j.pricing].join(' ').toLowerCase().includes(q)));
    const box = $('#jobList');
    box.innerHTML = list.length ? list.map(jobCard).join('')
      : st.only === 'fav' ? empty('🤍', 'لسه مفيش وظايف مفضلة', 'دوس على القلب في أي وظيفة عشان تلاقيها هنا بسرعة.')
        : empty('🔍', 'مفيش وظائف مطابقة', 'جرّب تغيّر الفلتر أو تمسح البحث.');
    bindJobActions(box); animateIn(box);
    $$('[data-fav]', box).forEach((b) => b.onclick = () => {
      const id = b.dataset.fav, on = !JOBCTX.fav.has(id);
      if (on) JOBCTX.fav.add(id); else JOBCTX.fav.delete(id);
      store.set(ukey('fav'), [...JOBCTX.fav]);
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); buzz(on ? 12 : 5);
      $('[data-favn]').textContent = S.jobs.filter((j) => JOBCTX.fav.has(String(j.id))).length;
      if (st.only === 'fav' && !on) render();
    });
  };
  store.set(ukey('seen'), new Date().toISOString());
  $('#jobsBadge').hidden = true;
  $('[data-q]').oninput = (e) => { st.q = e.target.value.trim(); render(); };
  bindPills($('#view'), st, render);
  render();
}
const JOBCTX = { seen: null, fav: new Set() };
const HEART = svg('<path d="M12 20s-7.5-4.6-9.3-9.2C1.4 7.4 3.6 4 7 4c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8C19.5 15.4 12 20 12 20Z"/>');
function jobCard(j, i) {
  const id = String(j.id), fav = JOBCTX.fav.has(id), isNew = jobIsNew(j, JOBCTX.seen);
  const max = ladderOf(j.company_id).max;
  const left = j.headcount ? Math.max(0, j.headcount - (j.applicants || 0)) : null;
  const fill = j.headcount ? Math.min(100, Math.round(((j.applicants || 0) / j.headcount) * 100)) : 0;
  return `<article class="jcard rise" style="--i:${Math.min(i, 8)};--h:${hue(j.company)}">
    <div class="jc-top">${jobLogo(j)}<div class="grow"><h4>${esc(j.title)}${isNew ? ' <span class="new-tag">جديد</span>' : ''}</h4><div class="jc-co">${esc(j.company)}</div></div>
      <button class="ibtn fav ${fav ? 'on' : ''}" data-fav="${esc(id)}" aria-pressed="${fav}" aria-label="أضف للمفضلة">${HEART}</button>
      <button class="ibtn" data-share="${esc(j.id)}" aria-label="شارك الوظيفة مع مناديب">${IC.share}</button></div>
    <div class="jc-loc">${IC.pin}<span>${esc(j.gov || '—')}${j.region ? ' — ' + esc(j.region) : ''}</span></div>
    <div class="tags">
      ${j.vehicle ? `<span class="tag">${VEH_EMOJI[j.vehicle] || ''} ${esc(j.vehicle)}</span>` : ''}
      ${j.work_type ? `<span class="tag">${esc(j.work_type)}</span>` : ''}
      ${j.age ? `<span class="tag">السن ${esc(j.age)}</span>` : ''}
      ${j.expiry ? `<span class="tag warn">${IC.clock} لحد ${fmtDate(j.expiry)}</span>` : ''}
    </div>
    <div class="jc-money">
      <div class="pay"><span>التسعيرة للمندوب</span><b>${esc(j.pricing || '—')}</b></div>
      <div class="bonus"><span>${IC.gift} بونصك كشريك</span><b>${esc(j.bonus_text || '—')}</b></div>
    </div>
    ${max ? `<div class="calc" data-max="${max}" data-n="3">
      <span class="c-l">🧮 لو رشّحت</span>
      <span class="stp"><button type="button" data-d="1" aria-label="زوّد">+</button><b aria-live="polite">3</b><button type="button" data-d="-1" aria-label="قلّل">−</button></span>
      <span class="c-l">وكمّلوا للآخر</span><strong>${money(3 * max)}</strong>
    </div>` : ''}
    ${j.headcount
      ? `<div class="slots"><div class="slots-t"><span>مطلوب ${j.headcount}</span><b>${left === 0 ? 'اكتمل العدد' : 'متبقي ' + left}</b></div><div class="slots-b"><i data-w="${fill}"></i></div></div>`
      : '<div class="slots open">✨ عدد مفتوح — رشّح براحتك</div>'}
    ${(j.docs || j.details) ? `<details class="more"><summary>التفاصيل والورق المطلوب</summary>${j.docs ? `<p><b>الورق:</b> ${esc(j.docs)}</p>` : ''}${j.details ? `<p>${esc(j.details)}</p>` : ''}</details>` : ''}
    <button class="btn pri block" data-apply="${esc(j.id)}">${IC.plus} رشّح مندوب على الوظيفة دي</button>
  </article>`;
}
function shareSheet(j) {
  if (!j) return;
  const m = modal(`
    <div class="sheet-h"><div class="sheet-ic" style="--c:var(--g)">${IC.share}</div><div><h2>شارك الوظيفة</h2><p>${esc(j.title)} · ${esc(j.company)}</p></div></div>
    <div class="share-opts">
      <button class="share-opt" data-s="img"><span>🖼️</span><b>صورة للستوري</b><em>صورة جاهزة بتصميم Full Speed لستوري واتساب وفيسبوك</em></button>
      <button class="share-opt" data-s="txt"><span>💬</span><b>رسالة نصية</b><em>تفاصيل الوظيفة كرسالة على واتساب</em></button>
    </div>`);
  $('[data-s=txt]', m.el).onclick = () => { m.close(); shareJob(j); };
  $('[data-s=img]', m.el).onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true; $('b', b).textContent = 'بنجهّز الصورة...';
    try { const blob = await storyImage(j); m.close(); previewStory(blob, j); } catch { toast('مقدرناش نعمل الصورة، جرّب تاني', 'bad'); b.disabled = false; }
  };
}
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
function wrapLines(x, text, maxW, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (x.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] += '…'; }
  return lines;
}
async function storyImage(j) {
  const W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  await Promise.all(['700', '500'].map((w) => document.fonts.load(`${w} 60px "Readex Pro"`).catch(() => {})));
  const F = (w, s) => `${w} ${s}px "Readex Pro", Cairo, sans-serif`;
  const circle = (cx, cy, r) => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); };
  const rr = (rx, ry, w, h, r) => { x.beginPath(); x.roundRect(rx, ry, w, h, r); x.fill(); };
  const g = x.createLinearGradient(0, 0, W * 0.6, H); g.addColorStop(0, '#0a8a4e'); g.addColorStop(0.55, '#10a861'); g.addColorStop(1, '#f37021');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(255,255,255,.08)'; circle(140, 220, 300); circle(W - 60, H - 300, 420); circle(W - 120, 520, 120);
  x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const mark = await loadImg('brand/fs-mark.png');
  x.fillStyle = '#fff'; circle(W / 2, 200, 118); x.drawImage(mark, W / 2 - 98, 102, 196, 196);
  x.fillStyle = '#fff'; x.font = F(700, 46); x.fillText('Full Speed', W / 2, 372);
  x.shadowColor = 'rgba(0,0,0,.18)'; x.shadowBlur = 50; x.shadowOffsetY = 20;
  x.fillStyle = '#fff'; rr(70, 450, W - 140, 1180, 60);
  x.shadowColor = 'transparent';
  x.fillStyle = '#f37021'; rr(W / 2 - 150, 410, 300, 84, 42);
  x.fillStyle = '#fff'; x.font = F(700, 44); x.fillText('🚀 مطلوب', W / 2, 454);
  x.fillStyle = '#17231d'; x.font = F(700, 82);
  const tl = wrapLines(x, j.title, W - 260, 2);
  tl.forEach((l, k) => x.fillText(l, W / 2, 600 + k * 100));
  let y = 600 + tl.length * 100 + 40;
  const lsrc = j.logo_url ? logoSrc(j.logo_url) : '';
  let logo = null; if (lsrc.startsWith('/logos/')) logo = await loadImg(lsrc).catch(() => null);
  x.fillStyle = '#f1f4ef'; circle(W / 2, y + 70, 78);
  if (logo) { x.save(); x.beginPath(); x.arc(W / 2, y + 70, 72, 0, Math.PI * 2); x.clip(); x.drawImage(logo, W / 2 - 72, y - 2, 144, 144); x.restore(); }
  else { x.fillStyle = '#0b8a4e'; x.font = F(700, 52); x.fillText((j.company || '?').slice(0, 2), W / 2, y + 72); }
  x.fillStyle = '#46524b'; x.font = F(500, 46); x.fillText(j.company || '', W / 2, y + 200);
  y += 290;
  const facts = [[`📍 ${[j.gov, j.region].filter(Boolean).join(' — ')}`, '#fff0e6', '#b4450f'], j.vehicle ? [`${VEH_EMOJI[j.vehicle] || '🛵'} ${j.vehicle}${j.work_type ? ' · ' + j.work_type : ''}`, '#e2f5ff', '#0a5b85'] : null].filter(Boolean);
  facts.forEach(([t, bg, fg]) => {
    x.font = F(500, 42); const w = Math.min(W - 220, x.measureText(t).width + 80);
    x.fillStyle = bg; rr(W / 2 - w / 2, y - 42, w, 84, 42); x.fillStyle = fg; x.fillText(t, W / 2, y); y += 110;
  });
  if (j.pricing) {
    y += 10; x.fillStyle = '#e3f6ec'; rr(150, y - 20, W - 300, 220, 40);
    x.fillStyle = '#0b8a4e'; x.font = F(500, 38); x.fillText('💰 التسعيرة', W / 2, y + 30);
    x.font = F(700, 56); const pl = wrapLines(x, j.pricing, W - 380, 2); pl.forEach((l, k) => x.fillText(l, W / 2, y + 100 + k * 64));
  }
  x.fillStyle = '#17231d'; x.font = F(500, 40); x.fillText('للتقديم كلّمني على واتساب 👇', W / 2, 1735);
  x.fillStyle = '#fff'; rr(220, 1775, W - 440, 100, 50);
  x.fillStyle = '#0b8a4e'; x.font = F(700, 54); x.direction = 'ltr'; x.fillText('0' + S.summary.freelancer.mobile, W / 2, 1827);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/png'));
}
function previewStory(blob, j) {
  const url = URL.createObjectURL(blob), file = new File([blob], `fullspeed-job-${j.code || j.id}.png`, { type: 'image/png' });
  const canShare = !!navigator.canShare?.({ files: [file] });
  const m = modal(`<div class="story-prev"><img src="${url}" alt="صورة الوظيفة"></div>
    <div class="sheet-actions">${canShare ? '<button class="btn pri grow" data-sh>📤 شارك الصورة</button>' : ''}<a class="btn ${canShare ? 'sec' : 'pri grow'}" href="${url}" download="${esc(file.name)}">⬇️ حفظ</a></div>`);
  const sh = $('[data-sh]', m.el);
  if (sh) sh.onclick = () => navigator.share({ files: [file], text: `مطلوب ${j.title} — ${j.company}` }).catch(() => {});
}
function shareJob(j) {
  if (!j) return;
  const text = [`🚀 مطلوب ${j.title} — ${j.company}`, `📍 ${[j.gov, j.region].filter(Boolean).join(' — ')}`,
    j.vehicle ? `🛵 ${j.vehicle}` : '', j.pricing ? `💰 ${j.pricing}` : '', '', 'لو مهتم ابعتلي رسالة 👋'].filter((x, k) => x || k === 4).join('\n');
  if (navigator.share) navigator.share({ text }).catch(() => {});
  else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
}

// ------------------------------------------------------------------ add courier
function addCourier(job) {
  buzz(10);
  const comps = S.companies.filter((c) => c.active);
  const vSel = VEHICLES.includes(job?.vehicle) ? job.vehicle : VEHICLES[0];
  const m = modal(`
    <div class="sheet-h"><div class="sheet-ic" style="--c:var(--orange)">${IC.users}</div>
      <div><h2>رشّح مندوب</h2><p>${job ? `${esc(job.title)} · ${esc(job.company)}` : 'كل ترشيح ممكن يتحوّل لبونص 💸'}</p></div></div>
    <form class="stack">
      <div class="grid2">
        <div><label class="f">اسم المندوب</label><input class="in" name="name" required maxlength="120"></div>
        <div><label class="f">موبايل المندوب</label><input class="in mono" name="mobile" required inputmode="tel" placeholder="01xxxxxxxxx"></div>
      </div>
      ${job ? '' : `<div><label class="f">الشركة</label><select class="in" name="company" required><option value="">اختار...</option>${comps.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></div>`}
      <div><label class="f">نوع المركبة</label><div class="vgrid">${VEHICLES.map((v) => `<label class="vopt"><input type="radio" name="vehicle" value="${esc(v)}" ${v === vSel ? 'checked' : ''}><span><em>${VEH_EMOJI[v] || '🚚'}</em>${esc(v)}</span></label>`).join('')}</div></div>
      <div class="grid2">
        <div><label class="f">المحافظة</label><select class="in" name="gov" required>${GOVS.map((g) => `<option ${job?.gov === g ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
        <div><label class="f">المنطقة</label><input class="in" name="region" required value="${esc(job?.region || '')}"></div>
      </div>
      <div class="err" data-err></div>
      <div class="sheet-actions"><button type="button" class="btn sec" data-close>إلغاء</button><button class="btn pri grow">إرسال الترشيح ${IC.send}</button></div>
    </form>`);
  const f = $('form', m.el);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const mob = normMobile(f.mobile.value);
    if (!/^1[0125]\d{8}$/.test(mob)) { $('[data-err]', f).textContent = 'رقم موبايل المندوب غير صحيح.'; return; }
    await busy($('button.pri', f), async () => {
      const { error } = await sb.rpc('submit_candidate', { p: {
        name: f.name.value, mobile: f.mobile.value, gov: f.gov.value, region: f.region.value, vehicle: f.vehicle.value,
        job_id: job?.id ?? null, company_id: job ? null : f.company.value,
      } });
      if (error) { $('[data-err]', f).textContent = errMsg(error); return; }
      m.close(); confetti(); buzz(30);
      toast('تم إرسال الترشيح 🎉 هيظهر في "مناديبي"', 'ok');
      S.cands = null; S.jobs = null; S.cStatus = '';
      go('couriers');
    });
  };
}

// ------------------------------------------------------------------ couriers
async function couriers() {
  loading();
  try { await loadCands(); } catch (e) { return view(empty('⚠️', 'مقدرناش نحمّل المناديب', errMsg(e))); }
  const earnedBy = {};
  S.ledger.filter((l) => !l.reversed_at && l.candidate_id).forEach((l) => { earnedBy[l.candidate_id] = (earnedBy[l.candidate_id] || 0) + Number(l.amount); });
  const totalEarned = Object.values(earnedBy).reduce((a, x) => a + x, 0);
  const counts = {}; S.cands.forEach((c) => { counts[c.status] = (counts[c.status] || 0) + 1; });
  const st = { q: '', st: S.cStatus || '' };
  S.cStatus = '';
  view(`
    <div class="page-h"><div><h2>مناديبي</h2><p>${S.cands.length} مندوب · كسبت منهم ${money(totalEarned)}</p></div><button class="btn pri sm" data-add>${IC.plus} ترشيح</button></div>
    ${S.cands.length ? `
      <label class="search">${IC.search}<input placeholder="ابحث بالاسم أو الموبايل" data-q></label>
      <div class="pills" data-f="st"><button class="pill ${!st.st ? 'on' : ''}" data-v="">الكل <em>${S.cands.length}</em></button>${Object.entries(CAND_STATUS).map(([k, [t]]) => `<button class="pill ${st.st === k ? 'on' : ''}" data-v="${k}">${t} <em>${counts[k] || 0}</em></button>`).join('')}</div>` : ''}
    <div class="list" id="cList"></div>`);
  $('[data-add]').onclick = () => addCourier();
  const render = () => {
    const q = st.q.toLowerCase();
    const list = S.cands.filter((c) => (!st.st || c.status === st.st) && (!q || (c.name + ' 0' + c.mobile + ' ' + c.mobile).toLowerCase().includes(q)));
    const box = $('#cList');
    box.innerHTML = !S.cands.length
      ? empty('🤝', 'لسه مرشحتش مناديب', 'أول ترشيح هو أول خطوة لأول بونص ليك.', 'رشّح أول مندوب')
      : list.length ? list.map((c, i) => candCard(c, earnedBy[c.id] || 0, i)).join('') : empty('🔍', 'مفيش نتايج', 'جرّب حالة تانية أو امسح البحث.');
    const cta = $('[data-empty-cta]', box); if (cta) cta.onclick = () => addCourier();
    animateIn(box);
  };
  if (S.cands.length) {
    $('[data-q]').oninput = (e) => { st.q = e.target.value.trim(); render(); };
    bindPills($('#view'), st, render);
  }
  render();
}
function candCard(c, earned, i) {
  const tgt = targetDays(c.company_id), started = !!c.start_date;
  const d = started ? daysBetween(c.start_date, c.end_date && c.end_date < today() ? c.end_date : today()) : 0;
  const pct = started ? Math.min(100, Math.round((d / tgt) * 100)) : 0;
  const full = started && d >= tgt;
  const C = 2 * Math.PI * 27;
  const lad = ladderOf(c.company_id), money_ = c.status !== 'rejected' && lad.max > 0;
  const steps = money_
    ? [{ t: 'الورق', amt: lad.paper, ok: !!c.paper_date }, ...lad.tiers.map((x) => ({ t: `${x.days} يوم`, days: x.days, amt: x.inc, ok: started && d >= x.days }))].filter((s) => s.amt > 0)
    : [['اترشّح', true], ['الورق', !!c.paper_date], ['بدأ الشغل', started], ['البونص الكامل', full]].map(([t, ok]) => ({ t, ok }));
  const cur = steps.findIndex((s) => !s.ok), nxt = steps[cur];
  const hint = !money_ ? '' : !c.paper_date ? (lad.paper ? `أول ما يخلّص ورقه تاخد <b>+${money(lad.paper)}</b>` : '')
    : !started ? 'لما يبدأ شغل تبدأ شرايح الأيام تتحسب لك'
      : nxt?.days ? `فاضل <b>${nxt.days - d} يوم</b> على <b>+${money(nxt.amt)}</b>` : '🎉 خدت البونص كله من المندوب ده';
  const stall = stallOf(c);
  return `<article class="ccard rise" style="--i:${Math.min(i, 8)};--h:${hue(c.name)}">
    <div class="cc-top"><div class="cav">${esc(initials(c.name))}</div>
      <div class="grow"><h4>${esc(c.name)}</h4><div class="cc-sub mono">0${esc(c.mobile)} · ${esc(c.code)}</div></div>${chip(CAND_STATUS, c.status)}</div>
    <div class="cc-meta">${(() => { const co = S.companies.find((x) => x.id === c.company_id); return co?.logo_url ? `<span class="mini-logo">${logoImg(co.logo_url, '')}</span>` : ''; })()}${esc(compName(c))}${c.vehicle ? ' · ' + (VEH_EMOJI[c.vehicle] || '') + ' ' + esc(c.vehicle) : ''}${c.region ? ' · ' + esc(c.region) : ''}</div>
    <div class="cc-body">
      <div class="ring ${full ? 'done' : ''}" aria-label="${started ? `${d} يوم من ${tgt}` : 'لسه مبدأش شغل'}">
        <svg viewBox="0 0 66 66"><circle cx="33" cy="33" r="27" class="trk"/><circle cx="33" cy="33" r="27" class="val" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}" data-off="${(C * (1 - pct / 100)).toFixed(1)}"/></svg>
        <div class="ring-t">${started ? `<b>${full ? '🌟' : d}</b><span>${full ? `${d} يوم` : `من ${tgt}`}</span>` : '<span>لسه<br>مبدأش</span>'}</div>
      </div>
      <ol class="steps">${steps.map((s, k) => `<li class="${s.ok ? 'ok' : k === cur ? 'now' : ''}"><i>${s.ok ? IC.check : ''}</i><span>${s.amt ? `<b>+${s.amt}</b>` : ''}${s.t}</span></li>`).join('')}</ol>
    </div>
    ${hint ? `<div class="cc-hint">${hint}</div>` : ''}
    ${stall ? `<div class="cc-alert">⚠️ ${esc(stall)} — كلّمه وتابع معاه</div>` : ''}
    <div class="cc-foot">
      <span>الورق: <b>${c.paper_date ? fmtDate(c.paper_date) : '—'}</b></span>
      <span class="earn">أرباحك منه<b>${money(earned)}</b></span>
      <a class="ibtn wa" href="${waLink(c.mobile)}" target="_blank" rel="noopener" aria-label="كلّم المندوب واتساب">${IC.chat}</a>
    </div>
  </article>`;
}

// ------------------------------------------------------------------ wallet
async function wallet() {
  loading();
  await refreshSummary();
  const [w, l] = await Promise.all([
    sb.from('withdrawals').select('id,amount,method,details,status,admin_note,created_at,decided_at').order('created_at', { ascending: false }),
    sb.from('bonus_ledger').select('id,candidate_id,kind,tier_days,amount,earned_on,reversed_at,reverse_reason,note').order('earned_on', { ascending: false }),
  ]);
  if (!S.cands) await loadCands().catch(() => {});
  const cName = (id) => S.cands?.find((c) => c.id === id)?.name || '';
  const wds = w.data || [], led = l.data || [];
  const b = S.summary.balance || {}, bal = Number(b.balance) || 0;
  view(`
    <section class="wallet w2">
      <span class="orb o1"></span><span class="orb o2"></span><span class="orb o3"></span>
      <span class="w-lbl">المتاح للسحب</span>
      <div class="w-big" data-count="${bal}" data-money>${money(0)}</div>
      <button class="w-cta" data-wd ${bal > 0 ? '' : 'disabled'}>${IC.cash} ${bal > 0 ? 'اطلب سحب دلوقتي' : 'مفيش رصيد متاح للسحب'}</button>
    </section>
    <div class="mini3">
      <div class="rise" style="--c:var(--sky);--i:1"><span>إجمالي أرباحك</span><b data-count="${Number(b.total_earned) || 0}" data-money>${money(0)}</b></div>
      <div class="rise" style="--c:var(--g);--i:2"><span>اتصرف لك</span><b data-count="${Number(b.paid) || 0}" data-money>${money(0)}</b></div>
      <div class="rise" style="--c:var(--orange);--i:3"><span>قيد المراجعة</span><b data-count="${Number(b.pending) || 0}" data-money>${money(0)}</b></div>
    </div>
    ${earningsChart(led)}
    <div class="seg2" data-on="${S.walletTab}"><span class="seg-ind"></span>
      <button data-t="earn" class="${S.walletTab === 'earn' ? 'on' : ''}">سجل الأرباح <em>${led.length}</em></button>
      <button data-t="wd" class="${S.walletTab === 'wd' ? 'on' : ''}">طلبات السحب <em>${wds.length}</em></button>
    </div>
    <div class="list tight" id="wList"></div>`);
  const kindMeta = (x) => (x.kind === 'paper' ? { c: 'var(--sky)', ic: IC.doc, t: 'بونص ورق' }
    : x.kind === 'days' ? { c: 'var(--g)', ic: IC.star, t: `بونص ${x.tier_days} يوم` }
      : { c: 'var(--orange)', ic: IC.trend, t: 'تسوية من الإدارة' });
  const earnRow = (x, i) => {
    const k = kindMeta(x), amt = Number(x.amount) || 0;
    return `<div class="tx rise ${x.reversed_at ? 'rev' : ''}" style="--i:${Math.min(i, 10)};--c:${k.c}">
      <div class="tx-ic">${k.ic}</div>
      <div class="grow"><b>${k.t}</b><span>${esc(cName(x.candidate_id) || '—')} · ${fmtDate(x.earned_on)}</span>
        ${x.reversed_at ? `<span class="tx-note">ملغي: ${esc(x.reverse_reason || '')}</span>` : ''}${x.note ? `<span class="tx-note">${esc(x.note)}</span>` : ''}</div>
      <div class="tx-end"><div class="tx-amt ${amt < 0 ? 'neg' : ''}">${amt >= 0 ? '+' : ''}${money(amt)}</div></div>
    </div>`;
  };
  const wdRow = (x, i) => `<div class="tx rise" style="--i:${Math.min(i, 10)};--c:var(--orange)">
      <div class="tx-ic">${IC.cash}</div>
      <div class="grow"><b>${esc(x.method)}</b><span class="mono" style="text-align:right">${esc(x.details)}</span>
        <ol class="wd-steps ${esc(x.status)}">
          <li class="ok"><i></i><span>اتبعت<br>${fmtDate(x.created_at)}</span></li>
          <li class="${x.status === 'pending' ? 'now' : 'ok'}"><i></i><span>مراجعة<br>الإدارة</span></li>
          <li class="${x.status === 'paid' ? 'ok' : x.status === 'rejected' ? 'bad' : ''}"><i></i><span>${x.status === 'rejected' ? 'اترفض' : 'اتحوّل'}<br>${x.decided_at ? fmtDate(x.decided_at) : '—'}</span></li>
        </ol>
        ${x.admin_note ? `<span class="tx-note">${esc(x.admin_note)}</span>` : ''}</div>
      <div class="tx-end"><div class="tx-amt" style="color:var(--ink)">${money(x.amount)}</div>${chip(WD_STATUS, x.status)}</div>
    </div>`;
  const render = () => {
    const box = $('#wList');
    if (S.walletTab === 'earn') box.innerHTML = led.length ? led.map(earnRow).join('') : empty('🌱', 'لسه مفيش أرباح', 'رشّح مناديب وابدأ اكسب من أول ما يكمّلوا ورقهم.', 'رشّح مندوب');
    else box.innerHTML = wds.length ? wds.map(wdRow).join('') : empty('💸', 'مفيش طلبات سحب', 'أول ما يبقى عندك رصيد اطلب سحبه من الزرار اللي فوق.');
    const cta = $('[data-empty-cta]', box); if (cta) cta.onclick = () => addCourier();
    animateIn(box);
  };
  $$('.seg2 button').forEach((btn) => btn.onclick = () => {
    S.walletTab = btn.dataset.t; buzz(4);
    $('.seg2').dataset.on = S.walletTab;
    $$('.seg2 button').forEach((x) => x.classList.toggle('on', x === btn));
    render();
  });
  render();
  const btn = $('[data-wd]');
  if (btn) btn.onclick = () => requestWd(bal);
  const ch = $('.chart');
  if (ch) {
    const tip = $('.ch-tip', ch);
    const pick = (b) => { $$('.bar-c', ch).forEach((x) => x.classList.toggle('sel', x === b)); tip.innerHTML = b.dataset.tip; };
    $$('.bar-c', ch).forEach((b) => { b.onclick = () => { pick(b); buzz(4); }; b.onpointerenter = () => pick(b); });
  }
}
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
function earningsChart(led) {
  const now = new Date(), months = [];
  for (let k = 5; k >= 0; k--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - k, 1);
    months.push({ key: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`, name: MONTHS[dt.getMonth()], v: 0, cur: k === 0 });
  }
  led.filter((x) => !x.reversed_at && x.earned_on).forEach((x) => {
    const m = months.find((mm) => mm.key === String(x.earned_on).slice(0, 7)); if (m) m.v += Number(x.amount) || 0;
  });
  const top = Math.max(...months.map((m) => m.v));
  if (top <= 0) return '';
  const total = months.reduce((a, m) => a + m.v, 0);
  const maxM = months.find((m) => m.v === top), cur = months[5];
  const tipOf = (m) => `<b>${m.name}</b> ${money(m.v)}`;
  return `<section class="chart rise" style="--i:4">
    <div class="ch-h"><b>أرباحك آخر 6 شهور</b><span>${money(total)}</span></div>
    <div class="ch-tip" aria-live="polite">${tipOf(cur)}</div>
    <div class="bars" aria-hidden="true">${months.map((m) => {
      const label = m === maxM || m === cur;
      return `<button type="button" class="bar-c ${m.cur ? 'sel cur' : ''}" data-tip="${esc(tipOf(m))}" tabindex="-1">
        <span class="bv">${label && m.v > 0 ? money(m.v) : ''}</span>
        <span class="bb"><i data-hh="${Math.max(m.v > 0 ? 3 : 0, Math.round((Math.max(0, m.v) / top) * 100))}"></i></span>
        <span class="bm">${m.name}</span></button>`;
    }).join('')}</div>
    <table class="sr-only"><caption>أرباحك آخر 6 شهور</caption><tr><th>الشهر</th><th>الأرباح</th></tr>${months.map((m) => `<tr><td>${m.name}</td><td>${money(m.v)}</td></tr>`).join('')}</table>
  </section>`;
}
function requestWd(max) {
  const mob = S.summary.freelancer.mobile;
  const m = modal(`
    <div class="sheet-h"><div class="sheet-ic" style="--c:var(--g)">${IC.cash}</div>
      <div><h2>طلب سحب</h2><p>المتاح: <b>${money(max)}</b></p></div></div>
    <form class="stack">
      <label class="amt"><input class="amt-in mono" name="amount" type="number" min="1" step="1" max="${max}" required placeholder="0" inputmode="numeric" aria-label="المبلغ"><span>ج.م</span></label>
      <div class="quick">${[[0.25, '25%'], [0.5, '50%'], [1, 'الكل']].map(([p, t]) => `<button type="button" class="pill" data-p="${p}">${t}</button>`).join('')}</div>
      <div><label class="f">طريقة الاستلام</label><div class="mgrid">${METHODS.map(([n, c], k) => `<label class="mopt" style="--c:${c}"><input type="radio" name="method" value="${esc(n)}" ${k === 0 ? 'checked' : ''}><span><i></i>${esc(n)}</span></label>`).join('')}</div></div>
      <div><label class="f">رقم المحفظة / الحساب</label><input class="in mono" name="details" required value="0${esc(mob)}"></div>
      <p class="note">⚠️ الإدارة هتحوّل على البيانات دي بالظبط — راجعها كويس.</p>
      <div class="err" data-err></div>
      <div class="sheet-actions"><button type="button" class="btn sec" data-close>إلغاء</button><button class="btn pri grow">إرسال الطلب ${IC.send}</button></div>
    </form>`);
  const f = $('form', m.el);
  $$('[data-p]', f).forEach((b) => b.onclick = () => {
    const v = Math.floor(max * Number(b.dataset.p));
    if (v > 0) { f.amount.value = v; buzz(4); }
    $$('[data-p]', f).forEach((x) => x.classList.toggle('on', x === b));
  });
  f.amount.oninput = () => $$('[data-p]', f).forEach((x) => x.classList.remove('on'));
  f.onsubmit = async (e) => {
    e.preventDefault();
    await busy($('button.pri', f), async () => {
      const { error } = await sb.rpc('request_withdrawal', { p_amount: Number(f.amount.value), p_method: f.method.value, p_details: f.details.value });
      if (error) { $('[data-err]', f).textContent = errMsg(error); return; }
      m.close(); confetti(); buzz(30);
      toast('تم إرسال طلب السحب 🎉', 'ok');
      S.walletTab = 'wd'; wallet();
    });
  };
}

// ------------------------------------------------------------------ profile
function badgesOf() {
  const n = S.summary.counts || {}, b = S.summary.balance || {};
  const tot = n.total || 0, hired = n.hired || 0, earned = Number(b.total_earned) || 0, paid = Number(b.paid) || 0;
  const cands = S.cands || [];
  const fullOnes = cands.filter((c) => c.start_date && daysBetween(c.start_date, c.end_date && c.end_date < today() ? c.end_date : today()) >= targetDays(c.company_id)).length;
  const comps = new Set(cands.map((c) => c.company_id).filter(Boolean)).size;
  const p = (v, goal) => ({ ok: v >= goal, prog: `${Math.min(v, goal).toLocaleString('en-US')}/${goal.toLocaleString('en-US')}` });
  return [
    ['🎯', 'أول ترشيح', p(tot, 1)], ['🤝', 'أول مندوب يتعيّن', p(hired, 1)], ['🔟', '10 ترشيحات', p(tot, 10)],
    ['⭐', '5 مناديب شغالين', p(hired, 5)], ['💵', 'أول بونص', p(earned > 0 ? 1 : 0, 1)], ['💰', 'أول 1,000 ج', p(earned, 1000)],
    ['🏆', '5,000 ج أرباح', p(earned, 5000)], ['💸', 'أول سحب', p(paid > 0 ? 1 : 0, 1)], ['📅', 'مندوب كمّل الشهر', p(fullOnes, 1)],
    ['🏢', '3 شركات مختلفة', p(comps, 3)], ['🚀', '25 ترشيح', p(tot, 25)], ['👑', '15 مندوب شغال', p(hired, 15)],
  ];
}
async function me() {
  if (!S.cands) { loading(); await loadCands().catch(() => {}); }
  const f = S.summary.freelancer, n = S.summary.counts || {}, lv = level(n.hired || 0);
  const bdg = badgesOf(), got = bdg.filter((x) => x[2].ok).length;
  view(`
    <section class="prof rise">
      <div class="pav">${esc(initials(f.name))}</div>
      <h2>${esc(f.name)}</h2>
      <span class="mono">0${esc(f.mobile)}</span>
      <span class="lv-badge" style="--lc:${lv.c}">${lv.i} مستوى ${lv.n}</span>
      <div class="prof-stats">
        <div><b data-count="${n.total ?? 0}">0</b><span>ترشيح</span></div>
        <div><b data-count="${n.hired ?? 0}">0</b><span>شغالين</span></div>
        <div><b data-count="${Number(S.summary.balance?.total_earned) || 0}" data-money>${money(0)}</b><span>أرباحك</span></div>
      </div>
    </section>
    <section class="card rise" style="--i:1;margin-top:14px">
      <div class="bd-h"><h3>🏅 إنجازاتك</h3><span>${got} من ${bdg.length}</span></div>
      <div class="badges">${bdg.map(([ic, t, s]) => `<div class="bdg ${s.ok ? 'ok' : ''}" title="${esc(t)}"><span class="bd-ic">${ic}</span><b>${esc(t)}</b>${s.ok ? '<em>✓</em>' : `<em>${s.prog}</em>`}</div>`).join('')}</div>
    </section>
    <section class="card stack rise" style="--i:2;margin-top:14px">
      <h3>${IC.user} بياناتي</h3>
      <form class="stack" id="pf">
        <div><label class="f">الإيميل</label><input class="in mono" name="email" type="email" value="${esc(f.email || '')}"></div>
        <div class="grid2"><div><label class="f">المحافظة</label><select class="in" name="gov">${GOVS.map((g) => `<option ${g === f.gov ? 'selected' : ''}>${g}</option>`).join('')}${f.gov && !GOVS.includes(f.gov) ? `<option selected>${esc(f.gov)}</option>` : ''}</select></div>
          <div><label class="f">المنطقة</label><input class="in" name="region" value="${esc(f.region || '')}"></div></div>
        <div class="err" data-err></div>
        <button class="btn pri">حفظ التعديلات</button>
      </form>
      <p class="small muted" style="margin:0">لتغيير الاسم أو رقم الموبايل كلّم الإدارة.</p>
    </section>
    <section class="card stack rise" style="--i:2;margin-top:14px">
      <h3>${IC.lock} تغيير كلمة المرور</h3>
      <form class="stack" id="pw">
        <div class="grid2"><div><label class="f">كلمة المرور الجديدة</label><input class="in" name="a" type="password" minlength="6" required autocomplete="new-password"></div>
          <div><label class="f">تأكيدها</label><input class="in" name="b" type="password" minlength="6" required autocomplete="new-password"></div></div>
        <div class="err" data-err></div>
        <button class="btn sec">تغيير كلمة المرور</button>
      </form>
    </section>
    <section class="card rise" style="--i:3;margin-top:14px">
      <h3>🌓 المظهر</h3>
      <div class="theme-seg">${[['', '📱 تلقائي'], ['light', '☀️ فاتح'], ['dark', '🌙 غامق']].map(([v, t]) => `<button class="pill ${(store.get('fsf-theme', '') || '') === v ? 'on' : ''}" data-theme-set="${v}">${t}</button>`).join('')}</div>
    </section>
    <button class="btn sec block rise" style="--i:3;margin-top:14px" data-tour>🧭 شوف الجولة التعريفية تاني</button>
    <button class="btn out block rise" style="--i:4;margin-top:10px" data-logout>${IC.logout} تسجيل الخروج</button>`);
  $('#view [data-logout]').onclick = logout;
  $('#view [data-tour]').onclick = () => maybeTour(true);
  $$('[data-theme-set]').forEach((b) => b.onclick = () => {
    const v = b.dataset.themeSet;
    store.set('fsf-theme', v); applyTheme(v); buzz(5);
    $$('[data-theme-set]').forEach((x) => x.classList.toggle('on', x === b));
  });
  $('#pf').onsubmit = async (e) => {
    e.preventDefault(); const t = e.target;
    await busy($('button', t), async () => {
      const { error } = await sb.rpc('update_my_profile', { p_gov: t.gov.value, p_region: t.region.value, p_email: t.email.value });
      if (error) return ($('[data-err]', t).textContent = errMsg(error));
      $('[data-err]', t).textContent = ''; toast('تم الحفظ ✅', 'ok'); await refreshSummary();
    });
  };
  $('#pw').onsubmit = async (e) => {
    e.preventDefault(); const t = e.target;
    if (t.a.value !== t.b.value) return ($('[data-err]', t).textContent = 'كلمتين المرور مش متطابقين.');
    await busy($('button', t), async () => {
      const { error } = await sb.auth.updateUser({ password: t.a.value });
      if (error) return ($('[data-err]', t).textContent = errMsg(error));
      t.reset(); $('[data-err]', t).textContent = ''; toast('تم تغيير كلمة المرور ✅', 'ok');
    });
  };
}

if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
boot();
