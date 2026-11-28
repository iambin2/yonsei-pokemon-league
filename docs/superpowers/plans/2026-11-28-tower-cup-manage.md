# 등반전 수정·삭제 및 게스트 경계 조건 수정 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 등반전 개최자가 이미 열린 등반전을 수정하거나 삭제할 수 있게 하고, 시작 전 게스트 도전 차단 및 마감된 `guestCup` 상태 정리를 함께 반영한다.

**Architecture:**
- **DB (`docs/db/tower_cups_manage.sql`)**: `tower_cup_update`, `tower_cup_delete` RPC를 추가하고, `streak_begin_guest`가 `starts_at > now()`인 등반전 시작을 거절하도록 갱신한다. 삭제 시 게스트 `streak_runs`에 연결된 `battles`를 먼저 정리해 `battles_run_kind` 제약을 위반하지 않도록 한다.
- **Frontend (`visitorAuth.js`, `Cups.jsx`, `Streak.jsx`)**: `CupMake`를 열기/수정 공용 모달로 확장하고, `CupBoard`에 `수정`·`삭제` 버튼을 추가한다. 비승인 게스트에게는 시작 전 등반전의 `도전하기`를 `시작 전`으로 비활성화하고, 마감되거나 삭제된 등반전은 `guestCup` 상태에서 자동 정리한다.

**Tech Stack:** PostgreSQL (Supabase RPC + PGlite), React 18, Vite

---

## Global Constraints
- 모든 한국어 문구는 합니다체, 가운뎃점(`·`) 및 느낌표(`!`) 없이 작성한다.
- `DESIGN.md`와 `tests/designLaw.test.mjs`를 준수한다.

---

### Task 1: `docs/db/tower_cups_manage.sql` 및 `scripts/verify-tower-cups-db.mjs` 작성
- [ ] `tower_cup_update`, `tower_cup_delete`, `streak_begin_guest`(시작 전 거절 포함) 작성
- [ ] `scripts/verify-tower-cups-db.mjs`에 수정·삭제·게스트 배틀 포함 삭제·시작 전 게스트 거절 테스트 추가

### Task 2: 프론트엔드(`visitorAuth.js`, `Cups.jsx`, `Streak.jsx`) 반영
- [ ] `updateTowerCup`, `deleteTowerCup` 추가
- [ ] `CupMake` 수정 모드 및 `CupBoard` 수정·삭제 버튼 추가, 시작 전 게스트 `시작 전` 표시
- [ ] `Streak.jsx`에서 마감/삭제된 `guestCup` 자동 정리

### Task 3: 전체 검증
- [ ] `node scripts/class-coverage.mjs`, `npm test`, `npm run verify:db`, `npm run build` 통과 확인
