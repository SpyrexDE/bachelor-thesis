from dataclasses import dataclass


@dataclass(frozen=True)
class SafeZone:
    # Fractions of the canvas that platform UI covers: concept/02, story spec.
    top: float
    bottom: float
    side: float


@dataclass(frozen=True)
class PlatformSpec:
    id: str
    label: str
    width: int
    height: int
    has_caption: bool
    caption_max_chars: int | None
    hashtag_max: int | None
    safe_zone: SafeZone | None


# Enforced limits and recommended resolutions: concept/02, artifact set.
INSTAGRAM = PlatformSpec(
    id="instagram",
    label="Instagram post",
    width=1440,
    height=1800,
    has_caption=True,
    caption_max_chars=2200,
    hashtag_max=30,
    safe_zone=None,
)

STORY = PlatformSpec(
    id="story",
    label="Story (9:16)",
    width=1440,
    height=2560,
    has_caption=False,
    caption_max_chars=None,
    hashtag_max=None,
    safe_zone=SafeZone(top=0.14, bottom=0.35, side=0.06),
)

BANNER = PlatformSpec(
    id="banner",
    label="Display banner",
    width=300,
    height=250,
    has_caption=False,
    caption_max_chars=None,
    hashtag_max=None,
    safe_zone=None,
)

PLATFORMS: tuple[PlatformSpec, ...] = (INSTAGRAM, STORY, BANNER)


def platform(platform_id: str) -> PlatformSpec:
    for spec in PLATFORMS:
        if spec.id == platform_id:
            return spec
    raise KeyError(f"unknown platform: {platform_id}")


def outside_safe_zone(box: tuple[float, float, float, float], width: int, height: int,
                      zone: SafeZone) -> bool:
    x0, y0, x1, y1 = box
    return (
        y0 < zone.top * height
        or y1 > (1 - zone.bottom) * height
        or x0 < zone.side * width
        or x1 > (1 - zone.side) * width
    )
