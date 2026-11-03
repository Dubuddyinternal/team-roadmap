// =====================================================================
// STAGE 7b — "sync-social" Edge Function (Cyberflow team app)
//
// WHY THIS EXISTS: pulls the Social Media numbers from YouTube and Instagram
// so nobody types them in by hand. Writes into social_snapshots and
// social_posts (stage 7a). The browser can only read those tables.
//
// WHO CAN RUN IT:
//   * the daily timer (pg_cron, stage 7a) — sends the private x-cron-key;
//   * any signed-in member of the team ("Sync now" button). A sync started
//     less than 10 minutes after the last one is skipped, to save quota.
//
// SECRETS (Supabase -> Edge Functions -> Secrets):
//   YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN — from Google Cloud and
//   the OAuth Playground (read-only YouTube + YouTube Analytics scopes).
//   IG_ACCESS_TOKEN — a Meta system-user token (never expires) for the
//   "Dubuddy Socials Sync" app with instagram_basic, instagram_manage_insights,
//   pages_show_list, pages_read_engagement, business_management.
//   IG_USER_ID (optional) — the Instagram business account id, if the token
//   can see more than one.
//   YT_CHANNEL_ID — the DU Buddy channel id (UC…). The sync reads that channel by id, so the
//   token only has to belong to its owner (dubuddy77@gmail.com); no channel picking needed.
//
// HOW TO DEPLOY: name it exactly  sync-social , "Verify JWT" OFF (this code
// checks the caller itself, like manage-people).
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || SERVICE_KEY;
const MIN_GAP_MS = 10 * 60 * 1000;
const MAX_VIDEOS = 2000;   // Instagram already has more than 500 posts; 500 cut the oldest off
const HISTORY_DAYS = 120;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-key",
};
function reply(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const ymd = (d) => d.toISOString().slice(0, 10);
const num = (v) => (v === undefined || v === null || v === "" ? null : Number(v));

// ISO 8601 duration (PT1H2M3S) -> seconds
function seconds(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
  if (!m) return null;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}

async function googleToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("YT_CLIENT_ID") || "",
      client_secret: Deno.env.get("YT_CLIENT_SECRET") || "",
      refresh_token: Deno.env.get("YT_REFRESH_TOKEN") || "",
      grant_type: "refresh_token",
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error("Google sign-in failed: " + (body.error_description || body.error || res.status));
  return body.access_token;
}

async function gget(token, url, params) {
  const res = await fetch(url + "?" + new URLSearchParams(params), { headers: { Authorization: "Bearer " + token } });
  const body = await res.json();
  if (!res.ok) throw new Error((body.error && body.error.message) || "YouTube error " + res.status);
  return body;
}

// The channel to sync. With YT_CHANNEL_ID set, the sync asks for that channel by its id instead of
// "the token's own channel": a Google sign-in with dubuddy77@gmail.com always lands on that email's
// own channel (Dubuddy Internal), while DU Buddy is a brand account Google doesn't offer to pick.
// Videos and counts are public, so any valid token reads them; Analytics needs the token's account
// to own the channel (dubuddy77 is DU Buddy's owner).
const PINNED = Deno.env.get("YT_CHANNEL_ID") || "";
const YT_IDS = PINNED ? "channel==" + PINNED : "channel==MINE";

