# 시각 완성도 수정 계획서

이 문서만 읽고 실행한다. 진단의 근거는 `docs/visual-audit/report.md` (발견 ID: K-, A-, B-, C-, D-, E-, G-, F-), 화면 ID는 `docs/visual-audit/inventory.md` 에 있다.

## 0. 목표와 지켜야 할 것

**목표:** league.pokeyonsei.com 의 현재 디자인 양식을 그대로 둔 채, 양식이 고르게 적용되지 않은 곳과 구성이 어긋난 곳을 바로잡는다.

**바꾸지 않는 것 (어기면 실패):**
- 디자인 양식: 색(토큰), 폰트, 네모난 패널(모서리 둥글기 없음), 그림자 없음, 세그먼트 숫자, 앰버 램프, 전체 분위기. 수정 전후를 나란히 놓았을 때 "같은 사이트가 더 정돈됐다"로 보여야 한다. "디자인이 바뀌었다"로 보이면 실패다.
- 기능 동작과 데이터 동작. 스타일과 배치만 바꾼다. 이 계획의 어떤 작업도 서비스 코드(`src/services/`), RPC, 저장 형식을 건드리지 않는다.
- 새 값을 만들지 않는다. 아래 1장의 값만 쓴다. 필요한 값이 없으면 멈추고 묻는다.
- `DESIGN.md`, `PRODUCT.md`, `CLAUDE.md` 가 이 문서보다 위다. 충돌하면 멈추고 묻는다. 한국어 문구는 합니다체, 가운뎃점(·) 금지, 줄표 금지.
- `npm test` (특히 `tests/designLaw.test.mjs`) 가 통과해야 한다. 실패하면 값을 고친다. 테스트의 `EXCEPT` 에 추가하지 않는다.
- 배틀 화면(`battle.css`, `battle-stage.css`, `tower-play.css`, `src/pages/battle/`)은 DESIGN.md "Battle" 장이 기준이다. 배틀의 선택 로직(`src/services/battleCpu.js`)은 건드리지 않는다.
- 라이트와 다크는 한 작업이다. 한쪽에서 고친 것은 같은 변경에서 다른 쪽도 확인한다.
- 커밋 메시지는 CLAUDE.md "Commit messages"의 네 구획(문제 인식, 사고 과정, 기획 방향성, 프롬프트)을 갖춘다. 배포는 하지 않는다. 사용자가 따로 말할 때만 한다.

**문서의 두 부분:** 3장(T-01~T-58)은 체계에서 벗어난 값과 버그를 바로잡는다. 5장(T-59~T-102)은 판단이 들어가는 작업으로, `docs/visual-audit/questions.md` 의 항목을 사용자가 2026-11-23에 "권한 쪽으로 전부" 확정한 것이다. 3장을 먼저 끝낸다. 기능 결함(report.md 9장)은 T-102 하나만 넣었다.

## 1. 확정된 체계

새로 설계한 값이 아니다. 지금 사이트가 쓰는 값이고, 근거는 사용 횟수다(배틀 3개 파일을 뺀 `src/styles/*.css` 20개 기준, 2026-11-22 집계).

### 간격 (`tokens.css:107`)
| 토큰 | 값 | 쓰임 | 사용 횟수 |
|---|---|---|---|
| `--seam` | 2 | 패널과 패널 사이 | 70 |
| `--s1` | 4 | 라벨과 값, 제목과 회색 줄 | 134 |
| `--s2` | 8 | 라벨과 칸, 조작 안쪽 | 210 |
| `--s3` | 12 | 섹션 제목과 내용, 패널 안쪽 여백(휴대폰) | 285 |
| `--s5` | 20 | 휴대폰 옆 여백, 한 섹션 안의 블록 사이, 칸과 칸 | 214 |
| `--s8` | 32 | 묶음 사이, 페이지 제목 아래, 데스크톱 옆 여백 | 79 |
| `--s13` | 52 | 섹션 사이, 데스크톱 열 간격 | 80 |
| `--s21` | 84 | 데스크톱 장 사이 | 39 |
| `--pad` | 12 (859 이하) / 20 (860 이상) | 패널 안쪽 여백 | 94 |

토큰을 거치지 않은 길이는 선(1, 2), 분기점, 아이콘(16, 20, 24), 폭 고정값(439, 709, 576, 1200, 220, 136)뿐이다. 14, 24, 34, 40 같은 간격이 화면에 나오면 두 여백이 겹친 버그다(report K-04, K-13).

### 글자 (`tokens.css:109-111`)
화면에 그려진 글자 측정(1440과 360, 다크, 장면 59개):

| 단 | 크기/줄높이 | 굵기 | 쓰임 | 그려진 횟수 (1440 / 360) |
|---|---|---|---|---|
| 32 | 32/40 | 700 | 페이지 제목, 기록의 한 이름 | 66 / 66 |
| 20 | 20/28 | 700 | 섹션·시트 제목, 패널의 한 이름 | 296 / 275 |
| 15 | 15/20 | 700 제목·키, 600 칸·탭, 400 회색 줄 | 행 제목, 키, 값 | 10,339 / 2,402 |
| 읽기 | 15/24 | 400 | 본문 | 102 / 105 |
| 12 | 12/16 (860 이상에서는 15/20) | 600 라벨, 400 회색 줄 | 라벨, 회색 줄, 단위, 힌트 | 0 / 8,136 |

다섯 번째 크기는 없다. 굵기는 400, 600, 700 셋.

### 높이 (`tokens.css:113`)
32 띠 / 44 터치 바닥 / 52 행·키 / 64 두 줄 행 / 84 카운터. 휴대폰에서 누르는 것은 44 미만이 없어야 한다.

### 모서리와 그림자
둥글기 0, 그림자 0. 경계가 필요한 떠 있는 면은 시트가 이미 쓰는 안쪽 머리카락 선(`box-shadow: inset 0 1px 0 var(--rule)`, `components.css:191`)과 같은 방식만 쓴다.

### 전환 (`tokens.css:120-123`)
| 토큰 | 값 | 쓰임 | 사용 횟수 |
|---|---|---|---|
| `--move-press` | 100ms ease-out | 누름 (scale .976) | 38 |
| `--move-tone` | 160ms ease-out | 상태 변화 (톤, 램프, 반전) | 76 |
| `--move-leave` | 260ms ease-in | 나감 (시트, 토스트, 옛 화면) | 3 |
| `--move-light` | 420ms ease-out | 들어옴 (12 올라오며 켜짐) | 19 |

`--ease-out: cubic-bezier(.22,1,.36,1)`, `--ease-in: cubic-bezier(.5,0,.75,0)`, 간격 38(행) / 62(세그먼트). 토큰을 거치지 않은 전환 선언은 사이트 CSS에 0건이다. JS는 `src/components/common/motion.js` 의 `DUR`, `EASE_OUT`, `EASE_IN`, `STAGGER` 만 쓴다.

### 배치
휴대폰 옆 여백 20, 640~859는 576 한 기둥, 860 이상은 1200(두 종류를 담는 화면은 709 + 52 + 439). 읽는 글은 709를 넘지 않는다.

## 2. 도구

Playwright는 의존성이 아니다. `npx playwright --version` 을 한 번 실행해 npx 캐시에 받아 둔다. 스크립트는 설치된 Chrome(`channel: "chrome"`)을 쓴다.

```bash
# 개발 서버 (운영 데이터 읽기). .claude/launch.json 의 ypl-dev-prod-data, 포트 5183
npx vite --mode production --port 5183 --strictPort

# 전 화면 스크린샷 + 측정. 결과: docs/visual-audit/shots/<ID>/<폭>x<높이>-<테마>.png, shots/measure.jsonl
node scripts/visual-audit.cjs --set public,inner,sheet --vp all          # 360 390 430 768 1280 1440 1920, 다크와 라이트
node scripts/visual-audit.cjs --set public,inner --vp edges --theme dark # 분기점 바로 아래와 위
node scripts/visual-audit.cjs --only REC-02,HOME --vp core               # 고친 화면만 (390x844, 1440x900)
node scripts/visual-audit.cjs --login --set admin --vp core              # 관리자: 창이 뜨면 사용자가 직접 로그인. 읽기가 아닌 요청은 모두 막는다

# 한 곳을 재는 자 (Git Bash에서는 앞에 MSYS_NO_PATHCONV=1)
MSYS_NO_PATHCONV=1 node scripts/visual-audit-probe.cjs "/?view=records" 1440x900 dark \
  "[...document.querySelectorAll('.rc-tr-place')].map(e=>e.getBoundingClientRect().right)" --shot out.png

# 전환 녹화 (프레임 시트)
node scripts/record-transition.cjs <out dir> "http://localhost:5183/?view=news" --ms 2000 --every 60 --cpu 1 --act "<js>"
```

- 장면 정의는 `scripts/visual-audit.scenes.cjs`. 새 상태를 확인해야 하면 장면을 거기에 더한다.
- **전후 비교:** 시작 전에 `--out docs/visual-audit/before` 로 전 화면을 한 번 찍어 두고, 묶음을 마칠 때마다 `--out docs/visual-audit/after` 로 해당 화면을 찍어 나란히 본다. 두 폴더는 `.gitignore` 에 넣는다.
- 관리자 캡처는 사용자가 직접 로그인해야 한다. 비밀번호를 묻거나 적지 않는다. 운영 서버에 쓰는 키(저장, 삭제, 결과 확정, 신청, 글 등록)는 누르지 않는다.
- 컴퓨터 배틀은 끝나면 `battle` 함수에 기록을 보낸다. 배틀을 끝까지 돌리는 확인에서는 `**/functions/v1/battle*` 요청을 막는다.
- 관리자 화면의 배치만 볼 때는 `ypl-dev-offline` (포트 5182, Supabase 없음, 아무 아이디로 로그인, 데이터는 그 브라우저의 localStorage)을 쓴다.
- 스크린샷 스크립트의 한계: 전체 페이지 샷에서 휴대폰 탭 바가 페이지 중간에 그려진다(고정 요소). 결함이 아니다.

**작업마다 하는 확인 (공통):** ① 적힌 "확인" 수치를 probe로 잰다. ② 적힌 화면을 390x844와 1440x900, 다크와 라이트로 다시 찍어 본다. ③ `measure.jsonl` 의 그 화면 줄에서 `overflow` 가 비어 있는지 본다. ④ `npm test`.

## 3. 작업

순서대로 한다. 묶음 하나가 커밋 하나다. 줄 번호는 3ffd32c 기준이라 앞 작업으로 밀릴 수 있으니 **선택자 문자열로 찾는다**. "현재"에 적힌 문자열이 파일에 없으면 그 작업은 멈추고 보고한다(추측으로 고치지 않는다).

---

### 묶음 1. 공통 부품 (모든 화면에 걸리는 것 먼저)

**T-01 확인 창의 두 키를 1 : 1.618로** (K-08)
- 파일: `src/styles/components.css`, `.modal-actions .btn--main { flex-grow: 1.618; }` 줄 바로 아래에 추가
- 현재: 두 키가 flex-grow 1 대 1.618인데 안쪽 여백이 빠져 390에서 158 : 230 (1.46), 1440에서 229 : 345 (1.51)
- 추가: `.modal-actions:has(> .btn:first-child:nth-last-child(2)) { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.618fr); }`
- 이유: DESIGN.md Hierarchy "뒤로 가는 쪽이 먼저, 주 행동이 1.618배". 키가 하나거나 셋인 줄은 그대로 flex다.
- 확인: 팀 빌더 `초기화` 확인 창(`?view=builder` → 팀에 포켓몬 하나 넣고 `초기화`). 두 키 폭의 비가 1.60~1.63 (390에서 148 : 240, 1440에서 219 : 355 안팎). 키가 셋인 공지 수정 시트(삭제, 취소, 저장)는 전과 같아야 한다.

**T-02 알림 켜기 창의 두 키를 같은 줄로** (K-08)
- 파일: `src/components/common/PushControl.jsx` (`<div className="push-ask">` 안), `src/styles/board.css` (`.push-ask`)
- 현재: `알림 받기`(main)와 `나중에`(second)가 세로로 쌓임, 각 536x52, 사이 20
- 바꿈: 두 `<Button>` 을 `<div className="modal-actions">` 로 감싸고 순서를 `나중에` 먼저, `알림 받기` 나중으로. 안내 문단(`push-note`)은 그 위에 그대로. `mode !== "ready" || blocked` 여서 `알림 받기` 가 없을 때는 `나중에` 하나만 들어간다. `.push-ask { display: grid; gap: var(--s5); }` 는 그대로 둔다.
- 확인: `?view=alerts` → 스위치를 눌러 시트를 연다(권한 창은 승인하지 않는다). 두 키가 한 줄, 간격 2, 폭 비 1.60~1.63.

