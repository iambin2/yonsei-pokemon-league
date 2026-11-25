import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { makeQr } from "../services/qrCode.js";
import { splitTeams } from "../services/teamSplit.js";
import { flushSync } from "react-dom";
import { backWith, popHandlers, pushHistory } from "../components/layout/history.js";
import { formatDate } from "../services/dateFormat.js";
import { josa } from "../services/josa.js";
import { Button, Dropdown, Empty, ErrorNote, Field, FoldOut, FormError, Icon, ListSearch, Loader, Modal, Prose, STAGGER, Segmented, siteAlert, siteConfirm, sitePrompt, transition } from "../components/index.js";
import { BackLink, Counter, Dock, Lead, Mon, Row, SectionHead, Status, Steps, TabsLine, Toast, useArrival } from "../components/common/Board.jsx";
import { reduced } from "../components/common/motion.js";
import { Busy } from "../components/common/Loader.jsx";
import { dotDate } from "../services/dateFormat.js";
import { addChampionshipQualifierManualRegistration, applyEventRecord, recommendChampionshipDirectEntrants, resetSubmissionPin, revertEventRecord, championsData, fetchPlayerChampionRosters, fetchRegistrationFinalRosters, buildChampionshipRecordApplyCompletionOptions, buildNormalizedRuntimeCreateAttempt, buildNormalizedSingleCreateAttempt, championshipEventPickerLabel, confirmEventTeamsForBracket, createChampionshipAdvancement, createNormalizedBracketRuntime, deleteNormalizedBracketRuntime, deleteNormalizedSingleBracketRuntime, ensureChampionshipHallOfFameEntry, listChampionshipManualParticipantCandidates, fetchNormalizedBracketRuntime, fetchNormalizedSingleBracketRuntime, readBracketMatchStamp, getEvent, sitePlayed, getEventRecordContext, getIndividualPlacementPointPolicy, inspectEventParticipantIdentities, lastPlacementPoints, isRecordApplyCompletionConfirmed, listChampionshipQualifierDirectSelectionIds, listEventRegistrationSubmissionStatuses, listEventRegistrations, listNormalizedBracketRuntimes, loadPrivateAnswers, listSubmissionEvents, preflightChampionshipFinalBracket, rollbackEventParticipantIdentityChanges, setChampionshipQualifierDirectSelections, setNormalizedSingleBracketWinner, readMatchOutcomes, readEntryDepartures, setEntryDeparture, readMatchPicks, setMatchPicks, fetchRegistrationLatestRosters, replaceBracketEntrant, readEventCheckins, readMatchReports, setBracketRules, bracketRulesReady, matchOutcomeMoreReady, setNormalizedMatchOutcome, syncNormalizedBracketMatches, validateEventParticipantEntries, validateEventTeamEntries } from "../services/index.js";
import { buildDefaultTeamMatchLineups, buildTeamMatchSeries, getTeamMatchLineupOptions, getTeamRegistrationAnswerEntries } from "../services/bracketTeamParticipants.js";
import { getTeamPlacementPointPolicy } from "../services/bracketRankingAwardSnapshot.js";
import { buildBracketSubmissionStatusModel, playerNameKey, spriteUrl } from "../services/teamBuilderCore.js";
import { buildBracketPageList } from "../services/historicalBracketReadModel.js";
import { beginNormalizedBracketDraw, completeNormalizedBracketDraw } from "../services/bracketDrawLifecycle.js";
import { ChampionsBracketControls } from "../components/ChampionsBracketControls.jsx";
import { applyTitleAwards, evaluateTitleAwards, revertTitleAwards } from "../services/titleAwards.js";
import { loadRecordsPokemonDirectory } from "../services/recordsPokemon.js";
import { freshRead, peekRead } from "../services/readCache.js";
import { drawPlan, seededPlan } from "../services/bracketProjection.js";
import { fetchNormalizedRecordsSnapshot } from "../services/normalizedRecordsService.js";
import { buildNormalizedRecordsProjection } from "../services/normalizedRecordsProjection.js";
import { GROUP_TOPOLOGY, groupDraw, validateGroupConfig } from "../services/groupBracketCore.js";
import { createGroupFinal, createGroupPlayoff, createIndividualBracketDraw, listSameRoundRookieChampions, reopenGroupStage, setGroupFinalWinner, setGroupStageWinner } from "../services/normalizedCompetitionService.js";
import { BYE, clearedByPick, collectGraphMatches, evalGraph, seriesWins, winsNeeded, withPick, withSeries } from "../services/bracketWinnerPlan.js";
import { matchStage } from "../services/recordsAnalytics.js";
import { battleClock, battleForMatch, battleHref, battleWinnerEntry, handoverReady, listEventBattles, officialBattleHref, retryBattleApply, voidBattle } from "../services/battleService.js";
import { parseBoutKey, teamBouts } from "../services/teamBouts.js";
import Fig from "../components/common/Fig.jsx";
import { WORDMARK_PATH } from "../components/layout/SiteHeader.jsx";
import { PRIVATE_BRACKETS_KEY, communityUrl, createCommunityItem, deleteCommunityItem, patchCommunityItem, readCommunity, readErrorText, shareLink, verifyCommunityPin } from "../services/communityStore.js";
import { PIN_DENIED } from "../services/communityItems.js";
import { PRIVATE_BRACKET_MAX, buildPrivateBracketPatch, buildPrivateGraph, createPrivateBracket, parseParticipantNames } from "../services/privateBracket.js";
import { leagueIntakeId, leagueIntakeOptions } from "../services/leagueIntake.js";
import { useItemTitle } from "../components/layout/title.js";
import { viewHref } from "../services/appRouting.js";
import { readBracketSchedule, roundKeyOf, roundStartIso, setMatchTable, setRoundSchedule, tableWord } from "../services/bracketSchedule.js";
import { VISITOR_EVENT, accountsReady, myPlayerLink, reportMatch, visitorSignedIn } from "../services/visitorAuth.js";
import BracketWizard from "./brackets/BracketWizard.jsx";
import BracketApply from "./brackets/BracketApply.jsx";

const uid = () => Math.random().toString(36).slice(2, 9);

/* ============================== 대진표 (Bracket) ============================== */
const nextPow2=n=>{let p=1;while(p<n)p*=2;return p;};

function elimResult(g){
  if(!g) return null;
  const {win,lose}=evalGraph(g);
  const clean=(x)=>x&&x!==BYE?x:null;
  if(g.kind==="double"){
    const gf=g.gf, reset=g.reset;
    const lf=g.lb[g.lb.length-1][0]; const semis=[lf]; if(g.lb.length>=2) semis.push(g.lb[g.lb.length-2][0]);
    const sf=semis.map(m=>lose[m.id]).filter(x=>x&&x!==BYE);
    if(gf.winner==="a"){ // 승자조 챔프가 GF 승리 → 즉시 우승
      return {champ:clean(win[gf.id]), ru:clean(lose[gf.id]), sf, done:!!clean(win[gf.id])};
    }
    if(gf.winner==="b"&&reset){ // 패자조 챔프가 GF 승리 → 리셋 매치로 결정
      return {champ:clean(win[reset.id]), ru:clean(lose[reset.id]), sf, done:!!reset.winner};
    }
    return {champ:null, ru:null, sf, done:false};
  }
  const finalM=g.rounds[g.rounds.length-1][0]; const semis=g.rounds.length>=2?g.rounds[g.rounds.length-2]:[];
  const champ=win[finalM.id]||null, ru=lose[finalM.id]||null;
  const sf=semis.map(m=>lose[m.id]).filter(x=>x&&x!==BYE);
  /* 3위 결정전: its winner third and its loser fourth; the event is done once it is played too */
  if(g.third){ const third=clean(win[g.third.id]), fourth=clean(lose[g.third.id]);
    return {champ:clean(champ), ru:clean(ru), sf:third&&fourth?[third,fourth]:sf, third, fourth, done:!!clean(champ)&&!!third}; }
  return {champ:clean(champ), ru:clean(ru), sf, done:!!clean(champ)};
}
function groupStandings(group){
  if(group.standing) return group.standing.rows.map(row=>({name:row.id,wins:row.wins}));
  const w={}; group.members.forEach(m=>w[m]=0);
  group.matches.forEach(mt=>{ if(mt.winner==="a")w[mt.a.pid]++; else if(mt.winner==="b")w[mt.b.pid]++; });
  return [...group.members].sort((x,y)=>w[y]-w[x]).map(name=>({name,wins:w[name]}));
}

/* ===== 마법사 ===== */
/* ===== PNG 다운로드 (우승 이미지 + 대진표 이미지) ===== */
/* 이미지 공유 (2026-11-22): a phone that can share files opens its share sheet (단톡방, 인스타그램); elsewhere, or if it is refused, the file downloads */
function bkDownload(canvas,filename){ canvas.toBlob(async blob=>{ if(!blob)return;
  const file=typeof File==="function"?new File([blob],filename,{type:"image/png"}):null;
  if(file&&matchMedia("(pointer: coarse)").matches&&navigator.canShare?.({files:[file]})){
    try{ await navigator.share({files:[file]}); return; }catch(error){ if(error?.name==="AbortError") return; }
  }
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1500); },"image/png"); }

function bkClip(ctx,t,max){ if(ctx.measureText(t).width<=max)return t; let s=t; while(s.length>1&&ctx.measureText(s+"…").width>max)s=s.slice(0,-1); return s+"…"; }
/* 이미지 저장도 사이트와 같은 서체와 네이비 다크 토큰을 쓴다. */
const BKF='"Albert Sans", "Freesentation", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const BKM=BKF;
/* 이미지는 테마와 상관없이 네이비 판이다. 색은 토큰에서 읽어 사이트와 어긋나지 않는다. */
let BKC=null;
function bkInks(){ const css=getComputedStyle(document.documentElement), v=n=>css.getPropertyValue(n).trim();
  BKC={ bg:v("--navy"), ink:v("--white"), t2:v("--mist"), t5:v("--mist"), rule:v("--navy-3") }; }
async function bkFonts(){ bkInks(); try{ if(document.fonts&&document.fonts.load){ await Promise.all(["700","600","400"].flatMap(w=>[document.fonts.load(w+' 40px "Freesentation"',"가"),document.fonts.load(w+' 40px "Albert Sans"',"A")])); await document.fonts.ready; } }catch(e){} }
function bkPage(ctx,W,H){ ctx.fillStyle=BKC.bg; ctx.fillRect(0,0,W,H); }
/* YPL 워드마크: 사이트 상단 바와 같은 그린 글자. x는 align 기준점, y는 글자 아래끝, h는 글자 높이. */
function bkWordmark(ctx,x,y,h,align="left"){
  const k=h/100, w=310*k, left=align==="center"?x-w/2:x;
  ctx.save(); ctx.translate(left,y-h); ctx.scale(k,k);
  ctx.transform(1,0,Math.tan(-12*Math.PI/180),1,0,0); ctx.translate(21,0);
  ctx.fillStyle=BKC.ink; ctx.fill(new Path2D(WORDMARK_PATH),"evenodd");
  ctx.restore(); return w;
}

async function downloadChampionPng(b,res,nameOf){
  await bkFonts();
  const S=2,W=1200,H=820; const cv=document.createElement("canvas"); cv.width=W*S; cv.height=H*S;
  const ctx=cv.getContext("2d"); ctx.scale(S,S);

  // 배경: 네이비 단색, 테두리 없음
  bkPage(ctx,W,H);

  ctx.textAlign="center";
  // 워드마크: 상단 바와 같은 그린 글자
  bkWordmark(ctx,W/2,152,36,"center");
  ctx.fillStyle=BKC.t5; ctx.font=`700 13px ${BKM}`; ctx.fillText("Yonsei Pokémon League",W/2,184);

  // CHAMPION 머리말
  ctx.fillStyle=BKC.t2; ctx.font=`700 20px ${BKM}`; ctx.fillText("우승",W/2,288);

  // 챔피언 이름
  const champ=nameOf(res.champ); const part=(b.participants||[]).find(p=>p.id===res.champ);
  let party=""; if(b.mode==="team"){ party=(part?.members||[]).join(", "); }
  else if(part?.party){ party=part.party.split(/[,\n]/).map(x=>x.trim()).filter(Boolean).join(", "); }
  ctx.font=`700 136px ${BKF}`; const champTxt=bkClip(ctx,champ,W-180); const cw=ctx.measureText(champTxt).width;
  ctx.fillStyle=BKC.ink; ctx.fillText(champTxt,W/2,420);

  let ty=572;
  if(party){ ctx.fillStyle=BKC.t2; ctx.font=`400 20px ${BKF}`;
    ctx.fillText(bkClip(ctx,party,W-200),W/2,522); ty=596; }

  ctx.fillStyle=BKC.ink; ctx.font=`700 32px ${BKF}`;
  ctx.fillText(bkClip(ctx,b.name,W-200),W/2,ty);
  ctx.fillStyle=BKC.t5; ctx.font=`400 20px ${BKF}`; ctx.fillText(formatDate(b.createdAt)+(b.private?", 사설 대진표 (공식 기록 아님)":""),W/2,ty+38);

  // 하단 준우승과 4강 (선 없이 간격으로 나눔)
  const subs=[];
  if(res.ru) subs.push("준우승 "+nameOf(res.ru));
  // 3위 결정전을 치렀으면 화면의 결과처럼 3위와 4위로 나눈다
  if(res.third&&res.fourth) subs.push("3위 "+nameOf(res.third),"4위 "+nameOf(res.fourth));
  else if(res.sf&&res.sf.length) subs.push("4강 "+res.sf.map(nameOf).join(", "));
  if(subs.length){
    ctx.fillStyle=BKC.t5; ctx.font=`400 20px ${BKF}`;
    ctx.fillText(bkClip(ctx,subs.join("      "),W-220),W/2,H-96);
  }
  bkDownload(cv,`${b.name}_우승_${champ}.png`);
}

/* the almanac's draw sheet, as on the site (sheetLayout, sheetRects): every name on its own line, a match's two lines joined at the
   column's right end, the middle of that join the next round's line; the winner's line and its half of the join a 2px rule */
const BX={ w:220 };
// 한 단의 대진(라운드 열들과 끝의 우승)을 그린다 → {right, bottom}
function bkDrawSection(ctx,cols,ev,nameOf,ox,oy,from,champ){
  const layout=sheetLayout(cols.map(c=>c.ms),0,from);
  layout.slots.forEach((col,c)=>col.forEach((s,j)=>{ s.m=cols[c].ms[j]; }));
  const geo=[...cols,...(champ?[0]:[])].map((_,c)=>({ x:ox+c*BX.w, w:BX.w, y:oy }));
  const won=(m,side)=>m.winner===side&&ev.sp(m.a)!==BYE&&ev.sp(m.b)!==BYE;
  ctx.textAlign="left"; ctx.font=`700 13px ${BKF}`;
  cols.forEach((col,c)=>{ if(col.label){ ctx.fillStyle=col.end?BKC.ink:BKC.t5; ctx.fillText(col.label,geo[c].x+(c?12:0),oy-20); } });
  layout.slots.forEach((col,c)=>col.forEach(({ m, ya, yb })=>{
    const decided=Boolean(m.winner);
    [["a",ya],["b",yb]].forEach(([side,y])=>{
      const pid=ev.sp(m[side]), win=decided&&m.winner===side, txt=pid===BYE?"부전승":(pid?nameOf(pid):""), score=sideScore(m,side);
      const x=geo[c].x+(c?12:0), base=oy+y-8;
      ctx.fillStyle=win||!decided&&pid&&pid!==BYE?BKC.ink:BKC.t5; ctx.font=`${win?700:400} 16px ${BKF}`;
      let room=geo[c].x+BX.w-12-x;
      if(score!=null&&!(decided&&!win&&m.forfeit)){ ctx.textAlign="right"; ctx.fillText(String(score),geo[c].x+BX.w-12,base); room-=ctx.measureText(String(score)).width+12; }
      ctx.textAlign="left"; ctx.fillText(bkClip(ctx,txt,room),x,base);
    });
  }));
  let right=geo[cols.length-1].x+BX.w;
  if(champ){ const g=geo[cols.length], y=oy+layout.slots[cols.length-1][0].ym;
    ctx.textAlign="left"; ctx.fillStyle=BKC.ink; ctx.font=`700 13px ${BKF}`; ctx.fillText("우승",g.x+12,oy-20);
    if(champ.name){ ctx.font=`700 32px ${BKF}`; ctx.fillText(bkClip(ctx,champ.name,BX.w-12),g.x+12,y-10); }
    else { ctx.fillStyle=BKC.t5; ctx.font=`400 13px ${BKF}`; ctx.fillText("결승이 끝나면 켜집니다.",g.x+12,y-8); }
    right=g.x+BX.w; }
  sheetRects(geo,layout,won,champ).forEach(r=>{ ctx.fillStyle=r.lit?BKC.ink:BKC.rule; ctx.fillRect(r.x,r.y,r.w,r.h); });
  return { right, bottom: oy+layout.totalH };
}
// 그래프 하나를 이미지의 단들로: 승자조(그리고 그랜드 파이널, 리셋 결승, 우승), 3위 결정전, 패자조. 사이트의 ElimBoard와 같은 순서다.
function bkSections(g,nameOf){
  const ev=evalGraph(g), res=elimResult(g);
  const roundCols=g.rounds.map((r,ri)=>({ label:roundLabel(g,ri), ms:r }));
  const gf=g.kind==="double"?[{ label:"그랜드 파이널", ms:[g.gf], end:true },...(g.reset&&g.gf.winner==="b"?[{ label:"리셋 결승", ms:[g.reset], end:true }]:[])]:[];
  const from=m=>g.reset&&m===g.reset?{ none:true, center:g.gf }:null;
  return [
    { cols:[...roundCols,...gf], champ:{ name:res?.champ?nameOf(res.champ):"" } },
    ...(g.third?[{ title:"3위 결정전", cols:[{ ms:[g.third] }] }]:[]),
    ...(g.kind==="double"?[{ title:"패자조", cols:g.lb.map((r,ri)=>({ label:lbRoundName(ri), ms:r })) }]:[]),
  ].map(s=>({ ...s, ev, from }));
}
async function downloadBracketPng(b,nameOf){
  await bkFonts();
  const padL=32,padT=136,S=2,gboxW=250;
  const elim=b.format==="group"?b.knockout:b.graph;
  const secs=elim?bkSections(elim,nameOf):[];
  const gCols=b.format==="group"?Math.min(b.groups.length,3):1, gRowH=b.format==="group"?40+Math.max(...b.groups.map(g=>g.members.length))*26+38:0;
  /* drawn twice: once to measure where the sheet ends, then on a canvas of that size */
  const paint=(ctx,W)=>{
    bkPage(ctx,W,99999);
    ctx.textAlign="left"; ctx.fillStyle=BKC.ink; ctx.font=`700 32px ${BKF}`; ctx.fillText(bkClip(ctx,b.name,W-68),34,50);
    const wmW=bkWordmark(ctx,34,77,14);
    ctx.fillStyle=BKC.t5; ctx.font=`400 13px ${BKF}`;
    ctx.fillText(formatDate(b.createdAt)+(b.private?", 사설 대진표 (공식 기록 아님)":""),34+wmW+12,76);
    let y=padT, right=padL+gCols*(gboxW+24)-24;
    if(b.format==="group"){
      b.groups.forEach((gr,gi)=>{ const st=groupStandings(gr); const r=Math.floor(gi/gCols),c=gi%gCols;
        const x=padL+c*(gboxW+24), gy=y+r*gRowH;
        ctx.fillStyle=BKC.ink; ctx.fillRect(x,gy,gboxW,2);
        ctx.font=`700 16px ${BKF}`; ctx.textAlign="left"; ctx.fillText(gr.name+"조",x,gy+26);
        st.forEach((s,i)=>{ const ry=gy+44+i*26; const adv=i<b.groupCfg.adv; ctx.fillStyle=BKC.rule; ctx.fillRect(x,ry+8,gboxW,1);
          ctx.fillStyle=adv?BKC.ink:BKC.t2; ctx.font=`${adv?700:400} 13px ${BKF}`; ctx.fillText(`${i+1}. ${nameOf(s.name)}`,x,ry+2); ctx.textAlign="right"; ctx.fillText(s.wins+"승",x+gboxW,ry+2); ctx.textAlign="left"; });
      });
      y+=Math.ceil(b.groups.length/gCols)*gRowH+40;
      if(b.knockout){ ctx.fillStyle=BKC.ink; ctx.font=`700 16px ${BKF}`; ctx.fillText("본선 토너먼트",padL,y); y+=52; }
    }
    secs.forEach(s=>{
      if(s.title){ ctx.fillStyle=BKC.ink; ctx.fillRect(padL,y,W-padL*2,2); ctx.font=`700 16px ${BKF}`; ctx.textAlign="left"; ctx.fillText(s.title,padL,y+30); y+=s.cols[0].label?84:52; }
      const r=bkDrawSection(ctx,s.cols,s.ev,nameOf,padL,y,s.from,s.champ); right=Math.max(right,r.right); y=r.bottom+40;
    });
    return { right, bottom:y };
  };
  const probe=document.createElement("canvas").getContext("2d");
  const size=paint(probe,4000);
  const W=Math.ceil(Math.max(700,size.right+padL)), H=Math.ceil(size.bottom+24);
  const cv=document.createElement("canvas"); cv.width=W*S; cv.height=H*S; const ctx=cv.getContext("2d"); ctx.scale(S,S);
  paint(ctx,W);
  ctx.textAlign="right"; ctx.fillStyle=BKC.t5; ctx.font=`700 13px ${BKM}`;
  ctx.fillText("Yonsei Pokémon League",W-34,H-16); ctx.textAlign="left";
  bkDownload(cv,`${b.name}_대진표.png`);
}


