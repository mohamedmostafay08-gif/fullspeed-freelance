// Full Speed Network — Freelancer app
import {
  sb, $, $$, esc, money, fmtDate, today, daysBetween, normMobile, authEmailFor, waLink, logoImg, logoSrc, toast, modal, errMsg, busy,
  GOVS, VEHICLES, CAND_STATUS, WD_STATUS, chip,
} from './shared/common.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './shared/config.js';
import { loadGrowth, growthCards, bindGrowth, growthKind } from './shared/partner-growth.js';

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

// Privacy-friendly usage counters (aggregated per day, no user ids) and client error reports.
const track = (ev) => { if (!RO) sb.rpc('track_event', { p_event: ev }).then(() => {}, () => {}); };
let errCount = 0;
function reportError(message, stack) {
  if (errCount++ >= 5 || !message || /ResizeObserver|Script error/i.test(message)) return;
  sb.rpc('log_client_error', { p: { app: 'partner', message: String(message).slice(0, 500), stack: String(stack || '').slice(0, 2000), url: location.pathname + '#' + S.view, ua: navigator.userAgent } }).then(() => {}, () => {});
}
addEventListener('error', (e) => reportError(e.message, e.error?.stack));
addEventListener('unhandledrejection', (e) => reportError(e.reason?.message || String(e.reason), e.reason?.stack));

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
const DEFAULT_LEVELS = [
  { n: 'مبتدئ', min: 0, c: '#8a86a8', i: '🌱' }, { n: 'برونزي', min: 1, c: '#c8661b', i: '🥉' },
  { n: 'فضي', min: 5, c: '#64748b', i: '🥈' }, { n: 'ذهبي', min: 15, c: '#c99400', i: '🥇' }, { n: 'ماسي', min: 30, c: '#7b5cff', i: '💎' },
];

const hue = (s) => { let h = 7; for (const ch of String(s || '')) h = (h * 31 + ch.codePointAt(0)) % 360; return h; };
const initials = (name) => String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('') || '؟';
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'صباح الخير ☀️' : h < 18 ? 'يومك سعيد 🌤️' : 'مساء الخير 🌙'; };
const LEVELS_OF = () => {
  const l = S.settings?.levels;
  return Array.isArray(l) && l.length && l[0].min === 0 ? [...l].sort((a, b) => a.min - b.min) : DEFAULT_LEVELS;
};
const feat = (k) => S.settings?.features?.[k] !== false;
// Staff opening /?as=<partner id> from the admin panel get a read-only copy of that partner's app.
const VIEW_AS = new URLSearchParams(location.search).get('as');
const RO = !!VIEW_AS;
function level(hired) {
  const LEVELS = LEVELS_OF();
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

// ------------------------------------------------------------------ passkeys (fingerprint / face)
const FN = `${SUPABASE_URL}/functions/v1`;
const pkSupported = async () => {
  try { return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch { return false; }
};
let swaP = null;
const swa = () => swaP || (swaP = import('https://esm.sh/@simplewebauthn/browser@13.1.0').catch((e) => { swaP = null; throw e; }));
async function pkCall(action, extra = {}, auth = false) {
  const headers = { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY };
  if (auth) { const { data } = await sb.auth.getSession(); headers.Authorization = 'Bearer ' + data.session?.access_token; }
  const r = await fetch(`${FN}/passkey`, { method: 'POST', headers, body: JSON.stringify({ action, ...extra }) });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.error || 'server');
  return out;
}
const deviceName = () => { const u = navigator.userAgent; return /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? (u.match(/Android[^;]*;\s*([^;)]+)/)?.[1] || 'Android').trim() : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : 'جهاز'; };
async function registerPasskey() {
  const { startRegistration } = await swa();
  const { options, cid } = await pkCall('register-options', { label: '0' + (S.summary?.freelancer?.mobile || '') }, true);
  const response = await startRegistration({ optionsJSON: options });
  await pkCall('register-verify', { cid, response, device: deviceName() }, true);
  store.set(ukey('pk-offer'), 1);
  track('passkey:on');
}
async function loginWithPasskey(btn) {
  const old = btn.innerHTML; btn.disabled = true; btn.textContent = 'بنستنى البصمة...';
  try {
    const { startAuthentication } = await swa();
    const { options, cid } = await pkCall('login-options');
    const response = await startAuthentication({ optionsJSON: options });
    const { token_hash } = await pkCall('login-verify', { cid, response });
    const { error } = await sb.auth.verifyOtp({ token_hash, type: 'magiclink' });
    if (error) throw error;
    track('passkey:login'); buzz(20); await boot();
  } catch (e) {
    if (e?.name === 'NotAllowedError' || e?.name === 'AbortError') return;
    toast(e?.message === 'unknown_passkey' ? 'البصمة دي مش متسجلة — ادخل بكلمة المرور وفعّلها من "حسابي".' : 'مقدرناش ندخلك بالبصمة، ادخل بكلمة المرور.', 'bad');
  } finally { btn.disabled = false; btn.innerHTML = old; }
}
pkSupported().then((ok) => { if (ok) { const b = $('#pkLogin'); b.hidden = false; b.onclick = () => loginWithPasskey(b); } });
async function maybeOfferPasskey() {
  if (store.get(ukey('pk-offer'), 0) || !(await pkSupported())) return;
  const { count } = await sb.from('passkeys').select('id', { count: 'exact', head: true });
  if (count) { store.set(ukey('pk-offer'), 1); return; }
  const m = modal(`<div class="sheet-h"><div class="sheet-ic" style="--c:var(--g)">🔐</div><div><h2>ادخل بالبصمة المرة الجاية؟</h2><p>من غير كلمة مرور — بصمة إيدك أو وشك وخلاص</p></div></div>
    <div class="sheet-actions"><button class="btn sec" data-no>مش دلوقتي</button><button class="btn pri grow" data-yes>فعّل البصمة</button></div>`);
  $('[data-no]', m.el).onclick = () => { store.set(ukey('pk-offer'), 1); m.close(); };
  $('[data-yes]', m.el).onclick = async (e) => {
    await busy(e.currentTarget, async () => {
      try { await registerPasskey(); m.close(); confetti(); toast('تم تفعيل الدخول بالبصمة 🎉', 'ok'); }
      catch (err) { if (err?.name !== 'NotAllowedError') toast('مقدرناش نفعّل البصمة على الجهاز ده', 'bad'); }
    });
  };
}

// ------------------------------------------------------------------ web push
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const b64ToU8 = (b) => { const p = '='.repeat((4 - (b.length % 4)) % 4), r = atob((b + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };
async function currentPushSub() { if (!pushSupported()) return null; const reg = await navigator.serviceWorker.ready; return reg.pushManager.getSubscription(); }
async function enablePush() {
  if (isIOS && !standalone()) throw new Error('ios_install');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('denied');
  const { publicKey } = await fetch(`${FN}/push`, { headers: { apikey: SUPABASE_ANON_KEY } }).then((r) => r.json());
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(publicKey) });
  const j = sub.toJSON();
  const { error } = await sb.rpc('save_push_subscription', { p: { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, ua: navigator.userAgent.slice(0, 200) } });
  if (error) throw error;
  track('push:on');
}
async function disablePush() {
  const sub = await currentPushSub(); if (!sub) return;
  await sb.rpc('remove_push_subscription', { p_endpoint: sub.endpoint });
  await sub.unsubscribe().catch(() => {});
}
const pushErr = (e) => ({ ios_install: 'على الآيفون لازم تثبّت التطبيق على الشاشة الرئيسية الأول (زرار المشاركة ← إضافة إلى الشاشة الرئيسية)، وبعدين فعّل الإشعارات من جوه.',
  denied: 'الإشعارات مقفولة للموقع ده — افتحها من إعدادات المتصفح وجرّب تاني.' }[e?.message] || 'مقدرناش نفعّل الإشعارات على الجهاز ده.');
