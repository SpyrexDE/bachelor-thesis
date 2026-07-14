"""Deterministic creative rendering for the mock image model.

Everything drawn here derives from the image prompt text and the request seed;
the render parameters are embedded as a PNG text chunk (vision.py) so mock VLM
calls can 'see' the artifact. Real pixels matter too: spec compliance runs OCR
over these images.
"""

import hashlib
import io
import json
import os
import re
from pathlib import Path
from random import Random

from PIL import Image, ImageDraw, ImageFont, PngImagePlugin

from grain.domain.platforms import PLATFORMS
from grain.providers.mock.vision import MANIFEST_KEY

FONT_CANDIDATES = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial.ttf",
)


def find_font() -> str:
    override = os.environ.get("GRAIN_FONT")
    candidates = (override,) + FONT_CANDIDATES if override else FONT_CANDIDATES
    for path in candidates:
        if path and Path(path).exists():
            return path
    raise FileNotFoundError(
        "no usable TrueType font found; set GRAIN_FONT or install DejaVu/Arial"
    )


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def luminance(rgb: tuple[int, int, int]) -> float:
    r, g, b = rgb
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def shade(rgb: tuple[int, int, int], factor: float) -> tuple[int, int, int]:
    # factor < 1 darkens; factor > 1 lightens toward white.
    if factor <= 1:
        return tuple(int(c * factor) for c in rgb)  # type: ignore[return-value]
    return tuple(min(255, int(c + (255 - c) * (factor - 1))) for c in rgb)  # type: ignore[return-value]


def parse_prompt(prompt: str) -> dict:
    def quoted(label: str) -> str | None:
        match = re.search(rf'{label}: "([^"]+)"', prompt)
        return match.group(1) if match else None

    palette = re.findall(r"#[0-9A-Fa-f]{6}", prompt)
    motif = re.search(r"Motif: ([^.]+)\.", prompt)
    brand = re.search(r"Brand block: (.+?) wordmark", prompt)
    style = re.search(r"Style: ([^.]+)\.", prompt)
    platform_id = None
    for spec in PLATFORMS:
        if prompt.lower().startswith(spec.label.lower()):
            platform_id = spec.id
    return {
        "platform": platform_id,
        "palette": [c.upper() for c in palette[:2]],
        "motif": motif.group(1).strip() if motif else "",
        "headline": quoted("Headline on image"),
        "kicker": quoted("Kicker line"),
        "claim_line": quoted("Claim line"),
        "brand": brand.group(1).strip() if brand else "",
        "style": [s.strip() for s in style.group(1).split(",")] if style else [],
        "bottom_edge_text": "very bottom edge" in prompt,
    }


