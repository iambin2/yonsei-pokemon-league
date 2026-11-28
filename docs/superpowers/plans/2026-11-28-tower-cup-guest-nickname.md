# 도전의 탑 등반전 닉네임(비로그인) 참가 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 도전의 탑 등반전(`tower_cups`)에 한해 구글 계정 연동 없이 사용자가 직접 입력한 닉네임으로 참가하고 등반전을 플레이할 수 있도록 한다.

**Architecture:**
- **DB (`docs/db/tower_cups_guest.sql`)**: `tower_cup_players`, `tower_cup_runs`, `streak_runs`의 `auth_user_id`를 nullable로 완화하고, 게스트 참가자 식별을 위한 `player_key` / `guest_token_hash` / `cup_id`를 추가한다. 게스트 참가 RPC(`tower_cup_join_guest`)와 게스트 등반 RPC(`streak_begin_guest`, `streak_active_run_guest`)를 추가하며, 월간 순위(`streak_board`)와 월간 상위(`streak_month_tops`)는 `auth_user_id is not null`로 한정해 게스트 기록이 월간 순위에 섞이지 않게 한다.
- **Edge Function (`supabase/functions/battle/index.ts`)**: `streak`, `streakResume`, `streakDraft` 액션이 승인된 Google 계정이 없을 때도 `cupId` + `guestToken`이 전달되면 게스트 등반 RPC로 동작하도록 분기한다.
- **Frontend (`visitorAuth.js`, `Cups.jsx`, `Streak.jsx`)**: 비승인/비로그인 방문자가 등반전 `참가`를 누르면 구글 로그인 대신 닉네임(코드방이면 4자리 코드 포함) 입력 모달을 띄우고, 기기별 `guestToken`으로 참가 및 `도전하기` 등반을 진행한다.

**Tech Stack:** PostgreSQL (Supabase RPC + PGlite), Deno Edge Function (`@pkmn/sim`), React 18, Vite

---

## Global Constraints
- **한국어 규칙**: 모든 UI 문구·에러 메시지·커밋 메시지는 한국어(합니다체, 가운뎃점 `·` 및 느낌표 `!` 금지)로 작성한다.
- **디자인 법칙**: `DESIGN.md` 및 `tests/designLaw.test.mjs`를 준수하며, 기존 `Modal`, `Question`, `Button`, `BackLink` 컴포넌트를 그대로 사용한다.
- **기능 분리**: 월간 도전의 탑(`streak_board`) 및 공식 대회 데이터에는 게스트 기록이 절대 섞이지 않는다.
- **하위 호환성**: DB SQL 적용 전에도 기존 화면이 깨지지 않도록 하고, `npm test`, `npm run verify:db`, `npm run build`가 모두 통과해야 한다.

## Review Focus
1. **게스트 기록의 월간 순위 격리**: 게스트가 등반전에서 연승을 쌓아도 `streak_board`와 `streak_month_tops`, `tower_archive`에 절대 나타나지 않아야 한다.
2. **코드 등반전 접근 제어**: 코드 등반전에 게스트가 잘못된 코드로 참가하려 하면 거절되고, 참가한 뒤에는 `tower_cups` 목록과 `tower_cup_board`에서 본인 줄(`mine`)과 코드를 볼 수 있어야 한다.
3. **동일 등반전 내 닉네임 중복 및 공백 검증**: 공백/20자 초과 닉네임과 같은 등반전 내 중복 닉네임은 DB에서 거절되어야 한다.
4. **반영 횟수(`run_limit`) 및 마감 시간 준수**: 마감된 등반전이나 반영 횟수를 모두 채운 게스트의 새 도전 시작(`streak_begin_guest`)은 거절되어야 한다.
5. **구글 로그인은 되어 있으나 이름 미승인(`pending`/`rejected`)인 방문자**: `!approved` 상태이므로 등반전에 닉네임으로 참가해 `cupId + guestToken` 경로로 등반할 수 있어야 한다.

---

### Task 1: DB 스키마 및 게스트 등반전 RPC 추가 (`docs/db/tower_cups_guest.sql`)

**Files:**
- Create: `docs/db/tower_cups_guest.sql`
- Modify: `scripts/verify-tower-cups-db.mjs`

