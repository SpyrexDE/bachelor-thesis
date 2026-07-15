import {
  PLATFORM_LABELS, api, el, emptyState, errorNote, fmt, openLightbox,
  statusBadge, topoChip,
} from "/api.js";
import { distStrip, roundCurve } from "/charts.js";
import { PLATFORM_ICONS, icon } from "/icons.js";
import {
  confirmDialog, copyMini, curveLegend, outputBlock, promptBlock, qClass, rampColor, skeleton, withTooltip,
} from "/ui.js";

const ROLE_ICONS = { orchestrator: "compass", producer: "edit", critic: "check-square", image: "image" };
const PLATFORM_ORDER = Object.keys(PLATFORM_LABELS);
// Canvas sizes are fixed per platform (concept/02); the stage sizes each
// column by this ratio so one shared height fits every frame to its artifact.
const PLATFORM_ASPECT = { instagram: 1440 / 1800, story: 1440 / 2560, banner: 300 / 250 };

export async function renderRuns(view, rest) {
  if (rest.length) return renderRunDetail(view, rest[0]);
  return renderRunList(view);
}

// Set the run-list filters from elsewhere (e.g. an Analysis point) and open it.
export function openRunsFiltered(filters) {
  for (const key of Object.keys(FILTERS)) FILTERS[key] = filters[key] ?? "";
  location.hash = "#/runs";
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// The matrix rule everywhere: per slot, the most recently created run counts.
// The API lists runs created_at DESC, so the first run per slot wins.
function countingRuns(runs) {
  const seen = new Set();
  const out = [];
  for (const run of runs) {
    const key = `${run.brief}|${run.topology}|${run.rep}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(run);
  }
  return out;
}

// ------------------------------------------------------------------ list ----

const FILTERS = { brief: "", topology: "", status: "" };
const FILTER_LABELS = { brief: "All briefs", topology: "All topologies", status: "All statuses" };
const SORT = { key: "created_at", dir: -1 };

function shortTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

// Colour is the pre-attentive channel, so it carries the score's goodness —
// a red or green outlier jumps out of the column where equal-length bars all
// looked the same. Quality metrics use their absolute scale (green = genuinely
// good); cost metrics normalise within the column (green = cheapest in the
// field), since there is no absolute "good latency".
function heatBucket(value, { absMax, min, max, higher }) {
  if (value === null || value === undefined) return 0;
  let norm = absMax != null ? value / absMax : (max > min ? (value - min) / (max - min) : 0.5);
  if (!higher) norm = 1 - norm;
  return Math.max(0, Math.min(5, Math.round(norm * 5)));
}

function heatCell(value, q, { digits = 2, suffix = "" } = {}) {
  if (value === null || value === undefined) return el("td", { class: "num muted" }, "—");
  return el("td", { class: "num" },
    el("span", { class: `heatnum q${q}` }, fmt(value, digits) + suffix));
}

function setThumbs(run) {
  if (run.final_round === null || run.final_round === undefined || run.status !== "done") {
    return el("span", { class: "run-thumbs", "aria-hidden": "true" },
      ...PLATFORM_ORDER.map(() => el("span", { class: "none" })));
  }
  // Eager: these are tiny and above the fold on first paint; lazy made them
  // flash empty as the table rendered.
  return el("span", { class: "run-thumbs" }, ...PLATFORM_ORDER.map((platform) =>
    el("img", {
      src: `/api/artifacts/${run.id}/${platform}/${run.final_round}`,
      alt: "", title: PLATFORM_LABELS[platform],
    })));
}

async function renderRunList(view) {
  view.replaceChildren(el("div", { class: "card" }, skeleton("row", 8)));

  async function load() {
    const query = Object.entries(FILTERS).filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
    let runs;
    try {
      runs = await api(`/api/runs${query ? `?${query}` : ""}`);
    } catch (error) {
      view.replaceChildren(el("div", { class: "card" }, errorNote(error)));
      return;
    }

    runs.sort((a, b) => {
      const get = (r) => (SORT.key === "created_at" ? r.created_at : r.metrics[SORT.key] ?? -Infinity);
      const av = get(a); const bv = get(b);
      return (av < bv ? -1 : av > bv ? 1 : 0) * SORT.dir;
    });

    const filtered = Object.values(FILTERS).some(Boolean);
    const table = runs.length ? runTable(runs)
      : filtered
        ? el("div", { class: "empty" },
            el("p", {}, "No runs match these filters."),
            el("button", {
              onclick: () => { for (const k of Object.keys(FILTERS)) FILTERS[k] = ""; load(); },
            }, "Clear filters"))
        : emptyState("No runs yet. Start them from the Matrix tab.");

    view.replaceChildren(el("div", { class: "card" },
      el("div", { class: "row spread" },
        el("div", {},
          el("h1", {}, icon("list", 16), "Runs"),
          el("p", { class: "section-note", style: "margin-bottom:0" },
            `${runs.length} run${runs.length === 1 ? "" : "s"}${filtered ? " matching filters" : ""}`)),
        el("div", { class: "row" }, ...filterControls())),
      table));
  }

  function sortHeader(key, label, extraClass = "num") {
    const active = SORT.key === key;
    return el("th", {
      class: `${extraClass} sortable`,
      onclick: () => {
        if (SORT.key === key) SORT.dir *= -1; else { SORT.key = key; SORT.dir = -1; }
        load();
      },
    }, label, active ? icon(SORT.dir < 0 ? "arrow-down" : "arrow-up", 12) : "");
  }

  function runTable(runs) {
    // Cost metrics have no absolute scale, so their heat is relative to the
    // column's own spread (cheapest = green, dearest = red).
    const range = (key) => {
      const vals = runs.map((r) => r.metrics[key]).filter((v) => v != null);
      return vals.length ? { min: Math.min(...vals), max: Math.max(...vals) } : { min: 0, max: 1 };
    };
    const taxR = range("tax"); const latR = range("latency");
    return el("table", {},
      el("thead", {}, el("tr", {},
        el("th", {}, "Set"),
        el("th", {}, "Run"),
        el("th", {}, "Status"),
        sortHeader("coherence", "Coherence"),
        sortHeader("viescore", "VIEScore"),
        sortHeader("tax", "Coord. tax"),
        sortHeader("latency", "Latency"),
        sortHeader("spec", "Spec"),
        sortHeader("created_at", "Created", ""))),
      el("tbody", {}, ...runs.map((run) => {
        const m = run.metrics;
        return el("tr", { class: "click", onclick: () => { location.hash = `#/runs/${run.id}`; } },
          el("td", {}, setThumbs(run)),
          el("td", {}, el("span", { class: "runid-cell" },
            topoChip(run.topology),
            el("a", { class: "mono", href: `#/runs/${run.id}`, onclick: (e) => e.stopPropagation() }, run.id))),
          el("td", {}, statusBadge(run.status)),
          coherenceCell(m.coherence),
          heatCell(m.viescore, heatBucket(m.viescore, { absMax: 10, higher: true }), { digits: 2 }),
          heatCell(m.tax, heatBucket(m.tax, { ...taxR, higher: false }), { digits: 3 }),
          heatCell(m.latency, heatBucket(m.latency, { ...latR, higher: false }), { digits: 1, suffix: "s" }),
          heatCell(m.spec, heatBucket(m.spec, { absMax: 1, higher: true }), { digits: 2 }),
          el("td", { class: "small muted" }, shortTime(run.created_at)));
      })));
  }

  function coherenceCell(c) {
    if (c === null || c === undefined) return el("td", { class: "num muted" }, "—");
    return el("td", { class: "num" },
      el("span", { class: `tag ${qClass(c)}`, style: "min-width:34px;justify-content:center;font-variant-numeric:tabular-nums" },
        fmt(c, 1)));
  }

  function filterControls() {
    const select = (name, options) =>
      el("select", { onchange: (e) => { FILTERS[name] = e.target.value; load(); } },
        el("option", { value: "" }, FILTER_LABELS[name]),
        ...options.map((o) => el("option", { value: o, selected: FILTERS[name] === o ? "" : null }, o)));
    return [
      select("brief", ["persil", "schwarzkopf", "loctite"]),
      select("topology", ["monolithic", "independent", "coarse", "fine"]),
      select("status", ["done", "running", "queued", "failed"]),
    ];
  }

  await load();
  return null;
}

