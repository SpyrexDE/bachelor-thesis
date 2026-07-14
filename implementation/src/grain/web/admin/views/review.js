import { api, el, emptyState, errorNote, fmt, topoChip } from "/api.js";
import { icon } from "/icons.js";
import { confirmDialog, skeleton } from "/ui.js";

// One small stat: label above, value below — the unit of every result panel,
// replacing the old grey-label prose rows.
function stat(label, value, { tone } = {}) {
  return el("div", { class: "stat" },
    el("div", { class: "sl" }, label),
    el("div", { class: `sv${tone ? ` ${tone}` : ""}` }, value));
}

// A win-rate row on a shared 0..1 track with a 0.5 tie line. The two topologies
// carry their identity chips; the bar reaches from 0.5 to the observed rate.
function winRateRow(step, data) {
  const [from, to] = step.split("-");
  const value = data.win_rate_later;
  const track = el("div", { class: "wr-track" }, el("span", { class: "tie" }));
  if (value !== null && value !== undefined) {
    const a = Math.min(value, 0.5) * 100; const b = Math.max(value, 0.5) * 100;
    const decisive = value >= 0.5;
    track.append(el("i", { class: `bar ${decisive ? "up" : "down"}`, style: `left:${a}%;width:${b - a}%` }));
    if (data.ci) {
      track.append(el("span", {
        class: "ci", style: `left:${data.ci[0] * 100}%;width:${(data.ci[1] - data.ci[0]) * 100}%`,
      }));
    }
    track.append(el("span", { class: "dot", style: `left:${value * 100}%` }));
  }
  return el("div", { class: "wr-row" },
    el("div", { class: "wr-pair" }, topoChip(from), icon("arrow-right", 12), topoChip(to)),
    track,
    el("div", { class: "wr-val" },
      value == null ? el("span", { class: "muted small" }, "no votes")
        : el("strong", {}, fmt(value, 2)),
      el("div", { class: "wr-n" }, `${data.n ?? 0} votes`)));
}

