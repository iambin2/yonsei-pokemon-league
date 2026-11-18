# 배틀과 도전의 탑을 게임으로: 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 배틀과 도전의 탑이 표가 아니라 게임으로 읽히게 한다: 무대가 주인공인 하나의 틀, 게임 문법의 HUD, 타격의 박자, 판의 의식, 장면 안에서 고르는 탑, 버벅임 없는 전환.

**Architecture:** 바뀌는 것은 화면뿐이다. 엔진(`@pkmn/sim`), 배틀 함수, DB, 컴퓨터(`battleCpu.js`)는 손대지 않는다. 먼저 법(DESIGN.md)과 측정 도구를 세우고, 그 위에 틀, HUD, 타격감, 의식, 탑의 순서로 쌓는다. 단계마다 시안을 사용자에게 보이고 글자로 고른 뒤 구현한다.

**Tech Stack:** React 18, 순수 CSS, WebGL2(`gl.js`, `arena.js`, `towerGL.js`), Web Animations(`motion.js`), Web Audio(`sfx.js`). 새 의존성 없음.

**Spec:** 2026-11-18 대화의 진단(이 문서 "진단 대응표"가 항목을 옮겨 적었다), `DESIGN.md` "Battle", `docs/BATTLE_STREAK.md`, `CLAUDE.md` "Working with the owner".

## Global Constraints

- 사용자 인터페이스만 바꾼다. 데이터 동작, 엔진의 판정, 배틀 함수의 응답 모양은 그대로다.
- 새 모양은 시안(스크린샷, 글자로 나눈 안, 추천 하나)부터다. 사용자가 글자로 고르기 전에는 구현하지 않는다.
- DESIGN.md를 먼저 고치고 코드를 고친다. 새 값이나 패턴을 코드에서 먼저 만들지 않는다.
- 모든 화면은 390과 1440, 두 테마에서 본다. 움직임은 녹화한 프레임으로, 배치는 잰 잉크로 판단한다.
- 성능 예산: 휴대폰 속도(CPU 4배 감속)에서 50 ms를 넘는 프레임 0개. 기준선은 리플레이 첫 12초에 20개, 가장 긴 것 817 ms.
- 움직임은 CSS와 Web Animations, transform과 opacity만. `prefers-reduced-motion`에서는 모든 새 연출이 멈춘 그림으로 선다.
- 고친 것은 일반 배틀과 도전의 탑, 싱글과 더블, 선수와 관전자와 리플레이 모두에 적용한다(같은 부품을 쓰는 곳 전부).
- 한국어 문구는 합니다체, 명사 라벨, 느낌표와 가운뎃점 없음. 쇼다운만의 말은 화면에 나오지 않는다.
- 원작과 맞춰야 하는 것(컷인, 타격, 소리)은 실제 영상을 찾아 비교한다. 내려받기는 이름, 출처, 크기를 말하고 먼저 묻는다.
- 커밋 메시지는 네 절(문제 인식, 사고 과정, 기획 방향성, 프롬프트). `npm test`와 `npm run build`가 경고 없이 통과해야 한다.
- 배포는 사용자가 "배포"라고 할 때만 한다.

## Review Focus

- **움직임 줄이기 설정:** 멈칫, 흔들림, 컷인, 카드 뒤집기가 꺼져도 결과(피해, 급소, 고른 카드)는 같은 순간에 읽혀야 한다. 2단계 측정 도구에 reduced 모드 한 번을 넣는다.
- **옛 판의 리플레이와 더블:** 새 HUD와 컷인이 더블(판 넷), 14장 이전 도전의 판, 턴이 100을 넘는 판에서 겹치거나 밀리지 않아야 한다. 4, 5단계 확인에 더블 리플레이 한 판과 긴 판 한 판을 넣는다.
- **관전자와 이어서 온 사람:** 중간에 들어온 화면은 컷인을 건너뛰고 지금 상태에 선다(따라잡기에서 연출을 재생하지 않는다). 5, 6단계 확인에 "턴 중간에 연 관전"을 넣는다.
- **느린 기기에서 누르기:** 연출 중에도 건너뛰기(무대 탭)가 먹어야 하고, 연출이 끝나기 전에 키가 눌려 잘못 보내지지 않아야 한다. 5단계에서 연출 중 탭을 CDP 터치로 확인한다.
- **라이트 테마의 무대 위 글자:** 컷인과 결과 카드의 글자가 밝은 테마에서 무대 위에 읽혀야 한다. 5, 6단계 스크린샷에 라이트를 넣는다.

