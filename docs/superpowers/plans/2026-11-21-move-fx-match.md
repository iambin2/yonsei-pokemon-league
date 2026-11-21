# 기술 연출을 원작의 시간과 세기에 맞추기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기술 연출 각본 223개를 원작 영상에서 잰 단계 시간, 흰 섬광, 타입 색 면적에 맞춘다. 그림은 우리 동사로 그린다.

**Architecture:** 재는 도구(프레임 → 수치 → 단계)를 `docs/move-fx-work/`에 두고, 순수 계산은 `fxphases.mjs` 하나로 모아 `tests/`에서 검사한다. 원작은 타입별 영상을 30fps로 자르고, 우리 쪽은 실험실을 Reanimate `capture.ts`로 찍는다. 두 쪽의 단계를 `match.tsv`로 비교하고, 통과할 때까지 `moveFx.js`와 `stageFx.js`를 고친다.

**Tech Stack:** Node 22 (`node:test`), Bun 1.4 + Reanimate 스킬 스크립트(`~/.claude/skills/reanimate/scripts`, pngjs 포함), yt-dlp, WebGL2 무대(`gl.js`).

**Spec:** `docs/superpowers/specs/2026-11-21-move-fx-match-design.md`

## Global Constraints

- 원작의 텍스처, 프레임, 모델, 셰이더를 가져오거나 따라 그리지 않는다. 원작 영상은 수치를 재는 데만 쓰고 스크래치패드에만 둔다.
- 원작 영상은 받을 때마다 이름, 출처, 크기를 운영자에게 묻고 받는다.
- 카메라는 움직이지 않는다(DESIGN.md "The camera").
- 통과 기준: 단계의 시작과 길이 ±80ms, 흰 섬광 길이 ±50ms이고 최대 면적은 원작 이하, 타입 색 면적의 최댓값(대상 크기로 나눔) ±25%, 남는 것이 사라지는 시각 ±120ms. 기준을 낮춰 통과시키지 않는다.
- 흰 섬광은 맞는 지점에서만, 대상의 몸 값(flash, rim, tint)을 하얗게 만들지 않는다. 비교의 분모는 대상 크기(잉크 높이)다.
- 비행, 강철, 얼음, 바위: 섬광은 "거의 흰 색이면서 타입 색 범위 밖"으로 센다. 맞는 빛은 `${t}.d` 램프.
- 날씨, 필드, 룸, 장판, 벽, 메가진화는 이번에 고치지 않는다.
- 타입 하나가 커밋 하나. 커밋 메시지는 네 섹션(`문제 인식:`, `사고 과정:`, `기획 방향성:`, `프롬프트 (사용자 지시):`). 배포는 운영자가 말할 때.
- 모든 보고와 문서는 한국어, 합니다체 문구 규칙(DESIGN.md Voice and tone)은 사이트 문구에만.

## Review Focus

- **맞는 순간이 없는 기술**(protect, harden, focus, speed): 연출이 처음 화면을 바꾸는 프레임이 0이어야 한다. Task 1 테스트 `self moves anchor at first change`.
- **흰 타입**(비행, 강철, 얼음, 바위): 타입 빛이 섬광으로 잘못 세지면 안 된다. Task 1 테스트 `near-white type light is not flash`.
- **방어에 막히거나 빗나간 기술**: 맞는 순간이 없어도 측정이 멈추지 않고, 섬광이 나오지 않아야 한다. Task 3에서 `protect` 뒤의 `flamethrower`를 한 번 찍어 섬광 면적 0을 확인.
- **연출 속도 느리게/빠르게와 동작 줄이기**: 새 섬광이 속도 배율을 따르고, 동작 줄이기에서도 섬광은 남는다(DESIGN.md Reduced motion). Task 3 확인 단계.
- **라이트 테마**: `flashStage`는 라이트에서 세기를 .6배로 줄인다. 새 맞는 지점 섬광도 같은 배율을 쓴다. Task 3 확인 단계.

