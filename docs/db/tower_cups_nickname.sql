-- 등반전 구글 연동 계정의 닉네임 참가 및 미승인 로그인 계정의 게스트 식별 지원 (2026-11-28). tower_cups_manage.sql 뒤에 실행한다.

begin;

-- 1. 승인된 Google 계정도 등반전 참가 시 닉네임을 직접 정할 수 있도록 p_nickname 추가(비어 있으면 기존 트레이너 이름 사용).
drop function if exists public.tower_cup_join(uuid, text);
create or replace function public.tower_cup_join(p_id uuid, p_code text default null, p_nickname text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_account_name text := public.tower_cup_name();
  v_name text := coalesce(nullif(btrim(coalesce(p_nickname, '')), ''), v_account_name);
  v_key text := 'u:' || v_user;
  v_cup public.tower_cups;
begin
  if char_length(v_name) not between 1 and 20 then
    raise exception using errcode = '22023', message = '닉네임은 1자에서 20자입니다.';
  end if;
  select * into v_cup from public.tower_cups c where c.id = p_id;
  if v_cup.id is null then
    raise exception using errcode = 'P0002', message = '등반전을 찾을 수 없습니다.';
  end if;
  if v_cup.ends_at <= now() then
    raise exception using errcode = 'P0001', message = '마감된 등반전입니다.';
  end if;
  if v_cup.room = 'code' and coalesce(p_code, '') <> v_cup.code
     and not exists (select 1 from public.tower_cup_players p where p.cup_id = p_id and p.player_key = v_key) then
    raise exception using errcode = '42501', message = '코드가 맞지 않습니다.';
  end if;
  if exists (select 1 from public.tower_cup_players p where p.cup_id = p_id and lower(btrim(p.trainer_name)) = lower(v_name) and p.player_key <> v_key) then
    raise exception using errcode = 'P0001', message = '이미 사용 중인 닉네임입니다.';
  end if;
  insert into public.tower_cup_players (cup_id, player_key, auth_user_id, trainer_name)
  values (p_id, v_key, v_user, v_name)
  on conflict do nothing;
  return jsonb_build_object('id', p_id, 'joined', true);
end;
$$;
revoke all on function public.tower_cup_join(uuid, text, text) from public, anon;
grant execute on function public.tower_cup_join(uuid, text, text) to authenticated;

-- 2. 목록 및 순위표: Google 로그인은 되어 있으나 이름 미승인 상태(게스트 토큰으로 참가)여도 본인 참가 여부와 본인 줄을 찾는다.
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
     and (c.room = 'open' or exists (select 1 from public.tower_cup_players p, me where p.cup_id = c.id and (p.player_key = me.u_key or p.player_key = me.g_key)))
   order by (c.ends_at <= now()), (c.starts_at > now()), c.ends_at
   limit 30;
$$;
revoke all on function public.tower_cups(text) from public;
grant execute on function public.tower_cups(text) to anon, authenticated;

create or replace function public.tower_cup_board(p_id uuid, p_guest_token text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with cup as (
    select c.*, (select auth.uid()) as me_uid,
           case when (select auth.uid()) is not null then 'u:' || (select auth.uid()) end as me_u_key,
           case when nullif(btrim(coalesce(p_guest_token, '')), '') is not null then 'g:' || public.tower_cup_guest_hash(btrim(p_guest_token)) end as me_g_key
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
                                      'joined', exists (select 1 from public.tower_cup_players p where p.cup_id = c.id and (p.player_key = c.me_u_key or p.player_key = c.me_g_key)),
                                      'code', case when exists (select 1 from public.tower_cup_players p where p.cup_id = c.id and (p.player_key = c.me_u_key or p.player_key = c.me_g_key)) then c.code end,
                                      'players', (select count(*) from public.tower_cup_players p where p.cup_id = c.id))
              from cup c),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('place', x.place, 'trainer_name', x.trainer_name, 'wins', x.wins, 'live', x.live_id is not null,
                                                          'battle_id', x.live_id, 'reached_at', x.reached_at, 'runs', x.used, 'mine', x.mine) order by x.place)
                        from (select row_number() over (order by coalesce(b.wins, 0) desc, b.reached_at nulls last, b.joined_at)::integer as place,
                                     b.trainer_name, coalesce(b.wins, 0) as wins, b.live_id, b.reached_at, b.used,
                                     (b.player_key = (select c.me_u_key from cup c) or b.player_key = (select c.me_g_key from cup c)) as mine
                                from best b) x), '[]'::jsonb)
  ) end;
$$;
revoke all on function public.tower_cup_board(uuid, text) from public;
grant execute on function public.tower_cup_board(uuid, text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