**Interfaces:**
- Produces:
  - `public.tower_cup_join_guest(p_id uuid, p_nickname text, p_code text default null, p_guest_token text default null) -> jsonb`
  - `public.tower_cups(p_guest_token text default null)`
  - `public.tower_cup_board(p_id uuid, p_guest_token text default null)`
  - `public.streak_begin_guest(p_cup_id uuid, p_guest_token text, p_format_id text, p_offer jsonb) -> jsonb`
  - `public.streak_active_run_guest(p_cup_id uuid, p_guest_token text) -> jsonb`

- [ ] **Step 1: `docs/db/tower_cups_guest.sql` 작성**
  - `streak_runs`에 `cup_id`, `guest_token_hash` 추가 및 `auth_user_id` nullable 전환, 게스트 활성 도전 유니크 인덱스 추가.
  - `tower_cup_players`, `tower_cup_runs`에 `player_key` 추가 및 `auth_user_id` nullable 전환.
  - `tower_cup_enter`, `tower_cup_climb` 트리거가 `auth_user_id` 경로와 `cup_id + guest_token_hash` 경로를 모두 처리하도록 갱신.
  - `tower_cup_join_guest`, `streak_begin_guest`, `streak_active_run_guest` 생성 및 `tower_cups`, `tower_cup_board`, `tower_cup_create`, `tower_cup_join`, `streak_board` 갱신.
- [ ] **Step 2: `scripts/verify-tower-cups-db.mjs`에 게스트 등반전 검증 케이스 추가**
  - 게스트 참가(공개/코드), 중복 닉네임 거절, `streak_begin_guest`로 등반 시작 및 연승 반영, `run_limit` 초과 거절, `streak_board` 격리, 멱등성(2회 실행) 검증.
- [ ] **Step 3: `npm run verify:db` 실행 및 통과 확인**

---

### Task 2: `battle` Edge Function 게스트 등반 지원

**Files:**
- Modify: `supabase/functions/battle/index.ts`

**Interfaces:**
- Consumes: `streak_begin_guest`, `streak_active_run_guest` RPCs from Task 1
- Produces: `streak`, `streakResume`, `streakDraft` actions accepting optional `cupId`, `guestToken` when no approved Google account is present

- [ ] **Step 1: `supabase/functions/battle/index.ts`의 `streak`, `streakResume`, `streakDraft` 수정**
  - 승인된 Google 계정(`user` + `streak_trainer_name`)이 있으면 기존 경로 유지.
  - 없고 `cupId` + `guestToken`이 있으면 `streak_begin_guest` / `streak_active_run_guest` 호출.
- [ ] **Step 2: `npm run build:battle` 여부 확인 및 Edge Function 구문/빌드 검증**

---

### Task 3: 프론트엔드 서비스 및 등반전 UI 수정

**Files:**
- Modify: `src/services/visitorAuth.js`
- Modify: `src/pages/battle/Cups.jsx`
- Modify: `src/pages/battle/Streak.jsx`

**Interfaces:**
- Consumes: `tower_cup_join_guest`, `tower_cups(p_guest_token)`, `tower_cup_board(p_id, p_guest_token)` and Edge Function `cupId`/`guestToken` payload
- Produces: `CupGuestJoin` modal in `Cups.jsx` and guest cup climbing flow in `Streak.jsx`

- [ ] **Step 1: `src/services/visitorAuth.js`에 게스트 토큰 관리 및 `joinTowerCupGuest`, `readTowerCups`/`readTowerCup` 게스트 토큰 전달, `startStreakRun`/`pickStreakDraft`/`resumeStreakRun`의 `cupId` 지원 추가**
- [ ] **Step 2: `src/pages/battle/Cups.jsx`에 `CupGuestJoin` 모달 추가 및 `!approved` 참가 흐름 연결, `onClimb` 시 컵 정보 전달**
- [ ] **Step 3: `src/pages/battle/Streak.jsx`에 `guestCup` 상태 관리 및 비로그인 등반전 도전/재개/드래프트/다시 도전 흐름 연결**

---

### Task 4: 전체 검증 (`verification-before-completion`)

- [ ] **Step 1: `node scripts/class-coverage.mjs` 확인**
- [ ] **Step 2: `npm test` 실행 및 전체 통과 확인**
- [ ] **Step 3: `npm run verify:db` 실행 및 전체 통과 확인**
- [ ] **Step 4: `npm run build` 실행 및 경고/오류 없이 빌드 성공 확인**
