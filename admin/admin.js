// Full Speed — Admin Control Panel
import {
  sb, $, $$, esc, money, fmtDate, today, daysBetween, normMobile, waLink, logoImg, toast, modal, confirmBox, promptBox, errMsg, busy,
  fetchAll, csvDownload, GOVS, VEHICLES, CAND_STATUS, WD_STATUS, FL_STATUS, chip,
} from '../shared/common.js';

const ROLE_PERMS = {
  owner: ['view', 'partners', 'couriers', 'withdrawals', 'companies', 'jobs', 'audit', 'staff'],
  admin: ['view', 'partners', 'couriers', 'withdrawals', 'companies', 'jobs', 'audit'],
  finance: ['view', 'withdrawals'], recruiter: ['view', 'couriers', 'jobs'], viewer: ['view'],
};
const ROLE_AR = { owner: 'المالك', admin: 'مدير', finance: 'مالية', recruiter: 'توظيف', viewer: 'مشاهدة فقط' };
const ICONS = {
  dash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
  partners: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="7" r="3.5"/><path d="M2 21c0-3.6 2.7-6.5 6-6.5S14 17.4 14 21"/><circle cx="17" cy="8.5" r="3"/><path d="M14 21c0-3 2.1-5.5 5.5-5.5"/></svg>`,
  couriers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="17" r="2.5"/><circle cx="18" cy="17" r="2.5"/><path d="M8.5 17h7"/><path d="M5 17H3v-5h9l2.5-5h2l1.5 7"/></svg>`,
  withdrawals: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><circle cx="12" cy="15.5" r="2" fill="currentColor" stroke="none"/></svg>`,
  companies: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V6a1 1 0 011-1h16a1 1 0 011 1v15"/><path d="M2 21h20"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2"/><path d="M9 15h6v6H9z"/></svg>`,
  jobs: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="8" width="20" height="13" rx="2"/><path d="M16 8V6a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><path d="M2 13h20"/></svg>`,
  staff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="3.5"/><path d="M2 21c0-3.6 2.7-6.5 7-6.5h2"/><circle cx="18.5" cy="16.5" r="3"/><path d="M15.8 13.8l1 1M21.2 19.2l1 1M13 16.5h1.5M22 16.5h1.5M15.8 19.2l1-1M21.2 13.8l1-1"/></svg>`,
  audit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>`,
};
const NAV = [
  ['dash', 'لوحة المؤشرات', 'view'], ['partners', 'الشركاء', 'view'], ['couriers', 'المناديب', 'view'],
  ['withdrawals', 'طلبات السحب', 'view'], ['companies', 'الشركات والبونص', 'view'], ['jobs', 'الوظائف', 'view'],
  ['staff', 'فريق الإدارة', 'staff'], ['audit', 'سجل التغييرات', 'audit'],
];
const S = { me: null, view: 'dash', companies: [], fl: [], flMap: new Map() };
const can = (p) => (ROLE_PERMS[S.me?.role] ?? []).includes(p);
const show = (id) => ['auth', 'noaccess', 'app'].forEach((x) => $('#' + x).classList.toggle('hidden', x !== id));
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
  const { data: st } = await sb.from('staff').select('role,active,email,name').eq('user_id', data.session.user.id).maybeSingle();
  if (!st || !st.active) { $('#naEmail').textContent = data.session.user.email; return show('noaccess'); }
  S.me = st;
  $('#meEmail').textContent = st.email; $('#meRole').textContent = ROLE_AR[st.role];
  $('#nav').innerHTML = NAV.filter((n) => can(n[2])).map((n) => `<button data-go="${n[0]}"><span class="ico">${ICONS[n[0]] || ''}</span><span class="lbl">${n[1]}</span><span class="badge hidden" data-badge="${n[0]}"></span></button>`).join('');
  $$('#nav button').forEach((b) => b.onclick = () => go(b.dataset.go));
  show('app');
  await loadBase();
  go(S.view);
}
async function loadBase() {
  const [c, f] = await Promise.all([
    sb.from('companies').select('*').order('name'),
    fetchAll(() => sb.from('freelancers').select('id,name,mobile,email,gov,region,status,duplicate_of,user_id,created_at,legacy_row,notes').order('created_at', { ascending: false })),
  ]);
  S.companies = c.data ?? []; S.fl = f; S.flMap = new Map(f.map((x) => [x.id, x]));
  const { count } = await sb.from('withdrawals').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  const bd = $('[data-badge=withdrawals]'); if (bd) { bd.textContent = count || ''; bd.classList.toggle('hidden', !count); }
  const pend = f.filter((x) => x.status === 'Pending' && !x.duplicate_of).length;
  const bp = $('[data-badge=partners]'); if (bp) { bp.textContent = pend || ''; bp.classList.toggle('hidden', !pend); }
}
function go(v) {
  S.view = v;
  $$('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.go === v));
  loading();
  ({ dash, partners, couriers, withdrawals, companies, jobs, staff, audit })[v]().catch((e) => view(`<div class="card empty">${esc(errMsg(e))}</div>`));
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
    fetchAll(() => sb.from('candidates').select('status,company_id,company_name')),
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
    <div class="ph"><h1>لوحة المؤشرات</h1><span class="small muted">${new Date().toLocaleString('ar-EG')}</span></div>
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
    </div>`);
}

// ------------------------------------------------------------------ partners
async function partners() {
  const [bal, cands] = await Promise.all([
    fetchAll(() => sb.from('freelancer_balances').select('*')),
    fetchAll(() => sb.from('candidates').select('freelancer_id,status')),
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
      <select class="in" style="width:auto" data-bst>${Object.entries(FL_STATUS).map(([k, [t]]) => `<option value="${k}">${t}</option>`).join('')}</select>
      <button class="btn pri sm" data-bapply>تطبيق الحالة</button><button class="btn ghost sm" data-bclear>إلغاء التحديد</button></div>
    <div id="tbl"></div>`);
  let rows = [];
  const render = () => {
    const q = $('[data-q]').value.trim().toLowerCase(), st = $('[data-st]').value, g = $('[data-gov]').value;
    rows = S.fl.filter((f) => (st === 'DUP' ? f.duplicate_of : (!f.duplicate_of && (!st || f.status === st))) && (!g || f.gov === g) &&
      (!q || [f.name, f.mobile, '0' + f.mobile, f.email, f.region].join(' ').toLowerCase().includes(q)));
    pagedTable($('#tbl'), rows, [
      [`<input type="checkbox" data-all>`, (f) => f.duplicate_of ? '' : `<input type="checkbox" data-sel="${f.id}" ${sel.has(f.id) ? 'checked' : ''}>`],
      ['التاريخ', (f) => `<span class="small">${fmtDate(f.created_at)}</span>`],
      ['الاسم', (f) => `<b>${esc(f.name)}</b>${f.duplicate_of ? '<div class="small" style="color:var(--amber)">مكرر من: ' + esc(flName(f.duplicate_of)) + '</div>' : ''}${f.user_id || f.duplicate_of ? '' : '<div class="small" style="color:var(--red)">بدون دخول</div>'}`],
      ['الموبايل', (f) => `<a class="mono" href="${waLink(f.mobile)}" target="_blank" rel="noopener">0${esc(f.mobile)}</a>`],
      ['الإيميل', (f) => `<span class="small mono">${esc(f.email || '—')}</span>`],
      ['المنطقة', (f) => `${esc(f.gov || '')}<div class="small muted">${esc(f.region || '')}</div>`],
      ['المناديب', (f) => `<span class="chip p">${cc[f.id]?.h ?? 0} / ${cc[f.id]?.t ?? 0}</span>`],
      ['الرصيد', (f) => `<b>${money(bMap.get(f.id)?.balance)}</b><div class="small muted">كسب ${money(bMap.get(f.id)?.total_earned)}</div>`],
      ['الحالة', (f) => chip(FL_STATUS, f.status)],
      ['', (f) => `<div class="acts"><button class="btn sec sm" data-det="${f.id}">التفاصيل</button>${can('partners') ? `<button class="btn sec sm" data-ed="${f.id}">تعديل</button>` : ''}</div>`],
    ], { onRender: (h) => {
      $$('[data-sel]', h).forEach((c) => c.onchange = () => { c.checked ? sel.add(c.dataset.sel) : sel.delete(c.dataset.sel); bulkBar(); });
      const all = $('[data-all]', h); if (all) all.onchange = () => { rows.filter((f) => !f.duplicate_of).forEach((f) => all.checked ? sel.add(f.id) : sel.delete(f.id)); render(); bulkBar(); };
      $$('[data-det]', h).forEach((b) => b.onclick = () => partnerDetails(S.flMap.get(b.dataset.det), bMap.get(b.dataset.det)));
      $$('[data-ed]', h).forEach((b) => b.onclick = () => partnerEdit(S.flMap.get(b.dataset.ed)));
    } });
  };
  const bulkBar = () => { $('[data-bulk]').classList.toggle('hidden', !sel.size || !can('partners')); $('[data-n]').textContent = sel.size; };
  $('[data-bclear]').onclick = () => { sel.clear(); render(); bulkBar(); };
  $('[data-bapply]').onclick = async (e) => {
    const st = $('[data-bst]').value;
    if (!(await confirmBox('تغيير حالة جماعي', `هيتغير ${sel.size} شريك لحالة "${FL_STATUS[st][0]}".`, 'تطبيق', false))) return;
    await busy(e.target, async () => {
      const { error } = await sb.from('freelancers').update({ status: st }).in('id', [...sel]);
      if (error) return toast(errMsg(error), 'bad');
      toast('تم ✅', 'ok'); sel.clear(); await loadBase(); go('partners');
    });
  };
  $$('[data-q],[data-st],[data-gov]').forEach((el) => el.oninput = render);
  $('[data-csv]').onclick = () => csvDownload('FullSpeed_Partners.csv',
    ['التاريخ', 'الاسم', 'الموبايل', 'الإيميل', 'المحافظة', 'المنطقة', 'الحالة', 'المناديب', 'شغالين', 'إجمالي الأرباح', 'اتصرف', 'قيد المراجعة', 'الرصيد'],
    rows.map((f) => { const b = bMap.get(f.id) || {}; return [fmtDate(f.created_at), f.name, '0' + f.mobile, f.email, f.gov, f.region, f.status, cc[f.id]?.t ?? 0, cc[f.id]?.h ?? 0, b.total_earned, b.paid, b.pending, b.balance]; }));
  render(); bulkBar();
}

