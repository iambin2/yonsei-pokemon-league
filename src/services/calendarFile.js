/* 캘린더에 추가 (2026-11-22): a notice's event days as an .ics file any calendar app opens (Google, Apple, Outlook), so a player keeps
   the day without copying it by hand. Times are the league's (Asia/Seoul); a day without a time is an all-day event. A notice with no
   event day gives nothing. */
const pad = n => String(n).padStart(2, "0");
const ymd = raw => String(raw || "").slice(0, 10).replace(/-/g, "");
const esc = text => String(text || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// days: [{ label, day: "2026-11-22", time: "16:00" | "" }], the notice's own days (one, or the qualifier and the final)
export function calendarFile({ id, title, days, url, now = new Date() }) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const events = (days || []).filter(d => /^\d{4}-\d{2}-\d{2}/.test(String(d.day || ""))).map((d, i) => {
    const when = /^(\d{1,2}):(\d{2})/.exec(String(d.time || ""));
    const date = ymd(d.day);
    const timing = when
      // three hours is a league day's usual length; the calendar only needs a block to stand on
      ? [`DTSTART;TZID=Asia/Seoul:${date}T${pad(when[1])}${when[2]}00`, `DTEND;TZID=Asia/Seoul:${date}T${pad(Math.min(23, Number(when[1]) + 3))}${when[2]}00`]
      : [`DTSTART;VALUE=DATE:${date}`];
    return ["BEGIN:VEVENT", `UID:${esc(id)}-${i}@league.pokeyonsei.com`, `DTSTAMP:${stamp}`, ...timing,
      `SUMMARY:${esc(d.label ? `${title} ${d.label}` : title)}`, ...(url ? [`URL:${esc(url)}`, `DESCRIPTION:${esc(url)}`] : []), "END:VEVENT"];
  });
  if (!events.length) return "";
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//YPL//league.pokeyonsei.com//KO", "CALSCALE:GREGORIAN", ...events.flat(), "END:VCALENDAR", ""].join("\r\n");
}

// a notice's event days, as its 일시 rows read them (NewsPage eventFacts)
export function noticeDays(notice) {
  const d = notice?.form?.eventDraft || {};
  return d.eventType === "champions"
    ? [{ label: "선발전", day: d.qualifierHeldOn ?? d.heldOn, time: d.qualifierStartTime }, { label: "본선", day: d.finalHeldOn, time: d.finalStartTime }]
    : [{ label: "", day: d.heldOn, time: d.startTime }];
}
