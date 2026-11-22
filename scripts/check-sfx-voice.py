"""Does any effect sound read as a creature's voice? Writes scripts/data/sfx-voice.json, which tests/battleSfx.test.mjs holds the sprite to.

A sound the battle plays must never be heard as a Pokémon crying (2026-11-22, the owner: "울음소리가 괴물처럼 들리는 문제가 계속해서",
"원본 울음소리가 안 나오고 이상한 울음소리가 나오는"). Sounds given the game's shape (build-sfx.py shaped(): band levels every 10 ms
measured from footage) carried the voice-like movement of what sounded in that footage, and read as a cry more strongly than the real
cries do: the stat sounds, poison, the sun, the sand, a screen. So did some plain recordings (creaking ice). This listens to every take
of public/sfx/sprite.m4a with earshot: three wordings of "a creature's voice", each as a z among earshot's vocabulary and as a forced
choice against what an effect should be. A take is voiced when its mean z is 2.3 or more and the forced choice goes to the voice 45% of
the time or more (a real cry reads 2.8 to 3.5 and 0.7 to 1; the margin is on purpose). Four real cries are scored too and must come out voiced, or the check proves nothing.

    <earshot's python> scripts/check-sfx-voice.py      # needs ffmpeg on PATH; exits 1 if a take is voiced
"""
import json, os, re, subprocess, sys, tempfile
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from earshot import api

ROOT = Path(__file__).resolve().parent.parent
VOICE = ["an animal or a monster growling, roaring or crying out", "a creature's voice, a beast's cry", "a dinosaur or a dragon roaring"]
ALTS = ["an impact, a hit or a thud", "a whoosh of air", "a chime, a bell or a sparkle", "an electronic synthesizer sound effect", "noise, wind, rain or fire"]
Z, P = 2.3, .45


def reading(path):
    got = [api.match(str(path), q, alts=ALTS) for q in VOICE]
    z, p = float(np.mean([g["z"] for g in got])), float(np.mean([g["p_vs_alts"] for g in got]))
    return {"z": round(z, 2), "p": round(p, 2), "voiced": bool(z >= Z and p >= P)}


if __name__ == "__main__":
    spr = json.loads(re.search(r"export default (\{.*\})", (ROOT / "src/pages/battle/sfxSprite.js").read_text(encoding="utf-8"), re.S).group(1))
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(ROOT / "public/sfx/sprite.m4a"), "-f", "f32le", "-ac", "1", "-ar", "44100", "-"], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32); lead = max(0, len(x) - spr["length"])
    tmp = Path(tempfile.mkdtemp())
    takes = {}
    for cid, cuts in spr["clips"].items():
        for i, (a, n) in enumerate(cuts):
            wavfile.write(tmp / "take.wav", 44100, (np.clip(x[lead + a: lead + a + n], -1, 1) * 32767).astype(np.int16))
            takes[f"{cid}[{i}]"] = {"at": a, "n": n, **reading(tmp / "take.wav")}
    cries = {n: reading(ROOT / "public" / "cries" / f"{n}.m4a") for n in (6, 25, 212, 445)}
    assert all(c["voiced"] for c in cries.values()), f"a real cry is not heard as a voice, so the check proves nothing: {cries}"
    (ROOT / "scripts/data/sfx-voice.json").write_text(json.dumps({"length": spr["length"], "z": Z, "p": P, "cries": cries, "takes": takes}, indent=1) + "\n", encoding="utf-8")
    voiced = {k: v for k, v in takes.items() if v["voiced"]}
    for k, v in sorted(takes.items(), key=lambda kv: -kv[1]["z"])[:24]:
        print(("VOICED  " if v["voiced"] else "        ") + f"{k:14s} z {v['z']:.2f}  p {v['p']:.2f}")
    print("real cries:", {n: (c["z"], c["p"]) for n, c in cries.items()})
    print(f"{len(voiced)} of {len(takes)} takes read as a voice")
    sys.exit(1 if voiced else 0)
