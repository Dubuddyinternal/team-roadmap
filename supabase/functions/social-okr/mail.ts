// =====================================================================
// The two Individual OKR emails, built from a person's month (no imports, so it can be previewed anywhere).
//   mid  — on the 20th, only when a key result isn't reached yet: a friendly nudge with what's left.
//   end  — on the 1st, for the month before: each target and what was done.
// Tone: a friendly note, never a warning.
// =====================================================================
export type KR = {
  label: string; tag: string; unit: string; target: number;
  done?: number | null;            // counts (Shorts, Reels, long videos)
  total?: boolean; now?: number | null; gained?: number | null; need?: number | null; by?: string;   // subscriber / follower totals
};
export type Month = { label: string; from: string; to: string; daysLeft: number };

const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");
const sgn = (n: number) => (n >= 0 ? "+" : "−") + fmt(Math.abs(n));
const dmy = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const GREEN = "#2E9466", AMBER = "#B7791F", GREY = "#8C7F75", INK = "#1A1614", ORANGE = "#E8622B";

export function krMet(k: KR) { return k.total ? (k.now != null && (k.now >= k.target || (k.need != null && (k.gained ?? 0) >= k.need))) : (k.done ?? 0) >= k.target; }

function row(k: KR, mode: "mid" | "end") {
  const met = krMet(k);
  const tag = `<span style="display:inline-block;font-family:monospace;font-size:11px;font-weight:700;padding:2px 7px;border-radius:5px;background:#F4EEE8;color:#56514A">${esc(k.tag)}</span>`;
  if (k.total) {
    const now = k.now ?? 0, left = Math.max(0, k.target - now), g = k.gained ?? 0, need = k.need ?? 0;
    const status = now >= k.target ? "Target reached 🎉" : met ? "On course ✓" : mode === "mid" ? `+${fmt(Math.max(0, need - g))} more this month` : "Short of this month's share";
    return `<tr><td style="padding:10px 0;border-top:1px solid #EEE6DF">${tag}<div style="font-weight:700;margin-top:4px">${esc(k.label)}</div>
        <div style="color:${GREY};font-size:12px">Total to reach: ${fmt(k.target)}${k.by ? " by " + dmy(k.by) : ""} · now ${fmt(now)} (${fmt(left)} to go)</div></td>
      <td style="text-align:right;border-top:1px solid #EEE6DF;font-family:monospace;white-space:nowrap">${sgn(g)} <span style="color:${GREY}">/ +${fmt(need)}</span></td>
      <td style="text-align:right;border-top:1px solid #EEE6DF;color:${met ? GREEN : AMBER};font-weight:700;white-space:nowrap;padding-left:10px">${status}</td></tr>`;
  }
  const done = k.done ?? 0, left = Math.max(0, k.target - done);
  const status = met ? "Done ✓" : mode === "mid" ? `${left} to go` : `${left} left`;
  return `<tr><td style="padding:10px 0;border-top:1px solid #EEE6DF">${tag}<div style="font-weight:700;margin-top:4px">${esc(k.label)}</div>
      <div style="color:${GREY};font-size:12px">Target: at least ${fmt(k.target)} ${esc(k.unit)} this month</div></td>
    <td style="text-align:right;border-top:1px solid #EEE6DF;font-family:monospace;white-space:nowrap">${fmt(done)} <span style="color:${GREY}">/ ${fmt(k.target)}</span></td>
    <td style="text-align:right;border-top:1px solid #EEE6DF;color:${met ? GREEN : AMBER};font-weight:700;white-space:nowrap;padding-left:10px">${status}</td></tr>`;
}

export function buildMail(mode: "mid" | "end", name: string, M: Month, krs: KR[], link: string) {
  const first = String(name || "there").split(" ")[0], met = krs.filter(krMet).length, all = met === krs.length;
  const subject = mode === "mid"
    ? `${M.label}: ${krs.length - met} of your key result${krs.length - met === 1 ? "" : "s"} still to go — ${M.daysLeft} days left`
    : `Your ${M.label} key results: ${met} of ${krs.length} done`;
  const intro = mode === "mid"
    ? `<p>Hi ${esc(first)},</p><p>A quick friendly check-in on your key results for <b>${esc(M.label)}</b>. You're ${met ? `already there on <b>${met} of ${krs.length}</b>` : "on your way"}, and there are <b>${M.daysLeft} days</b> left in the month — here's what's still open:</p>`
    : `<p>Hi ${esc(first)},</p><p>Here's how <b>${esc(M.label)}</b> went against your key results — <b>${met} of ${krs.length}</b> done.</p>`;
  const outro = mode === "mid"
    ? `<p>No pressure — just so nothing slips past the 30th. If something is blocking a target, tell the team and we'll sort it out together. 🙌</p>`
    : all ? `<p>Every key result done — brilliant work this month! 🎉 Let's keep the same rhythm going next month.</p>`
      : `<p>Thanks for all the work this month. Please look into the ones still open next month, so your objectives get completed — and tell the team if anything is slowing you down, we're happy to help. 🙌</p>`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:${INK};max-width:620px">
    <div style="font-weight:800;font-size:18px;margin-bottom:12px">DU <span style="color:${ORANGE}">Buddy</span></div>${intro}
    <div style="border:1px solid #E5DDD5;border-radius:12px;padding:6px 16px 10px;margin:12px 0">
      <table style="width:100%;font-size:13.5px;border-collapse:collapse"><tr style="color:${GREY};font-size:11px;text-transform:uppercase;letter-spacing:.05em">
        <td style="padding:8px 0">Key result</td><td style="text-align:right">${mode === "mid" ? "So far" : "Done"}</td><td></td></tr>${krs.map((k) => row(k, mode)).join("")}</table></div>
    ${outro}<p style="margin:16px 0"><a href="${esc(link)}" style="background:${ORANGE};color:#fff;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:10px;display:inline-block">Open my OKRs</a></p>
    <p style="color:${GREY};font-size:12px">Counted from the posts on DU Buddy's YouTube and Instagram${mode === "mid" ? ", up to today" : ""}. Sent from Social Media → 🎯 Individual OKRs.</p></div>`;
  const text = `Hi ${first},\n\n` + (mode === "mid" ? `A friendly check-in on your ${M.label} key results — ${M.daysLeft} days left.\n\n` : `Your ${M.label} key results: ${met} of ${krs.length} done.\n\n`)
    + krs.map((k) => k.total ? `${k.label}: ${sgn(k.gained ?? 0)} of +${fmt(k.need ?? 0)} this month (now ${fmt(k.now ?? 0)} / ${fmt(k.target)})` : `${k.label}: ${fmt(k.done ?? 0)} / ${fmt(k.target)}`).join("\n")
    + "\n\n" + (mode === "mid" ? "No pressure — just so nothing slips past the end of the month." : all ? "Every key result done — brilliant work!" : "Please look into the open ones next month so your objectives get completed. We're happy to help.")
    + `\n\nOpen my OKRs: ${link}`;
  return { subject, html, text };
}
