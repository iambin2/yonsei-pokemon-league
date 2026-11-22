-- 알림을 켠 기기는 처음부터 모든 종류를 받는다. 끄는 것은 본인이 알림 화면에서 한다. 2026-11-22 운영위 건의.
-- push_kinds.sql 다음에 실행한다. 다시 실행해도 같다.

-- 1. 새로 켜는 기기의 기본값: 알림 화면의 일곱 종류 전부(announcementPushPolicy.js PUSH_KINDS)
alter table public.push_subscriptions alter column kinds set default '{notice,schedule,match,board,reply,tower,record}';

-- 2. 종류를 고른 적이 없는 기기(예전 기본값 공지 하나 그대로)도 전부로 올린다. 직접 고른 기기(빈 목록 포함)는 건드리지 않는다.
--    게시판 새 글은 지금부터 세어, 켜자마자 지난 글이 몰려오지 않게 한다(set_push_kinds 와 같은 방식).
update public.push_subscriptions
   set kinds = '{board,match,notice,record,reply,schedule,tower}', board_pushed_at = now()
 where kinds = '{notice}';

-- 확인: select kinds, count(*) from public.push_subscriptions group by 1;  -- '{notice}' 줄이 없다
