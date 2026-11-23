// Admin: bonus campaigns, monthly contests, partner quality score.
import { sb, $, $$, esc, money, fmtDate, today, toast, modal, confirmBox, errMsg, busy, GOVS, chip } from '../shared/common.js';

let C = {}; // { S, view, can, go, openProfile, flName, compName }
export const init = (ctx) => { C = ctx; };

const METRIC_AR = { hires: 'عدد التعيينات (أول يوم شغل)', nominations: 'عدد الترشيحات', completed: 'مناديب كمّلوا 26 يوم' };
const STATE_AR = { draft: ['مسودة', 'n'], upcoming: ['لسه مبدأتش', 'b'], live: ['شغالة', 'g'], ended: ['خلصت — مستنية تأكيد', 'a'], awarded: ['الجوايز اتوزعت', 'p'], cancelled: ['ملغية', 'r'] };
const SCOPE_AR = { all: 'كل المناديب', partner: 'شريك معيّن', gov: 'محافظة', company: 'شركة' };
const MEDAL = ['🥇', '🥈', '🥉'];
const stateOf = (k) => k.status === 'live' && today() > k.ends_on ? 'ended' : k.status === 'live' && today() < k.starts_on ? 'upcoming' : k.status;
// The server only accepts the award once its own date (UTC) is past the last day, so the button waits for that too.
const serverDay = () => new Date().toISOString().slice(0, 10);
const monthBounds = () => { const d = new Date(), y = d.getFullYear(), m = d.getMonth(); const p = (x) => String(x).padStart(2, '0'); return [`${y}-${p(m + 1)}-01`, `${y}-${p(m + 1)}-${p(new Date(y, m + 1, 0).getDate())}`]; };
const isOwner = () => C.S?.me?.role === 'owner';

// ------------------------------------------------------------------ quality score
export async function loadQuality(force = false) {
  if (C.S.quality && !force) return C.S.quality;
  const { data, error } = await sb.rpc('admin_partner_quality');
  C.S.quality = new Map((error ? [] : data || []).map((q) => [q.freelancer_id, q]));
  return C.S.quality;
}
export const qBand = (q) => !q ? 'new' : q.score >= 75 ? 'hi' : q.score >= 55 ? 'mid' : q.score >= 35 ? 'low' : 'bad';
export const Q_BANDS = [['hi', 'ممتاز (75+)'], ['mid', 'كويس (55–74)'], ['low', 'محتاج متابعة (35–54)'], ['bad', 'ضعيف (أقل من 35)'], ['new', 'جديد (من غير ترشيحات)']];
const Q_TONE = { hi: 'g', mid: 'b', low: 'a', bad: 'r', new: 'n' };
export function qualityTitle(q) {
  if (!q) return 'لسه مرشّحش حد';
  return `نسبة التوظيف ${q.p_hire}/35 · استمرار ${q.p_retention}/25 · رفض ${q.p_reject}/20 · ثقة ${q.p_trust}/10 · نشاط ${q.p_activity}/10`
    + ` — ${q.nominations} ترشيح، ${q.started} بدأوا، ${q.completed} كمّلوا، ${q.rejected} مرفوض${q.nominations < 3 ? ' (عينة صغيرة)' : ''}`;
}
export function qualityBadge(q) {
  const b = qBand(q);
  return `<span class="qbadge q-${b} chip ${Q_TONE[b]}" title="${esc(qualityTitle(q))}">${q ? `<b>${q.score}</b>` : 'جديد'}${q && q.nominations < 3 ? '<i>؟</i>' : ''}</span>`;
}
export function qualityDetail(q) {
  if (!q) return '<span class="muted small">لسه مرشّحش حد — مفيش تقييم.</span>';
  const bar = (t, v, max) => `<div class="qd-row"><span>${t}</span><div class="qd-bar"><i style="width:${Math.round(v / max * 100)}%"></i></div><b>${v}/${max}</b></div>`;
  return `<div class="qd">${bar('نسبة التوظيف', q.p_hire, 35)}${bar('استمرار', q.p_retention, 25)}${bar('قلة الرفض', q.p_reject, 20)}${bar('ثقة', q.p_trust, 10)}${bar('نشاط', q.p_activity, 10)}
    <div class="small muted">${q.nominations} ترشيح · ${q.started} بدأوا · ${q.completed} كمّلوا · ${q.rejected} مرفوض${q.self_nominated ? ` · ⚠️ رشّح نفسه ${q.self_nominated}` : ''}${q.quick_quits ? ` · ⚠️ ${q.quick_quits} سابوا قبل 7 أيام` : ''}</div></div>`;
}
export function qualityHelp() {
  modal(`<h2>⭐ تقييم جودة الشريك (من 100)</h2>
    <div class="qhelp">
      <p><b>نسبة التوظيف — 35:</b> نسبة المناديب اللي بدأوا شغل من ترشيحاته (من غير آخر 7 أيام عشان لسه بتتراجع).</p>
      <p><b>استمرار — 25:</b> نسبة اللي كمّلوا 26 يوم من اللي بدأوا وعدّى عليهم وقت كفاية (لو مفيش لسه = نص الدرجة).</p>
      <p><b>قلة الرفض — 20:</b> كل ما المرفوضين أقل الدرجة أعلى.</p>
      <p><b>ثقة — 10:</b> بتقل لو رشّح نفسه أو لو مناديبه بيسيبوا الشغل قبل 7 أيام.</p>
      <p><b>نشاط — 10:</b> آخر ترشيح خلال 14 يوم = 10، خلال 30 = 6، خلال 60 = 3.</p>
      <p class="muted">75+ ممتاز · 55–74 كويس · 35–54 محتاج متابعة · أقل من 35 ضعيف. علامة "؟" يعني أقل من 3 ترشيحات فالرقم لسه مش دقيق.</p>
    </div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn pri" data-close>تمام</button></div>`);
}

