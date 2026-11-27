-- 한 번만 실행하는 파일입니다. 운영에는 이미 실행됐습니다(docs/db/README.md 장부). 다시 실행하지 않습니다.
-- 오늘의 탑을 내립니다 (2026-11-19, 운영자: "오늘의 탑도 그냥 없애줘. 도전의 탑 이번 달로만 남기자").
-- 사이트는 오늘의 탑을 더 열지 않고 알림 종류에서도 뺐습니다. 이 파일은 이미 그 알림을 켠 기기에서 그 종류를 거둡니다.
-- push_take 는 아침마다 오늘의 탑 한 줄을 push_outbox 에 넣지만, 받을 기기가 없으니 아무에게도 가지 않습니다.
-- 기록(streak_runs 의 daily 가 있는 줄)과 배틀 함수는 그대로 둡니다: 진행 중인 오늘의 탑은 끝까지 할 수 있습니다.
begin;
do $$ begin
  if current_setting('ypl.allow_one_time_sql', true) is distinct from 'yes' then
    raise exception 'ONE-TIME SCRIPT (2026-11-19): already applied in production. Do not re-run.';
  end if;
end $$;
update public.push_subscriptions set kinds = array_remove(kinds, 'daily') where 'daily' = any (kinds);
commit;
-- 확인: select count(*) from public.push_subscriptions where 'daily' = any (kinds);  -- 0
