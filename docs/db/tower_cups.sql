-- 등반전 (docs/BATTLE_STREAK.md 18장, 2026-11-19). streak_runs.sql 과 push_kinds.sql 뒤에 실행한다. 두 번 실행해도 안전하다.
-- 등반전은 기간과 참가자가 있는 도전의 탑 순위다. 참가자가 기간 안에 시작한 평소 도전(오늘의 탑 제외)을 세고, 마감 뒤의 승리는 세지 않는다.
-- 배틀 함수는 바꾸지 않는다: 도전이 생기고 연승이 오를 때 streak_runs 의 트리거가 센다.

-- 1. 등반전. 코드는 숫자 4자리이고 코드 등반전에만 있다.
create table if not exists public.tower_cups (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 24),
  host_user uuid not null references auth.users (id) on delete cascade,
  host_name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  room text not null check (room in ('open', 'code')),
  code text,
  run_limit integer check (run_limit is null or run_limit between 1 and 20),
  created_at timestamptz not null default now(),
  check ((room = 'code' and code ~ '^[0-9]{4}$') or (room = 'open' and code is null)),
  check (ends_at > starts_at and ends_at <= starts_at + interval '31 days')
);
create index if not exists tower_cups_ends on public.tower_cups (ends_at);
create index if not exists tower_cups_host on public.tower_cups (host_user, ends_at);

-- 2. 참가자. 이름은 들어올 때의 승인된 이름이다.
create table if not exists public.tower_cup_players (
  cup_id uuid not null references public.tower_cups (id) on delete cascade,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  trainer_name text not null,
  joined_at timestamptz not null default now(),
  primary key (cup_id, auth_user_id)
);
create index if not exists tower_cup_players_user on public.tower_cup_players (auth_user_id);

-- 3. 센 도전. nth: 그 참가자의 몇 번째 도전인가(반영 횟수). wins, reached_at: 마감 전까지의 연승과 닿은 시각.
create table if not exists public.tower_cup_runs (
  cup_id uuid not null references public.tower_cups (id) on delete cascade,
  run_id uuid not null references public.streak_runs (id) on delete cascade,
  auth_user_id uuid not null,
  nth integer not null,
  wins integer not null default 0,
  reached_at timestamptz not null default now(),
  primary key (cup_id, run_id)
);
create index if not exists tower_cup_runs_run on public.tower_cup_runs (run_id);
create index if not exists tower_cup_runs_board on public.tower_cup_runs (cup_id, auth_user_id);

alter table public.tower_cups enable row level security;
alter table public.tower_cup_players enable row level security;
alter table public.tower_cup_runs enable row level security;
revoke all on table public.tower_cups, public.tower_cup_players, public.tower_cup_runs from public, anon, authenticated;

-- 4. 도전이 생기면: 기간 안이고 참가자이고 횟수가 남은 등반전마다 줄을 만든다. 실패해도 도전을 막지 않는다.
create or replace function public.tower_cup_enter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into public.tower_cup_runs (cup_id, run_id, auth_user_id, nth, wins, reached_at)
    select c.id, new.id, new.auth_user_id, n.done + 1, new.wins, new.started_at
      from public.tower_cups c
      join public.tower_cup_players p on p.cup_id = c.id and p.auth_user_id = new.auth_user_id
     cross join lateral (select count(*)::integer as done from public.tower_cup_runs r where r.cup_id = c.id and r.auth_user_id = new.auth_user_id) n
     where new.started_at >= c.starts_at and new.started_at < c.ends_at
       and (c.run_limit is null or n.done < c.run_limit)
    on conflict do nothing;
  exception when others then
    raise warning 'tower_cup_enter: %', sqlerrm;
  end;
  return null;
end;
$$;
revoke all on function public.tower_cup_enter() from public, anon, authenticated;
drop trigger if exists tower_cup_enter on public.streak_runs;
create trigger tower_cup_enter after insert on public.streak_runs
  for each row when (new.daily is null) execute function public.tower_cup_enter();

