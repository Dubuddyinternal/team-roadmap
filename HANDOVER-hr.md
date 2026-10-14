# HR files: handover notes

## What it does

| Who | Where | What |
|---|---|---|
| Every teammate | Account menu → **🗂️ My HR file** (also linked at the top of 👤 My profile) | Fills in their details step by step, uploads documents, ticks the consent box and presses **Submit to HR**. Everything saves as they type. |
| HR | **Administration → 🗂️ Employees (HR)** | Sees everyone in the team with a progress bar and a status. Opens a person to read their details, open and approve or reject documents, and fill in the job terms. Then previews the contract and emails it. |
| Teammate | Email + **My HR file → ✍️ Contract** | Reads the contract, prints and signs it, uploads the signed copy, and presses **I've uploaded it**. |
| HR | Employees (HR) → the person | Checks the signed copy and presses **✅ Mark complete**. |

**Status order:** Not started → Filling in → Waiting for HR → Contract sent → Signed, to check → Complete.
HR can **↩️ Send back with a note** at any point. The person then sees the note and can edit again.

**Who counts as HR:**
- super-admins (Sumit)
- owners
- any role with the new **Manage HR files** permission (Administration → Roles & permissions)

HR only sees people in teams where they have that permission.

**🔔 Bells:**
- HR gets one when someone submits or uploads a signed contract.
- The person gets one when a document is rejected, the file is sent back, the contract is sent, or the file is complete.
- People who haven't submitted get a small reminder once a day when they open the site.

## What we collect

**Details:**
- **About you:** name as on Aadhaar, date of birth, gender, marital status, blood group, nationality, mobile, personal email
- **Family:** father's, mother's and spouse's names
- **Emergency contacts:** two
- **Address:** current and permanent
- **ID:** Aadhaar (the checksum is verified), PAN, passport, UAN
- **Bank:** holder, bank, account number (typed twice), IFSC
- **Education and last job**

**Documents:**
- **Required:** photo, Aadhaar, PAN, bank proof (a cancelled cheque or passbook)
- **Optional:** address proof, education certificate, last job's documents, anything else

Files can be PDF, JPG, PNG or WEBP, up to 10 MB each.

## Privacy

- **Database:** none of this is in `profiles` (every teammate can read that table). It lives in `hr_records` and `hr_documents`, which only the person and HR can read.
- **Files:** they go to the private `hr-docs` storage bucket, in a folder per person. HR opens them through links that expire after 2 minutes.
- **Hidden by default:** Aadhaar and bank account numbers are hidden on HR's screen until they press **Show**.
- **Locked after submit:** a person can't change details once submitted, unless HR sends the file back. Approved documents can't be deleted.

## One-time setup

1. **Database:** paste `supabase/stage18a_hr_files.sql` into Supabase → SQL editor → Run. It only adds things and is safe to run again.
2. **Email function:** in Supabase → Edge Functions, create **`hr-mail`** from `supabase/functions/hr-mail/index.ts`, with **Verify JWT ON**. It uses the same Zoho secrets as `idea-mail` (`SMTP_USER`, `SMTP_PASS`, optional `SMTP_HOST`, `MAIL_FROM`, `APP_URL`).
3. **Company and contract:** Sumit opens Administration → Employees (HR) → **⚙️ Company and contract template**, and fills in the registered address, the city for the courts clause, and who signs.
4. **Contract wording:** the starting template is a plain-English draft. **Have a lawyer or CA check it** before the first contract goes out. The wording can be edited on the same screen, and the placeholders are listed there.
5. **HR access (optional):** to let someone other than owners act as HR, tick **Manage HR files** on their role.

## Notes for the next developer

- **Front end:** `hr.js`, loaded after `monthly-feedback.js`. It adds its own styles. The admin section is registered in `adminSections()` in `index.html` (`k:"hr"`).
- **How data is written:** everything goes through `hr_save`, `hr_mark_signed`, `hr_admin_update`, `hr_review_doc` and `hr_save_settings` (security definer). The only direct writes are a person adding or removing their own `hr_documents` rows, which is limited by RLS.
- **Email link:** the contract email's button links to `?hr=1`, which opens My HR file after sign-in.
- **What gets stored:** the contract HTML is built in the browser from the template, the person's details and the job terms. It's stored on the record when sent, so the person always sees exactly what was emailed.
