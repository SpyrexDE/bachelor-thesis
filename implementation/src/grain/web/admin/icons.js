// Inline SVG icons, Feather-style: 24px viewBox, 2px stroke, currentColor.
// Every icon marks an action, a state, or an object type (docs/conventions.md).

const SVG = "http://www.w3.org/2000/svg";

const PATHS = {
  grid: [
    ["rect", { x: 3, y: 3, width: 7, height: 7 }],
    ["rect", { x: 14, y: 3, width: 7, height: 7 }],
    ["rect", { x: 14, y: 14, width: 7, height: 7 }],
    ["rect", { x: 3, y: 14, width: 7, height: 7 }],
  ],
  list: [
    ["line", { x1: 8, y1: 6, x2: 21, y2: 6 }],
    ["line", { x1: 8, y1: 12, x2: 21, y2: 12 }],
    ["line", { x1: 8, y1: 18, x2: 21, y2: 18 }],
    ["line", { x1: 3, y1: 6, x2: 3.01, y2: 6 }],
    ["line", { x1: 3, y1: 12, x2: 3.01, y2: 12 }],
    ["line", { x1: 3, y1: 18, x2: 3.01, y2: 18 }],
  ],
  users: [
    ["path", { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }],
    ["circle", { cx: 9, cy: 7, r: 4 }],
    ["path", { d: "M23 21v-2a4 4 0 0 0-3-3.87" }],
    ["path", { d: "M16 3.13a4 4 0 0 1 0 7.75" }],
  ],
  chart: [
    ["line", { x1: 12, y1: 20, x2: 12, y2: 10 }],
    ["line", { x1: 18, y1: 20, x2: 18, y2: 4 }],
    ["line", { x1: 6, y1: 20, x2: 6, y2: 16 }],
  ],
  play: [["polygon", { points: "5 3 19 12 5 21" }]],
  refresh: [
    ["polyline", { points: "23 4 23 10 17 10" }],
    ["polyline", { points: "1 20 1 14 7 14" }],
    ["path", { d: "M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" }],
  ],
  trash: [
    ["polyline", { points: "3 6 5 6 21 6" }],
    ["path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }],
  ],
  copy: [
    ["rect", { x: 9, y: 9, width: 13, height: 13, rx: 2 }],
    ["path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" }],
  ],
  open: [
    ["path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }],
    ["polyline", { points: "15 3 21 3 21 9" }],
    ["line", { x1: 10, y1: 14, x2: 21, y2: 3 }],
  ],
  plus: [
    ["line", { x1: 12, y1: 5, x2: 12, y2: 19 }],
    ["line", { x1: 5, y1: 12, x2: 19, y2: 12 }],
  ],
  check: [["polyline", { points: "20 6 9 17 4 12" }]],
  "check-circle": [
    ["path", { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14" }],
    ["polyline", { points: "22 4 12 14.01 9 11.01" }],
  ],
  "x-circle": [
    ["circle", { cx: 12, cy: 12, r: 10 }],
    ["line", { x1: 15, y1: 9, x2: 9, y2: 15 }],
    ["line", { x1: 9, y1: 9, x2: 15, y2: 15 }],
  ],
  alert: [
    ["path", { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }],
    ["line", { x1: 12, y1: 9, x2: 12, y2: 13 }],
    ["line", { x1: 12, y1: 17, x2: 12.01, y2: 17 }],
  ],
  clock: [
    ["circle", { cx: 12, cy: 12, r: 10 }],
    ["polyline", { points: "12 6 12 12 16 14" }],
  ],
  activity: [["polyline", { points: "22 12 18 12 15 21 9 3 6 12 2 12" }]],
  sun: [
    ["circle", { cx: 12, cy: 12, r: 5 }],
    ["line", { x1: 12, y1: 1, x2: 12, y2: 3 }],
    ["line", { x1: 12, y1: 21, x2: 12, y2: 23 }],
    ["line", { x1: 4.22, y1: 4.22, x2: 5.64, y2: 5.64 }],
    ["line", { x1: 18.36, y1: 18.36, x2: 19.78, y2: 19.78 }],
    ["line", { x1: 1, y1: 12, x2: 3, y2: 12 }],
    ["line", { x1: 21, y1: 12, x2: 23, y2: 12 }],
    ["line", { x1: 4.22, y1: 19.78, x2: 5.64, y2: 18.36 }],
    ["line", { x1: 18.36, y1: 5.64, x2: 19.78, y2: 4.22 }],
  ],
  moon: [["path", { d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" }]],
  layers: [
    ["polygon", { points: "12 2 2 7 12 12 22 7 12 2" }],
    ["polyline", { points: "2 17 12 22 22 17" }],
    ["polyline", { points: "2 12 12 17 22 12" }],
  ],
  "user-plus": [
    ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }],
    ["circle", { cx: 8.5, cy: 7, r: 4 }],
    ["line", { x1: 20, y1: 8, x2: 20, y2: 14 }],
    ["line", { x1: 17, y1: 11, x2: 23, y2: 11 }],
  ],
  inbox: [
    ["polyline", { points: "22 12 16 12 14 15 10 15 8 12 2 12" }],
    ["path", { d: "M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" }],
  ],
  link: [
    ["path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }],
    ["path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" }],
  ],
  star: [
    ["polygon", { points: "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" }],
  ],
  percent: [
    ["line", { x1: 19, y1: 5, x2: 5, y2: 19 }],
    ["circle", { cx: 6.5, cy: 6.5, r: 2.5 }],
    ["circle", { cx: 17.5, cy: 17.5, r: 2.5 }],
  ],
  "check-square": [
    ["polyline", { points: "9 11 12 14 22 4" }],
    ["path", { d: "M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" }],
  ],
  "phone-portrait": [
    ["rect", { x: 5, y: 2, width: 14, height: 20, rx: 2 }],
    ["line", { x1: 12, y1: 18, x2: 12.01, y2: 18 }],
  ],
  "phone-story": [
    ["rect", { x: 7, y: 1, width: 10, height: 22, rx: 2 }],
  ],
  banner: [
    ["rect", { x: 2, y: 7, width: 20, height: 10, rx: 2 }],
  ],
  "chevron-right": [["polyline", { points: "9 18 15 12 9 6" }]],
  "chevron-down": [["polyline", { points: "6 9 12 15 18 9" }]],
  "arrow-up": [
    ["line", { x1: 12, y1: 19, x2: 12, y2: 5 }],
    ["polyline", { points: "5 12 12 5 19 12" }],
  ],
  "arrow-down": [
    ["line", { x1: 12, y1: 5, x2: 12, y2: 19 }],
    ["polyline", { points: "19 12 12 19 5 12" }],
  ],
  "arrow-left": [
    ["line", { x1: 19, y1: 12, x2: 5, y2: 12 }],
    ["polyline", { points: "12 19 5 12 12 5" }],
  ],
  "arrow-right": [
    ["line", { x1: 5, y1: 12, x2: 19, y2: 12 }],
    ["polyline", { points: "12 5 19 12 12 19" }],
  ],
  maximize: [
    ["path", { d: "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" }],
  ],
  "corner-down-right": [
    ["polyline", { points: "15 10 20 15 15 20" }],
    ["path", { d: "M4 4v7a4 4 0 0 0 4 4h12" }],
  ],
  cpu: [
    ["rect", { x: 4, y: 4, width: 16, height: 16, rx: 2 }],
    ["rect", { x: 9, y: 9, width: 6, height: 6 }],
    ["line", { x1: 9, y1: 1, x2: 9, y2: 4 }], ["line", { x1: 15, y1: 1, x2: 15, y2: 4 }],
    ["line", { x1: 9, y1: 20, x2: 9, y2: 23 }], ["line", { x1: 15, y1: 20, x2: 15, y2: 23 }],
    ["line", { x1: 20, y1: 9, x2: 23, y2: 9 }], ["line", { x1: 20, y1: 14, x2: 23, y2: 14 }],
    ["line", { x1: 1, y1: 9, x2: 4, y2: 9 }], ["line", { x1: 1, y1: 14, x2: 4, y2: 14 }],
  ],
  image: [
    ["rect", { x: 3, y: 3, width: 18, height: 18, rx: 2 }],
    ["circle", { cx: 8.5, cy: 8.5, r: 1.5 }],
    ["polyline", { points: "21 15 16 10 5 21" }],
  ],
  compass: [
    ["circle", { cx: 12, cy: 12, r: 10 }],
    ["polygon", { points: "16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" }],
  ],
  edit: [
    ["path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }],
    ["path", { d: "M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" }],
  ],
  // Topology wiring pictograms: one block / parallel lanes / few large tasks /
  // revision loop. They mark the object type wherever a topology is named.
  "topo-monolithic": [
    ["rect", { x: 5, y: 5, width: 14, height: 14, rx: 2 }],
  ],
  "topo-independent": [
    ["line", { x1: 6, y1: 5, x2: 6, y2: 19 }],
    ["line", { x1: 12, y1: 5, x2: 12, y2: 19 }],
    ["line", { x1: 18, y1: 5, x2: 18, y2: 19 }],
  ],
  "topo-coarse": [
    ["rect", { x: 4, y: 5, width: 7, height: 14, rx: 1.5 }],
    ["rect", { x: 14, y: 5, width: 7, height: 14, rx: 1.5 }],
  ],
  "topo-fine": [
    ["path", { d: "M20 12a8 8 0 1 1-2.4-5.7" }],
    ["polyline", { points: "20 2.5 20 7 15.5 7" }],
  ],
};

export const PLATFORM_ICONS = {
  instagram: "phone-portrait",
  story: "phone-story",
  banner: "banner",
};

export function icon(name, size = 16) {
  const shapes = PATHS[name];
  if (!shapes) throw new Error(`unknown icon: ${name}`);
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("aria-hidden", "true");
  for (const [tag, attrs] of shapes) {
    const node = document.createElementNS(SVG, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    svg.append(node);
  }
  return svg;
}
