// Full Speed Freelance — admin-users edge function
// Staff-only actions that need the service role:
//   invite_staff, reset_freelancer_password, change_freelancer_mobile, create_freelancer_login,
//   suspend_freelancer, activate_freelancer, sign_out_freelancer
// The caller's permissions are read from the database (my_perms) before anything runs.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

// Fallback only if my_perms is unavailable.
const PERMS: Record<string, string[]> = {
  owner: ["view", "partners", "couriers", "withdrawals", "companies", "jobs", "audit", "staff"],
  admin: ["view", "partners", "couriers", "withdrawals", "companies", "jobs", "audit"],
  finance: ["view", "withdrawals"],
  recruiter: ["view", "couriers", "jobs"],
  viewer: ["view"],
};

function normMobile(v: string): string {
  let d = String(v ?? "").replace(/\D/g, "");
  if (d.startsWith("0020")) d = d.slice(4);
  else if (d.startsWith("20") && d.length === 12) d = d.slice(2);
  return d.replace(/^0+/, "");
}
// Errors go back as short codes the panel translates; raw database/auth text stays in the function logs.
function fail(err: { message?: string } | null) {
  const m = String(err?.message ?? "");
  console.error("admin-users", m);
  if (/Password should be|weak/i.test(m)) return json({ error: "weak_password" }, 400);
  if (/already registered|email_exists|duplicate key/i.test(m)) return json({ error: "mobile_exists" }, 400);
  return json({ error: "failed" }, 400);
}
const authEmail = (m: string) => `m${normMobile(m)}@fl.fullspeedlogistics.com`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const caller = createClient(URL_, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await caller.auth.getUser();
    if (!u?.user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
    const { data: me } = await admin.from("staff").select("role,active,email").eq("user_id", u.user.id).maybeSingle();
    if (!me || !me.active) return json({ error: "not_staff" }, 403);
    const pr = await caller.rpc("my_perms");
    const perms: string[] = !pr.error && Array.isArray(pr.data) ? pr.data : (PERMS[me.role] ?? []);
    const can = (p: string) => me.role === "owner" || perms.includes(p);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    const audit = (act: string, table: string, id: string, after: unknown) =>
      admin.from("audit_log").insert({ actor: u.user.id, actor_email: me.email, actor_role: me.role, action: act, table_name: table, record_id: id, after });

    // ---------- invite / add staff ----------
    if (action === "invite_staff") {
      if (!can("staff")) return json({ error: "not_allowed" }, 403);
      const email = String(body.email ?? "").trim().toLowerCase();
      const role = String(body.role ?? "");
      const password = String(body.password ?? "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !PERMS[role]) return json({ error: "invalid_input" }, 400);
      if (email.endsWith("@fl.fullspeedlogistics.com")) return json({ error: "invalid_input" }, 400);

      if (password.length < 8) return json({ error: "weak_password" }, 400);
      // pre-approve this e-mail (public signup of non-freelancer e-mails is blocked once an owner exists)
      await admin.from("trusted_signups").upsert({ email, created_at: new Date().toISOString(), used_at: null });
      let userId: string | null = null;
      const created = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { kind: "staff", name: body.name ?? "" },
      });
      if (created.error) {
        // e-mail already has an account: only allowed if it is already staff (role change). Never take over others.
        const { data: st } = await admin.from("staff").select("user_id").eq("email", email).maybeSingle();
        if (!st) return json({ error: "email_exists_not_staff" }, 400);
        userId = st.user_id;
      } else userId = created.data.user.id;

      const { error } = await admin.from("staff").upsert({ user_id: userId, email, name: body.name ?? null, role, active: true });
      if (error) return fail(error);
      await audit("staff.invite", "staff", userId!, { email, role });
      return json({ ok: true, user_id: userId });
    }

    // Everything below acts on one freelancer.
    // Partner tools must never touch a staff login (that would let a partner-admin take over an owner account).
    const loadF = async () => {
      const { data } = await admin.from("freelancers").select("id,user_id,mobile,status,duplicate_of").eq("id", body.freelancer_id).maybeSingle();
      if (data?.user_id) {
        const { data: st } = await admin.from("staff").select("user_id").eq("user_id", data.user_id).maybeSingle();
        if (st) throw new Error("target_is_staff");
      }
      return data;
    };

    // ---------- freelancer password reset ----------
    if (action === "reset_freelancer_password") {
      if (!can("partners")) return json({ error: "not_allowed" }, 403);
      const password = String(body.password ?? "");
      if (password.length < 6) return json({ error: "weak_password" }, 400);
      const f = await loadF();
      if (!f?.user_id) return json({ error: "no_login" }, 400);
      const { error } = await admin.auth.admin.updateUserById(f.user_id, { password });
      if (error) return fail(error);
      // A new password should end sessions opened with the old one, unless staff chose otherwise.
      if (body.sign_out !== false) await admin.rpc("svc_kill_sessions", { p_user: f.user_id });
      await audit("freelancer.password_reset", "freelancers", f.id, { by: me.email, signed_out: body.sign_out !== false });
      return json({ ok: true });
    }

    // ---------- suspend: block login + end sessions ----------
    if (action === "suspend_freelancer") {
      if (!can("partners")) return json({ error: "not_allowed" }, 403);
      const reason = String(body.reason ?? "").trim();
      if (!reason) return json({ error: "reason_required" }, 400);
      const f = await loadF();
      if (!f) return json({ error: "not_found" }, 404);
      const { error: e1 } = await admin.from("freelancers").update({ status: "Inactive", status_reason: reason }).eq("id", f.id);
      if (e1) return fail(e1);
      if (f.user_id) {
        const { error } = await admin.auth.admin.updateUserById(f.user_id, { ban_duration: "876000h" });
        if (error) {
          await admin.from("freelancers").update({ status: f.status }).eq("id", f.id);
          return fail(error);
        }
        await admin.rpc("svc_kill_sessions", { p_user: f.user_id });
      }
      await audit("freelancer.suspend", "freelancers", f.id, { reason, from: f.status });
      return json({ ok: true });
    }

    // ---------- re-activate ----------
    if (action === "activate_freelancer") {
      if (!can("partners")) return json({ error: "not_allowed" }, 403);
      const f = await loadF();
      if (!f) return json({ error: "not_found" }, 404);
      if (f.user_id) {
        const { error } = await admin.auth.admin.updateUserById(f.user_id, { ban_duration: "none" });
        if (error) return fail(error);
      }
      const { error: e1 } = await admin.from("freelancers").update({ status: "Active", status_reason: null }).eq("id", f.id);
      if (e1) return fail(e1);
      await audit("freelancer.activate", "freelancers", f.id, { from: f.status });
      return json({ ok: true });
    }

    // ---------- sign out of every device ----------
    if (action === "sign_out_freelancer") {
      if (!can("partners")) return json({ error: "not_allowed" }, 403);
      const f = await loadF();
      if (!f?.user_id) return json({ error: "no_login" }, 400);
      const { data: n, error } = await admin.rpc("svc_kill_sessions", { p_user: f.user_id });
      if (error) return fail(error);
      await audit("freelancer.sign_out_all", "freelancers", f.id, { sessions: n });
      return json({ ok: true, sessions: n });
    }

    // ---------- change a freelancer's mobile (= login) ----------
    if (action === "change_freelancer_mobile") {
      if (!can("partners")) return json({ error: "not_allowed" }, 403);
      const mobile = normMobile(body.mobile);
      if (mobile.length < 9) return json({ error: "invalid_mobile" }, 400);
      const f = await loadF();
      if (!f) return json({ error: "not_found" }, 404);
      const { data: clash } = await admin.from("freelancers").select("id").eq("mobile", mobile).is("duplicate_of", null).neq("id", f.id);
      if (clash?.length) return json({ error: "mobile_exists" }, 400);
      const { error: e1 } = await admin.from("freelancers").update({ mobile, mobile_raw: String(body.mobile) }).eq("id", f.id);
      if (e1) return fail(e1);
      if (f.user_id) {
        const { error } = await admin.auth.admin.updateUserById(f.user_id, { email: authEmail(mobile), email_confirm: true });
        if (error) {
          await admin.from("freelancers").update({ mobile: f.mobile }).eq("id", f.id);
          return fail(error);
        }
      }
      await audit("freelancer.mobile_change", "freelancers", f.id, { from: f.mobile, to: mobile });
      return json({ ok: true });
    }

    // ---------- give a login to a freelancer row that has none (e.g. legacy duplicate) ----------
    if (action === "create_freelancer_login") {
      if (!can("partners")) return json({ error: "not_allowed" }, 403);
      const password = String(body.password ?? "");
      if (password.length < 6) return json({ error: "weak_password" }, 400);
      const f = await loadF();
      if (!f) return json({ error: "not_found" }, 404);
      if (f.user_id) return json({ error: "already_has_login" }, 400);
      if (f.duplicate_of) return json({ error: "is_duplicate" }, 400);
      await admin.from("trusted_signups").upsert({ email: authEmail(f.mobile), created_at: new Date().toISOString(), used_at: null });
      const c = await admin.auth.admin.createUser({ email: authEmail(f.mobile), password, email_confirm: true, user_metadata: { kind: "legacy" } });
      if (c.error) return fail(c.error);
      await admin.from("freelancers").update({ user_id: c.data.user.id }).eq("id", f.id);
      await audit("freelancer.create_login", "freelancers", f.id, {});
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    const m = String((e as Error).message ?? e);
    if (m === "target_is_staff") return json({ error: m }, 400);
    console.error("admin-users failed", m);
    return json({ error: "server" }, 500);
  }
});
