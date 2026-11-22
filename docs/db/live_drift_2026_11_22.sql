-- 운영 DB에서 직접 고쳐져 저장소의 어느 SQL 파일과도 본문이 달랐던 함수 7개의 운영 정의 (2026-11-22, pg_get_functiondef).
-- 이 파일로 저장소가 운영과 같아집니다. 운영에 다시 돌려도 아무것도 바뀌지 않습니다(같은 본문의 create or replace).
-- 대조 방법과 전체 장부: docs/db/README.md

-- battle_official_seat(uuid,text,text,text)
CREATE OR REPLACE FUNCTION public.battle_official_seat(p_event_id uuid, p_source_node_key text, p_side text, p_pin text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_event ypl_schema_validation.events%rowtype;
  v_match ypl_schema_validation.matches%rowtype;
  v_seat record;
  v_status text;
  v_submission uuid;
  v_team jsonb;
  v_alive integer;
  v_stale record;
begin
  select * into v_event from ypl_schema_validation.events e where e.id = p_event_id;
  if not found then return jsonb_build_object('status', 'no_event'); end if;
  if v_event.status <> 'running' or v_event.record_applied_at is not null or v_event.is_team_event then
    return jsonb_build_object('status', 'not_running');
  end if;
  select * into v_match from ypl_schema_validation.matches m
   where m.event_id = p_event_id and m.source = 'normalized_bracket_runtime' and m.match_kind = 'bracket'
     and m.source_node_key = p_source_node_key;
  if not found or v_match.entry_a_id is null or v_match.entry_b_id is null then
    return jsonb_build_object('status', 'not_formed');
  end if;
  if v_match.winner_entry_id is not null then return jsonb_build_object('status', 'decided'); end if;

  -- 선발전의 본선 진출 인원이 이미 찼으면 이 경기의 결과는 넣을 수 없다(championship_qualifier_match_stop_guard 와 같은 셈)
  if v_event.event_type = 'champions' and v_event.championship_phase = 'qualifier' then
    with entrants as (
      select s.entry_id from ypl_schema_validation.bracket_entry_slots s
        join ypl_schema_validation.bracket_runtimes br on br.id = s.bracket_runtime_id
       where br.event_id = p_event_id and br.topology_kind = v_event.competition_format
    ), losses as (
      select case when m.winner_entry_id = m.entry_a_id then m.entry_b_id else m.entry_a_id end as entry_id, count(*)::integer as loss_count
        from ypl_schema_validation.matches m
       where m.event_id = p_event_id and m.source = 'normalized_bracket_runtime' and m.match_kind = 'bracket'
         and m.winner_entry_id is not null and m.winner_entry_id in (m.entry_a_id, m.entry_b_id)
       group by 1
    )
    select count(*)::integer into v_alive from entrants e left join losses l on l.entry_id = e.entry_id where coalesce(l.loss_count, 0) < (case when v_event.competition_format='single_elimination' then 1 else 2 end);
    if v_alive > 0 and v_alive <= v_event.qualification_slots then return jsonb_build_object('status', 'qualifier_done'); end if;
  end if;

  if p_side not in ('a', 'b') then return jsonb_build_object('status', 'not_player'); end if;
  select p.entry_id, p.player_id, p.registration_id, r.final_submission_id, r.registration_name, p_side as side
    into v_seat
    from ypl_schema_validation.entry_participants p
    join ypl_schema_validation.event_registrations r on r.id = p.registration_id
   where p.event_id = p_event_id and p.entry_id = case p_side when 'a' then v_match.entry_a_id else v_match.entry_b_id end;
  if not found then return jsonb_build_object('status', 'not_player'); end if;

  v_status := public.visitor_pin_check('submission', v_seat.registration_id::text, p_pin);
  if v_status <> 'ok' then return jsonb_build_object('status', v_status); end if;

  -- 이 자리에 열린 배틀이 지금 경기의 선수들 것이 아니면(운영진이 앞 경기를 바꿨다) 닫는다. 그 배틀은 결과를 넣을 수 없다.
  for v_stale in
    select b.id from public.battles b
     where b.kind = 'official' and b.event_id = p_event_id and b.source_node_key = p_source_node_key and b.status in ('waiting', 'active')
       and not (b.p1_entry_id in (v_match.entry_a_id, v_match.entry_b_id)
                and (b.p2_entry_id is null or b.p2_entry_id in (v_match.entry_a_id, v_match.entry_b_id)))
  loop
    perform public.battle_void_now(v_stale.id, '대진이 바뀌어 이 경기의 배틀이 아니게 되었습니다.');
  end loop;

  v_submission := coalesce(v_seat.final_submission_id, (
    select s.id from ypl_schema_validation.registration_submissions s
     where s.registration_id = v_seat.registration_id order by s.revision desc limit 1));
  if v_submission is null then return jsonb_build_object('status', 'no_team'); end if;
  select jsonb_agg(jsonb_build_object(
           'pokemonId', m.pokemon_id, 'pokemonName', m.pokemon_name_snapshot, 'ability', m.ability_id, 'nature', m.nature_id,
           'item', m.item_id, 'moves', jsonb_build_array(m.move_1_id, m.move_2_id, m.move_3_id, m.move_4_id),
           'statPoints', jsonb_build_object('hp', m.stat_hp, 'atk', m.stat_atk, 'def', m.stat_def, 'spa', m.stat_spa, 'spd', m.stat_spd, 'spe', m.stat_spe)
         ) order by m.slot)
    into v_team
    from ypl_schema_validation.registration_submissions s
    join ypl_schema_validation.team_snapshot_members m on m.snapshot_id = s.snapshot_id
   where s.id = v_submission;
  if v_team is null then return jsonb_build_object('status', 'no_team'); end if;

  return jsonb_build_object(
    'status', 'ok', 'side', v_seat.side, 'entryId', v_seat.entry_id, 'playerId', v_seat.player_id,
    'registrationName', v_seat.registration_name, 'team', v_team,
    'regulation', v_event.regulation_id, 'battleFormat', v_event.battle_format, 'eventName', v_event.name);
end;
$function$;

-- ypl_schema_validation.championship_qualifier_match_stop_guard()
CREATE OR REPLACE FUNCTION ypl_schema_validation.championship_qualifier_match_stop_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
    v_event ypl_schema_validation.events%rowtype;
    v_runtime_id uuid;
    v_alive_count integer;
begin
    if new.source <> 'normalized_bracket_runtime' or new.match_kind <> 'bracket' then
        return new;
    end if;
    select * into v_event
      from ypl_schema_validation.events e
     where e.id = new.event_id
       and e.event_type = 'champions'
       and e.championship_phase = 'qualifier'
     for update;
    if not found then
        return new;
    end if;
    if v_event.status = 'completed' and tg_op = 'UPDATE'
       and new.winner_entry_id is distinct from old.winner_entry_id then
        raise exception using errcode = 'P0001', message = '종료된 선발전의 경기 결과는 먼저 종료 취소 후 수정해야 합니다.';
    end if;
    if v_event.status not in ('open', 'running') then
        return new;
    end if;
    select br.id into v_runtime_id
      from ypl_schema_validation.bracket_runtimes br
     where br.event_id = v_event.id
       and br.topology_kind = v_event.competition_format;
    if v_runtime_id is null then
        return new;
    end if;
    with entrants as (
        select s.entry_id
          from ypl_schema_validation.bracket_entry_slots s
         where s.bracket_runtime_id = v_runtime_id
    ), losses as (
        select case when m.winner_entry_id = m.entry_a_id then m.entry_b_id else m.entry_a_id end as entry_id,
               count(*)::integer as loss_count
          from ypl_schema_validation.matches m
         where m.event_id = v_event.id
           and m.source = 'normalized_bracket_runtime'
           and m.match_kind = 'bracket'
           and m.winner_entry_id is not null
           and m.winner_entry_id in (m.entry_a_id, m.entry_b_id)
         group by 1
    )
    select count(*)::integer into v_alive_count
      from entrants e left join losses l on l.entry_id = e.entry_id
     where coalesce(l.loss_count, 0) < (case when v_event.competition_format='single_elimination' then 1 else 2 end);

    if v_alive_count <= v_event.qualification_slots
       and (
           tg_op = 'INSERT'
           or (tg_op = 'UPDATE' and old.winner_entry_id is null and new.winner_entry_id is not null)
       ) then
        if tg_op='INSERT' then return null; end if; raise exception using errcode = 'P0001', message = '본선 진출 인원이 확정되어 선발전 경기를 더 진행할 수 없습니다.';
    end if;
    return new;
end;
$function$;

-- ypl_schema_validation.create_championship_advancement(uuid,uuid,uuid,uuid,text,uuid,text)
CREATE OR REPLACE FUNCTION ypl_schema_validation.create_championship_advancement(p_advancement_id uuid, p_registration_id uuid, p_final_event_id uuid, p_player_id uuid, p_advancement_type text, p_source_entry_id uuid, p_reason text)
 RETURNS TABLE(advancement_id uuid, registration_id uuid)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
    v_final ypl_schema_validation.events%rowtype;
    v_qualifier ypl_schema_validation.events%rowtype;
    v_player ypl_schema_validation.players%rowtype;
    v_capacity integer;
    v_generation integer;
    v_count integer;
    v_qualifier_count integer;
    v_ranking_count integer;
begin
    if p_advancement_id is null or p_registration_id is null
       or p_final_event_id is null or p_player_id is null
       or p_advancement_type not in ('ranking', 'qualifier', 'manual') then
        raise exception using errcode = 'P0001', message = 'Champions advancement identity와 source가 필요합니다.';
    end if;
    if p_advancement_type in ('qualifier', 'ranking') then
        raise exception using errcode = 'P0001', message = '직행/qualifier advancement는 Qualifier 기록 반영 RPC에서만 생성할 수 있습니다.';
    end if;
    if (p_advancement_type = 'qualifier') <> (p_source_entry_id is not null) then
        raise exception using errcode = 'P0001', message = 'qualifier advancement만 source Entry를 가져야 합니다.';
    end if;

    select * into v_final from ypl_schema_validation.events e
     where e.id = p_final_event_id for update;
    if not found or v_final.event_type <> 'champions'
       or v_final.championship_phase <> 'final'
       or coalesce(v_final.competition_format,'single_elimination') not in ('single_elimination','double_elimination')
       or v_final.status <> 'open' or v_final.record_applied_at is not null then
        raise exception using errcode = 'P0001', message = '현재 Final Event에는 advancement를 만들 수 없습니다.';
    end if;
    select * into v_player from ypl_schema_validation.players p
     where p.id = p_player_id and p.status <> 'inactive';
    if not found then
        raise exception using errcode = 'P0001', message = 'advancement Player를 찾을 수 없습니다.';
    end if;

    v_capacity := (v_final.competition_settings #>> '{championship,finalCapacity}')::integer;
    v_generation := (v_final.competition_settings #>> '{championship,generation}')::integer;
    if v_capacity is null or v_capacity < 2 or v_generation is null or v_generation < 1 then
        raise exception using errcode = 'P0001', message = 'Final capacity 또는 generation 설정이 없습니다.';
    end if;
    select * into v_qualifier from ypl_schema_validation.events e
     where e.championship_final_event_id = p_final_event_id
       and e.event_type = 'champions' and e.championship_phase = 'qualifier'
     for update;
    if not found or v_qualifier.status <> 'completed' or v_qualifier.qualification_slots is null then
        raise exception using errcode = 'P0001', message = '선발전 기록 반영 완료 후에만 본선 수동 참가자를 추가할 수 있습니다.';
    end if;
    select (count(*) filter (where ca.advancement_type = 'qualifier'))::integer,
           (count(*) filter (where ca.advancement_type = 'ranking'))::integer
      into v_qualifier_count, v_ranking_count
      from ypl_schema_validation.championship_advancements ca
      join ypl_schema_validation.event_registrations r on r.id = ca.final_registration_id
     where r.event_id = p_final_event_id;
    if v_qualifier_count <> v_qualifier.qualification_slots
       or v_ranking_count <> v_capacity - v_qualifier.qualification_slots then
        raise exception using errcode = 'P0001', message = '직행/선발전 통과 Final entrant set이 확정되지 않았습니다.';
    end if;
    select count(*)::integer into v_count
      from ypl_schema_validation.championship_advancements ca
      join ypl_schema_validation.event_registrations r on r.id = ca.final_registration_id
     where r.event_id = p_final_event_id;
    if exists (select 1 from ypl_schema_validation.event_registrations r where r.event_id = p_final_event_id and r.player_id = p_player_id) then
        raise exception using errcode = 'P0001', message = '이미 본선에 등록된 Player입니다.';
    end if;

    if p_advancement_type = 'qualifier' then
        select * into v_qualifier from ypl_schema_validation.events e
         where e.championship_final_event_id = p_final_event_id
           and e.event_type = 'champions' and e.championship_phase = 'qualifier';
        if not found then
            raise exception using errcode = 'P0001', message = '연결된 Qualifier Event를 찾을 수 없습니다.';
        end if;
        if not exists (
            select 1 from ypl_schema_validation.entries e
            join ypl_schema_validation.entry_participants ep on ep.entry_id = e.id and ep.event_id = e.event_id
            where e.id = p_source_entry_id and e.event_id = v_qualifier.id
              and e.entry_type = 'individual' and e.status = 'active'
              and ep.player_id = p_player_id and ep.member_order = 1
        ) then
            raise exception using errcode = 'P0001', message = 'Qualifier Entry와 Player identity가 일치하지 않습니다.';
        end if;
        select count(*)::integer into v_count
          from ypl_schema_validation.championship_advancements ca
          join ypl_schema_validation.event_registrations r on r.id = ca.final_registration_id
         where r.event_id = p_final_event_id and ca.advancement_type = 'qualifier';
        if v_count >= v_qualifier.qualification_slots then
            raise exception using errcode = 'P0001', message = 'Qualifier 진출 인원이 이미 모두 확정되었습니다.';
        end if;
    end if;

    insert into ypl_schema_validation.event_registrations (
        id, event_id, player_id, registration_name, registration_data,
        registration_source, registered_at, updated_at
    ) values (
        p_registration_id, p_final_event_id, p_player_id, v_player.display_name,
        jsonb_build_object('champions', jsonb_build_object(
            'generation', v_generation,
            'source', p_advancement_type,
            'reason', nullif(btrim(coalesce(p_reason, '')), '')
        )),
        'advancement', now(), now()
    );
    insert into ypl_schema_validation.championship_advancements (
        id, final_registration_id, source_entry_id, advancement_type, reason
    ) values (
        p_advancement_id, p_registration_id, p_source_entry_id,
        p_advancement_type, nullif(btrim(coalesce(p_reason, '')), '')
    );
    return query select p_advancement_id, p_registration_id;
end;
$function$;

-- ypl_schema_validation.delete_normalized_bracket_runtime(uuid,uuid)
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
                or (v_runtime.topology_kind = 'groups_then_elimination' and m.source_node_key !~ '^((group|playoff):g[1-9][0-9]*:m[1-9][0-9]*|single:r[1-9][0-9]*:m[1-9][0-9]*|double:((w|l):r[1-9][0-9]*:m[1-9][0-9]*|(gf|reset):m1))$') or (v_runtime.topology_kind = 'single_elimination' and m.source_node_key !~ '^single:r[1-9][0-9]*:m[1-9][0-9]*$')
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

-- ypl_schema_validation.finalize_championship_qualifier(uuid)
CREATE OR REPLACE FUNCTION ypl_schema_validation.finalize_championship_qualifier(p_qualifier_event_id uuid)
 RETURNS TABLE(qualifier_event_id uuid, final_event_id uuid, alive_entry_ids uuid[], qualifier_advancement_count integer, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare q ypl_schema_validation.events%rowtype; f ypl_schema_validation.events%rowtype; rt uuid;
  capacity integer; direct_count integer; alive_count integer; entrant_count integer; direct record; survivor record; pid uuid; pname text; rid uuid; alive_ids uuid[];
begin
 select * into q from ypl_schema_validation.events e where e.id=p_qualifier_event_id for update;
 if not found or q.event_type<>'champions' or q.championship_phase<>'qualifier' or q.championship_final_event_id is null then raise exception using errcode='P0001',message='canonical Qualifier Event를 찾을 수 없습니다.';end if;
 select * into f from ypl_schema_validation.events e where e.id=q.championship_final_event_id for update;
 if not found or f.championship_phase<>'final' or f.status<>'open' then raise exception using errcode='P0001',message='연결된 Final Event 상태가 올바르지 않습니다.';end if;
 capacity:=(f.competition_settings #>> '{championship,finalCapacity}')::integer;
 select count(*) into direct_count from ypl_schema_validation.championship_qualifier_direct_selections d where d.qualifier_event_id=q.id;
 if capacity is null or direct_count>=capacity or q.qualification_slots is distinct from capacity-direct_count then raise exception using errcode='P0001',message='직행자/qualification_slots derived state가 올바르지 않습니다.';end if;
 select id into rt from ypl_schema_validation.bracket_runtimes where event_id=q.id and topology_kind=q.competition_format;
 if rt is null then raise exception using errcode='P0001',message='Qualifier normalized runtime이 필요합니다.';end if;
 with entrants as (select e.id from ypl_schema_validation.entries e join ypl_schema_validation.bracket_entry_slots s on s.entry_id=e.id where e.event_id=q.id and e.status='active' and s.bracket_runtime_id=rt), losses as (select case when m.winner_entry_id=m.entry_a_id then m.entry_b_id else m.entry_a_id end id,count(*) n from ypl_schema_validation.matches m where m.event_id=q.id and m.source='normalized_bracket_runtime' and m.match_kind='bracket' and m.winner_entry_id is not null group by 1) select array_agg(e.id order by e.id),count(*) into alive_ids,alive_count from entrants e left join losses l on l.id=e.id where coalesce(l.n,0)<(case when q.competition_format='single_elimination' then 1 else 2 end);
 select count(*) into entrant_count from ypl_schema_validation.bracket_entry_slots where bracket_runtime_id=rt;
 if entrant_count<q.qualification_slots or alive_count<>q.qualification_slots or entrant_count-alive_count<>entrant_count-q.qualification_slots then raise exception using errcode='P0001',message='Match-derived survivor/elimination state가 선발전 목표와 일치하지 않습니다.';end if;
 if exists(select 1 from ypl_schema_validation.championship_advancements a join ypl_schema_validation.event_registrations r on r.id=a.final_registration_id where r.event_id=f.id) then
   if q.status='completed' then return query select q.id,f.id,alive_ids,alive_count,false;return;end if;
   raise exception using errcode='P0001',message='기존 Final advancement가 있어 안전하게 기록 반영할 수 없습니다.';
 end if;
 if q.status not in ('open','running') then raise exception using errcode='P0001',message='현재 Qualifier 상태에서는 기록 반영할 수 없습니다.';end if;
 for direct in select d.id,d.player_id,p.display_name from ypl_schema_validation.championship_qualifier_direct_selections d join ypl_schema_validation.players p on p.id=d.player_id and p.status<>'inactive' where d.qualifier_event_id=q.id order by d.id loop
   insert into ypl_schema_validation.event_registrations(event_id,player_id,registration_name,registration_data,registration_source,registered_at) values(f.id,direct.player_id,direct.display_name,jsonb_build_object('champions',jsonb_build_object('source','ranking')),'advancement',now()) returning id into rid;
   insert into ypl_schema_validation.championship_advancements(final_registration_id,source_entry_id,direct_selection_id,advancement_type) values(rid,null,direct.id,'ranking');
 end loop;
 for survivor in select e.id from ypl_schema_validation.entries e where e.id=any(alive_ids) order by e.id loop
   select ep.player_id,p.display_name into pid,pname from ypl_schema_validation.entry_participants ep join ypl_schema_validation.players p on p.id=ep.player_id and p.status<>'inactive' where ep.event_id=q.id and ep.entry_id=survivor.id and ep.member_order=1;
   if not found or exists(select 1 from ypl_schema_validation.event_registrations r where r.event_id=f.id and r.player_id=pid) then raise exception using errcode='P0001',message='direct/survivor Player identity가 중복되었거나 올바르지 않습니다.';end if;
   insert into ypl_schema_validation.event_registrations(event_id,player_id,registration_name,registration_data,registration_source,registered_at) values(f.id,pid,pname,jsonb_build_object('champions',jsonb_build_object('source','qualifier')),'advancement',now()) returning id into rid;
   insert into ypl_schema_validation.championship_advancements(final_registration_id,source_entry_id,advancement_type) values(rid,survivor.id,'qualifier');
 end loop;
 if (select count(*) from ypl_schema_validation.event_registrations where event_id=f.id)<>capacity then raise exception using errcode='P0001',message='Final entrant set이 finalCapacity와 정확히 일치하지 않습니다.';end if;
 update ypl_schema_validation.events set status='completed',updated_at=now() where id=q.id;
 delete from ypl_schema_validation.matches where event_id=q.id and source='normalized_bracket_runtime' and winner_entry_id is null;
 return query select q.id,f.id,alive_ids,alive_count,true;
end $function$;

-- ypl_schema_validation.save_championship_application_event_pair(uuid,uuid,uuid,text,text,integer,text,integer,integer,integer,text,text,jsonb,jsonb,jsonb,date,date,timestamp with time zone,timestamp with time zone)
CREATE OR REPLACE FUNCTION ypl_schema_validation.save_championship_application_event_pair(p_qualifier_event_id uuid, p_final_event_id uuid, p_season_id uuid, p_announcement_id text, p_base_name text, p_round_number integer, p_battle_format text, p_generation integer, p_final_capacity integer, p_qualification_slots integer, p_regulation_id text, p_cup_rule_id text, p_cup_rule_settings jsonb, p_registration_settings jsonb, p_competition_settings jsonb, p_qualifier_held_on date, p_final_held_on date, p_qualifier_submission_target_at timestamp with time zone, p_final_submission_target_at timestamp with time zone)
 RETURNS TABLE(qualifier_event_id uuid, final_event_id uuid, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
    v_qualifier ypl_schema_validation.events%rowtype;
    v_final ypl_schema_validation.events%rowtype;
    v_qualifier_exists boolean := false;
    v_final_exists boolean := false;
    v_settings jsonb;
    v_qualifier_registration_settings jsonb;
    v_critical_changed boolean := false;
begin
    if p_qualifier_event_id is null or p_final_event_id is null
       or p_qualifier_event_id = p_final_event_id or p_season_id is null
       or nullif(btrim(coalesce(p_announcement_id, '')), '') is null
       or nullif(btrim(coalesce(p_base_name, '')), '') is null then
        raise exception using errcode = 'P0001', message = 'Champions 공지와 Event pair identity가 필요합니다.';
    end if;
    if p_battle_format not in ('singles', 'doubles') then
        raise exception using errcode = 'P0001', message = 'Champions battle_format은 singles 또는 doubles여야 합니다.';
    end if;
    if p_generation is null or p_generation < 1
       or p_final_capacity is null or p_final_capacity < 2 then
        raise exception using errcode = 'P0001', message = 'generation과 final capacity가 올바르지 않습니다.';
    end if;
    if p_round_number is not null and p_round_number < 1 then
        raise exception using errcode = 'P0001', message = '회차 번호는 1 이상이어야 합니다.';
    end if;
    if not exists (select 1 from ypl_schema_validation.seasons s where s.id = p_season_id) then
        raise exception using errcode = 'P0001', message = 'Champions Event에 연결할 Season이 없습니다.';
    end if;

    perform pg_advisory_xact_lock(hashtextextended('championship-pair:' || p_qualifier_event_id::text, 0));
    perform pg_advisory_xact_lock(hashtextextended('championship-pair:' || p_final_event_id::text, 0));

    select * into v_qualifier from ypl_schema_validation.events e where e.id = p_qualifier_event_id for update;
    v_qualifier_exists := found;
    select * into v_final from ypl_schema_validation.events e where e.id = p_final_event_id for update;
    v_final_exists := found;

    if v_qualifier_exists <> v_final_exists then
        raise exception using errcode = 'P0001', message = 'Champions Event pair가 부분 생성 상태라 저장을 중단했습니다.';
    end if;

    v_settings := coalesce(p_competition_settings, '{}'::jsonb)
      || jsonb_build_object(
           'rankingEnabled', false,
           'championship', jsonb_build_object(
             'generation', p_generation,
             'finalCapacity', p_final_capacity
           )
         );
    v_qualifier_registration_settings := coalesce(p_registration_settings, '{}'::jsonb)
      || jsonb_build_object('announcementId', btrim(p_announcement_id));

    if not v_qualifier_exists then
        insert into ypl_schema_validation.events (
            id, season_id, name, round_number, event_type, division,
            battle_format, competition_format, competition_settings, is_team_event,
            regulation_id, cup_rule_id, cup_rule_settings, registration_settings,
            held_on, date_precision, status, submission_target_at,
            championship_phase, championship_final_event_id, qualification_slots
        ) values (
            p_final_event_id, p_season_id, btrim(p_base_name) || ' 본선', p_round_number,
            'champions', null, p_battle_format, null, v_settings, false,
            p_regulation_id, p_cup_rule_id, coalesce(p_cup_rule_settings, '{}'::jsonb),
            jsonb_strip_nulls(jsonb_build_object('competitionEditionId',p_registration_settings->'competitionEditionId')),
            p_final_held_on, case when p_final_held_on is null then 'unknown' else 'exact' end, 'open', p_final_submission_target_at,
            'final', null, null
        );
        insert into ypl_schema_validation.events (
            id, season_id, name, round_number, event_type, division,
            battle_format, competition_format, competition_settings, is_team_event,
            regulation_id, cup_rule_id, cup_rule_settings, registration_settings,
            held_on, date_precision, status, submission_target_at,
            championship_phase, championship_final_event_id, qualification_slots
        ) values (
            p_qualifier_event_id, p_season_id, btrim(p_base_name) || ' 선발전', p_round_number,
            'champions', null, p_battle_format, null, v_settings, false,
            p_regulation_id, p_cup_rule_id, coalesce(p_cup_rule_settings, '{}'::jsonb), v_qualifier_registration_settings,
            p_qualifier_held_on, case when p_qualifier_held_on is null then 'unknown' else 'exact' end, 'open', p_qualifier_submission_target_at,
            'qualifier', p_final_event_id, null
        );
        return query select p_qualifier_event_id, p_final_event_id, true;
        return;
    end if;

    if v_qualifier.event_type <> 'champions' or v_qualifier.championship_phase <> 'qualifier'
       or v_qualifier.championship_final_event_id <> p_final_event_id
       or v_final.event_type <> 'champions' or v_final.championship_phase <> 'final'
       or v_final.championship_final_event_id is not null then
        raise exception using errcode = 'P0001', message = '기존 Champions Qualifier/Final relation이 canonical pair와 다릅니다.';
    end if;

    v_critical_changed :=
        v_qualifier.battle_format is distinct from p_battle_format
        or v_final.battle_format is distinct from p_battle_format
        
        
        or (v_qualifier.competition_settings #>> '{championship,generation}')::integer is distinct from p_generation
        or (v_final.competition_settings #>> '{championship,generation}')::integer is distinct from p_generation
        or (v_final.competition_settings #>> '{championship,finalCapacity}')::integer is distinct from p_final_capacity;

    if v_critical_changed and (
        v_qualifier.status <> 'open' or v_final.status <> 'open'
        or exists (select 1 from ypl_schema_validation.event_registrations r where r.event_id in (p_qualifier_event_id, p_final_event_id))
        or exists (select 1 from ypl_schema_validation.entries e where e.event_id in (p_qualifier_event_id, p_final_event_id))
        or exists (select 1 from ypl_schema_validation.matches m where m.event_id in (p_qualifier_event_id, p_final_event_id))
        or exists (select 1 from ypl_schema_validation.bracket_runtimes br where br.event_id in (p_qualifier_event_id, p_final_event_id))
        or exists (
            select 1 from ypl_schema_validation.championship_advancements ca
            join ypl_schema_validation.event_registrations r on r.id = ca.final_registration_id
            where r.event_id = p_final_event_id
        )
    ) then
        raise exception using errcode = 'P0001', message = '참가/대진 runtime이 시작된 Champions pair의 핵심 설정은 수정할 수 없습니다.';
    end if;

    update ypl_schema_validation.events e set
        season_id = p_season_id,
        name = btrim(p_base_name) || ' 본선',
        round_number = p_round_number,
        division = null,
        battle_format = p_battle_format,
        competition_format = v_final.competition_format,
        competition_settings = v_settings,
        is_team_event = false,
        regulation_id = p_regulation_id,
        cup_rule_id = p_cup_rule_id,
        cup_rule_settings = coalesce(p_cup_rule_settings, '{}'::jsonb),
        held_on = p_final_held_on,
        date_precision = case when p_final_held_on is null then 'unknown' else 'exact' end,
        submission_target_at = p_final_submission_target_at,
        updated_at = now()
    where e.id = p_final_event_id;

    update ypl_schema_validation.events e set
        season_id = p_season_id,
        name = btrim(p_base_name) || ' 선발전',
        round_number = p_round_number,
        division = null,
        battle_format = p_battle_format,
        competition_format = v_qualifier.competition_format,
        competition_settings = v_settings,
        is_team_event = false,
        regulation_id = p_regulation_id,
        cup_rule_id = p_cup_rule_id,
        cup_rule_settings = coalesce(p_cup_rule_settings, '{}'::jsonb),
        registration_settings = v_qualifier_registration_settings,
        held_on = p_qualifier_held_on,
        date_precision = case when p_qualifier_held_on is null then 'unknown' else 'exact' end,
        submission_target_at = p_qualifier_submission_target_at,
        updated_at = now()
    where e.id = p_qualifier_event_id;

    return query select p_qualifier_event_id, p_final_event_id, false;
end;
$function$;

-- ypl_schema_validation.save_league_intake(text,uuid,uuid,jsonb)
CREATE OR REPLACE FUNCTION ypl_schema_validation.save_league_intake(p_announcement_id text, p_season_id uuid, p_existing_master_event_id uuid, p_settings jsonb)
 RETURNS ypl_schema_validation.league_intakes
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  g ypl_schema_validation.league_intakes%rowtype;
  old_master ypl_schema_validation.events%rowtype;
  old_rookie ypl_schema_validation.events%rowtype;
  mid uuid; rid uuid; gid uuid; d text; eid uuid; n integer; subtitle text; edition uuid;
  common jsonb; current_event ypl_schema_validation.events%rowtype;
  registration ypl_schema_validation.event_registrations%rowtype;
  resolved_player uuid; player_count integer; target uuid;
begin
  if not ypl_schema_validation.is_ypl_admin() then raise exception '관리자 권한이 필요합니다.'; end if;
  if nullif(btrim(p_announcement_id), '') is null or p_season_id is null
     or p_settings is null or jsonb_typeof(p_settings) <> 'object' then raise exception '공지와 시즌 설정이 필요합니다.'; end if;
  if coalesce(p_settings->>'battle_format','') not in ('singles','doubles')
      then
    raise exception '통합 접수의 배틀 형식과 토너먼트 방식을 선택해 주세요.';
  end if;
  subtitle := btrim(coalesce(p_settings->>'subtitle',''));
  if subtitle ~ '[|·•]' or subtitle ~ '(마스터|루키)리그' then raise exception '부제의 구분자와 리그 표기를 정리해 주세요.'; end if;
  -- Serialize pair creation and registration admission. No client-only uniqueness.
  perform pg_advisory_xact_lock(hashtextextended('league-intake:' || p_announcement_id, 0));
  select * into g from ypl_schema_validation.league_intakes where announcement_id = p_announcement_id for update;
  if found then
    mid := g.master_event_id; rid := g.rookie_event_id; gid := g.id;
    if p_existing_master_event_id is not null and p_existing_master_event_id <> mid then raise exception '기존 공지와 대회 연결이 일치하지 않습니다.'; end if;
    select * into old_master from ypl_schema_validation.events where id = mid for update;
    select * into old_rookie from ypl_schema_validation.events where id = rid for update;
    if old_master.season_id is distinct from old_rookie.season_id or old_master.division <> 'master' or old_rookie.division <> 'rookie'
       or old_master.is_team_event or old_rookie.is_team_event or old_master.event_type <> 'pokecup' or old_rookie.event_type <> 'pokecup' then
      raise exception '통합 접수의 리그별 대회 연결이 올바르지 않습니다.';
    end if;
    p_season_id := old_master.season_id;
  else
    gid := gen_random_uuid(); rid := gen_random_uuid(); mid := coalesce(p_existing_master_event_id, gen_random_uuid());
    if p_existing_master_event_id is not null then
      perform pg_advisory_xact_lock(hashtextextended('league-intake-event:' || mid::text,0));
      select * into old_master from ypl_schema_validation.events where id = mid for update;
      if not found or old_master.event_type <> 'pokecup' or old_master.division <> 'master' or old_master.is_team_event
         or old_master.status <> 'open' or old_master.record_applied_at is not null
         or old_master.registration_settings->>'announcementId' is distinct from p_announcement_id then
        raise exception '열린 개인 마스터 공지만 통합 접수로 전환할 수 있습니다.';
      end if;
      if ypl_schema_validation.league_intake_has_downstream(array[mid],true) then raise exception '기존 제출이나 참가, 대진표가 있어 통합 접수로 자동 전환할 수 없습니다.'; end if;
      if exists(select 1 from ypl_schema_validation.event_registrations where event_id=mid and final_submission_id is not null) then
        raise exception '공식 파티가 고정된 신청은 이동할 수 없습니다.';
      end if;
      p_season_id := old_master.season_id;
    end if;
  end if;
  if old_master.id is not null and ypl_schema_validation.league_intake_has_downstream(array[mid,rid]) then
    foreach current_event in array array[old_master,old_rookie] loop
      if current_event.id is null then continue; end if;
      if current_event.battle_format is distinct from p_settings->>'battle_format'
         
         or current_event.regulation_id is distinct from p_settings->>'regulation_id'
         or current_event.cup_rule_id is distinct from p_settings->>'cup_rule_id'
         or current_event.cup_rule_settings is distinct from coalesce(p_settings->'cup_rule_settings','{}'::jsonb)
         or coalesce(current_event.competition_settings->'titleAward','null'::jsonb) is distinct from coalesce(p_settings->'title_award','null'::jsonb)
         or coalesce(current_event.competition_settings->>'recordRuleLabel','') is distinct from coalesce(p_settings->>'record_rule_label','') then
        raise exception '신청이나 경기 기록이 있어 대회 규칙을 변경할 수 없습니다.';
      end if;
    end loop;
  end if;
  -- One ordinary competition owns both leagues, including rounds after teams.
  if old_master.id is not null then
    select id,round_number into edition,n from ypl_schema_validation.competition_editions
      where family='regular' and (id=old_master.competition_edition_id or
        (old_master.competition_edition_id is null and round_number=old_master.round_number));
    if edition is null then raise exception '기존 대회의 공식 회차를 확인할 수 없습니다.'; end if;
  else
    select id,round_number into edition,n from ypl_schema_validation.reserve_competition_edition('regular');
  end if;
  foreach d in array array['master','rookie'] loop
    eid := case when d = 'master' then mid else rid end;
    current_event := case when d = 'master' then old_master else old_rookie end;
    if current_event.id is not null then
      if current_event.round_number is distinct from n then raise exception '통합 접수의 양쪽 회차가 일치하지 않습니다.'; end if;
      if current_event.status = 'cancelled' and ypl_schema_validation.league_intake_has_downstream(array[mid,rid]) then raise exception '취소된 접수에 후속 기록이 있습니다.'; end if;
    end if;
    insert into ypl_schema_validation.events (
      id, season_id, name, round_number, competition_edition_id, event_type, division, battle_format, competition_format,
      competition_settings, is_team_event, regulation_id, cup_rule_id, cup_rule_settings,
      registration_settings, held_on, date_precision, status, submission_target_at, team_reveal_mode
    ) values (
      eid, p_season_id, concat(n,'회 파이컵 ',case when d='master' then '마스터' else '루키' end,' 리그',case when subtitle<>'' then ' '||subtitle else '' end),
      n, edition, 'pokecup', d, p_settings->>'battle_format', null,
      jsonb_build_object('recordRuleLabel',coalesce(p_settings->>'record_rule_label',''),'titleAward',p_settings->'title_award','rankingEnabled',d='master'),
      false, p_settings->>'regulation_id', p_settings->>'cup_rule_id', coalesce(p_settings->'cup_rule_settings','{}'::jsonb),
      jsonb_build_object('announcementId',p_announcement_id,'leagueIntakeId',gid,'competitionEditionId',edition,'intakeName',concat(n,'회 파이컵',case when subtitle<>'' then ' '||subtitle else '' end)),
      nullif(p_settings->>'held_on','')::date, case when nullif(p_settings->>'held_on','') is null then 'unknown' else 'exact' end,
      coalesce(nullif(current_event.status,'cancelled'),'open'), nullif(p_settings->>'submission_target_at','')::timestamptz, 'on_record_apply'
    ) on conflict (id) do update set
      name=excluded.name, competition_edition_id=excluded.competition_edition_id, battle_format=excluded.battle_format, competition_format=ypl_schema_validation.events.competition_format,
      competition_settings=excluded.competition_settings, regulation_id=excluded.regulation_id, cup_rule_id=excluded.cup_rule_id,
      cup_rule_settings=excluded.cup_rule_settings, registration_settings=excluded.registration_settings,
      held_on=excluded.held_on, date_precision=excluded.date_precision, submission_target_at=excluded.submission_target_at,
      status=excluded.status, updated_at=now();
  end loop;
  if g.id is null and p_existing_master_event_id is not null then
    -- Only application rows may move, before the pair becomes visible. No
    -- Submission/Entry exists (checked above), so all immutable chains and IDs
    -- remain untouched. The admission lock prevents concurrent legacy INSERTs.
    if exists(select 1 from ypl_schema_validation.event_registrations where event_id=mid group by btrim(registration_name) having count(*)>1) then
      raise exception '중복된 기존 신청 이름이 있어 전환 전에 검수가 필요합니다.';
    end if;
    for registration in select * from ypl_schema_validation.event_registrations where event_id=mid order by id for update loop
      if registration.registration_source <> 'application' then raise exception '일반 신청 외의 연결이 있어 자동 전환할 수 없습니다.'; end if;
      select count(*),(array_agg(id))[1] into player_count,resolved_player from ypl_schema_validation.players where display_name=btrim(registration.registration_name);
      if player_count>1 or (registration.player_id is not null and registration.player_id is distinct from resolved_player) then
        raise exception '기존 신청자의 정확한 선수 확인이 필요합니다.';
      end if;
      target := case when ypl_schema_validation.has_individual_master_eligibility(resolved_player) then mid else rid end;
      update ypl_schema_validation.event_registrations set event_id=target,player_id=resolved_player,
        registration_name=btrim(registration.registration_name),updated_at=now() where id=registration.id;
    end loop;
  end if;
  insert into ypl_schema_validation.league_intakes(id,announcement_id,master_event_id,rookie_event_id)
    values(gid,p_announcement_id,mid,rid) on conflict(announcement_id) do nothing;
  select * into strict g from ypl_schema_validation.league_intakes where id=gid;
  return g;
end $function$;