function pushCard() {
  if (!pushSupported() || Notification.permission !== 'default' || store.get(ukey('push-x'), 0)) return '';
  return `<div class="install push-card rise" id="pushCard"><span class="rc-ic">🔔</span>
    <div class="grow"><b>اعرف أول ما مندوبك يتعيّن</b><span>فعّل الإشعارات وهتوصلك على الموبايل حتى والتطبيق مقفول</span></div>
    <button class="btn pri sm" data-push-on>فعّل</button><button class="x" data-push-x aria-label="إخفاء">×</button></div>`;
}
function bindPushCard() {
  const c = $('#pushCard'); if (!c) return;
  $('[data-push-x]', c).onclick = () => { store.set(ukey('push-x'), 1); c.remove(); };
  $('[data-push-on]', c).onclick = async (e) => {
    await busy(e.currentTarget, async () => {
      try { await enablePush(); c.remove(); confetti(); toast('الإشعارات اشتغلت 🔔', 'ok'); } catch (err) { toast(pushErr(err), 'bad'); }
    });
  };
}

const logout = async () => { await sb.auth.signOut(); location.reload(); };
$$('[data-logout]').forEach((b) => b.onclick = logout);
$('#waitRefresh').onclick = () => boot();

// ------------------------------------------------------------------ boot
async function loadSettings() {
  const { data } = await sb.from('app_settings').select('key,value');
  S.settings = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
  applyFeatures(); renderBanners();
}
function applyFeatures() {
  $('#chatBtn').hidden = !feat('chat');
  if (!feat('passkey')) $('#pkLogin').hidden = true;
}
function renderBanners() {
  const host = $('#banners'); if (!host) return;
  const out = [];
  if (RO) out.push(`<div class="banner ro-b">👀 بتشوف التطبيق بعين <b>${esc(S.summary?.freelancer?.name || '')}</b> — عرض بس، مفيش أي حاجة بتتغيّر <button class="x" data-ro-x aria-label="قفل">×</button></div>`);
  if (S.summary?.freelancer?.frozen) out.push(`<div class="banner warn">🔒 حسابك متجمّد مؤقتاً — السحب والترشيح موقوفين لحد ما الإدارة تراجع.${S.summary.freelancer.frozen_reason ? ` <small>(${esc(S.summary.freelancer.frozen_reason)})</small>` : ''}${feat('chat') && !RO ? ' <button class="link" data-banner-go="chat">كلّم الإدارة</button>' : ''}</div>`);
  const a = S.settings?.announcement;
  if (a?.on && a.text && store.get('fsf-annc-x', '') !== a.text) {
    out.push(`<div class="banner ${esc(a.tone || 'info')}">📣 ${esc(a.text)}${a.link ? ` <button class="link" data-banner-go="${esc(a.link)}">شوف</button>` : ''} <button class="x" data-annc-x aria-label="إخفاء">×</button></div>`);
  }
  host.innerHTML = out.join('');
  $$('[data-banner-go]', host).forEach((b) => b.onclick = () => go(b.dataset.bannerGo));
  const ax = $('[data-annc-x]', host); if (ax) ax.onclick = () => { store.set('fsf-annc-x', a.text); renderBanners(); };
  const rx = $('[data-ro-x]', host); if (rx) rx.onclick = () => window.close();
}

async function boot() {
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    if (RO) { document.body.innerHTML = '<p style="padding:40px;text-align:center;font-family:sans-serif">افتح لوحة الإدارة وسجّل دخول الأول، وبعدين افتح "شوف التطبيق بعينه" تاني.</p>'; return; }
    return show('auth');
  }
  const { data: sum, error } = RO ? await sb.rpc('admin_freelancer_summary', { p_freelancer: VIEW_AS }) : await sb.rpc('my_summary');
  if (error) { toast(errMsg(error), 'bad'); return RO ? null : show('auth'); }
  if (!sum?.freelancer) {
    if (RO) return toast('الشريك ده مش موجود', 'bad');
    await sb.auth.signOut();
    toast('الحساب ده مش حساب شريك.', 'bad');
    return show('auth');
  }
  S.summary = sum;
  if (RO) document.body.classList.add('ro');
  await loadSettings();
  const st = sum.freelancer.status;
  if (st !== 'Active' && !RO) {
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
  if (store.get('fsf-open-day', '') !== today()) { store.set('fsf-open-day', today()); track('app:open'); }
  if (!RO) setTimeout(flushQueue, 1500);
  const want = new URLSearchParams(location.search).get('go');
  if (['home', 'jobs', 'couriers', 'wallet', 'me', 'chat'].includes(want)) { S.view = want; history.replaceState(null, '', location.pathname); }
  go(S.view);
  if (RO) return;
  maybeTour();
  if (feat('passkey')) setTimeout(maybeOfferPasskey, 2500);
}
function updateLevelChip() {
  const lv = level(S.summary?.counts?.hired || 0);
  const el = $('#lvChip'); el.textContent = `${lv.i} ${lv.n}`; el.style.setProperty('--lc', lv.c);
  const u = S.summary?.unread || {};
  const set = (id, n) => { const b = $(id); b.textContent = n > 9 ? '9+' : n; b.hidden = !n; };
  set('#bellBadge', u.notifications || 0); set('#chatBadge', u.messages || 0);
}

// ------------------------------------------------------------------ nav
$$('.dock [data-go]').forEach((b) => b.onclick = () => { buzz(5); go(b.dataset.go); });
$('#fab').onclick = () => addCourier();
$('#meBtn').onclick = () => go('me');
$('#lvChip').onclick = () => go('me');
$('#bellBtn').onclick = () => { buzz(5); notificationsSheet(); };
$('#chatBtn').onclick = () => { buzz(5); go('chat'); };
let chatTimer = null;
function go(v) {
  S.view = v;
  clearInterval(chatTimer);
  $$('.dock [data-go]').forEach((b) => b.classList.toggle('on', b.dataset.go === v));
  $('#chatBtn').classList.toggle('on', v === 'chat');
  window.scrollTo(0, 0);
  track('view:' + v);
  ({ home, jobs, couriers, wallet, me, chat })[v]();
}

// ------------------------------------------------------------------ notifications
const NOTIF_IC = { stalled: '⏳', new_job: '🚀', broadcast: '📣', frozen: '🔒', unfrozen: '✅', hired: '🎉', rejected: '❌', accepted: '✅', paper: '📄', bonus: '💰', paid: '💸', wd_rejected: '⚠️', message: '💬', self_join: '🙌' };
const ago = (d) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(d)) / 60000));
  return m < 1 ? 'دلوقتي' : m < 60 ? `من ${m} دقيقة` : m < 1440 ? `من ${Math.round(m / 60)} ساعة` : m < 2880 ? 'امبارح' : fmtDate(d);
};
async function notificationsSheet() {
  const m = modal(`<div class="sheet-h"><div class="sheet-ic" style="--c:var(--orange)">🔔</div><div><h2>الإشعارات</h2><p>آخر اللي حصل في حسابك</p></div></div><div class="nlist"><div class="spin"></div></div>`);
  const { data, error } = await sb.from('notifications').select('id,kind,title,body,link,created_at,read_at').eq('freelancer_id', S.summary.freelancer.id).order('created_at', { ascending: false }).limit(60);
  const box = $('.nlist', m.el);
  if (error) { box.innerHTML = empty('⚠️', 'مقدرناش نحمّل الإشعارات', errMsg(error)); return; }
  box.innerHTML = data.length ? data.map((n) => `<button class="nitem ${n.read_at ? '' : 'unread'}" data-link="${esc(n.link || '')}">
      <span class="n-ic">${NOTIF_IC[n.kind] || '🔔'}</span>
      <span class="grow"><b>${esc(n.title)}</b>${n.body ? `<span>${esc(n.body)}</span>` : ''}<em>${ago(n.created_at)}</em></span></button>`).join('')
    : empty('🔕', 'مفيش إشعارات لسه', 'أول ما مندوب يتعيّن أو بونص ينزل هتلاقيه هنا.');
  $$('[data-link]', box).forEach((b) => b.onclick = () => { const l = b.dataset.link; m.close(); if (l) go(l); });
  if (!RO && data.some((n) => !n.read_at)) { await sb.rpc('mark_notifications_read'); if (S.summary.unread) S.summary.unread.notifications = 0; updateLevelChip(); }
}

