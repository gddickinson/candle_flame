"""
Main window for the candle flame simulator.

Assembles the 3D OpenGL viewport (CandleCanvas) alongside
the control panel into a single horizontal layout.
"""
from __future__ import annotations
from PyQt5.QtWidgets import QHBoxLayout, QMainWindow, QWidget

from .canvas import CandleCanvas
from .controls import ControlPanel
from .particles import FlameParams


class MainWindow(QMainWindow):
    """Top-level window: 3D viewport + control panel."""

    def __init__(self):
        super().__init__()
        self.setWindowTitle("\U0001f56f\ufe0f  3D Candle Flame Simulator")
        self.resize(960, 700)

        params = FlameParams()
        self.canvas = CandleCanvas(params)
        self.panel = ControlPanel(self.canvas)

        central = QWidget()
        lay = QHBoxLayout(central)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)
        lay.addWidget(self.canvas, stretch=1)
        lay.addWidget(self.panel)
        self.setCentralWidget(central)
