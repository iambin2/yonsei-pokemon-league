"""Build public/sfx/sprite.m4a and src/pages/battle/sfxSprite.js, every sound of the battle (src/pages/battle/sfx.js).

The sounds are recorded ones in one family, so they sit with the music (orchestral rock, scripts/build-music.py):
Kenney's Impact, Sci-Fi, Interface and Digital Audio packs (kenney.nl, CC0) and Lentikula's Basic, Druid and Healing Spell
Impacts and Sci-Fi Weapon Shots (lentikula.itch.io, CC0). Each clip is cut from its silence, held to a length, brought to one
loudness (its loudest tenth of a second), and laid one after another in one file with a little silence between, so the battle
fetches and decodes one file. The packs are not kept in the repository; unpack them into one folder:

    <dir>/kenney-impact-sounds, kenney-sci-fi-sounds, kenney-interface-sounds, kenney-digital-audio  (the zips as unpacked)
    <dir>/lk-basic, lk-druid, lk-heal, lk-scifi                                                        (the archives as unpacked)
    <dir>/kenney-rpg-audio, kenney-ui-audio                                                            (kenney.nl, CC0)
    <dir>/rec/bsb/<id>.ogg      BigSoundBank (bigsoundbank.com, CC0, Joseph Sardin): https://bigsoundbank.com/UPLOAD/ogg/<id>.ogg
    <dir>/rec/oga/...           OpenGameArt CC0: rubberduck's breaking/falling/hit and water/splash/slime packs, BMacZero's spark,
                                IgnasD's ice and wind, artisticdude's swishes, StarNinjas' sword clashes (each zip unpacked in its name)

The sounds of every turn take the game's own shape (shaped(), scripts/data/sfx-shapes.json, measured 2026-11-21 from 포켓몬 챔피언스 footage
with the music taken out and from clean rips of the 3D games' hits: numbers only, the game's audio is never used).
Since 2026-11-20 every place was chosen by earshot (match to a description of the sound, realness) over 834 candidates and then by
the slot's meaning; most places hold two or three takes the battle plays in turn.

    python scripts/build-sfx.py <dir>
"""
import json
import sys
from pathlib import Path

import av
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SR = 44100
PAD = 2048  # silence at each end: an AAC file's first and last frames are not exact (scripts/build-music.py)
GAP = 2205  # 50 ms between clips
TARGET = 10 ** (-12 / 20)  # the RMS of each clip's loudest 100 ms

K_IMP = "kenney-impact-sounds/Audio/"
K_SCI = "kenney-sci-fi-sounds/Audio/"
K_UI = "kenney-interface-sounds/Audio/"
K_DIG = "kenney-digital-audio/Audio/"
LK = {
    "fire": "lk-basic/Fire Spell Impacts/Fire Spell Impact {}.wav",
    "ice": "lk-basic/Ice Spell Impacts/Ice Spell Impact {}.wav",
    "bolt": "lk-basic/Lightning Spell Impacts/Lightning Spell Impact {}.wav",
    "water": "lk-basic/Water Spell Impacts/Water Spell Impact {}.wav",
    "earth": "lk-druid/Earth Spell Impacts/Earth Spell Impact {}.wav",
    "plant": "lk-druid/Plant Spell Impacts/Plant Spell Impact {}.wav",
    "wind": "lk-druid/Wind Spell Impacts/Wind Spell Impact {}.wav",
    "heal": "lk-heal/Impacts/Healing Spell Impact {}.wav",
}


def lk(kind, n):
    return LK[kind].format(n)


