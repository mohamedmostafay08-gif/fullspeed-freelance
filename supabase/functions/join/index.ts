// Public courier self-registration from a partner's referral link.
// Verifies Cloudflare Turnstile (when TURNSTILE_SECRET is set), then calls public_join with the service role.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED = [/^https:\/\/([a-z0-9-]+\.)?fullspeed-freelance\.pages\.dev$/, /^https:\/\/freelance\.fullspeedlogistics\.com$/];
const KNOWN = ['invalid_ref', 'invalid_input', 'rate_limited', 'courier_exists', 'job_closed', 'job_full'];

function headers(origin: string) {
  const ok = ALLOWED.some((re) => re.test(origin));
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'https://fullspeed-freelance.pages.dev',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  };
}

Deno.serve(async (req) => {
  const h = headers(req.headers.get('origin') ?? '');
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: h });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method !== 'POST') return reply({ error: 'method' }, 405);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return reply({ error: 'invalid_input' }, 400); }

  const secret = Deno.env.get('TURNSTILE_SECRET');
  if (secret) {
    const form = new FormData();
    form.append('secret', secret);
    form.append('response', String(b.token ?? ''));
    const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (ip) form.append('remoteip', ip);
    const v = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
      .then((r) => r.json()).catch(() => ({ success: false }));
    if (!v.success) return reply({ error: 'captcha' }, 403);
  }

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const p = { name: b.name, mobile: b.mobile, region: b.region, job_id: b.job_id, vehicle: b.vehicle };
  const { error } = await sb.rpc('public_join', { p_ref: String(b.ref ?? ''), p });
  if (error) {
    const code = KNOWN.find((k) => error.message.includes(k));
    if (!code) console.error('public_join failed', error.message);
    return reply({ error: code ?? 'server' }, code ? 400 : 500);
  }
  return reply({ ok: true });
});
