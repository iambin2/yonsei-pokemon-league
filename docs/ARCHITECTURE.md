# YPL technical architecture and data model

## 1. System and environment boundaries

YPL connects Team Builder, tournament operations, and Records in a single Event lifecycle.

```text
YPL Tools
└─ Team Builder

YPL Operations
├─ 공지 / Event / Registration
├─ official party submission
├─ participant confirmation / 대진표 / match
└─ record apply / revert

YPL Records
├─ trainers
├─ tournament archive
├─ Pokémon usage
└─ ranking
```

The normalized architecture verified in Test has been migrated and cut over to `ypl_schema_validation` on the new Production `YPL_DB` (`rqffrogcverfjqzjasax`, Seoul).

- In Production, active Event-linked competition runtime reads and writes only normalized facts in `ypl_schema_validation`. `public.site_data / ypl_data_v4` stays in place for site-level data and historical legacy compatibility.
- Test holds the regression and migration verification reference, along with clean production-candidate and rollback references.
- Old Production stays untouched as a rollback and archive source, not an active app source.

## 2. Data source boundary

### Active normalized Event

Official editions are tracked under three families in `competition_editions`: `regular`, `champions`, and `light`. Each new Event carries a `competition_edition_id`. Master, Rookie, and Team divisions of the regular PokéCup share the `regular` sequence. Champions Singles and Doubles, along with each Qualifier and Final, link explicitly to the same edition. The server reserves edition numbers under per-family locks. Historical records only register entries in the edition catalog without altering matches, parties, or points. See [COMPETITION_EDITIONS.md](COMPETITION_EDITIONS.md) for the full rules.

Canonical facts for new active Event-linked runtimes live in the normalized schema.

```text
Season
└─ Event
   ├─ EventRegistration
   │  └─ RegistrationSubmission revision
   │     └─ TeamSnapshot
   │        └─ TeamSnapshotMember
   ├─ Entry
   │  └─ EntryParticipant
   └─ BracketRuntime
      ├─ BracketEntrySlot
      ├─ BracketIdentityChange
      └─ formed Match
         └─ Result / RankingAward
```

- `BracketRuntime` is the discriminator for an active normalized bracket.
- `BracketEntrySlot` persists the actual draw position. Entry seed is not a draw slot.
- `BracketIdentityChange` logs identities created, linked, or modified by the runtime, along with rollback ownership.
- `Match` stores only formed nodes and winner facts.
- Bracket graphs, BYEs, unresolved future Matches, advancement edges, loser movement, and GF/reset activation are pure projections rather than persisted graphs.
- The `BracketDraw` animation is a presentation-only UI that reads stored projections. It never runs draws, changes slots, or writes Matches.

Official individual tournaments can use `groups_then_elimination`. They share the same Event and Entry records, storing group assignments in the `BracketEntrySlot` group stage and confirmed finals assignments in the elimination stage. Group round-robin matches, single-game tiebreakers, and finals use `group:`, `playoff:`, and `single:` or `double:` match keys. Standings sort by total group wins, head-to-head wins among tied players, and then re-applying the same rule to any remaining tied group. When an entire tied group advances or is eliminated together, players keep a shared rank. Finals are drawn without rank-based seeding. Only ties straddling the advancement cutoff trigger tiebreakers: the server randomly draws two players from the tied group for single-game matches until each spot is decided. Tiebreaker results do not count toward group wins. Once finals begin, group results lock; operators must cancel finals results and placements first to edit group matches. Final placements and points apply once during the existing record apply step.

In a unified intake, a same-edition Rookie champion whose records are finalized appears as a default candidate in the Master bracket. Only when confirming the final bracket does the server re-verify that championship and save a Master Registration and Entry for the same Player. The Rookie registration and party stay intact. The database script is `docs/db/group_brackets_and_rookie_candidates.sql`. For deployment, apply the DB change first, run `npm run build:battle` to build and deploy battle functions with the updated projection, and then deploy the matching frontend. All three components must read the same stage structure for automatic site-battle winner recording to work.

New active brackets are never saved to `public.site_data / ypl_data_v4.brackets`, and legacy graphs are never used as a fallback source. Active runtime must have zero legacy dependency.