// one Analytics report as [{column: value}]
async function report(token, params) {
  const r = await gget(token, "https://youtubeanalytics.googleapis.com/v2/reports", { ids: YT_IDS, ...params });
  const cols = (r.columnHeaders || []).map((h) => h.name);
  return (r.rows || []).map((row) => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
}

async function syncYouTube(admin, team, cfg) {
  const token = await googleToken();
  const DATA = "https://www.googleapis.com/youtube/v3";
  const notes = [];

  const ch = await gget(token, DATA + "/channels", { part: "snippet,statistics,contentDetails", ...(PINNED ? { id: PINNED } : { mine: "true" }) });
  const channel = ch.items && ch.items[0];
  if (!channel) throw new Error(PINNED ? "YouTube found no channel with the id in YT_CHANNEL_ID (" + PINNED + ")." : "This Google account has no YouTube channel. Sign in to the Playground as the channel owner.");
  const stats = channel.statistics;
  const today = new Date();

  // Only ever sync the DU Buddy channel (YT_CHANNEL_ID). On 3 Nov a token for "Dubuddy Internal"
  // wiped the main channel's posts and history through the branch below.
  const pinned = PINNED;
  if (pinned && channel.id !== pinned) {
    throw new Error(`Signed in to the wrong YouTube channel ("${channel.snippet.title}", ${num(stats.subscriberCount)} subscribers). Make the token again and pick the DU Buddy channel. Nothing was changed.`);
  }
  // signed in to a different channel than last time: its old numbers don't belong here
  if (cfg.youtube_channel_id !== channel.id) {
    await admin.from("social_posts").delete().eq("team_slug", team).eq("platform", "youtube");
    await admin.from("social_snapshots").delete().eq("team_slug", team).eq("platform", "youtube");
    await admin.from("social_sync_config").update({ youtube_channel_id: channel.id }).eq("id", 1);
    if (cfg.youtube_channel_id) notes.push("YouTube channel changed: cleared the previous channel's numbers.");
  }

  // --- every upload (newest first), then their details in batches of 50
  const ids = [];
  let page = "";
  do {
    const pl = await gget(token, DATA + "/playlistItems", {
      part: "contentDetails", maxResults: "50", playlistId: channel.contentDetails.relatedPlaylists.uploads,
      ...(page ? { pageToken: page } : {}),
    });
    for (const it of pl.items || []) ids.push(it.contentDetails.videoId);
    page = pl.nextPageToken || "";
  } while (page && ids.length < MAX_VIDEOS);

  const posts = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const v = await gget(token, DATA + "/videos", { part: "snippet,statistics,contentDetails,status,liveStreamingDetails", id: ids.slice(i, i + 50).join(",") });
    for (const it of v.items || []) {
      if (it.status && it.status.privacyStatus !== "public") continue;
      const dur = seconds(it.contentDetails.duration);
      posts.set(it.id, {
        team_slug: team, platform: "youtube", external_id: it.id,
        title: it.snippet.title,
        url: (!it.liveStreamingDetails && dur !== null && dur <= 180 ? "https://www.youtube.com/shorts/" : "https://www.youtube.com/watch?v=") + it.id,
        thumbnail: (it.snippet.thumbnails && (it.snippet.thumbnails.medium || it.snippet.thumbnails.default) || {}).url || null,
        // streamed live (liveStreamingDetails present) counts as a live session
        post_type: it.liveStreamingDetails ? "Live" : dur !== null && dur <= 180 ? "Short" : "Long video",
        published_at: it.snippet.publishedAt, duration_s: dur,
        views: num(it.statistics.viewCount), likes: num(it.statistics.likeCount),
        comments: num(it.statistics.commentCount),
        shares: null, watch_minutes: null, avg_view_s: null, avg_view_pct: null, impressions: null, ctr_pct: null,
        followers_gained: null, updated_at: new Date().toISOString(),
      });
    }
  }

  // --- lifetime per-video analytics: shares, watch time, retention. Asked for by
  // video id, 50 at a time — a "top videos" report would skip the newer ones.
  try {
    const all = [...posts.keys()];
    for (let i = 0; i < all.length; i += 50) {
      const rows = await report(token, {
        startDate: "2005-04-23", endDate: ymd(today), dimensions: "video", filters: "video==" + all.slice(i, i + 50).join(","),
        metrics: "views,shares,estimatedMinutesWatched,averageViewDuration,averageViewPercentage",
      });
      for (const r of rows) {
        const p = posts.get(r.video);
        if (!p) continue;
        p.shares = num(r.shares);
        p.watch_minutes = num(r.estimatedMinutesWatched);
        p.avg_view_s = num(r.averageViewDuration);
        p.avg_view_pct = num(r.averageViewPercentage);
      }
    }
  } catch (e) { notes.push("Shares/watch time not available: " + e.message); }

  // --- subscribers each video brought in (asked separately so a refusal can't cost the numbers above)
  try {
    const all = [...posts.keys()];
    for (let i = 0; i < all.length; i += 50) {
      const rows = await report(token, {
        startDate: "2005-04-23", endDate: ymd(today), dimensions: "video", filters: "video==" + all.slice(i, i + 50).join(","),
        metrics: "subscribersGained",
      });
      for (const r of rows) { const p = posts.get(r.video); if (p) p.followers_gained = num(r.subscribersGained); }
    }
  } catch (e) { notes.push("Subscribers per video not available: " + e.message); }

  // Thumbnail impressions / CTR: YouTube Analytics does not offer them per
  // video ("query is not supported"), so ctr_pct stays empty (Studio only).

  if (posts.size) {
    const { error } = await admin.from("social_posts").upsert([...posts.values()]);
    if (error) throw new Error("Saving posts failed: " + error.message);
  }

  // --- follower history: today's count, walked back with daily gained/lost.
  // The Data API rounds subscriberCount to 3 significant figures (76,6xx comes back as 76,600),
  // so it barely ever moves. YouTube Analytics has the exact lifetime gained − lost: use that when
  // it agrees with the rounded number, and keep the rounded number (with a note) when it doesn't.
  const rounded = num(stats.subscriberCount);
  let current = rounded;
  try {
    const life = await report(token, { startDate: "2005-04-23", endDate: ymd(today), metrics: "subscribersGained,subscribersLost" });
    const exact = life[0] ? (num(life[0].subscribersGained) || 0) - (num(life[0].subscribersLost) || 0) : null;
    const unit = rounded ? Math.pow(10, Math.max(0, String(Math.abs(rounded)).length - 3)) : 1;
    if (exact != null && rounded != null && Math.abs(exact - rounded) < unit * 1.5) current = exact;
    else if (exact != null) notes.push(`Exact subscriber count (${exact}) is far from the rounded one (${rounded}); kept the rounded one.`);
  } catch (e) { notes.push("Exact subscriber count not available: " + e.message); }
  const snaps = [{ team_slug: team, platform: "youtube", day: ymd(today), followers: current,
    total_views: num(stats.viewCount), post_count: num(stats.videoCount), updated_at: new Date().toISOString() }];
  try {
    const start = new Date(today.getTime() - HISTORY_DAYS * 86400000);
    const rows = await report(token, {
      startDate: ymd(start), endDate: ymd(today), dimensions: "day", sort: "-day",
      metrics: "subscribersGained,subscribersLost",
    });
    // the count at the end of day D = current minus the net change on every day after D
    let count = current;
    for (const r of rows) {
      if (r.day >= ymd(today)) { count -= (num(r.subscribersGained) || 0) - (num(r.subscribersLost) || 0); continue; }
      snaps.push({ team_slug: team, platform: "youtube", day: r.day, followers: count, updated_at: new Date().toISOString() });
      count -= (num(r.subscribersGained) || 0) - (num(r.subscribersLost) || 0);
    }
  } catch (e) { notes.push("Follower history not available: " + e.message); }

  // YouTube's history comes from Analytics, which is exact, so every day it returns is rewritten:
  // the old rule ("only fill days never recorded") froze the rounded 76,600 into the history.
  const toSave = snaps;
  const { error: sErr } = await admin.from("social_snapshots").upsert(toSave);
  if (sErr) throw new Error("Saving followers failed: " + sErr.message);

  return { channel: channel.snippet.title, followers: current, videos: posts.size, history_days: toSave.length - 1, notes };
}

