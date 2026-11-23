// Web push sender.
// GET  -> { publicKey } (VAPID keys are generated once and kept in app_secrets, never leave the server)
// POST -> { id } from the notifications_push DB trigger, or { action: 'daily_report' | 'weekly_report' } from pg_cron,
//         or { action: 'staff_alert', roles, title, body, url } from other edge functions. All use x-push-key.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};
const reply = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: CORS });

async function secret(key: string): Promise<string | null> {
  const { data } = await sb.from('app_secrets').select('value').eq('key', key).maybeSingle();
  return data?.value ?? null;
}
async function vapid() {
  let pub = await secret('vapid_public'), priv = await secret('vapid_private');
  if (!pub || !priv) {
    const k = webpush.generateVAPIDKeys();
    await sb.from('app_secrets').upsert(
      [{ key: 'vapid_public', value: k.publicKey }, { key: 'vapid_private', value: k.privateKey }],
      { onConflict: 'key', ignoreDuplicates: true },
    );
    pub = await secret('vapid_public'); priv = await secret('vapid_private');
  }
  return { pub: pub!, priv: priv! };
}

// Sends in chunks of 50 at a time (a big broadcast must not open hundreds of connections at once),
// then writes the results in two queries instead of one per subscription.
async function sendTo(table: string, subs: { id: number; endpoint: string; p256dh: string; auth: string }[], payload: string) {
  const ok: number[] = [];
  const gone: number[] = [];
  for (let i = 0; i < subs.length; i += 50) {
    await Promise.all(subs.slice(i, i + 50).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 43200, urgency: 'normal' });
        ok.push(s.id);
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(s.id);
        else console.error('push failed', code, (e as Error).message);
      }
    }));
  }
  for (let i = 0; i < ok.length; i += 500) await sb.from(table).update({ last_ok_at: new Date().toISOString() }).in('id', ok.slice(i, i + 500));
  for (let i = 0; i < gone.length; i += 500) await sb.from(table).delete().in('id', gone.slice(i, i + 500));
  return ok.length;
}

// Constant-time comparison so the push key can't be guessed from response timing.
function sameKey(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}
const fmt = (n: number) => Number(n || 0).toLocaleString('en-US');
async function dailyReport() {
  const subs = await staffSubs();
  if (!subs?.length) return { sent: 0 };
  const { data: r, error } = await sb.rpc('daily_report_data');
  if (error || !r) { console.error('report failed', error?.message); return { error: 'report' }; }
  const parts = [
    `${fmt(r.new_candidates)} ترشيح جديد${r.self_joins ? ` (${fmt(r.self_joins)} من اللينكات)` : ''}`,
    `${fmt(r.started)} بدأوا شغل`,
    r.wd_pending ? `${fmt(r.wd_pending)} طلب سحب مستني (${fmt(r.wd_amount)} ج)` : '',
    r.unread_msgs ? `${fmt(r.unread_msgs)} رسالة من الشركاء مستنية رد` : '',
    r.stale ? `${fmt(r.stale)} ترشيح متأخر في المراجعة` : '',
    r.pending_partners ? `${fmt(r.pending_partners)} شريك جديد مستني تفعيل` : '',
    r.errors ? `${fmt(r.errors)} خطأ في التطبيق` : '',
  ].filter(Boolean);
  const { pub, priv } = await vapid();
  webpush.setVapidDetails('mailto:no-reply@fullspeedlogistics.com', pub, priv);
  const payload = JSON.stringify({ title: '📊 تقرير Full Speed النهارده', body: parts.join(' · '), url: '/admin/', tag: 'daily-report' });
  return { sent: await sendTo('staff_push_subscriptions', subs, payload) };
}

// Only active staff ever receive staff pushes (reports carry money figures); optionally limited to some roles.
async function staffSubs(roles?: string[]) {
  const { data: subs } = await sb.from('staff_push_subscriptions').select('id,user_id,endpoint,p256dh,auth');
  if (!subs?.length) return [];
  let q = sb.from('staff').select('user_id').eq('active', true);
  if (roles?.length) q = q.in('role', roles);
  const { data: st } = await q;
  const ok = new Set((st ?? []).map((x) => x.user_id));
  return subs.filter((s) => ok.has(s.user_id));
}
async function sendStaff(subs: { id: number; endpoint: string; p256dh: string; auth: string }[], msg: Record<string, string>) {
  if (!subs.length) return { sent: 0 };
  const { pub, priv } = await vapid();
  webpush.setVapidDetails('mailto:no-reply@fullspeedlogistics.com', pub, priv);
  return { sent: await sendTo('staff_push_subscriptions', subs, JSON.stringify(msg)) };
}
const delta = (a: number, b: number) => (b ? ` (${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%)` : '');
async function weeklyReport() {
  const subs = await staffSubs();
  if (!subs.length) return { sent: 0 };
  const { data: r, error } = await sb.rpc('weekly_report_data');
  if (error || !r) { console.error('weekly report failed', error?.message); return { error: 'report' }; }
  const body = [
    `${fmt(r.nominations)} ترشيح${delta(r.nominations, r.nominations_prev)}`,
    `${fmt(r.hires)} بدأوا شغل`,
    `${fmt(r.new_partners)} شريك جديد`,
    `بونص ${fmt(r.bonus)} ج`,
  ].join(' · ');
  return sendStaff(subs, { title: '📄 التقرير الأسبوعي جاهز', body, url: '/admin/?go=report', tag: 'weekly-report' });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method === 'GET') return reply({ publicKey: (await vapid()).pub });
  if (req.method !== 'POST') return reply({ error: 'method' }, 405);

  const key = await secret('push_key');
  if (!key || !sameKey(req.headers.get('x-push-key') ?? '', key)) return reply({ error: 'unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  if (body.action === 'daily_report') return reply(await dailyReport());
  if (body.action === 'weekly_report') return reply(await weeklyReport());
  if (body.action === 'staff_alert') {
    const roles = Array.isArray(body.roles) ? body.roles.map(String) : ['owner'];
    return reply(await sendStaff(await staffSubs(roles), {
      title: String(body.title ?? '').slice(0, 120), body: String(body.body ?? '').slice(0, 300),
      url: String(body.url ?? '/admin/').startsWith('/admin') ? String(body.url ?? '/admin/') : '/admin/', tag: String(body.tag ?? 'staff-alert').slice(0, 60),
    }));
  }
  const { id } = body;
  const { data: n } = await sb.from('notifications').select('id,freelancer_id,kind,title,body,link').eq('id', id).maybeSingle();
  if (!n) return reply({ error: 'not_found' }, 404);
  const { data: subs } = await sb.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('freelancer_id', n.freelancer_id);
  if (!subs?.length) return reply({ sent: 0 });

  const { pub, priv } = await vapid();
  webpush.setVapidDetails('mailto:no-reply@fullspeedlogistics.com', pub, priv);
  const payload = JSON.stringify({ title: n.title, body: n.body ?? '', link: n.link ?? '', tag: `${n.kind}-${n.id}` });

  const sent = await sendTo('push_subscriptions', subs, payload);
  return reply({ sent });
});
