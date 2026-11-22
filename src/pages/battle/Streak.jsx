/* 연승 도전 (docs/BATTLE_STREAK.md 8장, DESIGN.md "Layout and pages" 연승 도전): the battle page's tab, what a game of a run has at
   stake while it is played, and what it says when it ends. A run climbs floors of five games, the fifth the floor's gatekeeper
   (src/services/streak.js), and the run is shown as the tower itself (tower.js; 2026-11-10, the user: the lift's hall was "너무
   단순해. 전광판 숫자만 반복되는 느낌"): the tab's stage is the tower seen from its foot, beside it the run's streak; going into a
   game is a scene on that tower, in through the door of the game. Its games are played as any server battle (BattleRoom), and the battle function answers as the computer; what a game's
   answer says of the run is kept with the seat (battleService.js). No gatekeeper is drawn before its game (2026-11-09, the user:
   "실루엣들이 뭔가 어정쩡하게 있다"): a gatekeeper's game is told by inverted doors and the floor's last game, and the gatekeeper is
   met on the team preview. */
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import Button from "../../components/common/Button.jsx";
import Icon from "../../components/common/Icon.jsx";
import Modal from "../../components/common/Modal.jsx";
import ErrorNote from "../../components/common/ErrorNote.jsx";
import Seg from "../../components/common/Seg.jsx";
import { Bar, Counter, Dock, Row, SectionHead, Toast } from "../../components/common/Board.jsx";
import StandTable from "../../components/common/StandTable.jsx";
import { siteConfirm } from "../../components/common/SiteDialog.jsx";
import { GoogleMark } from "../../components/layout/SiteHeader.jsx";
import { currentStreakGame, keepStreakDraft, keepStreakResume, keepStreakStart, readBattleRow, readSeat, readStreakDraft, streakNextGame, viewBattle, warmBattle } from "../../services/battleService.js";
import { pickStreakDraft, readDailyBoard, readMyStreakRuns, resumeStreakRun, readStreakBoard, signInWithGoogle, startStreakRun } from "../../services/visitorAuth.js";
import { formatDate } from "../../services/dateFormat.js";
import { STREAK_LIVES, STREAK_STEP, floorGame, gameWords, streakFloor, streakMaster, swapParty, swapTier } from "../../services/streak.js";
import { nameOf } from "./Stage.jsx";
import { DUR, EASE_IN, EASE_OUT, STAGGER, climb, place, reduced } from "../../components/common/motion.js";
import { ALIGNMENTS, STAT_KEYS, calculatedStat, onSpriteError, spriteUrl } from "../../services/teamBuilderCore.js";
import { josa, toID } from "../../services/battleLog.js";
import { drawTower, standTower, towerBreak, towerDive, towerDrop, towerShow } from "./tower.js";
import { MonCard } from "./Sets.jsx";
import { centreInk } from "../../components/common/inkCentre.js";
import { useAccount } from "../../components/common/useMe.js";
import { CupBoard, CupList, CupMake, askedCup, showCupInAddress, useCups } from "./Cups.jsx";
import { useMusic } from "./music.js";

// the board's months are the run's months in KST, as the database counts them: "2026-11-01"
const monthOf = back => {
  const kst = new Date(Date.now() + 9 * 3600e3);
  const now = kst.getUTCFullYear();
  let y = now, m = kst.getUTCMonth() + 1 - back;
  while (m < 1) { m += 12; y -= 1; }
  return { key: `${y}-${String(m).padStart(2, "0")}-01`, label: y === now ? `${m}월` : `${y}년 ${m}월` };
};
/* the boards kept (2026-11-22: only this month and the last could be seen, though every run stays): back through each month since the
   tower's rules were reset (2026-11-11, docs/BATTLE_STREAK.md 14장), then round to this month again */
const FIRST_MONTH = { y: 2026, m: 11 };
const monthsKept = () => {
  const kst = new Date(Date.now() + 9 * 3600e3);
  return Math.max(1, (kst.getUTCFullYear() - FIRST_MONTH.y) * 12 + kst.getUTCMonth() + 1 - FIRST_MONTH.m);
};
// today in KST as the database writes a 오늘의 탑 run's day: "2026-11-13"
const kstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
// the month's board, read once at a game's end to know whether the run is the account's best this month (null while read or when it cannot be)
function useBoard(daily = false) {
  const [board, setBoard] = useState(null);
  useEffect(() => { let on = true; (daily ? readDailyBoard() : readStreakBoard()).then(rows => on && setBoard(rows), () => {}); return () => { on = false; }; }, [daily]);
  return board;
}

/* 연승 도전 shows no 난이도 anywhere (2026-11-09, the user: "난이도 표기 자체를 연승 도전에서는 없애자"): the computer still plays each
   floor at its own (streak.js streakStep), but the screens say only the floor and its games */

/* a floor's five games as one bar cut on the seam (the tower draws the same as a floor's five doors, tower.js): won lit, the game being played the
   amber lamp's colour, the next one while the run rests at .382, a lost one muted, the rest an unlit bar's light. at: the game, 1 to 5 */
export function TrackBar({ at, playing = false, lost = false, mini = false }) {
  return <span className={"streak-track-bar" + (mini ? " mini" : "")} aria-hidden="true">
    {Array.from({ length: STREAK_STEP }, (_, i) => <i key={i} data-step={i + 1} className={i + 1 < at ? "won" : i + 1 === at ? (lost ? "lost" : playing ? "now" : "next") : ""} />)}
  </span>;
}
/* the run's lamps (DESIGN.md 도전의 탑, The run's lamps, 2026-11-10; two since 2026-11-11, the second the spare a gatekeeper lights):
   lit while left and its housing once out or not yet earned, at the right end of the line that names the game. lives: the lamps left; none drawn while the database does not say them (before the lamps'
   SQL has run a run still ends on its first lost game) */
export function RunLamps({ lives }) {
  if (lives == null) return null;
  return <span className="streak-lamps" role="img" aria-label={`남은 램프 ${lives}개`}>
    {Array.from({ length: STREAK_LIVES }, (_, i) => <i key={i} className={"lamp" + (i < lives ? "" : " unlit")} />)}
  </span>;
}
/* the floor as its number in segments and its track. wins: the games won; lost: the run ended on the next game */
function FloorTrack({ wins, lost = false, playing = false }) {
  const floor = streakFloor(wins), at = floorGame(wins);
  return <span className="streak-track" role="img" aria-label={`${floor}층, ${STREAK_STEP}판 가운데 ${at - 1}판 이김`}>
    <Seg value={String(floor)} h={32} cells={String(floor).length} label="" />
    <TrackBar at={at} lost={lost} playing={playing} />
  </span>;
}

/* the tower on the tab (tower.js): the stage's place holds the run's own scene, the tower in its place at night, the camera before
   the door of the game the run will go to, the doors won lit down the road behind it and the month's other climbers marked where
   they stand. Pressing the key plays the going in on this very picture. climbers: { name, wins, live } */
/* ready: the run, the board and the account are read. The tower comes in once, on where the run truly stands: drawn before, it came in
   on an empty run and played again as the run and the board arrived (2026-11-19, the user: "탑 등장 애니메이션 ... 그 이후에 또 다시
   애니메이션이 반복되고 ... 하나로 통일해줘"). Once standing, what changes after is the scene's own move (standTower) */
