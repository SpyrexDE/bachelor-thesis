# Run Anatomy & Data Model

## Run
A run is one `(brief, topology)` pair, executed once. It produces the artifact set plus telemetry.

## Brief (input)
Creative-brief elements, verbatim from Belch & Belch, *Advertising and Promotion* (Fig. 8-3, "Key Elements of a Creative Brief"):

- Basic problem or issue the communication must address or solve
- Communication objectives
- Target audience
- Insights to drive creative work
- Key benefits or major selling idea to communicate
- Reason to believe / supporting information
- Tone and manner / brand personality
- **Deliverables** (what is needed and when, static for all runs)
- Measures of success (should be tied back to objectives)
- _Mandatories_: brand and legal/compliance constraints (mandatory claims, prohibited wording). A standard creative-brief element (AMA Creative Brief Template), outside Belch's nine.

## Artifact set (output)
Each artifact is one integrated creative from the image model (text, layout, and branding in the image, like a real ad). Each follows the real platform specs: enforced limits (aspect-ratio range, file size) plus the platform's recommended resolutions:

- **Instagram post**: 4:5 image, recommended 1440x1800 (Meta Ads Guide); the copy is rendered into the image.
- **Vertical story/Reel key visual**: 9:16 full-frame image, recommended 1440x2560 (Meta Ads Guide); *on-image text stays inside Meta's safe zone: roughly 14% of the top, 35% of the bottom, and 6% per side stay free, because platform UI (profile icon, call to action) covers those margins (Meta Ads Guide; Meta ships a downloadable safe zone checker)*. Static key visual; animating it is out of scope/future work.
- **Display banner**: a 300x250 IAB web unit, file up to 150 KB; the copy is rendered into the creative, so it is minimal (300x250 = the IAB Universal Ad Package medium rectangle, a long-standing fixed web unit; 150 KB = Google Display Network limit).

Why these three: they differ strongly on two enforced constraints, so each artifact must be built for its own format: aspect ratio (4:5 portrait / 9:16 vertical / ~1:1 300x250, so the visual must be recomposed) and canvas size (a large 1440x1800 feed image vs a tiny 300x250 banner, so the content and its on-image text must be compressed). How well the campaign holds together across that per-format adaptation is what the topologies are compared on.

## Test matrix
- ***Topologies: 4 (Monolithic, Independent, Coarse, Fine)***
- Briefs: 3, chosen to span Henkel's product range rather than a single product: Laundry & Home Care (Persil), Hair (Schwarzkopf), and adhesives (Loctite). The Loctite brief targets DIY/craftsmen and prosumer audiences, a different buyer group and tone than FMCG, which extends the range beyond consumer goods while keeping the same three channels. Category coverage, not statistical generalisation (n=3 is far too small for that). Source: Henkel company pages.
- Reps: 3 per (brief, topology).

	> Single runs are unreliable under stochastic decoding: *Do Repetitions Matter?* (2025) finds 10 of 12 evaluation slices invert at least one pairwise rank versus the three-run majority, and recommends at least two repetitions (it uses three). So we run three and report the variance across them (Bouthillier 2021: trust the distribution, not a single seeded run). Every call's seed is recorded, so runs are reproducible; the reps sample run-to-run spread, and topologies are compared by their distribution within a brief (Analysis). API seeds are best effort, not deterministic (OpenAI, Anthropic; Blackwell 2024 measures the run-to-run variation); whether the image API honours them is checked in the pilot.
- Fixed: model, temperature, the shared role prompts, the critic's stopping rule and hard cap.

**Total runs**: `3 briefs x 4 topologies x 3 reps = 36`
