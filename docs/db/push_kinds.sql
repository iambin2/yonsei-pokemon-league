-- 알림 종류 (2026-11-18, docs/PUSH.md). 공지 하나뿐이던 알림에 게시판, 대회 일정, 내 경기, 도전의 탑 순위와 신기록, 오늘의 탑을 더하고
-- 구독마다 종류를 켜고 끈다. announcement_push.sql 과 application_close.sql 다음에 실행한다. 여러 번 실행해도 된다.
--
-- 생각
--   - 이미 있는 구독은 공지만 받는다(예전과 같다). 새 구독은 공지, 내 경기, 내 글의 댓글을 받는다. 둘은 계정이 이어진 기기에만 온다.
--   - 내 글의 댓글(reply)의 줄은 community_accounts.sql 의 트리거가 넣는다(계정으로 쓴 글과 댓글에 답이 달릴 때).
--   - 구독은 저장할 때의 로그인(auth.uid())으로 계정에 이어진다. 화면이 보내는 계정 id는 받지 않는다.
--   - 보낼 것은 push_outbox 한 줄로 모인다. 공지는 Edge Function이, 내 경기와 도전의 탑은 아래 트리거가, 대회 일정과 오늘의 탑은
--     push_take(true)(15분마다 부르는 정리)가 넣는다. 게시판은 줄을 만들지 않고 구독마다 지난 알림 뒤의 새 글을 센다.
--   - 꺼내기(push_take)는 한 번만 꺼낸다: 줄은 taken_at 으로, 게시판과 도전의 탑은 구독의 마지막 알림 시각으로 잠근다.
--     그래서 함수를 누가 몇 번 불러도 같은 알림이 두 번 가지 않는다(Edge Function이 공개로 열려 있는 이유).
--   - 밤(한국 시각 22시부터 9시)에는 공지와 내 경기만 보낸다. 나머지는 아침까지 기다리고, 하루가 지난 줄은 보내지 않는다.
--   - 트리거는 배틀과 도전의 쓰기를 절대 막지 않는다: 알림을 만들다 실패해도 삼키고 넘어간다.

begin;

-- 1. 구독마다 받을 종류, 이어진 계정, 묶어 보내는 종류의 마지막 알림 시각
alter table public.push_subscriptions add column if not exists kinds text[] not null default '{notice}';
alter table public.push_subscriptions alter column kinds set default '{notice,match,reply}';
alter table public.push_subscriptions add column if not exists auth_user_id uuid references auth.users (id) on delete set null;
alter table public.push_subscriptions add column if not exists board_pushed_at timestamptz not null default now();
alter table public.push_subscriptions add column if not exists tower_pushed_at timestamptz;
-- the check is laid again on every run, so a kind added later (record, 2026-11-18) reaches a database that ran an earlier copy
alter table public.push_subscriptions drop constraint if exists push_subscriptions_kinds;
alter table public.push_subscriptions add constraint push_subscriptions_kinds
  check (kinds <@ array['notice', 'board', 'schedule', 'match', 'tower', 'record', 'reply', 'daily']::text[]);
create index if not exists push_subscriptions_account on public.push_subscriptions (auth_user_id) where auth_user_id is not null;

-- 2. 구독 저장: application_close.sql 의 한도는 그대로, 저장하는 사람의 로그인으로 계정을 잇는다(로그아웃한 기기는 풀린다).
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.push_subscriptions s where s.endpoint = p_endpoint)
     and (select count(*) from public.push_subscriptions) >= 1000 then
    raise exception using errcode = 'P0001', message = '알림 구독자가 가득 찼습니다.';
  end if;
  insert into public.push_subscriptions (endpoint, p256dh, auth, auth_user_id)
  values (p_endpoint, p_p256dh, p_auth, auth.uid())
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, auth_user_id = excluded.auth_user_id;
end;
$$;
revoke all on function public.save_push_subscription(text, text, text) from public;
grant execute on function public.save_push_subscription(text, text, text) to anon, authenticated;

