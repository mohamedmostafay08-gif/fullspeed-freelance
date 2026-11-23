// Admin analytics: small HTML/CSS chart primitives (RTL-friendly, theme-aware, hover tooltips)
// and the chart strip for each page. Clickable marks carry data-fx-k / data-fx-v, which the page's
// filter bar (filters.js) turns into a filter; '@month' columns narrow the date range to that month.
import { $, $$, esc, money, fetchAll, sb, CAND_STATUS, WD_STATUS, FL_STATUS, today, daysBetween, dayOfValue, targetDaysMap } from '../shared/common.js';
import { filters, rangeBounds, inBounds } from './filters.js';
import { qBand, Q_BANDS } from './growth.js';

const n0 = (v) => Math.round(Number(v) || 0).toLocaleString('en-US');
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const ym = (v) => dayOfValue(v).slice(0, 7); // Cairo month of a date or timestamp
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const monthLabel = (k) => { const [y, m] = k.split('-').map(Number); return `${MONTHS_AR[m - 1]} ${String(y).slice(2)}`; };
const monthShort = (k) => { const [y, m] = k.split('-'); return `${Number(m)}/${y.slice(2)}`; };
const addMonth = (k, n) => { const [y, m] = k.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

// Months to show for the current range: the range's own months, or the last `max` months up to now.
export function monthsFor([a, b], max = 12) {
  const end = ym(b || today()), start = a ? ym(a) : addMonth(end, -(max - 1));
  const out = []; for (let k = start; k <= end && out.length < 36; k = addMonth(k, 1)) out.push(k);
  return out.slice(-Math.max(max, 1));
}

// ---------------------------------------------------------------- tooltip (one floating element)
let tipEl = null;
function initTip() {
  if (tipEl) return;
  tipEl = document.createElement('div'); tipEl.className = 'ax-tip'; tipEl.setAttribute('role', 'tooltip'); tipEl.hidden = true;
  document.body.append(tipEl);
  const show = (t, x, y) => {
    tipEl.innerHTML = t; tipEl.hidden = false;
    const r = tipEl.getBoundingClientRect();
    tipEl.style.left = Math.max(8, Math.min(innerWidth - r.width - 8, x - r.width / 2)) + 'px';
    tipEl.style.top = Math.max(8, y - r.height - 14) + 'px';
  };
  // Touch has no hover: a tap shows the values for a moment (the same tap also applies the filter).
  let hideT = 0;
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    const m = e.target.closest?.('[data-tip]'); if (!m) { tipEl.hidden = true; return; }
    show(m.dataset.tip, e.clientX, e.clientY); clearTimeout(hideT); hideT = setTimeout(() => { tipEl.hidden = true; }, 2600);
  }, { passive: true });
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const m = e.target.closest?.('[data-tip]');
    if (!m) { tipEl.hidden = true; return; }
    show(m.dataset.tip, e.clientX, e.clientY);
  }, { passive: true });
  document.addEventListener('focusin', (e) => { const m = e.target.closest?.('[data-tip]'); if (!m) return; const r = m.getBoundingClientRect(); show(m.dataset.tip, r.left + r.width / 2, r.top); });
  document.addEventListener('focusout', () => { tipEl.hidden = true; });
  addEventListener('scroll', () => { tipEl.hidden = true; }, { passive: true });
}
const tip = (html) => `data-tip="${esc(html)}"`;
const click = (k, v, on) => (k ? `data-fx-k="${esc(k)}" data-fx-v="${esc(v)}" tabindex="0" role="button" aria-pressed="${on ? 'true' : 'false'}"` : '');

