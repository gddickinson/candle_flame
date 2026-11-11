"""Write tests/fixtures/flame_reference.json: numbers from the real Python particles, noise, camera and geometry
that the node tests (candle/web/static/*.test.mjs) compare the JavaScript port against.

Run after changing particles.py, noise.py, simulation.py, camera.py, geometry.py or candle/web/reference.py:
    python scripts/make_js_fixtures.py
tests/test_web.py fails if the committed fixture is out of date.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from candle.web.reference import fixture  # noqa: E402

FIXTURE = ROOT / "tests" / "fixtures" / "flame_reference.json"


def dumps(data) -> str:
    return json.dumps(data, separators=(",", ":"), sort_keys=True)


def main():
    FIXTURE.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE.write_text(dumps(fixture()))
    print(f"wrote {FIXTURE} ({FIXTURE.stat().st_size / 1e3:.0f} kB)")


if __name__ == "__main__":
    main()
