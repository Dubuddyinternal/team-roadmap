// =====================================================================
// CLAUDE PIPELINE: who is calling, and what they may do.
//
// The browser sends its Supabase sign-in token (Authorization: Bearer …).
// We ask Supabase who that is and read their role in the team.
//   view jobs:            any member of the team
//   start / changes /     owner, admin, editor, or a custom role with "edit"
//     redo SEO / cancel
//   approve edit / post:  owner, admin (and the super-admin) only
// On this Mac (local mode) you are always the owner.
// =====================================================================
import { STORE, SUPABASE, LOCAL } from "./config.js";

export async function whoIs(req, team) {
  if (LOCAL && STORE === "local") return { id: "local-owner", name: "Owner", role: "owner", canRun: true, canApprove: true };
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const h = { apikey: SUPABASE.service, authorization: `Bearer ${token}` };
  const u = await fetch(`${SUPABASE.url}/auth/v1/user`, { headers: h });
  if (!u.ok) return null;
  const user = await u.json();
  const sh = { apikey: SUPABASE.service, authorization: `Bearer ${SUPABASE.service}` };
  const get = async p => { const r = await fetch(`${SUPABASE.url}/rest/v1/${p}`, { headers: sh }); return r.ok ? r.json() : []; };
  const [prof] = await get(`profiles?id=eq.${user.id}&select=name,is_super`);
  const [mem] = await get(`memberships?team_slug=eq.${encodeURIComponent(team)}&user_id=eq.${user.id}&select=role`);
  const role = prof && prof.is_super ? "owner" : mem ? mem.role : null;
  if (!role) return null;
  let perms = [];
  if (!["owner", "admin", "editor", "commenter", "viewer"].includes(role)) {
    const [r] = await get(`team_roles?team_slug=eq.${encodeURIComponent(team)}&key=eq.${encodeURIComponent(role)}&select=perms`);
    perms = (r && r.perms) || [];
  }
  const boss = role === "owner" || role === "admin" || perms.includes("manage_people");
  return { id: user.id, name: (prof && prof.name) || user.email, role,
    canRun: boss || role === "editor" || perms.includes("edit"), canApprove: boss };
}
