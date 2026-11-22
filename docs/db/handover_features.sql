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
--      예약한 공지(announcements[].publishAt)도 같은 작업이 시각이 지나면 'notice' 줄로 넣는다. push_queue_notice_edit 은 고친 공지를
--      운영진이 다시 알릴 때 쓴다.
--   5. handover_features_ready(): 사이트가 이 파일이 실행되었는지 묻는다.
--
--   6. 배틀의 시계: 공식 배틀은 대회의 턴 시간(competition_settings.turnSeconds)을 쓰고, 운영진이 admin_battle_clock 으로 멈추고
--      다시 켜고 1분 늘린다. battle_timer.sql 의 battle_set_deadline 을 대신한다(친선과 도전의 탑은 그대로 90초).
--   7. match_picks: 게임으로 치른 경기의 선출(출전마다 낸 포켓몬). 운영진이 set_match_picks 로 남긴다.
--   8. replace_bracket_entrant: 대진표가 만들어진 뒤, 결과가 없는 출전의 사람을 같은 대회의 다른 신청자로 바꾼다.
--   9. event_checkins 와 my_checkin: 대회 날 선수가 스스로 남기는 체크인. 운영진은 표를 읽어 대진표를 만들 때 쓴다.
--  10. match_reports 와 report_match_result: 두 선수가 남기는 결과 보고. 같으면 싱글은 바로 들어가고, 나머지는 운영진이 한 번 누른다.
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
  begin
    -- 예약한 공지: publishAt 이 지난 공지를 한 번(바로 올린 공지와 같은 dedup 이라 두 번 가지 않는다). 하루가 지난 예약은 알리지 않는다.
    insert into public.push_outbox (dedup, kind, title, body, url)
    select 'notice:' || (a.item ->> 'id'), 'notice', 'YPL 공지', left(coalesce(nullif(btrim(a.item ->> 'title'), ''), '새 공지'), 120),
           '?view=news&notice=' || (a.item ->> 'id')
      from public.site_data s
     cross join lateral jsonb_array_elements(s.value -> 'announcements') a(item)
     cross join lateral (select public.push_closes_at(a.item ->> 'publishAt') as at) d
     where s.key = 'ypl_data_v4' and jsonb_typeof(s.value -> 'announcements') = 'array' and a.item ? 'id'
       and d.at <= p_now and d.at > p_now - interval '1 day'
    on conflict (dedup) do nothing;
  exception when others then
    raise warning 'push_queue_bracket_steps notice: %', sqlerrm;
  end;
end;
$$;

