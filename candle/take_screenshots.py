#!/usr/bin/env python3
"""
Capture example screenshots of the candle flame simulator.

Launches the application headlessly, waits for the flame to
settle, then saves a series of screenshots with different
settings to the screenshots/ directory.
"""
from __future__ import annotations

import os
import sys
import math

from PyQt5.QtCore import QTimer
from PyQt5.QtWidgets import QApplication

# Ensure the package is importable from the project root
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from PyQt5.QtGui import QSurfaceFormat

from candle.app import DARK_STYLE
from candle.main_window import MainWindow

SHOTS_DIR = os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(SHOTS_DIR, exist_ok=True)


def _capture(window: MainWindow, name: str):
    """Grab the canvas framebuffer and save to screenshots/."""
    path = os.path.join(SHOTS_DIR, name)
    window.canvas.screenshot(path)
    print(f"  saved {path}")


def main():
    # OpenGL surface format — must be set before QApplication
    fmt = QSurfaceFormat()
    fmt.setVersion(2, 1)
    fmt.setProfile(QSurfaceFormat.CompatibilityProfile)
    fmt.setDepthBufferSize(24)
    fmt.setSamples(4)
    fmt.setSwapBehavior(QSurfaceFormat.DoubleBuffer)
    QSurfaceFormat.setDefaultFormat(fmt)

    app = QApplication(sys.argv)
    app.setStyleSheet(DARK_STYLE)

    win = MainWindow()
    win.resize(960, 700)
    win.show()

    steps: list[tuple[int, callable]] = []
    step_idx = [0]

    def _schedule(delay_ms: int, fn):
        steps.append((delay_ms, fn))

    # ── Shot 1: Default flame ────────────────────────────────────────
    def shot_default():
        print("[1/5] Default flame")
        _capture(win, "default_flame.png")

    _schedule(3000, shot_default)

    # ── Shot 2: High intensity + turbulence ──────────────────────────
    def shot_intense():
        print("[2/5] High intensity")
        win.panel._intensity.setValue(100)
        win.panel._turb.setValue(85)

    def shot_intense_cap():
        _capture(win, "high_intensity.png")

    _schedule(500, shot_intense)
    _schedule(2000, shot_intense_cap)

    # ── Shot 3: Wind effect ──────────────────────────────────────────
    def shot_wind():
        print("[3/5] Wind effect")
        win.panel._intensity.setValue(70)
        win.panel._turb.setValue(50)
        win.panel._wx.setValue(40)

    def shot_wind_cap():
        _capture(win, "wind_effect.png")

    _schedule(500, shot_wind)
    _schedule(2000, shot_wind_cap)

    # ── Shot 4: Burgundy candle ──────────────────────────────────────
    def shot_burgundy():
        print("[4/5] Burgundy candle")
        win.panel._wx.setValue(0)
        win.canvas.set_candle_color(0.42, 0.08, 0.12)

    def shot_burgundy_cap():
        _capture(win, "burgundy_candle.png")

    _schedule(500, shot_burgundy)
    _schedule(2000, shot_burgundy_cap)

    # ── Shot 5: Full window screenshot ───────────────────────────────
    def shot_full():
        print("[5/5] Full window with UI")
        win.canvas.set_candle_color(0.96, 0.94, 0.88)
        win.panel._intensity.setValue(70)

    def shot_full_cap():
        img = win.grab()
        path = os.path.join(SHOTS_DIR, "full_window.png")
        img.save(path)
        print(f"  saved {path}")

    _schedule(500, shot_full)
    _schedule(2000, shot_full_cap)

    # ── Done ─────────────────────────────────────────────────────────
    def done():
        print("\nAll screenshots saved to screenshots/")
        app.quit()

    _schedule(500, done)

    # Chain timers
    def run_next():
        if step_idx[0] >= len(steps):
            return
        delay, fn = steps[step_idx[0]]
        step_idx[0] += 1
        QTimer.singleShot(delay, lambda: (fn(), run_next()))

    QTimer.singleShot(0, run_next)

    app.exec_()


if __name__ == "__main__":
    main()
