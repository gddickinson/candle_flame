"""
Procedural candle scene geometry.

Returns lists of mesh dicts, each containing vertices, normals,
indices, colour, and shininess — ready for VBO upload.
"""
from __future__ import annotations
import math
import numpy as np


def cylinder(r_top: float, r_bot: float, height: float,
             seg: int = 24, y_off: float = 0.0):
    """Open-ended cylinder with top and bottom caps."""
    verts, norms, idxs = [], [], []

    # Side wall
    for i in range(seg + 1):
        a = (i / seg) * 2 * math.pi
        ca, sa = math.cos(a), math.sin(a)
        verts.append([r_bot*ca, y_off - height/2, r_bot*sa])
        norms.append([ca, 0, sa])
        verts.append([r_top*ca, y_off + height/2, r_top*sa])
        norms.append([ca, 0, sa])
    for i in range(seg):
        b = i * 2
        idxs.extend([b, b+1, b+2, b+1, b+3, b+2])

    # Top cap
    cs = len(verts)
    verts.append([0, y_off + height/2, 0])
    norms.append([0, 1, 0])
    for i in range(seg + 1):
        a = (i / seg) * 2 * math.pi
        verts.append([r_top*math.cos(a), y_off + height/2, r_top*math.sin(a)])
        norms.append([0, 1, 0])
    for i in range(seg):
        idxs.extend([cs, cs+1+i, cs+2+i])

    # Bottom cap
    bs = len(verts)
    verts.append([0, y_off - height/2, 0])
    norms.append([0, -1, 0])
    for i in range(seg + 1):
        a = (i / seg) * 2 * math.pi
        verts.append([r_bot*math.cos(a), y_off - height/2, r_bot*math.sin(a)])
        norms.append([0, -1, 0])
    for i in range(seg):
        idxs.extend([bs, bs+2+i, bs+1+i])

    return (np.array(verts, np.float32),
            np.array(norms, np.float32),
            np.array(idxs, np.uint32))


def torus(major_r: float, minor_r: float,
          maj_seg: int = 24, min_seg: int = 8, y_off: float = 0.0):
    """Torus ring (melted wax rim)."""
    verts, norms, idxs = [], [], []
    for i in range(maj_seg + 1):
        a = (i / maj_seg) * 2 * math.pi
        cx, cz = major_r * math.cos(a), major_r * math.sin(a)
        for j in range(min_seg + 1):
            b = (j / min_seg) * 2 * math.pi
            nx = math.cos(b) * math.cos(a)
            ny = math.sin(b)
            nz = math.cos(b) * math.sin(a)
            verts.append([cx + minor_r*math.cos(b)*math.cos(a),
                          y_off + minor_r*math.sin(b),
                          cz + minor_r*math.cos(b)*math.sin(a)])
            norms.append([nx, ny, nz])
    stride = min_seg + 1
    for i in range(maj_seg):
        for j in range(min_seg):
            a = i * stride + j
            b = a + stride
            idxs.extend([a, b, a+1, b, b+1, a+1])
    return (np.array(verts, np.float32),
            np.array(norms, np.float32),
            np.array(idxs, np.uint32))


def plane(w: float, d: float, y_off: float = 0.0):
    """Flat horizontal plane (table)."""
    hw, hd = w/2, d/2
    v = np.array([[-hw,y_off,-hd],[hw,y_off,-hd],
                   [hw,y_off,hd],[-hw,y_off,hd]], np.float32)
    n = np.array([[0,1,0]]*4, np.float32)
    i = np.array([0,2,1,0,3,2], np.uint32)
    return v, n, i


def build_candle_meshes(color=(0.96, 0.94, 0.88)):
    """Build all scene meshes for the candle.

    Returns list of dicts with: vertices, normals, indices,
    color (r,g,b), shininess, is_candle (bool).
    """
    meshes = []

    # Candle body
    v, n, i = cylinder(0.08, 0.085, 0.45, 24, y_off=-0.02)
    meshes.append(dict(vertices=v, normals=n, indices=i,
                       color=color, shininess=30.0, is_candle=True))

    # Melted rim
    v, n, i = torus(0.075, 0.012, 24, 8, y_off=0.2)
    meshes.append(dict(vertices=v, normals=n, indices=i,
                       color=color, shininess=60.0, is_candle=True))

    # Wick
    v, n, i = cylinder(0.003, 0.003, 0.06, 6, y_off=0.23)
    meshes.append(dict(vertices=v, normals=n, indices=i,
                       color=(0.10, 0.06, 0.03), shininess=5.0, is_candle=False))

    # Table
    v, n, i = plane(3.0, 3.0, y_off=-0.245)
    meshes.append(dict(vertices=v, normals=n, indices=i,
                       color=(0.10, 0.08, 0.06), shininess=20.0, is_candle=False))

    return meshes
