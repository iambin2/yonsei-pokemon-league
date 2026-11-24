import React from "react";
import Icon from "../common/Icon.jsx";
import { BrandMark, DISCORD_URL, Wordmark } from "./SiteHeader.jsx";
import { follow } from "../common/Board.jsx";
import { viewHref } from "../../services/appRouting.js";

const YEAR_FOUNDED = 2023;

/* 바닥글은 바탕 위, 머리카락 선 아래의 낮은 두 줄(2026-11-24, 운영자 시안 A: 252로 페이지 끝을 너무 많이 차지했다):
   첫 줄은 20 브랜드, 저작권과 개인정보처리방침, 오른쪽 끝에 관리자 로그인과 디스코드 참여(2026-11-06: 운영진이 찾을 수 있게
   모든 폭에서 첫 줄에 선다). 둘째 줄은 12의 팬 사이트 안내. 메뉴는 탭 바와 상단 바가 이미 갖고 있어 되풀이하지 않는다. */
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
          <span className="site-foot-links">
            {onAdmin && <button type="button" className="site-foot-login" onClick={onAdmin}>관리자 로그인</button>}
            <a className="site-foot-dc" href={DISCORD_URL} target="_blank" rel="noopener noreferrer"><Icon n="ext" size={16} />디스코드 참여</a>
          </span>
        </div>

        <p className="site-foot-fine">
          연세대학교 포켓몬스터 동아리 포켓몬 센터 연세점이 운영하는 팬 사이트로, Nintendo, Creatures, GAME FREAK, The Pokémon Company와 관계가 없습니다.
          Pokémon 및 포켓몬스터는 각 회사의 상표입니다.
        </p>
      </div>
    </footer>
  );
}
