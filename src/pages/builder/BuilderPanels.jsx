import React, { memo, useMemo, useState } from "react";
import { Icon } from "../../components/index.js";
import { Bang, Bar, Cell, Choice, Mon, Steps } from "../../components/common/Board.jsx";
import { place } from "../../components/common/motion.js";
import { formatDate } from "../../services/dateFormat.js";
import { championsData, getSubmissionWriteGate } from "../../services/index.js";
import { STAT_KEYS, STAT_LABELS, TYPE_KO, dexRecord, moveName, speciesIdentity, spriteUrl, onSpriteError } from "../../services/teamBuilderCore.js";
import { multiplierMark, teamMatchups } from "../../services/teamTypeChart.js";
import Button from "../../components/common/Button.jsx";

export function TypeBadges({ types = [] }) {
  return <div className="tb-types">{types.map(type => <span key={type} className={`tb-type type-${championsData.toID(type)}`}>{TYPE_KO[type] || type}</span>)}</div>;
}

/* Showdown 목록처럼 행마다 여섯 종족값과 합계. 한국 커뮤니티의 HABCDS 표기, 정렬 중인 값은 굵고 밝게. */
const STAT_LETTERS = { hp: "H", atk: "A", def: "B", spa: "C", spd: "D", spe: "S", bst: "합" };
export function BaseStatStrip({ stats, sortId }) {
  if (!stats) return null;
  const values = { ...stats, bst: STAT_KEYS.reduce((sum, key) => sum + (stats[key] || 0), 0) };
  return (
    <span className="tb-base-strip" aria-label={`종족값 ${STAT_KEYS.map(key => `${STAT_LABELS[key]} ${stats[key]}`).join(", ")}, 합계 ${values.bst}`}>
      {Object.keys(STAT_LETTERS).map(key => <span key={key} className={sortId === key ? "on" : ""} aria-hidden="true"><i>{STAT_LETTERS[key]}</i>{values[key]}</span>)}
    </span>
  );
}

/* "2026.09.09 – 2026.12.02" → "9월 9일 (수) – 12월 2일 (수)": 날짜는 사이트의 한 표기로 */
const periodText = period => String(period || "").replace(/\d{4}\.\d{2}\.\d{2}/g, d => formatDate(d));

/* 목록은 편집과 따로 그린다. 359행(화면 요소 약 9천 개)을 능력 포인트나 기술이 바뀔 때마다 다시 그리면
   슬라이더 한 칸에 100ms가 걸렸다. 목록이 받는 값은 팀의 종 구성이 바뀔 때만 새로 만들어진다. */
export const PoolList = memo(function PoolList({ pool, detailData, displayPokemon, sortId, occupancy, selectedUid, onAdd }) {
  return (
    <div className="tb-pokemon-list">
      {pool.map(pokemon => {
        const details = dexRecord(detailData, pokemon);
        const sameSpeciesMember = occupancy.get(speciesIdentity(detailData, pokemon));
        const already = Boolean(sameSpeciesMember);
        const canReplaceSelected = sameSpeciesMember?.uid === selectedUid && sameSpeciesMember.name !== pokemon.name;
        return (
          <button key={pokemon.name} className="tb-pokemon-row" onClick={() => onAdd(pokemon)} disabled={already && !canReplaceSelected}>
            <span className="stand tb-pic"><i className="floor" aria-hidden="true" /><Mon src={spriteUrl(pokemon.name)} small loading="lazy" onError={onSpriteError()} /></span>
            <span className="tb-pokemon-copy"><strong>{displayPokemon(pokemon)}</strong><small>{details?.num ? `#${String(details.num).padStart(4, "0")}` : ""}</small></span>
            <TypeBadges types={details?.types || []} />
            <BaseStatStrip stats={details?.baseStats} sortId={sortId} />
            {details?.baseStats && <b className="tb-bst" aria-hidden="true">{STAT_KEYS.reduce((sum, key) => sum + (details.baseStats[key] || 0), 0)}</b>}
            <span className="tb-add-mark">
              <Icon n={canReplaceSelected ? "refresh" : already ? "check" : "plus"} size={16} />
            </span>
          </button>
        );
      })}
      {!pool.length && <div className="tb-pool-empty">검색 결과가 없습니다.</div>}
    </div>
  );
});