// ---------------------------------------------------------------- detail ----
// One viewport, three regions: the artifact set (stage), the verdict beside it
// (rail), execution and round history in a drawer. Numbers stay attached to
// the artifacts they judge; depth comes from drilling, not from scrolling.

const METRIC_TILES = [
  { key: "viescore", label: "VIEScore", icon: "star", digits: 2, unit: "/ 10 set avg", higher: true },
  { key: "tax", label: "Coordination tax", icon: "percent", digits: 3, unit: "token share", higher: false },
  { key: "latency", label: "Latency", icon: "clock", digits: 1, unit: "s modeled (D4)", higher: false },
  { key: "spec", label: "Spec compliance", icon: "check-square", digits: 2, unit: "checks passed", higher: true },
];

async function renderRunDetail(view, runId) {
  const main = document.querySelector("main");
  main.classList.add("cockpit");
  view.replaceChildren(el("div", { class: "card" }, skeleton("row", 4)));

  let timer = null;
  let briefsById = null;
  // Drill state survives live-poll redraws: shown round, selected artifact, drawer tab.
  const ui = { round: null, sel: null, tab: null };

  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
  const cleanup = () => { stop(); main.classList.remove("cockpit"); };

  async function draw() {
    let run, allRuns;
    try {
      [run, allRuns] = await Promise.all([api(`/api/runs/${runId}`), api("/api/runs")]);
      if (!briefsById) {
        briefsById = Object.fromEntries((await api("/api/briefs")).map((b) => [b.id, b]));
      }
    } catch (error) {
      stop();
      view.replaceChildren(el("div", { class: "card" }, errorNote(error)));
      return;
    }

    const metricsByKey = {};
    for (const m of run.metric_details) metricsByKey[`${m.metric}:${m.scope}`] = m;
    const rounds = [...new Set(run.artifacts.map((a) => a.round))].sort((a, b) => a - b);
    const finalRound = run.artifacts.find((a) => a.is_final)?.round ?? rounds[rounds.length - 1] ?? 0;
    if (ui.round !== null && !rounds.includes(ui.round)) ui.round = null;
    const counting = countingRuns(allRuns);
    const field = Object.fromEntries(["coherence", ...METRIC_TILES.map((t) => t.key)].map((key) => [
      key,
      counting.filter((r) => r.id !== run.id && r.status === "done" && r.metrics[key] != null)
        .map((r) => r.metrics[key]),
    ]));
    const brief = briefsById[run.brief];

    const stage = el("div", { class: "card rd-stage" });
    const drawer = el("div", { class: "card rd-drawer" });
    const rail = el("div", { class: "rd-rail" });

    const renderStage = () => drawStage(stage, run, brief, rounds, finalRound, metricsByKey, ui, {
      onRound: () => { ui.sel = null; renderStage(); renderRail(); },
      onSelect: () => { renderStage(); renderRail(); },
    });
    const renderRail = () => drawRail(rail, run, metricsByKey, field, ui, {
      finalRound,
      onBack: () => { ui.sel = null; renderStage(); renderRail(); },
      goDelivered: () => { ui.round = null; renderStage(); renderRail(); },
    });
    const renderDrawer = () => drawDrawer(drawer, run, rounds, finalRound, metricsByKey, ui, renderDrawer);

    renderStage(); renderRail(); renderDrawer();
    view.replaceChildren(el("div", { class: "rd" },
      headCard(run, allRuns),
      el("div", { class: "rd-left" }, stage, drawer),
      rail));

    const live = run.status === "running" || run.status === "queued";
    if (live && !timer) timer = setInterval(draw, 1500);
    if (!live) stop();
  }

  // ---- header strip -----------------------------------------------------

  function headCard(run, allRuns) {
    const siblings = allRuns.filter((r) => r.brief === run.brief && r.topology === run.topology);
    const byRep = {};
    for (const s of siblings) if (!byRep[s.rep]) byRep[s.rep] = s; // created_at DESC: first = counting
    const superseded = byRep[run.rep] && byRep[run.rep].id !== run.id;

    const repnav = el("span", { class: "repnav" }, el("span", { class: "lbl" }, "rep"),
      ...[1, 2, 3].map((rep) => {
        const target = byRep[rep];
        if (!target) return el("span", { class: "ghost", title: `rep ${rep}: not run` }, rep);
        return el("a", { class: rep === run.rep ? "cur" : "", href: `#/runs/${target.id}` }, rep);
      }));

    return el("div", { class: "card rd-head" },
      el("div", { class: "crumb" },
        el("a", { href: "#/matrix" }, icon("grid", 13), " Matrix"),
        el("span", { class: "sep" }, "/"),
        el("span", {}, el("strong", {}, run.brief), " "), topoChip(run.topology),
        el("span", { class: "sep" }, "/"), repnav,
        el("span", { class: "sep" }, "/"),
        el("span", { class: "mono muted" }, run.id)),
      statusBadge(run.status),
      superseded
        ? el("span", { class: "supersede" }, "superseded — ",
            el("a", { href: `#/runs/${byRep[run.rep].id}` }, "open the counting run"))
        : null,
      el("div", { class: "actions" },
        el("span", { class: "mono small muted", title: "run seed (concept/02: reproducible)" }, `seed ${run.seed}`),
        actionButton("refresh", "Re-run (same seed)", () => rerun(true)),
        actionButton("play", "Re-run (new seed)", () => rerun(false)),
        actionButton("chart", "Recompute", recompute),
        el("button", { class: "danger", onclick: remove }, icon("trash", 13), "Delete")));
  }

  async function rerun(reuseSeed) {
    const result = await api(`/api/runs/${runId}/rerun`, { method: "POST", body: { reuse_seed: reuseSeed } });
    location.hash = `#/runs/${result.runs[0]}`;
  }
  async function recompute() { await api(`/api/runs/${runId}/recompute`, { method: "POST" }); draw(); }
  async function remove() {
    const ok = await confirmDialog({
      title: `Delete ${runId}?`, message: "The run and its artifacts are removed.",
      confirmLabel: "Delete", danger: true,
    });
    if (!ok) return;
    try { await api(`/api/runs/${runId}`, { method: "DELETE" }); location.hash = "#/runs"; }
    catch (error) { await confirmDialog({ title: "Could not delete", message: error.message, confirmLabel: "OK" }); }
  }
  function actionButton(iconName, label, handler) {
    return el("button", {
      onclick: async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        try { await handler(); } catch (error) {
          await confirmDialog({ title: "Action failed", message: error.message, confirmLabel: "OK" });
        }
        button.disabled = false;
      },
    }, icon(iconName, 13), label);
  }

  await draw();
  return cleanup;
}

