/* =====================================================================
   HR files  (database: supabase/stage18a_hr_files.sql, email: supabase/functions/hr-mail)

   · Account menu → 🗂️ My HR file (also linked from 👤 My profile) — every
     teammate: personal details, family, emergency contacts, address, ID and
     bank details, education and past work, document uploads, consent and
     submit. Later: read the offer letter and sign it.
   · Administration → 🗂️ Employees (HR) — super-admins and roles with
     "Manage HR files": everyone's progress, every detail and document,
     approve / reject documents, send a file back with a note, job terms,
     preview and email the offer letter, mark the file complete. Super-admins
     also edit the company details and the contract template.

   Files go to the private "hr-docs" bucket under <user id>/…; HR opens them
   through short-lived signed links. Nothing here is stored in profiles.
   ===================================================================== */

var HR = { rec: null, docs: [], step: 0, dirty: false, saveTimer: null, settings: null, policies: [], signs: [], company: {} };

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
  { k: "policies", ico: "📜", lbl: "Company policies" },
  { k: "submit", ico: "✅", lbl: "Check and submit" },
  { k: "contract", ico: "✍️", lbl: "Offer letter" }
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
  contract_sent: ["Offer letter sent", "amber"],
  signed:        ["Signed, to check", "blue"],
  complete:      ["Complete", "green"]
};
var HR_JOB = [
  { k: "designation", lbl: "Designation", ph: "e.g. Content Creator" },
  { k: "department", lbl: "Department", ph: "e.g. Marketing" },
  { k: "employment_type", lbl: "Type", type: "select", opts: ["Full-time employee", "Intern", "Consultant / freelancer", "Part-time"] },
  { k: "joining_date", lbl: "Joining date", type: "date" },
  { k: "ctc", lbl: "Annual CTC (INR)", ph: "e.g. 12,00,000" },
  { k: "apl_days", lbl: "Leave during probation (APL days)", ph: "3" },
  { k: "probation", lbl: "Confirmed after", ph: "e.g. 4 months" },
  { k: "notice", lbl: "Notice during probation", ph: "e.g. 15 days" },
  { k: "location", lbl: "Work location", ph: "e.g. Delhi office / Remote" },
  { k: "reporting_to", lbl: "Reports to", ph: "e.g. Sumit" },
  { k: "hours", lbl: "Working hours", ph: "e.g. 10 am – 7 pm, Monday to Saturday" }
];
var HR_DEFAULT_TEMPLATE = [
  "# Appointment on Probation: Offer Letter",
  "Dear {full_name},\n{date}",
  "Congratulations! And welcome to {company_short}.",
  "This has reference to our recent discussions. We are pleased to offer you the position of \"{designation}\" as a probationer. Your annual CTC will be INR {ctc}/- p.a.",
  "1. Leaves: You shall be eligible for {apl_days} days of All Purpose Leave (APL) during your probation period, which can be availed in proportion to the number of months worked.\n2. Notice period: During probation, either party may terminate the service by giving {notice} written notice.\n3. Appointment letter: A detailed letter of appointment will be issued to you on your confirmation after {probation}, on completion of the probationary period with a satisfactory performance evaluation.",
  "{company_short} believes in and practises a pay-for-performance culture. Apart from the target compensation, you will also be entitled to various rewards, recognitions, incentives and training initiatives, as per company policy applicable from time to time. The Company is committed to investing in the careers of top performers by giving them significant organizational responsibilities over time.",
  "You are required to furnish copies of the following documents on the date of joining (you can upload them in My HR file):\na. Qualification (graduation, post-graduation, professional etc.).\nb. Proof of date of birth, 10th mark card.\nc. Experience (any document relating to previous employment, service certificate).\nd. Last compensation package (Form 16, salary slip or annual pay revision letter).\ne. Relieving letter from your previous employer.\nf. Address proof – Aadhaar card, ration card, voter ID, PAN, driving licence.\ng. Passport-size photos with a white background.",
  "## Note",
  "1. {company_short} has a zero-tolerance policy towards breach of our Code of Conduct.\n2. Neither {company_short} nor our associates charge any registration fee or placement fee for the service that we provide our employees. We request you to notify us on priority in case anyone from {company_short} or representing {company_short} (employee / external agency / freelancer) has contacted you to collect any such charges or promised you employment in lieu of such a fee.\n3. We do not engage or employ any individual who is less than 18 years old, and have a zero-tolerance policy towards any form of discrimination / workplace harassment / forced or bonded labour.\n4. We respect the privacy of every employee, and all data collected from our employees during the recruiting and onboarding process is governed by our data security and privacy policy. Your data is not shared with any external agency at any time during or after your employment with {company_short}, and is protected as per our policy guidelines. We reserve the right to share relevant data with our insurance vendors and banks only to open your salary account and cover you as per the insurance requirements, payroll processing vendors, and ID card vendors for procuring your ID card or business cards as required by the process.\n5. As part of your onboarding process, we do not collect any original documents or any form of documents or payment cheques as collateral for your commitment or guarantee of employment with {company_short}. We request, collect, document and process your data only through your joining kit and collect copies of all documents as per the onboarding document checklist, to validate the same and complete your background verification as per {company_short}'s requirements.\n6. If you come across any irregularities or suspect any breach of our policy guidelines, please report the same to HR.",
  "This letter of offer is valid subject to your joining us on {joining_date}. Kindly sign a copy of this letter and return it as a token of your acceptance.",
  "Thanks & Regards,\nFor {company}\n\n\n{signatory}\n{signatory_title}",
  "Accepted the offer and terms, and will report for duty on: ______________\n\nSignature: ______________________    Date: ______________"
].join("\n\n");

