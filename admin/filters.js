// Filter bar shared by the admin pages: date range + extra dimensions + removable chips + saved presets.
// A page keeps its own selects (search, status, company…) and hands them over as "adopted" controls, so
// they show up as chips, are saved in presets and can be set by clicking a chart — without rewriting the page.
//
//   const FX = filters('couriers', {
//     tools: $('.tools'),                       // the page's existing filter row
//     date: (row) => row.created_at,            // which date the range applies to (null = no date control)
//     adopt: [{ key: 'st', label: 'الحالة', el: '[data-st]' }],  // existing selects/inputs
//     dims: [{ key: 'gov', label: 'المحافظة', options: [['القاهرة','القاهرة']], get: (r) => r.gov }],
//     onChange: () => render(),
//   });
//   rows = rows.filter(FX.match);   FX.strip is a <div> placed above the tools for the page's charts.
//   FX.set('gov', 'القاهرة')  — used by chart clicks (adopted or not).
import { $, $$, esc, promptBox, toast, cairoDay, dayOfValue } from '../shared/common.js';

const lsGet = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
const MEM = {}; // per-page state for this browser tab (kept when you leave and come back)

export const RANGES = [['all', 'كل الوقت'], ['today', 'النهارده'], ['7d', '7 أيام'], ['30d', '30 يوم'], ['90d', '90 يوم'], ['month', 'الشهر ده'], ['custom', 'فترة مخصّصة']];
const RANGE_T = Object.fromEntries(RANGES);
// Calendar days are Cairo days, matching the charts' month buckets.
const ymd = (d) => cairoDay(d);
const dayOf = dayOfValue;

// Inclusive [from, to] as yyyy-mm-dd for a range key ('' = open end).
export function rangeBounds(st) {
  const now = new Date(), t = ymd(now), back = (n) => ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n + 1));
  switch (st.range) {
    case 'today': return [t, t];
    case '7d': return [back(7), t];
    case '30d': return [back(30), t];
    case '90d': return [back(90), t];
    case 'month': return [ymd(new Date(now.getFullYear(), now.getMonth(), 1)), t];
    case 'custom': return [st.from || '', st.to || ''];
    default: return ['', ''];
  }
}
export const inBounds = ([a, b], v) => { const d = dayOf(v); if (!a && !b) return true; if (!d) return false; return (!a || d >= a) && (!b || d <= b); };