// ------------------------------------------------------------------ page
export async function growth() {
  const { S, view, can } = C;
  const tab = S.growthTab || 'camp';
  const [kR, cR, stR] = await Promise.all([
    sb.from('bonus_campaigns').select('*').order('created_at', { ascending: false }),
    sb.from('contests').select('*').order('starts_on', { ascending: false }),
    sb.rpc('admin_campaign_stats'),
  ]);
  if (kR.error) throw kR.error;
  if (cR.error) throw cR.error;
  const stats = new Map((stR.data || []).map((x) => [x.campaign_id, x]));
  const camps = kR.data || [], cons = cR.data || [];
  const edit = can('companies');
  view(`
    <div class="ph"><h1>🏆 الحملات والمسابقات</h1>
      <div class="row">${edit ? `<button class="btn pri" data-new>${tab === 'camp' ? '➕ حملة بونص جديدة' : '➕ مسابقة جديدة'}</button>` : ''}</div></div>
    <div class="tabs" role="tablist"><button role="tab" data-gt="camp" class="${tab === 'camp' ? 'on' : ''}">🎯 حملات البونص (${camps.length})</button><button role="tab" data-gt="con" class="${tab === 'con' ? 'on' : ''}">🏆 المسابقات (${cons.length})</button></div>
    <div id="gbody"></div>`);
  $$('[data-gt]').forEach((b) => b.onclick = () => { S.growthTab = b.dataset.gt; C.go('growth'); });
  const host = $('#gbody');
  if (tab === 'camp') {
    host.innerHTML = `<p class="small muted">مبلغ ثابت زيادة على كل مندوب اترشّح جوه فترة الحملة ووصل للشرط. بيتحسب لوحده (مع كل تحديث للمندوب وكل ليلة) وبيظهر للشريك في المحفظة "🎯 بونص حملة".</p>
      <div class="gcards">${camps.map((k) => campCard(k, stats.get(k.id), edit)).join('') || '<div class="card empty">مفيش حملات لسه — اعمل أول حملة وحمّس الشركاء 🎯</div>'}</div>`;
    $$('[data-ked]', host).forEach((b) => b.onclick = () => campaignForm(camps.find((k) => k.id === b.dataset.ked)));
    $$('[data-kapply]', host).forEach((b) => b.onclick = () => busy(b, async () => {
      const { data, error } = await sb.rpc('admin_apply_campaign', { p_id: b.dataset.kapply });
      if (error) return toast(errMsg(error), 'bad');
      toast(data ? `اتضاف ${data} بونص حملة جديد ✅` : 'مفيش مناديب جدد وصلوا للشرط', 'ok'); C.go('growth');
    }));
    $$('[data-ktog]', host).forEach((b) => b.onclick = () => busy(b, async () => {
      const k = camps.find((x) => x.id === b.dataset.ktog);
      if (k.active && !(await confirmBox('إيقاف الحملة', 'مفيش بونص حملة جديد هيتضاف. اللي اتضاف قبل كده بيفضل زي ما هو.', 'إيقاف'))) return;
      const { error } = await sb.from('bonus_campaigns').update({ active: !k.active }).eq('id', k.id);
      if (error) return toast(errMsg(error), 'bad'); C.go('growth');
    }));
  } else {
    host.innerHTML = `<p class="small muted">الشركاء بيشوفوا الترتيب الحي في التطبيق (أسماء الباقيين مختصرة). لما المسابقة تخلص، المالك بيراجع الترتيب ويستبعد أي حد مشكوك فيه، وبعدها الجوايز تتضاف للمحافظ — مفيش توزيع أوتوماتيك.</p>
      <div class="gcards">${cons.map((k) => contestCard(k, edit)).join('') || '<div class="card empty">مفيش مسابقات لسه — اعمل مسابقة الشهر 🏆</div>'}</div>`;
    $$('[data-ced]', host).forEach((b) => b.onclick = () => contestForm(cons.find((k) => k.id === b.dataset.ced)));
    $$('[data-crank]', host).forEach((b) => b.onclick = () => rankingModal(cons.find((k) => k.id === b.dataset.crank)));
    $$('[data-cset]', host).forEach((b) => b.onclick = () => busy(b, async () => {
      const [id, st] = b.dataset.cset.split(':');
      if (st === 'cancelled' && !(await confirmBox('إلغاء المسابقة', 'الشركاء مش هيشوفوها تاني ومفيش جوايز هتتوزع.', 'إلغاء المسابقة'))) return;
      const { error } = await sb.from('contests').update({ status: st }).eq('id', id);
      if (error) return toast(errMsg(error), 'bad'); toast(st === 'live' ? 'المسابقة اتنشرت للشركاء 🚀' : 'تم', 'ok'); C.go('growth');
    }));
  }
  const nb = $('[data-new]'); if (nb) nb.onclick = () => (tab === 'camp' ? campaignForm(null) : contestForm(null));
}