The visitor area (free board, sample and party showcases, and private brackets) stores data row-by-row only in `public.community_items` (`src/services/communityStore.js`, `docs/db/visitor_gates.sql`). All writes go through `community_write`, RLS hides private posts, and the server checks passwords against `public.visitor_pins`, which visitors cannot read. This data has no path into Event, Registration, Result, RankingAward, titles, or Hall of Fame, and private brackets have no record apply flow (`tests/community.test.mjs`).

Private bracket edits submit the DB-issued `updatedAt` token as `_expectedUpdatedAt`. `community_write` compares tokens under a row lock so a late save from another device cannot overwrite earlier results. On conflict, the UI reloads the latest version and asks the user to re-enter their change. General board writes keep their existing format. The migration script is `docs/db/private_bracket_conflict_guard.sql`, and verification scope is documented in [COMPETITION_FLOW_VERIFICATION.md](COMPETITION_FLOW_VERIFICATION.md).

### Historical legacy compatibility

Legacy graphs in `site_data.ypl_data_v4.brackets` are allowed only for displaying completed historical brackets that meet all three conditions:

- Not an Event-linked active runtime.
- A pre-normalized completed bracket with no `eventId`.
- Read-only presentation only.

Historical brackets are excluded from winner edits, participant or party edits, deletion, record apply or revert, and active sync. Legacy compatibility is never a reason to revive the legacy active lifecycle.

## 3. Event, Registration, and Submission

### Event and Registration

`Event` is the canonical owner of season, event type, division, battle format, competition format, rules, schedule, and record lifecycle.

- Applications are stored as `EventRegistration`.
- Name-based linking is allowed only on `registration_name` within the same Event. Equality ignores only whitespace and letter case (`playerNameKey`); fuzzy matching and arbitrary selection among players with the same name are prohibited.
- One Player exists per player name, enforced by the unique index in `docs/db/player_name_unique.sql`. When an applicant enters an existing player's name, the form shows that player's recent tournament and asks for confirmation. A different person with the same name registers under the next open letter alias (`nextAliasName`, such as `이제빈 B`, `C`).
- Editing an existing Event keeps its original `season_id` and `round_number`.
- Completed or record-applied Events reject official submission writes.

### Unified Rookie and Master intake

`league_intakes` links one announcement to two Events, Rookie and Master. The announcement collects registrations together, and operators pick the league during bracket creation. Each Event still owns its own Registration, official submission, runtime, Result, RankingAward, and record completion state. New team tournaments are fixed to Master while historical Light team tournaments remain preserved.

Individual Master eligibility is based on prior individual Master participation or an individual Rookie or Light championship. Team tournaments do not count toward eligibility. The DB validates the target league and cross-league duplicates at insert time and re-validates them on EntryParticipant creation. The shared party submission flow routes to the Event that owns the Registration without copying Submission rows or final pointers. Downstream checks across both Events and announcement deletion run atomically in the database.

Unified intake and official edition extensions were applied to the Production DB on 2026-11-02. On any future reinstall, apply the DB scripts before deploying the frontend. Transition constraints, rollout order, and verification details are in `docs/LEAGUE_INTAKE.md` and `docs/COMPETITION_EDITIONS.md`.

### Official submission

An official party is an immutable revision chain, not a mutable Team Builder draft.

```text
EventRegistration
→ RegistrationSubmission(revision)
→ TeamSnapshot
→ TeamSnapshotMember
```

- Resubmitting creates a new Submission and Snapshot revision instead of updating an existing row.
- Event rules (`regulation_id`, `cup_rule_id`, `cup_rule_settings`) are authoritative.
- `submission_target_at` can drive operational warnings, but it never bypasses lifecycle state.
- `final_submission_id` is the official freeze pointer set at record apply, not a submission indicator.

### Record apply and roster reveal

Record apply freezes the latest Submission only for actual `EntryParticipant.registration_id` records. Result, RankingAward, freeze, Event completion, and Champions HOF commit together in one `apply_event_record` transaction, and `revert_event_record` rolls them back in one transaction (`docs/db/record_apply_rpc.sql`). The browser only computes the plan.

