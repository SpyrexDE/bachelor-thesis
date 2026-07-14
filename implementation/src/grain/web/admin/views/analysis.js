import { api, el, emptyState, errorNote, fmt, topoChip, topoTone } from "/api.js";
import { boxPlot, roundCurve, scatter } from "/charts.js";
import { icon } from "/icons.js";
import { curveLegend, skeleton } from "/ui.js";
import { openRunsFiltered } from "/views/runs.js";

function signed(value, digits) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${fmt(Math.abs(value), digits)}`;
}

function miniStat(key, value) {
  return el("span", { class: "ministat" },
    el("span", { class: "mk" }, key), el("span", { class: "mv" }, value));
}

const METRIC_LABELS = {
  coherence: "Set coherence (0-5)",
  viescore: "VIEScore (set avg)",
  spec: "Spec compliance",
  tax: "Coordination tax",
  latency: "Latency (modeled s)",
};

const AXIS_LABELS = {
  coherence: "set coherence (0-5)",
  viescore: "VIEScore",
  tax: "coordination tax",
  latency: "latency (s)",
};

let selectedMetric = "coherence";
let qualityAxis = "coherence";
let costAxis = "tax";

export async function renderAnalysis(view) {
  view.replaceChildren(el("div", { class: "card" }, skeleton("row", 5)));
  let machine, pareto, rounds;
  try {
    [machine, pareto, rounds] = await Promise.all([
      api("/api/analysis/machine"), api("/api/analysis/pareto"), api("/api/analysis/rounds"),
    ]);
  } catch (error) {
    view.replaceChildren(el("div", { class: "card" }, errorNote(error)));
    return null;
  }

  if (!machine.cells) {
    view.replaceChildren(el("div", { class: "card" },
      el("h1", {}, icon("chart", 16), "Analysis"),
      emptyState("No finished runs yet. Analysis reads the matrix (concept/04).", "chart")));
    return null;
  }

  const machineCard = el("div", { class: "card" });

  function drawMachine() {
    const dist = machine.distributions[selectedMetric];
    const higher = dist.higher_better;
    const digits = selectedMetric === "latency" ? 0 : selectedMetric === "tax" ? 3 : 2;
    const entries = Object.entries(dist.topologies).map(([topology, data]) => ({
      label: topology, box: data.box, values: data.values, tone: topoTone(topology),
    }));
    const steps = machine.steps[selectedMetric];

    machineCard.replaceChildren(
      el("div", { class: "row spread" },
        el("h1", {}, icon("chart", 16), "Machine metrics"),
        el("span", { class: "small muted" },
          `${machine.cells}/36 matrix cells · ${higher ? "higher" : "lower"} is better`)),
      el("div", { class: "row seg-row", style: "margin:8px 0 4px" },
        ...Object.keys(METRIC_LABELS).map((metric) =>
          el("button", {
            class: metric === selectedMetric ? "primary" : "",
            onclick: () => { selectedMetric = metric; drawMachine(); },
          }, METRIC_LABELS[metric]))),
      el("div", { class: "chart-hold" }, boxPlot(entries)),
      el("div", { class: "row spread", style: "margin-top:16px" },
        el("h2", { style: "margin:0", title: "mean difference per brief, later topology minus earlier, averaged over reps" },
          "Change from one topology to the next"),
        el("span", { class: "delta-legend" },
          el("span", { class: "k up" }, "better"), el("span", { class: "k down" }, "worse"))),
      stepDeltas(steps, higher, digits),
    );
  }

  // Diverging bars: sign sets the side, good/bad sets the colour, per-brief
  // ticks show the spread the SD number alone never let you feel.
  function stepDeltas(steps, higher, digits) {
    const absMax = Math.max(0.0001, ...steps.flatMap((s) =>
      [Math.abs(s.mean ?? 0), ...s.per_brief.map((d) => Math.abs(d.diff))]));
    const pos = (v) => 50 + (v / absMax) * 48; // percent along the track, 0 centred
    return el("div", { class: "deltas" }, ...steps.map((step) => {
      const [from, to] = step.step.split("-");
      const mean = step.mean ?? 0;
      const improved = higher ? mean > 0 : mean < 0;
      const tone = mean === 0 ? "var(--muted)" : improved ? "var(--ok)" : "var(--bad)";
      const a = Math.min(pos(mean), 50); const b = Math.max(pos(mean), 50);
      return el("div", { class: "delta-row" },
        el("div", { class: "delta-step" }, topoChip(from), icon("arrow-right", 12), topoChip(to)),
        el("div", { class: "delta-track" },
          el("span", { class: "axis" }),
          el("i", { class: "fill", style: `left:${a}%;width:${b - a}%;background:${tone}` }),
          ...step.per_brief.map((d) => el("span", {
            class: "pb", style: `left:${pos(d.diff)}%`,
            title: `${d.brief}: ${signed(d.diff, digits)}`,
          }))),
        el("div", { class: "delta-val", style: `color:${tone}` }, signed(mean, digits),
          step.sd === undefined ? null : el("span", { class: "sd" }, `±${fmt(step.sd, digits)}`)));
    }));
  }

  const paretoCard = el("div", { class: "card" });

  function drawPareto() {
    const positions = Object.entries(pareto.positions);
    const points = positions.map(([topology, pos]) => ({
      label: topology,
      tone: topoTone(topology),
      x: pos[costAxis],
      y: pos[qualityAxis],
      onFrontier: pareto.frontier.includes(topology),
      tipLine: `${AXIS_LABELS[qualityAxis]} ${fmt(pos[qualityAxis], 2)} · ${AXIS_LABELS[costAxis]} ${fmt(pos[costAxis], 3)}`,
      onPick: () => openRunsFiltered({ topology }),
    }));

    const axisPicker = (label, value, options, onChange) =>
      el("label", { class: "check small" }, `${label} `,
        el("select", { onchange: (event) => onChange(event.target.value) },
          ...options.map((option) =>
            el("option", { value: option, selected: option === value ? "" : null },
              AXIS_LABELS[option]))));

    paretoCard.replaceChildren(
      el("div", { class: "row spread" },
        el("h1", {}, icon("activity", 16), "Pareto view"),
        el("div", { class: "row" },
          axisPicker("quality", qualityAxis, ["coherence", "viescore"], (v) => { qualityAxis = v; drawPareto(); }),
          axisPicker("cost", costAxis, ["tax", "latency"], (v) => { costAxis = v; drawPareto(); }))),
      el("p", { class: "section-note" },
        "The frontier is computed over all four axes at once; this plot is one projection of it."),
      el("div", { class: "row", style: "align-items:flex-start;gap:20px" },
        el("div", { class: "chart-hold", style: "flex:1 1 360px" },
          scatter(points, `cost: ${AXIS_LABELS[costAxis]}`, `quality: ${AXIS_LABELS[qualityAxis]}`)),
        el("div", { style: "flex:1 1 300px" },
          el("h2", {}, "Frontier"),
          el("div", { class: "frontier-list" }, ...positions.map(([topology, pos]) => {
            const dominated = pareto.dominated[topology];
            return el("div", { class: "frontier-item" },
              el("div", { class: "row", style: "gap:8px" },
                topoChip(topology),
                dominated
                  ? el("span", { class: "badge plain" }, "dominated")
                  : el("span", { class: "badge ok" }, icon("check", 11), "frontier"),
                dominated ? el("span", { class: "muted small" }, "by ",
                  ...dominated.flatMap((t, i) => [i ? el("span", {}, ", ") : null, topoChip(t)])) : null),
              el("div", { class: "frontier-nums" },
                miniStat("coh", fmt(pos.coherence, 1)), miniStat("VIE", fmt(pos.viescore, 2)),
                miniStat("tax", fmt(pos.tax, 3)), miniStat("lat", `${fmt(pos.latency, 0)}s`)));
          })))),
      specErrorTable(pareto.spec_errors),
    );
  }

  function specErrorTable(specErrors) {
    // Spec compliance reports beside the frontier (concept/04). Only checks that
    // actually failed somewhere are shown; a wall of 0/9 hides the signal.
    const topologies = Object.keys(specErrors);
    const allChecks = [...new Set(Object.values(specErrors).flatMap((c) => Object.keys(c)))].sort();
    const failing = allChecks.filter((name) =>
      topologies.some((t) => (specErrors[t][name]?.failed ?? 0) > 0));
    const hidden = allChecks.length - failing.length;

    if (!allChecks.length) return null;
    if (!failing.length) {
      return el("div", { style: "margin-top:16px" },
        el("h2", {}, "Spec failures beside the frontier"),
        el("p", { class: "badge ok", style: "display:inline-flex" }, icon("check", 12),
          `every spec check passes across all ${allChecks.length} checks`));
    }

    return el("div", { style: "margin-top:16px" },
      el("h2", {}, "Spec failures beside the frontier"),
      el("p", { class: "section-note" },
        `${failing.length} check${failing.length === 1 ? "" : "s"} failed at least once`
        + (hidden ? ` · ${hidden} always-passing check${hidden === 1 ? "" : "s"} hidden` : "")),
      el("table", {},
        el("thead", {}, el("tr", {}, el("th", {}, "Check"),
          ...topologies.map((t) => el("th", { class: "num" }, t)))),
        el("tbody", {}, ...failing.map((name) =>
          el("tr", {},
            el("td", { class: "small" }, name),
            ...topologies.map((t) => {
              const entry = specErrors[t][name];
              const failed = entry?.failed ?? 0;
              if (!entry) return el("td", { class: "num muted" }, "—");
              if (!failed) return el("td", { class: "num muted" }, `0/${entry.total}`);
              return el("td", {
                class: "num click",
                style: "color:var(--bad);font-weight:700;background:var(--bad-soft)",
                title: `open ${t} runs`,
                onclick: () => openRunsFiltered({ topology: t }),
              }, `${failed}/${entry.total}`);
            }))))));
  }

  const roundsCard = el("div", { class: "card" },
    el("div", { class: "row spread" },
      el("h1", { style: "margin:0" }, icon("refresh", 16), "Round curve inside Fine"),
      curveLegend()),
    rounds.curves.length
      ? el("div", { class: "grid", style: "grid-template-columns:repeat(auto-fill,minmax(260px,1fr));margin-top:16px;row-gap:18px" },
          ...rounds.curves.map((curve) =>
            el("div", {},
              el("p", { class: "small mono", style: "margin:0 0 2px" },
                el("a", { href: `#/runs/${curve.run_id}` }, `${curve.brief} rep ${curve.rep}`),
                el("span", { class: "muted" }, ` · ${curve.stop_reason}`)),
              curve.points.length > 1
                ? roundCurve(curve.points, curve.delivered_round, curve.best_round)
                : el("p", { class: "small muted", style: "margin:4px 0 14px" },
                    `accepted without revision — coherence ${fmt(curve.points[0]?.coherence, 1)}`))))
      : emptyState("No finished Fine runs yet.", "refresh"),
  );

  view.replaceChildren(machineCard, paretoCard, roundsCard);
  drawMachine();
  drawPareto();
  return null;
}
