-- 본인이 하는 연결 해제와 계정 삭제, 운영자의 연결 해제 (2026-11-22, 인수인계 준비).
-- 개인정보처리방침 제8조의 권리를 운영진에게 연락하지 않고 본인이 쓰게 한다. 지금까지는 요청마다 운영진이 SQL을 써야 했다.
-- 1. account_unlink: 로그인한 본인의 기록 연결(대기, 승인, 거절 모두)을 지운다. 계정은 남고, 대회 기록은 그대로 트레이너 이름으로 남는다.
-- 2. account_delete: 로그인한 본인의 구글 계정을 지운다. 연결(player_accounts), 저장한 팀(account_teams), 게시판 작성자 연결
--    (community_authors), 도전의 탑 기록(streak_runs, tower_cup_*)은 외래 키의 cascade로 함께 지워지고, 배틀의 계정 칸과 알림 구독의
--    계정은 비워진다(set null). 대회 기록(이름, 결과, 공식 파티)은 리그 기록이라 남는다(방침 제3조, 제8조).
-- 3. admin_unlink_player: 운영자가 잘못 승인한 연결을 푼다(지금까지는 승인과 거절만 있었다).
-- 모든 변경은 change_log.sql이 실행돼 있으면 거기 남는다(player_accounts).
-- 한 번 실행하면 되고, 다시 실행해도 안전하다. 실행한 뒤 docs/db/README.md 장부에 날짜를 적는다.

create or replace function public.account_unlink()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception using errcode = '42501', message = '로그인이 필요합니다.'; end if;
  delete from public.player_accounts a where a.auth_user_id = v_user;
  return found;
end;
$$;
revoke all on function public.account_unlink() from public, anon;
grant execute on function public.account_unlink() to authenticated;

create or replace function public.account_delete()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception using errcode = '42501', message = '로그인이 필요합니다.'; end if;
  -- 운영자 계정은 이 길로 지우지 않는다(대시보드에서 한다, HANDOVER.md 4절)
  if ypl_schema_validation.is_ypl_admin() then raise exception using errcode = '42501', message = '운영자 계정은 여기서 지울 수 없습니다.'; end if;
  delete from auth.users u where u.id = v_user;
  return found;
end;
$$;
revoke all on function public.account_delete() from public, anon;
grant execute on function public.account_delete() to authenticated;

create or replace function public.admin_unlink_player(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not ypl_schema_validation.is_ypl_admin() then raise exception using errcode = '42501', message = '운영자만 할 수 있습니다.'; end if;
  delete from public.player_accounts a where a.auth_user_id = p_user;
  return found;
end;
$$;
revoke all on function public.admin_unlink_player(uuid) from public, anon;
grant execute on function public.admin_unlink_player(uuid) to authenticated;

notify pgrst, 'reload schema';
