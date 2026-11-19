// Admin top bar: time-of-day greeting, live clock with Gregorian + Hijri date,
// a small "today" popover, and the language / theme switches.
import { sb, esc } from '../shared/common.js';
import { lang, isEn, tr, setLang } from './i18n.js';

const lsGet = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
const dark = matchMedia('(prefers-color-scheme: dark)');

// ---------------- theme: light / dark / system ----------------
const THEMES = ['system', 'light', 'dark'];
export const themePref = () => { const t = lsGet('fsa-theme'); return THEMES.includes(t) ? t : 'system'; };
export function applyTheme(pref = themePref()) {
  const d = document.documentElement;
  d.dataset.themePref = pref;
  d.dataset.theme = pref === 'system' ? (dark.matches ? 'dark' : 'light') : pref;
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.content = d.dataset.theme === 'dark' ? '#08110e' : '#eef3f0';
  document.querySelectorAll('[data-theme-btn]').forEach(paintThemeBtn);
}
dark.addEventListener?.('change', () => { if (themePref() === 'system') applyTheme('system'); });
const IC = {
  system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>',
};
const THEME_T = { system: tr('تلقائي', 'System'), light: tr('فاتح', 'Light'), dark: tr('غامق', 'Dark') };
function paintThemeBtn(b) {
  const p = themePref();
  b.innerHTML = IC[p];
  b.title = tr('المظهر: ', 'Theme: ') + THEME_T[p];
  b.setAttribute('aria-label', b.title);
}
function themeBtn() {
  const b = document.createElement('button');
  b.className = 'tb-btn'; b.type = 'button'; b.dataset.themeBtn = '';
  b.setAttribute('data-noi18n', '');
  b.onclick = () => { const p = THEMES[(THEMES.indexOf(themePref()) + 1) % THEMES.length]; lsSet('fsa-theme', p); applyTheme(p); };
  paintThemeBtn(b);
  return b;
}
function langBtn(getView) {
  const b = document.createElement('button');
  b.className = 'tb-btn'; b.type = 'button'; b.setAttribute('data-noi18n', '');
  b.textContent = isEn ? 'عربي' : 'EN';
  b.title = isEn ? 'التحويل للعربي' : 'Switch to English';
  b.onclick = () => setLang(isEn ? 'ar' : 'en', getView?.());
  return b;
}

// ---------------- clock ----------------
const loc = isEn ? 'en-GB' : 'ar-EG';
const fmtTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
const fmtDay = new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', numberingSystem: 'latn' });
let fmtHijri;
try { fmtHijri = new Intl.DateTimeFormat(isEn ? 'en-u-ca-islamic-umalqura' : 'ar-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric', numberingSystem: 'latn' }); } catch (_) { fmtHijri = null; }

function greet(h) {
  if (h >= 5 && h < 12) return tr('صباح الخير', 'Good morning');
  if (h >= 12 && h < 17) return tr('نهارك سعيد', 'Good afternoon');
  if (h >= 17 && h < 22) return tr('مساء الخير', 'Good evening');
  return tr('سهرة سعيدة', 'Good night');
}
const firstName = (me) => {
  const n = String(me?.name || '').trim();
  if (n) return n.split(/\s+/)[0];
  const e = String(me?.email || '').split('@')[0].split(/[._-]/)[0];
  return e ? e[0].toUpperCase() + e.slice(1) : '';
};

