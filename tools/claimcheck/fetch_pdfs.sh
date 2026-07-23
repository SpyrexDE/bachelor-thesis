#!/usr/bin/env bash
# Re-fetches the source PDFs (gitignored) reproducibly.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p pdfs
get() { echo "-> $2"; curl -sL --max-time 90 "$1" -o "pdfs/$2"; file -b "pdfs/$2" | grep -q PDF || echo "   WARNING: $2 is not a PDF"; }
get "https://www.ijcai.org/proceedings/2024/0890.pdf" guo2024llmma.pdf
get "https://arxiv.org/pdf/2501.06322"  tran2025collab.pdf
get "https://arxiv.org/pdf/2309.07864"  xi2025rise.pdf
get "https://arxiv.org/pdf/2412.17481v2" chen2024mas.pdf
get "https://arxiv.org/pdf/2311.17371"  smit2024mad.pdf
get "https://arxiv.org/pdf/2503.13657"  cemri2025mast.pdf
get "https://arxiv.org/pdf/2604.02460"  trankiela2026.pdf
get "https://arxiv.org/pdf/2509.23537"  tian2025beyond.pdf
# wang2025agenttaxo: OpenReview bot wall, no direct download (link fallback in the tool)
echo "done."
# --- Tier 2/3: all other freely available sources from the drafts ---
get "https://arxiv.org/pdf/2308.08155"  wu2024.pdf
get "https://arxiv.org/pdf/2510.04311"  tang2025complexity.pdf
get "https://arxiv.org/pdf/2512.08296"  kim2025.pdf
get "https://arxiv.org/pdf/2303.17651"  madaan2023selfrefine.pdf
get "https://arxiv.org/pdf/2310.01798"  huang2023selfcorrect.pdf
get "https://arxiv.org/pdf/2509.24086"  alvarado2025repetitions.pdf
get "https://arxiv.org/pdf/2410.03492"  blackwell2024reproducible.pdf
get "https://arxiv.org/pdf/2103.03098"  bouthillier2021variance.pdf
get "https://arxiv.org/pdf/2402.03286"  tewel2024consistory.pdf
get "https://arxiv.org/pdf/2310.08541"  yang2024idea2img.pdf
get "https://arxiv.org/pdf/2601.04703"  chen2026.pdf
get "https://arxiv.org/pdf/2505.21116"  lin2025.pdf
get "https://arxiv.org/pdf/2601.14470"  salim2026.pdf
get "https://arxiv.org/pdf/2410.02506"  zhang2025.pdf
get "https://arxiv.org/pdf/2502.14321"  yan2025beyond.pdf
get "https://arxiv.org/pdf/2508.18739"  wang2025diver.pdf
get "https://arxiv.org/pdf/2603.07119"  koltsov2026tiqa.pdf
get "https://arxiv.org/pdf/2504.14716"  tripathi2025.pdf
get "https://aclanthology.org/2024.acl-long.663.pdf"      ku2024viescore.pdf
get "https://aclanthology.org/2024.emnlp-main.1228.pdf"   liu2024interleaved.pdf
get "https://aclanthology.org/2025.findings-acl.1202.pdf" lu2025textimageplan.pdf
get "https://aclanthology.org/2025.naacl-long.475.pdf"    zeng2025s2mad.pdf
get "https://aclanthology.org/2025.emnlp-industry.17.pdf" wang2025mimo.pdf
get "https://aclanthology.org/W07-0718.pdf"               callisonburch2007meta.pdf
get "https://aclanthology.org/N18-2012.pdf"               novikova2018rankme.pdf
get "https://aclanthology.org/J08-4004.pdf"               artstein2008.pdf
get "https://openaccess.thecvf.com/content_CVPR_2020/papers/Fang_Perceptual_Quality_Assessment_of_Smartphone_Photography_CVPR_2020_paper.pdf" fang2020spaq.pdf
get "https://arxiv.org/pdf/2410.02736"  ye2025justice.pdf
