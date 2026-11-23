// Automation rules card (Settings) + withdrawal transfer receipts.
// Kept in its own module so admin.js only needs small hooks.
import { sb, $, $$, esc, toast, modal, errMsg, busy, money } from '../shared/common.js';

export const AUTO_DEF = { close_jobs: true, stall_on: true, stall_days: 5, stall_statuses: ['new', 'submitted'], stale_days: 3 };
export const autoCfg = (S) => ({ ...AUTO_DEF, ...(S.settings?.automation?.value || {}) });
export const staleDays = (S) => Math.max(1, Number(autoCfg(S).stale_days) || 3);

const ACT_AR = { run: '🔄 تشغيل', job_closed: '🔒 قفل وظيفة', stall_reminder: '🔔 تذكير شريك' };
const WHY_AR = { expired: 'تاريخها خلص', full: 'العدد اكتمل' };
const ST_AR = { new: 'مرشح جديد', submitted: 'تحت المراجعة' };
const when = (t) => new Date(t).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function logLine(l) {
  const d = l.detail || {};
  if (l.action === 'run') {
    return `${d.manual ? '👆 تشغيل يدوي' : '⏱️ تشغيل تلقائي'} — اتقفل ${d.closed ?? 0} وظيفة، اتبعت ${d.reminded ?? 0} تذكير، ${d.stale ?? 0} ترشيح متأخر${d.by ? ` <span class="muted">(${esc(d.by)})</span>` : ''}`;
  }
  if (l.action === 'job_closed') return `قفل الوظيفة <b class="mono">${esc(d.code || '')}</b> — ${WHY_AR[d.why] || esc(d.why || '')}${d.why === 'full' ? ` (${d.hired}/${d.headcount})` : ''}`;
  if (l.action === 'stall_reminder') return `تذكير بخصوص <b data-noi18n>${esc(d.name || '')}</b> — ${ST_AR[d.status] || esc(d.status || '')} بقاله ${d.days ?? '?'} يوم`;
  return esc(l.action);
}

// Card markup; the log is filled in by bindAutomation().
export function automationCard(S, upd) {
  const c = autoCfg(S);
  const sts = new Set(c.stall_statuses || []);
  return `<form class="card stack set-wide auto-card" data-s="automation">
    <div class="set-h"><h3>⚙️ القواعد التلقائية</h3>${upd('automation')}</div>
    <p class="small muted" style="margin:0">السيستم بيشغّل القواعد دي لوحده كل ساعة. كل حاجة بيعملها بتتسجّل تحت.</p>
    <div class="auto-grid">
      <label class="sw"><input type="checkbox" name="close_jobs" ${c.close_jobs ? 'checked' : ''}><span><b>🔒 قفل الوظايف أوتوماتيك</b>
        <span class="small muted">الوظيفة بتتقفل لما تاريخ انتهائها يعدّي أو عدد المتعيّنين يوصل للعدد المطلوب. لو فتحتها تاني بإيدك مش هيقفلها تاني.</span></span></label>
      <div class="sw auto-stall"><input type="checkbox" name="stall_on" ${c.stall_on ? 'checked' : ''} aria-label="تذكير الشريك بالمناديب الواقفين"><span><b>🔔 تذكير الشريك بالمندوب الواقف</b>
        <span class="small muted">لو المندوب مفيش عليه أي تغيير بقاله <input class="in auto-num" type="number" name="stall_days" min="1" max="60" value="${Number(c.stall_days) || 5}"> يوم، الشريك بيوصله إشعار يتابع معاه (مرة واحدة كل الفترة دي لكل مندوب).</span>
        <span class="row auto-sts small">الحالات: <label><input type="checkbox" name="st_new" ${sts.has('new') ? 'checked' : ''}> مرشح جديد</label><label><input type="checkbox" name="st_submitted" ${sts.has('submitted') ? 'checked' : ''}> تحت المراجعة</label></span></span></div>
      <div class="sw"><span style="margin-top:2px">⏰</span><span><b>علامة الترشيحات المتأخرة على الإدارة</b>
        <span class="small muted">الترشيح اللي "تحت المراجعة" أكتر من <input class="in auto-num" type="number" name="stale_days" min="1" max="60" value="${Number(c.stale_days) || 3}"> يوم بيظهر كمتأخر في لوحة المؤشرات وعلى أيقونة المناديب وفي التقرير اليومي.</span></span></div>
    </div>
    <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
      <button type="button" class="btn sec sm" data-auto-run>▶️ شغّل دلوقتي</button>
      <button class="btn pri">حفظ القواعد</button>
    </div>
    <div class="auto-log" data-auto-log><div class="small muted">بنحمّل السجل…</div></div>
  </form>`;
}

