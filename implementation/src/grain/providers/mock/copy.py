"""Headline writing for the mock producer."""

import re
from random import Random

HEADLINES = {
    "proof": {
        "warm": ("{benefit}. Tested, not promised.", "Numbers first: {num}."),
        "premium": ("{num}. Measured. Visible.", "Proof, mirrored: {num}."),
        "technical": ("{num}. Verified.", "Rated {num}. Used daily."),
    },
    "relief": {
        "warm": ("The hard part, handled.", "One worry less, every time."),
        "premium": ("Damage, dismissed.", "{benefit} — and it shows."),
        "technical": ("Fixed means fixed.", "No re-dos."),
    },
    "moment": {
        "warm": ("One go. {benefit}.", "Today: {benefit}."),
        "premium": ("First use. {benefit}.", "Instant classic: {benefit}."),
        "technical": ("On the job: {benefit}.", "First fix: {benefit}."),
    },
    "identity": {
        "warm": ("You care. It shows.", "For the ones who notice."),
        "premium": ("You set the standard.", "Made for your kind of bold."),
        "technical": ("You do it properly. So does {brand}.", "Built for people who check twice."),
    },
    "dare": {
        "warm": ("Go on, put it to the test.", "See for yourself."),
        "premium": ("Dare the mirror.", "Prove it on camera."),
        "technical": ("Test it. Then talk.", "Load it up. Watch it hold."),
    },
}


def benefit_short(key_benefit: str) -> str:
    clause = re.split(r"[,.]| that ", key_benefit)[0].strip()
    words = clause.split()
    if len(words) > 7:
        clause = " ".join(words[:7])
    return clause


NUMBER_UNIT = r"\b\d+ ?(?:kg|percent|%|degrees|°C?)\b"


def number_phrase(brief_fields_text: str, fallback_text: str = "") -> str:
    # The number worth leading with comes from the selling idea or a required
    # claim, not from whatever number appears first in the brief.
    for source in (brief_fields_text, fallback_text):
        match = re.search(NUMBER_UNIT, source)
        if match:
            return match.group(0)
    return "day one"


def headline(angle: str, tone: str, brief_fields: dict, rng: Random) -> str:
    template = rng.choice(HEADLINES[angle][tone])
    return template.format(
        benefit=brief_fields["benefit"],
        num=brief_fields["num"],
        brand=brief_fields["brand"],
    )
