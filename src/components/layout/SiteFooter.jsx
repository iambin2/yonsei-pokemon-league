import React from "react";
import Icon from "../common/Icon.jsx";
import { BrandMark, DISCORD_URL, Wordmark } from "./SiteHeader.jsx";
import { follow, Row } from "../common/Board.jsx";
import { viewHref } from "../../services/appRouting.js";

const YEAR_FOUNDED = 2023;

/* 바닥글은 바탕 위, 머리카락 선 아래(2026-11-24, 운영자 시안 A: 252로 페이지 끝을 너무 많이 차지했다): 20 브랜드와 저작권,
   개인정보처리방침의 한 줄, 12의 팬 사이트 안내, 그리고 2px 선이 여는 두 문(같은 날 운영자 시안 C: 밑줄 친 12 글자 둘은 그냥
   텍스트였다). 디스코드 참여는 켜진 15/700에 끝의 ↗, 관리자 로그인은 흐린 줄에 끝의 ›, 더보기의 줄과 같은 꼴. 860부터 리그의
   글은 709, 문은 439에 선다. 메뉴는 탭 바와 상단 바가 이미 갖고 있어 되풀이하지 않는다. */
export default function SiteFooter({ onNavigate, onAdmin }) {
  const year = new Date().getFullYear();
  const span = year > YEAR_FOUNDED ? `${YEAR_FOUNDED}–${year}` : `${YEAR_FOUNDED}`;

  return (
    <footer className="site-foot">
      <div className="site-foot-in">
        <div className="site-foot-mark">
          <a href={viewHref("home")} className="brand" onClick={follow(() => onNavigate("home"))} aria-label="YPL 홈으로">
            <BrandMark size={20} /><Wordmark />
          </a>
          <span className="site-foot-line">
            <span>© {span} Yonsei Pokémon League</span>
            <a href={viewHref("privacy")} className="site-foot-admin" onClick={follow(() => onNavigate("privacy"))}>개인정보처리방침</a>
          </span>
        </div>

        <div className="stack opens site-foot-doors">
          <a className="pn row site-foot-dc" href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
            <span className="row-main"><b className="t15">디스코드 참여</b></span><span className="row-value"><Icon n="ext" size={20} /></span>
          </a>
          {onAdmin && <Row className="site-foot-login" title="관리자 로그인" value={<Icon n="chevr" size={20} />} onClick={onAdmin} />}
        </div>

        <p className="site-foot-fine">
          연세대학교 포켓몬스터 동아리 포켓몬 센터 연세점이 운영하는 팬 사이트로, Nintendo, Creatures, GAME FREAK, The Pokémon Company와 관계가 없습니다.
          Pokémon 및 포켓몬스터는 각 회사의 상표입니다.
        </p>
      </div>
    </footer>
  );
}
