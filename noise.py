"""
3D value noise and fractional Brownian motion.

Used by the flame particle system to create coherent turbulent
flow fields.  All functions are vectorised over numpy arrays so
an entire particle batch can be perturbed in one call.
"""
from __future__ import annotations
import numpy as np


def _hash3(ix: np.ndarray, iy: np.ndarray, iz: np.ndarray) -> np.ndarray:
    """Integer-lattice hash → float in [0, 1]."""
    h = (ix * 374761393 + iy * 668265263 + iz * 1274126177).astype(np.int64)
    h = (h ^ (h >> 13)) * 1274126177
    return (h & 0x7FFFFFFF).astype(np.float64) / 0x7FFFFFFF


def _smooth_noise(x, y, z):
    """Trilinear-interpolated value noise."""
    ix = np.floor(x).astype(np.int64)
    iy = np.floor(y).astype(np.int64)
    iz = np.floor(z).astype(np.int64)
    fx, fy, fz = x - ix, y - iy, z - iz

    # Hermite smoothstep
    sx = fx * fx * (3 - 2 * fx)
    sy = fy * fy * (3 - 2 * fy)
    sz = fz * fz * (3 - 2 * fz)

    n000 = _hash3(ix,     iy,     iz    )
    n100 = _hash3(ix + 1, iy,     iz    )
    n010 = _hash3(ix,     iy + 1, iz    )
    n110 = _hash3(ix + 1, iy + 1, iz    )
    n001 = _hash3(ix,     iy,     iz + 1)
    n101 = _hash3(ix + 1, iy,     iz + 1)
    n011 = _hash3(ix,     iy + 1, iz + 1)
    n111 = _hash3(ix + 1, iy + 1, iz + 1)

    return (n000*(1-sx)*(1-sy)*(1-sz) + n100*sx*(1-sy)*(1-sz) +
            n010*(1-sx)*sy*(1-sz)     + n110*sx*sy*(1-sz) +
            n001*(1-sx)*(1-sy)*sz     + n101*sx*(1-sy)*sz +
            n011*(1-sx)*sy*sz         + n111*sx*sy*sz)


def fbm(x, y, z, octaves: int = 3):
    """Fractional Brownian motion built from layered value noise.

    Returns values roughly in [0, 1] for each input coordinate.
    """
    val = np.zeros_like(x, dtype=np.float64)
    amp = 1.0
    freq = 1.0
    total = 0.0
    for _ in range(octaves):
        val += _smooth_noise(x * freq, y * freq, z * freq) * amp
        total += amp
        amp *= 0.5
        freq *= 2.1
    return val / total
