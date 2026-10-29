# Monthly feedback and the suggestion box: handover notes

## Monthly feedback

| When | What happens |
|---|---|
| Open day (default the **25th**) | The form opens. Everyone gets a 🔔 at 9:30 am (India time), and a pop-up every day after that until they send it. The pop-up's **✍️ Fill it now** button opens the form. |
| Up to the last day of the month | People fill it in at **Administration → 📝 My monthly feedback**. Drafts save automatically. **Send it** locks the form, and their nearest linked senior gets a 🔔. |
| 1st to 10th of the next month | It can still be sent, marked **late**. |
| Review meeting | A senior opens **My Team → Monthly feedback → Read →**, writes notes and action points, and ticks "We've had the meeting". The person gets a 🔔 and sees the notes on their own feedback page. |

**Who can read someone's feedback:**
- the person
- everyone above them in **My Team → Reporting lines**
- super-admins (Sumit)

Drafts are visible to nobody else. An owner in a different branch of the chart can't read it either.

### Reminders until it's sent (stage 22a)

From the open day until it's sent (including the late window, up to the 10th of the next month), each person who hasn't sent theirs gets:
- the 🔔 and the daily pop-up (as before, from `feedback_remind()`)
- **emails**: 1 a day by default, spread over 9 am to 9 pm India time. The email's button links to `?fb=1`, which opens the form.
- a **strip at the top** of every page: "Your October feedback is pending". It turns red once it's late.
- a red dot on the **account button**, and **📝 Monthly feedback · Pending** in the account menu
- a reminder message once a day when they open the site

All of these stop as soon as they send it. Super-admins are left out.
Emails a day (0 to 3) and the strip are set in **My Team → Monthly feedback → ⚙️ Settings**.

Setup: run `supabase/stage22a_feedback_nudges.sql`, then create the Edge Function **`feedback-remind`** from `supabase/functions/feedback-remind/index.ts` with **Verify JWT OFF**. It uses the same Zoho secrets as `hr-remind`. The hourly job is pg_cron `feedback-mail-tick` (`17 * * * *`), which calls `feedback_mail_tick()`. Until the SQL is run, the browser part stays quiet.

### OKR check-in, twice a month (stage 22b)

Everyone who owns an objective or a key result in the newest OKR cycle updates the current numbers on their key results:
- **mid-month**, from the check-in day (default the **15th**) until the day before the feedback form opens
- **at month end**, together with monthly feedback (open day to the 10th of the next month). The check-in shows at the top of **📝 My monthly feedback**.

They do it in **Administration → 🎯 My OKR check-in**. Until it's saved they get the same reminders as feedback: a 🔔 and a daily pop-up (`okr_checkin_remind()`, pg_cron `okr-checkin-reminders`, 9:30 IST), the strip, **🎯 OKR check-in · Pending** in the account menu, and emails. One email covers both feedback and the check-in. Saving goes through `okr_checkin_save()`, which writes the numbers into the team's OKRs (only key results the person owns, or of objectives they own) and records the check-in in `okr_checkins`.

Switch it on or off and pick the mid-month day in **My Team → Monthly feedback → ⚙️ Settings**.

Setup: run `supabase/stage22b_okr_checkins.sql`, then redeploy **`feedback-remind`** with the new code.

### One-time setup (owners)

1. Go to **My Team → Reporting lines**. For each box, press ✎ and choose its **Linked login**. Boxes that aren't linked show "not linked". A senior only sees people whose boxes are linked below theirs.
2. In **My Team → Monthly feedback → ⚙️ Settings**, set the day the form opens, or switch feedback off.

Only **owners** (and Sumit) can change the org chart now, because the chart decides who reads whose feedback. Admins can no longer edit it.

### The form

1. How was your month? (😣 to 🤩)
2. Biggest wins
3. What didn't go to plan, and why
4. What slowed you down
5. Workload
6. How supported did you feel by your manager? (1 to 5)
7. What you need
8. What you learned
9. A shout-out
10. Top 3 goals for next month
11. Anything for the review meeting

Questions 1, 2, 3, 5 and 10 must be answered before the form can be sent. The questions live in `FB_Q` in `monthly-feedback.js`.

The form has **3 steps** (tabs at the top, Back / Next, Send on step 3):
1. **Monthly feedback**: the questions above (`FB_Q`).
2. **Personality**: tick the positive and negative traits you have (`FB_TRAITS_POS` / `FB_TRAITS_NEG`). At least one tick is needed. Stored as `answers.traits_pos` / `answers.traits_neg`.
3. **Self-awareness** (`FB_SA`): what do I think of myself; what do my parents, my seniors or manager, my colleagues and my juniors think of me; where do I see myself in 3 years. All are required except juniors.

Everything is saved in the same `monthly_feedback.answers`, so the review reader and My Performance show all three.

## Suggestion box

- **Administration → 📮 Send to Sumit** (everyone): send a suggestion, improvement, complaint, appreciation or anything else, **anonymously** or **with your name**. Anonymous messages store no sender and only the day, not the time.
- **Administration → 📮 Suggestion box** (super-admins only): sorted into New, Read and Done. Each new message also puts a 🔔 in Sumit's bell.

## Where things live

| Part | Where |
|---|---|
| Screens | `monthly-feedback.js`. The org chart's Linked login field and the My Team tab are in `index.html`. The pop-up's "Fill it now" button is in `notifications.js`. |
| Database | `supabase/stage16a_monthly_feedback.sql` (applied). It contains the tables `monthly_feedback`, `feedback_settings` and `suggestion_box`, plus functions `feedback_*`, `fb_reports` and `suggestion_send`. |
| Reminders | pg_cron job `feedback-reminders` (`0 4 * * *` UTC = 9:30 IST), which calls `feedback_remind()`. |