/* ===== 팀 대결(실제 lineup + 에이스 결정전) ===== */
const teamMatchDisplayName=(value)=>{ const name=String(value??""); const trimmed=name.trim(); return /^\d+$/.test(trimmed)?`${trimmed}팀`:name; };
function TeamMatchModal({ teamA, teamB, init, onClose, onSave }){
  const defaults=buildDefaultTeamMatchLineups(teamA,teamB);
  const optionsA=getTeamMatchLineupOptions(teamA),optionsB=getTeamMatchLineupOptions(teamB);
  const N=defaults.normalBoutCount;
  const initialLineup=(stored,fallback)=>Array.from({length:N},(_,i)=>Array.isArray(stored)?(stored[i]||""):(fallback[i]||""));
  const [lineupA,setLineupA]=useState(()=>initialLineup(init?.lineupA,defaults.lineupA));
  const [lineupB,setLineupB]=useState(()=>initialLineup(init?.lineupB,defaults.lineupB));
  const [games,setGames]=useState(()=>{ const g=Array(N).fill(null); (init?.games||[]).forEach((w,i)=>{if(i<N)g[i]=w;}); return g; });
  const [aceA,setAceA]=useState(init?.ace?.a||defaults.captainA||"");
  const [aceB,setAceB]=useState(init?.ace?.b||defaults.captainB||"");
  const [aceW,setAceW]=useState(init?.ace?.winner||null);
  const setGame=(i,w)=>setGames(games.map((x,j)=>j===i?(x===w?null:w):x));
  let a=0,b=0; games.forEach(w=>{if(w==="a")a++;else if(w==="b")b++;});
  const allPlayed=N>0&&games.every(w=>w); const tie=allPlayed&&a===b;
  const allPlayers=lineupA.every(Boolean)&&lineupB.every(Boolean);
  const decided=allPlayers&&allPlayed&&(!tie||(!!aceA&&!!aceB&&!!aceW));
  const confirm=()=>{ if(!decided) return; // the key is off until every bout is filled; the sheet's line says what is needed
    const result=buildTeamMatchSeries(teamA,teamB,{lineupA,lineupB,games,ace:tie?{a:aceA,b:aceB,winner:aceW}:null}); onSave(result.series,result.winnerSide); };
  // team: 폰에서는 두 팀의 머리 줄이 없으므로 각 칸이 제 팀의 이름을 달고 선다
  const side=(value,onChange,options,winner,onWin,label,team)=><div className="bk-bout-side"><span className="bk-bout-team t12 dim">{team}</span><div className="bk-bout-player"><Dropdown value={value} onChange={onChange} placeholder="선수 선택" ariaLabel={`${team} 선수`} options={options}/></div><button type="button" className={"bk-bout-win"+(winner?" is-win":"")} onClick={onWin} aria-label={label} aria-pressed={winner}>{winner?<><Icon n="check" size={16}/>승</>:"승"}</button></div>;
  const displayTeamA=teamMatchDisplayName(teamA.name),displayTeamB=teamMatchDisplayName(teamB.name);
  return (<Modal title={`${displayTeamA} vs ${displayTeamB}`} hint="실제 출전 선수를 선택하고 모든 개인전 결과를 입력해 주세요." onClose={onClose}>
    <div className="swap bk-team-match-modal">
      <div className="bk-bout-columns" aria-hidden="true"><span/><strong>{displayTeamA}</strong><span/><strong>{displayTeamB}</strong></div>
      <div className="bk-series">{Array.from({length:N}).map((_,i)=>(<div className="bk-series-row bk-bout-row" key={i}>
        <span className="bk-series-no bk-bout-label">{i+1}경기</span>
        {side(lineupA[i],v=>setLineupA(lineupA.map((name,j)=>j===i?v:name)),optionsA,games[i]==="a",()=>setGame(i,"a"),`${i+1}경기 A팀 승리`,displayTeamA)}
        <span className="bk-series-vs">vs</span>
        {side(lineupB[i],v=>setLineupB(lineupB.map((name,j)=>j===i?v:name)),optionsB,games[i]==="b",()=>setGame(i,"b"),`${i+1}경기 B팀 승리`,displayTeamB)}
      </div>))}</div>
      {tie&&<div className="bk-ace">
        <div className="bk-ace-h">타이브레이커</div>
        <div className="bk-series-row bk-bout-row bk-bout-row-ace"><span className="bk-bout-label-spacer" aria-hidden="true"/>{side(aceA,setAceA,optionsA,aceW==="a",()=>setAceW(aceW==="a"?null:"a"),"타이브레이커 A팀 승리",displayTeamA)}<span className="bk-series-vs">vs</span>{side(aceB,setAceB,optionsB,aceW==="b",()=>setAceW(aceW==="b"?null:"b"),"타이브레이커 B팀 승리",displayTeamB)}</div>
      </div>}
      <div className="modal-actions bk-team-match-actions"><Button variant="second" onClick={onClose}>취소</Button><Button variant="main" icon="check" onClick={confirm} disabled={!decided}>대결 확정</Button></div>
    </div>
  </Modal>);
}

/* ===== 경기 상자 (DESIGN.md "Brackets") =====
   두 줄, 36씩, 사이에 이음매. 이긴 줄은 반전되고 진 줄은 흐려진다. 아직 정해지지 않은 자리는 흐린 글자다.
   점수는 게임별 승자가 있을 때(팀전 시리즈)만 이긴 게임 수로 쓰고, 없으면 승자만 보인다. */
const seriesScore=(m,side)=>{ const s=m?.series; if(!s?.games) return null; return s.games.filter(w=>w===side).length+(s.ace?.winner===side?1:0); };
const slotName=(pid,nameOf)=>pid===BYE?"부전승":(pid?nameOf(pid):"대기");
const sideScore=(m,side)=>seriesScore(m,side)??(side==="a"?m.scoreA:m.scoreB)??null;
/* a match won without being played: a site battle says how it ended (기권, 시간 초과, docs/db/match_outcome_more.sql), else the operator's 불참 */
/* an entry the operators marked as having left the event (docs/db/handover_features.sql) says so first */
const lossWord=(battle,m)=>m?.departed==="disqualified"?"실격":m?.departed==="withdrew"?"기권":battle?.ended_by==="forfeit"?"기권":battle?.ended_by==="timeout"?"시간 초과":"불참";
/* 나: a signed-in trainer's own name carries the records' league tag form after it (DESIGN.md "Records"), here 나 with its square lit */
const MeTag=()=><span className="tb-type mb-me">나</span>;
/* the account's player as an entry of this bracket: approved links only (docs/db/player_accounts.sql); signed out or unlinked, none */
/* 내 경기로 (2026-11-22): a signed-in player's next match on a long bracket, one press away. The first undecided match they stand in. */
function myMatchIn(b,me){
  if(!me) return null;
  return [...[b.graph,b.knockout].filter(Boolean).flatMap(g=>{ const {sp}=evalGraph(g); return collectGraphMatches(g).map(m=>({m,a:sp(m.a),b:sp(m.b)})); }),
    ...(b.knockout?[]:(b.groups||[]).flatMap(g=>[...g.matches,...(g.playoffs||[])]).map(m=>({m,a:m.a?.pid,b:m.b?.pid})))]
    .find(x=>!x.m.winner&&(x.a===me||x.b===me)&&x.a!==BYE&&x.b!==BYE)?.m.id||null;
}
/* the key: on a desktop a second key under the tree's head; on a phone the day's main act, over the share key (2026-11-23 audit, Q-14) */
function MyMatchKey({ b, main=false, className="" }){
  const id=myMatchIn(b,useMyEntry(b.participants));
  if(!id) return null;
  return <Button variant={main?"main":"second"} icon="arrow" className={className} onClick={()=>document.querySelector(`[data-match="${CSS.escape(id)}"]`)?.scrollIntoView({block:"center"})}>내 경기로</Button>;
}
function useMyEntry(participants){
  const [playerId,setPlayerId]=useState(null);
  useEffect(()=>{
    let on=true;
    const read=()=>{
      if(!visitorSignedIn()){ setPlayerId(null); return; }
      accountsReady().then(ok=>ok?myPlayerLink():null).then(row=>{ if(on) setPlayerId(row?.status==="approved"&&row.player_id||null); },()=>{ if(on) setPlayerId(null); });
    };
    read();
    window.addEventListener(VISITOR_EVENT,read);
    return ()=>{ on=false; window.removeEventListener(VISITOR_EVENT,read); };
  },[]);
  if(!playerId) return null;
  return (participants||[]).find(p=>p.playerId===playerId||p.memberIdentities?.some(x=>x.playerId===playerId))?.id||null;
}
function MatchCard({ m, ev, nameOf, admin, onPick, teamMode, onOpenTeam, seedOf, onOpen, battle, me=null }){
  if(!m) return null;
  const pa=ev.sp(m.a), pb=ev.sp(m.b);
  const decided=!!m.winner;
  // a match being played as a site battle carries the amber lamp (DESIGN.md "Battle": the battle is the board's live match)
  const live=battle&&battle.status!=="ended"&&!m.winner?<i className="lamp sig mb-lamp" aria-hidden="true"/>:null;
  const bothReal=pa&&pb&&pa!==BYE&&pb!==BYE;
  const line=(side,pid,Tag,extra)=>{
    const isWin=decided&&m.winner===side, isBye=pid===BYE, lost=decided&&!isWin, n=seedOf?seedOf(pid):null, score=sideScore(m,side);
    return <Tag {...extra} className={"mb-row"+(isWin?" inv":"")+(lost?" lost":"")+(isBye||!pid?" wait":"")}>
      <i className="mb-seed num t12" aria-hidden={!n}>{n||""}</i>
      <span className="mb-name">{slotName(pid,nameOf)}</span>
      {me&&pid===me&&<MeTag/>}
      {lost&&m.forfeit?<span className="mb-score t12">{lossWord(battle,m)}</span>:score!=null&&<span className="mb-score num">{score}</span>}
    </Tag>;
  };
  /* a visitor presses the whole box (DESIGN.md "Open": the whole match box is the target): on a phone the names end in an ellipsis,
     so the sheet says them in full with the result */
  if(!admin&&onOpen&&[pa,pb].some(pid=>pid&&pid!==BYE))
    return <button type="button" className="mb can-open" data-match={m.id} onClick={()=>onOpen(m)} aria-label={`${slotName(pa,nameOf)}, ${slotName(pb,nameOf)}, ${live?"배틀 진행 중, ":""}경기 보기`}>{line("a",pa,"span")}{line("b",pb,"span")}{live}</button>;
  if(teamMode){
    const clickable=admin&&(bothReal||decided);
    const Box=clickable?"button":"div";
    return <Box {...(clickable?{type:"button"}:{})} className={"mb"+(clickable?" team-click":"")} onClick={()=>clickable&&onOpenTeam(m,pa,pb)} title={clickable?"눌러서 팀 대결 진행 또는 수정":""}>{line("a",pa,"span")}{line("b",pb,"span")}</Box>;
  }
  const canPick=admin&&bothReal;
  const pickProps=side=>({type:"button",disabled:!canPick,onClick:()=>canPick&&onPick(m.id,side),title:canPick?(decided?"다른 쪽을 누르면 승자 변경, 같은 쪽을 다시 누르면 취소":"눌러서 승자 선택"):""});
  return <div className={"mb"+(canPick?" can-pick":"")} data-match={m.id}>{line("a",pa,"button",pickProps("a"))}{line("b",pb,"button",pickProps("b"))}{live}</div>;
}
/* a match's battle in its sheet: watching it while it runs, its replay once it ended, or starting one for an open official match.
   A battle that cannot give the match a winner (a tie, a void one, one that could not go in) leaves the match open to be played again.
   The operator's result entry adds 다시 넣기 for a result that did not go in and 배틀 무효 for a battle nobody will finish. */
function MatchBattle({ m, ev, battle, startable, eventId, admin=false, onChanged, onWalkover=null, need=1, battles=[] }){
  const pa=ev.sp(m.a), pb=ev.sp(m.b);
  const [busy,setBusy]=useState(false);
  const [note,setNote]=useState("");
  const run=async fn=>{ setBusy(true); setNote(""); try{ await fn(); onChanged?.(); }catch(e){ setNote(e?.message||"잠시 뒤 다시 시도해 주세요."); }finally{ setBusy(false); } };
  const canStart=startable&&!m.winner&&pa&&pb&&pa!==BYE&&pb!==BYE;
  /* the operators' clock (docs/db/handover_features.sql): stop it for a dispute or a dropped phone, give a minute more */
  const [clockOn,setClockOn]=useState(false);
  useEffect(()=>{ let on=true; if(admin&&battle?.status==="active") handoverReady().then(ok=>on&&setClockOn(ok)); return ()=>{ on=false; }; },[admin,battle?.status]);
  const error=note&&<p className="t12 reg bk-entry-error"><span className="bang" aria-hidden="true">!</span>{note}</p>;
  if(battle&&battle.status!=="ended") return <div className="stack mb-battle">
    <Row title="사이트 배틀" line={battle.status==="waiting"?"한 선수가 들어와 상대를 기다리는 중입니다.":"지금 배틀로 치르는 중입니다."} lamp={battle.status==="waiting"?"대기":"진행 중"} sig={battle.status!=="waiting"}/>
    <Button variant="second" href={battleHref(battle.id)}>{battle.status==="waiting"?"경기 들어가기":"관전"}</Button>
    {/* 미착석: 한 선수만 앉아 기다리는 배틀은 운영진이 닫고 그 선수의 부전승으로(상대는 불참) 넣는다 */}
    {admin&&onWalkover&&battle.status==="waiting"&&battle.p1_entry_id&&[pa,pb].includes(battle.p1_entry_id)&&<Button variant="second" disabled={busy} onClick={async()=>{
      if(await siteConfirm({title:"부전승",body:`${battle.p1_name}만 들어와 있습니다. 배틀을 닫고 ${battle.p1_name}의 부전승으로, 상대는 불참으로 남깁니다.`,confirmLabel:"부전승",danger:true}))
        await run(async()=>{ await voidBattle(battle.id); await onWalkover(pa===battle.p1_entry_id?"a":"b"); });
    }}>{battle.p1_name} 부전승</Button>}
    {admin&&clockOn&&battle.status==="active"&&<div className="stack bk-entry-actions">
      <Button variant="second" disabled={busy} onClick={()=>run(()=>battleClock(battle.id,battle.deadline_at?"pause":"resume"))}>{battle.deadline_at?"시계 멈춤":"시계 다시"}</Button>
      <Button variant="second" disabled={busy} onClick={()=>run(()=>battleClock(battle.id,"extend"))}>1분 연장</Button>
    </div>}
    {admin&&<Button variant="second" disabled={busy} onClick={async()=>{
      if(await siteConfirm({title:"배틀 무효",body:"이 배틀을 닫습니다. 진행 중이던 배틀은 무효로 끝나 리플레이로 남고, 대진표에는 아무것도 넣지 않습니다. 승자는 결과 입력에서 정합니다.",confirmLabel:"무효",danger:true})) await run(()=>voidBattle(battle.id));
    }}>배틀 무효</Button>}
    {error}
  </div>;
  if(battle){
    const winner=battleWinnerEntry(battle), matchWinner=m.winner?ev.sp(m[m.winner]):null;
    const line=battle.applied_at?"배틀 결과가 대진표에 들어갔습니다."
      :battle.ended_by==="void"?`배틀이 무효가 되었습니다. ${battle.apply_error||""}`.trim()
      :matchWinner&&winner===matchWinner?"배틀 결과와 같은 승자가 대진표에 들어가 있습니다."
      /* a draw is a result, not a failure (2026-11-22: it stood among the apply errors): the match is played again */
      :battle.winner==="tie"?"배틀이 무승부로 끝났습니다. 다시 경기합니다."
      :battle.apply_error?`배틀 결과를 대진표에 넣지 못했습니다. ${battle.apply_error}`
      :"배틀 결과를 대진표에 넣는 중입니다.";
    /* 다전제: a battle won short of the wins asked for leaves the match open for the next one (the battle function counts them) */
    const series=need>1&&!m.winner?seriesWins(battles,m.id,[pa,pb]):null;
    const inSeries=Boolean(series)&&Boolean(winner)&&!battle.applied_at&&!battle.apply_error&&battle.ended_by!=="void"&&Math.max(...series)<need;
    const unsettled=!winner||Boolean(battle.apply_error)||battle.ended_by==="void"||inSeries;
    return <div className="stack mb-battle">
      <Row title="사이트 배틀" line={inSeries?`배틀 ${series[0]}:${series[1]}, ${need}선승입니다. 다음 배틀을 치릅니다.`:line}/>
      {canStart&&unsettled&&<Button variant="main" href={officialBattleHref(eventId,m.id)}>{inSeries?"다음 배틀":"배틀로 다시 경기"}</Button>}
      <Button variant="second" href={battleHref(battle.id)}>리플레이</Button>
      {admin&&!m.winner&&winner&&!battle.applied_at&&battle.ended_by!=="void"&&<Button variant="second" disabled={busy} onClick={()=>run(()=>retryBattleApply(battle.id))}>다시 넣기</Button>}
      {error}
    </div>;
  }
  if(canStart) return <div className="stack mb-battle">
    <Button variant="main" href={officialBattleHref(eventId,m.id)}>배틀로 경기</Button>
  </div>;
  return null;
}
/* a team match played as site battles (src/services/teamBouts.js): each bout is its own battle, entered by the member who plays it
   with their own party PIN. Nothing goes into the bracket until every bout has a winner (and the 에이스 결정전 when they tie); then
   the whole series goes in at once, as the operators' team entry would put it. boutCount: the larger team's members. */
function TeamBouts({ m, ev, battles, boutCount, startable, eventId, admin=false, onChanged }){
  const [busy,setBusy]=useState(false);
  const pa=ev.sp(m.a), pb=ev.sp(m.b);
  if(m.winner||!pa||!pb||pa===BYE||pb===BYE||!boutCount) return null;
  const state=teamBouts(battles,m.id,[pa,pb],boutCount);
  const rows=[...state.bouts,...(state.ace?[state.ace]:[])];
  if(!startable&&!rows.some(x=>x.battle)) return null;
  const done=state.winner?"모든 판이 끝났습니다. 시리즈를 대진표에 넣는 중입니다."
    :state.aceNeeded?`일반 판이 ${state.winsA} 대 ${state.winsB} 동점입니다. 에이스 결정전으로 정합니다.`
    :"";
  const bout=x=>{
    const label=x.n?`${x.n}경기`:"에이스 결정전", b=x.battle, open=b&&b.status!=="ended";
    const names=`${x.a?.name||"미정"}, ${x.b?.name||"미정"}`;
    const line=open?(b.status==="waiting"?`${label}, 상대를 기다리는 중`:`${label}, 진행 중`)
      :x.winner?`${label}, ${(x.winner==="a"?x.a:x.b)?.name||""} 승리`
      :b?`${label}, ${b.ended_by==="void"?"무효":"무승부"}, 다시 치를 판`:`${label}, 결과 전`;
    /* 아직 아무도 앉지 않은 판은 그 판의 이름이 제목이다(미정, 미정이 아니라 3경기). 리플레이와 배틀 무효는 두 줄 사이에 뜬 글자가
       아니라 그 줄의 오른쪽 끝에 선다 (2026-11-10) */
    const seated=Boolean(x.a?.name||x.b?.name);
    const voidKey=admin&&open&&<Button variant="link" disabled={busy} onClick={async()=>{
        if(!await siteConfirm({title:"배틀 무효",body:`${label}의 배틀을 닫습니다. 진행 중이던 배틀은 무효로 끝나 리플레이로 남고, 이 판은 다시 치릅니다.`,confirmLabel:"무효",danger:true})) return;
        setBusy(true); try{ await voidBattle(b.id); onChanged?.(); }finally{ setBusy(false); }
      }}>배틀 무효</Button>;
    const replayKey=!open&&x.winner&&b&&<Button variant="link" href={battleHref(b.id)}>리플레이</Button>;
    return <div className="stack" key={x.key}>
      <Row title={seated?names:label} line={seated?line:line.slice(label.length+2)} value={voidKey||replayKey||undefined} lamp={open?"진행 중":null} sig={open}/>
      {open?<Button variant="second" href={battleHref(b.id)}>{b.status==="waiting"?`${label} 들어가기`:`${label} 관전`}</Button>
        :!x.winner&&startable&&<Button variant="second" href={officialBattleHref(eventId,x.key)}>{label} 배틀로 경기</Button>}
    </div>;
  };
  return <div className="stack mb-battle">
    <Row title={`사이트 배틀, ${state.winsA} 대 ${state.winsB}`} line={done}/>
    {rows.map(bout)}
  </div>;
}
/* the official battles of an event, read with the bracket's own 15 second rhythm. A battle that put its winner in makes the
   bracket read itself again, so an operator's screen shows the result without a reload. */
