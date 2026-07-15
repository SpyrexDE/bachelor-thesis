# Metrics

Five machine metrics, plus a human A/B protocol:

1. **Coordination tax**: share of tokens spent coordinating rather than producing artifacts.

2. **VIEScore**: per-artifact quality (semantic consistency, perceptual quality), scored by a VLM.

3. **Set coherence**: whether the three platform artifacts form one campaign, scored by a holistic VLM judge over the whole set.

4. **Spec compliance**: whether each artifact meets its platform specs, checked in code; the one quality metric not scored by an LLM.

5. **Latency**: end-to-end wall-clock time from brief to finished set.

- **Human evaluation**, two separate tasks: the **A/B** (defined in its own section below) and the **rubric rating** (defined under Set coherence, Why trust the judge).

## Coordination tax
Share of tokens spent re-establishing cross-agent coherence rather than producing artifact content: the price the coordinated topologies pay to recover, through the concept call and critic loop, the shared context a single window provides on its own.

- $\text{tax} = \frac{\text{coordination tokens}}{\text{total tokens}}$, with total = coordination + production.
- **Coordination**: every token (input and output) of the calls that exist only because the work is split: the orchestrator's concept call (Coarse, Fine) and the critic's feedback (Fine).
- **Production**: every token of the calls that make artifact content, namely each producer's copy and the prompt it sends to the image model. A single agent's own planning counts here too: it would happen with or without a split, so it is production, not coordination.
- **Monolithic and Independent are exactly zero by construction**: neither has an orchestrator or critic call, so no coordination tokens exist.

How the tax changes from Coarse to Fine is an open measurement: revision rounds add coordination tokens (critic feedback) and production tokens (revised artifacts) at the same time, so the share can rise or fall. This is the cost side of granularity, reported next to latency.
> **Source**: the "communication tax" framing for inter-agent token overhead is from Wang 2025 (AgentTaxo), reused by Salim 2026 (Tokenomics); token-level cost accounting also follows Salim 2026, Zhang 2025 (Cut the Crap), and Yan 2025 (communication survey). Coordination tax is a distinct metric here: Wang counts duplicated tokens as waste, we count the tokens spent to restore coherence across the split (concept call, critic feedback), so the brief stays production and Monolithic and Independent are zero.

## VIEScore (per artifact)
Machine quality of a single artifact, scored by a VLM that also gives a rationale.