// ------------------------------------------------------------------ chat with admin
async function chat() {
  view(`<div class="page-h"><div><h2>كلّم الإدارة</h2><p>اسأل عن مندوب، طلب سحب أو أي حاجة — بنرد في أقرب وقت</p></div></div>
    <div class="chat" id="chatBox"><div class="spin"></div></div>
    <form class="composer" id="chatForm"><textarea class="in" name="body" rows="1" maxlength="2000" placeholder="اكتب رسالتك..." required></textarea>
      <button class="btn pri" aria-label="إرسال">${IC.send}</button></form>`);
  const box = $('#chatBox'), f = $('#chatForm'), ta = f.body;
  let lastId = 0;
  const bubble = (x) => `<div class="bub ${x.from_staff ? 'them' : 'me'}"><p>${esc(x.body)}</p><em>${ago(x.created_at)}${!x.from_staff && x.read_at ? ' · ✓✓' : ''}</em></div>`;
  const load = async () => {
    const { data, error } = await sb.from('messages').select('id,from_staff,body,created_at,read_at').eq('freelancer_id', S.summary.freelancer.id).order('created_at').limit(300);
    if (S.view !== 'chat') return;
    if (error) { box.innerHTML = empty('⚠️', 'مقدرناش نحمّل المحادثة', errMsg(error)); return; }
    const newest = data.length ? data[data.length - 1].id : 0;
    if (newest === lastId && box.dataset.ok) return;
    lastId = newest; box.dataset.ok = '1';
    box.innerHTML = data.length ? data.map(bubble).join('') : '<div class="chat-empty">👋 أهلاً بيك! اكتب سؤالك وفريق Full Speed هيرد عليك هنا.</div>';
    box.scrollTop = box.scrollHeight; window.scrollTo(0, document.body.scrollHeight);
    if (!RO && data.some((x) => x.from_staff && !x.read_at)) { await sb.rpc('mark_messages_read'); if (S.summary.unread) S.summary.unread.messages = 0; updateLevelChip(); }
  };
  ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const body = ta.value.trim(); if (!body) return;
    await busy($('button', f), async () => {
      const { error } = await sb.rpc('send_message', { p_body: body });
      if (error) { toast(errMsg(error), 'bad'); return; }
      ta.value = ''; ta.style.height = 'auto'; buzz(8); await load();
    });
  };
  await load();
  chatTimer = setInterval(load, 15000);
}

// ------------------------------------------------------------------ personal referral link + QR
const refLink = () => `${location.origin}/join?r=${encodeURIComponent(S.summary.freelancer.ref_code || '')}`;
let qrLib = null;
const loadQR = () => qrLib || (qrLib = new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
  s.onload = () => res(window.qrcode); s.onerror = () => { qrLib = null; rej(new Error('qr')); }; document.head.appendChild(s);
}));
async function refSheet() {
  if (!S.summary.freelancer.ref_code) { toast('اللينك لسه بيتجهّز، جرّب كمان شوية', 'bad'); return; }
  const url = refLink();
  const m = modal(`<div class="sheet-h"><div class="sheet-ic" style="--c:var(--g)">🔗</div><div><h2>لينكك الشخصي</h2><p>المندوب يفتحه ويسجّل بنفسه، ويتحسب ليك على طول</p></div></div>
    <div class="qr-box"><div class="qr" id="qr"><div class="spin"></div></div><img src="brand/fs-mark.png" alt="" class="qr-mark"></div>
    <div class="ref-url mono">${esc(url)}</div>
    <div class="sheet-actions"><button class="btn pri grow" data-sh>📤 ابعت اللينك</button><button class="btn sec" data-cp>📋 نسخ</button><button class="btn sec" data-dl>⬇️ QR</button></div>`);
  let canvas = null;
  try {
    const qrcode = await loadQR(); const q = qrcode(0, 'H'); q.addData(url); q.make();
    const n = q.getModuleCount(), cell = Math.floor(560 / (n + 8)), size = cell * (n + 8);
    canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const x = canvas.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, size, size); x.fillStyle = '#0b5c38';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) x.fillRect((c + 4) * cell, (r + 4) * cell, cell, cell);
    const mark = await loadImg('brand/fs-mark.png'); const ms = size * 0.22;
    x.fillStyle = '#fff'; x.beginPath(); x.arc(size / 2, size / 2, ms * 0.62, 0, Math.PI * 2); x.fill(); x.drawImage(mark, (size - ms) / 2, (size - ms) / 2, ms, ms);
    $('#qr', m.el).replaceChildren(canvas); $('.qr-mark', m.el).remove();
  } catch { $('#qr', m.el).innerHTML = '<p class="muted small">مقدرناش نعمل الـ QR دلوقتي، استخدم اللينك.</p>'; }
  const text = `🚀 عايز تشتغل مندوب مع Full Speed؟\nسجّل بياناتك من هنا وهنكلمك 👇\n${url}`;
  $('[data-sh]', m.el).onclick = () => (navigator.share ? navigator.share({ text }).catch(() => {}) : window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener'));
  $('[data-cp]', m.el).onclick = async () => { try { await navigator.clipboard.writeText(url); toast('اتنسخ ✅', 'ok'); } catch { toast(url); } };
  $('[data-dl]', m.el).onclick = () => {
    if (!canvas) return;
    canvas.toBlob((b) => {
      const file = new File([b], 'fullspeed-qr.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) navigator.share({ files: [file], text }).catch(() => {});
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = file.name; a.click(); }
    }, 'image/png');
  };
}

// ------------------------------------------------------------------ ready-made WhatsApp messages
function waSheet(c) {
  if (!c) return;
  const first = String(c.name || '').trim().split(/\s+/)[0] || '';
  const co = compName(c), job = S.jobs?.find((j) => String(j.id) === String(c.job_id));
  const tgt = targetDays(c.company_id), started = !!c.start_date;
  const d = started ? daysBetween(c.start_date, c.end_date && c.end_date < today() ? c.end_date : today()) : 0;
  const docs = (job?.docs || '').trim() || '• صورة البطاقة (وش وضهر)\n• رخصة القيادة\n• فيش جنائي';
  const T = [
    ['📄', 'الورق المطلوب', `أهلاً ${first} 👋\nعشان نكمّل تعيينك في ${co} محتاجين الورق ده:\n${docs}\n\nابعتهولي صور هنا وأنا أرفعهم على طول.`],
    ['📅', 'تذكير بالمقابلة', `أهلاً ${first} 👋\nبفكّرك بمقابلة ${co} إن شاء الله. لو محتاج العنوان أو أي تفاصيل كلّمني.`],
    started && d < tgt ? ['💪', 'كمّل الأيام', `برافو يا ${first} 👏 كمّلت ${d} يوم مع ${co}!\nفاضل ${tgt - d} يوم بس وتكمّل الشهر — كمّل كده 💪`] : null,
    c.status === 'hired' ? ['🎉', 'مبروك التعيين', `مبروك يا ${first} 🎉 اتعيّنت في ${co}!\nربنا يوفقك، ولو احتجت أي حاجة أنا موجود.`] : null,
    ['✍️', 'رسالة فاضية', ''],
  ].filter(Boolean);
  const m = modal(`<div class="sheet-h"><div class="sheet-ic" style="--c:#16a34a">💬</div><div><h2>رسالة لـ ${esc(c.name)}</h2><p>اختار رسالة جاهزة وهتفتح على واتساب — تقدر تعدّلها قبل ما تبعت</p></div></div>
    <div class="share-opts">${T.map(([ic, t, msg], k) => `<button class="share-opt" data-t="${k}"><span>${ic}</span><b>${t}</b><em>${esc(msg.split('\n')[0] || 'افتح المحادثة من غير رسالة')}</em></button>`).join('')}</div>`);
  $$('[data-t]', m.el).forEach((b) => b.onclick = () => {
    const msg = T[Number(b.dataset.t)][2]; track('wa:template'); m.close();
    window.open(waLink(c.mobile) + (msg ? '?text=' + encodeURIComponent(msg) : ''), '_blank', 'noopener');
  });
}