export async function loadAutoLog(host) {
  const { data, error } = await sb.from('automation_log').select('id,at,action,detail').order('id', { ascending: false }).limit(60);
  if (error) { host.innerHTML = `<div class="small muted">${esc(errMsg(error))}</div>`; return; }
  const rows = data || [];
  const last = rows.find((r) => r.action === 'run');
  const acts = rows.filter((r) => r.action !== 'run').slice(0, 20);
  const runs = rows.filter((r) => r.action === 'run').slice(0, 5);
  host.innerHTML = `
    <div class="auto-last">${last ? `آخر تشغيل: <b>${when(last.at)}</b> — اتقفل <b>${last.detail?.closed ?? 0}</b> وظيفة • <b>${last.detail?.reminded ?? 0}</b> تذكير • <b>${last.detail?.stale ?? 0}</b> ترشيح متأخر` : 'لسه ماشتغلش — أول تشغيل خلال ساعة، أو دوس "شغّل دلوقتي".'}</div>
    <div class="auto-cols">
      <div><div class="auto-h">آخر الإجراءات</div>${acts.length ? `<ul class="auto-ul">${acts.map((l) => `<li><span class="chip n">${ACT_AR[l.action] || esc(l.action)}</span> ${logLine(l)} <span class="small muted mono">${when(l.at)}</span></li>`).join('')}</ul>` : '<div class="small muted">مفيش إجراءات لسه.</div>'}</div>
      <div><div class="auto-h">آخر مرات التشغيل</div>${runs.length ? `<ul class="auto-ul">${runs.map((l) => `<li>${logLine(l)} <span class="small muted mono">${when(l.at)}</span></li>`).join('')}</ul>` : '<div class="small muted">—</div>'}</div>
    </div>`;
}

// save(form, key, value) is the settings page's shared saver.
export function bindAutomation(form, save, canRun) {
  const log = $('[data-auto-log]', form);
  loadAutoLog(log);
  form.onsubmit = (e) => {
    e.preventDefault();
    const n = (k, d) => Math.max(1, Math.min(60, Math.round(Number(form[k].value) || d)));
    const st = [form.st_new.checked && 'new', form.st_submitted.checked && 'submitted'].filter(Boolean);
    if (form.stall_on.checked && !st.length) return toast('اختار حالة واحدة على الأقل للتذكير', 'bad');
    save(form, 'automation', { close_jobs: form.close_jobs.checked, stall_on: form.stall_on.checked, stall_days: n('stall_days', 5), stall_statuses: st, stale_days: n('stale_days', 3) });
  };
  const run = $('[data-auto-run]', form);
  if (!canRun) { run.hidden = true; return; }
  run.onclick = () => busy(run, async () => {
    const { data, error } = await sb.rpc('admin_run_automation');
    if (error) return toast(errMsg(error), 'bad');
    toast(`اتشغّل ✅ — اتقفل ${data?.closed ?? 0} وظيفة، اتبعت ${data?.reminded ?? 0} تذكير`, 'ok');
    loadAutoLog(log);
  });
}

// ------------------------------------------------------------------ receipts
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'application/pdf': 'pdf' };
const extOf = (file) => EXT[file.type] || (/\.(jpe?g|png|webp|heic|pdf)$/i.exec(file.name)?.[1] || '').toLowerCase().replace('jpeg', 'jpg');

export async function uploadReceipt(w, file) {
  const ext = extOf(file);
  if (!ext) throw new Error('الملف لازم يكون صورة أو PDF');
  if (file.size > 10 * 1024 * 1024) throw new Error('الملف أكبر من 10 ميجا');
  const path = `${w.freelancer_id}/${w.id}.${ext}`;
  const { error: e1 } = await sb.storage.from('receipts').upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (e1) throw e1;
  const { error: e2 } = await sb.rpc('admin_set_withdrawal_receipt', { p_id: w.id, p_path: path });
  if (e2) throw e2;
  return path;
}

const fileField = `<label class="rc-drop"><input type="file" accept="image/*,application/pdf" data-rcf>
  <span>📎 <b>ارفع إيصال التحويل</b><span class="small muted" data-rcn>صورة أو PDF — الشريك هيشوفه في المحفظة</span></span></label>`;
