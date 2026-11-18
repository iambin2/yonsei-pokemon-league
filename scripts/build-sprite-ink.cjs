// The ink of every Pokémon picture, read once here instead of on every visitor's first sight of it (docs/BATTLE_FRAMES.md 3장:
// each picture drawn and read in the page held frames of 20 to 100 ms at a phone's speed). It runs the page's own functions
// (src/components/common/inkCentre.js) in Chrome on public/sprites/pokemon, so the table holds exactly what the page would measure.
//   node scripts/build-sprite-ink.cjs   (rerun after scripts/build-sprites.py adds or replaces pictures)
// Writes src/data/sprite-ink.json: { slug: [centre x, centre y, feet x, feet y, box x0, y0, x1, y1] }: the centre and the feet in
// percent of the picture's box (inkCentre.js), and the box of its ink in 64ths of the picture as the battle stage reads it
// (gl.js inkBox); null where a picture has no ink. Playwright is taken from the npx cache as scripts/measure-frames.cjs does.
const fs = require("fs"), path = require("path"), http = require("http");
function playwright() {
  try { return require("playwright"); } catch { /* not installed */ }
  const cache = path.join(process.env.LOCALAPPDATA || path.join(require("os").homedir(), ".npm"), "npm-cache", "_npx");
  for (const dir of fs.existsSync(cache) ? fs.readdirSync(cache) : []) {
    const p = path.join(cache, dir, "node_modules", "playwright");
    if (fs.existsSync(p)) return require(p);
  }
  throw new Error("playwright not found: run npx playwright --version once");
}
const ROOT = path.resolve(__dirname, ".."), DIR = path.join(ROOT, "public", "sprites", "pokemon");
const TYPES = { ".webp": "image/webp", ".js": "text/javascript", ".html": "text/html" };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const file = url === "/" ? null : path.join(ROOT, url.startsWith("/sprites/") ? "public" : "", url);
  if (!file || !file.startsWith(ROOT) || !fs.existsSync(file)) {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end("<!doctype html><title>ink</title>");
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const slugs = fs.readdirSync(DIR).filter(f => f.endsWith(".webp")).map(f => f.slice(0, -5)).sort();
  const { chromium } = playwright();
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage();
  await page.goto(base + "/");
  const table = await page.evaluate(async slugs => {
    const { inkShift, inkFeet } = await import("/src/components/common/inkCentre.js");
    // the page's own reads (centreInk at 48, standInk at 256 with its contain correction), on the same canvases
    const read = (img, size) => {
      const g = Object.assign(document.createElement("canvas"), { width: size, height: size }).getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0, size, size);
      const rgba = g.getImageData(0, 0, size, size).data, alpha = new Uint8Array(size * size);
      for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
      return alpha;
    };
    const r1 = x => Math.round(x * 10) / 10, r2 = x => Math.round(x * 100) / 100;
    const out = {};
    for (const slug of slugs) {
      const img = new Image();
      img.src = `/sprites/pokemon/${slug}.webp`;
      try { await img.decode(); } catch { continue; }
      const nw = img.naturalWidth, nh = img.naturalHeight;
      const c = inkShift(read(img, 48), 48, 48), f = inkFeet(read(img, 256), 256, 256);
      // gl.js inkBox: the box of the pixels over 40 at 64 by 64
      const al = read(img, 64); let x0 = 64, y0 = 64, x1 = 0, y1 = 0;
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (al[y * 64 + x] > 40) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      out[slug] = c && f ? [r1(c[0]), r1(c[1]), r2(f[0] * Math.min(1, nw / nh)), r2(f[1] * Math.min(1, nh / nw)), ...(x1 > x0 ? [x0, y0, x1 + 1, y1 + 1] : [0, 0, 64, 64])] : null;
    }
    return out;
  }, slugs);
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(ROOT, "src", "data", "sprite-ink.json"), JSON.stringify(table) + "\n");
  console.log(`sprite-ink.json: ${Object.keys(table).length} of ${slugs.length} pictures`);
})();
