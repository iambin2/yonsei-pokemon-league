"""Build public/music/*.m4a, the battle's background music (src/pages/battle/music.js).

One set by one composer so every scene sounds alike: LemonheadVGM's "7DaysofVGM Free Asset Pack" (CC0,
https://opengameart.org/content/7daysofvgm-free-asset-pack). Each track was exported as a whole number of bars (128, 160, 170 and
118 BPM), so each file is its own loop. The pack has no result jingles, so they are cut from its own tracks: 승리 is the first two
bars of the title theme, 패배 the menu theme's first two bars played lower and slower, as a fainting cry is. Every track and jingle is
brought to one loudness, -20 LUFS (BS.1770).

    python scripts/build-music.py
"""
import io
import urllib.request
from pathlib import Path

import av
import numpy as np
from scipy.signal import lfilter

OUT = Path(__file__).resolve().parent.parent / "public" / "music"
BASE = "https://opengameart.org/sites/default/files/"
SR = 44100
PAD = 2048
TARGET = -20.0  # the integrated loudness every track and jingle is brought to, LUFS (BS.1770)
# name: (the pack's file, its tempo)
TRACKS = {
    "lobby": ("upgrades_menu_asset_pack.ogg", 118),
    "battle": ("extraterrestrial_trials_asset_pack.ogg", 170),
    "pinch": ("cosmic_combatants_asset_pack.ogg", 160),
    "tower": ("blast_off_asset_pack.ogg", 128),
}


def fetch(name):
    req = urllib.request.Request(BASE + name, headers={"User-Agent": "music-build"})
    return urllib.request.urlopen(req, timeout=60).read()


def decode(data):
    src = av.open(io.BytesIO(data))
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
    # every track at one loudness (the title theme stood 3.7 LU under the battle's, 2026-11-20, measured with earshot), its peak kept
    # under -1 dBFS
    x = x * 10 ** ((TARGET - loudness(x)) / 20)
    peak = np.abs(x).max()
    return (x * (0.89 / peak) if peak > 0.89 else x).astype(np.float32)


def fade(x, seconds):
    n = int(seconds * SR)
    x = x.copy()
    x[:, -n:] *= np.linspace(1, 0, n) ** 2
    return x


def seamless(x, n=256):
    # the pack's files jump at their own seam (0.27 in one step for pinch, 2026-11-20): their last n samples are laid over the first n,
    # fading across, and cut from the end, so the loop's end flows into its start (n/44100 = 6 ms off a bar, never heard)
    x = x[:, :].copy()
    w = np.linspace(0, 1, n, dtype=np.float32)
    x[:, :n] = x[:, :n] * w + x[:, -n:] * (1 - w)
    return x[:, :-n]


def slower(x, rate):
    # played at rate under 1: lower and longer, as a tape slowed
    t = np.arange(0, x.shape[1] - 1, rate)
    return np.stack([np.interp(t, np.arange(x.shape[1]), ch) for ch in x]).astype(np.float32)


def write(name, x, length=None):
    path = OUT / f"{name}.m4a"
    out = av.open(str(path), "w", format="ipod")
    stream = out.add_stream("aac", rate=SR)
    stream.bit_rate = 96000
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
    made = {}
    for name, (file, bpm) in TRACKS.items():
        x = level(decode(fetch(file)))
        made[name] = (x, 60 / bpm * 4 * SR)  # the samples of one bar
        loop = seamless(x)
        # the loop wrapped in its own sound, PAD on each side: an AAC file's first and last frames are not exact (0.13 at the tower's
        # seam, 2026-11-20), so the seam is played from the middle of the file (music.js loops PAD in, for the printed length)
        write(name, np.concatenate([loop[:, -PAD:], loop, loop[:, :PAD]], axis=1), loop.shape[1])
    title, bar = made["tower"]
    write("win", level(fade(title[:, : int(bar * 2 + SR * 1.2)], 1.6)))
    menu, bar = made["lobby"]
    write("lose", level(fade(slower(menu[:, : int(bar * 2 + SR)], 0.8), 1.8)))


if __name__ == "__main__":
    main()
