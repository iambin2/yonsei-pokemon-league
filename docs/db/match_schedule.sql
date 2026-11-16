-- 대회 날의 경기 일정: 라운드마다 시작 시각, 만들어진 경기마다 테이블. Supabase SQL Editor에서 통째로 한 번 실행한다. 다시 실행해도 안전하다.
-- 사이트는 이 파일이 적용되기 전에도 지금처럼 동작한다(시각과 테이블이 보이지 않을 뿐이다). 적용되면 다음 조회부터 켜진다.
--
-- 바뀌는 것은 넷이다.
--   1. bracket_runtimes.round_schedule jsonb: 라운드 키 -> 시작 시각(timestamptz의 ISO 문자열). 예 {"single:r1": "2026-11-21T04:00:00+00:00"}
--      라운드 키는 경기 키(source_node_key)에서 끝의 :mN 을 뗀 것이다: single:rN, double:w:rN, double:l:rN, double:gf, double:reset.
--      작은 표가 아니라 런타임의 열인 까닭: 일정은 대진표 하나의 설정이고(group_advance, group_final_format 과 같은 자리),
--      대진표를 지우면 함께 사라져야 하며, 아직 만들어지지 않은 경기(투영)의 라운드에도 시각이 있어야 해서 경기 행에 둘 수 없다.
--   2. matches.table_label text: 만들어진 경기(저장된 행)의 테이블. 사이트는 숫자만 넣고 "3번 테이블"로 읽는다.
--      승자가 바뀌어 아래 경기가 지워지면 그 경기의 테이블도 함께 사라진다(투영은 저장하지 않는다).
--   3. set_normalized_round_schedule: 운영진만, 라운드 일정을 통째로 바꾼다. 같은 값을 다시 보내면 아무것도 바뀌지 않는다.
--   4. set_normalized_match_table: 운영진만, 만들어진 경기 하나의 테이블을 정하거나(null이면) 지운다.
--
-- 지키는 것: 승자, 대진, 점수, Result, RankingAward 는 이 파일이 쓰지 않는다. 기록에 반영된 대회는 바꿀 수 없다.
-- 읽기: 두 표 모두 public_read 정책(anon, authenticated)과 표 단위 SELECT 권한이 이미 있어 새 열도 방문자가 읽는다. 아래에서 열 단위로도 한 번 더 준다.

begin;

-- 1. 라운드 일정
alter table ypl_schema_validation.bracket_runtimes add column if not exists round_schedule jsonb not null default '{}'::jsonb;

-- 2. 경기의 테이블
alter table ypl_schema_validation.matches add column if not exists table_label text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bracket_runtimes_round_schedule_object' and conrelid = 'ypl_schema_validation.bracket_runtimes'::regclass) then
    alter table ypl_schema_validation.bracket_runtimes
      add constraint bracket_runtimes_round_schedule_object check (jsonb_typeof(round_schedule) = 'object');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'matches_table_label_shape' and conrelid = 'ypl_schema_validation.matches'::regclass) then
    alter table ypl_schema_validation.matches
      add constraint matches_table_label_shape check (table_label is null or (char_length(table_label) between 1 and 12 and table_label = btrim(table_label)));
  end if;
end;
$$;

-- 읽기: 방문자도 대진표와 함께 읽는다. 쓰기: 운영진의 RPC가 security invoker 로 쓰므로 그 열만 authenticated 에 열고, RLS admin_write 가 운영진만 남긴다.
grant select (round_schedule) on ypl_schema_validation.bracket_runtimes to anon, authenticated;
grant select (table_label) on ypl_schema_validation.matches to anon, authenticated;
grant update (round_schedule, updated_at) on ypl_schema_validation.bracket_runtimes to authenticated;

