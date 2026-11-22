-- 인수인계 전 기능 묶음 (2026-11-22). Supabase SQL Editor에서 통째로 한 번 실행한다. 다시 실행해도 안전하다.
-- 사이트는 이 파일 전에도 지금처럼 동작한다: 아래 기능은 handover_features_ready() 가 답할 때만 화면에 나온다.
--
-- 바뀌는 것
--   1. entry_departures: 대회 도중의 기권(withdrew)과 실격(disqualified). entries.status 는 건드리지 않는다(대진표 투영이 active 만
--      읽고 다른 값이면 멈추므로, 대회 도중 바꾸면 진행 중인 대진표가 깨진다). 운영진만 set_entry_departure 로 남기고 지운다. 누구나 읽는다.
--   2. client_errors: 방문자 화면에서 난 오류. report_client_error 는 누구나 부르되 한 시간에 300줄, 한 줄 2000자에서 자르고
--      30일이 지난 줄은 그때 지운다. 운영진만 admin_client_errors 로 읽는다.
--   3. 선수 이름 바꾸기(admin_rename_player)와 같은 사람 합치기(admin_merge_players). 합치기는 players 를 가리키는 모든 외래 키를
--      남길 선수로 옮기고 지울 선수를 지운다. 같은 대회에 둘 다 있으면(유일 제약) 아무것도 바꾸지 않고 멈춘다.
--      site_data(칭호, 명예의 전당, 옛 기록)의 이름은 사이트가 같은 순간 함께 고친다.
--   4. 라운드 시작과 파티 마감 알림: push_queue_bracket_steps() 가 10분마다(pg_cron) push_outbox 에 'match' 줄을 넣는다.
--      라운드 시작 30분 전부터: 그 라운드의 경기에 선 선수의 이어진 계정에. 파티 마감(대회 시작) 하루 전부터: 아직 파티를 내지 않은
--      신청자의 이어진 계정에. 보내기는 지금처럼 push_take(15분마다)가 한다. 대진표 공개는 push_take 가 이미 알린다.
--   5. handover_features_ready(): 사이트가 이 파일이 실행되었는지 묻는다.
--
-- 지키는 것: 승자, 대진, Result, RankingAward 는 이 파일이 쓰지 않는다(합치기는 선수만 옮긴다).

begin;

-- 1. 기권과 실격
create table if not exists ypl_schema_validation.entry_departures (
  event_id uuid not null references ypl_schema_validation.events (id) on delete cascade,
  entry_id uuid not null references ypl_schema_validation.entries (id) on delete cascade,
  kind text not null check (kind in ('withdrew', 'disqualified')),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  primary key (event_id, entry_id)
);
alter table ypl_schema_validation.entry_departures enable row level security;
drop policy if exists entry_departures_read on ypl_schema_validation.entry_departures;
create policy entry_departures_read on ypl_schema_validation.entry_departures for select to anon, authenticated using (true);
grant select on ypl_schema_validation.entry_departures to anon, authenticated;
grant select on ypl_schema_validation.entry_departures to service_role;

create or replace function ypl_schema_validation.set_entry_departure(p_event_id uuid, p_entry_id uuid, p_kind text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not ypl_schema_validation.is_ypl_admin() then
    raise exception using errcode = 'P0001', message = '관리자 권한이 필요합니다.';
  end if;
  perform 1 from ypl_schema_validation.events e where e.id = p_event_id and e.status = 'running' and e.record_applied_at is null for update;
  if not found then
    raise exception using errcode = 'P0001', message = '진행 중인 대회에만 기권과 실격을 남길 수 있습니다.';
  end if;
  if not exists (select 1 from ypl_schema_validation.entries n where n.id = p_entry_id and n.event_id = p_event_id) then
    raise exception using errcode = 'P0001', message = '이 대회의 출전이 아닙니다.';
  end if;
  if p_kind is null then
    delete from ypl_schema_validation.entry_departures d where d.event_id = p_event_id and d.entry_id = p_entry_id;
  elsif p_kind in ('withdrew', 'disqualified') then
    insert into ypl_schema_validation.entry_departures (event_id, entry_id, kind, note)
    values (p_event_id, p_entry_id, p_kind, nullif(btrim(coalesce(p_note, '')), ''))
    on conflict (event_id, entry_id) do update set kind = excluded.kind, note = excluded.note, created_at = now();
  else
    raise exception using errcode = 'P0001', message = '기권 또는 실격만 남길 수 있습니다.';
  end if;
end;
$$;
revoke all on function ypl_schema_validation.set_entry_departure(uuid, uuid, text, text) from public, anon;
grant execute on function ypl_schema_validation.set_entry_departure(uuid, uuid, text, text) to authenticated;

-- 2. 방문자 화면의 오류
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  message text not null,
  stack text,
  url text,
  build text,
  agent text
);
create index if not exists client_errors_created on public.client_errors (created_at desc);
alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, authenticated;
grant select on public.client_errors to service_role;

