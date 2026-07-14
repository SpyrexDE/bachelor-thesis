// Inline SVG charts: box plots, scatter, round curves, win-rate. No deps (D10).

import { withTooltip } from "/ui.js";

const SVG = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  node.append(...children);
  return node;
}

function tip(node, lines) {
  return withTooltip(node, () => lines.filter(Boolean).map((l) =>
    typeof l === "string" ? document.createTextNode(l) : l));
}

function text(x, y, content, attrs = {}) {
  const node = svgEl("text", { x, y, ...attrs });
  node.textContent = content;
  return node;
}

function scale(domainMin, domainMax, rangeMin, rangeMax) {
  const span = domainMax - domainMin || 1;
  return (v) => rangeMin + ((v - domainMin) / span) * (rangeMax - rangeMin);
}

function niceDomain(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min || Math.abs(max) || 1) * 0.08;
  // Never pad a non-negative metric below zero; that would draw impossible range.
  const low = min >= 0 ? Math.max(0, min - pad) : min - pad;
  return [low, max + pad];
}

export function boxPlot(entries) {
  // entries: [{label, box: {n,min,q1,median,q3,max}, values, tone}]
  // tone (a topology tint) colours the whole row so the four series read apart.
  const width = 640, rowH = 40, left = 118, right = 20;
  const rows = entries.filter((e) => e.box && e.box.n > 0);
  const height = rows.length * rowH + 30;
  const all = rows.flatMap((e) => [e.box.min, e.box.max]);
  if (!all.length) return svgEl("svg", { class: "svg-chart", width, height: 40 });
  const [d0, d1] = niceDomain(all);
  const x = scale(d0, d1, left, width - right);

  const svg = svgEl("svg", { class: "svg-chart", width, height, viewBox: `0 0 ${width} ${height}` });
  for (const tick of axisTicks(d0, d1, 5)) {
    svg.append(
      svgEl("line", { class: "grid", x1: x(tick), x2: x(tick), y1: 10, y2: height - 22 }),
      text(x(tick), height - 8, formatTick(tick), { "text-anchor": "middle" }),
    );
  }
  rows.forEach((entry, i) => {
    const cy = 14 + i * rowH + rowH / 2 - 8;
    const b = entry.box;
    const tone = entry.tone;
    svg.append(
      text(left - 10, cy + 4, entry.label, {
        "text-anchor": "end", class: "lbl", style: tone ? `fill:${tone};font-weight:700` : "",
      }),
      svgEl("line", { class: "whisker", x1: x(b.min), x2: x(b.q1), y1: cy, y2: cy, style: tone ? `stroke:${tone}` : "" }),
      svgEl("line", { class: "whisker", x1: x(b.q3), x2: x(b.max), y1: cy, y2: cy, style: tone ? `stroke:${tone}` : "" }),
      svgEl("rect", {
        class: "iqr", x: x(b.q1), y: cy - 9,
        width: Math.max(1, x(b.q3) - x(b.q1)), height: 18, rx: 2,
        style: tone ? `fill:${tone};fill-opacity:0.16;stroke:${tone}` : "",
      }),
      svgEl("line", { class: "median", x1: x(b.median), x2: x(b.median), y1: cy - 9, y2: cy + 9, "stroke-width": 2, style: tone ? `stroke:${tone}` : "" }),
    );
    for (const v of entry.values ?? []) {
      const dot = svgEl("circle", { class: "pt hit", cx: x(v), cy, r: 2.8, style: tone ? `fill:${tone};fill-opacity:0.85` : "" });
      tip(dot, [`${entry.label}: ${formatTick(v)}`]);
      svg.append(dot);
    }
  });
  return svg;
}

export function scatter(points, xLabel, yLabel) {
  // points: [{label, x, y, onFrontier}]
  const width = 460, height = 350, left = 60, bottom = 40, top = 30, right = 16;
  const svg = svgEl("svg", { class: "svg-chart", width, height, viewBox: `0 0 ${width} ${height}` });
  if (!points.length) return svg;
  const [x0, x1] = niceDomain(points.map((p) => p.x));
  const [y0, y1] = niceDomain(points.map((p) => p.y));
  const x = scale(x0, x1, left, width - right);
  const y = scale(y0, y1, height - bottom, top);

  for (const tick of axisTicks(x0, x1, 5)) {
    svg.append(
      svgEl("line", { class: "grid", x1: x(tick), x2: x(tick), y1: top, y2: height - bottom }),
      text(x(tick), height - bottom + 14, formatTick(tick), { "text-anchor": "middle" }),
    );
  }
  for (const tick of axisTicks(y0, y1, 5)) {
    svg.append(
      svgEl("line", { class: "grid", x1: left, x2: width - right, y1: y(tick), y2: y(tick) }),
      text(left - 8, y(tick) + 4, formatTick(tick), { "text-anchor": "end" }),
    );
  }
  svg.append(
    text(width / 2, height - 6, xLabel, { "text-anchor": "middle", class: "lbl" }),
    text(12, 14, yLabel, { class: "lbl" }),  // above the plot, clear of tick labels
  );
  for (const p of points) {
    // Tone = topology tint; frontier points fill solid, dominated stay hollow
    // with a tinted ring, so identity and frontier membership both read.
    const style = p.tone
      ? (p.onFrontier ? `fill:${p.tone};stroke:${p.tone}` : `fill:var(--panel);stroke:${p.tone}`)
      : "";
    const circle = svgEl("circle", {
      class: `hit ${p.onFrontier ? "frontier-pt" : "dominated-pt"}`,
      cx: x(p.x), cy: y(p.y), r: p.onFrontier ? 7 : 6, "stroke-width": 2, style,
    });
    tip(circle, [
      `${p.label}${p.onFrontier ? " · on frontier" : " · dominated"}`,
      p.tipLine,
    ].filter(Boolean));
    const interactive = p.href || p.onPick;
    const label = text(x(p.x) + 11, y(p.y) + 4, p.label, {
      class: interactive ? "lbl-link" : "", style: p.tone ? `fill:${p.tone};font-weight:650` : "",
    });
    if (p.onPick) {
      circle.classList.add("hit");
      label.classList.add("hit");
      circle.addEventListener("click", p.onPick);
      label.addEventListener("click", p.onPick);
      svg.append(circle, label);
    } else if (p.href) {
      const anchor = svgEl("a", { href: p.href });
      anchor.append(circle, label);
      svg.append(anchor);
    } else {
      svg.append(circle, label);
    }
  }
  return svg;
}