```text
EntryParticipant.registration_id
→ EventRegistration.final_submission_id
→ RegistrationSubmission
→ TeamSnapshot
→ TeamSnapshotMember
```

- A player who competed without submitting a party can still have a Result and participation history, with no roster or Pokémon usage recorded.
- A no-show who submitted a party without an actual EntryParticipant is excluded from official rosters and Pokémon usage.
- An `on_record_apply` Event that requires official roster reveal has `status=completed`, `record_applied_at`, and `team_revealed_at` set after apply.
- Revert rolls back Results and Awards, releases the freeze pointer, and clears the Event's reveal state while keeping immutable Submission and Snapshot history.
- A revealed normalized Event never backfills a participant without a final pointer from legacy party data.
- Titles live in `site_data.titleGroups` as name-based records outside the transaction. Titles selected by an operator after record apply record the Event ID in `grants` and `createdBy`, and reverting records rolls back only the recipients granted by that Event (`revertTitleAwards`).

## 4. Bracket runtime

### Creation and projection

Active Event-linked brackets follow this lifecycle:

```text
EventRegistration preflight
→ Entry / EntryParticipant confirmation
→ BracketRuntime + persisted slots
→ initial formed Match materialization
→ canonical projection refetch
→ Bracket UI
```

Single, Double, and Team runtimes all use this normalized lifecycle. Malformed Event ownership, slot sets, Entry identities, or Match topology fail closed instead of falling back to legacy graphs.

### Matches and standings

- Selecting, changing, or cancelling a winner updates canonical Match facts.
- Changing a winner clears stale downstream Matches and re-materializes only formed downstream nodes.
- Result records Entry placement facts, and Match or Result ownership never overwrites historical rows.
- Team Results are scoped to Team Entries and stay separate from member-level ranking payouts.

### Runtime deletion and rollback

Deleting a runtime is not a UI graph delete. It cleans up runtime-owned facts with clear ownership in FK-safe order:

```text
runtime-owned Match
→ BracketEntrySlot / BracketIdentityChange
→ EntryParticipant / Entry
→ runtime-created non-durable Registration / unreferenced Player
→ BracketRuntime
```

- Durable `EventRegistration` rows that have a Submission or a `final_submission_id` are never deleted.
- Player links on durable existing Registrations are not reverted on rollback.
- Only non-durable, runtime-created Registrations can be deleted.
- If the runtime changed the player link on a non-durable existing Registration and exact ownership is confirmed, rollback restores the previous player.
- A Player is deleted only when no other Registration, EntryParticipant, Match, RankingAward, or HOF row references it.
- Ambiguous ownership, durable downstream facts, or applied brackets fail closed.

## 5. Result, Ranking, and Records

### Result and RankingAward

`Result` and `RankingAward` represent separate facts.

- `Result` stores an Event Entry's champion, runner-up, or semifinalist placement.
- `RankingAward` stores the actual ledger delta for points, wins, runner-up finishes, and top-4 finishes.
- `RankingBaseline + RankingAward` is the canonical source for normalized rankings.

Award policy:

- Rookie events do not create `RankingAward` rows.
- Ordinary Master and Light events create `RankingAward` rows according to the current placement policy.
- Team placements remain in team history but are excluded from individual wins, runner-ups, and top-4 counts.
- Champions Qualifiers and Finals create no `RankingAward`, points delta, or season/series ranking delta.

The normalized ranking UI lists YPL and Classic normalized Seasons from newest to oldest and removes the legacy `+ 추가` mutation UI. Default Season order is YPL newest to oldest, followed by Classic newest to oldest.

### Records projection

Records projects completed official Events from normalized facts.

```text
Event → Entry → EntryParticipant → Player
Event → Match → Result
Event → RankingAward / RankingBaseline
EventRegistration.final_submission_id → official roster → Pokémon usage
```

When a linked legacy record exists for the same Event, Records suppresses the duplicate and shows only the normalized projection. Only historical compatibility Events keep legacy reads.

Rule display in Records uses `competition_settings.recordRuleLabel`.

