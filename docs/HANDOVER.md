# 인수인계

사이트를 맡는 사람이 처음 읽는 문서입니다. 무엇이 어디에 있고, 누구 계정에 묶여 있으며, 정기적으로 무엇을 해야 하는지 적습니다. 대회 진행은 [OPERATOR.md](OPERATOR.md), 문제가 생겼을 때는 [RUNBOOK.md](RUNBOOK.md)를 봅니다.

## 1. 구성

| 부분 | 어디 | 배포 |
|---|---|---|
| 사이트 | GitHub 저장소 `iambin2/ypl-site`, GitHub Pages | `main`에 push하면 자동 (`deploy.yml`) |
| 데이터베이스 | Supabase 프로젝트 `rqffrogcverfjqzjasax` (PostgreSQL 17) | SQL 편집기에서 손으로 (`docs/db/README.md`) |
| `battle` 함수 | Supabase Edge Function (배틀, 공식 경기, 도전의 탑) | `main`에 push하면 자동 (`functions.yml`), 토큰 필요 |
| `notify-announcement` 함수 | Supabase Edge Function (푸시 알림 발송) | 같음 |
| 도메인 | `league.pokeyonsei.com`, Cloudflare DNS의 CNAME `league` → `iambin2.github.io` (DNS only) | 바꿀 일 없음 |
| Google 로그인 | Google Cloud OAuth 앱, Supabase Auth의 Google 공급자 | 바꿀 일 없음 |

## 2. 계정과 소유자

아래 표의 빈칸은 인수인계 때 채웁니다. 저장소 안에서는 확인할 수 없는 정보입니다.

| 계정 | 지금 소유자 | 넘기는 방법 |
|---|---|---|
| GitHub 저장소 | 개인 계정 `iambin2` | 동아리 GitHub 조직을 만들고 Settings, Transfer ownership. 조직으로 옮기면 Pages 주소가 바뀌므로 Cloudflare CNAME도 `<조직>.github.io`로 고치고, 저장소 Settings, Pages에서 커스텀 도메인을 다시 넣습니다 |
| Supabase 조직과 프로젝트 | | 조직 Settings, Members에서 후임을 Owner로 초대한 뒤 본인을 뺍니다. 프로젝트 이전은 필요 없습니다 |
| Cloudflare (`pokeyonsei.com`) | | 계정 Members에 초대하거나, 도메인 등록처의 소유자 이전 |
| 도메인 등록 (만료일:      ) | | 등록처의 소유자 이전. 만료일을 달력에 적어 둡니다 |
| Google Cloud OAuth 앱 | | IAM에서 후임을 Owner로 추가 |
| 운영자 공용 로그인 | Supabase Auth의 `yplofficial` 한 개 | 4절 |

옛 Supabase 프로젝트 `fgjtph…`("YPL")는 버려진 프로젝트입니다. 일시정지 안내 메일이 와도 무시해도 됩니다.

## 3. 비밀

값은 이 문서에 적지 않습니다. 이름과 위치만 적습니다. 값은 동아리 공용 비밀번호 관리 도구(없다면 만듭니다)에 둡니다.

| 이름 | 위치 | 용도 | 잃으면 |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub 저장소 Secrets | 주간 백업, 컴퓨터 학습 | 대시보드 Settings, API에서 다시 복사 |
| `BACKUP_PASSPHRASE` | GitHub 저장소 Secrets, 공용 비밀번호 도구 | 주간 백업 암호 | **이 값이 없으면 그동안의 백업을 열 수 없습니다.** 반드시 두 곳에 둡니다 |
| `SUPABASE_ACCESS_TOKEN` | GitHub 저장소 Secrets | 함수 자동 배포 | 프로젝트 Owner가 supabase.com, Account, Access Tokens에서 새로 발급 |
| `VAPID_KEYS` | Supabase 함수 Secrets, 공용 비밀번호 도구 | 푸시 알림 서명 | 공개 절반은 `src/services/announcementPush.js`의 `VAPID_PUBLIC_KEY`. 쌍을 바꾸면 모든 기기의 알림 구독이 끊깁니다. 개인 절반은 소유자 PC의 `.env.local`에도 있으니 공용 도구로 옮깁니다 |
| Google OAuth 클라이언트 비밀 | Supabase 대시보드 Authentication, Providers, Google | Google 로그인 | Google Cloud에서 다시 발급 |
| 운영자 비밀번호 | Supabase Auth | 운영 화면 | 4절 |
| DB 비밀번호 | Supabase 대시보드 Settings, Database | 스키마 덤프, 복구 | 대시보드에서 재설정 (사이트는 쓰지 않음) |

