# recsheet.py <dir> <every ms>: a contact sheet of the recorded frames, one every <every> ms, eight across at half size
import sys, os
from PIL import Image, ImageDraw
d, every = sys.argv[1], int(sys.argv[2])
fs = sorted(f for f in os.listdir(d) if f.startswith("frame-"))
ts = [int(f[6:11]) for f in fs]; pick = []
for at in range(0, ts[-1] + every, every):
    k = max((i for i, t in enumerate(ts) if t <= at), default=0)
    if not pick or pick[-1] != k: pick.append(k)
ims = [Image.open(os.path.join(d, fs[k])) for k in pick]
w, h = ims[0].size; tw, th = w // 2, h // 2; cols = 8; rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (tw + 4), rows * (th + 16)), (128, 0, 128)); dr = ImageDraw.Draw(sheet)
for n, (k, im) in enumerate(zip(pick, ims)):
    x, y = (n % cols) * (tw + 4), (n // cols) * (th + 16); sheet.paste(im.resize((tw, th)), (x, y + 14)); dr.text((x + 2, y + 1), f"{ts[k]} ms", fill=(255, 255, 255))
sheet.save(os.path.join(d, "sheet.png"))
