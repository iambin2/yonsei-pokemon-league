import React, { useEffect, useState } from "react";
import { Row, SectionHead, Status } from "../../components/common/Board.jsx";
import Button from "../../components/common/Button.jsx";
import Icon from "../../components/common/Icon.jsx";
import Empty from "../../components/common/Empty.jsx";
import ErrorNote from "../../components/common/ErrorNote.jsx";
import Loader from "../../components/common/Loader.jsx";
import Pager from "../../components/common/Pager.jsx";
import { battleHref, endedByLine, isDoubles, readSeat } from "../../services/battleService.js";
import { battleHistoryIds, forgetBattles, listBattlesById } from "../../services/battleWatch.js";
import { mergeBattles, readMyBattles } from "../../services/accountTeams.js";
import { siteConfirm } from "../../components/common/SiteDialog.jsx";
import { createBattleReader } from "../../services/battleLog.js";
import { formatDate } from "../../services/dateFormat.js";
import { stopIndex } from "../../services/battleReplay.js";

/* 리플레이와 다시 찾기 (DESIGN.md "Battle", Replay; Finding a battle again).
   끝난 배틀은 무대 아래의 리플레이 줄로 이전 턴, 재생, 다음 턴을 오가고, 무대의 바닥선을 끌어 원하는 턴으로 간다. */

const stopWord = s => (s.end ? "끝" : s.turn === 0 ? "선출" : `${s.turn}턴`);

// the replay's controls stand back under the stage: small keys with their signs under the stage's foot, which is the track
const KEY = { sound: "M4 9h4l5-4v14l-5-4H4zM16 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2zM18.4 6a8.5 8.5 0 0 1 0 12L17 16.6a6.5 6.5 0 0 0 0-9.2z", mute: "M4 9h4l5-4v14l-5-4H4zM15.3 9.4l1.4-1.4 2.1 2.1 2.1-2.1 1.4 1.4-2.1 2.1 2.1 2.1-1.4 1.4-2.1-2.1-2.1 2.1-1.4-1.4 2.1-2.1z", prev: "M16 6l-9 6 9 6z", play: "M8 5l11 7-11 7z", pause: "M8 5h3v14H8zM13 5h3v14h-3z", next: "M8 6l9 6-9 6z",
  full: "M4 4h6v2H6v4H4zM14 4h6v6h-2V6h-4zM4 14h2v4h4v2H4zM18 14h2v6h-6v-2h4z", unfull: "M8 4h2v6H4V8h4zM14 4h2v4h4v2h-6zM4 14h6v6H8v-4H4zM14 14h6v2h-4v4h-2z" };
// each key names its keyboard key too (replayKey below), as Showdown's replays answer to theirs
const Key = ({ d, label, keys, hint, ...rest }) => <button type="button" className="bt-rkey" aria-label={label} title={`${label} (${hint})`} aria-keyshortcuts={keys} {...rest}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg></button>;
/* live: a battle still being played (중계), true while the stage follows it: its last key is 실시간, lit with the amber lamp while it
   stands there and the main key once the watcher went back, to come back. The track is the replay's own, nothing added to it */
export function ReplayBar({ stops, at, playing, onJump, onStep, onPlay, sound, awake, onSound, live, onLive, full, onFull }) {
  const i = stopIndex(stops, at);
  const last = stops.length - 1;
  const following = live === true;
  const prev = at > stops[i].at ? i : Math.max(0, i - 1);
  const turn = stops[i].turn, turns = Math.max(...stops.map(s => s.turn || 0));
  return (
    <div className="bt-replay" role="group" aria-label="리플레이">
      {/* where the replay stands is the stage's own foot (2026-11-24, the owner's draft C: the timeline of ticks, faint squares, Mega
          diamonds and a numbered handle was too much to read): its hairline lit as far as the replay has played, dragged to any turn
          (the range input lies over it unseen) */}
      <span className="bt-replay-track" style={{ "--p": last ? i / last : 1 }}>
        <span className="bt-replay-rail" aria-hidden="true"><i /></span>
        <input type="range" min="0" max={last} step="1" value={following ? last : i} onChange={e => { const k = Number(e.target.value); if (live !== undefined && k >= last) onLive(); else onJump(stops[k].at); }}
          aria-label="리플레이 위치" aria-valuetext={stopWord(stops[i])} />
      </span>
      {/* the keys under it: 이전 턴, 재생, 다음 턴 (처음 and 끝 answer Home and End), the turn as words, the sound and the full screen
          quiet at the end */}
      <div className="bt-replay-keys">
        <Key d={KEY.prev} label="이전 턴" keys="ArrowLeft" hint="←" onClick={() => onJump(stops[prev].at)} disabled={at <= stops[0].at} />
        <Key d={playing ? KEY.pause : KEY.play} label={playing ? "일시정지" : live !== undefined ? "재생" : i >= last ? "처음부터 재생" : "재생"} keys="Space" hint="Space" aria-pressed={playing} onClick={onPlay}
          disabled={following} className={"bt-rkey main" + (playing ? " on" : "")} />
        <Key d={KEY.next} label="다음 턴" keys="ArrowRight" hint="→" onClick={onStep} disabled={following || i >= last} />
        {live !== undefined && <button type="button" className={"bt-rkey bt-rlive" + (following ? " on-air" : " main")} onClick={following ? undefined : onLive} aria-pressed={following} title="실시간 (End)">
          {following && <i className="lamp sig" aria-hidden="true" />}실시간</button>}
        <span className="bt-replay-turn" aria-hidden="true">{turn > 0 ? <><b>{turn}</b>{` / ${turns}턴`}</> : <b>선출</b>}</span>
        {/* the sound, as Showdown's replays keep it with the playback: lit while the page is still silent and waits for a press */}
        <Key d={sound && awake ? KEY.sound : KEY.mute} label={sound && awake ? "소리 끄기" : "소리 켜기"} keys="M" hint="m"
          onClick={onSound} className={"bt-rkey bt-rsound" + (sound && !awake ? " main" : "")} />
        {/* 전체화면 (2026-11-21, the user: "유튜브에서 배틀 영상을 보듯이"): the last key, as a video player keeps it */}
        {onFull && <Key d={full ? KEY.unfull : KEY.full} label={full ? "전체화면 끝내기" : "전체화면"} keys="F" hint="f" aria-pressed={full} onClick={onFull} />}
      </div>
    </div>
  );
}

