# Database write access lockdown

Status: Migration A and Migration B were applied to Production (`rqffrogcverfjqzjasax`) on 2026-10-16. Client login changes shipped in `158c3f3`. Step 6 of section 5 (updating source SQL files, tests, and `ARCHITECTURE.md`) remains.
Survey date: 2026-10-16. Based on Production catalog queries and every `.from()` and `.rpc()` call under `src/`.

## 1. Problem

Anyone with the public `anon` key shipped in the frontend bundle can send direct PostgREST requests and alter official data.

- RLS is disabled on `public.site_data` and all 22 tables in `ypl_schema_validation`.
- `anon` has SELECT, INSERT, UPDATE, DELETE, and TRUNCATE on `site_data`. Overwriting the `ypl_data_v4` row wipes announcements and legacy records.
- `anon` has INSERT on 14 normalized tables, DELETE on 11, and UPDATE on 5 (including `results`, `ranking_awards`, `matches`, and `events`).
- `anon` can execute 27 functions. Ten of them are SECURITY DEFINER and bypass table privileges without checking the caller (including `finalize_championship_qualifier` and HOF create/delete). The remaining SECURITY INVOKER functions run with `anon`'s table grants, so those table grants effectively authorize function writes.
- Admin mode is a client-only check, and `src/admin/adminAuth.js` stores the admin ID and password in plaintext. Because that password is already exposed in deployed JS and git history, it should be discarded.
- `auth.users` has 0 rows, and the `authenticated` role does not even have USAGE on `ypl_schema_validation`.

As a result, the claim in section 10 of `docs/ARCHITECTURE.md` that RPCs and the DB act as the integrity boundary does not hold yet.

## 2. Write ownership

### Visitor writes

Unauthenticated visitors only need four write paths:

| Path | Code | DB write |
| --- | --- | --- |
| Tournament registration (Event-linked form) | `App.jsx` (`submitForm` to `submitEventApplication`) | 1-row INSERT on `event_registrations` |
| Official party submission | `TeamBuilderPage` (`submitEventTeamSnapshot`) | RPC `submit_registration_team_snapshot` (inserts into `team_snapshots`, `team_snapshot_members`, `registration_submissions`; locks `events` and `event_registrations` with `FOR UPDATE`) |
| Board samples and party showcases | `communityStore.updateCommunity(SHOWCASE_KEY)` | Upsert `site_data` key `ypl_showcase_v1` |
| Private brackets | `communityStore.updateCommunity(PRIVATE_BRACKETS_KEY)` | Upsert `site_data` key `ypl_private_brackets_v1` |

One exception exists: legacy forms not linked to an Event append responses by rewriting the entire `ypl_data_v4` row (bottom of `submitForm` in `App.jsx`). Two legacy forms currently have `enabled=true` (`2026-08-01 운영위원 모집` and `2026-07-13 6회 챔피언스`). Lockdown will block that path; see section 6 for the decision.

### Admin writes

All other writes belong to admins:

- Saving `site_data` key `ypl_data_v4` (`App.jsx` `save` to `saveSiteData`).
- All direct writes on normalized tables: `events`, `players`, UPDATE/DELETE on `event_registrations`, `entries`, `entry_participants`, `matches`, `results`, `ranking_awards`, and `bracket_*` (record apply, participant confirmation, and rollback paths in `normalizedCompetitionService.js`).
- All 26 other RPCs (every RPC except `submit_registration_team_snapshot`). `ensure_current_ypl_season` is called only when creating announcements or Champions pairs.

Reads remain public, since the entire site relies on `anon` reads.

## 3. Supabase Auth admin account and RLS

Only admins send requests as `authenticated`, and the database verifies `app_metadata.ypl_admin` inside the JWT. Because only the server (dashboard or service role) can modify `app_metadata`, clients cannot forge it.

| Target | Visitor (`anon`) | Admin (`authenticated` + `ypl_admin`) |
| --- | --- | --- |
| Read 22 normalized tables | Allowed | Allowed |
| Write normalized tables | `event_registrations` INSERT only, gated by policy | Full access (current `anon` scope plus tables used by Champions functions switching from DEFINER) |
| Read `site_data` | Allowed | Allowed |
| Write `site_data` | INSERT/UPDATE on two community keys only | Full access |
| `site_data` DELETE, TRUNCATE | Denied | DELETE only |
| `submit_registration_team_snapshot` | Execute (switched to DEFINER; internal checks gate access) | Execute |
| All other RPCs | Denied | Execute |

