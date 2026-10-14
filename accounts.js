/* =====================================================================
   ACCOUNTS  (database: supabase/stage19a_accounts.sql)

   · For me → 💸 My payments: anyone asks for money — a reimbursement
     (they already paid; it goes back to the bank account in their HR
     file) or a vendor payment (pay someone directly, e.g. an influencer),
     with the bill or invoice attached. Their paid salaries show here too.
   · Accounts → Payment requests: approve / reject, then mark paid with
     the bank reference. "Download bank file" gives a CSV for bulk upload.
   · Accounts → Payroll: a month's salaries from each person's CTC ÷ 12
     (HR job terms), plus bonus, reimbursements and deductions.
   Needs the "Accounts: payments & payroll" permission (owners have it).
   ===================================================================== */
var ACC = { tab: "pending", month: null, sel: {} };

function accEl(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function accMe() { return typeof currentUser === "function" ? currentUser() : null; }
function accCan() { var u = accMe(); return !!u && (u.super || (typeof hasPerm === "function" && hasPerm("accounts"))); }
function accToast(m) { var t = document.getElementById("toast"); if (t) t.style.zIndex = "10050"; if (typeof toast === "function") toast(m); }
function accErr(e) { return (e && (e.message || e.error_description)) || String(e || "unknown"); }
function accInr(n) { n = Number(n) || 0; return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
function accDate(d) { return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""; }
function accName(id) { var u = (typeof USERS !== "undefined" ? USERS : []).find(function (x) { return x.id === id; }); return u ? userDisplayName(u) : "Someone"; }
function accMonthNow() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
function accMonthLabel(m) { return new Date(m + "-01T00:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" }); }
var ACC_KIND = { reimbursement: "Reimbursement", vendor: "Vendor payment", advance: "Advance" };
var ACC_STATUS = { pending: ["Waiting", "amber"], approved: ["Approved · to pay", "blue"], paid: ["Paid", "green"], rejected: ["Not approved", "red"], cancelled: ["Cancelled", "grey"], draft: ["Draft", "grey"] };
// categories = the exact Zoho Books account names (stage19c, zoho-sync)
var ACC_CATS = [
  ["People and services", [["Influencer Expense", "Influencer"], ["Freelancer Expense", "Freelancer"], ["Consultant Expense", "Consultant (retainer)"], ["Professional Fee", "CA / legal / professional"]]],
  ["Marketing", [["Facebook Ads", "Facebook ads"], ["Google Ads", "Google ads"], ["Advertising And Marketing", "Other marketing"], ["MSG 91", "MSG91"]]],
  ["Software", [["Adobe", "Adobe"], ["Canva", "Canva"], ["Chatgpt", "ChatGPT"], ["Jotform", "Jotform"], ["Manychat", "Manychat"], ["Software Charges", "Other software"]]],
  ["Team", [["Meals and Entertainment", "Team food"], ["Staff Celebration", "Team celebration"], ["Staff Skill Development", "Courses / training"], ["Travel Expense", "Travel"]]],
  ["Office", [["Rent Expense", "Rent"], ["Electricity", "Electricity"], ["Office Supplies", "Office supplies"], ["Printing and Stationery", "Printing"], ["Telephone Expense", "Phone"], ["Internet Expense", "Internet"], ["Repairs and Maintenance", "Repairs"]]],
  ["Things the company keeps", [["Computer", "Laptop / monitor"], ["Furniture and Equipment", "Furniture"]]],
  ["Other", [["Other Expenses", "Anything else"]]]
];
var ACC_LEGACY = { "Influencer / creator": "Influencer Expense", "Ads": "Advertising And Marketing", "Travel": "Travel Expense", "Food": "Meals and Entertainment",
  "Software / subscription": "Software Charges", "Equipment": "Other Expenses", "Office": "Office Supplies", "Printing": "Printing and Stationery", "Freelancer": "Freelancer Expense", "Other": "Other Expenses" };
var ACC_PAID_FROM = [["Punjab National Bank", "Punjab National Bank"], ["Pancham Imprest", "Pancham's HDFC card (Pancham Imprest)"], ["Mannat Imprest", "Mannat's advance (Mannat Imprest)"], ["Imprest", "Another advance (Imprest)"]];
var ACC_IMPRESTS = ["Pancham Imprest", "Mannat Imprest", "Imprest"];
var ACC_194C = ["Influencer Expense", "Freelancer Expense"], ACC_194J = ["Professional Fee", "Consultant Expense"];
var ZOHO_ORG = "60041846412";
function accCatOf(c) { return ACC_LEGACY[c] || c || ""; }
function accCatLabel(c) {
  c = accCatOf(c); var hit = "";
  ACC_CATS.forEach(function (g) { g[1].forEach(function (x) { if (x[0] === c) hit = x[1]; }); });
  return hit || c;
}
function accCatSelect(val) {
  var sel = accEl("select"); var o0 = accEl("option", null, "Choose…"); o0.value = ""; sel.appendChild(o0);
  ACC_CATS.forEach(function (g) { var og = accEl("optgroup"); og.label = g[0]; g[1].forEach(function (x) { var o = accEl("option", null, x[1]); o.value = x[0]; og.appendChild(o); }); sel.appendChild(og); });
  sel.value = accCatOf(val);
  return sel;
}
function accNet(r) { return Number(r.amount) - Number(r.tds_amount || 0); }
function accChip(st) { var s = ACC_STATUS[st] || [st, "grey"]; return accEl("span", "hr-chip hr-" + s[1], s[0]); }
var ZOHO_CHIP = { pending: ["Zoho: waiting", "amber"], synced: ["Zoho ✓", "green"], failed: ["Zoho: failed", "red"], dry_run: ["Zoho: dry run", "grey"], manual: ["Zoho: enter by hand", "amber"] };
function accZohoLinks(ids) {
  var out = [];
  if (!ids) return out;
  if (ids.expense) out.push(["Expense", "https://books.zoho.in/app/" + ZOHO_ORG + "#/expenses/" + ids.expense]);
  if (ids.journal) out.push(["Journal", "https://books.zoho.in/app/" + ZOHO_ORG + "#/journals/" + ids.journal]);
  (ids.journals || []).forEach(function (j, i) { out.push(["Journal" + (i ? " " + (i + 1) : ""), "https://books.zoho.in/app/" + ZOHO_ORG + "#/journals/" + j.id]); });
  return out;
}
// post to Zoho Books (Edge Function zoho-sync); returns the reply or null
async function accZoho(body, quiet) {
  try {
    var r = await SUPA.functions.invoke("zoho-sync", { body: body });
    var err = r.error ? r.error.message : (r.data && r.data.error);
    if (r.error) { try { var j = await r.error.context.json(); if (j && j.error) err = j.error; } catch (_) { } }
    if (err) { if (!quiet) accToast("Zoho: " + err); return null; }
    if (!quiet && r.data) accToast(r.data.dry ? "Zoho dry run: logged what would be posted (nothing sent)" : "Posted to Zoho Books");
    return r.data;
  } catch (e) { if (!quiet) accToast("Zoho: " + accErr(e)); return null; }
}

(function () {
  var css = ".acc-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}.acc-tabs button{border:1px solid var(--line);background:#fff;border-radius:99px;padding:7px 14px;font:600 13px var(--sans);cursor:pointer;color:var(--ink)}"
    + ".acc-tabs button.on{background:var(--indigo-soft);border-color:#F5CDB6;color:var(--indigo)}"
    + ".acc-amt{font-weight:800;font-size:15px;white-space:nowrap}.acc-row{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-top:1px solid var(--line)}"
    + ".acc-row:first-child{border-top:0}.acc-row .main{flex:1;min-width:0}.acc-row .t{font-weight:700}.acc-row .h{color:var(--muted);font-size:12.5px;margin-top:2px;overflow-wrap:anywhere}"
    + ".acc-row .side{display:flex;flex-direction:column;align-items:flex-end;gap:6px}.acc-row .acc-acts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}"
    + ".acc-kind{display:flex;gap:8px;margin:10px 0}.acc-kind button{flex:1;border:1.5px solid var(--line-strong);background:#fff;border-radius:12px;padding:12px;text-align:left;cursor:pointer;font:13px var(--sans);color:var(--ink)}"
    + ".acc-kind button b{display:block;font-size:14px;margin-bottom:2px}.acc-kind button.on{border-color:var(--indigo);background:var(--indigo-soft)}"
    + ".acc-tbl{width:100%;border-collapse:collapse;font-size:13.5px}.acc-tbl th{text-align:left;font:600 11px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding:8px 6px;border-bottom:1px solid var(--line)}"
    + ".acc-tbl td{padding:8px 6px;border-bottom:1px solid var(--line);vertical-align:middle}.acc-tbl input{width:96px;padding:6px 8px;border:1px solid var(--line-strong);border-radius:8px;font:inherit;text-align:right}"
    + ".acc-tbl input.note{width:150px;text-align:left}.acc-tbl .num{text-align:right;white-space:nowrap}.acc-tbl tfoot td{font-weight:800}"
    + ".acc-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0}.acc-stats .s{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px}"
    + ".acc-stats .s b{display:block;font-size:20px}.acc-stats .s span{color:var(--muted);font-size:12.5px}"
    + "@media(max-width:820px){.acc-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.acc-row{flex-wrap:wrap}.acc-row .side{align-items:flex-start}.acc-tbl-wrap{overflow-x:auto}}";
  var st = document.createElement("style"); st.textContent = css; (document.head || document.documentElement).appendChild(st);
})();

/* ---------- files ---------- */
async function accUpload(reqId, file) {
  var me = accMe();
  var ok = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  if (ok.indexOf(file.type) < 0) { accToast("Attach a PDF, JPG, PNG or WEBP: " + file.name); return false; }
  if (file.size > 10485760) { accToast("Files can be up to 10 MB: " + file.name); return false; }
  var path = me.id + "/" + reqId + "-" + Math.random().toString(36).slice(2, 8) + "-" + file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  var up = await SUPA.storage.from("acc-docs").upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) { accToast("Upload failed: " + accErr(up.error)); return false; }
  var ins = await SUPA.from("acc_files").insert({ request_id: reqId, user_id: me.id, path: path, file_name: file.name.slice(0, 200), mime: file.type, size: file.size });
  if (ins.error) { accToast("Upload failed: " + accErr(ins.error)); return false; }
  return true;
}
async function accOpenFile(path) {
  var w = window.open("about:blank", "_blank");
  var r = await SUPA.storage.from("acc-docs").createSignedUrl(path, 120);
  if (r.error) { if (w) w.close(); accToast("Couldn't open it: " + accErr(r.error)); return; }
  if (w) { try { w.opener = null; } catch (_) { } w.location.href = r.data.signedUrl; } else location.href = r.data.signedUrl;
}
function accFileLinks(files) {
  var box = accEl("div", "h");
  (files || []).forEach(function (f) { var b = accEl("button", "hr-reveal", "📎 " + f.file_name); b.style.marginLeft = "0"; b.style.marginRight = "8px"; b.onclick = function () { accOpenFile(f.path); }; box.appendChild(b); });
  return box;
}