// ---- stage: the artifact set, always on screen ---------------------------

function galleryGrid(platforms, children) {
  const cols = platforms.map((p) => `${(PLATFORM_ASPECT[p] ?? 1).toFixed(4)}fr`).join(" ");
  const sumar = platforms.reduce((s, p) => s + (PLATFORM_ASPECT[p] ?? 1), 0);
  return el("div", { class: "rd-gallery" },
    el("div", { class: "rd-arts", style: `--cols:${cols};--sumar:${sumar.toFixed(4)}` }, ...children));
}

function drawStage(card, run, brief, rounds, finalRound, metricsByKey, ui, on) {
  const shownRound = ui.round ?? finalRound;
  const isFinal = shownRound === finalRound;

  const briefCue = withTooltip(
    el("span", { class: "brief-cue" }, `${brief.brand} · ${brief.product}`),
    () => [
      el("b", {}, "Required claims"), el("br", {}),
      ...brief.required_claims.flatMap((c) => [`· ${c}`, el("br", {})]),
      el("b", {}, "Prohibited"), el("br", {}),
      ...brief.prohibited_wording.flatMap((w) => [`· ${w}`, el("br", {})]),
    ]);

  const scrubber = rounds.length > 1
    ? el("span", { class: "rseg", role: "group", "aria-label": "round" },
        ...rounds.map((round) => el("button", {
          class: round === shownRound ? "on" : "",
          title: round === finalRound ? `round ${round} — delivered` : `round ${round} (draft)`,
          onclick: () => { ui.round = round === finalRound ? null : round; on.onRound(); },
        }, String(round), round === finalRound ? el("span", { class: "dot" }) : null)))
    : null;

  const head = el("div", { class: "rd-stage-head" },
    el("h2", {}, "Artifact set"),
    briefCue,
    el("span", { style: "flex:1" }),
    !isFinal ? el("span", { class: "badge warn" }, icon("clock", 11), `draft — delivered is round ${finalRound}`) : null,
    scrubber);

  if (run.status === "failed" && !run.artifacts.length) {
    card.replaceChildren(head, el("div", { class: "empty", style: "margin:auto" },
      icon("alert", 28), el("p", {}, run.error ?? "run failed before producing artifacts")));
    return;
  }
  if (!run.artifacts.length) {
    card.replaceChildren(head, galleryGrid(PLATFORM_ORDER,
      PLATFORM_ORDER.map((p) => el("div", {
        class: "skel", style: `aspect-ratio:${PLATFORM_ASPECT[p]};width:100%`,
      }))));
    return;
  }

  const shown = run.artifacts
    .filter((a) => a.round === shownRound)
    .sort((a, b) => PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform));

  const tiles = shown.map((artifact) => {
    const src = `/api/artifacts/${run.id}/${artifact.platform}/${artifact.round}`;
    const vie = metricsByKey[`viescore:${artifact.platform}`];
    const spec = metricsByKey[`spec:${artifact.platform}`];
    const fails = spec ? spec.detail.checks.filter((c) => !c.passed).length : null;
    const selected = ui.sel === artifact.platform;

    const chips = isFinal && run.status === "done" ? el("span", { class: "chips" },
      vie ? el("span", {
        class: `mini-badge ${qClass(vie.value / 2)}`, title: "VIEScore 0–10 — quality heat, same scale as the verdict",
      }, `VIE ${fmt(vie.value, 1)}`) : null,
      fails === null ? null
        : fails === 0
          ? el("span", { class: "mini-badge good", title: "all spec checks pass" }, icon("check", 10), " spec")
          : el("span", { class: "mini-badge bad" }, icon("alert", 10), ` ${fails} fail${fails > 1 ? "s" : ""}`))
      : null;

    const tile = el("div", {
      class: `rd-art${selected ? " sel" : ""}`,
      role: "button", tabindex: "0",
      "aria-pressed": selected ? "true" : "false",
      "aria-label": `${PLATFORM_LABELS[artifact.platform]} — ${selected ? "deselect" : "inspect"}`,
    },
      el("div", { class: "frame", style: `--ar:${PLATFORM_ASPECT[artifact.platform] ?? 1}` },
        // Eager: only three, always in view; lazy made them flash empty on round switch.
        el("img", { src, alt: PLATFORM_LABELS[artifact.platform] }),
        el("button", {
          class: "zoom", title: "Enlarge", "aria-label": "Enlarge",
          onclick: (e) => { e.stopPropagation(); openLightbox(src); },
        }, icon("maximize", 13))),
      el("div", { class: "foot" },
        el("span", { class: "name" }, icon(PLATFORM_ICONS[artifact.platform] ?? "banner", 13),
          PLATFORM_LABELS[artifact.platform]),
        chips));
    const toggle = () => { ui.sel = selected ? null : artifact.platform; on.onSelect(); };
    tile.addEventListener("click", toggle);
    tile.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });
    return tile;
  });

  card.replaceChildren(head, galleryGrid(shown.map((a) => a.platform), tiles));
}