**T-03 데스크톱 대화상자 위쪽 빈 띠** (K-08)
- 파일: `src/styles/components.css`, `@media (min-width: 860px)` 안의 `.grip::after { display: none; }` 다음 줄에 추가
- 현재: `.grip { height: 20px }` 가 데스크톱에서도 자리를 차지해 제목 위 28 (옆 20)
- 추가: `.grip { height: var(--s3); }`
- 확인: 1440에서 아무 시트(`?view=records` → 트레이너 행). `.sheet` top에서 `.modal > h3` top까지 20 (12 + 8).

**T-04 닫기 ×를 제목 줄 가운데로** (K-08)
- 파일: `src/styles/components.css`, `.modal-x` 규칙
- 현재: 52x52 상자가 `.modal` 맨 위(top 0)에 `place-items: center` 로 서서 × 가운데가 제목 첫 줄 가운데보다 4 낮다 (1440: 72 대 68, 390: 98 대 94)
- 바꿈: `.modal-x` 에 `translate: 0 calc(var(--s1) * -1);` 추가 (상자와 누르는 자리가 4 올라간다)
- 확인: 390과 1440에서 `.modal > h3` 첫 줄 상자의 세로 가운데와 `.modal-x svg` 의 세로 가운데 차이가 1 이하. × 상자의 위쪽이 시트 밖으로 잘리지 않는지(390에서 `.sheet` top보다 아래) 본다. 잘리면 이 작업은 되돌리고 보고한다.

**T-05 반전 패널 위의 초점 테두리** (K-10)
- 파일: `src/styles/tokens.css`, `:focus-visible { outline: var(--line) solid var(--lit); ... }` 줄 바로 아래에 추가
- 현재: 흰(반전) 바탕 위에 흰 2px 테두리라 안 보임
- 추가: `:is(.inv, .btn--main, .skip-link, .seg-track > [aria-selected="true"]):focus-visible { outline-color: var(--ground); }` (같은 예외가 이미 `board.css` 의 `.choice-opt.inv:has(:focus-visible)` 와 `.opt-row.inv:has(:focus-visible)` 두 곳에 있다. 그 방식을 반전된 모든 것으로 넓힌다)
- 확인: 1440과 390, 다크와 라이트. 키보드 Tab을 한 번 눌러 키보드 방식을 켠 뒤 `el.focus()`. 기록 1위 패널(`.rc-top.inv`), 게시판 `글쓰기`(`.btn--main`), 새 사설 대진표 시트의 방식 선택(`.seg-track` 고른 칸), 건너뛰기 링크, 고른 칩에서 `outline-color` 가 배경색과 다르고 화면에서 2px 선이 보인다.

**T-06 검색 건수를 칸 안으로** (K-03)
- 파일: `src/components/common/ListSearch.jsx`
- 현재: `{q && <span className="search-count t12 dim">{count}건</span>}` 가 `<label className="pn search-in">` **밖**에 있어, 글자를 넣으면 칸 폭이 1200 → 1157로 줄고 자릿수마다 움직인다
- 바꿈: 그 `<span>` 을 `<label>` 안, `<input>` 과 지우기 `<button className="search-clear">` 사이로 옮긴다. 다른 것은 그대로.
- 확인: `?view=records` 1440과 390. 검색 칸에 "김"을 넣기 전후 `.search-in` 의 width가 같다(1200 / 350). `count` 를 넘기지 않는 화면(건수가 `undefined건` 으로 찍히는 곳이 없는지)을 `grep -rn "<ListSearch" src` 로 모두 확인한다.

**T-07 행의 회색 줄을 400으로** (K-07)
- 파일: `src/components/common/Board.jsx`, `Row` 안의 `{line && <span className="t12 dim">{line}</span>}`
- 현재: 행의 회색 줄 600, 같은 목록 리드 판의 회색 줄 400 (`t12 dim reg`)
- 바꿈: `className="t12 dim reg"`
- 이유: DESIGN.md Hierarchy 5단 "600 a label, 400 a grey line". 리드 판, 알림 종류 칸, 시트의 힌트가 이미 400이다.
- 확인: `?view=news`, `?view=bracket`, `?view=alerts`, `?view=more`, `?view=board` 를 390과 1440으로 다시 찍는다. 리드와 그 아래 행의 날짜 줄 `font-weight` 가 둘 다 400. 행 제목(`b.t15`)은 700 그대로.

**T-08 램프는 말 앞에, 행 끝 램프는 안쪽 선에** (K-06)
- 근거: 램프가 말 앞에 서는 곳 4종(상단 바 "진행 중", LiveStrip, 공지 리드 "새 글", 더보기 "새 알림"), 말 뒤에 서는 곳 2종(일반 Row, 일반 Lead). 많은 쪽으로 맞춘다.
- 파일 1: `src/components/common/Board.jsx`
  - `Row`: 현재 `{typeof lamp === "string" && <span className="row-lamp-word t12">{lamp}</span>}` 다음 줄에 `{lamp != null && <span className="row-lamp">…<i className="lamp…"/></span>}`. 바꿈: lamp가 문자열이면 `<span className="row-lamp-word t12"><i className={"lamp" + (sig ? " sig" : "")} aria-hidden="true" />{lamp}</span>` 하나만 그리고, 문자열이 아닐 때만 기존 `row-lamp` 를 그린다.
  - `Lead`: 현재 `<span className="t12 lead-lamp">{lamp}<i className=… /></span>`. 바꿈: `<i … />` 를 `{lamp}` 앞으로.
- 파일 2: `src/styles/board.css`
  - `.row-lamp-word { flex: none; font-weight: 600; white-space: nowrap; }` → `.row-lamp-word { flex: none; display: inline-flex; align-items: center; gap: var(--s2); padding-right: var(--pad); font-weight: 600; white-space: nowrap; }`
  - `.row-lamp { …; width: var(--s8); }` → `width` 를 지우고 `justify-content: flex-end; padding: 0 var(--pad) 0 var(--s3);` (말 없는 램프도 오른쪽 여백이 `--pad`)
- 파일 3: `src/styles/home.css`, `.ho-news .row-lamp { width: var(--s13); }` 줄 삭제
- 확인: `?view=news`, 홈, `?view=news&notice=<id>` (다른 공지), `?view=alerts` 1440. 램프의 오른쪽 끝 또는 "새 글" 말의 오른쪽 끝이 같은 행의 다른 것과 같은 x(1300). 램프와 말 사이 8. 대진표 목록의 "진행 중" 행, 배틀 로비의 "진행 중" 행도 같이 본다.

**T-09 드롭다운 메뉴와 더보기 팝오버** (K-09)
- 파일: `src/styles/components.css`
  - `.dd-opt` 의 `padding: var(--s2) var(--s3);` → `padding: var(--s2) var(--pad);` (값 x 140과 항목 x 132의 8 어긋남 해소)
  - `.dd-menu` 규칙에 추가: `box-shadow: inset 0 0 0 var(--hair) var(--rule);`
  - `.popover` 규칙에 추가: `box-shadow: inset 0 0 0 var(--hair) var(--rule);`
  - `.mi` 규칙의 좌우 padding이 `var(--s3)` 이면 `var(--pad)` 로
- 이유: 떠 있는 면이 아래 패널과 한 단계 톤 차이뿐이라 라이트에서 이어져 보인다. 시트의 머리카락 선과 같은 방식.
- 확인: `?view=records&tab=rank` 1440 드롭다운을 열어 버튼 글자와 항목 글자의 left가 같다. 1024x768에서 상단 바 `더보기` 를 눌러 팝오버 가장자리 1px 선이 다크와 라이트 모두 보인다.

**T-10 섹션 제목 아래를 12로** (K-04)
- 파일: `src/styles/board.css`, `.sh { … margin-bottom: var(--s3); }` 줄 아래에 추가
  - `.stack > .sh { margin-bottom: calc(var(--s3) - var(--seam)); }` (stack의 간격 2와 합쳐 12)
  - `.stack > :is(h2, h3):first-child:not(.sh) { margin-bottom: calc(var(--s3) - var(--seam)); }` (stack 안의 맨 제목: 2 → 12)
- 파일: `src/styles/admin.css`, `.ad-block { display: grid; gap: var(--s3); }` 아래에 추가: `.ad-block > .sh { margin-bottom: 0; }` (24 → 12)
- 파일: `src/styles/records-board.css`, `.rc-chapter` 의 `padding: var(--s8) 0 var(--s3);` → `padding: calc(var(--s8) - var(--seam)) 0 calc(var(--s3) - var(--seam));` (34 / 14 → 32 / 12)
- 확인(제목 하단 → 첫 행 상단): 대진표 조별 리그 `?view=bracket&eventId=4379f233-b441-43ba-8c05-581d6c07af05` 의 "1조" 12 / 대진표 목록 보기 라운드 머리 12 / 게시글 "댓글 N" 12 / `?view=records&tab=tour` 시즌 장 머리 12, 장 사이 32 / `?view=admin` 구역 제목 12.

**T-11 패널 위의 second 키와 칸이 패널에 묻히는 곳** (K-11)
- `src/styles/news.css` 끝에 추가: `.nw-form .row .btn--second { --btn-bg: var(--panel-2); --btn-bg-hover: var(--rule); }`
- `src/styles/admin.css`, `.sheet :is(.fb-q, .ed-round, .tb-library-save, .bk-group) :is(input…` 선택자의 목록에 `.fold` 추가 → `.sheet :is(.fb-q, .ed-round, .tb-library-save, .bk-group, .fold) :is(…)`
- `src/styles/admin.css`, 위 규칙 아래에 추가: `.sheet .fb-dot { background: var(--panel); }`
- `src/styles/records-board.css`, `.rc-top-cell` 규칙 아래에 추가: `@media (hover: hover) { .rc-top.pn:hover .rc-top-cell { background: var(--rule); } }`
- 확인: 신청서(`?view=news` → 공지 → 참가 신청)의 "구글 로그인" 키 배경이 행 배경과 다르다. 오프라인 서버에서 공지 작성 → 링크 첨부를 펼쳐 입력칸 배경이 접힘 배경과 다르다. 객관식 질문의 선택지 앞 네모가 보인다. 기록 2위·3위 패널에 포인터를 올려도 칸이 보인다.

**묶음 1 끝 확인:** `--set public,inner,sheet --vp core` 전체를 다시 찍어 before와 비교한다. 달라진 곳이 위 11개 작업에서 말한 곳뿐이어야 한다.

---

### 묶음 2. 폭 구간과 넘침

**T-12 상단 바 전체 탭 분기점** (K-14)
- 파일: `src/components/layout/Navigation.jsx`, `const WIDE = "(min-width: 1100px)";`
- 바꿈: `"(min-width: 1200px)"`
- 이유: 탭 12개 + 계정 + 진행 중 + 테마 키가 서려면 약 1160이 필요하다. 1100~1150에서 "명예의 전당", "팀 빌더", "진행 중"이 두 줄이 된다. 1200은 이미 쓰는 분기점이다(`battle.css`).
- 확인: 대회 당일 상태가 필요하다. probe의 `--act` 로 `.topbar` 에 진행 중 램프와 긴 계정 이름을 흉내 낸다: 계정 버튼(`.acct`)의 글자를 "가나다라마바사아자차"로 바꾼 뒤, 1100, 1160, 1199, 1200, 1280에서 모든 `.navlink` 의 height가 64이고 `scrollWidth <= clientWidth`. 1199 이하는 5탭 + 더보기다.

**T-13 5열 대진표 트리의 8px 넘침** (C-02)
- 파일: `src/styles/brackets.css`, `@media (min-width: 860px)` 안의 `.bk-tree > .bk-col2 { flex: 1 0 var(--bk-w); width: auto; }`
- 현재: 216x5 + 32x4 = 1208 > 1200. `.bk-scroll` clientWidth 1200, scrollWidth 1208, 우승 패널이 8 잘린다
- 바꿈: `.bk-tree > .bk-col2 { flex: 1 1 0; min-width: calc(var(--s21) * 2 + var(--s8)); width: auto; }` (최소 200: 5열 1128, 6열부터 스크롤)
- 확인: `?view=bracket&eventId=17ffc2ab-5128-4af0-8a32-efb826372d10` (싱글 12명) 1280, 1440, 1920에서 `.bk-scroll` 의 scrollWidth === clientWidth. 모든 `.bk-col2` 의 left와 width가 정수. 더블(`eventId=c34f3629-ad49-4d32-82fb-38d1f989fa13`)과 싱글 7명(`927a1b9a-2ca7-431a-b71d-078ac9e5767b`)이 전과 같은 줄에 선다. 더블의 열 폭이 소수(378.67 등)로 남는 것은 T-75에서 다룬다.