- It is free text and hidden when empty.
- `cup_rule_id` is a technical identifier for Team Builder validation and enforcement, not a raw Records label.

## 6. Champions

### Pair and phase boundary

One Champions announcement creates a Qualifier and Final Event pair.

| Field | Qualifier | Final |
| --- | --- | --- |
| `battle_format` | `singles` or `doubles` | Same as pair |
| `competition_format` | `NULL` before creation, `single` or `double` chosen at creation | `NULL` before creation, `single` or `double` chosen at creation |
| `division` | `NULL` | `NULL` |
| Schedule | `qualifierHeldOn`, `qualifierSubmissionTargetAt` | `finalHeldOn`, `finalSubmissionTargetAt` |
| Registration / Submission / Snapshot | Qualifier-only X | Final-only Y |

`battle_format` is the Pokémon battle format and `competition_format` is the bracket topology. Keep the two separate.

Announcements do not set the bracket format. `create_selected_bracket_runtime` saves the admin's choice on the Event and creates the runtime in the same transaction. If creation fails, the format update rolls back, and requests to change the format of an existing runtime are rejected. Each league in a unified intake and each phase in Champions chooses its format independently. Editing an announcement preserves any format already chosen. The migration script is `docs/db/bracket_format_at_creation.sql`.

Qualifier X and Final Y share only Player identity. Submission, Snapshot, `final_submission_id`, and Registration are never copied, reused, or used as fallbacks across phases. Final official rosters and HOF read only Final Y.

### Direct selection and Qualifier setup

Qualifier setup follows four steps:

1. Select direct entrants from Qualifier `EventRegistration` rows and save them as normalized direct selection facts. The UI only recommends the top 4 applicants from the qualifier season ranking (`recommend_championship_direct_entrants`, `docs/db/champions_direct_recommendation.sql`). Operators make the actual selection.
2. Confirm actual Qualifier participants from the remaining non-direct Registrations.
3. Direct entrants and no-shows do not receive Qualifier Entries.
4. Only actual participants enter Entry/EntryParticipant and the admin-selected Single or Double Elimination runtime.

Given `finalCapacity = C`, direct entrant count `D`, and actual Qualifier participant count `A`:

```text
qualifierTarget Q = C - D
requiredEliminations E = A - Q
```

Operators do not type `qualification_slots` when drafting an announcement. Setup derives `Q` and saves it on the Qualifier runtime.

The Qualifier runs until `E` players are eliminated via Match facts (1 loss in Single Elimination, 2 losses in Double Elimination).

- While `eliminatedCount < E`, matches proceed and can be edited normally.
- Once `eliminatedCount = E`, new winner entries and downstream materialization stop, while corrections or cancellations on already-played deciding Matches remain allowed until apply.
- After qualifier apply, match mutations are blocked and require a reopen first.

A Qualifier never crowns a champion and never creates a fake final Match.

### Qualifier apply and reopen

Reaching the survivor count does not confirm Final entries on its own. When an operator runs Qualifier apply, an atomic flow re-validates direct entrants and survivors:

```text
persisted direct selection → ranking Advancement + Final EventRegistration
survivor Qualifier Entry → qualifier Advancement + Final EventRegistration
Qualifier → completed
```

- Final Registrations are created at this point, but Final Entries and Final Submissions are not, and `final_submission_id` stays `NULL`.
- Submission X from actual Qualifier participants is used only for Qualifier official rosters and usage.
- A Qualifier never creates Result, RankingAward, HOF, or champion/runner-up/semifinalist placements.
- Reopen and apply-revert are allowed only when no Final downstream facts exist. Even a Final Submission blocks reopen.
- After apply-revert, direct selections and played Qualifier Matches remain intact. Deleting the bracket before apply rolls back direct selections and runtime-owned qualifier facts.

### Final

Final candidates come from the Final `EventRegistration` rows created by Advancement. The Final wizard reuses ordinary participant confirmation to pick actual day-of participants.

- `finalCapacity` is the advancement capacity, not the actual bracket participant count.
- The Final wizard does not perform direct or ranking selection, mutate provenance, create arbitrary Registrations, or require submission completion to build a bracket.
- Manual replacement capability is preserved as a provenance fact without mixing it into the Final bracket creation UI.
- Final apply freezes only Final Submission Y for actual participants and creates Result, placement, and HOF records.
- Champions Finals do not create `RankingAward` rows.

