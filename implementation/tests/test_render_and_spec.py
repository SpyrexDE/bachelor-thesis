"""Renderer determinism and the code-checked spec compliance (concept/03)."""

import io

from PIL import Image

from grain.domain.platforms import BANNER, INSTAGRAM, STORY
from grain.metrics.spec import check_artifact, compliance_share
from grain.providers.base import ImageRequest
from grain.providers.mock import MockProvider
from grain.providers.mock.vision import read_manifest
from tests.conftest import requires_tesseract

PROMPT = (
    'Story (9:16) creative, 1440x2560. Palette: fir green with off-white '
    '(#1B5E20, #F5F5F0). Motif: crisp white shirt with a single water droplet. '
    'Headline on image: "Numbers first: 20 degrees.". '
    'Claim line: "Deep Clean at 20 degrees". '
    'Style: warm daylight, soft shadows, lived-in setting. Brand block: Persil wordmark. '
    "Keep all text inside the safe area: top 14%, bottom 35%, sides 6% stay free."
)

VIOLATION_PROMPT = PROMPT.replace(
    "Keep all text inside the safe area: top 14%, bottom 35%, sides 6% stay free.",
    "Place the claim line at the very bottom edge of the frame.",
)


def render(prompt: str, spec=STORY, seed: int = 7) -> bytes:
    provider = MockProvider()
    return provider.image(
        ImageRequest(prompt=prompt, width=spec.width, height=spec.height, seed=seed)
    ).png


def test_render_is_deterministic():
    assert render(PROMPT) == render(PROMPT)
    assert render(PROMPT, seed=8) != render(PROMPT, seed=7)


def test_manifest_travels_inside_the_png(tmp_path):
    path = tmp_path / "story.png"
    path.write_bytes(render(PROMPT))
    manifest = read_manifest(path)
    assert manifest["platform"] == "story"
    assert manifest["palette"] == ["#1B5E20", "#F5F5F0"]
    assert manifest["headline"] == "Numbers first: 20 degrees."
    assert manifest["text_boxes"]


def test_banner_stays_under_the_150_kb_limit():
    png = render(
        'Display banner creative, 300x250. Palette: safety red with graphite '
        '(#C8102E, #2F3436). Motif: steel hook holding a cast-iron weight. '
        'Headline on image: "Rated 250 kg. Used daily.". '
        'Claim line: "Holds up to 250 kg". Style: neutral background, hard light, '
        'workshop plate. Brand block: Loctite wordmark.',
        spec=BANNER,
    )
    assert len(png) <= 150 * 1024  # concept/02, banner file limit
    assert Image.open(io.BytesIO(png)).size == (300, 250)


@requires_tesseract
def test_spec_checks_pass_on_a_clean_story(tmp_path, briefs):
    path = tmp_path / "story.png"
    path.write_bytes(render(PROMPT))
    checks = check_artifact(briefs["persil"], STORY, path, caption=None)
    by_name = {c["check"]: c["passed"] for c in checks}
    assert by_name['required claim "Deep Clean at 20 degrees"'] is True
    assert by_name["on-image text inside the safe zone"] is True
    assert by_name["on-image text readable"] is True
    assert all(passed for name, passed in by_name.items() if name.startswith("prohibited"))


@requires_tesseract
def test_spec_flags_text_outside_the_safe_zone(tmp_path, briefs):
    path = tmp_path / "story.png"
    path.write_bytes(render(VIOLATION_PROMPT))
    checks = check_artifact(briefs["persil"], STORY, path, caption=None)
    safe_zone = next(c for c in checks if c["check"] == "on-image text inside the safe zone")
    assert safe_zone["passed"] is False
    assert compliance_share(checks) < 1.0


@requires_tesseract
def test_spec_flags_prohibited_wording_in_caption(tmp_path, briefs):
    path = tmp_path / "story.png"
    path.write_bytes(render(PROMPT))
    checks = check_artifact(
        briefs["persil"], STORY, path,
        caption=None,
    )
    clean = {c["check"]: c["passed"] for c in checks}
    assert clean['prohibited wording "germ-free"'] is True

    # Same render, but the caption smuggles a prohibited phrase.
    ig_path = tmp_path / "ig.png"
    ig_path.write_bytes(render(PROMPT.replace("Story (9:16)", "Instagram post"),
                               spec=INSTAGRAM))
    checks = check_artifact(briefs["persil"], INSTAGRAM, ig_path,
                            caption="Practically germ-free freshness. #persil")
    flagged = {c["check"]: c["passed"] for c in checks}
    assert flagged['prohibited wording "germ-free"'] is False


def test_caption_limits_checked_without_ocr(tmp_path, briefs, monkeypatch):
    # Caption checks are pure code; verify hashtag counting on a crafted caption.
    import grain.metrics.spec as spec_module

    monkeypatch.setattr(spec_module, "ocr_words", lambda path: [])
    caption = "Fresh. " + " ".join(f"#tag{i}" for i in range(31))
    checks = check_artifact(briefs["persil"], INSTAGRAM, tmp_path / "x.png", caption)
    by_name = {c["check"]: c for c in checks}
    assert by_name["at most 30 hashtags"]["passed"] is False
    assert by_name["caption within 2200 characters"]["passed"] is True
