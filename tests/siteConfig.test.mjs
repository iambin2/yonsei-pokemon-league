import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DISCORD_URL,
  DEFAULT_FOUNDED_YEAR,
  DEFAULT_PRIVACY_EFFECTIVE,
  DEFAULT_TIMELINE,
  isHttpUrl,
  resolveSiteConfig,
  sanitizeSiteConfig,
} from "../src/services/siteConfig.js";

test("resolveSiteConfig returns defaults when siteConfig is absent or malformed", () => {
  const cfg = resolveSiteConfig(null);
  assert.equal(cfg.discordUrl, DEFAULT_DISCORD_URL);
  assert.equal(cfg.foundedYear, DEFAULT_FOUNDED_YEAR);
  assert.equal(cfg.privacyEffectiveDate, DEFAULT_PRIVACY_EFFECTIVE);
  assert.deepEqual(cfg.aboutTimeline, DEFAULT_TIMELINE);
});

test("resolveSiteConfig validates URL, year range, and timeline entries", () => {
  assert.equal(isHttpUrl("https://discord.gg/abc"), true);
  assert.equal(isHttpUrl("javascript:alert(1)"), false);

  const cfg = resolveSiteConfig({
    discordUrl: "javascript:alert(1)",
    foundedYear: 1800,
    privacyEffectiveDate: "   ",
    aboutTimeline: [{ when: "2027년 3월", title: "", body: "누락" }],
  });
  assert.equal(cfg.discordUrl, DEFAULT_DISCORD_URL);
  assert.equal(cfg.foundedYear, DEFAULT_FOUNDED_YEAR);
  assert.equal(cfg.privacyEffectiveDate, DEFAULT_PRIVACY_EFFECTIVE);
  assert.deepEqual(cfg.aboutTimeline, DEFAULT_TIMELINE);
});

test("sanitizeSiteConfig trims valid admin edits and drops empty timeline rows", () => {
  const clean = sanitizeSiteConfig({
    discordUrl: " https://discord.gg/newinvite ",
    foundedYear: "2023",
    privacyEffectiveDate: " 2027년 3월 1일 ",
    aboutTimeline: [
      { when: " 2023년 5월 ", title: " 파이컵 탄생 ", body: " 첫 대회입니다. " },
      { when: "", title: "", body: "" },
      { when: "2027년 3월", title: "YPL 시즌 4 개막", body: "새 시즌이 시작되었습니다." },
    ],
  });
  assert.equal(clean.discordUrl, "https://discord.gg/newinvite");
  assert.equal(clean.foundedYear, 2023);
  assert.equal(clean.privacyEffectiveDate, "2027년 3월 1일");
  assert.equal(clean.aboutTimeline.length, 2);
  assert.equal(clean.aboutTimeline[1].title, "YPL 시즌 4 개막");
});
