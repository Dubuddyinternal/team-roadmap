// =====================================================================
// "feed-fetch" Edge Function — the My To-do feed agent (my-todo.js)
//
// WHAT IT DOES: given the links someone follows (YouTube channels, websites
// and blogs, any RSS / Atom feed — including RSS links made for Twitter/X or
// LinkedIn accounts by rss.app / RSSHub), it finds each one's feed and
// returns the latest posts. Nothing is stored here; the caller keeps the
// results in their own private my_todos row.
//
//   YouTube  @handle, /channel/UC…, /c/…, /user/…  → the channel's public
//            videos feed (youtube.com/feeds/videos.xml?channel_id=…)
//   Website  the page's <link rel="alternate" type="application/rss+xml">,
//            else /feed, /rss, /rss.xml, /feed.xml, /atom.xml, /index.xml
//   Twitter/X, LinkedIn  can't be read without a paid API → "needs_bridge"
//            (the caller can pass an RSS link for the account as feedUrl)
//
// REQUEST  POST { sources: [{ id, url, feedUrl? }] }   (at most 40)
// REPLY    { results: { <id>: { status: "ok"|"needs_bridge"|"no_feed"|"error",
//            feedUrl, title, items: [{ id, title, link, date, author }], error } } }
//
// WHO CAN RUN IT: any signed-in user — deploy with "Verify JWT" ON.
// Private / local addresses are refused, pages are capped at 2 MB, and each
// fetch gives up after 9 s.
// =====================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const UA = "Mozilla/5.0 (compatible; DubuddyFeedAgent/1.0; +https://tools.dubuddy.in)";
const MAX_SOURCES = 40, MAX_ITEMS = 10, MAX_BYTES = 2_000_000, TIMEOUT_MS = 9000;

export function kindOf(url) {
  let h = "";
  try { h = new URL(url).hostname.toLowerCase().replace(/^www\.|^m\./, ""); } catch (_) { return "bad"; }
  if (h === "youtube.com" || h === "youtu.be" || h.endsWith(".youtube.com")) return "youtube";
  if (h === "x.com" || h === "twitter.com" || h.endsWith(".twitter.com")) return "x";
  if (h === "linkedin.com" || h.endsWith(".linkedin.com")) return "linkedin";
  return "web";
}
function blockedHost(host) {
  host = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host.includes(":")) return true;                                   // IPv6 literals
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return true;
  }
  return false;
}
async function get(url) {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol) || blockedHost(u.hostname)) throw new Error("address not allowed");
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(u.toString(), { headers: { "user-agent": UA, "accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.5", "accept-language": "en" }, redirect: "follow", signal: ac.signal });
    const finalHost = new URL(r.url || u.toString()).hostname;
    if (blockedHost(finalHost)) throw new Error("address not allowed");
    const reader = r.body?.getReader(); let size = 0; const chunks = [];
    if (reader) for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > MAX_BYTES) { ac.abort(); break; } chunks.push(value); }
    const buf = new Uint8Array(size > MAX_BYTES ? MAX_BYTES : size); let o = 0;
    for (const c of chunks) { if (o + c.length > buf.length) { buf.set(c.subarray(0, buf.length - o), o); break; } buf.set(c, o); o += c.length; }
    return { status: r.status, type: r.headers.get("content-type") || "", text: new TextDecoder().decode(buf), url: r.url || u.toString() };
  } finally { clearTimeout(t); }
}

