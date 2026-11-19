// Shared helpers for both apps (no frameworks)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: /\/admin(\/|$)/.test(location.pathname) ? 'fsf-admin' : 'fsf-app' },
});

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = (n) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ج.م';
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '—');
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const daysBetween = (a, b) => Math.max(0, Math.floor((new Date(b) - new Date(a)) / 86400000));

export function normMobile(v) {
  let d = String(v ?? '').replace(/\D/g, '');
  if (d.startsWith('0020')) d = d.slice(4);
  else if (d.startsWith('20') && d.length === 12) d = d.slice(2);
  return d.replace(/^0+/, '');
}
export const authEmailFor = (m) => `m${normMobile(m)}@fl.fullspeedlogistics.com`;
export const waLink = (m) => `https://wa.me/20${normMobile(m)}`;

// Company logos are stored as Google Drive share links; serve the bundled copy, then Drive's image CDN, then initials.
const driveId = (url) => String(url || '').match(/(?:\/d\/|[?&]id=)([\w-]{20,})/)?.[1];
export function logoImg(url, text = '') {
  const id = driveId(url);
  const src = id ? `/logos/${id}.webp` : String(url || '');
  if (!src) return esc(text);
  const alt = id ? `https://lh3.googleusercontent.com/d/${id}=w160` : '';
  return `<img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-alt="${esc(alt)}" data-txt="${esc(text)}"
    onerror="if(this.dataset.alt){this.src=this.dataset.alt;this.dataset.alt=''}else{this.replaceWith(document.createTextNode(this.dataset.txt))}">`;
}

export function toast(msg, type = '') {
  let host = $('#toasts');
  if (!host) { host = document.createElement('div'); host.id = 'toasts'; document.body.appendChild(host); }
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => el.remove(), type === 'bad' ? 6000 : 3200);
}

// modal(html) -> {el, close}
export function modal(html, cls = '') {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${cls}" role="dialog">${html}</div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
  $$('[data-close]', bg).forEach((b) => b.addEventListener('click', close));
  const first = $('input,select,textarea', bg); if (first) setTimeout(() => first.focus(), 50);
  return { el: bg, close };
}

export function confirmBox(title, message, okText = 'تأكيد', danger = true) {
  return new Promise((resolve) => {
    const m = modal(`<h2>${esc(title)}</h2><p class="muted">${esc(message)}</p>
      <div class="row" style="justify-content:flex-end;margin-top:14px">
        <button class="btn sec" data-no>إلغاء</button><button class="btn ${danger ? 'dan' : 'pri'}" data-yes>${esc(okText)}</button></div>`);
    $('[data-no]', m.el).onclick = () => { m.close(); resolve(false); };
    $('[data-yes]', m.el).onclick = () => { m.close(); resolve(true); };
  });
}

