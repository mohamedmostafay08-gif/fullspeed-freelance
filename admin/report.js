// Weekly report (Saturday → Friday, Egypt time): KPIs vs the previous week, daily activity, top partners,
// companies and governorates, plus free-text notes. "PDF" renders the report to a real A4 PDF in the
// browser (html2canvas-pro → jsPDF, so Arabic is shaped by the browser), "مشاركة" sends the file through the
// phone's share sheet when it can, or a WhatsApp text summary with a link back to the report.
import { $, $$, esc, money, fetchAll, sb, toast, busy, targetDaysMap } from '../shared/common.js';
import { hbars, card } from './analytics.js';

const TZ = 'Africa/Cairo';
const cairoDay = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d instanceof Date ? d : new Date(d));
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dow = (s) => new Date(s + 'T12:00:00Z').getUTCDay(); // 0 = Sunday … 5 = Friday, 6 = Saturday
const DAYS_AR = ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];
const n0 = (v) => Math.round(Number(v) || 0).toLocaleString('en-US');
const dmy = (s) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };

// Last complete week: ends on the most recent Friday before today (a Friday itself is still in progress).
export function lastWeek(todayStr = cairoDay(new Date())) {
  let back = (dow(todayStr) - 5 + 7) % 7; if (back === 0) back = 7;
  const end = addDays(todayStr, -back);
  return { start: addDays(end, -6), end };
}
const weekOf = (start) => ({ start, end: addDays(start, 6) });
const inW = (day, w) => day && day >= w.start && day <= w.end;

function compute(w, D) {
  const { cands, led, wds, fl, tgt } = D;
  const cday = (c) => cairoDay(c.created_at);
  const noms = cands.filter((c) => inW(cday(c), w));
  const hires = cands.filter((c) => inW(c.start_date, w));
  const papers = cands.filter((c) => inW(c.paper_date, w));
  const lw = led.filter((l) => !l.reversed_at && inW(l.earned_on, w));
  const candCo = new Map(cands.map((c) => [c.id, c.company_id]));
  const completed = lw.filter((l) => l.kind === 'days' && Number(l.tier_days) >= (tgt[candCo.get(l.candidate_id)] || 26)).length;
  const paid = wds.filter((x) => x.status === 'paid' && x.decided_at && inW(cairoDay(x.decided_at), w));
  // Pending at the end of the week: requested by then and not decided by then.
  const pend = wds.filter((x) => cairoDay(x.created_at) <= w.end && (x.status === 'pending' || (x.decided_at && cairoDay(x.decided_at) > w.end)));
  return {
    noms, hires, lw,
    k: {
      partners: fl.filter((f) => !f.duplicate_of && inW(cairoDay(f.created_at), w)).length,
      noms: noms.length, papers: papers.length, hires: hires.length, completed,
      bonus: lw.reduce((a, l) => a + Number(l.amount), 0),
      paid: paid.reduce((a, x) => a + Number(x.amount), 0),
      pendN: pend.length, pendAmt: pend.reduce((a, x) => a + Number(x.amount), 0),
    },
  };
}

function kpi(label, cur, prev, { fmt = n0, good = 'up', sub = '' } = {}) {
  const d = cur - prev, p = prev ? Math.round((d / prev) * 100) : (cur ? 100 : 0);
  const tone = !d ? 'flat' : (d > 0) === (good === 'up') ? 'up' : 'down';
  return `<div class="rp-kpi"><div class="rp-kl">${label}</div><div class="rp-kv">${fmt(cur)}</div>
    <div class="rp-kd ${tone}">${d ? `${d > 0 ? '▲' : '▼'} ${Math.abs(p)}%` : '—'} <span>الأسبوع اللي قبله ${fmt(prev)}</span></div>${sub ? `<div class="rp-ks">${sub}</div>` : ''}</div>`;
}

