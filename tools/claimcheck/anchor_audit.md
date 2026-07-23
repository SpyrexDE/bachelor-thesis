# Cite Evidence Audit

Of 74 cites checked: 62 verbatim-supported, 0 via verbatim substring, 0 not verifiable, 12 without evidence/partial.

**14 cites worth a look** (no clear evidence in the excerpts — possibly a weak quote or evidence outside the excerpts):

- **guo2024llmma** [no-evidence] — Statement: “Multi-agent systems built on large language models are a natural architecture for such set-producing tasks: th…”
  - LLM: The excerpts are mostly title/abstract fragments and bare bibliography entries; the one substantive sentence ("Cooperative agents work together towards a shared goal...") loosely echoes the coordination idea but never mentions splitting work into one producer per artifact or a critic mechanism.
- **tewel2024consistory** [verbatim · partial only] — Statement: “First, consistent text-to-image generation produces image sets with a shared subject or style, evaluated by av…”
  - LLM: Excerpts confirm image sets sharing a subject, but describe evaluation via a human-rater user study (Mechanical Turk), not pairwise embedding similarity as the statement claims.
- **chen2026** [no-evidence] — Statement: “Work on multi-agent architectures for generation, in turn, studies capability and creativity rather than coord…”
  - LLM: The excerpts show M-ASK is explicitly about coordination (role decoupling into Search/Knowledge agents, turn-level rewards) in agentic search, not a study of capability/creativity in generation architectures, and "creativity" never appears in the text.
- **callisonburch2007meta** [no-evidence] — Statement: “First, relative judgments are more reliable than absolute scales: ranking translation outputs was found more c…”
  - LLM: Excerpts confirm the paper compared five-point scoring against ranking and measured timing/agreement for both, but no excerpt states the actual finding that ranking was more consistent/faster or a recommendation to replace scales with ranking.
- **guo2024llmma** [no-evidence] — Statement: “Monolithic is the single-agent baseline against which MAS studies compare ; Independent is parallelization in …”
  - LLM: The excerpts show Guo et al. naming other communication-structure categories (a "shared message pool" and a "layered" structure) but never mention or define a "centralized" structure, so the specific claim attributed to Guo et al. ("centralized structure in Guo et al.'s sense") has no direct verbatim support in the given text.
- **xi2025rise** [no-evidence] — Statement: “Monolithic is the single-agent baseline against which MAS studies compare ; Independent is parallelization in …”
  - LLM: Source_excerpts contain no text on multi-agent cooperation types (ordered/disordered cooperation) or evaluator-optimizer patterns — the specific Xi et al. taxonomy claim the statement makes.
- **madaan2023selfrefine** [no-evidence] — Statement: “Second, the literature bounds what a revision loop can deliver: most of the gain of iterative refinement arriv…”
  - LLM: The excerpts only cover Self-Refine's abstract/method description and one example transcript; none discuss gains saturating across iterations or self-correction degrading output without ground truth.
- **zhang2025** [no-evidence] — Statement: “The framing of inter-agent token overhead as a “communication tax” comes from AgentTaxo and is reused in later…”
- **yan2025beyond** [no-evidence] — Statement: “The framing of inter-agent token overhead as a “communication tax” comes from AgentTaxo and is reused in later…”
  - LLM: The excerpts (Yan et al. 2025 survey) discuss "communication overhead" generically but never use the phrase "communication tax," never mention AgentTaxo, and never discuss "token" costs specifically, so nothing here supports the claim about the tax framing's origin or reuse.
- **tewel2024consistory** [no-evidence] — Statement: “Whole set instead of pairs. The common protocol in prior consistency evaluation is pairwise: average the simil…”
  - LLM: The excerpts show a pairwise-averaging pattern only for layout diversity ("average displacement between corresponding points across each image pair") and an image-vs-text average for prompt-alignment, but never describe subject/identity consistency itself being scored via pairwise image-image similarity.
- **novikova2018rankme** [no-evidence] — Statement: “The rubric block comes after all A/B blocks, never between votes: a score given right after a vote inherits th…”
  - LLM: source_excerpts contain only the title/abstract, intro opening, two isolated sentence fragments, and the bibliography — no methods/procedure text about block ordering, vote-then-score contamination, or elicitation order affecting criterion correlations.
- **callisonburch2007meta** [no-evidence] — Statement: “The evidence comes from machine translation evaluation: ranking outputs relative to each other is more reliabl…”
  - LLM: Excerpts describe the paper's three evaluation methods (five-point scales, sentence ranking, phrase ranking) and note timing/agreement were measured, but contain no passage stating ranking was found more reliable/faster or recommending replacement of scales with ranking.
- **fang2020spaq** [no-evidence] — Statement: “This is documented for translation criteria , for NLG criteria , and for photo quality attributes, where five …”
  - LLM: The excerpt confirms SRCC was computed between the five attribute scores and MOS (overall quality), but the specific 0.78–0.96 range is not present in these excerpts—it would be in Table 2, which was not extracted.
- **ye2025justice** [verbatim · partial only] — Statement: “The judge carries documented biases (position, verbosity, self-preference) ; randomised artifact order and fix…”
  - LLM: Excerpts confirm the paper documents judge biases generally (12 biases, biases persist) and show "position" bias by name, but never mention "verbosity" or "self-preference" bias, so only part of the specific three-item claim is directly evidenced.