## 진단 대응표

| 진단 | 단계 |
|---|---|
| 전광판 법이 게임 장면을 덮음 | 1 |
| 전환 버벅임(50 ms 초과 20개, 817 ms) | 2 (프레임), 3과 4와 6 (흐름, `docs/BATTLE_TRANSITIONS.md`) |
| 무대가 화면의 40%, 가로 띠 여덟, 400 폭 기록 칸, 틀이 상태마다 바뀜 | 3 |
| 이름 없는 머리 숫자, 배율 칩, HP 판과 포켓몬의 X자, 빽빽한 기술 키, 타수 스티커, 표 같은 기록, 고장 난 숫자 같은 대기 표시 | 4 |
| 멈칫, 흔들림, 잔상 HP 없음. 급소와 효과 굉장이 한 줄로 지나감. 문장 박자 없음 | 5 |
| 시작과 끝의 의식 없음, 동영상 플레이어 재생 막대, 끝이 나가기 버튼 하나 | 6 |
| 로비가 신청서, 선출 카드가 사양서 | 7 |
| 탑 꼭대기 잘림, 이름표 겹침, 축척, 1위 중복, 첫 키가 로그인, 웹 토글, 휴대폰에서 잘리는 내 도전 | 8 |
| 드래프트, 문, 판 사이가 모두 표. 한 박자에 결정 셋 | 9 |

---

### Task 0: 앞 작업 닫기

이 계획은 깨끗한 트리에서 시작한다.

- [ ] 샘플 정리 에이전트의 결과를 검토하고 합친다. `tests/towerBuild.test.mjs`의 편중 검사(상한 3.5배)를 다시 돌려 통과시키거나 15.7에 새 수치를 적는다.
- [ ] 데미지 도우미 시안(A 게이지만, C 상대 HP 판)의 사용자 선택을 받는다. 구현은 Task 4에서 한다.
- [ ] 게시판 파일 넷의 주인 모를 변경과 남은 stash를 사용자에게 확인받는다.
- [ ] `npm test`, `npm run build` 통과 뒤 사용자 말에 따라 커밋한다(도구 통째 세트, 메가 여럿, 한 칸씩 드래프트, 교환 표 A, 터치, 알림, 중계 틀).

### Task 1: 법을 고친다 (DESIGN.md)

**Files:**
- Modify: `DESIGN.md` "Battle" 첫 문단(게임 예외의 범위), The tower, The draft, The doors, the trades
- Modify: `tests/designLaw.test.mjs`의 제외 목록
- Create: `src/styles/tower-play.css` (`streak.css`에서 드래프트, 문, 판 사이, 교환 규칙을 옮긴다. `src/main.jsx`의 import 순서에 `streak.css` 다음으로 넣는다)
- Modify: `CLAUDE.md` "Product and design constraints"의 예외 문장과 CSS 파일 수(21에서 22)

**정하는 것:**
- 게임 예외는 "판에 들어간 뒤와 판 사이"까지다: 선출, 배틀, 끝, 드래프트, 문, 판 사이, 교환, 진입 장면. 탭의 첫 화면(탑 옆 칸, 순위, 기록), 시트, 다이얼로그, 토스트는 전광판 법 그대로다.
- 예외 안에서도 남는 것: 사이트의 색(토큰, 타입 색, 호박색은 살아 있는 것), 글꼴, 한국어 문구 규칙, 사각 모서리, 그러데이션과 원 없음(메가 문양만 예외).
- 예외 안에서 새로 허용하는 것: 무대 위 덮개(컷인, 결과 카드), 화면 흔들림, 카드 뒤집기, 빛과 입자. "날지 않고 켜진다"는 예외 밖의 법으로 남는다.

