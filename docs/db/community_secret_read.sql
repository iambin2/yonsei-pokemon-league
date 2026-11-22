-- 익명으로 쓴 비공개 글(관리자 전용)을 쓴 사람이 다시 읽는다. 2026-11-22 운영위 건의.
-- 계정으로 쓴 비공개 글은 community_accounts.sql 의 읽기 정책이 이미 쓴 사람에게 보여 준다. 비밀번호로 쓴 글은 그 길이 없어
-- 올린 사람도 자기 글과 운영진의 답을 볼 수 없었다. 이 함수는 글의 비밀번호가 맞을 때만 그 글과 아래 댓글을 돌려준다.
-- 비밀번호 대조는 visitor_pin_check 그대로라 다섯 번 틀리면 15분 잠긴다. community_accounts.sql 다음에 실행한다.
create or replace function public.community_secret_read(p_id text, p_pin text)
returns table (id text, parent_id text, payload jsonb, secret boolean, has_pin boolean, by_account boolean, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.community_items i where i.id = p_id and i.parent_id is null and i.secret and not i.by_account) then
    return;
  end if;
  if public.visitor_pin_check('community', p_id, nullif(p_pin, '')) <> 'ok' then
    return;
  end if;
  return query
    select i.id, i.parent_id, i.payload, i.secret, i.has_pin, i.by_account, i.created_at
      from public.community_items i
     where i.id = p_id or i.parent_id = p_id;
end;
$$;
revoke all on function public.community_secret_read(text, text) from public;
grant execute on function public.community_secret_read(text, text) to anon, authenticated;