create or replace function public.report_client_error(p_message text, p_stack text default null, p_url text default null, p_build text default null, p_agent text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(btrim(p_message), '') = '' then return; end if;
  if (select count(*) from public.client_errors c where c.created_at > now() - interval '1 hour') >= 300 then return; end if;
  -- the same message from the same page within ten minutes is one line
  if exists (select 1 from public.client_errors c where c.created_at > now() - interval '10 minutes'
               and c.message = left(p_message, 2000) and c.url is not distinct from left(p_url, 500)) then return; end if;
  insert into public.client_errors (message, stack, url, build, agent)
  values (left(p_message, 2000), left(p_stack, 4000), left(p_url, 500), left(p_build, 80), left(p_agent, 300));
  delete from public.client_errors c where c.created_at < now() - interval '30 days';
end;
$$;
revoke all on function public.report_client_error(text, text, text, text, text) from public;
grant execute on function public.report_client_error(text, text, text, text, text) to anon, authenticated;

create or replace function public.admin_client_errors(p_limit integer default 100)
returns setof public.client_errors
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not ypl_schema_validation.is_ypl_admin() then
    raise exception using errcode = 'P0001', message = '관리자 권한이 필요합니다.';
  end if;
  return query select * from public.client_errors c order by c.created_at desc limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;
revoke all on function public.admin_client_errors(integer) from public, anon;
grant execute on function public.admin_client_errors(integer) to authenticated;

-- 3. 선수 이름 바꾸기와 합치기
create or replace function ypl_schema_validation.admin_rename_player(p_player_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if not ypl_schema_validation.is_ypl_admin() then
    raise exception using errcode = 'P0001', message = '관리자 권한이 필요합니다.';
  end if;
  if v_name = '' or char_length(v_name) > 30 then
    raise exception using errcode = 'P0001', message = '이름은 1자에서 30자 사이여야 합니다.';
  end if;
  if exists (select 1 from ypl_schema_validation.players p where p.id <> p_player_id
               and lower(regexp_replace(p.display_name, '\s', '', 'g')) = lower(regexp_replace(v_name, '\s', '', 'g'))) then
    raise exception using errcode = 'P0001', message = '같은 이름의 선수가 이미 있습니다. 같은 사람이면 합치기를 써 주세요.';
  end if;
  update ypl_schema_validation.players p set display_name = v_name, updated_at = now() where p.id = p_player_id;
  if not found then raise exception using errcode = 'P0001', message = '선수를 찾을 수 없습니다.'; end if;
end;
$$;
revoke all on function ypl_schema_validation.admin_rename_player(uuid, text) from public, anon;
grant execute on function ypl_schema_validation.admin_rename_player(uuid, text) to authenticated;

-- keep 이 남고 drop 의 기록이 모두 keep 으로 옮겨진 뒤 drop 이 지워진다. 돌려주는 것: 옮긴 행의 수
create or replace function ypl_schema_validation.admin_merge_players(p_keep uuid, p_drop uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fk record;
  v_moved integer := 0;
  v_count integer;
begin
  if not ypl_schema_validation.is_ypl_admin() then
    raise exception using errcode = 'P0001', message = '관리자 권한이 필요합니다.';
  end if;
  if p_keep is null or p_drop is null or p_keep = p_drop then
    raise exception using errcode = 'P0001', message = '서로 다른 두 선수가 필요합니다.';
  end if;
  perform 1 from ypl_schema_validation.players p where p.id in (p_keep, p_drop) for update;
  if (select count(*) from ypl_schema_validation.players p where p.id in (p_keep, p_drop)) <> 2 then
    raise exception using errcode = 'P0001', message = '선수를 찾을 수 없습니다.';
  end if;
  -- every column that points at a player, read from the catalog so a table added later is not missed
  for v_fk in
    select c.conrelid::regclass as tbl, a.attname as col
      from pg_catalog.pg_constraint c
      join pg_catalog.pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.contype = 'f' and c.confrelid = 'ypl_schema_validation.players'::regclass
  loop
    begin
      execute format('update %s set %I = $1 where %I = $2', v_fk.tbl, v_fk.col, v_fk.col) using p_keep, p_drop;
    exception when unique_violation then
      raise exception using errcode = 'P0001', message = format('두 선수가 같은 대회나 같은 기록에 함께 있어 합칠 수 없습니다 (%s).', v_fk.tbl);
    end;
    get diagnostics v_count = row_count;
    v_moved := v_moved + v_count;
  end loop;
  delete from ypl_schema_validation.players p where p.id = p_drop;
  return v_moved;
end;
$$;
revoke all on function ypl_schema_validation.admin_merge_players(uuid, uuid) from public, anon;
grant execute on function ypl_schema_validation.admin_merge_players(uuid, uuid) to authenticated;

-- 4. 라운드 시작과 파티 마감 알림 (push_kinds.sql 의 'match' 종류, 이어진 계정에만)
create or replace function public.push_queue_bracket_steps(p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    -- 라운드 시작: bracket_runtimes.round_schedule 의 시각 30분 전부터 시작까지, 그 라운드의 아직 끝나지 않은 경기에 선 선수에게
    insert into public.push_outbox (dedup, kind, auth_user_id, title, body, url)
    select distinct on (r.key, m.id, pa.auth_user_id)
           'round:' || e.id || ':' || r.key || ':' || pa.auth_user_id, 'match', pa.auth_user_id, '경기 시작 30분 전',
           left(e.name, 60) || ' 경기가 ' || to_char(r.at at time zone 'Asia/Seoul', 'FMHH24:MI') || '에 시작합니다.',
           '?view=bracket&eventId=' || e.id
      from ypl_schema_validation.bracket_runtimes b
      join ypl_schema_validation.events e on e.id = b.event_id and e.status = 'running'
     cross join lateral (select k.key, (k.value #>> '{}')::timestamptz as at from jsonb_each(b.round_schedule) k) r
      join ypl_schema_validation.matches m on m.event_id = e.id and m.source = 'normalized_bracket_runtime'
                                          and m.source_node_key like r.key || ':m%' and m.winner_entry_id is null
      join ypl_schema_validation.entry_participants ep on ep.entry_id in (m.entry_a_id, m.entry_b_id)
      join public.player_accounts pa on pa.player_id = ep.player_id and pa.status = 'approved'
     where r.at > p_now and r.at <= p_now + interval '30 minutes'
    on conflict (dedup) do nothing;
  exception when others then
    raise warning 'push_queue_bracket_steps round: %', sqlerrm;
  end;
  begin
    -- 파티 마감: 신청서가 이어진 대회의 시작(eventDraft.heldOn, startTime)이 하루 안이고, 아직 파티를 내지 않은 신청자에게
    insert into public.push_outbox (dedup, kind, auth_user_id, title, body, url)
    select 'party:' || g.id || ':' || pa.auth_user_id, 'match', pa.auth_user_id, '파티 제출 마감 임박',
           left(e.name, 60) || ' 파티 제출이 ' || to_char(d.at at time zone 'Asia/Seoul', 'FMMM"월" FMDD"일" FMHH24:MI') || '에 마감됩니다.',
           '?view=builder&eventId=' || e.id
      from public.site_data s
     cross join lateral jsonb_array_elements(s.value -> 'announcements') a(item)
     cross join lateral (select public.push_closes_at(
              nullif(a.item #>> '{form,eventDraft,heldOn}', '') || 'T' || nullif(a.item #>> '{form,eventDraft,startTime}', '')) as at) d
      join ypl_schema_validation.events e on e.id::text = a.item #>> '{form,eventId}' and e.status in ('open', 'running', 'planned')
      join ypl_schema_validation.event_registrations g on g.event_id = e.id
      join public.player_accounts pa on pa.player_id = g.player_id and pa.status = 'approved'
     where s.key = 'ypl_data_v4' and jsonb_typeof(s.value -> 'announcements') = 'array'
       and d.at > p_now and d.at <= p_now + interval '1 day'
       and not exists (select 1 from ypl_schema_validation.registration_submissions rs where rs.registration_id = g.id)
    on conflict (dedup) do nothing;
  exception when others then
    raise warning 'push_queue_bracket_steps party: %', sqlerrm;
  end;
end;
$$;
revoke all on function public.push_queue_bracket_steps(timestamptz) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'push-bracket-steps';
    perform cron.schedule('push-bracket-steps', '*/10 * * * *', 'select public.push_queue_bracket_steps()');
  end if;
end;
$$;

-- 5. 실행 여부
create or replace function public.handover_features_ready()
returns boolean language sql stable set search_path = '' as $$ select true $$;
revoke all on function public.handover_features_ready() from public;
grant execute on function public.handover_features_ready() to anon, authenticated;

commit;

notify pgrst, 'reload schema';