/* ---------- helpers ---------- */
function hrEl(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function hrEsc(s) { return (s == null ? "" : String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function hrErr(e) { return (e && (e.message || e.error_description)) || String(e || "unknown"); }
function hrDate(iso) { return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""; }
function hrSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
function hrMe() { return typeof currentUser === "function" ? currentUser() : null; }
function hrToast(m) {
  if (typeof toast !== "function") return;
  var t = document.getElementById("toast"); if (t) t.style.zIndex = "10050";   // above the admin page and HR dialogs
  toast(m);
}
// HR permissions (Roles & permissions): manage_hr acts on files, view_hr only reads them
function hrCan(perm) { var u = hrMe(); return !!u && (u.super || (typeof hasPerm === "function" && hasPerm(perm))); }
function hrIsAdmin() { return hrCan("manage_hr"); }
function hrCanView() { return hrCan("manage_hr") || hrCan("view_hr"); }
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
    + ".hr-pen{border:0;background:none;cursor:pointer;font-size:13px;padding:0 4px;margin-left:6px;opacity:.75}.hr-pen:hover{opacity:1}.hr-chg{margin-left:8px;font-size:10.5px;letter-spacing:0;text-transform:none}"
    + ".hr-open input,.hr-open select,.hr-open textarea{border-color:#2F8F4E !important;background:#fff !important}.hr-chgrow{margin-top:6px}.hr-chgno{font-size:12px;color:var(--muted);margin-top:4px}"
    + ".hr-done{text-align:center;padding:22px 16px;border:1px solid #BFE3C9;background:#EEF8F1;border-radius:14px;margin-top:6px}.hr-done .big{font-size:34px}.hr-done b{display:block;font-size:17px;margin:4px 0}.hr-done .h{color:var(--muted);font-size:13.5px}"
    + ".hr-wait{display:flex;flex-direction:column;gap:8px;margin-top:8px}.hr-wait .r{display:flex;gap:12px;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:12px;font-size:13.5px}"
    + ".hr-wait .r.now{border-color:#F5CDB6;background:var(--indigo-soft)}.hr-wait .n{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--line);font-weight:700;flex:none}.hr-wait .h{color:var(--muted);font-size:12.5px}"
    + ".hr-sig{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.hr-sig .pic{width:220px;height:76px;border:1.5px dashed var(--line-strong);border-radius:10px;background:#fff;display:grid;place-items:center;font-size:12.5px;color:var(--muted);overflow:hidden}"
    + ".hr-sig .pic img{max-width:200px;max-height:66px}"
    + ".hr-signgrid{display:flex;gap:18px;align-items:center;flex-wrap:wrap;justify-content:space-between}.hr-signgrid .meta{display:flex;flex-direction:column;align-items:flex-start;gap:4px;font-size:13.5px;order:2}"
    + ".hr-signgrid .pl{display:flex;gap:8px;align-items:center}.hr-signgrid .pl input{max-width:200px;margin:0;padding:6px 10px}"
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
  await hrLoadPolicies();
  await hrLoadChanges();
}
function hrClean(d) {
  var out = {};
  hrAllFields().forEach(function (f) { if (!f.noSave && d[f.k] != null && String(d[f.k]).trim() !== "") out[f.k] = d[f.k]; });
  return out;
}
async function hrSaveDraft(quiet) {
  if (!hrEditable(HR.rec)) return true;
  clearTimeout(HR.saveTimer);
  var d = HR.rec.details || {};
  var r = await SUPA.rpc("hr_save", { p_details: hrClean(d), p_submit: false, p_consent: false });
  if (r.error) { if (!quiet) hrToast("Couldn't save: " + hrErr(r.error)); return false; }
  // keep the details object the form is typing into; swapping it for the server's
  // copy made every edit after the first save land in an old object and get lost
  var keep = HR.rec.details; HR.rec = r.data; HR.rec.details = keep || r.data.details || {}; HR.dirty = false;
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
  return ins.data;
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

/* ---------- asking HR to change a locked detail ---------- */
function hrChangeOf(k) { return (HR.changes || []).filter(function (c) { return c.field === k; })[0] || null; }   // newest first
async function hrLoadChanges() {
  var me = hrMe(); if (!me) return;
  var r = await SUPA.from("hr_change_requests").select("*").eq("user_id", me.id).order("created_at", { ascending: false });
  HR.changes = r.error ? [] : (r.data || []);   // stage18e not run yet: no ✏️ requests
}
// the ✏️ next to a locked field, and what happens after asking
function hrChangeTools(f, label, inp, wrap, c, d) {
  if (HR.changes == null) return;
  var open = c && (c.status === "pending" || c.status === "approved");
  if (c && c.status === "pending") { label.appendChild(hrEl("span", "hr-chip hr-amber hr-chg", "Asked HR")); return; }
  if (c && c.status === "approved") {
    inp.disabled = false; wrap.classList.add("hr-open");
    label.appendChild(hrEl("span", "hr-chip hr-green hr-chg", "HR said yes"));
    var row = hrEl("div", "hr-chgrow");
    var sv = hrEl("button", "btn save", "Save change"); sv.type = "button";
    sv.onclick = async function () {
      var v = inp.value; if (f.fmt === "pan" || f.fmt === "ifsc") v = v.toUpperCase();
      var msg = hrCheck(f, v, d);
      if (msg) { hrToast(msg === "Required" ? "This can't be empty" : msg); inp.focus(); return; }
      sv.disabled = true;
      var r = await SUPA.rpc("hr_apply_change", { p_id: c.id, p_value: v });
      if (r.error) { hrToast(hrErr(r.error)); sv.disabled = false; return; }
      HR.rec = r.data; await hrLoadChanges(); hrToast("Changed. HR can see it."); hrRenderMine();
    };
    row.appendChild(sv); wrap.appendChild(row);
    return;
  }
  var pen = hrEl("button", "hr-pen", "✏️"); pen.type = "button"; pen.title = "Ask HR to change this"; pen.setAttribute("aria-label", "Ask HR to change " + f.lbl);
  pen.onclick = async function () {
    var why = await hrAsk("Change “" + f.lbl + "”?", "Why does it need to change? e.g. I moved to a new flat.", "Ask HR");
    if (!why) return;
    var r = await SUPA.rpc("hr_request_change", { p_field: f.k, p_label: f.lbl, p_reason: why });
    if (r.error) { hrToast(hrErr(r.error)); return; }
    await hrLoadChanges(); hrToast("Sent to HR. You'll get a 🔔 when they answer."); hrRenderMine();
  };
  label.appendChild(pen);
  if (c && c.status === "rejected" && !open) wrap.appendChild(hrEl("div", "hr-chgno", "HR said no" + (c.hr_note ? ": " + c.hr_note : "") + ". You can ask again."));
}

// HR: what this person asked to change, with Approve / Say no
var HR_SECRET = { aadhaar: 4, bank_account: 4 };
function hrRenderChangeCard(wrap, uid, canEdit) {
  var list = (HRA.changes && HRA.changes[uid]) || [];
  if (!list.length) return;
  var card = hrEl("div", "hr-card"); card.style.marginTop = "14px";
  card.appendChild(hrEl("h3", null, "✏️ Change requests"));
  var show = function (k, v) { if (v == null || v === "") return "—"; return HR_SECRET[k] ? hrMask(String(v).replace(/\s/g, ""), HR_SECRET[k]) : String(v); };
  list.slice(0, 12).forEach(function (c) {
    var row = hrEl("div", "hr-doc"), left = hrEl("div");
    left.appendChild(hrEl("div", "t", c.label));
    left.appendChild(hrEl("div", "h", "“" + c.reason + "” · " + hrDate(c.created_at)));
    var vals = c.status === "done" ? "Was: " + show(c.field, c.old_value) + " → now: " + show(c.field, c.new_value) : "Now: " + show(c.field, c.old_value);
    left.appendChild(hrEl("div", "h", vals));
    row.appendChild(left);
    var right = hrEl("div"); right.style.cssText = "display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end";
    if (c.status === "pending" && !canEdit) right.appendChild(hrEl("span", "hr-chip hr-amber", "Waiting for HR"));
    else if (c.status === "pending") {
      var no = hrEl("button", "btn", "Say no"), yes = hrEl("button", "btn save", "✓ Approve");
      var decide = async function (ok) {
        var note = null;
        if (!ok) { note = await hrAsk("Why not?", "e.g. Please send the new address proof to HR first.", "Say no"); if (!note) return; }
        yes.disabled = no.disabled = true;
        var r = await SUPA.rpc("hr_decide_change", { p_id: c.id, p_approve: ok, p_note: note });
        if (r.error) { hrToast(hrErr(r.error)); yes.disabled = no.disabled = false; return; }
        hrToast(ok ? "Approved. They can change it now." : "Told them no.");
        await hrLoadAll(); renderAdminPage();
      };
      no.onclick = function () { decide(false); }; yes.onclick = function () { decide(true); };
      right.append(no, yes);
    } else {
      var lbl = { approved: ["Approved, waiting for them", "amber"], rejected: ["Said no", "grey"], done: ["Changed · " + hrDate(c.done_at), "green"] }[c.status];
      right.appendChild(hrEl("span", "hr-chip hr-" + lbl[1], lbl[0]));
    }
    row.appendChild(right); card.appendChild(row);
  });
  wrap.appendChild(card);
}

/* ---------- contract ---------- */
function hrAddress(d, pre) {
  return [d[pre + "_line"], d[pre + "_city"], d[pre + "_state"], d[pre + "_pin"]].filter(function (x) { return x && String(x).trim(); }).join(", ");
}
// "4" → "4 months"; anything with words stays as typed
function hrUnit(v, unit) { v = String(v == null ? "" : v).trim(); return /^\d+$/.test(v) ? v + " " + unit + (v === "1" ? "" : "s") : v; }
function hrContractHtml(template, company, d, job, extra) {
  d = d || {}; job = job || {}; company = company || {};
  var v = {
    company_short: company.short || "Cyberflow", ctc: job.ctc || "[annual CTC]", apl_days: job.apl_days || "3",
    date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    company: company.name || "Cyberflow Tech Pvt Ltd", company_address: company.address || "[company address]",
    company_city: company.city || "[city]", signatory: company.signatory || "[signatory]", signatory_title: company.signatory_title || "Director",
    full_name: d.full_name || "[name]", father_name: d.father_name || "[father's name]",
    address: hrAddress(d, d.same_address || !d.perm_line ? "cur" : "perm") || "[address]",
    pan: (d.pan || "").toUpperCase(), email: d.personal_email || "", mobile: d.mobile || "",
    designation: job.designation || "[designation]", department: job.department || "[department]",
    employment_type: ({ "Full-time employee": "a full-time employee", "Intern": "an intern", "Consultant / freelancer": "a consultant", "Part-time": "a part-time employee" })[job.employment_type] || "[type]",
    joining_date: job.joining_date ? new Date(job.joining_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "[joining date]",
    pay: job.pay || "[pay]", probation: hrUnit(job.probation, "month") || "4 months", notice: hrUnit(job.notice, "day") || "15 days",
    location: job.location || "[work location]", reporting_to: job.reporting_to || "[manager]", hours: job.hours || "[working hours]"
  };
  Object.keys(extra || {}).forEach(function (k) { v[k] = extra[k]; });
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
  HR.step = step != null ? step : (st === "contract_sent" || st === "signed" || st === "complete") ? HR_STEPS.length - 1 : st === "submitted" ? hrStepIx("submit") : 0;
  hrRenderMine();
}
async function hrClosePage() {
  if (HR.dirty) { clearTimeout(HR.saveTimer); await hrSaveDraft(true); }
  var page = document.getElementById("hr-page"); if (page) page.style.display = "none";
  try { var u = new URL(location.href); if (u.searchParams.has("hr")) { u.searchParams.delete("hr"); history.replaceState(null, "", u.toString()); } } catch (_) { }
}
// every step shows; the offer letter one says "later" until HR sends it
function hrVisibleSteps() {
  return HR_STEPS.map(function (s, i) { return { s: s, i: i }; });
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
    shell.appendChild(hrEl("div", "hr-note info", "Thanks! HR is checking your file. You'll get a 🔔 and an email when your offer letter is ready. Your details are locked while HR checks them."));
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
    } else if (x.s.k === "policies") {
      var left = HR.policies.filter(function (p) { var st = hrPolicyState(p, HR.signs); return st === "todo" || st === "old"; }).length;
      if (HR.policies.length) b.appendChild(left ? hrEl("span", "todo", left + " to sign") : hrEl("span", "tick", "✓"));
    } else if (x.s.k === "contract") {
      var cs = rec.status;
      b.appendChild(cs === "contract_sent" ? hrEl("span", "todo", "to sign") : cs === "signed" || cs === "complete" ? hrEl("span", "tick", "✓") : hrEl("span", "todo", "later"));
    } else if (x.s.k === "docs") {
      var miss = HR_DOCS.filter(function (z) { return z.req && !hrDocsHave(HR.docs, z.k); }).length;
      b.appendChild(miss ? hrEl("span", "todo", miss + " left") : hrEl("span", "tick", "✓"));
    }
    b.onclick = async function () { if (editable && HR.dirty) await hrSaveDraft(false); HR.step = x.i; hrRenderMine(); };
    nav.appendChild(b);
  });
  grid.appendChild(nav);

  var card = hrEl("div", "hr-card");
  var step = HR_STEPS[HR.step];
  if (step.fields) hrRenderFields(card, step, d, editable);
  else if (step.k === "docs") hrRenderDocs(card, editable);
  else if (step.k === "submit") hrRenderSubmit(card, d, editable);
  else if (step.k === "policies") hrRenderPolicies(card, hrRenderMine);
  else hrRenderContract(card);

  if (step.k !== "contract") {
    var foot = hrEl("div", "hr-foot");
    var vis = hrVisibleSteps().map(function (x) { return x.i; }), at = vis.indexOf(HR.step);
    if (at > 0) { var back = hrEl("button", "btn", "← Back"); back.onclick = async function () { if (editable && HR.dirty) await hrSaveDraft(false); HR.step = vis[at - 1]; hrRenderMine(); }; foot.appendChild(back); }
    foot.appendChild(hrEl("div", "grow"));
    if (editable) { var sv = hrEl("span", "hr-saved", rec._new ? "" : "Saved"); sv.id = "hr-saved"; foot.appendChild(sv); }
    if (at < vis.length - 1 && step.k !== "submit") {
      var next = hrEl("button", "btn save", editable ? "Save and next →" : "Next →");
      next.onclick = async function () {
        if (editable) {
          next.disabled = true; next.textContent = "Saving…";
          if (!await hrSaveDraft(false)) { next.disabled = false; next.textContent = "Save and next →"; return; }
          hrToast("Saved ✓");
        }
        HR.step = vis[at + 1]; hrRenderMine(); page.scrollTop = 0;
      };
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
  card.appendChild(hrEl("div", "hint", editable ? "Fields marked * are needed. Press Save and next when this page is done." : "🔒 Your details are locked. To change one, press ✏️ next to it and HR will approve it."));
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
    var chg = editable || f.noSave ? null : hrChangeOf(f.k);
    if (!editable && !f.noSave) hrChangeTools(f, l, inp, wrap, chg, d);
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
    wrap.querySelectorAll(".hr-chgrow,.hr-chgno").forEach(function (x) { wrap.appendChild(x); });   // under the box
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
function hrStepIx(k) { return HR_STEPS.findIndex(function (z) { return z.k === k; }); }
function hrMissing(d) {
  var out = [];
  HR_STEPS.forEach(function (s, i) { (s.fields || []).forEach(function (f) { if (f.type !== "check" && hrCheck(f, d[f.k], d)) out.push({ step: i, txt: s.lbl + ": " + f.lbl + (hrCheck(f, d[f.k], d) === "Required" ? "" : " — " + hrCheck(f, d[f.k], d)) }); }); });
  HR_DOCS.forEach(function (x) { if (x.req && !hrDocsHave(HR.docs, x.k)) out.push({ step: hrStepIx("docs"), txt: "Upload: " + x.lbl }); });
  // every policy has to be signed before the file goes to HR
  (HR.policies || []).forEach(function (p) { var st = hrPolicyState(p, HR.signs); if (st === "todo" || st === "old") out.push({ step: hrStepIx("policies"), txt: "Sign: " + p.title }); });
  return out;
}
function hrRenderSubmit(card, d, editable) {
  card.appendChild(hrEl("h3", null, "✅ Check and submit"));
  if (!editable) {
    var done = hrEl("div", "hr-done");
    done.append(hrEl("div", "big", "🎉"), hrEl("b", null, "Submitted to HR" + (HR.rec.submitted_at ? " on " + hrDate(HR.rec.submitted_at) : "")),
      hrEl("div", "h", HR.rec.status === "submitted" ? "HR is checking your file now. You'll get a 🔔 and an email when your offer letter is ready." : "HR has your file."));
    card.appendChild(done);
    var nx = hrEl("button", "btn save", "See what happens next →"); nx.style.marginTop = "12px";
    nx.onclick = function () { HR.step = hrStepIx("contract"); hrRenderMine(); };
    card.appendChild(nx);
    return;
  }
  var miss = hrMissing(d);
  var warn = hrEl("div", "hr-note warn"); warn.hidden = true;
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
  var go = hrEl("button", "btn save", "Submit to HR");
  var say = function (m) { warn.textContent = m; warn.hidden = false; warn.scrollIntoView({ block: "nearest", behavior: "smooth" }); };
  go.onclick = async function () {
    if (miss.length) { say("You can't submit yet: " + miss.length + (miss.length === 1 ? " thing is" : " things are") + " still missing. Press any line above to fill it in."); return; }
    if (!cb.checked) { say("Please tick the box above first."); return; }
    warn.hidden = true;
    go.disabled = true; go.textContent = "Submitting…";
    await hrSaveDraft(true);
    var r = await SUPA.rpc("hr_save", { p_details: hrClean(HR.rec.details || {}), p_submit: true, p_consent: true });
    if (r.error) { say("Couldn't submit: " + hrErr(r.error)); go.disabled = false; go.textContent = "Submit to HR"; return; }
    HR.rec = r.data; hrToast("Submitted to HR ✅"); hrRenderMine();
  };
  foot.appendChild(go); card.append(warn, foot);
}
// the signature line under a signed offer letter
function hrOfferStamp(rec, docs, view, done) {
  var html = rec.contract_html || "";
  if (!rec.offer_sig_doc) { if (done) done(html); return html; }
  var put = function (img) { var h = html + hrSigBlock(rec.offer_signed_name || "", hrDate(rec.signed_at), rec.offer_place, img); if (view) view.innerHTML = h; if (done) done(h); return h; };
  var sd = (docs || []).find(function (z) { return z.id === rec.offer_sig_doc; });
  if (sd) hrImgData(sd.path).then(put).catch(function () { });
  return put(null);
}
function hrRenderContract(card) {
  var rec = HR.rec, st = rec.status;
  card.appendChild(hrEl("h3", null, "✍️ Your offer letter"));
  // not sent yet: say what happens and when
  if (st !== "contract_sent" && st !== "signed" && st !== "complete") {
    var sent = st === "submitted";
    card.appendChild(hrEl("div", "hint", "Your offer letter will show up here. This is how it gets to you:"));
    var steps = hrEl("div", "hr-wait");
    [[sent ? "✅" : "1", "Fill in your details, sign the company policies and press Submit", sent ? "Done" : "In Check and submit"],
     ["2", "HR adds your job terms and sends the offer letter", sent ? "HR is on it. You'll get a 🔔 and an email" : "After you submit"],
     ["3", "Read it here and sign it with your saved signature", "One click"]].forEach(function (x, i) {
      var r = hrEl("div", "r" + (sent && i === 1 ? " now" : !sent && i === 0 ? " now" : ""));
      var n = hrEl("span", "n", x[0]), t = hrEl("div"); t.append(hrEl("b", null, x[1]), hrEl("div", "h", x[2]));
      r.append(n, t); steps.appendChild(r);
    });
    card.appendChild(steps);
    if (!sent) { var go = hrEl("button", "btn save", "Go to Check and submit →"); go.style.marginTop = "12px"; go.onclick = function () { HR.step = hrStepIx("submit"); hrRenderMine(); }; card.appendChild(go); }
    return;
  }
  if (st === "complete") card.appendChild(hrEl("div", "hr-note ok", "Signed and checked. ✅"));
  else if (st === "signed") card.appendChild(hrEl("div", "hr-note info", "Thanks! You've signed it. HR is checking it now."));
  else card.appendChild(hrEl("div", "hint", "Sent to your email on " + hrDate(rec.contract_sent_at) + ". Read it, then sign it below."));
  var view = hrEl("div", "hr-contract"), html = rec.contract_html || "";
  view.innerHTML = html || "<p>No offer letter yet.</p>";
  card.appendChild(view);
  if (rec.offer_sig_doc) hrOfferStamp(rec, HR.docs, view, function (h) { html = h; });
  var row = hrEl("div", "hr-foot");
  var pr = hrEl("button", "btn", "🖨 Print or save as PDF"); pr.onclick = function () { hrPrint(html, "Offer letter"); };
  row.appendChild(pr); row.appendChild(hrEl("div", "grow"));
  card.appendChild(row);

  // sign with the saved signature
  if (st === "contract_sent") {
    var sign = hrEl("div", "hr-sec"); sign.appendChild(hrEl("h4", null, "Sign it"));
    var lab = hrEl("label", "hr-check"); var cb = hrEl("input"); cb.type = "checkbox";
    lab.append(cb, document.createTextNode("I have read this offer letter and I accept it."));
    var grid = hrEl("div", "hr-signgrid");
    var drawSig = function () { var old = grid.querySelector(".hr-sig"); var nb = hrSigBox(drawSig); if (old) old.replaceWith(nb); else grid.prepend(nb); };
    var meta = hrEl("div", "meta"), name = hrMyName();
    meta.appendChild(hrEl("div", null, "Name: ")).appendChild(hrEl("b", null, name || "Add it in About you"));
    meta.appendChild(hrEl("div", null, "Date: ")).appendChild(hrEl("b", null, hrDate(new Date().toISOString())));
    var pl = hrEl("input", "login-input"); pl.placeholder = "City"; pl.value = hrMyPlace(); pl.setAttribute("aria-label", "Place");
    var plr = hrEl("label", "pl"); plr.append(document.createTextNode("Place "), pl); meta.appendChild(plr);
    grid.appendChild(meta); drawSig();
    var sg = hrEl("button", "btn save", "✍️ Sign offer letter");
    sg.onclick = async function () {
      var sig = hrSigOf(HR.docs);
      if (!cb.checked) { hrToast("Tick the box first"); return; }
      if (!sig) { hrToast("Upload a photo of your signature first"); return; }
      if (pl.value.trim().length < 2) { hrToast("Add the place (your city)"); pl.focus(); return; }
      sg.disabled = true;
      var r = await SUPA.rpc("hr_sign_offer", { p_sig: sig.id, p_place: pl.value.trim() });
      if (r.error) { hrToast(hrErr(r.error)); sg.disabled = false; return; }
      HR.docs.forEach(function (z) { if (z.id === sig.id) z.status = "approved"; });
      HR.rec = r.data; hrToast("Signed. HR will check it."); hrRenderMine();
    };
    var f1 = hrEl("div", "hr-foot"); f1.append(hrEl("div", "grow"), sg);
    sign.append(lab, grid, f1);
    card.appendChild(sign);
  }
  if (rec.offer_sig_doc) return;   // signed online: no paper copy needed

  var signed = HR.docs.filter(function (z) { return z.kind === "contract"; });
  if (st !== "contract_sent" && !signed.length) return;
  var sec = hrEl("div", "hr-sec"); sec.appendChild(hrEl("h4", null, st === "contract_sent" ? "Or print it, sign every page and upload the signed copy" : "Signed copy"));
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
var HRA = { filter: "all", q: "", open: null, rows: null, docs: null, reveal: {}, policies: [], signs: {} };
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
  var pol = await SUPA.from("hr_policies").select("*").eq("active", true).order("position");
  HRA.policies = pol.error ? [] : (pol.data || []);
  HRA.signs = {};
  if (!pol.error) {
    var sg = await SUPA.from("hr_policy_signs").select("*").in("user_id", ids);
    (sg.data || []).forEach(function (x) { (HRA.signs[x.user_id] = HRA.signs[x.user_id] || []).push(x); });
  }
  HRA.changes = {};
  var ch = await SUPA.from("hr_change_requests").select("*").in("user_id", ids).order("created_at", { ascending: false });
  (ch.error ? [] : ch.data || []).forEach(function (x) { (HRA.changes[x.user_id] = HRA.changes[x.user_id] || []).push(x); });
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
  var h2 = hrEl("h2", null, "Employees"); head.appendChild(h2);
  wrap.appendChild(head);
  wrap.appendChild(hrEl("div", "hint", "Everyone fills in their own HR file from their profile menu → 🗂️ My HR file. Open a person to see their details, documents and policies" + (hrIsAdmin() ? ", and send their offer letter." : ".")));
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
    t.innerHTML = "<thead><tr><th>Person</th><th>Progress</th><th class='hide-s'>Documents</th><th class='hide-s'>Policies</th><th>Status</th><th class='hide-s'>Updated</th></tr></thead>";
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
      var need = HRA.policies.filter(function (p) { return p.needs_sign; });
      var signed = need.filter(function (p) { return hrPolicyState(p, HRA.signs[u.id]) === "done"; }).length;
      var c3b = hrEl("td", "hide-s", need.length ? signed + " of " + need.length + " signed" : "—");
      if (need.length && signed === need.length) c3b.style.color = "var(--done)";
      var c4 = hrEl("td"); c4.appendChild(hrChip(rec ? rec.status : "none"));
      var asks = (HRA.changes[u.id] || []).filter(function (x) { return x.status === "pending"; }).length;
      if (asks) { var ak = hrEl("span", "hr-chip hr-amber", "✏️ " + asks + " to answer"); ak.style.marginLeft = "6px"; c4.appendChild(ak); }
      var c5 = hrEl("td", "hide-s", rec ? hrDate(rec.updated_at) : "—");
      tr.append(c1, c2, c3, c3b, c4, c5);
      function go() { HRA.open = u.id; HRA.reveal = {}; renderAdminPage(); }
      tr.onclick = go; tr.onkeydown = function (e) { if (e.key === "Enter") go(); };
      tb.appendChild(tr);
    });
    if (!list.length) { var tr0 = hrEl("tr"), td0 = hrEl("td", null, "Nobody here."); td0.colSpan = 6; td0.style.color = "var(--muted)"; tr0.appendChild(td0); tb.appendChild(tr0); }
    t.appendChild(tb); holder.appendChild(t);
  }
  draw();
}

function hrRenderPerson(wrap, uid) {
  var u = hrUser(uid); if (!u) { HRA.open = null; renderAdminHr(wrap); return; }
  var rec = (HRA.rows && HRA.rows[uid]) || null, docs = (HRA.docs && HRA.docs[uid]) || [];
  var canEdit = hrIsAdmin();   // "HR: see employee files" only reads
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
  if (canEdit && acts.children.length) wrap.appendChild(acts);
  if (!canEdit) wrap.appendChild(hrEl("div", "hr-note info", "👀 You can see this file. Approving, sending back and offer letters need “HR: manage employee files”."));
  hrRenderChangeCard(wrap, uid, canEdit);

  var tl = hrEl("div", "hr-tl"); tl.style.margin = "12px 0 4px";
  [["Submitted", rec && rec.submitted_at], ["Offer letter sent", rec && rec.contract_sent_at], ["Signed", rec && rec.signed_at], ["Complete", rec && rec.completed_at]].forEach(function (x) {
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
      if (canEdit && z.status !== "approved") { var ap = hrEl("button", "hr-reveal", "Approve"); ap.onclick = function () { review("approved"); }; f.appendChild(ap); }
      if (canEdit && z.status !== "rejected") { var rj = hrEl("button", "hr-reveal", "Reject"); rj.style.color = "#C0362C"; rj.onclick = async function () { var n2 = await hrAsk("Why can't you accept it?", "e.g. Too blurry to read the number.", "Reject"); if (n2) review("rejected", n2); }; f.appendChild(rj); }
      files.appendChild(f);
    });
    left.appendChild(files); row.appendChild(left); dc.appendChild(row);
  });
  wrap.appendChild(dc);

  /* policies */
  if (HRA.policies.length) {
    var pc = hrEl("div", "hr-card"); pc.style.marginTop = "14px";
    pc.appendChild(hrEl("h3", null, "Company policies"));
    var mine = HRA.signs[uid] || [];
    HRA.policies.forEach(function (p) {
      var row = hrEl("div", "hr-doc"), left = hrEl("div");
      left.appendChild(hrEl("div", "t", p.title));
      var s = hrSignOf(p, mine), fl = hrEl("div", "hr-file"); fl.style.cssText = "background:none;padding:0;margin-top:4px";
      fl.appendChild(hrPolicyChip(p, mine));
      if (s) fl.appendChild(hrEl("span", null, "as “" + s.signed_name + "” · version " + s.version + (s.place ? " · " + s.place : "") + (s.method === "upload" ? " · signed copy" : s.method === "signature" ? " · signature" : " · typed name")));
      if (s && s.doc_id) {
        var doc = docs.find(function (z) { return z.id === s.doc_id; });
        if (doc) { var o = hrEl("button", "hr-reveal", "Open signed copy"); o.onclick = function () { hrOpenFile(doc.path); }; fl.appendChild(o); }
      } else if (s) {
        var v = hrEl("button", "hr-reveal", "View signed");
        v.onclick = function () { hrPolicyDialog(p, null, { signs: mine, details: (rec && rec.details) || {}, docs: docs, company: (HR.settings && HR.settings.company) || HR.company || {}, policies: HRA.policies, mine: false }); };
        fl.appendChild(v);
      }
      left.appendChild(fl); row.appendChild(left); pc.appendChild(row);
    });
    wrap.appendChild(pc);
  }

  /* job terms + contract */
  var jc = hrEl("div", "hr-card"); jc.style.marginTop = "14px";
  jc.appendChild(hrEl("h3", null, "Job terms and offer letter"));
  jc.appendChild(hrEl("div", "hint", "Fill these in, then preview the offer letter. It goes to " + u.email + "."));
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
  var msg = hrEl("span", "hr-saved");
  var note = function (t, bad) { msg.textContent = t; msg.style.color = bad ? "#B4321E" : ""; };
  var sj = hrEl("button", "btn", "Save job terms");
  sj.onclick = async function () {
    sj.disabled = true; note("Saving…");
    if (await act("save_job", { p_job: job })) note("✓ Saved at " + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    else note("Couldn't save. Try again.", true);
    sj.disabled = false;
  };
  var pv = hrEl("button", "btn save", "📄 Preview offer letter");
  pv.onclick = async function () {
    pv.disabled = true; note("Opening…");
    try {
      if (!await act("save_job", { p_job: job })) { note("Couldn't save the job terms. Try again.", true); return; }
      var s = HR.settings || await hrLoadSettings();
      var ready = rec && ["submitted", "contract_sent", "signed", "complete"].indexOf(rec.status) >= 0;
      hrContractDialog(u, hrContractHtml(s.contract_template, s.company, d, job), ready ? act : "waiting");
      note("");
    } catch (e) { note("Couldn't open the preview: " + hrErr(e), true); }
    finally { pv.disabled = false; }
  };
  jf.append(sj, msg, hrEl("div", "grow"), pv);
  if (rec && rec.contract_html) {
    var last = hrEl("button", "btn", rec.offer_sig_doc ? "See the signed offer letter" : "See the offer letter they got");
    last.onclick = function () { var dlg = hrContractDialog(u, hrOfferStamp(rec, docs, null, function (h) { if (dlg) dlg(h); }), null); };
    jf.insertBefore(last, pv);
  }
  if (!canEdit) {   // read only: show the terms, keep only "see the offer letter"
    box.querySelectorAll("input,select,textarea").forEach(function (x) { x.disabled = true; });
    [sj, msg, pv].forEach(function (x) { x.remove(); });
  }
  jc.appendChild(jf);
  wrap.appendChild(jc);
}
function hrContractDialog(u, html, act) {
  var ov = hrEl("div", "hr-ask"), bx = hrEl("div", "box"); bx.style.width = "min(820px,100%)"; ov.setAttribute("data-plain", "");
  // act === "waiting": a preview only; it can be sent once they submit their HR file
  var waiting = act === "waiting"; if (waiting) act = null;
  bx.appendChild(hrEl("h3", null, act || waiting ? "Offer letter for " + userDisplayName(u) : "Offer letter sent to " + userDisplayName(u)));
  if (waiting) bx.appendChild(hrEl("div", "hr-note warn", "This is a preview. You can email it once " + userDisplayName(u) + " submits their HR file. They're still filling it in, so details like their address and PAN may show as [brackets]."));
  if (act) bx.appendChild(hrEl("div", "hint", "Check every line. Anything in [brackets] is still missing — fill in the job terms or the company details first."));
  var view = hrEl("div", "hr-contract"); view.style.margin = "10px 0"; view.innerHTML = html; bx.appendChild(view);
  var row = hrEl("div", "hr-foot");
  var pr = hrEl("button", "btn", "🖨 Print / PDF"); pr.onclick = function () { hrPrint(html, "Offer letter — " + userDisplayName(u)); };
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
      ov.remove(); hrToast("Offer letter emailed to " + u.email);
      await hrLoadAll(); renderAdminPage();
    };
    row.appendChild(send);
  }
  bx.appendChild(row); ov.appendChild(bx);
  ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
  return function (h) { html = h; view.innerHTML = h; };   // swap in the signed version once its image loads
}
async function hrSettingsDialog() {
  var s = await hrLoadSettings();
  var c = Object.assign({}, s.company || {});
  var ov = hrEl("div", "hr-ask"), bx = hrEl("div", "box"); ov.setAttribute("data-plain", ""); bx.style.width = "min(820px,100%)"; bx.style.maxHeight = "92vh"; bx.style.overflowY = "auto";
  bx.appendChild(hrEl("h3", null, "Company details and offer letter template"));
  var box = hrEl("div", "hr-fields"); box.style.margin = "12px 0";
  [["name", "Company name"], ["short", "Short name used in policies (e.g. Cyberflow)"], ["address", "Registered address"], ["city", "City (for the courts clause)"], ["signatory", "Who signs for the company"], ["signatory_title", "Their title"], ["email", "HR email"]].forEach(function (x) {
    var w = hrEl("div", "field" + (x[0] === "address" ? " wide" : "")), id = "hr-c-" + x[0], l = hrEl("label", null, x[1]); l.htmlFor = id;
    var i = hrEl("input"); i.id = id; i.value = c[x[0]] || ""; i.oninput = function () { c[x[0]] = i.value; };
    w.append(l, i); box.appendChild(w);
  });
  bx.appendChild(box);
  bx.appendChild(hrEl("div", "hint", "Template: a blank line starts a new paragraph. # makes the title, ## a heading. Placeholders: {date} {company} {company_short} {company_address} {company_city} {signatory} {signatory_title} {full_name} {father_name} {address} {pan} {email} {mobile} {designation} {department} {employment_type} {joining_date} {ctc} {apl_days} {probation} {notice} {location} {reporting_to} {hours}. Have a lawyer check the wording before you use it."));
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
  box.appendChild(hrEl("span", "grow", "Your HR details, documents and offer letter are in My HR file."));
  var b = hrEl("button", "btn save", "Open");
  b.onclick = function () { var o = document.getElementById("profile-overlay"); if (o) o.classList.remove("show"); openMyHrFile(); };
  box.appendChild(b);
  dlg.insertBefore(box, dlg.firstChild);
}
// ?hr=1 (the offer letter email's button) opens the file once someone is signed in;
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
      hrToast(st === "contract_sent" ? "✍️ Your offer letter is waiting: account menu → My HR file" : st === "changes" ? "🗂️ HR asked for changes to your HR file" : "🗂️ Please fill in your HR file: account menu → My HR file");
    });
  }, 500);
})();

