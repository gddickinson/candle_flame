"""
Control panel for the candle flame simulator.

Dark amber theme to match the lava lamp project aesthetic,
with sections for flame, wind, candle colour, scene, and actions.
"""
from __future__ import annotations
import numpy as np
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QColor
from PyQt5.QtWidgets import (
    QCheckBox, QColorDialog, QGroupBox, QHBoxLayout, QLabel,
    QPushButton, QScrollArea, QSlider, QVBoxLayout, QWidget,
)
from .canvas import CandleCanvas

# ── colour presets ────────────────────────────────────────────────────

CANDLE_COLORS: dict[str, tuple[float, float, float]] = {
    "Ivory":      (0.96, 0.94, 0.88),
    "Warm White": (0.93, 0.86, 0.75),
    "Honey":      (0.83, 0.65, 0.25),
    "Burgundy":   (0.42, 0.08, 0.12),
    "Forest":     (0.10, 0.23, 0.10),
    "Navy":       (0.10, 0.10, 0.23),
    "Lavender":   (0.56, 0.50, 0.69),
    "Terracotta": (0.69, 0.33, 0.19),
    "Black":      (0.08, 0.08, 0.08),
    "Rose":       (0.75, 0.44, 0.50),
}


# ═══════════════════════════════════════════════════════════════════════
# Labelled slider  (reusable widget)
# ═══════════════════════════════════════════════════════════════════════

class LSlider(QWidget):
    """Horizontal slider with label + value readout."""

    def __init__(self, label, lo, hi, default, unit="", parent=None):
        super().__init__(parent)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 4)
        lay.setSpacing(2)
        top = QHBoxLayout()
        self._lbl = QLabel(label)
        self._lbl.setStyleSheet("color:#b8a080; font-size:11px;")
        self._val = QLabel(f"{default}{unit}")
        self._val.setStyleSheet(
            "color:#8a7560; font-size:11px;")
        self._val.setAlignment(Qt.AlignRight)
        top.addWidget(self._lbl)
        top.addWidget(self._val)
        lay.addLayout(top)
        self._s = QSlider(Qt.Horizontal)
        self._s.setRange(lo, hi)
        self._s.setValue(default)
        self._u = unit
        self._s.valueChanged.connect(
            lambda v: self._val.setText(f"{v}{self._u}"))
        lay.addWidget(self._s)
        self.valueChanged = self._s.valueChanged

    def value(self):
        return self._s.value()

    def setValue(self, v):
        self._s.setValue(v)


# ═══════════════════════════════════════════════════════════════════════
# Control panel
# ═══════════════════════════════════════════════════════════════════════

