# Accounts — handover

Payment requests, payroll and bank files, in Administration. Built on top of the HR file (bank details, CTC).

## What it does

- **👤 For me → 💸 My payments (everyone):** "＋ Ask for a payment".
  - **🧾 I already paid** (reimbursement): attach the bill. It's paid back to the bank account in the person's HR file.
  - **🤝 Pay someone** (vendor payment, e.g. an influencer): add their name and UPI ID, or account number and IFSC, plus the invoice.
  - The person sees each request's status, and their paid salaries.
- **💰 Accounts → Payment requests:**
  - Tabs: To approve, To pay, Paid, Not approved, All.
  - Approve, or Reject with a reason.
  - In **To pay**, select rows → **Download bank file** (CSV for a bulk upload) → pay from the bank → **Mark paid** with the date and UTR.
  - The requester gets a 🔔 at each step.
- **💰 Accounts → Payroll:**
  - Pick a month → **Fill from HR**: each person's CTC ÷ 12 from HR → Employees → job terms, plus approved reimbursements waiting to be paid.
  - Edit bonus, deductions and notes while in draft.
  - **Approve** → **Download bank file** → pay → **Mark paid**. This also settles the reimbursements included, and everyone gets a 🔔.
- **Bank file columns:** Beneficiary name, Account number, IFSC, Bank, UPI ID, Amount, Payment mode (NEFT / RTGS over ₹2 lakh / UPI), Narration, Email. Rearrange the columns to match your bank's bulk template.

- **💰 Accounts → 📊 Overview:** pick a month.
  - Cards: total payments, then paid / to pay / waiting for approval.
  - A table splits it by Salaries, Bonuses, Reimbursements and Vendor payments.
  - Salaries and bonuses come from that month's payroll. Reimbursements and vendor payments show everything still waiting or to pay, plus what was paid that month.
- **💰 Accounts → 🎯 Bonuses:** a bonus per person and month, as a fixed amount or a count × rate (e.g. 40 sales × ₹200).
  - **Approve** it, and it goes into that month's payroll when you fill or refresh it (`acc_payroll_fill`).
  - It's marked paid with the salary, by a trigger on `acc_payroll`.
  - Database: `supabase/stage19b_accounts_bonuses.sql`.

## Who can use it

- **Permission "Accounts: payments & payroll"** (`accounts`) in Roles & permissions. It includes seeing people's bank details. Owners and super-admins have it.
- Everyone can ask for payments and sees only their own.

## Database

- `supabase/stage19a_accounts.sql`:
  - Tables: `acc_requests`, `acc_files` (private bucket `acc-docs`), `acc_payroll`.
  - Functions: `acc_request_create / cancel`, `acc_decide`, `acc_mark_paid`, `acc_payroll_fill / save / status`, `acc_bank_rows`.
- Everything is written through these functions. People can only read their own rows unless they have the Accounts permission.

## Zoho Books (stage 19c)

When a payment request or a payroll month is marked paid, the page calls the Edge Function **`zoho-sync`** (Verify JWT ON; it checks the Accounts permission). The function writes to Zoho Books India (org 60041846412). The payment itself is still made from PNB by hand.

- **Secrets** (Supabase → Edge Functions → Secrets):
  - `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` (scope `ZohoBooks.fullaccess.all`, from accounts.zoho.in).
  - `ZOHO_DRY_RUN`. Unset or anything other than `false` means **dry run**: payloads are only logged in `acc_zoho_log`, and rows show "Zoho: dry run". Set it to `false` to go live. Rows still in dry run get posted on the next Retry.
