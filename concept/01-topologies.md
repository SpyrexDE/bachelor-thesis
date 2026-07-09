# Task & Topologies

## Task
- **Artifact**: one platform's deliverable (text + image), e.g. an Instagram post = image + caption + hashtags.
- **Artifact set**: all platform deliverables of one campaign together (Instagram post + vertical story + display banner); they must cohere.
- The system turns one **brief** into the whole **set**.
- Quality means coherence across the set (same message, brand, tone over the platforms), plus each artifact's own text-image fit.
- The idea generalises to personalised ads or game assets (thesis motivation).

## Assumptions
- Input = a marketing brief; user = someone who wants a coherent campaign across several platforms; output = the artifact set.
- The setup is chosen so that the RQ is answerable (granularity vs set coherence vs cost), not to copy a specific production workflow. Where it differs from real user requirements, that is a stated scope limitation.
- Platforms (the set): Instagram post, vertical story/Reel key visual, display banner (specs in Run Anatomy). All are Henkel-real channels and each combines text and image.

## Scope (which granularity we study)
- The granularity we vary is how finely the set-production process is split into separate roles: one agent, then parallel producers with no coordination, then an orchestrator plus producers, then plus a critic. The per-artifact split stays fixed (one agent each), so the manipulated variable is the set-level coordination structure (Monolithic, Independent, Coarse, Fine), not the inside of one artifact.
- Why one agent per artifact stays fixed: for a task this shallow (one ad image), splitting a single artifact by modality (a separate copywriter and image agent) likely adds coordination cost without a quality gain (Tang: MAS helps mainly on deep tasks; Kim: coordination's gains diminish once a single agent already handles the task well, the capability-saturation effect). We additionally assume that one shared context for text and image helps their alignment. Both are scoping assumptions, not measured results.
- Future work: a single artifact's internal granularity; a fuller orchestrator that also decomposes per platform and synthesises the outputs (here it emits only the shared concept, so the findings only hold for message-only orchestration); personalised one-to-many sets (target audience is already a brief field, held fixed here, so varying it per segment is the next step); and animating the static key visuals (a production add-on via richer producer skills, so the granularity findings still apply).

## Roles
- Orchestrator (Coarse and Fine): turns the brief into one platform agnostic shared creative concept, the single idea the whole set is built on (campaign angle, key-visual direction, tagline direction). The brief fixes the strategy (major selling idea, tone); the concept is the one concrete way to carry that strategy across all platforms, which the brief leaves open (Belch & Belch, creative strategy: a campaign is coordinated activities built on one idea across different media, and the big idea is the creative concept that implements the brief's selling idea), so it is not "just a restatement of the brief". It is the system's internal tool for holding the set together; the evaluation never sees it and judges only the finished set against the brief (Metrics).
- Producer (one per platform): receives the full brief, the orchestrator's creative concept, and its platform assignment, and makes that platform's artifact, fitted to its format. In Independent there is no orchestrator and no concept: the producer works from the brief and its assignment only. Producers get the full brief in every topology: splitting never removes brief information; what Independent removes is the shared concept and the sight of the other producers' work.
- Critic (Fine only): checks the whole set for cross-platform coherence and sends artifacts that drifted from the shared concept back for revision.
  - The loop length follows a stopping rule rather than a fixed count: the loop stops when the critic accepts, or when a round's gain on the in-loop proxy falls below a threshold set in a pilot run. A hard cap (about 5) is only a cost limit, intended to be high enough to record the full gain-per-round curve; the pilot checks that the gains flatten before the cap.
  - Fine delivers the version it stopped on, like the other topologies deliver their one version. No best-of selection over the rounds: that would give Fine an advantage that comes from picking among versions, not from the revision mechanism the study tests. What selection would have added is visible in the round curve (Analysis).
  - Validity caution: the in-loop stopping signal must not be the same judge used for the reported set-coherence score, or the loop optimises the very score it is evaluated on. Use the critic's accept plus a separate lightweight in-loop proxy for stopping; keep the official judge for final scoring only.
  - *Open: what the in-loop proxy concretely is. Chosen in the implementation phase; it must stay separate from the official judge.*
  - Grounding: most of the gain comes in the first rounds, then it saturates (Self-Refine 2023); intrinsic self-correction without a ground-truth signal can degrade output (Huang 2024); whether that happens here is visible in the round curve (Analysis). The critic being a separate agent weakens Huang's argument but does not remove it (still an LLM, not ground truth).

## Topologies

Each producer makes one platform's artifact. The four topologies differ in one thing: where set coherence comes from, which is what the study isolates.

| Topology | Where coherence comes from | Trade-off |
|---|---|---|
| Monolithic | One shared context: the whole set is written in a single context window, with no handoff between separate contexts where coherence could be lost | No specialisation or parallelism, and one context window does not scale |
| Independent | Only the brief: each producer reads the same brief, with no shared context and no shared concept | Three separate readings of the same brief can diverge, and nothing aligns them |
| Coarse | Concept up front: the orchestrator fixes one creative concept, then producers work in parallel with no contact (no feedback) | Each producer applies the shared concept to its own platform specs, so executions can drift with no channel to reconcile them, and set-level drift is never corrected |
| Fine | Up front plus correction: a critic sees the whole set and sends drifting artifacts back to revise (closed loop) | Can correct drift, but costs revision rounds (coordination tax, latency) |

The axis is the explicit set-level coherence mechanism the system adds. Monolithic lies off it, as the reference point: its coherence comes from one shared context, not from an explicit mechanism. The three topologies on the axis differ by how much they add: Independent none beyond the brief, Coarse one shared creative concept before production, Fine the same concept plus a correction loop after the first outputs. The four topologies split the research question into three comparison steps: 

- ***Monolithic vs Independent*** is what splitting alone loses
- ***Independent vs Coarse*** is what the orchestrator's shared concept recovers
- ***Coarse vs Fine*** is what the correction loop adds. 

The research question is whether splitting loses coherence and how much, whether the explicit mechanisms restore it, at what cost, and which topology fits which use case, given the trade-off between set coherence, per-artifact quality, and cost.

**Monolithic**: Single agent instructed to produce all artifacts in one go

```mermaid
flowchart LR
  B(["Brief"]) --> M("Single agent")
  M --> IG[/"Instagram post"/]
  M --> AD[/"Display banner"/]
  M --> FB[/"Story (9:16)"/]
  IG --> S[("Artifact set")]
  AD --> S
  FB --> S
```

**Independent**: each producer works from the brief alone; no orchestrator, no contact between producers.

```mermaid
flowchart TB
  B(["Brief"]) --> P1("Instagram producer")
  B --> P2("Banner producer")
  B --> P3("Story producer")
  P1 --> IG[/"Instagram post"/]
  P2 --> AD[/"Display banner"/]
  P3 --> FB[/"Story (9:16)"/]
  IG --> S[("Artifact set")]
  AD --> S
  FB --> S
```

**Coarse**: the orchestrator dispatches one producer per platform, in parallel, with no contact between them.

```mermaid
flowchart TB
  B(["Brief"]) --> O{{"Orchestrator: shared creative concept"}}
  O --> P1("Instagram producer")
  O --> P2("Banner producer")
  O --> P3("Story producer")
  P1 --> IG[/"Instagram post"/]
  P2 --> AD[/"Display banner"/]
  P3 --> FB[/"Story (9:16)"/]
  IG --> S[("Artifact set")]
  AD --> S
  FB --> S
```

**Fine**: a critic checks the whole set for cross-platform coherence and sends artifacts back to revise.

```mermaid
flowchart TB
  B(["Brief"]) --> O{{"Orchestrator: shared creative concept"}}
  O --> P1("Instagram producer")
  O --> P2("Banner producer")
  O --> P3("Story producer")
  P1 --> IG[/"Instagram post"/]
  P2 --> AD[/"Display banner"/]
  P3 --> FB[/"Story (9:16)"/]
  IG --> Cr("Critic")
  AD --> Cr
  FB --> Cr
  Cr --> Q{"Set coherent?"}
  Q -->|"No: revise"| P1
  Q -->|"No: revise"| P2
  Q -->|"No: revise"| P3
  Q -->|Yes| S[("Artifact set")]
```
### Established MAS design patterns
Each topology is an established pattern:
- **Monolithic**: the single-agent baseline that MAS studies compare against (Tang 2025, Kim 2025).
- **Independent**: parallelization in its *sectioning variant* (Anthropic 2024), independent subtasks run in parallel with no coordination after the split.
- **Coarse**: the orchestrator-workers workflow, a central LLM breaks the task down and delegates to workers (Anthropic 2024), restricted here: the orchestrator emits only the shared concept, the decomposition skeleton is fixed (one producer per platform), and nothing synthesises the outputs, so only the up-front concept differs from Independent. Structurally a centralised communication structure (Guo 2024): agents connect through one central node, with no producer-to-producer channel.
- **Fine**: adds the evaluator-optimizer loop, one LLM generates and another evaluates and feeds back (Anthropic 2024);

## Fair comparison
- The same prompt per role in every topology: each producer's instructions are identical in Coarse and Fine; Independent gets the producer prompt with the orchestrator input (the shared concept) absent, and that absence is the manipulation; Monolithic gets the Independent variant combined into one prompt (no orchestrator-input slots, and no explicit coherence instruction, so its coherence comes only from the shared context).
- Only what must differ per topology differs: the tools an agent has, and the wiring (who talks to whom, the loop). That difference is the granularity.
- Same model and brief. Seeds vary across reps and every call's seed is recorded for reproducibility (Run Anatomy, Test matrix). No topology is tuned more than another.
