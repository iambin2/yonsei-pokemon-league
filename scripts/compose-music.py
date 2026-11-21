"""Compose the battle's background music in code (src/pages/battle/music.js plays public/music/*.m4a).

Every sample is computed here: simple voices (a mallet, an electric piano, a soft pulse, a sine bass, a light kit), a computed room,
three short loops written note by note (lobby, battle, tower). Each loop is rendered circularly, the notes' and the room's tails
folded back onto its start, so it runs on with no seam. Brought to -20 LUFS (BS.1770, as the mix expects).

The owner chose style c, a soft pulse like the board's own lamps, from three drafts (2026-11-21: a mallet, b electric piano, c pulse),
in place of the Suno set that felt pasted in ("갑자기 재생되는 것 같고 안 어울리는 음악을 끼워넣은 것 같아").

    python scripts/compose-music.py --draft <dir> [--style a|b|c]   # one file: lobby, battle, tower in turn, to listen to
    python scripts/compose-music.py                                  # public/music/{lobby,battle,tower}.m4a (style c)
"""
import argparse
from pathlib import Path

import av
import numpy as np
from scipy.signal import lfilter

SR = 44100
ROOT = Path(__file__).resolve().parent.parent
rng = np.random.default_rng(7)

NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}
NOTE.update({"Db": 1, "Eb": 3, "Gb": 6, "Ab": 8, "Bb": 10})


def hz(name):
    """'A4' -> 440"""
    n, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((NOTE[n] + 12 * (o + 1) - 69) / 12)


def env(n, a, d, sustain=0.0, release=0.0):
    """attack a s, exponential decay with time constant d s towards sustain, a release fade over the last release s"""
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), sustain + (1 - sustain) * np.exp(-(t - a) / d))
    if release:
        r = int(release * SR)
        e[-r:] *= np.linspace(1, 0, r) ** 2
    return e


# ---------- voices: f in Hz, dur in seconds; each returns a mono array ----------
def mallet(f, dur):
    n = int((dur + 1.2) * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) * env(n, .002, .55)
    x += .25 * np.sin(2 * np.pi * f * 3.98 * t) * env(n, .001, .08)
    x += .06 * np.sin(2 * np.pi * f * 9.1 * t) * env(n, .001, .025)
    return x * .5


def epiano(f, dur):
    n = int((dur + 1.4) * SR); t = np.arange(n) / SR
    idx = 1.6 * np.exp(-t / .35) + .15
    x = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * t)) * env(n, .003, .9)
    x += .05 * np.sin(2 * np.pi * f * 14 * t) * env(n, .001, .02)
    gate = np.ones(n); off = int(dur * SR)
    gate[off:] = np.exp(-np.arange(n - off) / (.18 * SR))
    return x * gate * .45


def pulse(f, dur):
    """a soft square: odd harmonics falling fast, a short glow"""
    n = int((dur + .5) * SR); t = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * f * k * t) / k ** 1.6 for k in (1, 3, 5, 7) if f * k < 9000)
    gate = np.ones(n); off = int(dur * SR)
    gate[off:] = np.exp(-np.arange(n - off) / (.06 * SR))
    return x * env(n, .004, .35, .35) * gate * .32


def pad(f, dur):
    n = int((dur + .8) * SR); t = np.arange(n) / SR
    x = np.zeros(n)
    for det in (-.06, .06):
        g = f * 2 ** (det / 12)
        x += sum(np.sin(2 * np.pi * g * k * t + rng.uniform(0, 6.28)) / k ** 2 for k in (1, 2, 3, 4))
    e = np.minimum(1, t / .6); off = int(dur * SR)
    e[off:] *= np.exp(-(t[off:] - t[off]) / .35)
    return x * e * .07


