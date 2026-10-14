/* =====================================================================
   HR files  (database: supabase/stage18a_hr_files.sql, email: supabase/functions/hr-mail)

   · Account menu → 🗂️ My HR file (also linked from 👤 My profile) — every
     teammate: personal details, family, emergency contacts, address, ID and
     bank details, education and past work, document uploads, consent and
     submit. Later: read the contract and upload the signed copy.
   · Administration → 🗂️ Employees (HR) — super-admins and roles with
     "Manage HR files": everyone's progress, every detail and document,
     approve / reject documents, send a file back with a note, job terms,
     preview and email the contract, mark the file complete. Super-admins
     also edit the company details and the contract template.

   Files go to the private "hr-docs" bucket under <user id>/…; HR opens them
   through short-lived signed links. Nothing here is stored in profiles.
   ===================================================================== */

var HR = { rec: null, docs: [], step: 0, dirty: false, saveTimer: null, settings: null };

/* ---------- what we ask for ---------- */
var HR_STATES = ["Andaman and Nicobar Islands","Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chandigarh","Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jammu and Kashmir","Jharkhand",
  "Karnataka","Kerala","Ladakh","Lakshadweep","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha",
  "Puducherry","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal"];
var HR_STEPS = [
  { k: "about", ico: "🙂", lbl: "About you", fields: [
    { k: "full_name", lbl: "Full name (as on Aadhaar)", req: true },
    { k: "dob", lbl: "Date of birth", type: "date", req: true },
    { k: "gender", lbl: "Gender", type: "select", opts: ["Female", "Male", "Other", "Prefer not to say"], req: true },
    { k: "marital", lbl: "Marital status", type: "select", opts: ["Single", "Married", "Other"] },
    { k: "blood_group", lbl: "Blood group", type: "select", opts: ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−", "Don't know"] },
    { k: "nationality", lbl: "Nationality", ph: "Indian" },
    { k: "mobile", lbl: "Mobile number", type: "tel", req: true, fmt: "phone" },
    { k: "alt_mobile", lbl: "Another number (optional)", type: "tel", fmt: "phone" },
    { k: "personal_email", lbl: "Personal email", type: "email", req: true, fmt: "email" } ] },
  { k: "family", ico: "👪", lbl: "Family", fields: [
    { k: "father_name", lbl: "Father's name", req: true },
    { k: "mother_name", lbl: "Mother's name", req: true },
    { k: "spouse_name", lbl: "Spouse's name (if married)" } ] },
  { k: "emergency", ico: "🚑", lbl: "Emergency contacts", fields: [
    { k: "em1_name", lbl: "Contact 1 — name", req: true },
    { k: "em1_relation", lbl: "Relationship", ph: "e.g. Father", req: true },
    { k: "em1_phone", lbl: "Phone", type: "tel", req: true, fmt: "phone" },
    { k: "em2_name", lbl: "Contact 2 — name (optional)" },
    { k: "em2_relation", lbl: "Relationship" },
    { k: "em2_phone", lbl: "Phone", type: "tel", fmt: "phone" } ] },
  { k: "address", ico: "🏠", lbl: "Address", fields: [
    { k: "cur_line", lbl: "Where you live now — house, street, area", type: "area", req: true },
    { k: "cur_city", lbl: "City", req: true },
    { k: "cur_state", lbl: "State", type: "select", opts: HR_STATES, req: true },
    { k: "cur_pin", lbl: "PIN code", req: true, fmt: "pin" },
    { k: "same_address", lbl: "My permanent address is the same", type: "check" },
    { k: "perm_line", lbl: "Permanent address — house, street, area", type: "area", unless: "same_address" },
    { k: "perm_city", lbl: "City", unless: "same_address" },
    { k: "perm_state", lbl: "State", type: "select", opts: HR_STATES, unless: "same_address" },
    { k: "perm_pin", lbl: "PIN code", fmt: "pin", unless: "same_address" } ] },
  { k: "idbank", ico: "🪪", lbl: "ID and bank", fields: [
    { k: "aadhaar", lbl: "Aadhaar number", req: true, fmt: "aadhaar", ph: "12 digits" },
    { k: "pan", lbl: "PAN", req: true, fmt: "pan", ph: "ABCDE1234F" },
    { k: "passport", lbl: "Passport number (optional)" },
    { k: "uan", lbl: "UAN / PF number (if you had one before)" },
    { k: "bank_holder", lbl: "Account holder's name", req: true },
    { k: "bank_name", lbl: "Bank name", req: true },
    { k: "bank_account", lbl: "Account number", req: true, fmt: "account" },
    { k: "bank_account2", lbl: "Type the account number again", fmt: "match:bank_account", noSave: true },
    { k: "bank_ifsc", lbl: "IFSC code", req: true, fmt: "ifsc", ph: "e.g. SBIN0001234" } ] },
  { k: "work", ico: "🎓", lbl: "Education and work", fields: [
    { k: "edu_level", lbl: "Highest education", type: "select", opts: ["10th", "12th", "Diploma", "Graduate", "Post-graduate", "Doctorate", "Other"], req: true },
    { k: "edu_course", lbl: "Course / subject", ph: "e.g. B.Com" },
    { k: "edu_institute", lbl: "College / school" },
    { k: "edu_year", lbl: "Year of passing (or expected)", ph: "e.g. 2025" },
    { k: "prev_company", lbl: "Last company (if any)" },
    { k: "prev_title", lbl: "Your role there" },
    { k: "prev_from", lbl: "From", type: "month" },
    { k: "prev_to", lbl: "To", type: "month" },
    { k: "linkedin", lbl: "LinkedIn profile (optional)", ph: "https://linkedin.com/in/…" } ] },
  { k: "docs", ico: "📎", lbl: "Documents" },
  { k: "submit", ico: "✅", lbl: "Check and submit" },
  { k: "contract", ico: "✍️", lbl: "Contract" }
];
var HR_DOCS = [
  { k: "photo", lbl: "Passport-size photo", hint: "A clear photo of your face, plain background.", req: true },
  { k: "aadhaar", lbl: "Aadhaar card", hint: "Front and back. One PDF, or upload two photos.", req: true },
  { k: "pan", lbl: "PAN card", hint: "Front side.", req: true },
  { k: "bank", lbl: "Bank proof", hint: "A cancelled cheque or the first page of your passbook.", req: true },
  { k: "address", lbl: "Address proof", hint: "Only if where you live now is different from your Aadhaar address." },
  { k: "education", lbl: "Highest education certificate", hint: "Mark sheet or degree." },
  { k: "experience", lbl: "Last job's documents", hint: "Relieving letter or last 3 payslips, if you worked before." },
  { k: "other", lbl: "Anything else", hint: "Any other document HR asked for." }
];
var HR_STATUS = {
  none:          ["Not started", "grey"],
  draft:         ["Filling in", "amber"],
  changes:       ["Changes asked", "red"],
  submitted:     ["Waiting for HR", "blue"],
  contract_sent: ["Contract sent", "amber"],
  signed:        ["Signed, to check", "blue"],
  complete:      ["Complete", "green"]
};
var HR_JOB = [
  { k: "designation", lbl: "Designation", ph: "e.g. Content Creator" },
  { k: "department", lbl: "Department", ph: "e.g. Marketing" },
  { k: "employment_type", lbl: "Type", type: "select", opts: ["Full-time employee", "Intern", "Consultant / freelancer", "Part-time"] },
  { k: "joining_date", lbl: "Joining date", type: "date" },
  { k: "pay", lbl: "Monthly pay / stipend (₹)", ph: "e.g. 25,000" },
  { k: "probation", lbl: "Probation", ph: "e.g. 3 months" },
  { k: "notice", lbl: "Notice period", ph: "e.g. 30 days" },
  { k: "location", lbl: "Work location", ph: "e.g. Delhi office / Remote" },
  { k: "reporting_to", lbl: "Reports to", ph: "e.g. Sumit" },
  { k: "hours", lbl: "Working hours", ph: "e.g. 10 am – 7 pm, Monday to Saturday" }
];
var HR_DEFAULT_TEMPLATE = [
  "# Letter of Appointment and Work Agreement",
  "Date: {date}",
  "This agreement is between {company}, {company_address} (\"the Company\"), and {full_name}, child of {father_name}, living at {address} (\"you\").",
  "## 1. Your role",
  "You are appointed as {designation} in the {department} team, as {employment_type}, starting on {joining_date}. You will report to {reporting_to}. Your place of work is {location}.",
  "## 2. Pay",
  "You will be paid ₹{pay} a month, less any taxes and deductions the law requires, by bank transfer to the account you gave us.",
  "## 3. Probation",
  "Your first {probation} are a probation period. During it, either side may end this agreement with 7 days' written notice.",
  "## 4. Working hours and leave",
  "Your working hours are {hours}. Leave and holidays follow the Company's leave policy, as updated from time to time.",
  "## 5. Confidentiality",
  "You will keep the Company's business information, student data, product plans, code, content and finances confidential, during and after your time with the Company, and use them only for your work here.",
  "## 6. Work you create",
  "Everything you create for the Company in the course of your work — including content, videos, designs, code and documents — belongs to the Company.",
  "## 7. Conduct",
  "You will follow the Company's policies and code of conduct, and treat students, colleagues and partners with respect.",
  "## 8. Ending the agreement",
  "After probation, either side may end this agreement by giving {notice} of written notice, or pay in place of notice. The Company may end it immediately for serious misconduct. When you leave, you will return all Company property and data.",
  "## 9. Law",
  "This agreement is governed by the laws of India. Courts at {company_city} have jurisdiction.",
  "## Signatures",
  "For {company}\n\n\n______________________________\n{signatory}, {signatory_title}",
  "Accepted by\n\n\n______________________________\n{full_name}\nDate:"
].join("\n\n");

/* ---------- helpers ---------- */
function hrEl(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function hrEsc(s) { return (s == null ? "" : String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function hrErr(e) { return (e && (e.message || e.error_description)) || String(e || "unknown"); }
function hrDate(iso) { return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""; }
function hrSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
function hrMe() { return typeof currentUser === "function" ? currentUser() : null; }
function hrToast(m) { if (typeof toast === "function") toast(m); }
function hrIsAdmin() { var u = hrMe(); return !!u && (u.super || (typeof hasPerm === "function" && hasPerm("manage_hr"))); }
function hrUsers() { return typeof USERS !== "undefined" ? USERS : []; }
function hrUser(id) { return hrUsers().find(function (u) { return u.id === id; }) || null; }
function hrName(id) { var u = hrUser(id); return u ? userDisplayName(u) : "Someone"; }
function hrMask(v, keep) { v = String(v || ""); return v.length > keep ? "•".repeat(Math.min(8, v.length - keep)) + v.slice(-keep) : v; }

/* Aadhaar numbers carry a Verhoeff check digit */
var HR_VD = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],
  [5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
var HR_VP = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],
  [4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
function hrVerhoeff(num) { var c = 0, a = String(num).split("").reverse().map(Number); for (var i = 0; i < a.length; i++) c = HR_VD[c][HR_VP[i % 8][a[i]]]; return c === 0; }

/* returns an error message, or "" when the value is fine */
function hrCheck(f, v, d) {
  v = (v == null ? "" : String(v)).trim();
  if (f.unless && d[f.unless]) return "";
  if (!v) return f.req ? "Required" : "";
  var x = f.fmt || "";
  if (x === "phone" && !/^(\+91[\s-]?)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, ""))) return "Enter a 10-digit mobile number";
  if (x === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter a valid email";
  if (x === "pin" && !/^[1-9]\d{5}$/.test(v)) return "PIN codes have 6 digits";
  if (x === "aadhaar") { var a = v.replace(/\s/g, ""); if (!/^[2-9]\d{11}$/.test(a) || !hrVerhoeff(a)) return "That isn't a valid Aadhaar number"; }
  if (x === "pan" && !/^[A-Z]{5}\d{4}[A-Z]$/.test(v.toUpperCase())) return "PAN looks like ABCDE1234F";
  if (x === "ifsc" && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.toUpperCase())) return "IFSC looks like SBIN0001234";
  if (x === "account" && !/^\d{9,18}$/.test(v.replace(/\s/g, ""))) return "Account numbers have 9 to 18 digits";
  if (x.indexOf("match:") === 0 && v.replace(/\s/g, "") !== String(d[x.slice(6)] || "").replace(/\s/g, "")) return "The two account numbers don't match";
  return "";
}
function hrAllFields() { var out = []; HR_STEPS.forEach(function (s) { (s.fields || []).forEach(function (f) { out.push(f); }); }); return out; }
function hrStepIssues(step, d) {
  var n = 0; (step.fields || []).forEach(function (f) { if (f.type !== "check" && hrCheck(f, d[f.k], d)) n++; }); return n;
}
function hrDocsHave(docs, k) { return docs.some(function (x) { return x.kind === k && x.status !== "rejected"; }); }
/* % of required fields and required documents done */
function hrProgress(d, docs) {
  d = d || {}; docs = docs || [];
  var total = 0, done = 0;
  hrAllFields().forEach(function (f) { if (!f.req || f.noSave) return; total++; if (!hrCheck(f, d[f.k], d) && String(d[f.k] || "").trim()) done++; });
  HR_DOCS.forEach(function (x) { if (!x.req) return; total++; if (hrDocsHave(docs, x.k)) done++; });
  return total ? Math.round(done * 100 / total) : 0;
}
function hrChip(status) {
  var m = HR_STATUS[status || "none"] || HR_STATUS.none;
  return hrEl("span", "hr-chip hr-" + m[1], m[0]);
}
function hrEditable(rec) { return !rec || rec.status === "draft" || rec.status === "changes"; }

/* ---------- styles ---------- */
(function () {
  var css = ""
    + ".hr-page{position:fixed;inset:0;z-index:600;background:var(--paper);overflow-y:auto}"
    + ".hr-shell{max-width:1080px;margin:0 auto;padding:22px 20px 60px}"
    + ".hr-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px}"
    + ".hr-top h2{font-size:22px;font-weight:800;margin:0}"
    + ".hr-top .grow{flex:1}"
    + ".hr-bar{height:8px;border-radius:99px;background:var(--line);overflow:hidden;min-width:120px}"
    + ".hr-bar i{display:block;height:100%;background:var(--indigo);border-radius:99px}"
    + ".hr-pct{font-family:var(--mono);font-size:12px;color:var(--muted);white-space:nowrap}"
    + ".hr-grid{display:grid;grid-template-columns:230px minmax(0,1fr);gap:20px;align-items:start}"
    + ".hr-nav{display:flex;flex-direction:column;gap:3px;position:sticky;top:14px}"
    + ".hr-nav button{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:10px;text-align:left;font-size:14px;color:var(--ink)}"
    + ".hr-nav button:hover{background:var(--card)}"
    + ".hr-nav button.on{background:var(--indigo-soft);color:var(--indigo);font-weight:700}"
    + ".hr-nav .tick{margin-left:auto;font-size:12px;color:var(--done);font-weight:700}"
    + ".hr-nav .todo{margin-left:auto;font-family:var(--mono);font-size:11px;color:var(--muted)}"
    + ".hr-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px 22px}"
    + ".hr-card h3{font-size:18px;font-weight:800;margin:0 0 4px}"
    + ".hr-card .hint{margin-bottom:14px}"
    + ".hr-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px}"
    + ".hr-fields .field{margin:0}.hr-fields .wide{grid-column:1/-1}"
    + ".hr-fields label{display:block;font-size:12.5px;font-weight:600;margin-bottom:4px;color:var(--ink)}"
    + ".hr-fields .req{color:var(--indigo)}"
    + ".hr-fields input,.hr-fields select,.hr-fields textarea{width:100%;padding:9px 11px;border:1px solid var(--line-strong);border-radius:9px;background:#fff;font:inherit;font-size:14px}"
    + ".hr-fields input:disabled,.hr-fields select:disabled,.hr-fields textarea:disabled{background:var(--paper);color:var(--muted)}"
    + ".hr-fields .bad input,.hr-fields .bad select,.hr-fields .bad textarea{border-color:#C0362C}"
    + ".hr-ferr{font-size:11.5px;color:#C0362C;margin-top:3px;min-height:0}"
    + ".hr-check{display:flex;gap:8px;align-items:center;font-size:14px;cursor:pointer}"
    + ".hr-check input{width:16px;height:16px;accent-color:var(--indigo)}"
    + ".hr-foot{display:flex;gap:10px;align-items:center;margin-top:18px;flex-wrap:wrap}"
    + ".hr-foot .grow{flex:1}"
    + ".hr-saved{font-size:12px;color:var(--muted)}"
    + ".hr-note{border-radius:12px;padding:12px 14px;font-size:13.5px;line-height:1.5;margin-bottom:14px}"
    + ".hr-note.warn{background:#FBE7E5;color:#7A2621;border:1px solid #F1C4BF}"
    + ".hr-note.info{background:var(--indigo-soft);border:1px solid #F5CDB6}"
    + ".hr-note.ok{background:var(--done-bg);color:#14532D;border:1px solid #BFE3CE}"
    + ".hr-doc{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}"
    + ".hr-doc:last-child{border-bottom:none}"
    + ".hr-doc .t{font-weight:700;font-size:14px}.hr-doc .h{font-size:12.5px;color:var(--muted)}"
    + ".hr-files{display:flex;flex-direction:column;gap:5px;margin-top:7px}"
    + ".hr-file{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12.5px;background:var(--paper);border-radius:8px;padding:5px 9px}"
    + ".hr-file .n{font-weight:600;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    + ".hr-file .x{color:#C0362C;font-weight:600;font-size:12px;cursor:pointer;background:none;border:none}"
    + ".hr-chip{display:inline-block;font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:99px;white-space:nowrap}"
    + ".hr-grey{background:var(--planned-bg);color:var(--planned)}.hr-amber{background:var(--progress-bg);color:var(--progress)}"
    + ".hr-blue{background:#E6EEFB;color:#1D4ED8}.hr-green{background:var(--done-bg);color:var(--done)}.hr-red{background:var(--blocked-bg);color:var(--blocked)}"
    + ".hr-list{margin:0;padding-left:18px;font-size:13.5px;line-height:1.7}"
    + ".hr-contract{background:#fff;border:1px solid var(--line);border-radius:12px;padding:26px 30px;max-height:520px;overflow-y:auto;font-family:Georgia,'Times New Roman',serif;font-size:14.5px;line-height:1.65;color:#1A1614}"
    + ".hr-contract h1{font-size:20px;text-align:center;margin:0 0 14px}.hr-contract h2{font-size:15px;margin:16px 0 4px}.hr-contract p{margin:0 0 9px;white-space:pre-wrap}"
    + ".hr-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:12px 0 14px}"
    + ".hr-stat{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px;cursor:pointer;text-align:left}"
    + ".hr-stat b{display:block;font-size:20px;font-family:var(--mono)}.hr-stat span{font-size:12px;color:var(--muted)}"
    + ".hr-stat.on{border-color:var(--indigo);box-shadow:0 0 0 3px var(--indigo-soft)}"
    + ".hr-tbl{width:100%;border-collapse:collapse;font-size:13.5px;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}"
    + ".hr-tbl th{text-align:left;font-family:var(--mono);font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);padding:10px 12px;border-bottom:1px solid var(--line);background:var(--paper)}"
    + ".hr-tbl td{padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:middle}"
    + ".hr-tbl tr:last-child td{border-bottom:none}"
    + ".hr-tbl tr.click{cursor:pointer}.hr-tbl tr.click:hover td{background:var(--paper)}"
    + ".hr-who{display:flex;gap:10px;align-items:center}.hr-av{width:30px;height:30px;border-radius:50%;color:#fff;font-weight:700;font-size:12px;display:grid;place-items:center;background-size:cover;background-position:center;flex:none}"
    + ".hr-who .e{font-size:12px;color:var(--muted)}"
    + ".hr-mini{display:flex;align-items:center;gap:8px}.hr-mini .hr-bar{width:90px;min-width:0}"
    + ".hr-kv{display:grid;grid-template-columns:200px minmax(0,1fr);gap:6px 14px;font-size:13.5px}"
    + ".hr-kv .k{color:var(--muted)}.hr-kv .v{font-weight:600;overflow-wrap:anywhere;white-space:pre-wrap}"
    + ".hr-sec{margin-top:16px}.hr-sec h4{font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 8px}"
    + ".hr-reveal{font-size:12px;color:var(--indigo);font-weight:600;margin-left:6px;cursor:pointer;background:none;border:none}"
    + ".hr-tl{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:12.5px;color:var(--muted)}.hr-tl b{color:var(--ink)}"
    + ".hr-ask{position:fixed;inset:0;z-index:9500;background:rgba(26,22,20,.45);display:flex;align-items:center;justify-content:center;padding:16px}"
    + ".hr-ask .box{background:var(--card);border-radius:14px;padding:18px 20px;width:min(460px,100%)}"
    + ".hr-ask textarea{width:100%;min-height:110px;margin:10px 0;padding:10px;border:1px solid var(--line-strong);border-radius:9px;font:inherit}"
    + ".hr-tpl{width:100%;min-height:360px;font-family:var(--mono);font-size:12.5px;padding:12px;border:1px solid var(--line-strong);border-radius:10px}"
    + ".hr-profile-link{display:flex;gap:10px;align-items:center;background:var(--indigo-soft);border:1px solid #F5CDB6;border-radius:12px;padding:10px 12px;margin-bottom:14px;font-size:13.5px}"
    + ".hr-profile-link .grow{flex:1}"
    + "@media(max-width:820px){.hr-grid{grid-template-columns:1fr}.hr-nav{position:static;flex-direction:row;overflow-x:auto}.hr-nav button{white-space:nowrap}"
    + ".hr-fields{grid-template-columns:1fr}.hr-stats{grid-template-columns:repeat(2,1fr)}.hr-kv{grid-template-columns:1fr}.hr-tbl .hide-s{display:none}.hr-contract{padding:18px}}";
  var st = document.createElement("style"); st.textContent = css;
  (document.head || document.documentElement).appendChild(st);
})();

/* ---------- data ---------- */
async function hrLoadMine() {
  var me = hrMe(); if (!me || !SUPA) return;
  var r = await SUPA.from("hr_records").select("*").eq("user_id", me.id).maybeSingle();
  if (r.error) throw r.error;
  var d = await SUPA.from("hr_documents").select("*").eq("user_id", me.id).order("uploaded_at");
  if (d.error) throw d.error;
  HR.rec = r.data || { user_id: me.id, details: {}, status: "draft", _new: true };
  HR.docs = d.data || [];
}
function hrClean(d) {
  var out = {};
  hrAllFields().forEach(function (f) { if (!f.noSave && d[f.k] != null && String(d[f.k]).trim() !== "") out[f.k] = d[f.k]; });
  return out;
}
async function hrSaveDraft(quiet) {
  if (!hrEditable(HR.rec)) return true;
  var d = HR.rec.details || {};
  var r = await SUPA.rpc("hr_save", { p_details: hrClean(d), p_submit: false, p_consent: false });
  if (r.error) { if (!quiet) hrToast("Couldn't save: " + hrErr(r.error)); return false; }
  HR.rec = r.data; HR.rec.details.bank_account2 = d.bank_account2; HR.dirty = false;
  var s = document.getElementById("hr-saved"); if (s) s.textContent = "Saved " + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return true;
}
function hrQueueSave() {
  HR.dirty = true;
  var s = document.getElementById("hr-saved"); if (s) s.textContent = "Saving…";
  clearTimeout(HR.saveTimer); HR.saveTimer = setTimeout(function () { hrSaveDraft(true); }, 1200);
}
async function hrSignedUrl(path) {
  var r = await SUPA.storage.from("hr-docs").createSignedUrl(path, 120);
  if (r.error) throw r.error;
  return r.data.signedUrl;
}
async function hrOpenFile(path) {
  var w = window.open("about:blank", "_blank");   // open now, while the click still counts, so it isn't blocked
  try {
    var url = await hrSignedUrl(path);
    if (w) { try { w.opener = null; } catch (_) { } w.location.href = url; } else location.href = url;
  } catch (e) { if (w) w.close(); hrToast("Couldn't open it: " + hrErr(e)); }
}
async function hrUpload(kind, file) {
  var me = hrMe(); if (!me) return;
  var ok = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  if (ok.indexOf(file.type) < 0) { hrToast("Upload a PDF, JPG, PNG or WEBP file"); return; }
  if (file.size > 10485760) { hrToast("Files can be up to 10 MB"); return; }
  var safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  var path = me.id + "/" + kind + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + "-" + safe;
  var up = await SUPA.storage.from("hr-docs").upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) { hrToast("Upload failed: " + hrErr(up.error)); return; }
  var ins = await SUPA.from("hr_documents").insert({ user_id: me.id, kind: kind, path: path, file_name: file.name.slice(0, 200), mime: file.type, size: file.size }).select().single();
  if (ins.error) { await SUPA.storage.from("hr-docs").remove([path]); hrToast("Upload failed: " + hrErr(ins.error)); return; }
  HR.docs.push(ins.data);
  hrToast("Uploaded");
}
async function hrRemoveDoc(doc) {
  var del = await SUPA.from("hr_documents").delete().eq("id", doc.id);
  if (del.error) { hrToast("Couldn't remove it: " + hrErr(del.error)); return; }
  await SUPA.storage.from("hr-docs").remove([doc.path]);
  HR.docs = HR.docs.filter(function (x) { return x.id !== doc.id; });
}

/* ---------- a small "write a note" box ---------- */
function hrAsk(title, ph, btn) {
  return new Promise(function (res) {
    var ov = hrEl("div", "hr-ask"), box = hrEl("div", "box"); ov.setAttribute("data-plain", "");
    box.appendChild(hrEl("h3", null, title));
    var ta = hrEl("textarea"); ta.placeholder = ph || ""; box.appendChild(ta);
    var row = hrEl("div", "hr-foot"); row.appendChild(hrEl("div", "grow"));
    var c = hrEl("button", "btn", "Cancel"), ok = hrEl("button", "btn save", btn || "Send");
    c.onclick = function () { ov.remove(); res(null); };
    ok.onclick = function () { var v = ta.value.trim(); if (!v) { ta.focus(); return; } ov.remove(); res(v); };
    row.append(c, ok); box.appendChild(row); ov.appendChild(box); document.body.appendChild(ov); ta.focus();
  });
}

/* ---------- contract ---------- */
function hrAddress(d, pre) {
  return [d[pre + "_line"], d[pre + "_city"], d[pre + "_state"], d[pre + "_pin"]].filter(function (x) { return x && String(x).trim(); }).join(", ");
}
function hrContractHtml(template, company, d, job) {
  d = d || {}; job = job || {}; company = company || {};
  var v = {
    date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    company: company.name || "Cyberflow Tech Pvt Ltd", company_address: company.address || "[company address]",
    company_city: company.city || "[city]", signatory: company.signatory || "[signatory]", signatory_title: company.signatory_title || "Director",
    full_name: d.full_name || "[name]", father_name: d.father_name || "[father's name]",
    address: hrAddress(d, d.same_address || !d.perm_line ? "cur" : "perm") || "[address]",
    pan: (d.pan || "").toUpperCase(), email: d.personal_email || "", mobile: d.mobile || "",
    designation: job.designation || "[designation]", department: job.department || "[department]",
    employment_type: ({ "Full-time employee": "a full-time employee", "Intern": "an intern", "Consultant / freelancer": "a consultant", "Part-time": "a part-time employee" })[job.employment_type] || "[type]",
    joining_date: job.joining_date ? new Date(job.joining_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "[joining date]",
    pay: job.pay || "[pay]", probation: job.probation || "3 months", notice: job.notice || "30 days",
    location: job.location || "[work location]", reporting_to: job.reporting_to || "[manager]", hours: job.hours || "[working hours]"
  };
  var html = "";
  String(template || HR_DEFAULT_TEMPLATE).split(/\n{2,}/).forEach(function (block) {
    var t = hrEsc(block.trim()).replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? hrEsc(v[k]) : m; });
    if (!t) return;
    if (/^# /.test(t)) html += "<h1>" + t.slice(2) + "</h1>";
    else if (/^## /.test(t)) html += "<h2>" + t.slice(3) + "</h2>";
    else html += "<p>" + t + "</p>";
  });
  return html;
}
function hrPrint(html, title) {
  var fr = document.createElement("iframe");
  fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(fr);
  var doc = fr.contentWindow.document;
  doc.open();
  doc.write("<!doctype html><html><head><meta charset='utf-8'><title>" + hrEsc(title) + "</title><style>body{font-family:Georgia,'Times New Roman',serif;font-size:14.5px;line-height:1.65;color:#111;max-width:720px;margin:40px auto;padding:0 24px}h1{font-size:20px;text-align:center}h2{font-size:15px;margin:18px 0 4px}p{white-space:pre-wrap;margin:0 0 10px}</style></head><body>" + html + "</body></html>");
  doc.close();
  setTimeout(function () { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (_) { } setTimeout(function () { fr.remove(); }, 2000); }, 300);
}

/* =====================================================================
   1. MY HR FILE (everyone)
   ===================================================================== */
async function openMyHrFile(step) {
  if (!hrMe() || !SUPA) { hrToast("Sign in first"); return; }
  var page = document.getElementById("hr-page");
  if (!page) { page = hrEl("div", "hr-page"); page.id = "hr-page"; page.setAttribute("data-plain", ""); page.setAttribute("role", "dialog"); page.setAttribute("aria-modal", "true"); document.body.appendChild(page); }
  page.innerHTML = '<div class="hr-shell"><div class="hint">Loading your HR file…</div></div>';
  page.style.display = "block";
  try { await hrLoadMine(); } catch (e) { page.innerHTML = ""; hrClosePage(); hrToast("Couldn't open your HR file: " + hrErr(e) + (/hr_records/.test(hrErr(e)) ? " (run supabase/stage18a_hr_files.sql)" : "")); return; }
  var st = HR.rec.status;
  HR.step = step != null ? step : (st === "contract_sent" || st === "signed" || st === "complete") ? HR_STEPS.length - 1 : st === "submitted" ? 7 : 0;
  hrRenderMine();
}
async function hrClosePage() {
  if (HR.dirty) { clearTimeout(HR.saveTimer); await hrSaveDraft(true); }
  var page = document.getElementById("hr-page"); if (page) page.style.display = "none";
  try { var u = new URL(location.href); if (u.searchParams.has("hr")) { u.searchParams.delete("hr"); history.replaceState(null, "", u.toString()); } } catch (_) { }
}
function hrVisibleSteps() {
  var st = HR.rec && HR.rec.status;
  var hasContract = st === "contract_sent" || st === "signed" || st === "complete";
  return HR_STEPS.map(function (s, i) { return { s: s, i: i }; }).filter(function (x) { return x.s.k !== "contract" || hasContract; });
}
function hrRenderMine() {
  var page = document.getElementById("hr-page"); if (!page) return;
  var rec = HR.rec, d = rec.details || (rec.details = {}), editable = hrEditable(rec);
  var pct = hrProgress(d, HR.docs);
  page.innerHTML = "";
  var shell = hrEl("div", "hr-shell");
  var top = hrEl("div", "hr-top");
  top.appendChild(hrEl("h2", null, "🗂️ My HR file"));
  top.appendChild(hrChip(rec._new ? "draft" : rec.status));
  var bar = hrEl("div", "hr-bar"); var fill = hrEl("i"); fill.style.width = pct + "%"; bar.appendChild(fill);
  top.appendChild(bar); top.appendChild(hrEl("span", "hr-pct", pct + "% done"));
  top.appendChild(hrEl("div", "grow"));
  var close = hrEl("button", "btn", "Close"); close.onclick = hrClosePage; top.appendChild(close);
  shell.appendChild(top);

  if (rec.status === "changes" && rec.hr_note) {
    var n = hrEl("div", "hr-note warn"); n.textContent = "HR asked for changes: " + rec.hr_note; shell.appendChild(n);
  } else if (rec.status === "submitted") {
    shell.appendChild(hrEl("div", "hr-note info", "Thanks! HR is checking your file. You'll get a 🔔 and an email when your contract is ready. Your details are locked while HR checks them."));
  } else if (rec.status === "complete") {
    shell.appendChild(hrEl("div", "hr-note ok", "✅ Your HR file is complete. Nothing more is needed from you."));
  }

  var grid = hrEl("div", "hr-grid");
  var nav = hrEl("div", "hr-nav");
  hrVisibleSteps().forEach(function (x) {
    var b = hrEl("button"); b.type = "button"; if (x.i === HR.step) b.className = "on";
    b.appendChild(hrEl("span", null, x.s.ico)); b.appendChild(hrEl("span", null, x.s.lbl));
    if (x.s.fields) {
      var bad = hrStepIssues(x.s, d);
      b.appendChild(bad ? hrEl("span", "todo", bad + " left") : hrEl("span", "tick", "✓"));
    } else if (x.s.k === "docs") {
      var miss = HR_DOCS.filter(function (z) { return z.req && !hrDocsHave(HR.docs, z.k); }).length;
      b.appendChild(miss ? hrEl("span", "todo", miss + " left") : hrEl("span", "tick", "✓"));
    }
    b.onclick = function () { HR.step = x.i; hrRenderMine(); };
    nav.appendChild(b);
  });
  grid.appendChild(nav);

  var card = hrEl("div", "hr-card");
  var step = HR_STEPS[HR.step];
  if (step.fields) hrRenderFields(card, step, d, editable);
  else if (step.k === "docs") hrRenderDocs(card, editable);
  else if (step.k === "submit") hrRenderSubmit(card, d, editable);
  else hrRenderContract(card);

  if (step.k !== "contract") {
    var foot = hrEl("div", "hr-foot");
    var vis = hrVisibleSteps().map(function (x) { return x.i; }), at = vis.indexOf(HR.step);
    if (at > 0) { var back = hrEl("button", "btn", "← Back"); back.onclick = function () { HR.step = vis[at - 1]; hrRenderMine(); }; foot.appendChild(back); }
    foot.appendChild(hrEl("div", "grow"));
    if (editable) { var sv = hrEl("span", "hr-saved", rec._new ? "" : "Saved"); sv.id = "hr-saved"; foot.appendChild(sv); }
    if (at < vis.length - 1 && step.k !== "submit") {
      var next = hrEl("button", "btn save", "Next →");
      next.onclick = async function () { if (editable) await hrSaveDraft(true); HR.step = vis[at + 1]; hrRenderMine(); page.scrollTop = 0; };
      foot.appendChild(next);
    }
    card.appendChild(foot);
  }
  grid.appendChild(card);
  shell.appendChild(grid);
  page.appendChild(shell);
}
function hrRenderFields(card, step, d, editable) {
  card.appendChild(hrEl("h3", null, step.ico + " " + step.lbl));
  card.appendChild(hrEl("div", "hint", editable ? "Fields marked * are needed. Everything saves as you type." : "Locked while HR has your file."));
  var box = hrEl("div", "hr-fields");
  var errs = {};
  step.fields.forEach(function (f) {
    var wrap = hrEl("div", "field" + (f.type === "area" || f.type === "check" ? " wide" : ""));
    if (f.unless && d[f.unless]) wrap.hidden = true;
    var id = "hr-f-" + f.k, inp;
    if (f.type === "check") {
      var lab = hrEl("label", "hr-check"); inp = hrEl("input"); inp.type = "checkbox"; inp.id = id; inp.checked = !!d[f.k];
      lab.append(inp, document.createTextNode(f.lbl)); wrap.appendChild(lab);
      inp.disabled = !editable;
      inp.onchange = function () { d[f.k] = inp.checked; hrQueueSave(); hrRenderMine(); };
      box.appendChild(wrap); return;
    }
    var l = hrEl("label"); l.htmlFor = id; l.textContent = f.lbl; if (f.req) l.appendChild(hrEl("span", "req", " *"));
    wrap.appendChild(l);
    if (f.type === "select") {
      inp = hrEl("select"); var o0 = hrEl("option", null, "Choose…"); o0.value = ""; inp.appendChild(o0);
      f.opts.forEach(function (o) { var op = hrEl("option", null, o); op.value = o; inp.appendChild(op); });
    } else if (f.type === "area") { inp = hrEl("textarea"); inp.rows = 2; }
    else { inp = hrEl("input"); inp.type = f.type === "tel" ? "tel" : f.type === "email" ? "email" : f.type === "date" ? "date" : f.type === "month" ? "month" : "text"; }
    inp.id = id; inp.value = d[f.k] != null ? d[f.k] : ""; if (f.ph) inp.placeholder = f.ph;
    if (f.fmt === "pan" || f.fmt === "ifsc") inp.style.textTransform = "uppercase";
    if (f.k === "full_name" && !inp.value && editable && hrMe() && hrMe().name) { inp.value = hrMe().name; d.full_name = inp.value; }
    inp.disabled = !editable;
    var err = hrEl("div", "hr-ferr");
    errs[f.k] = { wrap: wrap, err: err };
    function sync(show) {
      var msg = hrCheck(f, inp.value, d);
      err.textContent = show && msg !== "Required" ? msg : "";
      wrap.classList.toggle("bad", !!(show && msg && msg !== "Required"));
    }
    inp.addEventListener("input", function () {
      var v = inp.value;
      if (f.fmt === "pan" || f.fmt === "ifsc") v = v.toUpperCase();
      d[f.k] = v; if (!f.noSave) hrQueueSave(); sync(false);
    });
    inp.addEventListener("change", function () { sync(true); });
    inp.addEventListener("blur", function () { sync(true); });
    wrap.append(inp, err);
    if (inp.value) setTimeout(function () { sync(true); }, 0);
    box.appendChild(wrap);
  });
  card.appendChild(box);
}
function hrRenderDocs(card, editable) {
  card.appendChild(hrEl("h3", null, "📎 Documents"));
  card.appendChild(hrEl("div", "hint", "PDF, JPG, PNG or WEBP, up to 10 MB each. Only you and HR can open these files."));
  HR_DOCS.forEach(function (x) {
    var row = hrEl("div", "hr-doc"), left = hrEl("div");
    var t = hrEl("div", "t", x.lbl); if (x.req) t.appendChild(hrEl("span", "req", " *")); left.appendChild(t);
    left.appendChild(hrEl("div", "h", x.hint));
    var files = hrEl("div", "hr-files");
    HR.docs.filter(function (z) { return z.kind === x.k; }).forEach(function (z) {
      var f = hrEl("div", "hr-file");
      var nm = hrEl("button", "n", z.file_name); nm.type = "button"; nm.title = "Open"; nm.onclick = function () { hrOpenFile(z.path); };
      f.appendChild(nm); f.appendChild(hrEl("span", null, hrSize(z.size || 0)));
      f.appendChild(z.status === "approved" ? hrEl("span", "hr-chip hr-green", "Approved") : z.status === "rejected" ? hrEl("span", "hr-chip hr-red", "Rejected") : hrEl("span", "hr-chip hr-grey", "Uploaded"));
      if (z.note) f.appendChild(hrEl("span", null, "· " + z.note));
      if (editable && z.status !== "approved") {
        var rm = hrEl("button", "x", "Remove"); rm.type = "button";
        rm.onclick = async function () { await hrRemoveDoc(z); hrRenderMine(); };
        f.appendChild(rm);
      }
      files.appendChild(f);
    });
    left.appendChild(files);
    row.appendChild(left);
    if (editable) {
      var inp = hrEl("input"); inp.type = "file"; inp.accept = "application/pdf,image/jpeg,image/png,image/webp"; inp.hidden = true; inp.multiple = true;
      var b = hrEl("button", "btn", "Upload"); b.type = "button"; b.onclick = function () { inp.click(); };
      inp.onchange = async function () {
        b.disabled = true; b.textContent = "Uploading…";
        for (var i = 0; i < inp.files.length; i++) await hrUpload(x.k, inp.files[i]);
        hrRenderMine();
      };
      var r = hrEl("div"); r.append(b, inp); row.appendChild(r);
    }
    card.appendChild(row);
  });
}
function hrMissing(d) {
  var out = [];
  HR_STEPS.forEach(function (s, i) { (s.fields || []).forEach(function (f) { if (f.type !== "check" && hrCheck(f, d[f.k], d)) out.push({ step: i, txt: s.lbl + ": " + f.lbl + (hrCheck(f, d[f.k], d) === "Required" ? "" : " — " + hrCheck(f, d[f.k], d)) }); }); });
  HR_DOCS.forEach(function (x) { if (x.req && !hrDocsHave(HR.docs, x.k)) out.push({ step: 6, txt: "Upload: " + x.lbl }); });
  return out;
}
function hrRenderSubmit(card, d, editable) {
  card.appendChild(hrEl("h3", null, "✅ Check and submit"));
  if (!editable) {
    card.appendChild(hrEl("div", "hint", HR.rec.status === "submitted" ? "Submitted on " + hrDate(HR.rec.submitted_at) + ". HR is checking it." : "Submitted. HR has your file."));
    return;
  }
  var miss = hrMissing(d);
  if (miss.length) {
    card.appendChild(hrEl("div", "hint", "A few things are still needed:"));
    var ul = hrEl("ul", "hr-list");
    miss.forEach(function (m) { var li = hrEl("li"); var a = hrEl("button", "hr-reveal", m.txt); a.style.marginLeft = "0"; a.onclick = function () { HR.step = m.step; hrRenderMine(); }; li.appendChild(a); ul.appendChild(li); });
    card.appendChild(ul);
  } else {
    card.appendChild(hrEl("div", "hr-note ok", "Everything needed is filled in. 🎉"));
  }
  var lab = hrEl("label", "hr-check"); lab.style.marginTop = "16px";
  var cb = hrEl("input"); cb.type = "checkbox"; cb.id = "hr-consent";
  lab.append(cb, document.createTextNode("I confirm these details are true, and I agree that Cyberflow Tech Pvt Ltd may keep them and my documents for my employment records, payroll and the law (for example tax and PF)."));
  card.appendChild(lab);
  var foot = hrEl("div", "hr-foot"); foot.appendChild(hrEl("div", "grow"));
  var go = hrEl("button", "btn save", "Submit to HR"); go.disabled = !!miss.length;
  go.onclick = async function () {
    if (!cb.checked) { hrToast("Please tick the box first"); return; }
    go.disabled = true; go.textContent = "Submitting…";
    await hrSaveDraft(true);
    var r = await SUPA.rpc("hr_save", { p_details: hrClean(HR.rec.details || {}), p_submit: true, p_consent: true });
    if (r.error) { hrToast(hrErr(r.error)); go.disabled = false; go.textContent = "Submit to HR"; return; }
    HR.rec = r.data; hrToast("Sent to HR. Thank you!"); hrRenderMine();
  };
  foot.appendChild(go); card.appendChild(foot);
}
function hrRenderContract(card) {
  var rec = HR.rec;
  card.appendChild(hrEl("h3", null, "✍️ Your contract"));
  if (rec.status === "complete") card.appendChild(hrEl("div", "hr-note ok", "Signed and checked. ✅"));
  else if (rec.status === "signed") card.appendChild(hrEl("div", "hr-note info", "Thanks! HR is checking your signed copy."));
  else card.appendChild(hrEl("div", "hint", "Sent to your email on " + hrDate(rec.contract_sent_at) + ". Read it, print it, sign every page, and upload the signed copy below."));
  var view = hrEl("div", "hr-contract"); view.innerHTML = rec.contract_html || "<p>No contract yet.</p>";
  card.appendChild(view);
  var row = hrEl("div", "hr-foot");
  var pr = hrEl("button", "btn", "🖨 Print or save as PDF"); pr.onclick = function () { hrPrint(rec.contract_html || "", "Contract"); };
  row.appendChild(pr); row.appendChild(hrEl("div", "grow"));
  card.appendChild(row);

  var signed = HR.docs.filter(function (z) { return z.kind === "contract"; });
  var sec = hrEl("div", "hr-sec"); sec.appendChild(hrEl("h4", null, "Signed copy"));
  var files = hrEl("div", "hr-files");
  signed.forEach(function (z) {
    var f = hrEl("div", "hr-file"); var nm = hrEl("button", "n", z.file_name); nm.type = "button"; nm.onclick = function () { hrOpenFile(z.path); };
    f.append(nm, hrEl("span", null, hrSize(z.size || 0)));
    f.appendChild(z.status === "rejected" ? hrEl("span", "hr-chip hr-red", "Rejected" + (z.note ? ": " + z.note : "")) : z.status === "approved" ? hrEl("span", "hr-chip hr-green", "Approved") : hrEl("span", "hr-chip hr-grey", "Uploaded"));
    if (rec.status === "contract_sent" && z.status !== "approved") { var rm = hrEl("button", "x", "Remove"); rm.onclick = async function () { await hrRemoveDoc(z); hrRenderMine(); }; f.appendChild(rm); }
    files.appendChild(f);
  });
  sec.appendChild(files);
  if (rec.status === "contract_sent") {
    var inp = hrEl("input"); inp.type = "file"; inp.accept = "application/pdf,image/jpeg,image/png,image/webp"; inp.multiple = true; inp.hidden = true;
    var up = hrEl("button", "btn", "Upload signed copy"); up.onclick = function () { inp.click(); };
    inp.onchange = async function () { up.disabled = true; up.textContent = "Uploading…"; for (var i = 0; i < inp.files.length; i++) await hrUpload("contract", inp.files[i]); hrRenderMine(); };
    var done = hrEl("button", "btn save", "I've uploaded it — send to HR");
    done.disabled = !signed.some(function (z) { return z.status !== "rejected"; });
    done.onclick = async function () {
      var r = await SUPA.rpc("hr_mark_signed"); if (r.error) { hrToast(hrErr(r.error)); return; }
      HR.rec = r.data; hrToast("Sent to HR"); hrRenderMine();
    };
    var f2 = hrEl("div", "hr-foot"); f2.append(up, inp, hrEl("div", "grow"), done); sec.appendChild(f2);
  }
  card.appendChild(sec);
}

/* =====================================================================
   2. ADMINISTRATION → EMPLOYEES (HR)
   ===================================================================== */
var HRA = { filter: "all", q: "", open: null, rows: null, docs: null, reveal: {} };
async function hrLoadSettings() {
  var s = await SUPA.from("hr_settings").select("*").eq("id", 1).maybeSingle();
  HR.settings = s.data || { company: {}, contract_template: "" };
  return HR.settings;
}
function hrTeamPeople() {
  return hrUsers().filter(function (u) { return u.id && typeof roleOf === "function" && roleOf(u, TEAM); })
    .sort(function (a, b) { return userDisplayName(a).localeCompare(userDisplayName(b)); });
}
async function hrLoadAll() {
  var ids = hrTeamPeople().map(function (u) { return u.id; });
  if (!ids.length) { HRA.rows = {}; HRA.docs = {}; return; }
  var r = await SUPA.from("hr_records").select("*").in("user_id", ids);
  if (r.error) throw r.error;
  var d = await SUPA.from("hr_documents").select("*").in("user_id", ids).order("uploaded_at");
  if (d.error) throw d.error;
  HRA.rows = {}; (r.data || []).forEach(function (x) { HRA.rows[x.user_id] = x; });
  HRA.docs = {}; (d.data || []).forEach(function (x) { (HRA.docs[x.user_id] = HRA.docs[x.user_id] || []).push(x); });
}
function hrAvatar(u) {
  var av = hrEl("span", "hr-av");
  if (u.profile && u.profile.photo) av.style.backgroundImage = "url(" + u.profile.photo + ")";
  else { av.style.background = userAvatarColor(u); av.textContent = (userDisplayName(u) || "?").charAt(0).toUpperCase(); }
  return av;
}
function hrBucket(st) {
  if (!st || st === "draft") return "todo";
  if (st === "submitted" || st === "signed") return "hr";
  if (st === "changes" || st === "contract_sent") return "them";
  return "done";
}
function renderAdminHr(wrap) {
  if (HRA.open && HRA.rows) { hrRenderPerson(wrap, HRA.open); return; }
  if (HRA.open) { hrLoadAll().then(function () { renderAdminPage(); }).catch(function (e) { HRA.open = null; hrToast(hrErr(e)); }); return; }
  var head = hrEl("div", "module-head");
  var h2 = hrEl("h2", null, "Employees (HR)"); head.appendChild(h2);
  if (hrMe() && hrMe().super) {
    var set = hrEl("button", "btn", "⚙️ Company and contract template"); set.style.marginLeft = "auto";
    set.onclick = function () { hrSettingsDialog(); }; head.appendChild(set); head.style.display = "flex"; head.style.alignItems = "center"; head.style.gap = "10px";
  }
  wrap.appendChild(head);
  wrap.appendChild(hrEl("div", "hint", "Everyone in this team fills in their own HR file from their account menu → 🗂️ My HR file. Open a person to check their details and documents, and send their contract."));
  var body = hrEl("div"); body.innerHTML = '<div class="hint" style="margin-top:14px">Loading…</div>';
  wrap.appendChild(body);
  hrLoadAll().then(function () { hrDrawList(body); }).catch(function (e) {
    body.innerHTML = ""; body.appendChild(hrEl("div", "hr-note warn", "Couldn't load HR files: " + hrErr(e) + (/hr_records/.test(hrErr(e)) ? ". Run supabase/stage18a_hr_files.sql in Supabase first." : "")));
  });
}
function hrDrawList(body) {
  body.innerHTML = "";
  var people = hrTeamPeople();
  var counts = { all: people.length, todo: 0, them: 0, hr: 0, done: 0 };
  people.forEach(function (u) { counts[hrBucket(HRA.rows[u.id] && HRA.rows[u.id].status)]++; });
  var stats = hrEl("div", "hr-stats");
  [["all", "Everyone"], ["todo", "Not submitted"], ["hr", "Waiting for HR"], ["them", "Waiting for them"], ["done", "Complete"]].forEach(function (s) {
    var b = hrEl("button", "hr-stat" + (HRA.filter === s[0] ? " on" : "")); b.type = "button";
    b.appendChild(hrEl("b", null, String(counts[s[0]]))); b.appendChild(hrEl("span", null, s[1]));
    b.onclick = function () { HRA.filter = s[0]; hrDrawList(body); };
    stats.appendChild(b);
  });
  body.appendChild(stats);
  var q = hrEl("input", "login-input"); q.placeholder = "Search by name or email"; q.value = HRA.q; q.style.cssText = "max-width:320px;margin-bottom:10px";
  q.oninput = function () { HRA.q = q.value; draw(); };
  body.appendChild(q);
  var holder = hrEl("div"); holder.style.overflowX = "auto"; body.appendChild(holder);
  function draw() {
    holder.innerHTML = "";
    var t = hrEl("table", "hr-tbl");
    t.innerHTML = "<thead><tr><th>Person</th><th>Progress</th><th class='hide-s'>Documents</th><th>Status</th><th class='hide-s'>Updated</th></tr></thead>";
    var tb = hrEl("tbody");
    var list = people.filter(function (u) {
      var rec = HRA.rows[u.id];
      if (HRA.filter !== "all" && hrBucket(rec && rec.status) !== HRA.filter) return false;
      var s = (userDisplayName(u) + " " + u.email).toLowerCase();
      return !HRA.q || s.indexOf(HRA.q.toLowerCase()) >= 0;
    });
    list.forEach(function (u) {
      var rec = HRA.rows[u.id], docs = HRA.docs[u.id] || [];
      var tr = hrEl("tr", "click"); tr.tabIndex = 0;
      var c1 = hrEl("td"), who = hrEl("div", "hr-who"), txt = hrEl("div");
      txt.appendChild(hrEl("div", null, userDisplayName(u))); txt.appendChild(hrEl("div", "e", u.email));
      who.append(hrAvatar(u), txt); c1.appendChild(who);
      var pct = rec ? hrProgress(rec.details, docs) : 0;
      var c2 = hrEl("td"), mini = hrEl("div", "hr-mini"), bar = hrEl("div", "hr-bar"), f = hrEl("i"); f.style.width = pct + "%"; bar.appendChild(f);
      mini.append(bar, hrEl("span", "hr-pct", pct + "%")); c2.appendChild(mini);
      var appr = docs.filter(function (z) { return z.status === "approved"; }).length;
      var c3 = hrEl("td", "hide-s", docs.length ? docs.length + " uploaded · " + appr + " approved" : "—");
      var c4 = hrEl("td"); c4.appendChild(hrChip(rec ? rec.status : "none"));
      var c5 = hrEl("td", "hide-s", rec ? hrDate(rec.updated_at) : "—");
      tr.append(c1, c2, c3, c4, c5);
      function go() { HRA.open = u.id; HRA.reveal = {}; renderAdminPage(); }
      tr.onclick = go; tr.onkeydown = function (e) { if (e.key === "Enter") go(); };
      tb.appendChild(tr);
    });
    if (!list.length) { var tr0 = hrEl("tr"), td0 = hrEl("td", null, "Nobody here."); td0.colSpan = 5; td0.style.color = "var(--muted)"; tr0.appendChild(td0); tb.appendChild(tr0); }
    t.appendChild(tb); holder.appendChild(t);
  }
  draw();
}

function hrRenderPerson(wrap, uid) {
  var u = hrUser(uid); if (!u) { HRA.open = null; renderAdminHr(wrap); return; }
  var rec = (HRA.rows && HRA.rows[uid]) || null, docs = (HRA.docs && HRA.docs[uid]) || [];
  var d = (rec && rec.details) || {}, job = Object.assign({}, (rec && rec.job) || {});
  var back = hrEl("button", "btn", "← All employees"); back.onclick = function () { HRA.open = null; renderAdminPage(); };
  wrap.appendChild(back);
  var top = hrEl("div", "hr-top"); top.style.marginTop = "14px";
  var who = hrEl("div", "hr-who"), txt = hrEl("div");
  var nm = hrEl("h2", null, userDisplayName(u)); nm.style.margin = "0"; txt.append(nm, hrEl("div", "e", u.email));
  who.append(hrAvatar(u), txt); top.appendChild(who);
  top.appendChild(hrChip(rec ? rec.status : "none"));
  var pct = rec ? hrProgress(d, docs) : 0;
  top.appendChild(hrEl("span", "hr-pct", pct + "% filled in"));
  top.appendChild(hrEl("div", "grow"));
  wrap.appendChild(top);

  async function act(action, extra) {
    var args = Object.assign({ p_user: uid, p_action: action, p_job: null, p_note: null, p_contract_html: null }, extra || {});
    var r = await SUPA.rpc("hr_admin_update", args);
    if (r.error) { hrToast(hrErr(r.error)); return null; }
    HRA.rows[uid] = r.data; return r.data;
  }
  var acts = hrEl("div", "hr-foot"); acts.style.marginTop = "0";
  if (rec && (rec.status === "submitted" || rec.status === "signed" || rec.status === "contract_sent")) {
    var sb = hrEl("button", "btn", "↩️ Send back with a note");
    sb.onclick = async function () { var n = await hrAsk("What needs to change?", "e.g. The PAN photo is blurry. Please upload it again.", "Send back"); if (n && await act("send_back", { p_note: n })) { hrToast("Sent back"); renderAdminPage(); } };
    acts.appendChild(sb);
  }
  if (rec && rec.status === "signed") {
    var cm = hrEl("button", "btn save", "✅ Mark complete");
    cm.onclick = async function () { if (await act("complete")) { hrToast("Marked complete"); renderAdminPage(); } };
    acts.appendChild(cm);
  }
  if (rec && rec.status === "complete") {
    var ro = hrEl("button", "btn", "Reopen the file");
    ro.onclick = async function () { var n = await hrAsk("Why are you reopening it?", "e.g. Please update your new address.", "Reopen"); if (n && await act("reopen", { p_note: n })) { hrToast("Reopened"); renderAdminPage(); } };
    acts.appendChild(ro);
  }
  if (acts.children.length) wrap.appendChild(acts);

  var tl = hrEl("div", "hr-tl"); tl.style.margin = "12px 0 4px";
  [["Submitted", rec && rec.submitted_at], ["Contract sent", rec && rec.contract_sent_at], ["Signed copy", rec && rec.signed_at], ["Complete", rec && rec.completed_at]].forEach(function (x) {
    var s = hrEl("span"); s.appendChild(document.createTextNode(x[0] + ": ")); s.appendChild(hrEl("b", null, x[1] ? hrDate(x[1]) : "—")); tl.appendChild(s);
  });
  wrap.appendChild(tl);
  if (rec && rec.hr_note && rec.status === "changes") wrap.appendChild(hrEl("div", "hr-note warn", "You asked: " + rec.hr_note));
  if (!rec) wrap.appendChild(hrEl("div", "hr-note info", "They haven't started their HR file yet. They can open it from their account menu → 🗂️ My HR file."));

  /* details */
  var card = hrEl("div", "hr-card"); card.style.marginTop = "14px";
  card.appendChild(hrEl("h3", null, "Their details"));
  HR_STEPS.forEach(function (s) {
    if (!s.fields) return;
    var sec = hrEl("div", "hr-sec"); sec.appendChild(hrEl("h4", null, s.lbl));
    var kv = hrEl("div", "hr-kv");
    s.fields.forEach(function (f) {
      if (f.noSave || f.type === "check") return;
      if (f.unless && d[f.unless]) return;
      var v = d[f.k]; if (v == null || String(v).trim() === "") { if (!f.req) return; v = ""; }
      kv.appendChild(hrEl("div", "k", f.lbl));
      var vv = hrEl("div", "v");
      var secret = f.k === "aadhaar" || f.k === "bank_account";
      if (!v) { vv.textContent = "—"; vv.style.color = "var(--muted)"; }
      else if (secret && !HRA.reveal[f.k]) {
        vv.textContent = hrMask(String(v).replace(/\s/g, ""), 4);
        var sh = hrEl("button", "hr-reveal", "Show"); sh.onclick = function () { HRA.reveal[f.k] = true; renderAdminPage(); }; vv.appendChild(sh);
      } else vv.textContent = f.fmt === "pan" || f.fmt === "ifsc" ? String(v).toUpperCase() : String(v);
      kv.appendChild(vv);
    });
    if (s.k === "address" && d.same_address) { kv.appendChild(hrEl("div", "k", "Permanent address")); kv.appendChild(hrEl("div", "v", "Same as above")); }
    sec.appendChild(kv); card.appendChild(sec);
  });
  if (rec && rec.consent_at) card.appendChild(hrEl("div", "hint", "Consent given on " + hrDate(rec.consent_at) + "."));
  wrap.appendChild(card);

  /* documents */
  var dc = hrEl("div", "hr-card"); dc.style.marginTop = "14px";
  dc.appendChild(hrEl("h3", null, "Documents"));
  HR_DOCS.concat([{ k: "contract", lbl: "Signed contract" }]).forEach(function (x) {
    var mine = docs.filter(function (z) { return z.kind === x.k; });
    if (!mine.length && !x.req) return;
    var row = hrEl("div", "hr-doc"), left = hrEl("div");
    var t = hrEl("div", "t", x.lbl); if (x.req) t.appendChild(hrEl("span", "req", " *")); left.appendChild(t);
    if (!mine.length) left.appendChild(hrEl("div", "h", "Not uploaded yet"));
    var files = hrEl("div", "hr-files");
    mine.forEach(function (z) {
      var f = hrEl("div", "hr-file");
      var n = hrEl("button", "n", z.file_name); n.type = "button"; n.title = "Open"; n.onclick = function () { hrOpenFile(z.path); };
      f.append(n, hrEl("span", null, hrSize(z.size || 0) + " · " + hrDate(z.uploaded_at)));
      f.appendChild(z.status === "approved" ? hrEl("span", "hr-chip hr-green", "Approved") : z.status === "rejected" ? hrEl("span", "hr-chip hr-red", "Rejected") : hrEl("span", "hr-chip hr-grey", "To check"));
      if (z.note) f.appendChild(hrEl("span", null, "· " + z.note));
      async function review(status, note) {
        var r = await SUPA.rpc("hr_review_doc", { p_doc: z.id, p_status: status, p_note: note || null });
        if (r.error) { hrToast(hrErr(r.error)); return; }
        Object.assign(z, r.data); renderAdminPage();
      }
      if (z.status !== "approved") { var ap = hrEl("button", "hr-reveal", "Approve"); ap.onclick = function () { review("approved"); }; f.appendChild(ap); }
      if (z.status !== "rejected") { var rj = hrEl("button", "hr-reveal", "Reject"); rj.style.color = "#C0362C"; rj.onclick = async function () { var n2 = await hrAsk("Why can't you accept it?", "e.g. Too blurry to read the number.", "Reject"); if (n2) review("rejected", n2); }; f.appendChild(rj); }
      files.appendChild(f);
    });
    left.appendChild(files); row.appendChild(left); dc.appendChild(row);
  });
  wrap.appendChild(dc);

  /* job terms + contract */
  var jc = hrEl("div", "hr-card"); jc.style.marginTop = "14px";
  jc.appendChild(hrEl("h3", null, "Job terms and contract"));
  jc.appendChild(hrEl("div", "hint", "Fill these in, then preview the contract. It goes to " + u.email + "."));
  var box = hrEl("div", "hr-fields");
  HR_JOB.forEach(function (f) {
    var w = hrEl("div", "field"), id = "hr-j-" + f.k, l = hrEl("label", null, f.lbl); l.htmlFor = id; w.appendChild(l);
    var inp;
    if (f.type === "select") { inp = hrEl("select"); var o0 = hrEl("option", null, "Choose…"); o0.value = ""; inp.appendChild(o0); f.opts.forEach(function (o) { var op = hrEl("option", null, o); op.value = o; inp.appendChild(op); }); }
    else { inp = hrEl("input"); inp.type = f.type === "date" ? "date" : "text"; if (f.ph) inp.placeholder = f.ph; }
    inp.id = id; inp.value = job[f.k] || "";
    inp.oninput = inp.onchange = function () { job[f.k] = inp.value; };
    w.appendChild(inp); box.appendChild(w);
  });
  jc.appendChild(box);
  var jf = hrEl("div", "hr-foot");
  var sj = hrEl("button", "btn", "Save job terms");
  sj.onclick = async function () { if (await act("save_job", { p_job: job })) hrToast("Job terms saved"); };
  var pv = hrEl("button", "btn save", "📄 Preview contract");
  pv.onclick = async function () {
    if (!rec || ["submitted", "contract_sent", "signed", "complete"].indexOf(rec.status) < 0) { hrToast("They need to submit their HR file first"); return; }
    await act("save_job", { p_job: job });
    var s = HR.settings || await hrLoadSettings();
    hrContractDialog(u, hrContractHtml(s.contract_template, s.company, d, job), act);
  };
  jf.append(sj, hrEl("div", "grow"), pv);
  if (rec && rec.contract_html) {
    var last = hrEl("button", "btn", "See the contract they got"); last.onclick = function () { hrContractDialog(u, rec.contract_html, null); };
    jf.insertBefore(last, pv);
  }
  jc.appendChild(jf);
  wrap.appendChild(jc);
}
function hrContractDialog(u, html, act) {
  var ov = hrEl("div", "hr-ask"), bx = hrEl("div", "box"); bx.style.width = "min(820px,100%)"; ov.setAttribute("data-plain", "");
  bx.appendChild(hrEl("h3", null, act ? "Contract for " + userDisplayName(u) : "Contract sent to " + userDisplayName(u)));
  if (act) bx.appendChild(hrEl("div", "hint", "Check every line. Anything in [brackets] is still missing — fill in the job terms or the company details first."));
  var view = hrEl("div", "hr-contract"); view.style.margin = "10px 0"; view.innerHTML = html; bx.appendChild(view);
  var row = hrEl("div", "hr-foot");
  var pr = hrEl("button", "btn", "🖨 Print / PDF"); pr.onclick = function () { hrPrint(html, "Contract — " + userDisplayName(u)); };
  var cl = hrEl("button", "btn", "Close"); cl.onclick = function () { ov.remove(); };
  row.append(pr, hrEl("div", "grow"), cl);
  if (act) {
    var send = hrEl("button", "btn save", "✉️ Email it to " + u.email);
    send.onclick = async function () {
      if (/\[[^\]]+\]/.test(view.textContent) && !send.dataset.ok) { send.dataset.ok = "1"; send.textContent = "Some [brackets] are empty. Send anyway?"; return; }
      send.disabled = true; send.textContent = "Sending…";
      var r = await SUPA.functions.invoke("hr-mail", { body: { action: "contract", user_id: u.id, html: html } });
      var err = r.error ? r.error.message : (r.data && r.data.error);
      if (r.error) { try { var j = await r.error.context.json(); if (j && j.error) err = j.error; } catch (_) { } }
      if (err) { hrToast("Couldn't send: " + err); send.disabled = false; send.textContent = "✉️ Email it to " + u.email; return; }
      ov.remove(); hrToast("Contract emailed to " + u.email);
      await hrLoadAll(); renderAdminPage();
    };
    row.appendChild(send);
  }
  bx.appendChild(row); ov.appendChild(bx);
  ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
}
async function hrSettingsDialog() {
  var s = await hrLoadSettings();
  var c = Object.assign({}, s.company || {});
  var ov = hrEl("div", "hr-ask"), bx = hrEl("div", "box"); ov.setAttribute("data-plain", ""); bx.style.width = "min(820px,100%)"; bx.style.maxHeight = "92vh"; bx.style.overflowY = "auto";
  bx.appendChild(hrEl("h3", null, "Company details and contract template"));
  var box = hrEl("div", "hr-fields"); box.style.margin = "12px 0";
  [["name", "Company name"], ["address", "Registered address"], ["city", "City (for the courts clause)"], ["signatory", "Who signs for the company"], ["signatory_title", "Their title"], ["email", "HR email"]].forEach(function (x) {
    var w = hrEl("div", "field" + (x[0] === "address" ? " wide" : "")), id = "hr-c-" + x[0], l = hrEl("label", null, x[1]); l.htmlFor = id;
    var i = hrEl("input"); i.id = id; i.value = c[x[0]] || ""; i.oninput = function () { c[x[0]] = i.value; };
    w.append(l, i); box.appendChild(w);
  });
  bx.appendChild(box);
  bx.appendChild(hrEl("div", "hint", "Template: a blank line starts a new paragraph. # makes the title, ## a heading. Placeholders: {date} {company} {company_address} {company_city} {signatory} {signatory_title} {full_name} {father_name} {address} {pan} {email} {mobile} {designation} {department} {employment_type} {joining_date} {pay} {probation} {notice} {location} {reporting_to} {hours}. Have a lawyer check the wording before you use it."));
  var ta = hrEl("textarea", "hr-tpl"); ta.value = s.contract_template || HR_DEFAULT_TEMPLATE; ta.style.marginTop = "8px"; bx.appendChild(ta);
  var row = hrEl("div", "hr-foot");
  var rs = hrEl("button", "btn", "Reset to the starting template"); rs.onclick = function () { ta.value = HR_DEFAULT_TEMPLATE; };
  var cl = hrEl("button", "btn", "Cancel"); cl.onclick = function () { ov.remove(); };
  var sv = hrEl("button", "btn save", "Save");
  sv.onclick = async function () {
    var r = await SUPA.rpc("hr_save_settings", { p_company: c, p_template: ta.value });
    if (r.error) { hrToast(hrErr(r.error)); return; }
    HR.settings = r.data; ov.remove(); hrToast("Saved");
  };
  row.append(rs, hrEl("div", "grow"), cl, sv); bx.appendChild(row); ov.appendChild(bx);
  document.body.appendChild(ov);
}

/* ---------- entry points ---------- */
// a link in My profile
function hrProfileLink() {
  var dlg = document.querySelector("#profile-overlay .dlg-body");
  if (!dlg || document.getElementById("hr-profile-link")) return;
  var box = hrEl("div", "hr-profile-link"); box.id = "hr-profile-link";
  box.appendChild(hrEl("span", null, "🗂️"));
  box.appendChild(hrEl("span", "grow", "Your HR details, documents and contract are in My HR file."));
  var b = hrEl("button", "btn save", "Open");
  b.onclick = function () { var o = document.getElementById("profile-overlay"); if (o) o.classList.remove("show"); openMyHrFile(); };
  box.appendChild(b);
  dlg.insertBefore(box, dlg.firstChild);
}
// ?hr=1 (the contract email's button) opens the file once someone is signed in;
// otherwise a gentle reminder once a day until it is submitted
(function () {
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    if (tries > 240) { clearInterval(t); return; }
    if (!hrMe() || !SUPA) return;
    clearInterval(t);
    hrProfileLink();
    var wants = false; try { wants = new URL(location.href).searchParams.get("hr") === "1"; } catch (_) { }
    if (wants) { openMyHrFile(); return; }
    SUPA.from("hr_records").select("status").eq("user_id", hrMe().id).maybeSingle().then(function (r) {
      if (r.error) return;
      var st = r.data && r.data.status;
      if (st && st !== "draft" && st !== "changes" && st !== "contract_sent") return;
      var key = "hr-nudge-" + new Date().toISOString().slice(0, 10);
      try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch (_) { }
      hrToast(st === "contract_sent" ? "✍️ Your contract is waiting: account menu → My HR file" : st === "changes" ? "🗂️ HR asked for changes to your HR file" : "🗂️ Please fill in your HR file: account menu → My HR file");
    });
  }, 500);
})();

// Administration → 🪪 My HR file: the same file, reachable from the admin sidebar too
function renderAdminMyHr(wrap) {
  var head = hrEl("div", "module-head"); head.appendChild(hrEl("h2", null, "My HR file")); wrap.appendChild(head);
  var card = hrEl("div", "hr-profile-link"); card.style.maxWidth = "640px";
  card.appendChild(hrEl("span", null, "🗂️"));
  var txt = hrEl("span", "grow", "Your personal details, documents and work contract. Loading…"); card.appendChild(txt);
  var b = hrEl("button", "btn save", "Open my HR file"); b.onclick = function () { openMyHrFile(); }; card.appendChild(b);
  wrap.appendChild(card);
  var me = hrMe(); if (!me || !SUPA) return;
  SUPA.from("hr_records").select("status").eq("user_id", me.id).maybeSingle().then(function (r) {
    var st = (r.data && r.data.status) || "none";
    txt.textContent = "Your personal details, documents and work contract. Status: " + (HR_STATUS[st] || HR_STATUS.none)[0] + ".";
  });
}
