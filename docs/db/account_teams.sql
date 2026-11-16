-- 계정에 팀과 배틀 기록 (2026-11-16, 시안 5의 A). player_accounts.sql, battles.sql, battle_integration.sql 다음에 실행한다.
-- 다시 실행해도 안전하다.
--
-- 순서: 이 SQL을 실행하고(아래 확인 쿼리로 결과를 본다), 배틀 함수를 다시 배포하고(npm run build:battle, 배포 명령은
--       supabase/functions/battle/index.ts 맨 위), 그 다음 사이트를 배포한다. 화면은 이 SQL이 실행되기 전까지 둘 다 감춘다
--       (account_teams 표가 없으면 팀 빌더는 이 기기에만 저장하고, my_battles 가 없으면 기록 탭은 이 기기의 배틀만 보인다).
--
-- 생각
--   - 구글로 로그인한 사람의 내 팀은 계정에 둔다. 한 줄이 한 팀이고, 팀 빌더가 저장하는 모양 그대로(team jsonb) 둔다.
--     id 는 팀 빌더가 만든 팀의 id 라서 계정 안에서만 하나다(기본 키가 계정과 id 둘).
--   - 본인만 읽고 쓴다(RLS). 한 팀은 16KB, 한 계정은 100팀까지다. 여섯 마리 팀은 2KB 안팎이다.
--   - 공식 제출은 그대로다. 제출은 열린 팀을 보낸다. 이 표는 내 팀 목록일 뿐이다.
--   - 배틀에는 자리마다 앉은 계정을 적는다(p1_auth_user_id, p2_auth_user_id). 배틀 함수가 자리를 줄 때 요청의 로그인 토큰으로 적는다.
--     이 두 열은 방문자에게 읽기를 주지 않는다(battles 는 열마다 허락받아 읽는다, battle_integration.sql). 본인의 배틀은
--     my_battles 로만 읽는다. 그래서 누가 어느 계정인지는 밖으로 나가지 않는다.

begin;

-- 1. 계정의 팀
create table if not exists public.account_teams (
  auth_user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  team jsonb not null check (jsonb_typeof(team) = 'object' and octet_length(team::text) <= 16384),
  regulation text not null default '' check (char_length(regulation) <= 24),
  updated_at timestamptz not null default now(),
  primary key (auth_user_id, id)
);
create index if not exists account_teams_recent on public.account_teams (auth_user_id, updated_at desc);

alter table public.account_teams enable row level security;
drop policy if exists account_teams_own on public.account_teams;
create policy account_teams_own on public.account_teams for all to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));
revoke all on table public.account_teams from public, anon, authenticated;
grant select, insert, update, delete on table public.account_teams to authenticated;

-- 한 계정에 100팀까지. 같은 계정의 두 저장이 동시에 와도 차례로 센다.
create or replace function public.account_teams_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('account-teams:' || new.auth_user_id::text, 0));
  if (select count(*) from public.account_teams t where t.auth_user_id = new.auth_user_id) >= 100 then
    raise exception '계정에는 팀을 100개까지 저장할 수 있습니다.' using errcode = 'P0001';
  end if;
  return new;
end
$$;
revoke all on function public.account_teams_cap() from public, anon, authenticated;
drop trigger if exists account_teams_cap on public.account_teams;
create trigger account_teams_cap before insert on public.account_teams for each row execute function public.account_teams_cap();

-- 2. 배틀의 자리마다 앉은 계정. 방문자는 읽지 못한다.
alter table public.battles add column if not exists p1_auth_user_id uuid references auth.users (id) on delete set null;
alter table public.battles add column if not exists p2_auth_user_id uuid references auth.users (id) on delete set null;
revoke select (p1_auth_user_id, p2_auth_user_id) on table public.battles from public, anon, authenticated;
create index if not exists battles_p1_account on public.battles (p1_auth_user_id, updated_at desc) where p1_auth_user_id is not null;
create index if not exists battles_p2_account on public.battles (p2_auth_user_id, updated_at desc) where p2_auth_user_id is not null;

-- 배틀 함수가 자리를 줄 때 부른다(service_role 만). 같은 자리를 다른 기기의 다른 계정이 다시 잡으면 그 계정으로 바뀐다.
create or replace function public.battle_set_account(p_id text, p_side text, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_side = 'p1' then
    update public.battles set p1_auth_user_id = p_user where id = p_id;
  elsif p_side = 'p2' then
    update public.battles set p2_auth_user_id = p_user where id = p_id;
  else
    raise exception using errcode = 'P0001', message = 'side must be p1 or p2';
  end if;
end
$$;
revoke all on function public.battle_set_account(text, text, uuid) from public, anon, authenticated;
grant execute on function public.battle_set_account(text, text, uuid) to service_role;

-- 3. 내 배틀: 로그인한 본인이 앉았던 배틀의 공개 열과 본인의 자리(my_side), 최근 것부터.
--    ponytail: 두 열의 or 라서 두 부분 인덱스를 bitmap 으로 합친다. 한 계정의 배틀이 수천 판이 되면 union all 로 나눈다.
create or replace function public.my_battles(p_limit integer default 30, p_offset integer default 0)
returns table (
  id text, status text, regulation text, format_id text, p1_name text, p2_name text, turn integer, winner text, ended_by text,
  kind text, created_at timestamptz, updated_at timestamptz, my_side text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.status, b.regulation, b.format_id, b.p1_name, b.p2_name, b.turn, b.winner, b.ended_by, b.kind, b.created_at, b.updated_at,
         case when b.p1_auth_user_id = (select auth.uid()) then 'p1' else 'p2' end
    from public.battles b
   where (select auth.uid()) is not null
     and (b.p1_auth_user_id = (select auth.uid()) or b.p2_auth_user_id = (select auth.uid()))
   order by b.updated_at desc
   limit least(greatest(coalesce(p_limit, 30), 1), 100) offset greatest(coalesce(p_offset, 0), 0)
$$;
revoke all on function public.my_battles(integer, integer) from public, anon;
grant execute on function public.my_battles(integer, integer) to authenticated;

commit;
notify pgrst, 'reload schema';

-- 확인(읽기만): 모두 true 여야 한다.
-- select to_regclass('public.account_teams') is not null as teams,
--        (select relrowsecurity from pg_class where oid = 'public.account_teams'::regclass) as rls,
--        not has_column_privilege('anon', 'public.battles', 'p1_auth_user_id', 'select') as hidden_p1,
--        not has_column_privilege('anon', 'public.battles', 'p2_auth_user_id', 'select') as hidden_p2,
--        not has_function_privilege('anon', 'public.my_battles(integer, integer)', 'execute') as rpc_closed,
--        has_function_privilege('service_role', 'public.battle_set_account(text, text, uuid)', 'execute') as fn_seat;