function TowerHall({ wins, live, climbers = null, ready = true }) {
  const ref = useRef(null);
  const floor = streakFloor(wins), at = floorGame(wins);
  const key = `${floor}|${at}|${live}|${JSON.stringify(climbers || [])}|${ready}`;
  useLayoutEffect(() => {
    const el = ref.current, draw = () => { if (ready || el.tower) standTower(el, { floor, at, live, climbers }); };
    draw();
    const seen = new ResizeObserver(draw);
    seen.observe(el);
    return () => seen.disconnect();
  }, [key]);
  return <div ref={ref} className="tw tw-hall" role="img" aria-label={`${floor}층 ${gameWords(wins)}`} />;
}

/* the opening draft (2026-11-11, docs/BATTLE_STREAK.md 13장), in steps (rebuilt the same day, the user: "내가 어떤 포켓몬을 어떻게 얼마나
   선택할 수 있는지, 특정 포켓몬을 선택했을 때 고르지 못하게 되는 포켓몬이 있는데 기준이 무엇인지 전혀 알 수 없어 ... 구구절절 설명을 하지
   않더라도 사용자가 직관적으로 규칙을 알 수 있어야 해", and "i 버튼을 누르지 않더라도 바로 확인", "여러 단계로 나눠서"). The rule is
   drawn, not written:
   - how many: the party's six places stand as a strip over everything, empty ones numbered, so six is seen before anything is chosen;
   - how: one place a step, the step's three candidates side by side as whole sets (picture, name, types, ability, item, four moves),
     so nothing is chosen blind; choosing one lights it into its place and the next step's three rise in its stead; a place in the
     strip goes back to its step;
   - one place at a time (2026-11-18, the user: "뒤에 나올 슬롯은 미리 고르지 못하게 해줘. 그래야 더 긴장감 있을 것 같아"): a place not
     reached yet stands off and cannot be opened, so the next three are seen only when their turn comes; a place already chosen opens
     again, and choosing there leaves the later ones as they are (every candidate holds an item no other does, so nothing chosen
     changes another);
   - the Mega: a Mega candidate carries the Mega emblem, and so does its place once chosen. Megas may be many (the same day, "메가진화를
     하나만 허용하는 게 이해가 안 돼"); the one place of their own and the Megas standing off are gone */
const MEGA = "/brand/mega-evolution.png";
/* a set's six stats at level 50 (the stat points and the nature it carries, as the team builder counts them; with neither, the
   species' own at level 50); null without its base stats */
const STAT_WORD = { hp: "HP", atk: "공격", def: "방어", spa: "특공", spd: "특방", spe: "스피" };
const BAR_TOP = 230;
export function statsAt50(res, species, evs = {}, nature = "") {
  const base = res?.detail?.pokedex?.[toID(species)]?.baseStats;
  if (!base) return null;
  const alignment = ALIGNMENTS.find(a => a.id === toID(nature));
  return Object.fromEntries(STAT_KEYS.map(k => [k, calculatedStat(base[k], evs?.[k] || 0, k, alignment)]));
}
/* the six as bars on their tracks (the info sheet's bar form): the word, the bar, the number. other: the stats it is held against,
   so the higher of each pair stands lit and the lower dim (the trade, 2026-11-16 draft A) */
function StatBars({ stats, other = null }) {
  if (!stats) return null;
  return <span className="streak-stats" role="img" aria-label={STAT_KEYS.map(k => `${STAT_WORD[k]} ${stats[k]}`).join(", ")}>
    {STAT_KEYS.map(k => {
      const n = stats[k], o = other?.[k];
      return <span key={k} className={"streak-stat" + (o == null || o === n ? "" : n > o ? " up" : " down")}>
        <small>{STAT_WORD[k]}</small>
        <Bar value={n / BAR_TOP} />
        <b>{n}</b>
      </span>;
    })}
  </span>;
}
/* pictures a coming scene will show, decoded and their ink read (inkCentre.js) in idle moments before it, so the scene never reads
   them while it moves (2026-11-18: the doors' twelve read on the break's last beat held frames of 117 ms at a phone's speed) */
const idle = f => (typeof requestIdleCallback === "function" ? requestIdleCallback(f) : setTimeout(f, 60));
export function readAhead(species) {
  for (const sp of species || []) {
    const im = new Image();
    im.src = spriteUrl(sp);
    im.decode().then(() => idle(() => centreInk(im)), () => {});
  }
}
/* a step's three come face down and turn over one after another (2026-11-18, the owner's draft B, Task 9): each card folds to its edge
   over its plain back (150) and opens on its face (150), 140 after the one before. Under reduced motion they stand turned */
const FOLD = 150, TURN_STEP = 140;
function turnOver(row) {
  if (!row || reduced() || typeof row.animate !== "function") return;
  const cards = [...row.children], backs = cards.map(card => {
    const back = document.createElement("i");
    back.className = "streak-back";
    back.setAttribute("aria-hidden", "true");
    card.append(back);
    return back;
  });
  // the faces are decoded and placed (their ink read on load) while the backs stand still, then they turn
  const faces = cards.map(c => c.querySelector("img")?.decode().catch(() => {}));
  Promise.race([Promise.all(faces), new Promise(r => setTimeout(r, 900))]).then(() => requestAnimationFrame(() => cards.forEach((card, i) => {
    const back = backs[i];
    card.animate([{ transform: "perspective(900px) rotateY(0deg)" }, { transform: "perspective(900px) rotateY(90deg)" }], { duration: FOLD, delay: i * TURN_STEP, easing: EASE_IN, fill: "backwards" })
      .finished.then(() => {
        back.remove();
        card.animate([{ transform: "perspective(900px) rotateY(-90deg)" }, { transform: "none" }], { duration: FOLD, easing: EASE_OUT });
      }, () => back.remove());
  })));
}
/* the chosen card stays lit and the other two go off; its picture switches on in its place in the row (place, the site's arrival),
   nothing flies (2026-11-18, the user: a copy of the picture flew up into the numbered place, "너무 구려") */
