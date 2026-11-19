// Passkey (fingerprint / face) registration and login for partners and admin staff (same passkeys table).
// Login success returns a one-time magic-link token_hash; the browser exchanges it with supabase.auth.verifyOtp.
// 'log-login' records an admin sign-in (staff_logins) and alerts owners by push when it comes from a new device.
import {
  generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse,
} from 'npm:@simplewebauthn/server@13.1.1';
import { isoBase64URL } from 'npm:@simplewebauthn/server@13.1.1/helpers';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Each site origin gets its own relying-party id (passkeys are bound to the domain they were made on).
const RP: Record<string, string> = {
  'https://fullspeed-freelance.pages.dev': 'fullspeed-freelance.pages.dev',
  'https://freelance.fullspeedlogistics.com': 'freelance.fullspeedlogistics.com',
};
const ORIGINS = Object.keys(RP);
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

function cors(origin: string) {
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  };
}

async function userFrom(req: Request) {
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const { data } = await sb.auth.getUser(jwt);
  return data.user ?? null;
}
async function putChallenge(challenge: string, userId: string | null) {
  await sb.from('webauthn_challenges').delete().lt('expires_at', new Date().toISOString());
  const { data, error } = await sb.from('webauthn_challenges').insert({ challenge, user_id: userId }).select('id').single();
  if (error) throw error;
  return data.id as string;
}
async function takeChallenge(id: string, userId: string | null) {
  const { data } = await sb.from('webauthn_challenges').select('challenge,user_id,expires_at').eq('id', id).maybeSingle();
  if (!data) return null;
  await sb.from('webauthn_challenges').delete().eq('id', id);
  if (new Date(data.expires_at) < new Date() || (userId && data.user_id !== userId)) return null;
  return data.challenge as string;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? '';
  const h = cors(origin);
  const RP_ID = RP[origin];
  if (req.method !== 'OPTIONS' && !RP_ID) return new Response(JSON.stringify({ error: 'origin' }), { status: 403, headers: h });
  const reply = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: h });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method !== 'POST') return reply({ error: 'method' }, 405);
  const body = await req.json().catch(() => ({}));

  try {
    switch (body.action) {
      case 'register-options': {
        const user = await userFrom(req);
        if (!user) return reply({ error: 'unauthorized' }, 401);
        const { data: existing } = await sb.from('passkeys').select('id,transports').eq('user_id', user.id);
        const options = await generateRegistrationOptions({
          rpName: body.app === 'admin' ? 'Full Speed Admin' : 'Full Speed Partners', rpID: RP_ID,
          userName: String(body.label || user.email || 'partner').slice(0, 64),
          userID: new TextEncoder().encode(user.id),
          attestationType: 'none',
          authenticatorSelection: { residentKey: 'required', userVerification: 'required', authenticatorAttachment: 'platform' },
          excludeCredentials: (existing ?? []).map((c) => ({ id: c.id, transports: c.transports ?? undefined })),
        });
        return reply({ options, cid: await putChallenge(options.challenge, user.id) });
      }
      case 'register-verify': {
        const user = await userFrom(req);
        if (!user) return reply({ error: 'unauthorized' }, 401);
        const expectedChallenge = await takeChallenge(String(body.cid), user.id);
        if (!expectedChallenge) return reply({ error: 'expired' }, 400);
        const v = await verifyRegistrationResponse({
          response: body.response, expectedChallenge, expectedOrigin: origin, expectedRPID: RP_ID, requireUserVerification: true,
        });
        if (!v.verified || !v.registrationInfo) return reply({ error: 'not_verified' }, 400);
        const c = v.registrationInfo.credential;
        const { error } = await sb.from('passkeys').insert({
          id: c.id, user_id: user.id, public_key: isoBase64URL.fromBuffer(c.publicKey), counter: c.counter,
          transports: c.transports ?? body.response?.response?.transports ?? null, device: String(body.device || '').slice(0, 80) || null,
        });
        if (error) return reply({ error: 'save_failed' }, 400);
        return reply({ ok: true });
      }
      case 'login-options': {
        const options = await generateAuthenticationOptions({ rpID: RP_ID, userVerification: 'required', allowCredentials: [] });
        return reply({ options, cid: await putChallenge(options.challenge, null) });
      }
      case 'login-verify': {
        const expectedChallenge = await takeChallenge(String(body.cid), null);
        if (!expectedChallenge) return reply({ error: 'expired' }, 400);
        const { data: pk } = await sb.from('passkeys').select('id,user_id,public_key,counter,transports').eq('id', String(body.response?.id ?? '')).maybeSingle();
        if (!pk) return reply({ error: 'unknown_passkey' }, 400);
        const v = await verifyAuthenticationResponse({
          response: body.response, expectedChallenge, expectedOrigin: origin, expectedRPID: RP_ID, requireUserVerification: true,
          credential: { id: pk.id, publicKey: isoBase64URL.toBuffer(pk.public_key), counter: Number(pk.counter), transports: pk.transports ?? undefined },
        });
        if (!v.verified) return reply({ error: 'not_verified' }, 400);
        await sb.from('passkeys').update({ counter: v.authenticationInfo.newCounter, last_used_at: new Date().toISOString() }).eq('id', pk.id);
        if (body.app === 'admin') {
          // The admin login screen only issues sessions to active staff.
          const { data: st } = await sb.from('staff').select('active').eq('user_id', pk.user_id).maybeSingle();
          if (!st?.active) return reply({ error: 'not_staff' }, 403);
        }
        const { data: u } = await sb.auth.admin.getUserById(pk.user_id);
        if (!u.user?.email) return reply({ error: 'no_user' }, 400);
        const { data: link, error } = await sb.auth.admin.generateLink({ type: 'magiclink', email: u.user.email });
        if (error || !link?.properties?.hashed_token) return reply({ error: 'session_failed' }, 500);
        return reply({ token_hash: link.properties.hashed_token });
      }
      case 'log-login': {
        const user = await userFrom(req);
        if (!user) return reply({ error: 'unauthorized' }, 401);
        const { data: st } = await sb.from('staff').select('email,role,active').eq('user_id', user.id).maybeSingle();
        if (!st?.active) return reply({ error: 'not_staff' }, 403);
        const deviceHash = String(body.device_hash ?? '').replace(/[^\w-]/g, '').slice(0, 64);
        if (deviceHash.length < 8) return reply({ error: 'bad_device' }, 400);
        const method = ['password', 'passkey', 'session'].includes(body.method) ? body.method : 'session';
        const device = String(body.device ?? '').slice(0, 80) || null;
        const ip = (req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0] ?? '').trim().slice(0, 64) || null;
        const { count } = await sb.from('staff_logins').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('device_hash', deviceHash);
        const isNew = !count;
        const { error } = await sb.from('staff_logins').insert({
          user_id: user.id, email: st.email, method, device_hash: deviceHash, device, ua: String(req.headers.get('user-agent') ?? '').slice(0, 300), ip, new_device: isNew,
        });
        if (error) return reply({ error: 'save_failed' }, 500);
        if (isNew) {
          // Best effort: a failed push must not block the sign-in.
          const { data: k } = await sb.from('app_secrets').select('value').eq('key', 'push_key').maybeSingle();
          if (k?.value) {
            await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/push`, {
              method: 'POST', headers: { 'Content-Type': 'application/json', 'x-push-key': k.value },
              body: JSON.stringify({ action: 'staff_alert', roles: ['owner'], title: '🛡️ دخول من جهاز جديد', body: `${st.email} — ${device || 'جهاز'}${ip ? ` • ${ip}` : ''}`, url: '/admin/?go=staff', tag: `login-${deviceHash}` }),
            }).catch((e) => console.error('alert push failed', (e as Error).message));
          }
        }
        return reply({ ok: true, new_device: isNew });
      }
      default:
        return reply({ error: 'bad_action' }, 400);
    }
  } catch (e) {
    console.error('passkey error', (e as Error).message);
    return reply({ error: 'server' }, 500);
  }
});
