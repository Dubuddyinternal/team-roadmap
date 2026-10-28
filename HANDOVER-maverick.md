# Maverick Admin: handover notes

## What it is

**Maverick** is Dubuddy's creator programme at **https://maverick.dubuddy.in** (repo `Dubuddyinternal/maverick`). Students sign up with their phone, send a Google Drive link to a video that mentions Dubuddy, publish it once we approve it, add the published link, and get paid to UPI:

- ₹50 base pay per verified video, due 7 days after publishing.
- A bonus on views counted over 30 days: 1,500–5,000 → ₹50 · 5,000–15,000 → ₹150 · 15,000–30,000 → ₹300 · 30,000+ → ₹500 · 1,00,000+ → ₹1,000.

The team's side is the **🎬 Maverick Admin** space here. Add it from Administration → Spaces → Maverick Admin. Everything creators do shows up in it live, without reloading.

## How the team uses it

| Tab | What |
|---|---|
| **All videos** | Every submission, newest first. Click the S. No. to open the full record, where you can change the status and write a note the creator sees ("Needs info" asks them a question; their reply sends it back to the Review queue). |
| **Review queue** | New videos, oldest first. **Approve**, or **Reject** with a reason the creator sees. |
| **Publish to verify** | The creator says it's live. **Approve** = verified, and base pay becomes due 7 days after the publishing date. **Reject** sends it back to "Approved" with the reason and clears the link, so they can publish again. |
| **Payouts → Base pay** | Verified videos. **Release payout** once the UPI transfer is done; it shows in the creator's payment history. |
| **Payouts → Bonuses** | Videos whose 30-day window is over. Type the views; the slab picks the amount. Then **Release payout**. |

The 🔔 in the space and the "waiting on us" sticker count what's waiting. Anyone with a Maverick permission also gets a toast when they open the app if videos are waiting, and a live toast when a new video or link comes in.

## Who can do what (Administration → Roles)

| Permission | Lets you |
|---|---|
| **Review Maverick videos** (`review_maverick`) | Approve, reject, verify, send back, enter views. The dubuddy **Admin** role has it. |
| **Release Maverick payouts** (`pay_maverick`) | Release base pay and bonuses: the payout head. Nobody has it by default except Owners; tick it for the payout head's role. |

The database checks these too (`maverick_is_reviewer()`, `maverick_can_pay()`), so a hidden button can't be bypassed.

## Deploying

tools.dubuddy.in deploys from the Vercel project `dubuddy2/team-roadmap` whenever `main` changes. The repo moved from `sumitkumarimages777-stack/team-roadmap` to `Dubuddyinternal/team-roadmap`. If a merge doesn't show up in Vercel → Deployments, check that Settings → Git points at `Dubuddyinternal/team-roadmap`, then use ⋯ → Create Deployment → `main`.

## Where things live

| Part | Where |
|---|---|
| Team side | `maverick-space.js` (all of it, drawn in a shadow root) and the `maverick` space type in `index.html` |
| Creator site | `Dubuddyinternal/maverick` (Next.js, Vercel) |
| Database | `supabase/maverick_schema.sql` in `Dubuddyinternal/maverick`. Tables `maverick_creators`, `maverick_submissions`, `maverick_payouts`; creators only ever see their own rows. Nothing about Maverick is stored in `team_data`. |
| Numbers | `CFG` at the top of `maverick-space.js`, and `lib/config.js` in the creator site. Keep them the same. |

## Emails to creators

Each step emails the creator from **maverick@dubuddy.in**: approved, rejected (with the reason), a question (Needs info), link sent back, verified, base pay released, bonus released. Replies go to that mailbox.

- Sent by the Edge Function `maverick-mail` (`supabase/functions/maverick-mail` in `Dubuddyinternal/maverick`, "Verify JWT" ON). It only sends when the caller has a Maverick permission and the video really is in that state, and it won't send the same email for the same video twice within 10 minutes.
- Secrets: `MAVERICK_SMTP_USER` (maverick@dubuddy.in) and `MAVERICK_SMTP_PASS` (its Zoho app password). Internal tools.dubuddy.in mail still uses `SMTP_USER` / `SMTP_PASS`.
- Every attempt is logged in `maverick_emails` and shown in the space's **✉️ Emails** tab, with **Open the Maverick mailbox ↗** (mail.zoho.in).
- The words are in `compose()` in that function.

## Not done yet

- **Phone OTP** on the creator site needs an SMS provider in Supabase (with DLT registration for Indian numbers). Until then, test with the test number in Authentication → Sign In / Providers → Phone, and delete it when real SMS goes live.