- [ ] **Step 1:** DESIGN.md 개정문을 쓴다(왜 넓히는지 사용자 말 인용: "실제 게임처럼 느껴지지 않고 엑셀처럼 느껴져", "기존 틀에서 완전히 벗어나 구조를 새로 쌓아도 돼").
- [ ] **Step 2:** 개정문을 사용자에게 보이고 승인받는다. 승인 전에는 다음 단계로 가지 않는다.
- [ ] **Step 3:** `streak.css`의 놀이 흐름 규칙을 `tower-play.css`로 옮기고(값은 그대로) `designLaw.test.mjs` 제외 목록에 넣는다.
- [ ] **Step 4:** `node tests/designLaw.test.mjs` 통과, 실험실 `swap.html`과 `draft.html`을 옮기기 전후로 찍어 픽셀이 같은지 본다(옮기기만 했으므로 차이 0).
- [ ] **Step 5:** 커밋.

### Task 2: 프레임 측정 도구와 기준선, 버벅임 원인 제거

**Files:**
- Create: `scripts/measure-frames.cjs` (스크래치의 `audit.cjs`를 저장소로: Playwright는 npx 캐시에서, `--use-angle=d3d11`, CPU 4배 감속, rAF 간격 기록)
- Create: `docs/BATTLE_FRAMES.md` (장면별 기준선과 바꿀 때마다의 표. `BATTLE_COMPUTER.md`의 실험 표와 같은 방식)
- Modify: 원인이 확인된 곳만 (`BattlePage.jsx`, `Stage.jsx`, `tower.js`, `towerGL.js`, `gl.js`)

**Interfaces:**
- Produces: `node scripts/measure-frames.cjs <scene> [--reduced] [--desktop]`. scene은 `replay-open`, `battle-open`(실험실 `?view=lab`), `tower-tab`, `tower-enter`, `between-games`, `end`. 출력은 한 줄: `frames N over34 N over50 N worst N sumLong N`. over50이 0이 아니면 종료 코드 1.

- [ ] **Step 1:** 도구를 쓰고 여섯 장면의 기준선을 `BATTLE_FRAMES.md`에 적는다(리플레이 열기는 지금 over50 20, worst 817).
- [ ] **Step 2:** 장면마다 Chrome 성능 추적(CDP `Tracing`)으로 긴 작업의 주인을 찾는다. 확인할 후보: 기록 한 줄마다 경기 전체 다시 그리기, 처음 보이는 그림의 디코드, GL 모델 생성(`buildModel`, `arena.js`), 칸 높이 바뀜으로 인한 레이아웃, 폰트 조각.
- [ ] **Step 3:** 확인된 원인만 하나씩 고치고, 고칠 때마다 다시 재서 표에 한 줄씩 적는다(실패한 시도도 적는다). 추측으로 고치지 않는다.
- [ ] **Step 4:** 여섯 장면 모두 over50 0. 보이는 것은 고치기 전과 같아야 한다(장면별 스크린샷 비교).
- [ ] **Step 5:** 커밋. 이후 모든 단계는 끝에 관련 장면을 이 도구로 잰다.

### Task 3: 하나의 틀과 하나의 전환 문법

**Files:**
- Modify: `src/pages/BattlePage.jsx` (`Arena`의 배치: `bt-main`, `bt-side`, `bt-deck`, 끝 화면 `bt-end`, `EndSets`)
- Modify: `src/styles/battle.css`, `src/styles/battle-stage.css`
- Modify: `DESIGN.md` "Battle"의 From 860, 휴대폰 배치, After the battle

**시안에서 고를 것(사용자):** 데스크톱의 기록과 파티를 (a) 무대 옆 서랍으로 접기, (b) 무대 아래 한 줄 띠로, (c) 지금처럼 400 칸을 두되 무대를 키우기. 휴대폰에서 가로 띠를 몇 개까지 줄일지(상대 줄과 내 줄을 무대 위 HUD로 올리는 안 포함).

