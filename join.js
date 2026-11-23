// Public courier sign-up from a partner's referral link (no login). Arabic by default, English on demand.
import { sb, $, $$, esc, normMobile, logoImg, toast } from './shared/common.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, TURNSTILE_SITE_KEY } from './shared/config.js';

const ref = new URLSearchParams(location.search).get('r') || '';
const root = $('#jn');
const VEH_EMOJI = { 'موتوسيكل': '🏍️', 'سيارة': '🚗', 'دراجة / اسكوتر': '🛴', 'تروسيكل': '🛺', 'مترجل (بدون مركبة)': '🚶' };
const VEH_EN = { 'موتوسيكل': 'Motorcycle', 'سيارة': 'Car', 'دراجة / اسكوتر': 'Bicycle / scooter', 'تروسيكل': 'Tricycle', 'مترجل (بدون مركبة)': 'On foot' };

const L = {
  ar: {
    dir: 'rtl', switch: 'English', title: 'اشتغل مع Full Speed',
    badLink: 'اللينك مش كامل', badLinkSub: 'اطلب من الشخص اللي بعتهولك يبعته تاني.',
    deadLink: 'اللينك ده مش شغال', noJobs: 'مفيش وظايف متاحة دلوقتي', noJobsSub: 'ارجع للينك ده بعد كام يوم، بننزّل وظايف جديدة باستمرار.',
    friend: 'صاحبك', invites: (p) => `🚀 ${p} بيدعوك تشتغل مع <span class="grad">Full Speed</span>`,
    lead: 'اختار الوظيفة اللي تناسبك وسجّل بياناتك في دقيقة — هنكلمك ونكمّل معاك.',
    pick: 'اختار الوظيفة', search: 'دوّر بالمنطقة أو الشركة أو الوظيفة...', allGov: 'كل المحافظات', more: 'اعرض وظايف أكتر', none: 'مفيش وظايف مطابقة — جرّب كلمة تانية.',
    you: 'بياناتك', name: 'اسمك بالكامل', mobile: 'رقم موبايلك', region: 'منطقتك', regionPh: 'مثلاً: مدينة نصر',
    submit: 'سجّلني دلوقتي 🚀', sending: 'بنسجّل...', privacy: 'بياناتك بتروح لفريق Full Speed بس.', pickFirst: 'اختار الوظيفة الأول من فوق.',
    offline: 'مفيش اتصال بالإنترنت، جرّب تاني.', generic: 'حصلت مشكلة، جرّب تاني.', retry: 'جرّب تاني', offlineTitle: 'النت فاصل',
    done: 'تم التسجيل!', doneJob: (t, c) => `سجّلنا بياناتك على وظيفة <b>${t}</b>${c ? ` في <b>${c}</b>` : ''}.`,
    doneSub: (p) => `فريق Full Speed هيكلمك قريب. ولو عندك سؤال كلّم ${p}.`, doneWho: 'الشخص اللي بعتلك اللينك', toast: 'تم التسجيل ✅',
    pay: 'التسعيرة',
    err: {
      invalid_ref: 'اللينك ده مش شغال. اطلب من الشخص اللي بعتهولك لينك جديد.',
      invalid_input: 'اكتب اسمك ورقم موبايل مصري صحيح (11 رقم يبدأ بـ 01).',
      rate_limited: 'في تسجيلات كتير دلوقتي، جرّب تاني بعد شوية.',
      courier_exists: 'الرقم ده متسجل عندنا قبل كده — هنكلمك قريب إن شاء الله.',
      job_closed: 'الوظيفة دي اتقفلت، اختار وظيفة تانية.',
      job_full: 'الوظيفة دي اكتمل عددها، اختار وظيفة تانية.',
      captcha: 'لازم تأكد إنك مش روبوت الأول.',
      account_frozen: 'اللينك ده موقوف مؤقتاً. كلّم الشخص اللي بعتهولك.',
    },
  },
  en: {
    dir: 'ltr', switch: 'عربي', title: 'Work with Full Speed',
    badLink: 'This link is incomplete', badLinkSub: 'Ask the person who sent it to share it again.',
    deadLink: 'This link is not active', noJobs: 'No open jobs right now', noJobsSub: 'Check this link again in a few days — new jobs are added all the time.',
    friend: 'Your friend', invites: (p) => `🚀 ${p} invites you to work with <span class="grad">Full Speed</span>`,
    lead: 'Pick the job that suits you and register in a minute — our team will call you.',
    pick: 'Choose a job', search: 'Search by area, company or job...', allGov: 'All governorates', more: 'Show more jobs', none: 'No matching jobs — try another word.',
    you: 'Your details', name: 'Full name', mobile: 'Mobile number', region: 'Your area', regionPh: 'e.g. Nasr City',
    submit: 'Register now 🚀', sending: 'Registering...', privacy: 'Your details go to the Full Speed team only.', pickFirst: 'Choose a job first.',
    offline: 'No internet connection, please try again.', generic: 'Something went wrong, please try again.', retry: 'Try again', offlineTitle: 'You are offline',
    done: 'You are registered!', doneJob: (t, c) => `We registered you for <b>${t}</b>${c ? ` at <b>${c}</b>` : ''}.`,
    doneSub: (p) => `The Full Speed team will call you soon. Questions? Contact ${p}.`, doneWho: 'the person who sent you the link', toast: 'Registered ✅',
    pay: 'Pay',
    err: {
      invalid_ref: 'This link is not active. Ask for a new one.',
      invalid_input: 'Enter your name and a valid Egyptian mobile number (11 digits starting with 01).',
      rate_limited: 'Too many sign-ups right now, please try again shortly.',
      courier_exists: 'This number is already registered — we will call you soon.',
      job_closed: 'This job just closed, please choose another.',
      job_full: 'This job is full, please choose another.',
      captcha: 'Please confirm you are not a robot first.',
      account_frozen: 'This link is paused for now. Contact the person who sent it.',
    },
  },
};
let lang = (() => { try { return localStorage.getItem('fsf-lang') || 'ar'; } catch { return 'ar'; } })();
if (!L[lang]) lang = 'ar';
const t = () => L[lang];

