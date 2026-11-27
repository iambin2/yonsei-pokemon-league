// Site-wide editable settings stored in site_data.siteConfig so successor admins can update
// the Discord invite link, club timeline, privacy policy date, and founded year without editing code.

export const DEFAULT_DISCORD_URL = "https://discord.gg/T7UZHhGvUh";
export const DEFAULT_FOUNDED_YEAR = 2023;
export const DEFAULT_PRIVACY_EFFECTIVE = "2026년 11월 29일";

export const DEFAULT_TIMELINE = [
  { when: "2023년 5월", title: "파이컵 탄생", body: "포센연이 자체 대회인 파이컵을 처음 열었습니다." },
  { when: "2023년 – 2025년", title: "매달 이어진 도전", body: "파이컵이 매월 정규 대회로 열렸습니다." },
  { when: "2025년 6월", title: "YPL 체제 출범", body: "마스터 리그와 루키 리그로 나뉘었습니다." },
  { when: "2026년 9월", title: "YPL 시즌 3 개막", body: "신청과 파티 제출을 이 사이트에서 받습니다." },
];

export function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\/\S+$/i.test(value.trim());
}

export function resolveSiteConfig(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const discordUrl = isHttpUrl(src.discordUrl) ? src.discordUrl.trim() : DEFAULT_DISCORD_URL;
  const yearNum = Number.parseInt(String(src.foundedYear ?? ""), 10);
  const foundedYear = Number.isInteger(yearNum) && yearNum >= 1990 && yearNum <= 2100 ? yearNum : DEFAULT_FOUNDED_YEAR;
  const privacyEffectiveDate = typeof src.privacyEffectiveDate === "string" && src.privacyEffectiveDate.trim()
    ? src.privacyEffectiveDate.trim()
    : DEFAULT_PRIVACY_EFFECTIVE;
  const timeline = Array.isArray(src.aboutTimeline)
    ? src.aboutTimeline
        .filter(item => item && typeof item === "object")
        .map(item => ({
          when: String(item.when || "").trim(),
          title: String(item.title || "").trim(),
          body: String(item.body || "").trim(),
        }))
        .filter(item => item.when && item.title)
    : [];
  return {
    discordUrl,
    foundedYear,
    privacyEffectiveDate,
    aboutTimeline: timeline.length ? timeline : DEFAULT_TIMELINE.map(item => ({ ...item })),
  };
}

export function sanitizeSiteConfig(draft) {
  const resolved = resolveSiteConfig(draft);
  return {
    discordUrl: resolved.discordUrl,
    foundedYear: resolved.foundedYear,
    privacyEffectiveDate: resolved.privacyEffectiveDate,
    aboutTimeline: resolved.aboutTimeline,
  };
}