def draw_motif(base: Image.Image, motif: str, accent: tuple[int, int, int], rng: Random) -> None:
    w, h = base.size
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    fill = accent + (66,)
    strong = accent + (110,)
    variant = int(hashlib.sha256(motif.encode()).hexdigest(), 16) % 6
    # Seed-dependent jitter applied in every variant, so different seeds always
    # produce different renders, as a stochastic image model would.
    dx = int(w * rng.uniform(-0.05, 0.05))
    dy = int(h * rng.uniform(-0.04, 0.04))
    cx = int(w * rng.uniform(0.55, 0.7))
    cy = int(h * rng.uniform(0.5, 0.62))
    r = int(min(w, h) * 0.32)
    if variant == 0:
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=fill)
        draw.ellipse((cx - r // 3, cy - r // 3, cx + r // 5, cy + r // 5), fill=strong)
    elif variant == 1:
        for i in range(3):
            y = int(h * (0.45 + 0.14 * i)) + dy
            draw.rectangle((int(w * 0.12) + dx, y, int(w * 0.88) + dx, y + int(h * 0.06)), fill=fill)
    elif variant == 2:
        width = max(8, r // 4)
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=strong, width=width)
        draw.ellipse(
            (cx - r // 2, cy - r // 2, cx + r // 2, cy + r // 2), outline=fill, width=width // 2
        )
    elif variant == 3:
        for i in range(4):
            offset = i * int(h * 0.05) + dy
            draw.arc(
                (int(-w * 0.3) + dx, int(h * 0.3) + offset, int(w * 1.1) + dx, int(h * 1.2) + offset),
                200, 330, fill=strong, width=max(6, w // 90),
            )
    elif variant == 4:
        split = int(w * 0.5) + dx
        draw.polygon(((split, 0), (w, 0), (w, h), (split - int(w * 0.2), h)), fill=fill)
        draw.line(((split, 0), (split - int(w * 0.2), h)), fill=strong, width=max(6, w // 120))
    else:
        cell = int(min(w, h) * 0.16)
        for row in range(2):
            for col in range(3):
                x0 = int(w * 0.15) + dx + col * int(cell * 1.3)
                y0 = int(h * 0.52) + dy + row * int(cell * 1.3)
                draw.rectangle((x0, y0, x0 + cell, y0 + cell), fill=fill)
    base.alpha_composite(overlay)


def wrap(text: str, font: ImageFont.FreeTypeFont, max_width: int,
         draw: ImageDraw.ImageDraw) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if draw.textlength(trial, font=font) <= max_width or not current:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


class TextPlacer:
    def __init__(self, draw: ImageDraw.ImageDraw, color: tuple[int, int, int],
                 scrim: tuple[int, int, int], max_width: int):
        self.draw = draw
        self.color = color
        self.scrim = scrim
        self.max_width = max_width
        self.boxes: list[dict] = []

    def place(self, kind: str, text: str, font: ImageFont.FreeTypeFont,
              x: int, y: int, center_x: int | None = None) -> int:
        lines = wrap(text, font, self.max_width, self.draw)
        for line in lines:
            width = self.draw.textlength(line, font=font)
            line_x = int(center_x - width / 2) if center_x is not None else x
            bbox = self.draw.textbbox((line_x, y), line, font=font)
            # A solid scrim behind every copy line, the way ads keep text off busy
            # areas; it also keeps the rendered text machine-readable.
            pad = max(4, font.size // 6)
            self.draw.rectangle(
                (bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad), fill=self.scrim
            )
            self.draw.text((line_x, y), line, font=font, fill=self.color)
            self.boxes.append(
                {"kind": kind, "text": line, "box": [bbox[0], bbox[1], bbox[2], bbox[3]]}
            )
            y = bbox[3] + int(font.size * 0.35)
        return y


def render(prompt: str, width: int, height: int, seed: int) -> bytes:
    parsed = parse_prompt(prompt)
    rng = Random(seed)
    font_path = find_font()

    primary = hex_rgb(parsed["palette"][0]) if parsed["palette"] else (60, 60, 60)
    accent = hex_rgb(parsed["palette"][1]) if len(parsed["palette"]) > 1 else (220, 220, 220)

    base = Image.new("RGBA", (width, height))
    top, bottom = primary, shade(primary, 0.72)
    for y in range(height):
        t = y / max(1, height - 1)
        row = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        ImageDraw.Draw(base).line(((0, y), (width, y)), fill=row + (255,))
    draw_motif(base, parsed["motif"], accent, rng)

    draw = ImageDraw.Draw(base)
    dark_background = luminance(primary) < 150
    text_color = (250, 250, 250) if dark_background else (20, 20, 20)
    scrim = shade(primary, 0.45) if dark_background else shade(primary, 1.6)

    is_banner = width <= 400
    headline_size = max(20, int(width * (0.10 if is_banner else 0.075)))
    headline_font = ImageFont.truetype(font_path, headline_size)
    small_font = ImageFont.truetype(font_path, max(14, int(headline_size * 0.42)))
    brand_font = ImageFont.truetype(font_path, max(13, int(headline_size * 0.38)))

    margin = int(width * 0.07)
    placer = TextPlacer(draw, text_color, scrim, max_width=width - 2 * margin)

    if parsed["platform"] == "story":
        safe_left = int(width * 0.06)
        top_y = int(height * 0.30)
        y = placer.place("headline", parsed["headline"] or "", headline_font,
                         safe_left, top_y, center_x=width // 2)
        if parsed["kicker"]:
            y = placer.place("kicker", parsed["kicker"], small_font,
                             safe_left, y + 8, center_x=width // 2)
        if parsed["claim_line"]:
            if parsed["bottom_edge_text"]:
                claim_y = height - int(small_font.size * 1.8)
            else:
                claim_y = min(y + int(height * 0.05), int(height * 0.58))
            placer.place("claim", parsed["claim_line"], small_font,
                         safe_left, claim_y, center_x=width // 2)
    elif is_banner:
        y = placer.place("headline", parsed["headline"] or "", headline_font, margin, int(height * 0.14))
        if parsed["kicker"]:
            y = placer.place("kicker", parsed["kicker"], small_font, margin, y + 4)
        if parsed["claim_line"]:
            placer.place("claim", parsed["claim_line"], small_font, margin, int(height * 0.72))
    else:
        y = placer.place("headline", parsed["headline"] or "", headline_font,
                         margin, int(height * 0.24), center_x=width // 2)
        if parsed["kicker"]:
            y = placer.place("kicker", parsed["kicker"], small_font,
                             margin, y + 10, center_x=width // 2)
        if parsed["claim_line"]:
            placer.place("claim", parsed["claim_line"], small_font, margin, int(height * 0.80))

    if parsed["brand"]:
        pad = max(6, width // 90)
        text_w = draw.textlength(parsed["brand"], font=brand_font)
        block_w, block_h = int(text_w + 2 * pad), int(brand_font.size + 2 * pad)
        if is_banner:
            x0, y0 = width - block_w - 6, height - block_h - 6
        elif parsed["platform"] == "story":
            x0, y0 = width - block_w - int(width * 0.06), int(height * 0.15)
        else:
            x0, y0 = width - block_w - margin, margin
        draw.rectangle((x0, y0, x0 + block_w, y0 + block_h), fill=accent)
        brand_color = (20, 20, 20) if luminance(accent) >= 150 else (250, 250, 250)
        draw.text((x0 + pad, y0 + pad), parsed["brand"], font=brand_font, fill=brand_color)
        placer.boxes.append(
            {"kind": "brand", "text": parsed["brand"], "box": [x0, y0, x0 + block_w, y0 + block_h]}
        )

    manifest = {
        "platform": parsed["platform"],
        "canvas": [width, height],
        "palette": parsed["palette"],
        "motif": parsed["motif"],
        "headline": parsed["headline"],
        "kicker": parsed["kicker"],
        "claim_line": parsed["claim_line"],
        "brand": parsed["brand"],
        "style": parsed["style"],
        "text_boxes": placer.boxes,
    }
    info = PngImagePlugin.PngInfo()
    info.add_text(MANIFEST_KEY, json.dumps(manifest))
    buffer = io.BytesIO()
    base.convert("RGB").save(buffer, format="PNG", pnginfo=info, optimize=True)
    return buffer.getvalue()
