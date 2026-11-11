"""Start the Candle Flame web app on http://127.0.0.1:8145 (local only).

    pip install -r requirements-web.txt
    python run_web.py [--port 8145]
"""
import argparse

import uvicorn

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--port", type=int, default=8145)
    a = ap.parse_args()
    print(f"Candle Flame web app: http://127.0.0.1:{a.port}")
    uvicorn.run("candle.web.app:app", host="127.0.0.1", port=a.port)