- **Accounts:** the exact account names are listed in the function (`ACCOUNTS`). Their ids are fetched once (Accounts → Monthly checks → **Fetch Zoho accounts**) into `acc_zoho_settings`, along with the taxes IGST18 / GST18. Accounts are never created from code.
- **Posting rules:**
  - **A. Payroll:** one journal per run, `TOOLS-PAYROLL-YYYY-MM`. Dr Salaries and Employee Wages (one line per person, salary − deductions), Dr Diwali Bonus for bonuses, Cr TDS Payable, Cr bank (net). Reimbursements paid with salaries are posted under rule B. A March salary paid in April shows a warning.
  - **B. Reimbursement:** an expense (category account, via Employee Reimbursements, tax-inclusive, `TOOLS-<n>`, with the receipt), then a journal Dr Employee Reimbursements / Cr bank. That journal is one per person + UTR, with one line per request. If paid from an imprest, the expense goes through that imprest and there's no bank journal.
  - **C. Vendor:** an expense via "paid from". If there's TDS, a journal instead: Dr category (gross) / Cr TDS Payable / Cr bank (net). That journal's reference is `TOOLS-<n>`, with the UTR in the notes, so the duplicate check stays exact.
  - **D. Card spend:** a vendor payment with paid from = Pancham Imprest becomes an expense through Pancham Imprest, with no bank journal. `source = 'tools'` lets the card-statement import skip it.
  - **E. Advance** ("💼 I need an advance"): a journal Dr <imprest> / Cr bank.
  - **F. Assets** (Computer, Furniture and Equipment): **not automated**. The row is marked "Zoho: enter by hand", because Zoho needs a bill with a vendor contact.
  - **GST:** only when "the bill shows our GSTIN" is ticked with the seller's GSTIN. Same state (06) uses GST18, otherwise IGST18. Place of supply comes from the GSTIN's first two digits.
- **Duplicates and retry:**
  - The Zoho ids are saved on each row and run (`zoho_ids`). Before creating anything, the function also searches Zoho by reference.
  - Failed rows show the error and a **↻ Retry**. Paid is never undone, and a synced row can't be edited.
- **Monthly checks:** paid this month by Zoho account, rows not yet in Zoho (with Retry all), TDS deducted this month (deposit by the 7th, challan 281), 194C / 194J limits crossed without TDS, and the latest Zoho log.
- **Bank file:** amounts are net of TDS, and the remark is `TOOLS-<n>`. Match the columns to PNB's sample once it arrives.

## Later

- **Cashfree Payouts:** on **Mark paid** (or a new "Pay now"), send the selected rows to Cashfree from an Edge Function. Store the Cashfree reference in `paid_ref`.
- **Assets as Zoho bills (rule F)**, once vendors are kept as Zoho contacts.
- **Automatic sales bonuses:** feed the count (e.g. sales) from your sales data into `acc_bonus_save` with the agreed rate, instead of typing it.
- **TDS** on vendor payments using `payee_pan`.

## Sales warehouse — Cashfree (stage 19d)

- **Accounts → 💳 Sales (Cashfree)**: every Cashfree payment, by month, with invoice number and GST split. Search, Successful / All attempts, Download CSV (same columns as the B2C sheet), Import CSV (Cashfree's transaction export or the B2C sheet; rows already present are skipped, invoice numbers in the file are kept).
- **Database**: `supabase/stage19d_cashfree_sales.sql` — `acc_sales` (one row per Cashfree payment, unique `cf_payment_id`), `acc_sales_settings` (prefix `CYBRCT`, next number, GST % — price includes GST; taxable = amount ÷ 1.18, CGST = SGST = 9% of taxable). `acc_sale_record` gives a successful payment the next invoice number exactly once (row lock, gap-free, arrival order); a late "failed" never undoes a success. `acc_sale_refund` marks refunds (FULL / PARTIAL, each refund id counted once).
- **Edge Function** `cashfree-hook` (Verify JWT **off**; checks Cashfree's HMAC signature with `CASHFREE_SECRET`). Secrets: `CASHFREE_APP_ID`, `CASHFREE_SECRET`, optional `CASHFREE_ENV=sandbox`. Cashfree → Developers → Webhooks → `https://bzhnzrmnbphkcasvrsnc.supabase.co/functions/v1/cashfree-hook` (Payment Gateway, version 2023-08-01).
- Not yet: sales to Zoho Books, credit notes for refunds, IGST for buyers outside Haryana (Cashfree doesn't send the buyer's state).
