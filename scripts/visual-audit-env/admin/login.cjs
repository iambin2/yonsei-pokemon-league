// ADM-01 two login errors and ADM-02 the session-expired toast.  node login.cjs <WxH> <dark|light>
const { open } = require("./lib.cjs"); const [size = "1440x900", theme = "dark"] = process.argv.slice(2); const [w, h] = size.split("x").map(Number);
const say = t => t.page.evaluate(() => [...document.querySelectorAll("[role=dialog] *, .toast, [class*=toast], [role=status], [role=alert]")].filter(e => e.offsetParent && e.children.length === 0 && e.innerText.trim()).map(e => { const r = e.getBoundingClientRect(); return e.innerText.trim().slice(0, 50) + " ." + String(e.className).slice(0, 30) + " " + Math.round(r.x) + "," + Math.round(r.y) + " " + Math.round(r.width) + "x" + Math.round(r.height) + " " + getComputedStyle(e).color; }).join("\n"));
(async () => {
  for (const fail of [true, "net"]) { const t = await open({ w, h, theme, loginFail: fail, mocks: { streak_month_tops: [] } }); await t.login(); console.log(await t.shot("ADM-01", fail === true ? "error-rejected" : "error-network")); console.log(await say(t)); await t.browser.close(); }
  const t = await open({ w, h, theme, expiresIn: 1, refreshFail: true, admin: true, mocks: { streak_month_tops: [], admin_change_log: [], admin_client_errors: [], admin_community_reports: [] } });
  await t.page.waitForTimeout(31000); console.log(await t.shot("ADM-02", "expired")); console.log(await say(t)); await t.browser.close(); process.exit(0);
})();