-- 3. 라운드 일정 RPC. p_schedule 은 키 -> 시각 문자열(또는 null, 빈 문자열이면 그 라운드를 지운다). 저장된 일정을 돌려준다.
create or replace function ypl_schema_validation.set_normalized_round_schedule(
    p_runtime_id uuid,
    p_event_id uuid,
    p_schedule jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_event ypl_schema_validation.events%rowtype;
    v_runtime ypl_schema_validation.bracket_runtimes%rowtype;
    v_key text;
    v_value jsonb;
    v_at timestamptz;
    v_next jsonb := '{}'::jsonb;
begin
    if not ypl_schema_validation.is_ypl_admin() then
        raise exception using errcode = '42501', message = '운영진만 경기 일정을 정할 수 있습니다.';
    end if;
    if p_runtime_id is null or p_event_id is null or p_schedule is null then
        raise exception using errcode = 'P0001', message = '대진표와 일정이 필요합니다.';
    end if;
    if jsonb_typeof(p_schedule) <> 'object' then
        raise exception using errcode = 'P0001', message = '일정의 형식이 올바르지 않습니다.';
    end if;

    -- the winner RPC, the outcome RPC and the sync lock the Event first; so does this
    select * into v_event
      from ypl_schema_validation.events as e
     where e.id = p_event_id
     for update;
    if not found then
        raise exception using errcode = 'P0001', message = '대회를 찾을 수 없습니다.';
    end if;
    if v_event.status not in ('open', 'running') or v_event.record_applied_at is not null then
        raise exception using errcode = 'P0001', message = '진행 중인 대회의 대진표에만 경기 일정을 정할 수 있습니다.';
    end if;

    select * into v_runtime
      from ypl_schema_validation.bracket_runtimes as br
     where br.id = p_runtime_id
       and br.event_id = p_event_id
     for update;
    if not found then
        raise exception using errcode = 'P0001', message = '이 대회의 대진표를 찾을 수 없습니다.';
    end if;

    if (select count(*) from jsonb_object_keys(p_schedule)) > 32 then
        raise exception using errcode = 'P0001', message = '라운드가 너무 많습니다.';
    end if;
    for v_key, v_value in select key, value from jsonb_each(p_schedule) loop
        if v_key !~ '^(single:r[1-9][0-9]?|double:(w:r[1-9][0-9]?|l:r[1-9][0-9]?|gf|reset))$' then
            raise exception using errcode = 'P0001', message = '알 수 없는 라운드입니다: ' || left(v_key, 40);
        end if;
        if v_value = 'null'::jsonb or v_value = '""'::jsonb then
            continue;
        end if;
        if jsonb_typeof(v_value) <> 'string' then
            raise exception using errcode = 'P0001', message = '시작 시각의 형식이 올바르지 않습니다.';
        end if;
        begin
            v_at := (v_value #>> '{}')::timestamptz;
        exception when others then
            raise exception using errcode = 'P0001', message = '시작 시각의 형식이 올바르지 않습니다.';
        end;
        v_next := v_next || jsonb_build_object(v_key, to_jsonb(v_at));
    end loop;

    if v_runtime.round_schedule is distinct from v_next then
        update ypl_schema_validation.bracket_runtimes as br
           set round_schedule = v_next,
               updated_at = now()
         where br.id = p_runtime_id
           and br.event_id = p_event_id;
        if not found then
            raise exception using errcode = 'P0001', message = '경기 일정을 저장하지 못했습니다.';
        end if;
    end if;
    return v_next;
end;
$$;

revoke all on function ypl_schema_validation.set_normalized_round_schedule(uuid, uuid, jsonb) from public;
revoke all on function ypl_schema_validation.set_normalized_round_schedule(uuid, uuid, jsonb) from anon, service_role;
grant execute on function ypl_schema_validation.set_normalized_round_schedule(uuid, uuid, jsonb) to authenticated;

-- 4. 경기의 테이블 RPC. p_table_label null 은 지우기. 만들어진(양쪽이 정해진) 대진 경기에만 남긴다.
create or replace function ypl_schema_validation.set_normalized_match_table(
    p_event_id uuid,
    p_source_node_key text,
    p_table_label text default null
)
returns table (
    table_match_id uuid,
    table_source_node_key text,
    match_table_label text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_event ypl_schema_validation.events%rowtype;
    v_match ypl_schema_validation.matches%rowtype;
    v_label text := nullif(btrim(coalesce(p_table_label, '')), '');
begin
    if not ypl_schema_validation.is_ypl_admin() then
        raise exception using errcode = '42501', message = '운영진만 테이블을 정할 수 있습니다.';
    end if;
    if p_event_id is null or p_source_node_key is null then
        raise exception using errcode = 'P0001', message = '대회와 경기가 필요합니다.';
    end if;
    if v_label is not null and char_length(v_label) > 12 then
        raise exception using errcode = 'P0001', message = '테이블 이름은 12자까지입니다.';
    end if;

    select * into v_event
      from ypl_schema_validation.events as e
     where e.id = p_event_id
     for update;
    if not found then
        raise exception using errcode = 'P0001', message = '대회를 찾을 수 없습니다.';
    end if;
    if v_event.status not in ('open', 'running') or v_event.record_applied_at is not null then
        raise exception using errcode = 'P0001', message = '진행 중인 대회의 경기에만 테이블을 정할 수 있습니다.';
    end if;

    select * into v_match
      from ypl_schema_validation.matches as m
     where m.event_id = p_event_id
       and m.source = 'normalized_bracket_runtime'
       and m.source_node_key = p_source_node_key
       and m.match_kind = 'bracket'
     for update;
    if not found then
        raise exception using errcode = 'P0001', message = '이 경기를 찾을 수 없습니다. 아직 만들어지지 않은 경기에는 테이블을 정할 수 없습니다.';
    end if;
    if v_match.entry_a_id is null or v_match.entry_b_id is null then
        raise exception using errcode = 'P0001', message = '두 선수가 정해진 경기에만 테이블을 정할 수 있습니다.';
    end if;

    -- the same label again changes nothing, so updated_at is not touched
    if v_match.table_label is distinct from v_label then
        update ypl_schema_validation.matches as m
           set table_label = v_label,
               updated_at = now()
         where m.id = v_match.id
           and m.event_id = p_event_id;
    end if;

    return query select v_match.id, v_match.source_node_key, v_label;
end;
$$;

revoke all on function ypl_schema_validation.set_normalized_match_table(uuid, text, text) from public;
revoke all on function ypl_schema_validation.set_normalized_match_table(uuid, text, text) from anon, service_role;
grant execute on function ypl_schema_validation.set_normalized_match_table(uuid, text, text) to authenticated;

commit;

-- 실행 뒤 확인(읽기만): 두 열과 두 함수가 있고, 방문자가 열을 읽을 수 있으면 넷 다 true 다.
-- select
--   exists (select 1 from information_schema.columns where table_schema = 'ypl_schema_validation' and table_name = 'bracket_runtimes' and column_name = 'round_schedule') as schedule_column,
--   exists (select 1 from information_schema.columns where table_schema = 'ypl_schema_validation' and table_name = 'matches' and column_name = 'table_label') as table_column,
--   to_regprocedure('ypl_schema_validation.set_normalized_round_schedule(uuid,uuid,jsonb)') is not null
--     and to_regprocedure('ypl_schema_validation.set_normalized_match_table(uuid,text,text)') is not null as rpcs,
--   has_column_privilege('anon', 'ypl_schema_validation.matches', 'table_label', 'select')
--     and has_column_privilege('anon', 'ypl_schema_validation.bracket_runtimes', 'round_schedule', 'select') as visitor_read;