// ---------------------------------------------------------------- primitives
export function card(title, body, { note = '', cls = '', tools = '' } = {}) {
  return `<section class="card ax-card ${cls}"><header class="ax-h"><h3>${title}</h3>${tools}</header>${note ? `<p class="ax-note">${note}</p>` : ''}${body}</section>`;
}
// Horizontal bars. items: [{label, value, v, sub, tipx, tone, heat}] — v is the filter value for clicks.
export function hbars(items, { k = '', fmt = n0, active = '', empty = 'مفيش بيانات في الفترة دي', limit = 10, tone = '' } = {}) {
  const list = items.slice(0, limit); if (!list.length) return `<div class="ax-empty">${empty}</div>`;
  const max = Math.max(1, ...list.map((x) => x.value));
  return `<div class="ax-hbars">${list.map((x) => {
    const on = active && String(x.v) === String(active);
    return `<div class="ax-hb ${k ? 'is-click' : ''} ${on ? 'on' : ''} ${active && !on ? 'dim' : ''}" ${click(k, x.v, on)} ${tip(`<b>${esc(x.label)}</b><br>${fmt(x.value)}${x.tipx ? '<br>' + x.tipx : ''}`)}>
      <span class="ax-hl">${esc(x.label)}</span>
      <span class="ax-ht"><i class="${x.tone || tone}" style="inline-size:${Math.max(1.5, (x.value / max) * 100)}%${x.heat != null ? `;--heat:${x.heat}` : ''}"></i></span>
      <span class="ax-hv">${fmt(x.value)}${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</span></div>`;
  }).join('')}</div>`;
}
// Vertical (grouped) columns over months. groups: [{key, label, vals:[...], forecast}] series: [{name, cls}]
export function columns(groups, series, { k = '@month', fmt = n0, active = '', height = 150, short = false } = {}) {
  if (!groups.length) return '<div class="ax-empty">مفيش بيانات</div>';
  const max = Math.max(1, ...groups.flatMap((g) => g.vals));
  const nice = (() => { const p = 10 ** Math.floor(Math.log10(max)); const s = [1, 2, 2.5, 5, 10].find((m) => m * p >= max); return s * p; })();
  const ticks = [nice, nice / 2, 0];
  const legend = series.length > 1 ? `<div class="ax-legend">${series.map((s) => `<span><i class="${s.cls}"></i>${s.name}</span>`).join('')}</div>` : '';
  return `${legend}<div class="ax-cols" style="--h:${height}px">
    <div class="ax-yax">${ticks.map((t) => `<span>${fmt(t)}</span>`).join('')}</div>
    <div class="ax-plot">${ticks.map((_, i) => `<b class="ax-gl" style="inset-block-start:${(i / 2) * 100}%"></b>`).join('')}
      ${groups.map((g) => {
        const on = active && active === g.key;
        const tipx = `<b>${esc(g.label)}${g.forecast ? ' (توقّع)' : ''}</b>${series.map((s, i) => `<br><i class="ax-dot ${s.cls}"></i>${s.name}: ${fmt(g.vals[i])}`).join('')}${g.tipx ? '<br>' + g.tipx : ''}`;
        return `<div class="ax-col ${g.forecast ? 'fc' : ''} ${on ? 'on' : ''} ${!g.forecast && k ? 'is-click' : ''}" ${g.forecast ? '' : click(k, g.key, on)} ${tip(tipx)}>
          <div class="ax-bars">${g.vals.map((v, i) => `<i class="${series[i].cls}" style="block-size:${v ? Math.max(1.5, (v / nice) * 100) : 0}%"></i>`).join('')}</div>
          <span class="ax-xl">${esc(short && g.key ? monthShort(g.key) : g.label)}</span></div>`;
      }).join('')}</div></div>`;
}
// Funnel: stages [{label, n}] — bar = share of the first stage, plus step-to-step conversion.
export function funnel(stages) {
  const top = stages[0]?.n || 0;
  return `<div class="ax-fun">${stages.map((s, i) => {
    const prev = i ? stages[i - 1].n : s.n;
    return `<div class="ax-fs" ${tip(`<b>${esc(s.label)}</b><br>${n0(s.n)} — ${pct(s.n, top)}% من الترشيحات${i ? `<br>${pct(s.n, prev)}% من المرحلة اللي قبلها` : ''}`)}>
      <span class="ax-fl">${esc(s.label)}</span>
      <span class="ax-ft"><i style="inline-size:${top ? Math.max(1.5, (s.n / top) * 100) : 0}%"></i></span>
      <span class="ax-fv"><b>${n0(s.n)}</b> <small>${pct(s.n, top)}%</small></span>
      ${i ? `<span class="ax-step" title="من المرحلة اللي قبلها">↓ ${pct(s.n, prev)}%</span>` : '<span class="ax-step"></span>'}</div>`;
  }).join('')}</div>`;
}
const seg = (name, opts, cur) => `<div class="ax-seg" role="group">${opts.map(([v, t]) => `<button type="button" data-seg="${name}" data-v="${v}" class="${v === cur ? 'on' : ''}">${t}</button>`).join('')}</div>`;
const countBy = (rows, f) => { const m = new Map(); rows.forEach((r) => { const k = f(r); if (k == null || k === '') return; m.set(k, (m.get(k) || 0) + 1); }); return m; };
const sumBy = (rows, f, v) => { const m = new Map(); rows.forEach((r) => { const k = f(r); if (k == null || k === '') return; m.set(k, (m.get(k) || 0) + Number(v(r) || 0)); }); return m; };
const sorted = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]);

// ---------------------------------------------------------------- shared domain helpers
// Target days per company = the highest "days" tier (falls back to the company setting, then 26).
const targets = (rules, companies) => targetDaysMap(rules, companies);
const workDays = (c) => (c.start_date ? daysBetween(c.start_date, c.end_date && c.end_date < today() ? c.end_date : today()) : 0);
function stagesOf(list, tgt) {
  const live = list.filter((c) => c.status !== 'rejected');
  return [
    { label: 'اترشّحوا', n: list.length },
    { label: 'اتقبلوا بعد المراجعة', n: live.filter((c) => c.status !== 'submitted').length },
    { label: 'خلّصوا الورق', n: live.filter((c) => c.paper_date).length },
    { label: 'بدأوا شغل', n: live.filter((c) => c.start_date).length },
    { label: 'كمّلوا أيام الهدف', n: live.filter((c) => c.start_date && workDays(c) >= (tgt[c.company_id] || 26)).length },
  ];
}
// Bonus amount reached after `d` days for a company (paper excluded): highest tier reached.
function tierAt(rules, cid, d) { return Math.max(0, ...rules.filter((r) => r.company_id === cid && r.kind === 'days' && d >= r.min_days).map((r) => Number(r.amount))); }

