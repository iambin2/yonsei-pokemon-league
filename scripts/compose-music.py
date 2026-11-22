"""Compose the battle's background music in code (src/pages/battle/music.js plays public/music/*.m4a).

Every sample is computed here, and the three loops are written note by note. The writing is reverse-engineered from the Pokémon themes
players praise (2026-11-22, the owner: "성공작으로부터 역산"): thirteen of them were measured beside ours, and passages were rendered with one
thing changed at a time to see what moved the reading. What they share, and what this file now does:

  - the tune is a fanfare: it leaps up a chord (a fifth, an octave) and runs in sixteenths, it does not step down in long notes;
  - the bass runs in sixteenths with its octave, the chord is an arpeggio in sixteenths, nothing is a held pad;
  - plain triads, and a turn to the major (E minor to E major, the same tune) rather than seventh chords;
  - the lead is three detuned saws spread left and right, the kit is loud, the room is small, the master is pressed dense;
  - a loop of 60 to 90 s in three or four sections that differ, and a fast chromatic run as the way in.

Measured on the same passage: 'sad and melancholic' fell from z 2.9 to 0.8-1.7 (theirs 0.4-1.7), 'exciting' rose from 2.5 to 3.0 (theirs
3.4-4.2). One tune runs through all three: the battle's fanfare, the lobby calls its head over a heartbeat and waits on the dominant, the
tower climbs it in A minor. arrange() lays a section out and refuses a note that grates (sour). Each loop is rendered circularly, the tails
folded back onto its start, so it runs on with no seam; the battle has a second loop to play over it when it runs hot (battle-heat.m4a).
Brought to -20 LUFS (BS.1770, as the mix expects).

    python scripts/compose-music.py --draft <dir>   # one file: lobby, battle, tower in turn, to listen to
    python scripts/compose-music.py                 # public/music/{lobby,battle,battle-heat,tower}.m4a, then music.js LENGTH and INTRO;
                                                    # and public/sfx/{win,lose,draw}.m4a, the result's bars (sfx.js)
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


def hz(m):
    """the MIDI note 69 -> 440; a fraction detunes"""
    return 440.0 * 2 ** ((m - 69) / 12)


def env(n, a, d, sustain=0.0):
    """attack a s, then an exponential decay with time constant d s towards sustain"""
    t = np.arange(n) / SR
    return np.where(t < a, t / max(a, 1e-4), sustain + (1 - sustain) * np.exp(-(t - a) / d))


def gated(x, dur, release):
    off = int(dur * SR)
    x[off:] *= np.exp(-np.arange(len(x) - off) / (release * SR))
    return x


# ---------- voices: f in Hz, dur in seconds; each returns a mono array ----------
def sing(f, dur):
    """the lead: a saw (every harmonic, falling as 1/k), a bite at the start, vibrato coming in late on a held note. arrange() plays it
    three times, the outer two detuned and spread: one saw alone read thinner and sadder"""
    n = int((dur + .2) * SR); t = np.arange(n) / SR
    vib = .007 * np.clip((t - .22) / .25, 0, 1) * np.sin(2 * np.pi * 5.6 * t)
    ph = 2 * np.pi * f * np.cumsum(1 + vib) / SR
    x = sum(np.sin(k * ph) / k for k in range(1, max(2, min(24, int(10000 / f))) + 1))
    return gated(x * env(n, .003, .25, .7), dur, .03) * .26


def pulse(f, dur):
    """the chord's voice: a soft square, odd harmonics falling fast, a short glow"""
    n = int((dur + .5) * SR); t = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * f * k * t) / k ** 1.6 for k in (1, 3, 5, 7) if f * k < 9000)
    return gated(x * env(n, .004, .35, .35), dur, .06) * .32


def bell(f, dur):
    """a struck bar: it rings on past its note"""
    n = int((dur + .9) * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / .3) + .4 * np.sin(4 * np.pi * f * t) * np.exp(-t / .12) + .15 * np.sin(2 * np.pi * 4.2 * f * t) * np.exp(-t / .04)
    return x * np.minimum(1, t / .002) * .3


def drive(f, dur):
    """the bass: harmonics at 150-400 Hz, which a phone speaker carries, the upper ones falling away as the note holds"""
    n = int((dur + .1) * SR); t = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * f * k * t) * (.4 + .6 * np.exp(-t * k / .5)) for k, a in enumerate((1, .55, .38, .24, .14), 1))
    return gated(x * env(n, .005, .5, .6), dur, .03) * .34


def kick(_f=0, _dur=0):
    n = int(.3 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * np.cumsum(45 + 75 * np.exp(-t / .03)) / SR) * env(n, .001, .09)