-- 5. 연승이 오르면: 마감 전인 등반전의 그 줄을 올린다. 그 판으로 다른 참가자 모두의 최고를 넘어서면(2연승부터) 나머지 참가자에게 알린다.
create or replace function public.tower_cup_climb()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cup record;
  v_best integer;
begin
  begin
    for v_cup in
      update public.tower_cup_runs r set wins = new.wins, reached_at = now()
        from public.tower_cups c
       where r.run_id = new.id and c.id = r.cup_id and now() < c.ends_at and new.wins > r.wins
      returning c.id, c.title
    loop
      if new.wins < 2 then continue; end if;
      select max(r.wins) into v_best from public.tower_cup_runs r where r.cup_id = v_cup.id and r.auth_user_id <> new.auth_user_id;
      if coalesce(v_best, 0) <> new.wins - 1 then continue; end if;  -- 넘어선 판이 아니다
      insert into public.push_outbox (dedup, kind, auth_user_id, title, body, url)
      select 'cup:' || v_cup.id || ':' || new.wins || ':' || p.auth_user_id, 'record', p.auth_user_id, '등반전 1위',
             left(new.trainer_name, 20) || ' 님이 ' || new.wins || '연승으로 ' || left(v_cup.title, 24) || ' 1위에 올랐습니다.',
             '?view=battle&tab=streak&cup=' || v_cup.id
        from public.tower_cup_players p
       where p.cup_id = v_cup.id and p.auth_user_id <> new.auth_user_id
      on conflict (dedup) do nothing;
    end loop;
  exception when others then
    raise warning 'tower_cup_climb: %', sqlerrm;
  end;
  return null;
end;
$$;
revoke all on function public.tower_cup_climb() from public, anon, authenticated;
drop trigger if exists tower_cup_climb on public.streak_runs;
create trigger tower_cup_climb after update of wins on public.streak_runs
  for each row when (new.daily is null and new.wins > old.wins) execute function public.tower_cup_climb();

-- 6. 계정의 승인된 이름(없으면 거절)
create or replace function public.tower_cup_name()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  select btrim(a.requested_name) into v_name from public.player_accounts a where a.auth_user_id = (select auth.uid()) and a.status = 'approved';
  if v_name is null then
    raise exception using errcode = '42501', message = '이름이 승인된 Google 계정만 등반전에 참가할 수 있습니다.';
  end if;
  return v_name;
end;
$$;
revoke all on function public.tower_cup_name() from public, anon, authenticated;