// Administration → 🪪 My HR file: the same file, reachable from the admin sidebar too
// Administration → HR → Company and offer letter ("HR: company details and offer letter")
function renderAdminHrSettings(wrap) {
  var head = hrEl("div", "module-head"); head.appendChild(hrEl("h2", null, "Company and offer letter")); wrap.appendChild(head);
  var card = hrEl("div", "hr-card"); card.style.maxWidth = "760px"; card.setAttribute("data-plain", "");
  card.appendChild(hrEl("div", "hint", "The company details and the offer letter wording used for every new offer letter and in the policies."));
  var kv = hrEl("div", "hr-kv"); kv.style.marginTop = "10px"; card.appendChild(kv);
  var ed = hrEl("button", "btn save", "✏️ Edit company details and offer letter"); ed.style.marginTop = "14px";
  ed.onclick = function () { hrSettingsDialog(); };
  card.appendChild(ed); wrap.appendChild(card);
  (HR.settings ? Promise.resolve(HR.settings) : hrLoadSettings()).then(function (s) {
    var c = (s && s.company) || {};
    [["Company", c.name], ["Short name", c.short], ["Address", c.address], ["City (courts)", c.city], ["Signs for the company", [c.signatory, c.signatory_title].filter(Boolean).join(", ")], ["HR email", c.email],
     ["Offer letter wording", s && s.contract_template ? "Customised" : "Standard template"]].forEach(function (x) {
      kv.append(hrEl("div", "k", x[0]), hrEl("div", "v", x[1] || "—"));
    });
  }).catch(function (e) { card.appendChild(hrEl("div", "hr-note warn", "Couldn't load: " + hrErr(e))); });
}
function renderAdminMyHr(wrap) {
  var head = hrEl("div", "module-head"); head.appendChild(hrEl("h2", null, "My HR file")); wrap.appendChild(head);
  var card = hrEl("div", "hr-profile-link"); card.style.maxWidth = "640px";
  card.appendChild(hrEl("span", null, "🗂️"));
  var txt = hrEl("span", "grow", "Your personal details, documents and offer letter. Loading…"); card.appendChild(txt);
  var b = hrEl("button", "btn save", "Open my HR file"); b.onclick = function () { openMyHrFile(); }; card.appendChild(b);
  wrap.appendChild(card);
  var me = hrMe(); if (!me || !SUPA) return;
  SUPA.from("hr_records").select("status").eq("user_id", me.id).maybeSingle().then(function (r) {
    var st = (r.data && r.data.status) || "none";
    txt.textContent = "Your personal details, documents and offer letter. Status: " + (HR_STATUS[st] || HR_STATUS.none)[0] + ".";
  });
}