### Design rationale

- Switch the 8 Champions DEFINER functions to SECURITY INVOKER. Keeping them DEFINER would bypass RLS and require rewriting all 8 function bodies to add caller checks. Switching to INVOKER takes one `ALTER` statement per function and makes table RLS the single gate. Those functions were DEFINER only because `anon` lacked write grants on `championship_advancements`, `championship_qualifier_direct_selections`, and `hall_of_fame_entries`, so granting those privileges to `authenticated` replaces the need. Because their bodies lock `championship_advancements` and `hall_of_fame_entries` with `FOR UPDATE`, `authenticated` also gets UPDATE on both tables.
- Keep `ensure_current_ypl_season` as SECURITY DEFINER. It calls the private `ensure_current_ypl_season_for_date` using only DB `now()`, so its result does not depend on the caller. Only its execute grant moves to `authenticated`.
- Switch `submit_registration_team_snapshot` to SECURITY DEFINER. It is the only RPC visitors call, and its body already validates Event status, record-apply state, and exact Registration match inside a transaction. Leaving it INVOKER would require keeping snapshot INSERT grants and `events`/`event_registrations` UPDATE grants (for `FOR UPDATE`) on `anon`, which would allow direct inserts bypassing the RPC.
- Gate visitor registrations with an RLS policy instead of an RPC so client code does not need to change. The policy requires `registration_source = 'application'`, `final_submission_id IS NULL`, an `open` Event with no `record_applied_at`, and a `player_id` that is either `NULL` or matches a Player with the same `display_name`. Column-level INSERT grants prevent `anon` from setting `final_submission_id`, `id`, or `created_at`.
- Revoke TRUNCATE from both `anon` and `authenticated` because TRUNCATE bypasses RLS.
- Disable public sign-ups and anonymous sign-ins in the Supabase dashboard. Anonymous sign-in users receive the `authenticated` role, which is also why the `ypl_admin` check lives in RLS policies rather than relying on role membership alone.

## 4. Client changes

Do not pull in the full `supabase-js` client (as noted in `storage.js`, it doubles initial JS size). One Auth REST call and a `fetch` wrapper are enough.

`src/storage.js`:

```js
let session = null; let refreshTimer = 0;
const authBase = SUPA_URL ? new URL("auth/v1/", SUPA_URL.replace(/\/?$/, "/")).href : "";

// Use the admin access token when signed in; otherwise fall back to the anon key.
const authFetch = (url, init = {}) => {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session?.access_token || SUPA_KEY}`);
  return fetch(url, { ...init, headers });
};

export const supa = SUPA_URL && SUPA_KEY
  ? new PostgrestClient(new URL("rest/v1", SUPA_URL.replace(/\/?$/, "/")).href, {
      headers: { apikey: SUPA_KEY }, fetch: authFetch,
    })
  : null;

