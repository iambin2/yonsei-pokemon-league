# Competition editions

Edition numbers belong to a tournament edition rather than the number of Event rows or participating divisions. `(family, round_number)` is unique in `competition_editions`, and every new Event links to it through `competition_edition_id`. Edition numbering continues across Season boundaries.

| Family | Included tournaments | Next edition baseline |
| --- | --- | --- |
| `regular` | Regular PokéCup individual Master/Rookie and Team | 38th after Team event `리전 워즈` (37th) |
| `champions` | Champions Singles/Doubles Qualifiers and Finals | 7th after past 6th |
| `light` | PokéCup Light, including historical Light Team | 8th after completed 7th |

Master and Rookie Events, or Singles/Doubles and Qualifier/Final Events, share one edition while each Event still owns its Registration, Entry, Submission/Snapshot, BracketRuntime, Result, and RankingAward. Even when a Team event is stored under `master` or includes Rookie players on a team, its edition family is `regular`. Champions Events have `division = NULL` and are distinguished by `event_type`.

Historical records only register their edition numbers in the catalog; migration does not alter existing Event rows, matches, points, or official parties. Champions editions 1 through 6 keep their `NULL` `battle_format` and phase values. Historical Events attach to their existing edition only if edited later, without reassigning a new round number.

## Storage

Only admins can call `reserve_competition_edition`. It reserves the next edition number under a per-family transaction advisory lock, and an Event trigger applies that number to the Event. The number shown in the browser is a preview only and is never trusted. Editing or retrying the same announcement keeps its existing edition. An edition reserved for a cancelled tournament is not reused for another tournament.

A regular unified intake reserves an edition once and applies it to both Master and Rookie Events. New Team events advance the same `regular` counter. Team and individual tournaments are never mixed in the same edition.

For Champions announcements, operators pick the battle format and then specify either `새 회차 생성` or an existing edition such as `7회에 더블 추가`. A format that already exists in an edition cannot be added again. The first format in a new edition reserves the 7th edition, and the other format can select and share the 7th. A Qualifier uses the edition of its linked Final. The Final's `registration_settings` receives only the edition link, without copying Qualifier applicants or submitted parties. Event names display Singles or Doubles.

## Rollout and verification

The `shared_competition_editions_and_round_reservation` migration was applied to Production `YPL_DB` on 2026-11-02. The `38회 NPC 공지` was explicitly corrected to link both Master and Rookie Events to `regular` edition 38. All 8 existing registrations kept their IDs, responses, and timestamps while being assigned to 3 Master and 5 Rookie slots. Runtime creation RPCs were tested on both sides with real applications and rolled back, and fingerprints matched for existing completed records, official parties, and points.

`node scripts/build-competition-edition-migration.mjs` bundles `competition_editions.sql`, the updated `league_intake.sql`, and the Champions pair save function into a single migration. Existing Champions advancement, finalize, and Hall of Fame RPCs are not replaced. Apply the DB migration before deploying the matching frontend.

The wrong round value (37) on `38회 NPC 공지` is fixed explicitly with `correct_pristine_event_round`. That function accepts only an open standalone individual Event that has no edition link and no Submissions, Entries, or brackets. The announcement then converts to unified intake while preserving registration IDs, responses, and timestamps. The completed 37th Team event is left untouched.

Isolated DB verification runs through `scripts/verify-league-intake-db.mjs`. Under actual runtime, submission, and record RPCs with RLS active, it checks all three families, both divisions sharing an edition, Champions Singles and Doubles, existing application migration, eligibility re-validation, and independent records, points, and revert flows per division. In the UI, switching divisions clears the applicant selection and loads only the selected division's roster.