# id: (source, longest seconds, options); options: "rev" reversed, "gain" in dB after levelling
CLIPS = {
    # the keys, the clock, the turn, the result
    "select": (['kenney-ui-audio/Audio/switch24.ogg', 'rec/bsb/0026.ogg@0.0', 'kenney-ui-audio/Audio/rollover5.ogg'], 0.25, {}),
    "tick": (['rec/bsb/0026.ogg@0.0', 'rec/oga/sfx_breaking_and_falling/bfh1_hit_09.ogg'], 0.12, {}),
    "tickHi": (['kenney-rpg-audio/Audio/metalClick.ogg', 'kenney-ui-audio/Audio/switch12.ogg'], 0.12, {'gain': 2}),
    "turn": (['rec/oga/sfx_breaking_and_falling/bfh1_glass_hit_01.ogg', 'kenney-rpg-audio/Audio/beltHandle1.ogg'], 0.5, {'gain': -4}),
    "fail": (['kenney-rpg-audio/Audio/footstep04.ogg'], 0.3, {'gain': -3}),
    "plate": (['rec/bsb/0052.ogg', 'kenney-rpg-audio/Audio/metalClick.ogg'], 0.5, {'gain': -5}),
    "plate2": (['kenney-rpg-audio/Audio/clothBelt2.ogg'], 0.4, {'gain': -5}),
    "glint": (['rec/oga/sfx_breaking_and_falling/bfh1_metal_hit_05.ogg', 'rec/oga/sfx_breaking_and_falling/bfh1_glass_hit_01.ogg'], 0.4, {'gain': -4}),
    "bloop": (['kenney-impact-sounds/Audio/impactPunch_medium_002.ogg', 'rec/oga/sfx_breaking_and_falling/bfh1_hit_08.ogg'], 0.4, {'gain': -4}),
    # blows
    "punch": (['kenney-impact-sounds/Audio/impactPunch_medium_000.ogg', 'kenney-impact-sounds/Audio/impactPunch_medium_001.ogg', 'kenney-impact-sounds/Audio/impactPunch_medium_004.ogg'], 0.3, {}),
    "punch2": (['kenney-rpg-audio/Audio/bookClose.ogg', 'kenney-impact-sounds/Audio/impactPunch_medium_000.ogg'], 0.3, {}),
    "punchH": (['kenney-impact-sounds/Audio/impactPunch_heavy_000.ogg', 'kenney-impact-sounds/Audio/impactPunch_heavy_003.ogg', 'kenney-impact-sounds/Audio/impactPunch_heavy_004.ogg'], 0.4, {}),
    "punchH2": (K_IMP + "impactPunch_heavy_001.ogg", .4, {}),
    "punchD": (['kenney-impact-sounds/Audio/impactPunch_heavy_002.ogg', 'kenney-rpg-audio/Audio/bookClose.ogg'], 0.4, {}),
    "soft": (['kenney-rpg-audio/Audio/cloth3.ogg', 'kenney-rpg-audio/Audio/dropLeather.ogg'], 0.3, {}),
    "softH": (['rec/bsb/2452.ogg', 'rec/bsb/2453.ogg', 'rec/bsb/2454.ogg'], 0.5, {}),
    "woodL": (['rec/bsb/0026.ogg@1.3', 'rec/bsb/0026.ogg@4.3'], 0.15, {}),
    "plank": (['rec/bsb/2205.ogg', 'rec/bsb/1300.ogg'], 0.4, {}),
    "plate3": (K_IMP + "impactPlate_heavy_000.ogg", .45, {}),
    "metalL": (['rec/oga/sword_clash_-_starninjas_0/sword_clash.8.ogg', 'kenney-rpg-audio/Audio/metalClick.ogg'], 0.35, {}),
    "metalL2": (['kenney-rpg-audio/Audio/beltHandle2.ogg', 'rec/oga/sword_clash_-_starninjas_0/sword_clash.6.ogg'], 0.35, {}),
    "metalM": (['kenney-rpg-audio/Audio/handleCoins.ogg', 'kenney-rpg-audio/Audio/handleCoins2.ogg'], 0.4, {}),
    "metalH": (['rec/oga/sfx_breaking_and_falling/bfh1_metal_falling_02.ogg', 'kenney-rpg-audio/Audio/metalPot1.ogg', 'kenney-rpg-audio/Audio/metalPot3.ogg'], 0.5, {}),
    "bell": (K_IMP + "impactBell_heavy_002.ogg", .6, {}),
    "tin": (['rec/bsb/0052.ogg', 'kenney-rpg-audio/Audio/beltHandle2.ogg'], 0.25, {}),
    "mining": (['rec/oga/sfx_breaking_and_falling/bfh1_rock_breaking_01.ogg', 'rec/oga/sfx_breaking_and_falling/bfh1_rock_breaking_02.ogg', 'rec/oga/sfx_breaking_and_falling/bfh1_rock_breaking_03.ogg'], 0.7, {}),
    "mining2": (['rec/bsb/1022.ogg@15.9', 'rec/oga/sfx_breaking_and_falling/bfh1_rock_falling_03.ogg'], 0.7, {}),
    "glassH": (['rec/bsb/1121.ogg', 'rec/bsb/0148.ogg'], 0.7, {}),
    "glassM": (['rec/bsb/0148.ogg', 'rec/bsb/0387.ogg'], 0.5, {}),
    "glassL": (['rec/oga/sfx_breaking_and_falling/bfh1_glass_hit_01.ogg', 'rec/oga/sfx_breaking_and_falling/bfh1_metal_hit_05.ogg'], 0.35, {}),
    # machines and power
    "field": (K_SCI + "forceField_001.ogg", .7, {}),
    "field2": (K_SCI + "forceField_002.ogg", .7, {}),
    "field3": (K_SCI + "forceField_004.ogg", .7, {}),
    "boom": (K_SCI + "explosionCrunch_004.ogg", 2, {}),
    "crunch": (K_SCI + "explosionCrunch_000.ogg", .9, {}),
    "lowBoom": (K_SCI + "lowFrequency_explosion_000.ogg", 1.2, {}),
    "lamp": (['kenney-ui-audio/Audio/switch6.ogg', 'kenney-ui-audio/Audio/switch32.ogg'], 0.4, {}),
    "slime": (['rec/oga/water-splash-slime-sfx/slime_06.ogg', 'rec/oga/water-splash-slime-sfx/slime_03.ogg', 'rec/oga/water-splash-slime-sfx/splash_06.ogg'], 0.6, {}),
    "ooze": (['rec/oga/water-splash-slime-sfx/loop_bubbles_02.ogg@0.0', 'rec/oga/water-splash-slime-sfx/loop_bubbles_02.ogg@2.5'], 1.2, {}),
    "rumble": (K_SCI + "spaceEngineLow_000.ogg", 3, {}),
    "hum": (K_SCI + "spaceEngineSmall_000.ogg", 3, {"gain": -3}),
    "flame": (K_SCI + "thrusterFire_003.ogg", 3, {"gain": -3}),
    # the spells: each type's matter, the field's weather, healing
    "fire": (['rec/bsb/1340.ogg@0.0', 'lk-basic/Fire Spell Impacts/Fire Spell Impact 3.wav', 'lk-basic/Fire Spell Impacts/Fire Spell Impact 4.wav'], 1.2, {}),
    "burn": (['rec/bsb/3322.ogg@27.7', 'rec/bsb/3322.ogg@13.2'], 0.9, {}),
    "ice": (['lk-basic/Ice Spell Impacts/Ice Spell Impact 1.wav', 'rec/oga/sfx_breaking_and_falling/bfh1_glass_breaking_01.ogg', 'lk-basic/Ice Spell Impacts/Ice Spell Impact 5.wav'], 1, {}),
    "iceL": (['rec/bsb/2205.ogg', 'rec/bsb/2206.ogg', 'rec/bsb/2208.ogg'], 2, {}),
    "frost": (['rec/oga/IceShatters_0/IceShatters/LedasLuzta33.ogg', 'rec/bsb/2205.ogg'], 1, {}),
    "bolt": (['lk-basic/Lightning Spell Impacts/Lightning Spell Impact 1.wav', 'lk-basic/Lightning Spell Impacts/Lightning Spell Impact 4.wav'], 1.4, {}),
    "boltL": (lk("bolt", 3), 2.4, {}),
    "spark": (['rec/bsb/0952.ogg@2.3', 'rec/oga/spark.wav'], 0.7, {}),
    "water": (['rec/bsb/1531.ogg', 'rec/bsb/1529.ogg', 'rec/bsb/1532.ogg'], 1.3, {}),
    "rain": (['rec/bsb/1289.ogg@35.3', 'rec/oga/water-splash-slime-sfx/loop_rain.ogg@3.9'], 2, {}),
    "earth": (['rec/oga/sfx_breaking_and_falling/bfh1_rock_falling_03.ogg', 'rec/bsb/1022.ogg@15.9', 'lk-druid/Earth Spell Impacts/Earth Spell Impact 2.wav'], 1, {}),
    "earthL": (lk("earth", 5), 2, {}),
    "plant": (['rec/bsb/2889.ogg@8.9', 'rec/bsb/1299.ogg@2.3'], 1.4, {}),
    "wind": (['rec/oga/wind/wind/Wind3.ogg', 'rec/bsb/0152.ogg@21.9'], 2, {}),
    "whoosh": (['rec/oga/swishes/swishes/swish-5.wav', 'rec/oga/swishes/swishes/swish-7.wav', 'rec/oga/swishes/swishes/swish-6.wav'], 1, {}),
    "whoosh2": (['rec/oga/swishes/swishes/swish-5.wav', 'rec/oga/swishes/swishes/swish-7.wav', 'rec/oga/swishes/swishes/swish-6.wav'], 1, {}),
    "breeze": (['rec/oga/wind/wind/Wind.ogg@0.3'], 1.4, {'gain': -2}),
    "swish": (['rec/bsb/0128.ogg', 'rec/oga/swishes/swishes/swish-11.wav'], 0.5, {}),
    "shine": (['lk-heal/Impacts/Healing Spell Impact 5.wav', 'lk-heal/Impacts/Healing Spell Impact 6.wav', 'lk-heal/Impacts/Healing Spell Impact 12.wav'], 0.7, {}),
    "chime": (lk("heal", 9), 1, {}),
    "rise": (lk("heal", 4), .7, {}),
    "fall": (lk("heal", 4), .7, {"rev": True}),
    "sparkle": (lk("heal", 6), 1.6, {}),
    "bright": (lk("heal", 11), 2, {}),
    "veil": (lk("heal", 12), 1, {}),
    "dream": (lk("heal", 13), 1.2, {}),
    "morph": (lk("heal", 14), 1.2, {}),
    "gather": (lk("heal", 15), .8, {}),
    "wish": (lk("heal", 2), 1.2, {}),
    "beam": ("lk-scifi/Laser Beam 1.wav", 3, {"gain": -2}),
    # the game's own shapes (shaped above) on real recordings' grain: the sounds of every turn
    "open": (["rec/bsb/1289.ogg@35.3", "rec/bsb/0153.ogg@11.6"], 0.8, {"shape": "sendout"}),
    "recallS": (["rec/bsb/1289.ogg@35.3", "rec/bsb/0153.ogg@11.6"], 1.3, {"shape": "recall"}),
    # the footage's faints are under the music; the game's faint is the recall's falling band sweeping back (measured 2026-11-07)
    "faintS": (["rec/bsb/1289.ogg@35.3", "rec/bsb/0153.ogg@11.6"], 1.4, {"shape": "recall"}),
    "hitN": (["lk-druid/Earth Spell Impacts/Earth Spell Impact 4.wav", "kenney-sci-fi-sounds/Audio/explosionCrunch_000.ogg"], 0.9, {"shape": "hitNormal"}),
    "hitS": (["rec/oga/sfx_breaking_and_falling/bfh1_falling_04.ogg"], 1.4, {"shape": "hitSuper"}),
    # not very effective: the nearest recordings as they are came closer to the game's than any shaped (CLAP 0.65)
    "hitR": (["rec/oga/sfx_breaking_and_falling/bfh1_breaking_03.ogg", "rec/oga/sfx_breaking_and_falling/bfh1_hit_06.ogg"], 0.4, {}),
    "knockS": (["kenney-rpg-audio/Audio/doorClose_3.ogg", "rec/bsb/1022.ogg@1.1"], 0.6, {"shape": "knock"}),
    # 2026-11-21: clean rips of the 3D games' stat, healing, Reflect and Legends Z-A's Mega Evolution, and the newest part of each
    # weather move's comparison with its music taken out
    "upS": (["rec/bsb/0153.ogg@11.6"], 1.4, {"shape": "statUp"}),
    "downS": (["rec/bsb/0153.ogg@11.6"], 1.4, {"shape": "statDown"}),
    "healS": (["lk-heal/Impacts/Healing Spell Impact 5.wav"], 2.2, {"shape": "heal"}),
    "screenS": (["lk-heal/Impacts/Healing Spell Impact 5.wav"], 2.8, {"shape": "screen"}),
    "megaA": (["lk-heal/Impacts/Healing Spell Impact 5.wav"], 2, {"shape": "megaStart"}),
    "megaB": (["rec/bsb/0153.ogg@11.6"], 1.8, {"shape": "megaEnd"}),
    "rainS": (["rec/bsb/0153.ogg@11.6"], 1.7, {"shape": "rain"}),
    "sunS": (["lk-heal/Impacts/Healing Spell Impact 5.wav"], 1.7, {"shape": "sun"}),
    "sandS": (["rec/bsb/0153.ogg@11.6"], 1.7, {"shape": "sand"}),
    "pistol": ("lk-scifi/Laser Pistol 1.wav", .5, {}),
}