/* =====================================================================
   3. COMPANY POLICIES  (database: supabase/stage18b_hr_policies.sql)
   Everyone reads each policy and signs it: by typing their name, or by
   uploading a signed copy. HR edits the library; "new version" asks
   everyone to sign again.
   ===================================================================== */
async function hrLoadPolicies() {
  var me = hrMe(); if (!me || !SUPA) return;
  var p = await SUPA.from("hr_policies").select("*").eq("active", true).order("position");
  if (p.error) { HR.policies = []; HR.signs = []; return; }   // stage18b not run yet: the step just stays empty
  var s = await SUPA.from("hr_policy_signs").select("*").eq("user_id", me.id);
  var c = await SUPA.rpc("hr_company");
  HR.policies = p.data || []; HR.signs = s.data || []; HR.company = (c && c.data) || {};
}
function hrSignOf(p, signs) {
  return (signs || []).filter(function (x) { return x.policy_id === p.id; }).sort(function (a, b) { return b.version - a.version; })[0] || null;
}
// todo | old (signed an earlier version) | done | read (no signature needed)
function hrPolicyState(p, signs) {
  if (!p.needs_sign) return "read";
  var s = hrSignOf(p, signs);
  return !s ? "todo" : s.version < p.version ? "old" : "done";
}
function hrPolicyChip(p, signs) {
  var st = hrPolicyState(p, signs), s = hrSignOf(p, signs);
  if (st === "done") return hrEl("span", "hr-chip hr-green", (s.method === "upload" ? "Signed copy uploaded · " : "Signed · ") + hrDate(s.signed_at));
  if (st === "old") return hrEl("span", "hr-chip hr-amber", "New version: sign again");
  if (st === "read") return hrEl("span", "hr-chip hr-grey", "Read only");
  return hrEl("span", "hr-chip hr-red", "To sign");
}
function hrPolicyList(policies) {
  return (policies || []).filter(function (x) { return x.slug !== "acknowledgement" && x.active !== false; })
    .map(function (x, i) { return (i + 1) + ". " + x.title; }).join("\n");
}
function hrPolicyHtml(p, d, company, policies) {
  d = Object.assign({}, d || {});
  if (!d.full_name && hrMe()) d.full_name = hrMe().name || "";
  return hrContractHtml(p.body, company, d, {}, { policy_list: hrPolicyList(policies) });
}
function hrMyName() { return ((HR.rec && HR.rec.details && HR.rec.details.full_name) || (hrMe() && hrMe().name) || "").trim(); }
function hrMyPlace() { var d = (HR.rec && HR.rec.details) || {}; return String(d.cur_city || d.perm_city || "").trim(); }
async function hrSign(p, name, place, sigId, docId) {
  var r = await SUPA.rpc("hr_policy_sign", { p_policy: p.id, p_name: name, p_place: place || null, p_sig: sigId || null, p_doc: docId || null });
  if (r.error) { hrToast(hrErr(r.error)); return false; }
  HR.signs = HR.signs.filter(function (x) { return !(x.policy_id === p.id && x.version === r.data.version); });
  HR.signs.push(r.data);
  if (sigId) HR.docs.forEach(function (z) { if (z.id === sigId) z.status = "approved"; });
  return true;
}