// ---- rail: the verdict, and the drill-down for one artifact --------------

// The rail is a column of separate cards, never one shared panel. It always
// holds the set-verdict card; selecting an artifact pops a distinct detail
// card *above* it, wearing the accent selection outline of its stage tile — so
// the two scopes read as two things and the drill-down is never mistaken for
// the set's own numbers.
function drawRail(rail, run, metricsByKey, field, ui, on) {
  const setCard = el("div", { class: "card rd-setcard" },
    ...buildSetVerdict(run, metricsByKey, field, Boolean(ui.sel)));
  if (ui.sel) {
    rail.replaceChildren(buildArtifactPanel(run, metricsByKey, ui, on), setCard);
  } else {
    rail.replaceChildren(setCard);
  }
}

function buildSetVerdict(run, metricsByKey, field, drilled) {
  const coherence = metricsByKey["coherence:set"];
  const c = coherence ? coherence.value : null;
  const med = median(field.coherence);
  const pct = beats(field.coherence, c, true);

  const hero = el("div", { class: `rd-hero ${c === null ? "muted-hero" : qClass(c)}` },
    el("div", {}, el("span", { class: "v" }, c === null ? "—" : fmt(c, 1)), el("span", { class: "of" }, " / 5")),
    el("div", {},
      el("div", { class: "lab" }, "Set coherence"),
      el("div", { class: "sub" }, "min over pillars — one broken pillar caps the set"),
      c !== null && med !== null
        ? el("div", { class: "sub" }, `matrix median ${fmt(med, 1)} · above ${pct}% of ${field.coherence.length} runs`)
        : null));

  const pillars = [];
  if (coherence) {
    const limit = coherence.value;
    const scores = Object.values(coherence.detail.pillars);
    // Tagging every pillar when all score alike says nothing; the tag marks
    // the pillar that actually binds the min (concept/03).
    const spread = Math.min(...scores) !== Math.max(...scores);
    for (const [pillar, score] of Object.entries(coherence.detail.pillars)) {
      const limiting = spread && score === limit;
      const just = el("div", { class: "rp-just", hidden: "" }, coherence.detail.justifications[pillar]);
      const chev = icon("chevron-right", 11);
      chev.classList.add("chev");
      const row = el("div", {
        class: `rp${limiting ? " limiting" : ""}`, role: "button", tabindex: "0",
        title: "judge justification",
      },
        el("span", { class: "pname" }, chev, pillar.replace(/_/g, " "),
          limiting ? el("span", { class: "limit-tag" }, "limits") : null),
        el("span", { class: "bar" }, el("span", { style: `width:${(score / 5) * 100}%;background:${rampColor(score / 5)}` })),
        el("span", { class: "val" }, String(score)));
      const toggle = () => {
        const open = just.hasAttribute("hidden");
        if (open) just.removeAttribute("hidden"); else just.setAttribute("hidden", "");
        row.classList.toggle("open", open);
      };
      row.addEventListener("click", toggle);
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
      });
      pillars.push(row, just);
    }
  }

  const tiles = METRIC_TILES.map((def) => {
    const metric = metricsByKey[`${def.key}:set`];
    const v = metric ? metric.value : null;
    const values = field[def.key];
    const tile = el("div", { class: "rd-tile" },
      el("div", { class: "k" }, icon(def.icon, 11), def.label),
      el("div", { class: "v" }, v === null ? "—" : fmt(v, def.digits), el("span", { class: "u" }, def.unit)),
      v !== null && values.length ? distStrip(values, v) : null);
    if (v !== null && values.length) {
      withTooltip(tile, () => [
        el("b", {}, def.label), el("br", {}),
        `this run ${fmt(v, def.digits)} · matrix median ${fmt(median(values), def.digits)}`, el("br", {}),
        `${def.higher ? "above" : "below"} ${beats(values, v, def.higher)}% of ${values.length} runs · ${def.higher ? "higher" : "lower"} is better`,
      ]);
    }
    return tile;
  });

  return [
    drilled ? el("div", { class: "rail-scope" }, "Set verdict — the whole set") : null,
    hero,
    pillars.length ? el("div", {}, ...pillars) : null,
    el("hr", { class: "rail-sep" }),
    el("div", { class: "rd-tiles" }, ...tiles),
    run.status !== "done"
      ? el("p", { class: "small muted", style: "margin-top:4px" }, "Metrics appear once the run finishes.")
      : null,
  ].filter(Boolean);
}

