"""
GLSL shader sources for the candle flame renderer.

All shaders target GLSL 1.20 for maximum driver compatibility.
Four programs:

  PHONG   — Blinn-Phong lit solid geometry (candle body, wick, table)
  FLAME   — additive-blend temperature-mapped point sprites
  SMOKE   — alpha-blend fading point sprites
  GLOW    — flat-colour billboard quad behind the flame
"""

# ═══════════════════════════════════════════════════════════════════════
# PHONG  (solid geometry)
# ═══════════════════════════════════════════════════════════════════════

PHONG_V = """
#version 120
attribute vec3 aPos;
attribute vec3 aNorm;
uniform mat4 uMVP;
uniform mat4 uModel;
uniform mat3 uNormMat;
varying vec3 vWorld;
varying vec3 vN;
void main() {
    vWorld = (uModel * vec4(aPos, 1.0)).xyz;
    vN = normalize(uNormMat * aNorm);
    gl_Position = uMVP * vec4(aPos, 1.0);
}
"""

PHONG_F = """
#version 120
uniform vec3  uColor;
uniform float uShininess;
uniform vec3  uLightPos;
uniform vec3  uLightCol;
uniform float uLightInt;
uniform vec3  uEye;
uniform float uAmbient;
varying vec3  vWorld;
varying vec3  vN;
void main() {
    vec3 N = normalize(vN);
    vec3 L = uLightPos - vWorld;
    float d = length(L);
    L /= d;
    float att = uLightInt / (1.0 + 0.7 * d * d);
    float diff = max(dot(N, L), 0.0);
    vec3 V = normalize(uEye - vWorld);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), uShininess);
    vec3 c = uColor * uAmbient
           + uColor * uLightCol * diff * att
           + uLightCol * spec * att * 0.3
           + uColor * vec3(1.0,0.6,0.3) * max(dot(N,vec3(0,-1,0)),0.0) * 0.05;
    gl_FragColor = vec4(c, 1.0);
}
"""

# ═══════════════════════════════════════════════════════════════════════
# FLAME  (additive point sprites)
# ═══════════════════════════════════════════════════════════════════════

FLAME_V = """
#version 120
attribute vec3  aPos;
attribute float aLife;
attribute float aMaxLife;
attribute float aTemp;
attribute float aSize;
uniform mat4  uMVP;
uniform float uScreenH;
varying float vLife, vTemp, vAge;
void main() {
    vLife = aLife;
    vTemp = aTemp;
    vAge  = 1.0 - aLife / max(aMaxLife, 0.001);
    vec4 clip = uMVP * vec4(aPos, 1.0);
    gl_Position  = clip;
    gl_PointSize = max(1.0, aSize * uScreenH * 0.8 / max(clip.w, 0.01));
}
"""

FLAME_F = """
#version 120
varying float vLife, vTemp, vAge;
void main() {
    if (vLife <= 0.0) discard;
    vec2 uv = gl_PointCoord - vec2(0.5);
    float r = length(uv) * 2.0;
    if (r > 1.0) discard;
    float a = 1.0 - r*r;
    a *= a;
    vec3 col;
    if      (vTemp > 0.8) col = mix(vec3(1,.95,.5),  vec3(.9,.92,1),  (vTemp-.8)/.2);
    else if (vTemp > 0.5) col = mix(vec3(1,.6,.05),   vec3(1,.95,.5),  (vTemp-.5)/.3);
    else if (vTemp > 0.2) col = mix(vec3(.8,.2,.02),  vec3(1,.6,.05),  (vTemp-.2)/.3);
    else                  col = mix(vec3(.3,.02,0),   vec3(.8,.2,.02), vTemp/.2);
    col += vec3(.15,.1,.05) * vTemp * vTemp;
    float fade = vAge < 0.1 ? vAge/0.1 : 1.0 - smoothstep(0.5, 1.0, vAge);
    a *= fade * 0.85;
    gl_FragColor = vec4(col, a);
}
"""

# ═══════════════════════════════════════════════════════════════════════
# SMOKE  (alpha-blend point sprites)
# ═══════════════════════════════════════════════════════════════════════

SMOKE_V = """
#version 120
attribute vec3  aPos;
attribute float aLife;
attribute float aMaxLife;
attribute float aSize;
uniform mat4  uMVP;
uniform float uScreenH;
varying float vAlpha;
void main() {
    float age = 1.0 - aLife / max(aMaxLife, 0.001);
    vAlpha = aLife > 0.0 ? (1.0-age)*(1.0-age)*0.12 : 0.0;
    vec4 clip = uMVP * vec4(aPos, 1.0);
    gl_Position  = clip;
    gl_PointSize = max(1.0, aSize * uScreenH * 1.2 / max(clip.w, 0.01));
}
"""

SMOKE_F = """
#version 120
varying float vAlpha;
void main() {
    if (vAlpha <= 0.001) discard;
    vec2 uv = gl_PointCoord - vec2(0.5);
    float r = length(uv) * 2.0;
    if (r > 1.0) discard;
    gl_FragColor = vec4(0.65, 0.62, 0.6, (1.0 - r*r) * vAlpha);
}
"""

# ═══════════════════════════════════════════════════════════════════════
# GLOW  (billboard quad)
# ═══════════════════════════════════════════════════════════════════════

GLOW_V = """
#version 120
attribute vec3 aPos;
uniform mat4 uMVP;
void main() { gl_Position = uMVP * vec4(aPos, 1.0); }
"""

GLOW_F = """
#version 120
uniform float uAlpha;
uniform vec3  uColor;
void main() { gl_FragColor = vec4(uColor, uAlpha); }
"""