**지켜야 할 것:**
- `docs/BATTLE_TRANSITIONS.md` 3장의 전환 문법 다섯 줄. 같은 문서 2장의 T1, T2, T3, T4, T8을 이 단계에서 닫는다.
- 선출, 진행, 끝, 관전, 리플레이가 같은 틀이다. 상태가 바뀌어도 무대의 자리와 크기가 1px도 움직이지 않는다.
- 끝 화면과 판 사이는 무대 위의 덮개이고, 아래 칸의 높이를 바꾸지 않는다.
- 휴대폰에서 무대가 화면 높이의 절반 이상이다(지금 844 가운데 약 340).

- [ ] **Step 1:** 지금 틀을 상태 다섯(선출, 진행, 끝, 관전, 리플레이)에서 390과 1440으로 찍고 무대의 사각형(x, y, w, h)을 잰다.
- [ ] **Step 2:** 시안 세 가지를 실험실 페이지로 만들어 한 장으로 보내고 고르게 한다.
- [ ] **Step 3:** DESIGN.md를 고친 뒤 구현한다.
- [ ] **Step 4:** 확인: 상태 다섯을 오가며 무대의 `getBoundingClientRect`가 같은지 Playwright로 단언한다(이 검사를 `tests/`가 아니라 `scripts/verify-battle-frame.cjs`로 남긴다: 브라우저가 필요하다). `measure-frames`의 `battle-open`, `end` 통과.
- [ ] **Step 5:** 커밋.

### Task 4: HUD를 게임의 문법으로

**Files:**
- Modify: `src/pages/battle/Stage.jsx` (HP 판, 능력 변화, 상태), `src/pages/BattlePage.jsx` (머리, 기술 키 `moveKeys`, 길게 누른 카드 `tipFor`, 대기 표시, 기록 `Log`)
- Modify: `src/styles/battle.css`, `src/styles/battle-stage.css`
- Modify: `DESIGN.md` "Battle"의 The head, HP plates, The move keys, Information at hand
- 전환: `docs/BATTLE_TRANSITIONS.md`의 T5(특성과 도구 판), T6(매 턴 다시 뜨는 안내), T7(턴 중에도 밝은 키)을 이 단계에서 닫는다.

**정하는 것(시안으로 확인):**
- HP 판은 제 포켓몬의 머리 위나 발치에 선다. 판과 포켓몬 사이를 시선이 가로지르지 않는다. 더블에서도 같다.
- 능력 변화는 배율(×1.5)이 아니라 능력 이름과 화살표의 단계(▲1에서 ▲6, ▼)다. 배율은 판을 누르면 나온다.
- 머리의 숫자는 이름을 단다(층, 턴). 이름 없이 설 수 없으면 뺀다.
- 기술 키: 이름, 타입 색, PP가 주인이고, 상성은 칩 하나, 타수는 Task 0에서 고른 안(A면 키 바닥 게이지, 길게 누를 때 차는 막대는 키 윗변으로 옮긴다. C면 겨눈 기술의 범위가 상대 HP 판에 선다). 위력과 명중과 우선도는 길게 누른 카드로 간다.
- 기록은 표의 행이 아니라 턴으로 묶인 흐름이다(턴 머리, 그 아래 줄들). Task 3에서 고른 자리에 선다.
- 대기 표시는 빈 세그먼트 칸이 아니라 도는 세그먼트(`Busy`)다.

- [ ] **Step 1:** 항목별 시안을 실험실에서 만든다(HP 판 자리 두 가지, 능력 변화 표기, 기술 키). 싱글과 더블, 390과 1440, 두 테마.
- [ ] **Step 2:** 사용자 선택 뒤 DESIGN.md를 고치고 구현한다.
- [ ] **Step 3:** 확인: 더블 리플레이 한 판과 100턴이 넘는 판에서 판이 겹치지 않는지, 능력 변화 여섯 단계가 한 줄에 서는지 스크린샷으로 본다. `tests/`의 기존 배틀 테스트 통과.
- [ ] **Step 4:** 커밋.