/* ---------- the saved signature ---------- */
// the newest signature photo in someone's documents
function hrSigOf(docs) {
  return (docs || []).filter(function (z) { return z.kind === "signature"; })
    .sort(function (a, b) { return String(b.uploaded_at).localeCompare(String(a.uploaded_at)); })[0] || null;
}
HR.sigImg = {};
// private file → data URL, so it shows in the page and in print without expiring
async function hrImgData(path) {
  if (HR.sigImg[path]) return HR.sigImg[path];
  var r = await SUPA.storage.from("hr-docs").download(path);
  if (r.error) throw r.error;
  var url = await new Promise(function (ok, bad) { var fr = new FileReader(); fr.onload = function () { ok(fr.result); }; fr.onerror = bad; fr.readAsDataURL(r.data); });
  return (HR.sigImg[path] = url);
}
// a phone photo of a signature on paper → a tidy PNG: paper made see-through, ink darkened, cropped
async function hrCleanSignature(file) {
  var src = URL.createObjectURL(file);
  try {
    var img = await new Promise(function (ok, bad) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { bad(new Error("Use a JPG or PNG photo")); }; i.src = src; });
    var k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
    var w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    var cx = cv.getContext("2d"); cx.drawImage(img, 0, 0, w, h);
    var px = cx.getImageData(0, 0, w, h), a = px.data, lum = new Uint8Array(w * h), hist = new Uint32Array(256);
    for (var i = 0; i < w * h; i++) { var L = Math.round(0.299 * a[i * 4] + 0.587 * a[i * 4 + 1] + 0.114 * a[i * 4 + 2]); lum[i] = L; hist[L]++; }
    var acc = 0, paper = 255;   // the paper is the brightest big part of the photo
    for (var v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= w * h * 0.4) { paper = v; break; } }
    var x0 = w, y0 = h, x1 = -1, y1 = -1, cut = paper * 0.72;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var j = y * w + x, al = Math.max(0, Math.min(1, (cut - lum[j]) / (cut * 0.45)));
      a[j * 4] = 20; a[j * 4 + 1] = 28; a[j * 4 + 2] = 70; a[j * 4 + 3] = Math.round(al * 255);
      if (al > 0.3) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0 || x1 - x0 < 20 || y1 - y0 < 6) throw new Error("We couldn't find a signature in that photo. Sign on plain white paper and try again.");
    cx.putImageData(px, 0, 0);
    var pad = 8; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
    var s = Math.min(1, 600 / (x1 - x0 + 1)), out = document.createElement("canvas");
    out.width = Math.round((x1 - x0 + 1) * s); out.height = Math.round((y1 - y0 + 1) * s);
    out.getContext("2d").drawImage(cv, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, out.width, out.height);
    var blob = await new Promise(function (ok) { out.toBlob(ok, "image/png"); });
    if (!blob) throw new Error("Couldn't read that photo");
    return new File([blob], "signature.png", { type: "image/png" });
  } finally { URL.revokeObjectURL(src); }
}
// pick a photo, clean it, save it to the profile; resolves to the new document or null
function hrPickSignature() {
  return new Promise(function (done) {
    var inp = hrEl("input"); inp.type = "file"; inp.accept = "image/*"; inp.hidden = true;
    document.body.appendChild(inp);   // some phones only open the picker for an input on the page
    inp.onchange = async function () {
      var f = inp.files[0]; inp.remove(); if (!f) return done(null);
      try { var png = await hrCleanSignature(f); done(await hrUpload("signature", png) || null); }
      catch (e) { hrToast(hrErr(e)); done(null); }
    };
    inp.click();
  });
}
// the line under a signed policy: signature, name, date, place
function hrSigBlock(name, when, place, img) {
  return '<div style="margin-top:26px;padding-top:14px;border-top:1px solid #d8d0c8;display:flex;gap:28px;flex-wrap:wrap;align-items:flex-end">'
    + '<div style="min-width:220px">' + (img ? '<img src="' + hrEsc(img) + '" alt="Signature" style="display:block;max-height:72px;max-width:260px;margin-bottom:2px">' : '<div style="height:40px"></div>')
    + '<div style="border-top:1px solid #333;padding-top:4px"><b>' + hrEsc(name) + '</b></div></div>'
    + '<div style="line-height:1.8">Date: <b>' + hrEsc(when) + '</b><br>Place: <b>' + hrEsc(place || "—") + '</b></div></div>';
}
// the "Your signature" box: shows the saved one, or asks for it
function hrSigBox(onChange) {
  var box = hrEl("div", "hr-sig"), sig = hrSigOf(HR.docs);
  var pic = hrEl("div", "pic");
  if (sig) {
    pic.textContent = "Loading…";
    hrImgData(sig.path).then(function (u) { pic.textContent = ""; var im = hrEl("img"); im.src = u; im.alt = "Your signature"; pic.appendChild(im); })
      .catch(function () { pic.textContent = "Couldn't load it"; });
  } else pic.appendChild(hrEl("span", null, "✍️ No signature yet"));
  var btn = hrEl("button", "btn" + (sig ? "" : " save"), sig ? "Change" : "📷 Upload a photo of your signature"); btn.type = "button";
  btn.onclick = async function () {
    btn.disabled = true; btn.textContent = "Saving…";
    var d = await hrPickSignature();
    if (d) hrToast("Signature saved to your profile");
    if (onChange) onChange(d); else { btn.disabled = false; btn.textContent = sig ? "Change" : "📷 Upload a photo of your signature"; }
  };
  box.append(pic, btn);
  return box;
}
function hrRenderPolicies(card, rerender) {
  card.appendChild(hrEl("h3", null, "📜 Company policies"));
  card.appendChild(hrEl("div", "hint", "Read each policy and press Sign. Your saved signature, name, date and place are added for you. Or print it, sign it and upload the signed copy."));
  if (!HR.policies.length) { card.appendChild(hrEl("div", "hr-note info", "HR hasn't added the policies yet.")); return; }
  var mySig = hrEl("div", "hr-doc"), ms = hrEl("div");
  ms.append(hrEl("div", "t", "Your signature"), hrEl("div", "h", "Sign on plain white paper and take a clear photo. It's saved to your profile, so you only do this once."));
  mySig.append(ms, hrSigBox(function () { rerender(); }));
  card.appendChild(mySig);
  var need = HR.policies.filter(function (p) { return p.needs_sign; });
  var done = need.filter(function (p) { return hrPolicyState(p, HR.signs) === "done"; }).length;
  var top = hrEl("div", "hr-mini"); top.style.margin = "4px 0 10px";
  var bar = hrEl("div", "hr-bar"), f = hrEl("i"); f.style.width = (need.length ? Math.round(done * 100 / need.length) : 100) + "%"; bar.appendChild(f);
  top.append(bar, hrEl("span", "hr-pct", done + " of " + need.length + " signed"));
  card.appendChild(top);
  HR.policies.forEach(function (p) {
    var row = hrEl("div", "hr-doc"), left = hrEl("div");
    var t = hrEl("div", "t", p.title); left.appendChild(t);
    left.appendChild(hrEl("div", "h", [p.code, "version " + p.version].filter(Boolean).join(" · ")));
    var line = hrEl("div", "hr-files"), fl = hrEl("div", "hr-file"); fl.style.background = "none"; fl.style.padding = "0";
    fl.appendChild(hrPolicyChip(p, HR.signs));
    var s = hrSignOf(p, HR.signs);
    if (s && s.doc_id) {
      var doc = HR.docs.find(function (z) { return z.id === s.doc_id; });
      if (doc) { var o = hrEl("button", "n", "Open signed copy"); o.type = "button"; o.onclick = function () { hrOpenFile(doc.path); }; fl.appendChild(o); }
    }
    line.appendChild(fl); left.appendChild(line);
    row.appendChild(left);
    var acts = hrEl("div"); acts.style.cssText = "display:flex;flex-direction:column;gap:6px;align-items:stretch";
    var st = hrPolicyState(p, HR.signs);
    var rd = hrEl("button", "btn" + (st === "todo" || st === "old" ? " save" : ""), st === "todo" || st === "old" ? "Read and sign" : "Read");
    rd.onclick = function () { hrPolicyDialog(p, rerender); };
    acts.appendChild(rd);
    if (p.needs_sign) {
      var inp = hrEl("input"); inp.type = "file"; inp.accept = "application/pdf,image/jpeg,image/png,image/webp"; inp.hidden = true;
      var up = hrEl("button", "btn", "Upload signed copy"); up.onclick = function () { inp.click(); };
      inp.onchange = async function () {
        var file = inp.files[0]; if (!file) return;
        var name = hrMyName();
        if (name.length < 2) { hrToast("Add your full name in About you first"); return; }
        up.disabled = true; up.textContent = "Uploading…";
        var docRow = await hrUpload("policy", file);
        if (docRow && await hrSign(p, name, hrMyPlace(), null, docRow.id)) hrToast("Signed copy saved");
        rerender();
      };
      acts.append(up, inp);
    }
    row.appendChild(acts);
    card.appendChild(row);
  });
}
// read a policy and sign it. ctx is for HR looking at someone else's (read only)
function hrPolicyDialog(p, after, ctx) {
  ctx = ctx || { signs: HR.signs, details: HR.rec && HR.rec.details, docs: HR.docs, company: HR.company, policies: HR.policies, mine: true };
  var html = hrPolicyHtml(p, ctx.details, ctx.company, ctx.policies);
  var ov = hrEl("div", "hr-ask"), bx = hrEl("div", "box"); ov.setAttribute("data-plain", "");
  bx.style.cssText = "width:min(860px,100%);max-height:94vh;display:flex;flex-direction:column";
  var head = hrEl("div", "hr-top"); head.style.margin = "0";
  var h = hrEl("h3", null, p.title); h.style.flex = "1"; head.append(h, hrPolicyChip(p, ctx.signs));
  bx.appendChild(head);
  var view = hrEl("div", "hr-contract"); view.style.cssText = "margin:10px 0;flex:1;max-height:none;min-height:0"; view.innerHTML = html;
  bx.appendChild(view);
  var st = hrPolicyState(p, ctx.signs), s = hrSignOf(p, ctx.signs);
  // already signed: stamp the page with the signature that was used
  if (s && s.method !== "upload") {
    var sd = s.sig_doc && (ctx.docs || []).find(function (z) { return z.id === s.sig_doc; });
    var stamp = function (img) { html = hrPolicyHtml(p, ctx.details, ctx.company, ctx.policies) + hrSigBlock(s.signed_name, hrDate(s.signed_at), s.place, img); view.innerHTML = html; };
    stamp(null);
    if (sd) hrImgData(sd.path).then(stamp).catch(function () { });
  }
  var canSign = ctx.mine && p.needs_sign && st !== "done";
  if (canSign) {
    var sign = hrEl("div"); sign.style.cssText = "display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--line);padding-top:10px";
    var lab = hrEl("label", "hr-check"); var cb = hrEl("input"); cb.type = "checkbox";
    lab.append(cb, document.createTextNode("I have read and understood this policy, and I agree to follow it."));
    var grid = hrEl("div", "hr-signgrid");
    var drawSig = function () { var old = grid.querySelector(".hr-sig"); var nb = hrSigBox(drawSig); if (old) old.replaceWith(nb); else grid.prepend(nb); };
    var meta = hrEl("div", "meta");
    var name = hrMyName();
    meta.appendChild(hrEl("div", null, "Name: ")).appendChild(hrEl("b", null, name || "Add it in About you"));
    meta.appendChild(hrEl("div", null, "Date: ")).appendChild(hrEl("b", null, hrDate(new Date().toISOString())));
    var pl = hrEl("input", "login-input"); pl.placeholder = "City"; pl.value = hrMyPlace(); pl.setAttribute("aria-label", "Place");
    var plr = hrEl("label", "pl"); plr.append(document.createTextNode("Place "), pl); meta.appendChild(plr);
    grid.appendChild(meta); drawSig();
    sign.append(lab, grid); bx.appendChild(sign);
  }
  var row = hrEl("div", "hr-foot");
  var pr = hrEl("button", "btn", "🖨 Print or save as PDF"); pr.onclick = function () { hrPrint(html, p.title); };
  var cl = hrEl("button", "btn", "Close"); cl.onclick = function () { ov.remove(); };
  row.append(pr, hrEl("div", "grow"), cl);
  if (canSign) {
    var go = hrEl("button", "btn save", "✍️ Sign");
    go.onclick = async function () {
      var sig = hrSigOf(HR.docs);
      if (!cb.checked) { hrToast("Tick the box first"); return; }
      if (name.length < 2) { hrToast("Add your full name in My HR file → About you first"); return; }
      if (!sig) { hrToast("Upload a photo of your signature first"); return; }
      if (pl.value.trim().length < 2) { hrToast("Add the place (your city)"); pl.focus(); return; }
      go.disabled = true;
      if (await hrSign(p, name, pl.value.trim(), sig.id, null)) { ov.remove(); hrToast("Signed: " + p.title); if (after) after(); }
      else go.disabled = false;
    };
    row.appendChild(go);
  }
  bx.appendChild(row); ov.appendChild(bx);
  ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
}
// Administration → 📜 Company policies (everyone)
function renderAdminPolicies(wrap) {
  var head = hrEl("div", "module-head"); head.appendChild(hrEl("h2", null, "Company policies"));
  if (hrCan("manage_policies")) {
    head.style.cssText += ";display:flex;align-items:center;gap:10px;flex-wrap:wrap";
    var pm = hrEl("button", "btn", "✏️ Add or edit policies"); pm.style.marginLeft = "auto"; pm.onclick = function () { hrPolicyManager(); }; head.appendChild(pm);
  }
  wrap.appendChild(head);
  var card = hrEl("div", "hr-card"); card.style.maxWidth = "880px"; card.setAttribute("data-plain", "");
  card.appendChild(hrEl("div", "hint", "Loading…")); wrap.appendChild(card);
  function draw() { card.innerHTML = ""; hrRenderPolicies(card, draw); }
  hrLoadMine().then(draw).catch(function (e) { card.innerHTML = ""; card.appendChild(hrEl("div", "hr-note warn", "Couldn't load the policies: " + hrErr(e))); });
}

