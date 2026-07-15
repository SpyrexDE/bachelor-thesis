import { icon } from "/icons.js";

// Image tags cannot send the admin header, so the token also travels as a
// cookie the gate accepts (api/app.py).
function setAdminCookie(token) {
  document.cookie = `grain_admin=${token}; path=/; samesite=strict`;
}

const storedToken = localStorage.getItem("grain-admin-token");
if (storedToken) setAdminCookie(storedToken);

export async function api(path, options = {}) {
  const headers = { ...options.headers };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const token = localStorage.getItem("grain-admin-token");
  if (token) headers["X-Admin-Token"] = token;

  const response = await fetch(path, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (response.status === 401 && !options.retried) {
    // Deployment runs with GRAIN_ADMIN_TOKEN so raters cannot open the console.
    const entered = window.prompt("Admin token:");
    if (entered) {
      localStorage.setItem("grain-admin-token", entered);
      setAdminCookie(entered);
      return api(path, { ...options, retried: true });
    }
  }
  if (!response.ok) {
    let detail = response.statusText;
    try { detail = (await response.json()).detail ?? detail; } catch { /* keep statusText */ }
    throw new Error(detail);
  }
  return response.json();
}

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (value !== null && value !== undefined) node.setAttribute(key, value);
  }
  node.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

export function fmt(value, digits = 2) {
  if (value === null || value === undefined) return "—";
  return Number(value).toFixed(digits);
}

export function errorNote(error) {
  return el("p", { class: "error-note" }, String(error.message ?? error));
}

export function openLightbox(src) {
  const img = el("img", { src, onclick: (e) => e.stopPropagation() });
  // "Enlarge" must always enlarge: fit the artifact into the viewport, scaling
  // small ones (the 300x250 banner) up as well as large ones down. Aspect ratio
  // is preserved; the 4x cap keeps a tiny raster from turning to mush.
  const fit = () => {
    if (!img.naturalWidth) return;
    const scale = Math.min(
      (innerWidth * 0.92) / img.naturalWidth,
      (innerHeight * 0.9) / img.naturalHeight,
      4,
    );
    img.style.width = `${Math.floor(img.naturalWidth * scale)}px`;
    img.style.height = `${Math.floor(img.naturalHeight * scale)}px`;
  };
  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    removeEventListener("resize", fit);
  };
  const onKey = (event) => { if (event.key === "Escape") close(); };
  img.addEventListener("load", fit);
  if (img.complete) fit();
  addEventListener("resize", fit);
  const overlay = el("div", { class: "lightbox", onclick: close },
    img,
    el("button", { class: "lightbox-close", "aria-label": "Close" }, icon("x-circle", 22)));
  document.addEventListener("keydown", onKey);
  document.body.append(overlay);
}

// The theme is applied before first paint by the inline snippet in each
// index.html; this button only flips and persists it.
export function themeToggle() {
  const current = () => document.documentElement.dataset.theme;
  const glyph = () => icon(current() === "dark" ? "sun" : "moon");
  const button = el("button", {
    class: "theme-toggle",
    title: "Switch theme",
    "aria-label": "Switch theme",
    onclick: () => {
      const next = current() === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("grain-theme", next);
      button.replaceChildren(glyph());
    },
  }, glyph());
  return button;
}

const STATUS_ICONS = {
  done: "check-circle",
  running: "activity",
  queued: "clock",
  failed: "alert",
};

export function statusBadge(status) {
  return el("span", { class: `status ${status}` }, icon(STATUS_ICONS[status] ?? "clock", 14), status);
}

export function emptyState(message, iconName = "inbox") {
  return el("div", { class: "empty" }, icon(iconName, 28), el("p", {}, message));
}

export const PLATFORM_LABELS = {
  instagram: "Instagram post",
  story: "Story (9:16)",
  banner: "Display banner",
};

export const TOPOLOGY_LABELS = {
  monolithic: "Monolithic",
  independent: "Independent",
  coarse: "Coarse",
  fine: "Fine",
};

// The topology is the study's independent variable; it carries its own glyph
// and tint everywhere it is named, so a row/column/chip reads without text.
export function topoChip(topology, { bare = false, size = 11 } = {}) {
  const label = TOPOLOGY_LABELS[topology] ?? topology;
  return el("span", { class: `topo-chip topo-${topology}${bare ? " bare" : ""}` },
    icon(`topo-${topology}`, size), label);
}

// The same tint as a CSS custom property, for SVG fills/strokes in charts.
export function topoTone(topology) {
  return `var(--topo-${topology}-fg)`;
}
