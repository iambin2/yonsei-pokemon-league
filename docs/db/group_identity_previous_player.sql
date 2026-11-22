-- 조별리그 대진표 생성이 "bracket_identity_changes 의 새 행이 검사 조건을 어깁니다"로 막히던 일을 고칩니다.
--
-- 원인: create_individual_bracket_draw 가 previous_registration_player_id 에 신청서의 선수 ID 를 늘 넣었습니다.
-- 그런데 ck_bracket_identity_changes_previous_player 는 "선수 연결을 바꾼 경우(registration_player_was_changed)에만
-- 이 값이 있을 수 있다"고 요구합니다. 이미 선수가 연결된 신청자(대부분의 신청자)가 한 명이라도 있으면 생성이 실패했습니다.
-- 고침: 연결을 바꾼 경우에만 값을 넣습니다. (연결을 바꾼 경우는 원래 선수가 없던 신청서라 값은 어차피 비어 있습니다.)
--
-- 운영자가 SQL Editor 에서 한 번 실행합니다. 다시 실행해도 안전합니다.
do $patch$
declare f regprocedure:='ypl_schema_validation.create_individual_bracket_draw(uuid,uuid,text,jsonb,jsonb,integer,text,uuid[],jsonb)'::regprocedure; d text;
begin
  d:=pg_get_functiondef(f);
  if position('''previous_registration_player_id'',r.player_id,' in d)>0 then
    d:=replace(d,'''previous_registration_player_id'',r.player_id,','''previous_registration_player_id'',case when was_linked then r.player_id end,');
    if position('''previous_registration_player_id'',r.player_id,' in d)>0 then raise exception '현재 대진표 생성 함수의 구조를 확인해 주세요.'; end if;
    execute d;
  end if;
end $patch$;
