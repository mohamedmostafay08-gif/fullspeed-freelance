// Full Speed — Admin Control Panel
import {
  sb, $, $$, esc, money, fmtDate, today, daysBetween, normMobile, waLink, logoImg, toast, modal, confirmBox, promptBox, errMsg, busy,
  fetchAll, csvDownload, GOVS, VEHICLES, CAND_STATUS, WD_STATUS, FL_STATUS, chip,
} from '../shared/common.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../shared/config.js';
import { initI18n, isEn } from './i18n.js';
import { mountTopbar, mountAuthTools, applyTheme } from './topbar.js';
import * as AX from './analytics.js';

applyTheme();
initI18n();

// Report uncaught admin errors to client_errors (max 5 per page load).
let errSent = 0;
function reportError(message, stack) {
  message = String(message || '');
  if (errSent >= 5 || !message || /ResizeObserver|Script error/i.test(message)) return;
  errSent++;
  sb.rpc('log_client_error', { p: { app: 'admin', message: message.slice(0, 500), stack: String(stack || '').slice(0, 2000), url: location.pathname, ua: navigator.userAgent } }).then(() => {}, () => {});
}
addEventListener('error', (e) => reportError(e.message, e.error?.stack));
addEventListener('unhandledrejection', (e) => reportError(e.reason?.message || e.reason, e.reason?.stack));

const ROLE_PERMS = {
  owner: ['view', 'partners', 'couriers', 'withdrawals', 'companies', 'jobs', 'audit', 'staff', 'settings', 'broadcast', 'revert'],
  admin: ['view', 'partners', 'couriers', 'withdrawals', 'companies', 'jobs', 'audit', 'settings', 'broadcast'],
  finance: ['view', 'withdrawals'], recruiter: ['view', 'couriers', 'jobs'], viewer: ['view'],
};
const ROLE_AR = { owner: 'المالك', admin: 'مدير', finance: 'مالية', recruiter: 'توظيف', viewer: 'مشاهدة فقط' };
const PERM_AR = {
  view: 'عرض كل الصفحات', partners: 'الشركاء والمحادثات والتجميد', couriers: 'تعديل المناديب', withdrawals: 'طلبات السحب',
  companies: 'الشركات والبونص', jobs: 'الوظائف', audit: 'سجل التغييرات والأخطاء', settings: 'إعدادات التطبيق', broadcast: 'الرسايل الجماعية',
};
const ICONS = {
  dash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
  master: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 20 3"/><path d="M16 7l3 3M14 9l2 2"/></svg>`,
  partners: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="7" r="3.5"/><path d="M2 21c0-3.6 2.7-6.5 6-6.5S14 17.4 14 21"/><circle cx="17" cy="8.5" r="3"/><path d="M14 21c0-3 2.1-5.5 5.5-5.5"/></svg>`,
  couriers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="17" r="2.5"/><circle cx="18" cy="17" r="2.5"/><path d="M8.5 17h7"/><path d="M5 17H3v-5h9l2.5-5h2l1.5 7"/></svg>`,
  withdrawals: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><circle cx="12" cy="15.5" r="2" fill="currentColor" stroke="none"/></svg>`,
  companies: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V6a1 1 0 011-1h16a1 1 0 011 1v15"/><path d="M2 21h20"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2"/><path d="M9 15h6v6H9z"/></svg>`,
  jobs: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="8" width="20" height="13" rx="2"/><path d="M16 8V6a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><path d="M2 13h20"/></svg>`,
  staff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="3.5"/><path d="M2 21c0-3.6 2.7-6.5 7-6.5h2"/><circle cx="18.5" cy="16.5" r="3"/><path d="M15.8 13.8l1 1M21.2 19.2l1 1M13 16.5h1.5M22 16.5h1.5M15.8 19.2l1-1M21.2 13.8l1-1"/></svg>`,
  audit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 01-12.6 7.4L3 20l1.2-4.2A8.5 8.5 0 1121 11.5z"/><path d="M8 10h8M8 13.5h5"/></svg>`,
  errors: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 2.4 17.6A2 2 0 004.1 20.6h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4.5"/><circle cx="12" cy="17" r=".8" fill="currentColor" stroke="none"/></svg>`,
  broadcast: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10v4a1 1 0 001 1h3l6 4V5L7 9H4a1 1 0 00-1 1z"/><path d="M16.5 8.5a5 5 0 010 7"/><path d="M19 6a8.5 8.5 0 010 12"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/><circle cx="12" cy="12" r="6.5"/></svg>`,
  fraud: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z"/><path d="M12 8v5"/><circle cx="12" cy="16.5" r=".8" fill="currentColor" stroke="none"/></svg>`,
};
const NAV = [
  ['dash', 'لوحة المؤشرات', 'view'], ['master', 'ماستر كي', 'owneronly'], ['partners', 'الشركاء', 'view'], ['couriers', 'المناديب', 'view'],
  ['withdrawals', 'طلبات السحب', 'view'], ['chat', 'المحادثات', 'partners'], ['broadcast', 'رسالة جماعية', 'broadcast'], ['companies', 'الشركات والبونص', 'view'], ['jobs', 'الوظائف', 'view'],
  ['fraud', 'مؤشرات التلاعب', 'partners'], ['staff', 'فريق الإدارة', 'staff'], ['settings', 'الإعدادات', 'settings'], ['errors', 'الأخطاء', 'audit'], ['audit', 'سجل التغييرات', 'audit'],
];
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
const S = {
  me: null, perms: null, view: (() => { try { const v = sessionStorage.getItem('fsa-view'); sessionStorage.removeItem('fsa-view'); return v && v !== 'profile' ? v : 'dash'; } catch (_) { return 'dash'; } })(), companies: [], fl: [], flMap: new Map(), poll: null, courSt: '',
  settings: {}, profileId: null, profTab: 'cands', courMode: lsGet('fsa-cour-mode') === 'board' ? 'board' : 'table', kbOpen: false,
};
// Server-side permissions (my_perms) win; the role table is only a fallback if the RPC is unavailable.
const can = (p) => (S.perms ?? ROLE_PERMS[S.me?.role] ?? []).includes(p);
const show = (id) => {
  ['auth', 'noaccess', 'app'].forEach((x) => $('#' + x).classList.toggle('hidden', x !== id));
  const at = $('#authTools'); if (at) { at.hidden = id === 'app'; if (id !== 'app' && !at.childElementCount) mountAuthTools(at, () => S.view); }
};
const view = (h) => { $('#view').innerHTML = h; };
const loading = () => view('<div class="spin"></div>');
const fnCall = async (body) => {
  const { data, error } = await sb.functions.invoke('admin-users', { body });
  if (error) { let m = error.message; try { m = (await error.context.json()).error || m; } catch (_) {} throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
};
const flName = (id) => S.flMap.get(id)?.name ?? '—';
const compName = (id, fallback) => S.companies.find((c) => c.id === id)?.name ?? fallback ?? '—';

// ------------------------------------------------------------------ auth
$('#loginForm').onsubmit = async (e) => {
  e.preventDefault(); const f = e.target;
  await busy($('button', f), async () => {
    const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim().toLowerCase(), password: f.pw.value });
    if (error) return ($('[data-err]', f).textContent = errMsg(error));
    boot();
  });
};
$$('[data-logout]').forEach((b) => b.onclick = async () => { await sb.auth.signOut(); location.reload(); });
$('#myPw').onclick = async () => {
  const p = await promptBox('تغيير كلمة المرور', 'كلمة المرور الجديدة (8 على الأقل)', { type: 'password' });
  if (!p) return;
  if (p.length < 8) return toast('8 حروف/أرقام على الأقل', 'bad');
  const { error } = await sb.auth.updateUser({ password: p });
  toast(error ? errMsg(error) : 'تم تغيير كلمة المرور ✅', error ? 'bad' : 'ok');
};

async function boot() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return show('auth');
  const { data: st } = await sb.from('staff').select('role,active,email,name,perms').eq('user_id', data.session.user.id).maybeSingle();
  if (!st || !st.active) { $('#naEmail').textContent = data.session.user.email; return show('noaccess'); }
  S.me = st;
  const pr = await sb.rpc('my_perms');
  S.perms = !pr.error && Array.isArray(pr.data) ? pr.data : null;
  $('#meEmail').textContent = st.email; $('#meRole').textContent = ROLE_AR[st.role] + (st.perms && st.role !== 'owner' ? ' • صلاحيات مخصّصة' : '');
  $('#nav').innerHTML = NAV.filter((n) => n[2] === 'owneronly' ? S.me?.role === 'owner' : can(n[2])).map((n) => `<button data-go="${n[0]}"><span class="ico">${ICONS[n[0]] || ''}</span><span class="lbl">${n[1]}</span><span class="badge hidden" data-badge="${n[0]}"></span></button>`).join('');
  $$('#nav button').forEach((b) => b.onclick = () => go(b.dataset.go));
  show('app');
  mountTopbar($('#topbar'), { me: st, getView: () => S.view });
  renderPushCtl();
  await loadBase();
  go(S.view);
}
async function loadBase() {
  const [c, f] = await Promise.all([
    sb.from('companies').select('*').order('name'),
    fetchAll(() => sb.from('freelancers').select('id,name,mobile,email,gov,region,status,duplicate_of,user_id,created_at,legacy_row,notes,frozen_at,frozen_reason,ref_code,status_reason').order('created_at', { ascending: false })),
  ]);
  S.companies = c.data ?? []; S.fl = f; S.flMap = new Map(f.map((x) => [x.id, x]));
  const { count } = await sb.from('withdrawals').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  const bd = $('[data-badge=withdrawals]'); if (bd) { bd.textContent = count || ''; bd.classList.toggle('hidden', !count); }
  const pend = f.filter((x) => x.status === 'Pending' && !x.duplicate_of).length;
  const bp = $('[data-badge=partners]'); if (bp) { bp.textContent = pend || ''; bp.classList.toggle('hidden', !pend); }
  await chatBadge();
  await errorsBadge();
}
async function errorsBadge() {
  const be = $('[data-badge=errors]'); if (!be || !can('audit')) return;
  const { count } = await sb.from('client_errors').select('*', { count: 'exact', head: true }).gte('at', new Date(Date.now() - 86400000).toISOString());
  be.textContent = count || ''; be.classList.toggle('hidden', !count);
}