function useEventBattles(eventId, onApplied){
  const [list,setList]=useState([]);
  const appliedRef=useRef(null);
  const retriedRef=useRef(new Set());
  useEffect(()=>{
    if(!eventId) return undefined;
    let stopped=false;
    const tick=async()=>{
      if(document.visibilityState!=="visible") return;
      const next=await listEventBattles(eventId);
      if(stopped) return;
      const applied=next.filter(x=>x.applied_at).map(x=>x.id).join(",");
      if(appliedRef.current!==null&&applied!==appliedRef.current) onApplied?.();
      appliedRef.current=applied;
      setList(next);
      /* a battle that ended with a winner but neither went in nor left a reason: the function stopped between the end and the
         bracket. Ask it once more (once a page), after the function has had its own half minute. */
      for(const x of next){
        if(x.status!=="ended"||x.applied_at||x.apply_error||x.ended_by==="void"||!battleWinnerEntry(x)||retriedRef.current.has(x.id)) continue;
        if(Date.now()-new Date(x.updated_at).getTime()<30000) continue;
        retriedRef.current.add(x.id);
        void retryBattleApply(x.id).catch(()=>{});
      }
    };
    void tick();
    const iv=setInterval(tick,15000);
    return ()=>{ stopped=true; clearInterval(iv); };
  },[eventId]);
  return list;
}
/* a match's sheet: the round, the two sides at full length with the winner inverted and named 승자, the score; a team match adds its bouts */
/* 결과 보고 (2026-11-22, the owner's draft 7 A): in a match played in the game, each of its two players says whether they won. The same
   answer from both puts a single-elimination winner in at once; otherwise the operators press it in, and a disagreement is theirs to settle. */
const REPORT_LINE={waiting:"두 선수가 같은 결과를 보고하면 들어갑니다.",agreed:"두 보고가 같습니다. 운영진이 확인하면 들어갑니다.",applied:"결과가 들어갔습니다.",disputed:"보고가 서로 달라 운영진이 정합니다."};
function MatchReport({ eventId, m, onDone }){
  const [state,setState]=useState(null);
  const [busy,setBusy]=useState(false);
  useEffect(()=>{ let on=true; reportMatch(eventId,m.id).then(r=>on&&setState(r)); return ()=>{ on=false; }; },[eventId,m.id]);
  if(!state||state.status==="not_player"||state.status==="decided") return null;
  const send=async won=>{ setBusy(true); try{ const r=await reportMatch(eventId,m.id,won); setState(r); if(r?.status==="applied") onDone?.(); }catch{ /* the buttons stay for another press */ } finally{ setBusy(false); } };
  const line=state.status==="waiting"&&state.mine!=null?`${state.mine?"이겼다고":"졌다고"} 보고했습니다. 상대의 보고를 기다립니다.`:REPORT_LINE[state.status];
  return <div className="stack mb-battle">
    <Row title="결과 보고" line={line}/>
    {state.status!=="applied"&&<div className="stack bk-entry-actions">
      <Button variant={state.mine===true?"main":"second"} disabled={busy} onClick={()=>send(true)}>승리 보고</Button>
      <Button variant={state.mine===false?"main":"second"} disabled={busy} onClick={()=>send(false)}>패배 보고</Button>
    </div>}
  </div>;
}
function MatchSheet({ g, m, ev, nameOf, onClose, battle, startable, eventId, battles=[], boutCount=0, start="", table="", me=null, reportOn=false, onReported, need=1 }){
  const s=m.series, bouts=Array.isArray(s?.games)?s.games:[];
  const side=(key,pid)=>{
    const win=m.winner===key, lost=Boolean(m.winner)&&!win, score=sideScore(m,key);
    // when the result went in (matches.played_at, 2026-11-22: kept since the start and shown nowhere)
    const when=win&&m.playedAt?formatDate(m.playedAt,{time:true}):"";
    return <Row key={key} className={win?"inv":""} title={me&&pid===me?<>{slotName(pid,nameOf)}<MeTag/></>:slotName(pid,nameOf)} line={win?(when?`승자, ${when} 결과 입력`:"승자"):lost?(m.forfeit?lossWord(battle,m):"패배"):"결과 전"}
      value={score!=null&&!(lost&&m.forfeit)?<Fig value={String(score)} h={40} label={`${score}점`}/>:null}/>;
  };
  const bout=(label,a,b,w)=><Row key={label} title={`${a||"미정"}, ${b||"미정"}`} line={`${label}, ${w==="a"?a:w==="b"?b:"결과 전"}${w?" 승리":""}`}/>;
  // the round's start as a clock and the match's table as a counter (docs/db/match_schedule.sql); a table the site did not number stays in the box's strip
  const tableNo=/^\d{1,2}$/.test(table)?table:"";
  return (<Modal title={stageOf(g,m)} onClose={onClose}>
    <div className="stack">{side("a",ev.sp(m.a))}{side("b",ev.sp(m.b))}</div>
    {(start||tableNo)&&<div className={"stack mb-when"+(start&&tableNo?" two":"")}>
      {start&&<Counter label={`${stageOf(g,m)} 시작`} value={start}/>}
      {tableNo&&<Counter label="테이블" value={tableNo} unit="번" after={<span className="t15">번</span>}/>}
    </div>}
    {boutCount?<TeamBouts m={m} ev={ev} battles={battles} boutCount={boutCount} startable={startable} eventId={eventId}/>
      :<MatchBattle m={m} ev={ev} battle={battle} startable={startable} eventId={eventId} need={need} battles={battles}/>}
    {reportOn&&me&&!m.winner&&[ev.sp(m.a),ev.sp(m.b)].includes(me)&&<MatchReport eventId={eventId} m={m} onDone={onReported}/>}
    {bouts.length>0&&<div className="stack mb-bouts">
      {bouts.map((w,i)=>bout(`${i+1}경기`,s.lineupA?.[i],s.lineupB?.[i],w))}
      {s.ace&&bout("타이브레이커",s.ace.a,s.ace.b,s.ace.winner)}
    </div>}
  </Modal>);
}

/* 경기 일정 (docs/db/match_schedule.sql), the operators' sheet from a round's head: each round's start on the event's day, then the
   table of each match already made and not yet decided (a match not made has no row to hold it). 저장 acts at once and offers 되돌리기. */
function ScheduleSheet({ g, schedule, nameOf, eventName, day, onClose, onSave }){
  const ev=evalGraph(g);
  const rounds=[...g.rounds.map((r,ri)=>[roundLabel(g,ri),r]),...(g.lb||[]).map((r,li)=>[lbRoundName(li),r]),...(g.kind==="double"?[["그랜드 파이널",[g.gf]]]:[])]
    .map(([label,ms])=>({label,key:roundKeyOf(ms[0]?.id)})).filter(x=>x.key);
  const open=collectGraphMatches(g).filter(m=>!m.winner&&[ev.sp(m.a),ev.sp(m.b)].every(pid=>pid&&pid!==BYE));
  const date=day||new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Seoul"});
  const [times,setTimes]=useState(()=>Object.fromEntries(rounds.map(x=>[x.key,dotDate(schedule.rounds[x.key])?.clock||""])));
  const [tables,setTables]=useState(()=>Object.fromEntries(open.map(m=>[m.id,schedule.tables.get(m.id)||""])));
  const [busy,setBusy]=useState(false);
  const count=Math.max(2,g.rounds[0]?.length||0);
  const options=[["","미정"],...Array.from({length:count},(_,i)=>[String(i+1),`${i+1}번`])];
  // 4강 1경기 테이블, 정두호 대 이제빈: the round, the match's place in it, the two names
  const fieldLabel=m=>{ const r=[...g.rounds,...(g.lb||[])].find(x=>x.includes(m)); return `${stageOf(g,m)}${r&&r.length>1?` ${r.indexOf(m)+1}경기`:""} 테이블, ${nameOf(ev.sp(m.a))} 대 ${nameOf(ev.sp(m.b))}`; };
  const submit=async()=>{
    if(busy)return;
    setBusy(true);
    try{ await onSave({rounds:Object.fromEntries(rounds.map(x=>[x.key,roundStartIso(date,times[x.key])])),tables}); }
    finally{ setBusy(false); }
  };
  return (<Modal title="경기 일정" hint={eventName} onClose={onClose}>
    <div className="swap" key="bk-schedule">
      <div className="bk-sched-times">{rounds.map(x=><Field key={x.key} label={`${x.label} 시작`}><input type="time" value={times[x.key]} onChange={e=>{const v=e.target.value; setTimes(cur=>({...cur,[x.key]:v}));}}/></Field>)}</div>
      {open.map(m=><div className="field" key={m.id}><span className="field-label">{fieldLabel(m)}</span>
        <Segmented value={tables[m.id]} onChange={v=>setTables(cur=>({...cur,[m.id]:v}))} ariaLabel={`${stageOf(g,m)} 테이블`} options={options}/></div>)}
      <div className="modal-actions"><Button variant="second" onClick={onClose}>취소</Button><Button variant="main" icon="check" disabled={busy} onClick={submit} loading={busy}>저장</Button></div>
    </div>
  </Modal>);
}

/* ===== 결과 입력 =====
   경기 칩으로 경기를 고르고 이긴 줄을 눌러 승자를 정한다. 대진표의 줄을 누르는 것과 같은 일이며(같은 줄을 다시 누르면 취소),
   저장은 누를 때마다 된다. 개인전의 게임 점수와 불참은 경기 데이터에 칸이 없어 다루지 않는다. */
const stageOf=(g,m)=>{
  const ri=g.rounds.findIndex(r=>r.includes(m));
  if(ri>=0) return roundLabel(g,ri);
  const li=(g.lb||[]).findIndex(r=>r.includes(m));
  if(li>=0) return lbRoundName(li);
  if(m===g.third) return "3위 결정전";
  return m===g.reset?"리셋 결승":"그랜드 파이널";
};
function ResultEntry({ g, nameOf, seedOf=()=>null, onPick, teamMode, onOpenTeam, busy, outcomeOn=false, teamForfeitOn=false, onOutcome, onDepart=null, picks=null, partyOf=()=>[], onPicks=null, pickMax=4, swapIn=null, onSwap=null, reports=null, winsOf=()=>1, battles=[], startable=false, eventId=null, onBattleChanged, boutsOf=()=>0, stage=stageOf }){
  const ev=evalGraph(g);
  // the reset final exists only once the losers' side has won the grand final, as on the board
  const rows=collectGraphMatches(g).filter(m=>m!==g.reset||g.gf?.winner==="b").map(m=>({m,a:ev.sp(m.a),b:ev.sp(m.b)})).filter(x=>x.a&&x.b&&x.a!==BYE&&x.b!==BYE);
  const [chosen,setChosen]=useState(null);
  const [draft,setDraft]=useState(null);
  const [pickDraft,setPickDraft]=useState(null);
  const [swapping,setSwapping]=useState(null);
  const cur=rows.find(x=>x.m.id===chosen)||rows.find(x=>!x.m.winner)||rows[rows.length-1];
  if(!cur) return null;
  const at=rows.indexOf(cur);
  const next=rows.slice(at+1).find(x=>!x.m.winner)||rows.find(x=>!x.m.winner&&x!==cur);
  /* 점수는 승자가 정해진 경기에만, 이 칸에서 고친 뒤 한 번에 저장한다. 이긴 선수의 점수가 더 커야 한다(서버도 같은 검사를 한다) */
  const scored=outcomeOn&&!teamMode&&Boolean(cur.m.winner)&&!cur.m.forfeit;
  const saved=[cur.m.scoreA??null,cur.m.scoreB??null];
  const shown=draft&&draft.id===cur.m.id?draft.score:saved;
  const dirty=scored&&(shown[0]!==saved[0]||shown[1]!==saved[1]);
  // N선승(third_place_best_of.sql): the winner's score is the wins this match asks for, the loser's below it
  const need=winsOf(cur.m.id), top=need>1?need:9;
  const bump=(i,d)=>{ const next=[...shown]; next[i]=Math.max(0,Math.min(top,(next[i]??0)+d)); if(next[1-i]==null) next[1-i]=0; setDraft({id:cur.m.id,score:next}); };
  const winIndex=cur.m.winner==="a"?0:1;
  const scoreError=dirty&&shown[0]!=null&&shown[winIndex]<=shown[1-winIndex]?"이긴 선수의 점수가 더 커야 합니다."
    :dirty&&shown[0]!=null&&need>1&&shown[winIndex]!==need?`이긴 선수의 점수는 ${need}이어야 합니다(${need}선승).`:"";
  const saveScore=async()=>{ await onOutcome(cur.m.id,{scoreA:shown[0],scoreB:shown[1],forfeit:false}); setDraft(null); };
  const goNext=async()=>{ if(dirty){ if(scoreError)return; await saveScore(); } if(next) setChosen(next.m.id); };
  const side=(s,pid)=>{
    const win=cur.m.winner===s, decided=Boolean(cur.m.winner), i=s==="a"?0:1;
    const line=teamMode?(decided&&!win&&cur.m.forfeit?"불참":"눌러서 팀 대결 입력"):win?"승자, 다시 누르면 취소":decided?(cur.m.forfeit?lossWord(battleForMatch(battles,cur.m.id,[cur.a,cur.b]),cur.m):"눌러서 승자로 바꾸기"):"눌러서 승자로";
    return <div className={"bk-entry-row "+(win?"inv":"pn")+(scored?" scored":"")}>
      <button type="button" className="bk-entry-pick" disabled={busy} aria-pressed={win}
        onClick={()=>teamMode?onOpenTeam(cur.m,cur.a,cur.b):onPick(cur.m.id,s)}>
        <span className="t12 dim num">{seedOf(pid)||""}</span>
        <span className="bk-entry-name"><b className="t20">{nameOf(pid)}</b><span className="t12 reg">{line}</span></span>
        {win&&!scored&&<Icon n="check" size={20}/>}
      </button>
      {scored&&<span className="bk-entry-score" role="group" aria-label={`${nameOf(pid)} 점수`}>
        <button type="button" className="bk-entry-step" onClick={()=>bump(i,-1)} disabled={busy||!shown[i]} aria-label={`${nameOf(pid)} 점수 내리기`}><Icon n="minus" size={20}/></button>
        <Fig value={shown[i]==null?"":String(shown[i])} h={40} label={shown[i]==null?"점수 없음":`${shown[i]}점`}/>
        <button type="button" className="bk-entry-step" onClick={()=>bump(i,1)} disabled={busy||shown[i]>=top} aria-label={`${nameOf(pid)} 점수 올리기`}><Icon n="plus" size={20}/></button>
      </span>}
    </div>;
  };
  return (<section className="bk-entry" aria-label="결과 입력">
    <h2 className="t20">결과 입력</h2>
    <div className="bk-entry-chips" role="tablist" aria-label="경기">{rows.map((x,i)=><button type="button" role="tab" aria-selected={x===cur} key={x.m.id}
      className={"bk-entry-chip t12 "+(x===cur?"inv":"pn")+(x.m.winner?" done":"")} onClick={()=>setChosen(x.m.id)}>{x.m.winner&&<Icon n="check" size={16}/>}M{i+1}</button>)}</div>
    <div className="stack swap" key={cur.m.id}>
      <p className="pn bk-entry-head t12"><span className="dim">M{at+1}, {stage(g,cur.m)}</span>{cur.m.winner?<span>결과 확정</span>:<span className="bk-entry-live"><i className="lamp sig" aria-hidden="true"/>진행 중</span>}</p>
      {side("a",cur.a)}{side("b",cur.b)}
    </div>
    {teamMode?<TeamBouts m={cur.m} ev={ev} battles={battles} boutCount={boutsOf(cur.m,ev)} startable={startable} eventId={eventId} admin onChanged={onBattleChanged}/>
      :<MatchBattle m={cur.m} ev={ev} battle={battleForMatch(battles,cur.m.id,[cur.a,cur.b])} startable={startable} eventId={eventId} admin onChanged={onBattleChanged} need={need} battles={battles}
        onWalkover={async side=>{ await onPick(cur.m.id,side); if(outcomeOn) await onOutcome(cur.m.id,{forfeit:true}); }}/>}
    {outcomeOn&&(!teamMode||teamForfeitOn)&&cur.m.winner&&<div className="stack bk-entry-actions">
      <Button variant="second" disabled={busy} onClick={()=>onOutcome(cur.m.id,{forfeit:!cur.m.forfeit})}>{cur.m.forfeit?"불참 취소":`${nameOf(cur.m.winner==="a"?cur.b:cur.a)} 불참 처리`}</Button>
      {/* 대회 도중 떠난 출전: 기권과 실격은 이 경기를 불참으로 남기고, 출전에 그 사유를 단다 */}
      {onDepart&&!teamMode&&[["withdrew","기권"],["disqualified","실격"]].map(([kind,word])=><Button key={kind} variant="second" disabled={busy}
        onClick={()=>onDepart(cur.m,cur.m.winner==="a"?cur.b:cur.a,cur.m.departed===kind?null:kind)}>
        {cur.m.departed===kind?`${word} 취소`:`${nameOf(cur.m.winner==="a"?cur.b:cur.a)} ${word} 처리`}</Button>)}
    </div>}
    {/* 선수 보고 (the owner's draft 7 A): what the two players said; the same answer is one press away */}
    {reports&&!teamMode&&!cur.m.winner&&(reports.get(cur.m.id)||[]).length>0&&(()=>{ const said=reports.get(cur.m.id);
      const agreed=said.length===2&&said[0].winner_entry_id===said[1].winner_entry_id?said[0].winner_entry_id:null;
      return <div className="stack bk-entry-actions">
        <Row title={agreed?"선수 보고 일치":said.length===2?"선수 보고 다름":"선수 보고 하나"} line={said.map(r=>`${nameOf(r.entry_id)}: ${nameOf(r.winner_entry_id)} 승`).join(", ")}/>
        {agreed&&[cur.a,cur.b].includes(agreed)&&<Button variant="main" icon="check" disabled={busy} onClick={()=>onPick(cur.m.id,agreed===cur.a?"a":"b")}>보고대로 {nameOf(agreed)} 승리</Button>}
      </div>; })()}
    {/* 자리 교체 (2026-11-22, the owner's draft 3 A): a match not yet played can seat another applicant in either place */}
    {onSwap&&swapIn?.length>0&&!teamMode&&!cur.m.winner&&(()=>{ const played=new Set(rows.filter(x=>x.m.winner).flatMap(x=>[x.a,x.b])); const open=[cur.a,cur.b].filter(pid=>!played.has(pid)); return open.length>0&&<>
      <div className="stack bk-entry-actions">{open.map(pid=><Button key={pid} variant={swapping===pid?"main":"second"} disabled={busy}
        onClick={()=>setSwapping(swapping===pid?null:pid)}>{nameOf(pid)} 자리 교체</Button>)}</div>
      {swapping&&[cur.a,cur.b].includes(swapping)&&<Field label={`${nameOf(swapping)} 자리에 앉을 신청자`}>
        <Dropdown value="" placeholder="신청했지만 대진에 없는 사람" ariaLabel="교체할 신청자" options={swapIn.map(r=>({value:r.id,label:r.name}))}
          onChange={async id=>{ const who=swapIn.find(r=>r.id===id); if(!who) return;
            if(!(await siteConfirm({title:"자리 교체",body:`${nameOf(swapping)} 자리에 ${who.name}을 앉힙니다. 이 자리의 경기와 일정은 그대로입니다.`,confirmLabel:"교체"}))) return;
            await onSwap(swapping,id); setSwapping(null); }}/></Field>}
    </>; })()}
    {/* 선출 (2026-11-22, the owner's draft 1 A): each side's party as six cells under the decided match, the ones brought lit */}
    {picks&&onPicks&&!teamMode&&cur.m.winner&&(()=>{
      const savedOf=pid=>picks.get(`${cur.m.id}|${pid}`)||[];
      const shownOf=pid=>pickDraft?.id===cur.m.id&&pickDraft.sides[pid]?pickDraft.sides[pid]:savedOf(pid);
      const toggle=(pid,id)=>{ const now=shownOf(pid); const next=now.includes(id)?now.filter(x=>x!==id):now.length>=pickMax?now:[...now,id];
        setPickDraft(d=>({id:cur.m.id,sides:{...(d?.id===cur.m.id?d.sides:{}),[pid]:next}})); };
      const dirty=[cur.a,cur.b].filter(pid=>String(shownOf(pid))!==String(savedOf(pid)));
      return <>{[cur.a,cur.b].map(pid=>{ const party=partyOf(pid); if(!party.length) return null; const on=shownOf(pid);
        return <section className="stack bk-picks" key={pid}><SectionHead title={`${nameOf(pid)} 선출 ${on.length} / ${pickMax}`}/>
          <div className="rc-six">{party.map(p=><button type="button" key={p.id} aria-pressed={on.includes(p.id)} disabled={busy} onClick={()=>toggle(pid,p.id)}
            className={"stand rc-cell "+(on.includes(p.id)?"inv":"pn")}><Mon src={p.img} small/><span className="floor rc-band t12">{p.name}</span></button>)}</div>
        </section>; })}
        {dirty.length>0&&<Button variant="main" icon="check" disabled={busy} onClick={async()=>{ for(const pid of dirty) await onPicks(cur.m.id,pid,shownOf(pid)); setPickDraft(null); }}>선출 저장</Button>}
      </>;
    })()}
    {scoreError&&<p className="t12 reg bk-entry-error"><span className="bang" aria-hidden="true">!</span>{scoreError}</p>}
    {(next||dirty)&&<Button variant={dirty?"main":"second"} icon={dirty&&!next?"check":"arrow"} disabled={busy||Boolean(scoreError)} onClick={goNext}>
      {dirty?(next?`저장하고 다음 경기 M${rows.indexOf(next)+1}`:"점수 저장"):`다음 경기 M${rows.indexOf(next)+1}`}</Button>}
  </section>);
}

