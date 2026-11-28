-- 등반전 비로그인(닉네임) 참가 지원 (2026-11-28). streak_runs.sql 과 tower_cups.sql 뒤에 실행한다. 두 번 실행해도 안전하다.
-- 월간 도전의 탑(streak_board)은 승인된 Google 계정만 오르고, 등반전(tower_cups)에 한해 기기별 게스트 토큰 + 닉네임으로 참가·등반할 수 있다.

begin;

-- 1. 게스트 토큰 해시(원본 토큰은 DB에 저장하지 않는다).
create or replace function public.tower_cup_guest_hash(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to('ypl:cup:' || coalesce(p_token, ''), 'UTF8')), 'hex');
$$;
revoke all on function public.tower_cup_guest_hash(text) from public, anon, authenticated;

-- 2. streak_runs: 게스트 등반전 도전은 auth_user_id 없이 cup_id + guest_token_hash 로 기록한다.
alter table public.streak_runs alter column auth_user_id drop not null;
alter table public.streak_runs add column if not exists cup_id uuid references public.tower_cups (id) on delete cascade;
alter table public.streak_runs add column if not exists guest_token_hash text;
alter table public.streak_runs drop constraint if exists streak_runs_owner;
alter table public.streak_runs add constraint streak_runs_owner check (
  (auth_user_id is not null and cup_id is null and guest_token_hash is null)
  or (auth_user_id is null and cup_id is not null and guest_token_hash is not null and daily is null)
);
create unique index if not exists streak_runs_one_active_guest
  on public.streak_runs (cup_id, guest_token_hash)
  where status = 'active' and guest_token_hash is not null;

-- 3. tower_cup_players / tower_cup_runs: 계정('u:' || uuid)과 게스트('g:' || hash)를 player_key로 함께 둔다.
alter table public.tower_cup_players add column if not exists player_key text;
update public.tower_cup_players set player_key = 'u:' || auth_user_id where player_key is null and auth_user_id is not null;
alter table public.tower_cup_players alter column player_key set not null;
alter table public.tower_cup_players drop constraint if exists tower_cup_players_pkey;
alter table public.tower_cup_players add primary key (cup_id, player_key);
alter table public.tower_cup_players alter column auth_user_id drop not null;
alter table public.tower_cup_players add column if not exists guest_token_hash text;
alter table public.tower_cup_players drop constraint if exists tower_cup_players_owner;
alter table public.tower_cup_players add constraint tower_cup_players_owner check (
  (auth_user_id is not null and guest_token_hash is null)
  or (auth_user_id is null and guest_token_hash is not null)
);
create unique index if not exists tower_cup_players_auth_uq
  on public.tower_cup_players (cup_id, auth_user_id) where auth_user_id is not null;
create unique index if not exists tower_cup_players_guest_uq
  on public.tower_cup_players (cup_id, guest_token_hash) where guest_token_hash is not null;

alter table public.tower_cup_runs add column if not exists player_key text;
update public.tower_cup_runs set player_key = 'u:' || auth_user_id where player_key is null and auth_user_id is not null;
alter table public.tower_cup_runs alter column player_key set not null;
alter table public.tower_cup_runs alter column auth_user_id drop not null;
create index if not exists tower_cup_runs_key_board on public.tower_cup_runs (cup_id, player_key);

-- 4. 트리거 갱신: 계정 도전과 게스트 등반전 도전을 모두 센다.
create or replace function public.tower_cup_enter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if new.auth_user_id is not null then
      insert into public.tower_cup_runs (cup_id, run_id, auth_user_id, player_key, nth, wins, reached_at)
      select c.id, new.id, new.auth_user_id, 'u:' || new.auth_user_id, n.done + 1, new.wins, new.started_at
        from public.tower_cups c
        join public.tower_cup_players p on p.cup_id = c.id and p.auth_user_id = new.auth_user_id
       cross join lateral (select count(*)::integer as done from public.tower_cup_runs r where r.cup_id = c.id and r.player_key = 'u:' || new.auth_user_id) n
       where new.started_at >= c.starts_at and new.started_at < c.ends_at
         and (c.run_limit is null or n.done < c.run_limit)
      on conflict do nothing;
    elsif new.guest_token_hash is not null and new.cup_id is not null then
      insert into public.tower_cup_runs (cup_id, run_id, auth_user_id, player_key, nth, wins, reached_at)
      select c.id, new.id, null, 'g:' || new.guest_token_hash, n.done + 1, new.wins, new.started_at
        from public.tower_cups c
        join public.tower_cup_players p on p.cup_id = c.id and p.guest_token_hash = new.guest_token_hash
       cross join lateral (select count(*)::integer as done from public.tower_cup_runs r where r.cup_id = c.id and r.player_key = 'g:' || new.guest_token_hash) n
       where c.id = new.cup_id
         and new.started_at >= c.starts_at and new.started_at < c.ends_at
         and (c.run_limit is null or n.done < c.run_limit)
      on conflict do nothing;
    end if;
  exception when others then
    raise warning 'tower_cup_enter: %', sqlerrm;
  end;
  return null;