const track = (ev) => { sb.rpc('track_event', { p_event: ev }).then(() => {}, () => {}); };
let errCount = 0;
const reportError = (message, stack) => {
  if (errCount++ >= 5 || !message || /ResizeObserver|Script error/i.test(message)) return;
  sb.rpc('log_client_error', { p: { app: 'join', message: String(message).slice(0, 500), stack: String(stack || '').slice(0, 2000), url: location.pathname, ua: navigator.userAgent } }).then(() => {}, () => {});
};
addEventListener('error', (e) => reportError(e.message, e.error?.stack));
addEventListener('unhandledrejection', (e) => reportError(e.reason?.message || String(e.reason), e.reason?.stack));

const brand = '<img class="brand-logo" src="brand/fs-logo.png" alt="Full Speed — The Future of Logistics" width="640" height="640">';
const langBtn = () => `<button type="button" class="jn-lang" data-lang>${t().switch}</button>`;
function page(html) {
  document.documentElement.lang = lang; document.documentElement.dir = t().dir; document.title = t().title;
  root.innerHTML = langBtn() + html;
  $('[data-lang]').onclick = () => {
    lang = lang === 'ar' ? 'en' : 'ar';
    try { localStorage.setItem('fsf-lang', lang); } catch { /* storage blocked */ }
    render();
  };
}

let tsToken = '', tsWidget = null;
function mountTurnstile() {
  if (!TURNSTILE_SITE_KEY) return;
  const draw = () => { tsToken = ''; tsWidget = window.turnstile.render('#ts', { sitekey: TURNSTILE_SITE_KEY, language: lang, callback: (tk) => { tsToken = tk; }, 'expired-callback': () => { tsToken = ''; } }); };
  if (window.turnstile) return draw();
  window.onTsLoad = draw;
  if (!$('script[data-ts]')) {
    const s = document.createElement('script'); s.dataset.ts = '1';
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTsLoad&render=explicit'; s.async = true;
    document.head.appendChild(s);
  }
}

