-- 등반전 수정·삭제 및 시작 전 게스트 도전 차단 (2026-11-28). tower_cups_guest.sql 뒤에 실행한다. 두 번 실행해도 안전하다.

begin;

-- 1. 게스트 도전 시작: 아직 시작하지 않은 등반전(starts_at > now())도 거절한다.
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
  if v_cup.starts_at > now() then
    raise exception using errcode = '42501', message = '아직 시작하지 않은 등반전입니다.';
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

-- 2. 등반전 수정 (개최자만). 이미 시작한 등반전의 시작 시각은 유지한다.
create or replace function public.tower_cup_update(
  p_id uuid, p_title text, p_starts_at timestamptz, p_ends_at timestamptz, p_room text, p_limit integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cup public.tower_cups;
  v_start timestamptz;
  v_code text;
begin
  select * into v_cup from public.tower_cups c where c.id = p_id and c.host_user = (select auth.uid()) for update;
  if v_cup.id is null then
    raise exception using errcode = '42501', message = '연 사람만 수정할 수 있습니다.';
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
    else lpad((floor(random() * 10000))::integer::text, 4, '0')
  end;
  update public.tower_cups c
     set title = btrim(p_title), starts_at = v_start, ends_at = p_ends_at, room = p_room, code = v_code, run_limit = p_limit
   where c.id = p_id;
  return jsonb_build_object('id', p_id, 'code', v_code);
end;
$$;
revoke all on function public.tower_cup_update(uuid, text, timestamptz, timestamptz, text, integer) from public, anon;
grant execute on function public.tower_cup_update(uuid, text, timestamptz, timestamptz, text, integer) to authenticated;

-- 3. 등반전 삭제 (개최자만). 게스트 도전의 판(battles)도 함께 정리한다.
create or replace function public.tower_cup_delete(p_id uuid)
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
    raise exception using errcode = '42501', message = '연 사람만 삭제할 수 있습니다.';
  end if;
  delete from public.battles b
   where b.run_id in (select r.id from public.streak_runs r where r.cup_id = p_id);
  delete from public.tower_cups c where c.id = p_id;
  return jsonb_build_object('id', p_id, 'deleted', true);
end;
$$;
revoke all on function public.tower_cup_delete(uuid) from public, anon;
grant execute on function public.tower_cup_delete(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