end;
$$;

create or replace function public.tower_cup_climb()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cup record;
  v_best integer;
  v_player_key text := case when new.auth_user_id is not null then 'u:' || new.auth_user_id else 'g:' || new.guest_token_hash end;
begin
  begin
    for v_cup in
      update public.tower_cup_runs r set wins = new.wins, reached_at = now()
        from public.tower_cups c
       where r.run_id = new.id and c.id = r.cup_id and now() < c.ends_at and new.wins > r.wins
      returning c.id, c.title
    loop
      if new.wins < 2 then continue; end if;
      select max(r.wins) into v_best from public.tower_cup_runs r where r.cup_id = v_cup.id and r.player_key <> v_player_key;
      if coalesce(v_best, 0) <> new.wins - 1 then continue; end if;
      insert into public.push_outbox (dedup, kind, auth_user_id, title, body, url)
      select 'cup:' || v_cup.id || ':' || new.wins || ':' || p.auth_user_id, 'record', p.auth_user_id, '등반전 1위',
             left(new.trainer_name, 20) || ' 님이 ' || new.wins || '연승으로 ' || left(v_cup.title, 24) || ' 1위에 올랐습니다.',
             '?view=battle&tab=streak&cup=' || v_cup.id
        from public.tower_cup_players p
       where p.cup_id = v_cup.id and p.auth_user_id is not null and p.player_key <> v_player_key
      on conflict (dedup) do nothing;
    end loop;
  exception when others then
    raise warning 'tower_cup_climb: %', sqlerrm;
  end;
  return null;
end;
$$;

-- 5. 기존 계정 생성/참가 RPC에 player_key 반영.
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
  insert into public.tower_cup_players (cup_id, player_key, auth_user_id, trainer_name)
  values (v_id, 'u:' || v_user, v_user, v_name);
  return jsonb_build_object('id', v_id, 'code', v_code);
end;
$$;

create or replace function public.tower_cup_join(p_id uuid, p_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
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
     and not exists (select 1 from public.tower_cup_players p where p.cup_id = p_id and p.player_key = 'u:' || v_user) then
    raise exception using errcode = '42501', message = '코드가 맞지 않습니다.';
  end if;
  insert into public.tower_cup_players (cup_id, player_key, auth_user_id, trainer_name)
  values (p_id, 'u:' || v_user, v_user, v_name)
  on conflict do nothing;
  return jsonb_build_object('id', p_id, 'joined', true);
end;
$$;

-- 6. 비로그인(닉네임) 참가 RPC.
create or replace function public.tower_cup_join_guest(p_id uuid, p_nickname text, p_code text default null, p_guest_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_nickname, ''));
  v_token text := btrim(coalesce(p_guest_token, ''));
  v_hash text;
  v_key text;
  v_cup public.tower_cups;
begin
  if char_length(v_name) not between 1 and 20 then
    raise exception using errcode = '22023', message = '닉네임은 1자에서 20자입니다.';
  end if;
  if char_length(v_token) < 16 then
    raise exception using errcode = '22023', message = '참가 정보를 확인하지 못했습니다. 다시 시도해 주세요.';
  end if;
  select * into v_cup from public.tower_cups c where c.id = p_id;
  if v_cup.id is null then
    raise exception using errcode = 'P0002', message = '등반전을 찾을 수 없습니다.';
  end if;
  if v_cup.ends_at <= now() then
    raise exception using errcode = 'P0001', message = '마감된 등반전입니다.';
  end if;
  v_hash := public.tower_cup_guest_hash(v_token);
  v_key := 'g:' || v_hash;
  if v_cup.room = 'code' and coalesce(p_code, '') <> v_cup.code
     and not exists (select 1 from public.tower_cup_players p where p.cup_id = p_id and p.player_key = v_key) then
    raise exception using errcode = '42501', message = '코드가 맞지 않습니다.';
  end if;
  if exists (select 1 from public.tower_cup_players p where p.cup_id = p_id and lower(btrim(p.trainer_name)) = lower(v_name) and p.player_key <> v_key) then
    raise exception using errcode = 'P0001', message = '이미 사용 중인 닉네임입니다.';
  end if;
  insert into public.tower_cup_players (cup_id, player_key, auth_user_id, guest_token_hash, trainer_name)
  values (p_id, v_key, null, v_hash, v_name)
  on conflict (cup_id, player_key) do nothing;
  return jsonb_build_object('id', p_id, 'joined', true);
