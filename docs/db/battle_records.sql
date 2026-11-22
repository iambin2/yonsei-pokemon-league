-- 배틀 기록 보강과 자동 정리 (2026-11-22, 인수인계 준비).
-- 1. 판마다 시작 시각(둘째 선수가 앉아 진행이 시작된 때)과 끝난 시각을 남긴다. 지금까지는 만든 때와 마지막으로 고친 때뿐이었다.
-- 2. 공식 배틀이 어느 파티 제출본으로 치러졌는지 남긴다. 파티는 고치지 않고 새 제출이 쌓이므로(ARCHITECTURE.md), 제출본 id가 그 판의 파티다.
-- 3. 매일 새벽 정리: 하루 넘게 아무도 들어오지 않은 친선 대기 방, 이틀 넘게 멈춘 친선 진행 판(결과가 없으니 기록이 아님)을 지우고,
--    끝난 친선과 공식 판의 엔진 상태(리플레이는 입력 기록으로 다시 돌리므로 필요 없음)를 비운다. 도전의 탑은 streak_runs.sql이 따로 정리한다.
-- 4. 친선과 공식 판의 한도(5000판)를 "최근 30일에 연 판"으로 바꾼다. 몰아서 여는 것은 그대로 막고, 쌓인 기록 때문에 방을 못 여는 일은 없앤다.
-- 5. 컴퓨터전 기록에 난이도를 남긴다(난이도별 승률).
-- 한 번 실행하면 되고, 다시 실행해도 안전하다. 실행한 뒤 docs/db/README.md 장부에 날짜를 적는다.
-- 확인: select count(*) filter (where ended_at is not null), count(*) filter (where started_at is not null) from public.battles;
--       select jobname, schedule from cron.job where jobname = 'battle-housekeeping';

-- ===== 1. 시작과 끝 시각 =====
alter table public.battles add column if not exists started_at timestamptz;
alter table public.battles add column if not exists ended_at timestamptz;

create or replace function public.battles_stamp_times()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'active' and new.started_at is null and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    new.started_at := now();
  end if;
  if new.status = 'ended' and new.ended_at is null and (tg_op = 'INSERT' or old.status is distinct from 'ended') then
    new.ended_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists battles_stamp_times on public.battles;
create trigger battles_stamp_times before insert or update of status on public.battles
  for each row execute function public.battles_stamp_times();

-- 지난 판: 정확한 시각은 남아 있지 않으므로 가장 가까운 값으로 채운다(시작은 만든 때, 끝은 마지막으로 고친 때).
update public.battles set started_at = created_at where started_at is null and status in ('active', 'ended') and ended_by is distinct from 'void';
update public.battles set ended_at = updated_at where ended_at is null and status = 'ended';

grant select (started_at, ended_at) on table public.battles to anon, authenticated;

-- ===== 2. 공식 배틀의 파티 제출본 =====
alter table public.battles add column if not exists p1_submission_id uuid;
alter table public.battles add column if not exists p2_submission_id uuid;