/* ---------- asking for money ---------- */
function accNewRequest(after) {
  var kind = "reimbursement";
  var ov = accEl("div", "hr-ask"), bx = accEl("div", "box"); ov.setAttribute("data-plain", "");
  bx.style.cssText = "width:min(640px,100%);max-height:94vh;overflow-y:auto";
  bx.appendChild(accEl("h3", null, "Ask for a payment"));
  var kinds = accEl("div", "acc-kind");
  var kb = {};
  [["reimbursement", "🧾 I already paid", "Get it back in your bank account (from your HR file)"], ["vendor", "🤝 Pay someone", "Accounts pays them directly, e.g. an influencer or freelancer"], ["advance", "💼 I need an advance", "Money upfront for work spending; you send the bills later"]].forEach(function (k) {
    var b = accEl("button"); b.type = "button"; b.appendChild(accEl("b", null, k[1])); b.appendChild(document.createTextNode(k[2]));
    b.onclick = function () { kind = k[0]; draw(); }; kb[k[0]] = b; kinds.appendChild(b);
  });
  bx.appendChild(kinds);
  var f = accEl("div", "hr-fields");
  var fld = function (lbl, inp, wide, req) { var w = accEl("div", "field" + (wide ? " wide" : "")); var l = accEl("label", null, lbl); if (req) l.appendChild(accEl("span", "req", " *")); w.append(l, inp); f.appendChild(w); return w; };
  var title = accEl("input"); title.placeholder = "e.g. Reel with @creatorname for the CUET campaign";
  var amount = accEl("input"); amount.type = "number"; amount.min = "1"; amount.step = "0.01"; amount.placeholder = "50000";
  var cat = accCatSelect("");
  var when = accEl("input"); when.type = "date"; when.value = new Date().toISOString().slice(0, 10);
  var notes = accEl("textarea"); notes.rows = 2; notes.placeholder = "Anything Accounts should know";
  fld("What is it for", title, true, true); fld("Amount (₹)", amount, false, true);
  var catW = fld("Type", cat);
  var whenW = fld("Date you paid", when);
  var pn = accEl("input"); pn.placeholder = "Name as on their bank account";
  var pu = accEl("input"); pu.placeholder = "e.g. name@okaxis";
  var pa = accEl("input"); pa.placeholder = "Account number";
  var pi = accEl("input"); pi.placeholder = "e.g. HDFC0001234"; pi.style.textTransform = "uppercase";
  var pb = accEl("input"); pb.placeholder = "Bank name";
  var pp = accEl("input"); pp.placeholder = "Optional, for TDS"; pp.style.textTransform = "uppercase";
  var vend = [fld("Pay to", pn, true, true), fld("UPI ID", pu), fld("PAN", pp), fld("Account number", pa), fld("IFSC", pi), fld("Bank", pb)];
  var gb = accEl("label", "hr-check"); var gcb = accEl("input"); gcb.type = "checkbox";
  gb.append(gcb, document.createTextNode("The bill shows our GSTIN (06AAMCC3851G1ZN)"));
  var gw = accEl("div", "field wide"); gw.appendChild(gb); f.appendChild(gw);
  var gi = accEl("input"); gi.placeholder = "Seller's GSTIN, e.g. 29ABCDE1234F1Z5"; gi.style.textTransform = "uppercase"; gi.maxLength = 15;
  var giW = fld("Seller's GSTIN", gi, true);
  gcb.onchange = function () { draw(); };
  fld("Notes", notes, true);
  bx.appendChild(f);
  var vhint = accEl("div", "hint", "Give either their UPI ID, or their account number and IFSC.");
  bx.appendChild(vhint);
  var files = accEl("input"); files.type = "file"; files.multiple = true; files.accept = "application/pdf,image/jpeg,image/png,image/webp";
  var fl = accEl("div", "field wide"); fl.style.marginTop = "10px"; var fll = accEl("label", null, "Bill / invoice"); fl.append(fll, files); bx.appendChild(fl);
  function draw() {
    Object.keys(kb).forEach(function (k) { kb[k].classList.toggle("on", k === kind); });
    vend.forEach(function (w) { w.hidden = kind !== "vendor"; }); vhint.hidden = kind !== "vendor";
    whenW.hidden = kind !== "reimbursement";
    catW.hidden = gw.hidden = kind === "advance"; giW.hidden = kind === "advance" || !gcb.checked;
    fl.hidden = kind === "advance";
    fll.textContent = kind === "vendor" ? "Their invoice (attach it if you have one)" : "Bill or receipt (please attach)";
  }
  draw();
  var row = accEl("div", "hr-foot");
  var cl = accEl("button", "btn", "Cancel"); cl.onclick = function () { ov.remove(); };
  var go = accEl("button", "btn save", "Send to Accounts");
  go.onclick = async function () {
    if (title.value.trim().length < 2) { accToast("Say what it's for"); title.focus(); return; }
    if (!(parseFloat(amount.value) > 0)) { accToast("Enter the amount"); amount.focus(); return; }
    if (kind === "vendor" && (pn.value.trim().length < 2 || (!pu.value.trim() && !(pa.value.trim() && pi.value.trim())))) { accToast("Add who to pay, and their UPI ID or account number and IFSC"); return; }
    if (kind !== "advance" && gcb.checked && !/^\d{2}[A-Z0-9]{13}$/.test(gi.value.trim().toUpperCase())) { accToast("Enter the seller's 15-character GSTIN"); gi.focus(); return; }
    if (kind === "reimbursement" && !files.files.length && !go.dataset.ok) { go.dataset.ok = "1"; go.textContent = "No bill attached. Send anyway?"; return; }
    go.disabled = true; go.textContent = "Sending…";
    var r = await SUPA.rpc("acc_request_create", { p: { kind: kind, title: title.value.trim(), amount: amount.value, category: cat.value, spent_on: kind === "reimbursement" ? when.value : "",
      notes: notes.value.trim(), payee_name: pn.value, payee_upi: pu.value, payee_account: pa.value, payee_ifsc: pi.value, payee_bank: pb.value, payee_pan: pp.value,
      has_gst_bill: kind !== "advance" && gcb.checked, vendor_gstin: gi.value.trim().toUpperCase() } });
    if (r.error) { accToast(accErr(r.error)); go.disabled = false; go.textContent = "Send to Accounts"; return; }
    for (var i = 0; i < files.files.length; i++) await accUpload(r.data.id, files.files[i]);
    ov.remove(); accToast("Sent to Accounts. You'll get a 🔔 when it's approved and paid."); if (after) after();
  };
  row.append(accEl("div", "grow"), cl, go); bx.appendChild(row); ov.appendChild(bx);
  document.body.appendChild(ov); title.focus();
}
function accRequestRow(r, files, opts) {
  opts = opts || {};
  var row = accEl("div", "acc-row"), main = accEl("div", "main"), side = accEl("div", "side");
  if (opts.select) { var cb = accEl("input"); cb.type = "checkbox"; cb.checked = !!ACC.sel[r.id]; cb.style.marginTop = "4px"; cb.onchange = function () { if (cb.checked) ACC.sel[r.id] = r; else delete ACC.sel[r.id]; if (opts.onSel) opts.onSel(); }; row.appendChild(cb); }
  main.appendChild(accEl("div", "t", r.title));
  var who = opts.mine ? "" : accName(r.user_id) + " · ";
  main.appendChild(accEl("div", "h", (r.ref_no ? "TOOLS-" + r.ref_no + " · " : "") + who + ACC_KIND[r.kind] + (r.category ? " · " + accCatLabel(r.category) : "") + " · asked " + accDate(r.created_at) + (r.spent_on ? " · paid by them on " + accDate(r.spent_on) : "")));
  var extra = [];
  if (Number(r.tds_amount) > 0) extra.push("TDS " + (r.tds_section ? r.tds_section + " " : "") + Number(r.tds_percent) + "% = " + accInr(r.tds_amount) + " · pay " + accInr(accNet(r)));
  if (r.has_gst_bill) extra.push("GST bill · " + r.vendor_gstin);
  if (r.kind === "advance" && r.imprest_account) extra.push("Into " + r.imprest_account);
  if (extra.length) main.appendChild(accEl("div", "h", extra.join(" · ")));
  if (r.kind === "vendor") main.appendChild(accEl("div", "h", "Pay to: " + r.payee_name + [r.payee_upi ? "UPI " + r.payee_upi : "", r.payee_account ? "A/c " + r.payee_account : "", r.payee_ifsc, r.payee_bank, r.payee_pan ? "PAN " + r.payee_pan : ""].filter(Boolean).map(function (x) { return " · " + x; }).join("")));
  if (r.notes) main.appendChild(accEl("div", "h", "“" + r.notes + "”"));
  if (r.decision_note) main.appendChild(accEl("div", "h", (r.status === "rejected" ? "Why not: " : "Note: ") + r.decision_note));
  if (r.status === "paid") main.appendChild(accEl("div", "h", "Paid " + accDate(r.paid_at) + (r.paid_ref ? " · Ref " + r.paid_ref : "") + (r.paid_from && r.paid_from !== "Punjab National Bank" ? " · from " + r.paid_from : "")));
  if (!opts.mine && r.status === "paid" && r.zoho_status && r.zoho_status !== "none") {
    var zl = accEl("div", "h"), zc = ZOHO_CHIP[r.zoho_status] || [r.zoho_status, "grey"];
    zl.appendChild(accEl("span", "hr-chip hr-" + zc[1], zc[0]));
    accZohoLinks(r.zoho_ids).forEach(function (l) { var a = accEl("a", null, " " + l[0] + " ↗"); a.href = l[1]; a.target = "_blank"; a.rel = "noopener"; a.style.marginLeft = "6px"; zl.appendChild(a); });
    if (r.zoho_error) zl.appendChild(accEl("span", null, " " + r.zoho_error));
    if (r.zoho_status !== "synced" && r.zoho_status !== "manual") {
      var rt = accEl("button", "hr-reveal", "↻ Retry"); rt.onclick = async function () { rt.disabled = true; await accZoho({ action: "requests", ids: [r.id] }); renderAdminPage(); }; zl.appendChild(rt);
    }
    main.appendChild(zl);
  }
  var fs = (files || []).filter(function (f) { return f.request_id === r.id; });
  if (fs.length) main.appendChild(accFileLinks(fs));
  side.append(accEl("div", "acc-amt", accInr(r.amount)), accChip(r.status));
  if (Number(r.tds_amount) > 0) side.appendChild(accEl("div", "h", "net " + accInr(accNet(r))));
  if (opts.acts) { var a = accEl("div", "acc-acts"); opts.acts(a); if (a.children.length) side.appendChild(a); }
  row.append(main, side);
  return row;
}