// ---------------------------------------------------------------- Instagram
const GRAPH = "https://graph.facebook.com/v23.0";
const IG_INSIGHT_DAYS = 180;   // newer posts get views/reach/shares/saves; older keep what they had

async function fget(path, params) {
  const res = await fetch(GRAPH + path + "?" + new URLSearchParams({ ...params, access_token: Deno.env.get("IG_ACCESS_TOKEN") || "" }));
  const body = await res.json();
  if (!res.ok || body.error) throw new Error((body.error && body.error.message) || "Instagram error " + res.status);
  return body;
}

// which Instagram business account the token reaches
async function igAccount() {
  const fixed = Deno.env.get("IG_USER_ID");
  if (fixed) return fixed;
  const pages = await fget("/me/accounts", { fields: "name,instagram_business_account", limit: "100" });
  const hit = (pages.data || []).find((p) => p.instagram_business_account);
  if (hit) return hit.instagram_business_account.id;
  throw new Error("The token can't see an Instagram account. In Business settings, give the system user the Facebook Page and the Instagram account, then generate the token again.");
}

// one post's insights; metrics a post type doesn't support make the call fail, so try smaller sets
async function mediaInsights(id, isReel) {
  const sets = isReel
    ? ["views,reach,shares,saved,follows,ig_reels_avg_watch_time", "views,reach,shares,saved,ig_reels_avg_watch_time", "views,reach,shares,saved", "reach,shares,saved", "reach"]
    : ["views,reach,shares,saved,follows", "views,reach,shares,saved", "reach,shares,saved", "reach"];
  for (const m of sets) {
    try {
      const r = await fget("/" + id + "/insights", { metric: m });
      const out = {};
      for (const row of r.data || []) out[row.name] = row.values && row.values[0] ? row.values[0].value : (row.total_value || {}).value;
      return out;
    } catch (_) { /* try the next, smaller set */ }
  }
  return {};
}

