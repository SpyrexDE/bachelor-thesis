import os
from dataclasses import dataclass
from pathlib import Path

IMPLEMENTATION_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    briefs_dir: Path
    provider: str
    # When set, researcher endpoints require this token so raters sharing the
    # host cannot unblind themselves via the admin API. Unset = open (local dev).
    admin_token: str | None


def load_settings() -> Settings:
    return Settings(
        data_dir=Path(os.environ.get("GRAIN_DATA_DIR", "data")).resolve(),
        briefs_dir=Path(
            os.environ.get("GRAIN_BRIEFS_DIR", IMPLEMENTATION_ROOT / "briefs")
        ).resolve(),
        provider=os.environ.get("GRAIN_PROVIDER", "mock"),
        admin_token=os.environ.get("GRAIN_ADMIN_TOKEN") or None,
    )
