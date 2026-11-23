const { open } = require("./lib.cjs");
(async () => {
  const log = []; const t = await open({ admin: true, log });
  console.log("after login:", await t.page.evaluate(() => document.querySelector("#ypl-main")?.innerText.slice(0, 600)));
  await t.shot("U-q-recon", "admin");
  for (const v of ["/", "/?view=bracket", "/?view=records"]) { log.push("== " + v); await t.press(v === "/" ? "홈" : v.includes("bracket") ? "대진표" : "기록", "nav a, nav button, header a, header button").catch(e => log.push("nav fail " + e.message.slice(0, 80))); await t.page.waitForTimeout(2500); console.log(v, t.page.url(), (await t.page.evaluate(() => document.querySelector("#ypl-main")?.innerText.slice(0, 500))).replace(/\n+/g, " | ")); }
  console.log([...new Set(log)].join("\n"));
  await t.browser.close();
})();