def snare(_f=0, _dur=0):
    n = int(.22 * SR); t = np.arange(n) / SR
    noise = lfilter([1, 0, -1], [1, -.3, .2], rng.standard_normal(n))
    return noise * env(n, .001, .06) * .3 + np.sin(2 * np.pi * (180 + 60 * np.exp(-t / .02)) * t) * env(n, .001, .04) * .36


def hat(_f=0, _dur=0):
    n = int(.05 * SR)
    return lfilter([1, -1], [1, -.2], rng.standard_normal(n)) * env(n, .0005, .012) * .05


def openhat(_f=0, _dur=0):
    n = int(.3 * SR)
    return lfilter([1, -1], [1, -.2], rng.standard_normal(n)) * env(n, .001, .07) * .045


def crash(_f=0, _dur=0):
    n = int(1.6 * SR); t = np.arange(n) / SR
    return lfilter([1, -1], [1, -.5], rng.standard_normal(n)) * np.exp(-t / .45) * .05


def riser(_f, dur):
    """air that swells up to a drop and stops there"""
    n = int(dur * SR); t = np.arange(n) / SR
    x = lfilter([1, -1], [1, -.6], rng.standard_normal(n)) * (t / dur) ** 2 * .05
    x[-441:] *= np.linspace(1, 0, 441)
    return x


VOICES = {"sing": sing, "pulse": pulse, "bell": bell, "drive": drive, "kick": kick, "snare": snare, "hat": hat, "open": openhat,
          "crash": crash, "riser": riser}
SENDS = {"drive": .04, "kick": .03, "snare": .22, "hat": .15, "open": .15, "crash": .4, "riser": .2}  # into the room; the rest .3


def room(seconds=1.2):
    """a small computed room: decaying noise, a little darker as it fades, one per ear"""
    n = int(seconds * SR); t = np.arange(n) / SR
    irs = []
    for _ in range(2):
        x = rng.standard_normal(n) * np.exp(-t / .25)
        x = lfilter([.5, .5], [1], x)
        x[:int(.012 * SR)] = 0
        irs.append(x / np.sqrt((x ** 2).sum()))
    return irs


# ---------- writing: chords, lines, the check, the arranger ----------
QUAL = {"": (0, 4, 7), "m": (0, 3, 7), "7": (0, 4, 7, 10), "sus4": (0, 5, 7)}


def halves(text):
    """'Em Em C,D' -> the chord's pitch classes for every half bar, the root first"""
    out = []
    for bar in text.split():
        for name in (bar.split(",") * 2)[:2]:
            root = name[:2] if name[1:2] == "#" else name[:1]
            out.append([(NOTE[root] + i) % 12 for i in QUAL[name[len(root):]]])
    return out


def line(text):
    """'E5 0 1; G5 1 .5' -> [(midi, at, beats)]"""
    parts = (p.split() for p in text.replace("\n", ";").split(";") if p.strip())
    return [(NOTE[n[:-1]] + 12 * (int(n[-1]) + 1), float(at), float(d)) for n, at, d in parts]