**T-14 결승 한 라운드 트리에서 우승 패널 잘림** (C-01)
- 화면: `?view=bracket&eventId=4379f233-b441-43ba-8c05-581d6c07af05` (본선이 결승 하나) 1440, 다크와 라이트
- 현재: `.bk-scroll` 높이 126, `.bk-champ-pos` 높이 180이 결승 가운데로 `translate` 되어 위 21, 아래 33이 잘리고 "우승" 열 머리를 덮는다 (`brackets.css` 의 `.bk-champ-pos`, `.bk-champ-col .bk-champ-node`, `.bk-scroll`)
- 바꿈: `src/styles/brackets.css` 에 추가: `.bk-tree:has(> .bk-col2:nth-child(2):last-child) .bk-champ-node { height: var(--mb); }` 와 같은 조건에서 `.bk-champ-pos { translate: none; }` (열이 결승과 우승 둘뿐일 때 우승 패널을 경기 카드 높이 `--mb` 로). `:has` 조건의 열 선택자는 실제 DOM(`.bk-tree` 의 직계 자식 수)을 probe로 확인하고 맞춘다.
- 끝난 것의 기준(수치): `.bk-champ-pos` 의 top ≥ `.bk-scroll` 의 top + 열 머리 높이, bottom ≤ `.bk-scroll` 의 bottom. "우승" 열 머리 글자가 보인다. 2라운드 이상인 트리(위 12명, 7명)는 전과 같다.

**T-15 라이트 테마 승자 띠** (E-01)
- 파일: `src/styles/battle.css`
- 현재: `:root[data-theme="light"] .bt-strip { background: var(--panel); }` (명시도 0,2,1)가 `.bt-strip[data-won] { background: var(--lit); color: var(--ground); }` (0,2,0)를 이겨, 라이트에서 승자 띠가 패널 색 바탕에 흰 글자가 된다
- 바꿈: 앞 규칙의 선택자를 `:root[data-theme="light"] .bt-strip:not([data-won])` 로
- 확인: 라이트에서 컴퓨터 배틀을 기권으로 끝낸 화면(390, 1440; `battle` 함수 요청은 막는다). `.bt-strip[data-won]` 의 배경이 `--lit`, 글자가 `--ground`. 다크는 전과 같다.

**T-16 데스크톱 배틀에서 대회 진행 띠** (E-04)
- 파일: `src/styles/battle.css`, `@media (min-width: 1200px)` 블록의 `.ypl:has(.bt-match) .site-foot { display: none; }`
- 바꿈: `.ypl:has(.bt-match) :is(.site-foot, .live-strip) { display: none; }`
- 이유: 그 블록의 주석이 "배틀은 한 창이고 아래에 아무것도 없다"인데 띠(44 + 20)를 세지 않아 대회 당일에는 늘 88 스크롤된다. 휴대폰 블록은 이미 `.live-strip` 을 숨긴다.
- 확인: 대회 당일 상태에서 1200x800, 1440x900. 배틀 중 `document.documentElement.scrollHeight === innerHeight`. 대회 당일이 아니면 띠 요소를 probe의 `--act` 로 `#ypl-main` 앞에 `<button class="pn live-strip">` 을 넣어 같은 조건을 만든다.

**T-17 끝난 뒤 데스크톱 키 높이** (E-11)
- 파일: `src/styles/battle.css`, `@media (min-width: 860px)` 의 `.bt-end-row` 묶음 끝에 추가
- 현재: `.bt-end-row { min-height: var(--h-counter); }` 와 `.bt-end-keys > .btn { min-height: 100%; }` 가 결과 머리 없이 키만 있을 때도 걸려 다시하기 692x84, 나가기 74x84
- 추가: `.bt-end-row:has(> :only-child) { min-height: 0; }` 와 `.bt-end-row:has(> :only-child) .bt-end-keys > .btn { min-height: var(--h-row); }`
- 확인: 1440에서 일반 컴퓨터 배틀이 끝난 뒤 두 키 높이 52. 도전의 탑과 중계(결과 머리가 옆에 서는 경우)는 84 그대로.

**T-18 관리자 휴대폰 순서** (G-01)
- 파일: `src/styles/admin.css`, `@media (max-width: 859px)` 안의 `.ad-main > .ad-block:last-child { order: 2; }`
- 현재: 내보내기만 order 2, 대회 진행(`.ad-side`) order 1, 나머지 0이라 대회 진행이 편집과 최근 변경 아래로 밀린다. 그 위 주석은 "할 일, 대회 진행, 편집" 순서다.
- 바꿈: `.ad-main > :not(.ad-block:first-child) { order: 2; }` (할 일만 0, 대회 진행 1, 나머지 2)
- 확인: `?view=admin` 390(오프라인 서버로 충분). 화면의 h2 순서가 할 일 → 대회 진행 → 편집 → (최근 변경, 화면 오류, 신고) → 내보내기. 1440은 전과 같다.

**T-19 신청자 시트 휴대폰 겹침** (G-04)
- 파일: `src/styles/pages.css`, `.fr-name { display: flex; align-items: baseline; gap: var(--s3); min-width: 0; }` 아래에 추가
- 추가: `@media (max-width: 639px) { .fr-name { flex-wrap: wrap; row-gap: var(--s1); } }`
- 현재: 390에서 `.fr-when`(nowrap)이 넘쳐 "11.17 화 23미제출"로 겹친다
- 확인: 관리자 로그인 뒤 `ADM-NEWS-02` 390. 모든 행에서 `.fr-when` 의 right ≤ `.fr-actions` 의 left. 1440은 전과 같다.

**T-20 더보기 1440의 오른쪽 단** (A-04)
- 파일: `src/styles/more.css`, `.more-side { grid-column: 2; grid-row: 2 / span 3; }`
- 바꿈: `span 3` → `span 4` (내 계정 그룹이 생겨 왼쪽 그룹이 넷)
- 확인: `?view=more` 1440. `.more-side` 의 bottom과 왼쪽 마지막 그룹의 bottom 차이 2 이하. 관리자 로그인 행이 오른쪽 단의 맨 아래. 계정 기능이 꺼진 오프라인 서버(5182)에서도 두 단의 끝이 맞는지 본다. 안 맞으면 `grid-row: 2 / -1` 이 되게 `.more` 의 행을 명시하는 대신 보고한다.

**T-21 휴대폰 탭 줄의 숨은 탭** (B-14)
- 파일: `src/styles/board.css`, `.tabsline { display: flex; gap: var(--s8); … }` 아래에 추가
- 추가: `@media (max-width: 859px) { .tabsline { gap: var(--s5); } }`
- 현재: 360에서 칭호의 "파트너"가 344.9에서 온전히 끝나고 다음 탭이 화면 밖에서 시작해 더 있다는 표시가 없다
- 확인: `?view=titles` 360과 390. 화면 오른쪽 끝에 다음 탭 글자가 반 이상 잘린 채 걸친다. 탭이 넷인 기록, 다섯인 배틀은 한 줄에 다 선다. 밑줄 미끄러짐이 그대로 도는지 탭을 눌러 본다.

**묶음 2 끝 확인:** `--set public,inner --vp edges --theme dark` 를 다시 찍고 `measure.jsonl` 에서 `overflow` 0건.

---

### 묶음 3. 기록, 칭호, 명예의 전당

**T-22 죽은 선택자** (B-06b)
- 파일: `src/styles/records-board.css`, `.records-round-detail .row { background: var(--panel-2); }`
- 바꿈: 선택자를 `.records-round-detail .rc-party-row` 로
- 확인: `?view=records&tab=tour` → "입상자별 공식 파티"를 펼친다. 파티 행 배경이 카드 배경과 다르고(`--panel-2`) 행 사이 2px 솔기가 보인다. 다크와 라이트.

**T-23 순위 숫자 자릿수 정렬** (B-02)
- 파일: `src/styles/records-board.css`, `.rc-tr-place { padding-left: var(--pad); color: var(--mute); }`
- 바꿈: `.rc-tr-place { padding: 0 var(--s3) 0 var(--pad); text-align: right; color: var(--mute); }` (오른쪽 정렬만 주면 숫자가 이름에 붙는다: 시안에서 "4이병재"로 찍혔다. 오른쪽 여백 12를 함께 준다). 두 자리 숫자가 칸 안에 드는지(칸 52 - 20 - 12 = 20, "10" 의 폭 약 19) 확인하고, 세 자리 순위가 생기는 목록이면 칸 폭을 `var(--h-row2)`(64)로 넓힌다.
- 확인: `?view=records` 1440에서 `N명 전체 보기` 를 누른 뒤 `.rc-tr-place` 글자 범위(Range)의 right가 모든 행에서 같다(±0.5). 390도. 숫자 right와 이름 left 사이가 12.

**T-24 이름 열 고정** (B-03)
- 파일: `src/styles/records-board.css`, 860 이상의 `.rc-tr-main { grid-template-columns: auto minmax(0, 1fr); … }`
- 바꿈: `auto` → `calc(var(--s21) * 2 + var(--s13))` (220). 이름이 넘치면 말줄임이 되게 이름 요소에 `min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap` 이 있는지 보고 없으면 준다.
- 확인: 전체 보기 상태에서 표식 열(작은 네모들)의 left가 모든 행에서 같다. 가장 긴 이름 + 태그 + "나" 태그가 220 안에 드는지 본다. 안 들면 220 대신 넣을 값을 정하지 말고 보고한다.

**T-25 랭킹 각주 폭** (K-02)
- 파일: `src/styles/records-board.css`, `.rc-note { margin-top: var(--s8); }`
- 바꿈: `.rc-note { margin-top: var(--s8); max-width: 709px; }`
- 확인: `?view=records&tab=rank` 1440. 각주 한 줄이 709 이하.

**T-26 기록 탭의 조작 순서와 간격** (K-01의 일부, 휴대폰과 공통)
- 파일: `src/styles/records-board.css`
- 현재: 트레이너 탭은 검색 → 12 → 칩 → **2** → 드롭다운. 칩(32)과 드롭다운(52)이 솔기로 붙어 한 덩어리로 보인다.
- 바꿈: `.rc-sort` 안의 칩과 드롭다운 사이를 12로. `.rc-sort` 가 `.stack` (gap 2)이면 `.rc-sort { gap: var(--s3); }` 을 준다.
- 확인: 390과 1440에서 칩 bottom → 드롭다운 top = 12.
- 데스크톱에서 세 조작을 한 줄로 모으는 것은 T-60.

**T-27 칭호 시트 제목** (B-19a)
- 파일: `src/pages/TitlesPage.jsx`, `TitleSheet` 의 `<Modal title={title} …>` 에 넘기는 제목
- 현재: 챔피언 메달의 시트 제목이 `item.name` 그대로 "초대 챔피언". 메달과 트레이너 시트는 "1대 챔피언"
- 바꿈: 챔피언 칭호일 때 제목을 `src/pages/ChampionsPage.jsx` 가 쓰는 세대 표기 함수(`generationText`)로 통과시킨다. 그 함수의 위치는 `grep -rn "generationText" src` 로 찾는다.
- 확인: `?view=titles` → 1대 챔피언 메달을 누른 시트 제목이 "1대 챔피언".

**T-28 주인 없는 칭호 시트** (K-16)
- 파일: `src/pages/TitlesPage.jsx`, `TitleSheet` 의 주인 목록
- 현재: "주인 0명" 제목 아래 "아직 주인이 없습니다."
- 바꿈: 주인이 0명이면 "주인 0명" 제목을 그리지 않고 빈 상태 한 줄만
- 확인: `?view=titles&tab=type` 의 꺼진 메달을 누른 시트.

**T-29 시트 맨 아래 링크 공유의 위 간격** (K-08)
- 파일: `src/styles/titles.css`, `.tl-sheet-sec { margin-top: var(--s8); }` 가 링크 공유에도 걸려 32. 트레이너·포켓몬 시트는 20.
- 바꿈: 칭호 시트의 링크 공유 묶음 `margin-top` 을 `var(--s5)` 로 (그 요소의 클래스는 `TitlesPage.jsx` 의 `<ShareHere>` 를 감싼 것을 본다)
- 확인: 칭호 시트에서 마지막 목록 bottom → 링크 공유 top = 20.

**묶음 3 끝 확인:** `--only REC-02,REC-09,REC-10,REC-14,REC-05,TTL-01,TTL-04 --vp core`.

---

### 묶음 4. 공지, 게시판, 대진표, 홈, 소개, 알림

**T-30 자유 글 본문과 댓글을 709로** (K-02)
- 파일: `src/styles/posts.css`, `@media (min-width: 860px)` 의 `.bd-art.many .bd-cmts { max-width: 709px; }` 근처
- 바꿈: 자유 글(샘플·파티 글이 아닌 글)의 `.bd-body` 와 `.bd-cmts` 에 `max-width: 709px`. 자유 글의 `<article>` 클래스는 `src/pages/BoardPage.jsx` 의 `PostView` 에서 확인하고, 샘플(`.bd-art.one`)과 파티(`.bd-art.many`)의 배치는 건드리지 않는다.
- 확인: `?view=board` → 글 하나, 1440과 1920. `.prose` 폭 709, 유튜브 임베드 709, 댓글 패널 709, 댓글 폼의 등록 키가 폼 오른쪽 끝(709 선). 390은 전과 같다.