// For me → 💸 My payments
function renderAdminMyPayments(wrap) {
  var head = accEl("div", "module-head"); head.style.cssText += ";display:flex;align-items:center;gap:10px;flex-wrap:wrap";
  head.appendChild(accEl("h2", null, "My payments"));
  var add = accEl("button", "btn save", "＋ Ask for a payment"); add.style.marginLeft = "auto"; add.onclick = function () { accNewRequest(function () { renderAdminPage(); }); };
  head.appendChild(add); wrap.appendChild(head);
  wrap.appendChild(accEl("div", "hint", "Spent your own money on work? Ask for a reimbursement. Need someone paid, like an influencer or a freelancer? Ask Accounts to pay them."));
  var card = accEl("div", "hr-card"); card.style.cssText = "max-width:900px;margin-top:12px"; card.setAttribute("data-plain", "");
  card.appendChild(accEl("div", "hint", "Loading…")); wrap.appendChild(card);
  var me = accMe();
  Promise.all([SUPA.from("acc_requests").select("*").eq("user_id", me.id).order("created_at", { ascending: false }),
               SUPA.from("acc_files").select("*").eq("user_id", me.id),
               SUPA.from("acc_payroll").select("*").eq("user_id", me.id).order("month", { ascending: false })]).then(function (res) {
    card.innerHTML = "";
    if (res[0].error) { card.appendChild(accEl("div", "hr-note warn", "Run supabase/stage19a_accounts.sql first (" + accErr(res[0].error) + ")")); return; }
    var list = res[0].data || [], files = res[1].data || [], pay = res[2].data || [];
    card.appendChild(accEl("h3", null, "Requests"));
    if (!list.length) card.appendChild(accEl("div", "hint", "Nothing yet. Press ＋ Ask for a payment."));
    var box = accEl("div"); card.appendChild(box);
    list.forEach(function (r) {
      box.appendChild(accRequestRow(r, files, { mine: true, acts: function (a) {
        if (r.status !== "pending") return;
        var c = accEl("button", "btn", "Cancel");
        c.onclick = async function () { var x = await SUPA.rpc("acc_request_cancel", { p_id: r.id }); if (x.error) { accToast(accErr(x.error)); return; } accToast("Cancelled"); renderAdminPage(); };
        a.appendChild(c);
      } }));
    });
    if (pay.length) {
      var c2 = accEl("div", "hr-sec"); c2.appendChild(accEl("h4", null, "Salary paid"));
      pay.forEach(function (p) {
        var row = accEl("div", "acc-row"), main = accEl("div", "main"), side = accEl("div", "side");
        main.append(accEl("div", "t", accMonthLabel(p.month)), accEl("div", "h", "Salary " + accInr(p.base) + (p.bonus ? " + bonus " + accInr(p.bonus) : "") + (p.reimb ? " + reimbursements " + accInr(p.reimb) : "") + (p.deductions ? " − deductions " + accInr(p.deductions) : "") + " · paid " + accDate(p.paid_at) + (p.paid_ref ? " · Ref " + p.paid_ref : "")));
        side.appendChild(accEl("div", "acc-amt", accInr(p.base + p.bonus + p.reimb - p.deductions)));
        row.append(main, side); c2.appendChild(row);
      });
      card.appendChild(c2);
    }
  });
}

/* ---------- bookkeeping details (Accounts) ---------- */
function accBooksDialog(r) {
  var ov = accEl("div", "hr-ask"), bx = accEl("div", "box"); ov.setAttribute("data-plain", ""); bx.style.width = "min(580px,100%)";
  bx.appendChild(accEl("h3", null, "Books · TOOLS-" + r.ref_no));
  bx.appendChild(accEl("div", "hint", r.title + " · " + accInr(r.amount)));
  var f = accEl("div", "hr-fields"); f.style.marginTop = "10px";
  var fld = function (lbl, inp, wide) { var w = accEl("div", "field" + (wide ? " wide" : "")); w.append(accEl("label", null, lbl), inp); f.appendChild(w); return w; };
  var cat = accCatSelect(r.category);
  var sec = accEl("select"); [["", "No TDS"], ["194C", "194C contractor"], ["194J", "194J professional / technical"], ["194H", "194H commission"], ["194I", "194I rent"]].forEach(function (x) { var o = accEl("option", null, x[1]); o.value = x[0]; sec.appendChild(o); });
  sec.value = r.tds_section || "";
  var pct = accEl("input"); pct.type = "number"; pct.min = "0"; pct.max = "50"; pct.step = "0.1"; pct.value = Number(r.tds_percent) || "";
  var sd = accEl("input"); sd.type = "date"; sd.value = r.spent_on || "";
  var gcb = accEl("input"); gcb.type = "checkbox"; gcb.checked = !!r.has_gst_bill;
  var gl = accEl("label", "hr-check"); gl.append(gcb, document.createTextNode("GST bill showing our GSTIN (claim input credit)"));
  var gi = accEl("input"); gi.value = r.vendor_gstin || ""; gi.placeholder = "Seller's GSTIN"; gi.style.textTransform = "uppercase"; gi.maxLength = 15;
  var imp = accEl("select"); ACC_IMPRESTS.forEach(function (x) { var o = accEl("option", null, x); o.value = x; imp.appendChild(o); }); imp.value = r.imprest_account || "Imprest";
  var catW = fld("Zoho account", cat, true);
  var secW = fld("TDS section", sec), pctW = fld("TDS %", pct);
  var sdW = fld(r.kind === "vendor" ? "Invoice / service date" : "Bill date", sd);
  var gw = accEl("div", "field wide"); gw.appendChild(gl); f.appendChild(gw);
  var giW = fld("Seller's GSTIN", gi, true);
  var impW = fld("Advance goes into", imp, true);
  bx.appendChild(f);
  var calc = accEl("div", "hr-rule-prev"); calc.style.marginTop = "10px"; bx.appendChild(calc);
  var asset = accEl("div", "hr-note warn"); asset.textContent = "Laptops, monitors and furniture are assets: they go into Zoho as a bill with the seller. The tool will flag it for you to enter in Zoho by hand."; bx.appendChild(asset);
  function draw() {
    var isAdv = r.kind === "advance", isVend = r.kind === "vendor";
    catW.hidden = gw.hidden = sdW.hidden = isAdv; impW.hidden = !isAdv; secW.hidden = pctW.hidden = !isVend; giW.hidden = isAdv || !gcb.checked;
    var c = cat.value, t = Math.round(Number(r.amount) * (parseFloat(pct.value) || 0) / 100);
    var hint = isVend && !sec.value ? (ACC_194C.indexOf(c) >= 0 ? "Usually 194C: 1% (individual) or 2% (company)." : ACC_194J.indexOf(c) >= 0 ? "Usually 194J: 10%." : "") : "";
    calc.textContent = isVend ? (t ? "TDS " + accInr(t) + " · pay them " + accInr(Number(r.amount) - t) : "No TDS · pay them " + accInr(r.amount)) + (hint ? " · " + hint : "") : isAdv ? "Zoho: Dr " + imp.value + " / Cr bank" : "Zoho: expense via Employee Reimbursements, then the bank pays them back";
    asset.hidden = ["Computer", "Furniture and Equipment"].indexOf(c) < 0;
  }
  sec.onchange = function () { if (sec.value === "194J" && !pct.value) pct.value = 10; if (sec.value === "194C" && !pct.value) pct.value = 1; if (!sec.value) pct.value = ""; draw(); };
  [cat, pct, gcb, imp].forEach(function (x) { x.oninput = draw; x.onchange = draw; });
  draw();
  var row = accEl("div", "hr-foot");
  var cl = accEl("button", "btn", "Cancel"); cl.onclick = function () { ov.remove(); };
  var sv = accEl("button", "btn save", "Save");
  sv.onclick = async function () {
    sv.disabled = true;
    var x = await SUPA.rpc("acc_request_edit", { p_id: r.id, p: { category: cat.value, tds_section: sec.value, tds_percent: sec.value ? pct.value : 0, has_gst_bill: gcb.checked,
      vendor_gstin: gi.value.trim().toUpperCase(), spent_on: sd.value, imprest_account: imp.value } });
    if (x.error) { accToast(accErr(x.error)); sv.disabled = false; return; }
    ov.remove(); accToast("Saved"); renderAdminPage();
  };
  row.append(accEl("div", "grow"), cl, sv); bx.appendChild(row); ov.appendChild(bx); document.body.appendChild(ov);
}