async function syncInstagram(admin, team, cfg) {
  if (!Deno.env.get("IG_ACCESS_TOKEN")) return { skipped: "IG_ACCESS_TOKEN not set" };
  const notes = [];
  const igId = await igAccount();
  const prof = await fget("/" + igId, { fields: "username,followers_count,media_count" });
  const today = new Date();

  if (cfg.instagram_user_id !== igId) {
    await admin.from("social_posts").delete().eq("team_slug", team).eq("platform", "instagram");
    await admin.from("social_snapshots").delete().eq("team_slug", team).eq("platform", "instagram");
    await admin.from("social_sync_config").update({ instagram_user_id: igId }).eq("id", 1);
    if (cfg.instagram_user_id) notes.push("Instagram account changed: cleared the previous account's numbers.");
  }

  // every post (newest first)
  const media = [];
  let after = "";
  do {
    const page = await fget("/" + igId + "/media", {
      fields: "id,caption,media_type,media_product_type,permalink,timestamp,thumbnail_url,media_url,like_count,comments_count",
      limit: "50", ...(after ? { after } : {}),
    });
    media.push(...(page.data || []));
    after = page.paging && page.paging.next && page.paging.cursors ? page.paging.cursors.after : "";
  } while (after && media.length < MAX_VIDEOS);

  const cutoff = Date.now() - IG_INSIGHT_DAYS * 86400000;
  const recent = [], older = [];
  // insights for the newer posts, 10 requests at a time (keeps the run short)
  const want = media.filter((m) => new Date(m.timestamp).getTime() >= cutoff);
  const insights = new Map();
  for (let i = 0; i < want.length; i += 10) {
    const chunk = want.slice(i, i + 10);
    const got = await Promise.all(chunk.map((m) => mediaInsights(m.id, m.media_product_type === "REELS" || m.media_type === "VIDEO")));
    chunk.forEach((m, k) => insights.set(m.id, got[k]));
  }
  for (const m of media) {
    const isReel = m.media_product_type === "REELS" || m.media_type === "VIDEO";
    const type = isReel ? "Reel" : m.media_type === "CAROUSEL_ALBUM" ? "Carousel" : "Image";
    const firstLine = String(m.caption || "").split("\n")[0].trim();
    const row = {
      team_slug: team, platform: "instagram", external_id: m.id,
      title: firstLine ? firstLine.slice(0, 180) : "(no caption)", url: m.permalink || null,
      thumbnail: m.thumbnail_url || (m.media_type === "IMAGE" ? m.media_url : null) || null,
      post_type: type, published_at: m.timestamp, duration_s: null,
      likes: num(m.like_count), comments: num(m.comments_count), updated_at: new Date().toISOString(),
    };
    if (new Date(m.timestamp).getTime() >= cutoff) {
      const ins = insights.get(m.id) || {};
      row.views = num(ins.views ?? ins.reach);
      row.shares = num(ins.shares);
      row.impressions = num(ins.reach);
      row.followers_gained = num(ins.follows);   // people who followed from this post
      row.avg_view_s = ins.ig_reels_avg_watch_time != null ? Math.round(Number(ins.ig_reels_avg_watch_time) / 100) / 10 : null;
      recent.push(row);
    } else older.push(row);
  }
  // two writes: older posts keep the views/shares they already had
  if (recent.length) { const { error } = await admin.from("social_posts").upsert(recent); if (error) throw new Error("Saving Instagram posts failed: " + error.message); }
  if (older.length) { const { error } = await admin.from("social_posts").upsert(older); if (error) throw new Error("Saving Instagram posts failed: " + error.message); }

  // followers today, and the last 30 days walked back from daily new followers
  const current = num(prof.followers_count);
  const snaps = [{ team_slug: team, platform: "instagram", day: ymd(today), followers: current, post_count: num(prof.media_count), updated_at: new Date().toISOString() }];
  const dailyFollows = new Map();   // day -> new followers that day
  try {
    const since = Math.floor((Date.now() - 29 * 86400000) / 1000), until = Math.floor(Date.now() / 1000);
    const r = await fget("/" + igId + "/insights", { metric: "follower_count", period: "day", since: String(since), until: String(until) });
    const vals = ((r.data || [])[0] || {}).values || [];
    for (const v of vals) dailyFollows.set(ymd(new Date(new Date(v.end_time).getTime() - 86400000)), num(v.value) || 0);
    let count = current;
    for (const v of [...vals].sort((a, b) => b.end_time.localeCompare(a.end_time))) {
      const day = ymd(new Date(new Date(v.end_time).getTime() - 86400000));
      if (day >= ymd(today)) { count -= num(v.value) || 0; continue; }
      snaps.push({ team_slug: team, platform: "instagram", day, followers: count, updated_at: new Date().toISOString() });
      count -= num(v.value) || 0;
    }
  } catch (e) { notes.push("Follower history not available: " + e.message); }
  const { data: have } = await admin.from("social_snapshots").select("day").eq("team_slug", team).eq("platform", "instagram").lt("day", ymd(today));
  const known = new Set((have || []).map((r) => r.day));
  const toSave = snaps.filter((x) => x.day === ymd(today) || !known.has(x.day));
  const { error: sErr } = await admin.from("social_snapshots").upsert(toSave);
  if (sErr) throw new Error("Saving Instagram followers failed: " + sErr.message);

  // --- estimated new followers per post (Meta won't give Reels' "follows")
  let attributed = 0;
  try { attributed = await attributeFollows(admin, team, recent, dailyFollows, ymd(today)); }
  catch (e) { notes.push("Follower estimate skipped: " + e.message); }

  return { account: prof.username, estimated_follows: attributed, followers: current, posts: media.length, with_insights: recent.length, history_days: toSave.length - 1, notes };
}

