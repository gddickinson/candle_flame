"""The desktop requirements must admit the numpy version pinned for the web app and CI (requirements-web.txt)."""
from pathlib import Path

from packaging.requirements import Requirement

ROOT = Path(__file__).resolve().parent.parent


def _reqs(name):
    lines = (ROOT / name).read_text().splitlines()
    return {r.name.lower(): r for r in (Requirement(x) for x in lines if x.strip() and not x.startswith("#"))}


def test_desktop_numpy_pin_admits_web_numpy():
    web = _reqs("requirements-web.txt")["numpy"]
    pinned = next(iter(web.specifier)).version
    assert _reqs("requirements.txt")["numpy"].specifier.contains(pinned), pinned
