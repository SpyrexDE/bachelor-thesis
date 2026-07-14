import { PLATFORM_LABELS, TOPOLOGY_LABELS, api, el, errorNote, fmt, topoChip } from "/api.js";
import { icon } from "/icons.js";
import { confirmDialog, qClass, skeleton, withTooltip } from "/ui.js";
import { openRunsFiltered } from "/views/runs.js";

const CHIP_ICONS = { running: "activity", queued: "clock", failed: "alert" };
const PLATFORM_ORDER = Object.keys(PLATFORM_LABELS);

// Medians beside the grid: coherence carries the colour, the rest give the
// cost/quality context without leaving the page (deep dive: Analysis).
// `pareto` marks the trade-off axes: two quality (coherence, VIEScore) and two
// cost (tax, latency). Spec compliance stays off the Pareto axes (Analysis:
// "Spec compliance stays off the Pareto axes") — a pass/fail code check, not a
// smooth trade-off, so it is context only and never marks a winner.
const SCORE_COLS = [
  { key: "viescore", label: "VIE", higher: true, pareto: true, fmt: (v) => fmt(v, 1) },
  { key: "tax", label: "tax", higher: false, pareto: true, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: "latency", label: "latency", higher: false, pareto: true, fmt: (v) => `${Math.round(v)}s` },
  { key: "spec", label: "spec", higher: true, pareto: false, fmt: (v) => `${Math.round(v * 100)}%` },
];

// The Pareto axes, coherence first (it also carries the card's headline heat).
const PARETO_AXES = [{ key: "coherence", higher: true }, ...SCORE_COLS.filter((c) => c.pareto)];