-- 그 자리의 참가 신청이 고정한 최종 제출본, 없으면 가장 최근 제출본(battle_official_seat와 같은 셈).
-- 팀전은 같은 엔트리에 여러 선수가 있으므로 그 판에 앉은 선수로 고른다.
create or replace function public.battle_seat_submission(p_entry_id uuid, p_player_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(r.final_submission_id, (
           select s.id from ypl_schema_validation.registration_submissions s
            where s.registration_id = r.id order by s.revision desc limit 1))
    from ypl_schema_validation.entry_participants p
    join ypl_schema_validation.event_registrations r on r.id = p.registration_id
   where p.entry_id = p_entry_id and (p_player_id is null or p.player_id = p_player_id)
   order by p.player_id = p_player_id desc nulls last
   limit 1;
$$;
revoke all on function public.battle_seat_submission(uuid, uuid) from public, anon, authenticated;

create or replace function public.battles_official_submission()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind <> 'official' then return new; end if;
  -- 랜덤 배틀 대회는 그 자리에 무작위 파티를 뽑으므로 제출본이 없다
  if (select e.competition_settings ->> 'matchPlay' from ypl_schema_validation.events e where e.id = new.event_id) = 'random' then return new; end if;
  if new.p1_entry_id is not null and (tg_op = 'INSERT' or new.p1_entry_id is distinct from old.p1_entry_id or new.p1_player_id is distinct from old.p1_player_id) then
    new.p1_submission_id := public.battle_seat_submission(new.p1_entry_id, new.p1_player_id);
  end if;
  if new.p2_entry_id is not null and (tg_op = 'INSERT' or new.p2_entry_id is distinct from old.p2_entry_id or new.p2_player_id is distinct from old.p2_player_id) then
    new.p2_submission_id := public.battle_seat_submission(new.p2_entry_id, new.p2_player_id);
  end if;
  return new;
end;
$$;
drop trigger if exists battles_official_submission on public.battles;
create trigger battles_official_submission before insert or update of p1_entry_id, p2_entry_id, p1_player_id, p2_player_id on public.battles
  for each row execute function public.battles_official_submission();

-- 공개는 파티와 같은 때에: 제출본 id만으로는 파티를 읽을 수 없다(파티는 공개된 뒤에만 읽힌다, private_answers.sql).
grant select (p1_submission_id, p2_submission_id) on table public.battles to anon, authenticated;

-- ===== 3. 매일 정리 =====
create or replace function public.battle_housekeeping()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_waiting integer;
  v_stalled integer;
  v_states integer;
begin
  delete from public.battles b where b.kind = 'friendly' and b.status = 'waiting' and b.created_at < now() - interval '1 day';
  get diagnostics v_waiting = row_count;
  delete from public.battles b where b.kind = 'friendly' and b.status = 'active' and b.updated_at < now() - interval '2 days';
  get diagnostics v_stalled = row_count;
  update public.battle_secrets s set state = null, pending = '{}'::jsonb
    from public.battles b
   where b.id = s.battle_id and b.kind in ('friendly', 'official') and b.status = 'ended' and s.state is not null;
  get diagnostics v_states = row_count;
  return jsonb_build_object('waiting_deleted', v_waiting, 'stalled_deleted', v_stalled, 'states_cleared', v_states);
end;
$$;
revoke all on function public.battle_housekeeping() from public, anon, authenticated;
grant execute on function public.battle_housekeeping() to service_role;

-- pg_cron으로 매일 한국 시간 04:10(UTC 19:10)에 돈다.
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'battle-housekeeping';
select cron.schedule('battle-housekeeping', '10 19 * * *', 'select public.battle_housekeeping()');

-- ===== 4. 친선과 공식 판의 한도 =====
-- streak_runs.sql의 battle_create와 같고, 5000판 한도만 최근 30일로 센다.
create or replace function public.battle_create(
  p_id text, p_regulation text, p_format_id text, p_engine text,
  p_p1_name text, p_p1_token_hash text, p_p1_team jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('battle_create'));
  if (select count(*) from public.battles b where b.created_at > now() - interval '1 minute' and b.kind <> 'streak') >= 20 then
    raise exception using errcode = 'P0001', message = '배틀이 많이 열리고 있습니다. 잠시 뒤 다시 시도해 주세요.';
  end if;
  if (select count(*) from public.battles b where b.kind <> 'streak' and b.created_at > now() - interval '30 days') >= 5000 then
    raise exception using errcode = 'P0001', message = '배틀 저장 공간이 가득 찼습니다. 운영진에게 정리를 요청해 주세요.';
  end if;
  insert into public.battles (id, regulation, format_id, engine, p1_name)
  values (p_id, p_regulation, p_format_id, p_engine, btrim(p_p1_name));
  insert into public.battle_secrets (battle_id, p1_token_hash, p1_team)
  values (p_id, p_p1_token_hash, p_p1_team);
end;
$$;

-- ===== 5. 컴퓨터전의 난이도 =====
alter table public.cpu_battles add column if not exists level text check (level is null or level ~ '^[a-z0-9-]{1,20}$');

-- cpu_battles.sql의 함수에 난이도 하나를 더한다. 옛 함수(7개 인자)는 배틀 함수가 새 함수로 바뀔 때까지 그대로 둔다.
create or replace function public.cpu_battle_record(
  p_id text, p_format_id text, p_engine text, p_winner text, p_ended_by text, p_turns integer, p_input_log text, p_level text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('cpu_battle_record'));
  if exists (select 1 from public.cpu_battles c where c.id = p_id) then return true; end if;
  if (select count(*) from public.cpu_battles c where c.created_at > now() - interval '1 minute') >= 30 then return false; end if;
  if (select count(*) from public.cpu_battles) >= 20000 then return false; end if;
  insert into public.cpu_battles (id, format_id, engine, winner, ended_by, turns, input_log, level)
  values (p_id, p_format_id, p_engine, p_winner, p_ended_by, p_turns, p_input_log, nullif(p_level, ''));
  return true;
end;
$$;
revoke all on function public.cpu_battle_record(text, text, text, text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.cpu_battle_record(text, text, text, text, text, integer, text, text) to service_role;

notify pgrst, 'reload schema';