function buildArtifactPanel(run, metricsByKey, ui, on) {
  const platform = ui.sel;
  const shownRound = ui.round ?? on.finalRound;
  const isFinal = shownRound === on.finalRound;
  const artifact = run.artifacts.find((a) => a.platform === platform && a.round === shownRound)
    ?? run.artifacts.find((a) => a.platform === platform && a.is_final);
  const vie = isFinal ? metricsByKey[`viescore:${platform}`] : null;
  const spec = isFinal ? metricsByKey[`spec:${platform}`] : null;

  const head = el("div", { class: "rd-panel-head" },
    el("span", { class: "scope-tag" }, "Artifact"),
    el("span", { class: "t" }, icon(PLATFORM_ICONS[platform] ?? "banner", 14), PLATFORM_LABELS[platform]),
    el("button", {
      class: "x", title: "Close artifact detail", "aria-label": "Close artifact detail",
      onclick: on.onBack,
    }, icon("x-circle", 15)));

  const blocks = [head];

  if (!isFinal) {
    blocks.push(el("p", { class: "small muted", style: "margin:6px 0 0" },
      `Round ${shownRound} is a draft; the verdict judges the delivered round. `,
      el("a", {
        href: "#",
        onclick: (e) => { e.preventDefault(); on.goDelivered(); },
      }, `View round ${on.finalRound}`)));
  }

  if (vie) {
    const sc = vie.detail.semantic_consistency;
    const pq = vie.detail.perceptual_quality;
    const minSC = Math.min(...Object.values(sc));
    const minPQ = Math.min(...Object.values(pq));
    blocks.push(
      el("div", { class: `rd-hero ${qClass(vie.value / 2)}`, style: "margin-top:8px" },
        el("div", {}, el("span", { class: "v" }, fmt(vie.value, 1)), el("span", { class: "of" }, " / 10")),
        el("div", {},
          el("div", { class: "lab" }, "VIEScore"),
          el("div", { class: "sub" }, `√(min SC × min PQ) = √(${minSC} × ${minPQ})`))),
      axisGroup("Semantic consistency", sc, vie.detail.rationales, minSC, minSC <= minPQ),
      axisGroup("Perceptual quality", pq, vie.detail.rationales, minPQ, minPQ <= minSC));
  }

  if (spec) {
    const checks = [...spec.detail.checks].sort((a, b) => a.passed - b.passed);
    const fails = checks.filter((c) => !c.passed);
    const passes = checks.filter((c) => c.passed);
    blocks.push(el("div", { class: `spec-row ${fails.length ? "bad" : "ok"}` },
      icon(fails.length ? "alert" : "check-circle", 14),
      `Spec ${passes.length}/${checks.length}`));
    if (fails.length) {
      blocks.push(
        el("div", { class: "checks" },
          ...fails.map((check) =>
            el("div", { class: "check-line fail" },
              el("span", { class: "badge bad" }, "fail"),
              el("span", {}, check.check, check.note ? el("span", { class: "muted" }, ` — ${check.note}`) : null)))),
        el("details", {}, el("summary", {}, `${passes.length} passing checks`),
          el("div", { class: "checks", style: "margin-top:6px" },
            ...passes.map((check) => el("div", { class: "check-line" },
              el("span", { class: "badge ok" }, "pass"), el("span", {}, check.check))))));
    }
  }

  if (!vie && !spec && isFinal) {
    blocks.push(el("p", { class: "small muted" },
      run.status === "done" ? "No per-artifact metrics stored — recompute the run." : "Judged once the run finishes."));
  }

  return el("div", { class: "card rd-artpanel" }, ...blocks.filter(Boolean));
}