def bass(f, dur):
    n = int((dur + .2) * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + .18 * np.sin(4 * np.pi * f * t)
    gate = np.ones(n); off = int(dur * SR)
    gate[off:] = np.exp(-np.arange(n - off) / (.03 * SR))
    return x * env(n, .006, .5, .55) * gate * .42


def kick(_f=0, _dur=0):
    n = int(.3 * SR); t = np.arange(n) / SR
    fr = 45 + 75 * np.exp(-t / .03)
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(n, .001, .09) * .7


def hat(_f=0, _dur=0):
    n = int(.05 * SR)
    x = lfilter([1, -1], [1, -.2], rng.standard_normal(n))
    return x * env(n, .0005, .012) * .07


def clap(_f=0, _dur=0):
    n = int(.18 * SR); t = np.arange(n) / SR
    noise = lfilter([1, 0, -1], [1, -.6, .3], rng.standard_normal(n))
    return (noise * env(n, .001, .05) * .18 + np.sin(2 * np.pi * 190 * t) * env(n, .001, .03) * .15)


VOICES = {"mallet": mallet, "epiano": epiano, "pulse": pulse, "pad": pad, "bass": bass, "kick": kick, "hat": hat, "clap": clap}
# what plays the tune and the chords in each style; bass, pad and kit are shared
STYLES = {"a": {"lead": "mallet", "keys": "mallet"}, "b": {"lead": "epiano", "keys": "epiano"}, "c": {"lead": "pulse", "keys": "pulse"}}


def room(seconds=1.8):
    """a computed room: decaying noise, a little darker as it fades, one per ear"""
    n = int(seconds * SR); t = np.arange(n) / SR
    irs = []
    for _ in range(2):
        x = rng.standard_normal(n) * np.exp(-t / .38)
        x = lfilter([.5, .5], [1], x)
        x[:int(.012 * SR)] = 0
        irs.append(x / np.sqrt((x ** 2).sum()))
    return irs


# ---------- the loops ----------
CHORDS = {
    "Fmaj7": ["F3", "A3", "C4", "E4"], "Dm7": ["D3", "F3", "A3", "C4"], "Bbmaj7": ["Bb2", "D3", "F3", "A3"], "Csus": ["C3", "F3", "G3", "C4"],
    "C": ["C3", "E3", "G3", "C4"], "Dm": ["D3", "F3", "A3", "D4"], "Bb": ["Bb2", "D3", "F3", "Bb3"], "F": ["F3", "A3", "C4", "F4"],
    "Am": ["A2", "C3", "E3", "A3"], "G": ["G2", "B2", "D3", "G3"], "Em": ["E3", "G3", "B3", "E4"], "E": ["E3", "G#3", "B3", "E4"],
    "Gm": ["G2", "Bb2", "D3", "G3"], "A": ["A2", "C#3", "E3", "A3"],
}


def up(name, k=12):
    n, o = name[:-1], int(name[-1])
    m = NOTE[n] + 12 * o + k
    names = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
    return f"{names[m % 12]}{m // 12}"


def lobby(s):
    """92 BPM, F major, 8 bars: a slow arpeggio under a tune of a few notes, no drums"""
    bpm, bars, ev = 92, 8, []
    prog = ["Fmaj7", "Dm7", "Bbmaj7", "Csus"]
    tune = [("A4", 0, 1.5), ("G4", 1.5, .5), ("F4", 2, 2), ("C5", 4, 1.5), ("A4", 5.5, .5), ("F4", 6, 2),
            ("D5", 8, 1.5), ("C5", 9.5, .5), ("A4", 10, 2), ("G4", 12, 3), ("C5", 15, 1)]
    for bar in range(bars):
        ch = CHORDS[prog[(bar // 2) % 4]]; b0 = bar * 4
        if bar % 2 == 0:
            ev += [("pad", n, b0, 8, .8) for n in ch]
            ev.append(("bass", up(ch[0], -12), b0, 3.5, .9))
        else:
            ev.append(("bass", up(ch[0], -12), b0 + 2, 1.8, .7))
        for i, k in enumerate([0, 1, 2, 3, 2, 1, 2, 3]):
            ev.append((s["keys"], up(ch[k]), b0 + i * .5, .45, .32 if i % 2 else .42))
    for rep in (0, 16):
        ev += [(s["lead"], n, rep + at, d, .55) for n, at, d in tune]
    return bpm, bars, ev


def battle(s):
    """132 BPM, D minor, 16 bars: a driving bass, a light kit, a riff that answers itself"""
    bpm, bars, ev = 132, 16, []
    prog = ["Dm", "Bb", "F", "C"]
    riff = [("D5", 0, .5), ("F5", .75, .5), ("A5", 1.5, .5), ("G5", 2, .5), ("F5", 2.5, .5), ("E5", 3, .5), ("C5", 3.5, .5)]
    answer = [("D5", 0, .5), ("E5", .5, .5), ("F5", 1, 1), ("A5", 2, .75), ("G5", 2.75, .75), ("F5", 3.5, .5)]
    for bar in range(bars):
        ch = CHORDS[prog[(bar // 2) % 4]]; b0 = bar * 4
        if bar % 2 == 0:
            ev += [("pad", n, b0, 8, .7) for n in ch[1:]]
        root = up(ch[0], -12)
        for i in range(8):
            ev.append(("bass", root if i % 4 != 3 else up(root, 12), b0 + i * .5, .4, .85 if i % 2 == 0 else .6))
        for i in range(4):
            ev.append(("kick", None, b0 + i, 0, .8 if bar >= 2 else .0))
            ev.append(("hat", None, b0 + i + .5, 0, .9))
        ev += [("clap", None, b0 + 1, 0, .8 if bar >= 2 else 0), ("clap", None, b0 + 3, 0, .8 if bar >= 2 else 0)]
        for i, k in enumerate([1, 2, 3, 2]):
            ev.append((s["keys"], up(ch[k]), b0 + i + .5, .3, .3))
        if bar >= 4 and bar % 2 == 0:
            shift = 0 if (bar // 2) % 2 == 0 else -2
            ev += [(s["lead"], up(n, shift) if shift else n, b0 + at, d, .5) for n, at, d in riff]
        if bar >= 4 and bar % 2 == 1:
            ev += [(s["lead"], n, b0 + at, d, .45) for n, at, d in answer] if bar % 4 == 3 else []
    return bpm, bars, ev


def tower(s):
    """108 BPM, A minor, 16 bars: a rising arpeggio, steps that climb, the last chord turned major to lead on"""
    bpm, bars, ev = 108, 16, []
    prog = ["Am", "F", "G", "Em", "Am", "F", "G", "E"]
    climb = ["A4", "B4", "C5", "D5", "E5", "F5", "G5", "G#5"]
    for bar in range(bars):
        ch = CHORDS[prog[(bar // 2) % 8]]; b0 = bar * 4
        if bar % 2 == 0:
            ev += [("pad", n, b0, 8, .7) for n in ch]
            ev.append(("bass", up(ch[0], -12), b0, 3.6, .85))
            ev.append(("bass", up(ch[0], -12), b0 + 4, 1.6, .7))
            ev.append(("bass", up(ch[0], -12), b0 + 6, 1.6, .7))
        for i in range(16):
            k = [0, 1, 2, 3][i % 4] + (1 if i >= 8 and i % 4 == 3 else 0)
            n = up(ch[min(k, 3)], 12 if i % 8 < 4 else 24) if k < 4 else up(ch[1], 24)
            ev.append((s["keys"], n, b0 + i * .25, .2, .22 + .06 * (i % 4 == 0)))
        ev.append(("kick", None, b0, 0, .65)); ev.append(("kick", None, b0 + 2.5, 0, .45))
        ev += [("hat", None, b0 + i * .5, 0, .6 if i % 2 else .3) for i in range(8)]
        if bar % 2 == 1:
            ev.append((s["lead"], climb[(bar // 2) % 8], b0 + 2, 2, .5))
    return bpm, bars, ev


def render(scene, style):
    bpm, bars, ev = scene(STYLES[style])
    beat = 60 / bpm; L = int(round(bars * 4 * beat * SR))
    dry = np.zeros((2, L + 3 * SR)); send = np.zeros((2, L + 3 * SR))
    pans = {"bass": 0, "kick": 0, "clap": 0, "hat": .35, "pad": 0, "mallet": -.2, "epiano": -.2, "pulse": -.2}
    sends = {"bass": .05, "kick": .03, "clap": .25, "hat": .15, "pad": .5}
    for voice, note, at, dur, vel in ev:
        if vel <= 0:
            continue
        x = VOICES[voice](hz(note) if note else 0, dur * beat) * vel
        lead = voice != "pad" and note and hz(note) > 600
        p = .2 if lead else pans.get(voice, 0)
        g = np.array([np.cos((p + 1) * np.pi / 4), np.sin((p + 1) * np.pi / 4)]) * np.sqrt(2)
        i = int(round(at * beat * SR)); j = min(i + len(x), dry.shape[1])
        dry[:, i:j] += g[:, None] * x[: j - i]
        send[:, i:j] += g[:, None] * x[: j - i] * sends.get(voice, .3)
    # fold the tails onto the start: the loop runs on with no seam
    loop = dry[:, :L].copy(); wet_in = send[:, :L].copy()
    for k in range(1, 4):
        a, b = k * L, min((k + 1) * L, dry.shape[1])
        if a < b:
            loop[:, : b - a] += dry[:, a:b]; wet_in[:, : b - a] += send[:, a:b]
    irs = room()
    wet = np.stack([np.fft.irfft(np.fft.rfft(wet_in[c]) * np.fft.rfft(irs[c], L), L) for c in range(2)])
    out = loop + wet * .9
    # a gentle top: nothing over 9 kHz pokes out
    out = lfilter([.6, .4], [1], out, axis=1)
    return out, L


def loudness(x):
    """Integrated loudness in LUFS (ITU-R BS.1770-4: K-weighting, 400 ms blocks, absolute and relative gates). build-cry-levels.py
    measures the cries with it too."""
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


def level(x, target=-20.0):
    # every track at one loudness, its peak kept under -1 dBFS
    x = x * 10 ** ((target - loudness(x)) / 20)
    peak = np.abs(x).max()
    return (x * (0.89 / peak) if peak > 0.89 else x).astype(np.float32)


def write(path, x):
    out = av.open(str(path), "w", format="ipod")
    stream = out.add_stream("aac", rate=SR)
    stream.bit_rate = 128000
    stream.layout = "stereo"
    x = x.astype(np.float32)
    for i in range(0, x.shape[1], 1024):
        frame = av.AudioFrame.from_ndarray(np.ascontiguousarray(x[:, i:i + 1024]), format="fltp", layout="stereo")
        frame.sample_rate = SR
        for packet in stream.encode(frame):
            out.mux(packet)
    for packet in stream.encode(None):
        out.mux(packet)
    out.close()


PAD = 2048  # the loop wrapped in its own sound on each side: an AAC file's first and last frames are not exact (music.js)
SCENES = {"lobby": lobby, "battle": battle, "tower": tower}

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--style", default="c", choices=list(STYLES))
    ap.add_argument("--draft", help="a folder: write one file of the three loops in turn to listen to")
    args = ap.parse_args()
    loops = {name: render(fn, args.style) for name, fn in SCENES.items()}
    if args.draft:
        parts = []
        for name in ("lobby", "battle", "tower"):
            x, L = loops[name]
            x = level(np.concatenate([x, x], axis=1))  # twice round, so the seam is heard
            fade = int(1.5 * SR); x[:, :fade] *= np.linspace(0, 1, fade); x[:, -fade:] *= np.linspace(1, 0, fade)
            parts += [x, np.zeros((2, SR))]
        Path(args.draft).mkdir(parents=True, exist_ok=True)
        write(Path(args.draft) / f"music-{args.style}.m4a", np.concatenate(parts, axis=1))
    else:
        for name, (x, L) in loops.items():
            x = level(x)
            write(ROOT / "public" / "music" / f"{name}.m4a", np.concatenate([x[:, -PAD:], x, x[:, :PAD]], axis=1))
            print(f"{name}: {L} samples ({L / SR:.3f} s)")  # music.js LENGTH