**T-31 데스크톱 댓글 키 폭** (K-15)
- 파일: `src/styles/posts.css`, `.bd-act { min-height: var(--h-control); … padding: 0 var(--s1); … }`
- 바꿈: `min-width: var(--h-control);` 추가, `text-align: center` 가 필요하면 함께
- 확인: 1440에서 답글, 수정, 삭제, 신고 각 폭 ≥ 44. 390에서 댓글 머리 줄이 전보다 더 꺾이지 않는다(C-05는 T-78).

**T-32 게시판 행의 글쓴이와 날짜** (C-15)
- 파일: `src/pages/BoardPage.jsx` 의 자유 목록 행, `src/styles/posts.css` `.bd-day { margin-left: var(--s2); }`
- 바꿈: 공지("고정, 11.16 월")와 대진표 줄처럼 쉼표로 잇는다: "트레이너, 11.22 일". `.bd-day` 의 margin-left는 지운다.
- 확인: `?view=board` 390과 1440.

**T-33 신청 수정의 오류 자리** (A-16)
- 파일: `src/pages/NewsPage.jsx`, 신청 수정 단계의 비밀번호 `Question` (힌트 `<p>` 가 children으로 들어가 오류보다 앞에 그려짐)
- 바꿈: 오류가 있을 때는 힌트 `<p>` 를 그리지 않는다
- 확인: 공지 → 신청 수정 → 두 칸이 빈 채로 `신청 불러오기` (빈 칸이면 서버에 가지 않는다). 두 칸 모두 칸 bottom → 오류 top = 8.

**T-34 검색 결과 없음** (K-16, K-17)
- 파일: `src/pages/NewsPage.jsx`, 검색 결과가 없을 때의 `<Empty>` 와 "최근 공지"
- 바꿈: Empty의 둘째 줄("'…'에 맞는 공지를 찾지 못했습니다.")을 지운다. "최근 공지" 라벨을 다른 섹션과 같은 `SectionHead` (h2 20)로.
- 세그먼트 "0건"은 T-76에서 뺀다.
- 확인: `?view=news` 에서 "없는말" 검색, 390과 1440.

**T-35 알림 종류 판의 마지막 칸** (K-12)
- 파일: `src/styles/board.css`, `.push-board { grid-template-columns: 1fr 1fr; }` 아래에 추가
- 추가: `.push-cell:last-child:nth-child(odd) { grid-column: 1 / -1; }` (칸 클래스 이름은 `PushControl.jsx` 의 `PushBoard` 에서 확인)
- 확인: `?view=alerts` 390과 1440. 판에 빈 칸이 없다.

**T-36 404의 갈 곳 셋** (K-12)
- 파일: `src/styles/board.css`, `.status-links { grid-template-columns: repeat(2, minmax(0, 1fr)); }` 와 `.status-links > :first-child:nth-last-child(odd) { grid-column: 1 / -1; }`
- 바꿈: 둘째 규칙을 지우고 첫째를 `repeat(3, minmax(0, 1fr))` 로
- 확인: `/?view=nothing-here` 390과 1440. 공지, 대진표, 기록 세 키가 같은 폭. 500 화면(키 수가 다르면)은 `StatusPage.jsx` 에서 키 수를 확인하고 2개면 `repeat(2, …)` 가 유지되게 `:has` 로 나눈다.

**T-37 소개 리드 판의 빈 띠** (A-20a)
- 파일: `src/styles/hall.css`, `.ab-lead { display: grid; gap: var(--s3); align-content: start; padding: var(--pad); }`
- 바꿈: `.ab-lead > :last-child { margin-top: auto; }` 를 추가하고 `.ab-lead` 를 `align-content: stretch` 가 되게(grid면 `grid-template-rows` 마지막을 `1fr` 로 두고 마지막 자식에 `align-self: end`). 디스코드 키가 판의 바닥에 선다.
- 확인: `?view=about` 1440. 디스코드 키 bottom → 판 bottom = `--pad` (20).

**T-38 개인정보 번호 목록 내어쓰기** (A-28)
- 파일: `src/styles/pages.css` 의 `.prose` 목록 규칙 (없으면 `Prose.jsx` 가 번호 줄을 어떻게 그리는지 보고, 번호 줄이 `<p>` 면 손대지 않고 보고한다)
- 확인: `?view=privacy` 1440 제1조 5항의 둘째 줄이 첫 줄 글자와 같은 x에서 시작.

**묶음 4 끝 확인:** `--only NEWS-01,NEWS-05,BOARD-01,BOARD-02,BOARD-09,ALERT,ABOUT-01,SHELL-10,PRIV-01 --vp core`.

---

### 묶음 5. 팀 빌더, 계산기

**T-39 능력 포인트 슬라이더 높이 (휴대폰)** (K-15)
- 파일: `src/styles/builder.css`, `.tb-stat-row { … min-height: var(--h-strip); }` 아래에 추가
- 추가: `@media (max-width: 859px) { .tb-stat-row { min-height: var(--h-control); } }`
- 확인: `?view=builder` 390, 포켓몬을 고른 편집기. 여섯 행 각 44, range 입력의 높이 ≥ 44. 계산기의 `.calc-stat-row` (44)와 같다.

**T-40 기술 칸의 회색 줄** (D-05)
- 파일: `src/styles/builder.css` 끝에 추가
- 현재: `.tb-move-meta` 가 `t12 reg dim` 인데 `board.css` 의 `.cell > span:not(.cell-label)` (15/20/600 nowrap ellipsis)에 덮인다
- 추가: `.cell > .tb-move-meta { font-size: var(--t12); line-height: var(--l12); font-weight: 400; white-space: normal; }`
- 확인: 390에서 기술을 고른 칸의 회색 줄이 12/16/400이고 "명중", "PP"가 잘리지 않는다. 칸 넷의 높이가 서로 같다(한 칸만 두 줄이 되어 높이가 달라지면 `min-height` 대신 보고한다).

**T-41 도감 종족값 범위 두 줄** (D-06)
- 파일: `src/styles/calculator.css`, `.calc-base-row { … grid-template-columns: var(--s5) minmax(0, 1fr) var(--s8) calc(var(--s21) - var(--s5)); … }`
- 추가: `@media (min-width: 860px) { .calc-base-row { grid-template-columns: var(--s5) minmax(0, 1fr) var(--s8) var(--s21); } .calc-base-row > :last-child { white-space: nowrap; } }`
- 확인: `?view=calc&tab=dex` 1440과 1100에서 포켓몬을 고른다. 범위 칸("183 ~ 215")이 한 줄, 행 높이 32.

**T-42 저장 독의 자리** (D-09)
- 파일: `src/styles/team-builder.css` (또는 `builder.css`) 의 860 이상 구역에 추가
- 추가: `.tb-main-column > .dock { margin-top: 0; }`
- 현재: 기술 칸 끝 → 독 52, 독 → 규정 검사 20. 독이 자기가 저장하는 편집기보다 아래 패널에 가깝다.
- 확인: 1440에서 기술 칸 bottom → 독 top = 20, 독 bottom → 규정 검사 top = 20.

**T-43 빈 요소가 먹는 간격 셋** (K-13)
- (a) `src/styles/builder.css`, 860 이상의 `.tb-rules:not(:has(.tb-rule-group:nth-child(3))) { grid-template-columns: minmax(0, 1fr); }` → `{ display: none; }`. 확인: 1440 규정 줄 bottom → "포켓몬 선택" top = 20 (현재 40).
- (b) `src/pages/TeamBuilderPage.jsx`, `<p className="tb-field-meta">` 를 문구가 있을 때만 그린다. 확인: 390과 1440에서 특성·도구·성격 칸 → "능력 포인트" = 32 (현재 44).
- (c) `src/styles/team-builder.css` 에 추가: `.official-submission > ul { margin-top: 0; }`. 확인: `?view=builder&eventId=4379f233-b441-43ba-8c05-581d6c07af05` 에서 이름 칸 → 오류 줄 = 20 (현재 32).

**T-44 규정 검사 패널의 왼쪽 선** (D-10)
- 파일: `src/styles/team-builder.css` 의 `.tb-validation…` 규칙들
- 현재: 제목 x 172, 위반 줄 글자 168, 아이콘 없는 줄 140 (1440)
- 바꿈: 아이콘과 글자 사이를 두 곳 모두 `var(--s3)` 로 맞추고, 아이콘 없는 `li` 에 `padding-left: calc(var(--s5) + var(--s3))`
- 확인: 위반 상태(report D의 추가 장면: 텍스트로 가져오기에 `Rotom-Wash` 와 어흥염 `Knock Off`)에서 세 종류 줄의 글자 left가 같다. 390과 1440.

**T-45 규칙 변경 확인의 목록** (D-23)
- 파일: `src/styles/team-builder.css`, `.tb-rule-confirm-list { margin: var(--s3) 0; padding: var(--s3) var(--s5) var(--s3) var(--s13); … }`
- 바꿈: `list-style: none; padding: var(--s3) var(--pad);`
- 확인: 팀이 있는 상태에서 규정을 모노타입으로 바꿔 시트를 연다. 점이 없고 글자 left가 시트의 다른 글자와 같다.

**T-46 계산기 기술 칸의 2px 어긋남** (D-14)
- 파일: `src/styles/team-builder.css`, `.pick-type` 계열의 `height: 24px;`
- 바꿈: 칸 안의 태그에 한해 `.pick-field .pick-type { height: var(--l15); }` 추가 (목록 시트의 태그 24는 그대로)
- 확인: `?view=calc` 1100에서 기술 하나만 고른 줄. 채운 칸과 빈 칸의 라벨 top이 같다.

**T-47 대결 칸 이름 줄** (D-15)
- 파일: `src/styles/calculator.css`, `.calc-vs-band { display: grid; align-content: center; gap: var(--s1); padding: 0 var(--pad); }`
- 바꿈: `align-content: start; padding: var(--s2) var(--pad) 0;`
- 확인: 한쪽만 고른 상태에서 두 칸의 첫 줄 top이 같다(390, 1440). 양쪽 다 고른 상태에서 띠 높이가 전과 같은지 본다. 띠가 낮아지면 `min-height` 로 전 높이를 지킨다.

**T-48 내 팀 시트의 버튼 두 줄 사이** (D-22)
- 파일: `src/styles/builder.css`, `.tb-library-text { grid-template-columns: 1fr 1fr; margin-top: var(--s2); }`
- 바꿈: `margin-top: var(--seam);`
- 확인: 내 팀 시트에서 버튼 두 줄 사이 2.

**묶음 5 끝 확인:** `--only BLD,BLD-13,CALC-02,CALC-05,CALC-06 --vp core` 와 1099x900, 1100x900.

---

### 묶음 6. 관리자

**T-49 포인트 시트 간격** (K-13)
- 파일: `src/styles/admin.css`, `.ad-points { display: grid; gap: var(--s3); margin-top: var(--s5); }`
- 바꿈: `gap: 0;` (Field의 margin-bottom 20과 SectionHead의 12만 남는다)
- 확인: 오프라인 서버 `?view=admin` → 포인트. 입력 bottom → 다음 라벨 top = 20, 제목 bottom → 첫 라벨 top = 12.

**T-50 빈 상태 판 높이** (G-15)
- 파일: `src/styles/admin.css`, `.ad-event-head, .ad-none { display: grid; gap: var(--s1); padding: var(--s3) var(--pad); }` 아래에 추가
- 추가: `.ad-none { min-height: var(--h-row); align-content: center; }`
- 확인: "지금 할 일이 없습니다." 판 높이 52.

**T-51 성적 수정 표 머리** (G-18)
- 파일: `src/styles/admin.css`, `.ed-head span:first-child { text-align: left; }`
- 바꿈: `.ed-head span:first-child { text-align: left; padding-left: var(--s3); }`
- 확인: "트레이너" 머리 글자와 그 아래 입력 글자의 left가 같다.

**T-52 랭킹 탭 운영 키 두 줄 사이** (G-07)
- 파일: `src/styles/records-board.css` 에 추가: `.rc-rank > .rc-admin { margin-top: var(--seam); }` (`.rc-admin` 의 기존 `margin-bottom: var(--s5)` 는 그대로)
- 확인: 관리자 상태 `?view=records&tab=rank`. 시즌 추가/누적 탭 추가 줄 bottom → 성적 수정 줄 top = 2.

**T-53 대회 설정 묶음의 아래 여백** (K-13)
- 파일: `src/admin/editors/AdminEditors.jsx`, 대회 설정 묶음 안의 마지막 `Field` (`flush` 가 없어 margin-bottom 20이 묶음 padding에 더해져 아래 40)
- 바꿈: 묶음의 마지막 Field에 `flush` (Field가 이 prop으로 margin-bottom을 0으로 만드는지 `Field.jsx` 에서 확인)
- 확인: 공지 작성 → 대회 신청 받기 → 대회와 연결. 묶음의 위 여백과 아래 여백이 둘 다 20.

