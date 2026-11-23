# sheet.py <ID> <name> [w=390]: the dark and light shots of one state side by side, into p/sheets/
import sys, os
from PIL import Image
i, n = sys.argv[1], sys.argv[2]; w = sys.argv[3] if len(sys.argv) > 3 else "390"
import os
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "docs", "visual-audit", "shots", i)
fs = [f for f in sorted(os.listdir(d)) if f.startswith(n + "-" + w + "x")]
ims = [Image.open(os.path.join(d, f)) for f in fs]
H = min(max(im.height for im in ims), 1900)
out = Image.new("RGB", (sum(im.width for im in ims) + 8 * (len(ims) - 1), H), (128, 0, 128))
x = 0
for im in ims: out.paste(im.crop((0, 0, im.width, min(im.height, H))), (x, 0)); x += im.width + 8
os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)), "sheets"), exist_ok=True)
p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sheets", f"{i}-{n}-{w}.png"); out.save(p); print(p, out.size)
