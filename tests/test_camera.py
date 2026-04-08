"""Smoke tests for camera module (matrix math)."""

import numpy as np
import math
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def test_orbit_camera_init():
    from candle.camera import OrbitCamera
    cam = OrbitCamera()
    assert cam.distance == 1.2
    assert cam.auto_rotate is True


def test_orbit_camera_eye():
    from candle.camera import OrbitCamera
    cam = OrbitCamera()
    eye = cam.eye
    assert eye.shape == (3,)
    assert eye.dtype == np.float32
    # Eye should be at some distance from origin
    dist = np.linalg.norm(eye - cam.target)
    assert dist > 0


def test_view_matrix_shape():
    from candle.camera import OrbitCamera
    cam = OrbitCamera()
    view = cam.view_matrix()
    assert view.shape == (4, 4)
    assert view.dtype == np.float32


def test_perspective_matrix():
    from candle.camera import perspective
    proj = perspective(45.0, 1.0, 0.01, 50.0)
    assert proj.shape == (4, 4)
    assert proj.dtype == np.float32
    # Last row should be [0, 0, -1, 0] for perspective
    assert proj[3, 2] == -1.0
    assert proj[3, 0] == 0.0
    assert proj[3, 1] == 0.0
    assert proj[3, 3] == 0.0


def test_camera_rotate():
    from candle.camera import OrbitCamera
    cam = OrbitCamera()
    initial_theta = cam.theta
    cam.rotate(100, 0)
    assert cam.theta != initial_theta, "Rotation should change theta"


def test_camera_zoom():
    from candle.camera import OrbitCamera
    cam = OrbitCamera()
    initial_dist = cam.distance
    cam.zoom(500)
    assert cam.distance != initial_dist, "Zoom should change distance"
    assert cam.distance >= cam.min_dist
    assert cam.distance <= cam.max_dist


if __name__ == "__main__":
    test_orbit_camera_init()
    test_orbit_camera_eye()
    test_view_matrix_shape()
    test_perspective_matrix()
    test_camera_rotate()
    test_camera_zoom()
    print("All camera tests passed.")
