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

## Who can use it

- **Permission "Accounts: payments & payroll"** (`accounts`) in Roles & permissions. It includes seeing people's bank details. Owners and super-admins have it.
- Everyone can ask for payments and sees only their own.

## Database

- `supabase/stage19a_accounts.sql`:
  - Tables: `acc_requests`, `acc_files` (private bucket `acc-docs`), `acc_payroll`.
  - Functions: `acc_request_create / cancel`, `acc_decide`, `acc_mark_paid`, `acc_payroll_fill / save / status`, `acc_bank_rows`.
- Everything is written through these functions. People can only read their own rows unless they have the Accounts permission.

## Later

- **Cashfree Payouts:** on **Mark paid** (or a new "Pay now"), send the selected rows to Cashfree from an Edge Function. Store the Cashfree reference in `paid_ref`.
- **Zoho Books:** after a payment is marked paid, push an expense or bill payment (vendor = `payee_name`, account from `category`).
- **Automatic bonuses:** rules that add to `acc_payroll.bonus` when the month is filled.
- **TDS** on vendor payments using `payee_pan`.
