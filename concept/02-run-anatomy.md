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
Each artifact is one integrated creative from the image model (text, layout, and branding in the image, like a real ad). Each follows the real platform specs: enforced limits (aspect-ratio range, caption length, file size) plus the platform's recommended resolutions:

- **Instagram post**: 4:5 image, recommended 1440x1800 (Meta Ads Guide), plus a separate caption (up to 2200 characters and 30 hashtags; Instagram Graph API limits); the image itself may also carry text.
- **Vertical story/Reel key visual**: 9:16 full-frame image, recommended 1440x2560 (Meta Ads Guide); *on-image text stays inside Meta's safe zone: roughly 14% of the top, 35% of the bottom, and 6% per side stay free, because platform UI (profile icon, call to action) covers those margins (Meta Ads Guide; Meta ships a downloadable safe zone checker)*. Static key visual; animating it is out of scope/future work.
- **Display banner**: a 300x250 IAB web unit, file up to 150 KB; the copy is rendered into the creative (no caption), so it is minimal (300x250 = the IAB Universal Ad Package medium rectangle, a long-standing fixed web unit; 150 KB = Google Display Network limit).

Why these three: they differ strongly on three enforced constraints that force the shared message to be re-expressed instead of copied: aspect ratio (4:5 portrait / 9:16 vertical / ~1:1 300x250, so the visual must be recomposed), canvas size (a large 1440x1800 feed image vs a tiny 300x250 banner, so the message must be compressed), and text budget (a caption up to 2200 characters vs a banner with no caption and almost no room for on-image text). Copying one artifact to another platform fails across these differences, so each artifact demands real adaptation, and how well brand and message survive that adaptation is what the topologies are compared on.

## Test matrix
- ***Topologies: 3 (Monolithic, Coarse, Fine)***
- Briefs: 3, chosen to span Henkel's product range rather than a single product: Laundry & Home Care (Persil), Hair (Schwarzkopf), and adhesives (Loctite). The Loctite brief targets DIY/craftsmen and prosumer audiences, a different buyer group and tone than FMCG, which extends the range beyond consumer goods while keeping the same three channels. Category coverage, not statistical generalisation (n=3 is far too small for that). Source: Henkel company pages.
- Reps: 3 per (brief, topology).

	> Single-run LLM rankings are brittle under stochastic decoding: *Do Repetitions Matter?* (2025) finds 83% of evaluation slices (10/12) invert at least one pairwise rank relative to the three-run majority, recommends at least two repetitions, and itself uses three. We use three, match the seed across topologies within a rep (one seed per rep, passed to every LLM and image call in all three topologies, so each rep is a paired comparison) and vary it across reps to sample run-to-run variance rather than a single favourable seed (Bouthillier 2021), and report the variance; quantifying that uncertainty follows Towards Reproducible LLM Evaluation (2024). Seeds are best-effort on LLM APIs: OpenAI documents the seed parameter as best effort with determinism not guaranteed, Anthropic states that results are not fully deterministic even at temperature 0, and Blackwell 2024 measures this run-to-run variation. Whether the image API honours seeds is checked in the implementation phase. So seeding controls variance rather than guaranteeing determinism. More reps tighten the estimate but cost more (future work if budget allows).
- Fixed: model, temperature, the shared role prompts, the critic's stopping rule and hard cap.

**Total runs**: `3 briefs x 3 topologies x 3 reps = 27`