**묶음 6 끝 확인:** 오프라인 서버에서 관리자 화면을 390과 1440으로 찍고, 운영 데이터는 `--login --set admin --vp core` 로 사용자와 함께 한 번 찍는다.

---

### 묶음 7. 모션과 상호작용

**T-54 떠나는 페이지의 어두워짐을 leave로** (F-10)
- 파일: `src/styles/shell.css`, `.page.is-going { opacity: var(--opacity-disabled); transition: opacity var(--move-tone); pointer-events: none; }`
- 바꿈: `var(--move-tone)` → `var(--move-leave)` (260ms ease-in. DESIGN.md Motion 표의 leave, `motion.js` 의 `dimAway` 와 같은 값)
- 확인: probe로 `main.page` 의 computed `transition-duration` 이 0.26s, `transition-timing-function` 이 `cubic-bezier(0.5, 0, 0.75, 0)`.

**T-55 낱말 키의 누름과 세그먼트의 바탕 전환** (F-09)
- 파일: `src/styles/board.css`, `.sh-link, .btn--link, .site-foot-dc, .site-foot-login, .site-foot-admin { transition: color var(--move-tone); }`
- 바꿈: `transition: scale var(--move-press), color var(--move-tone);`
- 파일: `src/styles/components.css`, `.seg-track > button` 규칙의 `transition: scale var(--move-press), color var(--move-tone);`
- 바꿈: `transition: scale var(--move-press), background-color var(--move-tone), color var(--move-tone);`
- 확인: 홈의 `전체 보기` 를 누르고 20ms, 60ms, 110ms의 `scale` 이 .976으로 점차 간다(20ms에 이미 .976이면 실패). 세그먼트에서 다른 칸을 고르면 바탕이 160ms로 바뀐다.

**T-56 주 행동 키와 홀로 선 조작의 호버** (F-08)
- 파일: `src/styles/board.css`, `.btn.btn--main { --btn-bg: var(--lit); --btn-bg-hover: var(--lit); --btn-fg: var(--ground); … }`
- 바꿈: `--btn-bg-hover: var(--dim);` (다른 반전 패널이 호버에서 쓰는 한 단계: 같은 파일의 `:is(button, a).inv:hover:not(:disabled) { background: var(--dim); … }`)
- 파일: `src/styles/components.css`, `.dd-btn` 규칙 묶음 뒤에 추가: `@media (hover: hover) { .dd-btn:hover:not(:disabled) { background: var(--panel-2); } }` (칸 안의 드롭다운은 `board.css` 의 `.cell` 규칙이 이미 답한다. 그 규칙이 여전히 이기는지 확인한다)
- 파일: `src/styles/board.css`, `.search-in` 규칙 묶음 뒤에 추가: `@media (hover: hover) { .pn.search-in:hover { background: var(--panel-2); } }` (시트 안은 `components.css` 의 `.sheet .pn.search-in:hover` 가 이미 `--rule`)
- 확인: 1440에서 실제 마우스를 올리기 전후 `background-color` 가 달라진다: 게시판 `글쓰기`, 기록의 "모든 시즌" 드롭다운, 공지 검색 칸. 꺼진 키(`:disabled`)는 변하지 않는다. 라이트에서 `--dim` 위의 글자(`--ground`)가 읽히는지 본다.
- 상단 바의 로고, 내 기록, 진행 중, 테마 키는 그대로 둔다(T-97).

**T-57 대회 탭 이름 링크의 누르는 폭** (F-13)
- 파일: `src/styles/records.css`, `.rc-name-link::after { content: ""; position: absolute; inset: -12px -4px; }`
- 바꿈: `inset: calc(var(--s3) * -1) calc(var(--s2) * -1);` (가로 42 → 50)
- 확인: `?view=records&tab=tour` 390. 이름 링크의 누름 상자 폭 ≥ 44. 한 줄에 이름이 둘 이상 있는 행(4강)에서 옆 이름의 상자와 겹치지 않는지 본다. 겹치면 되돌리고 보고한다.

**T-58 DESIGN.md의 표를 실제와 맞춤** (F-12)
- 파일: `DESIGN.md` "Motion"의 표, light 줄의 Length `420 in all`
- 바꿈: `420 a panel, about 680 until the last has lit` (같은 장의 "First open" 문단이 이미 "38 apart (the stagger stops growing at 260), each rising 12 into place over 420"이라고 적는다. 코드는 바꾸지 않는다)
- 확인: 글만 바뀐다.

**묶음 7 끝 확인:** `node scripts/record-transition.cjs` 로 페이지 이동(`?view=news` 에서 상단 바 `기록` 누르기)을 `--cpu 1 --every 40` 으로 녹화해 before와 after의 프레임 시트를 나란히 본다. 줄인 움직임(`scripts/visual-audit-probe.cjs … --reduced`)에서 transform 애니메이션이 여전히 0개.

시트가 올라오는 첫 프레임(F-02), 첫 방문 홈의 내용 바뀜(F-03), 탭을 바꿀 때 검색 칸까지 다시 켜지는 것(F-04), 접힘의 닫힘(F-07), 폼 오류로 대화상자가 뛰는 것(F-06)은 값이 아니라 구조를 바꾸는 일이라 5장 묶음 14(T-92~T-96)에 있다.

## 4. 끝났는지 확인하는 법 (전체)

1. `npm test` 통과, `npm run build` 에 경고 없음.
2. `node scripts/visual-audit.cjs --set public,inner,sheet --vp all` 과 `--vp edges --theme dark` 를 다시 돌려 `measure.jsonl` 에서 `overflow` 0건, 글자 크기 종류가 1장의 다섯 가지뿐.
3. before와 after를 화면 ID별로 나란히 본다. 달라진 곳마다 이 문서의 작업 번호를 댈 수 있어야 한다. 번호를 댈 수 없는 변화는 되돌린다.
4. 색, 폰트, 패널 모양, 그림자가 달라진 화면이 하나도 없어야 한다.
5. 사용자가 직접 써 본다: 휴대폰(390)과 데스크톱(1440)에서 홈 → 공지 → 신청서, 기록 → 트레이너 시트, 대진표 → 경기 시트, 팀 빌더 저장, 컴퓨터 배틀 한 판.

---

## 5. 판단이 들어가는 작업 (2026-11-23 추가)

**배경.** 3장의 작업을 다 해도 "버그 없는 기계적인 사이트"가 된다. 진단의 큰 덩어리는 값이 틀린 곳이 아니라 **규칙을 판단 없이 끝까지 적용한 곳**이었다(1200을 다 쓰라는 규칙 → 50px 글자에 1200 폭 드롭다운, 두 단의 끝 선을 맞추라는 규칙 → 빈 띠, 모든 행동은 52 면이라는 규칙 → 같은 무게로 쌓인 키 넷). 사용자는 이 진단에 동의했고, `questions.md` 의 항목을 **모두 권한 쪽으로 확정**하라고 맡겼다("너의 추천안대로 해줘"). 아래가 그 확정이다. 3장을 먼저 끝낸 뒤에 한다.

**원칙의 검증.** 네 원칙을 기록 트레이너 탭과 공지 글에 스타일만 덮어씌워 전후를 찍어 확인했다(`docs/visual-audit/shots/_drafts/*-pair.png`, 왼쪽이 지금, 오른쪽이 적용). 색, 폰트, 패널 모양은 그대로이고 조작의 폭과 순서만 달라진다. 이 사진이 "같은 사이트가 더 정돈됐다"의 기준이다.

**여기서도 지킬 것.** 0장의 금지는 그대로다. 새 색, 새 글자 크기, 새 간격 값을 만들지 않는다. 구조(JSX)를 고치는 작업은 그리는 순서와 클래스만 바꾸고, 데이터와 동작은 건드리지 않는다. 작업에 적힌 "끝난 것의 기준"을 수치로 채우지 못하면 멈추고 보고한다.

### 묶음 8. DESIGN.md 개정 (코드보다 먼저, 커밋 하나)

**T-59 "Composing a screen"에 27~30을 더한다**
- 파일: `DESIGN.md`, "Composing a screen"의 26번 문단 바로 뒤, "## Made by people" 앞에 아래 문단을 그대로 넣는다.

```markdown
**Judged, not only measured** (2026-11-23: a whole-site audit found the numbers kept everywhere and the screens still reading as machine-made, because rules were carried out to the letter where the content asked for less; the owner: "기계적으로 체계를 지키고 있기 때문이 아닐까")

27. **A control is as wide as what it holds.** On desktop a search field may take the room that is left, but a select, a row of chips or a key is as wide as its words (a select 220, a key its word and its padding, 44 or 52 high), and it stands beside what it acts on, never across the 1200 from it. The 1200 belongs to lists, boards and panels. A select of one short word stretched across the page, or a key 760 from the field it submits, is a phone layout stretched. Reading (a post, a note under a table) stays inside the 709.
28. **Actions are ranked on the screen as they are in use.** One main action (52, inverted) a screen. What is used next stands as second actions (52). What is used now and then (a share, a calendar file, a rare cancel) stands smaller: a 44 key in a row, or an underlined word. Keys of different rank never stack as equal planes, and the rarest act is never the widest key.
29. **Nothing is stretched to make a line meet.** Two columns end on one line when their content lets them. A panel is never lengthened into a band without ink, a grid is never padded with empty panels, and a row is never widened so that its end reaches an edge: the shorter thing ends short. (This is rule 26 read strictly; a medal board's columns follow the number of its medals.)
30. **The seam joins one kind.** 2 stands between panels of one kind (rows of a list, cells of a board, keys of one row). Two different kinds of thing (a row of chips and a select, a list and the key under it) stand 12 apart or more, even when both are panels.
```

- 같은 파일 "Space" 장의 문장 "A page of one list or one kind of panel (공지, 기록, 칭호, 명예의 전당, 게시판, 소개) uses the whole 1200, so its head's right end and every row end on the bar's right edge, a short bracket tree included." 바로 뒤에 한 문장을 더한다: `Its controls do not: a search, a select and a key follow Composing a screen 27.`
- 같은 파일 "Sheets, dialogs, toasts"의 "then its actions as planes along the bottom edge, a word action standing as a second action panel." 뒤에 더한다: `On desktop a sheet's single utility key (링크 공유) is as wide as its word, at the sheet's end edge.`
- 같은 파일 "Hierarchy"의 Actions 문장 "a destructive confirm is the main action too, its sentence says what it destroys." 를 다음으로 바꾼다: `a destructive confirm is the main action too, without the ✓ (a ✓ says done; a delete is not a thing done well), its sentence says what it destroys, and the keyboard's focus starts on the way back.`
- 확인: 글만 바뀐다. `npm test` (문서 법 테스트가 있으면 통과).

### 묶음 9. 조작의 폭 (원칙 27)

**T-60 기록 트레이너 탭: 검색, 칩, 시즌을 한 줄로** (K-01, Q-03)
- 파일: `src/styles/records-board.css` 의 860 이상 구역
- 구조(확인됨): `.rc-list` 의 직계 자식이 `.search`, `.stack.rc-sort`(안에 `.chips` 와 `.dd`), `.rc-tops`, `.rc-legend`, `.rc-table`, `.rc-more` 순이다.
- 추가:
  ```css
  @media (min-width: 860px) {
    .rc-list { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: var(--s3); }
    .rc-list > * { grid-column: 1 / -1; }
    .rc-list > .search { grid-column: 1; }
    .rc-list > .rc-sort { grid-column: 2; grid-row: 1; display: flex; align-items: center; gap: var(--s3); margin-top: 0; }
    .rc-sort .dd { width: calc(var(--s21) * 2 + var(--s13)); }
  }
  ```
- 시즌이 하나뿐이라 드롭다운이 없을 때도 칩이 검색 오른쪽에 선다. 대회 탭(`TournamentArchiveView`)은 칩이 먼저, 검색이 나중이라 순서가 다르다: 같은 줄 배치를 그 탭에도 준다(검색 왼쪽, 칩 오른쪽). 칩이 많아(투어 수) 한 줄에 안 들어가면 칩은 검색 아래 줄에 그대로 두고 간격만 12로 한다.
- 랭킹 탭의 시즌 드롭다운: 860 이상에서 폭 220, 왼쪽 정렬(`.rc-season .dd { width: calc(var(--s21) * 2 + var(--s13)); }`). 메뉴(`.dd-menu`)는 버튼 폭을 따른다.
- 끝난 것의 기준(1440): 검색 칸, 칩 줄, 드롭다운의 세로 가운데가 같은 y(±1). 드롭다운 폭 220, 오른쪽 끝 1320. 검색 칸 높이 52 그대로. 390은 T-26의 결과(세 줄, 간격 12)와 같다. 시안: `_drafts/rec-1440x900-pair.png`.

