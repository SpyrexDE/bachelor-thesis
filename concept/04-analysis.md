# Analysis

How the metrics from 03 are aggregated to answer the research question.

## Distributions
- Each metric is reported as a distribution over its runs, grouped by topology (box plots), because single runs are unreliable (reps in 02).
- Topology differences are tested for significance. Within a rep the seed is matched across topologies (02), so the tests compare paired runs.
- *Open: the concrete test (paired, small n, no normality assumption) and whether to correct for testing several metrics and topology pairs at once.*

## Pareto frontier
- The topologies are compared on quality (set coherence, per-artifact quality) and on cost (tax, latency) at the same time.
- A topology is dominated if another is at least as good on every axis and better on at least one; a dominated topology is never worth choosing. The rest form the frontier.
- The frontier can hold one, two, or three topologies. One: a single topology wins on everything, and the answer is simple. Several: the axes conflict (e.g. best coherence at the highest cost), and the choice between them depends on how much quality is worth relative to cost in a given use case.
- One position is known in advance: Monolithic can never be dominated, because its tax is exactly 0 (03) and Coarse and Fine are always above 0. So Monolithic is always on the frontier, and only Monolithic could be the single winner. The open question on the frontier is therefore whether the quality gain of Coarse and Fine justifies their extra cost.

## Human A/B
- The win rates per topology pair (03) are reported next to the machine distributions, as direct evidence on the research question.
- The two agreement numbers (the judge-human correlation, and how often the set with the higher coherence score is also the human choice) are reported with the machine results and state how far those results match human judgment. The correlation exists only if the rubric-rating task runs and passes its catch-set check (03).

## The round curve inside Fine
- Fine's revision loop yields a curve: set coherence after each round against the cost of that round.
	- The intermediate set of each round is saved and scored by the official judge after the run ends, so the loop itself never sees that judge (validity caution in 01).
	- The curve also shows what delivering the best round instead of the stopped-on round would have changed (Fine delivers the version it stopped on, 01).
- The curve is the result; there is no single break-even round. A break-even would need a fixed exchange rate between coherence points and tokens or seconds, and none exists. The curve shows what each further round adds and costs; the reader applies their weighting, the same way as in the Pareto view.

## Statistical power
- 3 briefs x 3 reps per topology show the shape of the trade-off and the Pareto positions, not tight estimates.
- If the loop runs several rounds, the round curve inside Fine has more data points per run and is the more precise part of the analysis.
