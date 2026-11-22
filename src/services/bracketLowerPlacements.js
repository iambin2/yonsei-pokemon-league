/* 5위 이하 순위 (2026-11-22): 우승, 준우승, 4강 밖의 출전도 어디서 떨어졌는지를 결과로 남긴다(placement_code "placed").
   포인트는 주지 않는다(bracketRankingAwardSnapshot.js가 건너뛴다). 같은 단계에서 떨어진 출전은 같은 순위의 공동이다.
   - 싱글: 경기 M개인 라운드에서 진 출전은 M+1위부터, 라벨은 그 라운드의 이름(8강, 16강).
   - 더블: 패자조에서 진 순서대로, 뒤의 라운드에서 진 출전이 앞선다(4강 둘은 elimResult가 이미 센다).
   - 조별리그 뒤 본선: 본선은 위와 같고, 조에서 떨어진 출전은 본선 인원 다음 순위의 공동이다.
   b: 대진표 투영(graph 또는 groups와 knockout). 돌려주는 것: [{ participantId, rank_min, rank_max, placement_label }] */
import { BYE, collectGraphMatches, evalGraph } from "./bracketWinnerPlan.js";

const real = x => x && x !== BYE;
const band = (better, ids, label) => ids.map(participantId => ({
  participantId, rank_min: better + 1, rank_max: better + ids.length,
  placement_label: label || (ids.length > 1 ? `공동 ${better + 1}위` : `${better + 1}위`),
}));

function fromGraph(g) {
  if (!g) return { rows: [], count: 0 };
  const { lose } = evalGraph(g);
  const players = new Set();
  for (const m of collectGraphMatches(g)) for (const s of [m.a, m.b]) if (s?.pid && s.pid !== BYE) players.add(s.pid);
  const rows = [];
  if (g.kind === "double") {
    // the last two losers' rounds are 3rd and 4th (elimResult's 4강); earlier rounds rank after everyone who outlasted them
    let better = 4;
    for (let j = g.lb.length - 3; j >= 0; j--) {
      const ids = g.lb[j].map(m => lose[m.id]).filter(real);
      rows.push(...band(better, ids));
      better += ids.length;
    }
  } else {
    // the final and the semifinals are elimResult's; a round of M matches seats its losers from M+1
    for (let i = g.rounds.length - 3; i >= 0; i--) {
      const M = g.rounds[i].length;
      rows.push(...band(M, g.rounds[i].map(m => lose[m.id]).filter(real), `${M * 2}강`));
    }
  }
  return { rows, count: players.size };
}

export function lowerPlacements(b) {
  if (b?.format === "group") {
    const knockout = fromGraph(b.knockout);
    const inKnockout = new Set();
    for (const m of collectGraphMatches(b.knockout)) for (const s of [m.a, m.b]) if (s?.pid && s.pid !== BYE) inKnockout.add(s.pid);
    const out = (b.groups || []).flatMap(g => g.members || []).filter(id => !inKnockout.has(id));
    return [...knockout.rows, ...band(inKnockout.size, out)];
  }
  return fromGraph(b?.graph).rows;
}