**T-61 사설 대진표의 도구 키를 공식 대진표와 같게** (K-01, C-03)
- 파일: `src/pages/BracketsPage.jsx` 의 사설 대진표 보기(도구 키 묶음 `stack bk-actions`), `src/styles/brackets.css`
- 바꿈: 860 이상에서 공식 대진표가 쓰는 제목 줄 구조(`.bk-open-row` 안의 `.bk-tools`, 높이 44, 폭은 낱말만큼)를 사설에도 쓴다. 키의 순서를 공식과 같게: 링크 공유, QR(있으면), 우승 이미지, 대진표 이미지, 그 뒤에 사설만의 키(결과 입력, 수정, 삭제). 휴대폰은 지금의 2열 격자 그대로.
- 끝난 것의 기준(1440): 사설 도구 키 각 높이 44, 폭 120 이하, 제목과 같은 줄의 오른쪽 끝. 묶음 높이 160 → 44.

**T-62 운영 진입 키를 제목 줄의 링크로** (K-01, G-06, G-07)
- 대상: 칭호 추가(`TitlesPage.jsx`), 이전 챔피언 추가(`ChampionsPage.jsx`), 회차 편집·시즌 추가·누적 탭 추가·성적 수정·랭킹 수정(`RecordsPage.jsx`), 첫 대진표 만들기(`BracketsPage.jsx`)
- 바꿈: 공지 작성과 새 대진표가 이미 쓰는 방식으로 통일한다: 그 화면 제목 줄(h1 줄 또는 해당 섹션의 `SectionHead`) 오른쪽 끝의 밑줄 링크(`btn--link` / `sh-link`, 12단 600). 여러 개면 한 줄에 `gap: var(--s5)` 로 나란히. 누르는 높이는 44를 지킨다(기존 링크와 같은 방식).
- 대진표 삭제(`bk-delete`, 1200 폭 한 낱말): 860 이상에서 오른쪽 끝에 낱말 폭 + 좌우 20의 second 키(52)로. `justify-self: end; width: auto`.
- 끝난 것의 기준(1440, 관리자): 위 키 중 폭이 200을 넘는 것이 없다. 랭킹 탭 목록 위의 1200x104 덩어리가 사라지고 시즌 드롭다운과 같은 줄에 링크가 선다.

**T-63 데스크톱 시트의 맨 아래 키** (K-08, Q-06)
- 파일: `src/pages/RecordsPage.jsx`(트레이너·포켓몬 시트의 링크 공유), `src/pages/TitlesPage.jsx`, `src/components/ShareHere.jsx`, 해당 CSS
- 바꿈: 860 이상에서 시트의 링크 공유 키는 낱말 폭 + 좌우 20, 시트 안쪽 오른쪽 끝(`justify-self: end; width: auto`). 휴대폰은 전폭 그대로.
- 챔피언 시트의 "○○ 기록 보기"(`hof-sheet-act`)를 파티 시트와 같은 `.modal-actions` 로 바꾼다(한 주 행동은 붙박이 면).
- 끝난 것의 기준(1440): 링크 공유 폭 160 이하. 챔피언 시트와 파티 시트의 "기록 보기" 키가 같은 자리, 같은 폭.

**T-64 대진표 마법사와 팀 빌더 규정** (K-01, D-07)
- 대진표 마법사 1단계(`BracketsPage.jsx` `BracketWizard`): 860 이상에서 입력 열을 709로 줄여 취소·다음(439 열)과 52 간격으로 나란히 서게 한다(공지의 신청서와 같은 709 + 439).
- 팀 빌더 규정 줄(`builder.css` `.tb-rules-line { grid-template-columns: repeat(2, minmax(0, 1fr)); }`): 1100 이상에서 `minmax(0, 439fr) minmax(0, 709fr)`, `column-gap: var(--s13)` 로 아래 두 단과 같은 선에.
- 끝난 것의 기준: 팀 빌더 1440에서 규정 두 칸의 경계 x가 아래 두 단의 경계(559 / 611)와 같다.

**T-65 계산기 데스크톱** (D-16, Q-15)
- 스피드 탭: 860 이상에서 기준 패널과 조건(Segmented, 칩, 설명 문단)을 439 열에 `position: sticky` 로 붙들고 속도 줄 목록을 709 열에 세운다. 도감 탭: 종족값과 방어 상성을 439, 기술 표를 709.
- 끝난 것의 기준(1440): 속도 줄에서 이름과 종족값 사이 빈칸이 960 → 480 이하. 기술 표의 "기술"과 "타입" 사이 394 → 200 이하.

### 묶음 10. 행동의 순서 (원칙 28)

**T-66 위험한 확인 창의 키** (K-08, Q-01)
- 파일: `src/components/common/SiteDialog.jsx`
- 바꿈: `current.danger` 이거나 `current.kind === "alert"` 이면 확인 키의 `icon="check"` 를 넘기지 않는다. `danger` 이면 `autoFocus` 를 확인 키가 아니라 취소 키에 준다. 키의 변형(`variant="main"`), 문구, 순서는 그대로.
- 파일: `src/styles/battle.css` `.bt-forfeit.btn { --btn-bg: #4A1820; --btn-bg-hover: #6A2230; --btn-fg: #FFFFFF; … }`: 색은 그대로 두되 손대지 않는다(새 토큰을 만드는 일이라 이 계획 밖이다).
- 끝난 것의 기준: 공지 삭제, 팀 초기화, 기권 확인 창의 실행 키에 체크가 없고, 창이 열릴 때 초점이 취소에 있다. 저장·승인 같은 일반 확인은 체크와 초점이 전과 같다.

**T-67 공지 글의 보조 키** (A-10, Q-09)
- 파일: `src/pages/NewsPage.jsx`(글 보기의 `.nw-more`), `src/styles/news.css`
- 바꿈: 키를 두 묶음으로 나눈다. **신청 묶음**(신청 수정, 파티 제출, 선발전·본선 파티 제출): 52 second 키, 세로로. **쓰임새 묶음**(캘린더에 추가, 링크 공유, 링크 1·2): 한 줄에 나란히 44 높이, `grid-template-columns: repeat(auto-fit, minmax(0, 1fr))`, 간격 2. 두 묶음 사이 12(원칙 30). 쓰임새 묶음에는 클래스 `nw-utils` 를 준다.
- 휴대폰(859 이하): 신청 묶음만 스펙 행 바로 아래, 본문 앞으로 올린다(`.nw-more` 의 `order` 를 본문보다 앞으로, 위 간격 20). 키가 둘이면 한 줄 두 칸, 44 높이. 쓰임새 묶음은 본문 뒤 그대로.
- 끝난 것의 기준: 1440에서 옆 단의 52 키가 주 키 포함 최대 셋(주 키, 신청 수정, 파티 제출), 캘린더와 링크 공유는 44. 390에서 파티 제출 키의 top이 본문 첫 줄보다 위. 시안: `_drafts/news-1440x900-pair.png`, `_drafts/news-390x844-pair.png` (시안은 키를 뜻이 아니라 순서로 골라 "파티 제출"이 작게 찍혔다. 위 글이 기준이다).

**T-68 게시판 샘플·파티 글의 수정과 삭제** (C-12, Q-13)
- 파일: `src/pages/BoardPage.jsx`
- 바꿈: 수정, 삭제를 자유 글과 같은 메타 줄의 글자 키(`.bd-act`)로 옮기고, 큰 키 격자(`.bd-bar`)에는 이미지 저장과 링크 공유만 둔다.
- 끝난 것의 기준: 세 종류 글에서 수정·삭제·신고가 같은 자리, 같은 크기.

**T-69 관리자: 대회 진행 패널과 대진표 운영 줄** (G-03, G-13, Q-16)
- `src/admin/AdminPage.jsx` `EventPanel`: 대회 취소를 `variant="link"` 로 패널 오른쪽 아래에(위 간격 12). 접수 단계의 주 키는 신청 현황(`variant="main"`), 지금 마감은 second. 두 키의 비 1(지금 마감) : 1.618(신청 현황) 그대로.
- `src/pages/BracketsPage.jsx` 의 기록 반영 뒤 줄: "기록 반영됨"(왼쪽)과 링크 둘("칭호 다시 판정", "반영 취소", 오른쪽 끝, `gap: var(--s5)`)을 이미지 키들과 다른 한 줄에 `display: flex; justify-content: space-between; align-items: baseline` 로.
- 끝난 것의 기준: 대회 진행 패널에서 가장 넓은 키가 신청 현황. 운영 줄의 세 요소 글자 기준선 y가 같다(±1).

**T-70 트레이너 시트의 "내 기록 연결"** (B-18e, Q-14)
- 파일: `src/pages/RecordsPage.jsx` 트레이너 시트: "내 기록 연결" 섹션을 최근 대회와 사용한 파티 사이에서 맨 아래 링크 공유 바로 위로 옮긴다. 내 기록 찾기 모드(`me=1`)에서 맨 위에 서는 리드(`TrainerLink lead`)는 그대로.

### 묶음 11. 늘리지 않기 (원칙 29)와 관계의 간격 (원칙 30)

**T-71 메달 판과 역대 챔피언 벽의 마지막 줄** (K-12, Q-05)
- `src/components/TitleFaces.jsx` `MedalBoard`: 빈 패널로 채우는 코드를 지운다. `src/pages/TitlesPage.jsx` 의 `COLS`: 메달 수가 열 수보다 적은 마지막 줄이 생기면 열 수를 메달 수의 약수 또는 메달 수로 맞춘다(파트너 7개 → 데스크톱 7열, 기타 3개 → 3열, 이벤트 8개 → 4열 두 줄). 판의 폭은 열 수 x 칸 폭으로 줄고 왼쪽 정렬한다(1200을 채우려고 칸을 넓히지 않는다. 칸 폭은 지금의 값).
- `src/styles/hall.css` `.hof-wall`: 1440에서 5명이면 5열 한 줄(`repeat(5, …)`), 6명 이상이면 3열. 열 수는 사람 수로 정한다(JSX에서 `--n` 을 넘기고 CSS가 읽는다. 홈의 벽이 이미 `--n` 을 쓴다).
- 끝난 것의 기준: 칭호의 어느 탭에도 `.off` 도 메달도 아닌 빈 패널이 없다. 명예의 전당 1440과 768에서 벽에 빈 칸이 없다.

**T-72 챔피언 시트의 빈 반전 패널** (A-05, Q-14)
- 파일: `src/components/common/ChampionSheet.jsx`: 세트(`sets`)가 없는 우승은 `Modal` 의 `className="wide"` 를 빼 576 폭으로 연다(여섯 그림만 있으므로 좁은 시트에 맞다). 세트가 있는 우승은 `wide` 그대로 두되 860 이상에서 인장(`.hof-seal`)을 439, 그 오른쪽 709에 이름·시즌·"기록 보기"를 둔다.
- 끝난 것의 기준(1440): `.hof-seal` 안에서 잉크 없는 가로 띠가 40을 넘지 않는다.

**T-73 소개의 두 단과 리드 판** (A-20)
- `src/styles/hall.css`: 리드 판 분할을 홈과 같은 식으로(`home.css` 의 `.ho-screen` 식 `minmax(0, 1fr) calc((100% - var(--s13)) * 439 / 1148)`). "세 가지 대회"와 "정규 리그" 두 단은 끝 선을 맞추려 늘리지 않는다(원칙 29, 지금대로 122 차이를 둔다).
- `src/pages/AboutPage.jsx`: 단계 번호가 "2", "3"만 있다. 리드 판(디스코드 참여)에 "1"을 준다.

**T-74 홈 히어로** (A-02, A-13, Q-07, Q-08)
- 360에서 시계가 넘침: `src/pages/HomePage.jsx` 대회 당일 분기에서, 폭 389 이하일 때 "시작" 단위(`.ho-unit`)를 시계 옆이 아니라 위 라벨 줄("오늘 대회 진행 중" 뒤)에 그린다. CSS만으로 한다면 `@media (max-width: 389px) { .ho-board.today { flex-wrap: wrap; } .ho-board.today .ho-unit { order: -1; flex-basis: 100%; } }`. 시계는 84 그대로.
- 1440의 72 빈 띠: `src/styles/home.css` 860 이상 `.ho-display { … align-items: end; … }` → `align-items: start`. 대회 당일에는 스펙 행에서 일시 행을 그리지 않는다(시계와 같은 사실, `HomePage.jsx` 의 스펙 행 목록에서 `now.today` 일 때 제외).
- 끝난 것의 기준: 360에서 `.ho-board` 의 right ≤ 패널 안쪽 right, 문서 가로 넘침 없음, 390에서 시계 오른쪽 여백 ≥ 12. 1440에서 이름 블록 bottom → 시계 top이 20.