// Split each day's new followers across posts by the views each got that day.
// Views per day come from the lifetime views this sync records daily
// (social_post_daily); until a post has two days of history, a day's
// followers go to the posts published in the 3 days before it, by views.
async function attributeFollows(admin, team, posts, dailyFollows, today) {
  if (posts.length) {
    const { error } = await admin.from("social_post_daily").upsert(
      posts.filter((p) => p.views != null).map((p) => ({ team_slug: team, platform: "instagram", external_id: p.external_id, day: today, views: p.views })));
    if (error) throw new Error(error.message);
  }
  if (dailyFollows.size) {
    await admin.from("social_snapshots").upsert([...dailyFollows].map(([day, n]) => ({ team_slug: team, platform: "instagram", day, gained: n })));
  }
  const since = ymd(new Date(Date.now() - 40 * 86400000));
  const { data: hist, error: hErr } = await admin.from("social_post_daily").select("external_id,day,views")
    .eq("team_slug", team).eq("platform", "instagram").gte("day", since).limit(20000);
  if (hErr) throw new Error(hErr.message);
  const byDay = new Map();   // day -> Map(id -> views)
  for (const h of hist || []) { if (h.views == null) continue; if (!byDay.has(h.day)) byDay.set(h.day, new Map()); byDay.get(h.day).set(h.external_id, Number(h.views)); }
  const pub = new Map(posts.map((p) => [p.external_id, { day: String(p.published_at).slice(0, 10), views: Number(p.views) || 0 }]));
  const prevDay = (d) => ymd(new Date(new Date(d + "T00:00:00Z").getTime() - 86400000));
  const rows = [];
  for (const [day, follows] of dailyFollows) {
    if (day >= today || !follows) continue;
    let w = new Map();
    const a = byDay.get(day), b = byDay.get(prevDay(day));
    if (a && b) for (const [id, v] of a) { const inc = v - (b.get(id) ?? 0); if (inc > 0) w.set(id, inc); }
    if (!w.size) {   // no daily views yet for that day: posts from the 3 days before it, by views
      for (const [id, p] of pub) { const age = (new Date(day) - new Date(p.day)) / 86400000; if (age >= 0 && age <= 3) w.set(id, Math.max(1, p.views)); }
    }
    const tot = [...w.values()].reduce((x, y) => x + y, 0); if (!tot) continue;
    for (const [id, v] of w) rows.push({ team_slug: team, platform: "instagram", external_id: id, day, est_follows: Math.round(follows * v / tot * 100) / 100 });
  }
  // replace the estimates for the days we just recalculated
  const days = [...dailyFollows.keys()].filter((d) => d < today);
  if (days.length) await admin.from("social_post_daily").update({ est_follows: null }).eq("team_slug", team).eq("platform", "instagram").in("day", days);
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin.from("social_post_daily").upsert(rows.slice(i, i + 500));
    if (error) throw new Error(error.message);
  }
  // each post's total = all its credited days
  const { data: all } = await admin.from("social_post_daily").select("external_id,est_follows").eq("team_slug", team).eq("platform", "instagram").not("est_follows", "is", null).limit(50000);
  const sums = new Map();
  for (const r of all || []) sums.set(r.external_id, (sums.get(r.external_id) || 0) + Number(r.est_follows));
  const upd = [...sums].map(([id, v]) => ({ team_slug: team, platform: "instagram", external_id: id, followers_est: Math.round(v * 10) / 10 }));
  for (let i = 0; i < upd.length; i += 500) {
    const { error } = await admin.from("social_posts").upsert(upd.slice(i, i + 500), { onConflict: "team_slug,platform,external_id", ignoreDuplicates: false });
    if (error) throw new Error(error.message);
  }
  return Math.round([...sums.values()].reduce((x, y) => x + y, 0));
}