-- 공지 수정 알림: 운영진이 고친 공지를 다시 알린다(수정마다 한 줄). 보내기는 사이트가 notify-announcement 를 빈 요청으로 불러 한다.
create or replace function public.push_queue_notice_edit(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
begin
  if not ypl_schema_validation.is_ypl_admin() then
    raise exception using errcode = 'P0001', message = '관리자 권한이 필요합니다.';
  end if;
  select a.item ->> 'title' into v_title
    from public.site_data s cross join lateral jsonb_array_elements(s.value -> 'announcements') a(item)
   where s.key = 'ypl_data_v4' and a.item ->> 'id' = p_id;
  if not found then raise exception using errcode = 'P0001', message = '공지를 찾을 수 없습니다.'; end if;
  insert into public.push_outbox (dedup, kind, title, body, url)
  values ('notice-edit:' || p_id || ':' || extract(epoch from now())::bigint, 'notice', 'YPL 공지 수정',
          left(coalesce(nullif(btrim(v_title), ''), '공지'), 120), '?view=news&notice=' || p_id)
  on conflict (dedup) do nothing;
end;
$$;
revoke all on function public.push_queue_notice_edit(text) from public, anon;
grant execute on function public.push_queue_notice_edit(text) to authenticated;
revoke all on function public.push_queue_bracket_steps(timestamptz) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'push-bracket-steps';
    perform cron.schedule('push-bracket-steps', '*/10 * * * *', 'select public.push_queue_bracket_steps()');
  end if;
end;
$$;

-- 6. 배틀의 시계: 대회마다 턴 시간, 운영진의 멈춤과 연장 (battle_timer.sql 의 battle_set_deadline 을 대신한다)
--    competition_settings.turnSeconds(60, 90, 120, 180초, 없으면 90초)를 공식 배틀이 쓴다. 다른 배틀(친선, 도전의 탑)은 그대로 90초.
--    멈춘 배틀은 paused_left(남은 초)를 들고 deadline_at 이 비어, 배틀 함수의 시간 초과 판정이 일어나지 않는다(마감이 없다).
--    멈춘 동안 턴이 넘어가면 남은 시간이 그 대회의 한 턴으로 다시 찬다. 선수는 멈춘 동안에도 고를 수 있다.
alter table public.battles add column if not exists paused_left integer check (paused_left is null or paused_left between 0 and 3600);
grant select (paused_left) on table public.battles to anon, authenticated;

create or replace function public.battle_set_deadline()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_secs integer := 90;
begin
  if new.status <> 'active' then
    new.deadline_at := null;
    new.paused_left := null;
    return new;
  end if;
  if tg_op = 'INSERT' or old.status is distinct from 'active' or new.spectator_log is distinct from old.spectator_log then
    if new.kind = 'official' and new.event_id is not null then
      select case when (e.competition_settings ->> 'turnSeconds') in ('60', '90', '120', '180') then (e.competition_settings ->> 'turnSeconds')::integer else 90 end
        into v_secs from ypl_schema_validation.events e where e.id = new.event_id;
      v_secs := coalesce(v_secs, 90);
    end if;
    if new.paused_left is not null then
      new.paused_left := v_secs;
      new.deadline_at := null;
    else
      new.deadline_at := now() + make_interval(secs => v_secs);
    end if;
  end if;
  return new;
end;
$$;

-- p_action: 'pause' 멈춤, 'resume' 다시, 'extend' 1분 더(멈춘 배틀은 남은 시간에). 진행 중인 공식 배틀만, 운영진만.
create or replace function public.admin_battle_clock(p_id text, p_action text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.battles%rowtype;
begin
  if not ypl_schema_validation.is_ypl_admin() then
    raise exception using errcode = 'P0001', message = '관리자 권한이 필요합니다.';
  end if;
  select * into v from public.battles b where b.id = p_id for update;
  if not found or v.kind <> 'official' or v.status <> 'active' then
    raise exception using errcode = 'P0001', message = '진행 중인 공식 배틀만 시계를 바꿀 수 있습니다.';
  end if;
  if p_action = 'pause' and v.paused_left is null then
    update public.battles b set paused_left = greatest(0, ceil(extract(epoch from (coalesce(v.deadline_at, now()) - now())))::integer), deadline_at = null
     where b.id = p_id;
  elsif p_action = 'resume' and v.paused_left is not null then
    update public.battles b set deadline_at = now() + make_interval(secs => greatest(v.paused_left, 30)), paused_left = null where b.id = p_id;
  elsif p_action = 'extend' then
    if v.paused_left is not null then
      update public.battles b set paused_left = least(v.paused_left + 60, 3600) where b.id = p_id;
    else
      update public.battles b set deadline_at = coalesce(v.deadline_at, now()) + interval '60 seconds' where b.id = p_id;
    end if;
  elsif p_action not in ('pause', 'resume') then
    raise exception using errcode = 'P0001', message = '멈춤, 다시, 연장만 할 수 있습니다.';
  end if;
  return (select b.deadline_at from public.battles b where b.id = p_id);
end;
$$;
revoke all on function public.admin_battle_clock(text, text) from public, anon;
grant execute on function public.admin_battle_clock(text, text) to authenticated;

-- 7. 선출: 게임으로 치른 경기에서 출전마다 실제로 낸 포켓몬(pokemon_id, 1에서 6마리). 운영진이 결과 입력에서 남긴다.
--    파티처럼 대회가 공개되기(team_revealed_at) 전에는 운영진만 읽는다. 승자, 대진, 결과와는 상관없는 사실이라 언제든 고칠 수 있다.
create table if not exists ypl_schema_validation.match_picks (
  event_id uuid not null references ypl_schema_validation.events (id) on delete cascade,
  source_node_key text not null,
  entry_id uuid not null references ypl_schema_validation.entries (id) on delete cascade,
  pokemon_ids text[] not null check (cardinality(pokemon_ids) between 1 and 6),
  updated_at timestamptz not null default now(),
  primary key (event_id, source_node_key, entry_id)
);
alter table ypl_schema_validation.match_picks enable row level security;
drop policy if exists match_picks_read on ypl_schema_validation.match_picks;
create policy match_picks_read on ypl_schema_validation.match_picks for select to anon, authenticated
  using (ypl_schema_validation.is_ypl_admin()
         or exists (select 1 from ypl_schema_validation.events e where e.id = event_id and e.team_revealed_at is not null));
grant select on ypl_schema_validation.match_picks to anon, authenticated, service_role;

create or replace function ypl_schema_validation.set_match_picks(p_event_id uuid, p_source_node_key text, p_entry_id uuid, p_pokemon_ids text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids text[] := array(select distinct btrim(x) from unnest(coalesce(p_pokemon_ids, '{}')) x where btrim(x) <> '');
begin
  if not ypl_schema_validation.is_ypl_admin() then
    raise exception using errcode = 'P0001', message = '관리자 권한이 필요합니다.';
  end if;
  if not exists (select 1 from ypl_schema_validation.matches m where m.event_id = p_event_id and m.source_node_key = p_source_node_key
                   and p_entry_id in (m.entry_a_id, m.entry_b_id)) then
    raise exception using errcode = 'P0001', message = '이 경기의 출전이 아닙니다.';
  end if;
  if cardinality(v_ids) = 0 then
    delete from ypl_schema_validation.match_picks p where p.event_id = p_event_id and p.source_node_key = p_source_node_key and p.entry_id = p_entry_id;
    return;
  end if;
  if cardinality(v_ids) > 6 then
    raise exception using errcode = 'P0001', message = '선출은 여섯 마리까지입니다.';
  end if;
  insert into ypl_schema_validation.match_picks (event_id, source_node_key, entry_id, pokemon_ids)
  values (p_event_id, p_source_node_key, p_entry_id, v_ids)
  on conflict (event_id, source_node_key, entry_id) do update set pokemon_ids = excluded.pokemon_ids, updated_at = now();
end;
$$;
revoke all on function ypl_schema_validation.set_match_picks(uuid, text, uuid, text[]) from public, anon;
grant execute on function ypl_schema_validation.set_match_picks(uuid, text, uuid, text[]) to authenticated;

-- 8. 참가자 교체: 대진표가 만들어진 뒤, 아직 한 경기도 결과가 없는 출전의 사람을 같은 대회의 다른 신청자로 바꾼다.
--    출전(entries.id)은 그대로라 자리, 경기, 일정은 건드리지 않고, 그 출전의 신청과 선수만 바뀐다. 선수가 없는 신청은
--    이름이 같은 선수(공백과 대소문자 무시)를 쓰고, 없으면 새로 만든다(대진표를 만들 때와 같은 규칙). 개인전만, 챔피언스는 제외.
create or replace function ypl_schema_validation.replace_bracket_entrant(p_event_id uuid, p_entry_id uuid, p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reg ypl_schema_validation.event_registrations%rowtype;
  v_player uuid;
begin
  if not ypl_schema_validation.is_ypl_admin() then
    raise exception using errcode = 'P0001', message = '관리자 권한이 필요합니다.';
  end if;
  perform 1 from ypl_schema_validation.events e
   where e.id = p_event_id and e.status = 'running' and e.record_applied_at is null and not e.is_team_event
     and coalesce(e.event_type, '') <> 'champions'
   for update;
  if not found then
    raise exception using errcode = 'P0001', message = '진행 중인 개인전 대회에서만 참가자를 바꿀 수 있습니다.';
  end if;
  if not exists (select 1 from ypl_schema_validation.entries n where n.id = p_entry_id and n.event_id = p_event_id) then
    raise exception using errcode = 'P0001', message = '이 대회의 출전이 아닙니다.';
  end if;
  if exists (select 1 from ypl_schema_validation.matches m where m.event_id = p_event_id
               and p_entry_id in (m.entry_a_id, m.entry_b_id) and m.winner_entry_id is not null) then
    raise exception using errcode = 'P0001', message = '결과가 있는 출전은 바꿀 수 없습니다.';
  end if;
  select * into v_reg from ypl_schema_validation.event_registrations g where g.id = p_registration_id and g.event_id = p_event_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = '이 대회의 신청이 아닙니다.';
  end if;
  if exists (select 1 from ypl_schema_validation.entry_participants ep where ep.event_id = p_event_id and ep.registration_id = p_registration_id) then
    raise exception using errcode = 'P0001', message = '이미 대진표에 있는 신청자입니다.';
  end if;
  v_player := v_reg.player_id;
  if v_player is null then
    select p.id into v_player from ypl_schema_validation.players p
     where lower(regexp_replace(p.display_name, '\s', '', 'g')) = lower(regexp_replace(v_reg.registration_name, '\s', '', 'g'))
     limit 1;
    if v_player is null then
      insert into ypl_schema_validation.players (display_name) values (btrim(v_reg.registration_name)) returning id into v_player;
    end if;
    update ypl_schema_validation.event_registrations g set player_id = v_player where g.id = p_registration_id;
  end if;
  begin
    update ypl_schema_validation.entry_participants ep set registration_id = p_registration_id, player_id = v_player
     where ep.entry_id = p_entry_id and ep.event_id = p_event_id;
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = '그 선수는 이미 이 대회에 출전합니다.';
  end;
  update ypl_schema_validation.entries n set display_name = btrim(v_reg.registration_name), updated_at = now() where n.id = p_entry_id;
end;
$$;
revoke all on function ypl_schema_validation.replace_bracket_entrant(uuid, uuid, uuid) from public, anon;
grant execute on function ypl_schema_validation.replace_bracket_entrant(uuid, uuid, uuid) to authenticated;

-- 9. 셀프 체크인: 대회 날(한국 날짜가 held_on) 구글 계정이 선수와 이어진 신청자가 스스로 도착을 남긴다. 운영진은 누가 왔는지 읽고
--    체크인한 사람으로 대진표를 만든다. p_event_ids: 한 공지가 받는 대회들(루키와 마스터 통합 접수는 둘), 그중 신청한 쪽에 남는다.
create table if not exists ypl_schema_validation.event_checkins (
  event_id uuid not null references ypl_schema_validation.events (id) on delete cascade,
  registration_id uuid not null references ypl_schema_validation.event_registrations (id) on delete cascade,
  auth_user_id uuid,
  checked_in_at timestamptz not null default now(),
  primary key (event_id, registration_id)
);
alter table ypl_schema_validation.event_checkins enable row level security;
drop policy if exists event_checkins_read on ypl_schema_validation.event_checkins;
create policy event_checkins_read on ypl_schema_validation.event_checkins for select to authenticated
  using (ypl_schema_validation.is_ypl_admin() or auth_user_id = auth.uid());
grant select on ypl_schema_validation.event_checkins to authenticated, service_role;

-- 'not_signed' | 'not_registered' | 'closed'(그날이 아님) | 'open'(체크인 전) | 'done'
create or replace function ypl_schema_validation.my_checkin(p_event_ids uuid[], p_check_in boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reg record;
begin
  if auth.uid() is null then return 'not_signed'; end if;
  select g.id, g.event_id, e.held_on, e.status into v_reg
    from ypl_schema_validation.event_registrations g
    join ypl_schema_validation.events e on e.id = g.event_id
    join public.player_accounts pa on pa.player_id = g.player_id and pa.status = 'approved' and pa.auth_user_id = auth.uid()
   where g.event_id = any (coalesce(p_event_ids, '{}'))
   limit 1;
  if not found then return 'not_registered'; end if;
  if exists (select 1 from ypl_schema_validation.event_checkins c where c.event_id = v_reg.event_id and c.registration_id = v_reg.id) then return 'done'; end if;
  if v_reg.held_on is distinct from (now() at time zone 'Asia/Seoul')::date or v_reg.status in ('cancelled', 'completed') then return 'closed'; end if;
  if not p_check_in then return 'open'; end if;
  insert into ypl_schema_validation.event_checkins (event_id, registration_id, auth_user_id) values (v_reg.event_id, v_reg.id, auth.uid())
  on conflict do nothing;
  return 'done';
end;
$$;
revoke all on function ypl_schema_validation.my_checkin(uuid[], boolean) from public, anon;
grant execute on function ypl_schema_validation.my_checkin(uuid[], boolean) to authenticated;

-- 10. 선수 결과 직접 보고: 게임으로 치른 경기의 두 선수가 각자 이겼는지 졌는지 남긴다. 둘이 같으면 싱글 엘리미네이션은 그 자리에서
--     승자가 들어가고(set_normalized_single_bracket_winner, 배틀 결과와 같은 길), 그 밖의 대진(더블, 조별)은 운영진이 결과 입력에서
--     한 번 눌러 넣는다. 다르면 운영진이 정한다. p_won 이 null 이면 읽기만 한다.
--     돌려주는 것: { status: 'waiting'|'agreed'|'applied'|'disputed'|'decided'|'not_player', mine: true|false|null }
create table if not exists ypl_schema_validation.match_reports (
  event_id uuid not null references ypl_schema_validation.events (id) on delete cascade,
  source_node_key text not null,
  entry_id uuid not null references ypl_schema_validation.entries (id) on delete cascade,
  winner_entry_id uuid not null,
  auth_user_id uuid,
  created_at timestamptz not null default now(),
  primary key (event_id, source_node_key, entry_id)
);
alter table ypl_schema_validation.match_reports enable row level security;
drop policy if exists match_reports_read on ypl_schema_validation.match_reports;
create policy match_reports_read on ypl_schema_validation.match_reports for select to authenticated using (ypl_schema_validation.is_ypl_admin());
grant select on ypl_schema_validation.match_reports to authenticated, service_role;

create or replace function ypl_schema_validation.report_match_result(p_event_id uuid, p_source_node_key text, p_won boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match ypl_schema_validation.matches%rowtype;
  v_mine uuid;
  v_other uuid;
  v_runtime ypl_schema_validation.bracket_runtimes%rowtype;
  v_a uuid;
  v_b uuid;
begin
  if auth.uid() is null then return jsonb_build_object('status', 'not_player'); end if;
  perform 1 from ypl_schema_validation.events e where e.id = p_event_id and e.status = 'running' and e.record_applied_at is null and not e.is_team_event for update;
  if not found then return jsonb_build_object('status', 'not_player'); end if;
  select * into v_match from ypl_schema_validation.matches m
   where m.event_id = p_event_id and m.source = 'normalized_bracket_runtime' and m.match_kind = 'bracket' and m.source_node_key = p_source_node_key;
  if not found or v_match.entry_a_id is null or v_match.entry_b_id is null then return jsonb_build_object('status', 'not_player'); end if;
  select ep.entry_id into v_mine from ypl_schema_validation.entry_participants ep
    join public.player_accounts pa on pa.player_id = ep.player_id and pa.status = 'approved' and pa.auth_user_id = auth.uid()
   where ep.event_id = p_event_id and ep.entry_id in (v_match.entry_a_id, v_match.entry_b_id) limit 1;
  if v_mine is null then return jsonb_build_object('status', 'not_player'); end if;
  v_other := case when v_mine = v_match.entry_a_id then v_match.entry_b_id else v_match.entry_a_id end;
  if v_match.winner_entry_id is not null then return jsonb_build_object('status', 'decided', 'mine', v_match.winner_entry_id = v_mine); end if;

  if p_won is not null then
    insert into ypl_schema_validation.match_reports (event_id, source_node_key, entry_id, winner_entry_id, auth_user_id)
    values (p_event_id, p_source_node_key, v_mine, case when p_won then v_mine else v_other end, auth.uid())
    on conflict (event_id, source_node_key, entry_id) do update set winner_entry_id = excluded.winner_entry_id, auth_user_id = excluded.auth_user_id, created_at = now();
  end if;

  select r.winner_entry_id into v_a from ypl_schema_validation.match_reports r where r.event_id = p_event_id and r.source_node_key = p_source_node_key and r.entry_id = v_mine;
  select r.winner_entry_id into v_b from ypl_schema_validation.match_reports r where r.event_id = p_event_id and r.source_node_key = p_source_node_key and r.entry_id = v_other;
  if v_a is null or v_b is null then return jsonb_build_object('status', 'waiting', 'mine', case when v_a is null then null else v_a = v_mine end); end if;
  if v_a <> v_b then return jsonb_build_object('status', 'disputed', 'mine', v_a = v_mine); end if;

  select * into v_runtime from ypl_schema_validation.bracket_runtimes b where b.event_id = p_event_id;
  if v_runtime.topology_kind = 'single_elimination' and p_source_node_key like 'single:%' then
    begin
      perform 1 from ypl_schema_validation.set_normalized_single_bracket_winner(v_runtime.id, p_event_id, p_source_node_key, v_a);
      return jsonb_build_object('status', 'applied', 'mine', v_a = v_mine);
    exception when others then
      raise warning 'report_match_result: %', sqlerrm;
    end;
  end if;
  return jsonb_build_object('status', 'agreed', 'mine', v_a = v_mine);
end;
$$;
revoke all on function ypl_schema_validation.report_match_result(uuid, text, boolean) from public, anon;
grant execute on function ypl_schema_validation.report_match_result(uuid, text, boolean) to authenticated;

-- 5. 실행 여부
create or replace function public.handover_features_ready()
returns boolean language sql stable set search_path = '' as $$ select true $$;
revoke all on function public.handover_features_ready() from public;
grant execute on function public.handover_features_ready() to anon, authenticated;

commit;

notify pgrst, 'reload schema';