const bindFile = (el) => { const f = $('[data-rcf]', el); f.onchange = () => { $('[data-rcn]', el).textContent = f.files[0] ? f.files[0].name : ''; }; return f; };

// "Mark paid" dialog with an optional receipt. Resolves true when the status changed.
export function paidDialog(w, who, setStatus) {
  return new Promise((resolve) => {
    const m = modal(`<h2>✅ تأكيد التحويل</h2>
      <p class="muted" style="margin-top:0">تم تحويل <b>${money(w.amount)}</b> لـ <b data-noi18n>${esc(who)}</b> على <span class="mono">${esc(w.details || '')}</span>؟</p>
      ${fileField}
      <div class="err" data-err></div>
      <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn sec" data-no>إلغاء</button><button class="btn pri" data-yes>تم التحويل</button></div>`);
    const f = bindFile(m.el);
    let done = false, inFlight = false;
    const close = (v) => { if (done || inFlight) return; done = true; m.close(); resolve(v); };
    $('[data-no]', m.el).onclick = () => close(false);
    m.el.addEventListener('click', (e) => { if (e.target === m.el) close(false); });
    $('[data-yes]', m.el).onclick = (e) => busy(e.target, async () => {
      const err = $('[data-err]', m.el); err.textContent = '';
      // Once "paid" is sent it can't be cancelled from here: lock the dialog until the server answers.
      inFlight = true; m.lock(true);
      try { await setStatus(); } catch (x) { err.textContent = errMsg(x); return; }
      finally { inFlight = false; m.lock(false); }
      if (f.files[0]) {
        try { await uploadReceipt({ ...w, status: 'paid' }, f.files[0]); toast('اتحوّل واتحفظ الإيصال 🧾', 'ok'); }
        catch (x) { toast(`اتعلّم "تم التحويل" بس الإيصال ماترفعش: ${errMsg(x)} — تقدر ترفعه من زرار 🧾`, 'bad'); }
      } else toast('تم ✅', 'ok');
      close(true);
    });
  });
}

// View / attach / replace a receipt later. Resolves true if something was uploaded.
export function receiptDialog(w, who, canEdit) {
  return new Promise((resolve) => {
    const m = modal(`<h2>🧾 إيصال التحويل</h2>
      <p class="small muted" style="margin-top:0">${esc(who)} • ${money(w.amount)}</p>
      <div class="rc-prev" data-prev>${w.receipt_path ? '<div class="spin"></div>' : '<div class="small muted">مفيش إيصال مرفوع لسه.</div>'}</div>
      ${canEdit ? fileField : ''}
      <div class="err" data-err></div>
      <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn sec" data-close>قفل</button>${canEdit ? `<button class="btn pri" data-up>${w.receipt_path ? 'استبدال الإيصال' : 'رفع الإيصال'}</button>` : ''}</div>`);
    let changed = false;
    const done = () => resolve(changed);
    $$('[data-close]', m.el).forEach((b) => b.addEventListener('click', done));
    m.el.addEventListener('click', (e) => { if (e.target === m.el) done(); });
    if (w.receipt_path) showReceipt($('[data-prev]', m.el), w.receipt_path);
    if (!canEdit) return;
    const f = bindFile(m.el);
    $('[data-up]', m.el).onclick = (e) => busy(e.target, async () => {
      if (!f.files[0]) return ($('[data-err]', m.el).textContent = 'اختار الملف الأول');
      try { w.receipt_path = await uploadReceipt(w, f.files[0]); changed = true; toast('الإيصال اتحفظ 🧾', 'ok'); m.close(); done(); }
      catch (x) { $('[data-err]', m.el).textContent = errMsg(x); }
    });
  });
}

async function showReceipt(host, path) {
  const { data, error } = await sb.storage.from('receipts').createSignedUrl(path, 600);
  if (error || !data?.signedUrl) { host.innerHTML = `<div class="small muted">مقدرناش نفتح الإيصال: ${esc(errMsg(error))}</div>`; return; }
  const u = data.signedUrl;
  host.innerHTML = /\.pdf$/i.test(path)
    ? `<a class="btn sec" href="${esc(u)}" target="_blank" rel="noopener">📄 افتح الإيصال (PDF)</a>`
    : `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="إيصال التحويل"></a>`;
}
