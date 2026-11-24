import React from "react";
import { koNumber } from "./Board.jsx";
import Fig from "./Fig.jsx";
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

/* A ranking as the almanac's table (2026-11-24): small dim column heads over a 2px lit rule, then rows of 52 closed by hairlines, the
   place muted, the name, the points in Albert Sans at the row's end (a zero muted). A sole leader stands first, its name at 32 and its
   points as a thin large figure. A tie is the same place again (the label says 공동). rows are raw; they are ranked here, unless placed:
   도전의 탑's board comes ranked from the database. unit says what the points count (연승). A row's live run carries the amber lamp with
   도전 중, and its open is its door. rows null is the table's places standing at their size while the ranking is read (data-wait), so
   nothing under it moves when the rows light into them. */
export default function StandTable({ rows, total, onName, open = false, onMore, shown: limit = SHOWN, placed = false, unit = "점" }) {
  // the head is the same element while the rows are read and after, and stands through their arrival (data-kept, motion.js light)
  const head = <div className="st-head t12 dim" aria-hidden="true" data-kept=""><span>순위</span><span>트레이너</span><span>{unit === "점" ? "점수" : unit}</span></div>;
  if (!rows) return <><div className="line-score st" aria-hidden="true" data-wait="">
    {head}<div className="pn st-row st-first" />{[1, 2, 3, 4].map(i => <div key={i} className="pn st-row" />)}
  </div></>;
  const ranked = placed ? rows : rankRows(rows);
  if (!ranked.length) return null;
  const shown = open ? ranked : ranked.slice(0, limit);
  const per = new Map(); ranked.forEach((r) => per.set(r.rank, (per.get(r.rank) || 0) + 1));
  const tied = (r) => per.get(r.rank) > 1;
  const solo = per.get(ranked[0].rank) === 1;
  const seen = new Map();
  return (<>
    <div className="line-score st">
      {head}
      {shown.map((r, i) => {
        const n = (seen.get(r.name) || 0) + 1; seen.set(r.name, n);
        const first = i === 0 && solo;
        const pts = r.points || 0;
        const place = `${tied(r) ? "공동 " : ""}${r.rank}위`;
        const line = r.note || "";
        const go = r.open || (onName ? (e) => onName(r.name, e.currentTarget) : null);
        const Box = go ? "button" : "div";
        return <Box key={`${r.name}#${n}`} {...(go ? { type: "button", onClick: go } : {})} className={"pn st-row" + (first ? " st-first" : "") + (line ? " two" : "")}
          aria-label={`${place} ${r.name}, ${pts}${unit}${line ? `, ${line}` : ""}${r.live ? ", 도전 중" : ""}`}>
          <span className="st-place">{r.live && <i className="lamp sig" aria-hidden="true" />}{r.rank}</span>
          <span className="st-main">
            <b className={first ? "t32" : "t15"}>{r.name}{r.live && <span className="t12 st-live"> 도전 중</span>}</b>
            {line && <span className="t12 dim reg">{line}</span>}
          </span>
          <span className={"st-pts" + (pts ? "" : " mute")}>{first ? <Fig value={String(pts)} h={40} label={`${pts}${unit}`} /> : <span className="st-n">{koNumber(pts)}</span>}<span className="t12 dim">{unit}</span></span>
        </Box>;
      })}
    </div>
    {!open && ranked.length > limit && onMore && <div className="rank-more"><Button variant="second" line onClick={onMore}>{total || ranked.length}명 전체 보기</Button></div>}
  </>);
}
