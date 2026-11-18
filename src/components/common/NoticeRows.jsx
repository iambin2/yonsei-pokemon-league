import React from "react";
import { Row, follow } from "./Board.jsx";
import { isNewNotice } from "./seenNotices.js";
import { dotDate, formatDate } from "../../services/dateFormat.js";
import { viewHref } from "../../services/appRouting.js";

/* 공지는 어디서나 한 모양이다: 홈과 공지 목록이 같은 큰 판과 같은 64 행을 쓴다(DESIGN.md "Composing a screen" 11). */
/* 목록의 첫 공지(첫 쪽, 검색 없음)는 홈과 같은 큰 판으로 선다(시안 B): 새 글이면 램프와 그 말, 20의 제목, 날짜는 회색 줄의 글자다
   (날짜는 읽는 숫자라 세그먼트가 아니다, DESIGN.md "Seven-segment displays") */
export const NoticeLead=({a,onOpen})=>{
  const d=dotDate(a.date), fresh=isNewNotice(a);
  return <a className="pn lead nt-lead" href={viewHref("news",{notice:a.id})} onClick={follow(onOpen)} aria-label={`${a.title}, ${formatDate(a.date)}${fresh?", 새 글":""}`}>
    {fresh&&<span className="t12 lead-lamp"><i className="lamp" aria-hidden="true"/>새 글</span>}
    <b className="t20 lead-title">{a.title}</b>
    <span className="t12 dim reg">{a.pinned&&<><b className="nw-pin">고정</b>, </>}{d?<><span className="num">{d.day}</span> {d.weekday}</>:formatDate(a.date)}</span>
  </a>;
};
export const NoticeRow=({a,onOpen})=>{
  const d=dotDate(a.date), fresh=isNewNotice(a);
  return <Row title={a.title} line={<>{a.pinned&&<><b className="nw-pin">고정</b>, </>}{d?<><span className="num">{d.day}</span> {d.weekday}</>:formatDate(a.date)}</>} lamp={fresh&&"새 글"} label={fresh?`${a.title}, ${formatDate(a.date)}, 새 글`:undefined} onClick={onOpen} href={viewHref("news",{notice:a.id})}/>;
};
