const { open } = require("./lib.cjs"); const L = require("./live.cjs");
(async () => {
  // 1) the three-cell countdown
  process.env.HELD = "2027-04-10";
  let t = await open({ w: 390, h: 844, theme: "dark", mocks: { streak_month_tops: [] }, patches: [{ re: /tbl:site_data/, fn: rows => { const a = rows[0].value.announcements.find(x => x.id === "mgcf6zf"); a.form.closesAt = "2026-11-01T00:00"; a.form.eventDraft.heldOn = "2027-04-10"; return rows; } }] });
  await t.go("/?"); console.log(await t.page.evaluate(() => { const s = document.querySelector(".ho-days"); return { label: s.getAttribute("aria-label"), html: s.outerHTML.replace(/<svg[\s\S]*?<\/svg>/g, "<svg/>").slice(0, 700), w: s.getBoundingClientRect().width, kids: [...s.children].map(c => c.className + " " + Math.round(c.getBoundingClientRect().width) + " " + (c.getAttribute("data-d") || c.textContent)) }; }));
  await t.shot("HOME-03", "closed-3digits"); await t.browser.close();
  // 2) the winner by a bye, and the entry rows at 1920
  t = await open({ w: 1920, h: 1080, theme: "dark", admin: true, ...L.live({ battle: true }) });
  await t.page.evaluate(u => { history.pushState({}, "", u); dispatchEvent(new PopStateEvent("popstate")); }, "/?view=bracket&eventId=" + L.EV); await t.page.waitForTimeout(3500);
  await t.press("M5"); console.log(await t.shot("ADM-BRK-04", "decided"));
  console.log(await t.page.evaluate(() => { const css = (e, p) => getComputedStyle(e)[p]; const rows = [...document.querySelectorAll(".mb-row")].filter(r => /김원의|정두호|김성빈/.test(r.innerText)).slice(0, 6).map(r => r.className + " | " + r.innerText.replace(/\n/g, " ") + " | name " + css(r.querySelector(".mb-name"), "color") + " bg " + css(r, "backgroundColor") + " op " + css(r.querySelector(".mb-name"), "opacity"));
    const b = s => [...document.querySelectorAll(s)].filter(e => e.offsetParent).slice(0, 8).map(e => { const r = e.getBoundingClientRect(); return (e.innerText || e.getAttribute("aria-label") || "").replace(/\n/g, "/").slice(0, 24) + " ." + String(e.className).slice(0, 34) + " " + Math.round(r.x) + "," + Math.round(r.y) + " " + Math.round(r.width) + "x" + Math.round(r.height); });
    const sec = [...document.querySelectorAll("h2, .sec-head")].find(e => /결과 입력/.test(e.innerText)); const root = sec?.closest("section") || sec?.parentElement;
    return { rows, root: root && root.className, kids: root && [...root.querySelectorAll("*")].filter(e => e.offsetParent && /btn|stepper|pick|row|re-|rs-/.test(String(e.className))).slice(0, 26).map(e => { const r = e.getBoundingClientRect(); return (e.innerText || e.getAttribute("aria-label") || "").replace(/\n/g, "/").slice(0, 20) + " ." + String(e.className).slice(0, 40) + " " + Math.round(r.x) + "," + Math.round(r.y) + " " + Math.round(r.width) + "x" + Math.round(r.height); }), tbl: b(".mb-table, [class*=mb-t]"), lamp: b(".mb-lamp") }; }));
  await t.browser.close(); process.exit(0);
})();