/* nothing chosen: the editor stands switched off, its own cells, bars and move places dark (2026-11-23, the owner: one sentence in an
   empty panel read "덩그러니"). The head names what to do; choosing a Pokémon lights the same board. */
export function OffEditor() {
  return (
    <div className="tb-editor-off" aria-label="세팅할 포켓몬을 선택해 주세요.">
      <div className="tb-editor-head"><h2 className="t20">세팅할 포켓몬을 선택해 주세요.</h2></div>
      <div className="cells tb-spec" aria-hidden="true">
        {["특성", "도구"].map(label => <Cell key={label} label={label}><span>없음</span></Cell>)}
        <Cell label="성격" wide><span>없음</span></Cell>
      </div>
      <div className="tb-editor-section" aria-hidden="true">
        <div className="tb-subhead"><span className="t12 dim">능력 포인트</span><b className="t12">0 / 66</b></div>
        <div className="tb-stats">
          {STAT_KEYS.map(key => <div className="tb-stat-row" key={key}><span className="t12 tb-stat-key">{STAT_LETTERS[key]}</span><Bar thick value={0} /><span className="t15 tb-off-num">0</span><span /></div>)}
        </div>
      </div>
      <div className="tb-editor-section" aria-hidden="true">
        <div className="tb-subhead"><span className="t12 dim">기술</span><b className="t12">0 / 4</b></div>
        <div className="cells">{[1, 2, 3, 4].map(n => <Cell key={n} label={`기술 ${n}`}><span>없음</span></Cell>)}</div>
      </div>
    </div>
  );
}

/* 팀의 한 칸 (DESIGN.md "Team builder"): 포켓몬은 패널 안에서 이름 띠를 딛고 서고, 고른 칸의 이름 띠가 반전된다.
   빈칸은 + 하나. 띠의 회색 줄은 도구와 기술 수. */
export function TeamSlot({ index, member, active, displayName, itemLabel, onSelect, onRemove }) {
  if (!member) {
    // nothing to press here: the place shows its number, dim (2026-11-23 audit, Q-15)
    return <div className="pn tb-mon empty" aria-label={`${index + 1}번 칸 비어 있음`}><span className="num t15">{index + 1}</span></div>;
  }
  const moveCount = member.moves.filter(Boolean).length;
  const unresolved = member.resolutionState === "unresolved";
  return (
    /* the picture is the slot: no name under it (the editor below names the chosen one); the chosen slot inverts.
       The × is the slot's sibling, not its child: a button never holds another button */
    <div className="tb-mon-cell">
    <button type="button" className={"stand tb-mon" + (active ? " inv active" : " pn") + (unresolved ? " unresolved" : "")} onClick={onSelect} aria-pressed={active}
      aria-label={`${displayName}, ${itemLabel || "도구 없음"}, 기술 ${moveCount}/4${unresolved ? ", 현재 규칙에서 확인할 수 없는 포켓몬" : ""}`}>
      <i className="floor" aria-hidden="true" />
      <Mon src={spriteUrl(member.pokemon.name)} />
    </button>
    <button type="button" className="tb-mon-remove" aria-label={`${displayName} 제거`} onClick={onRemove}><Icon n="x" size={16} /></button>
    </div>
  );
}

/* 타입 상성 (DESIGN.md "Team builder"): the team against the 18 types as a board of cells, a member a column, a type a row.
   방어 is what each type does to each member, its ability counted; 공격 is each member's best damaging move against each type.
   A cell lights what counts (×2), dims what does not (×½, ×0), stays dark for ×1; ×4 inverts, as in the calculator's dex.
   The one line over each board names the types to look at. A phone shows one board under a choice; desktop shows both side by side. */
