import { api, el, errorNote, openLightbox, themeToggle } from "/api.js";
import { icon } from "/icons.js";

document.getElementById("topbar-end").append(themeToggle());

const root = document.getElementById("rater");
const params = new URLSearchParams(location.search);
let code = (params.get("code") ?? "").toUpperCase();
let shownAt = null;
let introSeen = { ab: false, rubric: false };

// Canvas aspect per platform (concept/02) — frames match it so artifacts fill
// edge-to-edge instead of floating letterboxed in a uniform box.
const PLATFORM_ASPECT = { instagram: 1440 / 1800, story: 1440 / 2560, banner: 300 / 250 };

// ---- small primitives -------------------------------------------------------

function kbd(text) {
  return el("kbd", { class: "rv-kbd" }, text);
}

function centered(child) {
  return el("div", { class: "rv-center" }, child);
}

function startBtn(onclick, label = "Start") {
  return el("button", { class: "rv-start", onclick }, icon("play", 14), label);
}

function step(iconName, title, description) {
  return el("div", { class: "rv-step" },
    el("span", { class: "rv-step-ic" }, icon(iconName, 18)),
    el("div", {},
      el("div", { class: "rv-step-t" }, title),
      el("div", { class: "rv-step-d" }, description)));
}

// One image tile. The frame holds the artifact; clicking enlarges it (never
// votes) and the enlarged view carries the full caption — so the compact grid
// stays clean and no copy is ever truncated. `showCaption` prints the full
// caption inline where there is room for it (the single-set rating screen).
function artTile(artifact, { showCaption = false } = {}) {
  // The frame is part of the set's click target (choosing the set); only the
  // hover zoom button opens the artifact — it stops propagation so enlarging
  // never counts as a vote.
  const frame = el("div", {
    class: "rv-frame",
    style: `--ar:${PLATFORM_ASPECT[artifact.platform] ?? 1}`,
  },
    el("img", { src: artifact.image_url, alt: artifact.platform, loading: "lazy" }),
    el("button", {
      class: "rv-zoom", title: "Enlarge", "aria-label": "Enlarge artifact",
      onclick: (event) => { event.stopPropagation(); openLightbox(artifact.image_url, artifact.caption); },
    }, icon("maximize", 16), el("span", {}, "Enlarge")));
  return el("div", { class: "rv-art" }, frame,
    showCaption && artifact.caption ? el("div", { class: "rv-cap" }, artifact.caption) : null);
}

// ---- persistent progress ----------------------------------------------------

function progressBar(state) {
  const inRubric = state.stage === "rubric";
  const phase = inRubric ? state.rubric : state.ab;
  const total = phase.total || 0;
  const done = phase.done || 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const twoParts = state.ab.total && state.rubric.total;
  const unit = inRubric ? "Set" : "Pair";
  return el("div", { class: "rv-progress" },
    el("div", { class: "rv-progress-head" },
      el("span", { class: "rv-phase" },
        twoParts ? el("span", { class: "rv-part-tag" }, inRubric ? "Part 2" : "Part 1") : null,
        el("span", {}, inRubric ? "Rate the set" : "Which set is better?")),
      el("span", { class: "rv-count" }, `${unit} ${Math.min(done + 1, total)} `,
        el("span", { class: "rv-count-tot" }, `/ ${total}`))),
    el("div", { class: "rv-track" }, el("span", { class: "rv-fill", style: `width:${pct}%` })));
}

// ---- the brief, structured (never a text dump) ------------------------------

// Every element a rater needs to judge fit, each as a structured row — no raw
// text dump. What a rater can't act on (deliverables, success measures) is left
// out; prohibited wording earns its own "Don't say" row beside "Must say".
function briefPanel(brief) {
  const row = (label, value) => value
    ? el("div", { class: "rv-brow" },
        el("span", { class: "rv-bk" }, label),
        el("span", { class: "rv-bv" }, value))
    : null;
  const chipRow = (label, items, cls) => (items ?? []).length
    ? el("div", { class: "rv-brow" },
        el("span", { class: "rv-bk" }, label),
        el("span", { class: "rv-chips" },
          ...items.map((it) => el("span", { class: `rv-chip ${cls}` }, it))))
    : null;
  return el("aside", { class: "rv-brief" },
    el("div", { class: "rv-product" },
      el("img", { src: brief.image_url, alt: brief.product, loading: "lazy" })),
    el("div", { class: "rv-bhead" },
      el("div", { class: "rv-brand" }, brief.brand),
      el("div", { class: "rv-pname" }, brief.product)),
    el("div", { class: "rv-bbody" },
      row("Objective", brief.objectives),
      row("Audience", brief.audience),
      row("Key benefit", brief.key_benefit),
      row("Tone", brief.tone),
      chipRow("Must say", brief.required_claims, "yes"),
      chipRow("Don't say", brief.prohibited, "no")));
}

