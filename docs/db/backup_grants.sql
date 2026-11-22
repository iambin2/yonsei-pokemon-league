-- 주간 백업이 모든 표를 읽게 한다 (2026-11-22). backup.yml 은 service_role 키로 API를 읽는데, service_role 은 RLS는 건너뛰지만
-- 표의 권한(GRANT)은 건너뛰지 못한다. 잠금(access_lockdown.sql 등)이 표마다 권한을 거두면서 service_role 에게는 6개 표만 남아,
-- 첫 백업이 신청, 대진, 결과, 계정, 게시판 표를 읽지 못하고 실패했다.
-- service_role 에게 읽기만 준다. 이 키는 저장소 비밀과 Supabase에만 있고 방문자에게 가지 않으므로 공개 범위는 바뀌지 않는다.
-- 쓰기는 주지 않는다. 앞으로 만드는 표에도 같은 읽기가 저절로 붙는다(default privileges).
-- 한 번 실행하면 되고, 다시 실행해도 안전하다. 실행한 뒤 docs/db/README.md 장부에 날짜를 적고 Actions의 Weekly backup을 다시 돌린다.
-- 확인: select count(*) filter (where not has_table_privilege('service_role', c.oid, 'SELECT')) as unreadable
--         from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'ypl_schema_validation') and c.relkind = 'r';  -- 0

grant usage on schema public, ypl_schema_validation to service_role;
grant select on all tables in schema public to service_role;
grant select on all tables in schema ypl_schema_validation to service_role;
alter default privileges in schema public grant select on tables to service_role;
alter default privileges in schema ypl_schema_validation grant select on tables to service_role;

notify pgrst, 'reload schema';
