-- 도전의 탑 기록 보존 (2026-11-22, 인수인계 준비). streak_runs.sql 뒤에 실행한다.
-- 1. 내 도전: 로그인한 본인의 지난 도전(달, 연승, 램프, 시작과 끝)을 최근 것부터. 지금까지는 이번 달 순위의 한 줄이 전부였다.
-- 2. 달의 1, 2, 3위: 지난 모든 달의 상위 셋. 칭호와 명예의 전당이 읽는다(달마다 운영자가 순위표를 캡처할 필요가 없다).
-- 3. 달의 1위가 친 판의 리플레이 보존: streak_start 와 streak_begin 은 지난달보다 오래된 연승 판을 지운다. 그 직전에 달의 1위 도전의
--    판을 tower_archive 로 옮겨 두어, 최고 기록의 리플레이가 두 달 뒤 사라지지 않게 한다(관전 로그와 입력 기록만, 파티의 비밀은 남기지 않는다).
-- 한 번 실행하면 되고, 다시 실행해도 안전하다. 실행한 뒤 docs/db/README.md 장부에 날짜를 적는다.
-- 확인: select * from public.streak_month_tops() limit 3;

-- ===== 1. 내 도전 =====
create or replace function public.streak_my_runs(p_limit integer default 30, p_offset integer default 0)
returns table (run_id uuid, month date, daily date, wins integer, lives integer, status text, started_at timestamptz, ended_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.month, r.daily, r.wins, r.lives, r.status, r.started_at, r.ended_at
    from public.streak_runs r
   where (select auth.uid()) is not null and r.auth_user_id = (select auth.uid())
   order by r.started_at desc
   limit least(greatest(coalesce(p_limit, 30), 1), 100) offset greatest(coalesce(p_offset, 0), 0)
$$;
revoke all on function public.streak_my_runs(integer, integer) from public, anon;
grant execute on function public.streak_my_runs(integer, integer) to authenticated;

-- ===== 2. 달의 상위 셋 =====
-- 순위는 streak_board와 같은 셈: 계정마다 그 달의 가장 좋은 도전, 연승이 많은 순, 같으면 먼저 닿은 순. 이번 달은 아직 끝나지 않아 뺀다.
create or replace function public.streak_month_tops()
returns table (month date, place integer, trainer_name text, wins integer, run_id uuid, reached_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with best as (
    select distinct on (r.month, r.auth_user_id) r.month, r.auth_user_id, r.trainer_name, r.wins, r.id, coalesce(r.last_win_at, r.started_at) as reached
      from public.streak_runs r
     where r.daily is null and r.wins > 0 and r.month < (date_trunc('month', now() at time zone 'Asia/Seoul'))::date
     order by r.month, r.auth_user_id, r.wins desc, coalesce(r.last_win_at, r.started_at)
  ), ranked as (
    select b.*, (row_number() over (partition by b.month order by b.wins desc, b.reached))::integer as place from best b
  )
  select k.month, k.place, k.trainer_name, k.wins, k.id, k.reached from ranked k where k.place <= 3 order by k.month desc, k.place;
$$;
revoke all on function public.streak_month_tops() from public;
grant execute on function public.streak_month_tops() to anon, authenticated;

-- ===== 3. 달의 1위 리플레이 보존 =====
create table if not exists public.tower_archive (
  battle_id text primary key,
  run_id uuid not null,
  month date not null,
  format_id text not null,
  p1_name text not null,
  p2_name text,
  winner text,
  ended_by text,
  turn integer not null,
  spectator_log text not null,
  input_log text,
  created_at timestamptz not null,
  archived_at timestamptz not null default now()
);
alter table public.tower_archive enable row level security;
revoke all on table public.tower_archive from public, anon, authenticated;
grant select on table public.tower_archive to anon, authenticated;
drop policy if exists tower_archive_read on public.tower_archive;
create policy tower_archive_read on public.tower_archive for select to anon, authenticated using (true);

create or replace function public.tower_archive_keep()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.streak_runs%rowtype;
begin
  if old.kind <> 'streak' or old.run_id is null or old.status <> 'ended' then return old; end if;
  select * into v_run from public.streak_runs r where r.id = old.run_id;
  if not found or v_run.daily is not null then return old; end if;
  -- 그 달의 1위 도전인가(streak_month_tops와 같은 셈)
  if exists (
    select 1 from public.streak_runs r
     where r.month = v_run.month and r.daily is null and r.wins > 0
       and (r.wins > v_run.wins or (r.wins = v_run.wins and coalesce(r.last_win_at, r.started_at) < coalesce(v_run.last_win_at, v_run.started_at)))
  ) then return old; end if;
  insert into public.tower_archive (battle_id, run_id, month, format_id, p1_name, p2_name, winner, ended_by, turn, spectator_log, input_log, created_at)
  values (old.id, old.run_id, v_run.month, old.format_id, old.p1_name, old.p2_name, old.winner, old.ended_by, old.turn, old.spectator_log, old.input_log, old.created_at)
  on conflict (battle_id) do nothing;
  return old;
end;
$$;
revoke all on function public.tower_archive_keep() from public, anon, authenticated;
drop trigger if exists tower_archive_keep on public.battles;
create trigger tower_archive_keep before delete on public.battles for each row execute function public.tower_archive_keep();

notify pgrst, 'reload schema';