/* QR (2026-11-22, the owner's draft 9 A): the bracket's address for a screen at the venue, phones held up to it. Navy squares on white in
   both themes, as a camera reads them best, with the four-module quiet zone the standard asks for. */
function QrSheet({ name, url, onClose }){
  const qr=makeQr(url), n=qr.size+8;
  const d=qr.rows.flatMap((row,y)=>row.map((on,x)=>on?`M${x+4} ${y+4}h1v1h-1z`:"")).join("");
  return <Modal title="QR" hint={name} onClose={onClose}>
    <svg className="bk-qr" viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" role="img" aria-label={`${name} 대진표 주소 QR 코드`}><path d={d}/></svg>
  </Modal>;
}

/* 목록 보기 (2026-11-22, the owner's draft A): the same matches as rows, a round a section, for a screen reader and a narrow phone.
   Matches with a bye are left out, as on the board; the reset final only once it is played for. */
function BracketList({ g, nameOf, me=null, battles=[] }){
  if(!g) return null;
  const {sp}=evalGraph(g);
  const rounds=[...g.rounds.map((r,i)=>[roundLabel(g,i),r]),...(g.lb||[]).map((r,i)=>[lbRoundName(i),r]),...(g.gf?[["그랜드 파이널",[g.gf]]]:[]),...(g.reset&&g.gf?.winner==="b"?[["리셋 결승",[g.reset]]]:[]),...(g.third?[["3위 결정전",[g.third]]]:[])];
  return <div className="bk-rounds">{rounds.map(([label,matches])=>{
    const rows=matches.map(m=>({m,a:sp(m.a),b:sp(m.b)})).filter(x=>x.a!==BYE&&x.b!==BYE&&(x.a||x.b));
    if(!rows.length) return null;
    return <section key={label} className="stack"><SectionHead title={label}/><div className="stack">{rows.map(({m,a,b})=>{
      const win=m.winner?(m.winner==="a"?a:b):null, lose=m.winner?(m.winner==="a"?b:a):null;
      const battle=battleForMatch(battles,m.id,[a,b]);
      const live=!m.winner&&battle&&battle.status!=="ended";
      const sa=sideScore(m,"a"), sb=sideScore(m,"b");
      const name=pid=>pid?(pid===me?<>{nameOf(pid)}<MeTag/></>:nameOf(pid)):"대기";
      return <Row key={m.id} title={<>{name(a)}, {name(b)}</>} lamp={live} sig={live}
        line={win?(m.forfeit?`${nameOf(win)} 승리, ${nameOf(lose)} ${lossWord(battle,m)}`:`${nameOf(win)} 승리`):live?"진행 중":"경기 전"}
        value={win&&sa!=null&&sb!=null&&!m.forfeit?<Fig value={`${sa}:${sb}`} h={32} label={`${sa} 대 ${sb}`}/>:null}/>;
    })}</div></section>;
  })}</div>;
}

/* ===== 대진표 보드 =====
   인쇄된 대진표(draw sheet)처럼: 이름 하나마다 제 줄 위에 서고, 한 경기의 두 줄은 열의 오른끝에서 세로줄로 이어지며, 그 세로줄의
   한가운데에서 다음 라운드의 줄이 나간다. 그래서 첫 라운드에서 우승까지 한 번도 끊기지 않는 한 그림이다.
   줄은 1px, 이긴 쪽이 지나온 줄(제 줄과 세로줄의 제 절반)은 2px의 켜진 선이다. */
const WINS_OPTIONS=[{value:"1",label:"단판"},{value:"2",label:"2선승"},{value:"3",label:"3선승"}];
/* a name's row is 32 and stands on its line; a match's two lines are 40 apart (a pair), matches 64 apart; the champion's 32 name 44 */
const BK_ROW_H=32, BK_D=40, BK_GAP=64, BK_CHAMP_H=44, BK_INSET=12;
/* a round has one name wherever it is written: the tree's columns, the draw, the match sheet, result entry */
const roundName=(len)=>len===1?"결승":`${len*2}강`;
const roundLabel=(g,ri)=>g.kind==="double"?`승자조 ${ri+1}라운드`:roundName(g.rounds[ri].length);
const lbRoundName=(li)=>`패자조 ${li+1}라운드`;
/* 진행 중인 단일 토너먼트의 지금 라운드: 승자가 정해지지 않은 첫 라운드와 그 라운드에서 끝난 경기 수 (상태 띠) */
function liveProgress(b){
  if(b.format==="group"&&!b.knockout&&b.groups?.length){
    const games=b.groups.flatMap(g=>g.matches);
    return `조별 경기 ${games.filter(m=>m.winner).length}/${games.length} 종료`;
  }
  const g=b.format==="group"?b.knockout:b.graph;
  if(!g||g.kind==="double"||!g.rounds?.length) return "";
  const ev=evalGraph(g);
  const ri=g.rounds.findIndex(r=>r.some(m=>!ev.win[m.id]));
  if(ri<0) return "";
  const r=g.rounds[ri];
  return `${roundName(r.length)} ${r.filter(m=>ev.win[m.id]).length}/${r.length} 종료`;
}
/* once any match of the bracket has a table (docs/db/match_schedule.sql), every match carries a 32 head strip on the seam over its
   upper name, so the matches of a round stay one size */
const BK_STRIP_H=32+2;
/* where every line of a section stands (y of each line in its column's body). The first column's matches are two lines BK_D apart,
   BK_GAP between matches. A later slot fed by a match of the column before IS that match's outgoing line: it stands at the middle of
   the feeding match's two lines. A slot fed from elsewhere (a loser dropping in, the grand final's losers' side) stands BK_D under or
   over its partner, and a match fed by neither is stacked. `from(m)` may say { none, center }: no roads in, centred on that match. */
function sheetLayout(cols,strip=0,from=()=>null){
  const top=BK_ROW_H+strip, out=new Map();
  const slots=cols.map((ms,c)=>{ let floor=top; return ms.map(m=>{
    const o=from(m)||{};
    const feed=s=>c&&!o.none&&s?.win?cols[c-1].find(x=>x.id===s.win)||null:null;
    const fa=feed(m.a), fb=feed(m.b);
    let ya=fa?out.get(fa.id):null, yb=fb?out.get(fb.id):null;
    if(ya==null&&yb==null){ ya=o.center&&out.has(o.center.id)?Math.max(floor,out.get(o.center.id)-BK_D/2):floor; yb=ya+BK_D; }
    else if(ya==null) ya=yb-BK_D;
    else if(yb==null) yb=ya+BK_D;
    const ym=Math.round((ya+yb)/2); out.set(m.id,ym); floor=yb+BK_GAP+strip;
    return { ya, yb, ym, fa, fb }; }); });
  return { slots, out, totalH: Math.max(top,...slots.flat().map(s=>s.yb))+BK_GAP/2 };
}
/* the lines of a section as filled rectangles on whole pixels, from its columns' left edges and widths (columns abut, so a match's
   joining line at its column's right edge is where the next column's lines begin). Each name's line runs its column's width; the
   two lines of a match are joined at the right end by a vertical, half each; the middle of that vertical is the next round's line.
   A hairline is the pixel row [y, y+1) and column [x-1, x); a lit line (the winner's, and its half of the vertical) is [y-1, y+1)
   and [x-2, x), so lit and hairline segments butt on the same edges. */
function sheetRects(geo,layout,won,champ){
  const rects=[];
  const H=(x0,x1,y,lit)=>rects.push(lit?{ x:x0, y:y-1, w:x1-x0, h:2, lit }:{ x:x0, y, w:x1-x0, h:1, lit });
  const V=(x,y0,y1,lit)=>rects.push(lit?{ x:x-2, y:y0-1, w:2, h:y1-y0+2, lit }:{ x:x-1, y:y0, w:1, h:y1-y0+1, lit });
  layout.slots.forEach((col,c)=>{ const g=geo[c]; if(!g) return; const xr=g.x+g.w;
    // a slot fed from elsewhere (a loser dropping in) has no road in: its line starts 12 in, where its name does, so it never touches
    // the join of the column before and reads as joined to a match it did not come from
    const x0=fed=>c&&!fed?g.x+BK_INSET:g.x;
    col.forEach(({ ya, yb, ym, m, fa, fb })=>{ const wa=won(m,"a"), wb=won(m,"b");
      H(x0(fa),xr,g.y+ya,wa); H(x0(fb),xr,g.y+yb,wb); V(xr,g.y+ya,g.y+ym,wa); V(xr,g.y+ym,g.y+yb,wb); }); });
  const last=layout.slots.length-1, gc=geo[last+1];
  if(champ&&gc&&layout.slots[last]?.[0]) H(gc.x,gc.x+gc.w,gc.y+layout.slots[last][0].ym,Boolean(champ.name));
  rects.sort((a,b)=>a.lit-b.lit);
  return rects;
}
/* one section of the draw sheet: its rounds as columns and, after them, the 우승 line. Every name stands on its own line; the lines
   are one drawing over the section (sheetRects), laid over the names' rows, and no line passes through a name. */
function SheetSection({ cols, strip=0, from, card, stripOf, champ=null, n, won, className="" }){
  const layout=sheetLayout(cols.map(c=>c.ms),strip,from);
  layout.slots.forEach((col,c)=>col.forEach((s,j)=>{ s.m=cols[c].ms[j]; }));
  const ref=useRef(null);
  const [geo,setGeo]=useState(null);
  useLayoutEffect(()=>{
    const tree=ref.current;
    if(!tree) return undefined;
    const measure=()=>{
      const next=[...tree.querySelectorAll(":scope > .bk-col2")].map(col=>{ const body=col.querySelector(":scope > .bk-col-body");
        return col.offsetParent&&body?{ x:col.offsetLeft, w:col.offsetWidth, y:col.offsetTop+body.offsetTop }:null; });
      next.size={ w:tree.scrollWidth, h:tree.scrollHeight };
      setGeo(prev=>JSON.stringify(prev)===JSON.stringify(next)&&prev?.size?.w===next.size.w&&prev?.size?.h===next.size.h?prev:next);
    };
    measure();
    const watch=typeof ResizeObserver==="function"?new ResizeObserver(measure):null;
    watch?.observe(tree);
    return ()=>watch?.disconnect();
  },[cols.length,strip,Boolean(champ)]);
  const rects=geo?sheetRects(geo,layout,won,champ):[];
  const lastY=layout.slots[cols.length-1]?.[0]?.ym??BK_ROW_H;
  return <div className={"bk-tree "+className} ref={ref} style={{"--n":n}}>
    {cols.map((col,c)=>(<div className="bk-col2" key={c}>
      {col.head}
      <div className="bk-col-body" style={{height:layout.totalH}}>
        {col.ms.map((m,j)=>{ const { ya, yb }=layout.slots[c][j];
          return <div className="bk-mpos" data-c={c} data-j={j} key={m.id} style={{top:(ya-BK_ROW_H-strip)+"px","--d":(yb-ya)+"px"}}>{strip?stripOf(m):null}{card(m)}</div>; })}
      </div>
    </div>))}
    {/* the 우승 line: the final's middle runs on into it; the champion's name stands on it at 32 and lights when the final ends */}
    {champ&&<div className={"bk-col2 bk-champ-col"+(champ.name?" on":"")}>
      <div className="bk-col-h gf">우승</div>
      <div className="bk-col-body" style={{height:layout.totalH}}>
        <div className="bk-mpos bk-champ-pos" style={{top:(lastY-BK_CHAMP_H)+"px"}}>
          {champ.name
            ? <div className="bk-champ-node"><b className="t15">{champ.name}</b></div>
            : <div className="bk-champ-node wait"><span className="t12">결승이 끝나면 켜집니다.</span></div>}
        </div>
      </div>
    </div>}
    {geo&&<svg className="bk-wires" width={geo.size.w} height={geo.size.h} shapeRendering="crispEdges" aria-hidden="true">
      {rects.map((r,i)=><rect key={i} className={r.lit?"lit":"dim"} x={r.x} y={r.y} width={r.w} height={r.h}/>)}
    </svg>}
  </div>;
}
function ElimBoard({ g, nameOf, admin, onPick, teamMode, onOpenTeam, qualifier=false, seedOf, battles=[], startable=false, eventId=null, boutsOf=()=>0, schedule=null, me=null, onSchedule=null, reportOn=false, onReported, winsOf=()=>1 }){
  const ev=evalGraph(g);
  const finalRes=elimResult(g);
  const strip=schedule?.tables?.size?BK_STRIP_H:0;
  const startOf=ms=>{ const at=schedule?.rounds?.[roundKeyOf(ms[0]?.id)]; return at?dotDate(at)?.clock||"":""; };
  /* a column's head: the round and its start at the right end (13:00); for an operator it opens the schedule */
  const head=(label,ms,extra="t12 dim")=>{
    const start=startOf(ms);
    const words=<><span>{label}</span>{start&&<span className="num">{start}</span>}</>;
    return onSchedule
      ? <button type="button" className={"bk-col-h bk-col-set "+extra} onClick={onSchedule} aria-label={`${label}${start?` ${start} 시작`:""}, 경기 일정 정하기`}>{words}</button>
      : <div className={"bk-col-h "+extra}>{words}</div>;
  };
  /* a match already decided (a winner, or a bye) is no longer waiting for a table: its strip stands empty, keeping the tree's line
     (2026-11-23 audit, Q-03: 테이블 미정 stood over finished matches) */
  const stripOf=m=>{ const label=schedule?.tables?.get(m.id)||""; const settled=Boolean(ev.win[m.id]); return <div className={"mb-strip t12"+(label||settled?"":" wait")} aria-hidden={!label&&settled?true:undefined}>{label?tableWord(label):settled?"":"테이블 미정"}</div>; };
  /* the match open is in the address (?m=), so a reload or a shared link opens the same match: "이 경기" can be sent */
  const [seen,setSeenState]=useState(()=>{ const k=new URLSearchParams(window.location.search).get("m"); return k?collectGraphMatches(g).find(x=>String(x.id)===k)||null:null; });
  const setSeen=m=>{ setSeenState(m); const url=new URL(window.location.href); if(m) url.searchParams.set("m",m.id); else url.searchParams.delete("m");
    if(url.href!==window.location.href) window.history.replaceState(window.history.state,"",url); };
  // a team match is live while any of its bouts is (the lamp on its box)
  const liveBout=m=>battles.find(x=>x.status!=="ended"&&parseBoutKey(x.source_node_key)?.parent===m.id)||null;
  const card=m=><MatchCard m={m} ev={ev} nameOf={nameOf} admin={admin} onPick={onPick} teamMode={teamMode} onOpenTeam={onOpenTeam} seedOf={seedOf} onOpen={setSeen} me={me} battle={teamMode?liveBout(m):battleForMatch(battles,m.id,[ev.sp(m.a),ev.sp(m.b)])}/>;
  const seenRound=seen&&[...g.rounds,...(g.lb||[]),[g.gf],[g.reset]].find(r=>r?.includes(seen));
  // known: both entrants of the next match are named by it; on: it was played and decided (a bye is known but not lit)
  // the line a winner stands on lights: a match played and decided (a bye's winner stays quiet)
  const won=(m,side)=>m.winner===side&&ev.sp(m.a)!==BYE&&ev.sp(m.b)!==BYE;
  const col=(label,ms,extra)=>({ head:head(label,ms,extra), ms });
  /* a double's end stands on the winners' row: its final, the grand final (and the reset final once it is played for), then 우승, so the
     road a champion takes runs on one line to the name (2026-11-24: the grand final and 우승 stood apart under the losers' rounds) */
  const gfCols=g.kind==="double"&&!qualifier?[col("그랜드 파이널",[g.gf],"t12 gf"),...(g.reset&&g.gf.winner==="b"?[col("리셋 결승",[g.reset],"t12 gf")]:[])]:[];
  const top=[...g.rounds.map((r,ri)=>col(roundLabel(g,ri),r)),...gfCols];
  const champ=qualifier?null:{ name:finalRes?.champ?nameOf(finalRes.champ):"" };
  const lbCols=g.kind==="double"?g.lb.map((r,ri)=>col(lbRoundName(ri),r)):[];
  // the winners' and the losers' rows share one grid of columns, so a round's column stands over the same 1200 share in both
  const n=Math.max(top.length+(champ?1:0),lbCols.length);
  const from=m=>g.reset&&m===g.reset?{ none:true, center:g.gf }:null;
  const section=(cols,extra={})=><SheetSection cols={cols} strip={strip} from={from} card={card} stripOf={stripOf} n={n} won={won} {...extra}/>;
  return (<div className="bk-scroll" role="region" aria-label="대진표" tabIndex={0}>
  {seen&&<MatchSheet g={g} m={seen} ev={ev} nameOf={nameOf} onClose={()=>setSeen(null)} battle={battleForMatch(battles,seen.id,[ev.sp(seen.a),ev.sp(seen.b)])} startable={startable} eventId={eventId} battles={battles} boutCount={teamMode?boutsOf(seen,ev):0}
    start={seenRound?startOf(seenRound):""} table={schedule?.tables?.get(seen.id)||""} me={me} reportOn={reportOn&&!teamMode} onReported={onReported} need={winsOf(seen.id)}/>}
  {section(top,{champ})}
  {/* 3위 결정전 (third_place_best_of.sql): under the tree, between the semifinal losers, one column of the tree wide */}
  {g.third&&<div className="bk-lb"><div className="bk-lb-h t15">3위 결정전</div>{section([{ head:null, ms:[g.third] }],{className:"bk-narrow"})}</div>}
  {g.kind==="double"&&<div className="bk-lb"><div className="bk-lb-h t15">패자조</div>{section(lbCols,{className:"bk-narrow"})}</div>}
  </div>);
}

// 좁은 줄의 날짜(DESIGN.md "Numbers, dates, time"): 09.13 15:50, 날짜와 시각은 한 줄에
function formatBracketSubmissionTime(value) {
  const at = dotDate(value);
  return at ? [at.day, at.clock].filter(Boolean).join(" ") : "";
}

/* 마감 뒤 제출은 막지 않는다(어쩔 수 없는 사람을 위해). 운영진에게만 그 횟수를 상태 자리에 보인다: 마지막 제출도 마감 뒤라 그 시각이 곁에 선다.
   따로 줄을 두면 격자의 한 줄이 통째로 높아진다. */
