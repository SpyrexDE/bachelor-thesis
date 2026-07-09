# Analysis

How the metrics from 03 are aggregated to answer the research question.

## Distributions
- Each metric is reported as a distribution over its runs, grouped by topology (box plots), because single runs are unreliable (reps in 02).
- Topology differences are reported as effect sizes with confidence intervals: at this sample size a test is underpowered, a bare reject/fail-to-reject invites reading non-significance as no effect, and an interval reports magnitude and uncertainty on the scale the Pareto view needs.
	- The estimand: per brief, the difference of rep means between the two topologies of a step, pooled as the average within-brief difference, conditional on these three briefs (02, category coverage). The brief is the blocking variable (a hard brief is hard for every topology).
	- Differences are read along the three comparison steps (01).
	- The intervals are read jointly across metrics and steps as a descriptive summary; no single interval is treated as a standalone discovery claim.
- Interval method: a t-interval over the per-brief differences (one difference per brief, the difference of rep means between the two topologies of a step), 3 values per step. A plain bootstrap under-covers at this sample size (Bowyer 2025), which is why the t-interval is the default over it; a Bayesian interval remains a candidate if the t-interval's normality assumption looks shaky once real data exists.

## Pareto frontier
- The topologies are compared on quality (set coherence, per-artifact quality) and on cost (tax, latency) at the same time.
- Spec compliance is a pass/fail gate, not a frontier axis. A set that breaks a hard platform constraint is unusable, and no amount of quality or low cost makes up for that, so it is a precondition, not something to trade off. (A pass share out of 9 runs would also be too coarse for a continuous axis.) It is therefore reported beside the frontier and gates the reading: a topology that routinely breaks hard specs is not recommendable, whatever its frontier position.
- A topology is dominated if another is at least as good on every axis and better on at least one; a dominated topology is never worth choosing. The rest form the frontier.
- The frontier can hold anything from one topology to all four. One: a single topology wins on everything, and the answer is simple. Several: the axes conflict (e.g. best coherence at the highest cost), and the choice between them depends on how much quality is worth relative to cost in a given use case.
- Two positions are partly known in advance: Monolithic and Independent both have a tax of exactly 0 (03) and Coarse and Fine are always above 0, so no coordinated topology can ever dominate a zero-tax one. Whether one or both zero-tax topologies stay on the frontier is decided by quality and latency (Independent's producers run in parallel, Monolithic writes the set in one sequence); at least one of them is always on the frontier, and the single winner, if there is one, must be one of them. The open question on the frontier is therefore whether the quality gain of Coarse and Fine justifies their extra cost.

## Human A/B
- Win rates per comparison step (03) sit next to the machine distributions, as direct evidence on the research question.
- The two agreement numbers sit with the machine results as the human check on the judge, each reported only as far as the rater budget and the catch-set check (03) allow.

## The round curve inside Fine
- Fine's revision loop yields a curve: set coherence after each round against the cost of that round.
	- The intermediate set of each round is saved and scored by the official judge after the run ends, so the loop itself never sees that judge (validity caution in 01).
	- The curve also shows what delivering the best round instead of the stopped-on round would have changed (Fine delivers the version it stopped on, 01).
- The curve is the result; there is no single break-even round. A break-even would need a fixed exchange rate between coherence points and tokens or seconds, and none exists. The curve shows what each further round adds and costs; the reader applies their weighting, the same way as in the Pareto view.

## Statistical power
- The sample is small on purpose (02), so the analysis shows the shape of the trade-off and the Pareto positions, not tight estimates
- The round curve inside Fine is the more precise part of the analysis: set coherence is measured after each critic round, so a single run yields several data points instead of one.