/* ---------- HR: the policy library ---------- */
async function hrPolicyManager() {
  var r = await SUPA.from("hr_policies").select("*").order("position");
  if (r.error) { hrToast("Run supabase/stage18b_hr_policies.sql first (" + hrErr(r.error) + ")"); return; }
  var list = r.data || [];
  var ov = hrEl("div", "hr-ask"), bx = hrEl("div", "box"); ov.setAttribute("data-plain", "");
  bx.style.cssText = "width:min(760px,100%);max-height:92vh;overflow-y:auto";
  bx.appendChild(hrEl("h3", null, "📜 Policies"));
  bx.appendChild(hrEl("div", "hint", "Everyone in the team sees the active ones in My HR file → Company policies. Open one to change its wording."));
  list.forEach(function (p) {
    var row = hrEl("div", "hr-doc"), left = hrEl("div");
    left.appendChild(hrEl("div", "t", p.title + (p.active ? "" : " (hidden)")));
    left.appendChild(hrEl("div", "h", [p.code, "version " + p.version, p.needs_sign ? "needs a signature" : "read only"].filter(Boolean).join(" · ")));
    var ed = hrEl("button", "btn", "Edit"); ed.onclick = function () { ov.remove(); hrPolicyEditor(p); };
    row.append(left, ed); bx.appendChild(row);
  });
  var foot = hrEl("div", "hr-foot");
  var add = hrEl("button", "btn save", "＋ New policy"); add.onclick = function () { ov.remove(); hrPolicyEditor(null); };
  var cl = hrEl("button", "btn", "Close"); cl.onclick = function () { ov.remove(); };
  foot.append(add, hrEl("div", "grow"), cl); bx.appendChild(foot);
  ov.appendChild(bx); document.body.appendChild(ov);
}
function hrPolicyEditor(p) {
  var isNew = !p; p = p || { title: "", code: "", body: "# New policy\n\nWrite the policy here.", needs_sign: true, active: true, position: 60, version: 1 };
  var ov = hrEl("div", "hr-ask"), bx = hrEl("div", "box"); ov.setAttribute("data-plain", "");
  bx.style.cssText = "width:min(880px,100%);max-height:94vh;overflow-y:auto";
  bx.appendChild(hrEl("h3", null, isNew ? "New policy" : "Edit: " + p.title));
  var box = hrEl("div", "hr-fields"); box.style.margin = "10px 0";
  function fld(label, el, wide) { var w = hrEl("div", "field" + (wide ? " wide" : "")), l = hrEl("label", null, label); w.append(l, el); box.appendChild(w); return el; }
  var ti = fld("Title", Object.assign(hrEl("input"), { value: p.title }));
  var co = fld("Code (optional)", Object.assign(hrEl("input"), { value: p.code, placeholder: "e.g. HR/WS/Ver1.0" }));
  var po = fld("Order in the list", Object.assign(hrEl("input"), { type: "number", value: p.position }));
  var opts = hrEl("div"); opts.style.cssText = "display:flex;flex-direction:column;gap:6px;justify-content:center";
  var ns = hrEl("input"); ns.type = "checkbox"; ns.checked = p.needs_sign; var l1 = hrEl("label", "hr-check"); l1.append(ns, document.createTextNode("Everyone must sign it"));
  var ac = hrEl("input"); ac.type = "checkbox"; ac.checked = p.active; var l2 = hrEl("label", "hr-check"); l2.append(ac, document.createTextNode("Show it to the team"));
  opts.append(l1, l2); fld("Options", opts);
  bx.appendChild(box);
  bx.appendChild(hrEl("div", "hint", "A blank line starts a new paragraph. # makes the title, ## a heading. Placeholders: {company} {company_short} {full_name} {date} {policy_list} (the list of all other policies)."));
  var ta = hrEl("textarea", "hr-tpl"); ta.value = p.body; ta.style.marginTop = "8px"; bx.appendChild(ta);
  var foot = hrEl("div", "hr-foot");
  var pv = hrEl("button", "btn", "Preview");
  pv.onclick = function () { hrPolicyDialogPreview(Object.assign({}, p, { title: ti.value, body: ta.value })); };
  var cl = hrEl("button", "btn", "Cancel"); cl.onclick = function () { ov.remove(); hrPolicyManager(); };
  foot.append(pv, hrEl("div", "grow"), cl);
  async function save(newVersion) {
    if (!ti.value.trim()) { hrToast("Give it a title"); return; }
    var slug = isNew ? ti.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || ("policy-" + Date.now().toString(36)) : p.slug;
    var r = await SUPA.rpc("hr_save_policy", { p_id: isNew ? null : p.id, p_slug: slug, p_title: ti.value.trim(), p_code: co.value.trim(), p_body: ta.value,
      p_needs_sign: ns.checked, p_position: parseInt(po.value, 10) || 100, p_active: ac.checked, p_new_version: !!newVersion });
    if (r.error) { hrToast(hrErr(r.error)); return; }
    ov.remove(); hrToast(newVersion ? "Saved as version " + r.data.version + ". Everyone will be asked to sign again" : "Saved");
    hrPolicyManager();
  }
  var sv = hrEl("button", "btn save", "Save"); sv.onclick = function () { save(false); };
  foot.appendChild(sv);
  if (!isNew && p.needs_sign) {
    var nv = hrEl("button", "btn", "Save as a new version"); nv.title = "Everyone signs it again";
    nv.onclick = function () { save(true); };
    foot.insertBefore(nv, sv);
  }
  bx.appendChild(foot); ov.appendChild(bx); document.body.appendChild(ov);
}
function hrPolicyDialogPreview(p) {
  var html = hrContractHtml(p.body, HR.settings ? HR.settings.company : HR.company, { full_name: "[their name]" }, {}, { policy_list: "1. Work Systems Policy\n2. Leave Policy\n3. …" });
  var ov = hrEl("div", "hr-ask"), bx = hrEl("div", "box"); bx.style.width = "min(820px,100%)";
  bx.appendChild(hrEl("h3", null, "Preview: " + p.title));
  var view = hrEl("div", "hr-contract"); view.style.margin = "10px 0"; view.innerHTML = html; bx.appendChild(view);
  var c = hrEl("button", "btn", "Close"); c.onclick = function () { ov.remove(); }; bx.appendChild(c);
  ov.appendChild(bx); ov.style.zIndex = "9600"; document.body.appendChild(ov);
}
