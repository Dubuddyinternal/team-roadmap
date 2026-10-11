# Marketing space: handover notes

## What it is

**Marketing** is a parent space in the sidebar. Other spaces sit inside it:

- **Social Media**: the existing space, unchanged, with Our agreement, Summary, Ideation, Content Process and Schedule.
- **Campaigns**: one space per sale or launch.
- Any other template added with **＋ Add space**.

## Setting it up

1. Go to Administration → Spaces → **＋ Add space** → **Marketing**, and give it a name, for example "Dubuddy Marketing".
2. Every Social Media space that isn't already inside a Marketing space moves into it automatically.
3. To add more inside it, use **＋ Add space** under the Marketing space in the sidebar. You can choose Create campaign, Social media, Educational content, Competitor analysis or Product roadmap. Push automations and Influencer pipeline show as "coming soon".
4. To move an existing space in or out of Marketing, use its **⋯** menu → Move into / out of Marketing.

Adding or moving spaces needs the **Add spaces** permission. Deleting a Marketing space doesn't delete the spaces inside it; they go back to the sidebar.

## A campaign

| Tab | What |
|---|---|
| Fill in Details | Name, tagline, offer code, duration, days, messaging and your own fields, plus the **list of contents**: every reel, banner, push notification and WhatsApp message, each with a date, platform and one accountable person. |
| Assignment & distribution of work | The items grouped by platform. **Assign** or **Reassign** emails the person and puts a 🔔 in their bell. Reels, long videos, stories and influencer videos go to **Content Process → To Do** in the Social Media space, marked 🔔 High priority. Banners and alerts open Strapi, WhatsApp opens MSG91, and notifications open Firebase. |
| Calendar | A grid or list of every month the campaign covers. You can filter by type, platform or person, and make a flowchart. |
| Dashboard | Counts from what you entered. The **Campaign success** sales block shows example numbers ("NOT LIVE") until it is connected to the orders database. |

## Keep an Eye (its own space, not inside Marketing)

Add it from Administration → Spaces → **＋ Add space** → **Keep an Eye**. It sits in the sidebar on its own and can't be moved into Marketing. It's for studying companies we want to be like (🌟) and competitors (⚔️). Every company gets the same fixed template, so an intern knows what to fill.

| Tab | What |
|---|---|
| Companies | Every company being watched, who is studying it, the due date, and how many **MUST FILL** boxes are done. Choosing a person emails them and puts a 🔔 in their bell. |
| Fill the template | Five numbered sections: The basics, What they sell, How they market, What students say, and Our take. Each box says what to write and shows an example. A sixth section takes your own extra boxes. |
| What changed | A dated log of things spotted later, such as a new offer, a price change or a post that went viral, each with a link. |
| Compare | The key boxes from every company side by side. |

The template's boxes are set in `SECTIONS` at the top of `watch-space.js`. To change what interns fill, edit that list.

## Where things live

| Part | Where |
|---|---|
| Campaign screens | `campaign-space.js` (`window.CX`), drawn in its own shadow root. Data is saved inside the space in `cspaces`. |
| Keep an Eye screens | `watch-space.js` (`window.WX`), the same way. `index.html`: search for `renderContentWatch`. |
| Sidebar, templates, hand-off | `index.html`. Search for `openMarketingTemplates`, `_drawCs` and `renderContentCampaign`. |
| High-priority card on the board | `social-space.js` (`.hotbar`) |
| Assignment email and bell | Edge Function `idea-mail`, action `assign`, at version 4. It checks that the caller can edit in the team and that the person is a member. |
