import React, { useEffect, useState } from "react";
import Icon from "../common/Icon.jsx";
import { VISITOR_EVENT, accountsEnabled, accountsReady, myPlayerLink, visitorSignedIn } from "../../services/visitorAuth.js";
import { useSlideLine } from "../common/Board.jsx";
import { TABS, WIDE_TABS, current, tabOf, useWideNav } from "./Navigation.jsx";
import { follow } from "../common/Board.jsx";
import { viewHref } from "../../services/appRouting.js";

export const DISCORD_URL = "https://discord.gg/T7UZHhGvUh";

/* YPL Wing Y (2026-10-27 다듬음, H) — public/brand/ypl-wing-y.svg 와 같은 도형, 단색(F1): 서 있는 면의 글자색을 따른다.
   2026-10-12 로고를 그린 규칙(윗변과 나란한 깃털 층, 한 사선 위의 깃털 끝, 세 갈래 꼬리)으로 다시 세우고
   깃털을 날개 아래 하나로 줄이고, 획과 몸통을 굵게, 틈은 바에서 보일 만큼, 폭은 0.94배로 모았다.
   깃털은 팔의 바깥선에서 멈춘다(겹치면 evenodd 가 구멍을 낸다). 모든 면이 직선이고 좌우가 정확히 대칭이다.
   상단 바는 고정된 길잡이라서 로고는 움직이지 않는다(2026-10-12, 등장과 로딩 빛 띠를 뺐다). */