function travel(row, species) {
  const card = [...(row?.children || [])].find(c => c.dataset.species === species);
  if (card) for (const c of row.children) c.classList.toggle("off", c !== card);
}
export function DraftBoard({ res, draft, picks, onPick }) {
  // the first place not chosen: the furthest a run's draft has come (the last when all six are)
  const open = () => { const i = draft.findIndex((_, k) => !picks[k]); return i < 0 ? draft.length - 1 : i; };
  const [step, setStep] = useState(open);
  const strip = useRef(null), cards = useRef(null), next = useRef(0);
  // switching on: the strip's places one after another, then each step's three turning over (turnOver)
  useLayoutEffect(() => { place([...(strip.current?.children || [])], { step: STAGGER.row }); }, []);
  useLayoutEffect(() => turnOver(cards.current), [step]);
  // the next place's three are read while this step's stand turned, so they turn over without a wait
  useEffect(() => { const t = setTimeout(() => readAhead(draft[step + 1]?.map(c => c.species)), FOLD * 2 + TURN_STEP * 2); return () => clearTimeout(t); }, [step]);
  useEffect(() => () => clearTimeout(next.current), []);
  // a place newly filled lights its picture where it stands
  const had = useRef(picks);
  useLayoutEffect(() => {
    const was = had.current;
    had.current = picks;
    picks.forEach((sp, k) => { if (sp && sp !== was[k]) place(strip.current?.children[k]?.querySelector("img")); });
  }, [picks]);
  const reached = open();
  const megaOf = k => draft[k]?.find(c => c.species === picks[k])?.mega;
  const choose = species => {
    const was = picks[step] === species;
    if (!was) travel(cards.current, species);
    else for (const c of cards.current?.children || []) c.classList.remove("off");
    onPick(step, species);
    clearTimeout(next.current);
    if (was) return;
    // the chosen one lights in its place, and after a beat the next empty place's step comes up
    const after = draft.findIndex((_, k) => k !== step && !picks[k]);
    if (after >= 0) next.current = setTimeout(() => setStep(after), DUR.light);
  };
  const done = picks.filter(Boolean).length;
  return <section className="streak-draft" aria-labelledby="streak-draft-title">
    <div className="pn streak-trades-title"><b id="streak-draft-title">파티 고르기</b><span className="t12 dim">{done} / {draft.length}</span></div>
    <div className="stack streak-party" ref={strip}>
      {draft.map((_, k) => {
        const sp = picks[k], shut = !sp && k > reached;
        return <button key={k} type="button" disabled={shut} className={"streak-slot" + (sp ? " full" : "") + (k === step ? " now" : "")} aria-current={k === step ? "step" : undefined}
          aria-label={`${k + 1}번째 자리${sp ? `, ${nameOf(res, sp)}` : ""}`} onClick={() => { clearTimeout(next.current); setStep(k); }}>
          {sp ? <img src={spriteUrl(sp)} alt="" draggable="false" onError={onSpriteError()} /> : <span>{k + 1}</span>}
          {megaOf(k) && <img className="streak-mega-mark" src={MEGA} alt="" draggable="false" />}
        </button>;
      })}
    </div>
    <div key={step} ref={cards} className="stack streak-draft-row" role="radiogroup" aria-label={`${step + 1}번째 자리`}>
      {draft[step].map(c => {
        const on = picks[step] === c.species;
        return <span key={c.species} data-species={c.species} className={"streak-pick" + (picks[step] && !on ? " off" : "")}>
          <MonCard res={res} species={c.species} ability={c.ability} item={c.item} moves={(c.moves || []).map(id => ({ id, pp: "" }))} compact
            pick={{ order: on ? step + 1 : 0, onPick: () => choose(c.species) }} />
          {/* its six at level 50 on tracks under the moves, part of the card: a tap on them chooses it as the card does (2026-11-16 draft B) */}
          <span className={"streak-pick-stats" + (on ? " on" : "")} onClick={() => choose(c.species)}>
            <StatBars stats={statsAt50(res, c.species, c.evs, c.nature)} />
          </span>
          {c.mega && <img className="streak-mega-mark" src={MEGA} alt="메가진화" draggable="false" />}
        </span>;
      })}
    </div>
  </section>;
}

/* the doors to the next game (2026-11-11, 13장): two doors, each with the six behind it as a team preview shows them (the even foe
   and the strong one, its computer a step up, which lets the trade reach a tier up when beaten), or one shut door, the gatekeeper's,
   which lights the spare lamp. 15장: behind a door stands a party built for it (towerBuild.mjs); no season or rank is shown (2026-11-11,
   the user: "상대 파티 순위 표시는 불필요하므로 UI에서 완전히 제거").
   Each door says what it gives beside its name, in nouns, so the choice reads as the trade-off it is (2026-11-11, the user: "보통 상대
   강한 상대도 뭐 어쩌라는 건지 와닿는 게 하나도 없어"): the gate 램프 +1 and 교환 승급, the strong door 교환 승급 (14장), the even one 없음, each after the
   same dim 보상 so the two doors read as one line compared (2026-11-11, the user chose draft C over the hairline chips).
   One is chosen, inverted; the key goes through it */
export function DoorPick({ res, doors, value, onChange }) {
  if (!doors?.length) return null;
  const word = { even: "보통 상대", hard: "강한 상대", gate: "수문장" };
  /* no strip of its own over the doors (2026-11-11: with it the break ran past a phone's stage and the trades lost their last row):
     each door names itself. The even door is blue and the strong one red, the whole door when chosen (no bar on its edge)
     (2026-11-11, the user: "약한 상대는 푸른 계열, 강한 상대는 붉은 계열"), in the water and fire type colours the site already has */
  return <section className="streak-doors" aria-label="다음 상대">
    <div className={"stack streak-door-row" + (doors.length === 1 ? " one" : "")} role="radiogroup" aria-label="다음 상대">
      {doors.map((d, i) => <button key={d.kind} type="button" role="radio" aria-checked={value === i} onClick={() => onChange(i)}
        className={"streak-door" + (d.kind === "gate" ? " inv" : (d.kind === "hard" ? " type-fire" : " type-water") + (value === i ? " on" : " pn"))}>
        <span className="streak-door-head"><b>{word[d.kind]}</b></span>
        <span className="streak-door-gain" aria-label={d.kind === "even" ? "보상 없음" : d.kind === "hard" ? "이기면 교환 승급" : "이기면 램프 하나와 교환 승급"}>
          <span className="streak-gain-k" aria-hidden="true">보상</span>
          {d.kind === "even" ? <span className="streak-gain none">없음</span>
            : <>{d.kind === "gate" && <span className="streak-gain"><i className="lamp" aria-hidden="true" />램프 +1</span>}<span className="streak-gain">교환 승급</span></>}
        </span>
        {/* the six as their pictures alone (2026-11-18, the user: the type squares under them were "상당히 무의미") */}
        {d.species.length > 0 && <span className="streak-door-six">{d.species.map(s => <span key={s} className="streak-door-mon">
          <img src={spriteUrl(s)} alt={nameOf(res, s)} draggable="false" onError={onSpriteError()} />
        </span>)}</span>}
      </button>)}
    </div>
  </section>;
}

/* a game of a run, beside it while it is played (the menu): which game, the streak riding on it lit at 32 with its unit, and the
   floor's track joined under it. A floor's gatekeeper inverts. wins: the games won before it */
export function StreakStake({ wins, lives = null }) {
  const master = streakMaster(wins);
  return <div className="stack streak-stake">
    <div className={(master ? "inv" : "pn") + " streak-stake-head"}>
      <span className="t12 dim streak-named">{gameWords(wins)}<RunLamps lives={lives} /></span>
      <span className="streak-stake-board"><Seg value={String(wins)} h={32} cells={2} label={`${wins}연승`} /><span className="t15">연승</span></span>
    </div>
    <div className="pn streak-stake-track"><FloorTrack wins={wins} playing /></div>
  </div>;
}

/* the stake on a run's team preview (DESIGN.md 연승 도전, Floors and the stake, 2026-11-09): a band over the foe's six, the game and
   the streak riding on it, inverted on a gatekeeper's game, where the gatekeeper's cell among the six inverts with it (battle.css) */
