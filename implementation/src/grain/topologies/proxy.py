"""In-loop stopping proxy for Fine.

Deliberately cruder than the official set-coherence judge and kept apart from it
(concept/01 validity caution; docs/.ai/decisions.md D11): no brief, no rubric, no
tone — just palette uniformity and wording overlap across the draft set. The
concrete real-mode proxy remains an open point for the pilot phase.
"""

from itertools import combinations
from pathlib import Path

from grain.providers.mock.lexicon import terms
from grain.providers.mock.vision import read_manifest


def proxy_score(image_paths: list[Path]) -> float:
    manifests = [read_manifest(path) for path in image_paths]
    palettes = {tuple(m["palette"]) for m in manifests}
    palette_uniformity = 1.0 if len(palettes) == 1 else 1.0 / len(palettes)

    term_sets = [
        set(terms(" ".join(filter(None, (m["headline"], m["kicker"], m["claim_line"])))))
        for m in manifests
    ]
    overlaps = [
        len(a & b) / len(a | b) if a | b else 1.0
        for a, b in combinations(term_sets, 2)
    ]
    wording_overlap = sum(overlaps) / len(overlaps)

    return round(0.5 * palette_uniformity + 0.5 * wording_overlap, 4)
