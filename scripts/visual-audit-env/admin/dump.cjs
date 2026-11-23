const { open } = require("./lib.cjs"); const fs = require("fs");
(async () => {
  const t = await open({ admin: true });
  const seen = {};
  t.page.on("response", async r => { const u = r.url(); if (!/supabase\.co\/rest/.test(u) || r.request().method() !== "GET") return; const n = new URL(u).pathname.split("/").pop(); try { const b = await r.text(); const k = n + (seen[n] ? "_" + seen[n] : ""); seen[n] = (seen[n] || 0) + 1; fs.writeFileSync("data/" + k + ".json", b); fs.appendFileSync("data/_urls.txt", k + " " + decodeURIComponent(u.split("/rest/v1/")[1]).slice(0, 700) + "\n"); } catch {} });
  await t.go("/?view=admin"); await t.login().catch(() => {});
  await t.press("대진표", "header a, header button, nav a"); await t.page.waitForTimeout(2500);
  await t.press("38회 파이컵 마스터 리그"); await t.page.waitForTimeout(3000);
  await t.shot("U-q-recon", "bracket-admin");
  console.log((await t.page.evaluate(() => document.querySelector("#ypl-main")?.innerText.slice(0, 1500))).replace(/\n+/g, " | "));
  console.log(t.log.filter(l => !l.startsWith("GET")).join("\n"));
  await t.browser.close();
})();
