-- 등반전 개최자 닉네임 지정, 코드 등반전 목록 노출, 4자리(1000~9999) 코드 생성 강제 (2026-11-28). tower_cups_nickname.sql 뒤에 실행한다.

begin;

-- 1. 만들기: 개최자 닉네임(p_nickname) 지원 및 4자리 코드(1000~9999) 생성.
drop function if exists public.tower_cup_create(text, timestamptz, timestamptz, text, integer);
create or replace function public.tower_cup_create(
  p_title text, p_starts_at timestamptz, p_ends_at timestamptz, p_room text, p_limit integer default null, p_nickname text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_account_name text := public.tower_cup_name();
  v_name text := coalesce(nullif(btrim(coalesce(p_nickname, '')), ''), v_account_name);
  v_start timestamptz := greatest(coalesce(p_starts_at, now()), now());
  v_code text;
  v_id uuid;
begin
  if char_length(v_name) not between 1 and 20 then
    raise exception using errcode = '22023', message = '닉네임은 1자에서 20자입니다.';
  end if;
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
  if p_room = 'code' then v_code := (1000 + floor(random() * 9000))::integer::text; end if;
  insert into public.tower_cups (title, host_user, host_name, starts_at, ends_at, room, code, run_limit)
  values (btrim(p_title), v_user, v_name, v_start, p_ends_at, p_room, v_code, p_limit)
  returning id into v_id;
  insert into public.tower_cup_players (cup_id, player_key, auth_user_id, trainer_name)
  values (v_id, 'u:' || v_user, v_user, v_name);
  return jsonb_build_object('id', v_id, 'code', v_code);
end;
$$;
revoke all on function public.tower_cup_create(text, timestamptz, timestamptz, text, integer, text) from public, anon;
grant execute on function public.tower_cup_create(text, timestamptz, timestamptz, text, integer, text) to authenticated;

-- 2. 수정: 개최자 닉네임(p_nickname) 변경 및 4자리 코드(1000~9999) 생성.
drop function if exists public.tower_cup_update(uuid, text, timestamptz, timestamptz, text, integer);
create or replace function public.tower_cup_update(
  p_id uuid, p_title text, p_starts_at timestamptz, p_ends_at timestamptz, p_room text, p_limit integer default null, p_nickname text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_cup public.tower_cups;
  v_name text;
  v_start timestamptz;
  v_code text;
begin
  select * into v_cup from public.tower_cups c where c.id = p_id and c.host_user = v_user for update;
  if v_cup.id is null then
    raise exception using errcode = '42501', message = '연 사람만 수정할 수 있습니다.';
  end if;
  v_name := coalesce(nullif(btrim(coalesce(p_nickname, '')), ''), v_cup.host_name);
  if char_length(v_name) not between 1 and 20 then
    raise exception using errcode = '22023', message = '닉네임은 1자에서 20자입니다.';
  end if;
  if exists (select 1 from public.tower_cup_players p where p.cup_id = p_id and lower(btrim(p.trainer_name)) = lower(v_name) and p.player_key <> 'u:' || v_user) then
    raise exception using errcode = 'P0001', message = '이미 사용 중인 닉네임입니다.';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 24 then
    raise exception using errcode = '22023', message = '등반전 이름은 1자에서 24자입니다.';
  end if;
  if p_room is null or p_room not in ('open', 'code') then
    raise exception using errcode = '22023', message = '입장 방식을 골라 주세요.';
  end if;
  if p_limit is not null and p_limit not between 1 and 20 then
    raise exception using errcode = '22023', message = '반영 횟수는 1번에서 20번입니다.';
  end if;
  v_start := case when v_cup.starts_at <= now() then v_cup.starts_at else greatest(coalesce(p_starts_at, now()), now()) end;
  if p_ends_at is null or p_ends_at <= v_start then
    raise exception using errcode = '22023', message = '마감은 시작보다 뒤여야 합니다.';
  end if;
  if p_ends_at > v_start + interval '31 days' then
    raise exception using errcode = '22023', message = '등반전은 31일까지 열 수 있습니다.';
  end if;
  v_code := case
    when p_room = 'open' then null
    when v_cup.code is not null then v_cup.code
    else (1000 + floor(random() * 9000))::integer::text
  end;
  update public.tower_cups c
     set title = btrim(p_title), host_name = v_name, starts_at = v_start, ends_at = p_ends_at, room = p_room, code = v_code, run_limit = p_limit
   where c.id = p_id;
  update public.tower_cup_players p
     set trainer_name = v_name
   where p.cup_id = p_id and p.player_key = 'u:' || v_user;
  return jsonb_build_object('id', p_id, 'code', v_code);
end;
$$;
revoke all on function public.tower_cup_update(uuid, text, timestamptz, timestamptz, text, integer, text) from public, anon;
grant execute on function public.tower_cup_update(uuid, text, timestamptz, timestamptz, text, integer, text) to authenticated;

-- 3. 목록: 코드 등반전도 모두 목록에 노출한다(코드는 참가한 사람에게만 board에서 보이며 입장 시 코드를 입력해야 한다).
create or replace function public.tower_cups(p_guest_token text default null)
returns table (id uuid, title text, host_name text, starts_at timestamptz, ends_at timestamptz, room text, run_limit integer, players integer, joined boolean, hosting boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select case when (select auth.uid()) is not null then 'u:' || (select auth.uid()) end as u_key,
           case when nullif(btrim(coalesce(p_guest_token, '')), '') is not null then 'g:' || public.tower_cup_guest_hash(btrim(p_guest_token)) end as g_key
  )
  select c.id, c.title, c.host_name, c.starts_at, c.ends_at, c.room, c.run_limit,
         (select count(*)::integer from public.tower_cup_players p where p.cup_id = c.id),
         exists (select 1 from public.tower_cup_players p, me where p.cup_id = c.id and (p.player_key = me.u_key or p.player_key = me.g_key)),
         c.host_user is not distinct from (select auth.uid())
    from public.tower_cups c
   where c.ends_at > now() - interval '7 days'
   order by (c.ends_at <= now()), (c.starts_at > now()), c.ends_at
   limit 30;
$$;
revoke all on function public.tower_cups(text) from public;
grant execute on function public.tower_cups(text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
