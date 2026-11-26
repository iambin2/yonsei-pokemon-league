# YPL — Yonsei Pokémon League 사이트

포켓몬 센터 연세점 공식 배틀 리그 기록 사이트입니다.
React 18 + Vite로 만든 정적 SPA이며, GitHub Pages에 자동 배포됩니다.

- 배포 주소: https://league.pokeyonsei.com/
- 데이터: Supabase (정규화 스키마 + 레거시 key-value 테이블)

처음 맡았다면 이 순서로 읽습니다: [`docs/HANDOVER.md`](docs/HANDOVER.md) (계정, 비밀, 정기 작업), [`docs/OPERATOR.md`](docs/OPERATOR.md) (대회 하나를 화면 순서대로), [`docs/RUNBOOK.md`](docs/RUNBOOK.md) (문제가 생겼을 때, 백업과 복구).

---

## 0. 준비물

- **Node.js 24 이상** (https://nodejs.org). 저장소의 `.nvmrc`가 버전을 정하고, CI도 그 파일을 읽습니다.
- 터미널에서 `node -v` 가 버전을 출력하면 OK

---

## 1. 로컬 실행

```bash
npm install      # 처음 한 번만
npm run dev      # 개발 서버 → http://localhost:5173
```

종료는 `Ctrl + C`.

```bash
npm run build    # dist/ 생성 (실제 배포물)
npm run preview  # 빌드 결과 미리보기
npm test         # 전체 회귀 테스트 실행
npm run data:champions  # 팀 빌더와 계산기가 쓰는 src/data/champions-data.json 재생성
```

테스트 한 개만 돌리려면 파일을 직접 실행합니다. 각 테스트는 `node:test` 단독 모듈이라 러너 설정이 없습니다.

```bash
node tests/championsCore.test.mjs
```

---

## 2. 환경변수

프로젝트 루트에 `.env` 를 만들고 (`.env.example` 참고) 아래 세 개를 채웁니다.

| 변수 | 설명 |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` | anon public 키 |
| `VITE_YPL_DATA_SCHEMA` | 정규화 데이터 스키마 이름 (운영값 `ypl_schema_validation`) |

값은 Supabase 대시보드 **Project Settings → API** 에서 복사합니다.
운영 빌드가 쓰는 값은 저장소의 `.env.production` 에 들어 있습니다.

`VITE_SUPABASE_*` 를 비워 두면 사이트는 `localStorage` 모드로 떨어집니다. 이 경우 관리자 편집이 **그 브라우저에만** 저장되고 다른 사람에게는 보이지 않습니다. 현재 동작 모드는 `src/storage.js` 의 `STORAGE_MODE` (`artifact` / `supabase` / `local`) 로 확인합니다.

---

## 3. 배포 — GitHub Pages

`main` 에 push하면 `.github/workflows/deploy.yml` 이 테스트, SQL 검사, 빌드를 거쳐 사이트를 배포하고, 함수 쪽 코드가 바뀌었으면 `functions.yml` 이 두 Edge Function을 배포합니다(저장소 비밀 `SUPABASE_ACCESS_TOKEN` 필요). 새 SQL은 소유자가 먼저 SQL 편집기에서 실행합니다(`docs/db/README.md`). 다른 브랜치에 push하면 `ci.yml` 이 같은 검사만 돌립니다.

두 가지만 주의하세요.

- 사이트는 커스텀 도메인 `league.pokeyonsei.com` 의 루트에서 서비스되므로 `vite.config.js` 의 `base` 는 `"/"` 입니다. 도메인을 떼면 `"/yonsei-pokemon-league/"` 로 되돌려야 링크와 정적 자산 경로가 살아 있습니다.
- 빌드 시 `version.json` 이 함께 생성되고, `index.html` 에 주입된 스크립트가 이 파일을 확인해 **새 배포가 감지되면 페이지를 자동으로 새로고침**합니다. 방문자가 캐시된 옛 화면에 머무르지 않게 하는 장치이므로, `index.html` 의 head나 `base` 를 건드릴 때 같이 확인하세요.

---

## 4. Supabase

### 데이터 소스가 두 개입니다

- **정규화 스키마** (`ypl_schema_validation`) — 진행 중인 모든 대회의 정본입니다. 시즌·공지·신청·공식 파티 제출·참가자·대진 런타임·경기·결과·랭킹이 전부 여기 있습니다.
- **레거시 `public.site_data`** — 사이트 수준 데이터와, 정규화 이전에 끝난 옛 대진표의 **읽기 전용** 보존용입니다. 새 대진표를 여기에 쓰면 안 됩니다.

자세한 규칙과 불변식은 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) 에 있습니다. 데이터 관련 코드를 고치기 전에 반드시 읽으세요.

### 새 환경을 세팅한다면

`docs/db/README.md` 가 SQL 파일의 적용 장부와 순서, 운영 스키마를 덤프하는 방법을 적어 둡니다. 예전의 루트 `supabase_setup.sql` 은 방문자에게 쓰기를 열어 주는 옛 설정이라 2026-11-22에 지웠습니다.

### 보안 상태 (알고 계셔야 할 것)

`public` 과 `ypl_schema_validation` 의 모든 테이블에 RLS가 켜져 있고, anon 키로는 테이블에 직접 쓸 수 없습니다. 방문자 쓰기(게시판, 신청, 파티 제출)는 서버가 검사하는 RPC로만 들어가고, 운영 쓰기는 `app_metadata.ypl_admin` 계정만 할 수 있습니다. SQL 원본은 `docs/db/` 에 있습니다.

---

## 5. 관리자 로그인

- **더보기** 화면의 관리자 로그인 줄 (데스크톱 넓은 화면에서는 푸터 끝의 **관리자 로그인**)
- 운영진 공용 아이디와 비밀번호로 로그인합니다. 비밀번호는 운영진끼리만 공유하고 저장소에 적지 않습니다.
- 실제 계정은 Supabase Auth에 있습니다. `@` 없는 아이디는 `아이디@ypl.invalid` 이메일로 바뀌어 로그인하고(`src/storage.js`), `app_metadata.ypl_admin = true` 를 붙인 계정만 DB 쓰기가 허용됩니다. 일반 가입은 꺼 두었습니다.
- 세션은 메모리에만 있어 새로고침하면 다시 로그인해야 합니다.

> 쓰기 권한의 실제 경계는 DB 권한과 RLS입니다. 적용 계획과 순서는 [`docs/db-access-lockdown.md`](docs/db-access-lockdown.md) 를 따릅니다.

---

## 6. 폴더 구조

```
yonsei-pokemon-league/
├─ index.html                 # 진입 HTML
├─ vite.config.js             # base 경로 + 버전 자동 새로고침 플러그인
├─ .github/workflows/        # 배포, 검사, 함수 배포, 주간 백업, 가동 감시, 알림 정리, 데이터 갱신 (실패하면 이슈가 열림)
├─ docs/
│  ├─ ARCHITECTURE.md         # 데이터 구조와 불변식 (정본)
│  ├─ brand/                  # 앱 아이콘과 링크 미리보기 원본, Wing Y 기록
│  └─ db/                     # Supabase SQL과 적용 장부 (README.md)
├─ scripts/                   # 운영 스크립트 (아래 7절)
├─ tests/                     # node:test 회귀 테스트
├─ public/
└─ src/
   ├─ main.jsx                # React 진입점
   ├─ App.jsx                 # 셸 — 뷰 상태, 사이트 데이터, 관리자 모드
   ├─ storage.js              # 저장 어댑터 (artifact → Supabase → localStorage)
   ├─ pages/                  # 화면 (홈, 기록, 대진표, 칭호, 팀 빌더, 계산기 …)
   ├─ components/             # 공용 UI (common/Board.jsx가 전광판 부품, layout/은 상단 바와 탭 바)
   ├─ admin/                  # 관리자 모드 (에디터, 모달, 모드 바)
   ├─ services/               # 도메인 로직 — 대진 lifecycle, projection, 기록, 챔피언스
   ├─ data/                   # 팀 빌더와 계산기 데이터
   └─ styles/                 # tokens.css(토큰)와 board.css(공용 부품), 화면별 CSS
```

화면 이동은 라우터 라이브러리 없이 `?view=` 쿼리스트링으로 처리합니다 (`src/services/appRouting.js`).

### 디자인: YPL Scoreboard

사이트는 경기장의 전광판입니다. 꺼진 남색 판 위에 사실이 직각 패널로 켜지고, 숫자는 7세그먼트로, 지금 살아 있는 것은 호박색 램프 하나로 알립니다. 꾸미지 않고 데이터에서 읽은 사실만 보이며, 강조는 색이 아니라 빛(켜짐, 흐림, 꺼짐, 반전)으로만 합니다. 간격, 글자 크기, 높이, 시간은 모두 황금비 하나에서 나옵니다.

규칙과 그 이유는 [`DESIGN.md`](DESIGN.md) 가 유일한 기준이고, 제품 원칙과 브랜드 규칙은 [`PRODUCT.md`](PRODUCT.md) 에 있습니다. 값은 `src/styles/tokens.css`, 공용 부품은 `src/components/common/Board.jsx` 와 `src/styles/board.css` 에 있고, `tests/designLaw.test.mjs` 가 모든 CSS를 규칙대로 검사합니다. 라이트/다크 두 테마가 `<html data-theme>` 위에 얹혀 있어서, 색을 직접 써 넣으면 한쪽 테마가 조용히 깨집니다.

---

## 7. 운영 스크립트

```bash
npm run backup -- [출력폴더]               # Supabase 읽기 전용 스냅샷 (표마다 JSON 하나)
npm run verify:db                         # docs/db의 SQL을 일회용 PostgreSQL(PGlite)에서 검사, Supabase에 접속하지 않음
node scripts/db-ledger.mjs > ledger.sql   # 어느 SQL이 운영에 들어갔는지 확인하는 읽기 전용 질의
node scripts/class-coverage.mjs           # 스타일 규칙이 없는 className 찾기
```

`backup` 은 환경변수 `SUPABASE_SERVICE_ROLE_KEY` 가 있으면 모든 행을, 없으면 `.env.production` 의 공개 키로 RLS가 보여 주는 것만 받고 가려진 표는 보고합니다. 매주 일요일에는 `backup.yml` 이 서비스 키로 전부 받아 암호화해 90일 보관합니다. 복구는 [`docs/RUNBOOK.md`](docs/RUNBOOK.md) "복구"를 따릅니다.

`class-coverage.mjs` 의 미매칭 결과에는 동적 클래스와 JavaScript 전용 클래스도 포함됩니다. 중요한 건 **내 변경이 새로 늘렸는지** 여부입니다.

`scripts/generate-normalized-migration.mjs` 는 레거시 CSV를 정규화 SQL로 변환하는 일회성 마이그레이션 도구입니다.