---

### Task 1: 재는 도구 (프레임 → 수치 → 단계)

**Files:**
- Create: `docs/move-fx-work/fxphases.mjs` (순수 계산, 의존성 없음)
- Create: `docs/move-fx-work/fxmeasure.mjs` (프레임 폴더를 읽어 행을 내는 CLI, 스크래치패드의 `fxmeasure.ts`를 옮김)
- Test: `tests/fxPhases.test.mjs`

**Interfaces:**
- Produces:
  - `typeWindow(type: string) -> { hue: [number, number], minSat: number, nearWhite: boolean }` — 18타입. 색상은 `src/styles/tokens.css`의 `--type-*` 값에서 ±20°, `nearWhite`는 flying, steel, ice, rock.
  - `classify([r,g,b], win) -> "white" | "type" | null` — `white`는 r>235, g>225, b>200이면서 (`nearWhite`면) 타입 범위 밖일 때만.
  - `phasesOf(rows: Row[], { fps: number, baseline: Row, inkPx: number, hit: boolean }) -> { zero: number, phases: { name, start, end }[], flash: { start, end, peak } | null, typePeak: number, residueEnd: number }` — `Row = { white: number, type: number, cx: number }`(화면 비율). 모든 시간은 ms, `zero` 기준. 면적은 `inkPx`로 나눈 값. `hit: false`면 `zero`는 기준선보다 처음 바뀐 프레임.
  - `compareRow(ref, ours) -> { pass: boolean, fails: string[] }` — Global Constraints의 네 기준.
  - CLI: `bun docs/move-fx-work/fxmeasure.mjs <frames> --type fire --fps 30 [--top 0.12] [--from N --to N] > rows.json`

- [ ] **Step 1: 실패하는 테스트 쓰기** — `tests/fxPhases.test.mjs`에 합성 행으로:
  - `flash is found and timed`: 30fps, 10프레임 기준선(white .02) 뒤 프레임 20~24에 white .15 → `flash.end - flash.start` = 133±34, `zero`는 프레임 20의 시각.
  - `self moves anchor at first change`: `hit: false`, type 면적이 프레임 7부터 오름 → `zero` = 233.
  - `near-white type light is not flash`: `classify([240,240,245], typeWindow("ice"))` → `"type"`, `classify([250,248,240], typeWindow("fire"))` → `"white"`.
  - `compareRow fails on long travel`: ref travel 500ms, ours 1100ms → `pass: false`, `fails` 에 `"travel"`.
- [ ] **Step 2: 실패 확인** — `node --test tests/fxPhases.test.mjs` → FAIL (모듈 없음).
- [ ] **Step 3: `fxphases.mjs` 구현** — 단계 경계는 type 면적과 white 면적이 기준선+잡음(기준선 첫 10프레임 표준편차의 3배)을 넘고 내려오는 점. 단계 이름: `charge`(맞기 전 첫 상승~travel 시작), `travel`(type 면적이 대상 쪽으로 중심 cx가 움직이는 구간), `land`, `flash`, `residue`.
- [ ] **Step 4: 통과 확인** — `node --test tests/fxPhases.test.mjs` → PASS, `npm test` 전체 PASS.
- [ ] **Step 5: `fxmeasure.mjs` CLI** — pngjs는 `createRequire(~/.claude/skills/reanimate/scripts/)`로 불러온다(`shoot.mjs`가 npx 캐시의 Playwright를 쓰는 것과 같은 방식). 원작 화염방사 프레임(`scratchpad/ref-fire/ref/frames`)에 돌려 흰 섬광 최대가 화면 13% 근처, 시각 4.23s 근처로 나오는지 본다.
- [ ] **Step 6: 커밋** — `docs/move-fx-work/fxphases.mjs fxmeasure.mjs tests/fxPhases.test.mjs`, README에 두 도구 줄 추가.

### Task 2: 원작 구간표와 우리 쪽 찍기

