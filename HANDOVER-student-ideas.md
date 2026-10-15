# Student ideas board: handover notes

## What it is

**https://tools.dubuddy.in/ideas** is a public page where students suggest features and vote for them. It needs no login.

- New ideas wait for the team's approval before anyone else sees them.
- Statuses students see: **In review → Planned → In progress → Completed**, or **Not planned**.
- If a student leaves an email, they get a thank-you right away, then one when their idea is approved, when its status changes, and when the team writes to them.
- Teammates who pitch an idea with their name get the same: a thank-you, then status and message emails, plus a 🔔 in their bell.

## Putting it on the website and in the app

- **Website:** link to `https://tools.dubuddy.in/ideas`, for example "💡 Suggest a feature" in the menu or footer.
- **App:** open the same address in an in-app browser (WebView). It's built for phones and follows the phone's dark mode.
- **Later, with login:** the plan is for the app to pass the student's login so votes are tied to real accounts. Today each browser gets one vote per idea, and each browser can send at most 5 ideas a day.

## How the team handles ideas

| Where | What |
|---|---|
| Product space → **🎓 From students** | New ideas: **Approve**, **Merge into…** an existing idea (votes move across), or **Reject** with an optional reason. Needs the **Review student ideas** permission (Owners always have it). |
| Product space → **All ideas** | Approved ideas show 🎓 and their vote count. **✉️** in the last column writes to the student, or to the teammate who pitched it. You can email them, show the message as the team's reply on the board, and tick "shipped". |
| Roadmap columns | Backlog = In review · Primary research / Will do / Implementation research = Planned · Ready to implement / Under implementation by engineering = In progress · Done = Completed · Won't do = Not planned. Moving an idea updates the board and emails the student. |
| Administration → **✉️ Idea emails** | The words of every email, for students and for teammates: thank-you, approved, each status, and the wrapper around your ✉️ messages. You can switch each one off, edit it, send yourself a test, or reset it to the default. Needs **Review student ideas**. |
| Administration → **💡 My product ideas** | Every teammate sees the status of the ideas they pitched from Social Media → Ideation. |

## Where things live

| Part | Where |
|---|---|
| Public page | `ideas/index.html` |
| Team side | `student-ideas.js` (inbox, sync, ✉️, My product ideas) and `product-pitch.js` (team pitches) |
| Database | `supabase/stage15a_student_ideas.sql`, `stage15b_idea_thanks.sql`, `stage15c_idea_email_templates.sql` (all applied). Tables `student_ideas` and `student_idea_votes`. Students reach them only through the `ideas_*` functions. |
| Emails | Edge Function `idea-mail` (`supabase/functions/idea-mail/index.ts`), "Verify JWT" **OFF**, because the public page sends thank-yous while signed out; every action is still checked by the database. It uses the same Zoho secrets as `manage-people`. |

The old "💡 Student Ideas" panel that read from JSONBin has been removed from the app. Its JSONBin bin (`6a477b27…`) can be deleted on jsonbin.io.