const MATCHUP_SIDES = ["방어 상성", "공격 상성"];
export const TypeMatchups = memo(function TypeMatchups({ team, detailData, displayPokemon }) {
  const [side, setSide] = useState(MATCHUP_SIDES[0]);
  const rows = useMemo(() => teamMatchups(team.map(member => ({
    types: dexRecord(detailData, member.pokemon)?.types || [],
    ability: member.ability,
    moves: member.moves.map(id => detailData?.moves?.[id]).filter(Boolean),
  }))), [team, detailData]);
  const names = team.map(member => displayPokemon(member.pokemon));
  const exposed = rows.filter(row => row.weak > row.resist);
  const anyMove = rows.some(row => row.offence.some(Boolean));
  const gaps = rows.filter(row => !row.hits);
  const tags = list => <TypeBadges types={list.map(row => row.type.english)} />;
  const board = (key, title, corner, caption, totals, cells, note) => (
    <div className={"tb-mx-side swap" + (side === title ? " on" : "")} key={key}>
      <div className="tb-subhead"><span className="t12 dim">{title}</span></div>
      <div className="tb-mx-note">{note}</div>
      <table className="tb-mx-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="t12 tb-mx-corner">{corner}</th>
            {team.map((member, index) => <th scope="col" key={member.uid}><span className="stand tb-mx-mon"><i className="floor" aria-hidden="true" /><Mon src={spriteUrl(member.pokemon.name)} small onError={onSpriteError()} /><span className="sr-only">{names[index]}</span></span></th>)}
            {totals.map(([label]) => <th scope="col" className="t12 tb-mx-total" key={label}>{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.type.id}>
              <th scope="row"><span className={`tb-type type-${row.type.id}`}>{row.type.korean}</span></th>
              {cells(row).map(([m, label], index) => <td key={team[index].uid} className={m >= 4 ? "x4" : m != null && m < 1 ? "lo" : undefined} aria-label={label ? `${names[index]} ${label}` : undefined}>{multiplierMark(m)}</td>)}
              {totals.map(([label, count, lit]) => <td key={label} className={"tb-mx-total" + (!count(row) ? " off" : lit(row) ? "" : " lo")}>{count(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="tb-mx" data-tb-step="team" data-rise>
      <div className="tb-subhead tb-mx-head"><h2 className="t20">타입 상성</h2><span className="t12 reg dim">특성 반영</span></div>
      <div className="tb-mx-pick"><Choice name="tb-matchup-side" options={MATCHUP_SIDES} value={side} onChange={setSide} /></div>
      <div className="tb-mx-sides">
        {board("defence", MATCHUP_SIDES[0], "공격 타입", "타입별로 받는 대미지 배율과 약점, 내성인 포켓몬 수",
          [["약점", row => row.weak, row => row.weak > row.resist], ["내성", row => row.resist, () => false]],
          row => row.defence.map(m => [m, multiplierMark(m)]),
          exposed.length ? <><span className="t12 dim">약점이 내성보다 많은 타입</span>{tags(exposed)}</> : <span className="t12 reg dim">약점이 내성보다 많은 타입이 없습니다.</span>)}
        {board("offence", MATCHUP_SIDES[1], "상대 타입", "타입별로 기술이 주는 가장 큰 대미지 배율과 2배로 칠 수 있는 포켓몬 수",
          [["2배", row => row.hits, () => true]],
          row => row.offence.map(cell => [cell?.m, cell ? `${multiplierMark(cell.m) || "×1"}, ${moveName(detailData, cell.move.id)}` : ""]),
          !anyMove ? null
            : gaps.length ? <><span className="t12 dim">2배로 칠 기술이 없는 타입</span>{tags(gaps)}</> : <span className="t12 reg dim">모든 타입을 2배로 칠 기술이 있습니다.</span>)}
      </div>
    </div>
  );
});

export function ValidationPanel({ result, regulationName, cupRuleSummary, teamLength, configuredSpecialRule }) {
  let title;
  let message;
  let icon;
  if (result.status === "invalid") {
    title = "규정 위반";
    message = `${result.errors.length}개의 규정 위반을 확인했습니다.`;
    icon = <Bang />;
  } else if (result.status === "valid") {
    title = "규정 통과";
    message = `${regulationName}, ${cupRuleSummary} 기준으로 포켓몬 구성과 세팅이 최종 검증을 통과했습니다.`;
    icon = <Icon n="check" size={16} />;
  } else {
    title = teamLength || configuredSpecialRule ? "미완성" : "팀을 구성해 주세요.";
    message = teamLength || configuredSpecialRule
      ? "규정 위반은 확인되지 않았지만 최종 검증에 필요한 룰 설정 또는 팀 세팅이 아직 완료되지 않았습니다."
      : "포켓몬을 선택하고 각 포켓몬의 세팅을 완료해 주세요.";
    icon = null;
  }

  const messages = [
    ...result.errors.map(messageText => ({ type: "error", message: messageText })),
    ...result.incomplete.map(messageText => ({ type: "incomplete", message: messageText })),
    ...result.warnings.map(messageText => ({ type: "warning", message: messageText })),
  ];

  return (
    <div className={`tb-validation ${result.status}`}>
      <div className="tb-validation-head">
        {icon && <span className="tb-validation-icon">{icon}</span>}
        <div><strong>{title}</strong><span>{message}</span></div>
      </div>
      {messages.length > 0 && <ul>{messages.slice(0, 8).map(({ type, message: detail }, index) => <li className={type} key={`${type}-${detail}-${index}`}>{type === "error" && <Bang />}{detail}</li>)}</ul>}
      {messages.length > 8 && <div className="tb-more">외 {messages.length - 8}개</div>}
    </div>
  );
}

/* Party submission: three steps on one panel, 팀 고르기, 확인, 제출. The team is the one in the builder; 확인 finds the
   registration by name; 제출 writes a new numbered submission that is never deleted. The steps only show where the visitor
   stands: every check and write is the same call as before. */
export function OfficialSubmissionPanel({
  eventId,
  eventContext,
  eventContextStatus,
  eventContextError,
  regulationName,
  cupRuleSummary,
  teamValid,
  registrationName,
  onRegistrationNameChange,
  onLookup,
  lookupBusy,
  lookupError,
  registration,
  eligibility,
  submissionBusy,
  submissionError,
  submissionPin,
  onSubmissionPinChange,
  pinNeeded,
  onSubmit,
  justSubmitted,
  onAgain,
  revisions = [],
}) {
  if (!eventId) return null;
  const eventGate = eventContext ? getSubmissionWriteGate(eventContext) : null;
  const blocked = Boolean(eventContextError || eventContextStatus === "error" || (eventGate && !eventGate.allowed));
  const ready = !blocked && eventContextStatus === "ready" && Boolean(registration) && Boolean(eligibility?.eligible);
  /* the steps go on as the form does: a team the submission's own check lets through (a member short of a move) has passed step 1
     (2026-11-10: the steps said 1 팀 고르기 while the panel under them took the PIN and submitted) */
  const passed = teamValid || Boolean(eligibility?.eligible);
  const at = justSubmitted ? 4 : !passed ? 1 : !registration ? 2 : 3;
  const errors = [
    ...(eventContextError ? [eventContextError] : []),
    ...(eventGate && !eventGate.allowed && !eligibility?.errors?.includes(eventGate.error) ? [eventGate.error] : []),
    ...(lookupError ? [lookupError] : []),
    ...(eligibility?.errors || []),
    ...(submissionError ? [submissionError] : []),
  ];
  const notes = eligibility?.warnings || [];
  const latestSubmission = registration?.latestSubmission || null;
  const formatSubmissionTime = value => value ? formatDate(value, { time: true }) : "";
  /* 2026-11-06 redesign: the event's name at 20 with one grey line (the rule and the deadline), the steps, then each step as a block 20
     apart: what the team step found, the name with its label and its key joined on the seam, what the check found, the PIN, and the
     main action. The name field and its key share the steps' thirds, so 신청자 확인 stands under the last step's edge, not in the air. */
  return (
    <div className="tb-validation official-submission">
      <div className="tb-sub-head">
        <b className="t20">{eventContext?.name || "공식 파티 제출"}</b>
        {eventContext && <p className="t12 reg dim">{[
          regulationName || eventContext.regulation_id || "레귤레이션 확인 필요",
          cupRuleSummary || eventContext.cup_rule_id || "추가 룰 없음",
          eventContext.submission_target_at && `제출 마감 ${formatDate(eventContext.submission_target_at, { time: true })}`,
        ].filter(Boolean).join(", ")}</p>}
      </div>
      {/* an event that takes no party now says why under its name, and nothing it cannot use stands (2026-11-23 audit, Q-15) */}
      {blocked ? <ul className="tb-blocked">{errors.slice(0, 8).map((message, index) => <li className="error" key={`b-${index}`}><Bang />{message}</li>)}</ul>
        : <Steps labels={["팀 고르기", "확인", "제출"]} at={at} />}

      {justSubmitted ? <div className="inv tb-submitted" role="status">
        <Icon n="check" size={20} />
        <span><b className="t15">제출했습니다.</b><span className="t12 reg">이 파티가 지금의 공식 파티입니다.</span></span>
      </div> : null}
      {blocked ? null : justSubmitted ? <Button type="button" variant="second" onClick={onAgain}>다시 제출</Button> : <>
        <p className={"tb-step-line t12" + (passed ? "" : " off")}>{passed ? <><Icon n="check" size={16} />지금 팀이 규정을 통과했습니다.</> : "팀을 구성해 규정을 통과하면 제출할 수 있습니다."}</p>
        <div className="q tb-sub-field">
          <label className="q-label t12 dim" htmlFor="tb-sub-name">신청자 이름</label>
          <div className="tb-official-lookup">
            <input
              id="tb-sub-name"
              className="in"
              value={registrationName}
              onChange={event => onRegistrationNameChange(event.target.value)}
              onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing && registrationName.trim() && !lookupBusy) onLookup(); }}
              placeholder="신청할 때 쓴 이름"
              autoComplete="name"
              disabled={lookupBusy}
            />
            <Button type="button" variant="second" onClick={onLookup} disabled={lookupBusy || !registrationName.trim()} loading={lookupBusy}>신청자 확인</Button>
          </div>
          {registration && <p className="tb-step-line t12"><Icon n="check" size={16} />{registration.registration.registration_name}님의 신청을 확인했습니다.</p>}
        </div>
        {(errors.length > 0 || notes.length > 0) && <ul>
          {errors.slice(0, 8).map((message, index) => <li className="error" key={`e-${index}`}><Bang />{message}</li>)}
          {notes.slice(0, 4).map((message, index) => <li key={`w-${index}`}>{message}</li>)}
        </ul>}
        {ready && pinNeeded && <div className="q tb-sub-field">
          <label className="q-label t12 dim" htmlFor="tb-sub-pin">제출 비밀번호</label>
          <input
            id="tb-sub-pin"
            className="in tb-sub-pin"
            type="password"
            value={submissionPin}
            onChange={event => onSubmissionPinChange(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
            placeholder="숫자 4자리"
            inputMode="numeric"
            autoComplete="off"
          />
          {latestSubmission && <p className="t12 reg dim">처음 제출할 때 정한 비밀번호입니다. 잊었다면 운영진에게 문의해 주세요.</p>}
        </div>}
        {ready && <Button type="button" variant="main" icon="check" onClick={onSubmit} loading={submissionBusy} disabled={submissionBusy || (pinNeeded && submissionPin.length !== 4)}>
          {latestSubmission ? "다시 제출" : "파티 제출"}
        </Button>}
      </>}

      {revisions.length > 0 && <div className="tb-revisions">
        <p className="t12 dim">제출 기록</p>
        <div className="stack">{revisions.map((row, index) => (
          <div className="pn tb-revision" key={row.id}>
            <b className="t15">{row.revision}회차</b>
            <span className="t12 reg dim num">{formatSubmissionTime(row.submitted_at)}</span>
            {index === 0 ? <span className="t12 tb-revision-now">지금의 공식 파티</span> : <span className="t12 reg dim">이전 제출</span>}
          </div>
        ))}</div>
        <p className="t12 reg dim">다시 제출하면 {revisions[0].revision + 1}회차로 남고, 이전 회차는 지워지지 않습니다.</p>
      </div>}
    </div>
  );
}

