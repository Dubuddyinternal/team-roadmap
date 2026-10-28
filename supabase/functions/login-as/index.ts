// =====================================================================
// "login-as" Edge Function — super-admin only: sign in as someone else.
//
// The app's 🔑 "Log in as" button (Administration → People) calls this with
// the person's user_id. If the caller is a super-admin, it makes a ONE-TIME
// sign-in for that person (a magic-link token, never emailed) and returns
// it; the page uses it straight away, keeping the super-admin's own session
// aside so "Back to <me>" returns. No password is made, seen or changed.
// Every use is written to public.login_as_log (who, as whom, when) —
// supabase/stage21a_login_as.sql.
//
// HOW TO DEPLOY: Supabase → Edge Functions → Deploy a new function → Via
// Editor → name it exactly  login-as  → paste this file → Deploy. Leave
// "Verify JWT" ON.
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function reply(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(405, { error: "POST only" });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { error: "Sign in first." });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: who, error: whoErr } = await admin.auth.getUser(token);
  if (whoErr || !who || !who.user) return reply(401, { error: "Sign in first." });
  const me = who.user;

  // only a super-admin
  const { data: mine } = await admin.from("profiles").select("is_super").eq("id", me.id).maybeSingle();
  if (!mine || !mine.is_super) return reply(403, { error: "Only a super-admin can log in as someone else." });

  let body;
  try { body = await req.json(); } catch (_) { return reply(400, { error: "Bad request." }); }
  const target = String((body && body.user_id) || "");
  if (!target || target === me.id) return reply(400, { error: "Pick someone else." });

  const { data: prof } = await admin.from("profiles").select("id,email,name").eq("id", target).maybeSingle();
  if (!prof || !prof.email) return reply(404, { error: "That person wasn't found." });

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: prof.email });
  if (linkErr || !link || !link.properties || !link.properties.hashed_token) return reply(400, { error: (linkErr && linkErr.message) || "Couldn't make the sign-in." });

  await admin.from("login_as_log").insert({ by_user: me.id, as_user: target, team_slug: body.team || null });
  return reply(200, { token_hash: link.properties.hashed_token, email: prof.email, name: prof.name || prof.email });
});