// ------------------------------------------------------------------ courier documents
async function shrinkImage(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/heic' || file.size < 600 * 1024) return file;
  const img = await loadImg(URL.createObjectURL(file)).catch(() => null); if (!img) return file;
  const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
  return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
}
async function docsSheet(c) {
  const dir = `${S.summary.freelancer.id}/${c.id}`;
  const m = modal(`<div class="sheet-h"><div class="sheet-ic" style="--c:var(--sky)">📎</div><div><h2>ورق ${esc(c.name)}</h2><p>صوّر البطاقة والرخصة والفيش وارفعهم هنا — الإدارة بس اللي بتشوفهم</p></div></div>
    <div class="docs" id="docs"><div class="spin"></div></div>
    <label class="btn pri block up-btn"><input type="file" accept="image/*,application/pdf" multiple hidden>📷 صوّر أو ارفع ورق</label>
    <p class="muted small" style="text-align:center;margin:8px 0 0">صور أو PDF — لحد 6 ميجا للملف</p>`);
  const box = $('#docs', m.el), inp = $('input', m.el);
  const load = async () => {
    const { data, error } = await sb.storage.from('courier-docs').list(dir, { sortBy: { column: 'created_at', order: 'desc' } });
    if (error) { box.innerHTML = `<p class="err">${esc(errMsg(error))}</p>`; return; }
    const files = (data || []).filter((f) => f.name && !f.name.startsWith('.'));
    if (!files.length) { box.innerHTML = '<div class="docs-empty">لسه مفيش ورق مرفوع</div>'; return; }
    const { data: urls } = await sb.storage.from('courier-docs').createSignedUrls(files.map((f) => `${dir}/${f.name}`), 300);
    box.innerHTML = files.map((f, k) => {
      const u = urls?.[k]?.signedUrl || '#', pdf = /\.pdf$/i.test(f.name);
      return `<a class="doc" href="${esc(u)}" target="_blank" rel="noopener">${pdf ? '<span class="doc-pdf">PDF</span>' : `<img src="${esc(u)}" alt="" loading="lazy">`}<em>${fmtDate(f.created_at)}</em></a>`;
    }).join('');
  };
  inp.onchange = async () => {
    const files = [...inp.files]; if (!files.length) return;
    const lbl = $('.up-btn', m.el); lbl.classList.add('busy'); lbl.lastChild.textContent = `بنرفع ${files.length} ملف...`;
    let ok = 0;
    for (const f0 of files) {
      const f = await shrinkImage(f0);
      if (f.size > 6 * 1024 * 1024) { toast(`${f0.name}: الملف أكبر من 6 ميجا`, 'bad'); continue; }
      const ext = (f.name.match(/\.(\w+)$/)?.[1] || 'jpg').toLowerCase();
      const { error } = await sb.storage.from('courier-docs').upload(`${dir}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`, f, { contentType: f.type, upsert: false });
      if (error) toast(errMsg(error), 'bad'); else ok++;
    }
    lbl.classList.remove('busy'); lbl.lastChild.textContent = '📷 صوّر أو ارفع ورق'; inp.value = '';
    if (ok) { toast(`اترفع ${ok} ملف ✅`, 'ok'); buzz(20); }
    load();
  };
  load();
}
const view = (html) => {
  const el = $('#view');
  el.innerHTML = html;
  el.classList.remove('page'); void el.offsetWidth; el.classList.add('page');
  animateIn(el);
};
const loading = () => { $('#view').innerHTML = '<div class="sk-wrap"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div>'; };