// ---------------------------------------------------------------- Audience location
// YouTube gives viewers by city (no states for India, no subscribers below
// country); Instagram gives the top cities as "City, State". Cities from
// YouTube are put in their state with this list (plus anything Instagram
// taught us in the same sync).
const STATE_CITIES = {
  "Delhi": "Delhi|New Delhi|Dwarka|Rohini|Narela|Najafgarh",
  "Uttar Pradesh": "Lucknow|Kanpur|Agra|Varanasi|Prayagraj|Allahabad|Ghaziabad|Noida|Greater Noida|Meerut|Bareilly|Aligarh|Moradabad|Saharanpur|Gorakhpur|Jhansi|Firozabad|Mathura|Ayodhya|Faizabad|Muzaffarnagar|Shahjahanpur|Rampur|Etawah|Mirzapur|Bulandshahr|Sambhal|Amroha|Hardoi|Fatehpur|Raebareli|Orai|Sitapur|Bahraich|Unnao|Jaunpur|Lakhimpur|Hapur|Banda|Azamgarh|Basti|Ballia|Gonda|Deoria|Sultanpur|Mainpuri|Budaun|Pilibhit|Lalitpur|Bijnor|Kannauj|Etah|Chandauli|Ghazipur|Mau|Shamli|Baghpat|Kushinagar",
  "Bihar": "Patna|Gaya|Bhagalpur|Muzaffarpur|Purnia|Darbhanga|Bihar Sharif|Arrah|Begusarai|Katihar|Munger|Chhapra|Danapur|Saharsa|Sasaram|Hajipur|Dehri|Siwan|Motihari|Nawada|Bettiah|Kishanganj|Jamalpur|Buxar|Jehanabad|Aurangabad Bihar|Samastipur|Madhubani|Sitamarhi|Gopalganj|Supaul|Araria|Lakhisarai|Sheikhpura|Khagaria|Vaishali",
  "Maharashtra": "Mumbai|Pune|Nagpur|Thane|Nashik|Navi Mumbai|Aurangabad|Chhatrapati Sambhajinagar|Solapur|Kolhapur|Amravati|Kalyan|Vasai-Virar|Pimpri-Chinchwad|Sangli|Malegaon|Jalgaon|Akola|Latur|Dhule|Ahmednagar|Chandrapur|Parbhani|Ichalkaranji|Jalna|Bhiwandi|Panvel|Satara|Nanded|Wardha|Yavatmal|Ratnagiri|Beed|Osmanabad|Gondia|Bhusawal|Ulhasnagar|Mira-Bhayandar|Baramati",
  "Karnataka": "Bengaluru|Bangalore|Mysuru|Mysore|Hubli|Hubballi|Dharwad|Mangaluru|Mangalore|Belagavi|Belgaum|Kalaburagi|Gulbarga|Davanagere|Ballari|Bellary|Vijayapura|Shivamogga|Shimoga|Tumakuru|Tumkur|Raichur|Bidar|Udupi|Hassan|Mandya|Chitradurga|Hospet|Kolar|Manipal",
  "Tamil Nadu": "Chennai|Coimbatore|Madurai|Tiruchirappalli|Trichy|Salem|Tiruppur|Erode|Vellore|Thoothukudi|Tirunelveli|Thanjavur|Dindigul|Hosur|Nagercoil|Kanchipuram|Karur|Kumbakonam|Cuddalore|Tiruvannamalai|Pollachi",
  "Telangana": "Hyderabad|Secunderabad|Warangal|Nizamabad|Karimnagar|Khammam|Ramagundam|Mahbubnagar|Nalgonda|Adilabad|Siddipet|Suryapet",
  "West Bengal": "Kolkata|Calcutta|Howrah|Durgapur|Asansol|Siliguri|Bardhaman|Kharagpur|Haldia|Malda|English Bazar|Baharampur|Krishnanagar|Barasat|Habra|Raiganj|Jalpaiguri|Bally|Barrackpore|Bhatpara|Kalyani|Midnapore|Cooch Behar|Bankura|Purulia",
  "Gujarat": "Ahmedabad|Surat|Vadodara|Baroda|Rajkot|Bhavnagar|Jamnagar|Gandhinagar|Junagadh|Anand|Navsari|Morbi|Nadiad|Bharuch|Vapi|Gandhidham|Mehsana|Bhuj|Porbandar|Valsad|Palanpur|Godhra|Surendranagar",
  "Rajasthan": "Jaipur|Jodhpur|Kota|Bikaner|Ajmer|Udaipur|Bhilwara|Alwar|Bharatpur|Sikar|Sri Ganganagar|Pali|Tonk|Kishangarh|Beawar|Hanumangarh|Churu|Jhunjhunu|Barmer|Nagaur|Chittorgarh|Dausa|Sawai Madhopur|Bundi|Jaisalmer",
  "Madhya Pradesh": "Indore|Bhopal|Jabalpur|Gwalior|Ujjain|Sagar|Dewas|Satna|Ratlam|Rewa|Murwara|Katni|Singrauli|Burhanpur|Khandwa|Bhind|Chhindwara|Guna|Shivpuri|Vidisha|Morena|Damoh|Mandsaur|Khargone|Neemuch|Itarsi|Sehore|Betul|Seoni|Hoshangabad|Narmadapuram",
  "Haryana": "Gurugram|Gurgaon|Faridabad|Panipat|Ambala|Yamunanagar|Rohtak|Hisar|Karnal|Sonipat|Panchkula|Bhiwani|Sirsa|Bahadurgarh|Jind|Thanesar|Kurukshetra|Kaithal|Rewari|Palwal|Jhajjar|Narnaul|Fatehabad",
  "Punjab": "Ludhiana|Amritsar|Jalandhar|Patiala|Bathinda|Mohali|Sahibzada Ajit Singh Nagar|Hoshiarpur|Pathankot|Moga|Batala|Abohar|Malerkotla|Khanna|Phagwara|Muktsar|Barnala|Rajpura|Firozpur|Kapurthala|Sangrur",
  "Chandigarh": "Chandigarh",
  "Jharkhand": "Ranchi|Jamshedpur|Dhanbad|Bokaro|Bokaro Steel City|Deoghar|Hazaribagh|Giridih|Ramgarh|Phusro|Medininagar|Daltonganj|Chas|Dumka|Chaibasa",
  "Odisha": "Bhubaneswar|Cuttack|Rourkela|Berhampur|Brahmapur|Sambalpur|Puri|Balasore|Baleshwar|Bhadrak|Baripada|Jharsuguda|Jeypore|Angul",
  "Chhattisgarh": "Raipur|Bhilai|Bilaspur|Korba|Durg|Rajnandgaon|Jagdalpur|Raigarh|Ambikapur|Dhamtari",
  "Uttarakhand": "Dehradun|Haridwar|Roorkee|Haldwani|Rudrapur|Kashipur|Rishikesh|Nainital|Kotdwar|Pithoragarh",
  "Himachal Pradesh": "Shimla|Mandi|Solan|Dharamshala|Kangra|Hamirpur|Una|Kullu|Baddi",
  "Jammu and Kashmir": "Srinagar|Jammu|Anantnag|Baramulla|Kathua|Sopore|Udhampur",
  "Ladakh": "Leh|Kargil",
  "Kerala": "Thiruvananthapuram|Trivandrum|Kochi|Cochin|Ernakulam|Kozhikode|Calicut|Thrissur|Kollam|Kannur|Palakkad|Alappuzha|Malappuram|Kottayam|Kasaragod",
  "Andhra Pradesh": "Visakhapatnam|Vijayawada|Guntur|Nellore|Kurnool|Rajahmundry|Rajamahendravaram|Kakinada|Tirupati|Kadapa|Anantapur|Eluru|Ongole|Vizianagaram|Srikakulam|Machilipatnam|Amaravati",
  "Assam": "Guwahati|Silchar|Dibrugarh|Jorhat|Nagaon|Tinsukia|Tezpur|Bongaigaon|Dispur",
  "Goa": "Panaji|Margao|Vasco da Gama|Mapusa|Ponda",
  "Tripura": "Agartala",
  "Meghalaya": "Shillong",
  "Manipur": "Imphal",
  "Mizoram": "Aizawl",
  "Nagaland": "Kohima|Dimapur",
  "Arunachal Pradesh": "Itanagar",
  "Sikkim": "Gangtok",
  "Puducherry": "Puducherry|Pondicherry",
  "Andaman and Nicobar Islands": "Port Blair",
};
const CITY_STATE = new Map();
for (const [st, list] of Object.entries(STATE_CITIES)) for (const c of list.split("|")) CITY_STATE.set(c.toLowerCase(), st);
// Instagram writes "City, State"
function splitCity(s) { const i = String(s).lastIndexOf(", "); return i < 0 ? [String(s), ""] : [s.slice(0, i), s.slice(i + 2)]; }