def decode(path):
    src = av.open(str(path))
    resample = av.AudioResampler(format="fltp", layout="stereo", rate=SR)
    parts = [f.to_ndarray() for frame in src.decode(audio=0) for f in resample.resample(frame)]
    parts += [f.to_ndarray() for f in resample.resample(None)]
    return np.concatenate(parts, axis=1).astype(np.float32)


SHAPES = json.loads((ROOT / "scripts" / "data" / "sfx-shapes.json").read_text())


def shaped(x, name):
    """The texture x (a real recording) given the game's own shape for `name` (scripts/data/sfx-shapes.json: 포켓몬 챔피언스's
    sound measured from footage and clean rips, 1/3-octave band levels every 10 ms, numbers only): frame by frame each band is
    brought to the shape's level, so the result moves through time and frequency as the game's does while its grain stays the
    recording's (2026-11-20, the owner: "효과음만 포켓몬 챔피언스 원작과 아주 비슷하게")."""
    edges = np.array(SHAPES["edges_hz"])
    shape = np.array(SHAPES["shapes"][name], dtype=np.float64)
    n, hop = 2048, int(SHAPES["hop_s"] * SR)
    frames = len(shape)
    need = frames * hop + n
    x = np.tile(x, (1, int(np.ceil(need / x.shape[1])) + 1))[:, :need]
    win = np.hanning(n)
    f = np.fft.rfftfreq(n, 1 / SR)
    centres = np.sqrt(edges[:-1] * edges[1:])
    which = [(f >= edges[k]) & (f < edges[k + 1]) for k in range(len(edges) - 1)]
    out = np.zeros((x.shape[0], need))
    norm = np.zeros(need)
    for i in range(frames):
        a = i * hop
        spec = np.fft.rfft(x[:, a:a + n] * win, axis=1)
        power = (np.abs(spec) ** 2).mean(axis=0)
        have = np.array([10 * np.log10(power[w].sum() + 1e-12) for w in which])
        g = np.clip(shape[i] - have, -60, 40)
        gain = 10 ** (np.interp(np.log2(np.maximum(f, 20)), np.log2(centres), g) / 20)
        gain[f < edges[0] * 0.7] *= 0.1
        out[:, a:a + n] += np.fft.irfft(spec * gain, n, axis=1) * win
        norm[a:a + n] += win ** 2
    y = out / np.maximum(norm, 1e-3)
    return y[:, : frames * hop].astype(np.float32)