async function partnerDetails(f, b) {
  const [c, l, w] = await Promise.all([
    sb.from('candidates').select('*').eq('freelancer_id', f.id).order('created_at', { ascending: false }),
    sb.from('bonus_ledger').select('*').eq('freelancer_id', f.id).order('created_at', { ascending: false }),
    sb.from('withdrawals').select('*').eq('freelancer_id', f.id).order('created_at', { ascending: false }),
  ]);
  b = b || {};
  const kindTxt = (x) => x.kind === 'paper' ? 'ورق' : x.kind === 'days' ? `${x.tier_days} يوم` : 'تسوية';
  const m = modal(`
    <div class="ph"><h2 style="margin:0">${esc(f.name)} ${chip(FL_STATUS, f.status)}</h2><button class="btn ghost" data-close>✕</button></div>
    <div class="kv">
      <div><span>الموبايل</span><a class="mono" href="${waLink(f.mobile)}" target="_blank">0${esc(f.mobile)}</a></div><div><span>الإيميل</span>${esc(f.email || '—')}</div>
      <div><span>المنطقة</span>${esc(f.gov || '')} ${esc(f.region || '')}</div><div><span>تاريخ التسجيل</span>${fmtDate(f.created_at)}</div>
      <div><span>إجمالي الأرباح</span><b>${money(b.total_earned)}</b></div><div><span>اتصرف</span>${money(b.paid)}</div>
      <div><span>قيد المراجعة</span>${money(b.pending)}</div><div><span>الرصيد</span><b>${money(b.balance)}</b></div>
    </div>
    ${f.notes ? `<p class="small"><b>ملاحظات:</b> ${esc(f.notes)}</p>` : ''}
    <h3 style="margin-top:16px">المناديب (${c.data?.length ?? 0})</h3>
    <div class="tw"><table class="t"><thead><tr><th>الكود</th><th>الاسم</th><th>الشركة</th><th>الحالة</th><th>الورق</th><th>بداية الشغل</th></tr></thead><tbody>
    ${(c.data || []).map((x) => `<tr><td class="mono small">${esc(x.code)}</td><td>${esc(x.name)}<div class="small mono muted">0${esc(x.mobile)}</div></td><td>${esc(compName(x.company_id, x.company_name))}</td><td>${chip(CAND_STATUS, x.status)}</td><td>${fmtDate(x.paper_date)}</td><td>${fmtDate(x.start_date)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">—</td></tr>'}
    </tbody></table></div>
    <div class="ph" style="margin-top:16px"><h3 style="margin:0">سجل الأرباح</h3>${can('partners') ? '<button class="btn sec sm" data-adj>➕ تسوية يدوية</button>' : ''}</div>
    <div class="tw"><table class="t"><thead><tr><th>التاريخ</th><th>النوع</th><th>المندوب</th><th>المبلغ</th><th></th></tr></thead><tbody>
    ${(l.data || []).map((x) => `<tr style="${x.reversed_at ? 'opacity:.5' : ''}"><td>${fmtDate(x.earned_on)}</td><td>${kindTxt(x)}${x.note ? `<div class="small muted">${esc(x.note)}</div>` : ''}${x.reversed_at ? `<div class="small" style="color:var(--red)">ملغي: ${esc(x.reverse_reason || '')}</div>` : ''}</td><td>${esc((c.data || []).find((k) => k.id === x.candidate_id)?.name || '')}</td><td><b>${money(x.amount)}</b></td><td>${!x.reversed_at && can('partners') ? `<button class="btn dan sm" data-rev="${x.id}">إلغاء</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">—</td></tr>'}
    </tbody></table></div>
    <h3 style="margin-top:16px">السحوبات</h3>
    <div class="tw"><table class="t"><thead><tr><th>التاريخ</th><th>المبلغ</th><th>الطريقة</th><th>الحالة</th></tr></thead><tbody>
    ${(w.data || []).map((x) => `<tr><td>${fmtDate(x.created_at)}</td><td><b>${money(x.amount)}</b></td><td>${esc(x.method)}<div class="small mono muted">${esc(x.details)}</div></td><td>${chip(WD_STATUS, x.status)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">—</td></tr>'}
    </tbody></table></div>`, 'wide');
  const reopen = async () => { m.close(); const { data } = await sb.from('freelancer_balances').select('*').eq('freelancer_id', f.id).maybeSingle(); partnerDetails(f, data); };
  const adj = $('[data-adj]', m.el);
  if (adj) adj.onclick = async () => {
    const amt = await promptBox('تسوية يدوية', 'المبلغ (موجب = إضافة، سالب = خصم)', { type: 'number' }); if (!amt) return;
    const note = await promptBox('سبب التسوية', 'السبب (هيظهر للشريك)'); if (!note) return;
    const { error } = await sb.rpc('admin_add_adjustment', { p_freelancer: f.id, p_amount: Number(amt), p_note: note });
    if (error) return toast(errMsg(error), 'bad'); toast('تم ✅', 'ok'); reopen();
  };
  $$('[data-rev]', m.el).forEach((btn) => btn.onclick = async () => {
    const r = await promptBox('إلغاء بند أرباح', 'سبب الإلغاء'); if (!r) return;
    const { error } = await sb.rpc('admin_reverse_ledger', { p_id: Number(btn.dataset.rev), p_reason: r });
    if (error) return toast(errMsg(error), 'bad'); toast('تم الإلغاء', 'ok'); reopen();
  });
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
      <div><label class="f">ملاحظات داخلية</label><textarea class="in" name="notes">${esc(f.notes || '')}</textarea></div>
      <div class="err" data-err></div>
      <div class="row" style="justify-content:space-between">
        <div class="row">
          ${f.user_id ? '<button type="button" class="btn sec sm" data-pw>🔑 كلمة مرور جديدة</button>' : (f.duplicate_of ? '' : '<button type="button" class="btn sec sm" data-mk>🔑 إنشاء دخول</button>')}
          ${f.duplicate_of ? '' : '<button type="button" class="btn sec sm" data-mob>📱 تغيير الموبايل</button>'}
        </div>
        <div class="row"><button type="button" class="btn sec" data-close>إلغاء</button><button class="btn pri">حفظ</button></div>
      </div>
      <p class="small muted" style="margin:0">مفيش حذف للحسابات — لإيقاف حساب غيّر الحالة لـ "موقوف".</p>
    </form>`);
  const fm = $('form', m.el);
  fm.onsubmit = async (e) => {
    e.preventDefault();
    await busy($('button.pri', fm), async () => {
      const { error } = await sb.from('freelancers').update({
        name: fm.name.value.trim(), email: fm.email.value.trim() || null, status: fm.status.value,
        gov: fm.gov.value.trim(), region: fm.region.value.trim(), notes: fm.notes.value.trim() || null,
      }).eq('id', f.id);
      if (error) return ($('[data-err]', fm).textContent = errMsg(error).includes('duplicate') ? 'الإيميل ده مستخدم لشريك تاني' : errMsg(error));
      m.close(); toast('تم الحفظ ✅', 'ok'); await loadBase(); go('partners');
    });
  };
  const pwBtn = $('[data-pw]', m.el) || $('[data-mk]', m.el);
  if (pwBtn) pwBtn.onclick = async () => {
    const p = await promptBox('كلمة مرور جديدة للشريك', '6 حروف/أرقام على الأقل — ابعتها للشريك بنفسك', { type: 'text' });
    if (!p) return; if (p.length < 6) return toast('6 على الأقل', 'bad');
    try { await fnCall({ action: f.user_id ? 'reset_freelancer_password' : 'create_freelancer_login', freelancer_id: f.id, password: p }); toast('تم ✅', 'ok'); m.close(); await loadBase(); go('partners'); }
    catch (e) { toast(errMsg(e), 'bad'); }
  };
  const mob = $('[data-mob]', m.el);
  if (mob) mob.onclick = async () => {
    const v = await promptBox('تغيير رقم الموبايل', 'الرقم الجديد (هيبقى هو اسم الدخول)', { placeholder: '01xxxxxxxxx' });
    if (!v) return;
    try { await fnCall({ action: 'change_freelancer_mobile', freelancer_id: f.id, mobile: v }); toast('تم تغيير الموبايل ✅', 'ok'); m.close(); await loadBase(); go('partners'); }
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
  const rulesR = await sb.from('bonus_rules').select('company_id,kind,min_days').eq('active', true);
  const tgt = {}; (rulesR.data || []).forEach((r) => { if (r.kind === 'days') tgt[r.company_id] = Math.max(tgt[r.company_id] || 0, r.min_days); });
  const sel = new Set();
  view(`
    <div class="ph"><h1>المناديب</h1><button class="btn sec sm" data-csv>⬇️ تقرير مالي Excel</button></div>
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
    </div>
    <div class="bulk hidden" data-bulk>تم تحديد <span data-n></span> <button class="btn pri sm" data-bedit>تحديث جماعي</button><button class="btn ghost sm" data-bclear>إلغاء التحديد</button></div>
    <div id="tbl"></div>`);
  let rows = [];
  const render = () => {
    const q = $('[data-q]').value.trim().toLowerCase(), st = $('[data-st]').value, co = $('[data-co]').value, due = $('[data-due]').value;
    rows = cands.filter((c) => (!st || c.status === st) && (!co || (co === 'NONE' ? !c.company_id : c.company_id === co)) &&
      (!due || (due === 'any' ? earned[c.id] > 0 : due === 'none' ? !earned[c.id] : (c.paper_date && !c.start_date))) &&
      (!q || [c.name, c.code, c.mobile, '0' + c.mobile, flName(c.freelancer_id), S.flMap.get(c.freelancer_id)?.mobile].join(' ').toLowerCase().includes(q)));
    pagedTable($('#tbl'), rows, [
      [`<input type="checkbox" data-all>`, (c) => `<input type="checkbox" data-sel="${c.id}" ${sel.has(c.id) ? 'checked' : ''}>`],
      ['الكود', (c) => `<span class="mono small">${esc(c.code)}</span><div class="small muted">${fmtDate(c.created_at)}</div>`],
      ['المندوب', (c) => `<b>${esc(c.name)}</b><div class="small mono muted">0${esc(c.mobile)} • ${esc(c.vehicle || '')}</div>`],
      ['الشركة / الوظيفة', (c) => `${esc(compName(c.company_id, c.company_name))}${c.job_id ? `<div class="small muted">${esc(jMap.get(c.job_id)?.code || '')}</div>` : ''}`],
      ['الشريك', (c) => `${esc(flName(c.freelancer_id))}<div class="small mono muted">0${esc(S.flMap.get(c.freelancer_id)?.mobile || '')}</div>`],
      ['الحالة', (c) => chip(CAND_STATUS, c.status)],
      ['الأيام', (c) => { if (!c.start_date) return '<span class="small muted">لم يبدأ</span>'; const t = tgt[c.company_id] || 26; const d = daysBetween(c.start_date, c.end_date && c.end_date < today() ? c.end_date : today()); return `<div class="small">${d} / ${t}${d >= t ? ' 🌟' : ''}</div><div class="bar"><i style="width:${Math.min(100, d / t * 100)}%"></i></div>`; }],
      ['الورق', (c) => c.paper_date ? `✅ <span class="small">${fmtDate(c.paper_date)}</span>` : '—'],
      ['البونص', (c) => `<b>${money(earned[c.id])}</b>`],
      ['', (c) => can('couriers') ? `<button class="btn sec sm" data-ed="${c.id}">تعديل</button>` : ''],
    ], { onRender: (h) => {
      $$('[data-sel]', h).forEach((x) => x.onchange = () => { x.checked ? sel.add(x.dataset.sel) : sel.delete(x.dataset.sel); bulkBar(); });
      const all = $('[data-all]', h); if (all) all.onchange = () => { rows.forEach((c) => all.checked ? sel.add(c.id) : sel.delete(c.id)); render(); bulkBar(); };
      $$('[data-ed]', h).forEach((b) => b.onclick = () => courierEdit([cands.find((c) => c.id === b.dataset.ed)]));
    } });
  };
  const bulkBar = () => { $('[data-bulk]').classList.toggle('hidden', !sel.size || !can('couriers')); $('[data-n]').textContent = sel.size; };
  $('[data-bclear]').onclick = () => { sel.clear(); render(); bulkBar(); };
  $('[data-bedit]').onclick = () => courierEdit(cands.filter((c) => sel.has(c.id)));
  $$('[data-q],[data-st],[data-co],[data-due]').forEach((el) => el.oninput = render);
  $('[data-csv]').onclick = () => csvDownload('FullSpeed_Couriers_Financial.csv',
    ['الكود', 'المندوب', 'موبايل المندوب', 'الشركة', 'الشريك', 'موبايل الشريك', 'الحالة', 'تاريخ الورق', 'أول يوم شغل', 'آخر يوم', 'البونص المستحق'],
    rows.map((c) => [c.code, c.name, '0' + c.mobile, compName(c.company_id, c.company_name), flName(c.freelancer_id), '0' + (S.flMap.get(c.freelancer_id)?.mobile || ''), CAND_STATUS[c.status]?.[0], c.paper_date, c.start_date, c.end_date, earned[c.id] || 0]));
  render(); bulkBar();
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
      <p class="small muted" style="margin:0">البونص بيتحسب تلقائي. اللي اتكسب مش بيتشال لو المندوب اتوقف، وبيتلغي بس لو اتغير لـ "مرفوض".</p>
      <div class="err" data-err></div>
      <div class="row" style="justify-content:space-between">
        ${one ? '<button type="button" class="btn sec sm" data-recalc>🔄 إعادة حساب البونص</button>' : '<span></span>'}
        <div class="row"><button type="button" class="btn sec" data-close>إلغاء</button><button class="btn pri">حفظ</button></div>
      </div>
    </form>`);
  const f = $('form', m.el);
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
      m.close(); toast('تم الحفظ ✅', 'ok'); go('couriers');
    });
  };
  const rc = $('[data-recalc]', m.el);
  if (rc) rc.onclick = async () => {
    const r = await promptBox('إعادة حساب البونص', 'السبب (مثلاً: تصحيح تاريخ غلط)'); if (!r) return;
    const { error } = await sb.rpc('admin_recalc_candidate', { p_id: one.id, p_reason: r });
    if (error) return toast(errMsg(error), 'bad'); m.close(); toast('تمت إعادة الحساب ✅', 'ok'); go('couriers');
  };
}

// ------------------------------------------------------------------ withdrawals
async function withdrawals() {
  const [wds, bal] = await Promise.all([
    fetchAll(() => sb.from('withdrawals').select('*').order('created_at', { ascending: false })),
    fetchAll(() => sb.from('freelancer_balances').select('freelancer_id,balance,total_earned')),
  ]);
  const bMap = new Map(bal.map((b) => [b.freelancer_id, b]));
  view(`
    <div class="ph"><h1>طلبات السحب</h1><button class="btn sec sm" data-csv>⬇️ تصدير</button></div>
    <div class="tools">
      <select class="in" data-st><option value="pending">قيد المراجعة</option><option value="paid">تم التحويل</option><option value="rejected">مرفوض</option><option value="">الكل</option></select>
      <input class="in q" placeholder="بحث بالشريك أو الموبايل" data-q>
    </div>
    <div class="card small" style="margin-bottom:10px;background:var(--amber-soft)">⚠️ قبل التحويل: اتأكد إن رقم المحفظة/الحساب يخص الشريك نفسه. لو الرقم مختلف عن موبايل الشريك هيظهر تحذير.</div>
    <div id="tbl"></div>`);
  let rows = [];
  const render = () => {
    const st = $('[data-st]').value, q = $('[data-q]').value.trim().toLowerCase();
    rows = wds.filter((w) => (!st || w.status === st) && (!q || [flName(w.freelancer_id), S.flMap.get(w.freelancer_id)?.mobile, w.details].join(' ').toLowerCase().includes(q)));
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
  $('[data-csv]').onclick = () => csvDownload('FullSpeed_Withdrawals.csv', ['التاريخ', 'الشريك', 'موبايل الشريك', 'المبلغ', 'الطريقة', 'بيانات التحويل', 'الحالة', 'ملاحظة'],
    rows.map((w) => [fmtDate(w.created_at), flName(w.freelancer_id), '0' + (S.flMap.get(w.freelancer_id)?.mobile || ''), w.amount, w.method, w.details, WD_STATUS[w.status][0], w.admin_note]));
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
      return `<div class="card stack" style="${c.active ? '' : 'opacity:.6'}">
        <div class="row"><div class="logo co-logo">${c.logo_url ? logoImg(c.logo_url, (c.name || '?').slice(0, 2)) : '🏢'}</div>
          <div class="grow"><b>${esc(c.name)}</b>${c.active ? '' : ' <span class="chip r">موقوفة</span>'}<div class="small muted">البونص الكامل ${money(c.full_amount)} بعد ${c.target_days} يوم</div></div></div>
        <div class="small">ورق: <b>${money(paper?.amount ?? 0)}</b></div>
        <div class="small">${tiers.map((t) => `<span class="chip g" style="margin:2px">${t.min_days} يوم ← ${money(t.amount)}</span>`).join('')}</div>
        ${can('companies') ? `<button class="btn sec sm" data-ed="${c.id}">تعديل</button>` : ''}
      </div>`; }).join('') || '<div class="card empty">لا توجد شركات</div>'}</div>`);
  const add = $('[data-add]'); if (add) add.onclick = () => companyEdit(null, []);
  $$('[data-ed]').forEach((b) => b.onclick = () => companyEdit(S.companies.find((c) => c.id === b.dataset.ed), rFor(b.dataset.ed)));
}

function companyEdit(c, rules) {
  const paper = rules.find((r) => r.kind === 'paper');
  const tiers = rules.filter((r) => r.kind === 'days').sort((a, b) => a.min_days - b.min_days);
  const tierRow = (t = {}) => `<div class="row" data-tier><input class="in" type="number" min="1" placeholder="بعد كام يوم" value="${t.min_days ?? ''}" style="width:130px" data-d> <span class="small">يوم ←</span> <input class="in" type="number" min="0" placeholder="المبلغ" value="${t.amount ?? ''}" style="width:130px" data-a> <button type="button" class="btn dan sm" data-rm>✕</button></div>`;
  const m = modal(`
    <h2>${c ? 'تعديل ' + esc(c.name) : 'شركة جديدة'}</h2>
    <form class="stack">
      <div class="grid2"><div><label class="f">اسم الشركة</label><input class="in" name="name" value="${esc(c?.name || '')}" required></div>
        <div><label class="f">رابط اللوجو</label><input class="in mono" name="logo" value="${esc(c?.logo_url || '')}" placeholder="https://..."></div></div>
      ${c ? `<label class="row small"><input type="checkbox" name="active" ${c.active ? 'checked' : ''}> الشركة مفعّلة (بتظهر في الترشيح)</label>` : `
      <div class="grid2"><div><label class="f">البونص الكامل</label><input class="in" type="number" name="full" value="1000" min="0"></div><div><label class="f">بعد كام يوم</label><input class="in" type="number" name="days" value="26" min="1"></div></div>
      <p class="small muted" style="margin:0">هيتعمل تلقائي: ورق 100، 7 أيام 200، 15 يوم 500، والبونص الكامل. تقدر تعدلهم بعد الحفظ.</p>`}
      ${c ? `<div class="card" style="background:#f8fafc"><h3>قواعد البونص</h3>
        <div class="row"><label class="f" style="margin:0">بونص استكمال الورق</label><input class="in" type="number" min="0" name="paper" value="${paper?.amount ?? 0}" style="width:130px"></div>
        <p class="small muted">الشريك بياخد مبلغ <b>أعلى شريحة</b> المندوب وصلها (مش مجموعهم). آخر شريحة = البونص الكامل.</p>
        <div class="stack" data-tiers>${tiers.map(tierRow).join('')}</div>
        <button type="button" class="btn sec sm" data-addt style="margin-top:8px">➕ شريحة</button></div>` : ''}
      <div class="err" data-err></div>
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn sec" data-close>إلغاء</button><button class="btn pri">حفظ</button></div>
    </form>`);
  const f = $('form', m.el);
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

// ------------------------------------------------------------------ jobs
async function jobs() {
  const [js, cands] = await Promise.all([
    fetchAll(() => sb.from('jobs').select('*').order('created_at', { ascending: false })),
    fetchAll(() => sb.from('candidates').select('job_id,status').not('job_id', 'is', null)),
  ]);
  const apps = {}; cands.forEach((c) => { if (c.status !== 'rejected') apps[c.job_id] = (apps[c.job_id] || 0) + 1; });
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
    const rows = js.filter((j) => (st ? j.status === st : j.status !== 'Deleted') && (!co || j.company_id === co) &&
      (!q || [j.code, j.title, j.gov, j.region, j.pricing, j.bonus_text].join(' ').toLowerCase().includes(q)));
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
  const add = $('[data-add]'); if (add) add.onclick = () => jobEdit(null);
  render();
}

function jobEdit(j, isCopy) {
  const DOCS = ['بطاقة سارية', 'رخصة قيادة', 'رخصة مركبة', 'فيش جنائي', 'شهادة ميلاد', 'شهادة جيش'];
  const has = (d) => String(j?.docs || '').includes(d);
  const m = modal(`
    <h2>${j && !isCopy ? 'تعديل وظيفة ' + esc(j.code) : 'نشر وظيفة جديدة'}</h2>
    <form class="stack">
      <div class="grid3">
        <div><label class="f">الشركة</label><select class="in" name="company" required><option value="">اختار...</option>${S.companies.filter((c) => c.active || c.id === j?.company_id).map((c) => `<option value="${c.id}" ${j?.company_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
        <div><label class="f">المسمى الوظيفي</label><input class="in" name="title" value="${esc(j?.title || 'مندوب توصيل')}" required></div>
        <div><label class="f">السن</label><input class="in" name="age" value="${esc(j?.age || '')}" placeholder="من 21 لـ 40"></div>
      </div>
      <div class="grid3">
        <div><label class="f">المحافظة</label><select class="in" name="gov">${GOVS.map((g) => `<option ${j?.gov === g ? 'selected' : ''}>${g}</option>`).join('')}${j?.gov && !GOVS.includes(j.gov) ? `<option selected>${esc(j.gov)}</option>` : ''}</select></div>
        <div><label class="f">المنطقة</label><input class="in" name="region" value="${esc(j?.region || '')}" required></div>
        <div><label class="f">نوع الدوام</label><select class="in" name="type">${['دوام كامل (Full-Time)', 'بارت تايم (Part-Time)', 'شفتات متغيرة (Shifts)', 'عمل حر (Freelance)'].map((t) => `<option ${j?.work_type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      </div>
      <div class="grid3">
        <div><label class="f">المركبة</label><select class="in" name="vehicle">${VEHICLES.map((v) => `<option ${j?.vehicle === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div><label class="f">التسعيرة للمندوب</label><input class="in" name="pricing" value="${esc(j?.pricing || '')}" required></div>
        <div><label class="f">نص البونص للشريك</label><input class="in" name="bonus" value="${esc(j?.bonus_text || '')}" placeholder="يتملي من الشركة لو فاضي"></div>
      </div>
      <div class="grid3">
        <div><label class="f">العدد المطلوب (فاضي = مفتوح)</label><input class="in" type="number" min="1" name="hc" value="${j?.headcount ?? ''}"></div>
        <div><label class="f">تاريخ الانتهاء</label><input class="in" type="date" name="expiry" value="${j?.expiry || ''}"></div>
        <div><label class="f">الحالة</label><select class="in" name="status"><option value="Active" ${j?.status !== 'Inactive' ? 'selected' : ''}>نشطة</option><option value="Inactive" ${j?.status === 'Inactive' ? 'selected' : ''}>متوقفة</option></select></div>
      </div>
      <div><label class="f">الورق المطلوب</label><div class="row">${DOCS.map((d) => `<label class="small row" style="gap:4px"><input type="checkbox" name="doc" value="${d}" ${has(d) ? 'checked' : ''}>${d}</label>`).join('')}</div></div>
      <div><label class="f">التفاصيل</label><textarea class="in" name="details">${esc(j?.details || '')}</textarea></div>
      <div class="err" data-err></div>
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn sec" data-close>إلغاء</button><button class="btn pri">${j && !isCopy ? 'حفظ' : 'نشر'}</button></div>
    </form>`, 'wide');
  const f = $('form', m.el);
  f.company.onchange = () => { if (!f.bonus.value) { const c = S.companies.find((x) => x.id === f.company.value); if (c) f.bonus.value = `${c.full_amount} ج.م بعد ${c.target_days} يوم`; } };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const c = S.companies.find((x) => x.id === f.company.value);
    const rec = {
      company_id: f.company.value, company_name: c?.name ?? null, title: f.title.value.trim(), age: f.age.value.trim(), gov: f.gov.value, region: f.region.value.trim(),
      work_type: f.type.value, vehicle: f.vehicle.value, pricing: f.pricing.value.trim(), bonus_text: f.bonus.value.trim() || (c ? `${c.full_amount} ج.م بعد ${c.target_days} يوم` : ''),
      headcount: f.hc.value ? Number(f.hc.value) : null, expiry: f.expiry.value || null, status: f.status.value,
      docs: $$('[name=doc]:checked', f).map((x) => x.value).join('، '), details: f.details.value.trim(),
    };
    await busy($('button.pri', f), async () => {
      const q = j && !isCopy ? sb.from('jobs').update(rec).eq('id', j.id) : sb.from('jobs').insert({ ...rec, created_by: (await sb.auth.getUser()).data.user.id });
      const { error } = await q;
      if (error) return ($('[data-err]', f).textContent = errMsg(error));
      m.close(); toast(j && !isCopy ? 'تم الحفظ ✅' : 'تم نشر الوظيفة 🚀', 'ok'); go('jobs');
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
      <b>الصلاحيات:</b> المالك = كل حاجة • مدير = كل حاجة ما عدا الفريق • مالية = عرض + السحوبات • توظيف = عرض + المناديب والوظائف • مشاهدة فقط.
    </div>
    <div id="tbl"></div>`);
  pagedTable($('#tbl'), data, [
    ['الإيميل', (s) => `<span class="mono">${esc(s.email)}</span>`], ['الاسم', (s) => esc(s.name || '')],
    ['الصلاحية', (s) => `<select class="in" style="width:auto" data-role="${s.user_id}">${Object.entries(ROLE_AR).map(([k, t]) => `<option value="${k}" ${k === s.role ? 'selected' : ''}>${t}</option>`).join('')}</select>`],
    ['مفعّل', (s) => `<input type="checkbox" data-act="${s.user_id}" ${s.active ? 'checked' : ''}>`],
    ['أضيف', (s) => fmtDate(s.created_at)],
  ], { onRender: (h) => {
    $$('[data-role]', h).forEach((x) => x.onchange = async () => { const { error } = await sb.from('staff').update({ role: x.value }).eq('user_id', x.dataset.role); toast(error ? errMsg(error) : 'تم ✅', error ? 'bad' : 'ok'); if (error) go('staff'); });
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

// ------------------------------------------------------------------ audit
async function audit() {
  const { data, error } = await sb.from('audit_log').select('*').order('at', { ascending: false }).limit(500);
  if (error) throw error;
  const T = { freelancers: 'شريك', candidates: 'مندوب', withdrawals: 'سحب', companies: 'شركة', bonus_rules: 'قاعدة بونص', jobs: 'وظيفة', bonus_ledger: 'أرباح', staff: 'فريق' };
  const diff = (a) => {
    if (!a.before || !a.after) return a.after ? Object.entries(a.after).filter(([k]) => ['name', 'status', 'amount', 'title', 'email', 'role'].includes(k)).map(([k, v]) => `${k}: ${v}`).join(' • ') : '';
    return Object.keys(a.after).filter((k) => k !== 'updated_at' && JSON.stringify(a.before[k]) !== JSON.stringify(a.after[k])).map((k) => `${k}: ${a.before[k] ?? '∅'} ← ${a.after[k] ?? '∅'}`).join(' • ');
  };
  view(`<div class="ph"><h1>سجل التغييرات</h1><span class="small muted">آخر 500 عملية</span></div>
    <div class="tools"><select class="in" data-t><option value="">كل الجداول</option>${Object.entries(T).map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select><input class="in q" placeholder="بحث بالإيميل أو المحتوى" data-q></div><div id="tbl"></div>`);
  const render = () => {
    const t = $('[data-t]').value, q = $('[data-q]').value.trim().toLowerCase();
    const rows = data.filter((a) => (!t || a.table_name === t) && (!q || JSON.stringify(a).toLowerCase().includes(q)));
    pagedTable($('#tbl'), rows, [
      ['الوقت', (a) => `<span class="small">${new Date(a.at).toLocaleString('en-GB')}</span>`],
      ['المستخدم', (a) => `<span class="small mono">${esc(a.actor_email || a.actor_role || 'system')}</span>`],
      ['العملية', (a) => `<span class="chip n">${esc(T[a.table_name] || a.table_name || '')}</span> ${esc(a.action)}`],
      ['التغيير', (a) => `<div class="small" style="max-width:520px;white-space:normal;word-break:break-word">${esc(diff(a)).slice(0, 600)}</div>`],
    ]);
  };
  $$('[data-t],[data-q]').forEach((el) => el.oninput = render);
  render();
}

sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') location.reload(); });
boot();