// The axis minimum is what enters O = √(minSC × minPQ); the binding axis
// carries the warn tone so the constraint is visible before reading.
function axisGroup(label, scores, rationales, minVal, binding) {
  const rows = Object.entries(scores ?? {}).flatMap(([key, value]) => {
    const row = el("div", { class: "sub10" },
      el("span", { class: "sname" }, key.replace(/_/g, " ")),
      el("span", { class: "bar" }, el("span", { style: `width:${(value / 10) * 100}%;background:${rampColor(value / 10)}` })),
      el("span", { class: "val" }, String(value)));
    const why = rationales?.[key];
    return why ? [row, el("div", { class: "rationale" }, why)] : [row];
  });
  return el("div", {},
    el("div", { class: "axis-head" }, label,
      el("span", {
        class: `amin${binding ? " binding" : ""}`,
        title: "the axis minimum enters the VIEScore",
      }, `min ${minVal}`)),
    ...rows);
}

function beats(values, mine, higher) {
  if (!values.length || mine === null || mine === undefined) return null;
  const b = values.filter((v) => (higher ? mine > v : mine < v)).length;
  return Math.round((b / values.length) * 100);
}

// ---- drawer: execution & rounds drill-down --------------------------------

function drawDrawer(card, run, rounds, finalRound, metricsByKey, ui, rerender) {
  const tabs = [{ key: "exec", label: "Execution", icon: "activity" }];
  if (rounds.length > 1) tabs.push({ key: "rounds", label: "Rounds", icon: "refresh" });
  if (ui.tab && !tabs.some((t) => t.key === ui.tab)) ui.tab = null;

  const tokens = { production: 0, coordination: 0, image: 0 };
  for (const call of run.calls) tokens[barClass(call)] += call.tokens_in + call.tokens_out;
  const total = tokens.production + tokens.coordination + tokens.image;
  const latency = metricsByKey["latency:set"]?.value ?? null;
  const tax = metricsByKey["tax:set"]?.value ?? null;

  const share = total ? el("span", { class: "sharebar", title: "token share: production / coordination / image" },
    el("i", { style: `width:${(tokens.production / total) * 100}%;background:var(--accent)` }),
    el("i", { style: `width:${(tokens.coordination / total) * 100}%;background:var(--warn)` }),
    el("i", { style: `width:${(tokens.image / total) * 100}%;background:#7d8aa8` })) : null;

  const bar = el("div", { class: "drawbar" },
    ...tabs.map((tab) => el("button", {
      class: `tabbtn${ui.tab === tab.key ? " on" : ""}`,
      "aria-expanded": ui.tab === tab.key ? "true" : "false",
      onclick: () => { ui.tab = ui.tab === tab.key ? null : tab.key; rerender(); },
    }, icon(tab.icon, 13), tab.label)),
    el("span", { class: "sum" },
      share,
      el("span", {},
        `${run.calls.length} calls · ${rounds.length || 1} round${rounds.length > 1 ? "s" : ""}`
        + (latency !== null ? ` · ${fmt(latency, 1)}s modeled` : "")
        + (tax !== null ? ` · ${Math.round(tax * 100)}% coordination` : ""))));

  card.classList.toggle("open", Boolean(ui.tab));
  const body = ui.tab
    ? el("div", { class: "body" }, ui.tab === "exec"
        ? execBody(run)
        : roundsBody(run, rounds, finalRound, metricsByKey))
    : null;
  card.replaceChildren(...[bar, body].filter(Boolean));
}

