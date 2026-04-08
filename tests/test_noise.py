"""Smoke tests for noise module (fBm output range)."""

import numpy as np
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def test_fbm_output_range():
    from candle.noise import fbm
    np.random.seed(42)
    x = np.random.uniform(-10, 10, 1000)
    y = np.random.uniform(-10, 10, 1000)
    z = np.random.uniform(-10, 10, 1000)
    result = fbm(x, y, z, octaves=3)
    assert result.shape == (1000,), f"Expected shape (1000,), got {result.shape}"
    assert np.all(result >= 0), f"fBm values should be >= 0, min was {result.min()}"
    assert np.all(result <= 1), f"fBm values should be <= 1, max was {result.max()}"


def test_fbm_deterministic():
    from candle.noise import fbm
    x = np.array([1.0, 2.0, 3.0])
    y = np.array([4.0, 5.0, 6.0])
    z = np.array([7.0, 8.0, 9.0])
    r1 = fbm(x, y, z)
    r2 = fbm(x, y, z)
    np.testing.assert_array_equal(r1, r2, "fBm should be deterministic for same inputs")


def test_fbm_vectorized():
    from candle.noise import fbm
    x = np.zeros(5)
    y = np.zeros(5)
    z = np.linspace(0, 1, 5)
    result = fbm(x, y, z)
    assert result.shape == (5,)
    # Different z inputs should give different (or same) results -- no crash
    assert not np.any(np.isnan(result)), "fBm should not produce NaN"


if __name__ == "__main__":
    test_fbm_output_range()
    test_fbm_deterministic()
    test_fbm_vectorized()
    print("All noise tests passed.")
