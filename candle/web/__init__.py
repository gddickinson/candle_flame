"""Web interface for the candle flame simulator (no Qt or OpenGL imports).

Contents:
    app.py        FastAPI app: static front end + JSON API under /api (STATIC_ENDPOINTS for the Pages export)
    reference.py  Seeded runs of the real particle code (mulberry32 RNG) for the Verify page and node-test fixtures
    static/       ES-module front end: JS port of the physics (flame_engine.js), WebGL renderer, pages
"""