end;
$$;
revoke all on function public.tower_cup_join_guest(uuid, text, text, text) from public;
grant execute on function public.tower_cup_join_guest(uuid, text, text, text) to anon, authenticated;

-- 7. 목록 및 순위표: 게스트 토큰이 있으면 본인 참가 여부와 코드, 본인 줄을 함께 돌려준다.
drop function if exists public.tower_cups();
create or replace function public.tower_cups(p_guest_token text default null)
returns table (id uuid, title text, host_name text, starts_at timestamptz, ends_at timestamptz, room text, run_limit integer, players integer, joined boolean, hosting boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select case
      when (select auth.uid()) is not null then 'u:' || (select auth.uid())
      when nullif(btrim(coalesce(p_guest_token, '')), '') is not null then 'g:' || public.tower_cup_guest_hash(btrim(p_guest_token))
      else null
    end as key
  )
  select c.id, c.title, c.host_name, c.starts_at, c.ends_at, c.room, c.run_limit,
         (select count(*)::integer from public.tower_cup_players p where p.cup_id = c.id),
         exists (select 1 from public.tower_cup_players p, me where p.cup_id = c.id and p.player_key = me.key),
         c.host_user is not distinct from (select auth.uid())
    from public.tower_cups c
   where c.ends_at > now() - interval '7 days'
     and (c.room = 'open' or exists (select 1 from public.tower_cup_players p, me where p.cup_id = c.id and p.player_key = me.key))
   order by (c.ends_at <= now()), (c.starts_at > now()), c.ends_at
   limit 30;
$$;
revoke all on function public.tower_cups(text) from public;
grant execute on function public.tower_cups(text) to anon, authenticated;

drop function if exists public.tower_cup_board(uuid);
create or replace function public.tower_cup_board(p_id uuid, p_guest_token text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with cup as (
    select c.*, (select auth.uid()) as me_uid,
           case
             when (select auth.uid()) is not null then 'u:' || (select auth.uid())
             when nullif(btrim(coalesce(p_guest_token, '')), '') is not null then 'g:' || public.tower_cup_guest_hash(btrim(p_guest_token))
             else null
           end as me_key
      from public.tower_cups c where c.id = p_id
  ), best as (
    select p.player_key, p.trainer_name, p.joined_at, b.wins, b.reached_at, coalesce(u.used, 0) as used, l.battle_id as live_id
      from cup c
      join public.tower_cup_players p on p.cup_id = c.id
      left join lateral (select r.wins, r.reached_at from public.tower_cup_runs r
                          where r.cup_id = c.id and r.player_key = p.player_key
                          order by r.wins desc, r.reached_at limit 1) b on true
      left join lateral (select count(*)::integer as used from public.tower_cup_runs r where r.cup_id = c.id and r.player_key = p.player_key) u on true
      left join lateral (select s.battle_id from public.tower_cup_runs r
                           join public.streak_runs s on s.id = r.run_id and s.status = 'active'
                           join public.battles g on g.id = s.battle_id and g.status = 'active' and g.deadline_at > now()
                          where r.cup_id = c.id and r.player_key = p.player_key and now() < c.ends_at
                          limit 1) l on true
  )
  select case when not exists (select 1 from cup) then null else jsonb_build_object(
    'cup', (select jsonb_build_object('id', c.id, 'title', c.title, 'host_name', c.host_name, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
                                      'room', c.room, 'run_limit', c.run_limit, 'hosting', c.host_user is not distinct from c.me_uid,
                                      'joined', exists (select 1 from public.tower_cup_players p where p.cup_id = c.id and p.player_key = c.me_key),
                                      'code', case when exists (select 1 from public.tower_cup_players p where p.cup_id = c.id and p.player_key = c.me_key) then c.code end,
                                      'players', (select count(*) from public.tower_cup_players p where p.cup_id = c.id))
              from cup c),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('place', x.place, 'trainer_name', x.trainer_name, 'wins', x.wins, 'live', x.live_id is not null,
                                                          'battle_id', x.live_id, 'reached_at', x.reached_at, 'runs', x.used, 'mine', x.mine) order by x.place)
                        from (select row_number() over (order by coalesce(b.wins, 0) desc, b.reached_at nulls last, b.joined_at)::integer as place,
                                     b.trainer_name, coalesce(b.wins, 0) as wins, b.live_id, b.reached_at, b.used,
                                     b.player_key is not distinct from (select c.me_key from cup c) as mine
                                from best b) x), '[]'::jsonb)
  ) end;