### Champions Records and HOF

Qualifier and Final appear as one Champions tournament row in the Records archive.

- Qualifier-only archive rows are not displayed.
- Once the Final finishes, Final participants and results take precedence, and Qualifier-only actual participants merge in as `참가`.
- A Player who appears in both phases is shown once with their Final result.
- Trainer and Pokémon roster history preserves Qualifier X and Final Y as separate official rosters.

HOF entries are created only for the Final champion Result. The party comes from the Final frozen TeamSnapshot chain, Pokémon display names use the canonical Records localization pipeline, and artwork identity uses `pokemon_id`.

Champions uses a single ordinal. The ordinal finalized at Final record apply is shared by the paired Qualifier and Final `round_number` and `HallOfFameEntry.generation_number`. For example, `제7회 챔피언스` in Records and `7대 싱글 챔피언` in HOF share the same ordinal.

## 7. Announcement deletion

Announcement deletion runs a read-only preflight instead of a delete-then-restore flow.

Deletion is blocked if any of these downstream facts exist:

- `EventRegistration`
- `RegistrationSubmission`
- `Entry` or `EntryParticipant`
- `BracketRuntime` or `Match`
- `Result`, `RankingAward`, or `HallOfFameEntry`
- `record_applied_at`

When blocked, nothing is mutated across announcements, Events, or Registrations. Only a pristine Event clears its announcement reference and changes status to `cancelled`. Events are never physically deleted. For Champions, preflight checks both the Qualifier and Final pair.

## 8. Season and round numbering

### Event round number

A new Event's `round_number` is assigned automatically from existing non-cancelled Event history rather than parsed from the Event name.

| New Event | Sequence source | New round |
| --- | --- | --- |
| Rookie individual | Non-team Rookie max | `max + 1` |
| Master individual | Non-team Master max | `max + 1` |
| Light individual | Non-team Light max | `max + 1` |
| Team | Non-team Master max | `max + 1` |
| Champions pair | Champions max | `max + 1`, shared by Qualifier and Final |

Team Events read the Master sequence without advancing it themselves. If Team 37 follows Master 36, the next Master event can still be 37.

### Season rollover

`resolve_ypl_season_for_date(p_at)` maps an `Asia/Seoul` timestamp to a half-year window, and the private date-injection function `ensure_current_ypl_season_for_date(p_at)` creates the canonical Season row and sets YPL-only current status under an advisory transaction lock. The app calls the `ensure_current_ypl_season()` wrapper, which only uses DB `now()`, preventing `anon` callers from triggering rollovers with arbitrary dates. The anchor is `2026-09-01 KST = YPL 시즌 3`, rolling over every March 1 and September 1. Dates before the anchor fail closed without auto-creating rows.

- A partial unique index protects only `series='ypl' AND status='current'`. Rollover never modifies Classic rows or existing Event links.
- New ordinary Events and Champions Qualifier/Final pairs call the ensure RPC right before creation so they share the same YPL Season. Editing an existing Event or pair keeps its original `season_id` instead of moving it to the current Season.
- `pg_cron` is not used. Production calls the idempotent ensure RPC at current-season entry points. Anchors are `2026-09-01 = YPL 시즌 3`, `2027-03-01 = YPL 시즌 4`, and `2027-09-01 = YPL 시즌 5`.

## 9. Production migration and cutover

Production uses `ypl_schema_validation` on the new `YPL_DB` as its active normalized schema. `public.site_data / ypl_data_v4` remains for site-level data and historical legacy compatibility. Legacy graphs in `ypl_data_v4.brackets` are limited to read-only display of Event-unlinked pre-normalized completed brackets and are never used as a fallback for active Event-linked runtimes.

