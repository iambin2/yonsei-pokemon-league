-- 점수와 불참을 조별리그와 팀전까지, 그리고 사이트 배틀의 기권과 시간 초과를 대진표 경기에. match_outcome.sql 뒤에 통째로 한 번 실행한다.
-- 다시 실행해도 안전하다. 사이트는 이 파일 전에도 지금처럼 동작한다(팀전의 불참 단추만 보이지 않는다).
--
-- 바뀌는 것은 셋이다.
--   1. set_normalized_match_outcome: 팀전 대회의 경기에도 불참을 남긴다(점수는 세부 경기에서 세므로 팀 경기에는 받지 않는다).
--      조별리그와 순위 결정전, 본선 경기는 이미 같은 표의 bracket 경기라 함수가 그대로 받는다(화면만 열렸다).
--   2. match_outcome_more_ready(): 사이트가 이 파일이 실행되었는지 묻는 함수. true 만 돌려준다.
--   3. 공식 배틀이 기권(forfeit)이나 시간 초과(timeout)로 끝나 대진표에 들어가면(battles.applied_at 이 처음 채워지면) 그 경기를
--      resolution 'forfeit' 로 남기는 트리거. 승자는 배틀이 정한 그대로이고, 배틀 함수(battle_apply_result)는 바꾸지 않는다.
--
-- 지키는 것: 승자, 대진, Result, RankingAward 는 이 파일이 쓰지 않는다.

begin;

-- 1. 점수와 불참을 남기는 RPC (match_outcome.sql 의 본문에서 팀전 거절만 다르다)
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

-- 2. 실행 여부
create or replace function ypl_schema_validation.match_outcome_more_ready()
returns boolean language sql stable set search_path = '' as $$ select true $$;
revoke all on function ypl_schema_validation.match_outcome_more_ready() from public;
grant execute on function ypl_schema_validation.match_outcome_more_ready() to authenticated;

-- 3. 배틀의 기권과 시간 초과
create or replace function public.battle_applied_mark_forfeit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update ypl_schema_validation.matches as m
     set resolution = 'forfeit', score_a = null, score_b = null, updated_at = now()
   where m.event_id = new.event_id
     and m.source = 'normalized_bracket_runtime'
     and m.source_node_key = new.source_node_key
     and (m.winner_entry_id is not null or m.winner_player_id is not null)
     and m.resolution = 'played';
  return null;
end;
$$;
revoke all on function public.battle_applied_mark_forfeit() from public, anon, authenticated;

drop trigger if exists battle_applied_mark_forfeit on public.battles;
create trigger battle_applied_mark_forfeit
  after update of applied_at on public.battles
  for each row
  when (old.applied_at is null and new.applied_at is not null and new.kind = 'official' and new.ended_by in ('forfeit', 'timeout'))
  execute function public.battle_applied_mark_forfeit();

commit;

notify pgrst, 'reload schema';