function scopeLabel(k) {
  if (k.scope === 'partner') return `الشريك: ${C.flName(k.scope_value)}`;
  if (k.scope === 'company') return `شركة ${C.compName(k.scope_value)}`;
  if (k.scope === 'gov') return `مناديب ${k.scope_value}`;
  return 'كل المناديب';
}
function campCard(k, st, edit) {
  const running = k.active && today() >= k.starts_on && today() <= k.ends_on;
  const state = !k.active ? ['متوقفة', 'r'] : today() < k.starts_on ? ['لسه مبدأتش', 'b'] : today() > k.ends_on ? ['خلصت (الترشيح)', 'n'] : ['شغالة', 'g'];
  return `<div class="card gcard ${running ? 'on' : ''}">
    <div class="gcard-h"><b>🎯 ${esc(k.name)}</b><span class="chip ${state[1]}">${state[0]}</span></div>
    <div class="gcard-amt">+${money(k.amount)} <small>لكل مندوب</small></div>
    <div class="small gcard-meta"><span>👥 ${esc(scopeLabel(k))}</span><span>📅 ${fmtDate(k.starts_on)} ← ${fmtDate(k.ends_on)}</span><span>✅ ${k.trigger_kind === 'paper' ? 'بعد الورق' : `بعد ${k.min_days} يوم شغل`}</span></div>
    ${k.note ? `<div class="small muted">${esc(k.note)}</div>` : ''}
    <div class="gcard-st"><div><span>مؤهلين</span><b>${st?.eligible ?? '—'}</b></div><div><span>اتصرف لهم</span><b>${st?.earned_rows ?? 0}</b></div><div><span>التكلفة لحد دلوقتي</span><b>${money(st?.earned_amount)}</b></div></div>
    ${edit ? `<div class="row"><button class="btn sec sm" data-ked="${k.id}">✏️ تعديل</button><button class="btn sec sm" data-kapply="${k.id}" title="يحسب الحملة على المناديب الموجودين دلوقتي">🔄 احسب دلوقتي</button><button class="btn ${k.active ? 'dan' : 'pri'} sm" data-ktog="${k.id}">${k.active ? '⏸️ إيقاف' : '▶️ تشغيل'}</button></div>` : ''}
  </div>`;
}
function contestCard(k, edit) {
  const st = stateOf(k), [t, tone] = STATE_AR[st] || [st, 'n'];
  const prizes = (k.prizes || []).filter((p) => Number(p.amount) > 0).sort((a, b) => a.rank - b.rank);
  return `<div class="card gcard ${st === 'live' ? 'on' : ''}">
    <div class="gcard-h"><b>🏆 ${esc(k.title)}</b><span class="chip ${tone}">${t}</span></div>
    <div class="small gcard-meta"><span>📊 ${METRIC_AR[k.metric]}</span><span>📅 ${fmtDate(k.starts_on)} ← ${fmtDate(k.ends_on)}</span>${k.scope_gov ? `<span>📍 ${esc(k.scope_gov)}</span>` : ''}${k.scope_company ? `<span>🏢 ${esc(C.compName(k.scope_company))}</span>` : ''}</div>
    <div class="gprizes">${prizes.map((p) => `<span>${MEDAL[p.rank - 1] || '#' + p.rank} ${money(p.amount)}</span>`).join('') || '<span class="muted">من غير جوايز فلوس</span>'}</div>
    <div class="row">
      <button class="btn ${st === 'ended' && serverDay() > k.ends_on && isOwner() ? 'pri' : 'sec'} sm" data-crank="${k.id}">${st === 'ended' && serverDay() > k.ends_on && isOwner() ? '✅ راجع وأكّد الفائزين' : '📊 الترتيب'}</button>
      ${edit && ['draft', 'live'].includes(k.status) ? `<button class="btn sec sm" data-ced="${k.id}">✏️ تعديل</button>` : ''}
      ${edit && k.status === 'draft' ? `<button class="btn pri sm" data-cset="${k.id}:live">🚀 انشرها للشركاء</button>` : ''}
      ${edit && ['draft', 'live'].includes(k.status) ? `<button class="btn ghost sm" data-cset="${k.id}:cancelled">إلغاء</button>` : ''}
    </div>
  </div>`;
}