export async function renderReview(view) {
  view.replaceChildren(el("div", { class: "card" }, skeleton("row", 4)));
  async function load() {
    let plan, sessions, results;
    try {
      [plan, sessions] = await Promise.all([api("/api/review/plan"), api("/api/review/sessions")]);
      results = plan.exists ? await api("/api/review/results") : null;
    } catch (error) {
      view.replaceChildren(el("div", { class: "card" }, errorNote(error)));
      return;
    }
    view.replaceChildren(planCard(plan), sessionsCard(plan, sessions));
    if (results) view.append(abResultsCard(results.ab, sessions), rubricResultsCard(results.rubric));
  }

  function planCard(plan) {
    if (!plan.exists) {
      return el("div", { class: "card" },
        el("h1", {}, icon("users", 16), "Human evaluation"),
        el("p", { class: "muted" },
          "No review plan yet. It needs the complete 36-run matrix and materialises: ",
          "36 real sets, 3 scrambled catch sets, 2 anchors, 27 between-topology pairs ",
          "and sampled within-topology control pairs (concept/03)."),
        el("button", {
          class: "primary",
          onclick: async (event) => {
            const button = event.currentTarget;
            button.disabled = true;
            try {
              await api("/api/review/plan", { method: "POST", body: {} });
              load();
            } catch (error) {
              await confirmDialog({ title: "Could not generate plan", message: error.message, confirmLabel: "OK" });
              button.disabled = false;
            }
          },
        }, icon("layers", 14), "Generate plan"));
    }

    const validity = plan.validity;
    const drifted = validity.scrambles_drifted;
    const scrambleMean = validity.scramble_judge_scores.reduce((a, b) => a + b, 0)
      / (validity.scramble_judge_scores.length || 1);
    return el("div", { class: "card" },
      el("div", { class: "row spread" },
        el("h1", {}, icon("users", 16), "Human evaluation"),
        el("div", { class: "row" },
          el("button", {
            onclick: async () => {
              const ok = await confirmDialog({
                title: "Regenerate the plan?",
                message: "All sessions, votes, and ratings are discarded and a new plan is built.",
                confirmLabel: "Regenerate", danger: true,
              });
              if (!ok) return;
              await api("/api/review/plan", { method: "POST", body: { force: true } });
              load();
            },
          }, icon("refresh", 14), "Regenerate"),
          el("button", {
            class: "danger",
            onclick: async () => {
              const ok = await confirmDialog({
                title: "Delete the review plan?",
                message: "Every session, vote, and rating is deleted with it.",
                confirmLabel: "Delete plan", danger: true,
              });
              if (!ok) return;
              await api("/api/review/plan", { method: "DELETE" });
              load();
            },
          }, icon("trash", 14), "Delete plan"))),
      el("div", { class: "statrow" },
        stat("Sets", el("span", {}, el("strong", {}, String(plan.sets.real)), " real ",
          el("span", { class: "muted" }, `· ${plan.sets.scramble} scrambled · 2 anchors`))),
        stat("A/B pairs", el("span", {}, el("strong", {}, String(plan.pairs.between)), " between ",
          el("span", { class: "muted" }, `· ${plan.pairs.within} within-control`))),
        stat("Plan seed", el("span", { class: "mono" }, String(plan.seed))),
        stat("Catch validity",
          el("span", { class: `badge ${drifted ? "ok" : "warn"}` },
            icon(drifted ? "check" : "alert", 12),
            drifted ? `scrambles lower (${fmt(scrambleMean, 1)} vs ${fmt(validity.real_coherence_mean, 2)})`
              : `catch weak (${fmt(scrambleMean, 1)} vs ${fmt(validity.real_coherence_mean, 2)})`),
          { tone: drifted ? "" : "warn-sv" })),
    );
  }

  function sessionsCard(plan, sessions) {
    const label = el("input", { placeholder: "Rater label (e.g. rater-1)" });
    const withAb = el("input", { type: "checkbox", checked: "" });
    const withRubric = el("input", { type: "checkbox" });
    const asPilot = el("input", { type: "checkbox" });

    const create = el("button", {
      class: "primary",
      disabled: plan.exists ? null : "",
      onclick: async () => {
        if (!label.value.trim()) {
          await confirmDialog({ title: "Add a label", message: "Give the session a label so you can tell raters apart.", confirmLabel: "OK" });
          label.focus();
          return;
        }
        try {
          await api("/api/review/sessions", {
            method: "POST",
            body: {
              label: label.value.trim(), ab: withAb.checked,
              rubric: withRubric.checked, pilot: asPilot.checked,
            },
          });
          label.value = "";
          load();
        } catch (error) {
          await confirmDialog({ title: "Could not create session", message: error.message, confirmLabel: "OK" });
        }
      },
    }, icon("user-plus", 14), "Create session");

    const rows = sessions.map((session) => {
      const link = `${location.origin}/review/?code=${session.code}`;
      return el("tr", {},
        el("td", {}, el("strong", { class: "mono" }, session.code)),
        el("td", {}, session.label,
          session.pilot ? el("span", { class: "badge plain", style: "margin-left:6px" }, "pilot") : null),
        el("td", {}, session.stage === "done"
          ? el("span", { class: "badge ok" }, icon("check", 12), "done")
          : el("span", { class: "badge plain" },
              icon(session.stage === "ab" ? "users" : "check-square", 12),
              session.stage === "ab" ? "in A/B" : "in rubric")),
        el("td", { class: "num" }, session.ab.total ? `${session.ab.done}/${session.ab.total}` : "—"),
        el("td", { class: "num" }, session.rubric.total ? `${session.rubric.done}/${session.rubric.total}` : "—"),
        el("td", {},
          el("a", { href: link, target: "_blank" }, icon("open", 13), " open"),
          "  ",
          el("a", {
            href: "#", onclick: (event) => {
              event.preventDefault();
              const anchor = event.currentTarget;
              navigator.clipboard.writeText(link);
              anchor.replaceChildren(icon("check", 13), " copied");
              setTimeout(() => { anchor.replaceChildren(icon("copy", 13), " copy link"); }, 1200);
            },
          }, icon("copy", 13), " copy link")),
        el("td", {}, el("button", {
          class: "danger",
          title: `Delete session ${session.code}`,
          onclick: async () => {
            const ok = await confirmDialog({
              title: `Delete session ${session.code}?`,
              message: `${session.label} and all its answers are removed.`,
              confirmLabel: "Delete", danger: true,
            });
            if (!ok) return;
            await api(`/api/review/sessions/${session.id}`, { method: "DELETE" });
            load();
          },
        }, icon("trash", 14))));
    });

    return el("div", { class: "card" },
      el("h2", {}, "Rater sessions"),
      el("div", { class: "row", style: "margin-bottom:12px" },
        label,
        el("label", { class: "check" }, withAb, "A/B task"),
        el("label", { class: "check" }, withRubric, "Rubric task"),
        el("label", { class: "check", title: "Dry runs never feed the results below" },
          asPilot, "Pilot (excluded from results)"),
        create),
      sessions.length
        ? el("table", {},
            el("tr", {},
              el("th", {}, "Code"), el("th", {}, "Label"), el("th", {}, "Stage"),
              el("th", { class: "num" }, "A/B"), el("th", { class: "num" }, "Rubric"),
              el("th", {}, "Rater link"), el("th", {}, "")),
            ...rows)
        : emptyState("No sessions yet. Each rater gets one session code.", "users"));
  }

  function abResultsCard(ab, sessions) {
    const counted = sessions.filter((s) => !s.pilot).length;
    const piloted = sessions.length - counted;
    const steps = Object.entries(ab.steps);
    const anyVotes = steps.some(([, d]) => d.win_rate_later != null);

    return el("div", { class: "card" },
      el("div", { class: "row spread" },
        el("h2", {}, icon("users", 14), "A/B results — win rate of the later topology"),
        el("span", { class: "small muted" },
          `${counted} session(s) counted` + (piloted ? ` · ${piloted} pilot excluded` : ""))),
      anyVotes
        ? el("div", { class: "winrate-list" },
            el("div", { class: "wr-scale" },
              el("span", { style: "left:0%" }, "0.0"),
              el("span", { class: "tie-lbl", style: "left:50%" }, "0.5 tie"),
              el("span", { style: "left:100%" }, "1.0")),
            ...steps.map(([step, data]) => winRateRow(step, data)))
        : emptyState("No A/B votes yet. Share a session link to collect them.", "users"),
      el("div", { class: "statrow", style: "margin-top:14px" },
        stat("Within-topology control", ab.within_control.within.pairs
          ? el("span", {}, el("strong", {}, fmt(ab.within_control.within.mean, 2)),
              el("span", { class: "muted" }, ` decisiveness · between ${fmt(ab.within_control.between.mean ?? null, 2)}`))
          : el("span", { class: "muted" }, "no votes yet")),
        stat("Judge alignment", ab.judge_alignment.n
          ? el("span", {}, el("strong", {}, fmt(ab.judge_alignment.share_higher_score_wins, 2)),
              el("span", { class: "muted" }, ` higher-coherence wins · n=${ab.judge_alignment.n}`))
          : el("span", { class: "muted" }, "no votes yet")),
        stat("Inter-rater agreement", ab.agreement.rater_pairs
          ? el("span", {}, el("strong", {}, fmt(ab.agreement.percent_agreement, 2)),
              el("span", { class: "muted" }, ` raw · κ ${fmt(ab.agreement.mean_pairwise_kappa, 2)} · ${ab.agreement.rater_pairs} pair(s)`))
          : el("span", { class: "muted" }, "needs two raters"))));
  }

  function rubricResultsCard(rubric) {
    const catchCheck = rubric.catch_check;
    const rho = rubric.spearman_overall;
    // Spearman lives on -1..1; a centred bar shows sign and strength at a glance.
    const rhoBar = rho === null ? null : el("div", { class: "rho-track" },
      el("span", { class: "axis" }),
      el("i", {
        class: rho >= 0 ? "up" : "down",
        style: `left:${Math.min(rho, 0) * 50 + 50}%;width:${Math.abs(rho) * 50}%`,
      }));

    return el("div", { class: "card" },
      el("h2", {}, icon("check-square", 14), "Rubric results"),
      el("div", { class: "statrow" },
        stat("Judge vs humans", rho === null
          ? el("span", { class: "muted" }, "needs ratings on real sets")
          : el("div", {}, el("div", { class: "row", style: "gap:8px" },
              el("strong", { style: "font-size:16px" }, fmt(rho, 2)),
              el("span", { class: "muted small" }, "Spearman ρ")), rhoBar)),
        stat("Per-set agreement", rubric.per_set_agreement.n
          ? el("span", {}, el("strong", {}, fmt(rubric.per_set_agreement.exact, 2)),
              el("span", { class: "muted" }, ` exact · ${fmt(rubric.per_set_agreement.within_one, 2)} within one · n=${rubric.per_set_agreement.n}`))
          : el("span", { class: "muted" }, "needs two ratings per set")),
        stat("Catch check", catchCheck.raters_score_scrambles_lower === null
          ? el("span", { class: "muted" }, "needs ratings on scrambles and real sets")
          : catchCheck.raters_score_scrambles_lower
            ? el("span", { class: "badge ok" }, icon("check", 12),
                `scrambles lower (${fmt(catchCheck.scramble_human_mean, 2)} vs ${fmt(catchCheck.real_human_mean, 2)})`)
            : el("span", { class: "badge bad" }, icon("alert", 12),
                `NOT lower (${fmt(catchCheck.scramble_human_mean, 2)} vs ${fmt(catchCheck.real_human_mean, 2)}) — abort, concept/03`))),
      rubric.spearman_overall === null ? null
        : el("p", { class: "section-note", style: "margin-top:12px" },
            "Per-pillar ρ: ",
            ...Object.entries(rubric.spearman_pillars).flatMap(([pillar, r], i) => [
              i ? el("span", {}, " · ") : null,
              el("span", {}, `${pillar.replace(/_/g, " ")} `),
              el("strong", {}, r === null ? "—" : fmt(r, 2)),
            ])));
  }

  await load();
  return null;
}
