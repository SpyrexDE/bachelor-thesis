// Shared UI primitives: score ramp, dialogs, tooltips, skeletons, payload
// formatting. Keeps the views declarative and the visual language in one place.

import { el } from "/api.js";
import { icon } from "/icons.js";

// --- Score heat ramp (coherence 0-5) -----------------------------------------

export function qClass(value) {
  if (value === null || value === undefined) return null;
  const b = Math.max(0, Math.min(5, Math.round(value)));
  return `q${b}`;
}

// Saturated ramp colour for bars/fills at a normalised 0..1 position.
export function rampColor(norm) {
  const b = Math.max(0, Math.min(5, Math.round(norm * 5)));
  return `var(--q${b}-fg)`;
}

// --- Favicon -----------------------------------------------------------------

export function setFavicon() {
  // The matrix in miniature: a 4-cell grain mark, accent on ink.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <rect width="32" height="32" rx="7" fill="#1d1d1f"/>
    <g fill="#7f9cf5">
      <rect x="7" y="7" width="7" height="7" rx="1.5"/>
      <rect x="18" y="7" width="7" height="7" rx="1.5" opacity="0.55"/>
      <rect x="7" y="18" width="7" height="7" rx="1.5" opacity="0.55"/>
      <rect x="18" y="18" width="7" height="7" rx="1.5"/>
    </g></svg>`;
  const link = document.querySelector("link[rel=icon]") ?? el("link", { rel: "icon" });
  link.setAttribute("type", "image/svg+xml");
  link.setAttribute("href", `data:image/svg+xml,${encodeURIComponent(svg)}`);
  document.head.append(link);
}

// --- Tooltip (one shared element, follows the cursor) ------------------------

let ttEl = null;
function tooltipEl() {
  if (!ttEl) { ttEl = el("div", { class: "tt" }); document.body.append(ttEl); }
  return ttEl;
}

// The anchor can vanish under the cursor (route change, redraw); hide the
// shared tooltip explicitly then, or it lingers on the next view.
export function dismissTooltip() {
  ttEl?.classList.remove("show");
}

// build: () => array of nodes/strings, or a string. Shows on hover, follows mouse.
export function withTooltip(node, build) {
  const move = (event) => {
    const tt = tooltipEl();
    const pad = 14;
    let x = event.clientX + pad;
    let y = event.clientY + pad;
    if (x + tt.offsetWidth > innerWidth - 8) x = event.clientX - pad - tt.offsetWidth;
    if (y + tt.offsetHeight > innerHeight - 8) y = event.clientY - pad - tt.offsetHeight;
    tt.style.left = `${Math.max(8, x)}px`;
    tt.style.top = `${Math.max(8, y)}px`;
  };
  node.addEventListener("mouseenter", (event) => {
    const tt = tooltipEl();
    const content = build();
    tt.replaceChildren(...(Array.isArray(content) ? content : [content]));
    tt.classList.add("show");
    move(event);
  });
  node.addEventListener("mousemove", move);
  node.addEventListener("mouseleave", () => tooltipEl().classList.remove("show"));
  return node;
}

// --- Dialogs (replace native alert / confirm / prompt) -----------------------

function overlay(build) {
  const back = el("div", { class: "modal-back" });
  const close = (value, resolve) => {
    back.classList.remove("show");
    setTimeout(() => back.remove(), 130);
    document.removeEventListener("keydown", onKey);
    resolve(value);
  };
  let onKey;
  const promise = new Promise((resolve) => {
    const modal = build((value) => close(value, resolve));
    back.append(modal);
    back.addEventListener("mousedown", (event) => { if (event.target === back) close(null, resolve); });
    onKey = (event) => { if (event.key === "Escape") close(null, resolve); };
    document.addEventListener("keydown", onKey);
  });
  document.body.append(back);
  requestAnimationFrame(() => back.classList.add("show"));
  return promise;
}

export function confirmDialog({ title, message, confirmLabel = "Confirm", danger = false }) {
  return overlay((done) => {
    const confirm = el("button", {
      class: danger ? "danger" : "primary",
      onclick: () => done(true),
    }, confirmLabel);
    const modal = el("div", { class: "modal" },
      el("h3", {}, title),
      message ? el("p", {}, message) : null,
      el("div", { class: "actions" },
        el("button", { onclick: () => done(false) }, "Cancel"), confirm));
    requestAnimationFrame(() => confirm.focus());
    return modal;
  });
}

export function promptDialog({ title, message, placeholder = "", value = "", confirmLabel = "OK" }) {
  return overlay((done) => {
    const input = el("input", {
      placeholder, value,
      onkeydown: (event) => {
        if (event.key === "Enter") done(input.value.trim() || null);
      },
    });
    const modal = el("div", { class: "modal" },
      el("h3", {}, title),
      message ? el("p", {}, message) : null,
      input,
      el("div", { class: "actions" },
        el("button", { onclick: () => done(null) }, "Cancel"),
        el("button", { class: "primary", onclick: () => done(input.value.trim() || null) }, confirmLabel)));
    requestAnimationFrame(() => input.focus());
    return modal;
  });
}

export function toast(message, { action } = {}) {
  document.querySelector(".toast")?.remove();
  const node = el("div", { class: "toast" }, icon("check-circle", 15), message,
    action ? el("button", { onclick: () => { node.remove(); action.onClick(); } }, action.label) : null);
  document.body.append(node);
  setTimeout(() => node.remove(), 5000);
  return node;
}

// --- Skeleton loading --------------------------------------------------------

export function skeleton(kind = "row", count = 5) {
  const cls = kind === "card" ? "skel skel-card" : "skel skel-row";
  return el("div", {}, ...Array.from({ length: count }, () => el("div", { class: cls })));
}

// Swatch legend for the round curve. Each swatch is the actual chart mark
// (same SVG classes as charts.js), so the legend shows the encoding rather
// than describing it in a sentence — solid line, dashed line, delivered dot,
// best-round ring, all four the reader must map on the curve.
const SVGNS = "http://www.w3.org/2000/svg";
function curveSwatch(...marks) {
  const svg = document.createElementNS(SVGNS, "svg");
  for (const [k, v] of Object.entries({
    class: "svg-chart cl-mark", width: 18, height: 12, viewBox: "0 0 18 12", "aria-hidden": "true",
  })) svg.setAttribute(k, v);
  for (const [tag, attrs] of marks) {
    const node = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    svg.append(node);
  }
  return svg;
}

export function curveLegend() {
  return el("div", { class: "curve-legend" },
    el("span", {}, curveSwatch(["line", { class: "curve", x1: 1, y1: 6, x2: 17, y2: 6, "stroke-width": 2 }]),
      "coherence"),
    el("span", {}, curveSwatch(["line", { class: "proxy", x1: 1, y1: 6, x2: 17, y2: 6, "stroke-width": 1.5, "stroke-dasharray": "4 3" }]),
      "in-loop proxy"),
    el("span", {}, curveSwatch(["circle", { class: "dot-delivered", cx: 9, cy: 6, r: 4, "stroke-width": 1.5 }]),
      "delivered"),
    el("span", {}, curveSwatch(["circle", { class: "best-ring", cx: 9, cy: 6, r: 4.5, "stroke-width": 2, "stroke-dasharray": "4 3" }]),
      "best round"),
    el("span", { class: "muted cl-ref" }, "concept/04"));
}

// --- Payload formatting for the trace drill-down -----------------------------

function escape(text) {
  return String(text).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

// Prompt text is '## '-sectioned; highlight the headers so structure reads.
export function promptBlock(text) {
  const html = escape(text ?? "").replace(/^(##?\s.+)$/gm, '<span class="sec">$1</span>');
  const node = el("div", { class: "code-block" });
  node.innerHTML = html;
  return node;
}

// Output is fenced JSON (chat) or absent (image). Pretty-print + light highlight.
export function outputBlock(text) {
  if (!text) return el("div", { class: "code-block", style: "color:var(--muted)" }, "No text output — the model returned an image (shown above).");
  let pretty = text.trim();
  const match = pretty.match(/```json\s*([\s\S]*?)```/);
  const body = match ? match[1] : pretty;
  try {
    pretty = JSON.stringify(JSON.parse(body), null, 2);
  } catch { pretty = body.trim(); }
  // Escape first (only <>&; quotes stay literal), then highlight. Injected
  // spans use unquoted class attributes so later passes never match inside them.
  const html = escape(pretty)
    .replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, "<span class=k>$1</span>$2")
    .replace(/(:\s*)("(?:[^"\\]|\\.)*")/g, "$1<span class=s>$2</span>")
    .replace(/(:\s*)(-?\d+(?:\.\d+)?)/g, "$1<span class=n>$2</span>");
  const node = el("div", { class: "code-block json" });
  node.innerHTML = html;
  return node;
}

export function copyMini(getText) {
  const button = el("button", { class: "copy-mini", title: "Copy" }, icon("copy", 12), " copy");
  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    try { await navigator.clipboard.writeText(getText()); } catch { /* clipboard blocked */ }
    button.replaceChildren(icon("check", 12), " copied");
    setTimeout(() => button.replaceChildren(icon("copy", 12), " copy"), 1200);
  });
  return button;
}
