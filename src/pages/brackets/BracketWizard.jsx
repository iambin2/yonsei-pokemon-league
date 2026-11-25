import React, { useEffect, useRef, useState } from "react";
import { splitTeams } from "../../services/teamSplit.js";
import { formatDate } from "../../services/dateFormat.js";
import { Button, Dropdown, Empty, ErrorNote, Field, FormError, Icon, Loader, STAGGER, Segmented } from "../../components/index.js";
import { BackLink, Counter, Dock, Steps, Toast } from "../../components/common/Board.jsx";
import { addChampionshipQualifierManualRegistration, recommendChampionshipDirectEntrants, buildNormalizedSingleCreateAttempt, championshipEventPickerLabel, createChampionshipAdvancement, listChampionshipManualParticipantCandidates, listChampionshipQualifierDirectSelectionIds, listEventRegistrationSubmissionStatuses, listEventRegistrations, loadPrivateAnswers, listSubmissionEvents, preflightChampionshipFinalBracket, setChampionshipQualifierDirectSelections, readEventCheckins, bracketRulesReady } from "../../services/index.js";
import { getTeamRegistrationAnswerEntries } from "../../services/bracketTeamParticipants.js";
import { playerNameKey } from "../../services/teamBuilderCore.js";
import { freshRead } from "../../services/readCache.js";
import { drawPlan, seededPlan } from "../../services/bracketProjection.js";
import { fetchNormalizedRecordsSnapshot } from "../../services/normalizedRecordsService.js";
import { buildNormalizedRecordsProjection } from "../../services/normalizedRecordsProjection.js";
import { GROUP_TOPOLOGY, groupDraw, validateGroupConfig } from "../../services/groupBracketCore.js";
import { listSameRoundRookieChampions } from "../../services/normalizedCompetitionService.js";
import { leagueIntakeId, leagueIntakeOptions } from "../../services/leagueIntake.js";

const uid = () => Math.random().toString(36).slice(2, 9);
const nextPow2 = n => { let p = 1; while (p < n) p *= 2; return p; };
const WINS_OPTIONS = [{ value: "1", label: "단판" }, { value: "2", label: "2선승" }, { value: "3", label: "3선승" }];

