// Full Speed Freelance — claim edge function
// A partner from the old Google Sheet app moves to the new app: mobile + OLD password (proof of ownership) + new password.
// The old passwords were imported only as bcrypt hashes (private.legacy_passwords). On success the new password is
// set on the partner's login (created if missing) and the old hash is deleted. 5 wrong tries lock the account for 1 hour.
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGINS = ["https://fullspeed-freelance.pages.dev", "https://freelance.fullspeedlogistics.com"];
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

function normMobile(v: string): string {
  let d = String(v ?? "").replace(/\D/g, "");
  if (d.startsWith("0020")) d = d.slice(4);
  else if (d.startsWith("20") && d.length === 12) d = d.slice(2);
  return d.replace(/^0+/, "");
}
const authEmail = (m: string) => `m${normMobile(m)}@fl.fullspeedlogistics.com`;

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const h = {
    "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
  const reply = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: h });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return reply({ error: "method" }, 405);

  try {
    const ip = (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "").trim().slice(0, 64) || "unknown";
    const { data: okIp } = await sb.rpc("svc_rate_ok", { p_key: `claim:${ip}`, p_max: ip === "unknown" ? 200 : 20, p_secs: 3600 });
    if (okIp === false) return reply({ error: "rate_limited" }, 429);

    const body = await req.json().catch(() => ({}));
    const mobile = normMobile(body.mobile);
    const oldPw = String(body.old_password ?? "");
    const newPw = String(body.new_password ?? "");
    if (!/^1[0125]\d{8}$/.test(mobile)) return reply({ error: "invalid_mobile" }, 400);
    if (!oldPw) return reply({ error: "wrong_old_password" }, 400);
    if (newPw.length < 6) return reply({ error: "weak_password" }, 400);

    // One RPC does the lookup, the lock check, the bcrypt compare and the attempt counter, atomically.
    const { data: r, error: e1 } = await sb.rpc("svc_check_legacy_password", { p_mobile: mobile, p_password: oldPw });
    if (e1) { console.error("claim check", e1.message); return reply({ error: "server" }, 500); }
    if (r?.result !== "ok") return reply({ error: r?.result ?? "not_found", minutes: r?.minutes ?? null }, 400);
    const fid: string = r.freelancer_id;

    const { data: f } = await sb.from("freelancers").select("id,user_id,mobile,status").eq("id", fid).maybeSingle();
    if (!f) return reply({ error: "not_found" }, 400);
    if (f.status === "Inactive") return reply({ error: "account_suspended" }, 400);
    if (f.user_id) {
      const { data: st } = await sb.from("staff").select("user_id").eq("user_id", f.user_id).maybeSingle();
      if (st) return reply({ error: "not_found" }, 400); // never touch a staff login
      const { error } = await sb.auth.admin.updateUserById(f.user_id, { password: newPw });
      if (error) { console.error("claim update", error.message); return reply({ error: /Password should be|weak/i.test(error.message) ? "weak_password" : "server" }, 400); }
      await sb.rpc("svc_kill_sessions", { p_user: f.user_id });
    } else {
      await sb.from("trusted_signups").upsert({ email: authEmail(f.mobile), created_at: new Date().toISOString(), used_at: null });
      const c = await sb.auth.admin.createUser({ email: authEmail(f.mobile), password: newPw, email_confirm: true, user_metadata: { kind: "legacy" } });
      if (c.error) { console.error("claim create", c.error.message); return reply({ error: /Password should be|weak/i.test(c.error.message) ? "weak_password" : "server" }, 400); }
      const { error } = await sb.from("freelancers").update({ user_id: c.data.user.id }).eq("id", f.id).is("user_id", null);
      if (error) { console.error("claim link", error.message); return reply({ error: "server" }, 500); }
    }
    // The old password has done its job: forget it.
    await sb.rpc("svc_forget_legacy_password", { p_freelancer: f.id });
    await sb.from("audit_log").insert({ actor_role: "partner", action: "freelancer.claim_legacy", table_name: "freelancers", record_id: f.id, after: { ip, had_login: !!f.user_id } });
    return reply({ ok: true });
  } catch (e) {
    console.error("claim failed", (e as Error).message);
    return reply({ error: "server" }, 500);
  }
});
