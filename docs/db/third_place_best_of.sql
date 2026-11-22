-- 3위 결정전과 다전제(N선승) (2026-11-22, 소유자의 선택: 싱글에서 대진표를 만들 때 고르고, 3위와 4위는 순위만 나누며 포인트는 그대로,
-- N선승은 대진표를 만들 때 정하고, 사이트 배틀도 다전제). Supabase SQL Editor에서 통째로 한 번 실행한다. 다시 실행해도 안전하다.
-- 사이트는 이 파일 전에도 지금처럼 동작한다: 규칙 열이 없으면 단판, 3위전 없음이고, 만들기의 두 선택은 bracket_rules_ready() 뒤에만 보인다.
--
-- 바뀌는 것
--   1. bracket_runtimes 에 third_place(3위 결정전), wins_to(경기의 선승 수), final_wins_to(결승의 선승 수). 기본은 없음, 1, 1.
--   2. set_bracket_rules: 운영진이 대진표를 만든 직후, 결과가 하나도 없을 때 규칙을 정한다. 개인전만, 챔피언스 제외,
--      3위전은 싱글 엘리미네이션과 싱글 본선의 조별리그만.
--   3. 3위 결정전 경기(source_node_key 'single:third')는 준결승의 두 패자가 서는 경기다. 싱글 엘리미네이션은 승자 RPC가 준결승이
--      바뀔 때마다 sync_third_place_match 로 만들고 지우며, 그 승자는 set_third_place_winner 가 정한다. 조별 뒤 싱글 본선은
--      사이트가 계산한 계획(save_group_final_matches)이 같은 행을 쓴다.
--   4. set_normalized_single_bracket_winner, 대진표 삭제 두 함수, guard_group_record_apply 가 3위전 행을 받는다(아래 각 절).
--   7. set_normalized_match_outcome: N선승 대진표에서 이긴 선수의 점수는 선승 수와 같아야 한다.
--   8. 사이트 배틀의 다전제: 대진표에 들어가는 마지막 배틀(battles.applied_at)이 정해지면, 그 경기의 배틀 승수를 세어 점수로 남긴다.
--      배틀 함수(supabase/functions/battle)는 선승 수에 닿기 전의 배틀은 대진표에 넣지 않는다.
--
-- 지키는 것: 승자와 대진의 계산은 그대로다. 3위와 4위는 Result 의 순위(3, 4)만 다르고 placement_code 는 둘 다 semifinalist 라
-- RankingAward 와 4강 횟수, 칭호 판정은 바뀌지 않는다(사이트의 결과 계산이 정한다).

begin;

-- 1. 대진 규칙 열
alter table ypl_schema_validation.bracket_runtimes add column if not exists third_place boolean not null default false;
alter table ypl_schema_validation.bracket_runtimes add column if not exists wins_to smallint not null default 1;
alter table ypl_schema_validation.bracket_runtimes add column if not exists final_wins_to smallint not null default 1;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bracket_runtimes_wins_range' and conrelid = 'ypl_schema_validation.bracket_runtimes'::regclass) then
    alter table ypl_schema_validation.bracket_runtimes
      add constraint bracket_runtimes_wins_range check (wins_to between 1 and 3 and final_wins_to between 1 and 3);
  end if;
end;
$$;
grant select (third_place, wins_to, final_wins_to) on ypl_schema_validation.bracket_runtimes to anon, authenticated;

