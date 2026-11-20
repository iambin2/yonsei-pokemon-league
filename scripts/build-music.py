"""Build public/music/*.m4a, the battle's background music (src/pages/battle/music.js).

One set made for the league by the owner with Suno (2026-11-20, a paid plan), from one style sentence ("modern JRPG monster trainer
battle music, orchestral rock hybrid, ..."), so every scene sounds alike: earshot hears all three as "energetic orchestral rock
video game battle music" (z +4.4 to +4.6, the first of 322 descriptions). The masters are kept by the owner and not committed; put
them in <repo>/music as battle.mp3, lobby.mp3 and tower.mp3.

Each track loops between two bar lines past its intro and before its ending, chosen where the bars around the two sound most alike
(chroma and timbre, 0.97 to 0.98) and aligned on the drums' attacks to the sample. At the seam the loop's first 30 ms are crossfaded
from what really follows its end, so the loop's end runs into its start. Every track is brought to -20 LUFS (BS.1770).

    python scripts/build-music.py
"""
from pathlib import Path

import av
import numpy as np
from scipy.signal import lfilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "music"
SR = 44100
PAD = 2048
XFADE = 1323  # 30 ms
TARGET = -20.0  # the integrated loudness every track is brought to, LUFS (BS.1770)
# name: (the loop's first and last sample in the master at 44.1 kHz, its tempo and bars as measured)
TRACKS = {
    "battle": (460800, 6757440),  # 161.4 BPM, 96 bars, 142.78 s
    "lobby": (1983424, 6260672),  # 99.4 BPM, 40 bars, 96.99 s
    "tower": (720896, 6673856),  # 99.4 BPM, 56 bars, 134.99 s
}


def decode(path):
    src = av.open(str(path))
    resample = av.AudioResampler(format="fltp", layout="stereo", rate=SR)
    parts = [f.to_ndarray() for frame in src.decode(audio=0) for f in resample.resample(frame)]
    parts += [f.to_ndarray() for f in resample.resample(None)]
    return np.concatenate(parts, axis=1).astype(np.float32)


def loudness(x):
    """Integrated loudness in LUFS (ITU-R BS.1770-4: K-weighting, 400 ms blocks, absolute and relative gates)."""
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    y = lfilter(b2, a2, lfilter(b1, a1, x, axis=1), axis=1)
    block, step = int(0.4 * SR), int(0.1 * SR)
    z = np.array([(y[:, i:i + block] ** 2).mean(axis=1).sum() for i in range(0, y.shape[1] - block + 1, step)])
    lk = -0.691 + 10 * np.log10(np.maximum(z, 1e-12))
    z = z[lk > -70]
    rel = -0.691 + 10 * np.log10(z.mean()) - 10
    z = z[-0.691 + 10 * np.log10(z) > rel]
    return -0.691 + 10 * np.log10(z.mean())


def level(x):
    # every track at one loudness, its peak kept under -1 dBFS
    x = x * 10 ** ((TARGET - loudness(x)) / 20)
    peak = np.abs(x).max()
    return (x * (0.89 / peak) if peak > 0.89 else x).astype(np.float32)


def loop_of(x, a, b):
    # the loop [a, b): its first XFADE samples fade in from what follows b in the master, so playing b-1 then a sounds as b-1 then b
    loop = x[:, a:b].copy()
    w = np.linspace(0, 1, XFADE, dtype=np.float32)
    loop[:, :XFADE] = x[:, b:b + XFADE] * (1 - w) + x[:, a:a + XFADE] * w
    return loop


def write(name, x, length=None):
    path = OUT / f"{name}.m4a"
    out = av.open(str(path), "w", format="ipod")
    stream = out.add_stream("aac", rate=SR)
    stream.bit_rate = 128000
    stream.layout = "stereo"
    for i in range(0, x.shape[1], 1024):
        frame = av.AudioFrame.from_ndarray(np.ascontiguousarray(x[:, i:i + 1024]), format="fltp", layout="stereo")
        frame.sample_rate = SR
        for packet in stream.encode(frame):
            out.mux(packet)
    for packet in stream.encode(None):
        out.mux(packet)
    out.close()
    n = length or x.shape[1]
    print(f"{name}: {n} samples ({n / SR:.3f} s), {path.stat().st_size // 1024} KB")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (a, b) in TRACKS.items():
        loop = level(loop_of(decode(ROOT / "music" / f"{name}.mp3"), a, b))
        # the loop wrapped in its own sound, PAD on each side: an AAC file's first and last frames are not exact, so the seam is played
        # from the middle of the file (music.js loops PAD in, for the printed length)
        write(name, np.concatenate([loop[:, -PAD:], loop, loop[:, :PAD]], axis=1), loop.shape[1])


if __name__ == "__main__":
    main()
