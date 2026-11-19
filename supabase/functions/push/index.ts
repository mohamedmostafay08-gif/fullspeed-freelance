// Web push sender.
// GET  -> { publicKey } (VAPID keys are generated once and kept in app_secrets, never leave the server)
// POST -> { id } from the notifications_push DB trigger, authenticated with x-push-key.
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

async function sendTo(table: string, subs: { id: number; endpoint: string; p256dh: string; auth: string }[], payload: string) {
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 43200, urgency: 'normal' });
      sent++;
      await sb.from(table).update({ last_ok_at: new Date().toISOString() }).eq('id', s.id);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sb.from(table).delete().eq('id', s.id);
      else console.error('push failed', code, (e as Error).message);
    }
  }));
  return sent;
}

const fmt = (n: number) => Number(n || 0).toLocaleString('en-US');
async function dailyReport() {
  const { data: subs } = await sb.from('staff_push_subscriptions').select('id,endpoint,p256dh,auth');
  if (!subs?.length) return { sent: 0 };
  const { data: r, error } = await sb.rpc('daily_report_data');
  if (error || !r) { console.error('report failed', error?.message); return { error: 'report' }; }
  const parts = [
    `${fmt(r.new_candidates)} ترشيح جديد${r.self_joins ? ` (${fmt(r.self_joins)} من اللينكات)` : ''}`,
    `${fmt(r.started)} بدأوا شغل`,
    r.wd_pending ? `${fmt(r.wd_pending)} طلب سحب مستني (${fmt(r.wd_amount)} ج)` : '',
    r.unread_msgs ? `${fmt(r.unread_msgs)} رسالة من الشركاء مستنية رد` : '',
    r.stale ? `${fmt(r.stale)} ترشيح متأخر +48 ساعة` : '',
    r.pending_partners ? `${fmt(r.pending_partners)} شريك جديد مستني تفعيل` : '',
    r.errors ? `${fmt(r.errors)} خطأ في التطبيق` : '',
  ].filter(Boolean);
  const { pub, priv } = await vapid();
  webpush.setVapidDetails('mailto:no-reply@fullspeedlogistics.com', pub, priv);
  const payload = JSON.stringify({ title: '📊 تقرير Full Speed النهارده', body: parts.join(' · '), url: '/admin/', tag: 'daily-report' });
  return { sent: await sendTo('staff_push_subscriptions', subs, payload) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method === 'GET') return reply({ publicKey: (await vapid()).pub });
  if (req.method !== 'POST') return reply({ error: 'method' }, 405);

  const key = await secret('push_key');
  if (!key || req.headers.get('x-push-key') !== key) return reply({ error: 'unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  if (body.action === 'daily_report') return reply(await dailyReport());
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
