/* 홈의 내 다음: 로그인한 트레이너(useMe)의 다음 대회 신청, 파티 제출, 다음 경기. 이미 있는 공개 읽기만 쓴다
   (신청자 목록, 제출 현황, 대진표와 같은 읽기). 사실을 모르는 칸은 null이고, 화면은 그 칸을 꺼 둔다. */
import { getEvent, getLeagueIntakeEvents, listEventRegistrationSubmissionStatuses, listEventRegistrations, listNormalizedBracketRuntimes } from "./normalizedCompetitionService.js";
import { freshRead } from "./readCache.js";
import { liveMatches } from "./recordsAnalytics.js";
import { playerNameKey } from "./teamBuilderCore.js";

export async function loadMyNext(eventId, me) {
  const event = await getEvent(eventId);
  if (!event) return { applied: null, submitted: null, match: null };
  const events = await getLeagueIntakeEvents(event).catch(() => [event]);
  const key = playerNameKey(me.name);
  const isMe = (playerId, name) => (playerId ? playerId === me.playerId : playerNameKey(name) === key);

  const regs = (await Promise.all(events.map(e => listEventRegistrations(e.id)))).flat();
  const mine = regs.find(r => isMe(r.player_id, r.registration_name)) || null;
  const [submitted, match] = await Promise.all([
    mine ? listEventRegistrationSubmissionStatuses(mine.event_id, [mine]).then(rows => Boolean(rows[0]?.hasSubmission), () => null) : null,
    freshRead("brackets", listNormalizedBracketRuntimes, 10_000).then(rows => {
      const ids = events.map(e => e.id);
      for (const { bracket } of rows || []) {
        if (!ids.includes(bracket?.eventId)) continue;
        const m = liveMatches(bracket).live.find(x => playerNameKey(x.a) === key || playerNameKey(x.b) === key);
        if (m) return { id: m.id, stage: m.stage, opponent: playerNameKey(m.a) === key ? m.b : m.a, eventId: bracket.eventId };
      }
      return null;
    }, () => null),
  ]);
  // 신청은 대회에 걸린 사실: 읽었으면 했거나 안 했거나다. 제출은 신청한 사람에게만 있다.
  return { applied: Boolean(mine), submitted: mine ? submitted : null, // the builder takes what the notice's own 파티 제출 key gives it (NewsPage): the notice's event, a champions phase's own event
    builderEventId: event.event_type === "champions" && mine ? mine.event_id : eventId, match };
}
