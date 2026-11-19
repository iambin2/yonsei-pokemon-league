# 등반전 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 기간과 참가자가 있는 도전의 탑 순위(등반전)와 그 전광판, 1위 경신 알림.

**Architecture:** 평소 도전(`streak_runs`)을 트리거로 세는 세 표와 RPC 다섯. 배틀 함수는 그대로. 화면은 도전의 탑 탭 옆 칸의 목록과 만들기 시트, `&cup=` 전광판.

**Tech Stack:** Postgres(Supabase), PGlite 확인 스크립트, React 18.

**Spec:** docs/BATTLE_STREAK.md 18장, DESIGN.md "Battle" 등반전.

## Global Constraints
- 문구: 합니다체, 명사 라벨, 느낌표, 가운뎃점, 엠대시 없음. 설명 문장 없음(Composing a screen 22).
- 토큰과 Board 부품만. `tests/designLaw.test.mjs` 통과.
- 실패로 닫는다: 승인되지 않은 계정, 틀린 코드, 끝난 등반전은 거절.

## Review Focus
- 마감 뒤 이긴 판이 순위를 바꾼다 → 바꾸지 않아야 한다 (Task 1 확인).
- 들어가기 전에 시작한 도전이 세진다 → 세지 않는다 (Task 1).
- 반영 횟수를 넘은 도전이 세진다 → 세지 않는다 (Task 1).
- 같은 연승의 알림이 두 번 → 한 번 (Task 1).
- SQL 전의 사이트가 깨진다 → 등반전을 감춘다 (Task 2, `PGRST202`이면 null).

### Task 1: SQL과 확인
**Files:** Create `docs/db/tower_cups.sql`, `scripts/verify-tower-cups-db.mjs`.
- [ ] 확인 스크립트: 만들기(승인 계정만, 하나만), 공개 입장, 코드 입장(틀린 코드 거절), 기간 안의 도전만, 횟수, 마감 뒤 굳음, 동률 순서, 알림 한 번, 지금 마감, 익명은 표를 못 읽음, 두 번 실행.
- [ ] SQL을 써서 통과.

### Task 2: 서비스
**Files:** Modify `src/services/visitorAuth.js`: `readTowerCups()`, `readTowerCup(id)`, `createTowerCup({title, startsAt, endsAt, room, limit})`, `joinTowerCup(id, code)`, `closeTowerCup(id)`.

### Task 3: 화면
**Files:** Create `src/pages/battle/Cups.jsx`; Modify `src/pages/battle/Streak.jsx`, `src/pages/BattlePage.jsx`(cup 주소), `src/styles/streak.css`, DESIGN.md.
- [ ] 탭 옆 칸: 등반전 목록(행, 진행 중 램프), 등반전 만들기 키와 시트.
- [ ] 전광판(`&cup=`): 이름 32, 남은 시간, 순위(StandTable), 참가와 도전 키, 코드, 연 사람의 지금 마감. 15초마다 다시 읽음.
- [ ] 390과 1440, 두 테마.

### Task 4: 마무리
- [ ] `npm test`, `npm run build` 경고 없음, 커밋.