// one demographics breakdown as [[key, value]]
async function igDemo(igId, metric, breakdown, timeframe) {
  const r = await fget("/" + igId + "/insights", { metric, period: "lifetime", metric_type: "total_value", breakdown, ...(timeframe ? { timeframe } : {}) });
  const res = ((((r.data || [])[0] || {}).total_value || {}).breakdowns || [])[0];
  return ((res && res.results) || []).map((x) => [x.dimension_values[0], num(x.value) || 0]);
}

async function syncGeo(admin, team) {
  const notes = [];
  const rows = [];
  const now = new Date().toISOString();
  const add = (platform, kind, level, name, state, value, period) =>
    rows.push({ team_slug: team, platform, kind, level, name, state: state || "", value, period, updated_at: now });
  const learned = new Map();

  // --- Instagram
  if (Deno.env.get("IG_ACCESS_TOKEN")) {
    try {
      const igId = await igAccount();
      for (const [metric, kind, tf, period] of [["follower_demographics", "followers", null, "all followers"], ["reached_audience_demographics", "viewers", "this_month", "reached this month"]]) {
        try {
          for (const [k, v] of await igDemo(igId, metric, "city", tf)) {
            const [city, st] = splitCity(k);
            if (st) learned.set(city.toLowerCase(), st);
            add("instagram", kind, "city", k, st, v, period);
          }
          for (const [k, v] of await igDemo(igId, metric, "country", tf)) add("instagram", kind, "country", k, "", v, period);
        } catch (e) { notes.push("Instagram " + kind + " by place: " + e.message); }
      }
    } catch (e) { notes.push("Instagram places: " + e.message); }
  }

  // --- YouTube (last 90 days)
  try {
    const token = await googleToken();
    const end = new Date(Date.now() - 86400000), start = new Date(Date.now() - 90 * 86400000);
    const range = { startDate: ymd(start), endDate: ymd(end) };
    const period = "last 90 days";
    const cities = await report(token, { ...range, dimensions: "city", metrics: "views", filters: "country==IN", sort: "-views", maxResults: "250" });
    for (const r of cities) {
      const c = String(r.city || "");
      if (!c) continue;
      const st = CITY_STATE.get(c.toLowerCase()) || learned.get(c.toLowerCase()) || "";
      add("youtube", "viewers", "city", c, st, num(r.views), period);
    }
    const countries = await report(token, { ...range, dimensions: "country", metrics: "views,subscribersGained", sort: "-views", maxResults: "50" });
    for (const r of countries) {
      add("youtube", "viewers", "country", r.country, "", num(r.views), period);
      add("youtube", "subscribers", "country", r.country, "", num(r.subscribersGained), period);
    }
  } catch (e) { notes.push("YouTube places: " + e.message); }

  // replace each platform's rows only when we got fresh ones for it
  for (const pl of ["youtube", "instagram"]) {
    const mine = rows.filter((r) => r.platform === pl);
    if (!mine.length) continue;
    await admin.from("social_geo").delete().eq("team_slug", team).eq("platform", pl);
    const { error } = await admin.from("social_geo").upsert(mine);
    if (error) notes.push("Saving " + pl + " places failed: " + error.message);
  }
  return { rows: rows.length, unmapped_youtube_cities: rows.filter((r) => r.platform === "youtube" && r.level === "city" && !r.state).map((r) => r.name).slice(0, 30), notes };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(405, { error: "POST only" });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: cfg, error: cfgErr } = await admin.from("social_sync_config").select("*").eq("id", 1).single();
  if (cfgErr || !cfg) return reply(500, { error: "Run stage7a_social_sync.sql first." });
  const team = cfg.team_slug;

  // --- who is calling: the daily timer, or a signed-in team member
  const cronKey = req.headers.get("x-cron-key");
  if (cronKey) {
    if (cronKey !== cfg.cron_key) return reply(401, { error: "Wrong key." });
  } else {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return reply(401, { error: "Sign in first." });
    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: "Bearer " + token } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: ok } = await caller.rpc("has_role", { team, min_role: "viewer" });
    if (!ok) return reply(403, { error: "Only team members can sync." });
    if (cfg.last_sync && Date.now() - new Date(cfg.last_sync).getTime() < MIN_GAP_MS) {
      return reply(200, { skipped: true, last_sync: cfg.last_sync, last_result: cfg.last_result });
    }
  }

  const result = { youtube: null, instagram: null, places: null };
  try {
    result.youtube = await syncYouTube(admin, team, cfg);
  } catch (e) {
    result.youtube = { error: e.message };
  }
  try {
    result.instagram = await syncInstagram(admin, team, cfg);
  } catch (e) {
    result.instagram = { error: e.message };
  }
  try {
    result.places = await syncGeo(admin, team);
  } catch (e) {
    result.places = { error: e.message };
  }
  const now = new Date().toISOString();
  await admin.from("social_sync_config").update({ last_sync: now, last_result: result }).eq("id", 1);
  const bad = !!(result.youtube && result.youtube.error && result.instagram && result.instagram.error);
  return reply(bad ? 502 : 200, { last_sync: now, ...result });
});
