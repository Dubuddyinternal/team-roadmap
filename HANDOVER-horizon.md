# Widen our Horizon: handover notes

Big questions someone reads about every week, such as what kind of startups YC is backing, what's happening in AI, or what it would take to build a B2B company like Zoho. It's its own space. Add it from Administration → Spaces → **＋ Add space** → **🔭 Widen our Horizon**.

| Tab | What |
|---|---|
| Topics | Each question, who answers it every week and who checks it. Three starter topics (YC, AI, B2B like Zoho) come with their weekly questions filled in, or you can write your own. |
| Fill this week | The same template every week: this week in 5 lines, the topic's own questions, 3 examples with links, what we can take away, something we could build, where I looked, and questions for next week. **Submit for check** unlocks when every MUST FILL box is done. Weeks run Monday to Sunday. |
| Weekly check | What's waiting for a check, with **Mark checked** or **Ask for more** plus a note, and a grid of every topic over the last 6 weeks. Only the space's admins can check. |
| Learnings | Every week's takeaway and build idea, newest first. |

Emails and 🔔: the person answering is told when the topic is given to them and when a week is sent back. The checker is told when a week is submitted. These go through the Edge Function `idea-mail`, action `assign`.

Code: `horizon-space.js` (`window.HX`). The starter topics and weekly boxes are `PRESETS`, `TOP` and `BOTTOM` at the top of the file. In `index.html`, search for `renderContentHorizon`.