/* ---------- feed parsing (RSS 2.0, RSS 1.0 / RDF, Atom) ---------- */
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decode(s) {
  return String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e.toLowerCase()] ?? m));
}
function text(s) { return decode(decode(String(s || "")).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim(); }
function tag(block, names) {
  for (const n of names) {
    const m = block.match(new RegExp("<" + n + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + n + ">", "i"));
    if (m) return m[1];
  }
  return "";
}
function attr(s, name) { const m = s.match(new RegExp("\\s" + name + "\\s*=\\s*(\"([^\"]*)\"|'([^']*)')", "i")); return m ? decode(m[2] ?? m[3] ?? "") : ""; }
export function looksLikeFeed(s) { return /<(rss|feed|rdf:RDF)[\s>]/i.test(String(s).slice(0, 3000)); }
export function parseFeed(xml, base) {
  const isAtom = /<feed[\s>]/i.test(xml.slice(0, 3000));
  const blocks = xml.match(isAtom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) || [];
  const head = xml.split(isAtom ? /<entry[\s>]/i : /<item[\s>]/i)[0];
  const title = text(tag(head, ["title"]));
  const items = blocks.slice(0, MAX_ITEMS).map((b) => {
    let link = "";
    if (isAtom) {
      const links = b.match(/<link\b[^>]*>/gi) || [];
      const alt = links.find((l) => !/rel\s*=/.test(l) || /rel\s*=\s*["']alternate["']/i.test(l)) || links[0] || "";
      link = attr(alt, "href");
    } else {
      link = text(tag(b, ["link"])) || attr((b.match(/<link\b[^>]*>/i) || [""])[0], "href");
    }
    try { if (link) link = new URL(link, base).toString(); } catch (_) { link = ""; }
    if (link && !/^https?:/i.test(link)) link = "";
    const date = text(tag(b, ["pubDate", "published", "updated", "dc:date"]));
    const t = Date.parse(date);
    const author = text(tag(b, ["dc:creator", "author"]).replace(/<email>[\s\S]*?<\/email>/i, "")) || "";
    const id = text(tag(b, ["guid", "id", "yt:videoId"])) || link || text(tag(b, ["title"]));
    return { id: id.slice(0, 300), title: (text(tag(b, ["title"])) || "(untitled)").slice(0, 300), link, date: isNaN(t) ? "" : new Date(t).toISOString(), author: author.slice(0, 120) };
  }).filter((i) => i.title || i.link);
  return { title: title.slice(0, 200), items };
}

/* ---------- finding a source's feed ---------- */
async function youtubeFeed(url) {
  if (/\/feeds\/videos\.xml/.test(url)) return url;
  const m = url.match(/\/channel\/(UC[\w-]{22})/);
  if (m) return "https://www.youtube.com/feeds/videos.xml?channel_id=" + m[1];
  const r = await get(url);
  // the page's own channel first (canonical link / externalId); a bare "channelId" can belong to a recommended channel
  const t = r.text;
  const id = (t.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})/) ||
    t.match(/<meta[^>]+itemprop=["'](?:identifier|channelId)["'][^>]+content=["'](UC[\w-]{22})/) ||
    t.match(/"externalId"\s*:\s*"(UC[\w-]{22})"/) || t.match(/"browseId"\s*:\s*"(UC[\w-]{22})"/) ||
    t.match(/"channelId"\s*:\s*"(UC[\w-]{22})"/) || [])[1];
  if (!id) throw new Error("couldn't find that channel");
  return "https://www.youtube.com/feeds/videos.xml?channel_id=" + id;
}
async function webFeed(url) {
  const r = await get(url);
  if (looksLikeFeed(r.text)) return { feedUrl: r.url, page: r };
  const links = r.text.match(/<link\b[^>]*>/gi) || [];
  const alt = links.find((l) => /rel\s*=\s*["']?alternate/i.test(l) && /type\s*=\s*["']application\/(rss|atom)\+xml/i.test(l));
  if (alt && attr(alt, "href")) return { feedUrl: new URL(attr(alt, "href"), r.url).toString() };
  for (const p of ["/feed", "/rss", "/rss.xml", "/feed.xml", "/atom.xml", "/index.xml", "/feed/"]) {
    try {
      const f = new URL(p, r.url).toString(), x = await get(f);
      if (x.status < 400 && looksLikeFeed(x.text)) return { feedUrl: x.url, page: x };
    } catch (_) { /* try the next one */ }
  }
  return { feedUrl: "" };
}
export async function checkSource(src) {
  const url = String(src.url || "").trim(), given = String(src.feedUrl || "").trim();
  try {
    const kind = kindOf(given || url);
    if (kind === "bad") return { status: "error", error: "not a web link" };
    let feedUrl = given, page = null;
    if (!feedUrl) {
      const k = kindOf(url);
      if (k === "x" || k === "linkedin") return { status: "needs_bridge" };
      if (k === "youtube") feedUrl = await youtubeFeed(url);
      else { const w = await webFeed(url); feedUrl = w.feedUrl; page = w.page || null; }
    }
    if (!feedUrl) return { status: "no_feed" };
    const r = page && page.url === feedUrl ? page : await get(feedUrl);
    if (r.status >= 400) return { status: "error", feedUrl, error: "the site answered " + r.status };
    if (!looksLikeFeed(r.text)) return { status: "no_feed", feedUrl };
    const f = parseFeed(r.text, r.url);
    return { status: "ok", feedUrl, title: f.title, items: f.items };
  } catch (e) {
    return { status: "error", error: String(e && e.name === "AbortError" ? "timed out" : (e && e.message) || e).slice(0, 200) };
  }
}
async function pool(list, n, fn) {
  const out = new Array(list.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => { while (i < list.length) { const k = i++; out[k] = await fn(list[k]); } }));
  return out;
}

if (typeof Deno !== "undefined") Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { ...CORS, "content-type": "application/json" } });
  let body = {};
  try { body = await req.json(); } catch (_) { /* empty */ }
  const sources = (Array.isArray(body.sources) ? body.sources : []).filter((s) => s && s.id && s.url).slice(0, MAX_SOURCES);
  const res = await pool(sources, 6, checkSource);
  const results = {};
  sources.forEach((s, k) => { results[String(s.id).slice(0, 60)] = res[k]; });
  return new Response(JSON.stringify({ results }), { headers: { ...CORS, "content-type": "application/json" } });
});
