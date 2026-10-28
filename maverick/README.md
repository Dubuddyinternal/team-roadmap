# Maverick by Dubuddy

The creator site at **maverick.dubuddy.in**. Built with Next.js (App Router, plain JavaScript) and Supabase.

## Pages

| URL | What it is |
|---|---|
| `/` | Home: hero, the two paths, earnings calculator, slabs |
| `/how-it-works` | Six steps + the Maverick Playbook |
| `/help` | Help tiles, status meanings, contact |
| `/login` | Mobile number + OTP (Supabase phone auth) |
| `/signup` | "About you" form, first time only |
| `/dashboard` | Creator overview and My videos (empty for new users) |
| `/dashboard/submit` | Submit a Drive link |
| `/dashboard/videos/[id]` | Status of one video (in review / needs info / approved / rejected / published) |
| `/dashboard/payouts` | UPI ID, payout totals, payment history |

Every number (₹ per video, slabs, days) lives in `lib/config.js`.
The design is in `app/prototype.css` (the original prototype's styles) plus `app/globals.css` (fonts and the phone layout).

## Environment variables

Set these in Vercel → Project → Settings → Environment Variables (and in `.env.local` for local work):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>
```

Without them the public pages still work; login and the dashboard show "not connected yet".

## Database

`supabase/maverick_schema.sql` creates the `maverick_creators`, `maverick_submissions` and `maverick_payouts` tables with row-level security. Creators only ever see their own rows. Reviewers are whoever `maverick_is_reviewer()` allows (it returns false until it is wired to the team permission system used by tools.dubuddy.in).

Phone OTP needs an SMS provider (Twilio, MessageBird, Vonage or Textlocal) turned on in Supabase → Authentication → Sign In / Providers → Phone. If the dev team uses a different OTP service, only `sendCode()` and `verify()` in `app/login/page.js` change.

## Run locally

```
npm install
npm run dev
```