// Seven day columns (nominations + people who started work) — plain inline SVG so it prints and exports cleanly.
function dayChart(w, cur) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(w.start, i));
  const a = days.map((d) => cur.noms.filter((c) => cairoDay(c.created_at) === d).length);
  const b = days.map((d) => cur.hires.filter((c) => c.start_date === d).length);
  const max = Math.max(1, ...a, ...b), W = 640, H = 190, pb = 36, pt = 14, cw = W / 7, bw = Math.min(26, cw / 3.2);
  const y = (v) => H - pb - (v / max) * (H - pb - pt);
  const bars = days.map((d, i) => {
    const cx = W - (i + 0.5) * cw; // right-to-left: Saturday on the right
    return `<g><title>${DAYS_AR[dow(d)]} ${dmy(d)}: ${a[i]} ترشيح، ${b[i]} بدأوا شغل</title>
      <rect x="${cx - bw - 2}" y="${y(a[i])}" width="${bw}" height="${H - pb - y(a[i])}" rx="4" class="rp-b1"/>
      <rect x="${cx + 2}" y="${y(b[i])}" width="${bw}" height="${H - pb - y(b[i])}" rx="4" class="rp-b2"/>
      ${a[i] ? `<text x="${cx - bw / 2 - 2}" y="${y(a[i]) - 4}" class="rp-tv">${a[i]}</text>` : ''}${b[i] ? `<text x="${cx + bw / 2 + 2}" y="${y(b[i]) - 4}" class="rp-tv">${b[i]}</text>` : ''}
      <text x="${cx}" y="${H - pb + 16}" class="rp-tx">${DAYS_AR[dow(d)]}</text><text x="${cx}" y="${H - pb + 30}" class="rp-tx2">${d.slice(8)}/${d.slice(5, 7)}</text></g>`;
  }).join('');
  return `<div class="rp-legend"><span><i class="rp-b1"></i>ترشيحات</span><span><i class="rp-b2"></i>بدأوا شغل</span></div>
    <svg class="rp-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="النشاط اليومي"><line x1="0" x2="${W}" y1="${H - pb}" y2="${H - pb}" class="rp-ax"/>${bars}</svg>`;
}

const cache = {};
async function loadData(S) {
  if (cache.t && Date.now() - cache.t < 60000) return cache.d;
  const [cands, led, wds, rules] = await Promise.all([
    fetchAll(() => sb.from('candidates').select('id,freelancer_id,company_id,company_name,gov,status,created_at,paper_date,start_date')),
    fetchAll(() => sb.from('bonus_ledger').select('candidate_id,freelancer_id,kind,tier_days,amount,earned_on,reversed_at')),
    fetchAll(() => sb.from('withdrawals').select('freelancer_id,amount,status,created_at,decided_at')),
    sb.from('bonus_rules').select('company_id,kind,min_days').eq('active', true),
  ]);
  const tgt = {};
  Object.assign(tgt, targetDaysMap(rules.data || [], S.companies));
  cache.d = { cands, led, wds, fl: S.fl, tgt }; cache.t = Date.now();
  return cache.d;
}

