"""Albert Sans for the site: the Latin subset, with every digit as wide as the zero (DESIGN.md "Typesetting": every digit is tabular).

Albert Sans has no `tnum` feature, so `font-variant-numeric: tabular-nums` draws nothing with it. This gives the default digits
one advance, the zero's at every weight, each digit centred in it, in the variable file (outlines and their gvar deltas shifted,
the advance's phantom points set to the zero's, HVAR dropped so the advance is read from gvar). OFL 1.1, no reserved name.

  python scripts/build-albert-sans.py <AlbertSans[wght].ttf from github.com/google/fonts ofl/albertsans>

Writes public/fonts/albert-sans-latin-wght.woff2 with the code points the shipped file already carries.
"""
import sys
from fontTools.ttLib import TTFont
from fontTools import subset

OUT = "public/fonts/albert-sans-latin-wght.woff2"
DIGITS = "0123456789"


def main(src):
    keep = sorted(TTFont(OUT).getBestCmap())  # the shipped file's code points, before it is overwritten
    f = TTFont(src)
    glyf, hmtx, gvar = f["glyf"], f["hmtx"], f["gvar"].variations
    cmap = f.getBestCmap()
    zero = cmap[ord("0")]
    adv0 = hmtx[zero][0]

    def adv_deltas(name):
        # the advance's change at each tuple: the right phantom point's x delta less the left one's
        out = {}
        for tv in gvar.get(name, []):
            c = tv.coordinates
            l, r = c[-4], c[-3]
            out[repr(sorted(tv.axes.items()))] = (r[0] if r else 0) - (l[0] if l else 0)
        return out

    zero_d = adv_deltas(zero)
    for d in DIGITS:
        name = cmap[ord(d)]
        if name == zero:
            continue
        g = glyf[name]
        adv, lsb = hmtx[name]
        shift = round((adv0 - adv) / 2)
        coords, ends, _ = g.getCoordinates(glyf)
        coords.translate((shift, 0))
        g.coordinates = coords
        g.recalcBounds(glyf)
        hmtx[name] = (adv0, g.xMin)
        own_d = adv_deltas(name)
        orig = list(coords) + [(0, 0)] * 4
        for tv in gvar.get(name, []):
            key = repr(sorted(tv.axes.items()))
            assert key in zero_d, f"{name}: the zero has no tuple {key}"
            tv.calcInferredDeltas(orig, list(ends))  # spell out every point, so the shift reaches the ones gvar left to inference
            move = (zero_d[key] - own_d.get(key, 0)) / 2
            c = tv.coordinates
            n = len(c) - 4
            for i in range(n):
                x, y = c[i]
                c[i] = (round(x + move), round(y))
            c[n] = (0, round(c[n][1]))
            c[n + 1] = (round(zero_d[key]), round(c[n + 1][1]))
            c[n + 2:] = [(round(x), round(y)) for x, y in c[n + 2:]]
    del f["HVAR"]

    opts = subset.Options()
    opts.flavor = "woff2"
    opts.notdef_outline = True
    s = subset.Subsetter(opts)
    s.populate(unicodes=keep)
    s.subset(f)
    f.flavor = "woff2"
    f.save(OUT)
    print(f"{OUT}: {len(keep)} code points, digits {adv0} wide")


if __name__ == "__main__":
    main(sys.argv[1])
