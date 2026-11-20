"""Write src/pages/battle/cryLevels.js: each cry's gain in dB to one loudness (src/pages/battle/cries.js plays it).

The HOME cries (public/cries/<dex number>.m4a, scripts/build-cries.py) differ by 13 dB, some over 0 dBTP (2026-11-20, measured with
earshot). Each is measured once here by BS.1770 (scripts/build-music.py's meter; a cry shorter than one 400 ms block by its RMS) and
given the gain that brings it to TARGET, its peak kept under -1 dBFS.

    python scripts/build-cry-levels.py
"""
import importlib.util
import json
from pathlib import Path

import av
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
TARGET = -22.0  # LUFS: a cry stands about 4 dB over the music as it plays (music -20 LUFS on its 0.5 default)
spec = importlib.util.spec_from_file_location("music", ROOT / "scripts" / "build-music.py")
music = importlib.util.module_from_spec(spec)
spec.loader.exec_module(music)


def decode(path):
    src = av.open(str(path))
    resample = av.AudioResampler(format="fltp", layout="stereo", rate=44100)
    parts = [f.to_ndarray() for frame in src.decode(audio=0) for f in resample.resample(frame)]
    parts += [f.to_ndarray() for f in resample.resample(None)]
    return np.concatenate(parts, axis=1).astype(np.float64)


def main():
    gains = {}
    for path in sorted((ROOT / "public" / "cries").glob("*.m4a"), key=lambda p: (not p.stem.isdigit(), int(p.stem) if p.stem.isdigit() else 0, p.stem)):
        x = decode(path)
        try:
            lufs = music.loudness(x) if x.shape[1] > 44100 * 0.45 else None
        except (ValueError, ZeroDivisionError):
            lufs = None
        if lufs is None or not np.isfinite(lufs):
            lufs = 20 * np.log10(max(np.sqrt((x ** 2).mean()), 1e-6)) + 3
        db = TARGET - lufs
        peak = np.abs(x).max() * 10 ** (db / 20)
        if peak > 0.89:
            db -= 20 * np.log10(peak / 0.89)
        gains[path.stem] = round(float(db), 1)
    (ROOT / "src" / "pages" / "battle" / "cryLevels.js").write_text(
        "// written by scripts/build-cry-levels.py: each cry's gain in dB to one loudness, by its file name (the dex number, or a form)\n"
        f"export default {json.dumps(gains, separators=(',', ':'))};\n")
    v = sorted(gains.values())
    print(f"{len(v)} cries, gain {v[0]} to {v[-1]} dB, median {v[len(v) // 2]}")


if __name__ == "__main__":
    main()