async function refreshSummary() {
  const { data } = RO ? await sb.rpc('admin_freelancer_summary', { p_freelancer: VIEW_AS }) : await sb.rpc('my_summary');
  if (data?.freelancer) { S.summary = data; updateLevelChip(); renderBanners(); }
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
    sb.from('candidates').select('id,code,name,mobile,company_id,company_name,job_id,vehicle,gov,region,status,paper_date,start_date,end_date,created_at,source').eq('freelancer_id', S.summary.freelancer.id).order('created_at', { ascending: false }),
    sb.from('bonus_ledger').select('id,candidate_id,kind,tier_days,amount,earned_on,reversed_at,note').eq('freelancer_id', S.summary.freelancer.id).order('created_at', { ascending: false }),
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
  $$('[data-apply]', root).forEach((b) => b.onclick = (e) => { e.stopPropagation(); addCourier(findJob(b.dataset.apply)); });
  $$('[data-share]', root).forEach((b) => b.onclick = (e) => { e.stopPropagation(); shareSheet(findJob(b.dataset.share)); });
  $$('[data-open]', root).forEach((el) => {
    el.onclick = () => { buzz(5); jobSheet(findJob(el.dataset.open)); };
    el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } };
  });
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
  const [, , , G] = await Promise.all([refreshSummary(), loadJobs(), loadCands().catch(() => {}), loadGrowth()]);
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
    ${growthCards(G)}
    ${installCard()}
    ${feat('push_prompt') && !RO ? pushCard() : ''}
    ${S.summary.freelancer.ref_code && feat('join') ? `<button class="refcard rise" style="--i:2" data-ref>
      <span class="rc-ic">🔗</span><span class="grow"><b>لينكك الشخصي + QR</b><span>ابعته للمناديب يسجّلوا بنفسهم ويتحسبوا ليك</span></span><span class="rc-go">${IC.chev}</span></button>` : ''}

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
  bindPushCard();
  bindGrowth($('#view'), G);
  $('[data-ref]')?.addEventListener('click', refSheet);
  $$('.pl').forEach((b) => b.onclick = () => { buzz(8); S.jobCo = b.dataset.co; go('jobs'); });
}
function jobLogo(j) {
  const txt = (j.company || '?').slice(0, 2);
  return `<div class="jlogo">${j.logo_url ? logoImg(j.logo_url, txt) : esc(txt)}</div>`;
}
function partnersStrip() {
  const cs = S.companies.filter((c) => c.active && c.logo_url);
  if (cs.length < 3) return '';
  const nJobs = (id) => (S.jobs || []).filter((j) => String(j.company_id) === String(id)).length;
  const row = cs.map((c) => { const n = nJobs(c.id); return `<button class="pl" data-co="${esc(c.id)}" aria-label="وظايف ${esc(c.name)}">${logoImg(c.logo_url, c.name.slice(0, 2))}${n ? `<em>${n}</em>` : ''}</button>`; }).join('');
  return `<div class="sec-h"><h3>بنشتغل مع أكبر الشركات 🤝</h3><span class="sec-sub">دوس على أي شركة</span></div>
    <div class="marquee" aria-label="الشركات"><div class="mq-track">${row}${row}</div></div>`;
}
function miniJob(j, i) {
  return `<article class="mjob rise" style="--h:${hue(j.company)};--i:${6 + Math.min(i, 3)}" data-open="${esc(j.id)}">
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
  const st = { q: '', gov: '', veh: '', only: '', co: S.jobCo || '' };
  S.jobCo = '';
  JOBCTX.seen = store.get(ukey('seen'), null);
  JOBCTX.fav = new Set(store.get(ukey('fav'), []));
  S.jobView = store.get(ukey('jview'), 'cards');
  const myGov = S.summary.freelancer.gov;
  const nNew = S.jobs.filter((j) => jobIsNew(j, JOBCTX.seen)).length;
  const nMine = S.jobs.filter((j) => j.gov === myGov).length;
  const cos = [...new Map(S.jobs.filter((j) => j.company_id).map((j) => [String(j.company_id), j])).values()];
  const coCount = (id) => S.jobs.filter((j) => String(j.company_id) === id).length;
  const VIEWS = [['cards', svg('<rect x="4" y="3" width="16" height="8" rx="2"/><rect x="4" y="13" width="16" height="8" rx="2"/>'), 'بطاقات'],
    ['list', svg('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="18" r="1.2"/>'), 'قائمة'],
    ['group', svg('<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>'), 'حسب الشركة'],
    feat('map') && ['map', svg('<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>'), 'خريطة']];
  if (!feat('map') && S.jobView === 'map') S.jobView = 'cards';
  view(`
    <div class="page-h"><div><h2>الوظائف المتاحة</h2><p>${S.jobs.length} وظيفة — رشّح عليها واكسب بونص</p></div>
      <div class="vt" role="group" aria-label="شكل العرض">${VIEWS.filter(Boolean).map(([v, ic, t]) => `<button data-view="${v}" class="${S.jobView === v ? 'on' : ''}" aria-label="${t}" title="${t}">${ic}</button>`).join('')}</div></div>
    <div class="srow"><label class="search">${IC.search}<input placeholder="ابحث بالشركة، المنطقة أو الوظيفة..." data-q></label>
      <button class="ibtn flt" data-flt aria-expanded="false" aria-label="فلاتر">${svg('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>')}<em class="dot-badge" hidden></em></button></div>
    ${cos.length > 1 ? `<div class="pills co-pills" data-f="co"><button class="pill ${!st.co ? 'on' : ''}" data-v="">كل الشركات</button>${cos.map((j) => {
      const id = String(j.company_id);
      return `<button class="pill co ${st.co === id ? 'on' : ''}" data-v="${esc(id)}"><span class="pl-mini">${j.logo_url ? logoImg(j.logo_url, '') : ''}</span>${esc(j.company)} <em>${coCount(id)}</em></button>`;
    }).join('')}</div>` : ''}
    <div class="flt-box" hidden>
    <div class="pills" data-f="only">
      <button class="pill on" data-v="">كل الوظايف</button>
      ${nNew ? `<button class="pill" data-v="new">✨ الجديدة <em>${nNew}</em></button>` : ''}
      ${nMine ? `<button class="pill" data-v="mine">📍 في ${esc(myGov)} <em>${nMine}</em></button>` : ''}
      <button class="pill" data-v="near">📍 الأقرب ليا</button>
      <button class="pill" data-v="fav">❤️ المفضلة <em data-favn>${S.jobs.filter((j) => JOBCTX.fav.has(String(j.id))).length}</em></button>
    </div>
    ${govs.length > 1 ? `<div class="pills" data-f="gov"><button class="pill on" data-v="">كل المحافظات</button>${govs.map((g) => `<button class="pill" data-v="${esc(g)}">${esc(g)}</button>`).join('')}</div>` : ''}
    <div class="pills" data-f="veh"><button class="pill on" data-v="">كل المركبات</button>${VEHICLES.map((v) => `<button class="pill" data-v="${esc(v)}">${VEH_EMOJI[v] || ''} ${esc(v)}</button>`).join('')}</div>
    </div>
    <div class="list" id="jobList"></div>`);
  const render = () => {
    const q = st.q.toLowerCase();
    const nf = [st.only, st.gov, st.veh].filter(Boolean).length, fb = $('[data-flt] .dot-badge');
    fb.textContent = nf; fb.hidden = !nf;
    const list = S.jobs.filter((j) => (!st.gov || j.gov === st.gov) && (!st.veh || j.vehicle === st.veh) &&
      (!st.co || String(j.company_id) === st.co) &&
      (st.only !== 'new' || jobIsNew(j, JOBCTX.seen)) && (st.only !== 'mine' || j.gov === myGov) &&
      (st.only !== 'fav' || JOBCTX.fav.has(String(j.id))) &&
      (!q || [j.company, j.title, j.gov, j.region, j.pricing].join(' ').toLowerCase().includes(q)));
    if (st.only === 'near' && !JOBCTX.me) {
      if (!JOBCTX.locating) {
        JOBCTX.locating = true;
        locate().then((pos) => { JOBCTX.me = pos; buzz(10); }).catch(() => {
          toast('مقدرناش نعرف مكانك — اسمح للتطبيق يوصل للموقع من إعدادات المتصفح', 'bad');
          st.only = ''; $$('[data-f=only] .pill').forEach((x) => x.classList.toggle('on', !x.dataset.v));
        }).finally(() => { JOBCTX.locating = false; render(); });
      }
      $('#jobList').innerHTML = '<div class="empty-s"><span class="e-ic">📍</span><b>بنحدد مكانك...</b><p>عشان نرتّبلك أقرب الوظايف ليك</p></div>';
      return;
    }
    if (st.only === 'near' && JOBCTX.me) list.sort((a, b) => (a.lat ? distKm(JOBCTX.me, a) : 1e9) - (b.lat ? distKm(JOBCTX.me, b) : 1e9));
    const box = $('#jobList');
    const coName = st.co && S.companies.find((c) => String(c.id) === st.co)?.name;
    box.className = 'list jv-' + S.jobView;
    const fkey = JSON.stringify([st, S.jobView]);
    if (fkey !== JOBCTX.fkey) { JOBCTX.fkey = fkey; JOBCTX.shown = 20; }
    const paged = S.jobView === 'map' ? list : list.slice(0, JOBCTX.shown);
    box.innerHTML = list.length ? renderJobs(paged)
        + (S.jobView !== 'map' && list.length > JOBCTX.shown ? `<button class="btn sec block" data-more>اعرض وظايف أكتر (فاضل ${list.length - JOBCTX.shown})</button>` : '')
      : st.only === 'fav' ? empty('🤍', 'لسه مفيش وظايف مفضلة', 'دوس على القلب في أي وظيفة عشان تلاقيها هنا بسرعة.')
        : coName && !coCount(st.co) ? empty('🏢', `مفيش وظايف متاحة لـ ${coName} دلوقتي`, 'أول ما تنزل وظيفة جديدة ليها هتلاقيها هنا.', 'شوف كل الوظايف')
          : empty('🔍', 'مفيش وظائف مطابقة', 'جرّب تغيّر الفلتر أو تمسح البحث.');
    const moreBtn = $('[data-more]', box);
    if (moreBtn) moreBtn.onclick = () => { JOBCTX.shown += 20; buzz(5); render(); };
    const cta = $('[data-empty-cta]', box);
    if (cta) cta.onclick = () => { st.co = ''; $$('[data-f=co] .pill').forEach((p) => p.classList.toggle('on', !p.dataset.v)); render(); };
    bindJobActions(box); animateIn(box);
    if (S.jobView === 'map' && list.length) drawMap(list);
    bindFav(box, () => { $('[data-favn]').textContent = S.jobs.filter((j) => JOBCTX.fav.has(String(j.id))).length; if (st.only === 'fav') render(); });
  };
  store.set(ukey('seen'), new Date().toISOString());
  $('#jobsBadge').hidden = true;
  $('[data-q]').oninput = (e) => { st.q = e.target.value.trim(); render(); };
  bindPills($('#view'), st, render);
  $('[data-flt]').onclick = (e) => {
    const box = $('.flt-box'), open = box.hidden; box.hidden = !open; buzz(5);
    e.currentTarget.setAttribute('aria-expanded', open); e.currentTarget.classList.toggle('on', open);
  };
  $$('[data-view]').forEach((b) => b.onclick = () => {
    S.jobView = b.dataset.view; store.set(ukey('jview'), S.jobView); buzz(5);
    $$('[data-view]').forEach((x) => x.classList.toggle('on', x === b)); render();
  });
  render();
  $('[data-f=co] .pill.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}
// ------------------------------------------------------------------ location + map
function locate() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('nogeo'));
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), rej, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  });
}
function distKm(a, b) {
  const R = 6371, r = (x) => (x * Math.PI) / 180, dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const fmtKm = (d) => (d < 1 ? `${Math.round(d * 1000)} متر` : `${d < 10 ? d.toFixed(1) : Math.round(d)} كم`);
function distTag(j) {
  if (!JOBCTX.me || j.lat == null) return '';
  return `<span class="tag dist">📍 ${fmtKm(distKm(JOBCTX.me, j))}${j.geo_precision === 'pin' ? '' : ' تقريباً'}</span>`;
}
let leafletP = null;
const loadLeaflet = () => leafletP || (leafletP = new Promise((res, rej) => {
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(l);
  const sc = document.createElement('script'); sc.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  sc.onload = () => res(window.L); sc.onerror = () => { leafletP = null; rej(new Error('leaflet')); }; document.head.appendChild(sc);
}));
async function drawMap(list) {
  const el = $('#jmap'); if (!el) return;
  let L; try { L = await loadLeaflet(); } catch { el.innerHTML = '<p class="muted" style="padding:20px;text-align:center">مقدرناش نحمّل الخريطة، جرّب تاني.</p>'; return; }
  if (!document.body.contains(el)) return;
  el.innerHTML = '';
  const map = L.map(el, { zoomControl: true }).setView([30.05, 31.25], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
  const pts = [];
  const placed = list.filter((j) => j.lat != null && j.lng != null);
  placed.forEach((j) => {
    const h = hue(String(j.id)), spread = j.geo_precision === 'pin' ? 0 : 0.012;
    const ll = [j.lat + ((h % 97) / 97 - 0.5) * spread, j.lng + (((h * 7) % 89) / 89 - 0.5) * spread];
    const m = L.circleMarker(ll, { radius: 9, color: '#fff', weight: 2, fillColor: `hsl(${hue(j.company)} 70% 45%)`, fillOpacity: 0.95 }).addTo(map);
    m.bindPopup(`<div class="mpop"><b>${esc(j.title)}</b><span>${esc(j.company)} · ${esc(j.region || j.gov || '')}</span>${j.pricing ? `<em>💰 ${esc(j.pricing)}</em>` : ''}${JOBCTX.me ? `<em>📍 ${fmtKm(distKm(JOBCTX.me, j))}</em>` : ''}${j.geo_precision === 'pin' ? '' : '<small>مكان تقريبي</small>'}<button class="btn pri sm" data-apply="${esc(j.id)}">رشّح مندوب</button></div>`);
    m.on('popupopen', (e) => { const b = e.popup.getElement().querySelector('[data-apply]'); if (b) b.onclick = () => { map.closePopup(); addCourier(findJob(b.dataset.apply)); }; });
    pts.push(ll);
  });
  if (JOBCTX.me) {
    L.circleMarker([JOBCTX.me.lat, JOBCTX.me.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#1aa9ec', fillOpacity: 1 }).addTo(map).bindTooltip('انت هنا');
    pts.push([JOBCTX.me.lat, JOBCTX.me.lng]);
  }
  if (pts.length) map.fitBounds(pts, { padding: [30, 30], maxZoom: 13 });
  const miss = list.length - placed.length;
  const note = $('.map-note'); if (note) note.textContent = miss ? `${miss} وظيفة لسه ملهاش مكان على الخريطة` : 'الأماكن اللي مكتوب عليها "تقريبي" محسوبة من اسم المنطقة';
  setTimeout(() => map.invalidateSize(), 250);
}
function renderJobs(list) {
  if (S.jobView === 'map') return '<div class="jmap-wrap"><div id="jmap" class="jmap"><div class="spin"></div></div><p class="map-note"></p></div>';
  if (S.jobView === 'list') return list.map(jobRow).join('');
  if (S.jobView === 'group') {
    const groups = new Map();
    list.forEach((j) => { const k = String(j.company_id || j.company); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(j); });
    return [...groups.values()].map((js, gi) => {
      const j = js[0], max = ladderOf(j.company_id).max;
      return `<section class="jgroup rise" style="--i:${Math.min(gi, 6)};--h:${hue(j.company)}">
        <div class="jg-h">${jobLogo(j)}<div class="grow"><b>${esc(j.company)}</b><span>${js.length} ${js.length === 1 ? 'وظيفة' : 'وظايف'}${max ? ` · لحد ${money(max)} للمندوب` : ''}</span></div></div>
        <div class="carousel">${js.map((x, k) => miniJob(x, k)).join('')}</div>
      </section>`;
    }).join('');
  }
  return list.map(jobCard).join('');
}
function jobRow(j, i) {
  const max = ladderOf(j.company_id).max, isNew = jobIsNew(j, JOBCTX.seen);
  return `<article class="jrow rise" style="--i:${Math.min(i, 10)};--h:${hue(j.company)}" data-open="${esc(j.id)}" role="button" tabindex="0">
    ${jobLogo(j)}
    <div class="grow"><b>${esc(j.title)}${isNew ? ' <span class="new-tag">جديد</span>' : ''}</b>
      <span>${esc(j.company)} · ${esc(j.gov || '—')}${j.region ? ' — ' + esc(j.region) : ''}</span>
      ${distTag(j) ? `<span class="jr-t">${distTag(j)}</span>` : ''}
      <span class="jr-t">${j.vehicle ? `${VEH_EMOJI[j.vehicle] || ''} ${esc(j.vehicle)}` : ''}${j.pricing ? ` · ${esc(j.pricing)}` : ''}</span></div>
    <div class="jr-end">${max ? `<span class="jr-bonus">🎁 ${money(max)}</span>` : ''}<button class="ibtn add" data-apply="${esc(j.id)}" aria-label="رشّح مندوب على ${esc(j.title)}">${IC.plus}</button></div>
  </article>`;
}
function jobSheet(j) {
  if (!j) return;
  const m = modal(`<div class="sheet-job">${jobCard(j, 0)}</div>`);
  bindJobActions(m.el); bindFav(m.el); animateIn(m.el);
  $$('[data-apply],[data-share]', m.el).forEach((b) => b.addEventListener('click', () => m.close()));
}
function bindFav(root, after) {
  $$('[data-fav]', root).forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    const id = b.dataset.fav, on = !JOBCTX.fav.has(id);
    if (on) JOBCTX.fav.add(id); else JOBCTX.fav.delete(id);
    store.set(ukey('fav'), [...JOBCTX.fav]);
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); buzz(on ? 12 : 5);
    after?.();
  });
}
const JOBCTX = { seen: null, fav: new Set(), shown: 20, fkey: '', me: null, locating: false };
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
      ${distTag(j)}
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
      <button class="share-opt" data-s="img" ${feat('story') ? '' : 'hidden'}><span>🖼️</span><b>صورة للستوري</b><em>صورة جاهزة بتصميم Full Speed لستوري واتساب وفيسبوك</em></button>
      <button class="share-opt" data-s="txt"><span>💬</span><b>رسالة نصية</b><em>تفاصيل الوظيفة كرسالة على واتساب</em></button>
    </div>`);
  $('[data-s=txt]', m.el).onclick = () => { m.close(); track('share:text'); shareJob(j); };
  $('[data-s=img]', m.el).onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true; $('b', b).textContent = 'بنجهّز الصورة...';
    try { const blob = await storyImage(j); m.close(); previewStory(blob, j); track('share:story'); } catch { toast('مقدرناش نعمل الصورة، جرّب تاني', 'bad'); b.disabled = false; }
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
// ------------------------------------------------------------------ job suggestions for a courier
const normAr = (t) => String(t || '').replace(/[أإآ]/g, 'ا').replace(/ة(?=\s|$)/g, 'ه').replace(/ى(?=\s|$)/g, 'ي').replace(/\s+/g, ' ').trim();
function matchJobs(gov, region, vehicle) {
  const g = normAr(gov), r = normAr(region), words = r.split(' ').filter((w) => w.length > 2);
  return (S.jobs || []).map((j) => {
    let sc = 0;
    if (vehicle && j.vehicle === vehicle) sc += 3;
    if (g && normAr(j.gov) === g) sc += 3;
    const jr = normAr(j.region);
    if (r && jr && (jr.includes(r) || r.includes(jr))) sc += 3; else if (words.some((w) => jr.includes(w))) sc += 1.5;
    sc += Math.min(1.5, ladderOf(j.company_id).max / 1000);
    return { j, sc };
  }).filter((x) => x.sc >= 4).sort((a, b) => b.sc - a.sc).slice(0, 3).map((x) => x.j);
}

