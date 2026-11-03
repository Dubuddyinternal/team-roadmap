/* =====================================================================
   Individual OKR emails — one builder for both the page's 👁 Preview and the
   "social-okr" Edge Function (deployed next to it as okr-mail.js), so what you
   preview is what gets sent.
     mode "mid"  — the 15th: OKR status so far
     mode "end"  — the last day of the month: the month's summary (target vs done)
     mode "note" — ✍️ Write a mail: your message, optionally with the status below
   Tone: friendly notes, never warnings.
   OKRMAIL.build({ mode, name, period, asOf, daysLeft, objectives:[{title, pct, total, krs:[{title, type, done, target, pct, tag}]}],
                   subject, message, withStatus, link }) -> { subject, html, text }
   ===================================================================== */
(function (root) {
  "use strict";
  var esc = function (v) { return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  var fmt = function (n) { return Math.round(Number(n) || 0).toLocaleString("en-IN"); };
  var GREEN = "#2E9466", AMBER = "#B7791F", GREY = "#8C7F75", INK = "#1A1614", ORANGE = "#E8622B";
  function doneText(k) { return k.type === "manual_pct" ? fmt(k.done) + "%" : k.type === "count" ? k.done + " of " + k.target + " done" : fmt(k.done) + " / " + fmt(k.target); }
  function bar(pct, col) { return '<div style="height:6px;background:#EEE6DF;border-radius:99px;overflow:hidden;margin-top:5px"><div style="height:6px;width:' + Math.max(0, Math.min(100, pct)) + '%;background:' + col + '"></div></div>'; }
  function block(o, mode) {
    var rows = o.krs.map(function (k, i) {
      var met = k.pct >= 100, col = met ? GREEN : AMBER;
      var st = met ? "Done ✓" : mode === "end" ? "Open" : (k.type === "count" ? (k.target - k.done) + " to go" : k.type === "manual_pct" ? (k.target - k.done) + "% to go" : fmt(k.target - k.done) + " to go");
      return '<tr><td style="padding:9px 0;border-top:1px solid #EEE6DF;vertical-align:top;width:34px;color:' + GREY + ';font-family:monospace;font-size:12px">KR' + (i + 1) + '</td>'
        + '<td style="padding:9px 8px 9px 0;border-top:1px solid #EEE6DF"><div style="font-weight:700">' + esc(k.title) + '</div>'
        + '<div style="font-size:11.5px;color:' + GREY + '">' + esc(k.tag) + '</div>' + bar(k.pct, col) + '</td>'
        + '<td style="padding:9px 0;border-top:1px solid #EEE6DF;text-align:right;font-family:monospace;white-space:nowrap;vertical-align:top">' + doneText(k) + '<div style="color:' + col + ';font-family:Arial;font-weight:700;font-size:12px;margin-top:3px">' + st + '</div></td></tr>';
    }).join("");
    var tot = o.total && o.total.now != null ? '<div style="font-size:12.5px;color:' + GREY + ';margin:2px 0 6px">' + esc(o.total.label) + ' now <b style="color:' + INK + '">' + fmt(o.total.now) + '</b> of ' + fmt(o.total.target)
      + (o.total.gained != null ? ' · ' + (o.total.gained >= 0 ? "+" : "−") + fmt(Math.abs(o.total.gained)) + ' this period' : '') + '</div>' : "";
    return '<div style="border:1px solid #E5DDD5;border-radius:12px;padding:12px 16px 8px;margin:0 0 12px">'
      + '<table style="width:100%;border-collapse:collapse"><tr><td style="font-size:15px;font-weight:800">' + esc(o.title) + '</td><td style="text-align:right;font-size:20px;font-weight:800;color:' + (o.pct >= 100 ? GREEN : INK) + '">' + o.pct + '%</td></tr></table>'
      + tot + '<table style="width:100%;font-size:13.5px;border-collapse:collapse">' + rows + '</table></div>';
  }
  function build(d) {
    var first = String(d.name || "there").split(" ")[0], all = [];
    (d.objectives || []).forEach(function (o) { all = all.concat(o.krs); });
    var done = all.filter(function (k) { return k.pct >= 100; }).length, n = all.length;
    var overall = n ? Math.round(all.reduce(function (a, k) { return a + Math.min(100, k.pct); }, 0) / n) : 0;
    var subject = d.mode === "note" ? (d.subject || "A note from the DU Buddy team")
      : d.mode === "mid" ? "Your OKRs so far — " + d.period + ": " + overall + "% · " + done + " of " + n + " done"
      : "Your " + d.period + " OKRs: " + done + " of " + n + " key results done";
    var intro = d.mode === "note" ? '<p>Hi ' + esc(first) + ',</p><div style="white-space:pre-wrap">' + esc(d.message || "") + '</div>'
      : d.mode === "mid" ? '<p>Hi ' + esc(first) + ',</p><p>Here\'s a friendly look at your OKRs for <b>' + esc(d.period) + '</b>, as of ' + esc(d.asOf) + ' — you\'re at <b>' + overall + '%</b>, with <b>' + done + ' of ' + n + '</b> key results done and ' + d.daysLeft + ' days still to go.</p>'
      : '<p>Hi ' + esc(first) + ',</p><p>Here\'s how <b>' + esc(d.period) + '</b> went: <b>' + done + ' of ' + n + '</b> key results done, <b>' + overall + '%</b> overall.</p>';
    var outro = d.mode === "note" ? "" : d.mode === "mid"
      ? '<p>Keep going — and if something is getting in the way of a key result, tell the team and we\'ll figure it out together. 🙌</p>'
      : done === n ? '<p>Every key result done — brilliant work this month! 🎉 Let\'s keep the same rhythm next month.</p>'
        : '<p>Thanks for all your work this month. Please look into the ones still open next month, so your objectives get completed — and tell us if anything is slowing you down, we\'re happy to help. 🙌</p>';
    var status = d.mode !== "note" || d.withStatus ? (d.mode === "note" ? '<p style="color:' + GREY + ';font-size:12px;margin:18px 0 8px;text-transform:uppercase;letter-spacing:.05em">Your OKRs · ' + esc(d.period) + ' · ' + overall + '%</p>' : "")
      + (d.objectives || []).map(function (o) { return block(o, d.mode); }).join("") : "";
    var html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:' + INK + ';max-width:620px">'
      + '<div style="font-weight:800;font-size:18px;margin-bottom:12px">DU <span style="color:' + ORANGE + '">Buddy</span></div>' + intro + status + outro
      + '<p style="margin:16px 0"><a href="' + esc(d.link || "") + '" style="background:' + ORANGE + ';color:#fff;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:10px;display:inline-block">Open my OKRs</a></p>'
      + '<p style="color:' + GREY + ';font-size:12px">Ideas counted from Ideation, posts from DU Buddy\'s YouTube and Instagram. Sent from Social Media → 🎯 Individual OKRs.</p></div>';
    var text = "Hi " + first + ",\n\n" + (d.mode === "note" ? (d.message || "") + "\n\n" : "") + (status ? (d.objectives || []).map(function (o) {
      return o.title + " — " + o.pct + "%\n" + o.krs.map(function (k, i) { return "  KR" + (i + 1) + " " + k.title + ": " + doneText(k); }).join("\n"); }).join("\n\n") : "")
      + "\n\nOpen my OKRs: " + (d.link || "");
    return { subject: subject, html: html, text: text };
  }
  root.OKRMAIL = { build: build };
})(typeof globalThis !== "undefined" ? globalThis : this);