/* ---------- Accounts → Payment requests ---------- */
async function accMarkPaidDialog(title, count, total, opts) {
  opts = opts || {};
  return new Promise(function (done) {
    var ov = accEl("div", "hr-ask"), bx = accEl("div", "box"); ov.setAttribute("data-plain", ""); bx.style.width = "min(460px,100%)";
    bx.appendChild(accEl("h3", null, title));
    bx.appendChild(accEl("div", "hint", count + (count === 1 ? " payment" : " payments") + " · " + accInr(total)));
    var f = accEl("div", "hr-fields"); f.style.marginTop = "10px";
    var d = accEl("input"); d.type = "date"; d.value = new Date().toISOString().slice(0, 10);
    var ref = accEl("input"); ref.placeholder = "UTR / bank reference (optional)";
    [["Paid on", d], ["Reference", ref]].forEach(function (x) { var w = accEl("div", "field"); w.append(accEl("label", null, x[0]), x[1]); f.appendChild(w); });
    var pf = null;
    if (opts.paidFrom) {
      pf = accEl("select"); ACC_PAID_FROM.forEach(function (x) { var o = accEl("option", null, x[1]); o.value = x[0]; pf.appendChild(o); });
      var w2 = accEl("div", "field wide"); w2.append(accEl("label", null, "Paid from"), pf); f.appendChild(w2);
    }
    bx.appendChild(f);
    var warn = accEl("div", "hr-note warn"); warn.hidden = true; bx.appendChild(warn);
    var check = function () { var m = opts.warnFor && opts.warnFor(d.value); warn.textContent = m || ""; warn.hidden = !m; };
    d.onchange = check; check();
    bx.appendChild(accEl("div", "hint", "This also posts it to Zoho Books."));
    var row = accEl("div", "hr-foot");
    var cl = accEl("button", "btn", "Cancel"); cl.onclick = function () { ov.remove(); done(null); };
    var go = accEl("button", "btn save", "Mark paid"); go.onclick = function () { ov.remove(); done({ date: d.value, ref: ref.value.trim(), paidFrom: pf ? pf.value : "Punjab National Bank" }); };
    row.append(accEl("div", "grow"), cl, go); bx.appendChild(row); ov.appendChild(bx); document.body.appendChild(ov);
  });
}
// a CSV the bank's bulk-payment upload can take (columns can be rearranged in a spreadsheet)
function accDownloadCsv(name, rows) {
  var head = ["Beneficiary name", "Account number", "IFSC", "Bank", "UPI ID", "Amount", "Payment mode", "Narration", "Email"];
  var q = function (v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  var csv = [head].concat(rows.map(function (r) { return [r.name, r.account || "", r.ifsc, r.bank, r.upi, Number(r.amount).toFixed(2), r.account ? (r.amount > 200000 ? "RTGS" : "NEFT") : "UPI", r.note, r.email]; }))
    .map(function (r) { return r.map(q).join(","); }).join("\r\n");
  var a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
async function accRequestsCsv(list) {
  var reimb = list.filter(function (r) { return r.kind !== "vendor"; }).map(function (r) { return r.user_id; });
  var bank = {};
  if (reimb.length) { var b = await SUPA.rpc("acc_bank_rows", { p_users: reimb }); (b.data || []).forEach(function (x) { bank[x.user_id] = x; }); }
  var missing = [];
  var rows = list.map(function (r) {
    if (r.kind === "vendor") return { name: r.payee_name, account: r.payee_account, ifsc: r.payee_ifsc, bank: r.payee_bank, upi: r.payee_upi, amount: accNet(r), note: "TOOLS-" + r.ref_no, email: "" };
    var x = bank[r.user_id] || {};
    if (!x.account) missing.push(accName(r.user_id));
    return { name: x.holder || accName(r.user_id), account: x.account, ifsc: x.ifsc, bank: x.bank, upi: "", amount: accNet(r), note: "TOOLS-" + r.ref_no, email: x.email || "" };
  });
  accDownloadCsv("payments-" + new Date().toISOString().slice(0, 10) + ".csv", rows);
  if (missing.length) accToast("No bank details in the HR file for: " + missing.join(", "));
}
function renderAdminAccRequests(wrap) {
  var head = accEl("div", "module-head"); head.appendChild(accEl("h2", null, "Payment requests")); wrap.appendChild(head);
  wrap.appendChild(accEl("div", "hint", "Reimbursements and vendor payments the team asked for. Approve them, pay them from the bank (download the bank file for a bulk upload), then mark them paid."));
  var body = accEl("div"); body.appendChild(accEl("div", "hint", "Loading…")); wrap.appendChild(body);
  Promise.all([SUPA.from("acc_requests").select("*").order("created_at", { ascending: false }).limit(500), SUPA.from("acc_files").select("*"),
               SUPA.from("acc_payroll").select("user_id,month,reimb,status").neq("status", "paid").gt("reimb", 0)]).then(function (res) {
    body.innerHTML = "";
    var inPayroll = {}; (res[2].data || []).forEach(function (p) { inPayroll[p.user_id] = p.month; });   // reimbursements also counted in an unpaid salary
    if (res[0].error) { body.appendChild(accEl("div", "hr-note warn", "Run supabase/stage19a_accounts.sql first (" + accErr(res[0].error) + ")")); return; }
    var all = res[0].data || [], files = res[1].data || [];
    var sum = function (st) { return all.filter(function (r) { return r.status === st; }).reduce(function (a, r) { return a + Number(r.amount); }, 0); };
    var cnt = function (st) { return all.filter(function (r) { return r.status === st; }).length; };
    var month = accMonthNow();
    var stats = accEl("div", "acc-stats");
    [[cnt("pending"), "waiting · " + accInr(sum("pending"))], [cnt("approved"), "to pay · " + accInr(sum("approved"))],
     [accInr(all.filter(function (r) { return r.status === "paid" && String(r.paid_at || "").slice(0, 7) === month; }).reduce(function (a, r) { return a + Number(r.amount); }, 0)), "paid this month"],
     [all.filter(function (r) { return r.kind === "vendor" && r.status !== "rejected" && r.status !== "cancelled"; }).length, "vendor payments in all"]].forEach(function (x) {
      var s = accEl("div", "s"); s.append(accEl("b", null, String(x[0])), accEl("span", null, x[1])); stats.appendChild(s);
    });
    body.appendChild(stats);
    var tabs = accEl("div", "acc-tabs");
    [["pending", "To approve (" + cnt("pending") + ")"], ["approved", "To pay (" + cnt("approved") + ")"], ["paid", "Paid"], ["rejected", "Not approved"], ["all", "All"]].forEach(function (t) {
      var b = accEl("button", ACC.tab === t[0] ? "on" : "", t[1]); b.type = "button"; b.onclick = function () { ACC.tab = t[0]; ACC.sel = {}; renderAdminPage(); }; tabs.appendChild(b);
    });
    body.appendChild(tabs);
    var list = all.filter(function (r) { return ACC.tab === "all" ? true : ACC.tab === "rejected" ? (r.status === "rejected" || r.status === "cancelled") : r.status === ACC.tab; });
    var card = accEl("div", "hr-card"); card.setAttribute("data-plain", "");
    var bar = null;
    if (ACC.tab === "approved" && list.length) {
      bar = accEl("div", "hr-foot"); bar.style.cssText = "margin:0 0 6px;padding-bottom:8px;border-bottom:1px solid var(--line)";
      var info = accEl("span", "hint");
      var allb = accEl("button", "btn", "Select all"); allb.onclick = function () { list.forEach(function (r) { ACC.sel[r.id] = r; }); renderAdminPage(); };
      var csv = accEl("button", "btn", "⬇ Download bank file");
      var paid = accEl("button", "btn save", "Mark paid");
      var upd = function () {
        var s = Object.keys(ACC.sel).map(function (k) { return ACC.sel[k]; });
        info.textContent = s.length ? s.length + " selected · pay " + accInr(s.reduce(function (a, r) { return a + accNet(r); }, 0)) : "Select the ones you're paying";
        csv.disabled = paid.disabled = !s.length;
      };
      csv.onclick = function () { accRequestsCsv(Object.keys(ACC.sel).map(function (k) { return ACC.sel[k]; })); };
      paid.onclick = async function () {
        var s = Object.keys(ACC.sel).map(function (k) { return ACC.sel[k]; });
        var d = await accMarkPaidDialog("Mark as paid", s.length, s.reduce(function (a, r) { return a + accNet(r); }, 0), { paidFrom: true }); if (!d) return;
        var ids = s.map(function (r) { return r.id; });
        var x = await SUPA.rpc("acc_pay", { p_ids: ids, p_date: d.date, p_ref: d.ref || null, p_paid_from: d.paidFrom });
        if (x.error) { accToast(accErr(x.error)); return; }
        accToast(x.data + " marked paid. Posting to Zoho…"); ACC.sel = {};
        await accZoho({ action: "requests", ids: ids }); renderAdminPage();
      };
      bar.append(allb, info, accEl("div", "grow"), csv, paid); card.appendChild(bar);
      bar._upd = upd; upd();
    }
    if (!list.length) card.appendChild(accEl("div", "hint", ACC.tab === "pending" ? "Nothing waiting. 🎉" : "Nothing here."));
    list.forEach(function (r) {
      var rowEl = accRequestRow(r, files, { select: ACC.tab === "approved", onSel: function () { if (bar) bar._upd(); }, acts: function (a) {
        if (r.status === "pending" || r.status === "approved") { var bk = accEl("button", "btn", "✎ Books"); bk.title = "Zoho category, TDS, GST bill"; bk.onclick = function () { accBooksDialog(r); }; a.appendChild(bk); }
        if (r.status !== "pending") return;
        var no = accEl("button", "btn", "Reject"), yes = accEl("button", "btn save", "✓ Approve");
        no.onclick = async function () {
          var n = await hrAsk("Why isn't it approved?", "e.g. Please attach the bill.", "Reject"); if (!n) return;
          var x = await SUPA.rpc("acc_decide", { p_id: r.id, p_approve: false, p_note: n }); if (x.error) { accToast(accErr(x.error)); return; }
          accToast("Rejected. They've been told why."); renderAdminPage();
        };
        yes.onclick = async function () {
          yes.disabled = true;
          var x = await SUPA.rpc("acc_decide", { p_id: r.id, p_approve: true, p_note: null }); if (x.error) { accToast(accErr(x.error)); yes.disabled = false; return; }
          accToast("Approved. It's in To pay now."); renderAdminPage();
        };
        a.append(no, yes);
      } });
      if (r.kind === "reimbursement" && r.status === "approved" && inPayroll[r.user_id]) {
        var w = accEl("div", "h", "⚠️ Also counted in the " + accMonthLabel(inPayroll[r.user_id]) + " payroll. Pay it there or here, not both."); w.style.color = "#8E1F14";
        rowEl.querySelector(".main").appendChild(w);
      }
      card.appendChild(rowEl);
    });
    body.appendChild(card);
  });
}

/* ---------- Accounts → Payroll ---------- */
function renderAdminAccPayroll(wrap) {
  var head = accEl("div", "module-head"); head.appendChild(accEl("h2", null, "Payroll")); accMonthPicker(head); wrap.appendChild(head);
  wrap.appendChild(accEl("div", "hint", "Salaries start from the CTC in each person's HR job terms, divided by 12. Approved bonuses for the month and approved reimbursements waiting to be paid are added in. Add a bonus or deductions, approve the month, pay it from the bank, then mark it paid."));
  var body = accEl("div"); body.appendChild(accEl("div", "hint", "Loading…")); wrap.appendChild(body);
  var draw = async function () {
    var r = await SUPA.from("acc_payroll").select("*").eq("month", ACC.month);
    body.innerHTML = "";
    if (r.error) { body.appendChild(accEl("div", "hr-note warn", "Run supabase/stage19a_accounts.sql first (" + accErr(r.error) + ")")); return; }
    var rows = (r.data || []).sort(function (a, b) { return accName(a.user_id).localeCompare(accName(b.user_id)); });
    var tools = accEl("div", "hr-foot"); tools.style.margin = "12px 0";
    var fill = accEl("button", "btn" + (rows.length ? "" : " save"), rows.length ? "↻ Refresh drafts from HR" : "Fill " + accMonthLabel(ACC.month) + " from HR");
    fill.title = "Adds everyone with a CTC; refreshes the salary and reimbursements of rows still in draft";
    fill.onclick = async function () {
      fill.disabled = true;
      var x = await SUPA.rpc("acc_payroll_fill", { p_month: ACC.month, p_refresh: !!rows.length });
      if (x.error) { accToast(accErr(x.error)); fill.disabled = false; return; }
      accToast(x.data ? x.data + (x.data === 1 ? " person" : " people") + " in " + accMonthLabel(ACC.month) : "Nobody has a CTC in their HR job terms yet"); draw();
    };
    tools.appendChild(fill); tools.appendChild(accEl("div", "grow"));
    var ids = function (st) { return rows.filter(function (x) { return x.status === st; }); };
    var net = function (x) { return Number(x.base) + Number(x.bonus) + Number(x.reimb) - Number(x.deductions) - Number(x.tds || 0); };
    if (ids("draft").length) {
      var ap = accEl("button", "btn save", "Approve " + ids("draft").length);
      ap.onclick = async function () { var x = await SUPA.rpc("acc_payroll_status", { p_ids: ids("draft").map(function (y) { return y.id; }), p_status: "approved" }); if (x.error) { accToast(accErr(x.error)); return; } accToast("Approved"); draw(); };
      tools.appendChild(ap);
    }
    if (ids("approved").length) {
      var csv = accEl("button", "btn", "⬇ Download bank file");
      csv.onclick = async function () {
        var list = ids("approved"), b = await SUPA.rpc("acc_bank_rows", { p_users: list.map(function (y) { return y.user_id; }) }), bank = {}, missing = [];
        (b.data || []).forEach(function (x) { bank[x.user_id] = x; });
        accDownloadCsv("salaries-" + ACC.month + ".csv", list.map(function (y) {
          var x = bank[y.user_id] || {}; if (!x.account) missing.push(accName(y.user_id));
          return { name: x.holder || accName(y.user_id), account: x.account, ifsc: x.ifsc, bank: x.bank, upi: "", amount: net(y), note: "Salary " + accMonthLabel(ACC.month), email: x.email || "" };
        }));
        if (missing.length) accToast("No bank details in the HR file for: " + missing.join(", "));
      };
      var pd = accEl("button", "btn save", "Mark " + ids("approved").length + " paid");
      pd.onclick = async function () {
        var list = ids("approved"), M = ACC.month;
        var d = await accMarkPaidDialog("Mark " + accMonthLabel(M) + " salaries paid", list.length, list.reduce(function (a, y) { return a + net(y); }, 0), {
          warnFor: function (day) { return /-03$/.test(M) && day >= M.slice(0, 4) + "-04-01" ? "Paid after 31 March — tell the CA (it may need a provision)." : ""; } });
        if (!d) return;
        var x = await SUPA.rpc("acc_payroll_status", { p_ids: list.map(function (y) { return y.id; }), p_status: "paid", p_date: d.date, p_ref: d.ref || null });
        if (x.error) { accToast(accErr(x.error)); return; }
        accToast("Marked paid. Everyone gets a 🔔. Posting to Zoho…");
        await accZoho({ action: "payroll", month: M }); draw();
      };
      tools.append(csv, pd);
    }
    body.appendChild(tools);
    var run = (await SUPA.from("acc_payroll_runs").select("*").eq("month", ACC.month).maybeSingle()).data;
    if (run) {
      var zc = ZOHO_CHIP[run.zoho_status] || null, zb = accEl("div", "hr-note " + (run.zoho_status === "failed" ? "warn" : "info"));
      zb.appendChild(document.createTextNode("Paid " + accDate(run.paid_on) + (run.paid_ref ? " · " + run.paid_ref : "") + " · "));
      if (zc) zb.appendChild(accEl("span", "hr-chip hr-" + zc[1], zc[0]));
      accZohoLinks(run.zoho_ids).forEach(function (l) { var a = accEl("a", null, " " + l[0] + " ↗"); a.href = l[1]; a.target = "_blank"; a.rel = "noopener"; a.style.marginLeft = "6px"; zb.appendChild(a); });
      if (run.zoho_error) zb.appendChild(document.createTextNode(" " + run.zoho_error));
      if (run.zoho_status !== "synced") { var rt = accEl("button", "hr-reveal", "↻ Retry Zoho"); rt.onclick = async function () { rt.disabled = true; await accZoho({ action: "payroll", month: ACC.month }); draw(); }; zb.appendChild(rt); }
      body.appendChild(zb);
      if (run.warning) body.appendChild(accEl("div", "hr-note warn", "⚠️ " + run.warning));
    }
    if (!rows.length) { body.appendChild(accEl("div", "hr-note info", "No salaries for " + accMonthLabel(ACC.month) + " yet. Press Fill to start from each person's CTC (HR → Employees → job terms).")); return; }
    var card = accEl("div", "hr-card acc-tbl-wrap"); card.setAttribute("data-plain", "");
    var t = accEl("table", "acc-tbl"), th = accEl("thead"), hr = accEl("tr");
    ["Person", "Salary", "Bonus", "Reimb.", "Deductions", "TDS", "Net pay", "Note", "Status"].forEach(function (h, i) { var c = accEl("th", i >= 1 && i <= 6 ? "num" : "", h); hr.appendChild(c); });
    th.appendChild(hr); t.appendChild(th);
    var tb = accEl("tbody");
    rows.forEach(function (y) {
      var tr = accEl("tr"), edit = y.status !== "paid";
      tr.appendChild(accEl("td", null, accName(y.user_id)));
      var netCell = accEl("td", "num", accInr(net(y)));
      var inputs = {};
      ["base", "bonus", "reimb", "deductions", "tds"].forEach(function (k) {
        var td = accEl("td", "num");
        if (edit && y.status === "draft") {
          var i = accEl("input"); i.type = "number"; i.min = "0"; i.step = "1"; i.value = Number(y[k]); inputs[k] = i;
          i.onchange = function () { save(); }; td.appendChild(i);
        } else td.textContent = accInr(y[k]);
        tr.appendChild(td);
      });
      tr.appendChild(netCell);
      var nt = accEl("td");
      if (y.status === "draft") { var ni = accEl("input", "note"); ni.value = y.note || ""; ni.placeholder = "e.g. Diwali bonus"; ni.onchange = function () { save(); }; inputs.note = ni; nt.appendChild(ni); }
      else nt.textContent = y.note || (y.paid_ref ? "Ref " + y.paid_ref : "");
      tr.appendChild(nt);
      var stc = accEl("td"); stc.appendChild(accChip(y.status));
      if (y.status === "approved") { var bk = accEl("button", "hr-reveal", "Back to draft"); bk.onclick = async function () { var x = await SUPA.rpc("acc_payroll_status", { p_ids: [y.id], p_status: "draft" }); if (x.error) { accToast(accErr(x.error)); return; } draw(); }; stc.appendChild(bk); }
      tr.appendChild(stc);
      async function save() {
        var v = function (k) { return parseFloat(inputs[k].value) || 0; };
        var x = await SUPA.rpc("acc_payroll_save2", { p_id: y.id, p_base: v("base"), p_bonus: v("bonus"), p_reimb: v("reimb"), p_deductions: v("deductions"), p_tds: v("tds"), p_note: inputs.note.value });
        if (x.error) { accToast(accErr(x.error)); return; }
        Object.assign(y, x.data); netCell.textContent = accInr(net(y)); foot();
      }
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    var tf = accEl("tfoot"), ftr = accEl("tr"); tf.appendChild(ftr); t.appendChild(tf);
    function foot() {
      ftr.innerHTML = "";
      var s = function (k) { return rows.reduce(function (a, y) { return a + Number(y[k]); }, 0); };
      ftr.appendChild(accEl("td", null, "Total · " + rows.length));
      ["base", "bonus", "reimb", "deductions", "tds"].forEach(function (k) { ftr.appendChild(accEl("td", "num", accInr(s(k)))); });
      ftr.appendChild(accEl("td", "num", accInr(rows.reduce(function (a, y) { return a + net(y); }, 0))));
      ftr.append(accEl("td"), accEl("td"));
    }
    foot();
    card.appendChild(t); body.appendChild(card);
  };
  draw();
}

/* ---------- Accounts → Overview: what's paid, what's to pay, what's waiting ---------- */
function accMonthPicker(head) {
  ACC.month = ACC.month || accMonthNow();
  var mi = accEl("input"); mi.type = "month"; mi.value = ACC.month; mi.style.cssText = "margin-left:auto;padding:8px 10px;border:1px solid var(--line-strong);border-radius:10px;font:inherit";
  mi.onchange = function () { if (mi.value) { ACC.month = mi.value; renderAdminPage(); } };
  head.style.cssText += ";display:flex;align-items:center;gap:10px;flex-wrap:wrap";
  head.appendChild(mi);
}
function renderAdminAccOverview(wrap) {
  var head = accEl("div", "module-head"); head.appendChild(accEl("h2", null, "Accounts overview")); accMonthPicker(head); wrap.appendChild(head);
  var body = accEl("div"); body.appendChild(accEl("div", "hint", "Loading…")); wrap.appendChild(body);
  var M = ACC.month;
  Promise.all([SUPA.from("acc_requests").select("*").limit(2000), SUPA.from("acc_payroll").select("*").eq("month", M), SUPA.from("acc_bonuses").select("*").eq("month", M)]).then(function (res) {
    body.innerHTML = "";
    if (res[0].error) { body.appendChild(accEl("div", "hr-note warn", "Run supabase/stage19a_accounts.sql first (" + accErr(res[0].error) + ")")); return; }
    var reqs = res[0].data || [], pay = res[1].data || [], bon = res[2].error ? [] : (res[2].data || []);
    // rows: [waiting approval, to pay, paid in the month]
    var T = { sal: [0, 0, 0], bonus: [0, 0, 0], reimb: [0, 0, 0], vendor: [0, 0, 0] };
    var col = { draft: 0, pending: 0, approved: 1, paid: 2 };
    pay.forEach(function (p) { var c = col[p.status]; T.sal[c] += Number(p.base) - Number(p.deductions); T.bonus[c] += Number(p.bonus); });
    var inPayroll = {}; pay.forEach(function (p) { inPayroll[p.user_id] = 1; });
    bon.forEach(function (b) { if (inPayroll[b.user_id] || b.status === "cancelled") return; T.bonus[col[b.status]] += Number(b.amount); });
    reqs.forEach(function (r) {
      var k = r.kind === "vendor" ? "vendor" : "reimb";
      if (r.status === "pending") T[k][0] += Number(r.amount);
      else if (r.status === "approved") T[k][1] += Number(r.amount);
      else if (r.status === "paid" && String(r.paid_at || "").slice(0, 7) === M) T[k][2] += Number(r.amount);
    });
    var sumCol = function (i) { return ["sal", "bonus", "reimb", "vendor"].reduce(function (a, k) { return a + T[k][i]; }, 0); };
    var grand = sumCol(0) + sumCol(1) + sumCol(2);
    var stats = accEl("div", "acc-stats");
    [[accInr(grand), "total payments · " + accMonthLabel(M)], [accInr(sumCol(2)), "paid"], [accInr(sumCol(1)), "approved, to pay"], [accInr(sumCol(0)), "waiting for approval"]].forEach(function (x, i) {
      var s = accEl("div", "s"); if (i === 0) s.style.cssText = "background:var(--indigo-soft);border-color:#F5CDB6";
      s.append(accEl("b", null, x[0]), accEl("span", null, x[1])); stats.appendChild(s);
    });
    body.appendChild(stats);
    var card = accEl("div", "hr-card acc-tbl-wrap"); card.setAttribute("data-plain", "");
    var t = accEl("table", "acc-tbl"), hr = accEl("tr");
    ["", "Waiting for approval", "To pay", "Paid", "Total"].forEach(function (h, i) { hr.appendChild(accEl("th", i ? "num" : "", h)); });
    var th = accEl("thead"); th.appendChild(hr); t.appendChild(th);
    var tb = accEl("tbody");
    [["sal", "💵 Salaries", "accpayroll"], ["bonus", "🎯 Bonuses", "accbonuses"], ["reimb", "🧾 Reimbursements", "accrequests"], ["vendor", "🤝 Vendor payments", "accrequests"]].forEach(function (x) {
      var tr = accEl("tr"), name = accEl("td"), a = accEl("button", "hr-reveal", x[1]); a.style.cssText = "margin:0;font-weight:700;color:var(--ink)";
      a.onclick = function () { adminView = x[2]; renderAdminPage(); }; name.appendChild(a); tr.appendChild(name);
      T[x[0]].forEach(function (v) { tr.appendChild(accEl("td", "num", v ? accInr(v) : "—")); });
      tr.appendChild(accEl("td", "num", accInr(T[x[0]][0] + T[x[0]][1] + T[x[0]][2])));
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    var tf = accEl("tfoot"), fr = accEl("tr"); fr.appendChild(accEl("td", null, "Total"));
    [0, 1, 2].forEach(function (i) { fr.appendChild(accEl("td", "num", accInr(sumCol(i)))); }); fr.appendChild(accEl("td", "num", accInr(grand)));
    tf.appendChild(fr); t.appendChild(tf); card.appendChild(t); body.appendChild(card);
    body.appendChild(accEl("div", "hint", "Salaries and bonuses are for " + accMonthLabel(M) + "'s payroll. Reimbursements and vendor payments show everything still waiting or to pay, and what was paid in " + accMonthLabel(M) + ". Reimbursements paid with a salary count once, as reimbursements."));
  });
}

/* ---------- Accounts → Bonuses ---------- */
function accBonusDialog(b, after) {
  var isNew = !b; b = b || { month: ACC.month || accMonthNow(), reason: "", units: null, rate: null, amount: null };
  var ov = accEl("div", "hr-ask"), bx = accEl("div", "box"); ov.setAttribute("data-plain", ""); bx.style.width = "min(560px,100%)";
  bx.appendChild(accEl("h3", null, isNew ? "Add a bonus" : "Edit bonus · " + accName(b.user_id)));
  var f = accEl("div", "hr-fields"); f.style.marginTop = "10px";
  var fld = function (lbl, inp, wide) { var w = accEl("div", "field" + (wide ? " wide" : "")); w.append(accEl("label", null, lbl), inp); f.appendChild(w); return w; };
  var who = accEl("select"); var o0 = accEl("option", null, "Who?"); o0.value = ""; who.appendChild(o0);
  (typeof hrTeamPeople === "function" ? hrTeamPeople() : []).forEach(function (u) { var o = accEl("option", null, userDisplayName(u)); o.value = u.id; who.appendChild(o); });
  if (!isNew) { who.value = b.user_id; who.disabled = true; }
  var mo = accEl("input"); mo.type = "month"; mo.value = b.month;
  var rs = accEl("input"); rs.value = b.reason || ""; rs.placeholder = "e.g. Sales incentive: CUET course sales";
  var mode = b.units != null && b.rate != null ? "units" : "fixed";
  var seg = accEl("div", "acc-tabs"); seg.style.margin = "0";
  var un = accEl("input"); un.type = "number"; un.min = "0"; un.step = "1"; un.placeholder = "e.g. 40"; un.value = b.units != null ? b.units : "";
  var ra = accEl("input"); ra.type = "number"; ra.min = "0"; ra.step = "1"; ra.placeholder = "e.g. 200"; ra.value = b.rate != null ? b.rate : "";
  var am = accEl("input"); am.type = "number"; am.min = "1"; am.step = "1"; am.placeholder = "e.g. 5000"; am.value = mode === "fixed" && b.amount ? b.amount : "";
  fld("Person", who); fld("Month", mo); fld("What it's for", rs, true);
  var segW = fld("How", seg, true);
  var unW = fld("Count (e.g. sales)", un), raW = fld("₹ each", ra), amW = fld("Amount (₹)", am);
  var total = accEl("div", "hr-rule-prev"); total.style.marginTop = "10px";
  bx.append(f, total);
  var bs = {};
  [["fixed", "Fixed amount"], ["units", "Count × rate"]].forEach(function (x) { var btn = accEl("button", "", x[1]); btn.type = "button"; btn.onclick = function () { mode = x[0]; draw(); }; bs[x[0]] = btn; seg.appendChild(btn); });
  function amount() { return mode === "units" ? (parseFloat(un.value) || 0) * (parseFloat(ra.value) || 0) : (parseFloat(am.value) || 0); }
  function draw() {
    Object.keys(bs).forEach(function (k) { bs[k].classList.toggle("on", k === mode); });
    unW.hidden = raW.hidden = mode !== "units"; amW.hidden = mode !== "fixed";
    total.textContent = "Bonus: " + accInr(amount()) + (mode === "units" && un.value && ra.value ? " (" + un.value + " × " + accInr(ra.value) + ")" : "");
  }
  [un, ra, am].forEach(function (x) { x.oninput = draw; }); draw();
  var row = accEl("div", "hr-foot");
  var cl = accEl("button", "btn", "Cancel"); cl.onclick = function () { ov.remove(); };
  var sv = accEl("button", "btn save", "Save");
  sv.onclick = async function () {
    if (!who.value) { accToast("Pick a person"); return; }
    if (rs.value.trim().length < 2) { accToast("Say what it's for"); rs.focus(); return; }
    if (!(amount() > 0)) { accToast("The bonus is ₹0"); return; }
    sv.disabled = true;
    var x = await SUPA.rpc("acc_bonus_save", { p_id: isNew ? null : b.id, p_user: who.value, p_month: mo.value, p_reason: rs.value.trim(),
      p_units: mode === "units" ? parseFloat(un.value) : null, p_rate: mode === "units" ? parseFloat(ra.value) : null, p_amount: mode === "fixed" ? parseFloat(am.value) : null });
    if (x.error) { accToast(accErr(x.error)); sv.disabled = false; return; }
    ov.remove(); accToast("Saved"); if (after) after();
  };
  row.append(accEl("div", "grow"), cl, sv); bx.appendChild(row); ov.appendChild(bx); document.body.appendChild(ov);
}
function renderAdminAccBonuses(wrap) {
  var head = accEl("div", "module-head"); head.appendChild(accEl("h2", null, "Bonuses")); accMonthPicker(head);
  var add = accEl("button", "btn save", "＋ Add a bonus"); add.onclick = function () { accBonusDialog(null, function () { renderAdminPage(); }); }; head.appendChild(add);
  wrap.appendChild(head);
  wrap.appendChild(accEl("div", "hint", "A fixed amount, or a count × rate (e.g. 40 sales × ₹200). Approved bonuses go into the month's payroll when you fill or refresh it, and are paid with the salary."));
  var body = accEl("div"); body.appendChild(accEl("div", "hint", "Loading…")); wrap.appendChild(body);
  var M = ACC.month;
  SUPA.from("acc_bonuses").select("*").eq("month", M).order("created_at", { ascending: false }).then(function (r) {
    body.innerHTML = "";
    if (r.error) { body.appendChild(accEl("div", "hr-note warn", "Run supabase/stage19b_accounts_bonuses.sql first (" + accErr(r.error) + ")")); return; }
    var list = (r.data || []).filter(function (b) { return b.status !== "cancelled"; });
    var by = function (st) { return list.filter(function (b) { return b.status === st; }); };
    var tot = function (a) { return a.reduce(function (s, b) { return s + Number(b.amount); }, 0); };
    var stats = accEl("div", "acc-stats");
    [[accInr(tot(list)), "bonuses · " + accMonthLabel(M)], [accInr(tot(by("draft"))), "draft"], [accInr(tot(by("approved"))), "approved, goes into payroll"], [accInr(tot(by("paid"))), "paid"]].forEach(function (x) {
      var s = accEl("div", "s"); s.append(accEl("b", null, x[0]), accEl("span", null, x[1])); stats.appendChild(s);
    });
    body.appendChild(stats);
    var bar = accEl("div", "hr-foot"); bar.style.margin = "0 0 10px";
    if (by("draft").length) {
      var ap = accEl("button", "btn save", "Approve " + by("draft").length);
      ap.onclick = async function () { var x = await SUPA.rpc("acc_bonus_status", { p_ids: by("draft").map(function (b) { return b.id; }), p_status: "approved" }); if (x.error) { accToast(accErr(x.error)); return; } accToast("Approved. Refresh the payroll to include them."); renderAdminPage(); };
      bar.append(accEl("div", "grow"), ap); body.appendChild(bar);
    }
    var card = accEl("div", "hr-card"); card.setAttribute("data-plain", "");
    if (!list.length) card.appendChild(accEl("div", "hint", "No bonuses for " + accMonthLabel(M) + " yet."));
    list.forEach(function (b) {
      var row = accEl("div", "acc-row"), main = accEl("div", "main"), side = accEl("div", "side");
      main.append(accEl("div", "t", accName(b.user_id)), accEl("div", "h", b.reason + (b.units != null && b.rate != null ? " · " + Number(b.units) + " × " + accInr(b.rate) : "")));
      side.append(accEl("div", "acc-amt", accInr(b.amount)), accChip(b.status === "approved" ? "approved_b" : b.status));
      var a = accEl("div", "acc-acts");
      if (b.status === "draft") {
        var e = accEl("button", "btn", "Edit"); e.onclick = function () { accBonusDialog(b, function () { renderAdminPage(); }); };
        var c = accEl("button", "btn", "Remove"); c.onclick = async function () { var x = await SUPA.rpc("acc_bonus_status", { p_ids: [b.id], p_status: "cancelled" }); if (x.error) { accToast(accErr(x.error)); return; } renderAdminPage(); };
        a.append(c, e);
      } else if (b.status === "approved") {
        var u = accEl("button", "btn", "Back to draft"); u.onclick = async function () { var x = await SUPA.rpc("acc_bonus_status", { p_ids: [b.id], p_status: "draft" }); if (x.error) { accToast(accErr(x.error)); return; } renderAdminPage(); };
        a.appendChild(u);
      }
      if (a.children.length) side.appendChild(a);
      row.append(main, side); card.appendChild(row);
    });
    body.appendChild(card);
  });
}
ACC_STATUS.approved_b = ["Approved · in payroll", "blue"];

/* ---------- Accounts → Checks (for the owner, once a month) ---------- */
function renderAdminAccChecks(wrap) {
  var head = accEl("div", "module-head"); head.appendChild(accEl("h2", null, "Monthly checks")); accMonthPicker(head); wrap.appendChild(head);
  var body = accEl("div"); body.appendChild(accEl("div", "hint", "Loading…")); wrap.appendChild(body);
  var M = ACC.month, fyStart = (Number(M.slice(5)) >= 4 ? Number(M.slice(0, 4)) : Number(M.slice(0, 4)) - 1) + "-04-01";
  Promise.all([SUPA.from("acc_requests").select("*").limit(5000), SUPA.from("acc_payroll").select("*").eq("status", "paid"), SUPA.from("acc_payroll_runs").select("*"),
               SUPA.from("acc_zoho_settings").select("*").eq("id", 1).maybeSingle(), SUPA.from("acc_zoho_log").select("*").order("at", { ascending: false }).limit(15),
               accZoho({ action: "status" }, true)]).then(function (res) {
    body.innerHTML = "";
    if (res[0].error) { body.appendChild(accEl("div", "hr-note warn", "Run supabase/stage19c_accounts_zoho.sql first (" + accErr(res[0].error) + ")")); return; }
    var reqs = res[0].data || [], pay = res[1].data || [], runs = res[2].data || [], zs = res[3].data || {}, logs = res[4].data || [], st = res[5];
    var sec = function (title, hint) { var c = accEl("div", "hr-card"); c.style.marginTop = "14px"; c.setAttribute("data-plain", ""); c.appendChild(accEl("h3", null, title)); if (hint) c.appendChild(accEl("div", "hint", hint)); body.appendChild(c); return c; };

    // Zoho connection
    var zc = sec("Zoho Books");
    var line = accEl("div", "h");
    line.textContent = !st ? "Couldn't reach the zoho-sync function." : !st.connected ? "Not connected yet: add ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET and ZOHO_REFRESH_TOKEN to the Supabase Edge Function secrets. Until then, payments are only logged (dry run)."
      : st.dry ? "Connected · DRY RUN: payloads are logged below, nothing is posted. Set ZOHO_DRY_RUN=false to go live." : "Connected · LIVE: posting to Zoho Books (organisation " + st.org + ").";
    zc.appendChild(line);
    var acc = zs.accounts ? Object.keys(zs.accounts).length : 0;
    zc.appendChild(accEl("div", "h", acc ? acc + " Zoho accounts linked · fetched " + accDate(zs.fetched_at) + ((zs.missing || []).length ? " · not found: " + zs.missing.join(", ") : " · all found") : "Accounts not fetched yet."));
    if (st && st.connected) { var fb = accEl("button", "btn", "Fetch Zoho accounts"); fb.style.marginTop = "8px"; fb.onclick = async function () { fb.disabled = true; var x = await accZoho({ action: "setup" }, true); accToast(x ? "Linked " + x.accounts + " accounts" : "Couldn't fetch"); renderAdminPage(); }; zc.appendChild(fb); }

    // paid this month by Zoho account
    var by = {}, add = function (k, v) { by[k] = (by[k] || 0) + v; };
    reqs.forEach(function (r) {
      if (r.status !== "paid" || String(r.paid_at || "").slice(0, 7) !== M) return;
      add(r.kind === "advance" ? (r.imprest_account || "Imprest") + " (advance)" : accCatOf(r.category) || "Other Expenses", Number(r.amount));
    });
    pay.forEach(function (p) { if (String(p.paid_at || "").slice(0, 7) !== M) return; add("Salaries and Employee Wages", Number(p.base) - Number(p.deductions)); if (Number(p.bonus)) add("Diwali Bonus", Number(p.bonus)); });
    var pc = sec("Paid in " + accMonthLabel(M) + " by Zoho account", "Should match the month in Zoho's Profit & Loss (expense side).");
    var keys = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; });
    if (!keys.length) pc.appendChild(accEl("div", "hint", "Nothing paid this month."));
    keys.forEach(function (k) { var r = accEl("div", "acc-row"); r.append(accEl("div", "main", k), accEl("div", "acc-amt", accInr(by[k]))); pc.appendChild(r); });
    if (keys.length) { var tr = accEl("div", "acc-row"); tr.append(accEl("b", "main", "Total"), accEl("div", "acc-amt", accInr(keys.reduce(function (a, k) { return a + by[k]; }, 0)))); pc.appendChild(tr); }

    // not in Zoho yet
    var bad = reqs.filter(function (r) { return r.status === "paid" && ["pending", "failed", "dry_run", "manual"].indexOf(r.zoho_status) >= 0; });
    var badRuns = runs.filter(function (r) { return r.zoho_status !== "synced" && r.zoho_status !== "none"; });
    // salaries paid with no run recorded (e.g. paid before the Zoho sync existed) can't be sent; say so
    var runMonths = runs.map(function (r) { return r.month; });
    pay.forEach(function (p) { if (runMonths.indexOf(p.month) < 0) { runMonths.push(p.month); badRuns.push({ month: p.month, zoho_status: "manual", zoho_error: "paid before the Zoho sync was set up; ask Claude to queue it" }); } });
    var fc = sec("Not in Zoho yet (" + (bad.length + badRuns.length) + ")", "Failed, waiting, dry run or to enter by hand.");
    if (!bad.length && !badRuns.length) fc.appendChild(accEl("div", "hint", "Everything paid is in Zoho. ✓"));
    badRuns.forEach(function (r) { var row = accEl("div", "acc-row"), m = accEl("div", "main"); m.append(accEl("div", "t", "Payroll " + accMonthLabel(r.month)), accEl("div", "h", (ZOHO_CHIP[r.zoho_status] || [r.zoho_status])[0] + (r.zoho_error ? " · " + r.zoho_error : ""))); row.appendChild(m); fc.appendChild(row); });
    bad.forEach(function (r) { var row = accEl("div", "acc-row"), m = accEl("div", "main"); m.append(accEl("div", "t", "TOOLS-" + r.ref_no + " · " + r.title), accEl("div", "h", (ZOHO_CHIP[r.zoho_status] || [r.zoho_status])[0] + (r.zoho_error ? " · " + r.zoho_error : ""))); row.append(m, accEl("div", "acc-amt", accInr(r.amount))); fc.appendChild(row); });
    var retryable = bad.filter(function (r) { return r.zoho_status !== "manual"; });
    if (retryable.length || badRuns.length) {
      var ra = accEl("button", "btn save", "↻ Retry all"); ra.style.marginTop = "8px";
      ra.onclick = async function () {
        ra.disabled = true;
        for (var i = 0; i < badRuns.length; i++) if (badRuns[i].zoho_status !== "manual") await accZoho({ action: "payroll", month: badRuns[i].month }, true);
        if (retryable.length) await accZoho({ action: "requests", ids: retryable.map(function (r) { return r.id; }) }, true);
        accToast("Done. Check the list again."); renderAdminPage();
      };
      fc.appendChild(ra);
    }

    // TDS deducted this month
    var tdsReq = reqs.filter(function (r) { return r.status === "paid" && Number(r.tds_amount) > 0 && String(r.paid_at || "").slice(0, 7) === M; });
    var tdsPay = pay.filter(function (p) { return Number(p.tds) > 0 && String(p.paid_at || "").slice(0, 7) === M; });
    var tdsTotal = tdsReq.reduce(function (a, r) { return a + Number(r.tds_amount); }, 0) + tdsPay.reduce(function (a, p) { return a + Number(p.tds); }, 0);
    var nx = new Date(M + "-01T00:00:00"); nx.setMonth(nx.getMonth() + 1);
    var tc = sec("TDS deducted in " + accMonthLabel(M) + ": " + accInr(tdsTotal), tdsTotal ? "Deposit by 7 " + nx.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) + " with challan 281." : "");
    var bySec = {}; tdsReq.forEach(function (r) { bySec[r.tds_section || "Other"] = (bySec[r.tds_section || "Other"] || 0) + Number(r.tds_amount); });
    var salT = tdsPay.reduce(function (a, p) { return a + Number(p.tds); }, 0); if (salT) bySec["192 (salaries)"] = salT;
    Object.keys(bySec).forEach(function (k) { var r = accEl("div", "acc-row"); r.append(accEl("div", "main", "Section " + k), accEl("div", "acc-amt", accInr(bySec[k]))); tc.appendChild(r); });

    // payees crossing TDS limits without TDS (this financial year)
    var py = {};
    reqs.forEach(function (r) {
      if (r.kind !== "vendor" || r.status === "rejected" || r.status === "cancelled" || String(r.paid_at || r.created_at).slice(0, 10) < fyStart) return;
      var c = accCatOf(r.category), sec2 = ACC_194C.indexOf(c) >= 0 ? "194C" : ACC_194J.indexOf(c) >= 0 ? "194J" : "";
      if (!sec2) return;
      var k = (r.payee_pan || r.payee_name || "").toUpperCase().trim(); if (!k) return;
      var x = py[k] = py[k] || { name: r.payee_name, pan: r.payee_pan, sec: sec2, total: 0, max: 0, tds: 0 };
      x.total += Number(r.amount); x.max = Math.max(x.max, Number(r.amount)); x.tds += Number(r.tds_amount || 0);
    });
    var warn = Object.keys(py).map(function (k) { return py[k]; }).filter(function (x) {
      if (x.tds > 0) return false;
      return x.sec === "194C" ? (x.max > 30000 || x.total > 100000) : x.total > 30000;
    });
    var wc = sec("TDS limits crossed without TDS (" + warn.length + ")", "194C: over ₹30,000 in one payment or ₹1,00,000 in the year. 194J: over ₹30,000 in the year. Counted from " + accDate(fyStart) + ".");
    if (!warn.length) wc.appendChild(accEl("div", "hint", "None. ✓"));
    warn.forEach(function (x) { var r = accEl("div", "acc-row"), m = accEl("div", "main"); m.append(accEl("div", "t", x.name + (x.pan ? " · PAN " + x.pan : " · no PAN")), accEl("div", "h", x.sec + " · biggest payment " + accInr(x.max))); r.append(m, accEl("div", "acc-amt", accInr(x.total))); wc.appendChild(r); });

    // audit log
    var lc = sec("Zoho log (latest 15)", "Every request sent to Zoho, or logged in a dry run. No passwords or tokens are kept.");
    logs.forEach(function (l) {
      var d = accEl("details"); d.style.cssText = "border-top:1px solid var(--line);padding:6px 0";
      var sm = accEl("summary", null, new Date(l.at).toLocaleString("en-GB") + " · " + (l.dry ? "DRY " : "") + l.method + " " + l.path + " · " + (l.ref || "") + (l.ok ? "" : " · ❌")); sm.style.cursor = "pointer"; sm.style.fontSize = "12.5px";
      var pre = accEl("pre", null, JSON.stringify({ request: l.request, response: l.response }, null, 2)); pre.style.cssText = "white-space:pre-wrap;font-size:11.5px;background:var(--paper);padding:8px;border-radius:8px;max-height:260px;overflow:auto";
      d.append(sm, pre); lc.appendChild(d);
    });
    if (!logs.length) lc.appendChild(accEl("div", "hint", "Nothing yet."));
  });
}
