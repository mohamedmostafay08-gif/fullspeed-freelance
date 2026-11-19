// Admin security: fingerprint / face sign-in (passkeys) for staff, login history, new-device alerts.
// Passkeys live in the same `passkeys` table as partners' and go through the same `passkey` edge function
// (app: 'admin' names the passkey "Full Speed Admin" and only lets active staff sign in from the admin screen).
// Every fresh admin session is recorded once in staff_logins by the edge function, which also pushes an
// alert to owners when the device has never been seen for that staff member.
import { sb, $, $$, esc, toast, modal, busy, fmtDate } from '../shared/common.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../shared/config.js';

const lsGet = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
const ssGet = (k) => { try { return sessionStorage.getItem(k); } catch (_) { return null; } };
const ssSet = (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (_) {} };

export const pkSupported = async () => {
  try { return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch { return false; }
};
let swaP = null;
const swa = () => swaP || (swaP = import('https://esm.sh/@simplewebauthn/browser@13.1.0').catch((e) => { swaP = null; throw e; }));
async function pkCall(action, extra = {}, auth = false) {
  const headers = { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY };
  if (auth) { const { data } = await sb.auth.getSession(); headers.Authorization = 'Bearer ' + data.session?.access_token; }
  const r = await fetch(`${SUPABASE_URL}/functions/v1/passkey`, { method: 'POST', headers, body: JSON.stringify({ action, app: 'admin', ...extra }) });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.error || 'server');
  return out;
}

