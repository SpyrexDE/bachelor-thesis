"""Spec compliance: the one quality metric checked in code, not by an LLM
(concept/03). Only what a producer can actually get wrong is scored: required
claims, prohibited wording, story safe zone and readability. Rendered text is
read via OCR."""

import re
from pathlib import Path

import pytesseract
from PIL import Image, ImageOps
from pytesseract import Output

from grain.domain.brief import Brief
from grain.domain.platforms import PlatformSpec, outside_safe_zone

OCR_CONFIDENCE = 40  # below this, tesseract's own word guesses are noise


def normalise(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]", " ", text.lower()).strip()


def tokens(text: str) -> set[str]:
    return set(normalise(text).split())


def prepare_for_ocr(image: Image.Image) -> tuple[Image.Image, float]:
    """Tesseract wants dark text on light ground; small canvases (the banner)
    are upscaled. Returns the prepared image and the factor to map coordinates
    back to the original."""
    scale = 3.0 if image.width < 400 else 1.0
    if scale != 1.0:
        image = image.resize((int(image.width * scale), int(image.height * scale)))
    grey = image.convert("L")
    histogram = grey.histogram()
    mean = sum(i * count for i, count in enumerate(histogram)) / max(1, sum(histogram))
    if mean < 128:
        grey = ImageOps.invert(grey)
    return grey, scale


def ocr_words(image_path: Path) -> list[dict]:
    with Image.open(image_path) as image:
        prepared, scale = prepare_for_ocr(image)
        data = pytesseract.image_to_data(prepared, output_type=Output.DICT)
    words = []
    for i, text in enumerate(data["text"]):
        if not text.strip() or float(data["conf"][i]) < 0:
            continue
        words.append({
            "text": text,
            "conf": float(data["conf"][i]),
            "box": (
                data["left"][i] / scale, data["top"][i] / scale,
                (data["left"][i] + data["width"][i]) / scale,
                (data["top"][i] + data["height"][i]) / scale,
            ),
        })
    return words


def claim_present(claim: str, artifact_tokens: set[str]) -> bool:
    wanted = tokens(claim)
    # OCR drops the odd word; four of five claim tokens still count as present.
    return bool(wanted) and len(wanted & artifact_tokens) / len(wanted) >= 0.8


def check_artifact(brief: Brief, spec: PlatformSpec, image_path: Path) -> list[dict]:
    words = [w for w in ocr_words(image_path) if w["conf"] >= OCR_CONFIDENCE]
    ocr_text = " ".join(w["text"] for w in words)
    full_text = normalise(ocr_text)
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

    if spec.safe_zone is not None:
        with Image.open(image_path) as image:
            width, height = image.size
        offenders = [
            w["text"] for w in words if outside_safe_zone(w["box"], width, height, spec.safe_zone)
        ]
        checks.append({
            "check": "on-image text inside the safe zone",
            "passed": not offenders,
            "note": f'outside: {", ".join(offenders[:4])}' if offenders else "",
        })
        readable = len(words) >= 3 and sum(w["conf"] for w in words) / max(1, len(words)) >= 50
        checks.append({
            "check": "on-image text readable",
            "passed": readable,
            "note": f"{len(words)} words recognised",
        })

    return checks


def compliance_share(checks: list[dict]) -> float:
    return round(sum(1 for c in checks if c["passed"]) / len(checks), 4)