def sour(tune, chords, scale):
    """The notes that grate (the owner, 2026-11-22: "귀를 거슬리게 하는 음"): one outside both the key and the chord, unless it passes in a
    sixteenth (a chromatic run); or one a semitone from a chord tone held a beat or more. chords: pitch classes per half bar. A note is
    checked against the chord it starts on."""
    bad = []
    for m, at, d in tune:
        tones = set(chords[int(at // 2) % len(chords)]); pc = m % 12
        if pc not in tones and (pc not in scale and d > .25 or d >= 1 and ((pc - 1) % 12 in tones or (pc + 1) % 12 in tones)):
            bad.append((m, at, d))
    return bad


E_MINOR = [4, 6, 7, 9, 11, 0, 2]
E_MIXOLYDIAN = [4, 6, 8, 9, 11, 1, 2]  # E major with D natural: the battle's turn to the major
G_MINOR = [7, 9, 10, 0, 2, 3, 5]  # the key the battle goes away to
A_MINOR = [9, 11, 0, 2, 4, 5, 7]


def arrange(ev, scale, b0, chords, tune, kit, low, keys, *, vel=.62, counter=(), third=False, octave=False, top=False, swell=0, heat=None):
    """One section onto ev, from beat b0. The tune: three detuned saws spread wide, its echo three quarters of a beat late, and when asked
    its third under it, its octave under it, a bell an octave over it. counter: a second line, one saw. low, the bass: run (sixteenths
    with the octave), tres (3+3+2), pedal (eighths on the root, swelling through the section), long (a note a bar). keys, the chord:
    16th or 8th (an arpeggio), stab (off the beat). kit: push, floor, half, soft, pulse, pulse2, build, heart.
    heat: a second list, for the layer played over the loop when the battle runs hot (music.js): a shaker on every sixteenth, a high
    ostinato, a bell over the tune, the riff's kick filled out to every beat; nothing over the break.
    chords: halves(). Returns the beat it ends on. A tune or a second line with a sour note in it is refused."""
    for notes in (tune, counter):
        assert not sour(notes, chords, scale), sour(notes, chords, scale)
    bars = len(chords) // 2
    at = lambda beat: chords[int(beat // 2) % len(chords)]
    for m, t, d in tune:
        v = vel * (1 if t % 1 == 0 else .9) * (1 + rng.uniform(-.04, .04)); hold = d * (.85 if d <= .5 else .95)
        ev += [("sing", m + cents, b0 + t + rng.uniform(-.006, .006), hold, v * g, p) for cents, g, p in ((0, 1, 0), (.08, .5, -.6), (-.08, .5, .6))]
        ev.append(("sing", m, b0 + t + .75, d * .5, v * .2, -.65))
        if third and d >= .5 and m % 12 in scale:  # the diatonic third under the tune
            i = scale.index(m % 12)
            ev.append(("sing", m - (m % 12 - scale[(i - 2) % 7]) % 12, b0 + t, hold, v * .45, -.35))
        if octave:
            ev.append(("sing", m - 12, b0 + t, hold, v * .45, .35))
        if top:
            ev.append(("bell", m + 12, b0 + t, min(d, .5), v * .3, .6))
        if heat is not None and not top:
            heat.append(("bell", m + 12, b0 + t, min(d, .5), v * .3, -.5))
    for m, t, d in counter:
        ev.append(("sing", m, b0 + t + rng.uniform(-.006, .006), d * .9, .3 * (1 if t % 1 == 0 else .9), .5))
    for bar in range(bars):
        bb, last, grow = b0 + bar * 4, bar == bars - 1, (bar + 1) / bars
        for i in range(16):
            root = at(bar * 4 + i * .25)[0]; r = (36 if root <= 7 else 24) + root
            if low == "run":
                ev.append(("drive", r + (12 if i % 4 == 2 else 0), bb + i * .25, .2, .85 if i % 4 == 0 else .6, 0))
            elif i % 2:
                continue
            elif low == "long":
                ev += [("drive", r, bb, 2.9 if last and kit == "heart" else 3.8, .8, 0)] if i == 0 else []
            elif low == "pedal":
                ev.append(("drive", r, bb + i * .25, .4, (.5 + .4 * grow) * (1 if i % 4 == 0 else .75), 0))
            elif low == "tres":
                ev.append(("drive", r + (12 if i in (4, 10, 14) else 0), bb + i * .25, .4, .85 if i in (0, 6, 12) else .58, 0))
        for i in range(16 if keys else 0):
            tones = sorted(60 + (pc - 60) % 12 for pc in at(bar * 4 + i * .25)); tones.append(tones[0] + 12)
            pan = -.7 if i % 2 else .7
            if keys == "stab" and i % 4 == 2:
                ev += [("pulse", m, bb + i * .25, .28, .26, p) for m, p in zip(tones, (-.7, .7, 0))]
            elif keys == "8th" and i % 2 == 0:
                ev.append(("pulse", tones[[0, 1, 2, 3, 2, 1, 2, 3][i // 2]] + 12, bb + i * .25, .42, .28 * (grow if kit == "build" else 1), pan))
            elif keys == "16th":
                ev.append(("pulse", tones[(0, 1, 2, 3, 2, 1, 2, 3)[i % 8]], bb + i * .25, .2, .3, pan))
        if kit in ("push", "floor"):
            kicks = [0, 1, 2, 3] if kit == "floor" else [0, 1.5, 2] + ([3.25] if bar % 2 else [])
            ev += [(v, None, bb + t, 0, .85, 0) for v, ts in (("kick", kicks), ("snare", [1, 3])) for t in ts if not (last and t >= 3)]
            for i in range(12 if last else 16):
                t = i * .25
                ev.append(("open", None, bb + t, 0, 1.2, .3) if kit == "floor" and t % 1 == .5 else ("hat", None, bb + t, 0, 1.2 if t % 1 == .5 else .7 if t % .5 == 0 else .45, .3))
            if last:
                ev += [("snare", None, bb + t, 0, v, p) for t, v, p in ((3, .55, -.2), (3.25, .5, -.1), (3.5, .65, 0), (3.75, .85, .2))]
                ev.append(("kick", None, bb + 3, 0, .7, 0))
        elif kit in ("pulse", "pulse2"):  # the lobby: 두근, 두근 under a tick, the snare only on three (pulse2)
            ev += [("kick", None, bb + t, 0, .8 if t % 2 == 0 else .55, 0) for t in (0, .75, 2, 2.75)]
            ev += [("hat", None, bb + i * .5, 0, .8 if i % 2 else .45, .3) for i in range(8)]
            ev += [("snare", None, bb + 2, 0, .6, 0)] if kit == "pulse2" else []
        elif kit == "half":  # the tower: the kick on one and the and of three, the snare on three
            ev += [("kick", None, bb + t, 0, .8, 0) for t in (0, 2.5)]
            ev += [("hat", None, bb + i * .25, 0, 1 if i % 4 == 2 else .6 if i % 2 == 0 else .4, .3) for i in range(16)]
            ev += [("snare", None, bb + t, 0, v, 0) for t, v in ([(2, .75)] + ([(3, .5), (3.5, .6), (3.75, .8)] if last else []))]
        elif kit == "build":  # the climb: the snare doubles and doubles
            ev += [("kick", None, bb + i, 0, .75, 0) for i in range(4)]
            step = (2, 1, .5, .25)[min(3, bar * 4 // bars)]
            ev += [("snare", None, bb + (1 if step == 2 else 0) + i * step, 0, .35 + .5 * (bar * 4 + i * step) / (bars * 4), 0) for i in range(int(4 / step))]
        elif kit == "heart":  # 두근, 두근: two bars of it alone, two with the snare closing in, then one beat of nothing
            ev += [("kick", None, bb + t, 0, .85 if t % 2 == 0 else .6, 0) for t in (0, .75, 2, 2.75) if not (last and t >= 2.75)]
            step = (0, 0, .5, .25)[bar]
            ev += [("snare", None, bb + i * step, 0, .3 + .55 * (bar * 4 + i * step - 8) / 7, 0) for i in range(int((3 if last else 4) / step) if step else 0)]
    if kit in ("push", "floor", "half"):
        ev.append(("crash", None, b0, 0, 1, -.2))
    if heat is not None and kit != "heart":
        for i in range(bars * 16):
            m = 69 + (at(i * .25)[0] - 69) % 12
            heat.append(("hat", None, b0 + i * .25, 0, .7 if i % 2 else .35, -.4))
            heat.append(("pulse", m + (0, 7, 12, 7)[i % 4] + 12, b0 + i * .25, .2, .2, -.6 if i % 2 else .6))
        if kit == "push":
            heat += [("kick", None, b0 + bar * 4 + t, 0, .7, 0) for bar in range(bars) for t in (1, 3)]
    if swell:
        end = bars * 4 - (1 if kit == "heart" else 0)
        ev.append(("riser", None, b0 + end - swell, swell, 1, 0))
    return b0 + bars * 4


# ---------- the loops ----------
# the tune all three share, eight bars, two to a chord (Em D C B): up the chord by a fifth and an octave, down through it, a run back up
FANFARE = """E5 0 .5; B5 .5 .5; E6 1 1; D6 2 .5; B5 2.5 .5; G5 3 .5; B5 3.5 .5; E6 4 1.5; B5 5.5 .5; G5 6 .25; A5 6.25 .25; B5 6.5 .25; D6 6.75 .25; E6 7 1
             D5 8 .5; A5 8.5 .5; D6 9 1; C6 10 .5; A5 10.5 .5; F#5 11 .5; A5 11.5 .5; D6 12 1.5; A5 13.5 .5; F#5 14 .25; G5 14.25 .25; A5 14.5 .25; C6 14.75 .25; D6 15 1
             C5 16 .5; G5 16.5 .5; C6 17 1; B5 18 .5; G5 18.5 .5; E5 19 .5; G5 19.5 .5; C6 20 1.5; G5 21.5 .5; E5 22 .25; F#5 22.25 .25; G5 22.5 .25; B5 22.75 .25; C6 23 1
             B4 24 .5; F#5 24.5 .5; B5 25 1; A5 26 .5; F#5 26.5 .5; D#5 27 .5; F#5 27.5 .5; B5 28 1; D#6 29 1; F#6 30 .5; D#6 30.5 .5; B5 31 .25; D#6 31.25 .25; F#6 31.5 .5"""


def lobby():
    """The wait before a battle (2026-11-22, the owner: "우중충해", "배틀 시작 전 긴장감"): the battle's key and its pace, 176 BPM, felt at half;
    64 bars (87 s). Under all of it the battle's own heartbeat on the kick and a tick, a bass that swells through each eight bars. The
    head of the fanfare called out in two bars and answered by a second voice; again with its third; a climb (Am Bm C D); then eight bars
    held on the dominant, the snare closing in, which only the first bar of the round after, or the battle itself, resolves. Twice round,
    the second with the octave under it and bells."""
    bpm, ev, b = 176, [], 0
    part = lambda b0, *a, **k: arrange(ev, E_MINOR, b0, *a, **k)
    call = line("""E5 0 .5; B5 .5 .5; E6 1 1; D6 2 .5; B5 2.5 .5; G5 3 .5; B5 3.5 .5; E6 4 2
                   C5 16 .5; G5 16.5 .5; C6 17 1; B5 18 .5; G5 18.5 .5; E5 19 .5; G5 19.5 .5; C6 20 2""")
    reply = line("""E5 8 .5; G5 8.5 .5; B5 9 1; G5 10 .5; B5 10.5 .5; E6 11 1; D6 12 1; B5 13 1; G5 14 2
                    D5 24 .5; F#5 24.5 .5; A5 25 1; D6 26 2; A5 28 1; F#5 29 1; A5 30 2""")
    climb = line("""E5 0 1; A5 1 1; C6 2 2; G5 4 1; A5 5 3; F#5 8 1; B5 9 1; D6 10 2; A5 12 1; B5 13 3
                    G5 16 1; C6 17 1; E6 18 2; D6 20 1; C6 21 3; A5 24 1; D6 25 1; F#6 26 2; E6 28 1; D6 29 3""")
    under = line("E5 0 8; D5 8 8; E5 16 8; F#5 24 8")
    hold = line("""B5 0 1; B5 1 .5; B5 1.5 1; A5 2.5 .5; B5 3 1; E6 4 3; B5 8 1; B5 9 .5; B5 9.5 1; A5 10.5 .5; B5 11 1; F#6 12 3
                   B5 16 1; B5 17 .5; B5 17.5 1; D#6 18.5 .5; F#6 19 1; F#6 20 1.5; D#6 21.5 .5; B5 22 2
                   D#6 24 1; F#6 25 1; A5 26 1; B5 27 1; D#6 28 1; F#6 29 1.5""")
    drone = line("F#5 0 8; E5 8 8; F#5 16 8; A5 24 4; B5 28 3")
    home, up = halves("Em Em Em Em C C D D"), halves("Am Am Bm Bm C C D D")
    wait = halves("Bsus4 Bsus4 Bsus4 Bsus4 B7 B7 B7 B7")
    for again in (False, True):
        b = part(b, home, call, "pulse", "pedal", "16th", vel=.6, counter=reply, octave=again)
        b = part(b, home, call, "pulse2", "pedal", "16th", vel=.62, counter=reply, third=True, top=again)
        b = part(b, up, climb, "pulse2", "pedal", "8th", vel=.62, counter=under)
        b = part(b, wait, hold, "build", "pedal", "8th", vel=.64, counter=drone, swell=16)
    return bpm, b // 4, ev


def battle():
    """176 BPM, E minor, 68 bars (93 s). The fanfare over Em D C B, twice (the second with its third); the same fanfare turned to E major
    over E D A B, the kick on every beat; a chase up each chord and round a turn (C D Em, then the dominant), down in a run; the fanfare
    gone away to G minor, a sixth lower, with bells; all three again, fuller; then the break: 두근, 두근 on the kick alone, a chromatic run down and up the dominant with the snare closing
    in, one beat of nothing, and the drop back into the fanfare. The break is the loop's last four bars and the way in too: music.js
    starts the track there (INTRO). Returns a fourth list, the layer played over the loop when the battle runs hot (arrange's heat),
    written to battle-heat.m4a."""
    bpm, ev, heat = 176, [], []
    fan = line(FANFARE)
    bright = line("""E5 0 .5; B5 .5 .5; E6 1 1; D6 2 .5; B5 2.5 .5; G#5 3 .5; B5 3.5 .5; E6 4 1.5; B5 5.5 .5; G#5 6 .25; A5 6.25 .25; B5 6.5 .25; D6 6.75 .25; E6 7 1
                     D5 8 .5; A5 8.5 .5; D6 9 1; C#6 10 .5; A5 10.5 .5; F#5 11 .5; A5 11.5 .5; D6 12 1.5; A5 13.5 .5; F#5 14 .25; G#5 14.25 .25; A5 14.5 .25; C#6 14.75 .25; D6 15 1
                     A4 16 .5; E5 16.5 .5; A5 17 1; G#5 18 .5; E5 18.5 .5; C#5 19 .5; E5 19.5 .5; A5 20 1.5; E5 21.5 .5; C#5 22 .25; D5 22.25 .25; E5 22.5 .25; G#5 22.75 .25; A5 23 1
                     B4 24 .5; F#5 24.5 .5; B5 25 1; A5 26 .5; F#5 26.5 .5; D#5 27 .5; F#5 27.5 .5; B5 28 1; D#6 29 1; F#6 30 .5; D#6 30.5 .5; B5 31 .25; D#6 31.25 .25; F#6 31.5 .5""")
    chase = line("""E5 0 .5; G5 .5 .5; C6 1 .5; E6 1.5 .5; D6 2 .25; C6 2.25 .25; B5 2.5 .25; C6 2.75 .25; G5 3 1
                    F#5 4 .5; A5 4.5 .5; D6 5 .5; F#6 5.5 .5; E6 6 .25; D6 6.25 .25; C6 6.5 .25; D6 6.75 .25; A5 7 1
                    G5 8 .5; B5 8.5 .5; E6 9 1.5; D6 10.5 .5; B5 11 .5; G5 11.5 .5; E6 12 .5; D6 12.5 .5; B5 13 .5; G5 13.5 .5; E5 14 .25; F#5 14.25 .25; G5 14.5 .25; A5 14.75 .25; B5 15 1
                    E5 16 .5; G5 16.5 .5; C6 17 .5; E6 17.5 .5; D6 18 .25; C6 18.25 .25; B5 18.5 .25; C6 18.75 .25; E6 19 1
                    F#5 20 .5; A5 20.5 .5; D6 21 .5; F#6 21.5 .5; E6 22 .25; D6 22.25 .25; C6 22.5 .25; D6 22.75 .25; F#6 23 1
                    D#6 24 1; B5 25 .5; F#5 25.5 .5; B5 26 .5; D#6 26.5 .5; F#6 27 1
                    B5 28 .5; D#6 28.5 .5; F#6 29 1; F#6 30 .25; E6 30.25 .25; D#6 30.5 .25; C6 30.75 .25; B5 31 .25; A5 31.25 .25; G5 31.5 .25; F#5 31.75 .25""")
    away = [(m - 9, t, d) for m, t, d in fan]  # the fanfare in G minor, a sixth lower: the change of key
    # the break: the fanfare's first leap, alone; then down the chromatic scale twice and up the dominant seventh to one held note
    turn = line("""E5 0 .5; B5 .5 .5; E6 1 2
                   E6 8 .25; D#6 8.25 .25; D6 8.5 .25; C#6 8.75 .25; C6 9 .25; B5 9.25 .25; A#5 9.5 .25; A5 9.75 .25
                   G#5 10 .25; G5 10.25 .25; F#5 10.5 .25; F5 10.75 .25; E5 11 .25; D#5 11.25 .25; D5 11.5 .25; C#5 11.75 .25
                   B4 12 .25; D#5 12.25 .25; F#5 12.5 .25; A5 12.75 .25; B5 13 .25; D#6 13.25 .25; F#6 13.5 .25; A6 13.75 .25; B5 14 1""")
    minor, major = halves("Em Em D D C C B B"), halves("E E D D A A B B")
    high, brk, far = halves("C D Em Em C D B B"), halves("Em Em B B"), halves("Gm Gm F F D# D# D D")
    part = lambda b0, scale, *a, **k: arrange(ev, scale, b0, *a, heat=heat, **k)

    b = part(0, E_MINOR, minor, fan, "push", "run", "16th")
    b = part(b, E_MINOR, minor, fan, "push", "run", "16th", third=True)
    b = part(b, E_MIXOLYDIAN, major, bright, "floor", "run", "16th", vel=.66, octave=True)
    b = part(b, E_MINOR, high, chase, "floor", "run", "16th", vel=.68)
    b = part(b, G_MINOR, far, away, "push", "run", "16th", vel=.68, top=True)
    b = part(b, E_MINOR, minor, fan, "push", "run", "16th", third=True, octave=True)
    b = part(b, E_MIXOLYDIAN, major, bright, "floor", "run", "16th", vel=.66, octave=True, top=True)
    b = part(b, E_MINOR, high, chase, "floor", "run", "16th", vel=.7, third=True, top=True)
    b = part(b, E_MINOR, brk, turn, "heart", "long", None, vel=.6, swell=7)
    return bpm, b // 4, ev, heat


def tower():
    """140 BPM, A minor, 40 bars (69 s): the fanfare in A minor, each phrase a step higher than the last (Am, F, G, then Am an octave up),
    over sixteenths that never stop; then steps that climb chord by chord (Dm Em F G) to the dominant under a line that rises a note a
    bar; the fanfare again with its third, with its octave and bells, and the steps once more to lead round."""
    bpm, ev = 140, []
    part = lambda b0, *a, **k: arrange(ev, A_MINOR, b0, *a, **k)
    tune = line("""A4 0 .5; E5 .5 .5; A5 1 1; G5 2 .5; E5 2.5 .5; C5 3 .5; E5 3.5 .5; A5 4 1.5; E5 5.5 .5; C5 6 .25; D5 6.25 .25; E5 6.5 .25; G5 6.75 .25; A5 7 1
                   F5 8 .5; A5 8.5 .5; C6 9 1; A5 10 .5; F5 10.5 .5; C5 11 .5; F5 11.5 .5; G5 12 .5; B5 12.5 .5; D6 13 1; B5 14 .5; G5 14.5 .5; D5 15 .5; G5 15.5 .5
                   A5 16 .5; C6 16.5 .5; E6 17 1; D6 18 .5; C6 18.5 .5; A5 19 .5; C6 19.5 .5; E6 20 1.5; C6 21.5 .5; A5 22 .25; B5 22.25 .25; C6 22.5 .25; D6 22.75 .25; E6 23 1
                   F5 24 .5; A5 24.5 .5; C6 25 1; F6 26 1; C6 27 1; E5 28 .5; G#5 28.5 .5; B5 29 1; E6 30 1; G#5 31 .5; B5 31.5 .5""")
    steps = line("""D5 0 .5; F5 .5 .5; A5 1 1.5; F5 2.5 .5; D5 3 1; E5 4 .5; G5 4.5 .5; B5 5 1.5; G5 6.5 .5; E5 7 1
                    F5 8 .5; A5 8.5 .5; C6 9 1.5; A5 10.5 .5; F5 11 1; G5 12 .5; B5 12.5 .5; D6 13 1.5; B5 14.5 .5; G5 15 1
                    F5 16 .5; A5 16.5 .5; D6 17 1.5; A5 18.5 .5; F5 19 1; G5 20 .5; B5 20.5 .5; E6 21 1.5; B5 22.5 .5; G5 23 1
                    C6 24 1; A5 25 1; D6 26 1; B5 27 1; E6 28 2; G#5 30 1; B5 31 1""")
    ladder = line("A4 0 4; B4 4 4; C5 8 4; D5 12 4; A4 16 4; B4 20 4; C5 24 2; D5 26 2; E5 28 4")
    home, rise = halves("Am Am F G Am Am F E"), halves("Dm Em F G Dm Em F,G E")
    b = part(0, home, tune, "half", "run", "16th")
    b = part(b, home, tune, "half", "run", "16th", third=True)
    b = part(b, rise, steps, "build", "pedal", "8th", swell=8, counter=ladder)
    b = part(b, home, tune, "half", "run", "16th", vel=.66, octave=True, top=True)
    b = part(b, rise, steps, "build", "pedal", "8th", swell=8, counter=ladder, third=True)
    return bpm, b // 4, ev


def cadences():
    """The result's own bars (2026-11-22: the effects' win and loss had nothing of the music in them), played by sfx.js over what it
    already sounds. A win: the fanfare's leap turned to E major, up to its top note and held, with its third, its octave and bells.
    A loss: the chord's soft square, not the lead, stepping down the minor scale, low and slow, onto a held note (the fanfare's leap taken downwards still read
    as a victory, z 4.7). A draw: the same plain voice held on the keynote over a suspended chord, neither up nor down."""
    out = {}
    ev = []
    arrange(ev, E_MIXOLYDIAN, 0, halves("E E"), line("E5 0 .5; B5 .5 .5; E6 1 1; B5 2 .25; E6 2.25 .25; G#6 2.5 .5; E6 3 3"), None, "long", "16th",
            vel=.7, third=True, octave=True, top=True)
    ev += [("kick", None, 0, 0, .85, 0), ("snare", None, 1, 0, .8, 0), ("kick", None, 2, 0, .85, 0), ("snare", None, 2.5, 0, .7, 0),
           ("kick", None, 3, 0, .9, 0), ("crash", None, 3, 0, 1, -.2)]
    out["win"] = (176, ev)
    ev = []
    fall = line("B4 0 1; A4 1 1; G4 2 1; E4 3 1; D4 4 1; B3 5 3")
    assert not sour(fall, halves("Em Em"), E_MINOR)
    ev += [("pulse", m, t, d * .95, .55, 0) for m, t, d in fall] + [("drive", 40, 0, 4.8, .7, 0), ("drive", 35, 5, 3, .7, 0), ("kick", None, 5, 0, .7, 0)]
    out["lose"] = (84, ev)
    ev = []
    arrange(ev, E_MINOR, 0, halves("Esus4 Esus4"), (), None, "long", None, counter=line("E5 0 .75; E5 .75 .25; E5 1 3"))
    out["draw"] = (120, ev)
    return out


def render(bpm, bars, ev):
    beat = 60 / bpm; L = int(round(bars * 4 * beat * SR))
    dry = np.zeros((2, L + 3 * SR)); send = np.zeros((2, L + 3 * SR))
    for voice, note, at, dur, vel, p in ev:
        x = VOICES[voice](hz(note) if note else 0, dur * beat) * vel
        g = np.array([np.cos((p + 1) * np.pi / 4), np.sin((p + 1) * np.pi / 4)]) * np.sqrt(2)
        i = max(0, int(round(at * beat * SR))); j = min(i + len(x), dry.shape[1])
        dry[:, i:j] += g[:, None] * x[: j - i]
        send[:, i:j] += g[:, None] * x[: j - i] * SENDS.get(voice, .3)
    # fold the tails onto the start: the loop runs on with no seam
    loop = dry[:, :L].copy(); wet_in = send[:, :L].copy()
    for k in range(1, 4):
        a, b = k * L, min((k + 1) * L, dry.shape[1])
        if a < b:
            loop[:, : b - a] += dry[:, a:b]; wet_in[:, : b - a] += send[:, a:b]
    irs = room()
    wet = np.stack([np.fft.irfft(np.fft.rfft(wet_in[c]) * np.fft.rfft(irs[c], L), L) for c in range(2)])
    out = loop + wet * .35
    # a gentle top: nothing over 9 kHz pokes out
    return lfilter([.6, .4], [1], out, axis=1), L


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


DRIVE = 3.0  # how hard the master is pressed: the loop's peak comes to tanh(3), its body up with it (theirs crest 13 dB, ours was 16)
WIDE = 2.0  # the sides against the middle: theirs sit at -8 dB, ours sat at -14


def master(x, over=None, target=-20.0):
    """Press the loop dense, then bring it to one loudness with its peak under -1 dBFS. over: a layer played with it, taken through the
    same two gains (it is small beside the loop, where the press is still a straight line)."""
    mid, side = (x[0] + x[1]) / 2, (x[0] - x[1]) * WIDE / 2
    x = np.stack([mid + side, mid - side])
    g = DRIVE / np.abs(x).max()
    y = np.tanh(x * g)
    k = min(10 ** ((target - loudness(y)) / 20), .89 / np.abs(y).max())
    return (y * k).astype(np.float32), None if over is None else (over * g * k).astype(np.float32)


def write(path, x, bit_rate=128000):
    out = av.open(str(path), "w", format="ipod")
    stream = out.add_stream("aac", rate=SR)
    stream.bit_rate = bit_rate
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
    ap.add_argument("--draft", help="a folder: write one file of the three loops in turn to listen to")
    args = ap.parse_args()
    made = {name: fn() for name, fn in SCENES.items()}  # bpm, bars, the notes, and the battle's hot layer
    loops = {name: render(*m[:3]) for name, m in made.items()}
    if args.draft:
        parts = []
        for name in ("lobby", "battle", "tower"):
            x = master(np.concatenate([loops[name][0]] * 2, axis=1))[0]  # twice round, so the seam is heard
            fade = int(1.5 * SR); x[:, :fade] *= np.linspace(0, 1, fade); x[:, -fade:] *= np.linspace(1, 0, fade)
            parts += [x, np.zeros((2, SR), np.float32)]
        Path(args.draft).mkdir(parents=True, exist_ok=True)
        write(Path(args.draft) / "music.m4a", np.concatenate(parts, axis=1))
    else:
        wrap = lambda a: np.concatenate([a[:, -PAD:], a, a[:, :PAD]], axis=1)
        for name, (x, L) in loops.items():
            over = render(*made[name][:2], made[name][3])[0] if len(made[name]) > 3 else None
            y, hot = master(x, over)
            write(ROOT / "public" / "music" / f"{name}.m4a", wrap(y))
            print(f"{name}: {L} samples ({L / SR:.3f} s)")  # music.js LENGTH
            if hot is not None:  # the layer over it: the same length, the same gains
                write(ROOT / "public" / "music" / f"{name}-heat.m4a", wrap(hot), 96000)
        for name, (bpm, ev) in cadences().items():  # one-shots: six bars, so no tail folds round; cut where they fall silent
            y = master(render(bpm, 6, ev)[0])[0]
            block = np.sqrt(np.convolve((y ** 2).mean(axis=0), np.ones(4410) / 4410, "same"))
            y = y[:, : int(np.nonzero(block > block.max() * 1e-3)[0][-1]) + 4410] * (10 ** (-12 / 20) / block.max())  # as the sprite's clips: loudest tenth of a second at -12 dBFS
            y[:, -4410:] *= np.linspace(1, 0, 4410)
            write(ROOT / "public" / "sfx" / f"{name}.m4a", y, 96000)
        print(f"battle intro: {int(round(16 * 60 / made['battle'][0] * SR))} samples")  # music.js INTRO: the break, its last four bars