export function StreakBand({ wins, lives = null }) {
  const master = streakMaster(wins);
  return <div className={(master ? "inv" : "pn") + " streak-band"}>
    <b className="t15 streak-named">{gameWords(wins)}<RunLamps lives={lives} /></b>
    <span className="streak-stake-board"><Seg value={String(wins)} h={32} cells={2} label={`${wins}연승`} /><span className="t15">연승</span></span>
  </div>;
}

/* the battle function kept warm while a key that calls it stands (연승 도전 시작, 이어서 하기, 다음 판, 다시 도전), as a battle room
   keeps it warm while its player thinks: a run started on a cold worker waited 3.9 s against 1.1 s warm (2026-11-09). A worker
   lives about 75 seconds, so every 45 while the page is in view */
function useWarm(on) {
  useEffect(() => {
    if (!on) return undefined;
    const warm = () => { if (document.visibilityState === "visible") void warmBattle(); };
    warm();
    const timer = setInterval(warm, 45_000);
    return () => clearInterval(timer);
  }, [on]);
}

// this visitor's account, kept current as they sign in and out: undefined while read, null signed out, else { requested_name, status }
export { useAccount };

/* this device's run, read again from its game: playing (a game on), resting (the game ended and the run goes on: won, or lost with a
   lamp left; the next game not yet opened), or none (null). A game that ended while its player was away (the clock) has told its
   seat nothing, so the seat asks once (viewBattle keeps the run's answer) */
/* undefined while it is read (for the seen it was asked for, so a read again is never answered by the last one), null for none */
function useRun(daily = false, seen = 0) {
  const ask = `${daily}|${seen}`;
  const [got, setGot] = useState(null);
  useEffect(() => {
    let on = true;
    const put = run => { if (on) setGot({ ask, run }); };
    const id = currentStreakGame(daily);
    const seat = id && readSeat(id);
    // a 오늘의 탑 run of an earlier day is over for the tab (2026-11-13): it stood in the way of today's, with no key to leave it
    if (!seat || (daily && seat.daily && String(seat.daily) < kstToday())) { put(null); return undefined; }
    const of = (s, playing) => ({ id, wins: s.wins ?? 0, lives: s.lives, game: s.game ?? (s.wins ?? 0) + 1, playing, party: s.party || null, doors: playing ? null : s.doors || null });
    readBattleRow(id).then(async row => {
      if (row?.status === "active") { put(of(seat, true)); return; }
      if (row?.status !== "ended") { put(null); return; }
      if (typeof seat.won !== "boolean") await viewBattle(id).catch(() => {});
      const told = readSeat(id);
      put(typeof told?.won === "boolean" && !told.ended ? { ...of(told, false), again: !told.won } : null);
    }, () => put(null));
    return () => { on = false; };
  }, [daily, seen]);
  return got?.ask === ask ? got.run : undefined;
}

/* going into a game of a run is a scene on the tower (tower.js): it switches on over the stage the key was pressed under (on the tab
   it already stands), the game just won lights and the lamp steps on, or the lift rises a floor after a gatekeeper, all while the
   game is made and read; then the camera walks in through the lamp's door into its dark, and the next screen comes up out of it
   (BattlePage.jsx useMatchLit). wins: the wins before the game gone into; null (a game being played, gone back into) plays nothing.
   again: a lost game gone into again, where no door was won.
   Returns shown (the tower has been read, and the court is dark) and leave (in through the door while the screen goes out; with
   no scene, the screen's own going out, leaveNow) */
export const floorCall = (dark, scope, wins, leaveNow = async () => {}, again = false) => {
  if (wins == null) return { shown: dark, leave: leaveNow };
  const shown = towerShow(document.querySelector(`${scope} .tw-hall`) || document.querySelector(`${scope} .bt-stagebox`), {
    floor: streakFloor(wins), at: floorGame(wins), climbing: !again && wins > 0 && floorGame(wins) === 1, master: streakMaster(wins), again,
  });
  return { shown: Promise.all([dark, shown]).catch(() => {}), leave: towerDive };
};

/* the run lit: its streak at 84 (this device's run while it goes on, else the account's best of the month or the day). No line
   explains the rule; the tower beside it shows it. With nothing of one's own it is not drawn (2026-11-18, the owner: "의미 없이
   낭비되는 공간을 최소화"): the month's first place stood here and was read twice, here and on the podium under it, and before that a
   dark cell stood for a number never played */
function RunBoard({ run, best, approved, daily = false }) {
  const value = run ? run.wins : approved && best ? best : null;
  if (value == null) return null;
  const label = run ? gameWords(run.wins) : daily ? "오늘 내 기록" : "이번 달 내 최고 기록";
  return <div className="pn streak-hero">
    <span className="t12 dim streak-named"><span className="streak-hero-label">{run && <i className="lamp sig" aria-hidden="true" />}{label}</span>{run && <RunLamps lives={run.lives} />}</span>
    <span className="streak-hero-board"><Seg value={String(value)} h={84} cells={2} label={`${value}연승`} /><span className="t20">연승</span></span>
  </div>;
}