def clip(x, longest, rev=False, gain=0):
    if rev:
        x = x[:, ::-1]
    mono = np.abs(x).max(axis=0)
    peak = mono.max()
    on = np.where(mono > peak * 0.02)[0]
    x = x[:, max(0, on[0] - 64): on[-1] + 1]
    n = min(x.shape[1], int(longest * SR))
    x = x[:, :n].copy()
    fade = min(n // 3, int(0.06 * SR))
    x[:, n - fade:] *= np.linspace(1, 0, fade) ** 2
    x[:, :32] *= np.linspace(0, 1, 32)
    # loudness: the RMS of the loudest 100 ms
    win = int(0.1 * SR)
    sq = (x ** 2).mean(axis=0)
    loud = np.sqrt(np.convolve(sq, np.ones(win) / win, mode="valid").max()) if n > win else np.sqrt(sq.mean())
    x = x * (TARGET / max(loud, 1e-6)) * 10 ** (gain / 20)
    top = np.abs(x).max()
    return x * (0.97 / top) if top > 0.97 else x


def main():
    src = Path(sys.argv[1])
    parts, table, at = [np.zeros((2, PAD), np.float32)], {}, PAD
    # a clip may name several takes (a list of files): the battle plays one of them at random each time, so a run of hits never
    # repeats one sound (2026-11-20). Each place is [start, length] of a take, in samples
    for name, (files, longest, opt) in CLIPS.items():
        table[name] = []
        for file in [files] if isinstance(files, str) else files:
            # "file@seconds": a take inside a long recording, from that second for the clip's 2 s window
            file, _, start = file.partition("@")
            x = decode(src / file)
            if start:
                x = x[:, int(float(start) * SR): int((float(start) + 2) * SR)]
            if opt.get("shape"):
                x = shaped(x, opt["shape"])
            x = clip(x, longest, opt.get("rev", False), opt.get("gain", 0))
            table[name].append([at, x.shape[1]])
            parts += [x, np.zeros((2, GAP), np.float32)]
            at += x.shape[1] + GAP
    parts.append(np.zeros((2, PAD), np.float32))
    whole = np.concatenate(parts, axis=1).astype(np.float32)
    out_path = ROOT / "public" / "sfx" / "sprite.m4a"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out = av.open(str(out_path), "w", format="ipod")
    stream = out.add_stream("aac", rate=SR)
    stream.bit_rate = 128000
    stream.layout = "stereo"
    for i in range(0, whole.shape[1], 1024):
        frame = av.AudioFrame.from_ndarray(np.ascontiguousarray(whole[:, i:i + 1024]), format="fltp", layout="stereo")
        frame.sample_rate = SR
        for packet in stream.encode(frame):
            out.mux(packet)
    for packet in stream.encode(None):
        out.mux(packet)
    out.close()
    # length: the sprite's own samples; a decoder may add the encoder's 1024 at the start (sfx.js counts from the end)
    meta = {"rate": SR, "length": whole.shape[1], "clips": table}
    (ROOT / "src" / "pages" / "battle" / "sfxSprite.js").write_text(
        "// written by scripts/build-sfx.py: where each clip of public/sfx/sprite.m4a starts and how long it is, in samples\n"
        f"export default {json.dumps(meta, separators=(',', ':'))};\n")
    print(f"{len(table)} clips, {sum(len(v) for v in table.values())} takes, {whole.shape[1] / SR:.1f} s, {out_path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