**Files:**
- Create: `docs/move-fx-work/refs.json` — `{ "fire": "qj7qVH6dyz0", "water": "C4XkrMghgwk", "grass": "YngFWS7k-W0", "electric": "lx9hm1AdzWU", "ice": "fin0QjV1QGw", "fighting": "fGR4WtguYoM", "poison": "cjxMnQDYkig", "ground": "3yDp1NIU9nQ", "flying": "h1TsHzbyrAI", "psychic": "8KjASk9x3Ws", "bug": "UCa1vD9c66w", "rock": "7lxCxN3YwZo", "ghost": "mOIvZSdRQPA", "dragon": "Kjx_2CAwwNY", "dark": "b0ramkcJw5k", "steel": "D1yjGRa2v9U", "fairy": "MlWWR0Xbi54", "normal": null }`
- Create: `docs/move-fx-work/segments.tsv` — `recipe\tmove\ttype\tvideo\tstart\tend\tnote` (손으로 채움, 시간은 초)
- Create: `docs/move-fx-work/refindex.sh <video.mp4> <out>` — 2초 간격 타임코드 색인 시트(화염방사 시험의 ffmpeg tile 명령)
- Create: `docs/move-fx-work/capture-ours.mjs <ids,comma> <outDir>` — 각 id마다 Reanimate `capture.ts`를 `--url http://localhost:5182/?view=lab --viewport 1280x720 --selector canvas --trigger none --wait-before 1500 --duration <각본 길이+1500> --pre-roll 0 --fps 30 --gpu hardware`와 async로 감싼 pre-js(`setFormat("singles")`, 2.5초 뒤 녹화 시작 후 300ms에 `__bench.play(id)`)로 부른다. 결과는 `<outDir>/<id>/frames`.
- Create: `docs/move-fx-work/match.mjs` — `segments.tsv`의 한 타입을 읽어 원작과 우리 행을 `phasesOf`, `compareRow`에 넣고 `match.tsv`(`recipe\tmove\tpass\tfails\tref\tours`)를 다시 쓴다.

**Interfaces:**
- Consumes: Task 1의 `phasesOf`, `compareRow`, CLI.
- Produces: `match.tsv` 한 줄 = 각본 하나. 각본의 타입은 `champions-data.json`의 `moves[rep].type`.

- [ ] **Step 1:** 개발 서버 `ypl-dev-offline`(preview_start)에서 `node docs/move-fx-work/capture-ours.mjs flamethrower <scratch>/ours` → 프레임 130장 이상, 첫 프레임에 연출이 없음(녹화가 시작을 놓치지 않음).
- [ ] **Step 2:** `ypl-preview`(빌드)에서 `--clock virtual`이 load를 넘기는지 한 번 시험. 되면 capture-ours에 `--clock virtual`을 기본으로, 안 되면 README에 이유를 적는다.
- [ ] **Step 3:** 화염방사 한 줄로 `match.mjs fire` → `match.tsv`에 `travel` 실패가 나오는지(시험에서 잰 1.1s 대 0.5s).
- [ ] **Step 4: 커밋.**

### Task 3: 맞는 지점의 흰 섬광 (B 규칙)

**Files:**
- Modify: `src/pages/battle/stageFx.js` (`flashStage` 옆, 288행 근처) — `impactFlash(stage, at: [x, y], { ms = 150, size = 1 } = {})` 추가. 맞는 지점의 가산 빛 하나, 라이트에서 세기 .6배, 연출 속도 배율(`ms()`)을 따른다. 몸 값(flash, rim, tint)은 건드리지 않는다.
- Modify: `src/pages/battle/moveFx.js` — 원작에 섬광이 있는 각본만 맞는 순간에 `impactFlash`를 부른다(각본별로 Task 4 이후에 켠다).
- Modify: `docs/move-fx-work/README.md` "지킬 것" 첫 줄, `DESIGN.md` "What the stage plays" 표의 hit 줄 — 맞는 지점의 짧은 흰 섬광 허용, 몸이 하얗게 뜨는 것은 계속 금지.
- Test: `tests/moveFx.test.mjs`에 `impactFlash never touches a body`: `stageFx.js` 소스에서 `impactFlash` 본문에 `flash:`, `rim`, `tint`가 없음을 확인.