/* the replay's keyboard, after Showdown's replays (k, j, l, Shift for first and last, < > for speed, m for sound) with the arrows,
   Home and End beside them. A key typed into a field, with a modifier, or a space on a focused key is left to the page */
const REPLAY_KEYS = { " ": "play", k: "play", ArrowLeft: "prev", j: "prev", ArrowRight: "next", l: "next", Home: "first", J: "first", End: "last", L: "last", "<": "slower", ">": "faster", m: "sound", f: "full" };
export function replayKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return null;
  const t = e.target;
  if (t?.closest?.("input, textarea, select, [contenteditable], dialog, [role=dialog]")) return null;
  if (e.key === " " && t?.closest?.("button, summary, a, [role=button]")) return null;
  return REPLAY_KEYS[e.key] || null;
}

// the replay as a text file: the game's own words turn by turn, then Showdown's protocol, which any Showdown reader can play
export function downloadReplay({ row, log, res, perspective, names }) {
  const reader = createBattleReader({ text: res.text, moves: res.detail.moves, pokedex: res.detail.pokedex, perspective });
  const out = [
    `${names.p1} 대 ${names.p2}`,
    `${row.kind === "official" ? "공식" : row.kind === "cpu" ? "컴퓨터와의" : "친선"} 배틀, ${isDoubles(row.format_id) ? "더블" : "싱글"}, ${formatDate(row.created_at)}`,
    row.winner === "tie" ? "무승부" : row.winner ? `${names[row.winner]} 승리` : "",
    // a battle with the computer has no page of its own to link to
    row.kind === "cpu" ? "" : new URL(battleHref(row.id), window.location.href).href,
  ];
  for (const line of String(log).split("\n")) {
    const { lines, event } = reader.read(line);
    if (event?.verb === "turn") out.push("", `${event.turn}턴`);
    out.push(...lines);
  }
  out.push("", "쇼다운 기록", String(log));
  const url = URL.createObjectURL(new Blob([out.join("\n")], { type: "text/plain;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `ypl-battle-${row.id}.txt` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- finding a battle again: the ones being played now, and the ones this device played or watched ---------- */
const kindLine = b => [b.kind === "official" ? "공식" : "친선", isDoubles(b.format_id) ? "더블" : "싱글", formatDate(b.updated_at), b.turn ? `${b.turn}턴` : ""].filter(Boolean).join(", ");
function result(b) {
  if (b.status === "waiting") return <span className="t12 dim">대기</span>;
  if (b.status === "active") return <Status live>진행 중</Status>;
  // my_side: the account's seat (my_battles), for a battle this device holds no seat of
  const side = b.my_side || readSeat(b.id)?.side;
  if (!side || b.winner === "tie") return <span className="t12 dim">{b.winner === "tie" ? "무승부" : "종료"}</span>;
  const won = b.winner === side;
  return <span className={"rc-place t12" + (won ? " inv" : " dim")}>{won ? "승리" : "패배"}</span>;
}
function BattleRows({ rows, onOpen }) {
  return <div className="stack">
    {rows.map(b => <Row key={b.id} title={`${b.p1_name} 대 ${b.p2_name || "상대 대기"}`}
      line={[kindLine(b), endedByLine(b)].filter(Boolean).join(", ")}
      value={result(b)} onClick={() => onOpen(b.id)}
      label={`${b.p1_name} 대 ${b.p2_name || "상대 대기"}, ${b.status === "active" ? "관전" : b.status === "ended" ? "리플레이 보기" : "열기"}`} />)}
  </div>;
}
/* the battle page's 기록 tab (2026-11-10: the list stood under 배틀 열기's form and grew without end): twelve battles a page, the
   newest first, with the pager under them; a device with none says so on a panel. Signed in with Google once
   docs/db/account_teams.sql has run, the account's battles join this device's (2026-11-16, 시안 5의 A) as 내 배틀; until then, or
   signed out, the list is this device's alone, as before. Only this device's can be deleted from it */
const PAGE = 12;
export function BattleLists({ onOpen, onCleared }) {
  const [mine, setMine] = useState(null);
  const [account, setAccount] = useState(false);
  const [page, setPage] = useState(1);
  // a failed read of this device's battles stands as the error with 다시 불러오기 (false), never as an empty list
  const [asked, setAsked] = useState(0);
  useEffect(() => {
    let on = true;
    setMine(null);
    Promise.all([listBattlesById(battleHistoryIds()).catch(() => false), readMyBattles().catch(() => null)])
      .then(([device, account]) => { if (!on) return; setAccount(Boolean(account)); setMine(device === false ? false : account ? mergeBattles(device, account) : device); });
    return () => { on = false; };
  }, [asked]);
  /* 기록 삭제 picks before it deletes (2026-11-06): the link turns the rows into checks (a 20 square leading each), 취소 leaves. Only
     a battle that is over can be picked: one still waiting or being played keeps its seat, so it stands muted without a check. Under
     the list 전체 선택 and the delete key join on the seam at 1 to 1.618, and the delete asks once. */
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const open = b => b.status === "waiting" || b.status === "active";
  // deletable: a battle over that this device alone keeps (the account's stay with the account)
  const here = new Set(battleHistoryIds());
  const mayForget = b => !open(b) && here.has(b.id) && !b.my_side;
  if (mine === null) return <Loader />;
  if (mine === false) return <ErrorNote action="다시 불러오기" onRetry={() => setAsked(n => n + 1)}>배틀 기록을 불러오지 못했습니다.</ErrorNote>;
  if (!mine.length) return <Empty title={account ? "아직 한 배틀이 없습니다." : "이 기기에서 한 배틀이 없습니다."} />;
  const done = mine.filter(mayForget);
  const pages = Math.ceil(mine.length / PAGE), cur = Math.min(page, pages);
  const shown = mine.slice((cur - 1) * PAGE, cur * PAGE);
  const toggle = id => setPicked(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const all = done.length > 0 && done.every(b => picked.has(b.id));
  const leave = () => { setPicking(false); setPicked(new Set()); };
  const remove = async () => {
    const ids = done.filter(b => picked.has(b.id)).map(b => b.id);
    if (!ids.length) return;
    if (!(await siteConfirm({ title: `배틀 기록 ${ids.length}개를 지울까요?`, body: "이 기기의 목록에서만 지웁니다. 서버의 리플레이는 남습니다.", confirmLabel: "삭제", danger: true }))) return;
    forgetBattles(ids);
    const gone = new Set(ids);
    setMine(list => list.filter(b => !gone.has(b.id)));
    leave();
    onCleared?.();
  };
  return <>
    {mine.length > 0 && <section className="bt-list" aria-labelledby="bt-mine-h">
      <SectionHead id="bt-mine-h" title={account ? "내 배틀" : "이 기기의 배틀"} link={picking ? "취소" : done.length ? "기록 삭제" : undefined} onLink={picking ? leave : () => setPicking(true)} />
      {picking ? <>
        <div className="stack" role="group" aria-label="지울 배틀">
          {shown.map(b => {
            const can = mayForget(b), on = picked.has(b.id);
            return <Row key={b.id} className={"bt-pickrow" + (can ? "" : " off")} title={`${b.p1_name} 대 ${b.p2_name || "상대 대기"}`}
              line={[kindLine(b), endedByLine(b)].filter(Boolean).join(", ")}
              lead={can ? <span className={"box" + (on ? " on" : "")} aria-hidden="true">{on && <Icon n="check" size={16} />}</span> : <span className="box box--none" aria-hidden="true" />}
              value={result(b)} onClick={can ? () => toggle(b.id) : undefined}
              label={can ? `${b.p1_name} 대 ${b.p2_name || "상대 대기"}, ${on ? "선택됨" : "선택 안 됨"}` : undefined} />;
          })}
        </div>
        <div className="bt-pickkeys">
          <Button onClick={() => setPicked(all ? new Set() : new Set(done.map(b => b.id)))}>{all ? "선택 해제" : "전체 선택"}</Button>
          <Button onClick={remove} disabled={!picked.size}>{picked.size ? `${picked.size}개 삭제` : "삭제"}</Button>
        </div>
      </> : <BattleRows rows={shown} onOpen={onOpen} />}
      <div><Pager page={cur} pages={pages} onGo={setPage} /></div>
    </section>}
  </>;
}