export function roundCurve(points, deliveredRound, bestRound) {
  // points: [{round, coherence, proxy}]; coherence scale is 0..5 (concept/03).
  const width = 250, height = 150, left = 30, bottom = 26, top = 10, right = 10;
  const svg = svgEl("svg", { class: "svg-chart", width, height, viewBox: `0 0 ${width} ${height}` });
  const maxRound = Math.max(1, ...points.map((p) => p.round));
  const x = scale(0, maxRound, left, width - right);
  const y = scale(0, 5, height - bottom, top);

  for (let tick = 0; tick <= 5; tick += 1) {
    svg.append(svgEl("line", { class: "grid", x1: left, x2: width - right, y1: y(tick), y2: y(tick) }));
  }
  svg.append(text(left - 6, y(0) + 4, "0", { "text-anchor": "end" }),
             text(left - 6, y(5) + 4, "5", { "text-anchor": "end" }));
  for (const p of points) {
    svg.append(text(x(p.round), height - 8, String(p.round), { "text-anchor": "middle" }));
  }

  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.round)},${y(p.coherence)}`).join(" ");
  svg.append(svgEl("path", { class: "curve", d: line, "stroke-width": 2 }));
  const proxyPts = points.filter((p) => p.proxy !== null && p.proxy !== undefined);
  if (proxyPts.length) {
    const proxyLine = proxyPts
      .map((p, i) => `${i ? "L" : "M"}${x(p.round)},${y(p.proxy * 5)}`).join(" ");
    svg.append(svgEl("path", {
      class: "proxy", d: proxyLine, "stroke-width": 1.5, "stroke-dasharray": "4 3",
    }));
  }
  for (const p of points) {
    const isDelivered = p.round === deliveredRound;
    const cx = x(p.round), cy = y(p.coherence);
    if (p.round === bestRound && bestRound !== deliveredRound) {
      svg.append(svgEl("circle", {
        class: "best-ring", cx, cy, r: 8, "stroke-width": 2.5, "stroke-dasharray": "4 3",
      }));
    }
    svg.append(svgEl("circle", {
      class: isDelivered ? "dot-delivered" : "dot",
      cx, cy, r: isDelivered ? 5 : 3.5, "stroke-width": 1.5,
    }));
    // The value sits at the point — nobody should count gridlines for three
    // numbers. Above the dot unless it is near the ceiling, then below.
    const above = p.coherence <= 4.2;
    svg.append(text(cx, cy + (above ? -9 : 16), p.coherence.toFixed(1),
      { "text-anchor": "middle", class: "pt-val" }));
    // Full detail (incl. the proxy the loop saw) on hover, like every other chart.
    const hit = svgEl("circle", { class: "hit", cx, cy, r: 12, fill: "transparent" });
    tip(hit, [
      `round ${p.round}${isDelivered ? " · delivered" : ""}${p.round === bestRound ? " · best" : ""}`,
      `coherence ${p.coherence.toFixed(1)} / 5`,
      p.proxy != null ? `in-loop proxy ${p.proxy.toFixed(2)} (scaled ${(p.proxy * 5).toFixed(1)})` : null,
    ]);
    svg.append(hit);
  }
  return svg;
}

export function distStrip(values, mine, { width = 132, height = 16 } = {}) {
  // One metric across the matrix: a tick per run, the accent marker = this run.
  // Reads position-in-field at a glance where a lone number reads nothing.
  const svg = svgEl("svg", {
    class: "svg-chart dist", width, height, viewBox: `0 0 ${width} ${height}`,
    "aria-hidden": "true",
  });
  const all = [...values, mine];
  const [d0, d1] = niceDomain(all);
  const x = scale(d0, d1, 3, width - 3);
  svg.append(svgEl("line", { class: "base", x1: 3, x2: width - 3, y1: height / 2, y2: height / 2 }));
  for (const v of values) {
    svg.append(svgEl("line", { class: "tick", x1: x(v), x2: x(v), y1: 4, y2: height - 4 }));
  }
  svg.append(
    svgEl("line", { class: "me", x1: x(mine), x2: x(mine), y1: 1, y2: height - 1 }),
    svgEl("circle", { class: "me-dot", cx: x(mine), cy: height / 2, r: 2.6 }),
  );
  return svg;
}

function axisTicks(min, max, count) {
  // Round tick steps (1/2/2.5/5 x 10^k), so a 0-5 scale ticks at whole numbers.
  const span = max - min || 1;
  const raw = span / (count - 1);
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * power).find((s) => s >= raw);
  const first = Math.ceil(min / step) * step;
  const ticks = [];
  for (let tick = first; tick <= max + step / 1000; tick += step) {
    ticks.push(Math.round(tick * 1000) / 1000);
  }
  return ticks;
}

function formatTick(value) {
  const abs = Math.abs(value);
  if (abs >= 1000) return `${Math.round(value / 100) / 10}k`;
  if (abs >= 10) return String(Math.round(value));
  return String(Math.round(value * 100) / 100);
}
