-- 게시판을 구글 계정으로 쓰기, 그 글과 댓글에 달린 답의 알림 (2026-11-18, docs/superpowers/specs/2026-11-18-board-account-replies-design.md).
-- push_kinds.sql 다음에 실행한다(알림 종류 reply 가 거기 있다). 여러 번 실행해도 된다.
--
-- 생각
--   - 승인된 계정으로 로그인한 사람이 "계정으로 쓰기"를 고르면(payload 의 예약 키 _byAccount), 이름은 화면이 보낸 것이 아니라
--     계정의 신청 이름(20자, streak_trainer_name 과 같은 규칙)이 서고, 비밀번호 없이 그 계정만 고치고 지운다. 운영진은 지금처럼 모두.
--   - 글과 계정의 짝은 방문자가 읽을 수 없는 community_authors 에만 둔다. 공개 표에는 계정으로 썼다는 표시(by_account)만 선다.
--   - 계정으로 쓴 사람은 자기 비밀글과 그 아래 댓글을 읽는다(운영진의 답을 알림으로 받고 읽도록).
--   - 답이 달리면 push_outbox 에 reply 줄을 넣는다: 글쓴이에게(그 글의 모든 댓글과 대댓글), 원댓글쓴이에게(그 댓글의 대댓글).
--     자기가 쓴 것으로는 알리지 않는다. 비밀글의 알림에는 내용을 담지 않는다. 쓰기는 절대 막지 않는다(실패는 경고만).
--   - 사설 대진표는 계정으로 쓰지 않는다(관리 비밀번호로 여럿이 고친다). community_write 의 서명은 그대로라 옛 화면도 돈다.

begin;

-- 1. 계정으로 쓴 글의 공개 표시와 닫힌 짝
alter table public.community_items add column if not exists by_account boolean not null default false;
create table if not exists public.community_authors (
  item_id text primary key references public.community_items (id) on delete cascade,
  auth_user_id uuid not null references auth.users (id) on delete cascade
);
create index if not exists community_authors_account on public.community_authors (auth_user_id);
alter table public.community_authors enable row level security;
revoke all on table public.community_authors from public, anon, authenticated;

-- 2. 이 글(글의 id)이 지금 로그인한 계정의 것인가. 읽기 정책이 부른다.
create or replace function public.community_mine(p_post text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.community_authors a where a.item_id = p_post and a.auth_user_id = (select auth.uid()));
$$;
revoke all on function public.community_mine(text) from public;
grant execute on function public.community_mine(text) to anon, authenticated;

-- 3. 읽기: 공개 글, 운영진, 그리고 계정으로 쓴 사람의 비밀글과 그 아래 댓글
drop policy if exists community_items_read on public.community_items;
create policy community_items_read on public.community_items for select to anon, authenticated
  using (not secret or (select ypl_schema_validation.is_ypl_admin()) or public.community_mine(coalesce(parent_id, id)));

