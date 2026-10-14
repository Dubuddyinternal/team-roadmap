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

## Later

- **Cashfree Payouts:** on **Mark paid** (or a new "Pay now"), send the selected rows to Cashfree from an Edge Function. Store the Cashfree reference in `paid_ref`.
- **Zoho Books:** after a payment is marked paid, push an expense or bill payment (vendor = `payee_name`, account from `category`).
- **Automatic sales bonuses:** feed the count (e.g. sales) from your sales data into `acc_bonus_save` with the agreed rate, instead of typing it.
- **TDS** on vendor payments using `payee_pan`.