$$;
revoke all on function public.tower_cup_board(uuid, text) from public;
grant execute on function public.tower_cup_board(uuid, text) to anon, authenticated;

-- 8. 게스트 등반전 도전 시작/재개 (service_role 전용, 배틀 함수만 부른다).
create or replace function public.streak_begin_guest(p_cup_id uuid, p_guest_token text, p_format_id text, p_offer jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_guest_token, ''));
  v_hash text;
  v_cup public.tower_cups;
  v_player public.tower_cup_players;
  v_run uuid;
  v_stale record;
  v_keep_from timestamptz := (date_trunc('month', now() at time zone 'Asia/Seoul') - interval '1 month') at time zone 'Asia/Seoul';
begin
  if char_length(v_token) < 16 then
    raise exception using errcode = '42501', message = '등반전에 먼저 참가해 주세요.';
  end if;
  v_hash := public.tower_cup_guest_hash(v_token);
  select * into v_cup from public.tower_cups c where c.id = p_cup_id;
  if v_cup.id is null or v_cup.ends_at <= now() then
    raise exception using errcode = '42501', message = '마감되었거나 없는 등반전입니다.';
  end if;
  select * into v_player from public.tower_cup_players p
   where p.cup_id = p_cup_id and p.guest_token_hash = v_hash;
  if v_player.cup_id is null then
    raise exception using errcode = '42501', message = '등반전에 먼저 참가해 주세요.';
  end if;
  if v_cup.run_limit is not null and (
    select count(*) from public.tower_cup_runs r where r.cup_id = p_cup_id and r.player_key = v_player.player_key
  ) >= v_cup.run_limit then
    raise exception using errcode = 'P0001', message = '이 등반전의 도전 횟수를 모두 사용했습니다.';
  end if;

  perform pg_advisory_xact_lock(hashtext('streak_start'));
  if (select count(*) from public.streak_runs r where r.started_at > now() - interval '1 day') >= 300 then
    raise exception using errcode = 'P0001', message = '오늘의 도전의 탑이 모두 찼습니다. 내일 다시 도전해 주세요.';
  end if;

  for v_stale in
    select r.id as run_id, r.battle_id from public.streak_runs r
     where r.cup_id = p_cup_id and r.guest_token_hash = v_hash and r.status = 'active' for update
  loop
    update public.battles b
       set status = 'ended', winner = 'p2', ended_by = 'forfeit', log = b.spectator_log, input_log = '', version = b.version + 1, updated_at = now()
     where b.id = v_stale.battle_id and b.status = 'active';
    if v_stale.battle_id is not null then perform public.streak_clear_secret(v_stale.battle_id); end if;
    update public.streak_runs r set status = 'ended', ended_at = now(), offer = null where r.id = v_stale.run_id;
  end loop;

  for v_stale in
    select b.id, b.run_id from public.battles b
     where b.kind = 'streak' and b.status = 'active' and b.deadline_at < now() - interval '1 minute'
     order by b.deadline_at limit 20 for update skip locked
  loop
    update public.battles b
       set status = 'ended', winner = 'p2', ended_by = 'timeout', log = b.spectator_log, input_log = '', version = b.version + 1, updated_at = now()
     where b.id = v_stale.id;
  end loop;

  delete from public.battles b
   where b.id in (select o.id from public.battles o where o.kind = 'streak' and o.status = 'ended' and o.created_at < v_keep_from limit 200);

  insert into public.streak_runs (auth_user_id, cup_id, guest_token_hash, trainer_name, format_id, month, offer, daily)
  values (null, p_cup_id, v_hash, btrim(v_player.trainer_name), p_format_id, (date_trunc('month', now() at time zone 'Asia/Seoul'))::date, p_offer, null)
  returning id into v_run;
  return jsonb_build_object('run_id', v_run, 'trainer_name', btrim(v_player.trainer_name), 'wins', 0, 'lives', 2, 'cup_id', p_cup_id);