**T-75 조별 리그와 더블 엘리미네이션** (C-07, C-08, C-09, Q-12)
- 조별 리그(`BracketsPage.jsx` `GroupStageBoard`, `brackets.css`): 조 순위 행 묶음과 조 경기 행 묶음 사이 12(원칙 30). "본선" 머리 아래 12, 위 32. 860 이상에서 조 묶음은 709 열(이름과 "본선 진출"이 1100 떨어지지 않게).
- 휴대폰 목록 보기: 우승 패널을 트리 보기와 같이 맨 위로. `brackets.css` 의 `.bk-board:has(.bk-champ-node) .bk-result > .bk-winner { display: grid; order: -1; margin: 0; }` 에서 `:has(.bk-champ-node)` 조건을 빼고 859 이하 전체에 준다. 데스크톱 목록 보기의 우승 이름도 32/40.
- 더블 엘리미네이션: 열 폭을 정수로(`.bk-tree` 를 grid로 바꾸지 말고, 열에 `flex: 1 1 0` 과 `min-width` 정수, 그리고 `.bk-scroll` 폭이 열 수로 나누어떨어지지 않으면 마지막 열이 나머지를 받는다). 그랜드 파이널과 우승은 "패자조" 머리 밑이 아니라 그 아래 별도 줄에 제 머리("그랜드 파이널")와 함께. 패자조의 선은 그리지 않는다(지금대로).
- 끝난 것의 기준: 더블(`eventId=c34f3629-ad49-4d32-82fb-38d1f989fa13`) 1440에서 모든 `.bk-col2` 의 left와 width가 정수. 조별 리그에서 순위 묶음 bottom → 경기 묶음 top = 12.

**T-76 검색 결과 없음을 한 모양으로** (K-17, Q-11)
- 게시판의 모양(글 한 줄 패널)으로 통일한다. `BracketsPage.jsx` 사설 탭과 `NewsPage.jsx` 의 `<Empty className="search-none"><Seg value={0} cells={2}/>…` 에서 세그먼트를 뺀다(건수는 T-06으로 검색 칸 안에 있다).
- 끝난 것의 기준: 세 화면의 검색 빈 상태가 같은 높이, 같은 구조.

**T-77 공지 목록의 검색 자리** (K-03, Q-08)
- `src/pages/NewsPage.jsx`: 검색 칸을 "다가오는 대회" 섹션 **위**(h1 바로 아래, 간격은 T-79의 값)로 옮긴다. 검색어가 있을 때 "다가오는 대회"를 숨기는 동작은 그대로.
- 끝난 것의 기준: 검색어를 넣기 전후 `.search-in` 의 top이 같다(1440, 390).

**T-78 휴대폰 댓글 머리** (C-05, Q-10)
- `src/pages/BoardPage.jsx` 댓글과 글 머리의 날짜: 639 이하에서 짧은 형식 "11.19 오후 3:12"(연도가 다르면 "25.11.19 오후 3:12")로, `white-space: nowrap`. 날짜 서식은 화면 쪽 함수로 만들고 `src/services/dateFormat.js` 의 기존 함수는 바꾸지 않는다.
- 끝난 것의 기준(390, 360): 모든 댓글 머리가 한 줄(높이 16), 댓글 패널 높이가 이름 길이와 무관.

**T-79 제목 아래 간격을 하나로** (K-05, Q-04)
- h1 아래: 32(`--s8`, "between groups; a page title under the bar"). `news.css` `.nw-upcoming, .nw-search, .nw-list { margin-top: var(--s5); }` 중 h1 바로 다음에 오는 것, `more.css` `.alerts > h1 { margin-bottom: var(--s5); }`, `hall.css` `.ab-screen { margin-top: var(--s5); }` 를 `var(--s8)` 로. 더보기와 기록은 이미 32.
- 탭 줄 아래: 20(`--s5`). `records-board.css` `.rc-body { margin-top: var(--s3); }` → `var(--s5)`. 칭호는 이미 20.
- 뒤로 링크: `news.css`, `brackets.css`, `posts.css` 의 `… > .back:first-child { margin-top: calc(var(--s3) * -1 + (var(--l12) - var(--h-control)) / 2); }` 세 줄을 지운다(신청서와 같은 선, 옆 단의 윗선과 같아진다). 휴대폰에서 LiveStrip과 6 겹치던 것도 풀린다.
- 끝난 것의 기준(1440): 공지, 알림, 소개, 더보기, 기록에서 h1 bottom → 다음 요소 top = 32. 기록과 칭호에서 탭 줄 bottom → 내용 top = 20. 공지 글, 대진표, 게시글에서 뒤로 링크 상자의 top = 옆 단(또는 본문 열)의 top.

**T-80 도움말 문장** (G-12, Q-02)
- `src/styles/components.css` `.bk-hint, .hint { font-size: var(--t15); line-height: var(--l-read); color: var(--dim); }` → `font-size: var(--t12); line-height: var(--l12);` (Hierarchy 5단: 힌트는 12/16, 데스크톱 15/20). 두 줄 이상 이어지는 설명 문단으로 쓰인 곳(`grep -rn "className=\"hint\"\|bk-hint" src`)은 하나씩 열어 보고, 읽는 글이면 클래스를 `prose` 계열로 바꾼다.
- 끝난 것의 기준(390): 어떤 칸에서도 힌트가 그 칸의 라벨보다 크지 않다.

### 묶음 12. 기록 화면의 나머지 (Q-14)

**T-81 상위 3 패널의 카운터**: `records-board.css` `.rc-top-cell { … padding: var(--s2) var(--s3); background: var(--panel-2); }` → 배경을 지우고 `padding: var(--s2) var(--s3) var(--s2) 0;` (세 패널 모두 칸 없이, 라벨이 이름과 같은 왼쪽 선). `.inv .rc-top-cell { background: transparent; padding-left: 0; }` 줄은 필요 없어지니 지운다. T-11에서 더한 호버 규칙도 지운다. 시안: `_drafts/rec-1440x900-pair.png`.

**T-82 대회 탭의 길이**: `RecordsPage.jsx` `TournamentArchiveView`: 처음에는 최근 20개 대회만 그리고 그 아래 "N개 전체 보기"(트레이너 탭의 "N명 전체 보기"와 같은 키, 같은 동작). 검색 중이거나 투어 칩을 고른 때는 전부 그린다.
- 끝난 것의 기준: `?view=records&tab=tour` 1440의 문서 높이가 15,568 → 7,000 이하.

**T-83 리그 태그**: 그대로 둔다(변경 없음). 열 어긋남은 T-24로 풀린다.

**T-84 명예의 전당 왕관의 여섯**: `hall.css` 휴대폰 `.hof-crown-mon { --floor: var(--h-control); … }` → `--floor: var(--h-strip);` (이름 띠 44 → 32, 그림이 그만큼 커진다). 860 이상 `.hof-crown { … align-items: end; … }` → `align-items: stretch`, `.hof-crown-mon { aspect-ratio: auto; height: calc(var(--s21) * 2); }` → `height: 100%; min-height: calc(var(--s21) * 2);`.
- 끝난 것의 기준: 390에서 현 챔피언의 그림이 역대 벽의 그림보다 1.25배 이상 크다. 1440에서 여섯 위의 빈 띠가 40 이하.

**T-85 최근 대회 날짜 표기**: 트레이너 시트의 목록에서 해가 둘 이상이면 모든 줄에 연도를 붙인다. `src/services/dateFormat.js` 는 바꾸지 않고, 시트가 줄을 그릴 때 "올해 날짜에 연도 생략" 대신 연도 포함 형식을 고른다(그 서비스에 연도 포함 함수가 이미 있으면 그것을 쓴다).

### 묶음 13. 팀 빌더, 계산기 (Q-15)

**T-86 860~1099의 후보 목록**: `team-builder.css` `.tb-pool-panel { position: static; max-height: 576px; }` (이 구간의 규칙) → `max-height: none;` 과 `.tb-pokemon-list { max-height: none; overflow: visible; }` (휴대폰처럼 페이지와 함께 스크롤). 끝난 것의 기준(1099x900, 860x900): 후보 목록 안쪽 스크롤이 없다.

**T-87 데스크톱 후보 행**: 1100 이상에서 행을 한 줄 64로: 그림(64 칸), 이름과 타입 태그 한 줄, 능력치 여섯 칸과 합. `team-builder.css` 의 데스크톱 행 규칙(3줄)을 바꾼다. 타입 격자는 그대로. 끝난 것의 기준(1280x800): 보이는 후보 행이 2.6 → 5 이상. 1100~1199에서 능력치 숫자 사이 간격 ≥ 8(D-25).

**T-88 계산기 휴대폰 능력치 행**: `calculator.css` `.calc-stat-row { grid-template-columns: var(--s8) minmax(0, 1fr) var(--h-control) calc(var(--s21) + var(--s5)); }` (휴대폰 쪽) → 랭크 스텝퍼를 둘째 줄로 내린다(`grid-template-areas`). H 행은 랭크가 없으니 한 줄. 끝난 것의 기준(390): 막대 폭 134 → 230 이상.

**T-89 공식 제출 패널이 막혔을 때**: `TeamBuilderPage.jsx` `OfficialSubmissionPanel`: `blocked` 이면 제목 바로 아래에 사유 문장을 두고 단계 띠, 이름 칸, 신청자 확인을 그리지 않는다. 잠긴 규정 드롭다운은 펼침 화살표 대신 자물쇠 아이콘(편집기의 잠긴 메가 도구 `tb-locked-item` 과 같은 표시).

**T-90 빈 칸의 +**: 누를 수 있는 것이 아니므로 +를 뺀다(`TeamBuilderPage.jsx` 의 빈 슬롯). 빈 칸은 번호만 흐리게.

**T-91 "최종" 열**: `TeamBuilderPage.jsx` 능력 포인트 행의 "최종 185"에서 낱말 "최종"을 행마다 쓰지 않고 능력 포인트 머리줄의 오른쪽 끝에 한 번 쓴다. 행에는 숫자만 오른쪽 정렬(`font-variant-numeric: tabular-nums` 는 이미 전역).

### 묶음 14. 구조를 바꾸는 모션 (Q-18)

**T-92 탭과 칩을 바꿀 때 바뀐 것만 켠다** (F-04, F-05): `src/components/common/motion.js` `lightAfter` 가 컨트롤 뒤의 모든 형제를 켜는 것을, 내용이 바뀌는 컨테이너만 켜게 한다. 검색 칸(`.search`)과 주 키(`.dock`, `.btn--main` 을 가진 줄)는 건너뛴다: 형제 중 `[data-still]` 표시가 있는 것을 건너뛰고, `ListSearch` 의 바깥 요소와 `Dock` 에 `data-still` 을 준다. light가 닿는 컨테이너(`.rc-body`, 칭호의 판, 대진표의 `.bk-board`, `.bk-list`)에서는 `.swap` 클래스를 뺀다(두 겹 페이드 제거).
- 끝난 것의 기준: 게시판 파티 탭에서 칩 "더블"을 누른 직후 `.search-in` 과 `.btn--main` 의 `getAnimations()` 가 비어 있다. 목록 행은 전과 같이 420, 38 간격으로 켜진다.

**T-93 접힘의 닫힘** (F-07): `RecordsPage.jsx`(회차 공식 파티), `NewsPage.jsx`(신청 현황), `BracketsPage.jsx`(파티 제출 현황)의 접힘에 `Modal.jsx` 의 `useExitAnimation` 과 같은 방식으로 닫힘을 준다: 닫을 때 내용의 opacity를 160(tone, ease-in)으로 0까지 내린 뒤 떼어낸다. 높이는 움직이지 않는다(법: transform과 opacity만).
- 끝난 것의 기준: 닫는 동안 내용에 opacity 애니메이션 160ms가 하나 돈다. 줄인 움직임에서는 바로 닫힌다.

**T-94 데스크톱 대화상자가 오류로 뛰지 않게** (F-06): `components.css` 860 이상 `.sheet { top: 50%; bottom: auto; … translate: -50% -50%; … }`: 열릴 때의 top을 고정한다. `Modal.jsx` 가 열린 직후 `.sheet` 의 top(px)을 한 번 재서 `style.top` 으로 넣고 `translate` 를 `-50% 0` 으로 바꾼다. 그 뒤 높이가 변하면 아래로만 자란다. 창 높이를 넘으면 기존 `max-height` 가 막는다.
- 끝난 것의 기준(1440): 글쓰기 시트에서 빈 채로 등록을 눌러 오류가 떠도 `.sheet` 의 top이 변하지 않는다(전 54 → 26).