function execBody(run) {
  if (!run.calls.length) return emptyState("No calls recorded yet.", "activity");
  // The timeline and the payload table are one thing: clicking a bar reveals
  // that call's row below (ui-method §4 — link what you can act on).
  const trace = traceTable(run.calls);
  return el("div", {},
    el("p", { class: "section-note" },
      "Each model call on the run's timeline — parallel bars ran at once, chained bars waited. ",
      "Click a bar or a row for the exact prompt and structured output."),
    gantt(run.calls, trace.reveal),
    trace.table);
}

function roundsBody(run, rounds, finalRound, metricsByKey) {
  const points = rounds.map((round) => ({
    round,
    coherence: metricsByKey[`coherence:round:${round}`]?.value
      ?? (round === finalRound ? metricsByKey["coherence:set"]?.value : null),
    proxy: metricsByKey[`proxy:round:${round}`]?.value ?? null,
  })).filter((p) => p.coherence !== null && p.coherence !== undefined);
  if (points.length < 2) {
    return emptyState("Per-round scores exist for Fine runs with more than one round.", "refresh");
  }
  const best = points.reduce((a, b) => (b.coherence > a.coherence ? b : a));
  // A two-to-three point curve does not deserve full bleed; it is a focused
  // panel, capped and centred, its side space deliberate margin (like the stage).
  const fact = (k, v) => el("div", { class: "rf" }, el("span", { class: "k" }, k), el("span", { class: "v" }, v));
  return el("div", { class: "rounds-panel" },
    el("div", { class: "rounds-chart" }, roundCurve(points, finalRound, best.round)),
    el("div", { class: "rounds-side" },
      el("div", { class: "rounds-facts" },
        fact("delivered", `round ${finalRound}`),
        fact("best round", best.round === finalRound ? "= delivered" : `round ${best.round} · ${fmt(best.coherence, 1)}`),
        fact("stop", run.stop_reason ?? "—")),
      curveLegend()));
}

// ---- trace: Gantt + expandable payload rows (drawer content) --------------

function barClass(call) {
  if (call.role === "image") return "image";
  return call.purpose === "coordination" ? "coordination" : "production";
}