function SubmissionStatusPanel({ model, busy, error, expanded, onToggle, onRefresh, onResetPin, showLate = false }) {
  const renderMember = member => (
    <div className="bk-submission-member" key={member.registrationId}>
      <span className="bk-submission-member-name">{member.name}</span>
      <span className={`bk-submission-state${member.hasSubmission ? " submitted" : ""}`}>
        {member.hasSubmission
          ? `${showLate&&member.lateSubmittedAt?.length ? `마감 뒤 ${member.lateSubmittedAt.length}번` : "제출 완료"}${formatBracketSubmissionTime(member.latestSubmittedAt) ? ` ${formatBracketSubmissionTime(member.latestSubmittedAt)}` : ""}`
          : "미제출"}
      </span>
      {onResetPin&&<button type="button" className="bd-del sm" onClick={()=>onResetPin(member)}>비밀번호 초기화</button>}
    </div>
  );
  const lateCount = showLate ? (model.mode === "team" ? model.teams.flatMap(team => team.members) : model.participants || []).filter(member => member.lateSubmittedAt?.length).length : 0;

  return (
    <section className="bk-submission sq" aria-label="파티 제출 현황">
      <div className="bk-submission-head">
        <button
          type="button"
          className="bk-submission-toggle"
          onClick={onToggle}
          aria-expanded={expanded}
          disabled={busy && model.total === 0}
        >
          <span className="bk-submission-title">파티 제출 현황</span>
          <span className="bk-submission-summary">
            {busy && model.total === 0 ? <Busy h={32}/> : `${model.submitted} / ${model.total} 제출${lateCount ? `, 마감 뒤 ${lateCount}명` : ""}`}
            <span className={"bk-submission-chevron"+(expanded?" open":"")} aria-hidden="true"><Icon n="chev" size={16}/></span>
          </span>
        </button>
        <button type="button" className="bk-submission-refresh" onClick={onRefresh} disabled={busy} aria-label="파티 제출 현황 새로고침">
          <Icon n="refresh" size={16}/>
        </button>
      </div>
      {error && <ErrorNote action="다시 불러오기" onRetry={onRefresh}>{error}</ErrorNote>}
      {expanded && !busy && !error && model.total > 0 && (
        <FoldOut className="bk-submission-detail">
          {model.mode === "team" ? (
            <div className="bk-submission-groups">
              {model.teams.map(team => (
                <div className="bk-submission-group sq" key={team.entryId}>
                  <div className="bk-submission-group-head">
                    <strong>{team.teamName}</strong>
                    <span>{team.submitted} / {team.total}</span>
                  </div>
                  <div className="bk-submission-members">{team.members.map(renderMember)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bk-submission-members bk-submission-individuals">
              {model.participants.map(renderMember)}
            </div>
          )}
        </FoldOut>
      )}
      {expanded && !busy && !error && model.total === 0 && (
        <div className="bk-submission-empty">확정된 참가 신청이 없어 제출 현황을 표시할 수 없습니다.</div>
      )}
    </section>
  );
}

function GroupStageBoard({b,admin,busy,run,nameOf,battles,startable,refresh}){
  const roundRobin = {sp:slot=>slot?.pid};
  const renderMatch=(match,editable)=><div className="stack pn" key={match.id} data-match={match.id}>
    <Row title={`${nameOf(match.a.pid)} vs ${nameOf(match.b.pid)}`} line={!match.winner?"경기 전":[`승자 ${nameOf(match[match.winner].pid)}`,
      match.forfeit?`${nameOf(match[match.winner==="a"?"b":"a"].pid)} ${lossWord(battleForMatch(battles,match.id,[match.a.pid,match.b.pid]),match)}`:match.scoreA!=null?`${match.scoreA}:${match.scoreB}`:null].filter(Boolean).join(", ")}/>
    {editable&&<div className="stack bk-pick">
      {["a","b"].map(side=><Button key={side} variant={match.winner===side?"main":"second"} disabled={busy}
        onClick={()=>run(()=>setGroupStageWinner(b,match,match.winner===side?null:match[side].pid))}>
        {match.winner===side?`${nameOf(match[side].pid)} 승자 취소`:`${nameOf(match[side].pid)} 승리`}
      </Button>)}
    </div>}
    <MatchBattle m={match} ev={roundRobin} battle={battleForMatch(battles,match.id,[match.a.pid,match.b.pid])} startable={startable&&!b.knockout}
      eventId={b.eventId} admin={admin} onChanged={refresh}/>
  </div>;
  return <div className="stack bk-gs">
    {b.groups.map(group=>{
      const {rows,ready,next,cutoff,complete,qualified}=group.standing;
      /* the group's standing and its games side by side on desktop (2026-11-23, the owner: one 709 column left the page's right half
         empty): the standing 709 at the left, the games 439 at the right, each from the same top line */
      return <section className="bk-gs-group" key={group.id}>
        <h2 className="t20">{group.name}조</h2>
        <div className="stack bk-gs-rank">{rows.map(row=><Row key={row.id} title={nameOf(row.id)}
          lead={complete?<Fig value={String(row.rank)} h={32} label={`${row.tied?"공동 ":""}${row.rank}위`}/>:null}
          line={[complete&&row.tied?"공동 순위":null,`${row.wins}승`,row.reason==="승자승"?row.reason:null].filter(Boolean).join(", ")}
          value={ready?(qualified.includes(row.id)?"본선 진출":"조별 탈락"):null}/>)}</div>
        <div className="stack bk-gs-games">
        {group.matches.map(match=>renderMatch(match,admin&&!b.knockout&&!group.playoffs.length?true:admin?false:undefined))}
        {cutoff&&<Row title="순위 결정전" line={ready?"진출자가 확정되었습니다.":`동률 선수 ${cutoff.ids.length}명 중 ${cutoff.places}명이 진출합니다.`}/>}
        {group.playoffs.map((match,i)=>renderMatch(match,admin&&!b.knockout&&i===group.playoffs.length-1?true:admin?false:undefined))}
        {admin&&!b.knockout&&next&&<Button variant="second" disabled={busy} onClick={()=>run(()=>createGroupPlayoff(b,group.id))}>단판 결정전 추첨</Button>}
        {admin&&group.playoffs.length>0&&!b.knockout&&<Button variant="second" disabled={busy} onClick={async()=>{
          if(await siteConfirm({title:"순위 결정전 초기화",body:"이 조의 결정전과 결과를 지우고 조별 결과 수정을 엽니다.",confirmLabel:"초기화",danger:true})){
            await run(()=>reopenGroupStage(b,group.id));
          }
        }}>결정전 초기화</Button>}
        </div>
      </section>;
    })}
    {admin&&!b.knockout&&b.groupCfg.ready&&<Button variant="main" disabled={busy} onClick={()=>run(()=>createGroupFinal(b))}>본선 추첨 및 확정</Button>}
    {admin&&b.knockout&&<Button variant="second" disabled={busy} onClick={async()=>{
      if(await siteConfirm({title:"본선 배치 취소",body:"아직 결과가 없는 본선 배치를 지우고 조별 단계로 돌아갑니다.",confirmLabel:"배치 취소",danger:true})){
        await run(()=>reopenGroupStage(b));
      }
    }}>본선 배치 취소</Button>}
  </div>;
}

function BracketBoard({ b, admin, flash, onApply, deleting=false, readOnly=false, refreshNormalized, onNormalizedReverted, data, save }){
  const nameOf=(pid)=>{ const p=(b.participants||[]).find(x=>x.id===pid); return p?p.name:pid; };
  const teamMode=b.mode==="team";
  const locked=!!b.applied||deleting||readOnly;
  const [matchMutationBusy,setMatchMutationBusy]=useState(false);
  const matchMutationBusyRef=useRef(false);
  const editAdmin=admin&&!locked&&!matchMutationBusy;
  // site battles: individual official brackets in progress can play a match as a battle; its winner goes in by itself
  const battles=useEventBattles(b.eventId&&b.projection?.source==="normalized"?b.eventId:null,()=>void refreshNormalized?.());
  const [series,setSeries]=useState(null);
  const [submissionStatuses,setSubmissionStatuses]=useState([]);
  const [submissionStatusError,setSubmissionStatusError]=useState("");
  const [submissionStatusBusy,setSubmissionStatusBusy]=useState(Boolean(b.eventId));
  const [submissionStatusExpanded,setSubmissionStatusExpanded]=useState(false);
  const [submissionStatusReloadKey,setSubmissionStatusReloadKey]=useState(0);
  const [championshipRefreshKey,setChampionshipRefreshKey]=useState(0);
  const [championshipEvent,setChampionshipEvent]=useState(null);
  const [hallOfFameBusy,setHallOfFameBusy]=useState(false);
  // the battle server only seats players of a running, unrecorded event (battle_official_seat); the button waits for the same
  // a team match has as many bouts as the larger team has members (buildDefaultTeamMatchLineups)
  const boutsOf=(m,ev)=>{ const size=id=>(b.participants||[]).find(x=>x.id===id)?.members?.length||0; return Math.max(size(ev.sp(m.a)),size(ev.sp(m.b))); };
  const battleStartable=Boolean(b.eventId&&b.projection?.runtimeId&&!locked&&b.status!=="done"&&championshipEvent?.status==="running"&&!championshipEvent.record_applied_at&&sitePlayed(championshipEvent));
  const runGroup=async(action)=>{
    if(!admin||locked||matchMutationBusyRef.current)return;
    matchMutationBusyRef.current=true;
    setMatchMutationBusy(true);
    try{await action();await refreshNormalized?.();}
    catch(error){flash(error?.message||"대진표를 저장하지 못했습니다.");await refreshNormalized?.();}
    finally{matchMutationBusyRef.current=false;setMatchMutationBusy(false);}
  };
  const pickGroupFinal=async(matchId,side)=>{
    if(!admin||locked||matchMutationBusyRef.current)return;
    const cleared=clearedByPick(b,matchId,side);
    if(cleared.length&&!(await siteConfirm({title:"본선 결과 변경",body:`이어진 경기 ${cleared.length}개의 결과가 지워집니다.`,confirmLabel:"변경",danger:true})))return;
    await runGroup(()=>setGroupFinalWinner(b,matchId,side));
  };
  useEffect(()=>{
    let cancelled=false;
    if(!b.eventId){ setChampionshipEvent(null); return undefined; }
    getEvent(b.eventId)
      .then(event=>{ if(!cancelled) setChampionshipEvent(event||null); })
      .catch(()=>{ if(!cancelled) setChampionshipEvent(null); });
    return ()=>{ cancelled=true; };
  },[b.eventId]);
  useEffect(()=>{
    if(!b.eventId){
      setSubmissionStatuses([]);
      setSubmissionStatusError("");
      setSubmissionStatusBusy(false);
      return;
    }
    let cancelled=false;
    setSubmissionStatusBusy(true);
    setSubmissionStatusError("");
    const loadStatuses=()=>listEventRegistrationSubmissionStatuses(b.eventId)
      .then(rows=>{ if(!cancelled){ setSubmissionStatuses(rows||[]); setSubmissionStatusError(""); } })
      .catch(error=>{ if(!cancelled) setSubmissionStatusError(error?.message||"파티 제출 현황을 불러오지 못했습니다."); })
      .finally(()=>{ if(!cancelled) setSubmissionStatusBusy(false); });
    loadStatuses();
    return ()=>{ cancelled=true; };
  },[b.eventId,submissionStatusReloadKey]);
  const submissionStatusModel=buildBracketSubmissionStatusModel(b,submissionStatuses);
  /* 점수와 불참(docs/db/match_outcome.sql): 그 SQL 전에는 null이라 화면에 나오지 않는다.
     팀전의 불참은 docs/db/match_outcome_more.sql 뒤에만 연다(teamForfeitOn) */
  const [outcomes,setOutcomes]=useState(null);
  const [outcomeKey,setOutcomeKey]=useState(0);
  const [teamForfeitOn,setTeamForfeitOn]=useState(false);
  const [departures,setDepartures]=useState(null);
  const [picks,setPicks]=useState(null);
  const [reports,setReports]=useState(null);
  const [parties,setParties]=useState(null);
  useEffect(()=>{
    let cancelled=false;
    if(!b.eventId){ setOutcomes(null); return undefined; }
    readMatchOutcomes(b.eventId).then(map=>{ if(!cancelled) setOutcomes(map); }).catch(()=>{ if(!cancelled) setOutcomes(null); });
    readEntryDepartures(b.eventId).then(map=>{ if(!cancelled) setDepartures(map); }).catch(()=>{ if(!cancelled) setDepartures(null); });
    readMatchPicks(b.eventId).then(map=>{ if(!cancelled) setPicks(map); }).catch(()=>{ if(!cancelled) setPicks(null); });
    if(admin) readMatchReports(b.eventId).then(map=>{ if(!cancelled) setReports(map); }).catch(()=>{ if(!cancelled) setReports(null); });
    return ()=>{ cancelled=true; };
  },[b.eventId,championshipRefreshKey,outcomeKey,b.graph,b.knockout,b.groups]);
  useEffect(()=>{
    let cancelled=false;
    if(teamMode&&admin) matchOutcomeMoreReady().then(ok=>{ if(!cancelled) setTeamForfeitOn(ok); });
    return ()=>{ cancelled=true; };
  },[teamMode,admin]);
  /* 선출: the operators' result entry shows each player's latest submitted party, its names and pictures from the records' directory */
  useEffect(()=>{
    let cancelled=false;
    if(!admin||!picks||teamMode){ setParties(null); return undefined; }
    const regs=(b.participants||[]).map(p=>p.registrationId).filter(Boolean);
    Promise.all([fetchRegistrationLatestRosters(regs),loadRecordsPokemonDirectory().catch(()=>null)]).then(([rosters,dir])=>{
      if(cancelled) return;
      const byPid=new Map((b.participants||[]).map(p=>[p.id,(rosters.get(p.registrationId)||[]).map(id=>{ const d=dir?.get(id);
        return {id,name:d?.displayName||id,img:spriteUrl(d?.canonicalName||id)}; })]));
      setParties(byPid);
    }).catch(()=>{ if(!cancelled) setParties(null); });
    return ()=>{ cancelled=true; };
  },[admin,picks!==null,teamMode,b.participants]);
  const savePicks=async(nodeKey,entryId,ids)=>{
    try{ await setMatchPicks({eventId:b.eventId,nodeKey,entryId,ids}); flash("선출을 저장했습니다."); }
    catch(error){ flash(`선출을 저장하지 못했습니다. ${error?.message||""}`.trim()); }
    finally{ setOutcomeKey(value=>value+1); }
  };
  /* 자리 교체: the event's applicants not in the bracket, offered in result entry (individual events, not Champions; after handover_features.sql) */
  const [swapIn,setSwapIn]=useState(null);
  useEffect(()=>{
    let cancelled=false;
    if(!admin||locked||teamMode||!b.eventId||championshipEvent?.event_type==="champions"){ setSwapIn(null); return undefined; }
    handoverReady().then(ok=>ok?listEventRegistrations(b.eventId):null).then(rows=>{
      if(cancelled||!rows) return;
      const seated=new Set((b.participants||[]).map(p=>p.registrationId).filter(Boolean));
      setSwapIn(rows.filter(r=>!seated.has(r.id)).map(r=>({id:r.id,name:r.registration_name})));
    }).catch(()=>{ if(!cancelled) setSwapIn(null); });
    return ()=>{ cancelled=true; };
  },[admin,locked,teamMode,b.eventId,b.participants,championshipEvent?.event_type]);
  const swapEntrant=async(entryId,registrationId)=>{
    try{ await replaceBracketEntrant({eventId:b.eventId,entryId,registrationId}); flash("자리를 바꿨습니다."); }
    catch(error){ flash(`자리를 바꾸지 못했습니다. ${error?.message||""}`.trim()); }
    finally{ await refreshNormalized?.(); }
  };
  const swapProps=swapIn?{swapIn,onSwap:swapEntrant}:{};
  const pickProps=parties?{picks,partyOf:pid=>parties.get(pid)||[],onPicks:savePicks,pickMax:championshipEvent?.battle_format==="singles"?3:4}:{};
  const slotSp=[b.graph,b.knockout].filter(Boolean).map(g=>evalGraph(g).sp);
  const evalSlot=s=>s?.pid?(s.pid===BYE?null:s.pid):slotSp.map(sp=>sp(s)).find(x=>x&&x!==BYE)||null;
  if(outcomes) [...collectGraphMatches(b.graph),...collectGraphMatches(b.knockout),...(b.groups||[]).flatMap(g=>[...g.matches,...(g.playoffs||[])])].forEach(m=>{
    const o=outcomes.get(m.id); m.scoreA=o?.score_a??null; m.scoreB=o?.score_b??null; m.forfeit=o?.resolution==="forfeit"&&Boolean(m.winner); m.playedAt=m.winner?o?.played_at||null:null;
    const loser=m.winner?evalSlot(m[m.winner==="a"?"b":"a"]):null; m.departed=loser&&departures?.get(loser)||null;
  });
  /* 조별 경기도 본선과 같은 결과 입력에서: 승자, 점수, 불참. 한 조의 경기들이 한 라운드처럼 선다 */
  const groupGraph=b.groups?.length&&!b.knockout?{kind:"group",rounds:[b.groups.flatMap(g=>[...g.matches,...(g.playoffs||[])])]}:null;
  const groupStage=(g,m)=>{ const group=b.groups.find(x=>x.matches.includes(m)||(x.playoffs||[]).includes(m)); return group?`${group.name}조${(group.playoffs||[]).includes(m)?" 순위 결정전":""}`:""; };
  const pickGroupStage=(matchId,side)=>{ const m=groupGraph?.rounds[0].find(x=>x.id===matchId); if(m) return runGroup(()=>setGroupStageWinner(b,m,m.winner===side?null:m[side].pid)); };
  /* 경기 일정(docs/db/match_schedule.sql): 라운드의 시작 시각과 경기의 테이블. 그 SQL 전에는 null이라 대진표는 지금과 같다 */
  const [schedule,setSchedule]=useState(null);
  const [scheduleKey,setScheduleKey]=useState(0);
  const runtimeId=b.projection?.source==="normalized"?b.projection.runtimeId:null;
  useEffect(()=>{
    let cancelled=false;
    if(!b.eventId||!runtimeId){ setSchedule(null); return undefined; }
    readBracketSchedule({eventId:b.eventId,runtimeId}).then(next=>{ if(!cancelled) setSchedule(next); }).catch(()=>{ if(!cancelled) setSchedule(null); });
    return ()=>{ cancelled=true; };
  },[b.eventId,runtimeId,scheduleKey,b.graph,b.knockout]);
  const me=useMyEntry(b.participants);
  const [shape,setShape]=useState("tree");
  // 결과 보고: a signed-in player of a running event played in the game (not on the site's battle), once handover_features.sql has run
  const [reportReady,setReportReady]=useState(false);
  useEffect(()=>{ let on=true; if(me&&!admin) handoverReady().then(ok=>on&&setReportReady(ok)); return ()=>{ on=false; }; },[me,admin]);
  const reportOn=reportReady&&!admin&&!teamMode&&championshipEvent?.status==="running"&&!sitePlayed(championshipEvent);
  const [scheduling,setScheduling]=useState(null);
  const canSchedule=Boolean(editAdmin&&schedule&&runtimeId);
  /* 저장은 한 번에: 바뀐 라운드 일정, 바뀐 테이블. 되돌릴 수 있으므로 묻지 않고 저장한 뒤 되돌리기를 준다 (DESIGN.md "Sheets") */
  const saveSchedule=async(next,{undo=true}={})=>{
    const before={rounds:schedule?.rounds||{},tables:schedule?.tables||new Map()};
    // 되돌리기는 앞의 일정을 그대로 다시 보낸다: 다시 읽기 전에 눌러도 빠지는 것이 없다
    const tableKeys=Object.keys(next.tables).filter(id=>!undo||(before.tables.get(id)||"")!==next.tables[id]);
    const instants=r=>JSON.stringify(Object.entries(r||{}).filter(([,v])=>v).map(([k,v])=>[k,new Date(v).getTime()]).sort());
    const roundsChanged=!undo||instants(next.rounds)!==instants(before.rounds);
    try{
      if(roundsChanged) await setRoundSchedule({eventId:b.eventId,runtimeId,rounds:next.rounds});
      for(const id of tableKeys) await setMatchTable({eventId:b.eventId,sourceNodeKey:id,label:next.tables[id]||null});
      setScheduling(null);
      setScheduleKey(value=>value+1);
      const back={rounds:before.rounds,tables:Object.fromEntries(tableKeys.map(id=>[id,before.tables.get(id)||""]))};
      flash(undo?"경기 일정을 저장했습니다.":"경기 일정을 되돌렸습니다.",undo&&(roundsChanged||tableKeys.length)?{label:"되돌리기",run:()=>void latestRef.current.saveSchedule(back,{undo:false})}:undefined);
    }catch(error){
      setScheduleKey(value=>value+1);
      flash(`경기 일정을 저장하지 못했습니다. ${error?.message||"잠시 뒤 다시 시도해 주세요."}`);
    }
  };
  /* 기권, 실격: 출전에 사유를 달고, 이 경기가 아직 불참이 아니면 불참으로 남긴다. 취소는 사유만 지운다(불참은 따로 취소한다) */
  const saveDeparture=async(m,entryId,kind)=>{
    if(readOnly||locked||matchMutationBusyRef.current)return;
    matchMutationBusyRef.current=true;
    setMatchMutationBusy(true);
    try{
      await setEntryDeparture({eventId:b.eventId,entryId,kind});
      if(kind&&!m.forfeit) await setNormalizedMatchOutcome({eventId:b.eventId,sourceNodeKey:m.id,forfeit:true});
      flash(kind?`${nameOf(entryId)}의 ${kind==="withdrew"?"기권":"실격"}을 남겼습니다.`:"취소했습니다.");
    }catch(error){
      flash(`저장하지 못했습니다. ${error?.message||"잠시 뒤 다시 시도해 주세요."}`);
    }finally{
      setOutcomeKey(value=>value+1);
      matchMutationBusyRef.current=false;
      setMatchMutationBusy(false);
    }
  };
  const saveOutcome=async(matchId,{scoreA=null,scoreB=null,forfeit=false})=>{
    if(readOnly||locked||matchMutationBusyRef.current)return;
    matchMutationBusyRef.current=true;
    setMatchMutationBusy(true);
    try{
      await setNormalizedMatchOutcome({eventId:b.eventId,sourceNodeKey:matchId,scoreA,scoreB,forfeit});
      setOutcomeKey(value=>value+1);
      flash(forfeit?"불참으로 남겼습니다.":scoreA!=null?"점수를 저장했습니다.":"불참을 취소했습니다.");
    }catch(error){
      setOutcomeKey(value=>value+1);
      flash(`저장하지 못했습니다. ${error?.message||"잠시 뒤 다시 시도해 주세요."}`);
    }finally{
      matchMutationBusyRef.current=false;
      setMatchMutationBusy(false);
    }
  };
  const pickNormalized=async(matchId,side)=>{
    if(readOnly||locked||matchMutationBusyRef.current)return;
    const match=collectGraphMatches(b.graph).find(row=>row.id===matchId);
    if(!match||!b.eventId||!b.projection?.runtimeId)return;
    const current=evalGraph(b.graph);
    const entryId=side==="a"?current.sp(match.a):current.sp(match.b);
    if(!entryId||entryId===BYE)return;
    const winnerEntryId=match.winner===side?null:entryId;
    /* 확정된 승자를 바꾸거나 취소하면 이어진 경기의 결과가 지워지고, 되돌리기가 없다: 무엇이 지워지는지 말하고 한 번 묻는다
       (DESIGN.md "Composing a screen" 18, 2026-11-08 관리자 워크스페이스) */
    if(match.winner){
      const cleared=clearedByPick(b,matchId,side);
      if(cleared.length){
        const stages=[...new Set(cleared.map(id=>matchStage(b,id)).filter(Boolean))].join(", ");
        const cancel=match.winner===side;
        if(!(await siteConfirm({title:cancel?"승자 취소":"승자 바꾸기",body:`이 경기의 승자를 ${cancel?"취소하면":"바꾸면"} 이어진 경기 ${cleared.length}개의 결과가 지워집니다${stages?` (${stages})`:""}. 지운 결과는 다시 입력해야 합니다.`,confirmLabel:cancel?"승자 취소":"바꾸기",danger:true})))return;
      }
    }
    matchMutationBusyRef.current=true;
    setMatchMutationBusy(true);
    try{
      if (!b.double && !teamMode) {
        await setNormalizedSingleBracketWinner({
          runtimeId:b.projection.runtimeId,
          eventId:b.eventId,
          sourceNodeKey:matchId,
          winnerEntryId,
        });
      } else {
        await syncNormalizedBracketMatches(b.eventId, withPick(b, matchId, side));
      }
      await refreshNormalized?.();
      setChampionshipRefreshKey(value=>value+1);
      /* 되돌리기: 새로 정한 승자만 되돌린다. 같은 쪽을 다시 누르는 것(승자 취소)과 같은 일이고, 그사이 바뀌었으면 하지 않는다.
         이미 있던 승자를 바꾼 것은 아래 경기가 지워지므로 정확히 되돌릴 수 없어 붙이지 않는다. */
      const undo=winnerEntryId&&!match.winner?{label:"되돌리기",run:()=>{
        const now=collectGraphMatches(latestRef.current.b.graph).find(row=>row.id===matchId);
        if(now?.winner===side) void latestRef.current.pickNormalized(matchId,side);
      }}:undefined;
      flash(winnerEntryId?"승자를 저장했습니다.":"승자를 취소했습니다.",undo);
    }catch(error){
      await refreshNormalized?.();
      setChampionshipRefreshKey(value=>value+1);
      flash(`승자를 저장하지 못했습니다. ${error?.message||"잠시 뒤 다시 시도해 주세요."}`);
    }finally{
      matchMutationBusyRef.current=false;
      setMatchMutationBusy(false);
    }
  };
  const latestRef=useRef(null);
  latestRef.current={b,pickNormalized,saveSchedule};
  const pick=(matchId,side)=>{
    if(readOnly||locked)return;
    return pickNormalized(matchId,side);
  };
  const openTeam=(m,pa,pb)=>{ if(readOnly||locked)return; const A=(b.participants||[]).find(p=>p.id===pa),B=(b.participants||[]).find(p=>p.id===pb); if(!A||!B)return; setSeries({m,A,B}); };
  const saveSeries=async(sObj,winnerSide)=>{
    if(readOnly||locked)return;
    if(matchMutationBusyRef.current)return;
    matchMutationBusyRef.current=true;
    setMatchMutationBusy(true);
    try{
      await syncNormalizedBracketMatches(b.eventId,withSeries(b,series.m.id,sObj,winnerSide));
      await refreshNormalized?.();
      setSeries(null);
      flash("팀전 결과를 저장했습니다.");
    }catch(error){
      await refreshNormalized?.();
      flash(`팀전 결과를 저장하지 못했습니다. ${error?.message||"잠시 뒤 다시 시도해 주세요."}`);
    }finally{
      matchMutationBusyRef.current=false;
      setMatchMutationBusy(false);
    }
  };
  const res = b.format==="group" ? (b.knockout?elimResult(b.knockout):null) : elimResult(b.graph);
  const resetPin=async(member)=>{
    if(!(await siteConfirm({title:"제출 비밀번호 초기화",body:`${member.name}의 제출 비밀번호를 지웁니다. 다음 제출 때 새로 정하며, 제출한 파티는 그대로 남습니다.`,confirmLabel:"초기화"})))return;
    try{ await resetSubmissionPin(member.registrationId); flash("제출 비밀번호를 초기화했습니다."); }
    catch(error){ flash(error?.message||"제출 비밀번호를 초기화하지 못했습니다."); }
  };
  const undoApplied=async()=>{
    if(readOnly)return;
    if(!b.applied)return;
    if(!(await siteConfirm({title:"기록 반영 취소",body:"이 대진표의 기록 반영을 취소할까요? 회차, 랭킹, 시즌 성적, 이 대회로 받은 칭호, 연결된 대회의 기록 상태가 함께 되돌아갑니다.",confirmLabel:"반영 취소",danger:true})))return;
    try{
      await revertEventRecord(b.eventId);
      await onNormalizedReverted?.();
      // 칭호는 site_data 에 산다. 기록이 이미 되돌아갔으니 칭호 저장이 실패해도 취소 자체는 끝난 것이다.
      const currentTitles=data?.titleGroups||[];
      const titleGroups=revertTitleAwards(currentTitles,b.eventId);
      if(titleGroups!==currentTitles){
        const ok=await save({...data,titleGroups},"기록 반영과 이 대회로 받은 칭호를 취소했습니다.");
        if(!ok) flash("기록 반영은 취소했지만 칭호는 되돌리지 못했습니다. 칭호 화면에서 확인해 주세요.");
        return;
      }
      flash("기록 반영을 취소했습니다.");
    }catch(error){
      flash(`기록 반영을 취소하지 못했습니다. 바뀐 내용은 없습니다. ${error?.message||"원인을 확인하지 못했습니다."}`);
    }
  };
  return (<div className="bk-board">
    {readOnly&&admin&&<p className="bk-hint">이미 끝난 과거 대진표입니다. 볼 수만 있고 수정, 삭제, 기록 반영은 할 수 없습니다.</p>}
    {res&&res.done&&championshipEvent?.championship_phase!=="qualifier"&&<section className="bk-result" aria-labelledby="bk-champ-name">
      <div className="inv bk-winner"><span className="t12">우승</span><h2 className="t20" id="bk-champ-name">{nameOf(res.champ)}</h2></div>
      {/* 날짜와 참가 수는 바로 위 대회 머리에 있다. 여기에는 결과만 한 번. */}
      {(res.ru||(res.sf&&res.sf.length>0))&&<Places res={res} nameOf={nameOf}/>}
      <div className="bk-cb-actions">
        <Button variant="second" className="bk-img" onClick={()=>downloadChampionPng(b,res,nameOf)}>우승 이미지</Button>
        <Button variant="second" className="bk-img" onClick={()=>downloadBracketPng(b,nameOf)}>대진표 이미지</Button>
        {/* the one main action docks above the bars on a scrolling screen (DESIGN.md "Controls") */}
        {admin&&!readOnly&&!b.applied&&championshipEvent?.championship_phase!=="qualifier"&&<Dock><Button variant="main" icon="check" onClick={()=>onApply(b,res)}>기록에 반영</Button></Dock>}
        {/* the operators' block after the record (2026-11-24, the owner: words floating on the ground read as nothing): its state lit on
            a panel, its acts as keys joined on the seam under it, as an event stands on 운영 */}
        {b.applied&&admin&&<div className="bk-ops">
          <p className="pn bk-ops-state t15"><Icon n="check" size={20}/>기록 반영됨</p>
          {!readOnly&&<div className="stack bk-ops-keys">{!readOnly&&admin&&championshipEvent?.event_type==="champions"&&championshipEvent?.championship_phase==="final"&&<Button variant="second" disabled={hallOfFameBusy} onClick={async()=>{setHallOfFameBusy(true);try{await ensureChampionshipHallOfFameEntry(b.eventId);flash("명예의 전당에 등록했습니다.");}catch(error){flash(`명예의 전당에 등록하지 못했습니다. ${error?.message||"잠시 뒤 다시 시도해 주세요."}`);}finally{setHallOfFameBusy(false);}}} loading={hallOfFameBusy}>명예의 전당 재시도</Button>}{championshipEvent?.championship_phase!=="qualifier"&&<Button variant="second" onClick={()=>onApply(b,res,{titlesOnly:true})}>칭호 다시 판정</Button>}<Button variant="second" onClick={undoApplied}>반영 취소</Button></div>}
        </div>}
      </div>
    </section>}
    <MyMatchKey b={b} className="bk-mine-wide"/>
    {b.eventId&&(admin||!(res&&res.done))&&<SubmissionStatusPanel
      model={submissionStatusModel}
      busy={submissionStatusBusy}
      error={submissionStatusError}
      expanded={submissionStatusExpanded}
      onToggle={()=>setSubmissionStatusExpanded(value=>!value)}
      onRefresh={()=>setSubmissionStatusReloadKey(value=>value+1)}
      onResetPin={admin?resetPin:null}
      showLate={admin}
    />}
    {admin&&championshipEvent?.championship_phase==="qualifier"&&<ChampionsBracketControls eventId={b.eventId} placement="qualifier" refreshKey={championshipRefreshKey} onChanged={()=>void refreshNormalized?.()}/>}
    {b.projection?.topology===GROUP_TOPOLOGY&&editAdmin&&groupGraph&&<ResultEntry g={groupGraph} stage={groupStage} nameOf={nameOf} busy={matchMutationBusy} onPick={pickGroupStage}
      outcomeOn={Boolean(outcomes)} onOutcome={saveOutcome} onDepart={departures?saveDeparture:null} {...pickProps} {...swapProps} reports={reports} winsOf={id=>winsNeeded(b,id)} battles={battles} startable={battleStartable} eventId={b.eventId} onBattleChanged={()=>void refreshNormalized?.()}/>}
    {b.projection?.topology===GROUP_TOPOLOGY&&<GroupStageBoard b={b} admin={admin&&!locked} busy={matchMutationBusy}
      run={runGroup} nameOf={nameOf} battles={battles} startable={battleStartable} refresh={()=>void refreshNormalized?.()}/>}
    {b.projection?.topology===GROUP_TOPOLOGY&&b.knockout&&<>
      <h2 className="t20 bk-final-h">본선</h2>
      {editAdmin&&!(res&&res.done)&&<ResultEntry g={b.knockout} nameOf={nameOf} busy={matchMutationBusy} onPick={pickGroupFinal} outcomeOn={Boolean(outcomes)} onOutcome={saveOutcome} onDepart={departures?saveDeparture:null} {...pickProps} {...swapProps} reports={reports} winsOf={id=>winsNeeded(b,id)}
        battles={battles} startable={battleStartable} eventId={b.eventId} onBattleChanged={()=>void refreshNormalized?.()}/>}
      <TabsLine value={shape} onChange={setShape} options={[["tree","대진표"],["list","목록"]]} label="보기"/>
      {shape==="list"?<BracketList g={b.knockout} nameOf={nameOf} me={me} battles={battles}/>:<ElimBoard g={b.knockout} nameOf={nameOf} admin={editAdmin} onPick={pickGroupFinal} battles={battles} reportOn={reportOn} onReported={()=>void refreshNormalized?.()} winsOf={id=>winsNeeded(b,id)}
        startable={battleStartable} eventId={b.eventId} schedule={schedule} me={me} onSchedule={canSchedule?()=>setScheduling(b.knockout):null}/>}
    </>}
    {admin&&!locked&&b.format==="elim"&&b.graph&&!(res&&res.done)&&<ResultEntry g={b.graph} nameOf={nameOf} busy={matchMutationBusy} onPick={pick} teamMode={teamMode} onOpenTeam={openTeam} outcomeOn={Boolean(outcomes)} teamForfeitOn={teamForfeitOn} onOutcome={saveOutcome} onDepart={departures?saveDeparture:null} {...pickProps} {...swapProps} reports={reports} winsOf={id=>winsNeeded(b,id)}
      battles={battles} startable={battleStartable} eventId={b.eventId} onBattleChanged={()=>void refreshNormalized?.()} boutsOf={boutsOf}
      seedOf={(pid)=>{const i=(b.participants||[]).findIndex(x=>x.id===pid);return i>=0?i+1:null;}}/>}
    {b.format==="elim"&&b.graph&&<TabsLine value={shape} onChange={setShape} options={[["tree","대진표"],["list","목록"]]} label="보기"/>}
    {b.format==="elim"&&shape==="list"&&<BracketList g={b.graph} nameOf={nameOf} me={me} battles={battles}/>}
    {b.format==="elim"&&shape!=="list"&&<ElimBoard g={b.graph} reportOn={reportOn} onReported={()=>void refreshNormalized?.()} winsOf={id=>winsNeeded(b,id)} nameOf={nameOf} admin={editAdmin} onPick={pick} teamMode={teamMode} onOpenTeam={openTeam} qualifier={championshipEvent?.championship_phase==="qualifier"} seedOf={(pid)=>{const i=(b.participants||[]).findIndex(x=>x.id===pid);return i>=0?i+1:null;}}
      battles={battles} startable={battleStartable} eventId={b.eventId} boutsOf={boutsOf} schedule={schedule} me={me} onSchedule={canSchedule?()=>setScheduling(b.graph):null}/>}
    {scheduling&&<ScheduleSheet g={scheduling} schedule={schedule} nameOf={nameOf} eventName={championshipEvent?.name||b.name||""} day={championshipEvent?.held_on||null} onClose={()=>setScheduling(null)} onSave={saveSchedule}/>}
    {series&&<TeamMatchModal teamA={series.A} teamB={series.B} init={series.m.series} onClose={()=>setSeries(null)} onSave={saveSeries}/>}
  </div>);
}

/* ===== 추첨 애니메이션 ===== */
function BracketDraw({ b, onDone }){
  const nameOf=(pid)=>{ const p=(b.participants||[]).find(x=>x.id===pid); return p?p.name:pid; };
  const allNames=(b.participants||[]).map(p=>p.name);
  const group=b.format==="group";
  // 채울 슬롯 순서(참가자만) 및 각 슬롯의 순번 계산
  const order={}; let k=0;
  if(group){ b.groups.forEach((g,gi)=>g.members.forEach((mem,mi)=>{ order["g"+gi+"_"+mi]=k++; })); }
  else { b.graph.rounds[0].forEach((m,mi)=>["a","b"].forEach((side,si)=>{ const s=m[side]; if(s.pid) order["m"+mi+"_"+si]=k++; })); }
  const total=k;
  // 움직임을 줄인 기기에서는 굴리지 않고 뽑힌 대진을 바로 세운다
  const [n,setN]=useState(()=>reduced()?total:0); const [roll,setRoll]=useState("");
  // 지금 뽑는 자리가 창 밖이면 따라간다 (2026-11-10: 13명부터는 추첨의 대부분이 화면 밖에서 일어났다)
  const rolling=useRef(null);
  useEffect(()=>{ rolling.current?.scrollIntoView({block:"nearest",inline:"nearest",behavior:reduced()?"auto":"smooth"}); },[n]);
  useEffect(()=>{
    if(n>=total){ const t=setTimeout(onDone,950); return ()=>clearTimeout(t); }
    let ticks=0; const iv=setInterval(()=>{ setRoll(allNames[Math.floor(Math.random()*allNames.length)]||""); if(++ticks>=9){ clearInterval(iv); const t=setTimeout(()=>setN(x=>x+1),140); return ()=>clearTimeout(t); } },70);
    return ()=>clearInterval(iv);
  },[n]); // eslint-disable-line
  /* 대진표의 칸 그대로 그린다(.mb, .mb-row): 이름이 들어와도 칸의 크기가 바뀌지 않고, 추첨이 끝나 대진표로 바뀔 때 같은 자리에 선다.
     아직 뽑지 않은 칸은 빈 줄, 뽑는 칸은 한 단 밝은 바탕(--tint) 위에서 이름이 그 안을 지나가고, 부전승과 다음 라운드의 대기는 대진표와 같은 흐린 글자다. */
  const row=(cls,text,ref)=><div className={"mb-row"+cls} ref={ref}><i className="mb-seed num t12" aria-hidden="true"/><span className="mb-name">{text}</span></div>;
  const slotFor=(key,pid,bye)=>{
    if(bye) return row(" wait","부전승");
    const ord=order[key];
    if(ord<n) return row(ord===n-1?" pop":"",nameOf(pid));
    if(ord===n) return row(" drolling",roll,rolling);
    return row(" wait","");
  };
  const done=n>=total;
  const skip=<Button variant={done?"main":"second"} size="sm" icon={done?"check":undefined} onClick={onDone}>{done?"대진 확정":"건너뛰기"}</Button>;
  return (<div className="bk-drawwrap swap">
    <div className="bk-draw-h"><h2 className="t20">{done?"대진 확정":"대진 추첨 중"}</h2><span className="t15 bk-draw-cnt num">{Math.min(n,total)} / {total}</span><span className="bk-draw-skip">{skip}</span></div>
    {group ? (
      <div className="bk-groups">{b.groups.map((g,gi)=>(
        <div className="bk-group" key={g.id}><div className="bk-group-h">{g.name}조</div>
          <div className="mb mb-list">{g.members.map((mem,mi)=>slotFor("g"+gi+"_"+mi,mem,false))}</div>
        </div>))}</div>
    ) : (()=>{ const rounds=b.graph.rounds;
      /* the draw stands on the sheet's own lines (SheetSection), every slot on its line, none lit until the sheet takes its place */
      const card=m=>{ const ri=rounds.findIndex(r=>r.includes(m)), j=rounds[ri].indexOf(m);
        return ri===0
          ? <div className="mb">{slotFor("m"+j+"_0",m.a.pid,m.a.bye)}{slotFor("m"+j+"_1",m.b.pid,m.b.bye)}</div>
          : <div className="mb">{row(" wait","대기")}{row(" wait","대기")}</div>; };
      return (<div className="bk-scroll sq" role="region" aria-label="대진표" tabIndex={0}>
        <SheetSection cols={rounds.map((r,ri)=>({ head:<div className="bk-col-h t12 dim">{roundLabel(b.graph,ri)}</div>, ms:r }))} card={card} n={rounds.length} won={()=>false}/>
      </div>);
    })()}
    <Dock><Button variant="main" icon={done?"check":"arrow"} onClick={onDone}>{done?"대진 확정":"건너뛰기"}</Button></Dock>
  </div>);
}

/* ===== 사설 대진표 =====
   누구나 만드는 연습용 대진표. 공식 대진표와 같은 보드, 추첨, 이미지 그리기를 쓰지만:
   - 저장은 communityStore 의 별도 행(ypl_private_brackets_v1)뿐이다. 정규화 스키마, 기록 반영, 랭킹, 명예의 전당 경로가 없다.
   - 화면마다 "사설" 표시와 기록 미반영 안내가 붙고, 이미지에도 사설 대진표라고 적힌다.
   - 관리(결과 입력, 다시 추첨, 삭제)는 만들 때 정한 비밀번호로 연다. 사이트 관리자는 언제나 정리할 수 있다. */
const PB_UNLOCK_KEY="ypl-private-brackets:unlocked";
// 연 대진표의 비밀번호. 쓸 때마다 서버가 확인하므로 이 탭이 닫힐 때까지 기억한다.
const readUnlocked=()=>{ try{ return new Map(Object.entries(JSON.parse(sessionStorage.getItem(PB_UNLOCK_KEY)||"{}"))); }catch{ return new Map(); } };
const writeUnlocked=map=>{ try{ sessionStorage.setItem(PB_UNLOCK_KEY,JSON.stringify(Object.fromEntries(map))); }catch{ /* 이 탭에서만 기억 못 함 */ } };
const pbFormat=b=>b.double?"더블 엘리미네이션":"싱글 엘리미네이션";
/* 우승 카드의 나머지 입상: 라벨과 값의 상자가 아니라 기록 > 대회 카드처럼 순위 이름표 뒤에 이름이 오는 줄(Consistency) */
function Places({ res, nameOf }){
  const lines=(res.third&&res.fourth?[["준우승",res.ru?[nameOf(res.ru)]:[]],["3위",[nameOf(res.third)]],["4위",[nameOf(res.fourth)]]]
    :[["준우승",res.ru?[nameOf(res.ru)]:[]],["4강",(res.sf||[]).map(nameOf)]]).filter(([,names])=>names.length);
  return <dl className="stack bk-places">{lines.map(([label,names])=><div className="pn spec-row" key={label}><dt className="t12 dim">{label}</dt><dd className="t15">{names.join(", ")}</dd></div>)}</dl>;
}
const pbStatus=b=>elimResult(b.graph)?.done?"종료":"진행 중";
const pbChamp=b=>{ const r=elimResult(b.graph); return r?.done?b.participants.find(p=>p.id===r.champ)?.name||"":""; };
const pbHasPicks=b=>collectGraphMatches(b.graph).some(m=>m.winner);

function PrivateBracketCreate({ onClose, onCreate }){
  const [name,setName]=useState(""); const [host,setHost]=useState(()=>{ try{return localStorage.getItem("ypl-board-nick")||"";}catch{return "";} });
  const [pin,setPin]=useState(""); const [namesText,setNamesText]=useState(""); const [double,setDouble]=useState("single");
  const [order,setOrder]=useState("random"); const [note,setNote]=useState(""); const [busy,setBusy]=useState(false);
  const names=parseParticipantNames(namesText);
  /* what is missing is said under its own field (DESIGN.md "Controls", Error on a field), every field at once: a dialog laid over this
     sheet said one at a time and hid the field it was about (2026-11-10) */
  const [tried,setTried]=useState(false);
  const bad={ name:!name.trim()&&"대진표 이름을 입력해 주세요.", host:!host.trim()&&"개설자 닉네임을 입력해 주세요.", pin:pin.length!==4&&"숫자 4자리를 정해 주세요.",
    names:names.length<2?"참가자를 2명 이상 적어 주세요.":names.length>PRIVATE_BRACKET_MAX&&`참가자는 ${PRIVATE_BRACKET_MAX}명까지 넣을 수 있습니다.` };
  const submit=async()=>{
    if(busy)return;
    if(Object.values(bad).some(Boolean)){ setTried(true); return; }
    setBusy(true);
    try{ await onCreate({name,host,pin,names,double:double==="double",order,note}); }
    finally{ setBusy(false); }
  };
  return (<Modal title="새 사설 대진표" onClose={onClose}>
    <div className="swap" key="pb-create">
      <Field label="대진표 이름" error={tried&&bad.name}><input value={name} onChange={e=>setName(e.target.value)} placeholder="예: 동아리방 금요 연습전" maxLength={40}/></Field>
      <div className="bk-grow2">
        <Field label="개설자 닉네임" error={tried&&bad.host}><input value={host} onChange={e=>setHost(e.target.value)} placeholder="예: 지나가던트레이너" maxLength={20}/></Field>
        <Field label="관리 비밀번호 (숫자 4자리)" error={tried&&bad.pin}><input value={pin} onChange={e=>setPin(e.target.value.replace(/[^0-9]/g,"").slice(0,4))} placeholder="결과 입력에 필요" inputMode="numeric"/></Field>
      </div>
      <div className="field"><label htmlFor="pb-names">참가자 {names.length>0&&<span className="tnum">{names.length}명</span>}</label>
        <textarea id="pb-names" value={namesText} onChange={e=>setNamesText(e.target.value)} rows={6} placeholder={"한 줄에 한 명씩 적거나 쉼표로 나눠 붙여넣어 주세요.\n지우\n이슬\n웅"} aria-invalid={tried&&bad.names?true:undefined}/>
        {tried&&bad.names&&<FormError>{bad.names}</FormError>}</div>
      <div className="field"><span className="field-label">방식</span><Segmented value={double} onChange={setDouble} ariaLabel="대진 방식" options={[["single","싱글 엘리미네이션"],["double","더블 엘리미네이션"]]}/></div>
      <div className="field"><span className="field-label">대진 배치</span><Segmented value={order} onChange={setOrder} ariaLabel="대진 배치" options={[["random","무작위 추첨"],["input","적은 순서대로"]]}/></div>
      <Field label="안내 (선택)"><textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} placeholder="규칙, 일정, 장소 등을 적어 주세요."/></Field>
      <div className="modal-actions"><Button variant="second" onClick={onClose}>취소</Button><Button variant="main" icon="check" disabled={busy} onClick={submit} loading={busy}>대진표 만들기</Button></div>
    </div>
  </Modal>);
}

/* 만든 뒤 고칠 수 있는 것: 이름, 개설자, 안내, 참가자 이름(오타). 인원과 대진은 그대로 둔다. */
function PrivateBracketEdit({ b, onClose, onSave }){
  const [name,setName]=useState(b.name); const [host,setHost]=useState(b.host||""); const [note,setNote]=useState(b.note||"");
  const [names,setNames]=useState(()=>b.participants.map(p=>p.name)); const [busy,setBusy]=useState(false);
  // what is missing is said under its own field, every field at once, when 저장 is pressed (DESIGN.md "Sheets")
  const [tried,setTried]=useState(false);
  const nameError=!name.trim()&&"대진표 이름을 입력해 주세요.";
  const namesError=list=>list.some(n=>!n)?"참가자 이름을 입력해 주세요.":new Set(list).size!==list.length?"같은 이름의 참가자가 있습니다. 이름이 겹치지 않게 고쳐 주세요.":"";
  const shownNamesError=tried&&namesError(names.map(n=>n.trim().slice(0,20)));
  const submit=async()=>{
    if(busy)return;
    const clean=names.map(n=>n.trim().slice(0,20));
    setTried(true);
    if(nameError||namesError(clean)) return;
    setBusy(true);
    try{ await onSave({name:name.trim().slice(0,40),host:host.trim().slice(0,20),note:note.trim().slice(0,1000),
      participants:b.participants.map((p,i)=>({...p,name:clean[i]}))}); }
    finally{ setBusy(false); }
  };
  return (<Modal title="대진표 수정" onClose={onClose}>
    <div className="swap" key="pb-edit">
      <Field label="대진표 이름" error={tried&&nameError}><input value={name} onChange={e=>setName(e.target.value)} maxLength={40}/></Field>
      <Field label="개설자 닉네임"><input value={host} onChange={e=>setHost(e.target.value)} maxLength={20}/></Field>
      <div className="field"><span className="field-label">참가자 이름</span>
        {names.map((n,i)=><input key={b.participants[i].id} value={n} aria-label={`참가자 ${i+1}`} maxLength={20} aria-invalid={shownNamesError?true:undefined} onChange={e=>{const v=e.target.value; setNames(cur=>cur.map((x,k)=>k===i?v:x));}}/>)}
        {shownNamesError&&<FormError>{shownNamesError}</FormError>}</div>
      <Field label="안내 (선택)"><textarea value={note} onChange={e=>setNote(e.target.value)} rows={3}/></Field>
      <div className="modal-actions"><Button variant="second" onClick={onClose}>취소</Button><Button variant="main" icon="check" disabled={busy} onClick={submit} loading={busy}>저장</Button></div>
    </div>
  </Modal>);
}

function PrivateBrackets({ admin, flash, tabs }){
  const [list,setList]=useState(()=>peekRead(PRIVATE_BRACKETS_KEY)||null);
  const listArrived=useArrival(Boolean(list));
  const [fresh,setFresh]=useState(false);
  const [loadError,setLoadError]=useState("");
  const reload=async()=>{ try{ setList(await freshRead(PRIVATE_BRACKETS_KEY,()=>readCommunity(PRIVATE_BRACKETS_KEY))); setLoadError(""); }catch(error){ setLoadError(readErrorText(error,"사설 대진표를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.")); }finally{ setFresh(true); } };
  useEffect(()=>{ void reload(); },[]); // eslint-disable-line react-hooks/exhaustive-deps
  const [q,setQ]=useState("");
  const [creating,setCreating]=useState(false);
  const [openId,setOpenId]=useState(()=>new URLSearchParams(window.location.search).get("pb"));
  const [drawId,setDrawId]=useState(null);
  const [unlocked,setUnlocked]=useState(readUnlocked);
  const [busy,setBusy]=useState(false); const [editing,setEditing]=useState(false);
  useEffect(()=>{ const onPop=()=>{ setOpenId(new URLSearchParams(window.location.search).get("pb")||null); setDrawId(null); }; popHandlers.add(onPop); return ()=>{ popHandlers.delete(onPop); }; },[]);
  const sorted=[...(list||[])].sort((a,b)=>(a.createdAt<b.createdAt?1:-1));
  const kw=q.trim().toLowerCase();
  const shown=kw?sorted.filter(b=>[b.name,b.host,...(b.participants||[]).map(p=>p.name)].some(t=>String(t||"").toLowerCase().includes(kw))):sorted;
  const open=openId?(list||[]).find(b=>b.id===openId):null;
  useItemTitle(open?.name);
  const canEdit=Boolean(open&&(admin||unlocked.has(open.id)));
  const nameOf=pid=>open?.participants?.find(p=>p.id===pid)?.name||pid;

  const openBracket=(b,{draw=false}={})=>{ const url=new URL(window.location.href); url.searchParams.set("tab","private"); url.searchParams.set("pb",b.id);
    pushHistory({...window.history.state,pb:b.id},url); setDrawId(draw?b.id:null); transition(()=>flushSync(()=>setOpenId(b.id)),{shared:"pb-"+b.id}); };
  const closeBracket=()=>{ setDrawId(null); if(window.history.state?.pb) backWith(open?"pb-"+open.id:null);
    else { const url=new URL(window.location.href); url.searchParams.delete("pb"); window.history.replaceState(window.history.state,"",url); transition(()=>flushSync(()=>setOpenId(null)),{shared:open?"pb-"+open.id:null,dir:"back"}); } };
  const unlock=(id,pin)=>{ const next=new Map(unlocked); next.set(id,pin); setUnlocked(next); writeUnlocked(next); };
  const lock=id=>{ const next=new Map(unlocked); next.delete(id); setUnlocked(next); writeUnlocked(next); };
  // Read the current draw, then let the DB reject a competing save by its token.
  const write=async(id,change,done)=>{ setBusy(true);
    try{
      const expectedUpdatedAt=(list||[]).find(x=>x.id===id)?.updatedAt;
      const current=(await readCommunity(PRIVATE_BRACKETS_KEY)).find(x=>x.id===id);
      const patch=buildPrivateBracketPatch(current,expectedUpdatedAt,change);
      await patchCommunityItem(PRIVATE_BRACKETS_KEY,id,patch,{pin:unlocked.get(id)||"",expectedUpdatedAt:current.updatedAt});
      await reload();
      if(done)flash(done); return true; }
    catch(error){ siteAlert("저장하지 못했습니다.",error?.message||"잠시 뒤 다시 시도해 주세요."); void reload(); return false; } finally{ setBusy(false); } };

  const create=async({pin,...input})=>{
    let b; try{ b=createPrivateBracket(input); }catch(error){ siteAlert("대진표를 만들 수 없습니다.",error?.message||""); return; }
    setBusy(true);
    try{ await createCommunityItem(PRIVATE_BRACKETS_KEY,b.id,b,{pin}); await reload(); if(b.order!=="random") flash("사설 대진표를 만들었습니다."); } // 추첨이 시작되면 화면이 말한다
    catch(error){ siteAlert("저장하지 못했습니다.",error?.message||"잠시 뒤 다시 시도해 주세요."); return; }
    finally{ setBusy(false); }
    try{ localStorage.setItem("ypl-board-nick",b.host); }catch{ /* 기억 못 해도 된다 */ }
    unlock(b.id,pin); setCreating(false); openBracket(b,{draw:b.order==="random"});
  };
  const verifyPin=async(title)=>{
    const pin=await sitePrompt({title,body:"대진표를 만들 때 정한 관리 비밀번호를 입력해 주세요.",label:"관리 비밀번호",placeholder:"숫자 4자리",confirmLabel:"열기",secret:true,inputMode:"numeric"});
    if(pin===null)return false;
    const status=await verifyCommunityPin(PRIVATE_BRACKETS_KEY,open.id,pin).catch(()=>"failed");
    if(status!=="ok"){ siteAlert(PIN_DENIED[status]||"비밀번호를 확인하지 못했습니다.","만든 사람에게 확인해 주세요."); return false; }
    unlock(open.id,pin); return true;
  };
  const askUnlock=async()=>{ if(await verifyPin("결과 입력")) flash("이제 승자를 눌러 결과를 입력할 수 있습니다."); };
  const startEdit=async()=>{ if(canEdit||await verifyPin("대진표 수정")) setEditing(true); };
  const saveEdit=async v=>{ if(await write(open.id,()=>({...v,updatedAt:new Date().toISOString()}),"수정했습니다.")) setEditing(false); };
  const pick=(matchId,side)=>{ if(busy||!canEdit)return; const id=open.id; const at=new Date().toISOString();
    setList(items=>items.map(x=>x.id===id?withPick(x,matchId,side):x));
    void write(id,x=>({...withPick(x,matchId,side),updatedAt:at})); };
  const redraw=async()=>{ if(!(await siteConfirm({title:"다시 추첨",body:"참가자는 그대로 두고 대진을 새로 섞습니다.",confirmLabel:"다시 추첨"})))return;
    const id=open.id; let graph;
    try{ graph=buildPrivateGraph(open.participants.map(p=>p.id),{double:open.double,order:"random"}); }catch(error){ siteAlert("다시 추첨하지 못했습니다.",error?.message||"잠시 뒤 다시 시도해 주세요."); return; }
    if(await write(id,()=>({graph,order:"random",updatedAt:new Date().toISOString()}))) setDrawId(id); };
  const del=async()=>{
    let pin=unlocked.get(open.id)||"";
    if(!admin&&!unlocked.has(open.id)){
      pin=await sitePrompt({title:"대진표 삭제",body:"대진표를 만들 때 정한 관리 비밀번호를 입력해 주세요.",label:"관리 비밀번호",placeholder:"숫자 4자리",confirmLabel:"삭제",secret:true,inputMode:"numeric"});
      if(pin===null)return;
    } else if(!(await siteConfirm({title:"대진표 삭제",body:`‘${open.name}’ 사설 대진표를 삭제할까요? 되돌릴 수 없습니다.`,confirmLabel:"삭제",danger:true}))) return;
    const id=open.id;
    try{ await deleteCommunityItem(PRIVATE_BRACKETS_KEY,id,pin); }
    catch(error){ siteAlert("삭제하지 못했습니다.",error?.message||"잠시 뒤 다시 시도해 주세요."); return; }
    await reload(); flash("사설 대진표를 삭제했습니다."); lock(id); closeBracket(); };
  const share=async()=>{ const r=await shareLink({view:"bracket",tab:"private",pb:open.id},open.name); if(r==="copied")flash("주소를 복사했습니다."); };

  if(openId&&!open) return (<section className="bk"><div className="bk-open">
    <BackLink to="사설 대진표" onClick={closeBracket}/>
    {fresh?<Empty title="대진표를 찾을 수 없습니다." desc="삭제되었거나 주소가 잘못되었습니다."/>:<Loader/>}
  </div></section>);

  if(open){ const res=elimResult(open.graph); const live=!res?.done; const pngBracket={...open,private:true};
    return (<section className="bk"><div className="bk-open">
      <header className="bk-head-open">
        <BackLink to="사설 대진표" onClick={closeBracket}/>
        {live&&<p className="bk-live t12"><Status live>{pbStatus(open)}</Status></p>}
        <div className="bk-open-row">
          <div className="bk-open-copy">
            <h1 className="t32 bk-open-title" data-vt={"pb-"+open.id}>{open.name}</h1>
            <p className="t12 dim reg bk-open-line">사설, {open.host?`${open.host} 개설, `:""}{pbFormat(open)}, {open.participants.length}명{open.createdAt?`, ${formatDate(open.createdAt)}`:""}</p>
          </div>
          {/* desktop: the keys stand beside the title as the official bracket's do, in its order, then the private bracket's own */}
          <div className="stack bk-tools">
            <Button variant="second" size="sm" onClick={share}>링크 공유</Button>
            {res?.done&&<Button variant="second" size="sm" onClick={()=>downloadChampionPng(pngBracket,res,nameOf)}>우승 이미지</Button>}
            <Button variant="second" size="sm" onClick={()=>downloadBracketPng(pngBracket,nameOf)}>대진표 이미지</Button>
            {canEdit
              ? <>{!admin&&<Button variant="second" size="sm" onClick={()=>lock(open.id)}>입력 마치기</Button>}
                  {!pbHasPicks(open)&&<Button variant="second" size="sm" disabled={busy} onClick={redraw}>다시 추첨</Button>}</>
              : <Button variant="second" size="sm" onClick={askUnlock}>결과 입력</Button>}
            <Button variant="second" size="sm" disabled={busy} onClick={startEdit}>수정</Button>
            {(canEdit||admin)&&<Button variant="second" size="sm" disabled={busy} onClick={del}>삭제</Button>}
          </div>
        </div>
        {open.note&&<div className="bk-note"><Prose text={open.note}/></div>}
        <div className="stack bk-actions bk-pb-actions">
          {canEdit
            ? <>{!admin&&<Button variant="second" onClick={()=>lock(open.id)}>입력 마치기</Button>}
                {!pbHasPicks(open)&&<Button variant="second" disabled={busy} onClick={redraw}>다시 추첨</Button>}</>
            : <Button variant="second" onClick={askUnlock}>결과 입력</Button>}
          <Button variant="second" onClick={share}>링크 공유</Button>
          <Button variant="second" onClick={()=>downloadBracketPng(pngBracket,nameOf)}>대진표 이미지</Button>
          {res?.done&&<Button variant="second" onClick={()=>downloadChampionPng(pngBracket,res,nameOf)}>우승 이미지</Button>}
          <Button variant="second" disabled={busy} onClick={startEdit}>수정</Button>
          {(canEdit||admin)&&<Button variant="second" disabled={busy} onClick={del}>삭제</Button>}
        </div>
      </header>
      {drawId===open.id
        ? <BracketDraw b={open} onDone={()=>setDrawId(null)}/>
        : <div className="bk-board">
            {res?.done&&<section className="bk-result" aria-labelledby="pb-champ-name">
              <div className="inv bk-winner"><span className="t12">우승</span><h2 className="t20" id="pb-champ-name">{nameOf(res.champ)}</h2></div>
              {(res.ru||(res.sf&&res.sf.length>0))&&<Places res={res} nameOf={nameOf}/>}
            </section>}
            <ElimBoard g={open.graph} nameOf={nameOf} admin={canEdit&&!busy} onPick={pick} seedOf={pid=>{const i=open.participants.findIndex(x=>x.id===pid);return open.order==="input"&&i>=0?i+1:null;}}/>
          </div>}
      {editing&&<PrivateBracketEdit b={open} onClose={()=>setEditing(false)} onSave={saveEdit}/>}
    </div></section>);
  }

  return (<section className="bk">
    <header className="bk-head"><h1 className="page-title">대진표</h1></header>
    {tabs}
    {/* 사설 explains in one panel that it never reaches the records (DESIGN.md "Brackets") */}
    <Row className="bk-private-note" title="사설 대진표는 리그 기록에 남지 않습니다."/>
    {/* the search with its main action at the row's right end, as the board's 글쓰기 stands (DESIGN.md "Controls": beside a search it
        keeps its own width): alone over the search it was a white bar across the whole 1200 (2026-11-10) */}
    <div className="bd-tools stack"><ListSearch q={q} setQ={setQ} placeholder="대진표, 개설자, 참가자 검색" count={shown.length}/><Button variant="main" icon="plus" onClick={()=>setCreating(true)}>새 사설 대진표</Button></div>
    {loadError&&<ErrorNote action="다시 불러오기" onRetry={reload}>{loadError}</ErrorNote>}
    {!list?(!loadError&&<Loader/>):shown.length===0
      ? (kw?<Empty className="search-none swap" title="맞는 대진표가 없습니다."/>
           :<Empty className="swap" title="아직 사설 대진표가 없습니다."/>)
      : <div className="stack bk-rows" ref={listArrived}>{shown.map((b,i)=><BracketRow key={b.id} b={b} lead={i===0&&!kw} vt={"pb-"+b.id} live={pbStatus(b)==="진행 중"}
          line={`${b.host?`${b.host} 개설, `:""}${b.participants.length}명, ${pbFormat(b)}${pbChamp(b)?`, 우승 ${pbChamp(b)}`:""}`} onOpen={()=>openBracket(b)} href={viewHref("bracket",{tab:"private",pb:b.id})}/>)}</div>}
    {creating&&<PrivateBracketCreate onClose={()=>setCreating(false)} onCreate={create}/>}
  </section>);
}
/* ===== 사설 대진표 끝 ===== */

/* only what runs carries a status: an ended bracket says 우승 in its grey line, so its end shows the date alone (nothing when the
   old record has none) instead of 종료 on every row */
function BracketRow({ b, vt, live, line, end, onOpen, href, lead=false }){
  const d=dotDate(b.createdAt);
  /* the newest of a list stands as a lead panel: its date lit, the amber lamp while it runs */
  if(lead) return <Lead date={d?.day} title={<span data-vt={vt}>{b.name}</span>} line={[line,end].filter(Boolean).join(", ")}
    lamp={live?"진행 중":null} sig={live} onClick={onOpen} href={href} label={`${b.name}, ${[line,live?"진행 중":end].filter(Boolean).join(", ")}`}/>;
  return <Row title={<span data-vt={vt}>{b.name}</span>} line={line} onClick={onOpen} href={href}
    value={live?<Status live>진행 중</Status>:end?<Status>{end}</Status>:d?<Status><span className="num">{d.day}<span className="wd">{d.weekday}</span></span></Status>:null}/>;
}

/* ===== 대진표 메인 ===== */
export default function BracketsPage({ data, admin, save, flash, refresh }){
  // 다시 들어오면 지난 조회 결과로 바로 그리고, 새 조회가 끝나면 바뀐 경우에만 다시 그린다(관리자는 늘 새 결과만).
  const seenRows=useRef(admin?undefined:peekRead("brackets"));
  const [normalizedBrackets,setNormalizedBrackets]=useState(()=>(seenRows.current||[]).map(row=>row.bracket));
  const [normalizedLoadError,setNormalizedLoadError]=useState("");
  const [normalizedInitialReady,setNormalizedInitialReady]=useState(Boolean(seenRows.current));
  const loadNormalized=async({initial=false}={})=>{
    try{
      const rows=await freshRead("brackets",listNormalizedBracketRuntimes);
      if(rows!==seenRows.current){ seenRows.current=rows; setNormalizedBrackets(rows.map(row=>row.bracket)); }
      setNormalizedLoadError("");
      return rows;
    }catch(error){
      setNormalizedLoadError(readErrorText(error,"잠시 뒤 다시 시도해 주세요."));
      return [];
    }finally{
      if(initial) setNormalizedInitialReady(true);
    }
  };
  useEffect(()=>{ void loadNormalized({initial:true}); },[]);
  // A deep link is consumed once; afterwards ?eventId= only mirrors the open bracket.
  const requestedEventIdRef=useRef(new URLSearchParams(window.location.search).get("eventId"));
  // Active Event-linked brackets are normalized-only. Completed pre-normalized
  // graphs without an Event id are a separate, display-only historical source.
  const list=normalizedInitialReady
    ? buildBracketPageList(normalizedBrackets,data?.brackets||[])
    : [];
  const [openId,setOpenId]=useState(null);
  const [wizard,setWizard]=useState(false);
  const [apply,setApply]=useState(null);
  const [qr,setQr]=useState(null);
  const [drawId,setDrawId]=useState(null);
  const [deletingId,setDeletingId]=useState(null);
  const deletingRef=useRef(false);
  const open=list.find(b=>b.id===openId);
  useItemTitle(open?.name);
  // 관람 중인 진행 대진표는 화면이 보이는 동안 15초마다 그 대회의 경기만 확인하고, 달라졌을 때 전체를 다시 읽는다.
  // 경기 밖의 변화(기록 반영)는 2분마다의 전체 조회가 따라잡는다.
  // 운영자도 같다(2026-11-22): 대회 날 두 사람이 나눠 입력하면 서로의 입력을 자기가 쓰기 전까지 보지 못하고 낡은 판을 눌렀다.
  // 자기 쓰기 뒤에는 이미 다시 읽으므로, 이 확인은 다른 사람(다른 운영자, 사이트 배틀)이 넣은 결과를 따라잡는 몫이다. 추첨 중에는 읽지 않는다.
  const liveEventId=!drawId&&open?.status==="active"&&open?.projection?.source==="normalized"?open.eventId:null;
  const liveRuntimeId=open?.projection?.runtimeId||null;
  useEffect(()=>{
    if(!liveEventId) return undefined;
    let busy=false, stamp=null, sameTicks=0;
    const tick=async()=>{
      if(busy||document.visibilityState!=="visible") return;
      busy=true;
      try{
        const next=await readBracketMatchStamp(liveEventId);
        if(next===stamp&&++sameTicks<8) return;
        stamp=next; sameTicks=0;
        const loaded=await fetchNormalizedSingleBracketRuntime(liveEventId,liveRuntimeId);
        if(loaded?.bracket) setNormalizedBrackets(prev=>prev.map(b=>b.eventId===liveEventId&&JSON.stringify(b)!==JSON.stringify(loaded.bracket)?loaded.bracket:b));
      }catch{ /* 다음 차례에 다시 읽는다 */ }
      finally{ busy=false; }
    };
    const iv=setInterval(tick,15000);
    const onVisible=()=>{ if(document.visibilityState==="visible") void tick(); };
    document.addEventListener("visibilitychange",onVisible);
    return ()=>{ clearInterval(iv); document.removeEventListener("visibilitychange",onVisible); };
  },[liveEventId,liveRuntimeId]);
  useEffect(()=>{
    if(!requestedEventIdRef.current) return;
    const target=list.find(b=>b.eventId===requestedEventIdRef.current);
    if(!target) return;
    requestedEventIdRef.current=null;
    openingRef.current=target.id;
    setOpenId(target.id);
  },[normalizedInitialReady,normalizedBrackets.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // Keep ?eventId= in step with the open bracket, so refresh and shared links
  // match the screen and a closed bracket does not reopen.
  /* the bracket a link asked for is set open in the same commit this runs in: until it stands, the address keeps its ?eventId=
     (2026-11-16: it was taken off for one render, so the entry under a sheet opened from the link kept no eventId) */
  const openingRef=useRef(null);
  useEffect(()=>{
    if(!normalizedInitialReady) return;
    if(openingRef.current&&!open) return;
    openingRef.current=null;
    const url=new URL(window.location.href);
    if(open?.eventId) url.searchParams.set("eventId",open.eventId); else url.searchParams.delete("eventId");
    if(url.href!==window.location.href) window.history.replaceState(window.history.state,"",url);
  },[open?.eventId,normalizedInitialReady]);
  // Opening a bracket is a history entry, so the phone's back button returns
  // to the list instead of leaving the bracket page.
  const openBracket=(b)=>{
    const url=new URL(window.location.href);
    if(b.eventId) url.searchParams.set("eventId",b.eventId); else url.searchParams.delete("eventId");
    pushHistory({...window.history.state,bracketId:b.id},url);
    transition(()=>flushSync(()=>setOpenId(b.id)),{shared:"b-"+b.id});
  };
  const closeBracket=()=>{
    setDrawId(null);
    if(window.history.state?.bracketId) backWith(open?"b-"+open.id:null);
    else transition(()=>flushSync(()=>setOpenId(null)),{shared:open?"b-"+open.id:null,dir:"back"});
  };
  // Back and forward reach the open bracket through App's page transition, in the same render as the view.
  useEffect(()=>{
    const onPop=()=>{ setOpenId(window.history.state?.bracketId||null); setDrawId(null); };
    popHandlers.add(onPop);
    return ()=>{ popHandlers.delete(onPop); };
  },[]);
  const create=async(b)=>{
    const normalizedCandidate=Boolean(
      b.eventId&&(b.mode==="single"||(b.mode==="team"&&b.format==="elim"))
    );
    if(!normalizedCandidate){
      flash("공식 대진표는 대회를 선택한 뒤 만들 수 있습니다.");
      return false;
    }
    if(normalizedCandidate){
      if(b.eventId&&list.some(existing=>existing.eventId===b.eventId)){
        flash("이 대회에 연결된 대진표가 이미 있습니다.");
        return false;
      }

      // Individual registration, slots and formed matches are saved together.
      // The existing team confirmation and runtime path stays separate.
      if(b.mode==="single"){
      try{
        const attempt=b.normalizedAttempt||buildNormalizedSingleCreateAttempt(b.participants||[]);
        await createIndividualBracketDraw({eventId:b.eventId,attempt,
          topology:b.format==="group"?GROUP_TOPOLOGY:b.double?"double_elimination":"single_elimination",
          groupPlan:b.plan,advance:b.groupCfg?.adv,finalFormat:b.groupCfg?.finalFormat,rookiePlayers:b.rookiePlayers,
        });
        // the bracket's rules go in right after it is made, before any result (third_place_best_of.sql); failing, it stays one game, no third place
        if(b.rules) await setBracketRules({runtimeId:attempt.runtimeId,eventId:b.eventId,...b.rules})
          .catch(error=>flash(`대진표는 만들었지만 3위 결정전과 선승 규칙은 저장하지 못했습니다. ${error?.message||""}`.trim()));
        const loaded=await fetchNormalizedSingleBracketRuntime(b.eventId,attempt.runtimeId);
        if(!loaded) throw new Error("만든 대진표를 다시 불러오지 못했습니다.");
        const presentation=beginNormalizedBracketDraw(loaded.bracket);
        setNormalizedBrackets(previous=>[
          ...previous.filter(row=>row.eventId!==b.eventId),
          presentation.bracket,
        ]);
        setOpenId(presentation.openId);
        setDrawId(presentation.drawId);
        flash("대진표를 만들었습니다.");
        return true;
      }catch(error){
        await loadNormalized();
        flash(`대진표를 만들지 못했습니다. ${error?.message||"잠시 뒤 다시 시도해 주세요."}`);
        return false;
      }
      }

      let confirmation=null;
      let createdRuntime=false;
      let runtimeId=null;
      try{
        confirmation=await confirmEventTeamsForBracket(b.eventId,b.participants||[]);
        const confirmedParticipants=confirmation.participants||[];
        const identityChangeByEntryParticipantId=new Map((confirmation.identityChanges||[]).map(change=>[change.entryParticipantId,change]));
        const withChange=(member, base)=>{
          const change=identityChangeByEntryParticipantId.get(member.entryParticipantId)||{};
          return {
            ...base,
            player_was_created:Boolean(change.playerWasCreated),
            registration_was_created:Boolean(change.registrationWasCreated),
            registration_player_was_changed:Boolean(change.registrationPlayerWasLinked),
            previous_registration_player_id:change.previousRegistrationPlayerId||null,
            entry_was_created:Boolean(change.entryWasCreated),
            entry_participant_was_created:true,
          };
        };
        const runtimeParticipants=confirmedParticipants.flatMap(team=>(team.memberIdentities||[]).map(member=>({
              ...withChange(member,{
                participant_key:`${team.id}:${member.entryParticipantId}`,
                display_name:team.name,
                entry_type:"team",
                player_id:member.playerId,
                registration_id:member.registrationId,
                entry_id:team.entryId,
                entry_participant_id:member.entryParticipantId,
                member_order:member.memberOrder,
                role:member.role,
              }),
            })));
        const attempt=buildNormalizedRuntimeCreateAttempt(confirmedParticipants,{plan:b.plan||null});
        runtimeId=attempt.runtimeId;
        await createNormalizedBracketRuntime({
          runtimeId:attempt.runtimeId,
          eventId:b.eventId,
          topologyKind:b.double?"double_elimination":"single_elimination",
          participants:runtimeParticipants,
          slots:attempt.slots,
        });
        createdRuntime=true;
        let loaded=await fetchNormalizedBracketRuntime(b.eventId,attempt.runtimeId);
        if(!loaded) throw new Error("만든 대진표를 다시 불러오지 못했습니다.");
        await syncNormalizedBracketMatches(b.eventId,loaded.bracket);
        loaded=await fetchNormalizedBracketRuntime(b.eventId,attempt.runtimeId);
        if(!loaded) throw new Error("경기를 만든 뒤 대진표를 다시 불러오지 못했습니다.");
        const presentation=beginNormalizedBracketDraw(loaded.bracket);
        setNormalizedBrackets(previous=>[
          ...previous.filter(row=>row.eventId!==b.eventId),
          presentation.bracket,
        ]);
        setOpenId(presentation.openId);
        setDrawId(presentation.drawId);
        flash("대진표를 만들었습니다.");
        return true;
      }catch(error){
        let cleanupError=null;
        if(createdRuntime){
          try{ await deleteNormalizedBracketRuntime({runtimeId,eventId:b.eventId}); }
          catch(runtimeError){ cleanupError=runtimeError; }
        }
        if(confirmation&&!cleanupError&&!createdRuntime){
          try{ await rollbackEventParticipantIdentityChanges(b.eventId,confirmation.identityChanges); }
          catch(rollbackError){ cleanupError=rollbackError; }
        }
        await refresh?.();
        await loadNormalized();
        flash(cleanupError
          ? `대진표를 만들지 못했고 참가 확정도 되돌리지 못했습니다. ${error?.message||"원인을 확인하지 못했습니다."} / ${cleanupError?.message||"원인을 확인하지 못했습니다."}`
          : `대진표를 만들지 못해 참가 확정을 되돌렸습니다. ${error?.message||"원인을 확인하지 못했습니다."}`);
        return false;
      }
    }
  };
  const del=async(b)=>{
    if(b.readOnly){ flash("이미 끝난 과거 대진표는 볼 수만 있습니다."); return; }
    if(b.applied){siteAlert("기록 반영을 먼저 취소해 주세요.","기록 반영 취소 후 대진표를 삭제할 수 있습니다.");return;}
    if(deletingRef.current)return;
    /* a bracket with results in it loses them all, and the draw: its name is typed to delete it (2026-11-22), one with none asks once */
    const decided=(b.graph?collectGraphMatches(b.graph):[]).concat((b.groups||[]).flatMap(pool=>[...(pool.matches||[]),...(pool.playoffs||[])])).filter(m=>m?.winner).length;
    if(decided){
      const typed=await sitePrompt({title:"대진표 삭제",body:`‘${b.name}’ 대진표에는 결과가 들어간 경기가 ${decided}개 있습니다. 지우면 추첨과 모든 결과가 사라지고 되돌릴 수 없습니다. 지우려면 대회 이름을 그대로 입력해 주세요.`,label:"대회 이름",placeholder:b.name,confirmLabel:"삭제"});
      if(typed==null)return;
      if(String(typed).trim()!==String(b.name).trim()){ siteAlert("대회 이름이 다릅니다.","대진표를 지우지 않았습니다."); return; }
    }else if(!(await siteConfirm({title:"대진표 삭제",body:`‘${b.name}’ 대회를 삭제할까요?`,confirmLabel:"삭제",danger:true})))return;
    if(deletingRef.current)return;
    deletingRef.current=true;
    setDeletingId(b.id);

    try{

      if(b.projection?.source==="normalized"){
        try{
          const deleteRuntime=b.mode==="single"&&b.projection?.topology==="single_elimination"
            ? deleteNormalizedSingleBracketRuntime
            : deleteNormalizedBracketRuntime;
          await deleteRuntime({
            runtimeId:b.projection.runtimeId,
            eventId:b.eventId,
          });
          setNormalizedBrackets(previous=>previous.filter(row=>row.eventId!==b.eventId));
          closeBracket();
          flash("대진표를 삭제했습니다.");
        }catch(error){
          const rows=await loadNormalized();
          const runtimeStillExists=(rows||[]).some(row=>
            row?.bracket?.eventId===b.eventId
            && row?.bracket?.projection?.runtimeId===b.projection?.runtimeId
          );
          if(!runtimeStillExists){
            closeBracket();
            flash("대진표를 삭제했습니다.");
          }else{
            flash(`대진표를 삭제하지 못했습니다. ${error?.message||"잠시 뒤 다시 시도해 주세요."}`);
          }
        }
        return;
      }

      flash("과거 대진표는 진행할 수 없습니다.");
    }finally{
      deletingRef.current=false;
      setDeletingId(null);
    }
  };
  // 공식과 사설은 한 화면의 두 탭(?tab=private). 사설 탭은 공식 대진표의 상태와 저장을 전혀 쓰지 않는다.
  const [tab,setTab]=useState(()=>new URLSearchParams(window.location.search).get("tab")==="private"?"private":"official");
  // the list comes from the server after the page stands: it lights the moment it arrives
  const listArrived=useArrival(normalizedInitialReady);
  const changeTab=t=>{ setTab(t); const url=new URL(window.location.href); if(t==="private")url.searchParams.set("tab","private"); else url.searchParams.delete("tab"); url.searchParams.delete("pb"); window.history.replaceState(window.history.state,"",url); };
  const tabsEl=()=><div className="bk-tabs"><TabsLine value={tab} onChange={changeTab} label="대진표 종류" options={[["official","공식"],["private","사설"]]}/></div>;
  if(tab==="private"&&!open) return <PrivateBrackets admin={admin} flash={flash} tabs={tabsEl()}/>;
  const bracketFormat=(b)=>b.format==="group"?"조별예선과 본선":(b.double?"더블 엘리미네이션":"싱글 엘리미네이션");
  const winnerOf=(b)=>{ const r=b.format==="group"?(b.knockout?elimResult(b.knockout):null):elimResult(b.graph); return r?.done?(b.participants||[]).find(p=>p.id===r.champ)?.name||"":""; };
  const statusTag=(b)=>{ const r=b.format==="group"?(b.knockout?elimResult(b.knockout):null):elimResult(b.graph); if(b.applied||(r&&r.done))return admin?(b.applied?"기록 반영됨":"기록 반영 전"):"종료"; return"진행 중"; };
  const lineOf=(b)=>[`${(b.participants||[]).length}${b.mode==="team"?"팀":"명"}`, b.mode==="team"?"팀전":"", bracketFormat(b), statusTag(b)!=="진행 중"&&winnerOf(b)?`우승 ${winnerOf(b)}`:""].filter(Boolean).join(", ");
  return (<section className="bk">
    {!open&&!wizard&&<header className="bk-head">
      <h1 className="page-title">대진표</h1>
      {admin&&<Button variant="link" disabled={!!deletingId} onClick={()=>transition(()=>flushSync(()=>setWizard(true)))}>새 대진표</Button>}
    </header>}
    {!open&&!wizard&&normalizedLoadError&&<ErrorNote action="다시 불러오기" onRetry={()=>void loadNormalized({initial:true})}>대진표를 불러오지 못했습니다. {normalizedLoadError}</ErrorNote>}
    {!open&&!wizard&&tabsEl()}
    {!open&&!wizard&&<div className="bk-list" ref={listArrived}>
      {!normalizedInitialReady
        ? <Loader/>
        : list.length===0&&!normalizedLoadError&&<Empty title="아직 만들어진 대진표가 없습니다."/>}
      {list.length>0&&<div className="stack bk-rows">{list.map((b,i)=><BracketRow key={b.id} b={b} lead={i===0} vt={"b-"+b.id} live={statusTag(b)==="진행 중"}
        line={lineOf(b)} end={admin&&statusTag(b)!=="진행 중"?statusTag(b):null} onOpen={()=>openBracket(b)} href={b.eventId?viewHref("bracket",{eventId:b.eventId}):undefined}/>)}</div>}
    </div>}
    {open&&!wizard&&(()=>{ const openRes=open.format==="group"?(open.knockout?elimResult(open.knockout):null):elimResult(open.graph);
      const openName=pid=>{ const p=(open.participants||[]).find(x=>x.id===pid); return p?p.name:pid; };
      return <div className="bk-open">
      <header className="bk-head-open">
        <BackLink to="대진표" onClick={deletingId===open.id?undefined:closeBracket}/>
        <div className="bk-open-row">
          <div className="bk-open-copy">
            <h1 className="t32 bk-open-title" data-vt={"b-"+open.id}>{open.name}</h1>
            <p className="t12 dim reg bk-open-line">{open.mode==="team"?"팀전":"개인전"}, {bracketFormat(open)}, {(open.participants||[]).length}{open.mode==="team"?"팀":"명"}{open.createdAt?`, ${formatDate(open.createdAt)}`:""}{admin&&statusTag(open)!=="진행 중"?`, ${statusTag(open)}`:""}</p>
          </div>
          {/* desktop: the images stand beside the title; a phone keeps them under the result */}
          {/* 링크 공유 (2026-11-22): the home-screen app has no address bar, and a bracket is what players pass around on the day */}
          <div className="stack bk-tools">
            {open.eventId&&<Button variant="second" size="sm" onClick={async()=>{ const r=await shareLink({view:"bracket",eventId:open.eventId},open.name); if(r==="copied")flash("주소를 복사했습니다."); }}>링크 공유</Button>}
            {open.eventId&&<Button variant="second" size="sm" onClick={()=>setQr({name:open.name,url:communityUrl({view:"bracket",eventId:open.eventId})})}>QR</Button>}
            {openRes?.done&&<Button variant="second" size="sm" onClick={()=>downloadChampionPng(open,openRes,openName)}>우승 이미지</Button>}
            {openRes?.done&&<Button variant="second" size="sm" onClick={()=>downloadBracketPng(open,openName)}>대진표 이미지</Button>}
          </div>
        </div>
        {statusTag(open)==="진행 중"&&<p className="pn bk-strip t12"><Status live>진행 중</Status>{liveProgress(open)&&<span className="dim">{liveProgress(open)}</span>}</p>}
        {/* a phone: the share key under the head, the desktop keeps it among the tools beside the title */}
        <MyMatchKey b={open} main className="bk-mine-phone"/>
        {open.eventId&&<div className="stack bk-actions bk-share"><Button variant="second" onClick={async()=>{ const r=await shareLink({view:"bracket",eventId:open.eventId},open.name); if(r==="copied")flash("주소를 복사했습니다."); }}>링크 공유</Button><Button variant="second" onClick={()=>setQr({name:open.name,url:communityUrl({view:"bracket",eventId:open.eventId})})}>QR</Button></div>}
      </header>
       {drawId===open.id ? <BracketDraw b={open} onDone={()=>setDrawId(completeNormalizedBracketDraw())}/> : <BracketBoard b={open} admin={admin} flash={flash} readOnly={open.readOnly} refreshNormalized={loadNormalized} onNormalizedReverted={loadNormalized} data={data} save={save} deleting={deletingId===open.id} onApply={(b,res,opts)=>setApply({b,res,...opts})}/>}
      {/* a delete that cannot be undone stands last, after everything the bracket shows */}
      {/* only while it can act: a recorded bracket is undone first, from 반영 취소 in its operators' block (2026-11-24) */}
      {!open.readOnly&&admin&&!open.applied&&<div className="stack bk-actions bk-delete"><Button variant="second" loading={deletingId===open.id} onClick={()=>del(open)}>삭제</Button></div>}
    </div>; })()}
    {wizard&&<BracketWizard data={data} onClose={()=>transition(()=>flushSync(()=>setWizard(false)),{dir:"back"})} onCreate={create}/>}
     {qr&&<QrSheet name={qr.name} url={qr.url} onClose={()=>setQr(null)}/>}
     {apply&&<BracketApply b={apply.b} res={apply.res} titlesOnly={Boolean(apply.titlesOnly)} data={data} save={save} flash={flash} refresh={refresh} onNormalizedApplied={loadNormalized} onClose={()=>{setApply(null);void loadNormalized();}}/>}
  </section>);
}

