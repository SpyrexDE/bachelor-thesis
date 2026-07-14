import { api, themeToggle } from "/api.js";
import { icon } from "/icons.js";
import { dismissTooltip, setFavicon } from "/ui.js";
import { renderAnalysis } from "/views/analysis.js";
import { renderMatrix } from "/views/matrix.js";
import { renderReview } from "/views/review.js";
import { renderRuns } from "/views/runs.js";

setFavicon();
document.getElementById("topbar-end").append(themeToggle());

const NAV_ICONS = { matrix: "grid", runs: "list", review: "users", analysis: "chart" };
for (const link of document.querySelectorAll("#nav a")) {
  const name = link.hash.replace("#/", "");
  link.prepend(icon(NAV_ICONS[name], 15));
}

const ROUTES = {
  matrix: renderMatrix,
  runs: renderRuns,
  review: renderReview,
  analysis: renderAnalysis,
};

let cleanup = null;

async function route() {
  const hash = location.hash.replace(/^#\//, "") || "matrix";
  const [name, ...rest] = hash.split("/");
  const render = ROUTES[name] ?? renderMatrix;

  if (cleanup) { cleanup(); cleanup = null; }
  dismissTooltip();
  for (const link of document.querySelectorAll("#nav a")) {
    link.classList.toggle("active", link.hash === `#/${name}`);
  }
  const view = document.getElementById("view");
  view.replaceChildren();
  cleanup = await render(view, rest);
}

window.addEventListener("hashchange", route);

api("/health")
  .then((health) => {
    document.getElementById("provider-badge").textContent = `provider: ${health.provider}`;
  })
  .catch(() => {
    document.getElementById("provider-badge").textContent = "offline";
  });

route();
