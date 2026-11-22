-- 변경 기록 (2026-11-22, 인수인계 준비).
-- 대회 기록을 바꾸는 모든 쓰기(승자 입력과 정정, 기록 반영과 취소, 대진표 생성과 삭제, 신청, 공지와 칭호 저장)를 누가, 언제,
-- 무엇에서 무엇으로 바꿨는지 남긴다. 쓰기 경로(화면, RPC, 배틀 함수)를 하나도 고치지 않고 표마다 트리거로 남기므로 빠지는 경로가 없다.
-- - 정정 이력: 승자를 바꾸면 하위 경기가 지워지고 다시 만들어지는데, 지워진 행도 old 로 남는다.
-- - 공지, 칭호, 명예의 전당(site_data 한 행): 저장 때 바뀐 항목(announcements, titleGroups 등)의 이전 값만 남긴다. 실수로 지운 공지를 되살리는 길이다.
-- - 누가: 로그인한 계정(auth.uid, 이메일)과 역할. 운영자가 공용 계정 하나를 쓰는 동안은 "운영자"까지만 가린다(HANDOVER.md 4절).
-- 기록은 운영자만 읽는다(public.admin_change_log). 방문자와 Google 계정 사용자는 읽을 수 없다. 표는 API에 드러나지 않는 ypl_audit 스키마에 둔다.
-- 한 번 실행하면 되고, 다시 실행해도 안전하다. 실행한 뒤 docs/db/README.md 장부에 날짜를 적는다.
-- 확인: select table_name, op, count(*) from ypl_audit.change_log group by 1, 2;  (실행 뒤 쓰기가 있어야 줄이 생긴다)

create schema if not exists ypl_audit;
revoke all on schema ypl_audit from public, anon, authenticated;

create table if not exists ypl_audit.change_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  actor_email text,
  actor_role text,
  table_name text not null,
  op text not null check (op in ('INSERT', 'UPDATE', 'DELETE')),
  row_id text,
  old jsonb,
  new jsonb
);
create index if not exists change_log_at_idx on ypl_audit.change_log (at desc);
create index if not exists change_log_row_idx on ypl_audit.change_log (table_name, row_id, at desc);
revoke all on table ypl_audit.change_log from public, anon, authenticated;

-- 요청한 쪽: PostgREST가 넣어 두는 JWT 클레임. 배틀 함수(service_role)와 SQL 편집기(클레임 없음)도 그대로 남는다.
create or replace function ypl_audit.claims()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

create or replace function ypl_audit.log_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claims jsonb := ypl_audit.claims();
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_key text;
begin
  if tg_op = 'UPDATE' then
    -- 바뀐 열만 남긴다(updated_at 과 version 같은 저절로 바뀌는 열은 빼고). 아무것도 바뀌지 않은 저장은 남기지 않는다.
    select coalesce(jsonb_object_agg(o.key, o.value), '{}'::jsonb), coalesce(jsonb_object_agg(o.key, v_new -> o.key), '{}'::jsonb)
      into v_old, v_new
      from jsonb_each(to_jsonb(old)) o
     where o.value is distinct from (to_jsonb(new) -> o.key) and o.key not in ('updated_at', 'version', 'revision');
    if v_old = '{}'::jsonb then return null; end if;
    -- site_data: value 안에서 바뀐 항목의 이전 값만(새 값은 지금 행에 있다). 한 행이 수백 KB라 통째로 남기지 않는다.
    if tg_table_name = 'site_data' and v_old ? 'value' then
      select coalesce(jsonb_object_agg(o.key, o.value), '{}'::jsonb) into v_old
        from jsonb_each(old.value) o where o.value is distinct from (new.value -> o.key);
      select coalesce(jsonb_agg(n.key), '[]'::jsonb) into v_new
        from jsonb_each(new.value) n where n.value is distinct from (old.value -> n.key);
      v_new := jsonb_build_object('changed', v_new);
    end if;
  end if;
  v_key := coalesce(v_new ->> 'id', v_old ->> 'id', to_jsonb(coalesce(new, old)) ->> 'id', to_jsonb(coalesce(new, old)) ->> 'key');
  insert into ypl_audit.change_log (actor, actor_email, actor_role, table_name, op, row_id, old, new)
  values (nullif(v_claims ->> 'sub', '')::uuid, v_claims ->> 'email', coalesce(v_claims ->> 'role', current_user), tg_table_name, tg_op, v_key, v_old, v_new);
  return null;
end;
$$;
revoke all on function ypl_audit.log_change() from public, anon, authenticated;

-- 기록하는 표: 대회 기록이 사는 표 전부. 파티 제출본(registration_submissions, team_snapshots)은 고치지 않고 쌓이는 표라 그 자체가 이력이다.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'ypl_schema_validation.seasons', 'ypl_schema_validation.events', 'ypl_schema_validation.players', 'ypl_schema_validation.event_registrations',
    'ypl_schema_validation.entries', 'ypl_schema_validation.entry_participants', 'ypl_schema_validation.bracket_runtimes',
    'ypl_schema_validation.bracket_entry_slots', 'ypl_schema_validation.matches', 'ypl_schema_validation.results',
    'ypl_schema_validation.ranking_awards', 'ypl_schema_validation.ranking_baselines', 'ypl_schema_validation.hall_of_fame_entries',
    'ypl_schema_validation.championship_advancements', 'ypl_schema_validation.championship_qualifier_direct_selections',
    'ypl_schema_validation.competition_editions', 'ypl_schema_validation.league_intakes', 'ypl_schema_validation.player_partners',
    'public.site_data', 'public.player_accounts'
  ] loop
    if to_regclass(v_table) is null then continue; end if;
    execute format('drop trigger if exists log_change on %s', v_table);
    execute format('create trigger log_change after insert or update or delete on %s for each row execute function ypl_audit.log_change()', v_table);
  end loop;
end;
$$;

-- 운영자만 읽는다. 최근 것부터, p_before(그 id보다 앞)로 이어 읽는다. 표 이름으로 거를 수 있다.
create or replace function public.admin_change_log(p_limit integer default 50, p_before bigint default null, p_table text default null)
returns table (id bigint, at timestamptz, actor_email text, actor_role text, table_name text, op text, row_id text, old jsonb, new jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not ypl_schema_validation.is_ypl_admin() then
    raise exception using errcode = '42501', message = '운영자만 볼 수 있습니다.';
  end if;
  return query
    select c.id, c.at, c.actor_email, c.actor_role, c.table_name, c.op, c.row_id, c.old, c.new
      from ypl_audit.change_log c
     where (p_before is null or c.id < p_before) and (p_table is null or c.table_name = p_table)
     order by c.id desc
     limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;
revoke all on function public.admin_change_log(integer, bigint, text) from public, anon;
grant execute on function public.admin_change_log(integer, bigint, text) to authenticated;

notify pgrst, 'reload schema';
