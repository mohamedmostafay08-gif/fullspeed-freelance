// Ctrl+K command palette + full-width / centered layout toggle for the admin panel.
// Searches partners, couriers and jobs, and runs quick commands (go to a page, new job, toggle theme…).
import { sb, esc, normMobile } from '../shared/common.js';
import { tr } from './i18n.js';

const lsGet = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };

// ---------------------------------------------------------------- width
export const widthPref = () => (lsGet('fsa-width') === 'center' ? 'center' : 'full');
export function applyWidth(p = widthPref()) { document.documentElement.dataset.width = p; }
const IC_FULL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9V5a2 2 0 0 1 2-2h4M21 9V5a2 2 0 0 0-2-2h-4M3 15v4a2 2 0 0 0 2 2h4M21 15v4a2 2 0 0 1-2 2h-4"/></svg>';
const IC_CENTER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3v4a2 2 0 0 1-2 2H3M15 3v4a2 2 0 0 0 2 2h4M9 21v-4a2 2 0 0 0-2-2H3M15 21v-4a2 2 0 0 1 2-2h4"/></svg>';
export function widthBtn() {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'tb-btn';
  const paint = () => {
    const full = widthPref() === 'full';
    b.innerHTML = full ? IC_CENTER : IC_FULL;
    b.title = full ? tr('عرض في النص', 'Centered view') : tr('ملء الشاشة', 'Full width');
    b.setAttribute('aria-label', b.title);
  };
  b.onclick = () => { lsSet('fsa-width', widthPref() === 'full' ? 'center' : 'full'); applyWidth(); paint(); dispatchEvent(new Event('resize')); };
  paint();
  return b;
}

// ---------------------------------------------------------------- palette
const IC_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export function searchBtn() {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'tb-btn tb-search';
  b.innerHTML = `${IC_SEARCH}<span class="tb-search-t">${tr('بحث', 'Search')}</span><kbd>${isMac ? '⌘' : 'Ctrl'} K</kbd>`;
  b.title = tr('بحث في كل حاجة', 'Search everything');
  b.onclick = () => openPalette();
  return b;
}

let ctx = null; // { S, go, openProfile, openCourier, jobEdit, nav, can }
export function initPalette(c) {
  ctx = c;
  addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK')) { e.preventDefault(); openPalette(); }
    else if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') && !document.activeElement?.isContentEditable) { e.preventDefault(); openPalette(); }
  });
}