function gantt(calls, onPick) {
  const span = Math.max(...calls.map((c) => c.ended_s), 1);
  const rows = calls.map((call) => {
    const left = (call.started_s / span) * 100;
    const width = Math.max(1.5, ((call.ended_s - call.started_s) / span) * 100);
    const bar = el("div", {
      class: `gantt-bar ${barClass(call)}`,
      style: `left:${left}%;width:${width}%`,
    }, `${fmt(call.duration_s, 1)}s`);
    withTooltip(bar, () => [
      el("b", {}, call.agent), el("br", {}),
      el("span", { class: "k" }, "purpose "), call.purpose, el("br", {}),
      el("span", { class: "k" }, "round "), String(call.round),
      el("span", { class: "k" }, "  ·  window "), `${fmt(call.started_s, 1)}–${fmt(call.ended_s, 1)}s`, el("br", {}),
      el("span", { class: "k" }, "tokens "), `${call.tokens_in}/${call.tokens_out}`, el("br", {}),
      el("span", { class: "k" }, "click "), "open this call below",
    ]);
    const row = el("div", {
      class: `gantt-row${onPick ? " click" : ""}`, role: "button", tabindex: "0",
      "aria-label": `${call.agent} — open call #${call.idx}`,
    },
      el("span", { class: "who" }, icon(ROLE_ICONS[call.role] ?? "cpu", 12), ` ${call.agent}`),
      el("div", { class: "gantt-track" }, bar),
      el("span", { class: "gantt-dur" }, `${fmt(call.ended_s, 1)}s`));
    if (onPick) {
      const go = () => onPick(call.idx);
      row.addEventListener("click", go);
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
      });
    }
    return row;
  });
  return el("div", {},
    el("div", { class: "gantt" }, ...rows),
    el("div", { class: "gantt-legend" },
      legendKey("var(--accent)", "production"),
      legendKey("var(--warn)", "coordination"),
      legendKey("#7d8aa8", "image")));
}

function legendKey(color, label) {
  return el("span", { class: "k" }, el("span", { class: "sw", style: `background:${color}` }), label);
}

function traceTable(calls) {
  const body = el("tbody", {});
  const rowByIdx = new Map();
  for (const call of calls) {
    const payload = el("tr", { class: "payload-row", hidden: "" },
      el("td", { class: "payload-cell", colspan: "7" }, payloadPanel(call)));
    const chev = icon("chevron-right", 13);
    chev.classList.add("chev");
    const mainRow = el("tr", { class: "trace-row" },
      el("td", { class: "chevcell" }, chev),
      el("td", { class: "num muted" }, String(call.idx)),
      el("td", { class: "mono" }, call.agent),
      el("td", {}, el("span", { class: `badge ${call.purpose === "coordination" ? "warn" : "plain"}` }, call.purpose)),
      el("td", { class: "num" }, String(call.round)),
      el("td", { class: "num mono" }, `${call.tokens_in}/${call.tokens_out}`),
      el("td", { class: "num" }, `${fmt(call.duration_s, 1)}s`));
    const setOpen = (open) => {
      if (open) payload.removeAttribute("hidden"); else payload.setAttribute("hidden", "");
      mainRow.classList.toggle("open", open);
    };
    mainRow.addEventListener("click", () => setOpen(payload.hasAttribute("hidden")));
    rowByIdx.set(call.idx, { mainRow, setOpen });
    body.append(mainRow, payload);
  }
  const table = el("table", { class: "trace-table", style: "margin-top:14px" },
    el("thead", {}, el("tr", {},
      el("th", {}, ""), el("th", {}, "#"), el("th", {}, "Agent"), el("th", {}, "Purpose"),
      el("th", { class: "num" }, "Round"), el("th", { class: "num" }, "Tokens in/out"),
      el("th", { class: "num" }, "Duration"))),
    body);
  // Reveal a call from the timeline: open its row, bring it into view, flash it.
  const reveal = (idx) => {
    const entry = rowByIdx.get(idx);
    if (!entry) return;
    entry.setOpen(true);
    entry.mainRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
    entry.mainRow.classList.remove("flash");
    void entry.mainRow.offsetWidth; // reflow so a repeat click retriggers the animation
    entry.mainRow.classList.add("flash");
  };
  return { table, reveal };
}

function payloadPanel(call) {
  const meta = el("div", { class: "small muted mono" },
    `seed ${call.seed} · window ${fmt(call.started_s, 1)}–${fmt(call.ended_s, 1)}s`
    + (call.parents.length ? ` · waited on #${call.parents.join(", #")}` : " · no dependencies"));
  const parts = [meta];
  if (call.prompt) {
    parts.push(el("div", {},
      el("h4", {}, icon("corner-down-right", 12), " Prompt the agent received",
        el("span", { style: "margin-left:auto" }, copyMini(() => call.prompt))),
      promptBlock(call.prompt)));
  }
  parts.push(el("div", {},
    el("h4", {}, icon("cpu", 12), " Structured output",
      call.output ? el("span", { style: "margin-left:auto" }, copyMini(() => call.output)) : null),
    outputBlock(call.output)));
  if (!call.prompt && !call.output) {
    return el("div", { class: "payload" },
      el("div", { class: "small muted" }, "No payload captured for this call (older run — re-run to capture)."));
  }
  return el("div", { class: "payload" }, ...parts);
}