class ControlPanel(QWidget):
    """Side panel with all candle flame controls."""

    def __init__(self, canvas: CandleCanvas, parent=None):
        super().__init__(parent)
        self.canvas = canvas
        self.params = canvas.params
        self.setFixedWidth(240)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QScrollArea.NoFrame)
        inner = QWidget()
        layout = QVBoxLayout(inner)
        layout.setContentsMargins(14, 16, 14, 16)
        layout.setSpacing(12)
        scroll.setWidget(inner)
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.addWidget(scroll)

        # ── Title ─────────────────────────────────────────────────────
        t = QLabel("🕯️  CANDLE")
        t.setAlignment(Qt.AlignCenter)
        t.setStyleSheet(
            "font-size:18px; color:#d4a860; letter-spacing:3px;"
            "font-weight:300; padding-bottom:4px;")
        layout.addWidget(t)
        st = QLabel("3D Flame Simulation")
        st.setAlignment(Qt.AlignCenter)
        st.setStyleSheet(
            "font-size:10px; color:#5a4a38; letter-spacing:2px;"
            "text-transform:uppercase; padding-bottom:10px;"
            "border-bottom:1px solid #1a1510;")
        layout.addWidget(st)

        # ══════════════════════════════════════════════════════════════
        # FLAME
        # ══════════════════════════════════════════════════════════════
        fg = QGroupBox("Flame")
        fl = QVBoxLayout(fg)

        self._intensity = LSlider("Intensity", 0, 100, 70, "%")
        self._intensity.valueChanged.connect(
            lambda v: setattr(self.params, "intensity", v / 100))
        fl.addWidget(self._intensity)

        self._flicker = LSlider("Flicker", 0, 100, 50, "%")
        self._flicker.valueChanged.connect(
            lambda v: setattr(self.params, "flicker", v / 100))
        fl.addWidget(self._flicker)

        self._turb = LSlider("Turbulence", 0, 100, 50, "%")
        self._turb.valueChanged.connect(
            lambda v: setattr(self.params, "turbulence", v / 100))
        fl.addWidget(self._turb)

        self._emit = LSlider("Emit Rate", 2, 30, 12)
        self._emit.valueChanged.connect(
            lambda v: setattr(self.params, "emit_rate", float(v)))
        fl.addWidget(self._emit)

        layout.addWidget(fg)

        # ══════════════════════════════════════════════════════════════
        # WIND
        # ══════════════════════════════════════════════════════════════
        wg = QGroupBox("Wind")
        wl = QVBoxLayout(wg)

        self._wx = LSlider("East ↔ West", -50, 50, 0)
        self._wx.valueChanged.connect(
            lambda v: setattr(self.params, "wind_x", v / 50))
        wl.addWidget(self._wx)

        self._wz = LSlider("North ↔ South", -50, 50, 0)
        self._wz.valueChanged.connect(
            lambda v: setattr(self.params, "wind_z", v / 50))
        wl.addWidget(self._wz)

        layout.addWidget(wg)

        # ══════════════════════════════════════════════════════════════
        # CANDLE
        # ══════════════════════════════════════════════════════════════
        cg = QGroupBox("Candle")
        cl = QVBoxLayout(cg)
        cl.addWidget(QLabel("Wax Colour"))

        row = QHBoxLayout()
        for name, (r, g, b) in CANDLE_COLORS.items():
            btn = QPushButton()
            btn.setFixedSize(22, 22)
            btn.setToolTip(name)
            btn.setStyleSheet(
                f"background:rgb({int(r*255)},{int(g*255)},{int(b*255)});"
                "border-radius:11px; border:2px solid #2a2218;")
            btn.clicked.connect(self._color_fn(r, g, b))
            row.addWidget(btn)
        row.addStretch()
        cl.addLayout(row)

        pick = QPushButton("Custom Colour…")
        pick.clicked.connect(self._pick_color)
        cl.addWidget(pick)

        layout.addWidget(cg)

        # ══════════════════════════════════════════════════════════════
        # SCENE
        # ══════════════════════════════════════════════════════════════
        sg = QGroupBox("Scene")
        sl = QVBoxLayout(sg)

        self._amb = LSlider("Ambient Light", 0, 50, 15, "%")
        self._amb.valueChanged.connect(
            lambda v: setattr(self.canvas, "ambient", v / 100))
        sl.addWidget(self._amb)

        self._auto = QCheckBox("Auto-Rotate")
        self._auto.setChecked(True)
        self._auto.toggled.connect(
            lambda v: setattr(self.canvas.camera, "auto_rotate", v))
        sl.addWidget(self._auto)

        self._rspd = LSlider("Rotate Speed", 5, 100, 15)
        self._rspd.valueChanged.connect(
            lambda v: setattr(self.canvas.camera, "auto_speed", v / 100))
        sl.addWidget(self._rspd)

        self._smk = QCheckBox("Show Smoke")
        self._smk.setChecked(True)
        self._smk.toggled.connect(
            lambda v: setattr(self.canvas, "show_smoke", v))
        sl.addWidget(self._smk)

        layout.addWidget(sg)

        # ══════════════════════════════════════════════════════════════
        # ACTIONS
        # ══════════════════════════════════════════════════════════════
        ag = QGroupBox("Actions")
        al = QVBoxLayout(ag)
        row1 = QHBoxLayout()

        self._pause = QPushButton("⏸  Pause")
        self._pause.setCheckable(True)
        self._pause.toggled.connect(self._on_pause)
        row1.addWidget(self._pause)

        blow = QPushButton("💨  Blow Out")
        blow.clicked.connect(lambda: self._intensity.setValue(0))
        row1.addWidget(blow)

        al.addLayout(row1)

        snap = QPushButton("📸  Screenshot")
        snap.clicked.connect(lambda: self.canvas.screenshot())
        al.addWidget(snap)

        layout.addWidget(ag)

        # ── Status ────────────────────────────────────────────────────
        self._status = QLabel("—")
        self._status.setStyleSheet("color:#5a4a38; font-size:10px;")
        layout.addWidget(self._status)

        # ── Help ──────────────────────────────────────────────────────
        hlp = QLabel(
            "<small style='color:#3a3025;'>"
            "<b style='color:#5a4a38;'>Controls</b><br>"
            "Drag to orbit · Scroll to zoom<br>"
            "Particle sim with 3D turbulent noise,<br>"
            "temperature-mapped colour, and<br>"
            "additive blend rendering"
            "</small>")
        hlp.setWordWrap(True)
        layout.addWidget(hlp)
        layout.addStretch()

        canvas.fps_changed.connect(self._on_fps)

    # ── slots ─────────────────────────────────────────────────────────

    def _color_fn(self, r, g, b):
        def fn(): self.canvas.set_candle_color(r, g, b)
        return fn

    def _pick_color(self):
        c = self.canvas.candle_rgb
        qc = QColor(int(c[0]*255), int(c[1]*255), int(c[2]*255))
        res = QColorDialog.getColor(qc, self, "Pick Candle Colour")
        if res.isValid():
            self.canvas.set_candle_color(
                res.red()/255, res.green()/255, res.blue()/255)

    def _on_pause(self, on):
        self.canvas.paused = on
        self._pause.setText("▶  Resume" if on else "⏸  Pause")

    def _on_fps(self, fps):
        af = int(np.sum(self.canvas.flame.life > 0))
        af_s = int(np.sum(self.canvas.smoke.life > 0))
        self._status.setText(f"{fps:.0f} fps · {af} flame · {af_s} smoke")