export function promptBox(title, label, { type = 'text', placeholder = '', required = true } = {}) {
  return new Promise((resolve) => {
    const m = modal(`<h2>${esc(title)}</h2><label class="f">${esc(label)}</label>
      <input class="in" type="${type}" placeholder="${esc(placeholder)}" data-v>
      <div class="row" style="justify-content:flex-end;margin-top:14px">
        <button class="btn sec" data-no>إلغاء</button><button class="btn pri" data-yes>حفظ</button></div>`);
    const inp = $('[data-v]', m.el);
    const go = () => { const v = inp.value.trim(); if (required && !v) return inp.focus(); m.close(); resolve(v); };
    $('[data-no]', m.el).onclick = () => { m.close(); resolve(null); };
    $('[data-yes]', m.el).onclick = go;
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
}

// Arabic messages for errors raised by the database
const ERR = {
  courier_exists: 'المندوب ده (نفس رقم الموبايل) متسجل قبل كده.',
  account_inactive: 'حسابك لسه مش متفعل. الإدارة هتراجعه وتفعله.',
  insufficient_balance: 'المبلغ أكبر من رصيدك المتاح.',
  invalid_amount: 'اكتب مبلغ صحيح.',
  invalid_input: 'راجع البيانات المكتوبة.',
  invalid_company: 'اختار شركة.',
  job_closed: 'الوظيفة دي اتقفلت.',
  job_full: 'الوظيفة دي اكتمل عددها.',
  rate_limited: 'وصلت للحد اليومي للترشيحات. حاول بكرة.',
  email_exists: 'الإيميل ده مسجل لحساب تاني.',
  mobile_exists: 'رقم الموبايل ده مسجل قبل كده. سجّل دخول.',
  invalid_email: 'الإيميل غير صحيح.',
  not_allowed: 'صلاحيتك لا تسمح بالإجراء ده.',
  only_owner_can_change_decided: 'الطلب ده اتقرر قبل كده. التعديل للمالك بس.',
  reason_required: 'لازم تكتب السبب.',
  mobile_change_via_admin_function_only: 'تغيير الموبايل من زرار "تغيير الموبايل" بس.',
  at_least_one_owner_required: 'لازم يفضل مالك واحد مفعّل على الأقل.',
  'Invalid login credentials': 'بيانات الدخول غير صحيحة.',
  'User already registered': 'رقم الموبايل ده مسجل قبل كده. سجّل دخول.',
  weak_password: 'كلمة المرور قصيرة.',
  email_exists_not_staff: 'الإيميل ده عليه حساب تاني. استخدم إيميل مختلف أو امسح الحساب من Supabase.',
  email_change_not_allowed: 'مينفعش تغيير الإيميل ده.',
  signup_not_allowed: 'التسجيل المباشر مقفول. اطلب من المالك يضيفك.',
  tiers_required: 'لازم شريحة واحدة على الأقل.',
  'Password should be at least': 'كلمة المرور لازم 6 حروف/أرقام على الأقل.',
  'Failed to fetch': 'مفيش اتصال بالإنترنت. حاول تاني.',
  'row-level security': 'صلاحيتك لا تسمح بالإجراء ده.',
};
export function errMsg(e) {
  const m = String(e?.message ?? e?.error ?? e ?? '');
  for (const k of Object.keys(ERR)) if (m.includes(k)) return ERR[k];
  if (m.includes('Database error saving new user')) return 'الموبايل أو الإيميل مسجل قبل كده.';
  return m || 'حصل خطأ غير متوقع';
}

export async function busy(btn, fn) {
  const old = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="small">جاري...</span>'; }
  try { return await fn(); } finally { if (btn) { btn.disabled = false; btn.innerHTML = old; } }
}

// fetch all rows (PostgREST caps at 1000 per request)
export async function fetchAll(build) {
  const out = []; const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await build().range(from, from + size - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < size) break;
  }
  return out;
}

export function csvDownload(name, header, rows) {
  const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const text = '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name; a.click();
}

export const GOVS = ['القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الشرقية', 'الدقهلية', 'الغربية', 'المنوفية', 'البحيرة', 'كفر الشيخ',
  'دمياط', 'بورسعيد', 'الإسماعيلية', 'السويس', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان',
  'البحر الأحمر', 'الوادي الجديد', 'مطروح', 'شمال سيناء', 'جنوب سيناء'];
export const VEHICLES = ['موتوسيكل', 'سيارة', 'دراجة / اسكوتر', 'تروسيكل', 'مترجل (بدون مركبة)'];
export const CAND_STATUS = {
  submitted: ['تحت المراجعة', 'n'], new: ['مرشح جديد', 'b'], hired: ['تم التعيين / شغال', 'g'],
  suspended: ['موقوف مؤقتاً', 'a'], rejected: ['مرفوض', 'r'],
};
export const WD_STATUS = { pending: ['قيد المراجعة', 'a'], paid: ['تم التحويل', 'g'], rejected: ['مرفوض', 'r'] };
export const FL_STATUS = { Active: ['مفعّل', 'g'], Pending: ['قيد المراجعة', 'a'], Hold: ['معلّق', 'p'], Inactive: ['موقوف', 'r'] };
export const chip = (map, k) => { const [t, c] = map[k] ?? [k, 'n']; return `<span class="chip ${c}">${esc(t)}</span>`; };