### Task 5: 타격의 세 박자

**Files:**
- Modify: `src/pages/battle/stageFx.js`, `moveFx.js`, `gl.js` (멈칫, 흔들림), `Stage.jsx` (잔상 HP, 컷인), `sfx.js` (컷인의 소리 자리), `stageCamera.js`
- Modify: `src/styles/battle-stage.css`
- Modify: `DESIGN.md` "Battle"의 The moves, The big moments, Judging a game

**값(시작점, 녹화로 다듬는다):**
- 멈칫: 맞는 순간 60 ms, 효과 굉장 90 ms, 급소 120 ms. 재생 속도를 따른다.
- 흔들림: 피해 비율에 비례, 최대 무대 폭의 1%, 180 ms 안에 잦아든다.
- 잔상 HP: 깎인 만큼이 흰 띠로 남아 400 ms 뒤 줄어든다.
- 급소, 효과 굉장, 일격에 쓰러짐은 무대 위 큰 글자 컷인(700 ms 이내)이고 메시지 창은 같은 말을 되풀이하지 않는다.
- 메시지의 박자: 기술 이름은 길게, 결과는 짧게. 턴 전체 길이는 지금보다 늘지 않는다.

- [ ] **Step 1:** 원작(포켓몬 챔피언스)의 타격 장면을 영상으로 찾아 멈칫과 흔들림의 길이를 프레임으로 센다(내려받기는 먼저 묻는다).
- [ ] **Step 2:** 실험실 `?view=lab`의 기술 탭에서 구현하고 CDP 화면 녹화로 전후를 나란히 놓아 사용자에게 보인다.
- [ ] **Step 3:** 확인: 한 턴의 길이를 전후로 잰다(늘지 않음). `--reduced`에서 멈칫과 흔들림이 없고 컷인은 멈춘 글자로 선다. 연출 중 무대 탭이 건너뛰는지 CDP 터치로 본다. 턴 중간에 연 관전이 컷인 없이 지금 상태에 서는지 본다. `tests/battleSfx.test.mjs` 통과. `measure-frames battle-open` 통과.
- [ ] **Step 4:** DESIGN.md에 값을 적고 커밋.

### Task 6: 판의 의식

**Files:**
- Modify: `src/pages/BattlePage.jsx` (열림 `opening`, 끝 `bt-end`, `ReplayBar`), `src/pages/battle/Stage.jsx`, `stageFx.js`, `changeover.js`, `Replay.jsx`
- Modify: `src/styles/battle.css`, `src/styles/battle-stage.css`
- Modify: `DESIGN.md` "Battle"의 The big moments, After the battle, Replay

**정하는 것(시안):**
- 시작: 두 이름과 두 파티가 마주 서는 VS 장면(2초 이내, 탭으로 건너뜀). 2026-11-07에 뺀 "배틀 시작" 팝업이 버벅였던 이유(BATTLE 기록)를 먼저 읽고 같은 길을 가지 않는다: 이미 그려진 것의 투명도와 위치로만 만든다.
- 끝: 이긴 포켓몬으로 카메라가 다가가고(1초), 무대 위에 결과 카드가 선다(승패, 판의 숫자, 도전의 탑이면 연승과 램프). 키는 카드 아래다. 나가기는 주 키가 아니다.
- 리플레이: 재생 막대는 턴의 눈금이 있는 줄이다. 쓰러짐과 메가진화가 눈금 위 표식으로 선다. 처음, 이전, 재생, 다음, 끝 키는 남는다.

- [x] **Step 1:** 시안(VS 두 가지, 결과 카드 두 가지, 타임라인) → 선택 → DESIGN.md.
- [x] **Step 2:** 구현. 일반 배틀, 도전의 탑, 공식 경기, 관전, 리플레이에 같은 부품을 쓴다.
- [x] **Step 3:** 확인: 끝에서 무대 사각형이 움직이지 않는다(Task 3의 검사). 진 판, 무승부, 기권, 시간 초과의 결과 카드. 라이트 테마. `measure-frames replay-open`, `end` 통과.
- [x] **Step 4:** 커밋.