- [ ] **Step 1:** 테스트 쓰기, 실패 확인.
- [ ] **Step 2:** `impactFlash` 구현, 테스트 통과, `npm test` PASS.
- [ ] **Step 3:** 실험실에서 화염방사에 켜고 찍어 섬광 길이 150±50ms, 대상 크기 대비 면적이 원작 이하인지 `match.tsv`로 확인. `protect` 뒤에 쓴 화염방사는 섬광 0.
- [ ] **Step 4:** 라이트와 다크, 느리게/빠르게, 동작 줄이기에서 한 번씩 찍어 본다.
- [ ] **Step 5: 커밋.**

### Task 4: 불꽃 타입 묶음 (각 타입 묶음의 본보기)

**Files:**
- Modify: `src/pages/battle/moveFx.js` (불꽃 각본의 동사: `stream`, `blast`, `vortex`, `volcano`, `hit … fire`, `shoot fireball` 등이 쓰는 길이와 입자)
- Modify: `docs/move-fx-work/segments.tsv`, `match.tsv`, `final.tsv`, `docs/move-fx-ranking.html`

- [ ] **Step 1:** 대표 기술이 불꽃인 각본 목록을 뽑는다(`recipes.json` × `champions-data.json`).
- [ ] **Step 2:** 원작 영상은 이미 받음(`scratchpad/ref-fire/fire.mp4`). `refindex.sh`로 색인을 만들고 각본마다 구간을 `segments.tsv`에 적는다. 영상에 없는 각본은 같은 각본의 다른 기술, 그것도 없으면 note에 `no-ref`.
- [ ] **Step 3:** 원작 행과 우리 행을 재고 `match.mjs fire`.
- [ ] **Step 4:** 실패한 각본마다 가장 작은 변경(각본의 숫자 → 동사의 기본값 순)으로 고치고 다시 찍는다. 한 각본에 다섯 번 넘게 돌아도 실패하면 수치와 이유를 note에 남기고 넘어간다.
- [ ] **Step 5:** 고친 동사를 쓰는 다른 타입 각본도 다시 찍어 나빠지지 않았는지 본다(`match.tsv`의 이전 줄과 비교).
- [ ] **Step 6:** 원작과 우리 필름스트립을 `pair.py`로 나란히 놓고 본다. 섬광, 불씨, 연기가 사이트의 매트한 물질감을 지키는지(README "지킬 것").
- [ ] **Step 7:** `npm test`, 일반 배틀과 도전의 탑에서 불꽃 기술 한 번씩, 휴대폰 속도 프레임 기록(`docs/BATTLE_FRAMES.md`의 방법)이 기준 안.
- [ ] **Step 8:** `final.tsv`, `report.py`로 순위표 갱신, 커밋.

### Task 5~21: 나머지 타입 (Task 4의 단계를 그대로)

순서: 물, 풀, 전기, 얼음, 격투, 독, 땅, 비행, 에스퍼, 벌레, 바위, 고스트, 드래곤, 악, 강철, 페어리, 노멀. 타입마다 Task 4의 Step 1~8을 하되, Step 2 앞에 영상(`refs.json`)을 운영자에게 물어 받는다. 노멀은 출처를 먼저 찾아 묻는다.

### Task 22: 마무리

- [ ] `match.tsv`에서 실패와 `no-ref` 각본, 한 각본 안에서 기술끼리 ±80ms를 넘은 목록을 README 끝에 정리한다(각본 나누기는 따로 정할 일).
- [ ] 메모리와 README에 이번 방법을 적고, 스크래치패드의 원작 영상은 남겨 두되 저장소에는 넣지 않았는지 `git status`로 확인.
