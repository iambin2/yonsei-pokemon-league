# cardlum.py <rec dir> [y0 y1]: mean luminance of the cards' band in every recorded frame, printed where it changes by more than 3
# (a card lit twice shows as up, down, up). Default band: 390x844's cards, y 560..760.
import sys, os
from PIL import Image, ImageStat
d = sys.argv[1]; y0, y1 = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (560, 760)
last = None
for f in sorted(x for x in os.listdir(d) if x.startswith("frame-")):
    im = Image.open(os.path.join(d, f)).convert("L")
    w, h = im.size; sy = h / 844
    v = ImageStat.Stat(im.crop((int(20 * sy), int(y0 * sy), int(370 * sy), int(y1 * sy)))).mean[0]
    if last is None or abs(v - last) > 3: print(f[6:11], round(v, 1)); last = v