// ---- session load / route ---------------------------------------------------

async function load() {
  if (!code) { renderCodeEntry(); return; }
  let state;
  try {
    state = await api(`/api/review/session/${code}`);
  } catch (error) {
    renderCodeEntry(error);
    return;
  }
  document.getElementById("session-label").textContent = state.label;

  if (state.stage === "done") renderDone(state);
  else if (state.stage === "ab" && !introSeen.ab && state.ab.done === 0) renderAbIntro(state);
  else if (state.stage === "ab") renderPair(state);
  else if (state.stage === "rubric" && !introSeen.rubric && state.rubric.done === 0) renderRubricIntro(state);
  else renderRating(state);
}

function renderCodeEntry(error = null) {
  const input = el("input", {
    class: "rv-code-input",
    placeholder: "Session code", maxlength: "6", value: code,
    onkeydown: (event) => { if (event.key === "Enter") submit(); },
  });
  function submit() {
    code = input.value.trim().toUpperCase();
    history.replaceState(null, "", `?code=${code}`);
    load();
  }
  root.replaceChildren(centered(el("div", { class: "rv-intro rv-code" },
    el("div", { class: "rv-intro-eyebrow" }, "Campaign review"),
    el("h1", {}, "Enter your session code"),
    el("p", { class: "rv-intro-sub" }, "You received a six-character code with your invite."),
    error ? errorNote(error) : null,
    el("div", { class: "rv-code-row" },
      input, el("button", { class: "rv-start", onclick: submit }, "Continue")))));
}

// ---- intros -----------------------------------------------------------------

function renderAbIntro(state) {
  const mins = Math.max(1, Math.ceil(state.ab.total * 0.75));
  const twoParts = state.rubric.total > 0;
  root.replaceChildren(centered(el("div", { class: "rv-intro" },
    el("div", { class: "rv-intro-eyebrow" }, twoParts ? "Part 1 of 2" : "Campaign review"),
    el("h1", {}, "Which set is better?"),
    el("p", { class: "rv-intro-sub" },
      `${state.ab.total} pairs · about ${mins} min`
      + (twoParts ? " · part 2 rates single sets afterwards" : "")),
    el("div", { class: "rv-steps" },
      step("list", "Read the brief", "It stays pinned on the left the whole time."),
      step("layers", "Compare A and B", "Two campaign sets — Instagram, story, banner — for the same brief."),
      step("check-circle", "Pick the better set", "There is no tie. Go with your overall judgment.")),
    el("div", { class: "rv-kbdhint" },
      "Shortcut: press ", kbd("A"), " or ", kbd("B"), " · hover an image to enlarge it"),
    startBtn(() => { introSeen.ab = true; load(); }))));
}

function renderRubricIntro(state) {
  const mins = Math.max(1, Math.ceil(state.rubric.total * 0.5));
  root.replaceChildren(centered(el("div", { class: "rv-intro" },
    el("div", { class: "rv-intro-eyebrow" }, "Part 2 of 2"),
    el("h1", {}, "Rate single sets"),
    el("p", { class: "rv-intro-sub" },
      `${state.rubric.total} sets · about ${mins} min · score each from 0 (broken) to 5 (fully held)`),
    el("div", { class: "rv-steps rv-steps-pillars" },
      step("star", "Key message", "The set carries one message — the one the brief asks for."),
      step("layers", "Brand cues", "Consistent brand signals across all three formats."),
      step("edit", "Tone", "One tone and manner, the one the brief asks for.")),
    el("p", { class: "rv-note" },
      "The three formats are meant to look different; judge whether the campaign holds together across them."),
    startBtn(() => { introSeen.rubric = true; load(); }))));
}

// ---- undo toast -------------------------------------------------------------

function showUndoToast(label, pairId) {
  document.querySelector(".toast")?.remove();
  const toast = el("div", { class: "toast" },
    icon("check-circle", 15), `Recorded: ${label} is better`,
    el("button", {
      onclick: async () => {
        toast.remove();
        try {
          await api(`/api/review/session/${code}/vote/${pairId}`, { method: "DELETE" });
        } catch { /* already past the window */ }
        load();
      },
    }, "Undo"));
  document.body.append(toast);
  setTimeout(() => toast.remove(), 5000);
}

// ---- A/B pair ---------------------------------------------------------------

