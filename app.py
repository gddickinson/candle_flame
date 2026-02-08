"""
CLI entry point for the 3D candle flame simulator.

Sets up the Qt application with a dark amber theme, configures
the OpenGL surface format, and shows the main window.

Usage::

    python -m candle
    python run_candle.py
"""
from __future__ import annotations
import logging
import sys

from PyQt5.QtGui import QSurfaceFormat
from PyQt5.QtWidgets import QApplication

from .main_window import MainWindow

log = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────
# Dark amber theme  (matches the lava-lamp project)
# ─────────────────────────────────────────────────────────────────────

DARK_STYLE = """
QWidget {
    background-color: #0e0c09;
    color: #b8a080;
    font-family: -apple-system, "Helvetica Neue", "Segoe UI", "Cantarell", sans-serif;
    font-size: 11px;
}
QGroupBox {
    border: 1px solid #1f1a14;
    border-radius: 4px;
    margin-top: 10px;
    padding-top: 14px;
    font-size: 10px;
    font-weight: bold;
    color: #6a5a48;
}
QGroupBox::title {
    subcontrol-origin: margin;
    subcontrol-position: top left;
    padding: 0 6px;
    color: #6a5a48;
    letter-spacing: 1px;
}
QSlider::groove:horizontal {
    height: 4px;
    background: #1f1a14;
    border-radius: 2px;
}
QSlider::handle:horizontal {
    width: 12px; height: 12px; margin: -4px 0;
    background: #c47830;
    border-radius: 6px;
}
QSlider::sub-page:horizontal {
    background: #6a4a20;
    border-radius: 2px;
}
QPushButton {
    background: #1a1510;
    border: 1px solid #2a2218;
    border-radius: 4px;
    padding: 6px 10px;
    color: #b8a080;
}
QPushButton:hover {
    background: #2a2218;
    border-color: #c47830;
}
QPushButton:pressed, QPushButton:checked {
    background: #3a2a18;
    border-color: #c47830;
}
QCheckBox { spacing: 6px; color: #b8a080; }
QCheckBox::indicator {
    width: 14px; height: 14px;
    border: 1px solid #3a3025;
    border-radius: 3px;
    background: transparent;
}
QCheckBox::indicator:checked { background: #c47830; }
QScrollArea { border: none; }
QScrollBar:vertical {
    background: #0a0806; width: 8px; border: none;
}
QScrollBar::handle:vertical {
    background: #2a2218;
    border-radius: 4px;
    min-height: 30px;
}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
    height: 0;
}
QLabel { background: transparent; }
"""


def main():
    """Launch the candle flame simulator."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )

    # OpenGL surface format — must be set before QApplication
    fmt = QSurfaceFormat()
    fmt.setVersion(2, 1)
    fmt.setProfile(QSurfaceFormat.CompatibilityProfile)
    fmt.setDepthBufferSize(24)
    fmt.setSamples(4)
    fmt.setSwapBehavior(QSurfaceFormat.DoubleBuffer)
    QSurfaceFormat.setDefaultFormat(fmt)

    app = QApplication(sys.argv)
    app.setApplicationName("Candle Flame Simulator")
    app.setStyleSheet(DARK_STYLE)

    win = MainWindow()
    win.show()

    log.info("Candle flame simulator launched")
    sys.exit(app.exec_())
