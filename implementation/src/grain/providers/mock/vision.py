"""What the mock 'sees' in an image.

The renderer embeds the visible features of a creative (palette, headline,
text lines, boxes) as a PNG text chunk. Mock critic and judges read that chunk
where a real VLM would read pixels; the information travels only inside the
artifact file itself.
"""

import json
from pathlib import Path

from PIL import Image

MANIFEST_KEY = "grain"


def read_manifest(image_path: Path) -> dict:
    with Image.open(image_path) as image:
        raw = image.text.get(MANIFEST_KEY)
    if raw is None:
        raise ValueError(f"{image_path} carries no render manifest")
    return json.loads(raw)