function renderPair(state) {
  const current = state.current;
  shownAt = performance.now();
  let submitting = false;  // keyboard auto-repeat must not double-vote

  async function vote(chosenSet, label) {
    if (submitting) return;
    submitting = true;
    for (const card of root.querySelectorAll(".rv-setcard")) card.classList.add("busy");
    try {
      await api(`/api/review/session/${code}/vote`, {
        method: "POST",
        body: {
          pair_id: current.pair_id,
          chosen_set: chosenSet,
          seconds: Math.round((performance.now() - shownAt) / 100) / 10,
        },
      });
      showUndoToast(label, current.pair_id);
    } catch (error) {
      alert(error.message);
    }
    load();
  }

  document.onkeydown = (event) => {
    if (event.repeat) return;
    if (event.key === "a" || event.key === "A") vote(current.left.set_id, "A");
    if (event.key === "b" || event.key === "B") vote(current.right.set_id, "B");
  };

  // The whole set card is the vote target; the grey footer says which choice a
  // click makes. A sits above B so the same format lines up vertically.
  const setCard = (letter, set) => {
    const card = el("div", {
      class: "rv-setcard", role: "button", tabindex: "0",
      "aria-label": `Set ${letter} is better`,
    },
      el("div", { class: "rv-setcard-arts" }, ...set.artifacts.map((a) => artTile(a))),
      el("div", { class: "rv-choose" },
        kbd(letter), el("span", {}, "is better"), icon("arrow-right", 15)));
    const go = () => vote(set.set_id, letter);
    card.addEventListener("click", go);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); go(); }
    });
    return card;
  };

  root.replaceChildren(
    progressBar(state),
    el("div", { class: "rv-stage rv-enter" },
      briefPanel(current.brief),
      el("div", { class: "rv-compare" },
        setCard("A", current.left),
        setCard("B", current.right))));
}

// ---- rubric rating ----------------------------------------------------------

function renderRating(state) {
  const current = state.current;
  const scores = { message: null, brand: null, tone: null };
  document.onkeydown = null;

  const pillars = [
    ["message", "Key message", "One message across the set, the one the brief asks for."],
    ["brand", "Brand cues", "Consistent brand signals: palette, logo, brand presence."],
    ["tone", "Tone", "One tone and manner, the one the brief asks for."],
  ];

  const submit = el("button", { class: "rv-submit", disabled: "" },
    "Submit scores", icon("arrow-right", 15));
  submit.addEventListener("click", async () => {
    submit.disabled = true;
    try {
      await api(`/api/review/session/${code}/rating`, {
        method: "POST",
        body: { set_id: current.set.set_id, ...scores },
      });
    } catch (error) {
      alert(error.message);
    }
    load();
  });

  function scaleRow(key, label, description) {
    const buttons = Array.from({ length: 6 }, (_, value) =>
      el("button", {
        class: "rv-seg",
        onclick: (event) => {
          scores[key] = value;
          for (const sibling of event.target.parentElement.children) sibling.classList.remove("sel");
          event.target.classList.add("sel");
          submit.disabled = Object.values(scores).some((v) => v === null);
        },
      }, String(value)));
    return el("div", { class: "rv-pillar" },
      el("div", { class: "rv-pillar-head" },
        el("strong", {}, label),
        el("span", { class: "rv-pillar-d" }, description)),
      el("div", { class: "rv-scale" }, ...buttons),
      el("div", { class: "rv-scale-ends" },
        el("span", {}, "0 · broken"), el("span", {}, "5 · fully held")));
  }

  root.replaceChildren(
    progressBar(state),
    el("div", { class: "rv-stage rv-enter" },
      briefPanel(current.brief),
      el("div", { class: "rv-rate" },
        el("div", { class: "rv-rate-arts" }, ...current.set.artifacts.map((a) => artTile(a, { showCaption: true }))),
        el("div", { class: "rv-pillars" }, ...pillars.map(([key, label, desc]) => scaleRow(key, label, desc))),
        el("div", { class: "rv-rate-foot" },
          el("span", { class: "rv-note" }, "Give all three scores to continue."),
          submit))));
}

// ---- done -------------------------------------------------------------------

function renderDone(state) {
  document.onkeydown = null;
  root.replaceChildren(centered(el("div", { class: "rv-intro rv-done" },
    el("div", { class: "rv-done-check" }, icon("check-circle", 44)),
    el("h1", {}, "All done"),
    el("p", { class: "rv-intro-sub" }, "Every item in this session is answered. Thank you."),
    el("div", { class: "rv-done-stats" },
      state.ab.total ? el("div", { class: "rv-done-stat" },
        el("span", { class: "rv-done-n" }, `${state.ab.done}/${state.ab.total}`),
        el("span", { class: "rv-done-l" }, "pairs compared")) : null,
      state.rubric.total ? el("div", { class: "rv-done-stat" },
        el("span", { class: "rv-done-n" }, `${state.rubric.done}/${state.rubric.total}`),
        el("span", { class: "rv-done-l" }, "sets rated")) : null))));
}

load();
