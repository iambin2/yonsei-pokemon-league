import React from "react";
import { Bar, koNumber } from "./Board.jsx";
import Button from "./Button.jsx";

/* 점수 순으로 정렬하고 같은 점수는 같은 순위, 다음 순위는 건너뛴다(6, 6, 8). */
export function rankRows(rows) {
  const sorted = [...(rows || [])].sort((a, b) => (b.points || 0) - (a.points || 0));
  let rank = 0;
  return sorted.map((row, i) => {
    if (i === 0 || (row.points || 0) !== (sorted[i - 1].points || 0)) rank = i + 1;
    return { ...row, rank };
  });
}

const SHOWN = 12;
/* 0인 성적은 쓰지 않는다: "우승 2, 4강 1" */
const recordLine = (r) => [["우승", r.win], ["준우승", r.ru], ["4강", r.top4]].filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(", ");

/* A ranking as the line score (DESIGN.md "Layout and pages", draft B; Composing a screen 25): a sole leader stands first as an inverted
   row 84 tall, the name at 20, its bar on a track and the points at 32; the rest are rows of 52, the place, the name, the bar and the
   points at 20. The bars are the points over the first's. No header row of column names: each row says its figure with its unit.
   A tie is named 공동 (공동 3위). rows are raw; they are ranked here, unless placed: 도전의 탑's board comes ranked from the database.
   unit says what the points count (연승). A row's live run carries the amber lamp with 도전 중, and its open is its door.
   rows null is the board switched off: the rows at their size while the ranking is read, so nothing under it moves when it lights. */
export default function StandTable({ rows, total, onName, open = false, onMore, shown: limit = SHOWN, placed = false, unit = "점" }) {
  if (!rows) return <div className="stack line-score" aria-hidden="true">
    <div className="inv ls-row ls-first" />{[1, 2, 3, 4].map(i => <div key={i} className="pn ls-row" />)}
  </div>;
  const ranked = placed ? rows : rankRows(rows);
  if (!ranked.length) return null;
  const shown = open ? ranked : ranked.slice(0, limit);
  const per = new Map(); ranked.forEach((r) => per.set(r.rank, (per.get(r.rank) || 0) + 1));
  const tied = (r) => per.get(r.rank) > 1;
  const solo = per.get(ranked[0].rank) === 1;
  const best = Math.max(1, ranked[0].points || 0);
  const seen = new Map();
  return (<>
    <div className="stack line-score">
      {shown.map((r, i) => {
        const n = (seen.get(r.name) || 0) + 1; seen.set(r.name, n);
        const first = i === 0 && solo;
        const pts = r.points || 0;
        const place = `${tied(r) ? "공동 " : ""}${r.rank}위`;
        const line = [recordLine(r), r.note].filter(Boolean).join(", ");
        const go = r.open || (onName ? (e) => onName(r.name, e.currentTarget) : null);
        const Box = go ? "button" : "div";
        return <Box key={`${r.name}#${n}`} {...(go ? { type: "button", onClick: go } : {})} className={(first ? "inv ls-first" : "pn") + " ls-row" + (line ? " two" : "")}
          aria-label={`${place} ${r.name}, ${pts}${unit}${line ? `, ${line}` : ""}${r.live ? ", 도전 중" : ""}`}>
          <span className="ls-place t15">{r.live && <i className="lamp sig" aria-hidden="true" />}{place}</span>
          <span className="ls-main">
            <b className={first ? "t20" : "t15"}>{r.name}{r.live && <span className="t12 ls-live"> 도전 중</span>}</b>
            {line && <span className="t12 dim reg ls-line">{line}</span>}
            <Bar value={pts / best} />
          </span>
          <span className="ls-pts"><b className={"num " + (first ? "t32" : "t20")}>{koNumber(pts)}</b><span className="t12 dim">{unit}</span></span>
        </Box>;
      })}
    </div>
    {!open && ranked.length > limit && onMore && <div className="rank-more"><Button variant="second" onClick={onMore}>{total || ranked.length}명 전체 보기</Button></div>}
  </>);
}
