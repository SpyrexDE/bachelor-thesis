"""Creative vocabulary the mock draws from.

Pools are keyed by brand and derived from the brief text at call time. The same
pools serve every topology; which entry gets picked depends only on the seed and
on what the prompt contains (shared concept, feedback), so coherence differences
between topologies come from information flow, not from these tables.
"""

import re

STOPWORDS = {
    "a", "an", "and", "at", "for", "in", "it", "its", "of", "on", "one", "or",
    "that", "the", "to", "with", "no", "your", "you", "per", "after", "up",
}

# Five campaign angles; each carries the terms a headline built on it will show.
ANGLES = {
    "proof": "lead with the tested number and let the evidence speak",
    "relief": "show the problem gone and the ease that is left",
    "moment": "capture one concrete scene where the product does its job",
    "identity": "mirror who the audience is when the product works",
    "dare": "challenge the doubt head-on and invite the test",
}

PALETTES = {
    "persil": (
        ("fir green with off-white", ("#1B5E20", "#F5F5F0")),
        ("deep teal with mist", ("#0F4C4C", "#EAF4F2")),
        ("cobalt with paper white", ("#1A3F8F", "#F4F6FB")),
        ("spring green with white", ("#2E7D32", "#FFFFFF")),
    ),
    "schwarzkopf": (
        ("onyx with signal red", ("#141414", "#D8232A")),
        ("aubergine with rose gold", ("#3A1F3D", "#E8B4A0")),
        ("graphite with champagne", ("#2B2B2B", "#EAD9B0")),
        ("noir with ruby", ("#1A0B10", "#B3122E")),
    ),
    "loctite": (
        ("safety red with graphite", ("#C8102E", "#2F3436")),
        ("steel blue with concrete grey", ("#33566E", "#D7DBDD")),
        ("charcoal with signal yellow", ("#26282A", "#F2C14E")),
        ("iron grey with red accent", ("#3E4347", "#C8102E")),
    ),
}

MOTIFS = {
    "persil": (
        "crisp white shirt with a single water droplet",
        "open washing-machine drum with cool light",
        "folded laundry stack on a clean surface",
        "temperature dial set to 20 degrees",
    ),
    "schwarzkopf": (
        "high-gloss hair strand in a sweeping curve",
        "split-panel hair surface, damaged against repaired",
        "liquid keratin ribbon in motion",
        "backstage mirror with warm bulbs",
    ),
    "loctite": (
        "steel hook holding a cast-iron weight",
        "repaired ceramic bowl with a visible seam",
        "single adhesive drop on a steel bolt",
        "clamped chair leg under load",
    ),
}

TONE_STYLES = {
    "warm": ("warm daylight", "soft shadows", "lived-in setting"),
    "premium": ("studio gloss", "high contrast", "editorial finish"),
    "technical": ("neutral background", "hard light", "workshop plate"),
}


def tone_key(tone_text: str) -> str:
    tone = tone_text.lower()
    if "premium" in tone or "glossy" in tone or "editorial" in tone:
        return "premium"
    if "technical" in tone or "no-nonsense" in tone or "dry" in tone:
        return "technical"
    return "warm"


def brand_key(brand_text: str) -> str:
    brand = brand_text.lower()
    for key in PALETTES:
        if key in brand:
            return key
    # Unknown brand: reuse the first pool so the mock still functions.
    return "persil"


def terms(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    return [w for w in words if w not in STOPWORDS and len(w) > 2 or w.isdigit()]