export async function reportView({ S, view, flName, compName }) {
  const lw = lastWeek();
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(lw.start, -7 * i));
  if (!S.reportWeek || !weeks.includes(S.reportWeek)) S.reportWeek = lw.start;
  const D = await loadData(S);
  const w = weekOf(S.reportWeek), pw = weekOf(addDays(S.reportWeek, -7));
  const cur = compute(w, D), prev = compute(pw, D), k = cur.k, p = prev.k;

  const perFl = new Map();
  cur.noms.forEach((c) => { const o = perFl.get(c.freelancer_id) || { n: 0, h: 0, b: 0 }; o.n++; perFl.set(c.freelancer_id, o); });
  cur.hires.forEach((c) => { const o = perFl.get(c.freelancer_id) || { n: 0, h: 0, b: 0 }; o.h++; perFl.set(c.freelancer_id, o); });
  cur.lw.forEach((l) => { const o = perFl.get(l.freelancer_id) || { n: 0, h: 0, b: 0 }; o.b += Number(l.amount); perFl.set(l.freelancer_id, o); });
  const topFl = [...perFl.entries()].sort((a, b) => b[1].n - a[1].n || b[1].h - a[1].h).slice(0, 8);
  const coM = new Map(); cur.noms.forEach((c) => { const key = c.company_id || c.company_name || '—'; const o = coM.get(key) || { n: 0, h: 0 }; o.n++; coM.set(key, o); });
  cur.hires.forEach((c) => { const key = c.company_id || c.company_name || '—'; const o = coM.get(key) || { n: 0, h: 0 }; o.h++; coM.set(key, o); });
  const govM = new Map(); cur.noms.forEach((c) => { if (c.gov) govM.set(c.gov, (govM.get(c.gov) || 0) + 1); });
  const notesKey = 'fsa-report-notes-' + w.start;
  const conv = k.noms ? Math.round((k.hires / k.noms) * 100) : 0;

  view(`
    <div class="ph rp-bar"><h1>📄 التقرير الأسبوعي</h1>
      <div class="row">
        <select class="in" data-week style="width:auto">${weeks.map((s) => `<option value="${s}" ${s === w.start ? 'selected' : ''}>${s === lw.start ? 'الأسبوع اللي فات — ' : ''}${dmy(s)} ← ${dmy(addDays(s, 6))}</option>`).join('')}</select>
        <button class="btn pri sm" data-pdf>⬇️ PDF</button>
        <button class="btn sec sm" data-share>📤 مشاركة واتساب</button>
      </div></div>
    <article class="rp" id="rpt">
      <header class="rp-head">
        <div class="rp-brand"><img src="../brand/fs-mark.png" alt="" width="44" height="44"><div><b>Full Speed</b><span>تقرير الأسبوع</span></div></div>
        <div class="rp-range"><b>${DAYS_AR[6]} ${dmy(w.start)} — ${DAYS_AR[5]} ${dmy(w.end)}</b><span>مقارنة بالأسبوع ${dmy(pw.start)} — ${dmy(pw.end)}</span></div>
      </header>
      <section class="rp-kpis">
        ${kpi('ترشيحات جديدة', k.noms, p.noms)}
        ${kpi('خلّصوا الورق', k.papers, p.papers)}
        ${kpi('بدأوا شغل', k.hires, p.hires, { sub: `تحويل ${conv}% من ترشيحات الأسبوع` })}
        ${kpi('كمّلوا أيام الهدف', k.completed, p.completed)}
        ${kpi('شركاء جداد', k.partners, p.partners)}
        ${kpi('بونص مستحق', k.bonus, p.bonus, { fmt: money })}
        ${kpi('اتصرف للشركاء', k.paid, p.paid, { fmt: money })}
        ${kpi('سحوبات مستنية', k.pendN, p.pendN, { good: 'down', sub: money(k.pendAmt) })}
      </section>
      ${card('📅 النشاط يوم بيوم', dayChart(w, cur), { cls: 'rp-card' })}
      <div class="rp-grid">
        ${card('🏆 أنشط الشركاء', `<table class="t rp-t"><thead><tr><th>#</th><th>الشريك</th><th>ترشيحات</th><th>بدأوا</th><th>بونص</th></tr></thead><tbody>
          ${topFl.map(([id, o], i) => `<tr><td>${i + 1}</td><td><b>${esc(flName(id))}</b></td><td>${o.n}</td><td>${o.h}</td><td>${money(o.b)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">مفيش نشاط الأسبوع ده</td></tr>'}
          </tbody></table>`, { cls: 'rp-card' })}
        ${card('🏢 الشركات', hbars([...coM.entries()].sort((a, b) => b[1].n - a[1].n).map(([id, o]) => ({ label: compName(id, id), value: o.n, v: id, sub: ` • ${o.h} بدأوا` })), { limit: 8, empty: 'مفيش ترشيحات الأسبوع ده' }), { cls: 'rp-card' })}
        ${card('📍 المحافظات', hbars([...govM.entries()].sort((a, b) => b[1] - a[1]).map(([g, n]) => ({ label: g, value: n, v: g })), { limit: 8, tone: 'tn-a', empty: 'مفيش ترشيحات الأسبوع ده' }), { cls: 'rp-card' })}
      </div>
      <section class="card rp-card rp-notes"><h3>📝 ملاحظات</h3>
        <textarea class="in" data-notes rows="3" placeholder="اكتب ملاحظاتك على الأسبوع (بتظهر في الـ PDF)">${esc(lsGet(notesKey) || '')}</textarea>
        <div class="rp-notes-print" data-notes-print></div></section>
      <footer class="rp-foot">اتعمل ${new Date().toLocaleString('en-GB', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' })} • Full Speed Admin</footer>
    </article>`);

  $('[data-week]').onchange = (e) => { S.reportWeek = e.target.value; reportView({ S, view, flName, compName }); };
  const notes = $('[data-notes]');
  notes.oninput = () => lsSet(notesKey, notes.value);
  const summary = () => [
    `📄 تقرير Full Speed — الأسبوع ${dmy(w.start)} ← ${dmy(w.end)}`,
    `• ${n0(k.noms)} ترشيح (${k.noms >= p.noms ? '+' : ''}${n0(k.noms - p.noms)} عن الأسبوع اللي قبله)`,
    `• ${n0(k.papers)} خلّصوا الورق • ${n0(k.hires)} بدأوا شغل • ${n0(k.completed)} كمّلوا الهدف`,
    `• ${n0(k.partners)} شريك جديد`,
    `• بونص مستحق ${money(k.bonus)} • اتصرف ${money(k.paid)}`,
    k.pendN ? `• ${n0(k.pendN)} طلب سحب مستني (${money(k.pendAmt)})` : '',
    notes.value.trim() ? `📝 ${notes.value.trim()}` : '',
  ].filter(Boolean).join('\n');
  const fileName = `FullSpeed_Weekly_${w.start}.pdf`;
  $('[data-pdf]').onclick = (e) => busy(e.currentTarget, async () => {
    try { const pdf = await buildPdf(); pdf.save(fileName); toast('اتعمل الـ PDF ✅', 'ok'); } catch (err) { console.error(err); toast('مقدرناش نعمل الـ PDF — جرّب تاني', 'bad'); }
  });
  $('[data-share]').onclick = (e) => busy(e.currentTarget, async () => {
    const text = summary();
    try {
      if (navigator.canShare) {
        const blob = (await buildPdf()).output('blob');
        const file = new File([blob], fileName, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'تقرير Full Speed الأسبوعي', text }); return; }
      }
    } catch (err) { if (err?.name === 'AbortError') return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n\n${location.origin}/admin/?go=report`)}`, '_blank', 'noopener');
  });
}

// ---------------------------------------------------------------- PDF (libraries load on first use)
// Pinned hashes (SRI): if a CDN ever serves a changed file, the browser refuses to run it.
const SRI = {
  'https://cdn.jsdelivr.net/npm/html2canvas-pro@1.5.8/dist/html2canvas-pro.min.js': 'sha384-QbVSYhU9faw2C7l92rI0Dmke8Yod6KaOixC1kkbO/dGnMDKtbWhwcxSSOkmHXWom',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js': 'sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk',
};
const loadScript = (src) => new Promise((ok, bad) => {
  if ([...document.scripts].some((s) => s.src === src)) return ok();
  const s = document.createElement('script'); s.src = src;
  if (SRI[src]) { s.integrity = SRI[src]; s.crossOrigin = 'anonymous'; }
  s.onload = ok; s.onerror = () => bad(new Error('load ' + src)); document.head.append(s);
});
async function libs() {
  await Promise.all([
    // html2canvas-pro: the maintained fork that understands modern CSS colours (color-mix / color()), which the panel uses.
    loadScript('https://cdn.jsdelivr.net/npm/html2canvas-pro@1.5.8/dist/html2canvas-pro.min.js'),
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
  ]);
  return { html2canvas: window.html2canvas, jsPDF: window.jspdf.jsPDF };
}
// Inline an SVG's computed styles and turn it into an <img> of the same box — html2canvas draws images reliably.
function svgToImg(svg, win) {
  // Size from the parent's content box (the SVG's own box is unreliable in the cloned document).
  const box = svg.parentElement, bcs = win.getComputedStyle(box);
  const w = Math.floor(box.clientWidth - parseFloat(bcs.paddingLeft) - parseFloat(bcs.paddingRight));
  const vb = svg.viewBox.baseVal, h = Math.round(Math.min(240, (w * vb.height) / vb.width));
  const copy = svg.cloneNode(true);
  const src = [svg, ...svg.querySelectorAll('*')], dst = [copy, ...copy.querySelectorAll('*')];
  src.forEach((el, i) => {
    const cs = win.getComputedStyle(el);
    ['fill', 'stroke', 'stroke-width', 'font-size', 'font-weight', 'font-family', 'text-anchor'].forEach((k) => { const v = cs.getPropertyValue(k); if (v) dst[i].setAttribute(k, v); });
  });
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); copy.setAttribute('width', w); copy.setAttribute('height', h);
  const img = svg.ownerDocument.createElement('img');
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copy));
  img.width = w; img.height = h; img.style.cssText = `display:block;inline-size:${w}px;block-size:${h}px`;
  svg.replaceWith(img);
  return new Promise((ok) => { if (img.complete) ok(); else { img.onload = ok; img.onerror = ok; } });
}
async function buildPdf() {
  const { html2canvas, jsPDF } = await libs();
  const el = $('#rpt'), notes = $('[data-notes]', el).value.trim();
  let breaks = [], cloneH = 1;
  await document.fonts?.ready;
  // All export-only changes happen in html2canvas's cloned document, so the page on screen never changes.
  const canvas = await html2canvas(el, {
    scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: 1100,
    onclone: async (doc) => {
      doc.documentElement.dataset.theme = 'light'; // paper is always light
      const r = doc.getElementById('rpt'); r.classList.add('rp-exporting');
      r.querySelector('[data-notes-print]').textContent = notes;
      await Promise.all([...r.querySelectorAll('svg.rp-svg')].map((s) => svgToImg(s, doc.defaultView)));
      // Page breaks may fall between blocks (header, KPI rows, cards), never through one.
      const top = r.getBoundingClientRect().top; cloneH = r.getBoundingClientRect().height;
      breaks = [...r.querySelectorAll('.rp-head, .rp-kpi, .rp > .card, .rp-grid > *, .rp-foot')].map((b) => b.getBoundingClientRect().bottom - top + 7);
    },
  });
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true });
  const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), m = 22;
  const iw = pw - m * 2, scale = iw / canvas.width, pageH = Math.floor((ph - m * 2) / scale);
  const k = canvas.height / cloneH, cuts = breaks.map((b) => Math.round(b * k)).sort((a, b) => a - b);
  for (let y = 0, i = 0; y < canvas.height - 4; i++) {
    let end = Math.min(canvas.height, y + pageH);
    if (end < canvas.height) { const c = cuts.filter((b) => b > y + pageH * 0.4 && b <= end).pop(); if (c) end = c; }
    const h = end - y;
    const part = document.createElement('canvas'); part.width = canvas.width; part.height = h;
    const g = part.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, part.width, h);
    g.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    if (i) pdf.addPage();
    pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', m, m, iw, h * scale);
    y = end;
  }
  return pdf;
}