// A topology is dominated when another is at least as good on every Pareto axis
// and strictly better on at least one (Analysis: Pareto frontier). The badge
// marks the frontier: the topologies that are not dominated, one to all four.
// Only topologies with a value on every axis can be placed on the trade-off.
function frontierTopologies(meds, topologies) {
  const placed = topologies.filter((t) => PARETO_AXES.every((a) => meds[t][a.key] != null));
  const asGood = (a, x, y) => (a.higher ? x >= y : x <= y);
  const better = (a, x, y) => (a.higher ? x > y : x < y);
  const dominates = (u, t) =>
    PARETO_AXES.every((a) => asGood(a, meds[u][a.key], meds[t][a.key])) &&
    PARETO_AXES.some((a) => better(a, meds[u][a.key], meds[t][a.key]));
  return new Set(placed.filter((t) => !placed.some((u) => u !== t && dominates(u, t))));
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Per slot the most recently created run counts (matrix rule); the API lists
// runs created_at DESC, so the first run seen per slot wins.
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

export async function renderMatrix(view) {
  let timer = null;
  view.replaceChildren(el("div", { class: "card" }, skeleton("row", 4)));

  async function load() {
    let data, doneRuns;
    try {
      [data, doneRuns] = await Promise.all([api("/api/matrix"), api("/api/runs?status=done")]);
    } catch (error) {
      view.replaceChildren(el("div", { class: "card" }, errorNote(error)));
      return;
    }

    const missing = [];
    for (const brief of data.briefs) {
      for (const topology of data.topologies) {
        for (const rep of data.reps) {
          const cell = data.cells[`${brief}|${topology}|${rep}`];
          if (!cell || cell.status === "failed") missing.push({ brief, topology, rep });
        }
      }
    }

    const activeJob = data.active_jobs[0] ?? null;
    const counting = countingRuns(doneRuns);

    view.replaceChildren(el("div", { class: "card" },
      headerRow(data, missing, activeJob),
      activeJob ? jobRow(activeJob) : null,
      matrixTable(data),
      legendFoot(),
      leaderboard(data, counting)));

    if (activeJob && !timer) timer = setInterval(load, 1500);
    if (!activeJob && timer) { clearInterval(timer); timer = null; }
  }

  function headerRow(data, missing, activeJob) {
    const startMissing = missing.length
      ? el("button", {
          class: "primary",
          disabled: activeJob ? "" : null,
          onclick: async () => {
            await api("/api/runs", { method: "POST", body: { cells: missing } });
            load();
          },
        }, icon("play", 14), `Run missing (${missing.length})`)
      : el("span", { class: "badge ok" }, icon("check", 12), "Matrix complete");

    const startAll = el("button", {
      disabled: activeJob ? "" : null,
      onclick: async () => {
        const ok = await confirmDialog({
          title: "Run the full matrix?",
          message: "Executes all 36 runs. Existing runs stay; the latest run wins per slot.",
          confirmLabel: "Run 36 runs",
        });
        if (!ok) return;
        await api("/api/runs", {
          method: "POST",
          body: { briefs: data.briefs, topologies: data.topologies, reps: data.reps },
        });
        load();
      },
    }, icon("refresh", 14), "Run full matrix");

    return el("div", { class: "row spread", style: "margin-bottom:14px" },
      el("h1", { style: "margin:0" }, icon("grid", 16), "Experiment matrix"),
      el("div", { class: "row" }, startMissing, startAll));
  }

  function jobRow(job) {
    const pct = job.progress.total ? (100 * job.progress.done) / job.progress.total : 0;
    const current = job.progress.current;
    return el("div", { class: "jobcard" },
      el("span", { class: "spin" }, icon("refresh", 15)),
      el("div", { style: "flex:1;min-width:0" },
        el("div", { class: "small", style: "margin-bottom:5px" },
          "Running ",
          current ? el("a", { href: `#/runs/${current}`, class: "mono" }, current) : "…",
          el("span", { class: "muted" }, `  ${job.progress.done}/${job.progress.total}`)),
        el("div", { class: "progress" }, el("div", { style: `width:${pct}%` }))),
      current ? el("a", { class: "small", href: `#/runs/${current}` }, "open run ", icon("chevron-right", 13)) : null);
  }

  function chip(data, brief, topology, rep) {
    const cell = data.cells[`${brief}|${topology}|${rep}`];
    const label = `${brief} · ${TOPOLOGY_LABELS[topology]} · rep ${rep}`;
    if (!cell) {
      const node = el("span", { class: "chip", "aria-label": `${label}: not run` }, "·");
      return withTooltip(node, () => [strong(label), text(" — not run")]);
    }
    const cls = cell.status === "done" ? `chip ${qClass(cell.coherence) ?? ""}` : `chip ${cell.status}`;
    const content = cell.status === "done"
      ? String(fmt(cell.coherence, 1))
      : icon(CHIP_ICONS[cell.status] ?? "clock", 12);
    const scoreText = cell.status === "done" ? `set coherence ${fmt(cell.coherence, 1)} / 5` : cell.status;
    const node = el("a", {
      class: cls,
      href: `#/runs/${cell.run_id}`,
      "aria-label": `${label}: ${scoreText}`,
    }, content);
    return withTooltip(node, () => [
      strong(label), el("br", {}),
      el("span", { class: "k" }, "status "), cell.status,
      ...(cell.status === "done"
        ? [el("br", {}), el("span", { class: "k" }, "coherence "), `${fmt(cell.coherence, 1)} / 5`]
        : []),
      ...(cell.final_round !== null && cell.final_round !== undefined
        ? [el("div", { class: "thumbs" }, ...PLATFORM_ORDER.map((platform) =>
            el("img", {
              src: `/api/artifacts/${cell.run_id}/${platform}/${cell.final_round}`,
              alt: PLATFORM_LABELS[platform],
            })))]
        : []),
    ]);
  }

  function matrixTable(data) {
    const header = el("tr", {},
      el("th", {}, "Brief"),
      ...data.topologies.map((t) => el("th", {}, topoChip(t))));

    const rows = data.briefs.map((brief) =>
      el("tr", {},
        el("td", { class: "matrix-brief" }, el("strong", {}, brief)),
        ...data.topologies.map((topology) =>
          el("td", {}, el("div", { class: "cell-chips" },
            ...data.reps.map((rep) => chip(data, brief, topology, rep)))))));

    return el("div", { class: "matrix-wrap" },
      el("table", { class: "matrix-table" },
        el("thead", {}, header),
        el("tbody", {}, ...rows)));
  }

  // Per-topology summary as a full-width leaderboard below the grid: coherence
  // is each card's headline (heat), the cost/quality medians sit under it, and
  // the per-axis best is marked on the Pareto columns. The badge marks the
  // Pareto frontier (non-dominated topologies), not a single coherence winner:
  // the research question is the quality/cost trade-off, "not to prove single
  // differences one by one" (Analysis). Cards keep the grid's column order so
  // the card under a column is that column's topology.
  function leaderboard(data, counting) {
    if (!counting.length) return null;
    const meds = {};
    for (const topology of data.topologies) {
      const runs = counting.filter((r) => r.topology === topology);
      meds[topology] = { n: runs.length };
      for (const key of ["coherence", ...SCORE_COLS.map((c) => c.key)]) {
        meds[topology][key] = median(runs.map((r) => r.metrics[key]).filter((v) => v != null));
      }
    }
    const best = {};
    for (const col of [{ key: "coherence", higher: true }, ...SCORE_COLS]) {
      const vals = data.topologies.map((t) => meds[t][col.key]).filter((v) => v != null);
      best[col.key] = vals.length ? (col.higher ? Math.max(...vals) : Math.min(...vals)) : null;
    }
    const frontier = frontierTopologies(meds, data.topologies);

    const cards = data.topologies.map((topology) => {
      const m = meds[topology];
      const coh = m.coherence;
      const onFrontier = frontier.has(topology);
      return el("a", {
        class: `lb-card topo-${topology}${onFrontier ? " frontier" : ""}`, href: "#/runs",
        title: `open ${TOPOLOGY_LABELS[topology]} runs`,
        onclick: (e) => { e.preventDefault(); openRunsFiltered({ topology }); },
      },
        el("div", { class: "lb-head" }, topoChip(topology),
          onFrontier
            ? withTooltip(
                el("span", { class: "lb-front" }, icon("check", 11), "on frontier"),
                "Not dominated on the quality/cost trade-off (coherence, VIE, tax, latency)")
            : null),
        el("div", { class: "lb-coh" },
          el("span", { class: `lb-big ${coh != null ? qClass(coh) : "muted"}` }, coh == null ? "—" : fmt(coh, 1)),
          el("span", { class: "lb-unit" }, "/ 5 coherence · ", String(m.n), " runs")),
        el("div", { class: "lb-stats" }, ...SCORE_COLS.map((col) => {
          const v = m[col.key];
          const win = col.pareto && v != null && v === best[col.key];
          const title = col.pareto
            ? (col.higher ? "higher is better" : "lower is better")
            : "spec compliance — off the Pareto axes, context only";
          return el("div", { class: `lb-stat${win ? " win" : ""}${col.pareto ? "" : " off-axis"}`, title },
            el("span", { class: "k" }, col.label),
            el("span", { class: "v" }, v == null ? "—" : col.fmt(v)));
        })));
    });
    return el("div", { class: "lb" }, ...cards);
  }

  function legendFoot() {
    const ramp = el("span", { class: "ramp-bar" },
      ...["q0", "q1", "q2", "q3", "q4", "q5"].map((q) => el("i", { class: q })));
    return el("div", { class: "mx-foot" },
      el("span", { class: "ramp" },
        el("span", { class: "muted" }, "coherence"),
        el("span", { class: "small muted" }, "0"), ramp, el("span", { class: "small muted" }, "5")),
      el("span", { class: "glyphs" },
        el("span", {}, el("span", { class: "chip running", style: "width:26px;height:20px" }, icon("activity", 11)), "running"),
        el("span", {}, el("span", { class: "chip", style: "width:26px;height:20px" }, icon("clock", 11)), "queued"),
        el("span", {}, el("span", { class: "chip failed", style: "width:26px;height:20px" }, icon("alert", 11)), "failed")));
  }

  function strong(t) { return el("b", {}, t); }
  function text(t) { return document.createTextNode(t); }

  await load();
  return () => { if (timer) clearInterval(timer); };
}