const STATUS_TONE = { submitted: 'tn-n', new: 'tn-b', hired: 'tn-g', suspended: 'tn-a', rejected: 'tn-r' };
const WD_TONE = { pending: 'tn-a', paid: 'tn-g', rejected: 'tn-r' };
const FL_TONE = { Active: 'tn-g', Pending: 'tn-a', Hold: 'tn-p', Inactive: 'tn-r' };
const govOpts = (rows, f) => sorted(countBy(rows, f)).map(([g]) => [g, g]);
const flOpts = (S, ids) => [...new Set(ids)].map((id) => [id, S.flMap.get(id)?.name || '—']).sort((a, b) => a[1].localeCompare(b[1], 'ar'));
const compOpts = (S) => S.companies.map((c) => [c.id, c.name]);
const bind = (host, fn) => $$('[data-seg]', host).forEach((b) => b.onclick = () => fn(b.dataset.seg, b.dataset.v));

// ================================================================= DASHBOARD (full overview)
export async function dashboard(host, { S, compName, flName, pre = null }) {
  initTip();
  host.innerHTML = `<div class="ax-sec-h"><h2>📊 التحليلات</h2><span class="small muted">الفلاتر هنا بتأثر على كل الشارتات تحت. دوس على أي عمود أو شريط عشان تفلتر بيه.</span></div>
    <div class="tools" data-ax-tools></div><div class="ax-grid" data-ax-body><div class="spin"></div></div>`;
  // `pre` = rows the dashboard already downloaded (candidates, withdrawals, jobs); only fetch what's missing.
  const [cands, led, wds, jobs, rulesR] = await Promise.all([
    pre?.cands || fetchAll(() => sb.from('candidates').select('id,status,paper_date,start_date,end_date,created_at,company_id,company_name,freelancer_id,gov,region,vehicle,job_id,source')),
    fetchAll(() => sb.from('bonus_ledger').select('kind,amount,earned_on,reversed_at,candidate_id,freelancer_id')),
    pre?.wds || fetchAll(() => sb.from('withdrawals').select('amount,status,created_at,decided_at,freelancer_id')),
    pre?.jobs || fetchAll(() => sb.from('jobs').select('id,code,title,headcount,status,company_id,company_name,gov,region,created_at,expiry')),
    sb.from('bonus_rules').select('company_id,kind,min_days,amount').eq('active', true),
  ]);
  const rules = rulesR.data || [], tgt = targets(rules, S.companies);
  const cMap = new Map(cands.map((c) => [c.id, c]));
  const ui = { fun: 'company', rank: 'total', money: 'month' };
  const FX = filters('dash', {
    tools: $('[data-ax-tools]', host), date: (c) => c.created_at, defRange: '90d', charts: false,
    dims: [
      { key: 'co', label: 'الشركة', all: 'كل الشركات', options: compOpts(S), get: (c) => c.company_id },
      { key: 'gov', label: 'المحافظة', all: 'كل المحافظات', options: govOpts(cands, (c) => c.gov), get: (c) => c.gov },
      { key: 'fl', label: 'الشريك', all: 'كل الشركاء', options: flOpts(S, cands.map((c) => c.freelancer_id)), get: (c) => c.freelancer_id },
      { key: 'veh', label: 'المركبة', all: 'كل المركبات', options: govOpts(cands, (c) => c.vehicle), get: (c) => c.vehicle },
    ],
    onChange: () => draw(),
  });
  const body = $('[data-ax-body]', host);
  body.addEventListener('click', (e) => { const m = e.target.closest('[data-fx-k]'); if (m) FX.set(m.dataset.fxK, m.dataset.fxV); });

  function draw() {
    const B = FX.bounds();
    const dimOk = (c) => c && ['co', 'gov', 'fl', 'veh'].every((k) => { const v = FX.get(k); if (!v) return true; return String({ co: c.company_id, gov: c.gov, fl: c.freelancer_id, veh: c.vehicle }[k] ?? '') === v; });
    const rows = cands.filter(FX.match);
    const st = stagesOf(rows, tgt);

    // --- funnel + breakdown by company / partner
    const groupKey = ui.fun === 'company' ? (c) => c.company_id || '' : (c) => c.freelancer_id;
    const groups = new Map(); rows.forEach((c) => { const k = groupKey(c); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); });
    const brk = [...groups.entries()].map(([k, l]) => ({ k, name: ui.fun === 'company' ? compName(k, l[0].company_name) : flName(k), s: stagesOf(l, tgt) }))
      .sort((a, b) => b.s[0].n - a.s[0].n).slice(0, 8);
    const fk = ui.fun === 'company' ? 'co' : 'fl';
    const funCard = card('🧭 رحلة المندوب (Funnel)', `${funnel(st)}
      <div class="ax-sub"><span class="small muted">حسب</span>${seg('fun', [['company', 'الشركة'], ['partner', 'الشريك']], ui.fun)}</div>
      <div class="tw ax-tw"><table class="t ax-t"><thead><tr><th>${ui.fun === 'company' ? 'الشركة' : 'الشريك'}</th><th>ترشيحات</th><th>ورق</th><th>بدأوا</th><th>كمّلوا</th><th>التحويل</th></tr></thead><tbody>
      ${brk.map((r) => { const conv = pct(r.s[4].n, r.s[0].n); return `<tr class="is-click ${FX.get(fk) === r.k ? 'on' : ''}" ${click(fk, r.k, FX.get(fk) === r.k)}><td><b data-noi18n>${esc(r.name)}</b></td><td>${r.s[0].n}</td><td>${r.s[2].n} <small class="muted">${pct(r.s[2].n, r.s[0].n)}%</small></td><td>${r.s[3].n} <small class="muted">${pct(r.s[3].n, r.s[0].n)}%</small></td><td>${r.s[4].n}</td><td><span class="ax-pill" style="--p:${conv}">${conv}%</span></td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">—</td></tr>'}
      </tbody></table></div>`, { cls: 'span2', note: 'كل مرحلة = عدد المناديب اللي وصلوها (المرفوضين مش محسوبين). السهم ↓ = نسبة التحويل من المرحلة اللي قبلها.' });

    // --- partner ranking
    const metric = { total: (l) => l.length, hired: (l) => l.filter((c) => c.status === 'hired').length, done: (l) => l.filter((c) => c.start_date && c.status !== 'rejected' && workDays(c) >= (tgt[c.company_id] || 26)).length }[ui.rank];
    const byFl = new Map(); rows.forEach((c) => { if (!byFl.has(c.freelancer_id)) byFl.set(c.freelancer_id, []); byFl.get(c.freelancer_id).push(c); });
    const rank = [...byFl.entries()].map(([id, l]) => ({ label: flName(id), v: id, value: metric(l), sub: `${pct(l.filter((c) => c.status === 'hired').length, l.length)}% تعيين`, tipx: `ترشيحات ${l.length} • اتعيّنوا ${l.filter((c) => c.status === 'hired').length}` }))
      .filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
    const rankCard = card('🏆 ترتيب الشركاء', `${seg('rank', [['total', 'ترشيحات'], ['hired', 'اتعيّنوا'], ['done', 'كمّلوا الهدف']], ui.rank)}${hbars(rank, { k: 'fl', active: FX.get('fl'), tone: 'tn-o' })}`);

    // --- governorates: length = nominations, shade = hire rate (heat)
    const byGov = new Map(); rows.forEach((c) => { const g = c.gov || 'غير محدد'; if (!byGov.has(g)) byGov.set(g, []); byGov.get(g).push(c); });
    const govs = [...byGov.entries()].map(([g, l]) => { const h = l.filter((c) => c.status === 'hired').length; return { label: g, v: g, value: l.length, heat: (h / l.length).toFixed(2), sub: `${pct(h, l.length)}% تعيين`, tipx: `اتعيّنوا ${h} (${pct(h, l.length)}%)` }; }).sort((a, b) => b.value - a.value);
    const govCard = card('🗺️ المحافظات', `${hbars(govs, { k: 'gov', active: FX.get('gov'), limit: 12, tone: 'tn-heat' })}<div class="ax-heatkey"><span>نسبة تعيين قليلة</span><i></i><span>عالية</span></div>`, { note: 'طول الشريط = عدد الترشيحات • لون أغمق = نسبة تعيين أعلى' });

    // --- money by month (+ forecast) and by company
    const ledOk = (l) => { if (l.candidate_id) return dimOk(cMap.get(l.candidate_id)); const fl = FX.get('fl'); return !FX.get('co') && !FX.get('gov') && !FX.get('veh') && (!fl || l.freelancer_id === fl); };
    const ledR = led.filter(ledOk), wdR = wds.filter((w) => !FX.get('fl') || w.freelancer_id === FX.get('fl'));
    const months = monthsFor(B, 6);
    const mGroups = months.map((m) => {
      const inM = (d) => ym(d) === m;
      const earned = ledR.filter((l) => !l.reversed_at && inM(l.earned_on)).reduce((a, l) => a + Number(l.amount), 0);
      const reversed = ledR.filter((l) => l.reversed_at && inM(l.earned_on)).reduce((a, l) => a + Math.abs(Number(l.amount)), 0);
      const paid = wdR.filter((w) => w.status === 'paid' && inM(w.decided_at || w.created_at)).reduce((a, w) => a + Number(w.amount), 0);
      const pend = wdR.filter((w) => w.status === 'pending' && inM(w.created_at)).reduce((a, w) => a + Number(w.amount), 0);
      return { key: m, label: monthLabel(m), vals: [earned, paid, pend, reversed] };
    });
    // Forecast for next month: bonus tiers that couriers working now will cross in the next 30 days,
    // plus the average monthly paper bonus of the last 3 months.
    const nm = addMonth(ym(today()), 1);
    const working = cands.filter((c) => c.status === 'hired' && c.start_date && (!c.end_date || c.end_date >= today()) && dimOk(c));
    const pipe = working.reduce((a, c) => { const d = workDays(c); return a + Math.max(0, tierAt(rules, c.company_id, d + 30) - tierAt(rules, c.company_id, d)); }, 0);
    const last3 = [1, 2, 3].map((i) => addMonth(ym(today()), -i));
    const paperAvg = Math.round(ledR.filter((l) => l.kind === 'paper' && !l.reversed_at && last3.includes(ym(l.earned_on))).reduce((a, l) => a + Number(l.amount), 0) / 3);
    if (!B[1] || B[1] >= today()) mGroups.push({ key: nm, label: monthLabel(nm), vals: [pipe + paperAvg, 0, 0, 0], forecast: true, tipx: `شرايح هيعدّوها ${working.length} مندوب شغال: ${money(pipe)}<br>متوسط بونص الورق آخر 3 شهور: ${money(paperAvg)}` });
    const SER = [{ name: 'بونص مستحق', cls: 'tn-1' }, { name: 'اتصرف', cls: 'tn-2' }, { name: 'سحب منتظر', cls: 'tn-3' }, { name: 'اتلغى', cls: 'tn-4' }];
    const tot = mGroups.filter((g) => !g.forecast).reduce((a, g) => a.map((x, i) => x + g.vals[i]), [0, 0, 0, 0]);
    const kp = `<div class="ax-kpis">${SER.map((s, i) => `<div><i class="ax-dot ${s.cls}"></i><span>${s.name}</span><b>${money(tot[i])}</b></div>`).join('')}<div class="fc"><span>توقّع الشهر الجاي</span><b>${money(pipe + paperAvg)}</b></div></div>`;
    const byCo = sumBy(ledR.filter((l) => !l.reversed_at && inBounds(B, l.earned_on)), (l) => cMap.get(l.candidate_id)?.company_id, (l) => l.amount);
    const coBars = sorted(byCo).map(([id, v]) => ({ label: compName(id), v: id, value: v }));
    const moneyCard = card('💰 الفلوس والبونص', `${kp}${seg('money', [['month', 'بالشهر'], ['company', 'بالشركة']], ui.money)}
      ${ui.money === 'month' ? columns(mGroups, SER, { fmt: (v) => n0(v), active: FX.state.range === 'custom' ? ym(FX.state.from) : '' }) : hbars(coBars, { k: 'co', active: FX.get('co'), fmt: money, tone: 'tn-1' })}`,
      { cls: 'span2', note: 'العمود المنقّط = توقّع الشهر الجاي: البونص اللي هيستحق لما المناديب الشغالين دلوقتي يعدّوا شرايح الأيام خلال 30 يوم + متوسط بونص الورق آخر 3 شهور. السحوبات مش مربوطة بشركة، فبتتفلتر بالشريك بس.' });

    // --- jobs: demand, fill rate, jobs nobody nominated for
    const jobOk = (j) => (!FX.get('co') || j.company_id === FX.get('co')) && (!FX.get('gov') || j.gov === FX.get('gov'));
    const liveJobs = jobs.filter((j) => j.status !== 'Deleted' && jobOk(j));
    const nom = countBy(rows.filter((c) => c.job_id), (c) => c.job_id);
    const hiredAll = countBy(cands.filter((c) => c.job_id && c.status === 'hired'), (c) => c.job_id);
    const demand = liveJobs.map((j) => ({ label: `${j.title || '—'} • ${compName(j.company_id, j.company_name)}`, v: j.id, value: nom.get(j.id) || 0, sub: j.region || j.gov || '', tipx: esc(`${j.code} • ${j.gov || ''} ${j.region || ''}`) })).filter((x) => x.value).sort((a, b) => b.value - a.value);
    const fill = liveJobs.filter((j) => j.headcount).map((j) => { const h = hiredAll.get(j.id) || 0; return { label: `${j.title || '—'} • ${compName(j.company_id, j.company_name)}`, v: j.id, value: Math.min(100, pct(h, j.headcount)), sub: `${h}/${j.headcount}`, tone: h >= j.headcount ? 'tn-g' : 'tn-b', tipx: `اتعيّن ${h} من ${j.headcount} مطلوب` }; }).sort((a, b) => b.value - a.value);
    const zero = liveJobs.filter((j) => j.status === 'Active' && (!j.expiry || j.expiry >= today()) && !cands.some((c) => c.job_id === j.id));
    const jobsCard = card('💼 الوظايف والشركات', `<div class="ax-split">
        <div><h4>الأكتر طلباً <small class="muted">(ترشيحات في الفترة)</small></h4>${hbars(demand, { limit: 7, tone: 'tn-1' })}</div>
        <div><h4>نسبة الامتلاء <small class="muted">(اتعيّنوا ÷ العدد المطلوب)</small></h4>${hbars(fill, { limit: 7, fmt: (v) => v + '%' })}</div>
      </div>
      <div class="ax-zero"><b>${zero.length}</b> وظيفة نشطة ملهاش ولا ترشيح ${zero.length ? `<div class="ax-tags">${zero.slice(0, 8).map((j) => `<span class="chip a">${esc(j.title || '')} • ${esc(compName(j.company_id, j.company_name))} • ${esc(j.region || j.gov || '')}</span>`).join('')}${zero.length > 8 ? `<span class="small muted">+${zero.length - 8}</span>` : ''}</div>` : ''}</div>`, { cls: 'span2' });

    body.innerHTML = funCard + rankCard + govCard + moneyCard + jobsCard;
    bind(body, (name, v) => { ui[name] = v; draw(); });
  }
  draw();
}

// ================================================================= page strips
// Each returns the FX (filter bar) so the page can filter its rows; call .draw(rows) after filtering.
function strip(FX, cards) { FX.strip.innerHTML = `<div class="ax-row">${cards.join('')}</div>`; }

export function partnersFx({ S, onChange }) {
  initTip();
  const prim = S.fl.filter((f) => !f.duplicate_of);
  const FX = filters('partners', {
    tools: $('.tools'), date: (f) => f.created_at,
    adopt: [{ key: 'q', label: 'بحث', el: '[data-q]' }, { key: 'st', label: 'الحالة', el: '[data-st]' }, { key: 'gov', label: 'المحافظة', el: '[data-gov]' }, { key: 'qsort', label: 'الترتيب', el: '[data-qsort]' }],
    dims: [{ key: 'login', label: 'الدخول', all: 'كل الحسابات', options: [['yes', 'ليه دخول'], ['no', 'بدون دخول'], ['frozen', 'متجمّد']], get: (f) => (f.frozen_at ? 'frozen' : f.user_id ? 'yes' : 'no') },
      { key: 'qual', label: 'الجودة', all: 'كل مستويات الجودة', options: Q_BANDS, get: (f) => qBand(S.quality?.get(f.id)) }],
    onChange,
  });
  FX.draw = (rows) => {
    const B = FX.bounds(), months = monthsFor(B, 6);
    const reg = months.map((m) => ({ key: m, label: monthLabel(m), vals: [prim.filter((f) => ym(f.created_at) === m).length] }));
    const gov = sorted(countBy(rows, (f) => f.gov)).map(([g, v]) => ({ label: g, v: g, value: v }));
    const stt = sorted(countBy(rows, (f) => f.status)).map(([s, v]) => ({ label: FL_STATUS[s]?.[0] || s, v: s, value: v, tone: FL_TONE[s] }));
    strip(FX, [
      card('📈 التسجيلات بالشهر', columns(reg, [{ name: 'شركاء جدد', cls: 'tn-1' }], { active: FX.state.range === 'custom' ? ym(FX.state.from) : '', height: 110, short: true })),
      card('🗺️ حسب المحافظة', hbars(gov, { k: 'gov', active: FX.get('gov'), limit: 6, tone: 'tn-o' })),
      card('🔖 حسب الحالة', hbars(stt, { k: 'st', active: FX.get('st') })),
    ]);
  };
  return FX;
}

export function couriersFx({ S, compName, onChange, rules = [] }) {
  initTip();
  const tgt = targets(rules, S.companies);
  const FX = filters('couriers', {
    tools: $('.tools'), date: (c) => c.created_at,
    adopt: [{ key: 'q', label: 'بحث', el: '[data-q]' }, { key: 'st', label: 'الحالة', el: '[data-st]' }, { key: 'co', label: 'الشركة', el: '[data-co]' }, { key: 'due', label: 'الاستحقاق', el: '[data-due]' }, { key: 'fl', label: 'الشريك', el: '[data-fl]' }],
    dims: [
      { key: 'gov', label: 'المحافظة', all: 'كل المحافظات', options: [], get: (c) => c.gov },
      { key: 'veh', label: 'المركبة', all: 'كل المركبات', options: [], get: (c) => c.vehicle },
      { key: 'src', label: 'المصدر', all: 'كل المصادر', options: [['partner', 'من التطبيق'], ['join', 'لينك الإحالة']], get: (c) => c.source },
    ],
    onChange,
  });
  FX.fillOptions = (cands) => {
    [['gov', (c) => c.gov], ['veh', (c) => c.vehicle]].forEach(([k, f]) => {
      const s = $(`[data-fx-dim=${k}]`); if (!s || s.options.length > 1) return;
      govOpts(cands, f).forEach(([v]) => s.add(new Option(v, v)));
      s.value = FX.state.sel[k] || '';
    });
  };
  FX.draw = (rows) => {
    const months = monthsFor(FX.bounds(), 6);
    const mon = months.map((m) => { const l = rows.filter((c) => ym(c.created_at) === m); return { key: m, label: monthLabel(m), vals: [l.length, l.filter((c) => c.status === 'hired').length] }; });
    const co = sorted(countBy(rows, (c) => c.company_id || '')).map(([id, v]) => ({ label: compName(id), v: id, value: v, sub: `${pct(rows.filter((c) => c.company_id === id && c.status === 'hired').length, v)}%` }));
    const stt = Object.keys(CAND_STATUS).map((s) => ({ label: CAND_STATUS[s][0], v: s, value: rows.filter((c) => c.status === s).length, tone: STATUS_TONE[s] })).filter((x) => x.value);
    strip(FX, [
      card('🧭 الرحلة', funnel(stagesOf(rows, tgt))),
      card('📈 بالشهر', columns(mon, [{ name: 'ترشيحات', cls: 'tn-1' }, { name: 'اتعيّنوا', cls: 'tn-2' }], { active: FX.state.range === 'custom' ? ym(FX.state.from) : '', height: 110, short: true })),
      card('🏢 حسب الشركة', hbars(co, { k: 'co', active: FX.get('co'), limit: 6, tone: 'tn-o' })),
      card('🔖 حسب الحالة', hbars(stt, { k: 'st', active: FX.get('st') })),
    ]);
  };
  return FX;
}

export function withdrawalsFx({ S, flName, onChange }) {
  initTip();
  const FX = filters('withdrawals', {
    tools: $('.tools'), date: (w) => w.created_at,
    adopt: [{ key: 'st', label: 'الحالة', el: '[data-st]' }, { key: 'q', label: 'بحث', el: '[data-q]' }],
    dims: [
      { key: 'fl', label: 'الشريك', all: 'كل الشركاء', options: [], get: (w) => w.freelancer_id },
      { key: 'method', label: 'الطريقة', all: 'كل الطرق', options: [], get: (w) => w.method },
    ],
    onChange,
  });
  FX.fillOptions = (wds) => {
    const s = $('[data-fx-dim=fl]'); if (s && s.options.length === 1) { flOpts(S, wds.map((w) => w.freelancer_id)).forEach(([v, t]) => s.add(new Option(t, v))); s.value = FX.state.sel.fl || ''; }
    const m = $('[data-fx-dim=method]'); if (m && m.options.length === 1) { govOpts(wds, (w) => w.method).forEach(([v]) => m.add(new Option(v, v))); m.value = FX.state.sel.method || ''; }
  };
  // The status chart should show every status, so it is drawn from the rows before the status filter.
  FX.draw = (rows, all) => {
    const base = (all || rows);
    const months = monthsFor(FX.bounds(), 6);
    const mon = months.map((m) => ({ key: m, label: monthLabel(m), vals: ['paid', 'pending', 'rejected'].map((s) => base.filter((w) => w.status === s && ym(w.created_at) === m).reduce((a, w) => a + Number(w.amount), 0)) }));
    const stt = ['pending', 'paid', 'rejected'].map((s) => { const l = base.filter((w) => w.status === s); return { label: WD_STATUS[s][0], v: s, value: l.reduce((a, w) => a + Number(w.amount), 0), sub: `${l.length} طلب`, tone: WD_TONE[s] }; });
    const top = sorted(sumBy(base.filter((w) => w.status !== 'rejected'), (w) => w.freelancer_id, (w) => w.amount)).map(([id, v]) => ({ label: flName(id), v: id, value: v }));
    strip(FX, [
      card('📈 المبالغ بالشهر', columns(mon, [{ name: 'اتصرف', cls: 'tn-2' }, { name: 'منتظر', cls: 'tn-3' }, { name: 'مرفوض', cls: 'tn-4' }], { active: FX.state.range === 'custom' ? ym(FX.state.from) : '', height: 110, short: true })),
      card('🔖 حسب الحالة', hbars(stt, { k: 'st', active: FX.get('st'), fmt: money })),
      card('🏆 أكتر الشركاء سحباً', hbars(top, { k: 'fl', active: FX.get('fl'), fmt: money, limit: 6, tone: 'tn-o' })),
    ]);
  };
  return FX;
}

export function jobsFx({ S, compName, onChange }) {
  initTip();
  const FX = filters('jobs', {
    tools: $('.tools'), date: (j) => j.created_at,
    adopt: [{ key: 'st', label: 'الحالة', el: '[data-st]' }, { key: 'co', label: 'الشركة', el: '[data-co]' }, { key: 'q', label: 'بحث', el: '[data-q]' }],
    dims: [
      { key: 'gov', label: 'المحافظة', all: 'كل المحافظات', options: [], get: (j) => j.gov },
      { key: 'veh', label: 'المركبة', all: 'كل المركبات', options: [], get: (j) => j.vehicle },
      { key: 'fillst', label: 'الامتلاء', all: 'كل الوظايف', options: [['zero', 'ملهاش ترشيحات'], ['open', 'لسه محتاجة'], ['full', 'مكتملة']], get: (j) => j._fill },
    ],
    onChange,
  });
  FX.fillOptions = (js) => {
    [['gov', (j) => j.gov], ['veh', (j) => j.vehicle]].forEach(([k, f]) => {
      const s = $(`[data-fx-dim=${k}]`); if (!s || s.options.length > 1) return;
      govOpts(js, f).forEach(([v]) => s.add(new Option(v, v))); s.value = FX.state.sel[k] || '';
    });
  };
  FX.draw = (rows, { apps = {}, hired = {} } = {}) => {
    const demand = rows.map((j) => ({ label: `${j.title || '—'} • ${compName(j.company_id, j.company_name)}`, v: j.code, value: apps[j.id] || 0, sub: j.region || '' })).filter((x) => x.value).sort((a, b) => b.value - a.value);
    const fill = rows.filter((j) => j.headcount).map((j) => { const h = hired[j.id] || 0; return { label: `${j.title || '—'} • ${compName(j.company_id, j.company_name)}`, v: j.code, value: Math.min(100, pct(h, j.headcount)), sub: `${h}/${j.headcount}`, tone: h >= j.headcount ? 'tn-g' : 'tn-b' }; }).sort((a, b) => b.value - a.value);
    const gov = sorted(countBy(rows, (j) => j.gov)).map(([g, v]) => ({ label: g, v: g, value: v }));
    const zero = rows.filter((j) => j._fill === 'zero').length;
    strip(FX, [
      card('🔥 الأكتر طلباً', hbars(demand, { k: 'q', active: FX.get('q'), limit: 6, tone: 'tn-1' }), { tools: zero ? `<button class="ax-badge" data-fx-k="fillst" data-fx-v="zero" ${tip('اعرض الوظايف اللي ملهاش ترشيحات')}>${zero} بدون ترشيحات</button>` : '' }),
      card('📦 نسبة الامتلاء', hbars(fill, { k: 'q', active: FX.get('q'), limit: 6, fmt: (v) => v + '%' })),
      card('🗺️ حسب المحافظة', hbars(gov, { k: 'gov', active: FX.get('gov'), limit: 6, tone: 'tn-o' })),
    ]);
  };
  return FX;
}

// Companies page has cards, not a table: the strip compares companies and clicking one narrows the cards.
export async function companiesFx({ S, onChange }) {
  initTip();
  const [cands, led] = await Promise.all([
    fetchAll(() => sb.from('candidates').select('id,company_id,status,created_at')),
    fetchAll(() => sb.from('bonus_ledger').select('amount,earned_on,reversed_at,candidate_id')),
  ]);
  const candCo = new Map(cands.map((c) => [c.id, c.company_id]));
  // The companies page has no filter row of its own; add one under the page header.
  let tools = $('.tools');
  if (!tools) { tools = document.createElement('div'); tools.className = 'tools'; $('#view .ph')?.after(tools); }
  const FX = filters('companies', {
    tools, date: (c) => c.created_at,
    dims: [{ key: 'co', label: 'الشركة', all: 'كل الشركات', options: compOpts(S), get: (c) => c.company_id || c.id },
      { key: 'act', label: 'الحالة', all: 'نشطة وموقوفة', options: [['1', 'نشطة'], ['0', 'موقوفة']], get: (c) => (c.active ? '1' : '0') }],
    onChange,
  });
  FX.draw = () => {
    const B = FX.bounds(), rows = cands.filter((c) => inBounds(B, c.created_at));
    const ui = FX.ui || (FX.ui = { m: 'nom' });
    const per = S.companies.map((co) => {
      const l = rows.filter((c) => c.company_id === co.id);
      const bonus = led.filter((x) => !x.reversed_at && candCo.get(x.candidate_id) === co.id && inBounds(B, x.earned_on)).reduce((a, x) => a + Number(x.amount), 0);
      return { co, nom: l.length, hired: l.filter((c) => c.status === 'hired').length, bonus };
    });
    const pick = { nom: (p) => p.nom, hired: (p) => p.hired, bonus: (p) => p.bonus }[ui.m];
    const items = per.map((p) => ({ label: p.co.name, v: p.co.id, value: pick(p), sub: ui.m === 'bonus' ? '' : `${pct(p.hired, p.nom)}% تعيين`, tipx: `ترشيحات ${p.nom} • اتعيّنوا ${p.hired} • بونص ${money(p.bonus)}` })).sort((a, b) => b.value - a.value);
    strip(FX, [card('🏢 مقارنة الشركات', `${seg('m', [['nom', 'ترشيحات'], ['hired', 'اتعيّنوا'], ['bonus', 'البونص المستحق']], ui.m)}${hbars(items, { k: 'co', active: FX.get('co'), fmt: ui.m === 'bonus' ? money : n0, limit: 12, tone: 'tn-1' })}`, { cls: 'span-all', note: 'الأرقام حسب الفترة المختارة. دوس على شركة عشان تعرض الكارت بتاعها بس.' })]);
    bind(FX.strip, (_, v) => { ui.m = v; FX.draw(); });
  };
  return FX;
}