**T-95 첫 방문 홈** (F-03): `HomePage.jsx`: `last`(지난 대회)를 아직 읽는 중이고 다가오는 대회가 없을 때, "다음 대회" 모양과 "공지 보기" 키를 그리지 않는다. 지난 대회 패널과 같은 높이의 꺼진 판(세그먼트 꺼짐, 키 없음)을 둔다. 읽기가 끝나면 그 자리에서 켠다.
- 끝난 것의 기준: 저장된 사본이 없는 첫 방문을 `--cpu 4` 로 녹화했을 때 주 키의 낱말이 바뀌는 프레임이 없고, 순위 구역의 top이 변하지 않는다(layout-shift 0).

**T-96 무거운 시트의 첫 프레임** (F-02): 먼저 잰다. `npm run build && npx vite preview --port 4173` 의 운영 빌드에서 `scripts/record-transition.cjs` 로 트레이너 시트 열기를 390, `--cpu 4`, `--every 40` 으로 녹화한다. 누른 뒤 첫 프레임에 시트 윗변이 출발점(864)에서 끝점(52)까지 거리의 절반을 이미 지나 있으면: `Modal.jsx` 의 스프링 시작을 시트 내용의 첫 그림 다음 프레임으로 미룬다(`requestAnimationFrame` 두 번 뒤 `slide(0)`). 절반을 지나지 않으면 이 작업은 "변경 없음"으로 닫고 측정값을 적는다.

**T-97 상단 바의 호버** (F-08, Q-17): 지금대로 둔다(변경 없음). 상단 바의 낱말을 평소에 한 단계 어둡게 하는 것은 사이트의 인상을 바꾼다. `.navlink` 의 기존 호버만 유지한다.

**T-98 페이저** (F-11): 지금대로 둔다(변경 없음). 목록에 최소 높이를 주면 짧은 마지막 쪽에 빈 띠가 생긴다(원칙 29).

### 묶음 15. 배틀 (Q-19, Q-20)

배틀은 DESIGN.md "Battle"의 "Judging the play screen"이 기준이고, 바꾼 뒤에는 `docs/BATTLE_FRAMES.md` 의 방법(`scripts/measure-frames.cjs`)으로 프레임을 다시 잰다. 연출과 기능은 그대로여야 한다.

**T-99 860~1199의 배틀을 두 단으로** (E-02): `src/styles/battle.css` 의 `@media (min-width: 1200px)` 블록(두 단 `grid-template-columns: minmax(0, 1fr) 400px`, 무대 `max-height`, 옆 기둥 sticky)과 `src/pages/BattlePage.jsx` 의 `WIDE = "(min-width: 1200px)"` 를 860으로 내린다. 옆 기둥 폭은 860~1199에서 `calc(var(--s21) * 4)`(336)로 줄인다(400이면 860에서 무대가 420밖에 안 남는다). `@media (min-width: 860px) and (max-width: 1199px)` 인 기존 규칙(`battle.css` 의 max-width 980 등)은 새 배치와 겹치지 않게 정리한다.
- 끝난 것의 기준: 860x900, 1024x768, 1199x800에서 배틀 중 문서 높이 = 창 높이(스크롤 없음), 기술 키 넷과 벤치가 창 안, 머리(`.bt-head`)가 덱보다 위. 1200 이상은 전과 같은 픽셀(전후 샷 비교). `measure-frames.cjs lobby`, `replay-open` 이 실패하지 않는다.

**T-100 배틀의 작은 것들** (E-05, E-07, E-08, E-09)
- 데스크톱 옆 기둥: 메뉴(연출, 소리, 기권)를 머리 바로 아래에, 파티 패널을 그 밑에(`BattlePage.jsx` 의 `.bt-side` 자식 순서).
- 첫 턴 안내 토스트: 뜬 뒤 4.66초(사이트 토스트의 수명, `Toaster.jsx` 의 값)에 꺼진다. 자리와 모양은 그대로.
- 데스크톱 더블: 내 플레이트 둘을 휴대폰처럼 오른쪽에 세로로 쌓는다(`battle.css` 860 이상의 `.bt-hud-own` 배치에서 `.two` 일 때 column).
- 379 이하 선출 카드: `.bt-card.short` 의 세로 안쪽 여백 12 → 8.
- 끝난 것의 기준: 1440x900 배틀 중 기권 키가 창 안. 더블에서 내 플레이트와 내 포켓몬 상자의 겹침이 상자 넓이의 20% 이하. 375x667 선출에서 셋째 줄 카드 bottom ≤ 독 top.

**T-101 그대로 두는 것**: 끝난 뒤 휴대폰 덱 위 140 빈칸(덱 높이를 지키는 의도), 로비 코트 아래 107 빈칸, 턴 수 카운터의 라벨, 방 목록의 0 카운터 셋, 390x480의 극단 높이. 변경 없음. 로비 → 선출 전환의 잘림(E-06)은 `docs/BATTLE_TRANSITIONS.md` 기준의 별도 작업으로 남긴다(이 계획 밖).

### 묶음 16. 화면에 보이는 결함 하나 (Q-21)

**T-102 계산기 "난수 5타 (NaN%)"** (BUG-1): `src/services/calculatorCore.js` `koLabel`: `ko.chance` 가 숫자가 아니면 괄호 없이 `난수 ${ko.n}타` 만 쓴다. `tests/` 에 계산기 테스트가 있으면 이 경우를 하나 더한다. 이것만은 서비스 코드지만 화면 문자열 한 줄이고 계산은 바뀌지 않는다.

**이 계획에 넣지 않은 결함:** 컴퓨터 배틀 무작위 파티의 빈 정보(BUG-2)는 원인을 모른다. `systematic-debugging` 으로 따로 다룬다. BUG-3, BUG-4는 재현과 데이터 확인이 먼저다.

### 묶음 17. 계정을 연동했을 때만 보이는 화면 (2026-11-23 추가)

첫 검수는 Google 계정 연동 없이 했다. 사용자가 직접 로그인한 창으로 운영 사이트의 연동 화면 12개를 찍어 본 결과다(report.md 11장, 샷 `docs/visual-audit/shots/ACCT-*/`). 묶음 16 다음에 한다. 확인에는 연동된 계정이 필요하다: 로그인은 사용자만 할 수 있으니, 구조와 수치는 코드와 로그아웃 상태로 확인할 수 있는 데까지 하고, 연동 상태의 화면은 "사용자 확인 필요"로 보고한다.

**T-103 계정 키 묶음: 로그아웃이 가장 큰 키** (H-01, 원칙 27·28)
- 파일: `src/components/AccountKeys.jsx`, `src/styles/records-board.css` (또는 `more.css`)
- 현재: `<div className="stack rc-more">` 안에 `<Button variant="second">로그아웃</Button>` (기록 화면 1156x52, 더보기 709x52, 내 시트 1145x52), 그 아래 `variant="link"` 둘(기록 연결 해제, 계정 삭제)이 가운데 정렬로 세로로 쌓임
- 바꿈: 세 행동을 모두 `variant="link"` 로, 한 줄에 왼쪽부터 로그아웃, 기록 연결 해제, 계정 삭제. 감싸는 요소의 클래스를 `acct-keys` 로 바꾸고 `.acct-keys { display: flex; flex-wrap: wrap; align-items: center; gap: 0 var(--s5); margin-top: var(--s3); }`, 각 링크의 누르는 높이 44(`min-height: var(--h-control)`). `FormError` 는 그 아래 줄 전체 폭.
- 끝난 것의 기준: 더보기, 내 기록 찾기(`?view=records&me=1`), 내 트레이너 시트에서 세 낱말이 같은 기준선, 왼쪽 끝이 그 묶음의 다른 글자와 같은 x, 폭이 200을 넘는 키가 없다.

**T-104 내 시트 맨 위의 연결 상태 띠와 로그아웃** (H-02, 원칙 28)
- 파일: `src/pages/RecordsPage.jsx` 트레이너 시트 (`TrainerLink` 의 `lead` 와 그 아래 AccountKeys)
- 현재: 내 시트에서 카운터 바로 아래에 반전 띠 "내 기록으로 연결되었습니다."(1145x44)와 로그아웃 키(1145x52)가 서고, 그다음이 "내 전적". 기록을 보러 온 화면에서 계정 상태와 로그아웃이 둘째 자리다.
- 바꿈: 이미 연결된(approved) 내 시트에서는 이 리드를 맨 위에 그리지 않는다. 연결 상태는 T-70으로 맨 아래에 옮긴 "내 기록 연결" 섹션에 Row 하나("기록 연결됨")로 두고 그 아래 T-103의 계정 키 줄. 아직 연결 전이거나 내 기록 찾기 모드에서 남의 시트를 볼 때의 리드("○○ 님의 기록이라면", 내 기록으로 연결 키)는 그대로 맨 위.
- 끝난 것의 기준: 연결된 내 시트에서 카운터 다음 요소가 "내 전적" 제목.

**T-105 "내 전적" 섹션** (H-03, Composing a screen 22)
- 파일: `src/pages/RecordsPage.jsx` `MyRecord`
- 현재: 제목 아래 설명 패널 `<Row title="나에게만 보입니다." line="다른 사람의 시트에는 전적이 서지 않습니다." />` (64 높이). 상대 행마다 회색 줄 "자주 만난 상대"가 반복된다(세 행에 세 번). 카운터는 라벨 "승"에 단위 "승", 라벨 "패"에 단위 "패".
- 바꿈: 설명 패널을 지우고 제목 아래 회색 줄 하나(`t12 dim reg`, 제목과 4 간격) "나에게만 보입니다."로. 상대 행 묶음 위에 라벨 한 번(`t12 dim`, 아래 8) "자주 만난 상대", 각 행의 회색 줄에서는 그 낱말을 빼고 게임 점수가 있을 때만 "게임 a:b". 승·패 카운터의 단위는 "판"으로(라벨 승, 값 3, 단위 판).
- 끝난 것의 기준: "내 전적" 섹션에 "자주 만난 상대"가 한 번만 나온다.

**T-106 더보기에 "알림"이 두 번** (H-04, K-16)
- 파일: `src/pages/MorePage.jsx`
- 현재: 로그인하면 "내 계정" 묶음의 알림 행("이 기기에서 꺼짐")과 "함께하기" 묶음의 알림 행("새 알림" 램프)이 한 화면에 둘 다 선다.
- 바꿈: 로그인 상태(내 계정 묶음이 그려질 때)에는 "함께하기"에서 알림을 빼고, "새 알림" 램프는 내 계정 묶음의 알림 행에 둔다. 로그아웃 상태는 지금대로.
- 끝난 것의 기준: 로그인한 더보기에서 글자 "알림"으로 시작하는 행이 하나.

**T-107 시트와 메뉴 안의 스크롤바** (H-05)
- 파일: `src/styles/tokens.css`
- 현재: `html` 쪽 규칙의 `scrollbar-color: var(--mute) transparent; scrollbar-width: none;` 에서 `scrollbar-color` 가 상속되어, Chrome(121 이상)이 시트·메뉴 안 스크롤러에서 `::-webkit-scrollbar { width: 8px }` 규칙을 무시하고 화살표 단추가 달린 운영체제 스크롤바를 그린다(창이 보이는 Chrome으로 찍은 `ACCT-my-sheet/1440x900-light.png` 오른쪽 끝. 창 없는 캡처에서는 안 보여 첫 검수가 놓쳤다).
- 바꿈: `::-webkit-scrollbar` 규칙들 아래에 추가: `@supports selector(::-webkit-scrollbar) { body { scrollbar-color: auto; } }` (Chromium과 Safari는 8px 규칙을 쓰고, Firefox는 `scrollbar-color` 를 그대로 쓴다).
- 끝난 것의 기준: 창이 보이는 Chrome(`scripts/visual-audit.cjs --headed`)에서 트레이너 시트를 열고 `.modal` 의 `offsetWidth - clientWidth` 가 8 이하, 스크린샷에 화살표 단추가 없다. 페이지 자체(`html`)의 스크롤바는 전과 같이 숨겨져 있다.

**T-108 확인만 하는 것**
- 내 행의 "나" 태그가 표식 열을 43 민다(이제빈 행 344, 다른 행 301): T-24(이름 열 220)로 풀리는지 내 행으로 확인한다. 이름 + 리그 태그 + "나" 태그의 폭은 약 140이다.
- 더보기 오른쪽 단의 관리자 로그인이 로그인 상태에서도 중간(y 1160, 왼쪽 단 끝은 1436)에 뜬다: T-20으로 풀리는지 확인한다.
- 배틀의 기록 탭과 도전의 탑 탭의 연동 화면은 이번 캡처에서 `battle` 함수 요청이 막혀(읽기도 POST) 제대로 뜨지 않았다. 판정하지 않았다.

### 5장의 순서와 끝 확인

묶음 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17. 묶음마다 3장과 같은 공통 확인을 하고, 묶음 9~11을 마친 뒤에는 `_drafts/*-pair.png` 의 오른쪽 그림과 실제 화면을 나란히 본다. 5장을 다 마친 뒤 4장의 전체 확인을 다시 한다.
