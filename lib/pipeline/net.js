// =====================================================================
// CLAUDE PIPELINE: fetch, tried again when the network drops for a moment.
// Only for requests that are safe to repeat (reads, deletes, and uploads of
// the same bytes to the same place): a dropped connection between Vercel and
// Supabase / Cloudflare shouldn't fail someone's upload or delete.
// =====================================================================
const SAFE = /^(GET|HEAD|DELETE|PUT)$/i;
export async function fetchRetry(url, opts = {}, tries = 3) {
  const method = (opts.method || "GET").toUpperCase();
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, opts);
      if (r.status >= 500 && r.status !== 501 && SAFE.test(method) && i < tries) { await new Promise(ok => setTimeout(ok, 300 * i)); continue; }
      return r;
    } catch (e) {
      if (!SAFE.test(method) || i >= tries) throw new Error(`Couldn't reach ${new URL(url).hostname} (${e.cause && e.cause.code || e.message}) — try again`);
      await new Promise(ok => setTimeout(ok, 300 * i));
    }
  }
}