export default function BracketWizard({ data, onClose, onCreate }){
  const [step,setStep]=useState(1);
  const [name,setName]=useState("");
  const [mode,setMode]=useState("single");      // single=개인전, team=팀전
  const [topologyKind,setTopologyKind]=useState("");
  const [groupFinalFormat,setGroupFinalFormat]=useState("single_elimination");
  const dbl=topologyKind==="double_elimination";
  const [format,setFormat]=useState("elim");     // elim | group
  const [countStr,setCountStr]=useState("8");
  const count=Math.max(0,parseInt(countStr)||0);
  const [groups,setGroups]=useState("2");
  const [adv,setAdv]=useState("2");
  const [teams,setTeams]=useState(Array(8).fill(null).map(()=>({name:"",members:""})));
  const [events,setEvents]=useState([]);
  const [eventListLoading,setEventListLoading]=useState(true);
  const [eventId,setEventId]=useState("");
  const [eventRegs,setEventRegs]=useState([]);
  const [eventBusy,setEventBusy]=useState(false);
  const [eventError,setEventError]=useState("");
  const [submissionStatuses,setSubmissionStatuses]=useState([]);
  const [submissionStatusError,setSubmissionStatusError]=useState("");
  const [selectedRegistrationIds,setSelectedRegistrationIds]=useState([]);
  const [checkedIn,setCheckedIn]=useState(()=>new Set());
  const [thirdPlace,setThirdPlace]=useState(false), [winsTo,setWinsTo]=useState(1), [finalWinsTo,setFinalWinsTo]=useState(1), [rulesOn,setRulesOn]=useState(false);
  const [directRegistrationIds,setDirectRegistrationIds]=useState([]);
  const [addedParticipants,setAddedParticipants]=useState([]);
  const [championshipManualOpen,setChampionshipManualOpen]=useState(false);
  const [championshipManualCandidates,setChampionshipManualCandidates]=useState([]);
  const [championshipManualPlayerId,setChampionshipManualPlayerId]=useState("");
  const [championshipManualReason,setChampionshipManualReason]=useState("");
  const [championshipManualBusy,setChampionshipManualBusy]=useState(false);
  const [creating,setCreating]=useState(false);
  const normalizedAttemptRef=useRef(null);
  /* 3 대진 배치: 만들기 전에 추첨을 보여 주고 자리를 바꾼다. parts는 이 배치가 가리키는 참가자 그대로다 */
  const [placement,setPlacement]=useState(null);
  const [held,setHeld]=useState(null);
  const dragFrom=useRef(null);
  const eventRequestRef=useRef(0);

  useEffect(()=>{
    let cancelled=false;
    listSubmissionEvents()
      .then(rows=>{ if(!cancelled) setEvents([...(rows||[])].sort((a,b)=>{
        const phaseOrder=value=>value==="qualifier"?0:value==="final"?1:2;
        const phaseDiff=phaseOrder(a.championship_phase)-phaseOrder(b.championship_phase);
        return phaseDiff||String(a.name||"").localeCompare(String(b.name||""),"ko");
      })); })
      .catch(error=>{ if(!cancelled) setEventError(error?.message||"대회 목록을 불러오지 못했습니다."); })
      .finally(()=>{ if(!cancelled) setEventListLoading(false); });
    return ()=>{ cancelled=true; };
  },[]);
  const selectLinkedEvent=async(id,{preserveDirectIds=null,preserveSelectedIds=null}={})=>{
    const request=++eventRequestRef.current;
    setEventId(id);
    normalizedAttemptRef.current=null;
    setEventError("");
    setEventRegs([]);
    setSelectedRegistrationIds([]);
    setSubmissionStatuses([]);
    setSubmissionStatusError("");
    setDirectRegistrationIds([]);
    setChampionshipManualOpen(false);
    setChampionshipManualCandidates([]);
    setChampionshipManualPlayerId("");
    setChampionshipManualReason("");
    if(!id){setEventBusy(false);return;}

    const event=events.find(x=>x.id===id);
    if(!event) return;

    setName(event.name||"");
    setMode(event.is_team_event?"team":"single");

    setFormat("elim");
    setTopologyKind("");
    setAddedParticipants([]);

    setEventBusy(true);
    try{
      const [registrationResult, directSelectionResult, championResult] = await Promise.allSettled([
        listEventRegistrations(id),
        event.championship_phase === "qualifier" ? listChampionshipQualifierDirectSelectionIds(id) : Promise.resolve([]),
        leagueIntakeId(event)&&event.division==="master" ? listSameRoundRookieChampions(id) : Promise.resolve([]),
      ]);
      if (registrationResult.status === "rejected") throw registrationResult.reason;
      // 팀 지망 같은 비공개 답은 운영진만 읽는 표에서 따로 온다(docs/db/private_answers.sql)
      const loaded = registrationResult.value || [];
      if(championResult.status==="rejected") throw championResult.reason;
      const champions=championResult.value||[];
      const championIds=new Set(champions.map(row=>row.player_id));
      const hidden = await loadPrivateAnswers(loaded.map(r=>r.id));
      const realRegs = loaded.map(r=>({
        ...r,
        ...(hidden.has(r.id)?{registration_data:{...r.registration_data,answers:{...r.registration_data?.answers,...hidden.get(r.id)}}}:{}),
        rookieChampion:championIds.has(r.player_id),
      }));
      const regs=[...realRegs,...champions.filter(c=>!loaded.some(r=>r.id===c.registration_id||r.player_id===c.player_id)).map(c=>({
        id:`rookie:${c.player_id}`,player_id:c.player_id,registration_name:c.registration_name||c.display_name,
        rookieChampion:true,candidateOnly:true,
      }))];
      let statuses=[];
      try{ statuses=await listEventRegistrationSubmissionStatuses(id,realRegs); }
      catch(statusError){ if(request===eventRequestRef.current)setSubmissionStatusError(statusError?.message || "제출 상태를 불러오지 못했습니다."); }
      if(request!==eventRequestRef.current)return;
      setEventRegs(regs);
      setSubmissionStatuses(statuses || []);
      const directIds = directSelectionResult.status === "fulfilled" ? directSelectionResult.value : [];
      if (directSelectionResult.status === "rejected") setEventError(directSelectionResult.reason?.message || "저장된 본선 직행자를 불러오지 못했습니다.");
      const registrationIds=(regs||[]).map(r=>r.id);
      const nextDirectIds=(preserveDirectIds||directIds).filter(registrationId=>registrationIds.includes(registrationId));
      const nextSelectedIds=preserveSelectedIds
        ? preserveSelectedIds.filter(registrationId=>registrationIds.includes(registrationId)&&!nextDirectIds.includes(registrationId))
        : registrationIds.filter(registrationId=>!nextDirectIds.includes(registrationId));
      setDirectRegistrationIds(nextDirectIds);
      setSelectedRegistrationIds(nextSelectedIds);
      setAddedParticipants([]);

      if(event.is_team_event){
        setCountStr("8");
        setTeams(Array(8).fill(null).map(()=>({name:"",members:""})));
      }
    }catch(error){
      if(request!==eventRequestRef.current)return;
      setEventError(error?.message||"신청자 목록을 불러오지 못했습니다.");
      setSubmissionStatusError(error?.message || "제출 상태를 불러오지 못했습니다.");
    }finally{
      if(request===eventRequestRef.current)setEventBusy(false);
    }
  };

  const setCnt=(v)=>{ const s=String(v).replace(/[^0-9]/g,"").slice(0,2); setCountStr(s); const n=parseInt(s)||0;
    if(n>=1&&n<=64){
      setTeams(p=>{const a=[];for(let i=0;i<n;i++)a.push(p[i]||{name:"",members:""});return a;}); } };
  const gN=Number(groups), aN=Number(adv);
  const buildParticipants=()=>{
    if(mode==="team") return teams.map(t=>({
      id:uid(),
      name:(t.name||"").trim(),
      members:(t.members||"").split(/[,\n]/).map(s=>s.trim()).filter(Boolean)
    })).filter(t=>t.name);

    if(eventId){
      const registered=eventRegs
        .filter(r=>selectedRegistrationIds.includes(r.id) && !directRegistrationIds.includes(r.id))
        .map(r=>({
          id:uid(),
          name:(r.registration_name||"").trim(),
          registrationId:r.candidateOnly?null:r.id,
          playerId:r.player_id||null,
          rookieChampion:r.candidateOnly
        }))
        .filter(p=>p.name);

      const added=linkedEvent?.championship_phase ? [] : addedParticipants
        .map(n=>({id:uid(),name:(n||"").trim()}))
        .filter(p=>p.name);

      return [...registered,...added];
    }

    return [];
  };
  const go=async()=>{
    if(creating)return;
    if(!topologyKind){setEventError("대진 방식을 선택해 주세요.");return;}
    if(linkedEvent?.championship_phase === "qualifier"){
      try{
        await setChampionshipQualifierDirectSelections(linkedEvent.id,directRegistrationIds);
      }catch(error){ setEventError(error?.message||"본선 직행자를 저장하지 못했습니다."); return; }
    }
    let parts=(step===3&&placement?.parts)||buildParticipants();
    if(parts.length<2){ setEventError(linkedEvent?.championship_phase==="final"?"본선 진출자를 먼저 확정해 주세요.":"참가자(팀)를 2개 이상 입력해 주세요."); return; }
    if(!eventId){setEventError("대회와 연결된 대진표를 만들어 주세요.");return;}
    if(format==="group"){
      try{validateGroupConfig(parts.length,gN,aN,groupFinalFormat);}
      catch(error){setEventError(error.message);return;}
    }
    if(linkedEvent?.championship_phase === "final"){
      try{
        const preflight=await preflightChampionshipFinalBracket(linkedEvent.id);
        if(!preflight.ok){ setEventError(preflight.error); return; }
      }catch(error){ setEventError(error?.message||"본선 대진표 생성 조건을 확인하지 못했습니다."); return; }
    }
    if(dbl&&parts.length<3){setEventError("더블 엘리미네이션은 참가자가 3명 이상이어야 합니다.");return;}
    if(new Set(parts.map(p=>playerNameKey(p.name))).size!==parts.length){setEventError("같은 이름의 참가자가 중복되어 있습니다.");return;}
    const useDbl = dbl;
    setCreating(true);
    let created=false;
    try{
      let normalizedAttempt=null;
      if(eventId&&mode==="single"){
        const attemptKey=JSON.stringify([topologyKind,format==="group"?[gN,aN,groupFinalFormat]:null,
          parts.map(p=>[p.registrationId||null,p.playerId||null,p.name]),(step===3&&placement?.plan)||null]);
        if(!normalizedAttemptRef.current||normalizedAttemptRef.current.attemptKey!==attemptKey){
          normalizedAttemptRef.current={attemptKey,...buildNormalizedSingleCreateAttempt(parts,{plan:format==="elim"?(step===3&&placement?.plan)||null:null})};
        }
        normalizedAttempt=normalizedAttemptRef.current;
      }
      created=await onCreate({ id:uid(), name:name.trim()||"새 대회", createdAt:new Date().toISOString().slice(0,10),
        mode, double:useDbl, format, groupCfg:format==="group"?{groups:gN,adv:aN,finalFormat:groupFinalFormat}:null,
        rookiePlayers:parts.filter(p=>p.rookieChampion).map(p=>p.playerId),
        eventId:eventId||null,
        participants:normalizedAttempt
          ? normalizedAttempt.participants.map(p=>({
              id:p.participant_key,
              name:p.display_name,
              registrationId:p.registration_id,
              playerId:p.player_id,
              entryId:p.entry_id,
              entryParticipantId:p.entry_participant_id,
            }))
          : parts,
        normalizedAttempt,
        plan:(step===3&&placement?.plan)||null,
        graph:null, groups:null, knockout:null, status:"active", applied:null,
        rules:rulesOn&&(thirdPlace||winsTo>1||finalWinsTo>1)?{thirdPlace:thirdPlace&&(topologyKind==="single_elimination"||groupFinalFormat==="single_elimination"),winsTo,finalWinsTo}:null });
    }catch(error){setEventError(error?.message||"대진표를 생성하지 못했습니다.");}
    finally{setCreating(false);}
    if(created)onClose();
  };
  const submissionStatusByRegistrationId = new Map((submissionStatuses || []).map(status => [status.registrationId, status]));
  const formatSubmissionTime = value => value ? formatDate(value, { time: true }) : "";
  const submissionBadge = registrationId => {
    const status = submissionStatusByRegistrationId.get(registrationId);
    if (!status?.hasSubmission) {
      return <span className="bk-hint bk-participant-submission missing">미제출</span>;
    }
    const submittedAt = formatSubmissionTime(status.latestSubmittedAt);
    return (
      <span
        className="bk-hint bk-participant-submission submitted"
        title={submittedAt ? `제출 시간 ${submittedAt}` : undefined}
      >
        제출 완료
      </span>
    );
  };
  const linkedEvent=events.find(event=>event.id===eventId)||null;
  useEffect(()=>{ let on=true; if(mode==="single"&&linkedEvent&&linkedEvent.event_type!=="champions") bracketRulesReady().then(ok=>on&&setRulesOn(ok)); else setRulesOn(false); return ()=>{ on=false; }; },[mode,linkedEvent?.id]);
  // 체크인한 신청자(셀프 체크인): 대진표에 넣을 사람을 한 번에 고르는 단추
  useEffect(()=>{ let on=true; readEventCheckins(eventId).then(set=>on&&setCheckedIn(set)).catch(()=>{}); return ()=>{ on=false; }; },[eventId]);
  const groupAvailable=Boolean(linkedEvent&&!linkedEvent.is_team_event&&!linkedEvent.championship_phase&&linkedEvent.event_type!=="champions");
  /* 직행 추천: 시즌 랭킹 상위 4명 가운데 신청한 사람(docs/db/champions_direct_recommendation.sql). 고르는 것은 운영자다 */
  const [directPicks,setDirectPicks]=useState([]);
  const qualifierId=linkedEvent?.championship_phase==="qualifier"?linkedEvent.id:null;
  useEffect(()=>{
    let live=true;
    setDirectPicks([]);
    if(qualifierId) recommendChampionshipDirectEntrants(qualifierId).then(rows=>{ if(live) setDirectPicks(rows||[]); });
    return ()=>{ live=false; };
  },[qualifierId]);
  const pickFor=id=>directPicks.find(pick=>pick.registrationId===id);
  const takeDirectPicks=()=>{ const ids=directPicks.map(pick=>pick.registrationId); setDirectRegistrationIds(ids); setSelectedRegistrationIds(prev=>prev.filter(id=>!ids.includes(id))); };
  const selectedIntakeId=leagueIntakeId(linkedEvent);
  const intakeEvents=selectedIntakeId?events.filter(event=>leagueIntakeId(event)===selectedIntakeId):[];
  const linkedAnnouncement=(data?.announcements||[]).find(announcement=>
    announcement.id===linkedEvent?.registration_settings?.announcementId
  );
  const linkedFields=linkedAnnouncement?.form?.fields||[];
  const assignedTeamsFor=(name)=>teams
    .filter(team=>(team.members||"").split(/[,\n]/).map(value=>value.trim()).includes(name))
    .map(team=>(team.name||"").trim()||"이름 없는 팀");
  const openChampionshipManualParticipant=async()=>{
    if(!linkedEvent?.championship_phase||championshipManualBusy)return;
    setEventError("");
    setChampionshipManualBusy(true);
    try{
      const candidates=await listChampionshipManualParticipantCandidates(linkedEvent.id);
      setChampionshipManualCandidates(candidates);
      setChampionshipManualPlayerId(candidates[0]?.id||"");
      setChampionshipManualReason("");
      setChampionshipManualOpen(true);
    }catch(error){ setEventError(error?.message||"추가할 참가자 후보를 불러오지 못했습니다."); }
    finally{ setChampionshipManualBusy(false); }
  };
  const addChampionshipManualParticipant=async()=>{
    if(!linkedEvent?.championship_phase||!championshipManualPlayerId||championshipManualBusy)return;
    setEventError("");
    setChampionshipManualBusy(true);
    try{
      if(linkedEvent.championship_phase==="qualifier"){
        await addChampionshipQualifierManualRegistration({qualifierEventId:linkedEvent.id,playerId:championshipManualPlayerId});
      }else{
        await createChampionshipAdvancement({finalEventId:linkedEvent.id,playerId:championshipManualPlayerId,advancementType:"manual",reason:championshipManualReason});
      }
      await selectLinkedEvent(linkedEvent.id,{
        preserveDirectIds:directRegistrationIds,
        preserveSelectedIds:selectedRegistrationIds,
      });
    }catch(error){ setEventError(error?.message||"수동 참가자를 추가하지 못했습니다."); }
    finally{ setChampionshipManualBusy(false); }
  };
  const confirmedCount=selectedRegistrationIds.filter(id=>!directRegistrationIds.includes(id)).length;
  const placeable=Boolean(eventId);
  const startPlacement=()=>{
    if(!topologyKind){setEventError("대진 방식을 선택해 주세요.");return;}
    const parts=buildParticipants();
    if(format==="group"){
      try{validateGroupConfig(parts.length,gN,aN,groupFinalFormat);}
      catch(error){setEventError(error.message);return;}
    }
    if(dbl&&parts.length<3){setEventError("더블 엘리미네이션은 참가자가 3명 이상이어야 합니다.");return;}
    if(new Set(parts.map(p=>playerNameKey(p.name))).size!==parts.length){setEventError("같은 이름의 참가자가 중복되어 있습니다.");return;}
    if(parts.length<2){ setEventError(linkedEvent?.championship_phase==="final"?"본선 진출자를 먼저 확정해 주세요.":"참가자(팀)를 2개 이상 입력해 주세요."); return; }
    setEventError("");
    setHeld(null);
    setPlacement({parts,plan:format==="group"?groupDraw(parts.map(p=>p.id),gN):drawPlan(parts.map(p=>p.id))});
    setStep(3);
  };
  const redraw=()=>{ setHeld(null); setPlacement(p=>p&&{...p,plan:format==="group"?groupDraw(p.parts.map(x=>x.id),gN):drawPlan(p.parts.map(x=>x.id))}); };
  /* 랭킹 시드: the participants by this season's ranking points (records, the newest season), the unranked after them in draw order */
  const [seeding,setSeeding]=useState(false);
  const seedByRanking=async()=>{
    setSeeding(true);
    try{
      const raw=await freshRead("records",fetchNormalizedRecordsSnapshot,60000);
      const season=buildNormalizedRecordsProjection(data,raw,null).ranking?.seasons?.[0];
      const points=new Map((season?.rows||[]).flatMap(row=>[[row.playerId,row.points],[`name:${playerNameKey(row.name||"")}`,row.points]]));
      const pointsOf=part=>points.get(part.playerId)??points.get(`name:${playerNameKey(part.name)}`)??-1;
      setHeld(null);
      setPlacement(p=>{ if(!p)return p; const drawn=drawPlan(p.parts.map(x=>x.id)).flat().filter(Boolean); const byId=new Map(p.parts.map(x=>[x.id,x]));
        return {...p,plan:seededPlan([...drawn].sort((x,y)=>pointsOf(byId.get(y))-pointsOf(byId.get(x))))}; });
      setEventError(season?.rows?.length?"":"이번 시즌 랭킹이 아직 없어 추첨 순서 그대로 놓았습니다.");
    }catch(error){ setEventError(`랭킹을 읽지 못했습니다. ${error?.message||""}`.trim()); }
    finally{ setSeeding(false); }
  };
  /* 팀 나누기 (2026-11-22, the owner's draft 5 A): a team event's applicants dealt into the teams by this season's ranking points, the
     cards filled to be edited as before; 다시 나누기 deals again with equal points in another order */
  const [splitNote,setSplitNote]=useState("");
  const splitByRanking=async()=>{
    setSeeding(true);
    try{
      const raw=await freshRead("records",fetchNormalizedRecordsSnapshot,60000);
      const season=buildNormalizedRecordsProjection(data,raw,null).ranking?.seasons?.[0];
      const points=new Map((season?.rows||[]).map(row=>[playerNameKey(row.name||""),row.points]));
      const n=Math.max(2,teams.length);
      const dealt=splitTeams(eventRegs.map(r=>r.registration_name),name=>points.get(playerNameKey(name))??0,n);
      setTeams(dealt.map((t,i)=>({name:teams[i]?.name||`${i+1}팀`,members:t.members.join(", ")})));
      setSplitNote(`팀마다 포인트 합 ${dealt.map(t=>t.points).join(", ")}`);
    }catch(error){ setEventError(`랭킹을 읽지 못했습니다. ${error?.message||""}`.trim()); }
    finally{ setSeeding(false); }
  };
  const swapPlaces=(x,y)=>{ if(!x||!y||x===y)return; setPlacement(p=>({...p,plan:p.plan.map(pair=>pair.map(k=>k===x?y:k===y?x:k))})); };
  const placeName=key=>placement?.parts.find(p=>p.id===key)?.name||"";
  const tapPlace=key=>{ if(dragFrom.current?.moved){ dragFrom.current=null; return; } if(held==null) setHeld(key); else { swapPlaces(held,key); setHeld(null); } };
  const placeCell=key=>key==null
    ? <span className="bk-place-name bye t15">부전승</span>
    : <button type="button" data-key={key} className={"bk-place-name t15 "+(held===key?"inv":"")} aria-pressed={held===key}
        onPointerDown={e=>{ if(e.pointerType==="mouse") dragFrom.current={key,x:e.clientX,y:e.clientY,moved:false}; }}
        onClick={()=>tapPlace(key)}>{placeName(key)}</button>;
  const dragPlace=e=>{ const from=dragFrom.current; if(from&&!from.lit&&Math.hypot(e.clientX-from.x,e.clientY-from.y)>=8){ from.lit=true; setHeld(from.key); } };
  const dropPlace=e=>{
    const from=dragFrom.current; if(!from)return;
    if(Math.hypot(e.clientX-from.x,e.clientY-from.y)<8){ dragFrom.current=null; return; }
    from.moved=true;
    const target=document.elementFromPoint(e.clientX,e.clientY)?.closest("[data-key]");
    if(target) swapPlaces(from.key,target.dataset.key);
    setHeld(null);
  };
  return (<div className="bk-create">
    <BackLink to="대진표" onClick={onClose}/>
    <header className="bk-head"><h1 className="page-title">대진표 만들기</h1>{(linkedEvent?.name||name)&&<span className="t12 dim">{linkedEvent?.name||name}</span>}</header>
    <Steps labels={placeable?["대회 설정","참가자 확정","대진 배치"]:["대회 설정","참가자 확정"]} at={step}/>
    <div className={"form-card swap"+(step===1?" bk-step1":"")} key={step}>
    {step===1&&<>
      {eventListLoading?<Loader/>:!events.length?<>
        {eventError?<ErrorNote>{eventError}</ErrorNote>:<Empty title="연결할 대회가 없습니다."
          desc="공지에서 대회를 연결한 신청서를 먼저 등록해 주세요. 기록을 반영한 대회는 이 목록에 표시하지 않습니다."/>}
        <Dock><Button variant="second" onClick={onClose}>대진표로 돌아가기</Button></Dock>
      </>:<>
      <div className="field">
        <label htmlFor="bk-reg-event">신청 대회 선택</label>
        <Dropdown
          id="bk-reg-event"
          value={selectedIntakeId?`intake:${selectedIntakeId}`:eventId}
          onChange={v=>{
            const selected=v.startsWith("intake:")
              ? events.find(event=>leagueIntakeId(event)===v.slice(7)&&event.division==="master")||events.find(event=>leagueIntakeId(event)===v.slice(7))
              : events.find(event=>event.id===v);
            selectLinkedEvent(selected?.id||"");
          }}
          placeholder="대회를 선택해 주세요."
          options={leagueIntakeOptions(events).map(option=>({value:option.value,label:option.label||championshipEventPickerLabel(option.event)}))}
        />
        {selectedIntakeId&&<div className="field">
          <span className="field-label">대진표 리그</span>
          <Segmented value={linkedEvent.division} onChange={division=>{const event=intakeEvents.find(row=>row.division===division);if(event)selectLinkedEvent(event.id);}} ariaLabel="대진표 리그" options={intakeEvents.map(event=>[event.division,event.division==="master"?"마스터":"루키"])}/>
        </div>}
        {linkedEvent?.is_team_event&&linkedEvent.division==="master"&&<div className="bk-hint">팀전은 마스터로 진행합니다.</div>}
        {eventError&&<FormError>{eventError}</FormError>}
        {eventId&&!eventBusy&&mode!=="team"&&submissionStatusError&&<div className="bk-hint" style={{color:"var(--lit)"}}>파티 제출 상태: {submissionStatusError}</div>}
      </div>

      <Field label="대진 방식" hint={!linkedEvent?"신청 대회를 먼저 선택해 주세요.":groupAvailable?"생성한 뒤에는 바꿀 수 없습니다.":linkedEvent.is_team_event?"팀전은 싱글 또는 더블 엘리미네이션으로 진행합니다.":"챔피언스는 선발전과 본선에서 각각 싱글 또는 더블 엘리미네이션을 선택합니다."}>
        <Dropdown disabled={!linkedEvent} value={topologyKind} onChange={value=>{setTopologyKind(value);setFormat(value===GROUP_TOPOLOGY?"group":"elim");}} placeholder="대진 방식을 선택해 주세요." ariaLabel="대진 방식" options={[{value:"single_elimination",label:"싱글 엘리미네이션"},{value:"double_elimination",label:"더블 엘리미네이션"},...(groupAvailable?[{value:GROUP_TOPOLOGY,label:"조별리그 후 본선"}]:[])]} />
      </Field>
      {topologyKind===GROUP_TOPOLOGY&&<>
        <div className="bk-grow2">
          <Field label="조 수"><input type="number" min="1" max="32" value={groups} onChange={e=>setGroups(e.target.value)}/></Field>
          <Field label="조별 진출 인원"><input type="number" min="1" max="63" value={adv} onChange={e=>setAdv(e.target.value)}/></Field>
        </div>
        <Field label="본선 방식" hint="진출자는 조 순위에 따른 시드 없이 본선을 추첨합니다.">
          <Dropdown ariaLabel="본선 방식" value={groupFinalFormat} onChange={setGroupFinalFormat} options={[{value:"single_elimination",label:"싱글 엘리미네이션"},{value:"double_elimination",label:"더블 엘리미네이션"}]}/>
        </Field>
      </>}
      {/* 3위 결정전과 N선승 (2026-11-22, the owner's picks: chosen here, individual events, not Champions; third_place_best_of.sql) */}
      {rulesOn&&topologyKind&&<>
        {(topologyKind==="single_elimination"||(topologyKind===GROUP_TOPOLOGY&&groupFinalFormat==="single_elimination"))&&
          <label className="bk-check"><input type="checkbox" checked={thirdPlace} onChange={e=>setThirdPlace(e.target.checked)}/><span>3위 결정전 <i>(준결승의 두 패자가 3위와 4위를 가립니다)</i></span></label>}
        <div className="bk-grow2">
          <Field label="경기"><Dropdown ariaLabel="경기의 선승 수" value={String(winsTo)} onChange={v=>setWinsTo(Number(v))} options={WINS_OPTIONS}/></Field>
          <Field label="결승"><Dropdown ariaLabel="결승의 선승 수" value={String(finalWinsTo)} onChange={v=>setFinalWinsTo(Number(v))} options={WINS_OPTIONS}/></Field>
        </div>
      </>}
      <Dock>
        <div className="stack bk-dock">
          <Button variant="second" onClick={onClose}>취소</Button>
          <Button variant="main" onClick={()=>setStep(2)} disabled={!topologyKind||!eventId||eventBusy} loading={eventBusy}>다음</Button>
        </div>
      </Dock>
      </>}
    </>}    {step===2&&<>
      {eventError&&<FormError>{eventError}</FormError>}
      {eventId&&mode!=="team" ? <>
        {linkedEvent?.championship_phase==="qualifier"&&<div className="field">
          <span className="field-label">본선 직행자 선택</span>
          <div className="bk-hint">신청자 중 운영자가 직접 선택합니다. 직행자는 선발전 대진표에서 빠지며, 본선 참가 신청은 아직 만들지 않습니다.{directPicks.length>0&&` 시즌 랭킹 상위 신청자 ${directPicks.length}명을 추천합니다.`}</div>
          {directPicks.length>0&&!(directPicks.length===directRegistrationIds.length&&directPicks.every(pick=>directRegistrationIds.includes(pick.registrationId)))&&<Button variant="second" size="sm" onClick={takeDirectPicks}>추천대로 선택</Button>}
          <div className="bk-fill">{eventRegs.map((reg,i)=>{const checked=directRegistrationIds.includes(reg.id);return <label className="bk-pin" key={`direct-${reg.id}`} style={{animationDelay:(i*STAGGER.row)+"ms",cursor:"pointer"}}><span className="bk-pin-no gold">{i+1}</span><input type="checkbox" checked={checked} onChange={()=>{setDirectRegistrationIds(prev=>checked?prev.filter(id=>id!==reg.id):[...prev,reg.id]);setSelectedRegistrationIds(prev=>checked?prev:[...prev.filter(id=>id!==reg.id)]);}} /><span style={{flex:1,fontWeight: 600}}>{reg.registration_name}</span><span className="bk-hint" style={{margin:0}}>{[checked?"본선 직행":pickFor(reg.id)&&"추천",pickFor(reg.id)&&`시즌 ${pickFor(reg.id).rank}위`].filter(Boolean).join(", ")}</span></label>;})}</div>
        </div>}
        <div className="stack bk-counters">
          <Counter label="신청" value={eventRegs.length}/>
          <Counter label="확정" value={confirmedCount}/>
          <Counter label="불참" value={Math.max(0,eventRegs.length-directRegistrationIds.length-confirmedCount)}/>
        </div>
        <div className="field">
          <span className="field-label">참가자 확정</span>
          {linkedEvent?.championship_phase==="qualifier"&&<div className="bk-hint">직행자 {directRegistrationIds.length}명은 제외하고 선발전 실제 참가자를 확정합니다.</div>}
        </div>

        <div className="bk-fill bk-participant-confirm-list">
          {eventRegs.map((reg,i)=>{
            if(linkedEvent?.championship_phase==="qualifier"&&directRegistrationIds.includes(reg.id)) return null;
            const checked=selectedRegistrationIds.includes(reg.id);
            return (
              <label className="bk-pin bk-participant-confirm-row" key={reg.id} style={{animationDelay:(i*STAGGER.row)+"ms",cursor:"pointer"}}>
                <span className="bk-pin-no">{i+1}</span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={()=>{
                    setSelectedRegistrationIds(prev=>
                      checked ? prev.filter(id=>id!==reg.id) : [...prev,reg.id]
                    );
                  }}
                  
                />
                <span className="bk-participant-name">{reg.registration_name}</span>
                {reg.rookieChampion&&<span className="bk-hint">이번 회차 루키 우승자</span>}
                {submissionBadge(reg.id)}
                {!checked&&<span className="bk-hint bk-participant-absent">불참</span>}
              </label>
            );
          })}

          {!linkedEvent?.championship_phase && addedParticipants.map((name,i)=>(
            <div className="bk-pin bk-participant-confirm-row bk-participant-added" key={`added-${i}`}>
              <span className="bk-pin-no gold">+</span>
              <input
                aria-label="추가 참가자 이름"
                value={name}
                onChange={e=>setAddedParticipants(prev=>prev.map((x,j)=>j===i?e.target.value:x))}
                placeholder="추가 참가자 이름"
              />
              <Button variant="second"
                type="button"
                size="sm"
                onClick={()=>setAddedParticipants(prev=>prev.filter((_,j)=>j!==i))}
              >
                삭제
              </Button>
            </div>
          ))}
        </div>

        <div className="stack bk-pin-keys">
            <Button variant="second"
              type="button"
              size="sm"
              onClick={()=>setSelectedRegistrationIds(eventRegs.map(r=>r.id))}
            >
              전체 선택
            </Button>
            <Button variant="second"
              type="button"
              size="sm"
              onClick={()=>setSelectedRegistrationIds([])}
            >
              전체 해제
            </Button>
            {eventRegs.some(r=>checkedIn.has(r.id))&&<Button variant="second" type="button" size="sm"
              onClick={()=>setSelectedRegistrationIds(eventRegs.filter(r=>checkedIn.has(r.id)).map(r=>r.id))}>
              체크인한 {eventRegs.filter(r=>checkedIn.has(r.id)).length}명
            </Button>}
          {linkedEvent?.championship_phase ? <Button variant="second"
            type="button"
            size="sm"
            onClick={openChampionshipManualParticipant}
            disabled={championshipManualBusy}
          >
            참가자 추가
          </Button> : <Button variant="second"
            type="button"
            size="sm"
            onClick={()=>setAddedParticipants(prev=>[...prev,""])}
          >
            참가자 추가
          </Button>}
        </div>
        {championshipManualOpen&&linkedEvent?.championship_phase&&<div className="field" style={{marginTop:"var(--s3)"}}>
          <span className="field-label">참가자 추가</span>
          <div className="bk-grow2">
            <Dropdown
              value={championshipManualPlayerId}
              onChange={setChampionshipManualPlayerId}
              placeholder="선수 선택"
              options={championshipManualCandidates.map(player=>({value:player.id,label:player.display_name}))}
            />
            {linkedEvent.championship_phase==="final"&&<input
              aria-label="운영 사유 (선택)"
              value={championshipManualReason}
              onChange={event=>setChampionshipManualReason(event.target.value)}
              placeholder="운영 사유 (선택)"
            />}
          </div>
          <div className="row-actions" style={{justifyContent:"flex-end",marginTop:"var(--s2)"}}>
            <Button variant="second" type="button" size="sm" disabled={championshipManualBusy} onClick={()=>setChampionshipManualOpen(false)}>취소</Button>
            <Button type="button" variant="main" icon="check" size="sm" disabled={!championshipManualPlayerId||championshipManualBusy} onClick={addChampionshipManualParticipant}>추가</Button>
          </div>
        </div>}
        {linkedEvent?.championship_phase==="qualifier"&&(()=>{const capacity=Number(linkedEvent?.competition_settings?.championship?.finalCapacity)||0;const actual=selectedRegistrationIds.filter(id=>!directRegistrationIds.includes(id)).length;const target=capacity-directRegistrationIds.length;const eliminated=actual-target;return <div className="bk-hint" style={{marginTop:"var(--s2)"}}>본선 정원은 {capacity}명이고 본선 직행은 {directRegistrationIds.length}명입니다. 선발전에는 {actual}명이 참가해 {target}명이 통과하므로 {Math.max(0,eliminated)}명이 탈락해야 합니다.{actual<target&&<span style={{color:"var(--lit)"}}> 참가 인원이 부족해 본선 정원을 채울 수 없습니다.</span>}</div>;})()}
      </> : <>
        {eventId&&mode==="team"&&<div className="field">
          <span className="field-label">신청자 / 팀 지망</span>
          <div className="bk-fill">
            {eventRegs.map((reg,i)=>{
              const answers=getTeamRegistrationAnswerEntries(reg,linkedFields);
              const assigned=assignedTeamsFor(reg.registration_name);
              return <div className="bk-pin" key={reg.id} style={{animationDelay:(i*STAGGER.row)+"ms"}}>
                <span className="bk-pin-no">{i+1}</span>
                <div style={{flex:1,minWidth:0}}>
                  <b>{reg.registration_name}</b>
                  <div className="bk-hint" style={{marginTop:"var(--s1)"}}>
                    {answers.length
                      ? answers.map(answer=>`${answer.label}: ${answer.value||"-"}`).join(", ")
                      : "저장된 팀 지망 답변 없음"}
                  </div>
                </div>
                <span className="bk-hint" style={{margin:0}}>
                  {assigned.length===0?"미배정":assigned.length===1?assigned[0]:"중복 배정"}
                </span>
              </div>;
            })}
          </div>
        </div>}

        <div className="field"><span className="field-label">{mode==="team"?"팀 수":"참가자 수"}</span>
          <div className="bk-count">
            <button type="button" onClick={()=>setCnt(Math.max(2,count-1))} aria-label="하나 줄이기"><Icon n="minus" size={16}/></button>
            <input type="text" inputMode="numeric" aria-label={mode==="team"?"팀 수":"참가자 수"} value={countStr} onChange={e=>setCnt(e.target.value)}/>
            <button type="button" onClick={()=>setCnt(Math.min(64,count+1))} aria-label="하나 늘리기"><Icon n="plus" size={16}/></button>
          </div>
          <div className="bk-hint">{(()=>{
            if(format==="group") return `${gN}개 그룹, 그룹당 약 ${Math.ceil(Math.max(count,1)/gN)}명, 상위 ${aN}명 본선`;
            const sz=nextPow2(Math.max(count,2));
            return `${sz}강 대진, 부전승 ${sz-count}개 자동 추가`;
          })()}</div>
        </div>

        {eventRegs.length>1&&<div className="stack bk-pin-keys">
          <Button variant="second" size="sm" onClick={splitByRanking} loading={seeding} disabled={seeding}>{splitNote?"다시 나누기":`신청자 ${eventRegs.length}명 팀 나누기`}</Button>
        </div>}
        {splitNote&&<div className="bk-hint">{splitNote}</div>}
        <div className="bk-fill">
          {teams.map((t,i)=>(<div className="bk-team-card" key={i} style={{animationDelay:(i*STAGGER.row)+"ms"}}>
                <span className="bk-pin-no gold">{i+1}</span>
                <input className="bk-tc-name" value={t.name} onChange={e=>setTeams(teams.map((x,j)=>j===i?{...x,name:e.target.value}:x))} placeholder={`팀 ${i+1} 이름`} aria-label={`팀 ${i+1} 이름`}/>
                <input className="bk-tc-mem" value={t.members} onChange={e=>setTeams(teams.map((x,j)=>j===i?{...x,members:e.target.value}:x))} placeholder="팀원 (쉼표로 구분)" aria-label="팀원 (쉼표로 구분)"/>
              </div>))}
        </div>
      </>}

      <Dock>
        <div className="stack bk-dock">
          <Button variant="second" onClick={()=>setStep(1)}>이전</Button>
          {placeable
            ? <Button variant="main" onClick={startPlacement}>{mode!=="team"?`${buildParticipants().length}명으로 추첨`:"추첨"}</Button>
            : <Button variant="main" icon="check" onClick={go} disabled={creating} loading={creating}>{eventId&&mode!=="team"?`${buildParticipants().length}명으로 대진표 만들기`:"대진표 만들기"}</Button>}
        </div>
      </Dock>
    </>}

    {step===3&&placement&&<>
      <div className="stack bk-place-tools"><Button variant="second" onClick={redraw}>다시 추첨</Button>
        {format!=="group"&&<Button variant="second" onClick={seedByRanking} loading={seeding} disabled={seeding}>랭킹 시드</Button>}</div>
      <p className="t12 reg dim">이름을 끌어 다른 이름에 놓거나, 두 이름을 차례로 누르면 자리가 바뀝니다.</p>
      <div className="stack bk-place" onPointerMove={dragPlace} onPointerUp={dropPlace} onPointerLeave={()=>{ if(dragFrom.current&&!dragFrom.current.moved) dragFrom.current=null; }}>
        {format==="group"?placement.plan.map((pool,i)=><section className="stack" key={i}>
          <h2 className="t20">{i+1}조</h2>
          {pool.map(key=><div className="pn" key={key}>{placeCell(key)}</div>)}
        </section>):placement.plan.map(([a,b],i)=><div className="pn bk-place-row" key={i}>
          <span className="t12 dim num">M{i+1}</span>{placeCell(a)}<span className="t12 dim">vs</span>{placeCell(b)}
        </div>)}
      </div>
      <Dock toast={eventError&&<Toast error>{eventError}</Toast>}>
        <div className="stack bk-dock">
          <Button variant="second" onClick={()=>{ setHeld(null); setStep(2); }}>이전</Button>
          <Button variant="main" icon="check" onClick={go} disabled={creating} loading={creating}>대결 확정</Button>
        </div>
      </Dock>
    </>}
    </div>
  </div>);
}