`.env.production`의 URL과 공개(anon) 키는 저장소에 커밋돼 있는 것이 맞습니다. 방문자에게 어차피 보내는 값입니다.

## 4. 운영자 계정

운영 쓰기는 Supabase Auth 사용자 중 `app_metadata.ypl_admin = true`인 계정만 할 수 있습니다(DB가 판정). 지금은 공용 계정 하나(`yplofficial`, 로그인 칸에 `@` 없이 치면 `yplofficial@ypl.invalid`)를 운영진이 같이 씁니다.

- **비밀번호 교체** (인수인계 때 꼭 합니다. 이 비밀번호는 예전 배포 파일에 노출된 적이 있습니다, `docs/db-access-lockdown.md` 10절): Supabase 대시보드 Authentication, Users에서 그 사용자를 열고 비밀번호를 바꿉니다.
- **운영자 추가**: Authentication, Users, Add user로 만든 뒤(이메일 확인 완료로) SQL 편집기에서
  ```sql
  update auth.users set raw_app_meta_data = raw_app_meta_data || '{"ypl_admin": true}'::jsonb where email = '<이메일>';
  ```
- **운영자 빼기**: 같은 SQL에서 `- 'ypl_admin'`으로 지우거나 사용자를 삭제합니다.
- 로그인한 세션은 탭을 닫으면 사라집니다.

## 5. 정기 작업

자동으로 도는 것은 실패하면 저장소에 "자동 작업 실패: 이름" 이슈가 열리고, 다음에 성공하면 저절로 닫힙니다. 저장소를 Watch해 두면 메일이 옵니다.

| 언제 | 무엇 | 자동 여부 |
|---|---|---|
| 매시간 | 사이트, 배틀 함수, DB가 응답하는지 (`uptime.yml`). DB가 7일 쉬어 일시정지되는 것도 막습니다 | 자동 |
| 15분마다 | 알림 보낼 것 찾기 (`push-sweep.yml`) | 자동 |
| 매주 일요일 03시 | 모든 표 백업, 암호화해 90일 보관 (`backup.yml`) | 자동 |
| 매주 월요일 | 포켓몬 데이터 갱신 PR (`refresh-champions-data.yml`), 컴퓨터 학습 PR (`learn-cpu-sets.yml`), 의존성 PR (Dependabot) | PR은 자동, **병합은 사람**. 아래 6절 |
| 반기 | 시즌 전환 | 자동 (DB가 날짜로 판단) |
| 포켓몬 챔피언스 시즌이 끝날 때 | 랭커 팀 갱신: `scripts/build-ranker-teams.mjs`의 `SEASONS`에 새 시즌 번호를 넣고 실행 | **수동**. RUNBOOK "랭커 팀" |
| 새 레귤레이션이 나올 때 | RUNBOOK "레귤레이션 바꾸기" | **수동** |
| 대회마다 | OPERATOR.md | 운영자 |
| 학기마다 한 번 | 백업 하나를 내려받아 열어 보기 (복구 연습) | 수동 |

## 6. PR 병합과 브랜치

작업 브랜치는 `design/scoreboard`이고, 배포할 때 그 브랜치를 `origin/design/scoreboard`와 `origin/main` 둘에 push합니다. 데이터 PR과 Dependabot PR은 `main`을 향합니다. 그래서:

1. PR을 GitHub에서 병합하면 `main`이 작업 브랜치보다 앞섭니다.
2. 다음 작업 전에 작업 브랜치에서 `git pull origin main`으로 받아 둡니다. 안 받으면 다음 배포 push가 거절됩니다.

후임이 브랜치 하나로 일하고 싶다면 `main`에서 바로 작업해도 됩니다. CLAUDE.md "Deployment"의 브랜치 문장만 고치면 됩니다.

## 7. 처음 30분

1. Node 24를 설치하고 `npm install`, `npm run dev`로 띄웁니다 (README 1절).
2. `npm test`가 통과하는지 봅니다.
3. 운영자 로그인으로 `?view=admin`을 열어 봅니다.
4. 저장소 Actions 탭에서 최근 실행이 모두 초록인지, Issues에 "자동 작업 실패"가 없는지 봅니다.
5. 2절과 3절 표의 빈칸을 채우고, 비밀번호를 바꿉니다.