-- 2. 규칙 정하기
create or replace function ypl_schema_validation.set_bracket_rules(p_runtime_id uuid, p_event_id uuid, p_third_place boolean, p_wins_to integer, p_final_wins_to integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rt ypl_schema_validation.bracket_runtimes%rowtype;
  v_event ypl_schema_validation.events%rowtype;
begin
  if not ypl_schema_validation.is_ypl_admin() then
    raise exception using errcode = 'P0001', message = '관리자 권한이 필요합니다.';
  end if;
  select * into v_event from ypl_schema_validation.events e where e.id = p_event_id for update;
  if not found or v_event.status <> 'running' or v_event.record_applied_at is not null or v_event.is_team_event
     or coalesce(v_event.event_type, '') = 'champions' then
    raise exception using errcode = 'P0001', message = '진행 중인 개인전 대회의 대진표만 규칙을 정할 수 있습니다.';
  end if;
  select * into v_rt from ypl_schema_validation.bracket_runtimes r where r.id = p_runtime_id and r.event_id = p_event_id for update;
  if not found then raise exception using errcode = 'P0001', message = '대진표를 찾을 수 없습니다.'; end if;
  if exists (select 1 from ypl_schema_validation.matches m where m.event_id = p_event_id and m.winner_entry_id is not null) then
    raise exception using errcode = 'P0001', message = '결과가 들어간 대진표는 규칙을 바꿀 수 없습니다.';
  end if;
  if coalesce(p_wins_to, 1) not between 1 and 3 or coalesce(p_final_wins_to, 1) not between 1 and 3 then
    raise exception using errcode = 'P0001', message = '선승 수는 1에서 3 사이입니다.';
  end if;
  if coalesce(p_third_place, false)
     and not (v_rt.topology_kind = 'single_elimination'
              or (v_rt.topology_kind = 'groups_then_elimination' and v_rt.group_final_format = 'single_elimination')) then
    raise exception using errcode = 'P0001', message = '3위 결정전은 싱글 엘리미네이션에만 둘 수 있습니다.';
  end if;
  update ypl_schema_validation.bracket_runtimes r
     set third_place = coalesce(p_third_place, false), wins_to = coalesce(p_wins_to, 1), final_wins_to = coalesce(p_final_wins_to, 1), updated_at = now()
   where r.id = p_runtime_id;
end;
$$;
revoke all on function ypl_schema_validation.set_bracket_rules(uuid, uuid, boolean, integer, integer) from public, anon;
grant execute on function ypl_schema_validation.set_bracket_rules(uuid, uuid, boolean, integer, integer) to authenticated;

-- 3a. 싱글 엘리미네이션의 3위 결정전을 준결승에 맞춘다: 두 준결승이 끝났으면 그 두 패자의 경기가 있고(달라졌으면 새로), 아니면 없다.
--     승자 RPC 안에서(같은 트랜잭션, 대회 잠금 뒤) 부른다.
create or replace function ypl_schema_validation.sync_third_place_match(p_runtime_id uuid, p_event_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_size integer := 1;
  v_rounds integer := 0;
  v_entries integer;
  v_semi_a ypl_schema_validation.matches%rowtype;
  v_semi_b ypl_schema_validation.matches%rowtype;
  v_lose_a uuid;
  v_lose_b uuid;
  v_third ypl_schema_validation.matches%rowtype;
begin
  if not exists (select 1 from ypl_schema_validation.bracket_runtimes r where r.id = p_runtime_id and r.event_id = p_event_id
                   and r.third_place and r.topology_kind = 'single_elimination') then
    return;
  end if;
  select count(*)::integer into v_entries from ypl_schema_validation.bracket_entry_slots s where s.bracket_runtime_id = p_runtime_id and s.event_id = p_event_id;
  while v_size < v_entries loop v_size := v_size * 2; v_rounds := v_rounds + 1; end loop;
  select * into v_third from ypl_schema_validation.matches m
   where m.event_id = p_event_id and m.source = 'normalized_bracket_runtime' and m.source_node_key = 'single:third';
  if v_rounds < 2 then
    delete from ypl_schema_validation.matches m where m.event_id = p_event_id and m.source = 'normalized_bracket_runtime' and m.source_node_key = 'single:third';
    return;
  end if;
  select * into v_semi_a from ypl_schema_validation.matches m
   where m.event_id = p_event_id and m.source = 'normalized_bracket_runtime' and m.source_node_key = 'single:r' || (v_rounds - 1) || ':m1';
  select * into v_semi_b from ypl_schema_validation.matches m
   where m.event_id = p_event_id and m.source = 'normalized_bracket_runtime' and m.source_node_key = 'single:r' || (v_rounds - 1) || ':m2';
  if v_semi_a.winner_entry_id is not null then
    v_lose_a := case when v_semi_a.winner_entry_id = v_semi_a.entry_a_id then v_semi_a.entry_b_id else v_semi_a.entry_a_id end;
  end if;
  if v_semi_b.winner_entry_id is not null then
    v_lose_b := case when v_semi_b.winner_entry_id = v_semi_b.entry_a_id then v_semi_b.entry_b_id else v_semi_b.entry_a_id end;
  end if;
  if v_third.id is not null and v_third.entry_a_id is not distinct from v_lose_a and v_third.entry_b_id is not distinct from v_lose_b then
    return;
  end if;
  delete from ypl_schema_validation.matches m where m.event_id = p_event_id and m.source = 'normalized_bracket_runtime' and m.source_node_key = 'single:third';
  if v_lose_a is null or v_lose_b is null then return; end if;
  insert into ypl_schema_validation.matches (
      event_id, match_kind, parent_match_id, round_number, stage_label, sequence_no, entry_a_id, entry_b_id,
      player_a_id, player_b_id, winner_entry_id, winner_player_id, resolution, source, source_node_key, played_at
  ) values (
      p_event_id, 'bracket', null, v_rounds, '3위 결정전', v_size, v_lose_a, v_lose_b,
      null, null, null, null, 'unknown', 'normalized_bracket_runtime', 'single:third', null
  );
end;
$$;
revoke all on function ypl_schema_validation.sync_third_place_match(uuid, uuid) from public, anon;
grant execute on function ypl_schema_validation.sync_third_place_match(uuid, uuid) to authenticated;

-- 3b. 3위 결정전의 승자(null 이면 지움). 승자 RPC가 'single:third' 를 받으면 여기로 넘긴다. 대회와 경기의 검사는 승자 RPC와 같다.
create or replace function ypl_schema_validation.set_third_place_winner(p_runtime_id uuid, p_event_id uuid, p_winner_entry_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event ypl_schema_validation.events%rowtype;
  v_match ypl_schema_validation.matches%rowtype;
begin
  select * into v_event from ypl_schema_validation.events e where e.id = p_event_id for update;
  if not found or v_event.status <> 'running' or v_event.record_applied_at is not null then
    raise exception using errcode = 'P0001', message = '진행 중인 대회의 경기만 바꿀 수 있습니다.';
  end if;
  if exists (select 1 from ypl_schema_validation.results r where r.event_id = p_event_id)
     or exists (select 1 from ypl_schema_validation.ranking_awards a where a.event_id = p_event_id) then
    raise exception using errcode = 'P0001', message = 'Result 또는 RankingAward가 있으면 winner mutation을 수행할 수 없습니다.';
  end if;
  if not exists (select 1 from ypl_schema_validation.bracket_runtimes r where r.id = p_runtime_id and r.event_id = p_event_id and r.third_place) then
    raise exception using errcode = 'P0001', message = '3위 결정전이 없는 대진표입니다.';
  end if;
  select * into v_match from ypl_schema_validation.matches m
   where m.event_id = p_event_id and m.source = 'normalized_bracket_runtime' and m.source_node_key = 'single:third' for update;
  if not found then raise exception using errcode = 'P0001', message = '3위 결정전이 아직 성립하지 않았습니다.'; end if;
  if p_winner_entry_id is not null and p_winner_entry_id not in (v_match.entry_a_id, v_match.entry_b_id) then
    raise exception using errcode = 'P0001', message = 'winner는 target Match의 양쪽 Entry 중 하나여야 합니다.';
  end if;
  update ypl_schema_validation.matches m
     set winner_entry_id = p_winner_entry_id,
         resolution = case when p_winner_entry_id is null then 'unknown' else 'played' end,
         played_at = case when p_winner_entry_id is null then null else now() end,
         updated_at = now()
   where m.id = v_match.id;
end;
$$;
revoke all on function ypl_schema_validation.set_third_place_winner(uuid, uuid, uuid) from public, anon;
grant execute on function ypl_schema_validation.set_third_place_winner(uuid, uuid, uuid) to authenticated;

-- 4. 싱글 승자 RPC: match_outcome.sql 의 본문에서 세 곳만 다르다(3위전 키는 자기 함수로, 검증에서 3위전 행 제외, 끝에서 3위전 맞추기)
create or replace function ypl_schema_validation.set_normalized_single_bracket_winner(
    p_runtime_id uuid,
    p_event_id uuid,
    p_source_node_key text,
    p_winner_entry_id uuid
)
returns table (
    runtime_id uuid,
    event_id uuid,
    source_node_key text,
    previous_winner_entry_id uuid,
    winner_entry_id uuid,
    deleted_downstream_count integer,
    created_downstream_count integer,
    changed boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_event ypl_schema_validation.events%rowtype;
    v_runtime ypl_schema_validation.bracket_runtimes%rowtype;
    v_target_match ypl_schema_validation.matches%rowtype;
    v_lock record;
    v_node record;
    v_entry_count integer;
    v_bracket_size integer := 1;
    v_max_round integer := 0;
    v_target_round integer;
    v_target_match_no integer;
    v_round_match_count integer;
    v_round integer;
    v_match_no integer;
    v_desc_round integer;
    v_desc_match_no integer;
    v_entry_a uuid;
    v_entry_b uuid;
    v_winner uuid;
    v_existing_winner uuid;
    v_match_id uuid;
    v_match_found boolean;
    v_formed boolean;
    v_repair_only boolean := false;
    v_deleted_downstream integer := 0;
    v_created_downstream integer := 0;
    v_deleted integer := 0;
    v_sequence_no integer;
    v_node_key text;
begin
    if p_runtime_id is null or p_event_id is null then
        raise exception using errcode = 'P0001', message = 'runtime_id와 event_id가 필요합니다.';
    end if;
    -- 3위 결정전 (third_place_best_of.sql): its winner is set by its own function; nothing downstream depends on it
    if p_source_node_key = 'single:third' then
        perform ypl_schema_validation.set_third_place_winner(p_runtime_id, p_event_id, p_winner_entry_id);
        return query select p_runtime_id, p_event_id, p_source_node_key, null::uuid, p_winner_entry_id, 0, 0, true;
        return;
    end if;
    if p_source_node_key is null
       or p_source_node_key !~ '^single:r[1-9][0-9]*:m[1-9][0-9]*$' then
        raise exception using errcode = 'P0001', message = 'Single bracket target node key가 올바르지 않습니다.';
    end if;

    -- Serialize every mutation for this Event before reading any canonical
    -- fact. A missing/foreign runtime is never interpreted as legacy state.
    select *
      into v_event
      from ypl_schema_validation.events
     where id = p_event_id
     for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'winner mutation 대상 Event를 찾을 수 없습니다.';
    end if;

    perform pg_advisory_xact_lock(hashtextextended('normalized-single-runtime:' || p_runtime_id::text, 0));
    select *
      into v_runtime
      from ypl_schema_validation.bracket_runtimes as br
     where br.id = p_runtime_id
       and br.event_id = p_event_id
     ;
    if not found then
        raise exception using errcode = 'P0001', message = 'normalized Single runtime을 찾을 수 없습니다.';
    end if;
    if v_event.is_team_event
       or v_event.competition_format <> 'single_elimination'
       or v_event.status <> 'running'
       or v_event.record_applied_at is not null
       or v_runtime.topology_kind <> 'single_elimination'
       or v_runtime.projection_version <> 1 then
        raise exception using errcode = 'P0001', message = 'running 상태의 normalized Single runtime만 winner mutation할 수 있습니다.';
    end if;

    -- Lock all Match rows owned by this Event. Foreign-source rows are a hard
    -- boundary: this RPC must never silently absorb a legacy or other runtime.
    for v_lock in
        select m.id
          from ypl_schema_validation.matches as m
         where m.event_id = p_event_id
         for update
    loop
        null;
    end loop;
    if exists (
        select 1
          from ypl_schema_validation.matches as m
         where m.event_id = p_event_id
           and m.source <> 'normalized_bracket_runtime'
    ) then
        raise exception using errcode = 'P0001', message = 'Event에 foreign-source Match가 있어 winner mutation을 중단했습니다.';
    end if;
    if exists (select 1 from ypl_schema_validation.results as r0 where r0.event_id = p_event_id)
       or exists (select 1 from ypl_schema_validation.ranking_awards as a0 where a0.event_id = p_event_id) then
        raise exception using errcode = 'P0001', message = 'Result 또는 RankingAward가 있으면 winner mutation을 수행할 수 없습니다.';
    end if;

    -- Identity and slot facts are validated from the runtime-owned rows. No
    -- Entry.seed ordering or implicit fallback is allowed here.
    select count(*)::integer
      into v_entry_count
      from ypl_schema_validation.bracket_identity_changes as c
     where c.bracket_runtime_id = p_runtime_id
       and c.event_id = p_event_id;
    if v_entry_count < 2 then
        raise exception using errcode = 'P0001', message = 'normalized Single runtime 참가자가 2명 미만입니다.';
    end if;
    while v_bracket_size < v_entry_count loop
        v_bracket_size := v_bracket_size * 2;
    end loop;
    if (select count(distinct c.entry_id)::integer
          from ypl_schema_validation.bracket_identity_changes as c
         where c.bracket_runtime_id = p_runtime_id
           and c.event_id = p_event_id) <> v_entry_count then
        raise exception using errcode = 'P0001', message = 'runtime ownership에 duplicate Entry identity가 있습니다.';
    end if;
    while v_bracket_size > 1 loop
        v_max_round := v_max_round + 1;
        v_bracket_size := v_bracket_size / 2;
    end loop;
    -- Recompute the size after deriving max round.
    v_bracket_size := 1;
    while v_bracket_size < v_entry_count loop
        v_bracket_size := v_bracket_size * 2;
    end loop;

    if exists (
        select 1
          from ypl_schema_validation.bracket_identity_changes as c
          left join ypl_schema_validation.entries as e
            on e.id = c.entry_id and e.event_id = p_event_id
          left join ypl_schema_validation.entry_participants as ep
            on ep.id = c.entry_participant_id
           and ep.event_id = p_event_id
           and ep.entry_id = c.entry_id
           and ep.registration_id = c.registration_id
           and ep.player_id = c.player_id
          left join ypl_schema_validation.event_registrations as r
            on r.id = c.registration_id
           and r.event_id = p_event_id
           and r.player_id = c.player_id
          left join ypl_schema_validation.players as pl
            on pl.id = c.player_id
         where c.bracket_runtime_id = p_runtime_id
           and c.event_id = p_event_id
           and (e.id is null or e.entry_type <> 'individual' or e.status <> 'active'
                or ep.id is null or ep.member_order <> 1
                or r.id is null or pl.id is null)
    ) then
        raise exception using errcode = 'P0001', message = 'Entry/EntryParticipant canonical identity가 runtime과 일치하지 않습니다.';
    end if;
    if (select count(*)::integer
          from ypl_schema_validation.bracket_entry_slots as s
         where s.bracket_runtime_id = p_runtime_id
           and s.event_id = p_event_id) <> v_entry_count then
        raise exception using errcode = 'P0001', message = 'persisted slot set이 active Entry identity와 일치하지 않습니다.';
    end if;
    if exists (
        select 1
          from ypl_schema_validation.bracket_entry_slots as s
         where s.bracket_runtime_id = p_runtime_id
           and s.event_id = p_event_id
           and (s.stage_kind <> 'elimination' or s.stage_no <> 1 or s.pool_no <> 0
                or s.slot_no < 1 or s.slot_no > v_bracket_size)
    ) then
        raise exception using errcode = 'P0001', message = 'persisted Single slot topology가 malformed 상태입니다.';
    end if;
    if exists (
        select 1
          from ypl_schema_validation.bracket_entry_slots as s
          left join ypl_schema_validation.bracket_identity_changes as c
            on c.bracket_runtime_id = p_runtime_id
           and c.event_id = p_event_id
           and c.entry_id = s.entry_id
         where s.bracket_runtime_id = p_runtime_id
           and s.event_id = p_event_id
           and c.entry_id is null
    ) or exists (
        select 1
          from ypl_schema_validation.bracket_identity_changes as c
          left join ypl_schema_validation.bracket_entry_slots as s
            on s.bracket_runtime_id = p_runtime_id
           and s.event_id = p_event_id
           and s.entry_id = c.entry_id
         where c.bracket_runtime_id = p_runtime_id
           and c.event_id = p_event_id
           and s.entry_id is null
    ) then
        raise exception using errcode = 'P0001', message = 'slot의 Entry 집합이 runtime ownership과 일치하지 않습니다.';
    end if;
    if exists (
        with slots as (
            select s.slot_no, s.entry_id
              from ypl_schema_validation.bracket_entry_slots as s
             where s.bracket_runtime_id = p_runtime_id and s.event_id = p_event_id
        )
        select 1
          from generate_series(1, v_bracket_size / 2) as g(match_no)
          left join slots a on a.slot_no = (g.match_no * 2) - 1
          left join slots b on b.slot_no = g.match_no * 2
         where a.entry_id is null and b.entry_id is null
    ) then
        raise exception using errcode = 'P0001', message = 'persisted first-round slot에 double-BYE가 있습니다.';
    end if;

    -- Every normalized Match must belong to the generated Single key space;
    -- an extra or out-of-range row is malformed state, never a recoverable
    -- legacy fallback.
    if exists (
        select 1
          from ypl_schema_validation.matches as m
         where m.event_id = p_event_id
           and m.source = 'normalized_bracket_runtime'
           and m.source_node_key is distinct from 'single:third'
           and (
               m.source_node_key is null
               or m.source_node_key !~ '^single:r[1-9][0-9]*:m[1-9][0-9]*$'
               or substring(m.source_node_key from '^single:r([0-9]+):m[0-9]+$')::integer > v_max_round
               or substring(m.source_node_key from 'm([0-9]+)$')::integer
                    > v_bracket_size / power(2, substring(m.source_node_key from '^single:r([0-9]+):m[0-9]+$')::integer)::integer
           )
    ) then
        raise exception using errcode = 'P0001', message = 'normalized Match에 생성할 수 없는 Single node key가 있습니다.';
    end if;
    if exists (
        select 1
          from ypl_schema_validation.matches as m
         where m.event_id = p_event_id
           and m.source = 'normalized_bracket_runtime'
           and m.source_node_key is distinct from 'single:third'
           and (m.match_kind <> 'bracket'
                or m.parent_match_id is not null
                or m.entry_a_id is null or m.entry_b_id is null
                or m.player_a_id is not null or m.player_b_id is not null
                or m.winner_player_id is not null
                or m.round_number is null
                or m.round_number is distinct from substring(m.source_node_key from '^single:r([0-9]+):m[0-9]+$')::smallint
                or m.stage_label is distinct from '본선 ' || substring(m.source_node_key from '^single:r([0-9]+):m[0-9]+$') || 'R'
                or m.sequence_no is distinct from (
                    power(2, substring(m.source_node_key from '^single:r([0-9]+):m[0-9]+$')::integer - 1)::integer
                    - 1 + substring(m.source_node_key from '^single:r[0-9]+:m([0-9]+)$')::integer
                )
                -- a decided Match is played, or forfeit when one player did not come (match_outcome.sql)
                or not (case when m.winner_entry_id is null then m.resolution = 'unknown'
                             else m.resolution in ('played', 'forfeit') end))
    ) then
        raise exception using errcode = 'P0001', message = 'normalized Match field가 Single canonical contract와 일치하지 않습니다.';
    end if;

    v_target_round := substring(p_source_node_key from '^single:r([0-9]+):m[0-9]+$')::integer;
    v_target_match_no := substring(p_source_node_key from '^single:r[0-9]+:m([0-9]+)$')::integer;
    if v_target_round > v_max_round then
        raise exception using errcode = 'P0001', message = '생성할 수 없는 Single bracket round입니다.';
    end if;
    v_round_match_count := v_bracket_size;
    for v_round in 1..v_target_round loop
        v_round_match_count := v_round_match_count / 2;
    end loop;
    if v_target_match_no > v_round_match_count then
        raise exception using errcode = 'P0001', message = '생성할 수 없는 Single bracket match 번호입니다.';
    end if;

    -- A temporary projection table is transaction-local and is never a domain
    -- fact. It lets the function evaluate BYE auto-advancement and downstream
    -- winners without persisting future topology nodes.
    drop table if exists pg_temp.normalized_single_winner_nodes;
    create temporary table normalized_single_winner_nodes (
        source_node_key text primary key,
        round_no integer not null,
        match_no integer not null,
        entry_a_id uuid,
        entry_b_id uuid,
        winner_entry_id uuid,
        formed boolean not null,
        normalized_match_id uuid
    ) on commit drop;

    for v_match_no in 1..(v_bracket_size / 2) loop
        v_node_key := 'single:r1:m' || v_match_no::text;
        select a.entry_id, b.entry_id
          into v_entry_a, v_entry_b
          from (select s.entry_id from ypl_schema_validation.bracket_entry_slots as s
                 where s.bracket_runtime_id = p_runtime_id and s.event_id = p_event_id
                   and s.slot_no = (v_match_no * 2) - 1) a
          full join (select s.entry_id from ypl_schema_validation.bracket_entry_slots as s
                 where s.bracket_runtime_id = p_runtime_id and s.event_id = p_event_id
                   and s.slot_no = v_match_no * 2) b on true;
        v_formed := v_entry_a is not null and v_entry_b is not null;
        if not v_formed and v_entry_a is null and v_entry_b is null then
            raise exception using errcode = 'P0001', message = '첫 라운드 double-BYE topology입니다.';
        end if;
        v_winner := case when v_entry_a is not null and v_entry_b is null then v_entry_a
                         when v_entry_b is not null and v_entry_a is null then v_entry_b
                         else null end;
        select m.id, m.entry_a_id, m.entry_b_id, m.winner_entry_id
          into v_match_id, v_target_match.entry_a_id, v_target_match.entry_b_id, v_existing_winner
          from ypl_schema_validation.matches as m
         where m.event_id = p_event_id
           and m.source = 'normalized_bracket_runtime'
           and m.source_node_key = v_node_key;
        v_match_found := found;
        if v_match_found then
            if not v_formed or v_target_match.entry_a_id is distinct from v_entry_a
               or v_target_match.entry_b_id is distinct from v_entry_b then
                raise exception using errcode = 'P0001', message = 'persisted Match가 slot topology와 일치하지 않습니다.';
            end if;
            if v_existing_winner is not null
               and v_existing_winner not in (v_entry_a, v_entry_b) then
                raise exception using errcode = 'P0001', message = 'persisted Match winner가 양쪽 Entry가 아닙니다.';
            end if;
            elsif v_formed then
                raise exception using errcode = 'P0001', message = 'formed first-round Match가 누락되었습니다.';
        end if;
        insert into pg_temp.normalized_single_winner_nodes
            values (v_node_key, 1, v_match_no, v_entry_a, v_entry_b,
                    case when v_match_found then v_existing_winner else v_winner end,
                    v_formed, case when v_match_found then v_match_id else null end);
    end loop;

    for v_round in 2..v_max_round loop
        v_round_match_count := v_bracket_size;
        for v_desc_round in 1..v_round loop
            v_round_match_count := v_round_match_count / 2;
        end loop;
        for v_match_no in 1..v_round_match_count loop
            v_node_key := 'single:r' || v_round::text || ':m' || v_match_no::text;
            select n.winner_entry_id into v_entry_a
              from pg_temp.normalized_single_winner_nodes as n
             where n.source_node_key = 'single:r' || (v_round - 1)::text || ':m' || ((v_match_no * 2) - 1)::text;
            select n.winner_entry_id into v_entry_b
              from pg_temp.normalized_single_winner_nodes as n
             where n.source_node_key = 'single:r' || (v_round - 1)::text || ':m' || (v_match_no * 2)::text;
            v_formed := v_entry_a is not null and v_entry_b is not null;
            select m.id, m.entry_a_id, m.entry_b_id, m.winner_entry_id
              into v_match_id, v_target_match.entry_a_id, v_target_match.entry_b_id, v_existing_winner
              from ypl_schema_validation.matches as m
             where m.event_id = p_event_id
               and m.source = 'normalized_bracket_runtime'
               and m.source_node_key = v_node_key;
            v_match_found := found;
            if v_match_found then
                if not v_formed or v_target_match.entry_a_id is distinct from v_entry_a
                   or v_target_match.entry_b_id is distinct from v_entry_b then
                    raise exception using errcode = 'P0001', message = 'downstream Match가 canonical topology와 일치하지 않습니다.';
                end if;
                if v_existing_winner is not null
                   and v_existing_winner not in (v_entry_a, v_entry_b) then
                    raise exception using errcode = 'P0001', message = 'downstream Match winner가 양쪽 Entry가 아닙니다.';
                end if;
            elsif v_formed
               and not (v_round > v_target_round
                        and ((v_target_match_no - 1) / power(2, v_round - v_target_round)::integer) + 1 = v_match_no) then
                -- Older create revisions persisted only first-round real
                -- matches. Repair an already-formed sibling node in-place;
                -- the affected descendant chain is rebuilt below as usual.
                insert into ypl_schema_validation.matches (
                    event_id, match_kind, parent_match_id, round_number, stage_label,
                    sequence_no, entry_a_id, entry_b_id, player_a_id, player_b_id,
                    winner_entry_id, winner_player_id, resolution, source,
                    source_node_key, played_at
                ) values (
                    p_event_id, 'bracket', null, v_round, '본선 ' || v_round::text || 'R',
                    ((power(2, v_round - 1)::integer) - 1 + v_match_no),
                    v_entry_a, v_entry_b, null, null, null, null, 'unknown',
                    'normalized_bracket_runtime', v_node_key, null
                ) returning id into v_match_id;
                v_match_found := true;
                v_existing_winner := null;
                v_created_downstream := v_created_downstream + 1;
            end if;
            insert into pg_temp.normalized_single_winner_nodes
                values (v_node_key, v_round, v_match_no, v_entry_a, v_entry_b,
                        case when v_match_found then v_existing_winner else null end,
                        v_formed, case when v_match_found then v_match_id else null end);
        end loop;
    end loop;

    select m.*
      into v_target_match
      from ypl_schema_validation.matches as m
     where m.event_id = p_event_id
       and m.source = 'normalized_bracket_runtime'
       and m.source_node_key = p_source_node_key
     for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'winner mutation 대상 Match가 없습니다. BYE/future node는 변경할 수 없습니다.';
    end if;
    if v_target_match.entry_a_id is null or v_target_match.entry_b_id is null then
        raise exception using errcode = 'P0001', message = 'formed Match가 아닌 node는 winner mutation 대상이 아닙니다.';
    end if;
    if p_winner_entry_id is not null
       and p_winner_entry_id not in (v_target_match.entry_a_id, v_target_match.entry_b_id) then
        raise exception using errcode = 'P0001', message = 'winner는 target Match의 양쪽 Entry 중 하나여야 합니다.';
    end if;

    if v_target_match.winner_entry_id is not distinct from p_winner_entry_id then
        if exists (
            select 1
              from pg_temp.normalized_single_winner_nodes as n
             where n.formed
               and n.normalized_match_id is null
               and n.round_no > v_target_round
               and ((v_target_match_no - 1) / power(2, n.round_no - v_target_round)::integer) + 1 = n.match_no
        ) then
            v_repair_only := true;
        else
            return query select p_runtime_id, p_event_id, p_source_node_key,
                                v_target_match.winner_entry_id, p_winner_entry_id,
                                0, 0, false;
            return;
        end if;
    end if;

    -- Remove only the target node's descendant chain, deepest first. Sibling
    -- subtrees and the target Match itself remain intact.
    if not v_repair_only then
      for v_desc_round in reverse v_max_round..(v_target_round + 1) loop
        v_round_match_count := v_bracket_size;
        for v_round in 1..v_desc_round loop
            v_round_match_count := v_round_match_count / 2;
        end loop;
        for v_desc_match_no in 1..v_round_match_count loop
            if ((v_target_match_no - 1) / power(2, v_desc_round - v_target_round)::integer) + 1 = v_desc_match_no then
                delete from ypl_schema_validation.matches as m
                 where m.event_id = p_event_id
                   and m.source = 'normalized_bracket_runtime'
                   and m.source_node_key = 'single:r' || v_desc_round::text || ':m' || v_desc_match_no::text;
                get diagnostics v_deleted = row_count;
                v_deleted_downstream := v_deleted_downstream + v_deleted;
            end if;
        end loop;
      end loop;

      update ypl_schema_validation.matches as m
       set winner_entry_id = p_winner_entry_id,
           resolution = case when p_winner_entry_id is null then 'unknown' else 'played' end,
           played_at = case when p_winner_entry_id is null then null else now() end,
           updated_at = now()
     where m.id = v_target_match.id
       and m.event_id = p_event_id
       and m.source = 'normalized_bracket_runtime';
      if not found then
          raise exception using errcode = 'P0001', message = 'target Match update ownership이 변경되었습니다.';
      end if;
    end if;

    -- Re-evaluate only the affected chain. A newly formed node receives a new
    -- Match with winner NULL; old descendant winners are never carried forward.
    if not v_repair_only then
      update pg_temp.normalized_single_winner_nodes as n
         set winner_entry_id = case when n.source_node_key = p_source_node_key then p_winner_entry_id else n.winner_entry_id end
       where n.source_node_key = p_source_node_key;
    end if;
    for v_round in (v_target_round + 1)..v_max_round loop
        v_round_match_count := v_bracket_size;
        for v_desc_round in 1..v_round loop
            v_round_match_count := v_round_match_count / 2;
        end loop;
        for v_match_no in 1..v_round_match_count loop
            if ((v_target_match_no - 1) / power(2, v_round - v_target_round)::integer) + 1 <> v_match_no then
                continue;
            end if;
            v_node_key := 'single:r' || v_round::text || ':m' || v_match_no::text;
            select n.winner_entry_id into v_entry_a
              from pg_temp.normalized_single_winner_nodes as n
             where n.source_node_key = 'single:r' || (v_round - 1)::text || ':m' || ((v_match_no * 2) - 1)::text;
            select n.winner_entry_id into v_entry_b
              from pg_temp.normalized_single_winner_nodes as n
             where n.source_node_key = 'single:r' || (v_round - 1)::text || ':m' || (v_match_no * 2)::text;
            v_formed := v_entry_a is not null and v_entry_b is not null;
            select n.normalized_match_id into v_match_id
              from pg_temp.normalized_single_winner_nodes as n where n.source_node_key = v_node_key;
            if not v_formed then
                update pg_temp.normalized_single_winner_nodes as n
                   set entry_a_id = v_entry_a, entry_b_id = v_entry_b,
                       winner_entry_id = null, formed = false, normalized_match_id = null
                 where n.source_node_key = v_node_key;
                continue;
            end if;
            insert into ypl_schema_validation.matches (
                event_id, match_kind, parent_match_id, round_number, stage_label,
                sequence_no, entry_a_id, entry_b_id, player_a_id, player_b_id,
                winner_entry_id, winner_player_id, resolution, source,
                source_node_key, played_at
            ) values (
                p_event_id, 'bracket', null, v_round, '본선 ' || v_round::text || 'R',
                ((power(2, v_round - 1)::integer) - 1 + v_match_no),
                v_entry_a, v_entry_b, null, null, null, null, 'unknown',
                'normalized_bracket_runtime', v_node_key, null
            ) returning id into v_match_id;
            v_created_downstream := v_created_downstream + 1;
            update pg_temp.normalized_single_winner_nodes as n
               set entry_a_id = v_entry_a, entry_b_id = v_entry_b,
                   winner_entry_id = null, formed = true, normalized_match_id = v_match_id
             where n.source_node_key = v_node_key;
        end loop;
    end loop;

    -- the semifinals may have changed: the 3위 결정전 follows them (third_place_best_of.sql)
    perform ypl_schema_validation.sync_third_place_match(p_runtime_id, p_event_id);

    return query select p_runtime_id, p_event_id, p_source_node_key,
                        v_target_match.winner_entry_id, p_winner_entry_id,
                        v_deleted_downstream, v_created_downstream, not v_repair_only;
end;
$$;

-- 5. 대진표 삭제 두 함수: 경기 키 검사가 3위전을 받는다(나머지는 live_drift_2026_11_22.sql, normalized_bracket_runtime_rpc.sql 그대로)
CREATE OR REPLACE FUNCTION ypl_schema_validation.delete_normalized_bracket_runtime(p_runtime_id uuid, p_event_id uuid)
 RETURNS TABLE(runtime_id uuid, event_id uuid, deleted_match_count integer, deleted boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
    v_event ypl_schema_validation.events%rowtype;
    v_runtime ypl_schema_validation.bracket_runtimes%rowtype;
    v_identity_count integer;
    v_match_count integer;
    v_created_player_ids uuid[] := array[]::uuid[];
    v_identity_snapshot jsonb := '[]'::jsonb;
begin
    if p_runtime_id is null or p_event_id is null then
        raise exception using errcode = 'P0001', message = 'runtime_id와 event_id가 필요합니다.';
    end if;

    select * into v_event
      from ypl_schema_validation.events
     where id = p_event_id
     for update;
    if not found then
        raise exception using errcode = 'P0001', message = '삭제 대상 Event를 찾을 수 없습니다.';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('normalized-bracket-runtime:' || p_runtime_id::text, 0));
    select * into v_runtime
      from ypl_schema_validation.bracket_runtimes br
     where br.id = p_runtime_id and br.event_id = p_event_id;
    if not found then
        raise exception using errcode = 'P0001', message = 'normalized runtime ownership이 일치하지 않습니다.';
    end if;
    if v_runtime.topology_kind <> v_event.competition_format
       or (v_runtime.topology_kind = 'single_elimination' and not v_event.is_team_event)
       or v_event.record_applied_at is not null
       or v_event.status not in ('open', 'running') then
        raise exception using errcode = 'P0001', message = '기록 반영 전 허용된 Team/Double runtime만 삭제할 수 있습니다.';
    end if;

    if exists (select 1 from ypl_schema_validation.results r0 where r0.event_id = p_event_id)
       or exists (select 1 from ypl_schema_validation.ranking_awards a0 where a0.event_id = p_event_id) then
        raise exception using errcode = 'P0001', message = 'Result 또는 RankingAward가 있어 runtime 삭제를 중단했습니다.';
    end if;

    select count(*)::integer into v_identity_count
      from ypl_schema_validation.bracket_identity_changes bic0
     where bic0.bracket_runtime_id = p_runtime_id and bic0.event_id = p_event_id;
    if v_identity_count < 2 then
        raise exception using errcode = 'P0001', message = 'runtime identity ownership metadata가 부족합니다.';
    end if;
    if exists (
        select 1
          from ypl_schema_validation.bracket_identity_changes c
          left join ypl_schema_validation.entries e
            on e.id = c.entry_id and e.event_id = p_event_id
          left join ypl_schema_validation.entry_participants ep
            on ep.id = c.entry_participant_id and ep.event_id = p_event_id
           and ep.entry_id = c.entry_id and ep.registration_id = c.registration_id and ep.player_id = c.player_id
          left join ypl_schema_validation.event_registrations er
            on er.id = c.registration_id and er.event_id = p_event_id and er.player_id = c.player_id
          left join ypl_schema_validation.players pl on pl.id = c.player_id
         where c.bracket_runtime_id = p_runtime_id and c.event_id = p_event_id
           and (e.id is null or e.entry_type <> case when v_event.is_team_event then 'team' else 'individual' end
             or e.status <> 'active' or ep.id is null or er.id is null or pl.id is null)
    ) then
        raise exception using errcode = 'P0001', message = 'runtime identity ownership exact-match가 깨져 삭제를 중단했습니다.';
    end if;

    if exists (
        select 1 from ypl_schema_validation.matches m0
         where m0.event_id = p_event_id and m0.source <> 'normalized_bracket_runtime'
    ) then
        raise exception using errcode = 'P0001', message = 'foreign-source Match가 있어 runtime 삭제를 중단했습니다.';
    end if;
    if exists (
        select 1
          from ypl_schema_validation.matches m
         where m.event_id = p_event_id
           and m.source = 'normalized_bracket_runtime'
           and (
             (m.match_kind = 'bracket' and (
                m.parent_match_id is not null or m.entry_a_id is null or m.entry_b_id is null
                or m.player_a_id is not null or m.player_b_id is not null or m.winner_player_id is not null
                or (v_runtime.topology_kind = 'double_elimination'
                    and m.source_node_key !~ '^double:(w|l):r[1-9][0-9]*:m[1-9][0-9]*$'
                    and m.source_node_key not in ('double:gf:m1', 'double:reset:m1'))
                or (v_runtime.topology_kind = 'groups_then_elimination' and m.source_node_key !~ '^((group|playoff):g[1-9][0-9]*:m[1-9][0-9]*|single:(r[1-9][0-9]*:m[1-9][0-9]*|third)|double:((w|l):r[1-9][0-9]*:m[1-9][0-9]*|(gf|reset):m1))$') or (v_runtime.topology_kind = 'single_elimination' and m.source_node_key !~ '^single:(r[1-9][0-9]*:m[1-9][0-9]*|third)$')
             ))
             or (m.match_kind in ('team_bout', 'ace') and (
                not v_event.is_team_event or m.parent_match_id is null
                or m.entry_a_id is not null or m.entry_b_id is not null
                or m.player_a_id is null or m.player_b_id is null or m.winner_entry_id is not null
                or not exists (
                    select 1 from ypl_schema_validation.matches parent
                     where parent.id = m.parent_match_id and parent.event_id = p_event_id
                       and parent.source = 'normalized_bracket_runtime' and parent.match_kind = 'bracket'
                       and (m.source_node_key = parent.source_node_key || ':ace'
                         or m.source_node_key ~ ('^' || parent.source_node_key || ':bout:[1-9][0-9]*$'))
                )
             ))
             or m.match_kind not in ('bracket', 'team_bout', 'ace')
           )
    ) then
        raise exception using errcode = 'P0001', message = 'normalized Match shape/source ownership이 runtime contract와 다릅니다.';
    end if;
    if exists (
        select 1 from ypl_schema_validation.matches m0
         where m0.event_id = p_event_id and m0.source = 'normalized_bracket_runtime'
         group by m0.source_node_key having count(*) > 1
    ) then
        raise exception using errcode = 'P0001', message = 'normalized Match source_node_key가 중복되어 삭제를 중단했습니다.';
    end if;

    select count(*)::integer into v_match_count
      from ypl_schema_validation.matches m0
     where m0.event_id = p_event_id and m0.source = 'normalized_bracket_runtime';

    select coalesce(
        array_agg(distinct bic0.player_id) filter (where bic0.player_was_created),
        array[]::uuid[]
    )
      into v_created_player_ids
      from ypl_schema_validation.bracket_identity_changes bic0
     where bic0.bracket_runtime_id = p_runtime_id
       and bic0.event_id = p_event_id;

    select coalesce(jsonb_agg(jsonb_build_object(
        'entry_participant_id', bic0.entry_participant_id,
        'entry_id', bic0.entry_id,
        'registration_id', bic0.registration_id,
        'player_id', bic0.player_id,
        'registration_was_created', bic0.registration_was_created,
        'registration_player_was_changed', bic0.registration_player_was_changed,
        'previous_registration_player_id', bic0.previous_registration_player_id,
        'entry_was_created', bic0.entry_was_created,
        'entry_participant_was_created', bic0.entry_participant_was_created
    ) order by bic0.entry_participant_id), '[]'::jsonb)
      into v_identity_snapshot
      from ypl_schema_validation.bracket_identity_changes bic0
     where bic0.bracket_runtime_id = p_runtime_id
       and bic0.event_id = p_event_id;

    delete from ypl_schema_validation.matches m0
     where m0.event_id = p_event_id
       and m0.source = 'normalized_bracket_runtime';

    delete from ypl_schema_validation.bracket_entry_slots bes0
     where bes0.bracket_runtime_id = p_runtime_id
       and bes0.event_id = p_event_id;

    delete from ypl_schema_validation.bracket_identity_changes bic0
     where bic0.bracket_runtime_id = p_runtime_id
       and bic0.event_id = p_event_id;

    delete from ypl_schema_validation.entry_participants ep0
     where ep0.event_id = p_event_id
       and ep0.id in (
           select distinct c.entry_participant_id
             from jsonb_to_recordset(v_identity_snapshot) as c(
               entry_participant_id uuid, entry_id uuid, registration_id uuid, player_id uuid,
               registration_was_created boolean, registration_player_was_changed boolean,
               previous_registration_player_id uuid, entry_was_created boolean,
               entry_participant_was_created boolean
             )
            where c.entry_participant_was_created
       );

    delete from ypl_schema_validation.entries e0
     where e0.event_id = p_event_id
       and e0.id in (
           select distinct c.entry_id
             from jsonb_to_recordset(v_identity_snapshot) as c(
               entry_participant_id uuid, entry_id uuid, registration_id uuid, player_id uuid,
               registration_was_created boolean, registration_player_was_changed boolean,
               previous_registration_player_id uuid, entry_was_created boolean,
               entry_participant_was_created boolean
             )
            where c.entry_was_created
       );

    update ypl_schema_validation.event_registrations er0
       set player_id = restore.previous_registration_player_id,
           updated_at = now()
      from (
          select distinct on (c.registration_id)
                 c.registration_id,
                 c.player_id,
                 c.previous_registration_player_id
            from jsonb_to_recordset(v_identity_snapshot) as c(
               entry_participant_id uuid, entry_id uuid, registration_id uuid, player_id uuid,
               registration_was_created boolean, registration_player_was_changed boolean,
               previous_registration_player_id uuid, entry_was_created boolean,
               entry_participant_was_created boolean
            )
            where c.registration_player_was_changed
              and not c.registration_was_created
              -- A submitted Registration is a durable Event fact. Bracket
              -- deletion must remove only runtime artifacts, never undo its
              -- Player link, even when that link was created by this runtime.
              and not exists (
                  select 1
                    from ypl_schema_validation.event_registrations durable_registration
                   where durable_registration.id = c.registration_id
                     and durable_registration.event_id = p_event_id
                     and (
                       durable_registration.final_submission_id is not null
                       or exists (
                         select 1
                           from ypl_schema_validation.registration_submissions durable_submission
                          where durable_submission.registration_id = durable_registration.id
                       )
                     )
              )
           order by c.registration_id, c.entry_participant_id
      ) restore
     where er0.id = restore.registration_id
       and er0.event_id = p_event_id
       and er0.player_id = restore.player_id;

    delete from ypl_schema_validation.event_registrations er0
     where er0.event_id = p_event_id
       and er0.id in (
           select distinct c.registration_id
             from jsonb_to_recordset(v_identity_snapshot) as c(
               entry_participant_id uuid, entry_id uuid, registration_id uuid, player_id uuid,
               registration_was_created boolean, registration_player_was_changed boolean,
               previous_registration_player_id uuid, entry_was_created boolean,
               entry_participant_was_created boolean
             )
             where c.registration_was_created
               -- Runtime-created does not mean disposable once a Team Builder
               -- submission exists. Preserve Registration plus its immutable
               -- Submission/Snapshot chain in that case.
               and not exists (
                   select 1
                     from ypl_schema_validation.event_registrations durable_registration
                    where durable_registration.id = c.registration_id
                      and durable_registration.event_id = p_event_id
                      and (
                        durable_registration.final_submission_id is not null
                        or exists (
                          select 1
                            from ypl_schema_validation.registration_submissions durable_submission
                           where durable_submission.registration_id = durable_registration.id
                        )
                      )
               )
       );
    delete from ypl_schema_validation.players pl0
     where pl0.id = any(v_created_player_ids)
       and not exists (
           select 1 from ypl_schema_validation.event_registrations er0
            where er0.player_id = pl0.id
       )
       and not exists (
           select 1 from ypl_schema_validation.entry_participants ep0
            where ep0.player_id = pl0.id
       )
       and not exists (
           select 1 from ypl_schema_validation.matches m0
            where m0.player_a_id = pl0.id
               or m0.player_b_id = pl0.id
               or m0.winner_player_id = pl0.id
       )
       and not exists (
           select 1 from ypl_schema_validation.ranking_awards ra0
            where ra0.player_id = pl0.id
       )
       and not exists (
           select 1 from ypl_schema_validation.hall_of_fame_entries hof0
            where hof0.player_id = pl0.id
       );

    delete from ypl_schema_validation.bracket_runtimes br0
     where br0.id = p_runtime_id
       and br0.event_id = p_event_id;

    update ypl_schema_validation.events
       set status = v_runtime.previous_event_status,
           updated_at = now()
     where id = p_event_id;

    return query select p_runtime_id, p_event_id, v_match_count, true;
end;
$function$;

create or replace function ypl_schema_validation.delete_normalized_single_bracket_runtime(
    p_runtime_id uuid,
    p_event_id uuid
)
returns table (
    runtime_id uuid,
    event_id uuid,
    deleted_match_count integer,
    deleted_slot_count integer,
    deleted_identity_count integer,
    restored_event_status text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_event ypl_schema_validation.events%rowtype;
    v_runtime ypl_schema_validation.bracket_runtimes%rowtype;
    v_change record;
    v_identity_snapshot jsonb;
    v_identity_count integer;
    v_deleted_matches integer := 0;
    v_deleted_slots integer := 0;
    v_deleted_identities integer := 0;
    v_deleted integer;
    v_bracket_size integer := 1;
    v_expected_match_count integer := 0;
begin
    if p_runtime_id is null or p_event_id is null then
        raise exception using errcode = 'P0001', message = 'runtime_id와 event_id가 필요합니다.';
    end if;

    select * into v_event
      from ypl_schema_validation.events
     where id = p_event_id
     for update;
    if not found then
        raise exception using errcode = 'P0001', message = '삭제 대상 Event를 찾을 수 없습니다.';
    end if;
    if v_event.is_team_event
       or v_event.competition_format <> 'single_elimination'
       or v_event.record_applied_at is not null
       or v_event.status = 'completed'
       or v_event.status not in ('open', 'running') then
        raise exception using errcode = 'P0001', message = '기록 반영 전 open/running 개인전만 삭제할 수 있습니다.';
    end if;

    perform pg_advisory_xact_lock(hashtextextended('normalized-single-runtime:' || p_runtime_id::text, 0));
    select * into v_runtime
      from ypl_schema_validation.bracket_runtimes as br
     where br.id = p_runtime_id and br.event_id = p_event_id
     ;
    if not found then
        raise exception using errcode = 'P0001', message = 'normalized Single runtime을 찾을 수 없습니다.';
    end if;
    if v_runtime.topology_kind <> 'single_elimination' or v_runtime.projection_version <> 1 then
        raise exception using errcode = 'P0001', message = '삭제 대상 runtime topology/version이 일치하지 않습니다.';
    end if;

    if exists (select 1 from ypl_schema_validation.results as r0 where r0.event_id = p_event_id)
       or exists (select 1 from ypl_schema_validation.ranking_awards as a0 where a0.event_id = p_event_id) then
        raise exception using errcode = 'P0001', message = 'Result 또는 RankingAward가 있어 삭제를 중단했습니다.';
    end if;
    if exists (
        select 1
          from ypl_schema_validation.matches as m0
         where m0.event_id = p_event_id
           and m0.source <> 'normalized_bracket_runtime'
    ) then
        raise exception using errcode = 'P0001', message = '다른 source가 소유한 Match가 있어 삭제를 중단했습니다.';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
        'entry_participant_id', entry_participant_id,
        'entry_id', entry_id,
        'registration_id', registration_id,
        'player_id', player_id,
        'player_was_created', player_was_created,
        'registration_was_created', registration_was_created,
        'registration_player_was_changed', registration_player_was_changed,
        'previous_registration_player_id', previous_registration_player_id,
        'entry_was_created', entry_was_created,
        'entry_participant_was_created', entry_participant_was_created
    ) order by entry_participant_id), '[]'::jsonb)
      into v_identity_snapshot
       from ypl_schema_validation.bracket_identity_changes as bic
      where bic.bracket_runtime_id = p_runtime_id and bic.event_id = p_event_id;

    select jsonb_array_length(v_identity_snapshot) into v_identity_count;
    if v_identity_count < 2 then
        raise exception using errcode = 'P0001', message = 'ownership metadata가 없거나 참가자 수가 부족합니다.';
    end if;
    if exists (
        select 1
          from jsonb_to_recordset(v_identity_snapshot) as c(
              entry_participant_id uuid, entry_id uuid, registration_id uuid,
              player_id uuid, player_was_created boolean,
              registration_was_created boolean, registration_player_was_changed boolean,
              previous_registration_player_id uuid, entry_was_created boolean,
              entry_participant_was_created boolean
          )
         where not c.entry_was_created or not c.entry_participant_was_created
    ) then
        raise exception using errcode = 'P0001', message = '현재 Single runtime이 소유하지 않은 Entry identity가 있어 삭제를 중단했습니다.';
    end if;
    if (select count(*) from ypl_schema_validation.entries as e0 where e0.event_id = p_event_id) <> v_identity_count
       or (select count(*) from ypl_schema_validation.entry_participants as ep0 where ep0.event_id = p_event_id) <> v_identity_count
       or (select count(*) from ypl_schema_validation.bracket_entry_slots as bes0 where bes0.bracket_runtime_id = p_runtime_id) <> v_identity_count then
        raise exception using errcode = 'P0001', message = 'runtime/slot/identity count가 exact ownership과 일치하지 않습니다.';
    end if;
    while v_bracket_size < v_identity_count loop
        v_bracket_size := v_bracket_size * 2;
    end loop;
    if exists (
        select 1
          from ypl_schema_validation.bracket_entry_slots s
         where s.bracket_runtime_id = p_runtime_id
           and s.event_id = p_event_id
           and (s.stage_kind <> 'elimination'
             or s.stage_no <> 1
             or s.pool_no <> 0
             or s.slot_no < 1
             or s.slot_no > v_bracket_size
             or not exists (
                 select 1
                   from jsonb_to_recordset(v_identity_snapshot) as c(
                       entry_participant_id uuid, entry_id uuid, registration_id uuid,
                       player_id uuid, player_was_created boolean,
                       registration_was_created boolean, registration_player_was_changed boolean,
                       previous_registration_player_id uuid, entry_was_created boolean,
                       entry_participant_was_created boolean
                   )
                  where c.entry_id = s.entry_id
             ))
    ) then
        raise exception using errcode = 'P0001', message = 'draw slot이 initial Single ownership과 일치하지 않습니다.';
    end if;
    if exists (
        select 1
          from jsonb_to_recordset(v_identity_snapshot) as c(
              entry_participant_id uuid, entry_id uuid, registration_id uuid,
              player_id uuid, player_was_created boolean,
              registration_was_created boolean, registration_player_was_changed boolean,
              previous_registration_player_id uuid, entry_was_created boolean,
              entry_participant_was_created boolean
          )
          left join ypl_schema_validation.bracket_entry_slots s
            on s.bracket_runtime_id = p_runtime_id
           and s.event_id = p_event_id
           and s.stage_kind = 'elimination'
           and s.stage_no = 1
           and s.pool_no = 0
           and s.entry_id = c.entry_id
         where s.entry_id is null
    ) then
        raise exception using errcode = 'P0001', message = 'ownership Entry에 initial draw slot이 없습니다.';
    end if;
    if exists (
        select 1
          from ypl_schema_validation.bracket_identity_changes c
          left join ypl_schema_validation.entries e
            on e.id = c.entry_id and e.event_id = p_event_id
          left join ypl_schema_validation.entry_participants ep
            on ep.id = c.entry_participant_id and ep.event_id = p_event_id
          left join ypl_schema_validation.event_registrations r
            on r.id = c.registration_id and r.event_id = p_event_id
          left join ypl_schema_validation.players p on p.id = c.player_id
         where c.bracket_runtime_id = p_runtime_id
           and (e.id is null or e.entry_type <> 'individual' or e.status <> 'active'
             or ep.entry_id is distinct from c.entry_id
             or ep.registration_id is distinct from c.registration_id
             or ep.player_id is distinct from c.player_id
             or ep.member_order is distinct from 1::smallint
             or r.player_id is distinct from c.player_id or p.id is null)
    ) then
        raise exception using errcode = 'P0001', message = 'ownership metadata와 현재 Entry/Registration/Player가 exact-match하지 않습니다.';
    end if;
    if exists (
        select 1
          from ypl_schema_validation.matches as m0
          where m0.event_id = p_event_id
             and (m0.source <> 'normalized_bracket_runtime'
               or m0.match_kind is distinct from 'bracket'
               or m0.parent_match_id is not null
               or m0.round_number is null or m0.round_number < 1
               or m0.source_node_key is null
               or m0.source_node_key !~ '^single:(r[1-9][0-9]*:m[1-9][0-9]*|third)$'
               or m0.entry_a_id is null or m0.entry_b_id is null
               or m0.player_a_id is not null or m0.player_b_id is not null
               or m0.winner_player_id is not null
               or (m0.winner_entry_id is not null
                   and m0.winner_entry_id not in (m0.entry_a_id, m0.entry_b_id))
               or not exists (
                   select 1 from ypl_schema_validation.bracket_identity_changes c0
                    where c0.bracket_runtime_id = p_runtime_id
                      and c0.event_id = p_event_id
                      and c0.entry_id = m0.entry_a_id)
               or not exists (
                   select 1 from ypl_schema_validation.bracket_identity_changes c1
                    where c1.bracket_runtime_id = p_runtime_id
                      and c1.event_id = p_event_id
                      and c1.entry_id = m0.entry_b_id))
    ) then
        raise exception using errcode = 'P0001', message = 'runtime Match shape가 Single canonical Match contract와 다릅니다.';
    end if;

    -- Snapshot ownership before deleting the FK parent metadata.
    delete from ypl_schema_validation.matches as m0
     where m0.event_id = p_event_id and m0.source = 'normalized_bracket_runtime';
    get diagnostics v_deleted_matches = row_count;

    delete from ypl_schema_validation.bracket_entry_slots as bes0
     where bes0.bracket_runtime_id = p_runtime_id and bes0.event_id = p_event_id;
    get diagnostics v_deleted_slots = row_count;

    delete from ypl_schema_validation.bracket_identity_changes as bic0
     where bic0.bracket_runtime_id = p_runtime_id and bic0.event_id = p_event_id;
    get diagnostics v_deleted_identities = row_count;
    if v_deleted_identities <> v_identity_count then
        raise exception using errcode = 'P0001', message = 'ownership metadata 삭제 수가 예상과 다릅니다.';
    end if;

    for v_change in
        select *
          from jsonb_to_recordset(v_identity_snapshot) as c(
              entry_participant_id uuid, entry_id uuid, registration_id uuid,
              player_id uuid, player_was_created boolean,
              registration_was_created boolean, registration_player_was_changed boolean,
              previous_registration_player_id uuid, entry_was_created boolean,
              entry_participant_was_created boolean
          )
    loop
        delete from ypl_schema_validation.entry_participants as ep0
         where id = v_change.entry_participant_id
           and ep0.event_id = p_event_id
           and ep0.entry_id = v_change.entry_id
           and ep0.registration_id = v_change.registration_id
           and ep0.player_id = v_change.player_id;
        get diagnostics v_deleted = row_count;
        if v_deleted <> 1 then
            raise exception using errcode = 'P0001', message = 'EntryParticipant exact deletion ownership이 일치하지 않습니다.';
        end if;
    end loop;

    for v_change in
        select *
          from jsonb_to_recordset(v_identity_snapshot) as c(
              entry_participant_id uuid, entry_id uuid, registration_id uuid,
              player_id uuid, player_was_created boolean,
              registration_was_created boolean, registration_player_was_changed boolean,
              previous_registration_player_id uuid, entry_was_created boolean,
              entry_participant_was_created boolean
          )
    loop
        if v_change.entry_was_created then
            delete from ypl_schema_validation.entries as e0
             where e0.id = v_change.entry_id
               and e0.event_id = p_event_id;
            get diagnostics v_deleted = row_count;
            if v_deleted <> 1 then
                raise exception using errcode = 'P0001', message = 'Entry exact deletion ownership이 일치하지 않습니다.';
            end if;
        end if;
    end loop;

    for v_change in
        select *
          from jsonb_to_recordset(v_identity_snapshot) as c(
              entry_participant_id uuid, entry_id uuid, registration_id uuid,
              player_id uuid, player_was_created boolean,
              registration_was_created boolean, registration_player_was_changed boolean,
              previous_registration_player_id uuid, entry_was_created boolean,
              entry_participant_was_created boolean
          )
    loop
        if v_change.registration_was_created
           and not exists (
               select 1
                 from ypl_schema_validation.event_registrations durable_registration
                where durable_registration.id = v_change.registration_id
                  and durable_registration.event_id = p_event_id
                  and (
                    durable_registration.final_submission_id is not null
                    or exists (
                      select 1
                        from ypl_schema_validation.registration_submissions durable_submission
                       where durable_submission.registration_id = durable_registration.id
                    )
                  )
           ) then
            delete from ypl_schema_validation.event_registrations as er0
             where er0.id = v_change.registration_id
               and er0.event_id = p_event_id
               and er0.player_id = v_change.player_id;
            get diagnostics v_deleted = row_count;
            if v_deleted <> 1 then
                raise exception using errcode = 'P0001', message = 'Registration 삭제 ownership이 일치하지 않습니다.';
            end if;
        elsif v_change.registration_player_was_changed
          and not exists (
              select 1
                from ypl_schema_validation.event_registrations durable_registration
               where durable_registration.id = v_change.registration_id
                 and durable_registration.event_id = p_event_id
                 and (
                   durable_registration.final_submission_id is not null
                   or exists (
                     select 1
                       from ypl_schema_validation.registration_submissions durable_submission
                      where durable_submission.registration_id = durable_registration.id
                   )
                 )
          ) then
            update ypl_schema_validation.event_registrations as er0
               set player_id = v_change.previous_registration_player_id,
                   updated_at = now()
             where er0.id = v_change.registration_id
               and er0.event_id = p_event_id
               and er0.player_id = v_change.player_id;
            get diagnostics v_deleted = row_count;
            if v_deleted <> 1 then
                raise exception using errcode = 'P0001', message = 'Registration restore ownership이 일치하지 않습니다.';
            end if;
        end if;
    end loop;

    delete from ypl_schema_validation.players as p0
     where p0.id in (
         select distinct c.player_id
           from jsonb_to_recordset(v_identity_snapshot) as c(
               entry_participant_id uuid, entry_id uuid, registration_id uuid,
               player_id uuid, player_was_created boolean,
               registration_was_created boolean, registration_player_was_changed boolean,
               previous_registration_player_id uuid, entry_was_created boolean,
               entry_participant_was_created boolean
           )
          where c.player_was_created
     )
       and not exists (
           select 1 from ypl_schema_validation.event_registrations er0
            where er0.player_id = p0.id
       )
       and not exists (
           select 1 from ypl_schema_validation.entry_participants ep0
            where ep0.player_id = p0.id
       )
       and not exists (
           select 1 from ypl_schema_validation.matches m0
            where m0.player_a_id = p0.id
               or m0.player_b_id = p0.id
               or m0.winner_player_id = p0.id
       )
       and not exists (
           select 1 from ypl_schema_validation.ranking_awards ra0
            where ra0.player_id = p0.id
       )
       and not exists (
           select 1 from ypl_schema_validation.hall_of_fame_entries hof0
            where hof0.player_id = p0.id
       );

    delete from ypl_schema_validation.bracket_runtimes as br0
     where br0.id = p_runtime_id and br0.event_id = p_event_id;
    get diagnostics v_deleted = row_count;
    if v_deleted <> 1 then
        raise exception using errcode = 'P0001', message = 'runtime exact deletion ownership이 일치하지 않습니다.';
    end if;

    update ypl_schema_validation.events
       set status = v_runtime.previous_event_status, updated_at = now()
     where id = p_event_id;
    get diagnostics v_deleted = row_count;
    if v_deleted <> 1 then
        raise exception using errcode = 'P0001', message = 'Event previous status 복구에 실패했습니다.';
    end if;

    return query select p_runtime_id, p_event_id, v_deleted_matches,
                        v_deleted_slots, v_deleted_identities,
                        v_runtime.previous_event_status;
end;
$$;

-- 6. 조별 뒤 본선의 기록 반영 검사: 결정된 본선 경기 수에서 3위전을 빼고, 3위전이 있으면 그것도 끝나야 한다(나머지는 group_brackets_and_rookie_candidates.sql 그대로)
create or replace function ypl_schema_validation.guard_group_record_apply()
returns trigger language plpgsql security invoker set search_path='' as $$
declare rt ypl_schema_validation.bracket_runtimes%rowtype; final_winner uuid;
begin
  if new.record_applied_at is null or old.record_applied_at is not null then return new; end if;
  select * into rt from ypl_schema_validation.bracket_runtimes where event_id=new.id and topology_kind='groups_then_elimination';
  if not found then return new; end if;
  if rt.group_final_format='single_elimination' then
    select winner_entry_id into final_winner from ypl_schema_validation.matches where event_id=new.id
      and source='normalized_bracket_runtime' and source_node_key ~ '^single:r[1-9][0-9]*:m[1-9][0-9]*$'
      order by round_number desc nulls last,sequence_no desc limit 1;
    if (select count(*) from ypl_schema_validation.matches where event_id=new.id and source='normalized_bracket_runtime'
        and source_node_key ~ '^single:r' and winner_entry_id is not null) <>
        (select count(*)-1 from ypl_schema_validation.bracket_entry_slots where bracket_runtime_id=rt.id and stage_kind='elimination') then
      final_winner:=null;
    end if;
    -- 3위 결정전이 있는 본선은 그 경기도 끝나야 한다(third_place_best_of.sql)
    if rt.third_place and not exists(select 1 from ypl_schema_validation.matches where event_id=new.id and source='normalized_bracket_runtime'
        and source_node_key='single:third' and winner_entry_id is not null) then
      final_winner:=null;
    end if;
  else
    select case when winner_entry_id=entry_a_id then winner_entry_id
      else (select reset.winner_entry_id from ypl_schema_validation.matches reset where reset.event_id=new.id
         and reset.source='normalized_bracket_runtime' and reset.source_node_key='double:reset:m1') end
      into final_winner from ypl_schema_validation.matches where event_id=new.id and source='normalized_bracket_runtime'
        and source_node_key='double:gf:m1' and winner_entry_id is not null;
  end if;
  if final_winner is null or not exists(select 1 from ypl_schema_validation.results where event_id=new.id
    and source='normalized_bracket_runtime' and placement_code='champion' and entry_id=final_winner) then
    raise exception '본선 우승자가 확정된 뒤 기록을 반영할 수 있습니다.';
  end if;
  return new;
end $$;

-- 7. 점수와 불참 RPC: match_outcome_more.sql 의 본문에 N선승 검사 하나를 더했다
create or replace function ypl_schema_validation.set_normalized_match_outcome(
    p_event_id uuid,
    p_source_node_key text,
    p_score_a smallint default null,
    p_score_b smallint default null,
    p_forfeit boolean default false
)
returns table (
    outcome_match_id uuid,
    outcome_score_a smallint,
    outcome_score_b smallint,
    outcome_resolution text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_event ypl_schema_validation.events%rowtype;
    v_match ypl_schema_validation.matches%rowtype;
    v_forfeit boolean := coalesce(p_forfeit, false);
    v_resolution text;
begin
    if p_event_id is null or p_source_node_key is null then
        raise exception using errcode = 'P0001', message = '대회와 경기가 필요합니다.';
    end if;

    -- the winner RPC and the sync lock the Event first; so does this
    select * into v_event
      from ypl_schema_validation.events as e
     where e.id = p_event_id
     for update;
    if not found then
        raise exception using errcode = 'P0001', message = '대회를 찾을 수 없습니다.';
    end if;
    if v_event.status <> 'running' or v_event.record_applied_at is not null then
        raise exception using errcode = 'P0001', message = '진행 중인 대회의 경기에만 점수와 불참을 남길 수 있습니다.';
    end if;
    -- 팀전의 점수는 세부 경기(team_bout, ace)에서 세므로 팀 경기에는 불참만 남긴다
    if v_event.is_team_event and p_score_a is not null then
        raise exception using errcode = 'P0001', message = '팀전 경기의 점수는 세부 경기에서 셉니다.';
    end if;
    if exists (select 1 from ypl_schema_validation.results as r where r.event_id = p_event_id)
       or exists (select 1 from ypl_schema_validation.ranking_awards as a where a.event_id = p_event_id) then
        raise exception using errcode = 'P0001', message = '결과가 정리된 대회의 경기는 바꿀 수 없습니다.';
    end if;

    select * into v_match
      from ypl_schema_validation.matches as m
     where m.event_id = p_event_id
       and m.source = 'normalized_bracket_runtime'
       and m.source_node_key = p_source_node_key
       and m.match_kind = 'bracket'
     for update;
    if not found then
        raise exception using errcode = 'P0001', message = '이 경기를 찾을 수 없습니다.';
    end if;
    if v_match.entry_a_id is null or v_match.entry_b_id is null or v_match.winner_entry_id is null then
        raise exception using errcode = 'P0001', message = '승자를 먼저 정해야 점수와 불참을 남길 수 있습니다.';
    end if;

    if (p_score_a is null) <> (p_score_b is null) then
        raise exception using errcode = 'P0001', message = '두 선수의 점수를 함께 넣어야 합니다.';
    end if;
    if p_score_a is not null then
        if v_forfeit then
            raise exception using errcode = 'P0001', message = '불참한 경기에는 점수를 남기지 않습니다.';
        end if;
        if p_score_a not between 0 and 99 or p_score_b not between 0 and 99 then
            raise exception using errcode = 'P0001', message = '점수는 0에서 99 사이여야 합니다.';
        end if;
        if (v_match.winner_entry_id = v_match.entry_a_id and p_score_a <= p_score_b)
           or (v_match.winner_entry_id = v_match.entry_b_id and p_score_b <= p_score_a) then
            raise exception using errcode = 'P0001', message = '이긴 선수의 점수가 더 커야 합니다.';
        end if;
        -- N선승 (third_place_best_of.sql): the winner's score is the wins the match asked for
        if exists (select 1 from ypl_schema_validation.bracket_runtimes r where r.event_id = p_event_id
                     and greatest(r.wins_to, r.final_wins_to) > 1
                     and greatest(p_score_a, p_score_b) not in (r.wins_to, r.final_wins_to)) then
            raise exception using errcode = 'P0001', message = '이긴 선수의 점수는 이 경기의 선승 수와 같아야 합니다.';
        end if;
    end if;

    v_resolution := case when v_forfeit then 'forfeit' else 'played' end;
    update ypl_schema_validation.matches as m
       set score_a = p_score_a,
           score_b = p_score_b,
           resolution = v_resolution,
           updated_at = now()
     where m.id = v_match.id
       and m.event_id = p_event_id;

    return query select v_match.id, p_score_a, p_score_b, v_resolution;
end;
$$;
revoke all on function ypl_schema_validation.set_normalized_match_outcome(uuid, text, smallint, smallint, boolean) from public;
revoke all on function ypl_schema_validation.set_normalized_match_outcome(uuid, text, smallint, smallint, boolean) from anon, service_role;
grant execute on function ypl_schema_validation.set_normalized_match_outcome(uuid, text, smallint, smallint, boolean) to authenticated;

-- 8. 배틀이 대진표에 들어간 순간(match_outcome_more.sql 의 트리거 함수를 대신한다): 그 경기를 이 두 출전이 배틀로 두 판 넘게
--    치렀으면(다전제) 끝난 배틀의 승수를 점수로 남기고, 한 판이면 지금처럼 기권과 시간 초과를 불참(forfeit)으로 남긴다.
create or replace function public.battle_applied_mark_forfeit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match ypl_schema_validation.matches%rowtype;
  v_a integer;
  v_b integer;
begin
  select * into v_match from ypl_schema_validation.matches m
   where m.event_id = new.event_id and m.source = 'normalized_bracket_runtime' and m.source_node_key = new.source_node_key;
  if not found or v_match.entry_a_id is null or v_match.entry_b_id is null then return null; end if;
  select count(*) filter (where (b.winner = 'p1' and b.p1_entry_id = v_match.entry_a_id) or (b.winner = 'p2' and b.p2_entry_id = v_match.entry_a_id)),
         count(*) filter (where (b.winner = 'p1' and b.p1_entry_id = v_match.entry_b_id) or (b.winner = 'p2' and b.p2_entry_id = v_match.entry_b_id))
    into v_a, v_b
    from public.battles b
   where b.kind = 'official' and b.event_id = new.event_id and b.source_node_key = new.source_node_key and b.status = 'ended'
     and coalesce(b.ended_by, '') <> 'void' and b.winner in ('p1', 'p2')
     and array[b.p1_entry_id, b.p2_entry_id] <@ array[v_match.entry_a_id, v_match.entry_b_id];
  if v_a + v_b > 1 and v_match.winner_entry_id is not null then
    update ypl_schema_validation.matches m set score_a = least(v_a, 99), score_b = least(v_b, 99), updated_at = now() where m.id = v_match.id;
  elsif new.ended_by in ('forfeit', 'timeout') then
    update ypl_schema_validation.matches m
       set resolution = 'forfeit', score_a = null, score_b = null, updated_at = now()
     where m.id = v_match.id and (m.winner_entry_id is not null or m.winner_player_id is not null) and m.resolution = 'played';
  end if;
  return null;
end;
$$;
revoke all on function public.battle_applied_mark_forfeit() from public, anon, authenticated;
drop trigger if exists battle_applied_mark_forfeit on public.battles;
create trigger battle_applied_mark_forfeit
  after update of applied_at on public.battles
  for each row
  when (old.applied_at is null and new.applied_at is not null and new.kind = 'official')
  execute function public.battle_applied_mark_forfeit();

-- 9. 실행 여부
create or replace function public.bracket_rules_ready()
returns boolean language sql stable set search_path = '' as $$ select true $$;
revoke all on function public.bracket_rules_ready() from public;
grant execute on function public.bracket_rules_ready() to anon, authenticated;

commit;

notify pgrst, 'reload schema';
