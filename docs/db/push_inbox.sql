-- 받은 알림 (2026-11-19, docs/PUSH.md "받은 알림"). 알림 화면(?view=alerts)이 지난 7일의 알림을 다시 보여 준다.
-- push_kinds.sql 과 community_accounts.sql 다음에 실행한다. 여러 번 실행해도 된다. 표는 만들지 않는다.
--
-- 생각
--   - 알림의 원본은 이미 있다: push_outbox 의 줄(7일 뒤 push_take 가 지운다)과 게시판의 공개 글(community_items).
--     게시판 알림은 기기마다 묶어 보내 줄이 없으므로, 글 하나하나를 게시판 새 글로 읽는다.
--   - 모두에게 가는 줄(auth_user_id 가 비어 있음)은 누구나 읽는다. 개인 줄은 그 계정의 로그인(auth.uid())으로만 읽는다.
--     화면이 보내는 것은 종류뿐이고 계정 id는 받지 않는다.
--   - 오늘의 탑(daily)은 2026-11-19 내렸으므로 보이지 않는다.

begin;

create or replace function public.push_inbox(p_kinds text[])
returns table (kind text, body text, url text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select * from (
    select o.kind, o.body, o.url, o.created_at
      from public.push_outbox o
     where o.kind = any(coalesce(p_kinds, '{}')) and o.kind <> 'daily'
       and o.created_at > now() - interval '7 days'
       and (o.auth_user_id is null or o.auth_user_id = auth.uid())
    union all
    select 'board', left(coalesce(nullif(btrim(i.payload ->> 'title'), ''), '새 글'), 80),
           '?view=board&tab=' || case when i.board = 'free' then 'free' else coalesce(i.payload ->> 'kind', 'sample') end || '&post=' || i.id,
           i.created_at
      from public.community_items i
     where 'board' = any(coalesce(p_kinds, '{}'))
       and i.parent_id is null and not i.secret and i.board in ('free', 'showcase')
       and i.created_at > now() - interval '7 days'
  ) a
  order by a.created_at desc
  limit 50;
$$;
revoke all on function public.push_inbox(text[]) from public;
grant execute on function public.push_inbox(text[]) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