// ---------------------------------------------------------------- device identity (stable per browser)
export function deviceName() {
  const u = navigator.userAgent;
  const os = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? ((u.match(/Android[^;]*;\s*([^;)]+)/)?.[1] || 'Android').trim()) : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : /Linux/.test(u) ? 'Linux' : 'جهاز';
  const br = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /SamsungBrowser/.test(u) ? 'Samsung' : /Firefox\//.test(u) ? 'Firefox' : /CriOS|Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : '';
  return br ? `${os} • ${br}` : os;
}
function deviceId() {
  let id = lsGet('fsa-device');
  if (!id || id.length < 16) {
    const b = crypto.getRandomValues(new Uint8Array(16));
    id = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    lsSet('fsa-device', id);
  }
  return id;
}
const sessionId = (s) => {
  try { const p = JSON.parse(atob(s.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return p.session_id || `${s.user?.id}:${p.iat}`; } catch (_) { return ''; }
};

// The login method is remembered for the next boot ('password' / 'passkey'); a restored session logs as 'session'.
export const markLogin = (method) => ssSet('fsa-login-method', method);

// Record this admin session once (fire and forget — never blocks the panel).
export async function logLogin(session) {
  const sid = sessionId(session);
  if (!sid || lsGet('fsa-logged-sid') === sid) return;
  const method = ssGet('fsa-login-method') || 'session';
  try {
    await pkCall('log-login', { method, device_hash: deviceId(), device: deviceName() }, true);
    lsSet('fsa-logged-sid', sid); ssSet('fsa-login-method', null);
  } catch (_) { /* retried on the next boot */ }
}

// ---------------------------------------------------------------- sign in with passkey (login screen)
export function mountPasskeyLogin(onSignedIn) {
  const form = $('#loginForm'); if (!form || $('#pkLogin', form)) return;
  const btn = document.createElement('button');
  btn.type = 'button'; btn.id = 'pkLogin'; btn.className = 'btn sec block pk-login'; btn.hidden = true;
  btn.textContent = '🔐 ادخل بالبصمة';
  const submit = $('button.pri', form); (submit || form.lastElementChild).after(btn);
  pkSupported().then((ok) => { btn.hidden = !ok; });
  btn.onclick = async () => {
    const old = btn.textContent; btn.disabled = true; btn.textContent = 'بنستنى البصمة...';
    try {
      const { startAuthentication } = await swa();
      const { options, cid } = await pkCall('login-options');
      const response = await startAuthentication({ optionsJSON: options });
      const { token_hash } = await pkCall('login-verify', { cid, response });
      const { error } = await sb.auth.verifyOtp({ token_hash, type: 'magiclink' });
      if (error) throw error;
      markLogin('passkey');
      onSignedIn();
    } catch (e) {
      if (e?.name === 'NotAllowedError' || e?.name === 'AbortError') return;
      const m = e?.message;
      $('[data-err]', form).textContent = m === 'unknown_passkey' ? 'البصمة دي مش متسجلة — ادخل بكلمة المرور وفعّلها من "الأمان".'
        : m === 'not_staff' ? 'البصمة دي مش لحساب في فريق الإدارة.' : 'مقدرناش ندخلك بالبصمة، ادخل بكلمة المرور.';
    } finally { btn.disabled = false; btn.textContent = old; }
  };
}

async function registerPasskey(me) {
  const { startRegistration } = await swa();
  const { options, cid } = await pkCall('register-options', { label: me?.email || 'admin' }, true);
  const response = await startRegistration({ optionsJSON: options });
  await pkCall('register-verify', { cid, response, device: deviceName() }, true);
}
const regErr = (e) => (e?.name === 'NotAllowedError' || e?.name === 'AbortError' ? '' : e?.name === 'InvalidStateError' ? 'البصمة متفعّلة قبل كده على الجهاز ده.' : e?.message === 'unauthorized' ? 'سجّل خروج ودخول تاني وجرّب.' : 'مقدرناش نفعّل البصمة على الجهاز ده.');

// After a password sign-in, offer the fingerprint once per staff member per browser.
export async function maybeOfferPasskey(me, userId) {
  if (ssGet('fsa-offer-pk') !== '1') return;
  ssSet('fsa-offer-pk', null);
  const k = 'fsa-pk-offer-' + userId;
  if (lsGet(k) || !(await pkSupported())) return;
  const { count } = await sb.from('passkeys').select('id', { count: 'exact', head: true });
  if (count) { lsSet(k, '1'); return; }
  const m = modal(`<h2>🔐 تدخل بالبصمة المرة الجاية؟</h2>
    <p class="muted">بدل كلمة المرور كل مرة — بصمة إيدك أو وشك على الجهاز ده. أسرع وأأمن.</p>
    <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn sec" data-no>مش دلوقتي</button><button class="btn pri" data-yes>فعّل البصمة</button></div>`);
  $('[data-no]', m.el).onclick = () => { lsSet(k, '1'); m.close(); };
  $('[data-yes]', m.el).onclick = (e) => busy(e.currentTarget, async () => {
    try { await registerPasskey(me); lsSet(k, '1'); m.close(); toast('تم تفعيل الدخول بالبصمة 🎉', 'ok'); } catch (err) { const t = regErr(err); if (t) toast(t, 'bad'); }
  });
}
// Call before boot() on a password sign-in so the offer appears once the panel is up.
export const flagPasswordLogin = () => { markLogin('password'); ssSet('fsa-offer-pk', '1'); };

// ---------------------------------------------------------------- "الأمان" modal (own passkeys + own recent logins)
const METHOD_AR = { password: 'كلمة مرور', passkey: 'بصمة', session: 'جلسة محفوظة' };
const when = (t) => new Date(t).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
export function mountSecurityButton(me) {
  const pw = $('#myPw'); if (!pw || $('#mySec')) return;
  const b = document.createElement('button');
  b.className = pw.className; b.id = 'mySec'; b.type = 'button'; b.textContent = '🔐 الأمان';
  pw.after(b);
  b.onclick = () => securityModal(me);
}
export async function securityModal(me) {
  const m = modal(`<h2>🔐 الأمان</h2><div data-sec><div class="spin"></div></div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost" data-close>قفل</button></div>`, 'wide');
  const host = $('[data-sec]', m.el);
  const draw = async () => {
    const [{ data: keys }, { data: logs }, ok] = await Promise.all([
      sb.from('passkeys').select('id,device,created_at,last_used_at').order('created_at'),
      sb.from('staff_logins').select('at,method,device,ip,new_device').eq('user_id', (await sb.auth.getUser()).data.user?.id).order('at', { ascending: false }).limit(10),
      pkSupported(),
    ]);
    if (!host.isConnected) return;
    host.innerHTML = `
      <div class="sec-box">
        <div class="sec-h"><b>الدخول بالبصمة أو الوش</b><span class="small muted">${!ok ? 'الجهاز ده مش بيدعم البصمة للمواقع' : keys?.length ? `مفعّلة على ${keys.length} ${keys.length === 1 ? 'جهاز' : 'أجهزة'}` : 'مش مفعّلة'}</span></div>
        <div class="sec-list">${(keys || []).map((k) => `<div class="sec-item"><span>📱 <b>${esc(k.device || 'جهاز')}</b><small class="muted"> — ${k.last_used_at ? 'آخر دخول ' + fmtDate(k.last_used_at) : 'اتفعّلت ' + fmtDate(k.created_at)}</small></span>
          <span class="row" style="gap:6px"><button class="btn ghost sm" data-ren="${esc(k.id)}">تغيير الاسم</button><button class="btn ghost sm" data-del="${esc(k.id)}">شيل</button></span></div>`).join('') || '<div class="small muted">مفيش أجهزة متسجلة.</div>'}</div>
        ${ok ? `<button class="btn pri sm" data-add>${keys?.length ? '+ فعّلها على الجهاز ده' : 'فعّل البصمة على الجهاز ده'}</button>` : ''}
      </div>
      <div class="sec-box">
        <div class="sec-h"><b>آخر مرات دخولك</b><span class="small muted">لو في دخول مش إنت، غيّر كلمة المرور فوراً وكلّم المالك</span></div>
        <div class="tw"><table class="t"><thead><tr><th>الوقت</th><th>الطريقة</th><th>الجهاز</th><th>IP</th></tr></thead><tbody>
          ${(logs || []).map((l) => `<tr><td class="small">${when(l.at)}</td><td>${METHOD_AR[l.method] || esc(l.method)}</td><td class="small">${esc(l.device || '—')}${l.new_device ? ' <span class="chip a">جهاز جديد</span>' : ''}</td><td class="small mono">${esc(l.ip || '—')}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">لسه مفيش سجل</td></tr>'}
        </tbody></table></div>
      </div>`;
    const add = $('[data-add]', host);
    if (add) add.onclick = () => busy(add, async () => {
      try { await registerPasskey(me); toast('تم تفعيل الدخول بالبصمة 🎉', 'ok'); draw(); } catch (e) { const t = regErr(e); if (t) toast(t, 'bad'); }
    });
    $$('[data-del]', host).forEach((b) => b.onclick = async () => {
      const { error } = await sb.rpc('remove_my_passkey', { p_id: b.dataset.del });
      toast(error ? 'مقدرناش نشيلها' : 'اتشالت', error ? 'bad' : ''); draw();
    });
    $$('[data-ren]', host).forEach((b) => b.onclick = () => {
      const row = b.closest('.sec-item'); const cur = $('b', row).textContent;
      row.innerHTML = `<input class="in" value="${esc(cur)}" maxlength="80" style="flex:1;min-width:0"><button class="btn pri sm">حفظ</button>`;
      const inp = $('input', row); inp.focus(); inp.select();
      const save = async () => { const { error } = await sb.rpc('rename_my_passkey', { p_id: b.dataset.ren, p_name: inp.value }); if (error) toast('مقدرناش نغيّر الاسم', 'bad'); draw(); };
      $('button', row).onclick = save; inp.onkeydown = (e) => { if (e.key === 'Enter') save(); };
    });
  };
  draw().catch(() => { host.innerHTML = '<div class="empty">حصل خطأ — جرّب تاني</div>'; });
}

// ---------------------------------------------------------------- owner view: every admin login
export async function staffLogins(host) {
  if (!host) return;
  host.innerHTML = '<div class="spin"></div>';
  const { data, error } = await sb.from('staff_logins').select('at,email,method,device,ip,new_device').order('at', { ascending: false }).limit(300);
  if (!host.isConnected) return;
  if (error) { host.innerHTML = `<div class="card empty">${esc(error.message)}</div>`; return; }
  const rows = data || [];
  const fresh = rows.filter((r) => r.new_device && Date.now() - new Date(r.at) < 7 * 864e5).length;
  let onlyNew = false;
  const draw = () => {
    const list = onlyNew ? rows.filter((r) => r.new_device) : rows;
    $('[data-sl]', host).innerHTML = `<div class="tw"><table class="t"><thead><tr><th>الوقت</th><th>العضو</th><th>الطريقة</th><th>الجهاز</th><th>IP</th></tr></thead><tbody>
      ${list.map((l) => `<tr class="${l.new_device ? 'sl-new' : ''}"><td class="small">${when(l.at)}</td><td class="mono small">${esc(l.email || '—')}</td><td>${METHOD_AR[l.method] || esc(l.method)}</td>
        <td class="small">${esc(l.device || '—')}${l.new_device ? ' <span class="chip a">🆕 جهاز جديد</span>' : ''}</td><td class="small mono">${esc(l.ip || '—')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">لسه مفيش سجل</td></tr>'}
      </tbody></table></div>`;
  };
  host.innerHTML = `<section class="card sl-card">
    <div class="ph" style="margin-bottom:8px"><h3 style="margin:0">🛡️ سجل دخول الإدارة</h3>
      <label class="small row" style="gap:6px"><input type="checkbox" data-slnew> الأجهزة الجديدة بس${fresh ? ` <span class="chip a">${fresh} آخر 7 أيام</span>` : ''}</label></div>
    <p class="small muted" style="margin:0 0 8px">كل مرة حد من الفريق بيدخل بيتسجل هنا. لو حد دخل من جهاز جديد بيوصلك إشعار على الموبايل (لو مفعّل التقرير اليومي).</p>
    <div data-sl></div></section>`;
  $('[data-slnew]', host).onchange = (e) => { onlyNew = e.target.checked; draw(); };
  draw();
}