-- 4. 쓰기. private_bracket_conflict_guard.sql 의 것에 계정 쓰기만 더했다(사설 대진표의 비밀번호와 stale 검사는 그대로).
create or replace function public.community_write(
  p_action text,
  p_board text,
  p_id text,
  p_parent_id text,
  p_payload jsonb,
  p_secret boolean,
  p_pin text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin boolean := ypl_schema_validation.is_ypl_admin();
  v_user uuid := auth.uid();
  v_item public.community_items%rowtype;
  v_parent public.community_items%rowtype;
  v_pin text := nullif(p_pin, '');
  v_status text;
  v_account boolean := false;
  v_name text;
  c_reserved constant text[] := array['id', 'pin', 'pinHash', 'comments', 'secret', 'createdAt', 'hasPin', '_expectedUpdatedAt', '_byAccount', 'byAccount'];
begin
  if p_action = 'create' then
    if p_board not in ('free', 'showcase', 'private_bracket')
       or coalesce(p_id, '') !~ '^[a-z0-9]{4,40}$'
       or jsonb_typeof(p_payload) is distinct from 'object' then
      raise exception using errcode = 'P0001', message = '저장할 글이 올바르지 않습니다.';
    end if;
    v_account := coalesce(p_payload ->> '_byAccount', '') = 'true';
    if v_account then
      if p_board = 'private_bracket' then
        raise exception using errcode = 'P0001', message = '사설 대진표는 계정으로 쓸 수 없습니다.';
      end if;
      select left(btrim(a.requested_name), 20) into v_name
        from public.player_accounts a where a.auth_user_id = v_user and a.status = 'approved';
      if v_name is null then
        raise exception using errcode = 'P0001', message = '승인된 계정으로 로그인해 주세요.';
      end if;
      v_pin := null;
    end if;
    if v_pin is not null and v_pin !~ '^[0-9]{4}$' then
      raise exception using errcode = 'P0001', message = '비밀번호는 숫자 4자리로 입력해 주세요.';
    end if;
    if p_board = 'private_bracket' and p_parent_id is null and v_pin is null then
      raise exception using errcode = 'P0001', message = '관리 비밀번호를 입력해 주세요.';
    end if;
    if p_parent_id is not null then
      select * into v_parent from public.community_items i
       where i.id = p_parent_id and i.board = p_board and i.parent_id is null;
      if not found then
        raise exception using errcode = 'P0001', message = '글을 찾을 수 없습니다.';
      end if;
    end if;
    if not v_admin then
      perform pg_advisory_xact_lock(hashtext('community_write'));
      if (select count(*) from public.community_items i where i.created_at > now() - interval '1 minute') >= 20 then
        raise exception using errcode = 'P0001', message = '글이 많이 올라오고 있습니다. 잠시 뒤 다시 시도해 주세요.';
      end if;
      if (select count(*) from public.community_items i where i.board = p_board) >= 3000 then
        raise exception using errcode = 'P0001', message = '저장 공간이 가득 찼습니다. 관리자에게 오래된 글 정리를 요청해 주세요.';
      end if;
    end if;
    insert into public.community_items (id, board, parent_id, payload, secret, has_pin, by_account)
    values (p_id, p_board, p_parent_id, case when p_board='private_bracket' then
              (p_payload - c_reserved) || jsonb_build_object('updatedAt',clock_timestamp())
            when v_account then (p_payload - c_reserved) || jsonb_build_object('nick', v_name)
            else p_payload - c_reserved end,
            coalesce(v_parent.secret, p_secret, false), v_pin is not null, v_account);
    if v_account then
      insert into public.community_authors (item_id, auth_user_id) values (p_id, v_user);
    end if;
    if v_pin is not null then
      insert into public.visitor_pins (scope, subject, pin_hash)
      values ('community', p_id, public.visitor_pin_hash(p_id, v_pin));
    end if;
    return 'ok';
  end if;

  if p_action not in ('verify', 'update', 'delete') then
    raise exception using errcode = 'P0001', message = '알 수 없는 요청입니다.';
  end if;
  select * into v_item from public.community_items i where i.id = p_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = '삭제되었거나 찾을 수 없는 글입니다.';
  end if;
  if not v_admin then
    if v_item.by_account then
      -- 계정으로 쓴 글: 쓴 계정만. 비밀번호는 보지 않는다
      if not exists (select 1 from public.community_authors a where a.item_id = p_id and a.auth_user_id = v_user) then
        return 'not_yours';
      end if;
    else
      v_status := public.visitor_pin_check('community', p_id, v_pin);
      if v_status <> 'ok' then return v_status; end if;
    end if;
  end if;

  if p_action = 'update' then
    if jsonb_typeof(p_payload) is distinct from 'object' then
      raise exception using errcode = 'P0001', message = '저장할 글이 올바르지 않습니다.';
    end if;
    -- The row lock serializes saves; the token also rejects an older reader.
    -- Old clients without a token must refresh instead of overwriting results.
    if v_item.board='private_bracket' and
       (not (p_payload ? '_expectedUpdatedAt') or
        p_payload->'_expectedUpdatedAt' is distinct from coalesce(v_item.payload->'updatedAt','null'::jsonb)) then
      return 'stale';
    end if;
    -- 계정으로 쓴 글의 이름은 고쳐지지 않는다
    update public.community_items i
       set payload = i.payload || ((p_payload - c_reserved) - case when i.by_account then 'nick' else '' end)
             || case when i.board='private_bracket' then jsonb_build_object('updatedAt',clock_timestamp()) else '{}'::jsonb end,
           secret = coalesce(p_secret, i.secret)
     where i.id = p_id;
    if p_secret is not null then
      update public.community_items i set secret = p_secret where i.parent_id = p_id;
    end if;
  elsif p_action = 'delete' then
    delete from public.visitor_pins p
     where p.scope = 'community'
       and p.subject in (select i.id from public.community_items i where i.id = p_id or i.parent_id = p_id);
    delete from public.community_items i where i.id = p_id;
  end if;
  return 'ok';
end;
$$;
revoke all on function public.community_write(text, text, text, text, jsonb, boolean, text) from public, anon, authenticated;
grant execute on function public.community_write(text, text, text, text, jsonb, boolean, text) to anon, authenticated;

-- 5. 답의 알림. 커밋 때 돈다(같은 쓰기의 community_authors 줄이 들어간 뒤라 쓴 사람을 알아 자기에게는 보내지 않는다).
create or replace function public.push_community_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post public.community_items%rowtype;
  v_writer uuid;
  v_nick text;
  v_tab text;
  v_text text;
begin
  begin
    if to_regclass('public.push_outbox') is null then return null; end if;
    select * into v_post from public.community_items i where i.id = new.parent_id and i.board in ('free', 'showcase');
    if not found then return null; end if;
    if not exists (select 1 from public.community_items i where i.id = new.id) then return null; end if;  -- 커밋 전에 지워졌다
    select a.auth_user_id into v_writer from public.community_authors a where a.item_id = new.id;
    v_nick := left(coalesce(nullif(btrim(new.payload ->> 'nick'), ''), '누군가'), 20);
    v_tab := case when v_post.board = 'free' then 'free' else coalesce(v_post.payload ->> 'kind', 'sample') end;
    v_text := case when v_post.secret then '' else left(coalesce(nullif(btrim(new.payload ->> 'body'), ''), '링크'), 80) end;

    insert into public.push_outbox (dedup, kind, auth_user_id, title, body, url)
    select 'reply:' || new.id || ':' || t.auth_user_id, 'reply', t.auth_user_id, '게시판 댓글',
           v_nick || case when t.why = 'comment' then ' 님이 내 댓글에 답글을 남겼습니다' else ' 님이 내 글에 댓글을 남겼습니다' end
             || case when v_text = '' then '.' else ': ' || v_text end,
           '?view=board&tab=' || v_tab || '&post=' || v_post.id
      from (
        -- 원댓글쓴이(답글이면)와 글쓴이, 같은 계정이면 원댓글 쪽으로 한 번
        select distinct on (x.auth_user_id) x.auth_user_id, x.why
          from (
            select a.auth_user_id, 'comment' as why, 1 as o
              from public.community_items c join public.community_authors a on a.item_id = c.id
             where c.id = new.payload ->> 'replyTo' and c.parent_id = v_post.id
            union all
            select a.auth_user_id, 'post', 2 from public.community_authors a where a.item_id = v_post.id
          ) x
         order by x.auth_user_id, x.o
      ) t
     where t.auth_user_id is distinct from v_writer
    on conflict (dedup) do nothing;
  exception when others then
    raise warning 'push_community_reply: %', sqlerrm;
  end;
  return null;
end;
$$;
revoke all on function public.push_community_reply() from public, anon, authenticated;
drop trigger if exists push_community_reply on public.community_items;
create constraint trigger push_community_reply after insert on public.community_items
  deferrable initially deferred
  for each row when (new.parent_id is not null) execute function public.push_community_reply();

commit;

notify pgrst, 'reload schema';
