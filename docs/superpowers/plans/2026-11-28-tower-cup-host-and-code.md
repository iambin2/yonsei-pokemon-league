# 등반전 개최자 닉네임, 코드방 목록 노출 및 4자리 코드 강제 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 등반전 개최자도 실명 대신 원하는 닉네임을 설정할 수 있게 하고, 코드 등반전도 목록에 노출하되 참가 시 코드를 요구하며, 코드는 항상 4자리(`1000`~`9999`)로 생성·표시되도록 한다.

**Architecture:**
- **DB (`docs/db/tower_cups_host_and_code.sql`)**: `tower_cup_create`·`tower_cup_update`에 `p_nickname`을 추가해 `host_name` 및 개최자 참가자 이름에 반영하고, 코드를 `1000`~`9999` 범위로 생성하며, `tower_cups` 목록에서 `room = 'code'` 필터를 제거한다.
- **Frontend (`Fig.jsx`, `Board.jsx`, `visitorAuth.js`, `Cups.jsx`, `Streak.jsx`)**: `Fig`/`Counter`에 `keepZero` 옵션을 추가해 코드 앞자리 `0`이 생략되지 않게 하고, `CupMake`에 개최자 닉네임 입력란을 추가하며, `CupList`에 코드방 표시를 더한다.

**Tech Stack:** PostgreSQL (Supabase RPC + PGlite), React 18, Vite

---

### Task 1: `docs/db/tower_cups_host_and_code.sql` 작성 및 `verify-tower-cups-db.mjs` 갱신
- [ ] `tower_cup_create`, `tower_cup_update`, `tower_cups` 갱신
- [ ] `verify-tower-cups-db.mjs`로 개최자 닉네임, 코드방 목록 노출, 4자리(`1000`~`9999`) 코드 생성 검증

### Task 2: 프론트엔드(`Fig.jsx`, `Board.jsx`, `visitorAuth.js`, `Cups.jsx`, `Streak.jsx`) 수정
- [ ] `Fig`/`Counter` `keepZero` 지원 및 `CupBoard` 코드 카운터 적용
- [ ] `CupMake` 닉네임 입력란 및 `CupList` 코드방 표기 추가

### Task 3: 전체 검증
- [ ] `node scripts/class-coverage.mjs`, `npm test`, `npm run verify:db`, `npm run build` 통과 확인
