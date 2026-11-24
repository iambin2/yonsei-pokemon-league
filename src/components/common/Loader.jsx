import React from "react";

/* 불러오는 동안(DESIGN.md "Motion", Loading, Busy): 자리는 크기대로 서고, 가는 줄 위를 짧은 굵은 줄 하나가 지나간다.
   transform 하나로 움직여 브라우저가 화면을 그리느라 바쁠 때도 합성기에서 계속 돈다. small 은 카드나 목록 안의 자리. */
export function Busy({ h = 40 }) {
  return <span className="y-busy" aria-hidden="true" style={{ "--busy-w": `${Math.round(h * 1.3)}px` }}><i /></span>;
}
export default function Loader({ small = false, label = "불러오는 중" }) {
  return <div className={"y-loader" + (small ? " sm" : "")} role="status" aria-label={label}><Busy h={small ? 32 : 40} /></div>;
}
