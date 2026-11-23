// T-43(c) and T-44 (2026-11-23): the team builder's official submission on an event patched open, and the rule panel with violations.
// node builder.cjs <WxH> <dark|light>   (GETs pass through and are patched; every write is answered here, lib.cjs)
const { open } = require("./lib.cjs");
const EV = "4379f233-b441-43ba-8c05-581d6c07af05";
const [size = "1440x900", theme = "dark"] = process.argv.slice(2);
const TEAM = `Rotom-Wash @ Sitrus Berry
Ability: Levitate
- Hydro Pump
- Volt Switch

Incineroar @ Safety Goggles
Ability: Intimidate
- Knock Off
- Fake Out
`;
const rng = `e=>{const r=document.createRange();r.selectNodeContents(e);const b=r.getBoundingClientRect();return Math.round(b.left)}`;
(async () => {
  const [w, h] = size.split("x").map(Number);
  const future = new Date(Date.now() + 5 * 864e5).toISOString();
  const t = await open({ w, h, theme, mocks: { "fn:battle": {} }, patches: [{ re: /tbl:events/, fn: rows => { if (Array.isArray(rows)) for (const r of rows) if (r.id === EV) { if ("status" in r) r.status = "open"; if ("record_applied_at" in r) r.record_applied_at = null; if ("submission_target_at" in r) r.submission_target_at = future; } return rows; } }] });
  await t.go("/?view=builder&eventId=" + EV); await t.page.waitForTimeout(2500);
  // T-44: violations from an imported team
  await t.press("내 팀"); await t.page.waitForTimeout(800); await t.press("텍스트로 가져오기"); await t.page.waitForTimeout(1000); console.log(await t.page.evaluate(()=>[...document.querySelectorAll("[role=dialog],[role=alertdialog],.modal")].map(d=>d.className+" inert="+!!d.closest("[inert]")+" "+d.innerText.slice(0,60).replace(/\n/g,"/")))); await t.shot("T-44","debug"); await t.page.locator(".modal").last().locator("textarea").fill(TEAM); await t.page.waitForTimeout(300);
  await t.page.locator("[role=dialog] button, .modal button").filter({ hasText: "가져오기" }).last().click(); await t.page.waitForTimeout(1500);
  const conf = t.page.locator("[role=dialog] button, [role=alertdialog] button").filter({ hasText: "가져오기" }); if (await conf.count()) { await conf.last().click(); await t.page.waitForTimeout(1200); }
  for (let i = 0; i < 3 && await t.page.locator(".modal").count(); i++) { await t.page.keyboard.press("Escape"); await t.page.waitForTimeout(700); }
  if (w < 860) { await t.page.locator("button").filter({ hasText: /^팀 구성$/ }).first().click(); await t.page.waitForTimeout(900); }
  console.log("T-44", JSON.stringify(await t.page.evaluate(`(()=>{const rng=${rng};return [...document.querySelectorAll(".tb-validation:not(.official-submission)")].filter(p=>p.offsetParent).map(p=>({head:[...p.querySelectorAll(".tb-validation-head strong")].map(s=>s.innerText.slice(0,20)+"@"+rng(s)),lines:[...p.querySelectorAll("ul > li")].map(li=>{const tn=[...li.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());const r=document.createRange();if(tn)r.selectNodeContents(tn);return (li.querySelector(".bang")?"!":"-")+" "+li.innerText.slice(0,24)+"@"+(tn?Math.round(r.getBoundingClientRect().left):"?")})}))})()`)));
  await t.shot("T-44", "violations", { fullPage: false });
  const panel = t.page.locator(".tb-validation:not(.official-submission)").locator("visible=true").first(); if (await panel.count()) { await panel.scrollIntoViewIfNeeded(); await t.shot("T-44", "panel"); }
  // T-43(c): a name looked up that has no registration
  if (w < 860) { await t.page.locator("button").filter({ hasText: /^팀 구성$/ }).first().click(); await t.page.waitForTimeout(900); }
  const name = t.page.locator("#tb-sub-name");
  if (await name.count()) {
    await name.scrollIntoViewIfNeeded(); await name.fill("없는이름테스트"); await t.press("신청자 확인"); await t.page.waitForTimeout(1500);
    console.log("T-43c", JSON.stringify(await t.page.evaluate(`(()=>{const f=document.querySelector(".official-submission .tb-sub-field");const u=document.querySelector(".official-submission > ul");const fb=f&&f.getBoundingClientRect().bottom,ut=u&&u.getBoundingClientRect().top;return {fieldBottom:fb&&Math.round(fb),ulTop:ut&&Math.round(ut),gap:fb&&ut?Math.round(ut-fb):null,ul:u&&u.innerText.slice(0,60)}})()`)));
    await t.page.locator(".official-submission").locator("visible=true").first().scrollIntoViewIfNeeded(); await t.shot("T-43", "lookup-error");
  } else console.log("T-43c: no name field (submission blocked?)", await t.page.evaluate(() => document.querySelector(".official-submission")?.innerText.slice(0, 200)));
  console.log([...new Set(t.log.filter(l => /UNMOCKED|PAGEERROR|PATCH FAIL/.test(l)))].join("\n").slice(0, 800));
  await t.browser.close(); process.exit(0);
})();