end;
$$;
revoke all on function public.streak_begin_guest(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.streak_begin_guest(uuid, text, text, jsonb) to service_role;

create or replace function public.streak_active_run_guest(p_cup_id uuid, p_guest_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('run_id', r.id, 'trainer_name', r.trainer_name, 'wins', r.wins, 'lives', r.lives, 'battle_id', r.battle_id,
         'offer', r.offer, 'daily', r.daily, 'cup_id', r.cup_id, 'games', (select count(*) from public.battles g where g.run_id = r.id))
    from public.streak_runs r
   where r.cup_id = p_cup_id
     and r.guest_token_hash = public.tower_cup_guest_hash(btrim(coalesce(p_guest_token, '')))
     and r.status = 'active';
$$;
revoke all on function public.streak_active_run_guest(uuid, text) from public, anon, authenticated;
grant execute on function public.streak_active_run_guest(uuid, text) to service_role;

-- 9. 월간 순위(streak_board)는 승인된 Google 계정 도전(auth_user_id is not null)만 센다.
create or replace function public.streak_board(p_month date default null)
returns table (place integer, trainer_name text, wins integer, live boolean, battle_id text, reached_at timestamptz, mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with month_runs as (
    select r.*, coalesce(r.last_win_at, r.started_at) as reached,
           (r.status = 'active' and b.status = 'active' and b.deadline_at > now()) as is_live
      from public.streak_runs r
      left join public.battles b on b.id = r.battle_id
     where r.month = coalesce(p_month, (date_trunc('month', now() at time zone 'Asia/Seoul'))::date)
       and r.daily is null
       and r.auth_user_id is not null
  ), best as (
    select distinct on (m.auth_user_id) m.*
      from month_runs m
     where m.wins > 0 or m.is_live
     order by m.auth_user_id, m.wins desc, m.reached, m.is_live desc
  )
  select (row_number() over (order by b.wins desc, b.reached))::integer, b.trainer_name, b.wins, coalesce(b.is_live, false),
         case when b.is_live then b.battle_id end, b.reached, b.auth_user_id = (select auth.uid())
    from best b
   order by b.wins desc, b.reached
   limit 100;
$$;
revoke all on function public.streak_board(date) from public;
grant execute on function public.streak_board(date) to anon, authenticated, service_role;

-- tower_history.sql 이 이미 실행된 환경이라면 월간 상위 3위와 아카이브 트리거도 게스트 도전을 제외한다.
do $$ begin
  if to_regprocedure('public.streak_month_tops()') is not null then
    execute $fn$
      create or replace function public.streak_month_tops()
      returns table (month date, place integer, trainer_name text, wins integer, run_id uuid, reached_at timestamptz)
      language sql stable security definer set search_path = ''
      as $body$
        with best as (
          select distinct on (r.month, r.auth_user_id) r.month, r.auth_user_id, r.trainer_name, r.wins, r.id, coalesce(r.last_win_at, r.started_at) as reached
            from public.streak_runs r
           where r.daily is null and r.auth_user_id is not null and r.wins > 0
             and r.month < (date_trunc('month', now() at time zone 'Asia/Seoul'))::date
           order by r.month, r.auth_user_id, r.wins desc, coalesce(r.last_win_at, r.started_at)
        ), ranked as (
          select b.*, (row_number() over (partition by b.month order by b.wins desc, b.reached))::integer as place from best b
        )
        select k.month, k.place, k.trainer_name, k.wins, k.id, k.reached from ranked k where k.place <= 3 order by k.month desc, k.place;
      $body$;
    $fn$;
  end if;
  if to_regclass('public.tower_archive') is not null then
    execute $fn$
      create or replace function public.tower_archive_keep()
      returns trigger language plpgsql security definer set search_path = ''
      as $body$
      declare v_run public.streak_runs%rowtype;
      begin
        if old.kind <> 'streak' or old.run_id is null or old.status <> 'ended' then return old; end if;
        select * into v_run from public.streak_runs r where r.id = old.run_id;
        if not found or v_run.daily is not null or v_run.auth_user_id is null then return old; end if;
        if exists (
          select 1 from public.streak_runs r
           where r.month = v_run.month and r.daily is null and r.auth_user_id is not null and r.wins > 0
             and (r.wins > v_run.wins or (r.wins = v_run.wins and coalesce(r.last_win_at, r.started_at) < coalesce(v_run.last_win_at, v_run.started_at)))
        ) then return old; end if;
        insert into public.tower_archive (battle_id, run_id, month, format_id, p1_name, p2_name, winner, ended_by, turn, spectator_log, input_log, created_at)
        values (old.id, old.run_id, v_run.month, old.format_id, old.p1_name, old.p2_name, old.winner, old.ended_by, old.turn, old.spectator_log, old.input_log, old.created_at)
        on conflict (battle_id) do nothing;
        return old;
      end;
      $body$;
    $fn$;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
