// T-74 (2026-11-23): the home on an event's day (live.cjs patches 38회 마스터 to today). node home74.cjs <WxH> <theme>
const { open } = require("./lib.cjs"); const L = require("./live.cjs");
const [size = "390x844", theme = "dark"] = process.argv.slice(2);
(async () => {
  const [w, h] = size.split("x").map(Number);
  const t = await open({ w, h, theme, ...L.live({ start: "23:50" }) });
  await t.go("/"); await t.page.waitForTimeout(2500);
  console.log(size, theme, JSON.stringify(await t.page.evaluate(() => {
    const R = e => e && e.getBoundingClientRect(), r = n => Math.round(n);
    const board = document.querySelector(".ho-board"), screen = board && board.closest(".ho-screen, section, .pn");
    let panel = board; while (panel && !/(^| )(pn|inv)( |$)/.test(panel.className)) panel = panel.parentElement;
    const ps = panel && getComputedStyle(panel), inner = panel && R(panel).right - parseFloat(ps.paddingRight);
    const ink = [...board.querySelectorAll("*")].filter(e => e.children.length === 0).reduce((m, e) => Math.max(m, R(e).right), 0);
    const name = document.querySelector(".ho-name"), disp = document.querySelector(".ho-display");
    const rows = [...document.querySelectorAll(".ho-spec-row dt")].map(d => d.innerText);
    return { today: board.className, boardRight: r(R(board).right), boardInk: r(ink), panelInner: r(inner), marginRight: r(inner - ink), docW: document.documentElement.scrollWidth, vw: innerWidth,
      nameBottom: r(R(name).bottom), clockTop: r(R(board).top), displayTop: r(R(disp).top), gap: r(R(board).top - R(name).bottom), specRows: rows, label: document.querySelector(".ho-label")?.innerText.replace(/\n/g, "/") };
  })));
  await t.shot("T-74", "today");
  const bad = [...new Set(t.log.filter(l => /UNMOCKED|PAGEERROR|PATCH FAIL/.test(l)))]; if (bad.length) console.log(bad.join("\n").slice(0, 600));
  await t.browser.close(); process.exit(0);
})();
