import React, { useEffect, useState } from "react";
import { josa } from "../../services/josa.js";
import { Button, Dropdown, Field, FormError, Icon, Loader, Modal, Segmented } from "../../components/index.js";
import { applyEventRecord, championsData, fetchPlayerChampionRosters, fetchRegistrationFinalRosters, buildChampionshipRecordApplyCompletionOptions, getEvent, getEventRecordContext, getIndividualPlacementPointPolicy, inspectEventParticipantIdentities, lastPlacementPoints, isRecordApplyCompletionConfirmed, validateEventParticipantEntries, validateEventTeamEntries } from "../../services/index.js";
import { getTeamPlacementPointPolicy } from "../../services/bracketRankingAwardSnapshot.js";
import { applyTitleAwards, evaluateTitleAwards } from "../../services/titleAwards.js";
import { loadRecordsPokemonDirectory } from "../../services/recordsPokemon.js";
import { BYE, evalGraph } from "../../services/bracketWinnerPlan.js";

export default function BracketApply({ b, res, data, save, onClose, flash, refresh, onNormalizedApplied, titlesOnly=false }){
  const partOf=(pid)=>(b.participants||[]).find(x=>x.id===pid);
  const nameOf=(pid)=>{ const p=partOf(pid); return p?p.name:pid; };
  const team=b.mode==="team";
  const tours=data.tournaments||[]; const seasons=data.seasons||[];
  const [tkey,setTkey]=useState(tours[0]?.key||"");
  const [date,setDate]=useState(new Date().toISOString().slice(0,7).replace("-","."));
  const [roundStr,setRoundStr]=useState("");
  const [season,setSeason]=useState(seasons[seasons.length-1]?.name||"");
  const [champ,setChamp]=useState(false);
  const [rule,setRule]=useState("");
  const [bumpRank,setBumpRank]=useState(true);
  const [bumpSeason,setBumpSeason]=useState(true);
  const [rankKey,setRankKey]=useState((data.rankings||[])[0]?.key||"");
  const [ptWin,setPtWin]=useState(team?"30":"60"); const [ptRu,setPtRu]=useState(team?"20":"40"); const [ptSf,setPtSf]=useState(team?"0":"20");
  /* 지난 대회와 같게: 기록에 반영된 가장 최근의 같은 종류 대회가 준 점수를 칸에 넣는다. 저장은 반영할 때 한 번이다 */
  const [lastPoints,setLastPoints]=useState({busy:false,note:""});
  const copyLastPoints=async()=>{
    setLastPoints({busy:true,note:""});
    try{
      const points=await lastPlacementPoints({isTeam:team});
      if(!points){ setLastPoints({busy:false,note:"기록에 반영된 지난 대회가 없습니다."}); return; }
      setPtWin(String(points.win)); setPtRu(String(points.ru)); if(!team) setPtSf(String(points.sf));
      setLastPoints({busy:false,note:`${points.eventName||"지난 대회"}의 점수를 넣었습니다.`});
    }catch(error){ setLastPoints({busy:false,note:error?.message||"지난 대회의 점수를 불러오지 못했습니다."}); }
  };
  const [override,setOverride]=useState({});
  const linked=Boolean(b.eventId);
  const normalizedRuntime=b.projection?.source==="normalized";
  const [linkedContext,setLinkedContext]=useState(null);
  const [linkedContextError,setLinkedContextError]=useState("");
  const [linkedContextBusy,setLinkedContextBusy]=useState(linked);
  const identityReviewRequired=linked&&!team&&(b.participants||[]).some(participant=>
    participant?.identityReviewRequired||
    participant?.identityStatus==="ambiguous"||
    participant?.identityStatus==="new"||
    !participant?.playerId||
    !participant?.registrationId||
    !participant?.entryId
  );
  const [identityPreview,setIdentityPreview]=useState([]);
  const [identityPreviewError,setIdentityPreviewError]=useState("");
  const [identityPreviewBusy,setIdentityPreviewBusy]=useState(identityReviewRequired);
  const qualifierEvent=linkedContext?.event?.championship_phase==="qualifier";
  useEffect(()=>{
    if(!b.eventId) return;
    let cancelled=false;
    setLinkedContextBusy(true);
    setLinkedContextError("");
    getEventRecordContext(b.eventId)
      .then(context=>{
        if(cancelled) return;
        setLinkedContext(context);
        setSeason(context.season.name);
        setChamp(context.event.event_type==="champions");
        if(context.event.event_type==="champions" && Number.isInteger(Number(context.event.round_number)) && Number(context.event.round_number)>0){
          setRoundStr(String(context.event.round_number));
        }
        const pointPolicy=team
          ? getTeamPlacementPointPolicy(context.event)
          : getIndividualPlacementPointPolicy(context.event);
        setBumpRank(pointPolicy.enabled);
        setBumpSeason(pointPolicy.enabled&&context.event.event_type!=="champions");
        if(pointPolicy.points){
          setPtWin(String(pointPolicy.points.win));
          setPtRu(String(pointPolicy.points.ru));
          setPtSf(String(pointPolicy.points.sf));
        }
        const preferredKey=pointPolicy.division==="rookie"
          ? "rookie"
          : pointPolicy.division==="light"
            ? "pylite"
            : pointPolicy.division==="master"
              ? "master"
              : "pycup";
        if(tours.some(t=>t.key===preferredKey)) setTkey(preferredKey);
      })
      .catch(error=>{ if(!cancelled) setLinkedContextError(error?.message||"연결 대회의 시즌을 확인하지 못했습니다."); })
      .finally(()=>{ if(!cancelled) setLinkedContextBusy(false); });
    return ()=>{ cancelled=true; };
  },[b.eventId]);
  useEffect(()=>{
    if(!identityReviewRequired){
      setIdentityPreview([]);
      setIdentityPreviewError("");
      setIdentityPreviewBusy(false);
      return;
    }
    let cancelled=false;
    setIdentityPreviewBusy(true);
    setIdentityPreviewError("");

    inspectEventParticipantIdentities(b.eventId,b.participants||[])
      .then(rows=>{
        if(!cancelled) setIdentityPreview(rows||[]);
      })
      .catch(error=>{
        if(!cancelled) setIdentityPreviewError(error?.message||"참가자의 선수 정보를 확인하지 못했습니다.");
      })
      .finally(()=>{
        if(!cancelled) setIdentityPreviewBusy(false);
      });

    return ()=>{ cancelled=true; };
  },[b.eventId,b.participants,identityReviewRequired]);

  const pN=(s)=>{ const v=parseFloat(s); return isNaN(v)?0:v; };
  const ptWinN=pN(ptWin), ptRuN=pN(ptRu), ptSfN=pN(ptSf);
  const r1=(n)=>Math.round(n*10)/10;
  const setPt=(fn)=>(e)=>fn(e.target.value.replace(/[^0-9.]/g,""));
  const memListOf=(pid)=>partOf(pid)?.members||[];
  const curT=tours.find(x=>x.key===tkey);
  const [preview,setPreview]=useState(null);
  const [awards,setAwards]=useState(null);
  const [awardPicks,setAwardPicks]=useState(()=>new Set());
  const [awardBusy,setAwardBusy]=useState(false);
  const [applying,setApplying]=useState(false);
  const [guard,setGuard]=useState(""); // what stops 기록에 반영, said on the sheet
  const manualExcluded=!!curT&&(curT.key==="rookie"||/루키/.test(curT.label||""));
  const linkedPointPolicy=linkedContext
    ? (team
      ? getTeamPlacementPointPolicy(linkedContext.event)
      : getIndividualPlacementPointPolicy(linkedContext.event))
    : null;
  const excluded=linked ? linkedPointPolicy?.enabled===false : manualExcluded;
  const recordSeason=linked ? (linkedContext?.season?.name||"") : season;
  const autoNext=String((curT?.rounds?.reduce((mx,r)=>Math.max(mx,parseInt(r.round)||0),0)||0)+1);
  const placements=[]; if(res.champ)placements.push({pid:res.champ,pts:ptWinN,label:"우승"});
  if(res.ru)placements.push({pid:res.ru,pts:ptRuN,label:"준우승"});
  if(!team)res.sf.forEach(pid=>placements.push({pid,pts:ptSfN,label:"4강"}));
  const alloc=[]; if(team){ placements.forEach(pl=>{ const p=partOf(pl.pid); const mem=p?.members||[]; mem.forEach(m=>alloc.push({key:pl.pid+"|"+m,team:p?.name,member:m,label:pl.label,base:pl.pts})); }); }
  const allocVal=(a)=>{ const o=override[a.key]; return (o===undefined||o==="")?a.base:pN(o); };
  const rankEra=(data.rankings||[]).find(r=>r.key===rankKey);
  const rankRows=rankEra?.rows||[];
  const isNew=(name)=>!rankRows.some(r=>r.name===name);
  const showBadge=bumpRank&&!excluded&&!!rankKey;
  const badgeFor=(name)=>showBadge?<span className={"bk-exist "+(isNew(name)?"new":"old")}>{isNew(name)?"신규":"기존"}</span>:null;
  const computeDeltas=()=>{ const deltas={};
    const add=(name,d)=>{ if(!name)return; const c=deltas[name]||{win:0,ru:0,top4:0,points:0}; deltas[name]={win:c.win+(d.win||0),ru:c.ru+(d.ru||0),top4:c.top4+(d.top4||0),points:c.points+(d.points||0)}; };
    if(team){ alloc.forEach(a=>add(a.member,{points:allocVal(a)})); }
    else { add(nameOf(res.champ),{win:1,points:ptWinN}); if(res.ru)add(nameOf(res.ru),{ru:1,points:ptRuN}); res.sf.map(nameOf).forEach(n=>add(n,{top4:1,points:ptSfN})); }
    return deltas; };
  const buildResult=()=>{
    const ownRound=Number(linkedContext?.event?.round_number);
    const roundNum=roundStr.trim()||(linked&&Number.isInteger(ownRound)&&ownRound>0?String(ownRound):autoNext);
    const deltas=computeDeltas();
    const willRank=bumpRank&&rankKey&&!excluded, willSeason=bumpSeason&&recordSeason&&!champ&&!excluded;
    return { deltas, roundNum, willRank, willSeason };
  };
  const prepare=()=>{
    if(linkedContextBusy||linkedContextError) return; // the key is off while the linked event loads or has failed; the form says why
    const stop=qualifierEvent?"선발전은 기록에 반영하지 않습니다. 선발전 현황에서 본선 진출자를 확정해 주세요."
      :!curT?"회차를 추가할 대회를 먼저 선택해 주세요."
      :!recordSeason?"기록을 반영할 시즌을 먼저 선택해 주세요.":"";
    setGuard(stop); if(stop) return;
    setPreview(buildResult());
  };
  // 기록 반영이 끝난 뒤, 고정된 공식 파티로 칭호 조건을 확인한다. 판정 실패는 기록 반영을 막지 않는다.
  const findTitleAwards=async(event)=>{
    const placements=[
      ...(res.champ?[{pid:res.champ,placement:"champion"}]:[]),
      ...(res.ru?[{pid:res.ru,placement:"runner_up"}]:[]),
      ...(team?[]:res.sf.map(pid=>({pid,placement:"semifinalist"}))),
    ].map(({pid,placement})=>{ const p=partOf(pid); return {placement,playerId:p?.playerId||null,registrationId:p?.registrationId||null,names:team?(memListOf(pid).length?memListOf(pid):[nameOf(pid)]):[nameOf(pid)]}; });
    const [rosters,detailData,directory]=await Promise.all([
      team?new Map():fetchRegistrationFinalRosters(placements.map(p=>p.registrationId)).catch(()=>new Map()),
      team?null:championsData.load().catch(()=>null),
      team?null:loadRecordsPokemonDirectory().catch(()=>null),
    ]);
    const champion=placements.find(p=>p.placement==="champion");
    // 팀전 우승 팀이 치른 경기(BYE 제외)와 각 경기의 세트 결과
    const championTeamSeries=team&&res.champ&&b.graph?(()=>{
      const g=b.graph; const {sp}=evalGraph(g);
      const all=[...g.rounds.flat(),...(g.lb||[]).flat(),...(g.gf?[g.gf]:[]),...(g.reset?[g.reset]:[])];
      return all.flatMap(m=>{ const a=sp(m.a), z=sp(m.b); if(!m.winner||!a||!z||a===BYE||z===BYE||(a!==res.champ&&z!==res.champ)) return []; return [{side:a===res.champ?"a":"b",series:m.series||null}]; });
    })():null;
    const partnerWins=champion?.playerId&&directory
      ? {[champion.playerId]:await fetchPlayerChampionRosters(champion.playerId).catch(()=>[])}
      : {};
    return evaluateTitleAwards({
      titleGroups:data.titleGroups||[],
      event,
      placements:placements.map(p=>({...p,roster:rosters.get(p.registrationId)||null})),
      detailData,
      partnerWins,
      championOrdinal:preview?.roundNum,
      pokemonName:directory?(id=>directory.get(id)?.displayName||""):null,
      championTeamSeries,
    });
  };
  const finishWithTitles=async(event)=>{
    const found=await findTitleAwards(event||linkedContext?.event).catch(()=>[]);
    if(!found.length){ flash(titlesOnly?"새로 받을 칭호가 없습니다.":"기록에 반영했습니다."); onClose(); return; }
    setAwardPicks(new Set(found.map(a=>a.key)));
    setAwards(found);
  };
  const grantTitles=async()=>{
    setAwardBusy(true);
    const chosen=awards.filter(a=>awardPicks.has(a.key)).map(a=>({...a,eventId:b.eventId}));
    const ok=await save({...data,titleGroups:applyTitleAwards(data.titleGroups||[],chosen)});
    setAwardBusy(false);
    flash(titlesOnly?(ok?"칭호에 반영했습니다.":"칭호를 저장하지 못했습니다."):ok?"기록과 칭호에 반영했습니다.":"기록은 반영했지만 칭호는 저장하지 못해 이 화면에만 반영됐습니다.");
    onClose();
  };
  const skipTitles=()=>{ if(awardBusy) return; if(!titlesOnly) flash("기록에 반영했습니다."); onClose(); };
  /* 칭호 다시 판정 (2026-11-22): a recorded event's titles judged again against today's title list, for a title added or a condition
     fixed after the record went in. Only titles not yet held come up, in the same sheet as after the record. */
  useEffect(()=>{ if(titlesOnly&&!linkedContextBusy&&!preview) setPreview(buildResult()); },[titlesOnly,linkedContextBusy]);
  useEffect(()=>{ if(titlesOnly&&preview&&!awards) void finishWithTitles(linkedContext?.event); },[titlesOnly,preview]);
  const commit=async()=>{
    if(!preview||applying) return;
    setApplying(true);
    try{ await commitRecords(); }finally{ setApplying(false); }
  };
  const commitRecords=async()=>{
    try{
      const participants=b.participants||[];
      const actualParticipants=team ? participants.filter(p=>Array.isArray(p?.members)) : participants;
      if(!actualParticipants.length || actualParticipants.some(p=>!p.entryId)){
        throw new Error("대진표에 참가자 정보가 모두 연결되지 않아 기록을 반영할 수 없습니다.");
      }
      if(team) await validateEventTeamEntries(b.eventId,actualParticipants);
      else await validateEventParticipantEntries(b.eventId,participants);
      const completed=await applyEventRecord(b.eventId,b,res,buildChampionshipRecordApplyCompletionOptions({
        event: linkedContext?.event,
        roundNumber: preview.roundNum,
        revealOfficialRosters: true,
      }));
      await onNormalizedApplied?.(completed);
      await finishWithTitles(linkedContext?.event);
    }catch(error){
      // 한 트랜잭션이라 반쯤 반영된 상태는 없다. 응답만 끊겼는지 대회 상태로 확인한다.
      let currentEvent=null;
      try{ currentEvent=await getEvent(b.eventId); }catch{ /* 확인하지 못하면 실패로 안내한다 */ }
      if(isRecordApplyCompletionConfirmed(currentEvent,{requireTeamReveal:true})){
        await onNormalizedApplied?.(currentEvent);
        flash("응답이 끊겼지만 다시 확인해 보니 기록은 반영되었습니다.");
        onClose();
        return;
      }
      flash(`기록을 반영하지 못했습니다. 바뀐 내용은 없습니다. ${error?.message||"원인을 확인하지 못했습니다."}`);
    }
  };
  if(titlesOnly&&!awards) return <Modal title="칭호 다시 판정" onClose={onClose}><Loader/></Modal>;
  if(awards){
    const toggle=(key)=>setAwardPicks(cur=>{ const next=new Set(cur); next.has(key)?next.delete(key):next.add(key); return next; });
    return (<Modal title="칭호 획득" hint="이번 대회로 칭호 조건을 만족한 트레이너가 있습니다. 칭호에도 반영할까요?" onClose={skipTitles}>
      <div className="swap" key="titles">
        <div className="bk-chg">{awards.map(a=>(
          <label className="bk-chg-row bk-award" key={a.key}>
            <input type="checkbox" checked={awardPicks.has(a.key)} onChange={()=>toggle(a.key)}/>
            <b>{a.groupKey==="partner"?a.title:a.holder}</b>
            <span className="bk-exist old">{a.label}</span>
            <span className="bk-chg-cnt">{a.reason}</span>
          </label>
        ))}</div>
        <div className="modal-actions">
          <Button variant="second" onClick={skipTitles} disabled={awardBusy}>나중에</Button>
          <Button variant="main" icon="check" onClick={grantTitles} disabled={awardBusy||!awardPicks.size} loading={awardBusy}>칭호에 반영</Button>
        </div>
      </div>
    </Modal>);
  }
  if(preview){
    const changes=Object.entries(preview.deltas).map(([name,d])=>{ const cur=rankRows.find(r=>r.name===name); return {name,isNew:!cur,curPts:cur?.points||0,d}; });
    return (<Modal title="반영 전 확인" hint={excluded
      ? (champ?"아래 내용으로 공식 기록에 반영합니다. 챔피언스 성적은 랭킹에 반영되지 않습니다.":"아래 내용으로 공식 기록에 반영합니다.")
      : "아래 내용으로 기록에 반영합니다. 포인트 변동을 확인한 뒤 진행해 주세요."} onClose={()=>{ if(!applying) setPreview(null); }}>
      <div className="swap" key="pre">
      <div className="bk-applybox">
        <div className="bk-ab-meta">{team?"팀전":"개인전"}{champ?" 챔피언스 시리즈":""}</div>
        <div><span>{curT.label} <b>{preview.roundNum}회</b>{recordSeason?`, ${recordSeason}`:""}{rule.trim()?`, ${rule.trim()}`:""}</span></div>
        <div><span>우승 <b>{nameOf(res.champ)}</b>{res.ru?<>, 준우승 {nameOf(res.ru)}</>:null}{res.sf.length?<>, 4강 {res.sf.map(nameOf).join(", ")}</>:null}</span></div>
      </div>
      {linked&&!team&&(
        !!identityPreviewError ||
        identityPreview.some(row=>row.status!=="existing")
      )&&
  <div className="field">
    <span className="field-label">참가자 선수 정보 확인</span>
    {identityPreviewBusy
      ? <div className="bk-hint">선수 정보를 확인하는 중입니다.</div>
      : identityPreviewError
        ? <FormError>{identityPreviewError}</FormError>
        : <div className="bk-chg">
            {identityPreview.map(row=>(
              <div className="bk-chg-row" key={row.participantId}>
                <span className={"bk-exist "+(row.status==="existing"?"old":"new")}>
                  {row.status==="existing"
                    ? "기존 선수"
                    : row.status==="new"
                      ? "신규 선수"
                      : "확인 필요"}
                </span>
                <b>{row.name}</b>
                <span className="bk-hint" style={{marginLeft:"auto"}}>
                  {row.status==="existing"
                    ? "기존 선수 정보 사용"
                    : row.status==="new"
                      ? "기록 반영 시 선수 등록"
                      : "같은 이름의 선수가 여러 명 있음"}
                  {row.willCreateRegistration ? ", 참가 등록 생성 예정" : ""}
                </span>
              </div>
            ))}
          </div>
    }
  </div>
}
      {preview.willRank ? <div className="field"><span className="field-label">누적 랭킹 「{rankEra?.label}」 포인트 변동</span>
        <div className="bk-chg">{changes.map(c=><div className="bk-chg-row" key={c.name}>
          <span className={"bk-exist "+(c.isNew?"new":"old")}>{c.isNew?"랭킹 신규":"랭킹 기존"}</span><b>{c.name}</b>
          <span className="bk-chg-pts">{c.curPts}<Icon n="arrow" size={16}/>{r1(c.curPts+c.d.points)}</span>
          {c.d.points?<span className="bk-chg-d">+{r1(c.d.points)}</span>:null}
          {(c.d.win||c.d.ru||c.d.top4)?<span className="bk-chg-cnt">{c.d.win?`승+${c.d.win} `:""}{c.d.ru?`준+${c.d.ru} `:""}{c.d.top4?`4강+${c.d.top4}`:""}</span>:null}
        </div>)}</div>
      </div> : <div className="bk-hint">{excluded?`${josa(curT.label, "topic")} 누적 랭킹과 시즌별 성적에 반영되지 않고 회차 기록에만 추가됩니다.`:"누적 랭킹 반영이 꺼져 있어 회차 기록에만 추가됩니다."}</div>}
      {preview.willSeason&&<div className="bk-hint">시즌별 성적 「{recordSeason}」에도 동일한 점수와 성적이 반영됩니다.</div>}
      <div className="modal-actions">
  <Button variant="second" onClick={()=>setPreview(null)} disabled={applying}>뒤로</Button>
  <Button
    variant="main" icon="check"
    onClick={commit}
    disabled={
      applying||
      linked&&!team&&(
        identityPreviewBusy||
        !!identityPreviewError||
        identityPreview.some(row=>row.status==="ambiguous")
      )
    }
   loading={applying}>이대로 반영</Button>
</div>
      </div>
    </Modal>);
  }
  return (<Modal
    title="기록에 반영"
    onClose={onClose}
  >
    <div className="swap" key="form">
      <p className="t12 dim bk-apply-meta">순위, {team?"팀전":"개인전"}
          {linked&&linkedContext?.event?.division
            ? `, ${linkedContext.event.division==="master"?"마스터 리그":linkedContext.event.division==="rookie"?"루키 리그":linkedContext.event.division==="light"?"파이컵 라이트":linkedContext.event.division==="other"?"일반 대회":linkedContext.event.division}`
            : ""}</p>
      <dl className="stack bk-apply-places">
        {placements.map((pl,i)=><div className={(i===0?"inv":"pn")+" spec-row"} key={pl.label+pl.pid}><dt className="t12">{pl.label}</dt><dd className="t15">{nameOf(pl.pid)}</dd></div>)}
        {team&&res.sf.length>0&&<div className="pn spec-row"><dt className="t12">4강</dt><dd className="t15">{res.sf.map(nameOf).join(", ")}</dd></div>}
      </dl>

      {linked ? <>
        {linkedContextBusy&&
          <Loader small/>
        }

        {linkedContextError&&
          <FormError>{linkedContextError}</FormError>
        }

        {!linkedContextBusy&&!linkedContextError&&<>
          <div className="bk-grow2">
            <div className="field">
              <span className="field-label">기록 분류</span>
              <div className="bk-hint">
                {curT?.label||"분류 확인 필요"} (연결된 대회 기준)
              </div>
            </div>

            <div className="field">
              <span className="field-label">시즌</span>
              <div className="bk-hint">
                {recordSeason||"시즌 정보 없음"} (연결된 대회 기준)
              </div>
            </div>
          </div>

          {/* 연결된 대회의 회차와 날짜는 대회 자신의 것이다(COMPETITION_EDITIONS.md). 2026-11-22까지 여기 있던 회차와 날짜 표기 칸은
              챔피언스 본선의 회차 말고는 서버로 가지 않아, 고쳐도 반영된다고 믿게 했다. 챔피언스만 회차를 남긴다 */}
          {champ&&<Field label="회차 번호"><input
              value={roundStr}
              onChange={e=>setRoundStr(e.target.value)}
              placeholder={autoNext}
            /></Field>}

          <div className="field">
            <span className="field-label">반영 내용</span>
            <div className="bk-applybox">
              <div><Icon n="check" size={16}/><span>{curT?.label||"회차"} 기록</span></div>
              <div className={excluded?"dim":undefined}><Icon n={excluded?"minus":"check"} size={16}/><span>
                {excluded
                  ? "누적 랭킹 미반영"
                  : `누적 랭킹${rankEra?.label?` (${rankEra.label})`:""}`}
              </span></div>
              <div className={excluded||champ?"dim":undefined}><Icon n={excluded||champ?"minus":"check"} size={16}/><span>
                {excluded||champ
                  ? "시즌별 성적 미반영"
                  : `시즌별 성적 (${recordSeason})`}
              </span></div>
            </div>
          </div>

          {!excluded&&
            <div className="field">
              <span className="field-label">{rankEra?.label?`${rankEra.label}에 더할 점수`:"등수별 점수"}</span>
              <div className="stack bk-apply-points">
                {placements.map(pl=><div className="pn bk-apply-point" key={pl.label+pl.pid}><span className="t15">{nameOf(pl.pid)}</span><span className="t12 dim">{pl.label}</span><b className="t15 num">+{pl.pts}</b></div>)}
              </div>
            </div>
          }
        </>}
      </> : <>
        <div className="field">
          <span className="field-label">형식</span>
          <Segmented value={champ} onChange={setChamp} ariaLabel="형식" options={[[false,"일반 (파이컵)"],[true,"챔피언스 시리즈"]]}/>
        </div>

        <div className="bk-grow2">
          <div className="field">
            <label htmlFor="bk-add-round">추가할 대회(회차 묶음)</label>
            <Dropdown
              id="bk-add-round"
              value={tkey}
              onChange={setTkey}
              placeholder="대회 선택"
              options={tours.map(t=>({value:t.key,label:t.label}))}
            />
          </div>

          <div className="field">
            <label htmlFor="bk-add-season">시즌</label>
            <Dropdown
              id="bk-add-season"
              value={season}
              onChange={setSeason}
              options={seasons.map(s=>({value:s.name,label:s.name}))}
            />
          </div>
        </div>

        <div className="bk-grow2">
          <Field label="회차 번호"><input value={roundStr} onChange={e=>setRoundStr(e.target.value)}/></Field>

          <Field label="날짜 표기"><input value={date} onChange={e=>setDate(e.target.value)} placeholder="2026.07"/></Field>
        </div>

        <Field label="대회 룰 (선택)"><input value={rule} onChange={e=>setRule(e.target.value)} placeholder="예: 모노타입 / 랜덤 배틀 / 6세대 63"/></Field>

        <div className="field">
          <div className="bk-pts-head"><span className="field-label">등수별 점수{team?" (팀원별 고정 점수)":""}</span><Button variant="link" onClick={copyLastPoints} disabled={lastPoints.busy} loading={lastPoints.busy}>지난 대회와 같게</Button></div>
          {lastPoints.note&&<p className="t12 reg dim bk-pts-note">{lastPoints.note}</p>}
          <div className="bk-pts">
            <div className="bk-pt"><span>우승</span><input aria-label="우승 점수" value={ptWin} onChange={setPt(setPtWin)}/></div>
            <div className="bk-pt"><span>준우승</span><input aria-label="준우승 점수" value={ptRu} onChange={setPt(setPtRu)}/></div>
            {!team&&<div className="bk-pt"><span>4강</span><input aria-label="4강 점수" value={ptSf} onChange={setPt(setPtSf)}/></div>}
          </div>
        </div>

        {team&&alloc.length>0&&
          <div className="field">
            <span className="field-label">팀원별 점수 배분 (개별 수정 가능)</span>
            <div className="bk-alloc">
              {alloc.map(a=>
                <div className="bk-alloc-row" key={a.key}>
                  <span className={"bk-alloc-tag "+(a.label==="우승"?"w":a.label==="준우승"?"r":"s")}>{a.label}</span>
                  <b>{a.member}</b>
                  {badgeFor(a.member)}
                  <span className="bk-alloc-team">{a.team}</span>
                  <input
                    aria-label={`${a.label} 점수`}
                    value={override[a.key]??""}
                    placeholder={String(a.base)}
                    onChange={e=>setOverride({...override,[a.key]:e.target.value.replace(/[^0-9.]/g,"")})}
                  />
                </div>
              )}
            </div>
          </div>
        }

        <label className="bk-check">
          <input
            type="checkbox"
            checked={bumpRank&&!excluded}
            onChange={e=>setBumpRank(e.target.checked)}
            disabled={excluded}
          />
          <span>
            누적 랭킹 반영 {excluded?"(이 대회는 제외)":(team?"(점수 배분)":"(승/준/4강 + 점수)")}
          </span>
        </label>

        {bumpRank&&!excluded&&
          <div className="field">
            <label htmlFor="bk-rank-era">반영할 누적 랭킹</label>
            <Dropdown
              id="bk-rank-era"
              value={rankKey}
              onChange={setRankKey}
              placeholder="랭킹 선택"
              options={(data.rankings||[]).map(r=>({value:r.key,label:r.label}))}
            />
          </div>
        }

        <label className="bk-check">
          <input
            type="checkbox"
            checked={bumpSeason&&!champ&&!excluded}
            onChange={e=>setBumpSeason(e.target.checked)}
            disabled={!recordSeason||champ||excluded}
          />
          <span>
            시즌별 성적 반영 {excluded?"(이 대회는 제외)":champ?"(챔피언스 시리즈는 제외)":(recordSeason?`(${recordSeason})`:"(시즌을 먼저 선택)")}
          </span>
        </label>
      </>}

      {guard&&<FormError>{guard}</FormError>}
      <div className="modal-actions">
        <Button variant="second" onClick={onClose}>나중에</Button>
        <Button variant="main" icon="check" onClick={prepare} disabled={linked&&(linkedContextBusy||Boolean(linkedContextError))}>기록에 반영</Button>
      </div>
    </div>
  </Modal>);
}