let data = null, state = 'loading', sel = '', shown = 20, doneInfo = null, form = { name: '', mobile: '', region: '' };

function render() {
  const T = t();
  if (state === 'bad') return page(`<div class="jn-card">${brand}<h1>${T.badLink}</h1><p class="muted">${T.badLinkSub}</p></div>`);
  if (state === 'offline') {
    page(`<div class="jn-card">${brand}<h1>${T.offlineTitle}</h1><p class="muted">${T.offline}</p><button class="btn pri" type="button" data-retry>${T.retry}</button></div>`);
    const b = $('[data-retry]'); if (b) b.onclick = () => { state = 'loading'; render(); start(); };
    return;
  }
  if (state === 'dead') return page(`<div class="jn-card">${brand}<h1>${T.deadLink}</h1><p class="muted">${esc(T.err.invalid_ref)}</p></div>`);
  if (state === 'empty') return page(`<div class="jn-card">${brand}<h1>${T.noJobs}</h1><p class="muted">${T.noJobsSub}</p></div>`);
  if (state === 'done') {
    const { job, partner } = doneInfo;
    return page(`<div class="jn-card jn-done">${brand}<div class="jn-ok">🎉</div><h1>${T.done}</h1>
      <p>${T.doneJob(esc(job?.title || ''), esc(job?.company || ''))}</p>
      <p class="muted">${T.doneSub(esc(partner || T.doneWho))}</p></div>`);
  }
  if (state !== 'form') return;
  const jobs = data.jobs;
  page(`
    <header class="jn-hero">${brand}
      <h1>${T.invites(esc(data.partner || T.friend))}</h1>
      <p>${T.lead}</p>
    </header>
    <section class="jn-step"><h2><i>1</i> ${T.pick} <small class="muted">(${jobs.length})</small></h2>
      ${jobs.length > 6 ? `<div class="jn-flt"><label class="search"><input placeholder="${T.search}" data-q></label>
        <select class="in" data-gov><option value="">${T.allGov}</option>${[...new Set(jobs.map((j) => j.gov).filter(Boolean))].sort().map((g) => `<option>${esc(g)}</option>`).join('')}</select></div>` : ''}
      <div class="jn-jobs"></div>
      <button type="button" class="btn sec block jn-more" hidden>${T.more}</button>
    </section>
    <section class="jn-step"><h2><i>2</i> ${T.you}</h2>
      <form class="card stack" id="jf" novalidate>
        <div><label class="f" for="jn-name">${T.name}</label><input class="in" id="jn-name" name="name" required maxlength="120" autocomplete="name" value="${esc(form.name)}"></div>
        <div><label class="f" for="jn-mob">${T.mobile}</label><input class="in mono" id="jn-mob" name="mobile" required inputmode="tel" autocomplete="tel" placeholder="01xxxxxxxxx" value="${esc(form.mobile)}"></div>
        <div><label class="f" for="jn-reg">${T.region}</label><input class="in" id="jn-reg" name="region" maxlength="100" placeholder="${T.regionPh}" value="${esc(form.region)}"></div>
        <div id="ts"></div>
        <div class="err" data-err></div>
        <button class="btn pri block">${T.submit}</button>
        <p class="muted small" style="text-align:center;margin:0">${T.privacy}</p>
      </form>
    </section>`);
  mountTurnstile();
  const card = (j, k) => `<label class="jn-job rise" style="--i:${Math.min(k, 8)}">
    <input type="radio" name="job" value="${esc(j.id)}" ${String(j.id) === sel ? 'checked' : ''}>
    <span class="jn-jc">
      <span class="jlogo" style="--h:${(j.company || '').length * 37 % 360}">${j.logo_url ? logoImg(j.logo_url, (j.company || '').slice(0, 2)) : esc((j.company || '?').slice(0, 2))}</span>
      <span class="grow"><b>${esc(j.title)}</b><span>${esc(j.company || '')} · 📍 ${esc([j.gov, j.region].filter(Boolean).join(' — '))}</span>
        <span class="jn-tags">${j.vehicle ? `<em>${VEH_EMOJI[j.vehicle] || '🛵'} ${esc(lang === 'en' ? (VEH_EN[j.vehicle] || j.vehicle) : j.vehicle)}</em>` : ''}${j.work_type ? `<em>${esc(j.work_type)}</em>` : ''}</span>
        ${j.pricing ? `<span class="jn-pay">💰 ${esc(j.pricing)}</span>` : ''}</span>
      <span class="jn-check" aria-hidden="true">✓</span>
    </span></label>`;
  const listEl = $('.jn-jobs'), more = $('.jn-more');
  const list = () => {
    const q = ($('[data-q]')?.value || '').trim().toLowerCase(), g = $('[data-gov]')?.value || '';
    const items = jobs.filter((j) => (!g || j.gov === g) && (!q || [j.title, j.company, j.gov, j.region].join(' ').toLowerCase().includes(q)));
    listEl.innerHTML = items.length ? items.slice(0, shown).map(card).join('') : `<p class="muted" style="text-align:center">${T.none}</p>`;
    more.hidden = items.length <= shown;
    $$('input[name=job]', listEl).forEach((r) => r.onchange = () => { sel = r.value; });
  };
  $('[data-q]')?.addEventListener('input', () => { shown = 20; list(); });
  $('[data-gov]')?.addEventListener('change', () => { shown = 20; list(); });
  more.onclick = () => { shown += 20; list(); };
  list();
  const f = $('#jf'), err = $('[data-err]', f);
  ['name', 'mobile', 'region'].forEach((k) => f[k].addEventListener('input', () => { form[k] = f[k].value; }));
  f.onsubmit = async (e) => {
    e.preventDefault(); err.textContent = '';
    if (!sel) { err.textContent = T.pickFirst; $('.jn-jobs').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (!f.name.value.trim() || !/^1[0125]\d{8}$/.test(normMobile(f.mobile.value))) { err.textContent = T.err.invalid_input; return; }
    if (TURNSTILE_SITE_KEY && !tsToken) { err.textContent = T.err.captcha; return; }
    const btn = $('button.pri', f); btn.disabled = true; btn.textContent = T.sending;
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/join`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ ref, job_id: sel, name: f.name.value.trim(), mobile: f.mobile.value.trim(), region: f.region.value.trim(), token: tsToken }),
      });
      const out = await r.json().catch(() => ({}));
      // The server spends the Turnstile token on every request, so always get a fresh one for the next try.
      tsToken = '';
      if (window.turnstile) { try { window.turnstile.reset(tsWidget ?? '#ts'); } catch { /* widget gone */ } }
      if (!r.ok || !out.ok) {
        err.textContent = T.err[out.error] || T.generic;
        return;
      }
      track('join:submit');
      doneInfo = { job: jobs.find((j) => String(j.id) === sel), partner: data.partner };
      state = 'done'; window.scrollTo(0, 0); render(); toast(T.toast, 'ok');
    } catch { err.textContent = T.offline; } finally { btn.disabled = false; btn.textContent = T.submit; }
  };
}

async function start() {
  track('join:view');
  if (!/^[a-z0-9]{4,12}$/i.test(ref)) { state = 'bad'; return render(); }
  let res;
  try { res = await sb.rpc('public_ref_info', { p_ref: ref }); } catch (e) { res = { error: e }; }
  // A network failure is not a dead link: let the courier retry instead of giving up.
  const netErr = res.error && (!navigator.onLine || /fetch|network|load failed/i.test(String(res.error.message || res.error)));
  if (netErr) { state = 'offline'; return render(); }
  if (res.error || !res.data) { state = 'dead'; return render(); }
  data = { ...res.data, jobs: res.data.jobs || [] };
  if (data.jobs.length === 1) sel = String(data.jobs[0].id);
  state = data.jobs.length ? 'form' : 'empty';
  render();
}

start();