// ------------------------------------------------------------------ forms
function campaignForm(k) {
  const { S } = C;
  const [, m2] = monthBounds();
  // The campaign's current partner/governorate must always be in its list, or the browser silently picks the
  // first option and saving moves the campaign (and its bonus) to someone else.
  const fls = S.fl.filter((f) => !f.duplicate_of && (f.status === 'Active' || (k?.scope === 'partner' && f.id === k.scope_value)))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const govs = k?.scope === 'gov' && k.scope_value && !GOVS.includes(k.scope_value) ? [k.scope_value, ...GOVS] : GOVS;
  const flSt = (f) => (f.status === 'Active' ? '' : ` (${f.status === 'Inactive' ? 'موقوف' : f.status === 'Hold' ? 'معلّق' : 'قيد المراجعة'})`);
  const m = modal(`<h2>${k ? 'تعديل حملة' : '🎯 حملة بونص جديدة'}</h2>
    <form class="stack">
      <div class="grid2"><div><label class="f">اسم الحملة (بيظهر للشريك)</label><input class="in" name="name" required maxlength="80" value="${esc(k?.name || '')}" placeholder="مثال: حملة نون القاهرة"></div>
        <div><label class="f">المبلغ الزيادة لكل مندوب (ج.م)</label><input class="in" name="amount" type="number" min="1" max="100000" required value="${k?.amount ?? ''}" placeholder="200"></div></div>
      <div class="grid2"><div><label class="f">لمين؟</label><select class="in" name="scope">${Object.entries(SCOPE_AR).map(([v, t]) => `<option value="${v}" ${k?.scope === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div data-sv><label class="f">اختار</label>
          <select class="in" name="sv_partner">${k?.scope !== 'partner' ? '<option value="">اختار الشريك…</option>' : ''}${fls.map((f) => `<option value="${f.id}" ${k?.scope_value === f.id ? 'selected' : ''}>${esc(f.name)}${flSt(f)} — 0${esc(f.mobile)}</option>`).join('')}</select>
          <select class="in" name="sv_gov">${govs.map((g) => `<option ${k?.scope_value === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>
          <select class="in" name="sv_company">${S.companies.map((c) => `<option value="${c.id}" ${k?.scope_value === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div></div>
      <div class="grid2"><div><label class="f">المناديب اللي اترشّحوا من</label><input class="in" type="date" name="starts" required value="${k?.starts_on || today()}"></div>
        <div><label class="f">لحد</label><input class="in" type="date" name="ends" required value="${k?.ends_on || m2}"></div></div>
      <div class="grid2"><div><label class="f">البونص بيتصرف</label><select class="in" name="trig"><option value="days" ${k?.trigger_kind !== 'paper' ? 'selected' : ''}>بعد عدد أيام شغل</option><option value="paper" ${k?.trigger_kind === 'paper' ? 'selected' : ''}>بعد ما يخلّص الورق</option></select></div>
        <div data-md><label class="f">عدد الأيام</label><input class="in" type="number" name="days" min="1" max="365" value="${k?.min_days ?? 26}"></div></div>
      <div><label class="f">ملاحظة للشركاء (اختياري)</label><input class="in" name="note" maxlength="200" value="${esc(k?.note || '')}"></div>
      <p class="small muted" style="margin:0">💡 الحملة بتشمل المناديب اللي اترشّحوا جوه الفترة بس، حتى لو وصلوا للشرط بعدها. المبلغ بيتضاف مرة واحدة لكل مندوب.</p>
      <div class="err" data-err></div>
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn sec" data-close>إلغاء</button><button class="btn pri">${k ? 'حفظ' : 'إطلاق الحملة'}</button></div>
    </form>`);
  const f = $('form', m.el);
  const sync = () => {
    const sc = f.scope.value;
    $('[data-sv]', f).hidden = sc === 'all';
    ['partner', 'gov', 'company'].forEach((x) => { f['sv_' + x].hidden = sc !== x; });
    $('[data-md]', f).hidden = f.trig.value === 'paper';
  };
  f.scope.onchange = f.trig.onchange = sync; sync();
  f.onsubmit = (e) => {
    e.preventDefault();
    const sc = f.scope.value;
    const rec = {
      name: f.name.value.trim(), amount: Number(f.amount.value), scope: sc, scope_value: sc === 'all' ? null : f['sv_' + sc].value,
      starts_on: f.starts.value, ends_on: f.ends.value, trigger_kind: f.trig.value, min_days: Number(f.days.value) || 26, note: f.note.value.trim() || null,
    };
    if (rec.ends_on < rec.starts_on) return ($('[data-err]', f).textContent = 'تاريخ النهاية قبل البداية');
    if (sc !== 'all' && !rec.scope_value) return ($('[data-err]', f).textContent = 'اختار الحملة لمين');
    // Changing who an existing campaign pays is a deliberate act: ask before saving it.
    if (k && (sc !== k.scope || (rec.scope_value ?? null) !== (k.scope_value ?? null)) && !f.dataset.scopeOk) {
      f.dataset.scopeOk = '1';
      return ($('[data-err]', f).textContent = `انتبه: الحملة هتتنقل من "${scopeLabel(k)}" لـ "${scopeLabel(rec)}". دوس حفظ تاني للتأكيد.`);
    }
    busy($('button.pri', f), async () => {
      const q = k ? sb.from('bonus_campaigns').update(rec).eq('id', k.id).select('id').single() : sb.from('bonus_campaigns').insert(rec).select('id').single();
      const { data, error } = await q;
      if (error) return ($('[data-err]', f).textContent = errMsg(error));
      const ap = await sb.rpc('admin_apply_campaign', { p_id: data.id });
      m.close(); toast(`${k ? 'الحملة اتعدّلت' : 'الحملة اشتغلت 🎯'}${ap.data ? ` — واتضاف ${ap.data} بونص لمناديب وصلوا للشرط` : ''}`, 'ok'); C.go('growth');
    });
  };
}

function contestForm(k) {
  const { S } = C;
  const [m1, m2] = monthBounds();
  const prizes = k?.prizes?.length ? [...k.prizes].sort((a, b) => a.rank - b.rank) : [{ rank: 1, amount: 2000 }, { rank: 2, amount: 1000 }, { rank: 3, amount: 500 }];
  const m = modal(`<h2>${k ? 'تعديل مسابقة' : '🏆 مسابقة جديدة'}</h2>
    <form class="stack">
      <div><label class="f">العنوان (بيظهر للشركاء)</label><input class="in" name="title" required maxlength="100" value="${esc(k?.title || '')}" placeholder="مثال: بطل شهر ديسمبر"></div>
      <div class="grid2"><div><label class="f">بنعدّ إيه؟</label><select class="in" name="metric">${Object.entries(METRIC_AR).map(([v, t]) => `<option value="${v}" ${k?.metric === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div><label class="f">الحالة</label><select class="in" name="status"><option value="draft" ${k?.status !== 'live' ? 'selected' : ''}>مسودة (مش ظاهرة)</option><option value="live" ${k?.status === 'live' ? 'selected' : ''}>منشورة للشركاء</option></select></div></div>
      <div class="grid2"><div><label class="f">من</label><input class="in" type="date" name="starts" required value="${k?.starts_on || m1}"></div><div><label class="f">لحد</label><input class="in" type="date" name="ends" required value="${k?.ends_on || m2}"></div></div>
      <div class="grid2"><div><label class="f">محافظة (اختياري)</label><select class="in" name="gov"><option value="">كل المحافظات</option>${GOVS.map((g) => `<option ${k?.scope_gov === g ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
        <div><label class="f">شركة (اختياري)</label><select class="in" name="co"><option value="">كل الشركات</option>${S.companies.map((c) => `<option value="${c.id}" ${k?.scope_company === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div></div>
      <div><label class="f">الجوايز</label><div class="prz" data-prz>${prizes.map((p, i) => prizeRow(i + 1, p.amount)).join('')}</div>
        <button type="button" class="btn ghost sm" data-addp>➕ مركز كمان</button></div>
      <div><label class="f">ملاحظة (اختياري)</label><input class="in" name="note" maxlength="200" value="${esc(k?.note || '')}"></div>
      <div class="err" data-err></div>
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn sec" data-close>إلغاء</button><button class="btn pri">${k ? 'حفظ' : 'حفظ المسابقة'}</button></div>
    </form>`);
  const f = $('form', m.el), box = $('[data-prz]', f);
  const renum = () => $$('.prz-row', box).forEach((r, i) => { $('.prz-rk', r).textContent = MEDAL[i] || '#' + (i + 1); });
  const bindRm = () => $$('[data-rmp]', box).forEach((b) => b.onclick = () => { b.closest('.prz-row').remove(); renum(); });
  bindRm();
  $('[data-addp]', f).onclick = () => { const n = $$('.prz-row', box).length + 1; if (n > 10) return; box.insertAdjacentHTML('beforeend', prizeRow(n, '')); bindRm(); };
  f.onsubmit = (e) => {
    e.preventDefault();
    const pz = $$('.prz-row input', box).map((x, i) => ({ rank: i + 1, amount: Number(x.value) || 0 }));
    const rec = { title: f.title.value.trim(), metric: f.metric.value, status: f.status.value, starts_on: f.starts.value, ends_on: f.ends.value,
      scope_gov: f.gov.value || null, scope_company: f.co.value || null, prizes: pz, note: f.note.value.trim() || null };
    if (rec.ends_on < rec.starts_on) return ($('[data-err]', f).textContent = 'تاريخ النهاية قبل البداية');
    busy($('button.pri', f), async () => {
      const { error } = k ? await sb.from('contests').update(rec).eq('id', k.id) : await sb.from('contests').insert(rec);
      if (error) return ($('[data-err]', f).textContent = errMsg(error));
      m.close(); toast(rec.status === 'live' ? 'المسابقة منشورة للشركاء 🚀' : 'اتحفظت كمسودة', 'ok'); C.S.growthTab = 'con'; C.go('growth');
    });
  };
}
const prizeRow = (n, amt) => `<div class="prz-row"><span class="prz-rk">${MEDAL[n - 1] || '#' + n}</span><input class="in" type="number" min="0" step="50" value="${amt}" placeholder="المبلغ ج.م"><button type="button" class="btn ghost sm" data-rmp aria-label="شيل">✕</button></div>`;

// ------------------------------------------------------------------ ranking / award
async function rankingModal(k) {
  const m = modal(`<h2>📊 ${esc(k.title)}</h2><div class="spin"></div>`, 'wide');
  const { data, error } = await sb.rpc('admin_contest_ranking', { p_contest: k.id });
  if (!m.el.isConnected) return;
  const body = $('.modal', m.el);
  if (error) { body.innerHTML = `<h2>📊 ${esc(k.title)}</h2><div class="empty">${esc(errMsg(error))}</div><div class="row" style="justify-content:flex-end"><button class="btn sec" data-close2>قفل</button></div>`; $('[data-close2]', body).onclick = m.close; return; }
  const st = stateOf(k), canAward = st === 'ended' && serverDay() > k.ends_on && isOwner();
  const prizes = new Map((k.prizes || []).map((p) => [Number(p.rank), Number(p.amount) || 0]));
  const Q = await loadQuality();
  const rows = data || [];
  let ex = new Set();
  const draw = () => {
    let pos = 0;
    return rows.map((r) => {
      const out = canAward ? ex.has(r.freelancer_id) : r.excluded;
      const place = out ? null : ++pos;
      const prize = k.status === 'awarded' ? r.amount : place ? prizes.get(place) : 0;
      return `<tr class="${out ? 'ex' : ''}"><td><b>${place ? (MEDAL[place - 1] || place) : '—'}</b></td>
        <td><button class="lnk" data-fl="${r.freelancer_id}"><b data-noi18n>${esc(r.name)}</b></button><div class="small muted">${esc(r.gov || '')}</div></td>
        <td>${qualityBadge(Q.get(r.freelancer_id))}</td><td><b>${r.score}</b></td><td>${prize ? money(prize) : '—'}</td>
        ${canAward ? `<td><label class="small row" style="gap:4px"><input type="checkbox" data-ex="${r.freelancer_id}" ${ex.has(r.freelancer_id) ? 'checked' : ''}> استبعاد</label>
          <input class="in sm" data-why="${r.freelancer_id}" placeholder="السبب" ${ex.has(r.freelancer_id) ? '' : 'hidden'}></td>` : r.excluded ? `<td class="small muted">مستبعد: ${esc(r.exclude_reason || '')}</td>` : '<td></td>'}</tr>`;
    }).join('') || `<tr><td colspan="6" class="empty">مفيش نتايج لسه</td></tr>`;
  };
  body.innerHTML = `<h2>📊 ${esc(k.title)} <span class="chip ${(STATE_AR[st] || [])[1] || 'n'}">${(STATE_AR[st] || [st])[0]}</span></h2>
    <p class="small muted" style="margin-top:-6px">${METRIC_AR[k.metric]} · ${fmtDate(k.starts_on)} ← ${fmtDate(k.ends_on)}. التعادل بيكسبه اللي وصل للرقم الأول.</p>
    <div class="tw"><table class="t"><thead><tr><th>المركز</th><th>الشريك</th><th>الجودة</th><th>النتيجة</th><th>الجايزة</th><th></th></tr></thead><tbody data-rk>${draw()}</tbody></table></div>
    ${canAward ? '<p class="small" style="margin:10px 0 0">⚠️ بعد التأكيد الجوايز بتتضاف لمحافظ الفائزين ويوصلهم إشعار، ومش هينفع تعدّل المسابقة تاني.</p>' : st === 'ended' ? '<p class="small muted">المالك بس اللي يقدر يأكّد الفائزين.</p>' : ''}
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" data-close2>قفل</button>${canAward ? '<button class="btn pri" data-award>✅ تأكيد الفائزين وتوزيع الجوايز</button>' : ''}</div>`;
  const tb = $('[data-rk]', body);
  const bind = () => {
    $$('[data-fl]', tb).forEach((b) => b.onclick = () => { m.close(); C.openProfile(b.dataset.fl); });
    // Excluding someone re-numbers the places and prizes below them.
    $$('[data-ex]', tb).forEach((c) => c.onchange = () => {
      const why = {}; $$('[data-why]', tb).forEach((i) => { why[i.dataset.why] = i.value; });
      ex = new Set($$('[data-ex]:checked', tb).map((x) => x.dataset.ex));
      tb.innerHTML = draw();
      $$('[data-why]', tb).forEach((i) => { i.value = why[i.dataset.why] || ''; });
      $(`[data-why="${c.dataset.ex}"]`, tb)?.focus();
      bind();
    });
  };
  bind();
  $('[data-close2]', body).onclick = m.close;
  const aw = $('[data-award]', body);
  if (aw) aw.onclick = async () => {
    const exclude = $$('[data-ex]:checked', tb).map((x) => ({ freelancer_id: x.dataset.ex, reason: ($(`[data-why="${x.dataset.ex}"]`, tb)?.value || '').trim() }));
    if (exclude.some((x) => !x.reason)) return toast('اكتب سبب لكل استبعاد', 'bad');
    const paid = rows.filter((r) => !exclude.some((x) => x.freelancer_id === r.freelancer_id)).map((r, i) => prizes.get(i + 1) || 0).filter((a) => a > 0);
    const winners = paid, total = paid.reduce((a, b) => a + b, 0);
    if (!(await confirmBox('تأكيد الفائزين', `هيتضاف ${money(total)} لـ ${winners.length} شريك${exclude.length ? ` واستبعاد ${exclude.length}` : ''}. مش هينفع ترجع فيها من هنا.`, 'تأكيد وتوزيع', false))) return;
    busy(aw, async () => {
      const { data: n, error: e2 } = await sb.rpc('admin_award_contest', { p_contest: k.id, p_exclude: exclude });
      if (e2) return toast(errMsg(e2), 'bad');
      m.close(); toast(`الجوايز اتوزعت على ${n} شريك 🏆`, 'ok'); C.S.growthTab = 'con'; C.go('growth');
    });
  };
}