async function requestToken(grant, body) {
  const r = await fetch(`${authBase}token?grant_type=${grant}`, {
    method: "POST", headers: { apikey: SUPA_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
  session = await r.json();
  clearTimeout(refreshTimer);
  // Refresh 1 minute before expiry. On failure, sign out so the next write fails with a permission error.
  refreshTimer = setTimeout(() => requestToken("refresh_token", { refresh_token: session.refresh_token }).catch(signOutAdmin), (session.expires_in - 60) * 1000);
}

export const signInAdmin = (email, password) => requestToken("password", { email, password });
export function signOutAdmin() { session = null; clearTimeout(refreshTimer); }
```

- Delete `src/admin/adminAuth.js` (plaintext credentials). `LoginModal` in `AdminEditors.jsx` awaits `signInAdmin`. The login field accepts the shared admin ID and appends `@ypl.invalid` when `@` is absent (`.invalid` is a reserved non-routable domain, preventing password-reset email hijacking).
- Both admin logout handlers in `App.jsx` call `signOutAdmin()`.
- Deploy the client only after Migration A. Before Migration A, `authenticated` has no schema USAGE, so signed-in admins fail both normalized reads and writes.
- Refreshing the page still exits admin mode because the token lives only in memory.

## 5. Rollout order

Each step keeps the site working on its own.

1. Dashboard setup by an operator (completed 2026-10-16: 1 admin with `ypl_admin=true`, sign-ups and anonymous login disabled, both legacy forms closed). Create the admin user in Authentication with a new password and email confirmed, disable public sign-ups and anonymous login, and flag `ypl_admin`:
   ```sql
   update auth.users set raw_app_meta_data = raw_app_meta_data || '{"ypl_admin": true}'::jsonb where email = '<admin-email>';
   ```
2. Apply Migration A (additive only, immediately safe). Adds the admin check function, grants `authenticated` privileges, and switches party submission to SECURITY DEFINER. `anon` grants remain untouched so nothing breaks.
3. Deploy the client changes from section 4. After deploy, sign in as admin and verify saving an announcement, recording a bracket winner, and applying records once each (admin requests now run as `authenticated`).
4. Apply Migration B (lockdown, single transaction). Enables RLS and policies, revokes `anon` writes and TRUNCATE, moves admin RPC execute grants, and switches Champions functions to SECURITY INVOKER.
5. Run the verification checks in section 7.
6. Clean up source files in the same PR. Source files under `docs/db/*.sql` still contain `grant ... to anon` and `security definer`, and `tests/championsApplicationEventPairRpc.test.mjs` and `tests/championsHallOfFameRevert.test.mjs` assert on those strings. Update the SQL files and tests to match Migration B, and update section 10 of `ARCHITECTURE.md` so re-running source SQL cannot restore `anon` privileges.

## 6. Pre-rollout decisions

1. Whether to close the two legacy forms. Decided on 2026-10-16 to close them (`enabled=false`, responses preserved). Confirm they are closed before Migration B. Both belong to past announcements; leaving them open would cause submissions after lockdown to fail with `"이 화면에만 반영됨"`. If a standalone form must keep accepting responses later, add a dedicated DEFINER RPC that appends one `jsonb` response.
2. Admin email address, needed for step 1 in the dashboard.

## 7. Verification

Right after Migration B, run this rollback block in the SQL editor to confirm `anon` is blocked:

```sql
begin;
set local role anon;
select count(*) from ypl_schema_validation.events;                               -- must succeed
insert into ypl_schema_validation.results (event_id) values (gen_random_uuid());   -- must fail with 42501
update public.site_data set value = value where key = 'ypl_data_v4';              -- must affect 0 rows (filtered by RLS)
select ypl_schema_validation.finalize_championship_qualifier(gen_random_uuid());   -- must fail with 42501
rollback;
```

Next, test on the live site: as a visitor, create and delete a board post, create a private bracket, and register plus submit a party for an open Event (in Test if no Event is open in Production). As a signed-in admin, save an announcement, record a winner, and apply then revert records.

## 8. Migration A (applied 2026-10-16)

```sql
-- A1. Admin check. Only the server can write JWT app_metadata.
create or replace function ypl_schema_validation.is_ypl_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'ypl_admin')::boolean, false)
$$;
revoke all on function ypl_schema_validation.is_ypl_admin() from public;
grant execute on function ypl_schema_validation.is_ypl_admin() to anon, authenticated;

-- A2. Admin role privileges: current anon scope plus tables written/locked by Champions INVOKER functions.
grant usage on schema ypl_schema_validation to authenticated;
grant select on all tables in schema ypl_schema_validation to authenticated;
grant insert, delete         on ypl_schema_validation.bracket_entry_slots,
                                ypl_schema_validation.bracket_identity_changes,
                                ypl_schema_validation.bracket_runtimes,
                                ypl_schema_validation.entries,
                                ypl_schema_validation.entry_participants,
                                ypl_schema_validation.players,
                                ypl_schema_validation.team_snapshots,
                                ypl_schema_validation.championship_qualifier_direct_selections to authenticated;
grant insert, update, delete on ypl_schema_validation.event_registrations,
                                ypl_schema_validation.matches,
                                ypl_schema_validation.ranking_awards,
                                ypl_schema_validation.results,
                                ypl_schema_validation.championship_advancements,
                                ypl_schema_validation.hall_of_fame_entries to authenticated;
grant insert, update         on ypl_schema_validation.events to authenticated;
grant insert                 on ypl_schema_validation.registration_submissions,
                                ypl_schema_validation.team_snapshot_members to authenticated;

do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'ypl_schema_validation' and p.prokind = 'f'
       and p.proname <> 'ensure_current_ypl_season_for_date'
  loop
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- A3. Only RPC callable by visitors. Body validates Event status and exact Registration match.
alter function ypl_schema_validation.submit_registration_team_snapshot(uuid, uuid, text, jsonb, jsonb) security definer;
```

## 9. Migration B (applied 2026-10-16, single transaction)

```sql
begin;

-- B1. Normalized tables: RLS, public read, admin write.
do $$
declare t text;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'ypl_schema_validation' and c.relkind = 'r'
  loop
    execute format('alter table ypl_schema_validation.%I enable row level security', t);
    execute format('create policy public_read on ypl_schema_validation.%I for select to anon, authenticated using (true)', t);
    execute format('create policy admin_write on ypl_schema_validation.%I for all to authenticated
                      using ((select ypl_schema_validation.is_ypl_admin()))
                      with check ((select ypl_schema_validation.is_ypl_admin()))', t);
  end loop;
end $$;

-- B2. Revoke anon writes; re-grant column-level INSERT for applications only.
revoke insert, update, delete, truncate on all tables in schema ypl_schema_validation from anon;
revoke truncate on all tables in schema ypl_schema_validation from authenticated;
grant insert (event_id, player_id, registration_name, registration_data, registration_source, registered_at, updated_at)
  on ypl_schema_validation.event_registrations to anon;

create policy visitor_apply on ypl_schema_validation.event_registrations
  for insert to anon
  with check (
    registration_source = 'application'
    and final_submission_id is null
    and exists (select 1 from ypl_schema_validation.events e
                 where e.id = event_registrations.event_id and e.status = 'open' and e.record_applied_at is null)
    and (player_id is null or exists (select 1 from ypl_schema_validation.players p
                                       where p.id = event_registrations.player_id
                                         and p.display_name = event_registrations.registration_name))
  );

-- B3. site_data: public read, visitor write on two community keys only, admin for the rest.
alter table public.site_data enable row level security;
revoke all on public.site_data from anon, authenticated;
grant select, insert, update on public.site_data to anon;
grant select, insert, update, delete on public.site_data to authenticated;

create policy site_data_read on public.site_data for select to anon, authenticated using (true);
create policy site_data_community_insert on public.site_data for insert to anon, authenticated
  with check (key in ('ypl_showcase_v1', 'ypl_private_brackets_v1'));
create policy site_data_community_update on public.site_data for update to anon, authenticated
  using (key in ('ypl_showcase_v1', 'ypl_private_brackets_v1'))
  with check (key in ('ypl_showcase_v1', 'ypl_private_brackets_v1'));
create policy site_data_admin on public.site_data for all to authenticated
  using ((select ypl_schema_validation.is_ypl_admin()))
  with check ((select ypl_schema_validation.is_ypl_admin()));

-- B4. RPC execute grants: leave only party submission and read helpers on anon.
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'ypl_schema_validation' and p.prokind = 'f'
       and p.proname not in ('submit_registration_team_snapshot', 'is_ypl_admin', 'resolve_ypl_season_for_date')
  loop
    execute format('revoke execute on function %s from public, anon', f);
  end loop;
end $$;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;  -- event trigger only

-- B5. Switch Champions DEFINER functions to INVOKER so RLS admin_write gates them.
alter function ypl_schema_validation.add_championship_qualifier_manual_registration(uuid, uuid) security invoker;
alter function ypl_schema_validation.cancel_championship_advancement(uuid) security invoker;
alter function ypl_schema_validation.create_championship_advancement(uuid, uuid, uuid, uuid, text, uuid, text) security invoker;
alter function ypl_schema_validation.ensure_championship_final_hall_of_fame(uuid, uuid) security invoker;
alter function ypl_schema_validation.remove_championship_final_hall_of_fame(uuid) security invoker;
alter function ypl_schema_validation.finalize_championship_qualifier(uuid) security invoker;
alter function ypl_schema_validation.reopen_championship_qualifier(uuid) security invoker;
alter function ypl_schema_validation.set_championship_qualifier_direct_selections(uuid, uuid[]) security invoker;

commit;
```

### Rolling back Migration B

```sql
begin;
do $$
declare t text;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'ypl_schema_validation' and c.relkind = 'r'
  loop
    execute format('drop policy if exists public_read on ypl_schema_validation.%I', t);
    execute format('drop policy if exists admin_write on ypl_schema_validation.%I', t);
    execute format('alter table ypl_schema_validation.%I disable row level security', t);
  end loop;
end $$;
drop policy if exists visitor_apply on ypl_schema_validation.event_registrations;

-- Restore anon grants as surveyed on 2026-10-16.
grant insert, delete         on ypl_schema_validation.bracket_entry_slots, ypl_schema_validation.bracket_identity_changes,
                                ypl_schema_validation.bracket_runtimes, ypl_schema_validation.entries,
                                ypl_schema_validation.entry_participants, ypl_schema_validation.players,
                                ypl_schema_validation.team_snapshots to anon;
grant insert, update, delete on ypl_schema_validation.event_registrations, ypl_schema_validation.matches,
                                ypl_schema_validation.ranking_awards, ypl_schema_validation.results to anon;
grant insert, update         on ypl_schema_validation.events to anon;
grant insert                 on ypl_schema_validation.registration_submissions, ypl_schema_validation.team_snapshot_members to anon;

drop policy if exists site_data_read on public.site_data;
drop policy if exists site_data_community_insert on public.site_data;
drop policy if exists site_data_community_update on public.site_data;
drop policy if exists site_data_admin on public.site_data;
alter table public.site_data disable row level security;
grant all on public.site_data to anon, authenticated;

do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'ypl_schema_validation' and p.prokind = 'f'
       and p.proname not in ('ensure_current_ypl_season_for_date', 'clear_qualifier_direct_selections_on_runtime_delete')
  loop
    execute format('grant execute on function %s to anon', f);
  end loop;
end $$;
grant execute on function public.rls_auto_enable() to anon, authenticated;

alter function ypl_schema_validation.add_championship_qualifier_manual_registration(uuid, uuid) security definer;
alter function ypl_schema_validation.cancel_championship_advancement(uuid) security definer;
alter function ypl_schema_validation.create_championship_advancement(uuid, uuid, uuid, uuid, text, uuid, text) security definer;
alter function ypl_schema_validation.ensure_championship_final_hall_of_fame(uuid, uuid) security definer;
alter function ypl_schema_validation.remove_championship_final_hall_of_fame(uuid) security definer;
alter function ypl_schema_validation.finalize_championship_qualifier(uuid) security definer;
alter function ypl_schema_validation.reopen_championship_qualifier(uuid) security definer;
alter function ypl_schema_validation.set_championship_qualifier_direct_selections(uuid, uuid[]) security definer;
commit;
```

## 10. Remaining risks

These risks remain outside the scope of this lockdown and need separate follow-up.

- The shared admin password is still exposed. By staff decision on 2026-10-16, the shared account (`yplofficial`) keeps its existing password. Because that password remains in public git history and older deployed JS bundles, anyone who looks it up can still sign in as admin after lockdown. Lockdown stops writes made with only the `anon` key. Rotating the password in the dashboard closes this gap without any code changes.
- Anyone can still overwrite an entire community row, such as replacing all board posts with an empty list. As noted in the ponytail comment in `communityStore.js`, blocking that requires moving to a per-post table and RPC. Lockdown limits the blast radius to those two keys.
- Public reads still expose personal information. `anon` can read legacy form responses in `ypl_data_v4` (including 5 responses for `운영위원 모집`) and `event_registrations.registration_data`. Responses should move to an admin-only store or be restricted with column-level SELECT grants.
- The application policy does not stop someone from registering for an open Event under any name, matching current product behavior.
