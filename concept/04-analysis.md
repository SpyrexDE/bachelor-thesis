# Analysis

How the metrics from 03 are aggregated to answer the research question. The goal is to place the topologies against each other on the trade-off between quality and cost (Pareto view) and see which are worth choosing, not to prove single differences one by one.

## Distributions
- Each metric is reported as a distribution over its runs, grouped by topology (box plots), because single runs are unreliable (reps in 02).
- For each comparison step (01), report **how big the difference between the two topologies is (its effect size), with a range showing how unsure that size is**.
	- **Why not a significance test**: with so few runs such a test is underpowered, so a "not significant" result would say more about the small sample than about the topologies, and would be easy to misread as "no difference". Testing each metric and step on its own would also mean many tests at once, whereas the ranges here are meant to be read together as one pattern (below). A size plus a range instead says both how large the effect looks and how uncertain it is, which is what the Pareto view needs.
	- **One number per brief**: on each brief, subtract the two topologies' mean scores (the average over that brief's reps). Three briefs give three differences per step.
	- **Same brief only**: each difference is taken within one brief, so the brief's own difficulty is removed from the comparison (a hard brief is hard for every topology). The result holds for these three briefs, not beyond them (02, category coverage).
	- **Read together, not one by one**: the ranges are read across all metrics and steps as one description of the pattern. With this few runs, no single range counts as its own finding.
- **How the range is computed**: report the mean of the three per-brief differences and how far they spread. The spread also shows how consistent the advantage was across the three briefs. With only three values it is wide and rough, not a precise estimate.

## Pareto frontier
- The topologies are compared on quality (set coherence, per-artifact quality) and on cost (tax, latency) at the same time.
- **The frontier**: the topologies where you cannot get better on one axis without getting worse on another. A topology is **dominated** if another is at least as good on every axis and better on at least one; a dominated topology is never worth choosing.
- **Spec compliance stays off the Pareto axes**: it is a pass/fail code check with few distinct values per topology (pass share out of 9 runs), not a smooth trade-off to weigh against quality. It is reported next to the frontier as the error distribution per topology (which checks failed, how often); what to do about it (for example extra checks to prevent a failure) is left to the reader.
- The frontier can contain from one to all four topologies. One: a single topology wins on every axis, and the answer is simple. Several: the axes conflict (for example best coherence at the highest cost), and the choice depends on how much quality is worth relative to cost for a given use case.
- **Two positions are partly fixed in advance**: Monolithic and Independent both have a tax of exactly 0 (03), and Coarse and Fine are always above 0, so no coordinated topology can dominate a zero-tax one. Which of the two zero-tax topologies stays on the frontier is decided by quality and latency (Independent's producers run in parallel, Monolithic writes the set in one sequence). At least one of them is always on the frontier, and the single winner, if there is one, must be one of them. So the open question is whether the quality gain of Coarse and Fine is worth their extra cost.

## Human A/B
- Win rates per comparison step (03) answer the research question directly from human preference, reported alongside the machine distributions as a second, independent line of evidence.
- The human-vs-judge agreement numbers (03) are reported next to the machine results, as far as the rater budget and validity checks (03) allow.

## The round curve inside Fine
- Fine's revision loop gives a curve: set coherence after each round against the cost of that round.
	- Each round's intermediate set is saved and scored by the official judge after the run ends, so the loop itself never sees that judge (validity caution in 01).
	- The curve also shows what delivering the best round, instead of the round the loop stopped on, would have changed (Fine delivers the version it stopped on, 01).
- The curve is the result: the reader reads off the round that matters to them, whether where coherence stops improving or, under their own weighting of coherence against cost, where more is no longer worth it.

## Limits of the small sample
- The sample is small on purpose (02), so the analysis shows the shape of the trade-off and the Pareto positions, not tight estimates.
- The round curve inside Fine is the more precise part: set coherence is measured after each critic round, so one run yields several data points instead of one.
