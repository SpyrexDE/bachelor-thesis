// Evidence passages checked BY HAND per concept claim (verbatim from the PDF).
// Takes precedence over the word-overlap heuristic in build_concept.mjs. An entry
// means: "I (or the LLM anchor run) READ the statement + source and this
// passage supports exactly this claim." A claim without an entry is only
// GUESSED by keyword and is marked in the UI as an approximation, not as checked.
// match: claim with data-src == src whose text contains `contains`.
export const CONCEPT_ANCHORS = [
  // --- broken cases fixed ---
  { src: "madaan2023selfrefine", contains: "most of the gain comes in the first rounds",
    needle: "marginal improvement naturally decreases with more iterations" },
  { src: "guo2024llmma", contains: "centralised communication structure",
    needle: "central agent coordinating the system" },
  // --- clearly correct matches confirmed (statement+passage read) ---
  // NOTE: the crisp phrasing "cost of coordination can exceed benefit of collaboration"
  // is Straub, Tsvetkova & Yasseri 2023 (Collective Intelligence) — Tang only CITES it (ref [17]).
  // So this uses Tang's OWN statement (benefit of MAS grows with task depth), matching the "(Tang:
  // MAS helps mainly on deep tasks)" cite. If the cost statement needs crisp evidence: cite Straub directly.
  { src: "tang2025complexity", contains: "adds coordination cost",
    needle: "the benefit of LLM-MAS over LLM-SAS increases with both task depth and width, and the effect is more pronounced with respect to depth" },
  { src: "huang2023selfcorrect", contains: "intrinsic self-correction",
    needle: "LLMs struggle to selfcorrect their responses without external feedback, and at times, their performance even degrades after self-correction." },
  { src: "bouthillier2021variance", contains: "run three and report the variance",
    needle: "computed across a single run of the two pipelines, but a better practice used in the deep-learning community is to average multiple seeds" },
  { src: "liu2024interleaved", contains: "Protocol and scale follow InterleavedEval",
    needle: "To obtain a holistic and comprehensive evaluation of interleaved generation, we define five fine-grained evaluation aspects" },
  { src: "liu2024interleaved", contains: "Spearman correlation between judge and human",
    needle: "Mete-evaluation on evaluation metrics in terms of Spearman correlation between automatic evaluation" },
  { src: "tripathi2025", contains: "less robust protocol",
    needle: "Pairwise preferences flip in about 35% of the cases, compared to only 9% for absolute scores" },
  { src: "artstein2008", contains: "inter-rater agreement",
    needle: "This article is a survey of methods for measuring agreement among corpus annotators." },
  { src: "tang2025complexity", contains: "single-agent baseline that MAS studies compare against",
    needle: "the performance advantage of an LLM-MAS over a single-agent baseline (LLM-SAS) grows with task complexity" },
  { src: "novikova2018rankme", contains: "inherits the just-formed",
    needle: "Separate collection (Setup 2), however, decreases correlation between naturalness and quality, as well as naturalness and informativeness to very low levels" },
  { src: "liu2024interleaved", contains: "only moderate on coherence",
    needle: "Mete-evaluation on evaluation metrics in terms of Spearman correlation between automatic evaluation" },
  { src: "fang2020spaq", contains: "for photos",
    needle: "we compute the Spearman’s rank correlation coefficient (SRCC) between MOSs and attribute scores, as listed in Table 2" },
  // the 4 previously unlinked ones, now read up in the PDFs
  { src: "tewel2024consistory", contains: "average the similarity of every image pair",
    needle: "We calculate the pair-wise similarity between each pair of images in each of the 100 sets" },
  { src: "callisonburch2007meta", contains: "ranking outputs relative to each other more",
    needle: "comparing systems by ranking them manually (constituents or entire sentences), resulted in much higher inter-annotator agreement" },
  { src: "callisonburch2007meta", contains: "Documented for translations",
    needle: "The high correlation between people’s fluency and adequacy scores" },
  { src: "novikova2018rankme", contains: "for NLG criteria",
    needle: "human judges often fail to distinguish between these different aspects, which results in highly correlated scores" },

  // --- external sources: show supporting TEXT directly on the right (no link path) ---
  // Anthropic "Building Effective Agents" (blog, 23 Jul, pulled verbatim from the page)
  { src: "anthropic2024agents", contains: "in its sectioning variant",
    quote: "Breaking a task into independent subtasks run in parallel." },
  { src: "anthropic2024agents", contains: "deliberately not the orchestrator-workers",
    quote: "A central LLM dynamically breaks down tasks, delegates them to worker LLMs, and synthesize their results." },
  { src: "anthropic2024agents", contains: "evaluator-optimizer loop",
    quote: "One LLM call generates a response while another provides evaluation and feedback in a loop." },
  // OpenAI Seed docs (verified by Fabian 04 Jul)
  { src: "openai2026seed", contains: "API seeds are best effort",
    quote: "Determinism is not guaranteed." },
  // Meta Ads Guide — spec values verified by Fabian 04 Jul (not fresh verbatim, Meta's page is JS-locked)
  { src: "meta2026adsguide", contains: "4:5 image, recommended 1440x1800",
    quote: "4:5 feed image — recommended resolution 1440 × 1800 px. (Meta Ads Guide, verified 04 Jul)" },
  { src: "meta2026adsguide", contains: "9:16 full-frame image, recommended 1440x2560",
    quote: "9:16 full-screen story/reel — recommended resolution 1440 × 2560 px. (Meta Ads Guide, verified 04 Jul)" },
  { src: "meta2026adsguide", contains: "roughly 14% of the top",
    quote: "Safe zone: keep core content clear of ~14% top, ~35% bottom and ~6% each side. (Meta Ads Guide, verified 04 Jul)" },
  // Belch & Belch — from our research (29 Jun), checked by Fabian against the book.
  // Brief elements: Fig. 8-3 verbatim (concept/02). Creative strategy: our research phrasing.
  { src: "belch2021advertising", contains: "Creative-brief elements, verbatim from",
    quote: "Belch & Belch, Advertising and Promotion — Fig. 8-3 'Key Elements of a Creative Brief': basic problem/issue to solve · communication objectives · target audience · insights to drive creative work · key benefits / major selling idea · reason to believe / supporting information · tone and manner / brand personality · deliverables · measures of success." },
  { src: "belch2021advertising", contains: "they are the brief elements",
    quote: "Belch & Belch, Advertising and Promotion — Fig. 8-3 'Key Elements of a Creative Brief': basic problem/issue to solve · communication objectives · target audience · insights to drive creative work · key benefits / major selling idea · reason to believe / supporting information · tone and manner / brand personality · deliverables · measures of success." },
  // AgentTaxo: its own OpenReview abstract is behind a bot wall (already so on 10 Jul); sentence from the CITING literature, transparently marked.
  { src: "wang2025agenttaxo", contains: "framing for inter-agent",
    quote: "From the literature citing it: AgentTaxo introduces the concept of a 'communication tax' to describe the overhead from inter-agent interactions. (AgentTaxo's own OpenReview abstract is behind a bot wall.)" },
  { src: "belch2021advertising", contains: "the concept is the one concrete way",
    quote: "Belch & Belch, creative strategy: a campaign is coordinated activities built on one central idea carried across different media; the 'big idea' (creative concept) is the concrete idea that implements the brief's selling idea across all platforms." },
];