**고른 것(2026-11-18):** 시작은 지금대로(VS 장면 없음). 끝은 시안 A, 무대가 그대로 서고 메시지 창이 결과 띠가 된다(카메라 접근은 하지 않았다). 리플레이는 턴 눈금 타임라인. 확인: 끝과 되돌아감에서 무대 사각형이 390과 1440 모두 그대로, replay-open 최악 317 ms. 진 판, 무승부, 기권, 시간 초과의 띠는 코드로만 보았다(자리를 가진 진 판의 화면은 다음 확인에서).

### Task 7: 로비와 선출

**Files:**
- Modify: `src/pages/BattlePage.jsx` (로비: `LobbyArena`, 상대와 난이도와 형식의 선택), `src/pages/battle/Sets.jsx` (`TeamPick`, `MonCard`, `PickDock`)
- Modify: `src/styles/battle.css`
- Modify: `DESIGN.md` "Battle"의 The opponent and the rooms, The party

**정하는 것(시안):**
- 로비는 무대가 주인이다. 선택(상대, 난이도, 형식, 파티)은 무대 위나 아래의 한 줄 선택으로 줄이고, 빈 코트의 물음표 열둘 대신 고른 것이 무대에 선다(컴퓨터면 그 폴리곤이 제 자리에, 내 파티가 정해졌으면 내 여섯이).
- 선출 카드는 그림과 이름과 타입과 도구가 앞면이고, 능력치 격자는 정보 키 뒤로 간다. 고른 순서가 크게 선다.

- [ ] **Step 1:** 시안 → 선택 → DESIGN.md → 구현.
- [ ] **Step 2:** 확인: 방 만들기, 코드 방, 공식 경기 대기, 도전의 탑 선출이 같은 부품으로 선다. 여섯 가운데 넷째 뒤를 고르는 선출(2026-11-06의 버그 자리)을 실험실에서 직접 눌러 본다.
- [ ] **Step 3:** 커밋.

### Task 8: 탑의 첫 화면

**Files:**
- Modify: `src/pages/battle/Streak.jsx` (탭: `StreakOpen`, 내 도전 패널, 키), `tower.js` (`climbersHTML`, 시점 `viewOf` 사용), `towerGL.js` (`viewOf("hall")`, 가로등, 기준물)
- Modify: `src/styles/streak.css`, `src/styles/battle-stage.css` (`.tw-hall`)
- Modify: `DESIGN.md` 도전의 탑, The tower

**고치는 것(대부분 시안 없이 바로, 시점과 기준물만 시안):**
- 쉬는 시점에서 탑의 꼭대기(등불)가 보인다. 내 위치는 호박색 램프, 오를 길이 위로 이어진다.
- 이름표가 겹치지 않는다: 같은 높이의 둘은 한 줄씩 띄운다(`climbersHTML`의 28 간격이 1440에서 지켜지지 않은 원인을 먼저 찾는다).
- 가로등을 문보다 작게, 문 앞에 사람 크기의 기준물 하나(시안).
- 옆 칸의 "이번 달 1위"와 시상대 1위의 중복을 없앤다: 내 도전이 없으면 패널은 "도전의 탑" 한 줄과 시작 키의 안내만 든다.
- 주 키는 언제나 "도전"이다. 로그인이 필요하면 누른 뒤 시트에서 구글 로그인을 받는다. "컴퓨터와 연습"은 그대로 둘째 키다.
- "이번 달 / 오늘의 탑"은 장면 모서리의 토글에서 탭 아래의 선택 줄로 내려온다.
- 휴대폰에서 내 도전 패널이 고정 키에 가리지 않는다.