-- 7. 만들기. 시작이 지금보다 앞이면 지금이다. 연 사람은 참가자다. { id, code }
create or replace function public.tower_cup_create(p_title text, p_starts_at timestamptz, p_ends_at timestamptz, p_room text, p_limit integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text := public.tower_cup_name();
  v_start timestamptz := greatest(coalesce(p_starts_at, now()), now());
  v_code text;
  v_id uuid;
begin
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 24 then
    raise exception using errcode = '22023', message = '등반전 이름은 1자에서 24자입니다.';
  end if;
  if p_room is null or p_room not in ('open', 'code') then
    raise exception using errcode = '22023', message = '입장 방식을 골라 주세요.';
  end if;
  if p_limit is not null and p_limit not between 1 and 20 then
    raise exception using errcode = '22023', message = '반영 횟수는 1번에서 20번입니다.';
  end if;
  if p_ends_at is null or p_ends_at <= v_start then
    raise exception using errcode = '22023', message = '마감은 시작보다 뒤여야 합니다.';
  end if;
  if p_ends_at > v_start + interval '31 days' then
    raise exception using errcode = '22023', message = '등반전은 31일까지 열 수 있습니다.';
  end if;
  perform pg_advisory_xact_lock(hashtext('tower_cup_create'));
  if exists (select 1 from public.tower_cups c where c.host_user = v_user and c.ends_at > now()) then
    raise exception using errcode = 'P0001', message = '이미 연 등반전이 있습니다. 그 등반전이 끝나면 새로 열 수 있습니다.';
  end if;
  if (select count(*) from public.tower_cups c where c.created_at > now() - interval '1 day') >= 50 then
    raise exception using errcode = 'P0001', message = '오늘 열 수 있는 등반전이 모두 찼습니다. 내일 다시 열어 주세요.';
  end if;
  if p_room = 'code' then v_code := lpad((floor(random() * 10000))::integer::text, 4, '0'); end if;
  insert into public.tower_cups (title, host_user, host_name, starts_at, ends_at, room, code, run_limit)
  values (btrim(p_title), v_user, v_name, v_start, p_ends_at, p_room, v_code, p_limit)
  returning id into v_id;
  insert into public.tower_cup_players (cup_id, auth_user_id, trainer_name) values (v_id, v_user, v_name);
  return jsonb_build_object('id', v_id, 'code', v_code);
end;
$$;

-- 8. 들어가기. 끝난 등반전과 틀린 코드는 거절한다. 이미 들어갔으면 그대로.
create or replace function public.tower_cup_join(p_id uuid, p_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := public.tower_cup_name();
  v_cup public.tower_cups;
begin
  select * into v_cup from public.tower_cups c where c.id = p_id;
  if v_cup.id is null then
    raise exception using errcode = 'P0002', message = '등반전을 찾을 수 없습니다.';
  end if;
  if v_cup.ends_at <= now() then
    raise exception using errcode = 'P0001', message = '마감된 등반전입니다.';
  end if;
  if v_cup.room = 'code' and coalesce(p_code, '') <> v_cup.code
     and not exists (select 1 from public.tower_cup_players p where p.cup_id = p_id and p.auth_user_id = (select auth.uid())) then
    raise exception using errcode = '42501', message = '코드가 맞지 않습니다.';
  end if;
  insert into public.tower_cup_players (cup_id, auth_user_id, trainer_name) values (p_id, (select auth.uid()), v_name)
  on conflict do nothing;
  return jsonb_build_object('id', p_id, 'joined', true);
end;
$$;

-- 9. 지금 마감(연 사람만). 시작 전이면 지운다.
create or replace function public.tower_cup_close(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cup public.tower_cups;
begin
  select * into v_cup from public.tower_cups c where c.id = p_id and c.host_user = (select auth.uid()) for update;
  if v_cup.id is null then
    raise exception using errcode = '42501', message = '연 사람만 마감할 수 있습니다.';
  end if;
  if v_cup.ends_at <= now() then return jsonb_build_object('id', p_id, 'gone', false); end if;
  if v_cup.starts_at >= now() then
    delete from public.tower_cups c where c.id = p_id;
    return jsonb_build_object('id', p_id, 'gone', true);
  end if;
  update public.tower_cups c set ends_at = now() where c.id = p_id;
  return jsonb_build_object('id', p_id, 'gone', false);
end;
$$;

-- 10. 목록: 끝나지 않았거나 7일 안에 끝난 등반전. 공개 등반전과 내가 든 등반전만. 열린 것, 열릴 것, 끝난 것 순.
create or replace function public.tower_cups()
returns table (id uuid, title text, host_name text, starts_at timestamptz, ends_at timestamptz, room text, run_limit integer, players integer, joined boolean, hosting boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.title, c.host_name, c.starts_at, c.ends_at, c.room, c.run_limit,
         (select count(*)::integer from public.tower_cup_players p where p.cup_id = c.id),
         exists (select 1 from public.tower_cup_players p where p.cup_id = c.id and p.auth_user_id = (select auth.uid())),
         c.host_user is not distinct from (select auth.uid())
    from public.tower_cups c
   where c.ends_at > now() - interval '7 days'
     and (c.room = 'open' or exists (select 1 from public.tower_cup_players p where p.cup_id = c.id and p.auth_user_id = (select auth.uid())))
   order by (c.ends_at <= now()), (c.starts_at > now()), c.ends_at
   limit 30;
$$;

-- 11. 한 등반전의 순위(링크를 아는 누구나). 참가자마다 센 도전의 최고, 같으면 먼저 닿은 쪽, 이긴 판이 없으면 들어온 차례.
--     live: 센 도전이 지금 진행 중이고 시계가 남았다(관전할 battle_id). 코드는 연 사람과 참가자에게만. 계정 id는 내보내지 않는다.
create or replace function public.tower_cup_board(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with cup as (
    select c.*, (select auth.uid()) as me from public.tower_cups c where c.id = p_id
  ), best as (
    select p.auth_user_id, p.trainer_name, p.joined_at, b.wins, b.reached_at, coalesce(u.used, 0) as used, l.battle_id as live_id
      from cup c
      join public.tower_cup_players p on p.cup_id = c.id
      left join lateral (select r.wins, r.reached_at from public.tower_cup_runs r
                          where r.cup_id = c.id and r.auth_user_id = p.auth_user_id
                          order by r.wins desc, r.reached_at limit 1) b on true
      left join lateral (select count(*)::integer as used from public.tower_cup_runs r where r.cup_id = c.id and r.auth_user_id = p.auth_user_id) u on true
      left join lateral (select s.battle_id from public.tower_cup_runs r
                           join public.streak_runs s on s.id = r.run_id and s.status = 'active'
                           join public.battles g on g.id = s.battle_id and g.status = 'active' and g.deadline_at > now()
                          where r.cup_id = c.id and r.auth_user_id = p.auth_user_id and now() < c.ends_at
                          limit 1) l on true
  )
  select case when not exists (select 1 from cup) then null else jsonb_build_object(
    'cup', (select jsonb_build_object('id', c.id, 'title', c.title, 'host_name', c.host_name, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
                                      'room', c.room, 'run_limit', c.run_limit, 'hosting', c.host_user is not distinct from c.me,
                                      'joined', exists (select 1 from public.tower_cup_players p where p.cup_id = c.id and p.auth_user_id = c.me),
                                      'code', case when exists (select 1 from public.tower_cup_players p where p.cup_id = c.id and p.auth_user_id = c.me) then c.code end,
                                      'players', (select count(*) from public.tower_cup_players p where p.cup_id = c.id))
              from cup c),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('place', x.place, 'trainer_name', x.trainer_name, 'wins', x.wins, 'live', x.live_id is not null,
                                                          'battle_id', x.live_id, 'reached_at', x.reached_at, 'runs', x.used, 'mine', x.mine) order by x.place)
                        from (select row_number() over (order by coalesce(b.wins, 0) desc, b.reached_at nulls last, b.joined_at)::integer as place,
                                     b.trainer_name, coalesce(b.wins, 0) as wins, b.live_id, b.reached_at, b.used,
                                     b.auth_user_id is not distinct from (select c.me from cup c) as mine
                                from best b) x), '[]'::jsonb)
  ) end;
$$;

revoke all on function public.tower_cup_create(text, timestamptz, timestamptz, text, integer) from public, anon;
revoke all on function public.tower_cup_join(uuid, text) from public, anon;
revoke all on function public.tower_cup_close(uuid) from public, anon;
revoke all on function public.tower_cups() from public;
revoke all on function public.tower_cup_board(uuid) from public;
grant execute on function public.tower_cup_create(text, timestamptz, timestamptz, text, integer) to authenticated;
grant execute on function public.tower_cup_join(uuid, text) to authenticated;
grant execute on function public.tower_cup_close(uuid) to authenticated;
grant execute on function public.tower_cups() to anon, authenticated;
grant execute on function public.tower_cup_board(uuid) to anon, authenticated;
