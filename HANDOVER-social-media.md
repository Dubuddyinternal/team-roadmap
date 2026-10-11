# Social Media space: handover notes

Give this file to Claude at the start of a new chat. Say: "Read HANDOVER-social-media.md, then help me with …".

## What it is

The **Social Media** space on tools.dubuddy.in, for the DU Buddy team. Its numbers fill in by themselves from YouTube and Instagram every morning at 8:00 AM IST. Anyone in the team can also press **Sync now**, at most once every 10 minutes.

It has five tabs:

- **🎯 Targets:** weekly and monthly targets for each platform, plus posting times. Only people whose role has **Edit social targets** can change them. An owner ticks that permission under Administration → Roles & permissions.
- **📊 Summary:** everything below is on this tab.
  - The **Both / YouTube only / Instagram only** switch, and **Compare Instagram vs YouTube**.
  - Target cards showing value / target.
  - **Which posts brought followers/subscribers.**
  - **Process health** boxes. Click one to see its details.
  - Keyword performance.
  - Follower and subscriber growth.
  - **Where your audience is:** states, then cities, plus metros vs other cities vs towns & rural.
  - **Published posts:** filters like Zoho, saved views, CSV export, and bulk tagging (for example Creator = Sivam).
- **💡 Ideation, 🎬 Content Process, 🗓 Schedule:** the team's own template, uploaded as Dubuddy_Social_Media_Space.html.

Wording: YouTube says **subscribers** and Instagram says **followers**.

## Where things live

| Part | Where |
|---|---|
| Website code | GitHub repo `sumitkumarimages777-stack/team-roadmap`, branch `main`. `index.html` is the app; `social-space.js` is the Social Media space. |
| Database | Supabase project `bzhnzrmnbphkcasvrsnc`. Tables `social_posts`, `social_snapshots`, `social_geo`, `social_post_daily`, `social_sync_config`. Set-up files are in `supabase/` (stage7a, stage8a, stage9a, all already applied). |
| Sync program | Supabase Edge Function `sync-social`, with "Verify JWT" OFF because it checks callers itself. Its code is in `supabase/functions/sync-social/index.ts`. Always deploy the **whole file**. |
| Daily timer | Supabase cron job `sync-social-daily` (02:30 UTC). |
| Keys | Supabase → Edge Functions → Secrets: `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN` (Google), `IG_ACCESS_TOKEN` (a Meta system-user token that never expires, from the "Dubuddy Socials Sync" app in the DU Buddy business portfolio). **Never paste keys into a chat.** |

## What the platforms do NOT give, so don't chase it

- **Followers per Instagram Reel:** Meta's API refuses "follows" for Reels. The posts table has a box where you can type the number from the Instagram app. The team chose not to use an automatic estimate. Some backend code for one, `attributeFollows`, still runs but nothing shows it.
- **YouTube thumbnail CTR / impressions:** not available through the API. They're only in YouTube Studio.
- **Districts:** neither platform gives them. Cities are the closest.
- **Urban / rural:** neither platform gives it. The chart shows metros vs other top cities vs "towns & rural", where towns & rural means everything outside the top cities.
- **YouTube subscribers by state or city:** YouTube gives them by country only. Viewers come by city, and the sync maps each city to its state with a built-in list.
- **Instagram locations:** top 45 cities only.
- **Webinars, community posts, stories and Instagram lives:** not tracked by any API. Type them in by hand on the Summary target cards.

## How changes get made

1. Claude works on a branch, tests it in a browser, then opens a pull request and merges it to `main`. The website updates from `main`.
2. Database changes go in a new `supabase/stageNx_….sql` file, and Claude applies them through the Supabase connection.
3. After changing `sync-social`, deploy the whole file and then press **Sync now** to check it works.

## If numbers look wrong

1. Press **Sync now** on the Summary, wait a minute and refresh.
2. If a platform's numbers are missing, ask Claude to read `social_sync_config.last_result`. It holds the last sync's messages for YouTube, Instagram and places.
3. If the result says "Google sign-in failed", the Google refresh token was revoked. Make a new one in the OAuth Playground and replace `YT_REFRESH_TOKEN` in Supabase Secrets.
4. If it's an Instagram token error, generate a new system-user token in Meta Business settings → System users, and replace `IG_ACCESS_TOKEN`.

## Clean-up you can do any time

- In Supabase → Edge Functions, delete the old `ig-debug` function. It's already switched off.

## Keep an Eye on 2nd Love

This is the last tab in the Social Media space. It starts with the line "1st love is our users. 2nd love is our competitors."

- **Us vs them:** a table of each competitor's Instagram followers, YouTube subscribers, posts per week and top post views, next to ours. **Log numbers** saves a reading each week, and the small green or red number is the change since the reading before.
- **Their study:** the same boxes for every competitor: what they post, when, their best post this week, hooks, look and feel, what they ask viewers to do, what students say in their comments, and what we'll try. Four of them are must fill.
- **→ Send to Ideation:** turns "What we'll try" into an idea on the Ideation tab.

Data is saved in `space.sx.rivals`. Code: `renderRivals` in `social-space.js`.