- [ ] **Step 1:** 이름표 겹침의 원인을 재현하고 고친다(`tower.js`). 1440과 390에서 도전자 넷으로 찍어 확인.
- [ ] **Step 2:** 시점과 기준물 시안 → 선택 → 구현. 탭 진입 장면과 층 이동 장면이 새 시점에서 이어지는지 녹화로 본다.
- [ ] **Step 3:** 키와 패널과 토글을 고친다. 로그아웃, 이름 확인 중, 도전 없음, 도전 중, 오늘의 탑 마친 뒤의 다섯 상태를 하네스(PGlite + 개발 서버)로 찍는다.
- [ ] **Step 4:** `measure-frames tower-tab`, `tower-enter` 통과. 커밋.

### Task 9: 탑의 놀이 흐름

**Files:**
- Modify: `src/pages/battle/Streak.jsx` (`DraftBoard`, `DoorPick`, `StreakEnd`, `SwapTable`), `tower.js`와 `towerGL.js` (문을 누르는 판정, 문 뒤의 여섯)
- Modify: `src/styles/tower-play.css`
- Modify: `DESIGN.md` The draft, The doors, the trades, `docs/BATTLE_STREAK.md` 17장(화면만 바뀐다는 것과 확인한 것)

**정하는 것(시안):**
- 드래프트: 자리의 차례가 오면 카드 석 장이 뒤집히며 공개된다. 고른 카드는 파티 칸으로 들어가고 나머지 둘은 꺼진다. 카드 앞면은 Task 7의 선출 카드와 같은 부품이다.
- 판 사이는 세 장면이다, 한 번에 하나만 묻는다: (1) 결과: 연승 숫자가 오르고 램프가 켜지거나 꺼진다. (2) 보상: 교환(11월 18일 A안의 표를 그대로 쓰되 이 장면의 전부로 선다) 또는 건너뛰기. (3) 다음 문.
- 문은 3D 탑의 실제 문이다: 카메라가 다음 층의 두 문 앞에 서고, 문을 누르면 그 뒤의 여섯이 문 위에 서며, 다시 누르면 들어간다. 수문장의 문은 닫힌 큰 문 하나다. 접근성과 움직임 줄이기에서는 지금의 두 패널이 대신 선다.
- 진 판의 복기는 (1)의 자리에 선다.

- [ ] **Step 1:** 세 장면의 흐름을 실험실에서 시안으로 만든다(정지 화면과 녹화). 문 고르기는 3D 안과 지금 패널 안을 나란히 보인다.
- [ ] **Step 2:** 선택 뒤 DESIGN.md → 구현. 배틀 함수의 요청(`streakNext`의 `swap`, `door`)은 그대로다.
- [ ] **Step 3:** 확인: `scripts/verify-streak-function.mjs`(함수 쪽 불변), 하네스로 실제 도전을 이긴 판, 교환, 강한 문, 진 판, 수문장, 끝까지 돌린다. 키보드만으로 드래프트와 문과 교환을 끝낼 수 있다. `measure-frames between-games` 통과.
- [ ] **Step 4:** 커밋.

### Task 10: 전체를 다시 본다

- [ ] 일반 배틀 한 판(싱글, 더블), 도전의 탑 한 도전(드래프트부터 끝까지), 관전, 리플레이를 390과 1440, 두 테마에서 처음부터 끝까지 직접 한다.
- [ ] 2026-11-18 진단의 항목을 하나씩 다시 채점한다(진단 대응표의 아홉 줄). 남은 것은 숨기지 않고 적는다.
- [ ] `measure-frames` 여섯 장면, `npm test`, `npm run build`.
- [ ] 실제 휴대폰에서 본 것과 못 본 것을 나눠 보고한다.

## 순서와 묶음

- 0 → 1 → 2는 차례대로다(법과 측정이 나머지의 바닥이다).
- 3 → 4 → 5 → 6은 배틀 쪽, 8 → 9는 탑 쪽이다. 7은 4 뒤 어디든 된다.
- 3 이후의 배틀 쪽과 8 이후의 탑 쪽은 파일이 거의 겹치지 않아 따로 진행할 수 있다(`BattlePage.jsx`의 `StreakEnd` 호출부만 만난다).
- 단계마다 사용자에게 보이는 것: 시안 한 장, 고른 뒤의 전후 비교, 잰 숫자.
