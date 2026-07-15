"""Spec compliance: the one quality metric checked in code, not by an LLM
(concept/03). It scores only what a producer decides: required claims present
and prohibited wording absent. The verbatim claim and wording strings are read
from the rendered image via OCR. Placement (safe zone) and pixel size are set by
the image model, not the producer, so they carry no coordination signal and stay
out of the scored share."""

import re
from pathlib import Path

import pytesseract
from PIL import Image, ImageOps
from pytesseract import Output

from grain.domain.brief import Brief

OCR_CONFIDENCE = 40  # below this, tesseract's own word guesses are noise


def normalise(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]", " ", text.lower()).strip()


def tokens(text: str) -> set[str]:
    return set(normalise(text).split())


def prepare_for_ocr(image: Image.Image) -> Image.Image:
    """Tesseract wants dark text on light ground; small canvases (the banner)
    are upscaled so their words survive recognition."""
    if image.width < 400:
        image = image.resize((image.width * 3, image.height * 3))
    grey = image.convert("L")
    histogram = grey.histogram()
    mean = sum(i * count for i, count in enumerate(histogram)) / max(1, sum(histogram))
    if mean < 128:
        grey = ImageOps.invert(grey)
    return grey


def ocr_text(image_path: Path) -> str:
    with Image.open(image_path) as image:
        data = pytesseract.image_to_data(prepare_for_ocr(image), output_type=Output.DICT)
    words = [
        text for text, conf in zip(data["text"], data["conf"])
        if text.strip() and float(conf) >= OCR_CONFIDENCE
    ]
    return normalise(" ".join(words))


def claim_present(claim: str, artifact_tokens: set[str]) -> bool:
    wanted = tokens(claim)
    # OCR drops the odd word; four of five claim tokens still count as present.
    return bool(wanted) and len(wanted & artifact_tokens) / len(wanted) >= 0.8


def check_artifact(brief: Brief, image_path: Path) -> list[dict]:
    full_text = ocr_text(image_path)
    artifact_tokens = set(full_text.split())

    checks: list[dict] = []
    for claim in brief.mandatories.required_claims:
        checks.append({
            "check": f'required claim "{claim}"',
            "passed": claim_present(claim, artifact_tokens),
        })
    for phrase in brief.mandatories.prohibited_wording:
        checks.append({
            "check": f'prohibited wording "{phrase}"',
            "passed": normalise(phrase) not in full_text,
        })
    return checks


def compliance_share(checks: list[dict]) -> float:
    return round(sum(1 for c in checks if c["passed"]) / len(checks), 4)
