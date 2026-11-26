# Competition flow verification

Verified on 2026-11-02 against the Production DB and current frontend. All 446 `npm test` cases, 20 isolated PostgreSQL integration checks, and the production build passed.

## Results by competition type

| Type | Verified behavior |
| --- | --- |
| Regular PokéCup | Collects applications under one announcement and assigns Master or Rookie from history. Both divisions share an edition while each Event owns its registrations, bracket, submitted parties, and record apply/revert. Keeps Master points and Rookie zero-point policy. |
| Team | New Team events lock to Master and advance the regular PokéCup edition counter. Awards 30/20 points per champion/runner-up team member without granting individual Master eligibility. Verified party submission freeze and revert. |
| Champions | Singles and Doubles Qualifiers and Finals share the 7th edition. Verified 2-loss elimination in a real Double graph, Final registration creation for 1 direct entrant and 2 survivors, day-of participant selection, separate Final party submission, coexistence of two 7th champions in HOF, and reverting one side. Neither phase creates ranking points. |
| Light | Assigns the 8th edition after historical 7th. Keeps ranking exclusion for new announcements while counting individual wins toward Master eligibility. Verified party submission freeze and revert. |
| General tournament | Keeps `pokecup` with `division=other`, excluded from editions and rankings. An older `rankingEnabled=true` flag is not inferred as Master points. |
| Private bracket | Verified 2 to 64 players in Single and Double formats, BYE distribution, and payload size. Verified PIN validation, preservation of other rows, blocking direct anonymous writes, and rejecting stale-version saves. Not linked to official Events or records. |

`scripts/verify-league-intake-db.mjs <PGlite dist/index.js>` runs `scripts/competition-flow-checks.mjs` alongside it. The suite does not connect to Supabase; it executes the real SQL functions and frontend projection/points logic under admin and `anon` roles with RLS enabled.

## Existing seminar events

In Production DB, `배틀부 세미나 미니대회` Group 1 and Group 2 already have `event_type=pokecup`, `division=other`, `officialEvent=false`, and `rankingEnabled=false`. Both `round_number` and `competition_edition_id` are `NULL`. Existing Events, registrations, Entries, and runtimes are not recreated or changed to a `NULL` `event_type`.

All winners are entered for Group 1 (7 players, 6 matches) and Group 2 (6 players, 5 matches), while both Events remain `running` with records not yet applied. This verification did not modify existing matches or record-apply state. The announcement editor and record confirmation views label them as general tournaments, and new announcements also offer the general tournament option.

The actual announcement editor component was checked at 390px and 1440px. Existing seminar drafts keep their names, `other` division, and existing Event links, and new general tournaments save without an edition and with rankings disabled.

## Production DB verification

The `guard_private_bracket_concurrent_saves` migration was applied. It keeps existing PIN, RLS, and permission boundaries on `community_write` while adding a version check only for private bracket saves. If a fresh read differs from the version displayed on screen, input stops immediately so a prior winner selection is not applied to another device's redraw. The DB issues an `updatedAt` token and compares `_expectedUpdatedAt` against the current token under a row lock to block races that happen after the read. On mismatch, it returns `stale` without saving. Older clients without a token are prompted to reload, and the general board keeps its existing write format.

Two verification suites ran against Production functions, each rolled back in full inside a transaction:

1. PIN and RLS enforcement, blocking the second of two same-version saves, retrying with the latest token, preserving other private rows, and editing or PIN-deleting general board posts.
2. Next edition for regular unified intake, next edition for Team, rejecting Rookie Team, next edition for Light, excluding general tournaments from editions, and sharing an edition across Champions Singles/Doubles Qualifiers and Finals.

Row counts and full-row fingerprints across all 22 tables matched before and after verification. No test tournaments, registrations, private brackets, or points remained in Production. Existing seminar events, the 37th Team event, and 38th registrations were preserved.