export function StreakOpen({ res, onOpen, go, tabs, enter, goingIn, standUp, leaveNow = async () => {}, onPractice = null }) {
  const account = useAccount();
  /* one kind of run, the month's, ranked by the month: 오늘의 탑 was taken off on 2026-11-19 (the owner: "오늘의 탑도 그냥 없애줘. 도전의 탑
     이번 달로만 남기자"). The battle function still knows a daily run, so a device in the middle of one finishes it on the play screen */
  const daily = false;
  /* seen: this device's run and draft read again, when another tab of it changes them (a draft picked in one tab left the others
     showing it, and their 출발 was refused) or when the battle function says the draft is gone */
  const [seen, setSeen] = useState(0);
  const run = useRun(daily, seen);
  const [draft, setDraft] = useState(() => readStreakDraft(false));
  const [picks, setPicks] = useState([]);
  const [door, setDoor] = useState(0);
  // the hall stands again (in place of the draft) while the first game is gone into, so the going in plays on the tower
  const [entering, setEntering] = useState(false);
  const [back, setBack] = useState(0);
  const [board, setBoard] = useState(undefined);
  // 다시 불러오기 under a board that failed to read asks for it again
  const [boardAsked, setBoardAsked] = useState(0);
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState(false);
  const [error, setError] = useState("");
  // a refusal after the court went dark stands it up again, lit
  const [round, setRound] = useState(0);
  const [cup, setCup] = useState(askedCup);
  const [making, setMaking] = useState(false);
  const [cupsAsked, setCupsAsked] = useState(0);
  const cups = useCups(`${cupsAsked}|${account?.status}`);
  const month = monthOf(back), nextBack = back < monthsKept() ? back + 1 : 0, other = monthOf(nextBack);
  useEffect(() => { setDraft(readStreakDraft(daily)); setPicks([]); setDoor(0); setError(""); }, [daily]);
  useEffect(() => {
    const changed = e => { if (!e.key || e.key.startsWith("ypl-battle:")) setSeen(n => n + 1); };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  useEffect(() => {
    if (!seen) return;
    const next = readStreakDraft(daily);
    if (next?.run?.run_id !== draft?.run?.run_id) setPicks([]);
    setDraft(next);
  }, [seen]);
  useEffect(() => {
    let on = true;
    setBoard(undefined);
    (daily ? readDailyBoard() : readStreakBoard(back ? month.key : undefined)).then(rows => on && setBoard(rows), () => on && setBoard(false));
    return () => { on = false; };
  }, [back, daily, account?.status, boardAsked]);
  const approved = account?.status === "approved";
  useWarm(approved);
  // the run as the server holds it, so a run started or picked elsewhere is shown here (and 새로 도전 asks before ending it)
  // the seat's token goes with the game it names, so a seat another device has taken since is given back (2026-11-13)
  /* synced (2026-11-16): the keys wait for the server's answer, so a run this device only remembers (ended, or moved on elsewhere)
     is never offered; with no answer (offline) the device's own stands */
  const [synced, setSynced] = useState(false);
  const sync = () => resumeStreakRun(daily, currentStreakGame(daily), readSeat(currentStreakGame(daily))?.token ?? "").then(made => { if (keepStreakResume(made, daily)) setSeen(n => n + 1); }, () => {}).then(() => setSynced(true));
  useEffect(() => { setSynced(false); if (approved) sync(); }, [approved, daily]);
  const wins = run?.wins ?? 0;
  const rows = Array.isArray(board) ? board : null;
  const mine = back ? null : rows?.find(r => r.mine);
  // the draft waits only while no run of its kind is on (a run started on another device leaves this one's stale)
  const drafting = approved && run === null && draft?.draft?.length ? draft.draft : null;
  // the tower's music while a run is chosen (the draft, the doors); the tab at rest is silent
  useMusic(drafting || (run && !run.playing && run.doors) ? "tower" : null);
  const doneToday = daily && !run && !drafting && Boolean(mine);
  // going in, as the lobby does: the court goes dark while the game is made and read, then its screen lights
  const goInto = async (make, next, again = false) => {
    if (busy) return;
    setBusy(true); setError("");
    const dark = goingIn(".bt-lobby-main");
    const ride = floorCall(dark, ".bt-lobby-main", next, leaveNow, again);
    try {
      const made = await make();
      await enter(made.id, ride.shown);
      await ride.leave();
      onOpen(made.id);
    } catch (e) {
      await dark;
      towerDrop(); standUp(); setError(e.message); setBusy(false); setEntering(false); setRound(n => n + 1);
      // refused because the run moved elsewhere (ended, or its next game opened on another device): show it as the server holds it
      if (approved) sync();
    }
  };
  // a run begins with its draft (no game yet, so nothing goes dark): the candidates stand in the tower's place
  const start = async () => {
    if (busy) return;
    if (run && !(await siteConfirm({ title: "새로 도전할까요?", body: `진행 중인 도전은 ${run.wins}연승으로 끝납니다.`, confirmLabel: "새로 도전" }))) return;
    setBusy(true); setError("");
    try {
      const made = await startStreakRun(daily);
      keepStreakDraft(made, daily);
      // the draft took the place of the run this device held (keepStreakDraft), so the tab reads its run again
      setDraft(made); setPicks([]); setSeen(n => n + 1);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };
  // the draft picked: the tower stands again with the party on its balcony, and the first game is gone into on it
  const depart = () => {
    flushSync(() => setEntering(true));
    goInto(async () => {
      try { return keepStreakStart(await pickStreakDraft(picks, daily)); } catch (e) {
        if (e.reason !== "gone") throw e;
        // the run left its draft (picked in another tab or on another device): drop it and show the run as it stands
        keepStreakDraft(null, daily); setSeen(n => n + 1); sync();
        throw new Error("이미 출발한 도전입니다.");
      }
    }, 0);
  };
  const resume = () => goInto(run.playing ? async () => ({ id: run.id }) : () => streakNextGame(run.id, null, door), run.playing ? null : run.wins, Boolean(run?.again));
  /* until the account can play, a battle with the computer stands beside the key, so a first visitor plays at once instead of waiting
     on a sign-in and an operator (DESIGN.md 연승 도전, 2026-11-09) */
  const practice = onPractice && <Button onClick={onPractice}>컴퓨터와 연습</Button>;
  const left = drafting ? drafting.length - picks.filter(Boolean).length : 0;
  const keys = account === undefined || (approved && !synced) ?<Button variant="main" loading>도전 시작</Button>
    : !approved ? <><Button variant="main" onClick={() => setGate(true)}>도전 시작</Button>{practice}</>
    : drafting ? <Button variant="main" icon={left ? "check" : undefined} disabled={left > 0} onClick={depart} loading={busy}>{left ? `${left}마리 더 고르기` : "출발"}</Button>
    : run ? <><Button variant="main" onClick={resume} loading={busy}>이어서 하기</Button>{!daily && <Button onClick={start} disabled={busy}>새로 도전</Button>}</>
    : doneToday ? <Button variant="main" disabled>오늘 도전 완료</Button>
    : <Button variant="main" onClick={start} loading={busy}>도전 시작</Button>;
  /* what the key cannot say by itself: why it waits. Signed out it says nothing: the key is 구글 로그인 and the month's board beside it
     shows the names it keeps (2026-11-10, the user: no sentence where the form already says it). Only a name waiting on the operators
     needs the sentence, as a grey line in the dock over the key that waits, never as a slab */
  /* the key is always the challenge (2026-11-18): what the account still needs is asked once it is pressed, in a sheet: the Google
     sign-in, the trainer's name, or the name the operators are still checking */
  const gateSheet = gate && <Modal title={account === null ? "구글 로그인" : account?.status === "pending" ? "이름 확인 중" : "트레이너 이름 정하기"}
    hint={account?.status === "pending" ? "운영진이 트레이너 이름을 확인하면 도전할 수 있습니다." : undefined} onClose={() => setGate(false)}>
    <div className="modal-actions">
      {account === null ? <Button variant="main" onClick={() => signInWithGoogle("", window.location.href.split("#")[0])}><GoogleMark />구글 로그인</Button>
        : account?.status === "pending" ? <Button variant="main" onClick={() => setGate(false)}>닫기</Button>
        : <Button variant="main" onClick={() => go?.("records", { tab: "trainer", me: "1" })}>트레이너 이름 정하기</Button>}
    </div>
  </Modal>;
  // the board as the home's and the records' ranking reads it; a live run opens its game to watch
  const placed = rows?.map(r => ({ rank: r.place, name: r.trainer_name, points: r.wins, live: r.live, open: r.live && r.battle_id ? () => onOpen(r.battle_id) : null }));
  // the other climbers on the tower, all of them, counted by floor there: this board's but one's own (one's own run is the path)
  const climbers = !back && rows ? rows.filter(r => !r.mine).map(r => ({ name: r.trainer_name, wins: r.wins, live: r.live })) : null;
  const ready = run !== undefined && board !== undefined && account !== undefined && (!approved || synced);
  /* 등반전 (Cups.jsx): one opened stands as its own screen in the tab, kept in the address (&cup=) so its link and its alert open it */
  const openCup = id => { showCupInAddress(id); setCup(id); };
  if (cup) return (
    <div className="bt-page">
      <h1 className="t32">배틀</h1>
      {tabs}
      {gateSheet}
      <CupBoard id={cup} approved={approved} onGate={() => setGate(true)} onOpen={onOpen} onBack={() => { openCup(null); setCupsAsked(n => n + 1); }}
        onClimb={() => { openCup(null); }} />
    </div>
  );
  return (
    <div className="bt-page">
      <h1 className="t32">배틀</h1>
      {tabs}
      {gateSheet}
      <div className="bt-lobby">
        <div className="bt-lobby-main">
          <div className="streak-scene">
            {drafting && !entering
              ? <DraftBoard res={res} draft={drafting} picks={picks} onPick={(i, sp) => setPicks(p => { const n = [...p]; n[i] = n[i] === sp ? undefined : sp; return n; })} />
              : <TowerHall key={round} wins={wins} live={Boolean(run?.playing)} climbers={climbers} ready={ready} />}
          </div>
          {run && !run.playing && run.doors && <DoorPick res={res} doors={run.doors} value={door} onChange={setDoor} />}
          <Dock toast={error ? <Toast error>{error}</Toast> : null}>
            <div className="bt-end-keys">{keys}</div>
          </Dock>
          {/* 등반전 under the tower's key: the side holds the run and the month (2026-11-19: beside them the side outgrew the tower) */}
          <CupList cups={cups} onCup={openCup} onMake={() => (approved ? setMaking(true) : setGate(true))} onRetry={() => setCupsAsked(n => n + 1)} />
        </div>
        <div className="bt-lobby-set streak-side">
          {/* the run's board heads the side, on the scene's top line, so the scene starts where 배틀 열기's court does (2026-11-09,
              the user: "연승도전과 배틀열기의 위 여백이 다른데") */}
          <div className="streak-run">
            <RunBoard run={run} best={rows ? mine?.wins ?? 0 : null} approved={approved} daily={daily} />
          </div>
          {making && <CupMake onClose={() => setMaking(false)} onMade={id => { setMaking(false); openCup(id); }} />}
          <section aria-labelledby="streak-board">
            <SectionHead id="streak-board" title={`${month.label} 순위`} link={nextBack ? `${other.label} 보기` : "이번 달 보기"} onLink={() => setBack(nextBack)} />
            {board === undefined ? <StandTable rows={null} />
              : !rows ? <ErrorNote action="다시 불러오기" onRetry={() => setBoardAsked(n => n + 1)}>순위를 불러오지 못했습니다.</ErrorNote>
              : !rows.length ? <Row title="아직 기록이 없습니다." />
              : <StandTable rows={placed} placed open unit="연승" />}
          </section>
          <MyRuns approved={approved} asked={round} />
        </div>
      </div>
    </div>
  );
}

/* 내 도전 (docs/db/tower_history.sql, 2026-11-22): the account's own runs, newest first, under the month's board, so a run is still
   found after its month's board has moved on. Five, then all thirty with 더 보기. Not drawn for a signed-out viewer, an account with no
   run yet, or before that SQL has run. */
function MyRuns({ approved, asked }) {
  const [runs, setRuns] = useState(null);
  const [all, setAll] = useState(false);
  useEffect(() => {
    if (!approved) { setRuns(null); return undefined; }
    let on = true;
    readMyStreakRuns().then(rows => on && setRuns(rows), () => on && setRuns(null));
    return () => { on = false; };
  }, [approved, asked]);
  if (!runs?.length) return null;
  const shown = all ? runs : runs.slice(0, 5);
  const label = r => {
    const [y, m] = String(r.month).split("-").map(Number);
    return r.daily ? `${formatDate(r.daily)} 오늘의 탑` : `${y}년 ${m}월`;
  };
  return <section aria-labelledby="streak-mine">
    <SectionHead id="streak-mine" title="내 도전" link={runs.length > 5 && !all ? "더 보기" : undefined} onLink={() => setAll(true)} />
    <div className="stack">{shown.map(r => <Row key={r.run_id} title={`${label(r)}, ${r.wins}연승`}
      line={r.status === "active" ? "진행 중" : [formatDate(r.started_at, { time: true }), r.ended_at ? `${formatDate(r.ended_at, { time: true })} 끝` : ""].filter(Boolean).join(", ")} />)}</div>
  </section>;
}

/* the swap after a won game (rebuilt 2026-11-09 second round, the user: "내 파티 상대 파티도 이거 텍스트가 붕 떠 있어서 직관적이지도
   않고, 사실 매 판 끝날 때마다 가장 중요한 요소인데 다음 판과 같은 맥락에서 아래로 한참 내려야 있어"; rebuilt again 2026-11-18, the
   owner's draft A, the user: "배치는 같은 줄에 있는 포켓몬끼리 교환될 것처럼 보이는데, 막상 눌러보면 다른 경우가 많아", "어떤 포켓몬을
   어떤 포켓몬 혹은 포켓몬들과 교환할 수 있는지 눌러보지 않고도 바로 확인"). The foes are built from the whole pool since 15장, so their
   tiers do not fall one a row as ours do: one of ours may take none of theirs, or three. So each row is one of ours, and on its right
   stands every one of theirs it can be traded for, as many as there are; a tap on one chooses that trade. One of ours with none
   stands off with an empty panel beside it. One of theirs held by an item the party already holds stands off in its row, its reason
   one press away (the won game's six are known whole, so the screen sees the items the server checks: streak.js swapParty). rows:
   ours ({ species, name, can: [{ species, name }], held: [{ species, name, why }] }), in tier order */
/* the table's rows: for each of ours, which of theirs it can be traded for (can) and which an item already in the party holds back
   (held, with why), by the server's own rule (streak.js swapParty). party, foes: the two sixes as the game began ({ species, item });
   blocked: trades the server refused, { give, take, why } */
export function tradeRows(res, ours, theirs, party, foes, reach = 0, blocked = []) {
  const itemWord = item => res?.text?.items?.[toID(item)]?.name || item;
  return ours.map(o => {
    const can = [], held = [];
    for (const t of theirs) {
      const refused = blocked.find(x => x.give === o.species && x.take === t.species);
      const made = refused ? null : swapParty(party, foes, o.species, t.species, reach);
      if (Array.isArray(made)) can.push(t);
      else if (refused || made === "item") {
        const item = foes.find(f => f.species === t.species)?.item;
        held.push({ ...t, why: refused?.why || `파티에 ${josa(itemWord(item), "subject")} 있어 바꿀 수 없습니다.` });
      }
    }
    return { ...o, can, held };
  });
}

/* what is received is never shown before it is taken (2026-11-18, the user: "교환할 때 전부 상세정보가 안 뜨는 것이 좋을 것 같아. 그래야
   무슨 샘플을 받을 줄 모른다는 쫄깃함이 있잖아"): the pair of sets that stood over the table only when the foe's set was known is gone,
   and one held back says only why */
export function SwapTable({ rows, chosen, onPick, onInfo = null, up = false }) {
  return <section className="streak-swap" aria-labelledby="streak-swap-title">
    <div className="stack streak-trades" role="table">
      <span className="pn streak-trades-head" role="columnheader" id="streak-swap-title" aria-label={up ? "포켓몬 교환 승급, 내 파티" : "포켓몬 교환, 내 파티"}>내 파티</span>
      <span className="pn streak-trades-mark" aria-hidden="true"><Icon n="swap" size={20} /></span>
      <span className="pn streak-trades-head" role="columnheader">받을 수 있는 포켓몬{up && <span className="streak-gain">승급</span>}</span>
      {rows.map(r => {
        const mine = chosen?.give === r.species, none = !r.can.length;
        return <React.Fragment key={r.species}>
          {/* one of ours is its set's key: the picture, the name and the info mark in one panel (on a phone the name keeps its room) */}
          <button type="button" className={(mine ? "inv" : "pn") + " streak-trade" + (none ? " off" : "")} disabled={!onInfo}
            onClick={() => onInfo?.(`swap:own:${r.species}:`)} aria-label={`${r.name} 세트 보기`}>
            <img src={spriteUrl(r.species)} alt="" draggable="false" onError={onSpriteError()} /><b>{r.name}</b>
            {onInfo && <b className="bt-i" aria-hidden="true">i</b>}
          </button>
          <span className={(mine ? "inv" : "pn") + " streak-trades-mark" + (none ? " off" : "")} aria-hidden="true"><Icon n="swap" size={20} /></span>
          <span className="streak-takes" role="group" aria-label={`${r.name}와 바꿀 수 있는 포켓몬${none ? " 없음" : ""}`} style={{ "--n": Math.max(3, r.can.length + r.held.length) }}>
            {r.can.map(t => {
              const on = mine && chosen.take === t.species;
              return <button key={t.species} type="button" className={(on ? "inv" : "pn") + " streak-take"} aria-pressed={on}
                aria-label={`${r.name} 대신 ${t.name}`} onClick={() => onPick(on ? null : { give: r.species, take: t.species })}>
                <img src={spriteUrl(t.species)} alt="" draggable="false" onError={onSpriteError()} /><b>{t.name}</b>
              </button>;
            })}
            {r.held.map(t => <button key={t.species} type="button" className="pn streak-take off" aria-disabled="true" aria-label={`${t.name}, 바꿀 수 없음`}
              onClick={() => onInfo?.(`swap:foe:${t.species}:${t.why}`)}>
              <img src={spriteUrl(t.species)} alt="" draggable="false" onError={onSpriteError()} /><b>{t.name}</b>
            </button>)}
            {/* the places left in a row of fewer than three stand as empty panels, so the board's grid stays whole */}
            {Array.from({ length: Math.max(0, 3 - r.can.length - r.held.length) }, (_, k) => <span key={`e${k}`} className="pn" />)}
          </span>
        </React.Fragment>;
      })}
    </div>
  </section>;
}

/* The end of a game of a run, for its player. The break between games stands in the stage's place (stage: the stage box), where the
   eye already is and where there is room, so nothing is scrolled to (2026-11-09 second round): its head is the run's count (switching
   from the last count to the new one as a score does) beside the next game, named, with its floor's track and its gatekeeper waiting at
   the end (inverted when the next game is the gatekeeper's); under it the trades. After a loss the head is the count and the run's place
   on the month's board, and the track shows where it fell. The deck keeps only the result and the keys (다음 판 or 다시 도전, and
   나가기). Playing the replay puts the break away (away) and the stage shows it; back at the end it lights again. The run rests after a
   win until 다음 판 opens the next game, so 나가기 loses nothing. ours, theirs: the two parties' species, as the team preview showed
   them (none after a reload: then there is no swap) */
/* the break's last beat: the tower in the stage's place, from the foot of the next game's door (tower.js towerBreak); going in walks
   in through that door (floorCall finds this hall) */
function BreakTower({ wins, climbing, again }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    void towerBreak(el, { floor: streakFloor(wins), at: floorGame(wins), climbing, again });
    // a new size is fitted where the scene stands, its walk to the next door kept (standTower)
    const seen = new ResizeObserver(() => { if (el.tower) standTower(el, el.tower.st); });
    seen.observe(el);
    return () => seen.disconnect();
  }, []);
  return <div ref={ref} className="tw tw-hall" role="img" aria-label={`다음 판 ${gameWords(wins)}`} />;
}
export function StreakEnd({ id, won, res = null, onOpen, onOut, enter, goingIn, standUp, leaveNow = async () => {}, settle = async () => {}, onInfo = null, stage = null, away = false, ours: ourSix = [], theirs: theirSix = [] }) {
  const seat = readSeat(id);
  const board = useBoard(Boolean(seat?.daily));
  // the door to the next game, the even one unless chosen (2026-11-11)
  const [door, setDoor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // the trade chosen, { give, take }: one a game (2026-11-10, the user: "한 라운드에 한 포켓몬만 바꿀 수 있게 해줘")
  const [chosen, setChosen] = useState(null);
  /* the break a run rests on asks one thing at a time (2026-11-18, the owner's draft B, Task 9): the result, then the trade (after a
     won game whose sixes are known), then the next door, the deck's key going from one to the next */
  const [beat, setBeat] = useState("result");
  useEffect(() => readAhead(seat?.doors?.flatMap(d => d.species)), []);
  // trades the server refused (what the screen could not see: a run from before the sets were sent): they stand off with its reason
  const [blocked, setBlocked] = useState([]);
  const wins = seat?.wins ?? 0;
  /* the run goes on: after a win, and after a lost game the seat has been told of (its answer, or its view read again) while a lamp
     is left. A lost game not yet told of (the clock, before the view comes back) stands as the run's end until it is */
  const resting = !seat?.ended && (won || typeof seat?.won === "boolean");
  const lives = seat?.lives;
  const master = streakMaster(wins);
  const best = Boolean(board?.find(r => r.mine && wins > 0 && r.wins === wins));
  const place = board?.find(r => r.mine && wins > 0)?.place ?? null;
  const [shown, setShown] = useState(resting && won && wins > 0 ? wins - 1 : wins);
  const box = useRef(null);
  useWarm(true);
  useEffect(() => {
    const timer = setTimeout(() => setShown(wins), DUR.light);
    const el = box.current;
    // the game just won brightens in its new light, then the next one lights (motion.js climb)
    if (el && resting && won) climb(el.querySelector(`[data-step="${floorGame(wins) - 1}"]`), el.querySelector(`[data-step="${floorGame(wins)}"]`));
    return () => clearTimeout(timer);
  }, [wins, resting, stage]);
  /* ours in tier order, strongest first, each its row; theirs in tier order within a row (SwapTable). A tier is a sample set's (19장),
     read off the whole sets the function sends (seat.own, seat.beaten) where it sends them, else off the species */
  const setOf = (list, m) => list?.find(s => s.species === m.species) || m;
  const byTier = (list, sets) => [...list].sort((a, b) => (swapTier(setOf(sets, a)) ?? 9) - (swapTier(setOf(sets, b)) ?? 9));
  const ours = byTier(ourSix, seat?.own), theirs = byTier(theirSix, seat?.beaten);
  // every won game offers its trade, a gatekeeper's too: the party a run started with goes all the way up (2026-11-10)
  const swapping = resting && won && ours.length === 6 && theirs.length === 6;
  // after a gatekeeper or a strong door the trade reaches a tier up: theirs one tier stronger for ours (13장)
  const reach = won ? Number(seat?.reach) || 0 : 0;
  /* a lost game's recap (패배 복기, 2026-11-10): the sets it was lost to, whole, as the cards a party is read on. The replay's keys
     stand in the deck under it as after every game */
  const recap = !won && res && seat?.foe?.length ? seat.foe : null;
  /* which of theirs each of ours can be traded for, by the server's own rule (streak.js swapParty) over the two sixes as the game
     began (seat.own, seat.beaten, 2026-11-18); a function from before then sends no sets, and the rule runs on species alone */
  const party = seat?.own?.length === 6 ? seat.own : ours.map(o => ({ species: o.species }));
  const foes = seat?.beaten?.length === 6 ? seat.beaten : theirs.map(t => ({ species: t.species }));
  const rows = swapping ? tradeRows(res, ours, theirs, party, foes, reach, blocked) : [];
  const swap = swapping && chosen ? [chosen] : null;
  const goInto = async (make, next) => {
    if (busy) return;
    setBusy(true); setError("");
    // a replay still playing is put at its end first, so the court goes dark on the game's end (BattlePage.jsx Arena settle)
    await settle();
    const dark = goingIn(".bt-main");
    const ride = floorCall(dark, ".bt-main", next, leaveNow, resting && !won);
    try {
      const made = await make();
      await enter(made.id, ride.shown);
      await ride.leave();
      onOpen(made.id);
    } catch (e) {
      await dark; towerDrop(); standUp(); setBusy(false);
      // the run is not on this game any more (ended, or its next game opened elsewhere): the tab shows it as the server holds it
      if (e.reason === "gone" || e.reason === "moved") { onOut(); return; }
      /* a refused trade stands off in its row and is let go, its reason one press away where the eye already is (a toast in the
         deck's flow pushed 다음 판 down, 2026-11-10, the user: "왜곡이 생겨"). Without a named trade the toast says it, and the key
         says 다음 판 again */
      if (e.pair?.give && e.pair?.take) { setBlocked(b => [...b, { ...e.pair, why: e.message }]); setChosen(null); setBeat("trade"); }
      else { setError(e.message); setChosen(null); }
    }
  };
  const played = won ? Math.max(0, wins - 1) : wins;
  const brk = resting ? <section ref={box} className={"streak-break beat-" + beat + (away ? " away" : "")} aria-label={beat === "door" ? "다음 판" : beat === "trade" ? "교환" : "결과"}>
    {beat === "result" && <div className="streak-result">
      <span className="t15 dim">{gameWords(played)} {won ? "승리" : "패배"}</span>
      <span className="streak-result-count" role="img" aria-label={`${best ? "이번 달 내 최고 기록" : "이번 도전"} ${shown}연승`}><Seg value={String(shown)} h={84} cells={2} label="" /><span className="t20">연승</span></span>
      {best && <span className="t12 dim">이번 달 내 최고 기록</span>}
      <span className="streak-result-track"><FloorTrack wins={wins} /><RunLamps lives={lives} /></span>
      {recap && <div className="stack streak-recap" role="group" aria-label="상대 파티">
        <span className="pn streak-trades-title"><b>상대 파티</b></span>
        {recap.map(m => <MonCard key={m.species} res={res} species={m.species} ability={m.ability} item={m.item || null} moves={(m.moves || []).map(name => ({ id: name, pp: "" }))} compact />)}
      </div>}
    </div>}
    {beat === "trade" && <SwapTable rows={rows} up={reach > 0} chosen={chosen} onPick={setChosen} onInfo={onInfo} />}
    {beat === "door" && <>
      <BreakTower wins={wins} climbing={won && wins > 0 && floorGame(wins) === 1} again={!won} />
      <b className={(master ? "inv" : "pn") + " t15 streak-named streak-break-name"}>{gameWords(wins)}<RunLamps lives={lives} /></b>
      <DoorPick res={res} doors={seat?.doors} value={door} onChange={setDoor} />
    </>}
  </section> : <section ref={box} className={"streak-break" + (away ? " away" : "")} aria-label="도전 끝">
    <div className="stack streak-break-head">
      <Counter label={best ? "이번 달 내 최고 기록" : "이번 도전"} value={shown} after={<span className="t15">연승</span>} />
      {/* a lost run: its place on the month's board as a counter of the same size beside the streak (the two stood at 84 and 116,
          the place's panel holding the track under it); the floor it fell on stays in the head's window */}
      {place != null ? <Counter label={`${monthOf(0).label} 순위`} value={place} after={<span className="t15">위</span>} />
        : <div className="pn streak-next"><b className="t15 streak-named">{gameWords(wins)}<RunLamps lives={lives} /></b><FloorTrack wins={wins} lost /></div>}
    </div>
    {recap && <div className="stack streak-recap" role="group" aria-label="상대 파티">
      <span className="pn streak-trades-title"><b>상대 파티</b></span>
      {recap.map(m => <MonCard key={m.species} res={res} species={m.species} ability={m.ability} item={m.item || null} moves={(m.moves || []).map(name => ({ id: name, pp: "" }))} compact />)}
    </div>}
    {/* a lost run stands as a scene of its own: the floors it climbed as a tower, the highest on top, then the month's first three */}
    <div className="stack streak-tower" role="img" aria-label={`${streakFloor(wins)}층 ${gameWords(wins)}에서 끝났습니다.`}>
      {Array.from({ length: Math.min(streakFloor(wins), 5) }, (_, i) => streakFloor(wins) - i).map(f => <span key={f} className="pn streak-tower-floor">
        <Seg value={String(f)} h={32} cells={String(streakFloor(wins)).length} label="" />
        <TrackBar at={f < streakFloor(wins) ? STREAK_STEP + 1 : floorGame(wins)} lost={f === streakFloor(wins)} />
      </span>)}
    </div>
    {board?.length > 0 && <section className="streak-break-board" aria-labelledby="streak-end-board">
      <SectionHead id="streak-end-board" title={`${monthOf(0).label} 순위`} />
      <StandTable rows={board.slice(0, 3).map(r => ({ rank: r.place, name: r.trainer_name, points: r.wins, live: r.live }))} placed unit="연승" />
    </section>}
  </section>;
  // the key goes from beat to beat, and from the next door into the game (2026-11-18)
  const onward = beat === "result" ? <Button variant="main" onClick={() => setBeat(swapping ? "trade" : "door")}>다음</Button>
    : beat === "trade" ? <Button variant="main" onClick={() => setBeat("door")}>{swap ? "바꾸고 다음" : "바꾸지 않고 다음"}</Button>
    : <Button variant="main" loading={busy} onClick={() => goInto(() => streakNextGame(id, swap, door), wins)}>{won ? "다음 판" : "이어서 하기"}</Button>;
  return <>
    {stage && createPortal(brk, stage)}
    <Dock toast={error ? <Toast error>{error}</Toast> : null}>
      <div className="bt-end-keys">
        {resting ? onward
          /* a new run begins with its draft, on the tab (2026-11-11); 오늘의 탑 is once a day, so its end has no 다시 도전 */
          /* a lost game the seat has not been told of yet (the clock, before its view comes back) may still have a lamp: 다시 도전 there
             would end the run unasked (2026-11-13), so it waits for the run's answer */
          : !seat?.daily && typeof seat?.won === "boolean" && <Button variant="main" icon="refresh" loading={busy} onClick={async () => {
            setBusy(true);
            try { keepStreakDraft(await startStreakRun(false), false); onOut(); } catch (e) { setError(e.message); setBusy(false); }
          }}>다시 도전</Button>}
        <Button onClick={onOut} disabled={busy}>나가기</Button>
      </div>
    </Dock>
  </>;
}
