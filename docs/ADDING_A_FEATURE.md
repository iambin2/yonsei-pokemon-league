# 새 화면과 기능 추가 가이드

이 문서는 후임 개발자나 코딩 에이전트가 YPL 사이트에 새 화면이나 UI 요소를 추가할 때, 원래부터 존재했던 것처럼 자연스럽게 맞추기 위한 실무 절차입니다.

## 1. 작업 전 읽을 문서

1. `DESIGN.md`의 Philosophy, The cover is the standard, Composing a screen 장을 읽습니다. YPL의 시각 언어는 **리그 연감(YPL League Almanac)**이며, 사각 카드나 그림자 없이 바탕 위에 글자, 1px 머리카락선(`--rule`), 2px 강조선(`--lit`), 얇은 큰 숫자(`Fig`)로만 화면을 짓습니다.
2. `PRODUCT.md`의 원칙을 확인합니다. 디자인 변경이 데이터 동작이나 운영 기능을 깨뜨려서는 안 됩니다.
3. 데이터 읽기나 쓰기가 포함되면 `docs/ARCHITECTURE.md`를 읽습니다. 활성 대회, 신청, 대진, 기록은 정규화 스키마(`ypl_schema_validation`) RPC를 통해서만 다루고, `public.site_data`는 공지, 칭호, 명예의 전당, 포인트 정책, 사이트 설정(`siteConfig`)에만 씁니다.

## 2. 어디에 붙일지 결정

- 기록과 통계는 `기록` 화면, 대회 정보는 `공지`, 대전 기능은 `배틀`, 도구는 `더보기` 아래에 둡니다.
- 홈(`HomePage.jsx`)은 리그의 표지입니다. 홈에는 지금 방문자가 해야 할 일에 대한 작은 키만 둘 수 있으며, 새 카드나 목록 블록을 추가하지 않습니다.

## 3. 공용 부품과 토큰 사용

새 스타일을 만들기 전에 `src/components/index.js`가 내보내는 공용 연감 부품을 먼저 씁니다. `npm run dev`를 띄운 뒤 `/?view=dev-kit`을 열면 개발 서버 전용 연감 부품 카탈로그에서 모든 공용 부품의 실제 모양을 다크, 라이트, 고대비 모드로 바로 확인할 수 있습니다.

- 레이아웃과 목록: `SectionHead`, `Row`, `Lead`, `Counter`, `Bar`, `TabsLine`, `Steps`, `Chips`, `TypeGrid`, `LiveStrip`, `BackLink`
- 입력과 시트: `Button`(`main`, `second`, `link` 세 가지만 허용), `Field`, `FormError`, `Choice`, `OptionRows`, `Cell`, `Dropdown`, `Segmented`, `Modal`, `Dock`
- 숫자와 상태: `Fig`(32px 이상의 큰 정수), `Empty`, `Loader`, `Toast`, `Prose`, `Icon`

CSS 값은 모두 `src/styles/tokens.css`의 시맨틱 토큰(`--ground`, `--lit`, `--dim`, `--mute`, `--rule`, `--tint`, `--on-lit`, `--s1`~`--s21`, `--t12`~`--t32`, `--move-*`)만 사용합니다. 색상 리터럴, `border-radius`, `box-shadow`(inset hairline 제외), `backdrop-filter`, `gradient`는 `tests/designLaw.test.mjs`에서 즉시 실패합니다.

한국어 문구는 `DESIGN.md`의 Voice and tone을 따릅니다. 합니다체로 쓰고, 느낌표, 줄표, 가운데 점(`·`)을 쓰지 않습니다.

## 4. 새 화면 추가 체크리스트

새 화면(`?view=example`)을 추가할 때는 아래 5곳을 순서대로 연결합니다.

1. `src/pages/ExamplePage.jsx` 작성 (최상위 제목은 `<h1 className="page-title">화면 이름</h1>`, 섹션 제목은 `<SectionHead>`의 `h2.t20`).
2. `src/services/appRouting.js`의 `APP_VIEWS`에 `"example"` 추가. 전용 쿼리 파라미터가 필요하면 `buildViewSearch`와 `VIEW_RESET_PARAMS`에 함께 등록합니다(`viewHref`와 `App.jsx`의 `go()`가 같은 함수를 공유합니다).
3. `src/App.jsx`에 `lazyPage(() => import("./pages/ExamplePage.jsx"))`, `PAGES` 맵, 탭 제목 라벨, `<main>` 렌더 분기를 추가합니다.
4. 내비게이션 노출이 필요하면 `src/components/layout/Navigation.jsx`(`NAV_ITEMS` 또는 `MORE_ITEMS`)와 `src/pages/MorePage.jsx`(`GROUPS`)에 추가합니다.
5. 전용 스타일이 필요하면 `src/styles/example.css`를 만들고 `src/main.jsx`에서 `board.css` 뒤, `admin.css` 앞에 import합니다.

## 5. 완료 전 필수 검증

```bash
node scripts/class-coverage.mjs   # 정의되지 않은 새 className이 없는지 확인
npm test                          # 도메인 테스트와 designLaw, tokenLaw, labelLaw, undeclaredRefs 검증
npm run verify:db                 # SQL을 수정했다면 PGlite 통합 검증
npm run build                     # 경고 없는 프로덕션 번들 확인
```

코드 검증을 통과한 뒤 `npm run dev`로 390px(모바일)과 1440px(데스크톱)에서 다크, 라이트, 고대비 세 모드를 모두 열어 홈 표지 옆에 두고 어색한 여백이나 선이 없는지 확인합니다.
