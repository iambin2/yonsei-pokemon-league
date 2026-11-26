# Posting with Google accounts and reply notifications

2026-11-18. Owner request: `"댓글이나 게시글을 구글 로그인을 통해 작성할 수도 있게 하는 옵션을 추가해주고, 그렇게 달린 댓글이나 대댓글에 알림이 가도록 해줘."` Author name is `"계정 이름으로 고정"`, and the rest of the proposal was approved with `"자 전부 만들자"`.

## Motivation

Board posts and comments currently rely on a display name and a 4-digit numeric password. Because the server does not know who authored an entry, it has no one to notify when a reply arrives. Posts written through an account belong to that account, so replies can push directly to its registered devices.

## Decisions

- Users signed in with an approved account (`player_accounts.status = 'approved'`) see a `"계정으로 쓰기"` option (on by default) when writing posts, comments, or nested replies. Selecting it hides the nickname and password fields, and the server sets the author name from the account's registered name (up to 20 characters, matching `streak_trainer_name`). Any name sent by the client is ignored.
- Account-authored posts and comments can only be edited or deleted by that account, without prompting for a password. Admins retain full delete permissions. Editing never changes the author name.
- Scope covers posts, comments, and nested replies on the `자유`, `샘플`, and `파티` boards. Private brackets are excluded because multiple people edit them with a shared management password.
- Account authors can read their own secret posts (admin-only) and comments underneath them, allowing them to open admin replies to suggestions after receiving a notification.
- Notification kind is `reply`, labeled `"내 글의 댓글"`, sent only to devices linked to the account. A comment or nested reply on a post notifies the post author; a nested reply on a comment notifies that comment's author. Self-replies send no notification. Newly enabled devices opt in by default. Quiet hours from 22:00 until 09:00 hold delivery until morning. Notifications for secret posts omit both title and body.
- No account badge is added. That would require new UI design, and locking the author name is sufficient.

## Non-goals

- No notifications for password-authored posts, since ownership is unknown.
- No way to claim or link existing posts to an account.
- No account posting on private brackets or by unapproved accounts.

## Architecture

1. Chosen approach: store only a public boolean `by_account` on `community_items`, and keep the item-to-account mapping in a locked table `community_authors` that visitors cannot read. Keep the single `community_write` RPC without changing its signature by reading a reserved `_byAccount` key from the payload, and enqueue notifications into `push_outbox` from a commit-time trigger. Account IDs never appear in public tables, and older clients keep working.
2. Rejected approach: adding an `author_user_id` column to `community_items`. Because the table is publicly readable, column-level permissions would be required and account IDs could easily leak.
3. Rejected approach: adding a parameter to `community_write`. PostgREST cannot disambiguate a 7-argument call across overloaded functions.

## Components

- `docs/db/push_kinds.sql`: add `reply` to the three kind lists (subscription, update, queue) and set the default for new subscriptions to `{notice,match,reply}`.
- `docs/db/community_accounts.sql` (new idempotent file, run after `push_kinds.sql`): add the `by_account` column, `community_authors`, `community_mine(id)`, read policies, updated `community_write`, and the `push_community_reply` notification trigger (runs at commit and never blocks writes on failure).
- Client: `authFetch` in `storage.js` falls back to the visitor token attached to the request when no admin session exists. `communityStore.js` reads and writes with the signed-in visitor's token, falling back to legacy columns if `by_account` is missing before SQL runs. Add `"계정으로 쓰기"` to all three write forms (posts, comments, and sample/party intros), skip password prompts in `authorize` for account posts, and add `"내 글의 댓글"` under `더보기` notification types.
- Verification: add account-posting and notification tests to `scripts/verify-push-db.mjs` (PGlite, real SQL), and verify the UI in Playwright with intercepted requests at 390 and 1440 in both themes.

## Rollout order

Run SQL first (admins re-run `push_kinds.sql`, then run `community_accounts.sql`), then deploy the site. Before the SQL runs, the site hides account posting and behaves as before.