// ------------------------------------------------------------------ offline nomination queue
const queueKey = () => ukey('queue');
const isNetErr = (e) => !navigator.onLine || /Failed to fetch|NetworkError|Load failed|network/i.test(String(e?.message || e));
async function flushQueue() {
  const q = store.get(queueKey(), []);
  if (!q.length || !navigator.onLine) return;
  let ok = 0; const left = [], failed = [];
  for (const item of q) {
    try {
      const { error } = await sb.rpc('submit_candidate', { p: item.p });
      if (!error) ok++;
      else if (isNetErr(error)) left.push(item);
      else failed.push(`${item.p.name}: ${errMsg(error)}`);
    } catch (e) { if (isNetErr(e)) left.push(item); else failed.push(`${item.p.name}: ${errMsg(e)}`); }
  }
  store.set(queueKey(), left);
  if (ok) { toast(`اتبعت ${ok} ترشيح كانوا مستنيين النت ✅`, 'ok'); S.cands = null; if (S.view === 'couriers' || S.view === 'home') go(S.view); }
  if (failed.length) toast('ترشيحات مااتبعتش: ' + failed.join(' · '), 'bad');
}
addEventListener('online', () => setTimeout(flushQueue, 800));

function addCourier(job, pre = {}) {
  if (RO) return toast('ده عرض بس 👀', 'bad');
  if (S.summary?.freelancer?.frozen) return toast(errMsg('account_frozen'), 'bad');
  buzz(10);
  const comps = S.companies.filter((c) => c.active);
  const vSel = VEHICLES.includes(job?.vehicle) ? job.vehicle : VEHICLES[0];
  const m = modal(`
    <div class="sheet-h"><div class="sheet-ic" style="--c:var(--orange)">${IC.users}</div>
      <div><h2>رشّح مندوب</h2><p>${job ? `${esc(job.title)} · ${esc(job.company)}` : 'كل ترشيح ممكن يتحوّل لبونص 💸'}</p></div></div>
    <form class="stack">
      <div class="grid2">
        <div><label class="f">اسم المندوب</label><input class="in" name="name" required maxlength="120" value="${esc(pre.name || '')}"></div>
        <div><label class="f">موبايل المندوب</label><input class="in mono" name="mobile" required inputmode="tel" placeholder="01xxxxxxxxx" value="${esc(pre.mobile || '')}"><div class="mob-hint" aria-live="polite"></div></div>
      </div>
      ${job ? '' : `<div><label class="f">الشركة</label><select class="in" name="company" required><option value="">اختار...</option>${comps.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></div>`}
      <div><label class="f">نوع المركبة</label><div class="vgrid">${VEHICLES.map((v) => `<label class="vopt"><input type="radio" name="vehicle" value="${esc(v)}" ${v === vSel ? 'checked' : ''}><span><em>${VEH_EMOJI[v] || '🚚'}</em>${esc(v)}</span></label>`).join('')}</div></div>
      <div class="grid2">
        <div><label class="f">المحافظة</label><select class="in" name="gov" required>${GOVS.map((g) => `<option ${(job?.gov || pre.gov) === g ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
        <div><label class="f">المنطقة</label><input class="in" name="region" required value="${esc(job?.region || pre.region || '')}"></div>
      </div>
      ${job ? '' : '<div class="match" hidden></div>'}
      <div class="err" data-err></div>
      <div class="sheet-actions"><button type="button" class="btn sec" data-close>إلغاء</button><button class="btn pri grow">إرسال الترشيح ${IC.send}</button></div>
    </form>`);
  const f = $('form', m.el);
  const hint = $('.mob-hint', f), sendBtn = $('button.pri', f);
  const matchBox = $('.match', f);
  if (matchBox) {
    const showMatches = async () => {
      if (!S.jobs) await loadJobs();
      const list = matchJobs(f.gov.value, f.region.value, f.vehicle.value);
      matchBox.hidden = !list.length;
      matchBox.innerHTML = list.length ? `<b>✨ أنسب وظايف للمندوب ده</b>${list.map((j) => { const mx = ladderOf(j.company_id).max; return `<button type="button" class="mrow" data-pick="${esc(j.id)}">${jobLogo(j)}<span class="grow"><b>${esc(j.title)}</b><span>${esc(j.company)} · ${esc(j.region || j.gov || '')}${j.vehicle ? ' · ' + (VEH_EMOJI[j.vehicle] || '') : ''}</span></span>${mx ? `<em>🎁 ${money(mx)}</em>` : ''}</button>`; }).join('')}` : '';
      $$('[data-pick]', matchBox).forEach((b) => b.onclick = () => {
        const pj = findJob(b.dataset.pick); track('match:pick');
        m.close(); addCourier(pj, { name: f.name.value, mobile: f.mobile.value, region: f.region.value });
      });
    };
    let mt = null;
    const later = () => { clearTimeout(mt); mt = setTimeout(showMatches, 300); };
    f.gov.addEventListener('change', later); f.region.addEventListener('input', later);
    $$('input[name=vehicle]', f).forEach((r) => r.addEventListener('change', later));
    if (pre.region || pre.gov) later();
  }
  if (pre.mobile) setTimeout(() => f.mobile.dispatchEvent(new Event('input')), 50);
  let dupT = null, dupFor = '';
  f.mobile.oninput = () => {
    clearTimeout(dupT);
    const mob = normMobile(f.mobile.value);
    if (!/^1[0125]\d{8}$/.test(mob)) { hint.className = 'mob-hint'; hint.textContent = ''; sendBtn.disabled = false; return; }
    hint.className = 'mob-hint wait'; hint.textContent = 'بنتأكد من الرقم...';
    dupT = setTimeout(async () => {
      dupFor = mob;
      const { data, error } = await sb.rpc('check_courier_mobile', { p_mobile: mob });
      if (dupFor !== normMobile(f.mobile.value)) return;
      if (error) { hint.className = 'mob-hint'; hint.textContent = ''; return; }
      const msg = { free: ['ok', '✓ الرقم متاح'], mine: ['bad', 'المندوب ده مترشّح باسمك قبل كده — هتلاقيه في "مناديبي"'], taken: ['bad', 'الرقم ده متسجل قبل كده مع شريك تاني'] }[data] || ['', ''];
      hint.className = 'mob-hint ' + msg[0]; hint.textContent = msg[1]; sendBtn.disabled = msg[0] === 'bad';
      if (msg[0] === 'bad') buzz([12, 60, 12]);
    }, 350);
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const mob = normMobile(f.mobile.value);
    if (!/^1[0125]\d{8}$/.test(mob)) { $('[data-err]', f).textContent = 'رقم موبايل المندوب غير صحيح.'; return; }
    const payload = { name: f.name.value, mobile: f.mobile.value, gov: f.gov.value, region: f.region.value, vehicle: f.vehicle.value,
      job_id: job?.id ?? null, company_id: job ? null : f.company.value };
    const queueIt = () => {
      store.set(queueKey(), [...store.get(queueKey(), []), { p: payload, at: Date.now() }]);
      m.close(); buzz(20); track('nominate:offline');
      toast('مفيش نت دلوقتي 📶 الترشيح اتحفظ وهيتبعت لوحده أول ما النت يرجع', 'ok');
    };
    if (!navigator.onLine) return queueIt();
    await busy($('button.pri', f), async () => {
      let error;
      try { ({ error } = await sb.rpc('submit_candidate', { p: payload })); } catch (e) { error = e; }
      if (error && isNetErr(error)) return queueIt();
      if (error) { $('[data-err]', f).textContent = errMsg(error); return; }
      m.close(); confetti(); buzz(30); track('nominate');
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
    ${store.get(queueKey(), []).length ? `<div class="cc-alert" style="margin-top:12px">📶 فيه ${store.get(queueKey(), []).length} ترشيح مستني النت عشان يتبعت — هيتبعت لوحده</div>` : ''}
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
    $$('[data-docs]', box).forEach((b) => b.onclick = () => docsSheet(S.cands.find((c) => c.id === b.dataset.docs)));
    $$('[data-wa]', box).forEach((b) => b.onclick = () => waSheet(S.cands.find((c) => c.id === b.dataset.wa)));
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
      ${c.status !== 'rejected' ? `<button class="ibtn docs-btn" data-docs="${esc(c.id)}" aria-label="ورق ${esc(c.name)}">📎</button>` : ''}
      <button class="ibtn wa" data-wa="${esc(c.id)}" aria-label="رسالة واتساب لـ ${esc(c.name)}">${IC.chat}</button>
    </div>
    ${c.source === 'self' ? '<div class="cc-src">🔗 سجّل من لينكك</div>' : ''}
  </article>`;
}

// ------------------------------------------------------------------ wallet
// Transfer receipt the admin attached to a paid withdrawal (private bucket, short-lived signed link).
async function receiptSheet(x) {
  if (!x?.receipt_path) return;
  const m = modal(`<div class="sheet-h"><div class="sheet-ic" style="--c:var(--g)">🧾</div><div><h2>إيصال التحويل</h2><p>${money(x.amount)} · ${esc(x.method || '')} · ${fmtDate(x.decided_at)}</p></div></div>
    <div class="rc-view"><div class="spin"></div></div>`);
  const box = $('.rc-view', m.el);
  const { data, error } = await sb.storage.from('receipts').createSignedUrl(x.receipt_path, 600);
  if (error || !data?.signedUrl) { box.innerHTML = `<p class="muted">مقدرناش نفتح الإيصال دلوقتي. جرّب تاني.</p>`; return; }
  const u = data.signedUrl;
  box.innerHTML = /\.pdf$/i.test(x.receipt_path)
    ? `<a class="btn pri block" href="${esc(u)}" target="_blank" rel="noopener">📄 افتح الإيصال (PDF)</a>`
    : `<img src="${esc(u)}" alt="إيصال التحويل"><a class="btn sec block" href="${esc(u)}" target="_blank" rel="noopener" style="margin-top:10px">فتح بالحجم الكامل</a>`;
}

async function wallet() {
  loading();
  await refreshSummary();
  const [w, l] = await Promise.all([
    sb.from('withdrawals').select('id,amount,method,details,status,admin_note,created_at,decided_at,receipt_path').eq('freelancer_id', S.summary.freelancer.id).order('created_at', { ascending: false }),
    sb.from('bonus_ledger').select('id,candidate_id,kind,tier_days,amount,earned_on,reversed_at,reverse_reason,note').eq('freelancer_id', S.summary.freelancer.id).order('earned_on', { ascending: false }),
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
      : growthKind(x) ? { c: x.kind === 'contest' ? '#d98a00' : 'var(--orange)', ic: IC.gift, t: growthKind(x).t, noNote: true }
      : { c: 'var(--orange)', ic: IC.trend, t: 'تسوية من الإدارة' });
  const earnRow = (x, i) => {
    const k = kindMeta(x), amt = Number(x.amount) || 0;
    return `<div class="tx rise ${x.reversed_at ? 'rev' : ''}" style="--i:${Math.min(i, 10)};--c:${k.c}">
      <div class="tx-ic">${k.ic}</div>
      <div class="grow"><b>${k.t}</b><span>${esc(cName(x.candidate_id) || '—')} · ${fmtDate(x.earned_on)}</span>
        ${x.reversed_at ? `<span class="tx-note">ملغي: ${esc(x.reverse_reason || '')}</span>` : ''}${x.note && !k.noNote ? `<span class="tx-note">${esc(x.note)}</span>` : ''}</div>
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
        ${x.admin_note ? `<span class="tx-note">${esc(x.admin_note)}</span>` : ''}
        ${x.status === 'paid' && x.receipt_path ? `<button class="rc-btn" data-rc="${esc(x.id)}">🧾 الإيصال</button>` : ''}</div>
      <div class="tx-end"><div class="tx-amt" style="color:var(--ink)">${money(x.amount)}</div>${chip(WD_STATUS, x.status)}</div>
    </div>`;
  const render = () => {
    const box = $('#wList');
    if (S.walletTab === 'earn') box.innerHTML = led.length ? led.map(earnRow).join('') : empty('🌱', 'لسه مفيش أرباح', 'رشّح مناديب وابدأ اكسب من أول ما يكمّلوا ورقهم.', 'رشّح مندوب');
    else box.innerHTML = wds.length ? wds.map(wdRow).join('') : empty('💸', 'مفيش طلبات سحب', 'أول ما يبقى عندك رصيد اطلب سحبه من الزرار اللي فوق.');
    const cta = $('[data-empty-cta]', box); if (cta) cta.onclick = () => addCourier();
    $$('[data-rc]', box).forEach((b) => b.onclick = () => receiptSheet(wds.find((x) => x.id === b.dataset.rc)));
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
  if (RO) return toast('ده عرض بس 👀', 'bad');
  if (S.summary?.freelancer?.frozen) return toast(errMsg('account_frozen'), 'bad');
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
      m.close(); confetti(); buzz(30); track('wd:request');
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
async function refreshSecurity() {
  if (!$('#secCard')) return;
  const pkOk = await pkSupported(), pkBtn = $('#pkBtn'), list = $('#pkList');
  const { data: keys } = await sb.from('passkeys').select('id,device,created_at,last_used_at').order('created_at');
  if (!$('#secCard')) return;
  $('#pkState').textContent = !pkOk ? 'الجهاز ده مش بيدعم البصمة للمواقع' : keys?.length ? `مفعّلة على ${keys.length} ${keys.length === 1 ? 'جهاز' : 'أجهزة'}` : 'مش مفعّلة';
  pkBtn.hidden = !pkOk; pkBtn.textContent = keys?.length ? '+ الجهاز ده' : 'فعّل';
  list.innerHTML = (keys || []).map((k) => `<div class="pk-item"><span>📱 ${esc(k.device || 'جهاز')}</span><em>${k.last_used_at ? 'آخر دخول ' + fmtDate(k.last_used_at) : 'اتفعّلت ' + fmtDate(k.created_at)}</em><button class="link" data-pk-del="${esc(k.id)}">شيل</button></div>`).join('');
  pkBtn.onclick = async () => {
    await busy(pkBtn, async () => {
      try { await registerPasskey(); confetti(); toast('تم تفعيل الدخول بالبصمة 🎉', 'ok'); } catch (e) { if (e?.name !== 'NotAllowedError') toast(e?.message === 'unauthorized' ? 'سجّل خروج ودخول تاني وجرّب' : 'مقدرناش نفعّل البصمة — ممكن تكون متفعّلة قبل كده على الجهاز ده', 'bad'); }
    });
    refreshSecurity();
  };
  $$('[data-pk-del]', list).forEach((b) => b.onclick = async () => { await sb.rpc('remove_my_passkey', { p_id: b.dataset.pkDel }); toast('اتشالت'); refreshSecurity(); });
  const pushBtn = $('#pushBtn'), sub = pushSupported() ? await currentPushSub().catch(() => null) : null;
  if (!$('#secCard')) return;
  $('#pushState').textContent = !pushSupported() ? (isIOS && !standalone() ? 'ثبّت التطبيق على الشاشة الرئيسية الأول' : 'المتصفح ده مش بيدعم الإشعارات')
    : Notification.permission === 'denied' ? 'مقفولة من إعدادات المتصفح' : sub ? 'مفعّلة على الجهاز ده ✓' : 'مش مفعّلة';
  pushBtn.hidden = !pushSupported() || Notification.permission === 'denied';
  pushBtn.textContent = sub ? 'إيقاف' : 'فعّل';
  pushBtn.onclick = async () => {
    await busy(pushBtn, async () => {
      try { if (sub) { await disablePush(); toast('الإشعارات اتقفلت'); } else { await enablePush(); confetti(); toast('الإشعارات اشتغلت 🔔', 'ok'); } } catch (e) { toast(pushErr(e), 'bad'); }
    });
    refreshSecurity();
  };
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
    ${f.ref_code && feat('join') ? `<button class="refcard rise" style="--i:1;margin-top:14px" data-ref>
      <span class="rc-ic">🔗</span><span class="grow"><b>لينكك الشخصي + QR</b><span>ابعته للمناديب يسجّلوا بنفسهم ويتحسبوا ليك</span></span><span class="rc-go">${IC.chev}</span></button>` : ''}
    <button class="refcard chatcard rise" style="--i:1;margin-top:10px" data-chat ${feat('chat') ? '' : 'hidden'}>
      <span class="rc-ic">💬</span><span class="grow"><b>كلّم الإدارة</b><span>اسأل عن مندوب أو طلب سحب</span></span><span class="rc-go">${IC.chev}</span></button>
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
    <section class="card rise" style="--i:2;margin-top:14px" id="secCard">
      <h3>🔐 الدخول والإشعارات</h3>
      <div class="set-row" ${feat('passkey') ? '' : 'hidden'}><div class="grow"><b>الدخول بالبصمة أو الوش</b><span id="pkState">بنشوف...</span></div><button class="btn sec sm" id="pkBtn" hidden>فعّل</button></div>
      <div class="pk-list" id="pkList"></div>
      <div class="set-row"><div class="grow"><b>إشعارات الموبايل</b><span id="pushState">بنشوف...</span></div><button class="btn sec sm" id="pushBtn" hidden>فعّل</button></div>
    </section>
    <section class="card rise" style="--i:3;margin-top:14px">
      <h3>🌓 المظهر</h3>
      <div class="theme-seg">${[['', '📱 تلقائي'], ['light', '☀️ فاتح'], ['dark', '🌙 غامق']].map(([v, t]) => `<button class="pill ${(store.get('fsf-theme', '') || '') === v ? 'on' : ''}" data-theme-set="${v}">${t}</button>`).join('')}</div>
    </section>
    <button class="btn sec block rise" style="--i:3;margin-top:14px" data-tour>🧭 شوف الجولة التعريفية تاني</button>
    <button class="btn out block rise" style="--i:4;margin-top:10px" data-logout>${IC.logout} تسجيل الخروج</button>`);
  $('#view [data-logout]').onclick = logout;
  $('#view [data-tour]').onclick = () => maybeTour(true);
  refreshSecurity();
  $('#view [data-ref]')?.addEventListener('click', refSheet);
  $('#view [data-chat]').onclick = () => go('chat');
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