- Two axes, each split into task-specific sub-scores rated 0 to 10:
	- **Semantic Consistency** (SC, does the image match the brief and its platform's specifications)
	- **Perceptual Quality** (PQ, is the image natural and free of artifacts)
- $O = \sqrt{\min(\text{SC sub-scores}) \times \min(\text{PQ sub-scores})}$
	- the inner min sets each axis to its worst sub-score: a single sub-score of 0 sets the whole axis to 0
	- the outer geometric mean is 0 if either axis is 0, otherwise balances the two
- Scored against the brief and the platform specs (02), the same references for every topology and run. The orchestrator's creative concept is not the reference (it exists only in Coarse and Fine and varies per run), and neither is the producer's own image prompt: both differ by topology, so scoring against them would make the metric depend on the topology.
- Reported per platform artifact, then averaged over the set for a per-set quality number.
> **Source**: Ku 2024 (VIEScore).

## Set coherence
Whether the whole set forms one campaign: the same key message, brand cues, and tone across the three platform artifacts. This is the cross-artifact metric.

- **Scoring**: one VLM-judge call receives the whole set at once (all three artifacts), the brief, and a written rubric, and returns one sub-score per rubric pillar (key message, brand cues, tone; 0 to 5 each), each with a justification.
	- The set's coherence score is the minimum of the three sub-scores. The definition is conjunctive (one message AND brand AND tone), so one broken pillar breaks the campaign; the same floor logic as VIEScore's inner min.
	- Protocol and scale follow InterleavedEval (Liu 2024): reference-free, whole-instance input, score plus rationale, validated against human ratings by Spearman correlation. The split into sub-scores with an explicit rule follows VIEScore (Ku 2024).
	- Fallback: if the first real-output runs show degenerate sub-scores (identical values across sets), scoring falls back to one holistic 0-to-5 score, Liu's exact protocol.
- **Rubric (what counts as coherent)**: a shared key message, brand cues, and tone; the visual format is expected to differ per platform.
	- "Key message" is the message the finished set carries, judged against the brief. It is not the orchestrator's internal creative concept (01): Monolithic and Independent have none, and the metric must be identical for every topology.
	- Why these three pillars: they are the brief elements (02, verbatim from Belch & Belch) that are visible in every artifact and must stay the same across platforms: key benefits / major selling idea (key message), tone and manner / brand personality (tone), mandatories and brand personality (brand cues). The remaining brief elements do not qualify: deliverables differ per platform by design, the target audience is fixed across runs, measures of success are not visible in an artifact, and objectives, insights, and reason to believe show up through message and tone rather than as separate visible dimensions.
	- From Liu only the protocol is borrowed; the rubric is written for this task. Liu's own coherence rubric rewards visual sameness across images (consistent style, subject, clothing, and traits) and a single unified narrative, while a campaign keeps one message, brand, and tone and changes the format per platform on purpose.
- **Why the judge sees the whole set, not pairs** (pairs are the common protocol in prior consistency evaluation):
	- Pairwise means: average the similarity of every image pair in the set (Tewel 2024, ConsiStory).
	- A pairwise average of per-artifact comparisons misses set-wide drift and scales quadratically.
	- Pairwise LLM judging is also the less robust protocol, flipping far more often than pointwise scoring under irrelevant distractor features (Tripathi 2025, Pairwise or Pointwise).
- **Why a judge, not a similarity metric**: embedding-based consistency (DINO or CLIP cosine similarity) rewards sameness and would punish correct platform adaptation. At most a secondary objective check, never the coherence score.
- **Why trust the judge**: in-loop critic, proxy, and final judge are all LLM-based, with no ground truth at any point, so the judge is validated against humans.
	- **Rubric rating, the second human task**: humans score sets themselves, one set at a time, the same three pillar sub-scores as the judge (0 to 5 each, min rule), so raters never have to combine the pillars into one score themselves. Report the Spearman correlation between judge and human scores (following Liu 2024), on the aggregated score and per pillar. A low correlation means the judge's scores reflect only its rubric, not what humans see as one campaign. Runs only if the rater budget covers it; otherwise the limitation below applies.
		- A separate block after all A/B blocks, never between votes: a score given right after a vote inherits the just-formed overall impression (separate elicitation is what lowers criterion correlations; Novikova 2018, RankME). After the A/B the rater has also seen the range of the material, which an absolute score needs. Set order randomised.
		- Default: all 36 sets, 2 raters each (the second rater gives the per-set agreement check).
		- Calibration and catch sets, against the risk that the real sets are too similar to score (range restriction): the block starts with two anchors (one deliberately incoherent set mixed across briefs, one strong set). Hidden among the real sets are 3 scrambled sets built from three different runs of the same brief: same product, built so that message and tone should drift.
		- Abort condition, in two steps: first check that the scrambled sets actually drifted (the judge scores them clearly lower, plus a manual look). If they drifted and raters still do not score them lower than the real sets, humans cannot rate coherence in isolation on this material; the correlation is then not reported and the limitation applies. If the scrambles never drifted, that says the runs are too similar, and nothing about the raters.
		- Limitation fallback: without this task, coherence results are read as "coherence as the rubric defines it", and the judge rests on Liu's validation of the protocol, not on a validation of this judge. That validation is itself only moderate on coherence (Liu reports Spearman around 0.4 for the coherence aspects), so the fallback is weaker here than for the other aspects.
	- Judge bias (position, verbosity, self-preference; Ye 2025, Justice or Prejudice) is only partly addressed: randomised artifact order counters position bias; a fixed rubric, judge model, temperature, and seed make scoring reproducible. Verbosity bias remains open, and self-preference depends on whether the judge model differs from the producer model. *Open: judge model choice (implementation phase; a judge different from the producer model would address self-preference).*

## Spec compliance (per artifact)
- **Not scored**: aspect ratio and pixel size come from the request arguements, so  every artifact is delivered at the platform's format by construction. File size (banner up to 150 KB, 02) is not an agent decision and carries no signal about the coordination structure, so it too stays out of the scored share.
- **Checked in code**: the passed-check share counts only what a producer can actually get wrong: required claims present, prohibited wording absent, on-image text inside the story safe zone and readable (margins 14%/35%/6% from 02). Rendered text is read via OCR. Reported as share of passed checks, per artifact and per set.

## Latency
End-to-end wall-clock seconds, from brief to finished set.

- Reported as median and spread over the repetitions, the second cost axis next to coordination tax.

## Human A/B
The first of the two human tasks (the second, rubric rating of single sets, is defined under Set coherence, Why trust the judge). Blind human preference between topologies' sets. Two roles: direct evidence on the research question (win rates per topology pair), and the human check on the machine metrics, which otherwise contain no human judgment (defined under Aggregation). It runs on a sample (rater budget), so the machine metrics cover all 36 runs.

- **Protocol**: a fixed list of set pairs; each pair is one independent trial, order randomised, grouped by brief (the rater reads the brief once, then judges all of that brief's pairs, with the brief available throughout). Per trial the rater sees two sets side by side and picks the better set for that brief. One binary question per pair, overall preference; this keeps cognitive load low (exposé: binary decisions against decision fatigue).
	- The brief stays visible because "better" means better for this brief: without it, raters can only judge looks and internal consistency, and a set that misses the brief's selling idea could win on looks.
	- Blind, randomised left/right position: only the sets themselves can influence the choice (no topology labels, no position bias).
	- Forced choice instead of absolute scores: the evidence comes from machine translation evaluation. WMT 2007 found ranking outputs relative to each other more reliable and faster than five-point scale scoring, and recommends replacing scales with ranking (Callison-Burch 2007). The finding is about the judgment type, and the A/B uses the same type: a pairwise comparison, here with two sets and no tie option.
	- No separate coherence vote in the A/B: when raters score several criteria in one task, the scores come out highly correlated, so a coherence vote next to an overall vote would mostly repeat the overall impression. Documented for translations (fluency and adequacy, Callison-Burch 2007), for NLG criteria (Novikova 2018, RankME), and for photos (five attribute scores correlate with the overall quality score at SRCC 0.78 to 0.96; Fang 2020, SPAQ).
	- Coherence is still rated by humans, in its own task: the rubric rating (Set coherence, Why trust the judge).
- **Pairs**: every pair shares the brief; sets from different briefs have no common task and are never compared. Between-topology pairs (same brief, same rep) are the main comparison: 3 topology pairs (the three adjacent steps, 01) x 3 briefs x 3 reps = 27. The other pairings stay machine-only: the rater budget does not cover them. Within-topology pairs (same brief and topology, different reps) are the control, sampled from the 36 possible to fit the rater budget: if raters prefer one run over another as decisively as one topology over another, run-to-run variance is as large as the topology effect and the between-topology wins say little.
- **Aggregation**: win rate per topology pair with a confidence interval; inter-rater agreement (Artstein 2008) shows whether the raters agree with each other.
	- The machine side of the agreement check is the set-coherence score: how often the set with the higher coherence score also wins the human vote. This tests whether coherence drives human preference; the Spearman correlation above tests whether the judge measures coherence at all.
- *Open: rater pool and count (Henkel experts; Georg has offered his team). Hard constraint from the 2026-07-03 meeting: at most about one hour per person. The A/B (~45 min) fits; A/B plus the full rubric task does not, so the two tasks will likely go to different people once the pool size is known.*
> **Sources**: van der Lee 2021 (human evaluation best practice), Artstein 2008 (inter-coder agreement).