-- 3. 내 기기의 설정. endpoint 를 아는 것이 그 구독의 주인이다(delete_push_subscription 과 같다). 없으면 null.
create or replace function public.push_settings(p_endpoint text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('kinds', to_jsonb(s.kinds), 'linked', s.auth_user_id is not null)
    from public.push_subscriptions s where s.endpoint = p_endpoint;
$$;
revoke all on function public.push_settings(text) from public;
grant execute on function public.push_settings(text) to anon, authenticated;

-- 게시판을 새로 켜면 켠 때부터 센다(예전 글이 한꺼번에 오지 않게).
create or replace function public.set_push_kinds(p_endpoint text, p_kinds text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kinds text[] := array(select distinct k from unnest(coalesce(p_kinds, '{}')) k order by k);
begin
  if not v_kinds <@ array['notice', 'board', 'schedule', 'match', 'tower', 'record', 'reply', 'daily']::text[] then
    raise exception using errcode = 'P0001', message = '알 수 없는 알림 종류입니다.';
  end if;
  update public.push_subscriptions s
     set board_pushed_at = case when 'board' = any(v_kinds) and not 'board' = any(s.kinds) then now() else s.board_pushed_at end,
         kinds = v_kinds
   where s.endpoint = p_endpoint;
  return public.push_settings(p_endpoint);
end;
$$;
revoke all on function public.set_push_kinds(text, text[]) from public;
grant execute on function public.set_push_kinds(text, text[]) to anon, authenticated;

-- 4. 보낼 알림. auth_user_id 가 비어 있으면 그 종류를 켠 모두에게, 있으면 그 계정에 이어진 기기에만 간다.
-- dedup 이 같은 사실을 한 번만 넣는다(공지 id, 대회 id, 배틀과 받는 계정 …).
create table if not exists public.push_outbox (
  id bigint generated always as identity primary key,
  dedup text not null unique,
  kind text not null check (kind in ('notice', 'schedule', 'match', 'tower', 'record', 'reply', 'daily')),
  auth_user_id uuid references auth.users (id) on delete cascade,
  title text not null check (char_length(title) <= 40),
  body text not null check (char_length(body) <= 200),
  url text not null check (url ~ '^\?view='),
  created_at timestamptz not null default now(),
  taken_at timestamptz
);
-- laid again on every run, as push_subscriptions_kinds: a table made by an earlier copy takes the kinds added since
alter table public.push_outbox drop constraint if exists push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check check (kind in ('notice', 'schedule', 'match', 'tower', 'record', 'reply', 'daily'));
create index if not exists push_outbox_due on public.push_outbox (created_at) where taken_at is null;
alter table public.push_outbox enable row level security;
revoke all on table public.push_outbox from public, anon, authenticated, service_role;

-- 공지는 notify-announcement 가 운영진을 확인한 뒤 넣는다. 같은 공지는 한 번만(다시 저장해도 다시 알리지 않는다).
create or replace function public.push_queue_notice(p_id text, p_title text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.push_outbox (dedup, kind, title, body, url)
  values ('notice:' || p_id, 'notice', 'YPL 공지', left(coalesce(nullif(btrim(p_title), ''), '새 공지'), 120),
          '?view=news&notice=' || p_id)
  on conflict (dedup) do nothing;
$$;
revoke all on function public.push_queue_notice(text, text) from public, anon, authenticated;
grant execute on function public.push_queue_notice(text, text) to service_role;

-- 5. 내 경기: 공식 경기의 배틀을 먼저 연 선수가 기다리면, 상대 출전(팀이면 팀원 모두)의 계정에 알린다.
-- 계정은 승인된 연결의 선수이거나, 아직 선수가 없는 새 트레이너면 신청 이름이 계정의 이름과 같은 사람이다.
create or replace function public.push_match_waiting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_opponent uuid;
begin
  begin
    select case when m.entry_a_id = new.p1_entry_id then m.entry_b_id when m.entry_b_id = new.p1_entry_id then m.entry_a_id end
      into v_opponent
      from ypl_schema_validation.matches m
     where m.event_id = new.event_id
       and m.source_node_key = coalesce(substring(new.source_node_key from '^(.+):(?:bout:[1-9][0-9]*|ace)$'), new.source_node_key)
     limit 1;
    if v_opponent is null then return null; end if;
    insert into public.push_outbox (dedup, kind, auth_user_id, title, body, url)
    select distinct 'match:' || new.id || ':' || a.auth_user_id, 'match', a.auth_user_id, '내 경기',
           left(new.p1_name, 20) || ' 님이 배틀에서 기다립니다.',
           '?view=battle&event=' || new.event_id || '&match=' || new.source_node_key
      from ypl_schema_validation.entry_participants p
      join ypl_schema_validation.event_registrations r on r.id = p.registration_id
      join public.player_accounts a on a.status = 'approved'
       and (a.player_id = p.player_id or a.name_key = lower(regexp_replace(r.registration_name, '\s', '', 'g')))
     where p.entry_id = v_opponent
    on conflict (dedup) do nothing;
  exception when others then
    raise warning 'push_match_waiting: %', sqlerrm;
  end;
  return null;
end;
$$;
revoke all on function public.push_match_waiting() from public, anon, authenticated;
drop trigger if exists push_match_waiting on public.battles;
create trigger push_match_waiting after insert on public.battles
  for each row when (new.kind = 'official' and new.status = 'waiting') execute function public.push_match_waiting();

-- 6. 도전의 탑: 이번 달 도전(오늘의 탑 아님)이 한 판 이겨 순위가 오르면, 그 바로 위에 있던 계정들(같은 연승에 먼저 닿은)에 알린다.
-- 순위는 streak_board 와 같다: 계정마다 그달의 최고 연승, 같으면 먼저 닿은 쪽이 위다. 2연승부터 알린다(1연승은 모두가 지나는 자리).
create or replace function public.push_tower_passed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prev_best integer;
  v_prev_reached timestamptz;
begin
  begin
    select max(r.wins) into v_prev_best
      from public.streak_runs r
     where r.auth_user_id = new.auth_user_id and r.month = new.month and r.daily is null and r.id <> new.id;
    if coalesce(v_prev_best, 0) > old.wins then return null; end if;  -- 다른 도전이 이미 그보다 위에 있었다: 순위가 바뀌지 않는다
    select min(coalesce(r.last_win_at, r.started_at)) into v_prev_reached
      from public.streak_runs r
     where r.auth_user_id = new.auth_user_id and r.month = new.month and r.daily is null and r.id <> new.id and r.wins = old.wins;
    v_prev_reached := least(v_prev_reached, coalesce(old.last_win_at, old.started_at));

    insert into public.push_outbox (dedup, kind, auth_user_id, title, body, url)
    select 'pass:' || new.id || ':' || new.wins || ':' || b.auth_user_id, 'tower', b.auth_user_id, '도전의 탑',
           left(new.trainer_name, 20) || ' 님이 ' || new.wins || '연승으로 이번 달 순위에서 앞섰습니다.', '?view=battle&tab=streak'
      from (select r.auth_user_id, max(r.wins) as best from public.streak_runs r
             where r.month = new.month and r.daily is null and r.auth_user_id <> new.auth_user_id
             group by r.auth_user_id) b
     where b.best = old.wins
       and (select min(coalesce(r.last_win_at, r.started_at)) from public.streak_runs r
             where r.auth_user_id = b.auth_user_id and r.month = new.month and r.daily is null and r.wins = b.best) < v_prev_reached
    on conflict (dedup) do nothing;
  exception when others then
    raise warning 'push_tower_passed: %', sqlerrm;
  end;
  return null;
end;
$$;
revoke all on function public.push_tower_passed() from public, anon, authenticated;
drop trigger if exists push_tower_passed on public.streak_runs;
create trigger push_tower_passed after update of wins on public.streak_runs
  for each row when (new.daily is null and new.wins = old.wins + 1 and new.wins >= 2) execute function public.push_tower_passed();

-- 6b. 도전의 탑 신기록: 이번 달 도전 하나가 다른 모든 도전의 최고 연승을 넘어서는 판(이번 달 1위가 되는 순간), 켠 모두에게 한 번.
-- 1위가 계속 이겨 기록을 늘리는 판은 알리지 않는다(넘어선 순간만): 다른 도전의 최고가 그대로라 다시 넘는 일이 없다.
-- 같은 계정의 새 도전이 제 지난 기록을 넘어도 알린다(기록이 바뀌었다). 같은 달 같은 연승은 한 번(dedup).
create or replace function public.push_tower_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_best integer;
begin
  begin
    select max(r.wins) into v_best
      from public.streak_runs r
     where r.month = new.month and r.daily is null and r.id <> new.id;
    if coalesce(v_best, 0) <> old.wins then return null; end if;  -- 넘어선 판이 아니다(이미 1위였거나 아직 아래)
    insert into public.push_outbox (dedup, kind, title, body, url)
    values ('record:' || new.month || ':' || new.wins, 'record', '도전의 탑 신기록',
            left(new.trainer_name, 20) || ' 님이 ' || new.wins || '연승으로 이번 달 1위 기록을 새로 썼습니다.', '?view=battle&tab=streak')
    on conflict (dedup) do nothing;
  exception when others then
    raise warning 'push_tower_record: %', sqlerrm;
  end;
  return null;
end;
$$;
revoke all on function public.push_tower_record() from public, anon, authenticated;
drop trigger if exists push_tower_record on public.streak_runs;
create trigger push_tower_record after update of wins on public.streak_runs
  for each row when (new.daily is null and new.wins = old.wins + 1 and new.wins >= 2) execute function public.push_tower_record();

-- 7. 공지의 신청 마감 시각(application_closed 와 같은 읽기). 읽을 수 없으면 null.
create or replace function public.push_closes_at(p_value text)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v text := btrim(coalesce(p_value, ''));
begin
  if v = '' then return null; end if;
  return case when v ~ '(Z|[+-]\d\d(:?\d\d)?)$' then v::timestamptz else v::timestamp at time zone 'Asia/Seoul' end;
exception when others then
  return null;
end;
$$;
revoke all on function public.push_closes_at(text) from public, anon, authenticated;

-- 8. 꺼내기. notify-announcement 만 부른다(service_role). p_sweep: 정해진 시각의 알림(대회 일정, 오늘의 탑, 게시판)도 살핀다.
-- 돌려준 줄은 이미 꺼낸 것으로 적혀 있다. 보내다 실패한 것은 다시 보내지 않는다(푸시 서비스가 받은 뒤의 실패는 알 수도 없다).
-- ponytail: PostgREST 가 한 번에 돌려주는 1000줄이 끝이다. 구독(최대 1000)과 일정 알림이 겹치면 넘친 줄은 사라진다. 구독이 수백을 넘으면 나눠 꺼낸다.
-- p_now 는 밤낮과 오늘의 날짜만 정한다(검사가 시각을 정하려고 둔다, ensure_current_ypl_season_for_date 와 같은 방식). Edge Function은 넘기지 않는다.
create or replace function public.push_take(p_sweep boolean default false, p_now timestamptz default now())
returns table (kind text, endpoint text, p256dh text, auth text, title text, body text, url text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day boolean := extract(hour from p_now at time zone 'Asia/Seoul') between 9 and 21;
  v_today date := (p_now at time zone 'Asia/Seoul')::date;
begin
  if p_sweep and v_day then
    delete from public.push_outbox o where o.created_at < now() - interval '7 days';

    -- 신청 마감 임박: 켜진 신청서의 마감이 하루 안으로 들어오면 한 번
    insert into public.push_outbox (dedup, kind, title, body, url)
    select 'close:' || (a.item ->> 'id') || ':' || c.at, 'schedule', '신청 마감 임박',
           left(coalesce(a.item ->> 'title', '대회'), 80) || ' 신청이 '
             || to_char(c.at at time zone 'Asia/Seoul', 'FMMM"월" FMDD"일" ')
             || case when extract(hour from c.at at time zone 'Asia/Seoul') < 12 then '오전 ' else '오후 ' end
             || to_char(c.at at time zone 'Asia/Seoul', 'FMHH12:MI') || '에 마감됩니다.',
           '?view=news&notice=' || (a.item ->> 'id')
      from public.site_data s
     cross join lateral jsonb_array_elements(s.value -> 'announcements') a(item)
     cross join lateral (select public.push_closes_at(a.item #>> '{form,closesAt}') as at) c
     where s.key = 'ypl_data_v4' and jsonb_typeof(s.value -> 'announcements') = 'array'
       and a.item #>> '{form,enabled}' = 'true' and a.item ? 'id'
       and c.at > now() and c.at <= now() + interval '1 day'
    on conflict (dedup) do nothing;

    -- 대진표 공개: 대회의 대진표가 처음 만들어지면 한 번
    insert into public.push_outbox (dedup, kind, title, body, url)
    select 'bracket:' || e.id, 'schedule', '대진표 공개', left(e.name, 80) || ' 대진표를 공개했습니다.', '?view=bracket&eventId=' || e.id
      from ypl_schema_validation.bracket_runtimes b
      join ypl_schema_validation.events e on e.id = b.event_id
     where b.created_at > now() - interval '1 day' and e.status <> 'cancelled'
    on conflict (dedup) do nothing;

    -- 결과 등록: 대회 결과가 기록에 반영되면 한 번(취소 뒤 다시 반영해도 다시 알리지 않는다)
    insert into public.push_outbox (dedup, kind, title, body, url)
    select 'result:' || e.id, 'schedule', '결과 등록', left(e.name, 80) || ' 결과를 기록에 반영했습니다.', '?view=bracket&eventId=' || e.id
      from ypl_schema_validation.events e
     where e.record_applied_at > now() - interval '1 day'
    on conflict (dedup) do nothing;

    -- 오늘의 탑: 하루 한 번, 아침 첫 정리에서
    insert into public.push_outbox (dedup, kind, title, body, url)
    values ('daily:' || v_today, 'daily', '오늘의 탑', '오늘의 탑이 열렸습니다.', '?view=battle&tab=streak')
    on conflict (dedup) do nothing;
  end if;

  -- 줄 꺼내기. 도전의 탑은 기기마다 6시간에 한 번, 그사이의 것은 버린다(순위는 화면에서 본다).
  return query
  with due as (
    update public.push_outbox o set taken_at = now()
     where o.taken_at is null and o.created_at > now() - interval '1 day'
       and (v_day or o.kind in ('notice', 'match'))
    returning o.id, o.kind, o.auth_user_id, o.title, o.body, o.url
  ), plain as (
    select d.kind, s.endpoint, s.p256dh, s.auth, d.title, d.body, d.url
      from due d
      join public.push_subscriptions s on d.kind = any(s.kinds) and (d.auth_user_id is null or d.auth_user_id = s.auth_user_id)
     where d.kind <> 'tower'
  ), tower as (
    update public.push_subscriptions s set tower_pushed_at = now()
      from (select distinct on (s2.endpoint) s2.endpoint, d.title, d.body, d.url
              from due d join public.push_subscriptions s2 on 'tower' = any(s2.kinds) and d.auth_user_id = s2.auth_user_id
             where d.kind = 'tower'
             order by s2.endpoint, d.id desc) t
     where s.endpoint = t.endpoint and (s.tower_pushed_at is null or s.tower_pushed_at < now() - interval '6 hours')
    returning 'tower'::text, s.endpoint, s.p256dh, s.auth, t.title, t.body, t.url
  )
  select * from plain union all select * from tower;

  -- 게시판: 기기마다 한 시간에 한 번, 지난 알림 뒤에 올라온 공개 글을 한 알림으로 묶는다(글 하나면 그 글로 바로 간다).
  if p_sweep and v_day then
    return query
    with fresh as (
      select s.endpoint, count(*)::integer as n,
             (array_agg(i.payload ->> 'title' order by i.created_at desc))[1] as latest,
             (array_agg(i.id order by i.created_at desc))[1] as latest_id,
             (array_agg(case when i.board = 'free' then 'free' else coalesce(i.payload ->> 'kind', 'sample') end order by i.created_at desc))[1] as tab
        from public.push_subscriptions s
        join public.community_items i on i.created_at > s.board_pushed_at
       where 'board' = any(s.kinds) and s.board_pushed_at < now() - interval '1 hour'
         and i.parent_id is null and not i.secret and i.board in ('free', 'showcase')
       group by s.endpoint
    )
    update public.push_subscriptions s set board_pushed_at = now()
      from fresh f
     where s.endpoint = f.endpoint
    returning 'board'::text, s.endpoint, s.p256dh, s.auth, '게시판 새 글'::text,
              left(coalesce(nullif(btrim(f.latest), ''), '새 글'), 80) || case when f.n > 1 then ' 외 ' || (f.n - 1) || '개' else '' end,
              case when f.n = 1 then '?view=board&tab=' || f.tab || '&post=' || f.latest_id else '?view=board' end;
  end if;
end;
$$;
revoke all on function public.push_take(boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.push_take(boolean, timestamptz) to service_role;

commit;

notify pgrst, 'reload schema';