let timer = null;
export function mountTopbar(host, { me, getView, quick } = {}) {
  if (!host) return;
  host.innerHTML = `
    <div class="tb-hi"><b data-noi18n data-greet></b><span data-noi18n data-sub></span></div>
    <button class="tb-clock" type="button" data-clock aria-haspopup="dialog" data-noi18n>
      <span class="tb-time" data-time></span>
      <span class="tb-date"><span data-day></span><i data-hijri></i></span>
    </button>
    <div class="tb-acts"></div>`;
  const acts = host.querySelector('.tb-acts');
  acts.append(langBtn(getView), themeBtn());
  const $g = host.querySelector('[data-greet]'), $sub = host.querySelector('[data-sub]'), $t = host.querySelector('[data-time]'),
    $d = host.querySelector('[data-day]'), $h = host.querySelector('[data-hijri]');
  const name = firstName(me);
  let lastDay = '';
  const tick = () => {
    const now = new Date();
    const parts = fmtTime.formatToParts(now);
    const hm = parts.filter((p) => ['hour', 'minute', 'second', 'literal'].includes(p.type) && !(p.type === 'literal' && /\s/.test(p.value))).map((p) => p.value).join('');
    const ap = (parts.find((p) => p.type === 'dayPeriod')?.value || '').toUpperCase();
    $t.innerHTML = `${esc(hm)}<small>${esc(isEn ? ap : (ap.startsWith('A') ? 'ص' : 'م'))}</small>`;
    const day = now.toDateString();
    if (day !== lastDay) {
      lastDay = day;
      $g.textContent = `${greet(now.getHours())}${name ? (isEn ? ', ' : ' يا ') + name : ''} 👋`;
      $d.textContent = fmtDay.format(now);
      $h.textContent = fmtHijri ? fmtHijri.format(now) : '';
    }
    if (now.getMinutes() === 0 && now.getSeconds() === 0) $g.textContent = `${greet(now.getHours())}${name ? (isEn ? ', ' : ' يا ') + name : ''} 👋`;
  };
  $sub.textContent = tr('ده ملخص سريع وأدوات التحكم في كل حاجة', 'Your control center for everything');
  tick();
  clearInterval(timer); timer = setInterval(tick, 1000);

  // today popover
  const clock = host.querySelector('[data-clock]');
  clock.onclick = async (e) => {
    const open = clock.querySelector('.tb-pop');
    if (open) { if (!open.contains(e.target)) open.remove(); return; }
    const pop = document.createElement('div');
    pop.className = 'tb-pop'; pop.setAttribute('role', 'dialog');
    pop.innerHTML = `<h4>${tr('النهارده لحد دلوقتي', 'Today so far')}</h4><div class="spin" style="margin:10px auto"></div>`;
    clock.append(pop);
    const close = (ev) => { if (!clock.contains(ev.target)) { pop.remove(); document.removeEventListener('click', close); } };
    setTimeout(() => document.addEventListener('click', close), 0);
    const rows = await todayStats(quick).catch(() => null);
    if (!pop.isConnected) return;
    pop.innerHTML = `<h4>${tr('النهارده لحد دلوقتي', 'Today so far')}</h4>` + (rows
      ? rows.map(([t, v]) => `<div class="tp-r"><span>${esc(t)}</span><b>${esc(v)}</b></div>`).join('')
      : `<div class="small muted">${tr('مقدرناش نجيب الأرقام', 'Could not load the numbers')}</div>`);
  };
}

async function todayStats(quick) {
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const since = d0.toISOString();
  const cnt = (q) => q.then((r) => (r.error ? '—' : r.count ?? 0));
  const [p, c, h, w] = await Promise.all([
    cnt(sb.from('freelancers').select('*', { count: 'exact', head: true }).gte('created_at', since)),
    cnt(sb.from('candidates').select('*', { count: 'exact', head: true }).gte('created_at', since)),
    cnt(sb.from('candidates').select('*', { count: 'exact', head: true }).eq('status', 'hired').gte('start_date', since.slice(0, 10))),
    cnt(sb.from('withdrawals').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
  ]);
  const rows = [
    [tr('شركاء جداد', 'New partners'), p],
    [tr('ترشيحات جديدة', 'New nominations'), c],
    [tr('بدأوا شغل النهارده', 'Started work today'), h],
    [tr('طلبات سحب مستنية', 'Pending withdrawals'), w],
  ];
  return quick ? rows.concat(quick()) : rows;
}

// language + theme switches on the sign-in screen
export function mountAuthTools(host, getView) {
  if (!host) return;
  host.innerHTML = '';
  host.append(langBtn(getView), themeBtn());
}
export { lang };