// ------------------------------------------------------------------ daily report push (staff)
const pushOk = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIOSDev = /iphone|ipad|ipod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const b64u8 = (b) => { const pad = '='.repeat((4 - (b.length % 4)) % 4), r = atob((b + pad).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };
async function swReg() { return (await navigator.serviceWorker.getRegistration('/')) || navigator.serviceWorker.register('/sw.js', { scope: '/' }); }
async function staffSub() { if (!pushOk()) return null; const reg = await navigator.serviceWorker.getRegistration('/'); return reg ? reg.pushManager.getSubscription() : null; }
async function renderPushCtl() {
  const host = $('#pushCtl'); if (!host || !can('view')) return;
  const sub = await staffSub().catch(() => null);
  const st = !pushOk() ? (isIOSDev && !isStandalone() ? 'ضيف الموقع للشاشة الرئيسية الأول (آيفون)' : 'المتصفح ده مش بيدعم الإشعارات')
    : Notification.permission === 'denied' ? 'مقفول من المتصفح' : sub ? 'مفعّل ✓' : 'مش مفعّل';
  const canToggle = pushOk() && Notification.permission !== 'denied';
  host.innerHTML = `<div class="pc-t">🔔 التقرير اليومي على الموبايل</div>
    <div class="pc-s">${esc(st)}</div>
    ${canToggle ? `<button class="btn sec sm block" data-pc>${sub ? 'إيقاف' : 'فعّل'}</button>` : ''}
    <div class="pc-n">بيوصلك كل يوم حوالي الساعة 9 الصبح${isIOSDev ? ' — على الآيفون لازم الموقع يكون متضاف للشاشة الرئيسية' : ''}.</div>`;
  const b = $('[data-pc]', host); if (!b) return;
  b.onclick = () => busy(b, async () => {
    try {
      if (sub) {
        await sb.rpc('remove_staff_push', { p_endpoint: sub.endpoint });
        await sub.unsubscribe().catch(() => {});
        toast('التقرير اليومي اتقفل');
      } else {
        if (isIOSDev && !isStandalone()) throw new Error('ios');
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') throw new Error('denied');
        const reg = await swReg(); await navigator.serviceWorker.ready;
        const { publicKey } = await fetch(`${SUPABASE_URL}/functions/v1/push`, { headers: { apikey: SUPABASE_ANON_KEY } }).then((r) => r.json());
        const ns = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u8(publicKey) });
        const j = ns.toJSON();
        const { error } = await sb.rpc('save_staff_push', { p: { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth } });
        if (error) throw error;
        toast('التقرير اليومي اتفعّل 🔔 هيوصلك كل يوم الصبح', 'ok');
      }
    } catch (e) {
      toast(e.message === 'ios' ? 'على الآيفون: من زرار المشاركة اختار "إضافة إلى الشاشة الرئيسية" وافتح لوحة الإدارة من هناك.'
        : e.message === 'denied' ? 'الإشعارات مقفولة — افتحها من إعدادات المتصفح.' : errMsg(e), 'bad');
    }
    renderPushCtl();
  });
}
async function chatBadge() {
  const bc = $('[data-badge=chat]'); if (!bc || !can('partners')) return;
  const { count } = await sb.from('messages').select('*', { count: 'exact', head: true }).eq('from_staff', false).is('read_at', null);
  bc.textContent = count || ''; bc.classList.toggle('hidden', !count);
}
function go(v, arg) {
  const views = { dash, master, partners, profile, couriers, courier, jobform, withdrawals, chat, broadcast, companies, jobs, fraud, staff, settings, errors, audit };
  if (!views[v]) v = 'dash';
  S.view = v;
  if (S.poll) { clearInterval(S.poll); S.poll = null; }
  $$('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.go === (v === 'profile' ? 'partners' : v === 'courier' ? 'couriers' : v === 'jobform' ? 'jobs' : v)));
  loading();
  // On phones the menu sits above the content, so land on the page itself rather than the top of the menu.
  if (matchMedia('(max-width: 900px)').matches) $('.main')?.scrollIntoView({ block: 'start' }); else scrollTo(0, 0);
  views[v](arg).catch((e) => view(`<div class="card empty">${esc(errMsg(e))}</div>`));
}

// generic paged table renderer
function pagedTable(host, rows, cols, { pageSize = 50, onRender } = {}) {
  let page = 0;
  const draw = () => {
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    page = Math.min(page, pages - 1);
    const slice = rows.slice(page * pageSize, page * pageSize + pageSize);
    host.innerHTML = `<div class="tw"><table class="t"><thead><tr>${cols.map((c) => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>
      ${slice.length ? slice.map((r) => `<tr>${cols.map((c) => `<td>${c[1](r)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" class="empty">لا توجد بيانات</td></tr>`}
      </tbody></table></div>
      <div class="pager"><button class="btn sec sm" data-p="-1" ${page ? '' : 'disabled'}>السابق</button><span>صفحة ${page + 1} من ${pages} • ${rows.length} سجل</span><button class="btn sec sm" data-p="1" ${page < pages - 1 ? '' : 'disabled'}>التالي</button></div>`;
    $$('[data-p]', host).forEach((b) => b.onclick = () => { page += Number(b.dataset.p); draw(); });
    onRender?.(host);
  };
  draw();
}

// ------------------------------------------------------------------ dashboard
async function dash() {
  if (can('view')) await sb.rpc('accrue_all');
  const [cands, bal, wds, jobsQ] = await Promise.all([
    fetchAll(() => sb.from('candidates').select('*')),
    fetchAll(() => sb.from('freelancer_balances').select('freelancer_id,total_earned,paid,pending,balance')),
    fetchAll(() => sb.from('withdrawals').select('status,amount')),
    sb.from('jobs').select('status'),
  ]);
  const prim = S.fl.filter((f) => !f.duplicate_of);
  const cnt = (arr, k, v) => arr.filter((x) => x[k] === v).length;
  const sum = (arr, k) => arr.reduce((s, x) => s + Number(x[k] || 0), 0);
  const pendW = wds.filter((w) => w.status === 'pending');
  const byComp = {};
  cands.filter((c) => c.status === 'hired').forEach((c) => { const n = compName(c.company_id, c.company_name); byComp[n] = (byComp[n] || 0) + 1; });
  const topComp = Object.entries(byComp).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxC = Math.max(1, ...topComp.map((x) => x[1]));
  const balMap = new Map(bal.map((b) => [b.freelancer_id, b]));
  const topFl = prim.map((f) => ({ f, e: Number(balMap.get(f.id)?.total_earned || 0) })).sort((a, b) => b.e - a.e).slice(0, 8);
  const maxF = Math.max(1, ...topFl.map((x) => x.e));
  view(`
    <div class="ph"><h1>لوحة المؤشرات</h1></div>
    <div class="grid4">
      <div class="card kpi b"><div class="lbl">إجمالي الشركاء</div><div class="val">${prim.length}</div><div class="small muted">مفعّل ${cnt(prim, 'status', 'Active')} • انتظار ${cnt(prim, 'status', 'Pending')}</div></div>
      <div class="card kpi g"><div class="lbl">مناديب اتعيّنوا</div><div class="val">${cnt(cands, 'status', 'hired')}</div><div class="small muted">من ${cands.length} ترشيح (${cands.length ? Math.round(cnt(cands, 'status', 'hired') / cands.length * 100) : 0}%)</div></div>
      <div class="card kpi a"><div class="lbl">طلبات سحب منتظرة</div><div class="val">${pendW.length}</div><div class="small muted">${money(sum(pendW, 'amount'))}</div></div>
      <div class="card kpi p"><div class="lbl">وظائف نشطة</div><div class="val">${(jobsQ.data || []).filter((j) => j.status === 'Active').length}</div></div>
    </div>
    <div class="grid3" style="margin-top:12px">
      <div class="card kpi"><div class="lbl">إجمالي البونص المستحق للشركاء</div><div class="val">${money(sum(bal, 'total_earned'))}</div></div>
      <div class="card kpi g"><div class="lbl">اتصرف فعلاً</div><div class="val">${money(sum(wds.filter((w) => w.status === 'paid'), 'amount'))}</div></div>
      <div class="card kpi a"><div class="lbl">أرصدة متاحة لم تُسحب</div><div class="val">${money(sum(bal.filter((b) => Number(b.balance) > 0), 'balance'))}</div></div>
    </div>
    <div class="grid2" style="margin-top:12px">
      <div class="card"><h3>المناديب الشغالين حسب الشركة</h3>${topComp.map(([n, v]) => `<div class="hbar"><span class="l">${esc(n)}</span><span class="b"><i style="width:${v / maxC * 100}%"></i></span><span class="n">${v}</span></div>`).join('') || '<div class="empty">—</div>'}</div>
      <div class="card"><h3>أعلى الشركاء أرباحاً</h3>${topFl.map(({ f, e }) => `<div class="hbar"><span class="l">${esc(f.name)}</span><span class="b"><i style="width:${e / maxF * 100}%;background:var(--amber)"></i></span><span class="n">${Math.round(e)}</span></div>`).join('') || '<div class="empty">—</div>'}</div>
    </div>
    <div id="axDash"></div>
    ${staleHtml(cands)}
    <div id="usageCard"></div>`);
  usageCard().catch(() => {});
  AX.dashboard($('#axDash'), { S, compName, flName }).catch((e) => { $('#axDash').innerHTML = `<div class="card empty">${esc(errMsg(e))}</div>`; });
  $$('[data-stale]').forEach((b) => b.onclick = () => courierEdit([cands.find((c) => c.id === b.dataset.stale)]));
  const sa = $('[data-stale-all]'); if (sa) sa.onclick = () => { S.courSt = 'submitted'; go('couriers'); };
}

function staleHtml(cands) {
  const cutoff = Date.now() - 48 * 3600 * 1000;
  const stale = cands.filter((c) => c.status === 'submitted' && new Date(c.created_at).getTime() < cutoff)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  if (!stale.length) return `<div class="card stale ok" style="margin-top:12px">✅ مفيش ترشيحات مستنية مراجعة أكتر من 48 ساعة.</div>`;
  const age = (c) => { const h = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 3600000); return h >= 48 ? `${Math.floor(h / 24)} يوم` : `${h} ساعة`; };
  return `<div class="card stale" style="margin-top:12px">
    <div class="ph" style="margin-bottom:8px"><h3 style="margin:0">⏰ ترشيحات متأخرة <span class="chip a">${stale.length}</span></h3><button class="btn sec sm" data-stale-all>عرض الكل في المناديب</button></div>
    <p class="small muted" style="margin:0 0 8px">ترشيحات حالتها "تحت المراجعة" وعدّى عليها أكتر من 48 ساعة — الشريك مستني رد.</p>
    <div class="tw"><table class="t"><thead><tr><th>المندوب</th><th>الشريك</th><th>الشركة</th><th>مستني من</th><th></th></tr></thead><tbody>
      ${stale.slice(0, 10).map((c) => `<tr><td><b>${esc(c.name)}</b><div class="small mono muted">${esc(c.code || '')}</div></td><td>${esc(flName(c.freelancer_id))}</td><td>${esc(compName(c.company_id, c.company_name))}</td><td><span class="chip r">${age(c)}</span></td><td>${can('couriers') ? `<button class="btn pri sm" data-stale="${c.id}">مراجعة</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div>${stale.length > 10 ? `<div class="small muted" style="margin-top:6px">و${stale.length - 10} كمان…</div>` : ''}</div>`;
}

// ------------------------------------------------------------------ partners
async function partners() {
  S.logins = null;
  const [bal, cands] = await Promise.all([
    fetchAll(() => sb.from('freelancer_balances').select('*')),
    fetchAll(() => sb.from('candidates').select('freelancer_id,status')),
    loginInfo(''),
  ]);
  const bMap = new Map(bal.map((b) => [b.freelancer_id, b]));
  const cc = {};
  cands.forEach((c) => { const o = (cc[c.freelancer_id] ??= { t: 0, h: 0 }); o.t++; if (c.status === 'hired') o.h++; });
  const sel = new Set();
  view(`
    <div class="ph"><h1>الشركاء (الفريلانسرز)</h1><div class="row"><button class="btn sec sm" data-csv>⬇️ تصدير Excel</button></div></div>
    <div class="tools">
      <input class="in q" placeholder="بحث بالاسم، الموبايل، الإيميل، المنطقة" data-q>
      <select class="in" data-st><option value="">كل الحالات</option>${Object.entries(FL_STATUS).map(([k, [t]]) => `<option value="${k}">${t}</option>`).join('')}<option value="DUP">صفوف مكررة (قديمة)</option></select>
      <select class="in" data-gov><option value="">كل المحافظات</option>${[...new Set(S.fl.map((f) => f.gov).filter(Boolean))].map((g) => `<option>${esc(g)}</option>`).join('')}</select>
    </div>
    <div class="bulk hidden" data-bulk>تم تحديد <span data-n></span>
      <select class="in" style="width:auto" data-bst>${Object.entries(FL_STATUS).filter(([k]) => k !== 'Inactive').map(([k, [t]]) => `<option value="${k}">${t}</option>`).join('')}</select>
      <button class="btn pri sm" data-bapply>تطبيق الحالة</button>
      <button class="btn dan sm" data-bsus>⛔ إيقاف</button><button class="btn sec sm" data-bact>✅ تفعيل</button>
      <button class="btn sec sm" data-bout>🚪 خروج من الأجهزة</button><button class="btn sec sm" data-bmsg>💬 رسالة</button>
      <button class="btn ghost sm" data-bclear>إلغاء التحديد</button></div>
    <div id="tbl"></div>`);
  let rows = [];
  const render = () => {
    const q = $('[data-q]').value.trim().toLowerCase(), st = $('[data-st]').value, g = $('[data-gov]').value;
    rows = S.fl.filter((f) => (st === 'DUP' ? f.duplicate_of : (!f.duplicate_of && (!st || f.status === st))) && (!g || f.gov === g) &&
      (!q || [f.name, f.mobile, '0' + f.mobile, f.email, f.region].join(' ').toLowerCase().includes(q)) && FX.match(f));
    FX.draw(rows);
    pagedTable($('#tbl'), rows, [
      [`<input type="checkbox" data-all>`, (f) => f.duplicate_of ? '' : `<input type="checkbox" data-sel="${f.id}" ${sel.has(f.id) ? 'checked' : ''}>`],
      ['التاريخ', (f) => `<span class="small">${fmtDate(f.created_at)}</span>`],
      ['الاسم', (f) => `<b>${esc(f.name)}</b>${f.frozen_at ? ` <span class="chip r" title="${esc(f.frozen_reason || '')}">🔒 متجمّد</span>` : ''}${f.duplicate_of ? '<div class="small" style="color:var(--amber)">مكرر من: ' + esc(flName(f.duplicate_of)) + '</div>' : ''}${f.user_id || f.duplicate_of ? '' : '<div class="small" style="color:var(--red)">بدون دخول</div>'}`],
      ['الموبايل', (f) => `<a class="mono" href="${waLink(f.mobile)}" target="_blank" rel="noopener">0${esc(f.mobile)}</a>`],
      ['الإيميل', (f) => `<span class="small mono">${esc(f.email || '—')}</span>`],
      ['المنطقة', (f) => `${esc(f.gov || '')}<div class="small muted">${esc(f.region || '')}</div>`],
      ['المناديب', (f) => `<span class="chip p">${cc[f.id]?.h ?? 0} / ${cc[f.id]?.t ?? 0}</span>`],
      ['الرصيد', (f) => `<b>${money(bMap.get(f.id)?.balance)}</b><div class="small muted">كسب ${money(bMap.get(f.id)?.total_earned)}</div>`],
      ['الحالة', (f) => chip(FL_STATUS, f.status) + (f.status === 'Inactive' && f.status_reason ? `<div class="small muted" title="${esc(f.status_reason)}">${esc(f.status_reason.slice(0, 24))}</div>` : '')],
      ['آخر دخول', (f) => { const li = S.logins?.get(f.id); return li?.last_sign_in_at ? `<span class="small" title="${new Date(li.last_sign_in_at).toLocaleString('en-GB')}">${fmtDate(li.last_sign_in_at)}</span>${li.sessions ? ` <span class="chip g" title="أجهزة فاتحة">📱${li.sessions}</span>` : ''}` : '<span class="small muted">—</span>'; }],
      ['', (f) => `<div class="acts"><button class="btn sec sm" data-det="${f.id}">الملف</button>${can('partners') && !f.duplicate_of ? `<button class="btn sec sm" data-ctl="${f.id}" title="إيقاف، باسوورد، أجهزة">🛡️ تحكم</button><button class="btn sec sm" data-ed="${f.id}">تعديل</button>` : ''}</div>`],
    ], { onRender: (h) => {
      $$('[data-sel]', h).forEach((c) => c.onchange = () => { c.checked ? sel.add(c.dataset.sel) : sel.delete(c.dataset.sel); bulkBar(); });
      const all = $('[data-all]', h); if (all) all.onchange = () => { rows.filter((f) => !f.duplicate_of).forEach((f) => all.checked ? sel.add(f.id) : sel.delete(f.id)); render(); bulkBar(); };
      $$('[data-det]', h).forEach((b) => b.onclick = () => openProfile(b.dataset.det));
      $$('[data-ed]', h).forEach((b) => b.onclick = () => partnerEdit(S.flMap.get(b.dataset.ed)));
      $$('[data-ctl]', h).forEach((b) => b.onclick = () => partnerControl(S.flMap.get(b.dataset.ctl)));
    } });
  };
  const bulkBar = () => { $('[data-bulk]').classList.toggle('hidden', !sel.size || !can('partners')); $('[data-n]').textContent = sel.size; };
  $('[data-bclear]').onclick = () => { sel.clear(); render(); bulkBar(); };
  $('[data-bapply]').onclick = async (e) => {
    const st = $('[data-bst]').value;
    if (!(await confirmBox('تغيير حالة جماعي', `هيتغير ${sel.size} شريك لحالة "${FL_STATUS[st][0]}".`, 'تطبيق', false))) return;
    await busy(e.target, async () => {
      // Suspended accounts are also blocked from logging in; they come back only through "تفعيل".
      const ids = [...sel].filter((id) => S.flMap.get(id)?.status !== 'Inactive');
      if (ids.length < sel.size) toast(`${sel.size - ids.length} موقوفين اتسابوا — استخدم "تفعيل" ليهم`, 'bad');
      if (!ids.length) return;
      const { error } = await sb.from('freelancers').update({ status: st }).in('id', ids);
      if (error) return toast(errMsg(error), 'bad');
      toast('تم ✅', 'ok'); sel.clear(); await loadBase(); go('partners');
    });
  };
  // Bulk account actions run one partner at a time through the server function and report how many worked.
  const bulkRun = async (btn, label, ids, body) => busy(btn, async () => {
    let ok = 0; const bad = [];
    for (const id of ids) {
      try { await fnCall({ ...body, freelancer_id: id }); ok++; } catch (e) { bad.push(`${flName(id)}: ${errMsg(e)}`); }
    }
    toast(`${label}: ${ok} من ${ids.length}${bad.length ? ` — فشل: ${bad.slice(0, 3).join('، ')}` : ''}`, bad.length ? 'bad' : 'ok');
    sel.clear(); S.logins = null; await loadBase(); go('partners');
  });
  $('[data-bsus]').onclick = async (e) => {
    const ids = [...sel].filter((id) => S.flMap.get(id)?.status !== 'Inactive'); if (!ids.length) return toast('كلهم موقوفين أصلاً', 'bad');
    const reason = await promptBox(`إيقاف ${ids.length} أكونت`, 'سبب الإيقاف (هيتسجل لكل واحد)'); if (!reason) return;
    bulkRun(e.target, 'اتوقف', ids, { action: 'suspend_freelancer', reason });
  };
  $('[data-bact]').onclick = async (e) => {
    const ids = [...sel].filter((id) => S.flMap.get(id)?.status === 'Inactive'); if (!ids.length) return toast('مفيش حد موقوف في المحددين', 'bad');
    if (!(await confirmBox('تفعيل جماعي', `هيتفعّل ${ids.length} أكونت ويقدروا يدخلوا تاني.`, 'تفعيل', false))) return;
    bulkRun(e.target, 'اتفعّل', ids, { action: 'activate_freelancer' });
  };
  $('[data-bout]').onclick = async (e) => {
    const ids = [...sel].filter((id) => S.flMap.get(id)?.user_id); if (!ids.length) return;
    if (!(await confirmBox('خروج من كل الأجهزة', `${ids.length} شريك هيتطلب منهم يسجّلوا دخول تاني.`, 'خروج'))) return;
    bulkRun(e.target, 'خرجوا', ids, { action: 'sign_out_freelancer' });
  };
  $('[data-bmsg]').onclick = async (e) => {
    const body = await promptBox(`رسالة لـ ${sel.size} شريك`, 'الرسالة (هتوصل في المحادثة + إشعار)'); if (!body) return;
    await busy(e.target, async () => {
      let ok = 0;
      for (const id of sel) { const { error } = await sb.rpc('admin_send_message', { p_freelancer: id, p_body: body }); if (!error) ok++; }
      toast(`اتبعتت لـ ${ok} من ${sel.size} 💬`, ok === sel.size ? 'ok' : 'bad'); sel.clear(); render(); bulkBar();
    });
  };
  $$('[data-q],[data-st],[data-gov]').forEach((el) => el.oninput = render);
  const FX = AX.partnersFx({ S, onChange: () => render() });
  $('[data-csv]').onclick = () => csvDownload('FullSpeed_Partners.csv',
    ['التاريخ', 'الاسم', 'الموبايل', 'الإيميل', 'المحافظة', 'المنطقة', 'الحالة', 'المناديب', 'شغالين', 'إجمالي الأرباح', 'اتصرف', 'قيد المراجعة', 'الرصيد'],
    rows.map((f) => { const b = bMap.get(f.id) || {}; return [fmtDate(f.created_at), f.name, '0' + f.mobile, f.email, f.gov, f.region, f.status, cc[f.id]?.t ?? 0, cc[f.id]?.h ?? 0, b.total_earned, b.paid, b.pending, b.balance]; }));
  render(); bulkBar();
}

// ------------------------------------------------------------------ master key (owner-only: open any partner's app read-only)
const openAs = (id) => window.open('/?as=' + encodeURIComponent(id), '_blank', 'noopener');
async function master() {
  if (S.me?.role !== 'owner') { view('<div class="card empty">الصفحة دي للمالك بس.</div>'); return; }
  view(`
    <div class="page-h"><div><h2>🔑 الماستر كي</h2><p class="muted small" style="margin:.2em 0 0">تخش بيه على تطبيق أي شريك وتشوف كل حاجة بعينه — <b>عرض بس</b>، مفيش أي حاجة بتتغيّر، والشريك مش بيحس بحاجة.</p></div></div>
    <div class="card" style="margin-top:12px">
      <label class="f">دوّر على الشريك</label>
      <input class="in" data-mq autocomplete="off" placeholder="بالاسم، الموبايل، كود الإحالة، أو المنطقة…" inputmode="search">
      <div class="small muted" style="margin-top:6px" data-mcount></div>
      <div data-mlist style="margin-top:10px"></div>
    </div>`);
  const input = $('[data-mq]'), list = $('[data-mlist]'), count = $('[data-mcount]');
  const render = () => {
    const raw = input.value.trim();
    const q = raw.toLowerCase(), qm = normMobile(raw);
    let rows = S.fl.filter((f) => !f.duplicate_of);
    if (raw) rows = rows.filter((f) =>
      (f.name || '').toLowerCase().includes(q) ||
      (qm && f.mobile && f.mobile.includes(qm)) ||
      (f.ref_code || '').toLowerCase().includes(q) ||
      (f.email || '').toLowerCase().includes(q) ||
      [f.gov, f.region].filter(Boolean).join(' ').toLowerCase().includes(q));
    count.textContent = raw ? `${rows.length} نتيجة` : `${rows.length} شريك إجمالي — اكتب للبحث`;
    const slice = rows.slice(0, 40);
    list.innerHTML = slice.map((f) => `
      <div class="mk-row">
        <div class="mk-av">${esc((f.name || '؟').trim().slice(0, 1))}</div>
        <div class="mk-id">
          <b>${esc(f.name || '—')}</b> ${chip(FL_STATUS, f.status)} ${f.frozen_at ? '<span class="chip r">🔒</span>' : ''}
          <div class="small muted"><span class="mono">0${esc(f.mobile || '')}</span> • ${esc([f.gov, f.region].filter(Boolean).join(' — ') || 'بدون منطقة')}${f.ref_code ? ` • كود <span class="mono">${esc(f.ref_code)}</span>` : ''}</div>
        </div>
        <div class="mk-acts">
          <button class="btn sec sm" data-prof="${f.id}">الملف</button>
          <button class="btn pri sm" data-open="${f.id}">👁️ خش بيه</button>
        </div>
      </div>`).join('') || '<div class="empty">مفيش شريك بالبحث ده</div>';
    if (rows.length > slice.length) list.innerHTML += `<div class="small muted" style="text-align:center;margin-top:8px">+${rows.length - slice.length} كمان — ضيّق البحث</div>`;
    $$('[data-open]', list).forEach((b) => b.onclick = () => openAs(b.dataset.open));
    $$('[data-prof]', list).forEach((b) => b.onclick = () => openProfile(b.dataset.prof));
  };
  input.oninput = render; render(); if (!matchMedia('(max-width: 900px)').matches) input.focus();
}

// ------------------------------------------------------------------ partner profile (full page)
function openProfile(id) { S.profileId = id; go('profile'); }
const ledKind = (x) => x.kind === 'paper' ? 'بونص ورق' : x.kind === 'days' ? `بونص ${x.tier_days} يوم` : 'تسوية';

async function profile() {
  const id = S.profileId, f = S.flMap.get(id);
  if (!f) { S.view = 'partners'; return partners(); }
  const [sumR, c, l, w, msgs] = await Promise.all([
    sb.rpc('admin_freelancer_summary', { p_freelancer: id }),
    sb.from('candidates').select('*').eq('freelancer_id', id).order('created_at', { ascending: false }),
    sb.from('bonus_ledger').select('*').eq('freelancer_id', id).order('created_at', { ascending: false }),
    sb.from('withdrawals').select('*').eq('freelancer_id', id).order('created_at', { ascending: false }),
    can('partners') ? sb.from('messages').select('id,from_staff,body,created_at,read_at').eq('freelancer_id', id).order('created_at', { ascending: false }).limit(30) : Promise.resolve({ data: [] }),
  ]);
  if (c.error) throw c.error;
  const cands = c.data || [], led = l.data || [], wds = w.data || [];
  const sm = (!sumR.error && sumR.data) || {};
  const fz = sm.freelancer || { frozen: !!f.frozen_at, frozen_reason: f.frozen_reason, ref_code: f.ref_code };
  const bal = sm.balance || {};
  const cnt = sm.counts || {
    total: cands.length, hired: cands.filter((x) => x.status === 'hired').length,
    pending: cands.filter((x) => ['submitted', 'new'].includes(x.status)).length, rejected: cands.filter((x) => x.status === 'rejected').length,
  };
  const candName = (cid) => cands.find((k) => k.id === cid)?.name || '';
  const TABS = [['cands', `المناديب (${cands.length})`], ['money', 'الفلوس'], can('partners') && ['msgs', 'الرسايل'], ['notes', 'ملاحظات'], can('audit') && ['log', 'السجل']].filter(Boolean);
  if (!TABS.some((t) => t[0] === S.profTab)) S.profTab = 'cands';
  view(`
    <div class="ph"><button class="btn ghost sm" data-back>→ رجوع للشركاء</button></div>
    <div class="card prof-h ${fz.frozen ? 'frozen' : ''}">
      <div class="prof-av">${esc(f.name.trim().slice(0, 1) || '؟')}</div>
      <div class="prof-id">
        <h1>${esc(f.name)} ${chip(FL_STATUS, f.status)} ${fz.frozen ? '<span class="chip r">🔒 متجمّد</span>' : ''}</h1>
        <div class="small muted prof-meta">
          <a class="mono" href="${waLink(f.mobile)}" target="_blank" rel="noopener">0${esc(f.mobile)}</a>
          <span>${esc([f.gov, f.region].filter(Boolean).join(' — ') || 'بدون منطقة')}</span>
          <span>مسجّل ${fmtDate(f.created_at)}</span>
          ${fz.ref_code ? `<span>كود الإحالة <b class="mono">${esc(fz.ref_code)}</b></span>` : ''}
          ${f.email ? `<span class="mono">${esc(f.email)}</span>` : ''}
        </div>
        ${fz.frozen ? `<div class="prof-fz">🔒 السحب والترشيح موقوفين — السبب: ${esc(fz.frozen_reason || '—')}</div>` : ''}
      </div>
      <div class="prof-acts">
        <button class="btn sec sm" data-as title="بيفتح تطبيق الشريك للقراءة بس">👁️ شوف التطبيق بعينه</button>
        <button class="btn sec sm" data-stmt>🧾 كشف حساب شهري</button>
        ${can('partners') ? `<button class="btn sec sm" data-ctl>🛡️ التحكم في الحساب</button><button class="btn sec sm" data-msg>💬 رسالة</button><button class="btn sec sm" data-edit>✏️ تعديل</button>
          <button class="btn ${fz.frozen ? 'pri' : 'dan'} sm" data-fz>${fz.frozen ? '🔓 فك التجميد' : '🔒 تجميد الأرباح'}</button>` : ''}
      </div>
    </div>
    <div class="grid4" style="margin-top:12px">
      <div class="card kpi b"><div class="lbl">المناديب</div><div class="val">${cnt.total}</div><div class="small muted">شغالين ${cnt.hired} • مستنيين ${cnt.pending} • مرفوض ${cnt.rejected}</div></div>
      <div class="card kpi g"><div class="lbl">إجمالي الأرباح</div><div class="val">${money(bal.total_earned)}</div></div>
      <div class="card kpi a"><div class="lbl">اتصرف</div><div class="val">${money(bal.paid)}</div><div class="small muted">قيد المراجعة ${money(bal.pending)}</div></div>
      <div class="card kpi p"><div class="lbl">الرصيد المتاح</div><div class="val">${money(bal.balance)}</div></div>
    </div>
    <div class="tabs" role="tablist">${TABS.map(([k, t]) => `<button role="tab" data-tab="${k}" class="${k === S.profTab ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div id="ptab"></div>`);

  const host = $('#ptab');
  const drawTab = async (k) => {
    S.profTab = k;
    $$('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === k));
    if (k === 'cands') {
      host.innerHTML = `<div class="card"><div class="tw"><table class="t"><thead><tr><th>الكود</th><th>الاسم</th><th>الشركة</th><th>الحالة</th><th>الورق</th><th>بداية الشغل</th><th></th></tr></thead><tbody>
        ${cands.map((x) => `<tr><td class="mono small">${esc(x.code)}<div class="muted">${fmtDate(x.created_at)}</div></td><td>${esc(x.name)}<div class="small mono muted">0${esc(x.mobile)}</div></td><td>${esc(compName(x.company_id, x.company_name))}</td><td>${chip(CAND_STATUS, x.status)}</td><td>${fmtDate(x.paper_date)}</td><td>${fmtDate(x.start_date)}</td>
          <td>${can('couriers') ? `<button class="btn sec sm" data-ced="${x.id}">تعديل</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">لسه مرشّحش حد</td></tr>'}
        </tbody></table></div></div>`;
      $$('[data-ced]', host).forEach((b) => b.onclick = () => courierEdit([cands.find((x) => x.id === b.dataset.ced)]));
    } else if (k === 'money') {
      host.innerHTML = `<div class="card">
        <div class="ph" style="margin-bottom:8px"><h3 style="margin:0">سجل الأرباح</h3>${can('partners') ? '<button class="btn sec sm" data-adj>➕ تسوية يدوية</button>' : ''}</div>
        <div class="tw"><table class="t"><thead><tr><th>التاريخ</th><th>النوع</th><th>المندوب</th><th>المبلغ</th><th></th></tr></thead><tbody>
        ${led.map((x) => `<tr style="${x.reversed_at ? 'opacity:.5' : ''}"><td>${fmtDate(x.earned_on)}</td><td>${ledKind(x)}${x.note ? `<div class="small muted">${esc(x.note)}</div>` : ''}${x.reversed_at ? `<div class="small" style="color:var(--red)">ملغي: ${esc(x.reverse_reason || '')}</div>` : ''}</td><td>${esc(candName(x.candidate_id))}</td><td><b>${money(x.amount)}</b></td><td>${!x.reversed_at && can('partners') ? `<button class="btn dan sm" data-rev="${x.id}">إلغاء</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">—</td></tr>'}
        </tbody></table></div>
        <h3 style="margin-top:16px">السحوبات</h3>
        <div class="tw"><table class="t"><thead><tr><th>التاريخ</th><th>المبلغ</th><th>الطريقة</th><th>الحالة</th></tr></thead><tbody>
        ${wds.map((x) => `<tr><td>${fmtDate(x.created_at)}</td><td><b>${money(x.amount)}</b></td><td>${esc(x.method)}<div class="small mono muted">${esc(x.details)}</div></td><td>${chip(WD_STATUS, x.status)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">—</td></tr>'}
        </tbody></table></div></div>`;
      const adj = $('[data-adj]', host);
      if (adj) adj.onclick = async () => {
        const amt = await promptBox('تسوية يدوية', 'المبلغ (موجب = إضافة، سالب = خصم)', { type: 'number' }); if (!amt) return;
        const note = await promptBox('سبب التسوية', 'السبب (هيظهر للشريك)'); if (!note) return;
        const { error } = await sb.rpc('admin_add_adjustment', { p_freelancer: id, p_amount: Number(amt), p_note: note });
        if (error) return toast(errMsg(error), 'bad'); toast('تم ✅', 'ok'); go('profile');
      };
      $$('[data-rev]', host).forEach((btn) => btn.onclick = async () => {
        const r = await promptBox('إلغاء بند أرباح', 'سبب الإلغاء'); if (!r) return;
        const { error } = await sb.rpc('admin_reverse_ledger', { p_id: Number(btn.dataset.rev), p_reason: r });
        if (error) return toast(errMsg(error), 'bad'); toast('تم الإلغاء', 'ok'); go('profile');
      });
    } else if (k === 'msgs') {
      const list = (msgs.data || []).slice().reverse();
      host.innerHTML = `<div class="card"><div class="ph" style="margin-bottom:8px"><h3 style="margin:0">آخر الرسايل</h3><button class="btn pri sm" data-openchat>💬 افتح المحادثة</button></div>
        <div class="bubbles prof-bub">${list.map((m) => `<div class="bub ${m.from_staff ? 'me' : 'them'}">${esc(m.body)}<span>${new Date(m.created_at).toLocaleString('en-GB')}</span></div>`).join('') || '<div class="empty">مفيش رسايل لسه</div>'}</div></div>`;
      $('[data-openchat]', host).onclick = () => go('chat', id);
      const bb = $('.prof-bub', host); bb.scrollTop = bb.scrollHeight;
    } else if (k === 'notes') {
      host.innerHTML = `<div class="card stack"><label class="f">ملاحظات داخلية (مش بتظهر للشريك)</label>
        <textarea class="in" rows="6" data-notes ${can('partners') ? '' : 'readonly'}>${esc(f.notes || '')}</textarea>
        ${can('partners') ? '<div class="row" style="justify-content:flex-end"><button class="btn pri" data-savenotes>حفظ الملاحظات</button></div>' : ''}</div>`;
      const sv = $('[data-savenotes]', host);
      if (sv) sv.onclick = () => busy(sv, async () => {
        const notes = $('[data-notes]', host).value.trim() || null;
        const { error } = await sb.from('freelancers').update({ notes }).eq('id', id);
        if (error) return toast(errMsg(error), 'bad');
        f.notes = notes; toast('اتحفظت ✅', 'ok');
      });
    } else if (k === 'log') {
      host.innerHTML = '<div class="spin"></div>';
      const ids = [id, ...cands.map((x) => x.id)].slice(0, 200);
      const { data, error } = await sb.from('audit_log').select('*').in('record_id', ids).order('at', { ascending: false }).limit(100);
      if (S.profTab !== 'log' || !host.isConnected) return;
      if (error) { host.innerHTML = `<div class="card empty">${esc(errMsg(error))}</div>`; return; }
      const rows = (data || []).filter((a) => ids.includes(a.record_id));
      host.innerHTML = `<div class="card"><div class="tw"><table class="t"><thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>التغيير</th></tr></thead><tbody>
        ${rows.map((a) => `<tr><td class="small">${new Date(a.at).toLocaleString('en-GB')}</td><td class="small mono">${esc(a.actor_email || a.actor_role || 'system')}</td>
          <td><span class="chip n">${esc(AUD_T[a.table_name] || a.table_name || '')}</span> ${esc(AUD_A[a.action] || a.action)}${a.record_id !== id ? `<div class="small muted">${esc(candName(a.record_id))}</div>` : ''}</td>
          <td><div class="small" style="max-width:520px;white-space:normal;word-break:break-word">${esc(auditDiff(a)).slice(0, 600)}</div></td></tr>`).join('') || '<tr><td colspan="4" class="empty">مفيش تغييرات مسجّلة</td></tr>'}
        </tbody></table></div></div>`;
    }
  };
  $$('[data-tab]').forEach((b) => b.onclick = () => drawTab(b.dataset.tab));
  drawTab(S.profTab);

  $('[data-back]').onclick = () => go('partners');
  $('[data-as]').onclick = () => window.open('/?as=' + encodeURIComponent(id), '_blank', 'noopener');
  $('[data-stmt]').onclick = () => statementModal(f, led, wds, candName);
  const on = (sel, fn) => { const el = $(sel); if (el) el.onclick = fn; };
  on('[data-msg]', () => go('chat', id));
  on('[data-ctl]', () => partnerControl(f));
  on('[data-edit]', () => partnerEdit(f));
  on('[data-fz]', async (e) => {
    const btn = e.currentTarget;
    let reason = null;
    if (fz.frozen) {
      if (!(await confirmBox('فك التجميد', `${f.name} هيرجع يقدر يسحب ويرشّح عادي، وهيوصله إشعار بكده.`, 'فك التجميد', false))) return;
    } else {
      reason = await promptBox('تجميد الأرباح', 'سبب التجميد (هيظهر للشريك) — السحب والترشيح هيتوقفوا'); if (!reason) return;
    }
    await busy(btn, async () => {
      const { error } = await sb.rpc('admin_set_frozen', { p_freelancer: id, p_on: !fz.frozen, p_reason: reason });
      if (error) return toast(errMsg(error), 'bad');
      toast(fz.frozen ? 'اتفك التجميد ✅' : 'الحساب اتجمّد 🔒', 'ok'); await loadBase(); go('profile');
    });
  });
}

// Printable monthly statement: opening balance, every earning/withdrawal in the month with a running balance.
function statementModal(f, led, wds, candName) {
  const now = new Date();
  const def = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const m = modal(`<div class="stmt-bar no-print"><label class="small bold">الشهر</label><input class="in" type="month" value="${def}" max="${def}" data-mon>
      <span style="flex:1"></span><button class="btn pri sm" data-print>🖨️ طباعة / PDF</button><button class="btn ghost sm" data-close>✕</button></div>
    <div class="stmt" data-stmt></div>`, 'wide stmt-modal');
  const dOf = (x) => String(x || '').slice(0, 10);
  const sum = (arr, k = 'amount') => arr.reduce((t, x) => t + Number(x[k] || 0), 0);
  const draw = () => {
    const mon = $('[data-mon]', m.el).value || def;
    const [y, mo] = mon.split('-').map(Number);
    const start = `${mon}-01`;
    const nx = new Date(y, mo, 1);
    const end = `${nx.getFullYear()}-${String(nx.getMonth() + 1).padStart(2, '0')}-01`;
    const L = led.filter((x) => !x.reversed_at), W = wds.filter((x) => x.status !== 'rejected');
    const inM = (d) => d >= start && d < end;
    const opening = sum(L.filter((x) => dOf(x.earned_on) < start)) - sum(W.filter((x) => dOf(x.created_at) < start));
    const rows = [
      ...L.filter((x) => inM(dOf(x.earned_on))).map((x) => {
        const a = Number(x.amount) || 0;
        return { d: dOf(x.earned_on), t: `${ledKind(x)}${candName(x.candidate_id) ? ' — ' + candName(x.candidate_id) : ''}${x.note ? ' (' + x.note + ')' : ''}`, cr: a > 0 ? a : 0, db: a < 0 ? -a : 0 };
      }),
      ...W.filter((x) => inM(dOf(x.created_at))).map((x) => ({ d: dOf(x.created_at), t: `سحب — ${x.method || ''} (${WD_STATUS[x.status]?.[0] || x.status})`, cr: 0, db: Number(x.amount) || 0 })),
    ].sort((a, b) => a.d.localeCompare(b.d));
    let run = opening;
    const totCr = rows.reduce((t, r) => t + r.cr, 0), totDb = rows.reduce((t, r) => t + r.db, 0);
    const monthName = new Date(y, mo - 1, 1).toLocaleDateString(isEn ? 'en-GB' : 'ar-EG', { month: 'long', year: 'numeric' });
    $('[data-stmt]', m.el).innerHTML = `
      <div class="st-head"><img src="../brand/fs-logo.png" alt="Full Speed"><div><h2>كشف حساب شهري</h2><div class="muted">${esc(monthName)}</div></div></div>
      <div class="kv st-kv">
        <div><span>الشريك</span><b>${esc(f.name)}</b></div><div><span>الموبايل</span><span class="mono">0${esc(f.mobile)}</span></div>
        <div><span>المنطقة</span>${esc([f.gov, f.region].filter(Boolean).join(' — ') || '—')}</div><div><span>تاريخ الإصدار</span>${fmtDate(new Date())}</div>
      </div>
      <div class="tw"><table class="t st-t"><thead><tr><th>التاريخ</th><th>البيان</th><th>له (+)</th><th>عليه (−)</th><th>الرصيد</th></tr></thead><tbody>
        <tr class="st-open"><td>${fmtDate(start)}</td><td>رصيد أول الشهر</td><td></td><td></td><td><b>${money(opening)}</b></td></tr>
        ${rows.map((r) => { run += r.cr - r.db; return `<tr><td>${fmtDate(r.d)}</td><td>${esc(r.t)}</td><td>${r.cr ? money(r.cr) : ''}</td><td>${r.db ? money(r.db) : ''}</td><td>${money(run)}</td></tr>`; }).join('') || '<tr><td colspan="5" class="empty">مفيش حركات في الشهر ده</td></tr>'}
        <tr class="st-tot"><td colspan="2">الإجمالي ورصيد آخر الشهر</td><td>${money(totCr)}</td><td>${money(totDb)}</td><td>${money(opening + totCr - totDb)}</td></tr>
      </tbody></table></div>
      <p class="small muted">الأرباح الملغية وطلبات السحب المرفوضة مش محسوبة. السحوبات محسوبة بتاريخ الطلب (المدفوعة وقيد المراجعة).</p>
      <div class="st-foot small muted">Full Speed Logistics — كشف آلي من لوحة الإدارة</div>`;
  };
  $('[data-mon]', m.el).oninput = draw;
  $('[data-print]', m.el).onclick = () => {
    document.body.classList.add('printing');
    const done = () => document.body.classList.remove('printing');
    addEventListener('afterprint', done, { once: true });
    window.print();
  };
  draw();
}

// ------------------------------------------------------------------ partner account control (suspend / password / sign out)
const genPassword = () => {
  const a = 'abcdefghjkmnpqrstuvwxyz', d = '23456789', r = (s) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length];
  return Array.from({ length: 4 }, () => r(a)).join('') + Array.from({ length: 4 }, () => r(d)).join('');
};
async function loginInfo(id) {
  if (!S.logins) {
    const { data } = await sb.rpc('admin_partner_logins');
    S.logins = new Map((data || []).map((x) => [x.freelancer_id, x]));
  }
  return S.logins.get(id);
}
async function partnerControl(f) {
  const li = f.user_id ? await loginInfo(f.id) : null;
  const off = f.status === 'Inactive';
  const m = modal(`
    <h2>🛡️ التحكم في حساب ${esc(f.name)}</h2>
    <div class="ctl-grid">
      <div class="ctl-card">
        <div class="ctl-h">حالة الأكونت ${chip(FL_STATUS, f.status)}</div>
        <div class="small muted">${off ? `موقوف${f.status_reason ? ` — ${esc(f.status_reason)}` : ''}. مش قادر يدخل التطبيق.` : 'الأكونت شغال ويقدر يدخل التطبيق.'}</div>
        <button class="btn ${off ? 'pri' : 'dan'} sm" data-c="${off ? 'act' : 'sus'}">${off ? '✅ تفعيل الأكونت' : '⛔ إيقاف الأكونت'}</button>
      </div>
      <div class="ctl-card">
        <div class="ctl-h">الدخول والأجهزة</div>
        <div class="small muted">${!f.user_id ? 'ملوش دخول لسه.' : `آخر دخول: <b>${li?.last_sign_in_at ? new Date(li.last_sign_in_at).toLocaleString('en-GB') : '—'}</b><br>أجهزة فاتحة دلوقتي: <b>${li?.sessions ?? 0}</b>`}</div>
        ${f.user_id ? '<button class="btn sec sm" data-c="out">🚪 خروج من كل الأجهزة</button>' : ''}
      </div>
      <div class="ctl-card wide">
        <div class="ctl-h">${f.user_id ? 'تغيير الباسوورد' : 'إنشاء دخول للشريك'}</div>
        <div class="row" style="gap:6px"><input class="in mono" data-pwv placeholder="الباسوورد الجديد (6 على الأقل)" style="flex:1;min-width:0">
          <button class="btn sec sm" data-c="gen" type="button">🎲 ولّد</button></div>
        ${f.user_id ? '<label class="small row" style="gap:6px"><input type="checkbox" data-pwout checked> خرّجه من الأجهزة التانية</label>' : ''}
        <button class="btn pri sm" data-c="pw">💾 حفظ الباسوورد</button>
        <div data-pwdone></div>
      </div>
    </div>
    <div class="row" style="justify-content:space-between;margin-top:14px">
      <div class="row"><button class="btn sec sm" data-c="edit">✏️ تعديل البيانات</button><button class="btn sec sm" data-c="mob">📱 تغيير الموبايل</button></div>
      <button class="btn ghost" data-close>قفل</button>
    </div>`, 'wide');
  const el = m.el, done = async (msg) => { toast(msg, 'ok'); S.logins = null; await loadBase(); };
  const act = async (b, fn) => busy(b, async () => { try { await fn(); } catch (e) { toast(errMsg(e), 'bad'); } });
  $$('[data-c]', el).forEach((b) => b.onclick = () => ({
    sus: () => act(b, async () => {
      const reason = await promptBox('إيقاف الأكونت', 'سبب الإيقاف (هيتسجل في السجل)'); if (!reason) return;
      await fnCall({ action: 'suspend_freelancer', freelancer_id: f.id, reason });
      m.close(); await done('الأكونت اتوقف وخرج من كل الأجهزة ⛔'); go(S.view);
    }),
    act: () => act(b, async () => {
      if (!(await confirmBox('تفعيل الأكونت', `${f.name} هيقدر يدخل التطبيق تاني.`, 'تفعيل', false))) return;
      await fnCall({ action: 'activate_freelancer', freelancer_id: f.id });
      m.close(); await done('الأكونت اتفعّل ✅'); go(S.view);
    }),
    out: () => act(b, async () => {
      if (!(await confirmBox('خروج من كل الأجهزة', 'هيتطلب منه يسجّل دخول تاني على كل الأجهزة.', 'خروج'))) return;
      const r = await fnCall({ action: 'sign_out_freelancer', freelancer_id: f.id });
      await done(`اتقفلت ${r.sessions ?? 0} جلسة 🚪`);
    }),
    gen: () => { $('[data-pwv]', el).value = genPassword(); },
    pw: () => act(b, async () => {
      const p = $('[data-pwv]', el).value.trim();
      if (p.length < 6) return toast('الباسوورد 6 حروف/أرقام على الأقل', 'bad');
      await fnCall(f.user_id
        ? { action: 'reset_freelancer_password', freelancer_id: f.id, password: p, sign_out: $('[data-pwout]', el)?.checked !== false }
        : { action: 'create_freelancer_login', freelancer_id: f.id, password: p });
      const msg = `أهلاً ${f.name}، بيانات دخولك على تطبيق Full Speed Partners:\nالموبايل: 0${f.mobile}\nالباسوورد: ${p}\nhttps://fullspeed-freelance.pages.dev`;
      $('[data-pwdone]', el).innerHTML = `<div class="ctl-ok">✅ اتحفظ. <a class="btn pri sm" target="_blank" rel="noopener" href="${waLink(f.mobile)}?text=${encodeURIComponent(msg)}">ابعتها واتساب</a>
        <button class="btn sec sm" data-copy>نسخ</button></div>`;
      $('[data-copy]', el).onclick = () => navigator.clipboard?.writeText(msg).then(() => toast('اتنسخت'), () => {});
      await done('الباسوورد اتغيّر 🔑');
    }),
    edit: () => { m.close(); partnerEdit(f); },
    mob: () => act(b, async () => {
      const v = await promptBox('تغيير رقم الموبايل', 'الرقم الجديد (هيبقى هو اسم الدخول)', { placeholder: '01xxxxxxxxx' }); if (!v) return;
      await fnCall({ action: 'change_freelancer_mobile', freelancer_id: f.id, mobile: v });
      m.close(); await done('تم تغيير الموبايل ✅'); go(S.view);
    }),
  })[b.dataset.c]?.());
}

function partnerEdit(f) {
  const m = modal(`
    <h2>تعديل: ${esc(f.name)}</h2>
    <form class="stack">
      <div><label class="f">الاسم</label><input class="in" name="name" value="${esc(f.name)}" required></div>
      <div class="grid2"><div><label class="f">الإيميل</label><input class="in mono" name="email" type="email" value="${esc(f.email || '')}"></div>
        <div><label class="f">الحالة</label><select class="in" name="status">${Object.entries(FL_STATUS).map(([k, [t]]) => `<option value="${k}" ${k === f.status ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
      <div class="grid2"><div><label class="f">المحافظة</label><input class="in" name="gov" value="${esc(f.gov || '')}" list="govl"><datalist id="govl">${GOVS.map((g) => `<option>${g}</option>`).join('')}</datalist></div>
        <div><label class="f">المنطقة</label><input class="in" name="region" value="${esc(f.region || '')}"></div></div>
      <div class="grid2"><div><label class="f">كود الإحالة</label><input class="in mono" name="ref_code" value="${esc(f.ref_code || '')}" maxlength="20" pattern="[A-Za-z0-9_-]{3,20}" title="3–20 حرف إنجليزي أو رقم"></div>
        <div><label class="f">الموبايل (اسم الدخول)</label><input class="in mono" value="0${esc(f.mobile || '')}" disabled></div></div>
      <div><label class="f">ملاحظات داخلية</label><textarea class="in" name="notes">${esc(f.notes || '')}</textarea></div>
      <div class="err" data-err></div>
      <div class="row" style="justify-content:space-between">
        <div class="row">
          ${f.user_id ? '<button type="button" class="btn sec sm" data-pw>🔑 كلمة مرور جديدة</button>' : (f.duplicate_of ? '' : '<button type="button" class="btn sec sm" data-mk>🔑 إنشاء دخول</button>')}
          ${f.duplicate_of ? '' : '<button type="button" class="btn sec sm" data-mob>📱 تغيير الموبايل</button>'}
        </div>
        <div class="row"><button type="button" class="btn sec" data-close>إلغاء</button><button class="btn pri">حفظ</button></div>
      </div>
      <p class="small muted" style="margin:0">مفيش حذف للحسابات — لإيقاف حساب غيّر الحالة لـ "موقوف" (بيقفل الدخول ويخرّجه من كل الأجهزة).</p>
    </form>`);
  const fm = $('form', m.el);
  fm.onsubmit = async (e) => {
    e.preventDefault();
    await busy($('button.pri', fm), async () => {
      // Suspending / re-activating also blocks or restores the login, so it goes through the server function.
      const want = fm.status.value, wasOff = f.status === 'Inactive';
      let status = want;
      if (want === 'Inactive' && !wasOff) {
        const reason = await promptBox('إيقاف الأكونت', 'سبب الإيقاف (هيتسجل في السجل)'); if (!reason) return;
        try { await fnCall({ action: 'suspend_freelancer', freelancer_id: f.id, reason }); } catch (e2) { return ($('[data-err]', fm).textContent = errMsg(e2)); }
        status = undefined;
      } else if (wasOff && want === 'Active') {
        try { await fnCall({ action: 'activate_freelancer', freelancer_id: f.id }); } catch (e2) { return ($('[data-err]', fm).textContent = errMsg(e2)); }
        status = undefined;
      }
      const patch = {
        name: fm.name.value.trim(), email: fm.email.value.trim() || null,
        gov: fm.gov.value.trim(), region: fm.region.value.trim(), notes: fm.notes.value.trim() || null,
        ref_code: fm.ref_code.value.trim().toUpperCase() || null,
      };
      if (status) patch.status = status;
      const { error } = await sb.from('freelancers').update(patch).eq('id', f.id);
      if (error) {
        const em = errMsg(error);
        return ($('[data-err]', fm).textContent = em.includes('ref_code') ? 'كود الإحالة ده مستخدم لشريك تاني' : em.includes('duplicate') ? 'الإيميل ده مستخدم لشريك تاني' : em);
      }
      m.close(); toast('تم الحفظ ✅', 'ok'); await loadBase(); go(S.view);
    });
  };
  const pwBtn = $('[data-pw]', m.el) || $('[data-mk]', m.el);
  if (pwBtn) pwBtn.onclick = async () => {
    const p = await promptBox('كلمة مرور جديدة للشريك', '6 حروف/أرقام على الأقل — ابعتها للشريك بنفسك', { type: 'text' });
    if (!p) return; if (p.length < 6) return toast('6 على الأقل', 'bad');
    try { await fnCall({ action: f.user_id ? 'reset_freelancer_password' : 'create_freelancer_login', freelancer_id: f.id, password: p }); toast('تم ✅', 'ok'); m.close(); await loadBase(); go(S.view); }
    catch (e) { toast(errMsg(e), 'bad'); }
  };
  const mob = $('[data-mob]', m.el);
  if (mob) mob.onclick = async () => {
    const v = await promptBox('تغيير رقم الموبايل', 'الرقم الجديد (هيبقى هو اسم الدخول)', { placeholder: '01xxxxxxxxx' });
    if (!v) return;
    try { await fnCall({ action: 'change_freelancer_mobile', freelancer_id: f.id, mobile: v }); toast('تم تغيير الموبايل ✅', 'ok'); m.close(); await loadBase(); go(S.view); }
    catch (e) { toast(errMsg(e), 'bad'); }
  };
}

// ------------------------------------------------------------------ couriers
async function couriers() {
  const [cands, led, jobsR] = await Promise.all([
    fetchAll(() => sb.from('candidates').select('*').order('created_at', { ascending: false })),
    fetchAll(() => sb.from('bonus_ledger').select('candidate_id,amount,kind').is('reversed_at', null)),
    sb.from('jobs').select('id,code,title'),
  ]);
  const earned = {}; led.forEach((l) => { if (l.candidate_id) earned[l.candidate_id] = (earned[l.candidate_id] || 0) + Number(l.amount); });
  const jMap = new Map((jobsR.data || []).map((j) => [j.id, j]));
  const rulesR = await sb.from('bonus_rules').select('company_id,kind,min_days,amount').eq('active', true);
  const tgt = {}; (rulesR.data || []).forEach((r) => { if (r.kind === 'days') tgt[r.company_id] = Math.max(tgt[r.company_id] || 0, r.min_days); });
  const sel = new Set();
  const perFl = {}; cands.forEach((c) => { perFl[c.freelancer_id] = (perFl[c.freelancer_id] || 0) + 1; });
  const partnerOpts = Object.entries(perFl).sort((a, b) => b[1] - a[1])
    .map(([id, n]) => `<option value="${id}">${esc(flName(id))} (${n})</option>`).join('');
  view(`
    <div class="ph"><h1>المناديب</h1><div class="row"><div class="seg" role="group" aria-label="طريقة العرض"><button data-mode="table">📋 جدول</button><button data-mode="board">🗂️ لوحة المراحل</button></div><button class="btn sec sm" data-csv>⬇️ تقرير مالي Excel</button></div></div>
    <div class="grid4" style="margin-bottom:12px">
      <div class="card kpi b"><div class="lbl">إجمالي الترشيحات</div><div class="val">${cands.length}</div></div>
      <div class="card kpi g"><div class="lbl">اتعيّنوا</div><div class="val">${cands.filter((c) => c.status === 'hired').length}</div></div>
      <div class="card kpi a"><div class="lbl">تحت المراجعة</div><div class="val">${cands.filter((c) => ['submitted', 'new'].includes(c.status)).length}</div></div>
      <div class="card kpi p"><div class="lbl">إجمالي البونص المستحق</div><div class="val">${money(Object.values(earned).reduce((a, b) => a + b, 0))}</div></div>
    </div>
    <div class="tools">
      <input class="in q" placeholder="بحث: المندوب، الكود، موبايل، الشريك" data-q>
      <select class="in" data-st><option value="">كل الحالات</option>${Object.entries(CAND_STATUS).map(([k, [t]]) => `<option value="${k}">${t}</option>`).join('')}</select>
      <select class="in" data-co><option value="">كل الشركات</option>${S.companies.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}<option value="NONE">بدون شركة مطابقة</option></select>
      <select class="in" data-due><option value="">كل الاستحقاقات</option><option value="paper">بونص ورق بس</option><option value="any">ليه أي بونص</option><option value="none">بدون بونص</option></select>
      <select class="in" data-fl><option value="">كل الشركاء</option>${partnerOpts}</select>
      <button class="btn sec sm" data-cols title="اختار العواميد اللي تظهر">🧩 العواميد</button>
    </div>
    <div class="bulk hidden" data-bulk>تم تحديد <span data-n></span> <button class="btn pri sm" data-bedit>تحديث جماعي</button><button class="btn ghost sm" data-bclear>إلغاء التحديد</button></div>
    <div id="tbl"></div><div id="board" class="hidden"></div>`);
  let rows = [];
  const render = () => {
    const board = S.courMode === 'board';
    $('#tbl').classList.toggle('hidden', board); $('#board').classList.toggle('hidden', !board); $('[data-st]').classList.toggle('hidden', board);
    $$('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === S.courMode));
    const q = $('[data-q]').value.trim().toLowerCase(), st = board ? '' : $('[data-st]').value, co = $('[data-co]').value, due = $('[data-due]').value, fl = $('[data-fl]').value;
    rows = cands.filter((c) => FX.match(c) && (!st || c.status === st) && (!fl || c.freelancer_id === fl) && (!co || (co === 'NONE' ? !c.company_id : c.company_id === co)) &&
      (!due || (due === 'any' ? earned[c.id] > 0 : due === 'none' ? !earned[c.id] : (c.paper_date && !c.start_date))) &&
      (!q || [c.name, c.code, c.mobile, '0' + c.mobile, flName(c.freelancer_id), S.flMap.get(c.freelancer_id)?.mobile].join(' ').toLowerCase().includes(q)));
    FX.draw(rows);
    if (board) return drawBoard($('#board'), rows, render);
    const days = (c) => c.start_date ? daysBetween(c.start_date, c.end_date && c.end_date < today() ? c.end_date : today()) : null;
    const ALL = {
      code: ['الكود', (c) => `<span class="mono small">${esc(c.code)}</span><div class="small muted">${fmtDate(c.created_at)}</div>`],
      name: ['المندوب', (c) => `<button class="lnk" data-cour="${c.id}"><b>${esc(c.name)}</b></button><div class="small mono muted">0${esc(c.mobile)}</div>`],
      partner: ['الشريك المرشّح', (c) => { const f = S.flMap.get(c.freelancer_id); return f ? `<button class="who" data-fl-open="${f.id}" title="افتح ملف الشريك"><span class="who-av">${esc((f.name || '؟').trim().slice(0, 1))}</span><span><b>${esc(f.name)}</b><span class="small mono muted">0${esc(f.mobile || '')}</span></span></button>` : '<span class="muted">—</span>'; }],
      company: ['الشركة / الوظيفة', (c) => `${esc(compName(c.company_id, c.company_name))}${c.job_id ? `<div class="small muted">${esc(jMap.get(c.job_id)?.title || '')} <span class="mono">${esc(jMap.get(c.job_id)?.code || '')}</span></div>` : ''}`],
      area: ['المحافظة / المنطقة', (c) => `${esc(c.gov || '—')}<div class="small muted">${esc(c.region || '')}</div>`],
      vehicle: ['المركبة', (c) => `<span class="small">${esc(c.vehicle || '—')}</span>`],
      source: ['المصدر', (c) => `<span class="chip ${c.source === 'join' ? 'a' : 'n'}">${c.source === 'join' ? '🔗 لينك الإحالة' : '📱 التطبيق'}</span>`],
      status: ['الحالة', (c) => chip(CAND_STATUS, c.status)],
      days: ['الأيام', (c) => { const d = days(c); if (d == null) return '<span class="small muted">لم يبدأ</span>'; const t = tgt[c.company_id] || 26; return `<div class="small">${d} / ${t}${d >= t ? ' 🌟' : ''}</div><div class="bar"><i style="width:${Math.min(100, d / t * 100)}%"></i></div>`; }],
      paper: ['الورق', (c) => c.paper_date ? `✅ <span class="small">${fmtDate(c.paper_date)}</span>` : '—'],
      start: ['أول يوم شغل', (c) => `<span class="small">${fmtDate(c.start_date)}</span>`],
      end: ['آخر يوم', (c) => `<span class="small">${fmtDate(c.end_date)}</span>`],
      bonus: ['البونص', (c) => `<b>${money(earned[c.id])}</b>`],
      updated: ['آخر تحديث', (c) => `<span class="small">${fmtDate(c.updated_at)}</span>`],
      note: ['ملاحظة الإدارة', (c) => `<span class="small muted">${esc((c.admin_note || '').slice(0, 40))}</span>`],
    };
    const shown = courCols().filter((k) => ALL[k]);
    pagedTable($('#tbl'), rows, [
      [`<input type="checkbox" data-all>`, (c) => `<input type="checkbox" data-sel="${c.id}" ${sel.has(c.id) ? 'checked' : ''}>`],
      ...shown.map((k) => ALL[k]),
      ['', (c) => `<div class="acts"><button class="btn sec sm" data-cour="${c.id}">التفاصيل</button><button class="btn sec sm" data-docs="${c.id}" title="ورق المندوب">📎 الورق</button>${can('couriers') ? `<button class="btn sec sm" data-ed="${c.id}">تعديل</button>` : ''}</div>`],
    ], { onRender: (h) => {
      $$('[data-sel]', h).forEach((x) => x.onchange = () => { x.checked ? sel.add(x.dataset.sel) : sel.delete(x.dataset.sel); bulkBar(); });
      const all = $('[data-all]', h); if (all) all.onchange = () => { rows.forEach((c) => all.checked ? sel.add(c.id) : sel.delete(c.id)); render(); bulkBar(); };
      $$('[data-ed]', h).forEach((b) => b.onclick = () => courierEdit([cands.find((c) => c.id === b.dataset.ed)]));
      $$('[data-docs]', h).forEach((b) => b.onclick = () => docsModal(cands.find((c) => c.id === b.dataset.docs)));
      $$('[data-cour]', h).forEach((b) => b.onclick = () => openCourier(b.dataset.cour));
      $$('[data-fl-open]', h).forEach((b) => b.onclick = () => openProfile(b.dataset.flOpen));
    } });
  };
  $('[data-cols]').onclick = () => {
    const ALL_T = { code: 'الكود', name: 'المندوب', partner: 'الشريك المرشّح', company: 'الشركة / الوظيفة', area: 'المحافظة / المنطقة', vehicle: 'المركبة', source: 'المصدر', status: 'الحالة', days: 'الأيام', paper: 'الورق', start: 'أول يوم شغل', end: 'آخر يوم', bonus: 'البونص', updated: 'آخر تحديث', note: 'ملاحظة الإدارة' };
    const cur = new Set(courCols());
    const m = modal(`<h2>🧩 العواميد اللي تظهر</h2><div class="cols-pick">${Object.entries(ALL_T).map(([k, t]) => `<label><input type="checkbox" value="${k}" ${cur.has(k) ? 'checked' : ''}> ${t}</label>`).join('')}</div>
      <div class="row" style="justify-content:space-between;margin-top:14px"><button class="btn ghost sm" data-def>↺ الافتراضي</button><div class="row"><button class="btn sec" data-close>إلغاء</button><button class="btn pri" data-ok>حفظ</button></div></div>`);
    $('[data-def]', m.el).onclick = () => { lsSet('fsa-cour-cols', ''); m.close(); render(); };
    $('[data-ok]', m.el).onclick = () => { lsSet('fsa-cour-cols', JSON.stringify($$('input:checked', m.el).map((x) => x.value))); m.close(); render(); };
  };
  if (S.courFl) { $('[data-fl]').value = S.courFl; S.courFl = ''; }
  if (S.courSt) { $('[data-st]').value = S.courSt; S.courSt = ''; }
  const bulkBar = () => { $('[data-bulk]').classList.toggle('hidden', !sel.size || !can('couriers') || S.courMode === 'board'); $('[data-n]').textContent = sel.size; };
  $$('[data-mode]').forEach((b) => b.onclick = () => { S.courMode = b.dataset.mode; lsSet('fsa-cour-mode', S.courMode); render(); bulkBar(); });
  $('[data-bclear]').onclick = () => { sel.clear(); render(); bulkBar(); };
  $('[data-bedit]').onclick = () => courierEdit(cands.filter((c) => sel.has(c.id)));
  $$('[data-q],[data-st],[data-co],[data-due],[data-fl]').forEach((el) => el.oninput = render);
  const FX = AX.couriersFx({ S, compName, rules: rulesR.data || [], onChange: () => render() }); FX.fillOptions(cands);
  $('[data-csv]').onclick = () => csvDownload('FullSpeed_Couriers_Financial.csv',
    ['الكود', 'المندوب', 'موبايل المندوب', 'الشركة', 'الشريك', 'موبايل الشريك', 'الحالة', 'تاريخ الورق', 'أول يوم شغل', 'آخر يوم', 'البونص المستحق'],
    rows.map((c) => [c.code, c.name, '0' + c.mobile, compName(c.company_id, c.company_name), flName(c.freelancer_id), '0' + (S.flMap.get(c.freelancer_id)?.mobile || ''), CAND_STATUS[c.status]?.[0], c.paper_date, c.start_date, c.end_date, earned[c.id] || 0]));
  render(); bulkBar();
}

const COUR_DEFAULT = ['code', 'name', 'partner', 'company', 'area', 'status', 'days', 'paper', 'bonus'];
const courCols = () => { try { const v = JSON.parse(lsGet('fsa-cour-cols') || 'null'); return Array.isArray(v) && v.length ? v : COUR_DEFAULT; } catch (_) { return COUR_DEFAULT; } };
function openCourier(id) { S.courierId = id; go('courier'); }
const SRC_AR = { partner: '📱 من تطبيق الشريك', join: '🔗 سجّل بنفسه من لينك الإحالة' };
async function courier() {
  const id = S.courierId;
  const [cR, lR, aR] = await Promise.all([
    sb.from('candidates').select('*').eq('id', id).maybeSingle(),
    sb.from('bonus_ledger').select('*').eq('candidate_id', id).order('earned_on'),
    can('audit') || can('view') ? sb.from('audit_log').select('*').eq('record_id', id).order('at').limit(200) : Promise.resolve({ data: [] }),
  ]);
  if (cR.error) throw cR.error;
  const c = cR.data; if (!c) { S.view = 'couriers'; return couriers(); }
  const f = S.flMap.get(c.freelancer_id);
  const job = c.job_id ? (await sb.from('jobs').select('*').eq('id', c.job_id).maybeSingle()).data : null;
  const rules = (await sb.from('bonus_rules').select('kind,min_days,amount').eq('company_id', c.company_id).eq('active', true)).data || [];
  const led = lR.data || [], aud = aR.data || [];
  const target = Math.max(26, ...rules.filter((r) => r.kind === 'days').map((r) => r.min_days));
  const d = c.start_date ? daysBetween(c.start_date, c.end_date && c.end_date < today() ? c.end_date : today()) : 0;
  const earnedSum = led.filter((x) => !x.reversed_at).reduce((a, x) => a + Number(x.amount), 0);
  // Timeline: key dates from the record itself + every status change found in the audit log.
  const ev = [{ at: c.created_at, t: 'اترشّح', s: `بواسطة ${f?.name || '—'}`, ic: '📝' }];
  aud.forEach((a) => {
    const b = a.before || {}, n = a.after || {};
    if (a.action === 'update' && b.status !== n.status && n.status) ev.push({ at: a.at, t: `الحالة: ${CAND_STATUS[n.status]?.[0] || n.status}`, s: `${CAND_STATUS[b.status]?.[0] || b.status || ''} ← • ${a.actor_email || 'system'}`, ic: '🔁' });
  });
  if (c.paper_date) ev.push({ at: c.paper_date, t: 'خلّص الورق', ic: '📎' });
  if (c.start_date) ev.push({ at: c.start_date, t: 'أول يوم شغل', ic: '🚀' });
  led.forEach((x) => ev.push({ at: x.earned_on, t: `${ledKind(x)}: ${money(x.amount)}`, s: x.reversed_at ? `ملغي — ${x.reverse_reason || ''}` : '', ic: x.reversed_at ? '↩️' : '💰' }));
  if (c.end_date) ev.push({ at: c.end_date, t: 'آخر يوم شغل', ic: '🏁' });
  ev.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const kv = (k, v) => `<div><span class="muted small">${k}</span><b>${v || '—'}</b></div>`;
  view(`
    <div class="ph"><button class="btn ghost sm" data-back>→ رجوع للمناديب</button></div>
    <div class="card prof-h">
      <div class="prof-av">${esc(c.name.trim().slice(0, 1) || '؟')}</div>
      <div class="prof-id">
        <h1>${esc(c.name)} ${chip(CAND_STATUS, c.status)}</h1>
        <div class="small muted prof-meta"><span class="mono">${esc(c.code)}</span><a class="mono" href="${waLink(c.mobile)}" target="_blank" rel="noopener">0${esc(c.mobile)}</a><span>${esc([c.gov, c.region].filter(Boolean).join(' — '))}</span><span>${esc(c.vehicle || '')}</span></div>
      </div>
      <div class="prof-acts"><button class="btn sec sm" data-docs>📎 الورق</button>${can('couriers') ? '<button class="btn pri sm" data-edit>✏️ تعديل</button>' : ''}</div>
    </div>
    <div class="grid4" style="margin-top:12px">
      <div class="card kpi b"><div class="lbl">أيام الشغل</div><div class="val">${d} / ${target}</div><div class="bar"><i style="width:${Math.min(100, d / target * 100)}%"></i></div></div>
      <div class="card kpi g"><div class="lbl">البونص المستحق للشريك</div><div class="val">${money(earnedSum)}</div></div>
      <div class="card kpi a"><div class="lbl">الورق</div><div class="val" style="font-size:18px">${c.paper_date ? '✅ ' + fmtDate(c.paper_date) : 'لسه'}</div></div>
      <div class="card kpi p"><div class="lbl">مصدر الترشيح</div><div class="val" style="font-size:15px">${SRC_AR[c.source] || esc(c.source || '—')}</div></div>
    </div>
    <div class="grid2 cour-grid" style="margin-top:12px">
      <div class="card">
        <h3 style="margin-top:0">👤 الشريك اللي رشّحه</h3>
        ${f ? `<button class="who big" data-fl-open="${f.id}"><span class="who-av">${esc(f.name.trim().slice(0, 1))}</span><span><b>${esc(f.name)}</b><span class="small mono muted">0${esc(f.mobile)} • ${esc(f.gov || '')}</span></span></button>
          <div class="row" style="margin-top:8px"><button class="btn sec sm" data-fl-cands>كل مناديبه</button><a class="btn sec sm" target="_blank" rel="noopener" href="${waLink(f.mobile)}">واتساب الشريك</a></div>` : '—'}
        <h3>🏢 الشركة والوظيفة</h3>
        <div class="kv">${kv('الشركة', esc(compName(c.company_id, c.company_name)))}${kv('الوظيفة', esc(job ? `${job.title || ''} (${job.code})` : ''))}${kv('مكان الوظيفة', esc(job ? [job.gov, job.region].filter(Boolean).join(' — ') : ''))}${kv('بونص الوظيفة', esc(job?.bonus_text || ''))}</div>
        <h3>📋 البيانات</h3>
        <div class="kv">${kv('تاريخ الترشيح', fmtDate(c.created_at))}${kv('أول يوم شغل', fmtDate(c.start_date))}${kv('آخر يوم', fmtDate(c.end_date))}${kv('آخر تحديث', fmtDate(c.updated_at))}</div>
        ${c.admin_note ? `<p class="small" style="margin-top:10px">📝 ${esc(c.admin_note)}</p>` : ''}
        ${rules.length ? `<h3>💰 شرايح البونص</h3><div class="row" style="flex-wrap:wrap;gap:6px">${rules.sort((a, b) => (a.min_days || 0) - (b.min_days || 0)).map((r) => `<span class="chip ${r.kind === 'paper' ? 'a' : (d >= r.min_days ? 'g' : 'n')}">${r.kind === 'paper' ? 'ورق' : r.min_days + ' يوم'}: ${money(r.amount)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="card">
        <h3 style="margin-top:0">🕒 التايم لاين</h3>
        <ol class="tl">${ev.map((e) => `<li><span class="tl-ic">${e.ic}</span><div><b>${esc(e.t)}</b>${e.s ? `<div class="small muted">${esc(e.s)}</div>` : ''}<div class="small muted mono">${String(e.at).length > 10 ? new Date(e.at).toLocaleString('en-GB') : fmtDate(e.at)}</div></div></li>`).join('')}</ol>
      </div>
    </div>`);
  $('[data-back]').onclick = () => go('couriers');
  $('[data-docs]').onclick = () => docsModal(c);
  const ed = $('[data-edit]'); if (ed) ed.onclick = () => courierEdit([c]);
  $$('[data-fl-open]').forEach((b) => b.onclick = () => openProfile(b.dataset.flOpen));
  const fc = $('[data-fl-cands]'); if (fc) fc.onclick = () => { S.courFl = c.freelancer_id; go('couriers'); };
}

function courierEdit(list) {
  const one = list.length === 1 ? list[0] : null;
  const m = modal(`
    <h2>${one ? 'تعديل المندوب: ' + esc(one.name) : `تحديث جماعي لـ ${list.length} مندوب`}</h2>
    ${one ? '' : '<p class="small muted" style="margin-top:-6px">أي حقل تسيبه فاضي مش هيتغير.</p>'}
    <form class="stack">
      <div class="grid2">
        <div><label class="f">الحالة</label><select class="in" name="status">${one ? '' : '<option value="">(بدون تغيير)</option>'}${Object.entries(CAND_STATUS).map(([k, [t]]) => `<option value="${k}" ${one?.status === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div><label class="f">الشركة</label><select class="in" name="company"><option value="">${one ? '— بدون —' : '(بدون تغيير)'}</option>${S.companies.map((c) => `<option value="${c.id}" ${one?.company_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      </div>
      <div class="grid3">
        <div><label class="f">تاريخ استكمال الورق</label><input class="in" type="date" name="paper" value="${one?.paper_date || ''}"></div>
        <div><label class="f">أول يوم شغل</label><input class="in" type="date" name="start" value="${one?.start_date || ''}"></div>
        <div><label class="f">آخر يوم شغل</label><input class="in" type="date" name="end" value="${one?.end_date || ''}"></div>
      </div>
      ${one ? `<div class="grid2"><div><label class="f">اسم المندوب</label><input class="in" name="name" value="${esc(one.name)}"></div><div><label class="f">المنطقة</label><input class="in" name="region" value="${esc(one.region || '')}"></div></div>
      <div><label class="f">ملاحظة</label><input class="in" name="note" value="${esc(one.admin_note || '')}"></div>` : ''}
      ${one ? '<div><label class="f">📎 ورق المندوب</label><div data-docs-host><div class="small muted">جاري التحميل…</div></div></div>' : ''}
      <p class="small muted" style="margin:0">البونص بيتحسب تلقائي. اللي اتكسب مش بيتشال لو المندوب اتوقف، وبيتلغي بس لو اتغير لـ "مرفوض".</p>
      <div class="err" data-err></div>
      <div class="row" style="justify-content:space-between">
        ${one ? '<button type="button" class="btn sec sm" data-recalc>🔄 إعادة حساب البونص</button>' : '<span></span>'}
        <div class="row"><button type="button" class="btn sec" data-close>إلغاء</button><button class="btn pri">حفظ</button></div>
      </div>
    </form>`);
  const f = $('form', m.el);
  if (one) loadDocs($('[data-docs-host]', m.el), one);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const upd = {};
    if (one) {
      Object.assign(upd, { status: f.status.value, company_id: f.company.value || null, paper_date: f.paper.value || null, start_date: f.start.value || null,
        end_date: f.end.value || null, name: f.name.value.trim() || one.name, region: f.region.value.trim(), admin_note: f.note.value.trim() || null });
      if (upd.status === 'rejected' && one.status !== 'rejected' && !(await confirmBox('رفض المندوب', 'رفض المندوب هيلغي أي بونص اتحسب للشريك عليه. متأكد؟', 'رفض'))) return;
    } else {
      if (f.status.value) upd.status = f.status.value;
      if (f.company.value) upd.company_id = f.company.value;
      if (f.paper.value) upd.paper_date = f.paper.value;
      if (f.start.value) upd.start_date = f.start.value;
      if (f.end.value) upd.end_date = f.end.value;
      if (!Object.keys(upd).length) return ($('[data-err]', f).textContent = 'مفيش حاجة تتغير');
      if (upd.status === 'rejected' && !(await confirmBox('رفض جماعي', `رفض ${list.length} مندوب هيلغي البونص بتاعهم.`, 'رفض'))) return;
    }
    await busy($('button.pri', f), async () => {
      const { error } = await sb.from('candidates').update(upd).in('id', list.map((c) => c.id));
      if (error) return ($('[data-err]', f).textContent = errMsg(error));
      m.close(); toast('تم الحفظ ✅', 'ok'); go(S.view);
    });
  };
  const rc = $('[data-recalc]', m.el);
  if (rc) rc.onclick = async () => {
    const r = await promptBox('إعادة حساب البونص', 'السبب (مثلاً: تصحيح تاريخ غلط)'); if (!r) return;
    const { error } = await sb.rpc('admin_recalc_candidate', { p_id: one.id, p_reason: r });
    if (error) return toast(errMsg(error), 'bad'); m.close(); toast('تمت إعادة الحساب ✅', 'ok'); go(S.view);
  };
}

// ------------------------------------------------------------------ couriers stage board (drag & drop, or "نقل لـ…" on phones)
const KB_COLS = [
  ['submitted', 'تحت المراجعة', (c) => c.status === 'submitted'],
  ['new0', 'مرشح جديد — من غير ورق', (c) => c.status === 'new' && !c.paper_date],
  ['new1', 'مرشح جديد — خلّص الورق', (c) => c.status === 'new' && !!c.paper_date],
  ['hired', 'اتعيّن / شغال', (c) => c.status === 'hired'],
];
const KB_MOVES = { submitted: 'تحت المراجعة', new0: 'جديد من غير ورق', new1: 'خلّص الورق', hired: 'اتعيّن', suspended: 'موقوف مؤقتاً', rejected: 'مرفوض' };
const kbColOf = (c) => c.status === 'new' ? (c.paper_date ? 'new1' : 'new0') : c.status;

function drawBoard(host, list, rerender) {
  const LIM = 60, edit = can('couriers');
  const age = (c) => { const d = daysBetween(c.created_at, new Date()); return d ? `من ${d} يوم` : 'النهارده'; };
  const card = (c) => `<div class="kb-card" ${edit ? 'draggable="true"' : ''} data-kc="${c.id}">
      <div class="kb-t"><b>${esc(c.name)}</b><span class="mono small muted">${esc(c.code || '')}</span></div>
      <div class="small muted kb-s">${esc(compName(c.company_id, c.company_name))} • ${esc(flName(c.freelancer_id))}</div>
      <div class="kb-f"><span class="small muted">${c.status === 'hired' && c.start_date ? 'بدأ ' + fmtDate(c.start_date) : age(c)}</span>
        ${edit ? `<select class="kb-mv" data-mv="${c.id}" aria-label="نقل المندوب لمرحلة تانية"><option value="">نقل لـ…</option>${Object.entries(KB_MOVES).filter(([k]) => k !== kbColOf(c)).map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select>` : ''}</div></div>`;
  const closed = list.filter((c) => ['suspended', 'rejected'].includes(c.status));
  host.innerHTML = `<div class="kb">${KB_COLS.map(([k, t, fn]) => {
    const l = list.filter(fn);
    return `<section class="kb-col" data-col="${k}"><header><b>${t}</b><span class="chip n">${l.length}</span></header>
      <div class="kb-list">${l.slice(0, LIM).map(card).join('') || `<div class="kb-empty">${edit ? 'اسحب مندوب هنا' : 'فاضي'}</div>`}
      ${l.length > LIM ? `<div class="small muted kb-more">و${l.length - LIM} كمان — ضيّق بالبحث أو الشركة</div>` : ''}</div></section>`;
  }).join('')}
    <section class="kb-col kb-closed"><header><b>موقوف / مرفوض</b><span class="chip n">${closed.length}</span></header>
      <div class="kb-drops"><div class="kb-drop" data-col="suspended">⏸️ موقوف <b>${closed.filter((c) => c.status === 'suspended').length}</b></div>
        <div class="kb-drop r" data-col="rejected">✕ مرفوض <b>${closed.filter((c) => c.status === 'rejected').length}</b></div></div>
      <details ${S.kbOpen ? 'open' : ''}><summary class="small">عرض المناديب (${closed.length})</summary><div class="kb-list">${closed.slice(0, LIM).map(card).join('')}</div></details>
    </section></div>
    ${edit ? '<p class="small muted" style="margin:8px 2px 0">اسحب الكارت لمرحلة تانية، أو استخدم "نقل لـ…" من الموبايل. اضغط على الكارت للتعديل الكامل.</p>' : ''}`;
  const find = (id) => list.find((c) => c.id === id);
  let dragId = null;
  $$('[data-kc]', host).forEach((el) => {
    el.onclick = (e) => { if (!edit || e.target.closest('select')) return; courierEdit([find(el.dataset.kc)]); };
    el.ondragstart = (e) => { dragId = el.dataset.kc; e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; el.classList.add('drag'); };
    el.ondragend = () => { el.classList.remove('drag'); $$('.over', host).forEach((z) => z.classList.remove('over')); };
  });
  $$('[data-col]', host).forEach((z) => {
    z.ondragover = (e) => { if (!dragId) return; e.preventDefault(); z.classList.add('over'); };
    z.ondragleave = (e) => { if (!z.contains(e.relatedTarget)) z.classList.remove('over'); };
    z.ondrop = (e) => { e.preventDefault(); z.classList.remove('over'); const id = e.dataTransfer.getData('text/plain') || dragId; dragId = null; moveCand(find(id), z.dataset.col, rerender); };
  });
  $$('[data-mv]', host).forEach((sel) => sel.onchange = () => { const v = sel.value; sel.value = ''; if (v) moveCand(find(sel.dataset.mv), v, rerender); });
  const det = $('details', host); if (det) det.ontoggle = () => { S.kbOpen = det.open; };
}

async function moveCand(c, to, rerender) {
  if (!c || !can('couriers') || kbColOf(c) === to) return;
  const upd = {};
  if (to === 'submitted') upd.status = 'submitted';
  else if (to === 'new0') {
    upd.status = 'new';
    if (c.paper_date) {
      if (!(await confirmBox('شيل تاريخ الورق؟', `${c.name} متسجّل إنه خلّص الورق يوم ${fmtDate(c.paper_date)}. النقل هنا هيشيل التاريخ ده.`, 'نقل', false))) return;
      upd.paper_date = null;
    }
  } else if (to === 'new1') { upd.status = 'new'; if (!c.paper_date) upd.paper_date = today(); }
  else { const r = await moveDialog(c, to); if (!r) return; Object.assign(upd, r); }
  const { error } = await sb.from('candidates').update(upd).eq('id', c.id);
  if (error) return toast(errMsg(error), 'bad');
  Object.assign(c, upd);
  toast(`${c.name} ← ${KB_MOVES[to]} ✅`, 'ok');
  rerender();
}

// Extra details for moves that need them: start date when hired, a confirmation when rejecting, an optional note.
function moveDialog(c, to) {
  return new Promise((resolve) => {
    const title = { hired: 'تعيين المندوب', suspended: 'إيقاف مؤقت', rejected: 'رفض المندوب' }[to];
    const m = modal(`<h2>${title}: ${esc(c.name)}</h2><form class="stack">
      ${to === 'hired' ? `<div><label class="f">أول يوم شغل</label><input class="in" type="date" name="start" value="${c.start_date || today()}" required></div>` : ''}
      ${to === 'rejected' ? '<p class="small" style="color:var(--red);margin:0;font-weight:700">رفض المندوب هيلغي أي بونص اتحسب للشريك عليه.</p>' : ''}
      <div><label class="f">ملاحظة (اختياري)</label><input class="in" name="note" value="${esc(c.admin_note || '')}"></div>
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn sec" data-no>إلغاء</button><button class="btn ${to === 'rejected' ? 'dan' : 'pri'}">${to === 'rejected' ? 'رفض' : 'تأكيد'}</button></div></form>`);
    const f = $('form', m.el); let done = false;
    const fin = (v) => { if (done) return; done = true; m.close(); resolve(v); };
    $('[data-no]', m.el).onclick = () => fin(null);
    m.el.addEventListener('click', (e) => { if (e.target === m.el) fin(null); });
    f.onsubmit = (e) => {
      e.preventDefault();
      const u = { status: to, admin_note: f.note.value.trim() || null };
      if (to === 'hired') u.start_date = f.start.value || today();
      fin(u);
    };
  });
}

// ------------------------------------------------------------------ courier documents (storage: courier-docs/<freelancer>/<candidate>/)
async function loadDocs(host, c) {
  const dir = `${c.freelancer_id}/${c.id}`;
  const bucket = sb.storage.from('courier-docs');
  const { data, error } = await bucket.list(dir, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
  if (error) { host.innerHTML = `<div class="small" style="color:var(--red)">${esc(errMsg(error))}</div>`; return; }
  const files = (data || []).filter((x) => x.name && !x.name.startsWith('.'));
  if (!files.length) { host.innerHTML = '<div class="small muted">الشريك لسه مرفعش ورق للمندوب ده.</div>'; return; }
  const isImg = (x) => /^image\//.test(x.metadata?.mimetype || '') || /\.(jpe?g|png|webp|heic)$/i.test(x.name);
  const { data: urls } = await bucket.createSignedUrls(files.map((x) => `${dir}/${x.name}`), 60);
  const urlOf = (x) => (urls || []).find((u) => u.path === `${dir}/${x.name}`)?.signedUrl;
  host.innerHTML = `<div class="docs">${files.map((x, i) => `<button type="button" class="doc" data-doc="${i}" title="${esc(x.name)}">
    ${isImg(x) && urlOf(x) ? `<img src="${esc(urlOf(x))}" alt="" loading="lazy">` : '<span class="doc-ic">📄</span>'}
    <span class="doc-n">${esc(x.name)}</span><span class="doc-d">${fmtDate(x.created_at)}</span></button>`).join('')}</div>`;
  $$('[data-doc]', host).forEach((b) => b.onclick = async () => {
    const x = files[Number(b.dataset.doc)];
    const { data: s, error: e } = await bucket.createSignedUrl(`${dir}/${x.name}`, 60);
    if (e) return toast(errMsg(e), 'bad');
    window.open(s.signedUrl, '_blank', 'noopener');
  });
}
function docsModal(c) {
  const m = modal(`<div class="ph"><h2 style="margin:0">📎 ورق ${esc(c.name)}</h2><button class="btn ghost" data-close>✕</button></div>
    <p class="small muted" style="margin-top:-6px">الشريك: ${esc(flName(c.freelancer_id))} • الروابط صالحة لدقيقة واحدة لكل فتحة.</p>
    <div data-docs-host><div class="spin"></div></div>`);
  loadDocs($('[data-docs-host]', m.el), c);
}

// ------------------------------------------------------------------ withdrawals
async function withdrawals() {
  const [wds, bal] = await Promise.all([
    fetchAll(() => sb.from('withdrawals').select('*').order('created_at', { ascending: false })),
    fetchAll(() => sb.from('freelancer_balances').select('freelancer_id,balance,total_earned')),
  ]);
  const bMap = new Map(bal.map((b) => [b.freelancer_id, b]));
  view(`
    <div class="ph"><h1>طلبات السحب</h1><button class="btn sec sm" data-csv title="بيصدّر الطلبات اللي ظاهرة حسب الفلتر">⬇️ تصدير للتحويل (Excel)</button></div>
    <div class="tools">
      <select class="in" data-st><option value="pending">قيد المراجعة</option><option value="paid">تم التحويل</option><option value="rejected">مرفوض</option><option value="">الكل</option></select>
      <input class="in q" placeholder="بحث بالشريك أو الموبايل" data-q>
    </div>
    <div class="card small" style="margin-bottom:10px;background:var(--amber-soft)">⚠️ قبل التحويل: اتأكد إن رقم المحفظة/الحساب يخص الشريك نفسه. لو الرقم مختلف عن موبايل الشريك هيظهر تحذير.</div>
    <div id="tbl"></div>`);
  let rows = [];
  const render = () => {
    const st = $('[data-st]').value, q = $('[data-q]').value.trim().toLowerCase();
    const base = wds.filter((w) => FX.match(w) && (!q || [flName(w.freelancer_id), S.flMap.get(w.freelancer_id)?.mobile, w.details].join(' ').toLowerCase().includes(q)));
    rows = base.filter((w) => !st || w.status === st);
    FX.draw(rows, base);
    pagedTable($('#tbl'), rows, [
      ['التاريخ', (w) => fmtDate(w.created_at)],
      ['الشريك', (w) => `<b>${esc(flName(w.freelancer_id))}</b><div class="small mono muted">0${esc(S.flMap.get(w.freelancer_id)?.mobile || '')}</div>`],
      ['المبلغ', (w) => `<b>${money(w.amount)}</b>`],
      ['التحويل على', (w) => { const fm = S.flMap.get(w.freelancer_id)?.mobile; const d = normMobile(w.details); const warn = d && fm && d !== fm; return `${esc(w.method)}<div class="mono small">${esc(w.details)}</div>${warn ? '<span class="chip r">⚠️ رقم مختلف عن موبايل الشريك</span>' : ''}`; }],
      ['رصيد الشريك', (w) => money(bMap.get(w.freelancer_id)?.balance)],
      ['الحالة', (w) => chip(WD_STATUS, w.status) + (w.admin_note ? `<div class="small muted">${esc(w.admin_note)}</div>` : '') + (w.decided_at ? `<div class="small muted">${fmtDate(w.decided_at)}</div>` : '')],
      ['', (w) => can('withdrawals') && (w.status === 'pending' || S.me.role === 'owner') ? `<div class="acts">${w.status !== 'paid' ? `<button class="btn pri sm" data-paid="${w.id}">✅ تم التحويل</button>` : ''}${w.status !== 'rejected' ? `<button class="btn dan sm" data-rej="${w.id}">رفض</button>` : ''}${w.status !== 'pending' ? `<button class="btn sec sm" data-pend="${w.id}">إرجاع للمراجعة</button>` : ''}</div>` : ''],
    ], { onRender: (h) => {
      const act = (sel, st, ask) => $$(sel, h).forEach((b) => b.onclick = async () => {
        const id = b.dataset[Object.keys(b.dataset)[0]];
        const w = wds.find((x) => x.id === id);
        let note = null;
        if (ask) { note = await promptBox(ask, 'ملاحظة (هتظهر للشريك)', { required: st === 'rejected' }); if (note === null) return; }
        else if (!(await confirmBox('تأكيد التحويل', `تم تحويل ${money(w.amount)} لـ ${flName(w.freelancer_id)} على ${w.details}؟`, 'تم التحويل', false))) return;
        const { error } = await sb.rpc('admin_set_withdrawal_status', { p_id: id, p_status: st, p_note: note || null });
        if (error) return toast(errMsg(error), 'bad');
        toast('تم ✅', 'ok'); await loadBase(); go('withdrawals');
      });
      act('[data-paid]', 'paid'); act('[data-rej]', 'rejected', 'سبب الرفض'); act('[data-pend]', 'pending', 'سبب الإرجاع');
    } });
  };
  $$('[data-st],[data-q]').forEach((el) => el.oninput = render);
  const FX = AX.withdrawalsFx({ S, flName, onChange: () => render() }); FX.fillOptions(wds);
  $('[data-csv]').onclick = () => {
    if (!rows.length) return toast('مفيش طلبات في الفلتر الحالي', 'bad');
    const st = $('[data-st]').value || 'all';
    csvDownload(`FullSpeed_Withdrawals_${st}_${today()}.csv`, ['رقم الطلب', 'التاريخ', 'الشريك', 'موبايل الشريك', 'المبلغ', 'الطريقة', 'بيانات التحويل', 'الحالة', 'ملاحظة'],
      rows.map((w) => [String(w.id).slice(0, 8), fmtDate(w.created_at), flName(w.freelancer_id), '0' + (S.flMap.get(w.freelancer_id)?.mobile || ''), w.amount, w.method, w.details, WD_STATUS[w.status]?.[0] ?? w.status, w.admin_note]));
    toast(`تم تصدير ${rows.length} طلب • الإجمالي ${money(rows.reduce((a, w) => a + Number(w.amount || 0), 0))}`, 'ok');
  };
  render();
}

// ------------------------------------------------------------------ companies
async function companies() {
  const { data: rules } = await sb.from('bonus_rules').select('*').eq('active', true);
  const rFor = (id) => (rules || []).filter((r) => r.company_id === id);
  view(`
    <div class="ph"><h1>الشركات وقواعد البونص</h1>${can('companies') ? '<button class="btn pri" data-add>➕ شركة جديدة</button>' : ''}</div>
    <div class="grid3">${S.companies.map((c) => {
      const rs = rFor(c.id); const paper = rs.find((r) => r.kind === 'paper');
      const tiers = rs.filter((r) => r.kind === 'days').sort((a, b) => a.min_days - b.min_days);
      return `<div class="card stack" data-co-card="${c.id}" data-active="${c.active ? 1 : 0}" style="${c.active ? '' : 'opacity:.6'}">
        <div class="row"><div class="logo co-logo">${c.logo_url ? logoImg(c.logo_url, (c.name || '?').slice(0, 2)) : '🏢'}</div>
          <div class="grow"><b>${esc(c.name)}</b>${c.active ? '' : ' <span class="chip r">موقوفة</span>'}<div class="small muted">البونص الكامل ${money(c.full_amount)} بعد ${c.target_days} يوم</div></div></div>
        <div class="small">ورق: <b>${money(paper?.amount ?? 0)}</b></div>
        <div class="small">${tiers.map((t) => `<span class="chip g" style="margin:2px">${t.min_days} يوم ← ${money(t.amount)}</span>`).join('')}</div>
        ${can('companies') ? `<button class="btn sec sm" data-ed="${c.id}">تعديل</button>` : ''}
      </div>`; }).join('') || '<div class="card empty">لا توجد شركات</div>'}</div>`);
  const add = $('[data-add]'); if (add) add.onclick = () => companyEdit(null, []);
  $$('[data-ed]').forEach((b) => b.onclick = () => companyEdit(S.companies.find((c) => c.id === b.dataset.ed), rFor(b.dataset.ed)));
  const FX = await AX.companiesFx({ S, onChange: () => paint() });
  const paint = () => {
    const co = FX.get('co'), act = FX.get('act');
    $$('[data-co-card]').forEach((el) => { el.hidden = (co && el.dataset.coCard !== co) || (act !== '' && el.dataset.active !== act); });
    FX.draw();
  };
  paint();
}

function companyEdit(c, rules) {
  const paper = rules.find((r) => r.kind === 'paper');
  const tiers = rules.filter((r) => r.kind === 'days').sort((a, b) => a.min_days - b.min_days);
  const tierRow = (t = {}) => `<div class="row" data-tier><input class="in" type="number" min="1" placeholder="بعد كام يوم" value="${t.min_days ?? ''}" style="width:130px" data-d> <span class="small">يوم ←</span> <input class="in" type="number" min="0" placeholder="المبلغ" value="${t.amount ?? ''}" style="width:130px" data-a> <button type="button" class="btn dan sm" data-rm>✕</button></div>`;
  const m = modal(`
    <h2>${c ? 'تعديل ' + esc(c.name) : 'شركة جديدة'}</h2>
    <form class="stack">
      <div class="grid2"><div><label class="f">اسم الشركة</label><input class="in" name="name" value="${esc(c?.name || '')}" required></div>
        <div><label class="f">اللوجو</label>
          <div class="logo-up"><div class="logo co-logo" data-lprev>${c?.logo_url ? logoImg(c.logo_url, (c.name || '?').slice(0, 2)) : '🏢'}</div>
            <label class="btn sec sm">⬆️ رفع صورة<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-lfile hidden></label></div>
          <input class="in mono" name="logo" value="${esc(c?.logo_url || '')}" placeholder="أو الصق رابط https://..." style="margin-top:6px"></div></div>
      ${c ? `<label class="row small"><input type="checkbox" name="active" ${c.active ? 'checked' : ''}> الشركة مفعّلة (بتظهر في الترشيح)</label>` : `
      <div class="grid2"><div><label class="f">البونص الكامل</label><input class="in" type="number" name="full" value="1000" min="0"></div><div><label class="f">بعد كام يوم</label><input class="in" type="number" name="days" value="26" min="1"></div></div>
      <p class="small muted" style="margin:0">هيتعمل تلقائي: ورق 100، 7 أيام 200، 15 يوم 500، والبونص الكامل. تقدر تعدلهم بعد الحفظ.</p>`}
      ${c ? `<div class="card" style="background:var(--surface2)"><h3>قواعد البونص</h3>
        <div class="row"><label class="f" style="margin:0">بونص استكمال الورق</label><input class="in" type="number" min="0" name="paper" value="${paper?.amount ?? 0}" style="width:130px"></div>
        <p class="small muted">الشريك بياخد مبلغ <b>أعلى شريحة</b> المندوب وصلها (مش مجموعهم). آخر شريحة = البونص الكامل.</p>
        <div class="stack" data-tiers>${tiers.map(tierRow).join('')}</div>
        <button type="button" class="btn sec sm" data-addt style="margin-top:8px">➕ شريحة</button></div>` : ''}
      <div class="err" data-err></div>
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn sec" data-close>إلغاء</button><button class="btn pri">حفظ</button></div>
    </form>`);
  const f = $('form', m.el);
  $('[data-lfile]', m.el).onchange = async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    const lbl = e.target.closest('label');
    try {
      lbl.classList.add('busy');
      const url = await uploadLogo(file, c?.id);
      f.logo.value = url;
      $('[data-lprev]', m.el).innerHTML = `<img src="${esc(url)}" alt="">`;
      toast('تم رفع اللوجو ✅ — دوس حفظ', 'ok');
    } catch (er) { toast(errMsg(er), 'bad'); } finally { lbl.classList.remove('busy'); }
  };
  const wire = () => $$('[data-rm]', m.el).forEach((b) => b.onclick = () => b.closest('[data-tier]').remove());
  const at = $('[data-addt]', m.el); if (at) at.onclick = () => { $('[data-tiers]', m.el).insertAdjacentHTML('beforeend', tierRow()); wire(); };
  wire();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const err = $('[data-err]', f);
    await busy($('button.pri', f), async () => {
      let payload;
      if (!c) payload = { name: f.name.value.trim(), logo_url: f.logo.value.trim(), full_amount: Number(f.full.value), target_days: Number(f.days.value) };
      else {
        const t = $$('[data-tier]', m.el).map((r) => ({ min_days: Number($('[data-d]', r).value), amount: Number($('[data-a]', r).value) })).filter((x) => x.min_days > 0);
        if (!t.length) return (err.textContent = 'لازم شريحة واحدة على الأقل');
        if (new Set(t.map((x) => x.min_days)).size !== t.length) return (err.textContent = 'في شريحتين بنفس عدد الأيام');
        payload = { name: f.name.value.trim(), logo_url: f.logo.value.trim(), active: f.active.checked, paper: Number(f.paper.value) || 0, tiers: t };
      }
      const { error } = await sb.rpc('admin_save_company', { p_id: c?.id ?? null, p: payload });
      if (error) return (err.textContent = errMsg(error).includes('duplicate') ? 'الشركة دي موجودة' : errMsg(error));
      m.close(); toast('تم الحفظ ✅', 'ok'); await loadBase(); go('companies');
    });
  };
}

// Logos go to the public company-logos bucket, downscaled to ≤320px so cards load fast.
async function uploadLogo(file, companyId) {
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) throw new Error('الصورة لازم تكون PNG أو JPG أو WEBP أو SVG');
  let blob = file, ext = (file.name.split('.').pop() || 'png').toLowerCase();
  if (file.type !== 'image/svg+xml') {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('الصورة مش مقروءة')); i.src = URL.createObjectURL(file); });
    const scale = Math.min(1, 320 / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale < 1 || file.size > 1048576) {
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.naturalWidth * scale); cv.height = Math.round(img.naturalHeight * scale);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      blob = await new Promise((res) => cv.toBlob(res, 'image/webp', 0.88)); ext = 'webp';
    }
    URL.revokeObjectURL(img.src);
  }
  if (!blob || blob.size > 1048576) throw new Error('الصورة أكبر من 1 ميجا');
  const path = `${companyId || 'new'}-${Date.now()}.${ext}`;
  const bucket = sb.storage.from('company-logos');
  const { error } = await bucket.upload(path, blob, { contentType: blob.type || file.type, upsert: false });
  if (error) throw error;
  return bucket.getPublicUrl(path).data.publicUrl;
}

// ------------------------------------------------------------------ chat inbox
async function chat(openId) {
  if (S.poll) { clearInterval(S.poll); S.poll = null; }
  const msgs = await fetchAll(() => sb.from('messages').select('id,freelancer_id,from_staff,body,created_at,read_at').order('created_at', { ascending: false }));
  const threads = new Map();
  msgs.forEach((m) => {
    const t = threads.get(m.freelancer_id) || { fid: m.freelancer_id, last: m, unread: 0, n: 0 };
    t.n++; if (!m.from_staff && !m.read_at) t.unread++;
    threads.set(m.freelancer_id, t);
  });
  const list = [...threads.values()].sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at));
  view(`
    <div class="ph"><h1>المحادثات</h1><button class="btn pri sm" data-new>✉️ رسالة جديدة لشريك</button></div>
    <div class="chat-wrap ${openId ? 'open' : ''}">
      <div class="chat-list card">
        <input class="in" placeholder="بحث باسم الشريك" data-cq>
        <div data-threads></div>
      </div>
      <div class="chat-pane card" data-pane>${openId ? '<div class="spin"></div>' : '<div class="empty">اختار محادثة من القائمة</div>'}</div>
    </div>`);
  const drawList = () => {
    const q = $('[data-cq]').value.trim().toLowerCase();
    const rows = list.filter((t) => !q || flName(t.fid).toLowerCase().includes(q));
    $('[data-threads]').innerHTML = rows.map((t) => `<button class="thread ${t.fid === openId ? 'on' : ''}" data-th="${t.fid}">
      <span class="th-av">${esc(flName(t.fid).trim().slice(0, 1) || '؟')}</span>
      <span class="th-b"><b>${esc(flName(t.fid))}</b><span>${t.last.from_staff ? 'انت: ' : ''}${esc(t.last.body.slice(0, 60))}</span></span>
      <span class="th-e"><span class="small muted">${fmtDate(t.last.created_at)}</span>${t.unread ? `<span class="badge">${t.unread}</span>` : ''}</span></button>`).join('')
      || '<div class="empty">لسه مفيش محادثات. الشركاء يقدروا يبعتوا من تطبيقهم، أو ابدأ انت برسالة جديدة.</div>';
    $$('[data-th]').forEach((b) => b.onclick = () => openThread(b.dataset.th));
  };
  $('[data-cq]').oninput = drawList;
  $('[data-new]').onclick = () => {
    const opts = S.fl.filter((f) => !f.duplicate_of && f.user_id).map((f) => `<option value="${f.id}">${esc(f.name)} — 0${esc(f.mobile)}</option>`).join('');
    const m = modal(`<h2>رسالة جديدة</h2><form class="stack">
      <div><label class="f">الشريك</label><select class="in" name="fl" required><option value="">اختار...</option>${opts}</select></div>
      <div><label class="f">الرسالة</label><textarea class="in" name="body" maxlength="2000" required></textarea></div>
      <div class="err" data-err></div>
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn sec" data-close>إلغاء</button><button class="btn pri">إرسال</button></div></form>`);
    const f = $('form', m.el);
    f.onsubmit = async (e) => {
      e.preventDefault();
      await busy($('button.pri', f), async () => {
        const { error } = await sb.rpc('admin_send_message', { p_freelancer: f.fl.value, p_body: f.body.value });
        if (error) return ($('[data-err]', f).textContent = errMsg(error));
        m.close(); chat(f.fl.value);
      });
    };
  };
  async function openThread(fid) {
    openId = fid;
    $('.chat-wrap').classList.add('open');
    $$('[data-th]').forEach((b) => b.classList.toggle('on', b.dataset.th === fid));
    const pane = $('[data-pane]');
    const f = S.flMap.get(fid);
    pane.innerHTML = `<div class="cp-h"><button class="btn ghost sm cp-back" data-back>→ رجوع</button>
        <div class="grow"><b>${esc(flName(fid))}</b><div class="small mono muted">0${esc(f?.mobile || '')}</div></div>
        ${f ? `<a class="btn sec sm" href="${waLink(f.mobile)}" target="_blank" rel="noopener">واتساب</a>` : ''}</div>
      <div class="bubbles" data-bubbles><div class="spin"></div></div>
      <form class="cp-send" data-send><textarea class="in" name="body" rows="1" maxlength="2000" placeholder="اكتب ردك..." required></textarea><button class="btn pri">إرسال</button></form>`;
    $('[data-back]', pane).onclick = () => { $('.chat-wrap').classList.remove('open'); };
    const fm = $('[data-send]', pane);
    fm.body.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); fm.requestSubmit(); } };
    fm.onsubmit = async (e) => {
      e.preventDefault();
      const body = fm.body.value.trim(); if (!body) return;
      await busy($('button', fm), async () => {
        const { error } = await sb.rpc('admin_send_message', { p_freelancer: fid, p_body: body });
        if (error) return toast(errMsg(error), 'bad');
        fm.body.value = ''; await drawThread(fid);
      });
    };
    await drawThread(fid);
  }
  async function drawThread(fid) {
    const { data, error } = await sb.from('messages').select('*').eq('freelancer_id', fid).order('created_at');
    const host = $('[data-bubbles]'); if (!host) return;
    if (error) { host.innerHTML = `<div class="empty">${esc(errMsg(error))}</div>`; return; }
    host.innerHTML = (data || []).map((m) => `<div class="bub ${m.from_staff ? 'me' : 'them'}"><div>${esc(m.body).replace(/\n/g, '<br>')}</div>
      <span>${new Date(m.created_at).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${m.from_staff && m.read_at ? ' ✓✓' : ''}</span></div>`).join('') || '<div class="empty">مفيش رسايل لسه — ابدأ انت.</div>';
    host.scrollTop = host.scrollHeight;
    if ((data || []).some((m) => !m.from_staff && !m.read_at)) {
      await sb.rpc('mark_messages_read', { p_freelancer: fid });
      const t = threads.get(fid); if (t) t.unread = 0;
      drawList(); chatBadge();
    }
  }
  drawList();
  if (openId) openThread(openId);
  S.poll = setInterval(async () => {
    if (S.view !== 'chat') return;
    if (openId) await drawThread(openId);
    await chatBadge();
  }, 20000);
}

// ------------------------------------------------------------------ fraud / quality signals
async function fraud() {
  const { data: d, error } = await sb.rpc('admin_fraud_signals');
  if (error) throw error;
  const sec = (title, why, rows, cols) => `<div class="card" style="margin-top:12px">
    <div class="ph" style="margin-bottom:6px"><h3 style="margin:0">${title}</h3><span class="chip ${rows.length ? 'r' : 'g'}">${rows.length ? rows.length + ' حالة' : 'مفيش ✅'}</span></div>
    <p class="small muted" style="margin:0 0 10px">${why}</p>
    ${rows.length ? `<div class="tw"><table class="t"><thead><tr>${cols.map((c) => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>
      ${rows.map((r) => `<tr>${cols.map((c) => `<td>${c[1](r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}</div>`;
  const flCell = (r) => `<b>${esc(r.freelancer)}</b>${S.flMap.get(r.freelancer_id) ? `<div class="small mono muted">0${esc(S.flMap.get(r.freelancer_id).mobile)}</div>` : ''}`;
  const stale = Number(d.stale_submissions || 0);
  view(`
    <div class="ph"><h1>مؤشرات التلاعب والجودة</h1><span class="small muted">علامات تستاهل مراجعة — مش اتهام</span></div>
    <div class="grid4">
      <div class="card kpi ${d.self_nominated.length ? 'a' : 'g'}"><div class="lbl">ترشيح النفس</div><div class="val">${d.self_nominated.length}</div></div>
      <div class="card kpi ${d.bursts.length ? 'a' : 'g'}"><div class="lbl">ترشيحات بكميات غريبة</div><div class="val">${d.bursts.length}</div></div>
      <div class="card kpi ${d.quick_quits.length ? 'a' : 'g'}"><div class="lbl">مناديب بيسيبوا بسرعة</div><div class="val">${d.quick_quits.length}</div></div>
      <div class="card kpi ${stale ? 'a' : 'g'}"><div class="lbl">ترشيحات متأخرة +48 ساعة</div><div class="val">${stale}</div></div>
    </div>
    ${sec('🪞 شريك رشّح نفسه', 'رقم المندوب هو نفس رقم الشريك — يعني الشريك سجّل نفسه كمندوب عشان ياخد البونص.', d.self_nominated,
      [['الشريك', flCell], ['المندوب', (r) => esc(r.courier)], ['الكود', (r) => `<span class="mono small">${esc(r.code || '')}</span>`]])}
    ${sec('📈 ترشيحات كتير في يوم واحد', 'شريك رشّح 10 مناديب أو أكتر في نفس اليوم خلال آخر 30 يوم — ممكن يكون نشاط حقيقي أو أرقام وهمية.', d.bursts,
      [['الشريك', flCell], ['اليوم', (r) => fmtDate(r.day)], ['عدد الترشيحات', (r) => `<b>${r.count}</b>`]])}
    ${sec('🚪 مناديب بيسيبوا الشغل بسرعة', 'شريك عنده 3 مناديب أو أكتر بدأوا شغل وسابوه في أقل من 7 أيام — ممكن مناديب بتدخل عشان الورق بس.', d.quick_quits,
      [['الشريك', flCell], ['بدأوا شغل', (r) => r.started], ['سابوا في أقل من 7 أيام', (r) => `<b style="color:var(--red)">${r.quit_within_7}</b>`],
        ['النسبة', (r) => `${r.started ? Math.round((r.quit_within_7 / r.started) * 100) : 0}%`]])}
    <div class="card" style="margin-top:12px"><div class="ph" style="margin-bottom:6px"><h3 style="margin:0">⏰ ترشيحات مستنية مراجعة</h3>${stale ? '<button class="btn sec sm" data-stale-all>افتح في المناديب</button>' : ''}</div>
      <p class="small muted" style="margin:0">${stale ? `فيه <b>${stale}</b> ترشيح حالته "تحت المراجعة" من أكتر من 48 ساعة. التأخير بيخلّي الشركاء يزهقوا.` : 'كل الترشيحات اتراجعت في وقتها ✅'}</p></div>`);
  const sa = $('[data-stale-all]'); if (sa) sa.onclick = () => { S.courSt = 'submitted'; go('couriers'); };
}

// ------------------------------------------------------------------ jobs
async function jobs() {
  const [js, cands] = await Promise.all([
    fetchAll(() => sb.from('jobs').select('*').order('created_at', { ascending: false })),
    fetchAll(() => sb.from('candidates').select('job_id,status').not('job_id', 'is', null)),
  ]);
  const apps = {}; cands.forEach((c) => { if (c.status !== 'rejected') apps[c.job_id] = (apps[c.job_id] || 0) + 1; });
  const hired = {}; cands.forEach((c) => { if (c.status === 'hired') hired[c.job_id] = (hired[c.job_id] || 0) + 1; });
  js.forEach((j) => { j._fill = !apps[j.id] ? 'zero' : j.headcount && (hired[j.id] || 0) >= j.headcount ? 'full' : 'open'; });
  const live = js.filter((j) => j.status !== 'Deleted');
  view(`
    <div class="ph"><h1>الوظائف</h1>${can('jobs') ? '<button class="btn pri" data-add>➕ نشر وظيفة</button>' : ''}</div>
    <div class="grid4" style="margin-bottom:12px">
      <div class="card kpi b"><div class="lbl">الوظائف</div><div class="val">${live.length}</div></div>
      <div class="card kpi g"><div class="lbl">نشطة وظاهرة للشركاء</div><div class="val">${live.filter((j) => j.status === 'Active' && (!j.expiry || j.expiry >= today()) && (!j.headcount || (apps[j.id] || 0) < j.headcount)).length}</div></div>
      <div class="card kpi a"><div class="lbl">منتهية / مكتملة</div><div class="val">${live.filter((j) => (j.expiry && j.expiry < today()) || (j.headcount && (apps[j.id] || 0) >= j.headcount)).length}</div></div>
      <div class="card kpi p"><div class="lbl">في السلة</div><div class="val">${js.length - live.length}</div></div>
    </div>
    <div class="tools">
      <select class="in" data-st><option value="Active">نشطة</option><option value="Inactive">متوقفة</option><option value="Deleted">السلة</option><option value="">الكل (عدا السلة)</option></select>
      <select class="in" data-co><option value="">كل الشركات</option>${S.companies.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
      <input class="in q" placeholder="بحث: وظيفة، منطقة، تسعيرة" data-q>
    </div>
    <div id="tbl"></div>`);
  const render = () => {
    const st = $('[data-st]').value, co = $('[data-co]').value, q = $('[data-q]').value.trim().toLowerCase();
    const rows = js.filter((j) => FX.match(j) && (st ? j.status === st : j.status !== 'Deleted') && (!co || j.company_id === co) &&
      (!q || [j.code, j.title, j.gov, j.region, j.pricing, j.bonus_text].join(' ').toLowerCase().includes(q)));
    FX.draw(rows, { apps, hired });
    pagedTable($('#tbl'), rows, [
      ['الكود', (j) => `<span class="mono small">${esc(j.code)}</span><div class="small muted">${fmtDate(j.created_at)}</div>`],
      ['الوظيفة', (j) => `<b>${esc(j.title)}</b><div class="small muted">${esc(compName(j.company_id, j.company_name))}</div>`],
      ['المكان', (j) => `${esc(j.gov || '')}<div class="small muted">${esc(j.region || '')}</div>`],
      ['المركبة', (j) => `${esc(j.vehicle || '')}<div class="small muted">${esc(j.work_type || '')}</div>`],
      ['التسعيرة / البونص', (j) => `${esc(j.pricing || '—')}<div class="small muted">${esc(j.bonus_text || '')}</div>`],
      ['المتقدمين', (j) => j.headcount ? `${apps[j.id] || 0} / ${j.headcount}${(apps[j.id] || 0) >= j.headcount ? ' <span class="chip g">مكتملة</span>' : ''}` : `${apps[j.id] || 0} <span class="small muted">(مفتوح)</span>`],
      ['الانتهاء', (j) => j.expiry ? `${fmtDate(j.expiry)}${j.expiry < today() ? ' <span class="chip r">منتهية</span>' : ''}` : '—'],
      ['الحالة', (j) => j.status === 'Active' ? '<span class="chip g">نشطة</span>' : j.status === 'Inactive' ? '<span class="chip a">متوقفة</span>' : '<span class="chip p">في السلة</span>'],
      ['', (j) => !can('jobs') ? '' : j.status === 'Deleted'
        ? `<div class="acts"><button class="btn sec sm" data-restore="${j.id}">استرجاع</button><button class="btn dan sm" data-purge="${j.id}">حذف نهائي</button></div>`
        : `<div class="acts"><button class="btn sec sm" data-ed="${j.id}">تعديل</button><button class="btn sec sm" data-tog="${j.id}">${j.status === 'Active' ? 'إيقاف' : 'تفعيل'}</button><button class="btn sec sm" data-dup="${j.id}">نسخ</button><button class="btn dan sm" data-trash="${j.id}">🗑️</button></div>`],
    ], { onRender: (h) => {
      const J = (id) => js.find((x) => x.id === id);
      const setSt = async (id, st, msg) => { const { error } = await sb.from('jobs').update({ status: st }).eq('id', id); if (error) return toast(errMsg(error), 'bad'); toast(msg, 'ok'); go('jobs'); };
      $$('[data-ed]', h).forEach((b) => b.onclick = () => jobEdit(J(b.dataset.ed)));
      $$('[data-dup]', h).forEach((b) => b.onclick = () => { const { id, code, created_at, updated_at, created_by, ...rest } = J(b.dataset.dup); jobEdit({ ...rest, expiry: null, status: 'Active' }, true); });
      $$('[data-tog]', h).forEach((b) => b.onclick = () => setSt(b.dataset.tog, J(b.dataset.tog).status === 'Active' ? 'Inactive' : 'Active', 'تم ✅'));
      $$('[data-trash]', h).forEach((b) => b.onclick = async () => { if (await confirmBox('نقل للسلة', 'الوظيفة هتختفي من عند الشركاء. تقدر ترجعها.', 'نقل للسلة')) setSt(b.dataset.trash, 'Deleted', 'اتنقلت للسلة'); });
      $$('[data-restore]', h).forEach((b) => b.onclick = () => setSt(b.dataset.restore, 'Inactive', 'اترجعت (متوقفة)'));
      $$('[data-purge]', h).forEach((b) => b.onclick = async () => {
        if (apps[b.dataset.purge]) return toast('مينفعش تتحذف: فيه مناديب مرشحين عليها', 'bad');
        if (!(await confirmBox('حذف نهائي', 'مش هتقدر ترجع الوظيفة دي.', 'حذف نهائي'))) return;
        const { error } = await sb.from('jobs').delete().eq('id', b.dataset.purge);
        if (error) return toast(errMsg(error).includes('foreign') ? 'مينفعش تتحذف: فيه مناديب مرشحين عليها' : errMsg(error), 'bad');
        toast('اتحذفت', 'ok'); go('jobs');
      });
    } });
  };
  $$('[data-st],[data-co],[data-q]').forEach((el) => el.oninput = render);
  const FX = AX.jobsFx({ S, compName, onChange: () => render() }); FX.fillOptions(js);
  const add = $('[data-add]'); if (add) add.onclick = () => jobEdit(null);
  render();
}

let leafletP = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletP) return leafletP;
  leafletP = new Promise((res, rej) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => res(window.L); s.onerror = () => { leafletP = null; rej(new Error('leaflet')); };
    document.head.appendChild(s);
  });
  return leafletP;
}
const LOC_TXT = { pin: 'مكان دقيق (دبوس)', region: 'مكان تقريبي (المنطقة)', gov: 'مكان تقريبي (المحافظة)' };
async function setupJobMap(root, f, loc) {
  const st = $('[data-locst]', root), box = $('[data-map]', root);
  const paint = () => { st.textContent = loc.lat == null ? 'مفيش مكان' : LOC_TXT[loc.prec] || LOC_TXT.pin; st.className = 'jloc-st ' + (loc.lat == null ? 'none' : loc.prec === 'pin' ? 'pin' : 'approx'); };
  paint();
  let L, map, marker = null;
  try { L = await loadLeaflet(); } catch { box.innerHTML = '<div class="jloc-ph">مقدرناش نحمّل الخريطة — جرّب تاني.</div>'; return; }
  if (!root.isConnected) return;
  box.innerHTML = '';
  map = L.map(box, { zoomControl: true }).setView(loc.lat != null ? [loc.lat, loc.lng] : [30.0444, 31.2357], loc.lat != null ? 14 : 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  const place = (lat, lng, prec, fly) => {
    loc.lat = lat; loc.lng = lng; loc.prec = prec;
    if (!marker) {
      marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      marker.on('dragend', () => { const p = marker.getLatLng(); place(p.lat, p.lng, 'pin'); });
    } else marker.setLatLng([lat, lng]);
    if (fly) map.setView([lat, lng], Math.max(map.getZoom(), 14));
    paint();
  };
  if (loc.lat != null) place(loc.lat, loc.lng, loc.prec);
  map.on('click', (e) => place(e.latlng.lat, e.latlng.lng, 'pin'));
  setTimeout(() => map.invalidateSize(), 60);
  setTimeout(() => map.invalidateSize(), 400);
  $('[data-geo]', root).onclick = async (e) => {
    const b = e.currentTarget, region = f.region.value.trim(), gov = f.gov.value;
    if (!region && !gov) return toast('اكتب المنطقة الأول', 'bad');
    b.disabled = true; const old = b.textContent; b.textContent = 'بندوّر...';
    try {
      const url = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({ format: 'json', limit: '1', countrycodes: 'eg', q: [region, gov, 'مصر'].filter(Boolean).join('، ') });
      const r = await fetch(url, { headers: { 'Accept-Language': 'ar' } }).then((x) => x.json());
      if (r?.[0]) place(Number(r[0].lat), Number(r[0].lon), 'region', true);
      else toast('ملقيناش المنطقة دي — حط الدبوس بإيدك', 'bad');
    } catch { toast('مقدرناش ندوّر دلوقتي', 'bad'); }
    finally { b.disabled = false; b.textContent = old; }
  };
  $('[data-clearloc]', root).onclick = () => {
    loc.lat = loc.lng = loc.prec = null;
    if (marker) { map.removeLayer(marker); marker = null; }
    paint();
  };
}

// Job form is a full page (matches the layout the team uses when posting a job).
function jobEdit(j, isCopy) { S.jobForm = { j: j || null, isCopy: !!isCopy }; go('jobform'); }
const HC_OPTS = [1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
const bonusLabel = (r) => r.kind === 'paper' ? `${Number(r.amount).toLocaleString('en-US')} ج.م (بعد الورق)` : `${Number(r.amount).toLocaleString('en-US')} ج.م (${r.min_days} يوم)`;
async function jobform() {
  const { j, isCopy } = S.jobForm || {};
  const editing = j && !isCopy;
  const DOCS = ['شهادة ميلاد', 'رخصة قيادة', 'شهادة جيش', 'فيش جنائي', 'بطاقة سارية', 'رخصة مركبة'];
  const has = (d) => String(j?.docs || '').includes(d);
  const rulesR = await sb.from('bonus_rules').select('company_id,kind,min_days,amount').eq('active', true).order('min_days');
  const rules = rulesR.data || [];
  const bonusOpts = (cid, cur) => {
    const c = S.companies.find((x) => x.id === cid);
    const list = rules.filter((r) => r.company_id === cid).map(bonusLabel);
    if (c?.full_amount && !list.length) list.push(`${Number(c.full_amount).toLocaleString('en-US')} ج.م (${c.target_days || 26} يوم)`);
    if (cur && !list.includes(cur)) list.unshift(cur);
    if (!list.length) return '<option value="">— اختار الشركة الأول —</option>';
    // Default to the highest tier (what the partner gets for a courier who completes the target).
    const pick = cur || list[list.length - 1];
    return list.map((t) => `<option ${t === pick ? 'selected' : ''}>${esc(t)}</option>`).join('');
  };
  const hc = j?.headcount ?? null, hcOther = hc != null && !HC_OPTS.includes(hc);
  view(`
    <div class="ph"><button class="btn ghost sm" data-back>→ رجوع للوظايف</button></div>
    <div class="card jf">
      <div class="jf-h">
        <h2>${editing ? '✏️ تعديل وظيفة ' + esc(j.code) : '➕ إضافة وظيفة شاغرة جديدة'}</h2>
        <span class="small muted">${editing ? 'التعديل بيظهر للشركاء على طول' : 'تسمع تلقائياً في تطبيق الفريلانسرز فور النشر'}</span>
      </div>
      <form class="stack" autocomplete="off">
        <div class="grid3">
          <div><label class="f">الشركة (من الشيت)</label><select class="in" name="company" required><option value="">اختار الشركة...</option>${S.companies.filter((c) => c.active || c.id === j?.company_id).map((c) => `<option value="${c.id}" ${j?.company_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
          <div><label class="f">المسمى الوظيفي / المهنة</label><input class="in" name="title" value="${esc(j?.title || '')}" placeholder="مثال: مندوب توصيل" required></div>
          <div><label class="f">السن المطلوب</label><input class="in" name="age" value="${esc(j?.age || '')}" placeholder="مثال: من 21 إلى 40 سنة"></div>
        </div>
        <div class="grid3">
          <div><label class="f">المحافظة</label><input class="in" name="gov" value="${esc(j?.gov || '')}" list="jf-govs" placeholder="مثال: القاهرة" required><datalist id="jf-govs">${GOVS.map((g) => `<option>${g}</option>`).join('')}</datalist></div>
          <div><label class="f">المنطقة</label><input class="in" name="region" value="${esc(j?.region || '')}" list="jf-regs" placeholder="مثال: مدينة نصر" required><datalist id="jf-regs"></datalist></div>
          <div><label class="f">نوع الشغل (الدوام)</label><select class="in" name="type">${['دوام كامل (Full-Time)', 'بارت تايم (Part-Time)', 'شفتات متغيرة (Shifts)', 'عمل حر (Freelance)'].map((t) => `<option ${j?.work_type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        </div>
        <div class="grid3">
          <div><label class="f">المركبة المطلوبة</label><select class="in" name="vehicle">${VEHICLES.map((v) => `<option ${j?.vehicle === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div><label class="f jf-green">🏷️ التسعيرة (Pricing)</label><input class="in" name="pricing" value="${esc(j?.pricing || '')}" placeholder="مثال: 45 ج للطلب أو 6000 ج ثابت" required></div>
          <div><label class="f jf-orange">🎁 البونص (Bonus)</label><select class="in" name="bonus">${bonusOpts(j?.company_id, j?.bonus_text)}</select></div>
        </div>
        <div class="grid3">
          <div><label class="f jf-blue">👥 العدد المطلوب</label>
            <select class="in" name="hcsel"><option value="">مفتوح (بدون عدد محدد)</option>${HC_OPTS.map((n) => `<option value="${n}" ${hc === n ? 'selected' : ''}>${n}</option>`).join('')}<option value="other" ${hcOther ? 'selected' : ''}>عدد تاني...</option></select>
            <input class="in" type="number" min="1" name="hc" value="${hcOther ? hc : ''}" placeholder="اكتب العدد" style="margin-top:6px" ${hcOther ? '' : 'hidden'}></div>
          <div><label class="f jf-red">⏳ تاريخ انتهاء الوظيفة (اختياري)</label><input class="in" type="date" name="expiry" value="${j?.expiry || ''}" min="${today()}"></div>
          <div ${editing ? '' : 'hidden'}><label class="f">الحالة</label><select class="in" name="status"><option value="Active" ${j?.status !== 'Inactive' ? 'selected' : ''}>نشطة</option><option value="Inactive" ${j?.status === 'Inactive' ? 'selected' : ''}>متوقفة</option></select></div>
        </div>
        <div><label class="f">الورق المطلوب (حدد ما يناسب)</label><div class="jf-docs">${DOCS.map((d) => `<label><input type="checkbox" name="doc" value="${d}" ${has(d) ? 'checked' : ''}> ${d}</label>`).join('')}</div></div>
        <div><label class="f">تفاصيل إضافية</label><textarea class="in" name="details" rows="3" placeholder="أية شروط أو تفاصيل أو مميزات إضافية للوظيفة...">${esc(j?.details || '')}</textarea></div>
        <div class="jloc">
          <div class="jloc-h"><label class="f" style="margin:0">📍 مكان الوظيفة على الخريطة</label><span class="jloc-st" data-locst></span></div>
          <div class="jloc-map" data-map><div class="jloc-ph">بنحمّل الخريطة...</div></div>
          <div class="row jloc-act">
            <button type="button" class="btn sec sm" data-geo>🔎 دوّر على المنطقة</button>
            <button type="button" class="btn ghost sm" data-clearloc>شيل المكان</button>
            <span class="small muted">دوس على الخريطة عشان تحط دبوس، وتقدر تسحبه.</span>
          </div>
        </div>
        <div class="err" data-err></div>
        <div class="row" style="justify-content:flex-start;gap:8px"><button class="btn pri jf-go">${editing ? '💾 حفظ التعديلات' : '✔ نشر الوظيفة في السيستم'}</button><button type="button" class="btn sec" data-cancel>إلغاء</button></div>
      </form>
    </div>`);
  const f = $('form', $('#view'));
  const loc = { lat: j?.lat ?? null, lng: j?.lng ?? null, prec: j?.lat != null ? (j.geo_precision || 'pin') : null };
  setupJobMap($('#view'), f, loc);
  $('[data-back]').onclick = $('[data-cancel]').onclick = () => go('jobs');
  f.company.onchange = () => { f.bonus.innerHTML = bonusOpts(f.company.value); };
  f.hcsel.onchange = () => { const o = f.hcsel.value === 'other'; f.hc.hidden = !o; if (o) f.hc.focus(); };
  // Region suggestions come from regions already used in jobs for the chosen governorate.
  const regs = async () => {
    const { data } = await sb.from('jobs').select('region').eq('gov', f.gov.value.trim()).limit(500);
    $('#jf-regs').innerHTML = [...new Set((data || []).map((x) => x.region).filter(Boolean))].map((r) => `<option>${esc(r)}</option>`).join('');
  };
  f.gov.onchange = regs; if (f.gov.value) regs();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const c = S.companies.find((x) => x.id === f.company.value);
    const hcv = f.hcsel.value === 'other' ? Number(f.hc.value) || null : f.hcsel.value ? Number(f.hcsel.value) : null;
    if (f.hcsel.value === 'other' && !hcv) return ($('[data-err]', f).textContent = 'اكتب العدد المطلوب');
    const rec = {
      company_id: f.company.value, company_name: c?.name ?? null, title: f.title.value.trim(), age: f.age.value.trim(), gov: f.gov.value.trim(), region: f.region.value.trim(),
      work_type: f.type.value, vehicle: f.vehicle.value, pricing: f.pricing.value.trim(), bonus_text: f.bonus.value || (c ? `${c.full_amount} ج.م (${c.target_days} يوم)` : ''),
      headcount: hcv, expiry: f.expiry.value || null, status: editing ? f.status.value : 'Active',
      docs: $$('[name=doc]:checked', f).map((x) => x.value).join('، '), details: f.details.value.trim(),
      lat: loc.lat, lng: loc.lng, geo_precision: loc.lat == null ? null : loc.prec,
    };
    await busy($('button.pri', f), async () => {
      const q = editing ? sb.from('jobs').update(rec).eq('id', j.id) : sb.from('jobs').insert({ ...rec, created_by: (await sb.auth.getUser()).data.user.id });
      const { error } = await q;
      if (error) return ($('[data-err]', f).textContent = errMsg(error));
      toast(editing ? 'تم الحفظ ✅' : 'تم نشر الوظيفة 🚀', 'ok'); go('jobs');
    });
  };
}

// ------------------------------------------------------------------ staff
async function staff() {
  const { data, error } = await sb.from('staff').select('*').order('created_at');
  if (error) throw error;
  view(`
    <div class="ph"><h1>فريق الإدارة</h1><button class="btn pri" data-add>➕ إضافة عضو</button></div>
    <div class="card small" style="margin-bottom:10px">
      <b>الصلاحيات:</b> المالك = كل حاجة • مدير = كل حاجة ما عدا الفريق والرجوع عن التعديلات • مالية = عرض + السحوبات • توظيف = عرض + المناديب والوظائف • مشاهدة فقط.
      <div class="muted" style="margin-top:4px">زرار <b>تفصيل</b> بيخليك تختار صلاحيات معينة لكل عضو بدل الافتراضي بتاع دوره.</div>
    </div>
    <div id="tbl"></div>`);
  pagedTable($('#tbl'), data, [
    ['الإيميل', (s) => `<span class="mono">${esc(s.email)}</span>`], ['الاسم', (s) => esc(s.name || '')],
    ['الصلاحية', (s) => `<select class="in" style="width:auto" data-role="${s.user_id}">${Object.entries(ROLE_AR).map(([k, t]) => `<option value="${k}" ${k === s.role ? 'selected' : ''}>${t}</option>`).join('')}</select>`],
    ['الصلاحيات', (s) => s.role === 'owner' ? '<span class="small muted">كل حاجة</span>' : `${s.perms ? '<span class="chip p">مخصّص</span> ' : ''}<button class="btn sec sm" data-perm="${s.user_id}">تفصيل</button>`],
    ['مفعّل', (s) => `<input type="checkbox" data-act="${s.user_id}" ${s.active ? 'checked' : ''}>`],
    ['أضيف', (s) => fmtDate(s.created_at)],
  ], { onRender: (h) => {
    $$('[data-role]', h).forEach((x) => x.onchange = async () => { const { error } = await sb.from('staff').update({ role: x.value }).eq('user_id', x.dataset.role); toast(error ? errMsg(error) : 'تم ✅', error ? 'bad' : 'ok'); if (error) go('staff'); });
    $$('[data-perm]', h).forEach((b) => b.onclick = () => permsModal(data.find((s) => s.user_id === b.dataset.perm)));
    $$('[data-act]', h).forEach((x) => x.onchange = async () => { const { error } = await sb.from('staff').update({ active: x.checked }).eq('user_id', x.dataset.act); toast(error ? errMsg(error) : 'تم ✅', error ? 'bad' : 'ok'); if (error) go('staff'); });
  } });
  $('[data-add]').onclick = () => {
    const m = modal(`<h2>إضافة عضو للإدارة</h2><form class="stack">
      <div class="grid2"><div><label class="f">الإيميل</label><input class="in mono" name="email" type="email" required></div><div><label class="f">الاسم</label><input class="in" name="name"></div></div>
      <div class="grid2"><div><label class="f">الصلاحية</label><select class="in" name="role">${Object.entries(ROLE_AR).filter(([k]) => k !== 'owner').map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}<option value="owner">المالك</option></select></div>
        <div><label class="f">كلمة مرور مبدئية</label><input class="in" name="pw" type="text" minlength="8" required></div></div>
      <p class="small muted" style="margin:0">ابعت كلمة المرور للعضو بنفسك واطلب منه يغيرها أول ما يدخل.</p>
      <div class="err" data-err></div>
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn sec" data-close>إلغاء</button><button class="btn pri">إضافة</button></div></form>`);
    const f = $('form', m.el);
    f.onsubmit = async (e) => {
      e.preventDefault();
      await busy($('button.pri', f), async () => {
        try { await fnCall({ action: 'invite_staff', email: f.email.value, name: f.name.value, role: f.role.value, password: f.pw.value }); m.close(); toast('تمت الإضافة ✅', 'ok'); go('staff'); }
        catch (er) { $('[data-err]', f).textContent = errMsg(er); }
      });
    };
  };
}

// ------------------------------------------------------------------ usage (aggregated counters, no personal data)
const EV_AR = {
  'app:open': 'فتح التطبيق', 'view:home': 'فتح صفحة الرئيسية', 'view:jobs': 'فتح صفحة الوظايف', 'view:couriers': 'فتح صفحة مناديبي',
  'view:wallet': 'فتح صفحة المحفظة', 'view:me': 'فتح صفحة حسابي', 'view:chat': 'فتح صفحة المحادثة', nominate: 'ترشيحات',
  'nominate:offline': 'ترشيحات من غير نت', 'share:story': 'صور ستوري', 'share:text': 'مشاركة نص', 'wa:template': 'رسايل واتساب جاهزة',
  'match:pick': 'اختيار من الوظايف المقترحة', 'wd:request': 'طلبات سحب', 'join:view': 'فتح صفحة التسجيل', 'join:submit': 'تسجيل مندوب من لينك',
  'push:on': 'تفعيل إشعارات', 'passkey:on': 'تفعيل بصمة', 'passkey:login': 'دخول بالبصمة',
};
async function usageCard() {
  const host = $('#usageCard'); if (!host || !can('view')) return;
  const days = [...Array(14)].map((_, i) => { const d = new Date(Date.now() - (13 - i) * 86400000); return d.toISOString().slice(0, 10); });
  const { data, error } = await sb.from('usage_daily').select('day,event,n').gte('day', days[0]).order('day');
  if (error || !host.isConnected) return;
  const rows = data || [];
  const opens = days.map((d) => ({ d, n: rows.filter((r) => r.day === d && r.event === 'app:open').reduce((s, r) => s + r.n, 0) }));
  const maxO = Math.max(1, ...opens.map((o) => o.n));
  const tot = {}; rows.forEach((r) => { tot[r.event] = (tot[r.event] || 0) + r.n; });
  const top = Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 15);
  host.innerHTML = `<div class="card usage" style="margin-top:12px">
    <h3>📈 استخدام التطبيق — آخر 14 يوم</h3>
    <div class="u-sub small muted">أجهزة فتحت التطبيق كل يوم</div>
    <div class="u-bars" role="img" aria-label="أجهزة فتحت التطبيق يومياً">${opens.map((o) => `<div class="u-col" title="${o.d}: ${o.n}"><span class="u-v">${o.n || ''}</span><i style="height:${Math.round(o.n / maxO * 100)}%"></i><span class="u-d">${o.d.slice(8)}</span></div>`).join('')}</div>
    ${top.length ? `<div class="tw" style="margin-top:12px"><table class="t"><thead><tr><th>الحدث</th><th>العدد (14 يوم)</th></tr></thead><tbody>
      ${top.map(([e, n]) => `<tr><td>${esc(EV_AR[e] || e)}</td><td class="bold">${n.toLocaleString('en-US')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">لسه مفيش بيانات استخدام</div>'}
    <p class="small muted" style="margin:10px 0 0">أرقام مجمّعة بدون أي بيانات شخصية</p></div>`;
}

// ------------------------------------------------------------------ client errors
async function errors() {
  const { data, error } = await sb.from('client_errors').select('id,at,app,message,stack,url,ua').order('at', { ascending: false }).limit(200);
  if (error) throw error;
  const groups = new Map();
  (data || []).forEach((e) => { const k = e.app + '|' + e.message; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); });
  const APP = { app: 'تطبيق الشركاء', admin: 'لوحة الإدارة', join: 'صفحة التسجيل' };
  const day = (data || []).filter((e) => Date.now() - new Date(e.at) < 86400000).length;
  view(`<div class="ph"><h1>الأخطاء</h1><span class="small muted">آخر 200 خطأ • ${day} في آخر 24 ساعة</span></div>
    ${groups.size ? `<div class="stack">${[...groups.values()].map((g) => {
      const last = g[0];
      return `<details class="card err-g"><summary><span class="chip n">${esc(APP[last.app] || last.app)}</span><b class="err-m">${esc(last.message)}</b>
        <span class="small muted">${g.length} مرة • آخر مرة ${new Date(last.at).toLocaleString('en-GB')}</span></summary>
        ${last.stack ? `<pre class="err-s">${esc(last.stack)}</pre>` : ''}
        <div class="small muted">${g.slice(0, 5).map((e) => `<div class="mono">${esc(e.url || '')} — ${esc((e.ua || '').slice(0, 120))}</div>`).join('')}</div></details>`;
    }).join('')}</div>` : '<div class="card empty">مفيش أخطاء 🎉</div>'}`);
  errorsBadge();
}

// ------------------------------------------------------------------ staff: fine-grained permissions
function permsModal(s) {
  if (!s) return;
  const cur = new Set(s.perms ?? ROLE_PERMS[s.role] ?? []);
  const m = modal(`<h2>صلاحيات ${esc(s.name || s.email)}</h2>
    <p class="small muted" style="margin-top:-6px">الدور: <b>${ROLE_AR[s.role] || s.role}</b> — ${s.perms ? 'الصلاحيات دي متخصّصة يدوياً.' : 'دي الصلاحيات الافتراضية للدور.'}</p>
    <div class="perm-grid">${Object.entries(PERM_AR).map(([k, t]) => `<label class="perm"><input type="checkbox" value="${k}" ${cur.has(k) ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>
    <p class="small muted">إدارة الفريق والرجوع عن التعديلات للمالك بس.</p>
    <div class="err" data-err></div>
    <div class="row" style="justify-content:space-between"><button class="btn ghost sm" data-reset ${s.perms ? '' : 'disabled'}>↺ رجّعها لافتراضي الدور</button>
      <div class="row"><button class="btn sec" data-close>إلغاء</button><button class="btn pri" data-save>حفظ</button></div></div>`);
  const save = (perms, btn) => busy(btn, async () => {
    const { error } = await sb.rpc('admin_set_staff_perms', { p_user: s.user_id, p_perms: perms });
    if (error) return ($('[data-err]', m.el).textContent = errMsg(error));
    m.close(); toast('اتحفظت الصلاحيات ✅ — هتسري من أول ما العضو يفتح اللوحة', 'ok'); go('staff');
  });
  $('[data-save]', m.el).onclick = (e) => {
    const p = $$('.perm input:checked', m.el).map((x) => x.value);
    if (!p.length) return ($('[data-err]', m.el).textContent = 'اختار صلاحية واحدة على الأقل (أو اقفل الحساب من عمود "مفعّل").');
    save(p, e.currentTarget);
  };
  $('[data-reset]', m.el).onclick = (e) => save(null, e.currentTarget);
}

// ------------------------------------------------------------------ settings helpers
const DEF_LEVELS = [{ n: 'مبتدئ', min: 0, c: '#8a86a8', i: '🌱' }, { n: 'برونزي', min: 1, c: '#c8661b', i: '🥉' }, { n: 'فضي', min: 5, c: '#64748b', i: '🥈' }, { n: 'ذهبي', min: 15, c: '#c99400', i: '🥇' }, { n: 'ماسي', min: 30, c: '#7b5cff', i: '💎' }];
const LINK_AR = { home: 'الرئيسية', jobs: 'الوظايف', couriers: 'مناديبي', wallet: 'المحفظة', me: 'حسابي', chat: 'المحادثة' };
async function loadSettings() {
  const { data, error } = await sb.from('app_settings').select('key,value,updated_at');
  if (error) throw error;
  S.settings = Object.fromEntries((data || []).map((r) => [r.key, r]));
  return S.settings;
}
const levelsOf = () => { const v = S.settings.levels?.value; return (Array.isArray(v) && v.length ? v : DEF_LEVELS).slice().sort((a, b) => a.min - b.min); };
function filterTxt(fl) {
  fl = fl || {}; const p = [];
  if (fl.gov) p.push(fl.gov);
  const mn = Number(fl.min_hired) || 0, mx = fl.max_hired == null ? -1 : Number(fl.max_hired);
  if (mn || mx >= 0) p.push(mx >= 0 ? `${mn}–${mx} مندوب شغال` : `${mn}+ مندوب شغال`);
  if (Number(fl.inactive_days)) p.push(`مرشّحوش من ${fl.inactive_days} يوم`);
  return p.length ? p.join(' • ') : 'كل الشركاء المفعّلين';
}

// ------------------------------------------------------------------ broadcast to a partner segment
async function broadcast() {
  await loadSettings().catch(() => {});
  const lv = levelsOf();
  const hist = await sb.from('audit_log').select('id,at,actor_email,after').eq('action', 'broadcast').order('at', { ascending: false }).limit(10);
  view(`<div class="ph"><h1>📣 رسالة جماعية</h1><span class="small muted">بتوصل إشعار جوه التطبيق، وعلى الموبايل للي مفعّل الإشعارات</span></div>
    <div class="bc-grid">
      <form class="card stack" data-bc>
        <h3 style="margin:0">مين يستلم؟</h3>
        <div class="grid3">
          <div><label class="f">المحافظة</label><select class="in" name="gov"><option value="">كل المحافظات</option>${GOVS.map((g) => `<option>${g}</option>`).join('')}</select></div>
          <div><label class="f">المستوى</label><select class="in" name="lvl"><option value="">كل المستويات</option>${lv.map((l, i) => `<option value="${i}">${esc(l.i || '')} ${esc(l.n)} (${lv[i + 1] ? `${l.min}–${lv[i + 1].min - 1}` : `${l.min}+`} شغالين)</option>`).join('')}</select></div>
          <div><label class="f">النشاط</label><select class="in" name="inactive"><option value="0">الكل</option><option value="7">مرشّحوش حد من أسبوع</option><option value="14">مرشّحوش حد من أسبوعين</option><option value="30">مرشّحوش حد من شهر</option><option value="60">مرشّحوش حد من شهرين</option></select></div>
        </div>
        <div class="bc-count" data-count>…</div>
        <h3 style="margin:6px 0 0">الرسالة</h3>
        <div><label class="f">العنوان</label><input class="in" name="title" maxlength="120" required placeholder="مثلاً: بونص زيادة الأسبوع ده 🔥"></div>
        <div><label class="f">التفاصيل</label><textarea class="in" name="body" maxlength="500" rows="4" placeholder="اكتب التفاصيل اللي الشريك محتاج يعرفها"></textarea><div class="small muted" data-len>0 / 500</div></div>
        <div><label class="f">لما يدوس على الإشعار يفتح</label><select class="in" name="link">${Object.entries(LINK_AR).map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></div>
        <div class="row" style="justify-content:flex-end"><button class="btn pri" data-send>📣 ابعت</button></div>
        <p class="small muted" style="margin:0">بتروح للشركاء المفعّلين بس. الوظايف الجديدة ليها إشعار تلقائي منفصل (من صفحة الإعدادات).</p>
      </form>
      <div class="stack">
        <div class="card"><h3>معاينة</h3><div class="bc-prev"><span class="bc-ic">📣</span><div><b data-pt>العنوان</b><div class="small" data-pb>التفاصيل…</div></div></div></div>
        <div class="card"><h3>آخر 10 رسايل</h3>${(hist.data || []).map((h) => { const af = h.after || {}; return `<div class="bc-h">
          <div class="row" style="justify-content:space-between;gap:6px"><b>${esc(af.title || '')}</b><span class="chip g">${Number(af.recipients) || 0} شريك</span></div>
          ${af.body ? `<div class="small">${esc(af.body)}</div>` : ''}
          <div class="small muted">${new Date(h.at).toLocaleString('en-GB')} • ${esc(h.actor_email || '')} • ${esc(filterTxt(af.filter))}</div></div>`; }).join('') || '<div class="empty">لسه مفيش رسايل اتبعتت</div>'}</div>
      </div>
    </div>`);
  const f = $('[data-bc]');
  const filt = () => {
    const p = {};
    if (f.gov.value) p.gov = f.gov.value;
    if (f.lvl.value !== '') { const i = Number(f.lvl.value); p.min_hired = lv[i].min; p.max_hired = lv[i + 1] ? lv[i + 1].min - 1 : -1; }
    if (Number(f.inactive.value)) p.inactive_days = Number(f.inactive.value);
    return p;
  };
  let tmr, seq = 0, n = null;
  const recount = () => {
    clearTimeout(tmr); n = null;
    $('[data-count]').innerHTML = '<span class="muted">جاري العد…</span>';
    tmr = setTimeout(async () => {
      const my = ++seq;
      const { data, error } = await sb.rpc('admin_broadcast_count', { p_filter: filt() });
      const el = $('[data-count]'); if (my !== seq || !el) return;
      n = error ? null : Number(data) || 0;
      el.innerHTML = error ? `<span style="color:var(--red)">${esc(errMsg(error))}</span>` : `👥 هتوصل لـ <b>${n}</b> شريك${n ? '' : ' — غيّر الفلتر'}`;
    }, 350);
  };
  const prev = () => {
    $('[data-pt]').textContent = f.title.value.trim() || 'العنوان';
    $('[data-pb]').textContent = f.body.value.trim() || 'التفاصيل…';
    $('[data-len]').textContent = `${f.body.value.length} / 500`;
  };
  ['gov', 'lvl', 'inactive'].forEach((k) => f[k].onchange = recount);
  f.title.oninput = prev; f.body.oninput = prev;
  f.onsubmit = async (e) => {
    e.preventDefault();
    const title = f.title.value.trim(); if (!title) return f.title.focus();
    if (n === null) return toast('استنى لحد ما العدد يظهر', 'bad');
    if (!n) return toast('مفيش شركاء في الشريحة دي', 'bad');
    if (!(await confirmBox('تأكيد الإرسال', `"${title}" هتوصل لـ ${n} شريك (${filterTxt(filt())}). مينفعش ترجع فيها بعد الإرسال.`, 'ابعت', false))) return;
    await busy($('[data-send]', f), async () => {
      const { data, error } = await sb.rpc('admin_broadcast', { p_title: title, p_body: f.body.value.trim(), p_filter: filt(), p_link: f.link.value });
      if (error) return toast(errMsg(error), 'bad');
      toast(`اتبعتت لـ ${data ?? n} شريك ✅`, 'ok'); go('broadcast');
    });
  };
  recount(); prev();
}

// ------------------------------------------------------------------ app settings (partner app behaviour)
const FEAT_AR = {
  chat: ['💬 المحادثة مع الإدارة', 'صفحة المحادثة في تطبيق الشريك'],
  join: ['🔗 تسجيل المناديب بلينك الشريك', 'صفحة التسجيل العامة واللينك/QR'],
  story: ['🖼️ صور الستوري للوظايف', 'زرار عمل صورة ستوري للوظيفة'],
  passkey: ['👆 الدخول بالبصمة', 'تفعيل ودخول بالبصمة / الوش'],
  push_prompt: ['🔔 اقتراح تفعيل الإشعارات', 'الكارت اللي بيطلب من الشريك يفعّل الإشعارات'],
  map: ['🗺️ خريطة الوظايف', 'عرض الوظايف على الخريطة وأقرب وظيفة'],
};
const TONE_AR = { info: 'معلومة (أزرق)', success: 'خبر حلو (أخضر)', warning: 'تنبيه (برتقالي)' };
const JB_AR = { all: ['كل الشركاء المفعّلين', 'أي وظيفة جديدة توصل إشعار لكل الشركاء'], gov: ['شركاء نفس المحافظة بس', 'الإشعار يروح للشركاء اللي في محافظة الوظيفة'], off: ['مقفول', 'مفيش إشعار تلقائي للوظايف الجديدة'] };

async function settings() {
  await loadSettings();
  const st = S.settings;
  const an = { on: false, text: '', tone: 'info', link: '', ...(st.announcement?.value || {}) };
  const ft = { chat: true, join: true, story: true, passkey: true, push_prompt: true, map: true, ...(st.features?.value || {}) };
  const jb = typeof st.job_broadcast?.value === 'string' ? st.job_broadcast.value : 'all';
  let lv = levelsOf().map((l) => ({ ...l }));
  const upd = (k) => st[k]?.updated_at ? `<span class="small muted">آخر تعديل ${new Date(st[k].updated_at).toLocaleString('en-GB')}</span>` : '';
  view(`<div class="ph"><h1>⚙️ الإعدادات</h1><span class="small muted">التغيير بيظهر في تطبيق الشركاء فوراً وبيتسجّل في سجل التغييرات</span></div>
    <div class="set-grid">
      <form class="card stack" data-s="announcement">
        <div class="set-h"><h3>📢 بانر إعلان للشركاء</h3>${upd('announcement')}</div>
        <label class="sw"><input type="checkbox" name="on" ${an.on ? 'checked' : ''}><span>البانر ظاهر في التطبيق</span></label>
        <div><label class="f">نص الإعلان</label><textarea class="in" name="text" maxlength="240" rows="2" placeholder="مثلاً: السحوبات هتتحوّل يوم الخميس بدل الأربع">${esc(an.text)}</textarea></div>
        <div class="grid2"><div><label class="f">اللون</label><select class="in" name="tone">${Object.entries(TONE_AR).map(([k, t]) => `<option value="${k}" ${k === an.tone ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div><label class="f">رابط (اختياري)</label><input class="in" name="link" value="${esc(an.link)}" placeholder="jobs أو https://…" dir="ltr"></div></div>
        <div class="small muted">الرابط ممكن يكون صفحة في التطبيق (${Object.keys(LINK_AR).join(', ')}) أو لينك خارجي يبدأ بـ https://</div>
        <div data-ap></div>
        <div class="row" style="justify-content:flex-end"><button class="btn pri">حفظ الإعلان</button></div>
      </form>
      <form class="card stack" data-s="features">
        <div class="set-h"><h3>🎛️ مميزات التطبيق</h3>${upd('features')}</div>
        ${Object.entries(FEAT_AR).map(([k, [t, d]]) => `<label class="sw"><input type="checkbox" name="${k}" ${ft[k] !== false ? 'checked' : ''}><span><b>${t}</b><span class="small muted">${d}</span></span></label>`).join('')}
        <div class="row" style="justify-content:flex-end"><button class="btn pri">حفظ المميزات</button></div>
      </form>
      <form class="card stack" data-s="job_broadcast">
        <div class="set-h"><h3>🚀 إعلان الوظايف الجديدة</h3>${upd('job_broadcast')}</div>
        ${Object.entries(JB_AR).map(([k, [t, d]]) => `<label class="sw"><input type="radio" name="jb" value="${k}" ${k === jb ? 'checked' : ''}><span><b>${t}</b><span class="small muted">${d}</span></span></label>`).join('')}
        <div class="row" style="justify-content:flex-end"><button class="btn pri">حفظ</button></div>
      </form>
      <form class="card stack set-wide" data-s="levels">
        <div class="set-h"><h3>🏅 مستويات الشركاء</h3>${upd('levels')}</div>
        <p class="small muted" style="margin:0">المستوى بيتحدد بعدد المناديب الشغالين (اتعيّنوا). أول مستوى لازم يبدأ من 0.</p>
        <div class="lv-row lv-hd small muted"><span>أيقونة</span><span>الاسم</span><span>من كام شغال</span><span>اللون</span><span>شكله</span><span></span></div>
        <div data-lv></div>
        <div class="row" style="justify-content:space-between"><button type="button" class="btn sec sm" data-lvadd>➕ مستوى جديد</button><button class="btn pri">حفظ المستويات</button></div>
      </form>
    </div>`);

  const save = (form, key, value) => busy($('button.pri', form), async () => {
    const { error } = await sb.rpc('admin_set_setting', { p_key: key, p_value: value });
    if (error) return toast(errMsg(error), 'bad');
    toast('اتحفظ ✅', 'ok');
    await loadSettings().catch(() => {});
    const h = $('.set-h', form); const u = $('.small', h); const t = `آخر تعديل ${new Date().toLocaleString('en-GB')}`;
    if (u) u.textContent = t; else h.insertAdjacentHTML('beforeend', `<span class="small muted">${t}</span>`);
  });

  // announcement
  const fa = $('[data-s=announcement]');
  const annPrev = () => {
    const t = fa.text.value.trim();
    $('[data-ap]').innerHTML = t ? `<div class="ann-prev ${esc(fa.tone.value)} ${fa.on.checked ? '' : 'off'}">📢 <span>${esc(t)}</span>${fa.link.value.trim() ? ' <u>التفاصيل ←</u>' : ''}${fa.on.checked ? '' : '<em>(مخفي)</em>'}</div>` : '';
  };
  ['text', 'tone', 'link', 'on'].forEach((k) => fa[k].addEventListener('input', annPrev));
  fa.onsubmit = (e) => {
    e.preventDefault();
    const v = { on: fa.on.checked, text: fa.text.value.trim(), tone: fa.tone.value, link: fa.link.value.trim() };
    if (v.on && !v.text) return toast('اكتب نص الإعلان الأول', 'bad');
    if (v.link && !LINK_AR[v.link] && !/^https:\/\/\S+$/.test(v.link)) return toast('الرابط لازم يكون اسم صفحة أو لينك يبدأ بـ https://', 'bad');
    save(fa, 'announcement', v);
  };
  annPrev();

  // features
  const ff = $('[data-s=features]');
  ff.onsubmit = (e) => { e.preventDefault(); save(ff, 'features', Object.fromEntries(Object.keys(FEAT_AR).map((k) => [k, ff[k].checked]))); };

  // new-job broadcast
  const fj = $('[data-s=job_broadcast]');
  fj.onsubmit = (e) => { e.preventDefault(); const v = $('input[name=jb]:checked', fj)?.value || 'all'; save(fj, 'job_broadcast', v); };

  // levels
  const fl = $('[data-s=levels]');
  const okColor = (c) => /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#10a861';
  const lvChip = (l) => `<span class="lv-chip" style="background:${okColor(l.c)}1f;color:${okColor(l.c)}">${esc(l.i || '')} ${esc(l.n || '—')}</span>`;
  const drawLv = () => {
    $('[data-lv]', fl).innerHTML = lv.map((l, i) => `<div class="lv-row" data-i="${i}">
      <input class="in lv-i" data-k="i" value="${esc(l.i || '')}" maxlength="4" aria-label="أيقونة">
      <input class="in" data-k="n" value="${esc(l.n || '')}" maxlength="30" placeholder="اسم المستوى" aria-label="الاسم">
      <input class="in" type="number" min="0" step="1" data-k="min" value="${Number(l.min) || 0}" aria-label="من كام مندوب شغال">
      <input class="in lv-c" type="color" data-k="c" value="${okColor(l.c)}" aria-label="اللون">
      <span data-chip>${lvChip(l)}</span>
      <button type="button" class="btn ghost sm" data-del="${i}" ${lv.length < 2 ? 'disabled' : ''} aria-label="حذف المستوى">✕</button></div>`).join('');
    $$('.lv-row[data-i]', fl).forEach((row) => {
      const l = lv[Number(row.dataset.i)];
      $$('[data-k]', row).forEach((inp) => inp.oninput = () => { l[inp.dataset.k] = inp.dataset.k === 'min' ? Number(inp.value) : inp.value; $('[data-chip]', row).innerHTML = lvChip(l); });
    });
    $$('[data-del]', fl).forEach((b) => b.onclick = () => { lv.splice(Number(b.dataset.del), 1); drawLv(); });
  };
  $('[data-lvadd]', fl).onclick = () => { lv.push({ i: '⭐', n: '', min: Math.max(0, ...lv.map((l) => Number(l.min) || 0)) + 5, c: '#10a861' }); drawLv(); };
  fl.onsubmit = (e) => {
    e.preventDefault();
    const clean = lv.map((l) => ({ n: String(l.n || '').trim(), min: Math.max(0, Math.floor(Number(l.min) || 0)), c: okColor(l.c), i: String(l.i || '').trim() })).sort((a, b) => a.min - b.min);
    if (clean.some((l) => !l.n)) return toast('كل مستوى لازم يكون ليه اسم', 'bad');
    if (clean[0].min !== 0) return toast('أول مستوى لازم يبدأ من 0', 'bad');
    if (new Set(clean.map((l) => l.min)).size !== clean.length) return toast('مينفعش مستويين يبدأوا من نفس العدد', 'bad');
    lv = clean; drawLv(); save(fl, 'levels', clean);
  };
  drawLv();
}

// ------------------------------------------------------------------ audit
const AUD_T = { freelancers: 'شريك', candidates: 'مندوب', withdrawals: 'سحب', companies: 'شركة', bonus_rules: 'قاعدة بونص', jobs: 'وظيفة', bonus_ledger: 'أرباح', staff: 'فريق', notifications: 'إشعارات', app_settings: 'إعدادات' };
const AUD_A = { insert: 'إضافة', update: 'تعديل', delete: 'حذف', broadcast: 'رسالة جماعية' };
const REVERTABLE = ['candidates', 'freelancers', 'jobs', 'companies', 'bonus_rules'];
const audV = (v) => v && typeof v === 'object' ? JSON.stringify(v) : v;
function auditDiff(a) {
  if (a.action === 'broadcast' && a.after) return `${a.after.title || ''} — ${a.after.recipients ?? 0} شريك (${filterTxt(a.after.filter)})`;
  if (!a.before || !a.after) {
    const o = a.after || a.before; if (!o) return '';
    return Object.entries(o).filter(([k]) => ['name', 'status', 'amount', 'title', 'email', 'role', 'key', 'value'].includes(k)).map(([k, v]) => `${k}: ${audV(v)}`).join(' • ');
  }
  return Object.keys(a.after).filter((k) => k !== 'updated_at' && JSON.stringify(a.before[k]) !== JSON.stringify(a.after[k])).map((k) => `${k}: ${audV(a.before[k]) ?? '∅'} ← ${audV(a.after[k]) ?? '∅'}`).join(' • ');
}
async function audit() {
  const { data, error } = await sb.from('audit_log').select('*').order('at', { ascending: false }).limit(500);
  if (error) throw error;
  const actors = [...new Set(data.map((a) => a.actor_email).filter(Boolean))].sort();
  const rv = can('revert');
  view(`<div class="ph"><h1>سجل التغييرات</h1><span class="small muted">آخر 500 عملية${rv ? ' • تقدر ترجّع أي تعديل على مندوب/شريك/وظيفة/شركة/بونص' : ''}</span></div>
    <div class="tools">
      <select class="in" data-t><option value="">كل الأنواع</option>${Object.entries(AUD_T).map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select>
      <select class="in" data-a><option value="">كل المستخدمين</option>${actors.map((e) => `<option>${esc(e)}</option>`).join('')}</select>
      <label class="pill-chk"><input type="checkbox" data-today> النهارده بس</label>
      <input class="in q" placeholder="بحث في المحتوى" data-q>
    </div><div id="tbl"></div>`);
  const dayStr = new Date().toDateString();
  const render = () => {
    const t = $('[data-t]').value, who = $('[data-a]').value, td = $('[data-today]').checked, q = $('[data-q]').value.trim().toLowerCase();
    const rows = data.filter((a) => (!t || a.table_name === t) && (!who || a.actor_email === who) && (!td || new Date(a.at).toDateString() === dayStr) &&
      (!q || JSON.stringify(a).toLowerCase().includes(q)));
    const cols = [
      ['الوقت', (a) => `<span class="small">${new Date(a.at).toLocaleString('en-GB')}</span>`],
      ['المستخدم', (a) => `<span class="small mono">${esc(a.actor_email || a.actor_role || 'system')}</span>`],
      ['العملية', (a) => `<span class="chip n">${esc(AUD_T[a.table_name] || a.table_name || '')}</span> ${esc(AUD_A[a.action] || a.action)}`],
      ['التغيير', (a) => `<div class="small" style="max-width:520px;white-space:normal;word-break:break-word">${esc(auditDiff(a)).slice(0, 600)}</div>`],
    ];
    if (rv) cols.push(['', (a) => a.action === 'update' && REVERTABLE.includes(a.table_name) ? `<button class="btn sec sm" data-rv="${a.id}" title="رجّع القيم اللي قبل التعديل ده">↩️ رجّع</button>` : '']);
    pagedTable($('#tbl'), rows, cols, { onRender: (h) => {
      $$('[data-rv]', h).forEach((b) => b.onclick = async () => {
        const a = data.find((x) => String(x.id) === b.dataset.rv); if (!a) return;
        if (!(await confirmBox('الرجوع عن التعديل', `${AUD_T[a.table_name] || a.table_name} هيرجع للقيم اللي كانت قبل التعديل ده (${new Date(a.at).toLocaleString('en-GB')}):\n${auditDiff(a).slice(0, 400)}`, 'رجّع', false))) return;
        await busy(b, async () => {
          const { data: r, error: er } = await sb.rpc('admin_revert_audit', { p_id: a.id });
          if (er) return toast(errMsg(er), 'bad');
          toast(r === 'nothing' ? 'مفيش فرق يترجع' : 'اترجع ✅ — والرجوع نفسه اتسجّل في السجل', 'ok');
          await loadBase(); go('audit');
        });
      });
    } });
  };
  $$('[data-t],[data-a],[data-today],[data-q]').forEach((el) => el.oninput = render);
  $('[data-today]').onchange = render;
  render();
}

sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') location.reload(); });
boot();