export function filters(page, { tools, date = null, adopt = [], dims = [], onChange = () => {}, defRange = 'all', charts = true } = {}) {
  const prev = MEM[page];
  const st = prev ? { ...prev, sel: { ...prev.sel } } : { range: defRange, from: '', to: '', sel: {} };
  MEM[page] = st;
  const adopted = adopt.map((a) => ({ ...a, node: typeof a.el === 'string' ? $(a.el) : a.el })).filter((a) => a.node);
  adopted.forEach((a) => { a.def = a.node.value; });
  // restore adopted values remembered from the last visit (only if the option still exists)
  if (prev?.adopted) adopted.forEach((a) => { const v = prev.adopted[a.key]; if (v != null && setCtl(a.node, v)) a.node.value = v; });

  // ---- DOM: chart strip above the tools, chips + presets row below
  const strip = document.createElement('div'); strip.className = 'ax-strip';
  const bar = document.createElement('div'); bar.className = 'fx-bar';
  if (tools) { if (charts) tools.before(strip); tools.after(bar); tools.classList.add('fx-tools'); }

  if (tools && date) {
    const wrap = document.createElement('div'); wrap.className = 'fx-date';
    wrap.innerHTML = `<select class="in fx-range" aria-label="الفترة">${RANGES.map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select>
      <span class="fx-custom" hidden><input class="in" type="date" data-fx-from aria-label="من"><span class="muted">→</span><input class="in" type="date" data-fx-to aria-label="لحد"></span>`;
    tools.prepend(wrap);
    const sel = $('.fx-range', wrap), cus = $('.fx-custom', wrap), f = $('[data-fx-from]', wrap), t = $('[data-fx-to]', wrap);
    sel.value = st.range; f.value = st.from; t.value = st.to; cus.hidden = st.range !== 'custom';
    sel.onchange = () => { st.range = sel.value; cus.hidden = st.range !== 'custom'; if (st.range === 'custom' && !st.from) { const [a] = rangeBounds({ range: '30d' }); st.from = f.value = a; } changed(); };
    f.onchange = () => { st.from = f.value; changed(); };
    t.onchange = () => { st.to = t.value; changed(); };
  }
  dims.forEach((d) => {
    if (!tools) return;
    const s = document.createElement('select'); s.className = 'in fx-dim'; s.dataset.fxDim = d.key;
    s.innerHTML = `<option value="">${esc(d.all || 'كل ' + d.label)}</option>${d.options.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}`;
    s.value = st.sel[d.key] ?? '';
    s.onchange = () => { st.sel[d.key] = s.value; changed(); };
    tools.append(s); d.node = s;
  });
  adopted.forEach((a) => a.node.addEventListener('input', () => { remember(); paintChips(); }));

  function setCtl(node, v) { return node.tagName !== 'SELECT' || [...node.options].some((o) => o.value === v); }
  function remember() { st.adopted = Object.fromEntries(adopted.map((a) => [a.key, a.node.value])); }
  function changed() { remember(); paintChips(); onChange(); }

  // ---- chips
  const optText = (node, v) => node.tagName === 'SELECT' ? ([...node.options].find((o) => o.value === v)?.textContent || v) : v;
  function chipsData() {
    const out = [];
    if (date && st.range !== defRange) {
      const [a, b] = rangeBounds(st);
      out.push({ k: '@range', t: `📅 ${st.range === 'custom' ? `${a || '…'} → ${b || '…'}` : RANGE_T[st.range]}` });
    }
    adopted.forEach((a) => { const v = a.node.value; if (v !== a.def && v !== '') out.push({ k: 'a:' + a.key, t: `${a.label}: ${optText(a.node, v)}` }); else if (v !== a.def) out.push({ k: 'a:' + a.key, t: `${a.label}: الكل` }); });
    dims.forEach((d) => { const v = st.sel[d.key]; if (v) out.push({ k: 'd:' + d.key, t: `${d.label}: ${optText(d.node || { tagName: 'X' }, v)}` }); });
    return out;
  }
  function paintChips() {
    const cs = chipsData();
    const presets = loadPresets();
    bar.innerHTML = `<div class="fx-chips">${cs.map((c) => `<button class="fx-chip" data-fx-x="${esc(c.k)}" title="شيل الفلتر">${esc(c.t)} <span aria-hidden="true">×</span></button>`).join('')}
      ${cs.length > 1 ? '<button class="fx-clear" data-fx-clear>مسح الكل</button>' : ''}</div>
      <div class="fx-pre"><button class="btn ghost sm" data-fx-pre aria-haspopup="true">⭐ الفلاتر المحفوظة${presets.length ? ` (${presets.length})` : ''}</button></div>`;
    $$('[data-fx-x]', bar).forEach((b) => b.onclick = () => clearKey(b.dataset.fxX));
    const c = $('[data-fx-clear]', bar); if (c) c.onclick = () => { reset(); };
    $('[data-fx-pre]', bar).onclick = (e) => { e.stopPropagation(); presetMenu(e.currentTarget); };
  }
  function clearKey(k) {
    if (k === '@range') { st.range = defRange; syncDate(); }
    else if (k.startsWith('a:')) { const a = adopted.find((x) => 'a:' + x.key === k); if (a) { a.node.value = a.def; a.node.dispatchEvent(new Event('input')); return; } }
    else if (k.startsWith('d:')) { const d = dims.find((x) => 'd:' + x.key === k); st.sel[d.key] = ''; if (d.node) d.node.value = ''; }
    changed();
  }
  function reset() {
    st.range = defRange; st.from = st.to = ''; st.sel = {}; syncDate();
    dims.forEach((d) => { if (d.node) d.node.value = ''; });
    adopted.forEach((a) => { a.node.value = a.def; });
    adopted[0]?.node.dispatchEvent(new Event('input'));
    changed();
  }
  function syncDate() {
    const s = tools && $('.fx-range', tools); if (!s) return;
    s.value = st.range; $('.fx-custom', tools).hidden = st.range !== 'custom';
    $('[data-fx-from]', tools).value = st.from || ''; $('[data-fx-to]', tools).value = st.to || '';
  }

  // ---- presets (per page, this browser)
  const PKEY = 'fsa-presets-' + page;
  function loadPresets() { try { const v = JSON.parse(lsGet(PKEY) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } }
  function snapshot() { remember(); return { range: st.range, from: st.from, to: st.to, sel: { ...st.sel }, adopted: { ...st.adopted } }; }
  function apply(p) {
    st.range = p.range || defRange; st.from = p.from || ''; st.to = p.to || ''; st.sel = { ...(p.sel || {}) }; syncDate();
    dims.forEach((d) => { if (d.node) d.node.value = st.sel[d.key] || ''; });
    adopted.forEach((a) => { const v = p.adopted?.[a.key]; a.node.value = v != null && setCtl(a.node, v) ? v : a.def; });
    adopted[0]?.node.dispatchEvent(new Event('input'));
    changed();
  }
  function presetMenu(btn) {
    document.querySelector('.fx-menu')?.remove();
    const list = loadPresets();
    const m = document.createElement('div'); m.className = 'fx-menu'; m.setAttribute('role', 'menu');
    m.innerHTML = `${list.map((p, i) => `<div class="fx-mi"><button class="fx-ap" data-i="${i}">${esc(p.name)}</button><button class="fx-del" data-d="${i}" title="امسح" aria-label="امسح">×</button></div>`).join('') || '<div class="fx-empty small muted">لسه مفيش فلاتر محفوظة</div>'}
      <button class="btn pri sm fx-save" data-save>💾 احفظ الفلتر الحالي</button>`;
    btn.parentElement.append(m);
    const close = () => { m.remove(); document.removeEventListener('click', out); };
    const out = (e) => { if (!m.contains(e.target)) close(); };
    setTimeout(() => document.addEventListener('click', out));
    $$('[data-i]', m).forEach((b) => b.onclick = () => { close(); apply(list[+b.dataset.i].state); toast(`اتطبّق: ${list[+b.dataset.i].name}`); });
    $$('[data-d]', m).forEach((b) => b.onclick = (e) => { e.stopPropagation(); list.splice(+b.dataset.d, 1); lsSet(PKEY, JSON.stringify(list)); close(); paintChips(); });
    $('[data-save]', m).onclick = async () => {
      close();
      const name = await promptBox('حفظ الفلتر', 'اسم الفلتر (مثلاً: نون القاهرة المتأخرين)'); if (!name) return;
      const l = loadPresets().filter((p) => p.name !== name); l.unshift({ name, state: snapshot() }); lsSet(PKEY, JSON.stringify(l.slice(0, 20)));
      paintChips(); toast('الفلتر اتحفظ ⭐', 'ok');
    };
  }

  paintChips(); remember();

  const api = {
    strip, state: st,
    bounds: () => rangeBounds(st),
    inRange: (v) => inBounds(rangeBounds(st), v),
    // row passes the date range + the extra dimensions (adopted controls are filtered by the page itself)
    match: (row) => (!date || inBounds(rangeBounds(st), date(row))) && dims.every((d) => !st.sel[d.key] || String(d.get(row) ?? '') === st.sel[d.key]),
    get: (key) => { const a = adopted.find((x) => x.key === key); return a ? a.node.value : st.sel[key] || ''; },
    // set from a chart click; clicking the active value again clears it
    set(key, v) {
      if (key === '@month') { // a month column: narrow the date range to that month (click again to undo)
        const [y, m] = v.split('-').map(Number), a = ymd(new Date(y, m - 1, 1)), b = ymd(new Date(y, m, 0));
        if (st.range === 'custom' && st.from === a && st.to === b) st.range = defRange; else { st.range = 'custom'; st.from = a; st.to = b; }
        syncDate(); changed(); return;
      }
      const a = adopted.find((x) => x.key === key);
      if (a) {
        const nv = a.node.value === v ? a.def : v;
        if (a.node.tagName === 'SELECT' && !setCtl(a.node, nv)) return;
        a.node.value = nv; a.node.dispatchEvent(new Event('input')); return;
      }
      const d = dims.find((x) => x.key === key); if (!d) return;
      st.sel[key] = st.sel[key] === v ? '' : v; if (d.node) d.node.value = st.sel[key];
      changed();
    },
    has: (key) => adopted.some((x) => x.key === key) || dims.some((x) => x.key === key),
    rangeLabel: () => (st.range === 'custom' ? rangeBounds(st).map((x) => x || '…').join(' → ') : RANGE_T[st.range]),
  };
  // Chart marks carry data-fx-k / data-fx-v; one delegated listener turns a click into a filter.
  strip.addEventListener('click', (e) => { const m = e.target.closest('[data-fx-k]'); if (m) api.set(m.dataset.fxK, m.dataset.fxV); });
  strip.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-fx-k]')) { e.preventDefault(); e.target.click(); } });
  return api;
}
