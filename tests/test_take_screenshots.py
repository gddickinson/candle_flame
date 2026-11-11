"""take_screenshots.py must write to the repo-root screenshots/ folder that the README gallery shows."""
import os
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)


def test_shots_dir_is_readme_gallery():
    pytest.importorskip("PyQt5")
    pytest.importorskip("OpenGL")
    from candle import take_screenshots
    assert os.path.realpath(take_screenshots.SHOTS_DIR) == os.path.join(os.path.realpath(ROOT), "screenshots")
    readme = open(os.path.join(ROOT, "README.md")).read()
    for name in ("default_flame.png", "high_intensity.png", "wind_effect.png", "burgundy_candle.png", "full_window.png"):
        assert f"screenshots/{name}" in readme and os.path.exists(os.path.join(ROOT, "screenshots", name))
