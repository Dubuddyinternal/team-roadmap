// Demo data for a fresh local copy: one team, you as its owner, and one
// Social Media space with a few dummy ideas and cards to try the pipeline on.
// Only used when local/data/db.json doesn't exist yet. Delete that file to
// start over from this.

const iso = d => d.toISOString().slice(0, 10);
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

const pre = (title, desc, hashtags, keywords) => ({
  source: "keyword", tool: "vidiq", keywords, why: "Demo card for testing the local pipeline", title, desc, hashtags,
});
const card = (id, stage, platform, vtype, idea, p, scheduled) => ({
  id, ideaId: null, idea, platform, vtype, stage, pre: p,
  post: { reel: null, thumb: null, postUrl: "" }, scheduled, published: null, acceptedOn: day(-3), metrics: null, override: null,
});

export function seed() {
  const social = {
    id: "cs-social", name: "Social Media", type: "social", access: "team", members: {},
    sx: {
      ideas: [
        { id: "i-demo1", idea: "CUET cutoff 2026 for SRCC explained", by: "Owner", created: day(-2), hook: "SRCC ka cutoff itna gir gaya?",
          cta: "Follow for more DU updates", platform: "yt", vtype: "short", source: "keyword", tool: "vidiq",
          keywords: ["srcc cutoff", "cuet cutoff 2026"], title: "", desc: "", hashtags: "", why: "High search volume in October",
          studentWhy: "", status: "new", comments: [] },
        { id: "i-demo2", idea: "Hostel vs PG near North Campus", by: "Owner", created: day(-1), hook: "", cta: "",
          platform: "ig", vtype: "reel", source: "comment", tool: "manual", keywords: ["du hostel"], title: "", desc: "",
          hashtags: "", why: "Students keep asking in comments", studentWhy: "", status: "under_review", comments: [] },
      ],
      cards: [
        card("c-demo1", "todo", "yt", "short", "Top 5 DU colleges for B.Com",
          pre("Top 5 DU Colleges for B.Com (2026)", "Which DU college should you pick for B.Com?", "#du #bcom #cuet", ["du colleges for bcom"]), day(4)),
        card("c-demo2", "inprogress", "ig", "reel", "3 mistakes in CUET form filling",
          pre("3 CUET form mistakes that cost seats", "Avoid these 3 mistakes while filling your CUET form.", "#cuet #cuet2026 #du", ["cuet form mistakes"]), day(2)),
        card("c-demo3", "inreview", "yt", "short", "DU semester exam pattern",
          pre("DU Semester Exam Pattern Explained", "Everything about the new DU semester exam pattern.", "#du #exams", ["du exam pattern"]), day(1)),
      ],
      events: [],
    },
  };

  return {
    tables: {
      teams: [{ slug: "dubuddy", name: "Dubuddy" }],
      profiles: [{ id: "local-owner", email: "owner@local", name: "Owner", username: "owner", is_super: true, must_change_pw: false, profile: {} }],
      memberships: [{ team_slug: "dubuddy", user_id: "local-owner", role: "owner", department: null }],
      team_roles: [],
      team_data: [
        { team_slug: "dubuddy", section: "cspaces", data: { list: [social] } },
        { team_slug: "dubuddy", section: "builtinHidden", data: { dev: true, bugs: true } },
      ],
    },
  };
}
