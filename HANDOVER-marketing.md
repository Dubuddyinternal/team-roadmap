# Marketing space: handover notes

## What it is

**Marketing** is a parent space in the sidebar. Other spaces sit inside it:

- **Social Media**: the existing space, unchanged, with Our agreement, Summary, Ideation, Content Process and Schedule.
- **Campaigns**: one space per sale or launch.
- Any other template added with **＋ Add space**.

## Setting it up

1. On the **dubuddy** team, **Dubuddy Marketing** is created on its own the first time the app loads, and the Social Media space moves inside it (`seedMarketingParent` in `index.html`). It only happens once: if you delete it, it stays deleted. Other teams add one from Administration → Spaces → **＋ Add space** → **Marketing**.
2. The sidebar has two add buttons (both need the **Add spaces** permission):
   - **＋ Add parent space**, at the bottom of the spaces list, opens every space template (Marketing, Scrum, Social Media…). The new space goes at the top level.
   - **＋ Add space**, inside a Marketing space, opens the marketing Space templates: Create campaign, Social media, Educational content, Competitor analysis and Product roadmap. Push automations and Influencer pipeline show as "coming soon". The new space goes inside that Marketing space.
3. To move an existing space in or out of Marketing, use its **⋯** menu → Move into / out of Marketing.

Adding or moving spaces needs the **Add spaces** permission. Deleting a Marketing space doesn't delete the spaces inside it; they go back to the sidebar.

## Who can do what in a campaign

Everyone on the team can see all four tabs of a campaign.

| Level | Who | Can do |
|---|---|---|
| Admin | Team Owner/Admin, or Admin on that space | Everything |
| Team Manager | A role named "…Manager…", or one given **Plan & assign campaigns** (Administration → Roles & permissions) | Move pieces between days on the Calendar (drag a card, or tap it to pick a day), and use Assignment: assign, notify, send to a board, open Strapi/MSG91/Firebase. Can't change the details. |
| Team Member | Everyone else | Read-only, with a note that their work happens on their own board (Content Process, or wherever a piece was handed off) |

This lives in `campAdmin` and `campPlanner` in `index.html`, which pass `canEdit` and `canPlan` to `campaign-space.js`.

## The list of contents

- **＋ Create content piece** (next to the heading) adds many pieces at once. Pick a day, then add rows of *type × how many*. A row set to "Other" asks what the pieces actually are. Pieces are named "Notification 1", "Notification 2" and so on, carrying on from the highest number already used for that type on that day. The platform is filled in from the type, while the accountable person and details are left empty.
- **Day strip**: one tab per day of the campaign's duration, plus any day added with **＋ Day** and any day that already has pieces, all in date order. A day you added that's outside the dates and still empty shows a ✕ so you can remove it. Pieces with no date get a **No date** tab.
- A day shows its pieces **grouped by type**. Each group has its colour, icon, count and **＋ Add one**, which opens the full item dialog with that type and day already filled in.

## A campaign

| Tab | What |
|---|---|
| Fill in Details | The **Campaign Creator** design. It starts with a hero showing the icon, name, tagline, offer code and a live "days to launch" countdown. Below that is the details form, where you tap to pick a campaign type, an offer type and a duration. Channels, audience, goal, budget, messaging and custom fields can be dragged in from the **Field library**. Then come a **Target** box per department and the **content pieces**: tap a tile for each reel, banner, push notification or WhatsApp message, with a date, platform and one accountable person. |
| Assignment & distribution of work | The items grouped by platform. **Assign** or **Reassign** emails the person and puts a 🔔 in their bell. **Every YouTube and Instagram piece** shows **Send to Content Process**, which puts it in **Content Process → To Do** in the Social Media space, marked 🔔 High priority. Other pieces use their own button if one is set in the item dialog (**Action** is the button's text, **URL** is where it goes; only http/https links are allowed). Otherwise banners and alerts open Strapi, WhatsApp opens MSG91, and notifications open Firebase. |
| Calendar | A month grid (drag a card to another day, or to "No date yet"), a list or a flowchart. You can filter by date range, type, platform or person. |
| Dashboard | Total pieces, then the counts by content type, platform and assignee, all read from the campaign. |

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