const MARK_PATH = "M0 0 L427.7 118 L657.5 430 L887.4 118 L1315.1 0 L1199.8 164 L947.9 233.5 L755.3 495.5 L755.3 536.5 L559.8 536.5 L559.8 495.5 L367.1 233.5 L115.3 164 Z M246.8 351.1 L149.5 212.7 L403.3 282.8 L506.3 422.7 Z M808.8 422.7 L911.7 282.8 L1165.6 212.7 L1068.3 351.1 Z M559.8 574.5 L755.3 574.5 L755.3 608.1 L916.1 732.5 L805.8 811.8 L713.7 639.1 L692.3 639.1 L751.1 811.8 L657.5 870.6 L564 811.8 L622.8 639.1 L601.3 639.1 L509.3 811.8 L399 732.5 L559.8 608.1 Z";
const MARK_RATIO = 1315.1 / 870.6;
export function BrandMark({ size = 24, className = "" }) {
  return (
    <svg className={"logo" + (className ? " " + className : "")} width={Math.round(size * MARK_RATIO)} height={size}
      viewBox="0 0 1315.1 870.6" aria-hidden="true" focusable="false">
      <path d={MARK_PATH} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

/* YPL 워드마크 솔리드(2026-11-01 B안): 그린 글자를 12도 기울인 한 덩어리. 띠를 없애 14px에서도 글자가 뭉치지 않는다.
   skewX(-12) translate(21 0) 안에서 그린다. 상단 바, 홈의 아레나, 대진표와 팀 시트의 이미지 저장이 같이 쓴다. */
export const WORDMARK_PATH = "M0 0 H34.7 L55 27.7 L75.3 0 H110 L69 56 V100 H41 V56 Z"
  + " M118 0 H188 A18 18 0 0 1 206 18 V46 A18 18 0 0 1 188 64 H146 V100 H118 Z M146 24 H178 V40 H146 Z"
  + " M214 0 H242 V76 H286 V100 H214 Z";
export function Wordmark() {
  return (
    <svg className="wordmark" viewBox="0 0 310 100" aria-hidden="true" focusable="false">
      <path transform="skewX(-12) translate(21 0)" fillRule="evenodd" d={WORDMARK_PATH} />
    </svg>
  );
}

/* Google의 G: Google 자신의 G 모양 그대로, 네 조각을 한 경로로 합쳐 글자 색 하나로 칠한다(2026-11-23, 운영자 시안 B "단색":
   네 색 G가 남색 판에서 혼자 튀었다). Wing Y와 같은 잉크라 두 테마를 따라가고, 반전된 면 위에서는 반전된 색이 된다.
   구글 로그인의 글자 앞마다 20으로 선다(DESIGN.md "The account word"). */
const G_PATH = "M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5zM46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65zM10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19zM24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z";
export const GoogleMark = () => <svg className="g-mark" viewBox="0 0 48 48" width={20} height={20} fill="currentColor" aria-hidden="true"><path d={G_PATH} /></svg>;

/* 구글 계정(docs/db/player_accounts.sql): 바의 오른쪽, 램프 앞에 G와 한 단어. 계정이 하는 일은 내 기록을 내 이름으로 갖는 것이라,
   버튼도 그 말을 한다(2026-11-06: "구글 로그인"은 눌러 보기 전에는 왜 있는지 알 수 없었다). 로그인 전은 "내 기록", 누르면 구글로
   튕기지 않고 기록의 트레이너 목록에서 내 이름을 찾는 화면(?me=1)으로 간다. 로그인 뒤는 계정의 트레이너 이름, 아직 없으면 "내 기록",
   누르면 그 이름의 기록 시트(로그아웃도 거기 있다). Supabase가 없는 개발 서버에는 서지 않는다. */
function AccountButton({ onNavigate }) {
  const [signed, setSigned] = useState(visitorSignedIn);
  const [link, setLink] = useState(null);
  useEffect(() => {
    let on = true;
    const sync = () => {
      const now = visitorSignedIn();
      setSigned(now);
      if (!now) { setLink(null); return; }
      accountsReady().then(ok => (ok ? myPlayerLink() : null)).then(row => { if (on) setLink(row); }, () => {});
    };
    sync();
    window.addEventListener(VISITOR_EVENT, sync);
    return () => { on = false; window.removeEventListener(VISITOR_EVENT, sync); };
  }, []);
  if (!accountsEnabled()) return null;
  const named = signed && link && link.status !== "rejected" ? link.requested_name : "";
  // a door with an address is a link to it (DESIGN.md "Panels" 3)
  const to = { tab: "trainer", me: "1", ...(named && link.player_id ? { trainer: named } : {}) };
  /* in or out, Google's G and one word on the bar: 로그인, then the trainer name (내 기록 until one is linked). 2026-11-23, the owner's
     draft A: the first letter's inverted square beside the name read 이 이제빈, "너무 못생겼어" */
  const label = named ? `${named}, 내 기록` : signed ? "내 기록, 구글 계정으로 로그인됨" : "로그인, 구글 계정으로 내 기록 연결";
  return <a href={viewHref("records", to)} className="acct" onClick={follow(() => onNavigate("records", to))} aria-label={label}>
    <GoogleMark />
    <span className="acct-name">{signed ? (named || "내 기록") : "로그인"}</span>
  </a>;
}

/* 바는 바탕 톤에 아래 머리카락 선 하나, 움직이지 않는다. 폰은 Wing Y와 워드마크, 오른쪽 끝에 테마 버튼.
   데스크톱(860 이상)은 1200 안에 브랜드, 화면 이름(지금 화면은 아래 2px 선), 테마 버튼. 넓은 데스크톱은 더보기가 없어
   관리자 로그인이 바닥글에 선다(SiteFooter). 테마 버튼은 바꿀 쪽을 보인다: 다크에서는 해, 라이트에서는 달. */
export default function SiteHeader({ view, onNavigate, dark, onToggleTheme, moreOpen, onMore, live = null }) {
  const wide = useWideNav();
  const cur = tabOf(view, wide);
  const navRef = useSlideLine(`${cur}:${wide}`);
  const themeLabel = dark ? "라이트 테마로 바꾸기" : "다크 테마로 바꾸기";
  return (
    <header className="topbar">
      <a href={viewHref("home")} className="brand" onClick={follow(() => onNavigate("home"))} aria-label="YPL 홈으로">
        <BrandMark size={20} /><Wordmark />
      </a>
      <nav className="navlinks" aria-label="주요 메뉴" ref={navRef}>
        {(wide ? WIDE_TABS : TABS).map(([key, label]) => key === "more"
          ? <button key={key} type="button" className="navlink" data-tab={key} {...current(cur, key)} aria-haspopup="menu" aria-expanded={moreOpen}
            onClick={e => onMore(e.currentTarget)}>{label}</button>
          : <a key={key} href={viewHref(key)} className="navlink" data-tab={key} {...current(cur, key)}
            onClick={follow(() => onNavigate(key))}>{key === "bracket" && live && <i className="lamp sig" aria-hidden="true" />}{label}</a>)}
      </nav>
      <AccountButton onNavigate={onNavigate} />
      {/* the lamp's fixture: its housing is dark until something is live; on event day it lights with its word and opens the bracket */}
      {live
        ? <a href={viewHref("bracket")} className="onair t12" onClick={follow(() => onNavigate("bracket"))} aria-label={`${live.name} 진행 중, 대진표 보기`}><i className="lamp sig" aria-hidden="true" />진행 중</a>
        : <i className="lamp unlit onair-off" aria-hidden="true" />}
      <button type="button" className="iconbtn theme-btn" onClick={onToggleTheme} aria-label={themeLabel}>
        <Icon key={dark ? "sun" : "moon"} n={dark ? "sun" : "moon"} size={24} />
      </button>
    </header>
  );
}
