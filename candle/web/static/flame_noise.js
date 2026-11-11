// JS port of candle/noise.py: 3-D value noise + fBm. Same integer hash (int64 in numpy, emulated exactly here),
// same Hermite smoothstep and trilinear sum order, so values match Python to the last bit (checked in node tests).
const A = 374761393, B = 668265263, C = 1274126177;

// _hash3: h = ix*A + iy*B + iz*C (exact in a double while |h| < 2^53, i.e. |coords| < ~2e6);
// h = (h ^ (h >> 13)) * C in int64; only the low 31 bits are kept, and those depend only on the low 32 bits.
export function hash3(ix, iy, iz) {
  const h = ix * A + iy * B + iz * C;
  const g = (h >>> 0) ^ (Math.floor(h / 8192) >>> 0);
  return (Math.imul(g, C) & 0x7FFFFFFF) / 0x7FFFFFFF;
}

export function smoothNoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  const n000 = hash3(ix, iy, iz), n100 = hash3(ix + 1, iy, iz);
  const n010 = hash3(ix, iy + 1, iz), n110 = hash3(ix + 1, iy + 1, iz);
  const n001 = hash3(ix, iy, iz + 1), n101 = hash3(ix + 1, iy, iz + 1);
  const n011 = hash3(ix, iy + 1, iz + 1), n111 = hash3(ix + 1, iy + 1, iz + 1);
  return n000 * (1 - sx) * (1 - sy) * (1 - sz) + n100 * sx * (1 - sy) * (1 - sz) +
    n010 * (1 - sx) * sy * (1 - sz) + n110 * sx * sy * (1 - sz) +
    n001 * (1 - sx) * (1 - sy) * sz + n101 * sx * (1 - sy) * sz +
    n011 * (1 - sx) * sy * sz + n111 * sx * sy * sz;
}

// fbm(x, y, z, octaves): roughly [0, 1]. f32 = true when the inputs are float32 (as in the particle code):
// numpy then computes x * freq in float32, which Math.fround reproduces.
export function fbm(x, y, z, octaves = 3, f32 = false) {
  const r = f32 ? Math.fround : v => v;
  let val = 0, amp = 1, freq = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const fq = r(freq);
    val += smoothNoise(r(x * fq), r(y * fq), r(z * fq)) * amp;
    total += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return val / total;
}