- Migration moved 22 normalized application tables, 26 functions, 174 constraints, 100 indexes, and 2 triggers.
- Source and destination matched on table row counts, non-empty data hashes, function/constraint/index/trigger catalog fingerprints, and table/function/schema ACL fingerprints.
- Orphan Events, Registrations, Entries, Submissions, Results, HOF rows, and broken `final_submission_id` pointers are all 0, and exactly one current YPL Season exists.
- Custom schema API exposure and `ypl_schema_validation` REST/RPC HTTP 200 responses were verified, and the production environment sets `VITE_YPL_DATA_SCHEMA=ypl_schema_validation`.
- Old Production stayed untouched as a rollback and archive source.

## 10. Security boundary

Client and UI checks are UX guards only, not the canonical integrity boundary. RPCs, services, and the database must independently validate Event ownership, phase, lifecycle state, exact Registration and Entry identity, and durable downstream facts, failing closed on error.

Since 2026-10-16, the Production DB has enforced write access (`docs/db/access_lockdown.sql`; rationale, verification, and rollback are in `docs/db-access-lockdown.md`).

- RLS is enabled on all 22 tables in `ypl_schema_validation` and on `public.site_data`. `anon` can read all of them. No visitor role can read `visitor_pins`.
- `anon` can write through only five paths: the visitor-space RPC `community_write` (SECURITY DEFINER, server checks each post's password); `event_registrations` INSERT for open Events (column-level grant plus the `visitor_apply` policy); the official party submission RPC `submit_registration_team_snapshot` (6-argument version, SECURITY DEFINER, requires the PIN set on first submission, which admins can clear via `reset_submission_pin`); push subscription RPCs `save_push_subscription` and `delete_push_subscription` (SECURITY DEFINER, `docs/db/announcement_push.sql`) along with `push_settings` and `set_push_kinds` for reading and updating notification categories on that single endpoint (SECURITY DEFINER, `docs/db/push_kinds.sql`); and `submit_announcement_response` (SECURITY DEFINER, `docs/db/backend_hardening.sql`), which appends one response to an enabled non-Event form without opening `ypl_data_v4`. `push_subscriptions` and `push_outbox` are closed to `anon`, endpoints must belong to known push services, and account links use only `auth.uid()` at save time (`docs/PUSH.md`).
- All other writes and admin RPC calls require the `authenticated` role, and the `admin_write` RLS policy requires `app_metadata.ypl_admin = true` in the JWT. Admins sign in through Supabase Auth (`signInAdmin` in `src/storage.js`).
- Champions RPCs run as SECURITY INVOKER and go through the same RLS policies. Only party submission, announcement push subscriptions, the `ensure_current_ypl_season` family, and the Qualifier direct-selection cleanup trigger remain SECURITY DEFINER.
- Neither `anon` nor `authenticated` has TRUNCATE privileges.
- `site_data` writes succeed only when the row's `revision` matches what was read (`src/services/revisionedRow.js`, trigger in `docs/db/backend_hardening.sql`). Rows that failed to load are never written, so a screen showing seed data cannot overwrite real data. For the same reason, the browser cache used for initial paint on return visits (`ypl-seen-site`, `siteDataService.js`) is display-only and never backs a save.
- Once an announcement form's `form.closesAt` (KST) passes, the DB rejects visitor applications via a `BEFORE INSERT` trigger on `event_registrations` for Event-linked forms and via `submit_announcement_response` for standalone forms (`docs/db/application_close.sql`). Late admin registrations are not blocked.
- Parties (`team_snapshots`, `team_snapshot_members`) are readable only when the submitted Event has `team_revealed_at` set or the caller is an admin. Client-side reveal checks alone do not stop direct REST queries (`docs/db/private_answers.sql`).
- Only answers to questions marked `public` stay in `form.responses` on `site_data` and `registration_data.answers`. All other answers are stripped before save into `public.form_private_answers` (keyed by response ID or registration ID), which only admins can read, and merged back in the admin view (`loadPrivateAnswers`). Changing a question's `public` flag later does not move existing answers.

Keep ACL lines in `docs/db/*.sql` aligned with this lockdown state. Never grant `anon` write access or admin RPC execution when adding tables or functions (`tests/championsApplicationEventPairRpc.test.mjs` checks this). Avoid broad table write grants, broad `anon` mutations, and ambiguous cascade cleanups.
