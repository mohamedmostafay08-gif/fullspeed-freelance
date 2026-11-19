// Public courier sign-up from a partner's referral link (no login).
import { sb, $, $$, esc, normMobile, logoImg, toast } from './shared/common.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, TURNSTILE_SITE_KEY } from './shared/config.js';

const ref = new URLSearchParams(location.search).get('r') || '';
const root = $('#jn');
const VEH_EMOJI = { 'موتوسيكل': '🏍️', 'سيارة': '🚗', 'دراجة / اسكوتر': '🛴', 'تروسيكل': '🛺', 'مترجل (بدون مركبة)': '🚶' };
const ERR = {
  invalid_ref: 'اللينك ده مش شغال. اطلب من الشخص اللي بعتهولك لينك جديد.',
  invalid_input: 'اكتب اسمك ورقم موبايل مصري صحيح (11 رقم يبدأ بـ 01).',
  rate_limited: 'في تسجيلات كتير دلوقتي، جرّب تاني بعد شوية.',
  courier_exists: 'الرقم ده متسجل عندنا قبل كده — هنكلمك قريب إن شاء الله.',
  job_closed: 'الوظيفة دي اتقفلت، اختار وظيفة تانية.',
  job_full: 'الوظيفة دي اكتمل عددها، اختار وظيفة تانية.',
  captcha: 'لازم تأكد إنك مش روبوت الأول.',
};
const page = (html) => { root.innerHTML = html; };
const brand = '<img class="brand-logo" src="brand/fs-logo.png" alt="Full Speed — The Future of Logistics" width="640" height="640">';

let tsToken = '';
function loadTurnstile() {
  if (!TURNSTILE_SITE_KEY) return;
  window.onTsLoad = () => window.turnstile.render('#ts', { sitekey: TURNSTILE_SITE_KEY, language: 'ar', callback: (t) => { tsToken = t; }, 'expired-callback': () => { tsToken = ''; } });
  const s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTsLoad&render=explicit'; s.async = true;
  document.head.appendChild(s);
}

async function start() {
  if (!/^[a-z0-9]{4,12}$/i.test(ref)) return page(`<div class="jn-card">${brand}<h1>اللينك مش كامل</h1><p class="muted">اطلب من الشخص اللي بعتهولك يبعته تاني.</p></div>`);
  const { data, error } = await sb.rpc('public_ref_info', { p_ref: ref });
  if (error || !data) return page(`<div class="jn-card">${brand}<h1>اللينك ده مش شغال</h1><p class="muted">${esc(ERR.invalid_ref)}</p></div>`);
  const jobs = data.jobs || [];
  if (!jobs.length) return page(`<div class="jn-card">${brand}<h1>مفيش وظايف متاحة دلوقتي</h1><p class="muted">ارجع للينك ده بعد كام يوم، بننزّل وظايف جديدة باستمرار.</p></div>`);
  page(`
    <header class="jn-hero">${brand}
      <h1>🚀 ${esc(data.partner || 'صاحبك')} بيدعوك تشتغل مع <span class="grad">Full Speed</span></h1>
      <p>اختار الوظيفة اللي تناسبك وسجّل بياناتك في دقيقة — هنكلمك ونكمّل معاك.</p>
    </header>
    <section class="jn-step"><h2><i>1</i> اختار الوظيفة</h2>
      <div class="jn-jobs">${jobs.map((j, k) => `<label class="jn-job rise" style="--i:${Math.min(k, 8)}">
        <input type="radio" name="job" value="${esc(j.id)}" ${jobs.length === 1 ? 'checked' : ''}>
        <span class="jn-jc">
          <span class="jlogo" style="--h:${(j.company || '').length * 37 % 360}">${j.logo_url ? logoImg(j.logo_url, (j.company || '').slice(0, 2)) : esc((j.company || '?').slice(0, 2))}</span>
          <span class="grow"><b>${esc(j.title)}</b><span>${esc(j.company || '')} · 📍 ${esc([j.gov, j.region].filter(Boolean).join(' — '))}</span>
            <span class="jn-tags">${j.vehicle ? `<em>${VEH_EMOJI[j.vehicle] || '🛵'} ${esc(j.vehicle)}</em>` : ''}${j.work_type ? `<em>${esc(j.work_type)}</em>` : ''}</span>
            ${j.pricing ? `<span class="jn-pay">💰 ${esc(j.pricing)}</span>` : ''}</span>
          <span class="jn-check" aria-hidden="true">✓</span>
        </span></label>`).join('')}</div>
    </section>
    <section class="jn-step"><h2><i>2</i> بياناتك</h2>
      <form class="card stack" id="jf" novalidate>
        <div><label class="f" for="jn-name">اسمك بالكامل</label><input class="in" id="jn-name" name="name" required maxlength="120" autocomplete="name"></div>
        <div><label class="f" for="jn-mob">رقم موبايلك</label><input class="in mono" id="jn-mob" name="mobile" required inputmode="tel" autocomplete="tel" placeholder="01xxxxxxxxx"></div>
        <div><label class="f" for="jn-reg">منطقتك</label><input class="in" id="jn-reg" name="region" maxlength="100" placeholder="مثلاً: مدينة نصر"></div>
        <div id="ts"></div>
        <div class="err" data-err></div>
        <button class="btn pri block">سجّلني دلوقتي 🚀</button>
        <p class="muted small" style="text-align:center;margin:0">بياناتك بتروح لفريق Full Speed بس.</p>
      </form>
    </section>`);
  loadTurnstile();
  const f = $('#jf'), err = $('[data-err]', f);
  f.onsubmit = async (e) => {
    e.preventDefault(); err.textContent = '';
    const job = $('input[name=job]:checked')?.value;
    if (!job) { err.textContent = 'اختار الوظيفة الأول من فوق.'; $('.jn-jobs').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (!f.name.value.trim() || !/^1[0125]\d{8}$/.test(normMobile(f.mobile.value))) { err.textContent = ERR.invalid_input; return; }
    if (TURNSTILE_SITE_KEY && !tsToken) { err.textContent = ERR.captcha; return; }
    const btn = $('button', f); btn.disabled = true; btn.textContent = 'بنسجّل...';
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/join`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ ref, job_id: job, name: f.name.value.trim(), mobile: f.mobile.value.trim(), region: f.region.value.trim(), token: tsToken }),
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok || !out.ok) {
        err.textContent = ERR[out.error] || 'حصلت مشكلة، جرّب تاني.';
        if (out.error === 'captcha' && window.turnstile) { window.turnstile.reset('#ts'); tsToken = ''; }
        return;
      }
      done(jobs.find((j) => String(j.id) === job), data.partner);
    } catch { err.textContent = 'مفيش اتصال بالإنترنت، جرّب تاني.'; }
    finally { btn.disabled = false; btn.textContent = 'سجّلني دلوقتي 🚀'; }
  };
}

function done(job, partner) {
  window.scrollTo(0, 0);
  page(`<div class="jn-card jn-done">${brand}<div class="jn-ok">🎉</div><h1>تم التسجيل!</h1>
    <p>سجّلنا بياناتك على وظيفة <b>${esc(job?.title || '')}</b>${job?.company ? ` في <b>${esc(job.company)}</b>` : ''}.</p>
    <p class="muted">فريق Full Speed هيكلمك قريب. ولو عندك سؤال كلّم ${esc(partner || 'الشخص اللي بعتلك اللينك')}.</p></div>`);
  toast('تم التسجيل ✅', 'ok');
}

start();