let open = false;
export function openPalette() {
  if (!ctx || open) return;
  open = true;
  const bg = document.createElement('div');
  bg.className = 'pal-bg';
  bg.innerHTML = `<div class="pal" role="dialog" aria-label="${esc(tr('بحث', 'Search'))}">
    <div class="pal-in">${IC_SEARCH}<input data-q autocomplete="off" spellcheck="false" placeholder="${esc(tr('دوّر على شريك، مندوب، وظيفة، أو اكتب أمر…', 'Search a partner, courier, job, or type a command…'))}"><kbd>Esc</kbd></div>
    <div class="pal-list" data-list role="listbox"></div>
    <div class="pal-ft"><span><kbd>↑</kbd><kbd>↓</kbd> ${tr('تنقّل', 'navigate')}</span><span><kbd>Enter</kbd> ${tr('افتح', 'open')}</span><span><kbd>Esc</kbd> ${tr('قفل', 'close')}</span></div>
  </div>`;
  document.body.appendChild(bg);
  const input = bg.querySelector('[data-q]'), list = bg.querySelector('[data-list]');
  let items = [], idx = 0, seq = 0, timer = null, cands = null;
  const close = () => { open = false; bg.remove(); };
  bg.addEventListener('click', (e) => { if (e.target === bg) close(); });

  const { S, go, can } = ctx;
  const cmds = () => [
    ...ctx.nav().map(([v, t]) => ({ k: 'cmd', ic: '↪', t: tr('روح لـ', 'Go to') + ' ' + t, s: '', run: () => go(v) })),
    can('jobs') && { k: 'cmd', ic: '➕', t: tr('وظيفة جديدة', 'New job'), run: () => ctx.jobEdit(null) },
    can('broadcast') && { k: 'cmd', ic: '📣', t: tr('رسالة جماعية', 'Broadcast'), run: () => go('broadcast') },
    { k: 'cmd', ic: '🌓', t: tr('غيّر الثيم (فاتح/غامق)', 'Toggle theme'), run: () => document.querySelector('.tb-acts [data-theme-btn], .tb-acts .tb-theme')?.click() },
    { k: 'cmd', ic: '⛶', t: tr('ملء الشاشة / عرض في النص', 'Full width / centered'), run: () => { lsSet('fsa-width', widthPref() === 'full' ? 'center' : 'full'); applyWidth(); } },
  ].filter(Boolean);

  const norm = (v) => String(v ?? '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
  const hit = (q, ...vals) => vals.some((v) => norm(v).includes(q));

  const draw = () => {
    if (!items.length) { list.innerHTML = `<div class="pal-empty">${tr('مفيش نتايج', 'No results')}</div>`; return; }
    let lastK = '';
    const KT = { partner: tr('الشركاء', 'Partners'), courier: tr('المناديب', 'Couriers'), job: tr('الوظايف', 'Jobs'), cmd: tr('أوامر', 'Commands') };
    list.innerHTML = items.map((it, i) => {
      const head = it.k !== lastK ? `<div class="pal-sec">${KT[it.k]}</div>` : ''; lastK = it.k;
      return `${head}<button class="pal-it ${i === idx ? 'on' : ''}" data-i="${i}" role="option"><span class="pal-ic">${it.ic}</span><span class="pal-tx"><b data-noi18n>${esc(it.t)}</b>${it.s ? `<small data-noi18n>${esc(it.s)}</small>` : ''}</span>${it.tag ? `<span class="pal-tag">${it.tag}</span>` : ''}</button>`;
    }).join('');
    list.querySelectorAll('[data-i]').forEach((b) => {
      b.onmouseenter = () => { idx = Number(b.dataset.i); list.querySelectorAll('.pal-it').forEach((x) => x.classList.toggle('on', x === b)); };
      b.onclick = () => runAt(Number(b.dataset.i));
    });
    list.querySelector('.pal-it.on')?.scrollIntoView({ block: 'nearest' });
  };
  const runAt = (i) => { const it = items[i]; if (!it) return; close(); it.run(); };

  const search = async () => {
    const raw = input.value.trim(), q = norm(raw), qm = normMobile(raw), my = ++seq;
    if (!q) { items = cmds().slice(0, 9); idx = 0; return draw(); }
    const out = [];
    for (const f of S.fl) {
      if (f.duplicate_of) continue;
      if (hit(q, f.name, f.ref_code, f.email, f.region, f.gov) || (qm.length >= 4 && String(f.mobile || '').includes(qm))) {
        out.push({ k: 'partner', ic: '👤', t: f.name, s: `0${f.mobile || ''} • ${[f.gov, f.region].filter(Boolean).join(' — ')}`, tag: f.status === 'Inactive' ? '⛔' : f.frozen_at ? '🔒' : '', run: () => ctx.openProfile(f.id) });
        if (out.length >= 6) break;
      }
    }
    // Couriers and jobs are searched on the server so the palette stays fast with thousands of rows.
    const like = `%${raw.replace(/[%_,()]/g, ' ')}%`;
    const orC = [`name.ilike.${like}`, `code.ilike.${like}`];
    if (qm.length >= 4) orC.push(`mobile.ilike.%${qm}%`);
    const [cR, jR] = await Promise.all([
      sb.from('candidates').select('id,code,name,mobile,status,freelancer_id,company_name').or(orC.join(',')).order('created_at', { ascending: false }).limit(6),
      sb.from('jobs').select('id,code,title,company_name,gov,region,status').or([`title.ilike.${like}`, `code.ilike.${like}`, `company_name.ilike.${like}`, `region.ilike.${like}`].join(',')).order('created_at', { ascending: false }).limit(5),
    ]);
    if (my !== seq || !open) return;
    (cR.data || []).forEach((c) => out.push({ k: 'courier', ic: '🛵', t: `${c.name}`, s: [c.code, '0' + c.mobile, c.company_name, S.flMap.get(c.freelancer_id)?.name].filter(Boolean).join(' • '), run: () => ctx.openCourier(c.id) }));
    (jR.data || []).forEach((j) => out.push({ k: 'job', ic: '💼', t: `${j.title || ''} — ${j.company_name || ''}`, s: `${j.code} • ${[j.gov, j.region].filter(Boolean).join(' — ')}`, tag: j.status === 'Inactive' ? '⏸' : '', run: async () => { const { data } = await sb.from('jobs').select('*').eq('id', j.id).maybeSingle(); if (data) ctx.jobEdit(data); } }));
    cmds().filter((c) => hit(q, c.t)).slice(0, 4).forEach((c) => out.push(c));
    items = out; idx = 0; draw();
  };

  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search, 160); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(items.length - 1, idx + 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); runAt(idx); }
  });
  bg.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  search();
  setTimeout(() => input.focus(), 20);
}
