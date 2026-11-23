import React from "react";
import { Icon } from "../components/index.js";
import { SectionHead } from "../components/common/Board.jsx";
import Button from "../components/common/Button.jsx";
import { DISCORD_URL } from "../components/layout/SiteHeader.jsx";

/* ============================== ABOUT ==============================
   Draft 1C (2026-11-19, the owner's pick): joining is the big screen, since the first question of someone arriving from the Discord is
   "can I play": the league's name at 32 with its facts as spec rows and ↗ 디스코드 참여 as the main action, and the two steps after it
   as doors in the 439. Then the season's flow as one inverted strip, the history as four stops in a row (now inverted), and the
   competitions beside the leagues, each with its tag. Neighbours never share a size and a form (Composing a screen 25). */
const STEPS = [
  { t: "공지에서 신청", d: "대회 공지의 신청 버튼으로 참가합니다.", cta: "공지 보기", to: "news" },
  { t: "공식 파티 제출", d: "대회 시작 전까지 사이트에서 파티를 제출합니다.", cta: "팀 빌더 열기", to: "builder" },
];
const FLOW = ["매월 파이컵", "포인트 누적", "챔피언스 시리즈", "시즌 챔피언"];
// 날짜는 읽는 글자다. 기간은 "2023년 – 2025년"처럼 띄운 반각 대시로 잇고, 한 덩어리로 끊기지 않는다.
const TIMELINE = [
  { when: "2023년 5월", title: "파이컵 탄생", body: "포센연이 자체 대회인 파이컵을 처음 열었습니다." },
  { when: "2023년 – 2025년", title: "매달 이어진 도전", body: "파이컵이 매월 정규 대회로 열렸습니다." },
  { when: "2025년 6월", title: "YPL 체제 출범", body: "마스터 리그와 루키 리그로 나뉘었습니다." },
  { when: "2026년 9월", title: "YPL 시즌 3 개막", body: "신청과 파티 제출을 이 사이트에서 받습니다." },
];
const COMPS = [
  { name: "파이컵", tag: "매월 정규 대회", lit: true, desc: "여기서 얻은 포인트로 챔피언스 시리즈 출전권에 도전합니다." },
  { name: "파이컵 라이트", tag: "번개 대회", desc: "포인트가 없고 자체 상품을 겁니다." },
  { name: "챔피언스 시리즈", tag: "학기 최강전", desc: "그 학기의 챔피언을 가리는 대회입니다." },
];
const LEAGUES = [
  { name: "마스터 리그", tag: "상위 정규 리그", lit: true },
  { name: "루키 리그", tag: "입문 정규 리그", desc: "우승하면 마스터 리그로 올라가고 ‘슈퍼루키’ 칭호를 얻습니다." },
];

/* a competition or a league: its name, its kind as a tag after it (Composing a screen 20: a league as the type's tag), one line under */
const Kinds = ({ items }) => <div className="stack">{items.map(c => (
  <div key={c.name} className="pn ab-kind">
    <span className="ab-kind-head"><b className="t15">{c.name}</b><span className={"tb-type ab-tag" + (c.lit ? " lit" : "")}>{c.tag}</span></span>
    {c.desc && <p className="read">{c.desc}</p>}
  </div>))}</div>;

export default function AboutPage({ go }) {
  return (<section className="about">
    <h1 className="t32">소개</h1>

    <div className="stack ab-screen">
      <section className="pn ab-lead" aria-labelledby="ab-name">
        {/* the first of the steps: the steps beside it count on from 2 */}
        <span className="num t20 ab-n">1</span>
        <span className="t12 dim">YPL, Yonsei Pokémon League</span>
        <b className="t32 ab-name" id="ab-name">포센연의 배틀 리그</b>
        <dl className="stack ab-spec">
          <div className="pn2"><dt className="t12 dim">첫 대회</dt><dd className="t15">2023년 5월, 파이컵</dd></div>
          <div className="pn2"><dt className="t12 dim">리그</dt><dd className="t15">마스터 리그, 루키 리그</dd></div>
        </dl>
        <Button variant="main" icon="ext" href={DISCORD_URL} target="_blank" rel="noreferrer">디스코드 참여</Button>
      </section>
      {/* the steps after joining the Discord, each a door to where it is done */}
      <ol className="stack ab-steps" start={2}>
        {STEPS.map((s, i) => (
          <li key={s.t} className="pn ab-step">
            <span className="num t20 ab-n">{i + 2}</span>
            <b className="t15">{s.t}</b>
            <p className="read">{s.d}</p>
            <button type="button" className="ab-go t12" onClick={() => go?.(s.to)}><Icon n="arrow" size={16} />{s.cta}</button>
          </li>
        ))}
      </ol>
    </div>

    <section className="ab-sec" aria-labelledby="ab-flow">
      <SectionHead id="ab-flow" title="시즌의 흐름" />
      <ol className="inv ab-flow">{FLOW.map(t => <li key={t} className="t15">{t}</li>)}</ol>
    </section>

    <section className="ab-sec" aria-labelledby="ab-time">
      <SectionHead id="ab-time" title="리그 연혁" />
      <ol className="stack ab-times">
        {TIMELINE.map((t, i) => (
          <li key={t.when} className={(i === TIMELINE.length - 1 ? "inv" : "pn") + " ab-time"}>
            <span className="num t15 ab-when">{t.when}</span>
            <b className="t15">{t.title}</b>
            <p className="read">{t.body}</p>
          </li>
        ))}
      </ol>
    </section>

    <div className="ab-two">
      <section className="ab-sec" aria-labelledby="ab-comps">
        <SectionHead id="ab-comps" title="세 가지 대회" />
        <Kinds items={COMPS} />
      </section>
      <section className="ab-sec" aria-labelledby="ab-leagues">
        <SectionHead id="ab-leagues" title="정규 리그" />
        <Kinds items={LEAGUES} />
      </section>
    </div>
  </section>);
}
