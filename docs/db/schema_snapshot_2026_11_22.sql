-- 운영 데이터베이스(Supabase rqffrogcverfjqzjasax)의 구조 스냅숏, 2026-11-22. 실행하는 파일이 아니라 읽는 파일이다.
-- 읽기 전용 카탈로그 조회로 만들었다: 표와 열, 제약, 색인, RLS 정책, 트리거, 뷰, 권한, 함수 서명, 확장, 예약 작업.
-- 함수 본문은 담지 않았다. 모든 함수가 docs/db 의 어느 파일과 같다(docs/db/README.md 장부). 완전한 덤프는 README의 "빈 프로젝트에서 다시 만들 때".
-- 데이터(행)는 담지 않는다. 데이터는 주간 암호화 백업(.github/workflows/backup.yml)에 있다.

-- ===== 표와 열 =====
create table public.account_teams (
  "auth_user_id" uuid not null default auth.uid(),
  "id" text not null,
  "name" text not null,
  "team" jsonb not null,
  "regulation" text not null default ''::text,
  "updated_at" timestamp with time zone not null default now()
);

create table public.battle_secrets (
  "battle_id" text not null,
  "p1_token_hash" text not null,
  "p2_token_hash" text,
  "p1_team" jsonb not null,
  "state" jsonb,
  "pending" jsonb not null default '{}'::jsonb,
  "room_code" text,
  "cpu_memory" jsonb
);

create table public.battles (
  "id" text not null,
  "regulation" text not null,
  "format_id" text not null,
  "engine" text not null,
  "status" text not null default 'waiting'::text,
  "p1_name" text not null,
  "p2_name" text,
  "turn" integer not null default 0,
  "winner" text,
  "ended_by" text,
  "spectator_log" text not null default ''::text,
  "log" text,
  "input_log" text,
  "version" integer not null default 0,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  "kind" text not null default 'friendly'::text,
  "event_id" uuid,
  "source_node_key" text,
  "p1_entry_id" uuid,
  "p2_entry_id" uuid,
  "p1_player_id" uuid,
  "p2_player_id" uuid,
  "applied_at" timestamp with time zone,
  "apply_error" text,
  "deadline_at" timestamp with time zone,
  "room" text,
  "rematch_id" text,
  "run_id" uuid,
  "p1_auth_user_id" uuid,
  "p2_auth_user_id" uuid,
  "started_at" timestamp with time zone,
  "ended_at" timestamp with time zone,
  "p1_submission_id" uuid,
  "p2_submission_id" uuid
);

create table public.community_authors (
  "item_id" text not null,
  "auth_user_id" uuid not null
);

create table public.community_items (
  "id" text not null,
  "board" text not null,
  "parent_id" text,
  "payload" jsonb not null,
  "secret" boolean not null default false,
  "has_pin" boolean not null default false,
  "created_at" timestamp with time zone not null default now(),
  "by_account" boolean not null default false
);

create table public.cpu_battles (
  "id" text not null,
  "format_id" text not null,
  "engine" text not null,
  "winner" text not null,
  "ended_by" text not null,
  "turns" integer not null,
  "input_log" text not null,
  "created_at" timestamp with time zone not null default now(),
  "level" text
);

create table public.form_private_answers (
  "subject" text not null,
  "answers" jsonb not null,
  "created_at" timestamp with time zone not null default now()
);

create table public.player_accounts (
  "auth_user_id" uuid not null,
  "email" text,
  "account_name" text,
  "requested_name" text not null,
  "name_key" text default lower(regexp_replace(requested_name, '\s'::text, ''::text, 'g'::text)),
  "player_id" uuid,
  "status" text not null default 'pending'::text,
  "requested_at" timestamp with time zone not null default now(),
  "decided_at" timestamp with time zone
);

create table public.push_outbox (
  "id" bigint not null,
  "dedup" text not null,
  "kind" text not null,
  "auth_user_id" uuid,
  "title" text not null,
  "body" text not null,
  "url" text not null,
  "created_at" timestamp with time zone not null default now(),
  "taken_at" timestamp with time zone
);

create table public.push_subscriptions (
  "endpoint" text not null,
  "p256dh" text not null,
  "auth" text not null,
  "created_at" timestamp with time zone not null default now(),
  "kinds" text[] not null default '{notice,match,reply}'::text[],
  "auth_user_id" uuid,
  "board_pushed_at" timestamp with time zone not null default now(),
  "tower_pushed_at" timestamp with time zone
);

create table public.site_data (
  "key" text not null,
  "value" jsonb not null,
  "revision" bigint not null default 0
);

create table public.streak_runs (
  "id" uuid not null default gen_random_uuid(),
  "auth_user_id" uuid not null,
  "trainer_name" text not null,
  "format_id" text not null,
  "month" date not null,
  "wins" integer not null default 0,
  "status" text not null default 'active'::text,
  "battle_id" text,
  "started_at" timestamp with time zone not null default now(),
  "last_win_at" timestamp with time zone,
  "ended_at" timestamp with time zone,
  "lives" integer not null default 2,
  "offer" jsonb,
  "daily" date
);

create table public.tower_archive (
  "battle_id" text not null,
  "run_id" uuid not null,
  "month" date not null,
  "format_id" text not null,
  "p1_name" text not null,
  "p2_name" text,
  "winner" text,
  "ended_by" text,
  "turn" integer not null,
  "spectator_log" text not null,
  "input_log" text,
  "created_at" timestamp with time zone not null,
  "archived_at" timestamp with time zone not null default now()
);

create table public.tower_cup_players (
  "cup_id" uuid not null,
  "auth_user_id" uuid not null,
  "trainer_name" text not null,
  "joined_at" timestamp with time zone not null default now()
);

create table public.tower_cup_runs (
  "cup_id" uuid not null,
  "run_id" uuid not null,
  "auth_user_id" uuid not null,
  "nth" integer not null,
  "wins" integer not null default 0,
  "reached_at" timestamp with time zone not null default now()
);

create table public.tower_cups (
  "id" uuid not null default gen_random_uuid(),
  "title" text not null,
  "host_user" uuid not null,
  "host_name" text not null,
  "starts_at" timestamp with time zone not null,
  "ends_at" timestamp with time zone not null,
  "room" text not null,
  "code" text,
  "run_limit" integer,
  "created_at" timestamp with time zone not null default now()
);

create table public.visitor_pins (
  "scope" text not null,
  "subject" text not null,
  "pin_hash" text not null,
  "failed_attempts" integer not null default 0,
  "locked_until" timestamp with time zone
);

create table ypl_audit.change_log (
  "id" bigint not null,
  "at" timestamp with time zone not null default now(),
  "actor" uuid,
  "actor_email" text,
  "actor_role" text,
  "table_name" text not null,
  "op" text not null,
  "row_id" text,
  "old" jsonb,
  "new" jsonb
);

create table ypl_backup.event_registrations_20261104 (
  "id" uuid,
  "registration_data" jsonb
);

create table ypl_backup.site_data_20261005 (
  "key" text,
  "value" jsonb
);

create table ypl_backup.site_data_20261103 (
  "key" text,
  "value" jsonb,
  "revision" bigint
);

create table ypl_backup.site_data_20261104 (
  "key" text,
  "value" jsonb,
  "revision" bigint
);

create table ypl_backup.site_data_20261106_notice_copy (
  "key" text,
  "value" jsonb,
  "revision" bigint
);

create table ypl_schema_validation.bracket_entry_slots (
  "bracket_runtime_id" uuid not null,
  "event_id" uuid not null,
  "stage_kind" text not null,
  "stage_no" smallint not null,
  "pool_no" smallint not null default 0,
  "slot_no" integer not null,
  "entry_id" uuid not null,
  "created_at" timestamp with time zone not null default now()
);

create table ypl_schema_validation.bracket_identity_changes (
  "bracket_runtime_id" uuid not null,
  "event_id" uuid not null,
  "entry_participant_id" uuid not null,
  "entry_id" uuid not null,
  "registration_id" uuid not null,
  "player_id" uuid not null,
  "player_was_created" boolean not null default false,
  "registration_was_created" boolean not null default false,
  "registration_player_was_changed" boolean not null default false,
  "previous_registration_player_id" uuid,
  "entry_was_created" boolean not null default false,
  "entry_participant_was_created" boolean not null default false,
  "created_at" timestamp with time zone not null default now()
);

create table ypl_schema_validation.bracket_runtimes (
  "id" uuid not null default gen_random_uuid(),
  "event_id" uuid not null,
  "topology_kind" text not null,
  "projection_version" smallint not null default 1,
  "previous_event_status" text not null,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  "group_advance" smallint,
  "group_final_format" text,
  "round_schedule" jsonb not null default '{}'::jsonb
);

create table ypl_schema_validation.championship_advancements (
  "id" uuid not null default gen_random_uuid(),
  "final_registration_id" uuid not null,
  "source_entry_id" uuid,
  "advancement_type" text not null,
  "reason" text,
  "created_at" timestamp with time zone not null default now(),
  "direct_selection_id" uuid
);

create table ypl_schema_validation.championship_qualifier_direct_selections (
  "id" uuid not null default gen_random_uuid(),
  "qualifier_event_id" uuid not null,
  "qualifier_registration_id" uuid not null,
  "player_id" uuid not null,
  "created_at" timestamp with time zone not null default now()
);

create table ypl_schema_validation.competition_editions (
  "id" uuid not null default gen_random_uuid(),
  "family" text not null,
  "round_number" integer not null,
  "created_at" timestamp with time zone not null default now()
);

create table ypl_schema_validation.entries (
  "id" uuid not null default gen_random_uuid(),
  "event_id" uuid not null,
  "entry_type" text not null,
  "display_name" text,
  "seed" integer,
  "status" text not null default 'active'::text,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now()
);

create table ypl_schema_validation.entry_participants (
  "id" uuid not null default gen_random_uuid(),
  "event_id" uuid not null,
  "entry_id" uuid not null,
  "registration_id" uuid not null,
  "player_id" uuid not null,
  "member_order" smallint not null default 1,
  "role" text,
  "created_at" timestamp with time zone not null default now()
);

create table ypl_schema_validation.event_registrations (
  "id" uuid not null default gen_random_uuid(),
  "event_id" uuid not null,
  "player_id" uuid,
  "registration_name" text not null,
  "registration_data" jsonb not null default '{}'::jsonb,
  "registration_source" text not null default 'application'::text,
  "registered_at" timestamp with time zone,
  "final_submission_id" uuid,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now()
);

create table ypl_schema_validation.events (
  "id" uuid not null default gen_random_uuid(),
  "season_id" uuid,
  "name" text not null,
  "round_number" integer,
  "event_type" text not null,
  "division" text,
  "battle_format" text,
  "competition_format" text,
  "competition_settings" jsonb not null default '{}'::jsonb,
  "is_team_event" boolean not null default false,
  "regulation_id" text,
  "cup_rule_id" text,
  "cup_rule_settings" jsonb not null default '{}'::jsonb,
  "registration_settings" jsonb not null default '{}'::jsonb,
  "held_on" date,
  "date_precision" text not null default 'exact'::text,
  "record_completeness" text not null default 'partial'::text,
  "status" text not null default 'planned'::text,
  "submission_target_at" timestamp with time zone,
  "team_reveal_mode" text not null default 'on_record_apply'::text,
  "team_reveal_at" timestamp with time zone,
  "team_revealed_at" timestamp with time zone,
  "record_applied_at" timestamp with time zone,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  "championship_phase" text,
  "championship_final_event_id" uuid,
  "qualification_slots" integer,
  "competition_edition_id" uuid
);

create table ypl_schema_validation.hall_of_fame_entries (
  "id" uuid not null default gen_random_uuid(),
  "event_id" uuid not null,
  "result_id" uuid not null,
  "player_id" uuid not null,
  "generation_number" integer not null,
  "generation_label" text,
  "image_ref" text,
  "note" text,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now()
);

create table ypl_schema_validation.league_intakes (
  "id" uuid not null default gen_random_uuid(),
  "announcement_id" text not null,
  "master_event_id" uuid not null,
  "rookie_event_id" uuid not null,
  "created_at" timestamp with time zone not null default now()
);

create table ypl_schema_validation.matches (
  "id" uuid not null default gen_random_uuid(),
  "event_id" uuid not null,
  "parent_match_id" uuid,
  "match_kind" text not null,
  "round_number" smallint,
  "stage_label" text,
  "sequence_no" integer,
  "entry_a_id" uuid,
  "entry_b_id" uuid,
  "player_a_id" uuid,
  "player_b_id" uuid,
  "winner_entry_id" uuid,
  "winner_player_id" uuid,
  "resolution" text not null default 'played'::text,
  "source" text not null,
  "source_node_key" text,
  "played_at" timestamp with time zone,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  "score_a" smallint,
  "score_b" smallint,
  "table_label" text
);

create table ypl_schema_validation.player_partners (
  "id" uuid not null default gen_random_uuid(),
  "player_id" uuid not null,
  "pokemon_id" text,
  "pokemon_name_snapshot" text not null,
  "source" text not null,
  "created_at" timestamp with time zone not null default now(),
  "revoked_at" timestamp with time zone
);

create table ypl_schema_validation.players (
  "id" uuid not null default gen_random_uuid(),
  "display_name" text not null,
  "status" text not null default 'active'::text,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now()
);

create table ypl_schema_validation.ranking_awards (
  "id" uuid not null default gen_random_uuid(),
  "event_id" uuid not null,
  "player_id" uuid not null,
  "result_id" uuid,
  "award_kind" text not null,
  "points_delta" numeric(10,2) not null default 0,
  "win_delta" integer not null default 0,
  "runner_up_delta" integer not null default 0,
  "top4_delta" integer not null default 0,
  "counts_series" boolean not null default true,
  "counts_season" boolean not null default true,
  "related_award_id" uuid,
  "reason" text,
  "source" text not null,
  "created_at" timestamp with time zone not null default now()
);

create table ypl_schema_validation.ranking_baselines (
  "id" uuid not null default gen_random_uuid(),
  "player_id" uuid not null,
  "scope" text not null,
  "series" text,
  "season_id" uuid,
  "points" numeric(10,2) not null default 0,
  "wins" integer not null default 0,
  "runner_ups" integer not null default 0,
  "top4s" integer not null default 0,
  "source" text not null,
  "captured_at" timestamp with time zone not null default now(),
  "note" text
);

create table ypl_schema_validation.registration_submissions (
  "id" uuid not null default gen_random_uuid(),
  "registration_id" uuid not null,
  "snapshot_id" uuid not null,
  "revision" integer not null,
  "submitted_at" timestamp with time zone,
  "source" text not null default 'team_builder'::text,
  "created_at" timestamp with time zone not null default now()
);

create table ypl_schema_validation.results (
  "id" uuid not null default gen_random_uuid(),
  "event_id" uuid not null,
  "entry_id" uuid not null,
  "placement_code" text not null,
  "rank_min" smallint,
  "rank_max" smallint,
  "placement_label" text not null,
  "source" text not null,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now()
);

create table ypl_schema_validation.seasons (
  "id" uuid not null default gen_random_uuid(),
  "code" text not null,
  "name" text not null,
  "series" text,
  "number" smallint,
  "starts_on" date,
  "ends_on" date,
  "sort_order" integer not null default 0,
  "status" text not null default 'past'::text,
  "created_at" timestamp with time zone not null default now()
);

create table ypl_schema_validation.team_snapshot_members (
  "id" uuid not null default gen_random_uuid(),
  "snapshot_id" uuid not null,
  "slot" smallint not null,
  "pokemon_id" text,
  "pokemon_name_snapshot" text not null,
  "ability_id" text,
  "nature_id" text,
  "stat_hp" smallint not null default 0,
  "stat_atk" smallint not null default 0,
  "stat_def" smallint not null default 0,
  "stat_spa" smallint not null default 0,
  "stat_spd" smallint not null default 0,
  "stat_spe" smallint not null default 0,
  "item_id" text,
  "move_1_id" text,
  "move_2_id" text,
  "move_3_id" text,
  "move_4_id" text
);

create table ypl_schema_validation.team_snapshots (
  "id" uuid not null default gen_random_uuid(),
  "schema_version" smallint not null default 1,
  "regulation_id" text,
  "cup_rule_id" text,
  "cup_rule_settings" jsonb not null default '{}'::jsonb,
  "source_type" text not null default 'manual'::text,
  "source_reference" text,
  "imported_at" timestamp with time zone,
  "created_at" timestamp with time zone not null default now()
);

create table ypl_schema_validation.title_awards (
  "id" uuid not null default gen_random_uuid(),
  "title_id" uuid not null,
  "player_id" uuid not null,
  "event_id" uuid,
  "result_id" uuid,
  "source" text not null,
  "reason" text,
  "awarded_at" timestamp with time zone default now(),
  "revoked_at" timestamp with time zone
);

create table ypl_schema_validation.title_definitions (
  "id" uuid not null default gen_random_uuid(),
  "code" text not null,
  "name" text not null,
  "description" text,
  "group_code" text,
  "award_mode" text not null,
  "sort_order" integer not null default 0,
  "active" boolean not null default true,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now()
);

-- ===== 제약 =====
alter table public.account_teams add constraint "account_teams_id_check" CHECK (((char_length(id) >= 1) AND (char_length(id) <= 64)));
alter table public.account_teams add constraint "account_teams_name_check" CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 40)));
alter table public.account_teams add constraint "account_teams_regulation_check" CHECK ((char_length(regulation) <= 24));
alter table public.account_teams add constraint "account_teams_team_check" CHECK (((jsonb_typeof(team) = 'object'::text) AND (octet_length((team)::text) <= 16384)));
alter table public.account_teams add constraint "account_teams_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.account_teams add constraint "account_teams_pkey" PRIMARY KEY (auth_user_id, id);
alter table public.battle_secrets add constraint "battle_secrets_room_code_check" CHECK (((room_code IS NULL) OR (room_code ~ '^[0-9]{4}$'::text)));
alter table public.battle_secrets add constraint "battle_secrets_battle_id_fkey" FOREIGN KEY (battle_id) REFERENCES battles(id) ON DELETE CASCADE;
alter table public.battle_secrets add constraint "battle_secrets_pkey" PRIMARY KEY (battle_id);
alter table public.battles add constraint "battles_check" CHECK (((status = 'ended'::text) = ((winner IS NOT NULL) AND (log IS NOT NULL) AND (input_log IS NOT NULL))));
alter table public.battles add constraint "battles_ended_by_check" CHECK ((ended_by = ANY (ARRAY['battle'::text, 'forfeit'::text, 'void'::text, 'timeout'::text])));
alter table public.battles add constraint "battles_id_check" CHECK ((id ~ '^[a-z0-9]{12}$'::text));
alter table public.battles add constraint "battles_kind" CHECK (((kind = ANY (ARRAY['friendly'::text, 'official'::text, 'streak'::text])) AND ((kind = ANY (ARRAY['friendly'::text, 'streak'::text])) = ((event_id IS NULL) AND (source_node_key IS NULL)))));
alter table public.battles add constraint "battles_p1_name_check" CHECK (((char_length(btrim(p1_name)) >= 1) AND (char_length(btrim(p1_name)) <= 20)));
alter table public.battles add constraint "battles_p2_name_check" CHECK (((char_length(btrim(p2_name)) >= 1) AND (char_length(btrim(p2_name)) <= 20)));
alter table public.battles add constraint "battles_regulation_check" CHECK ((regulation ~ '^[a-z0-9-]{1,12}$'::text));
alter table public.battles add constraint "battles_room_check" CHECK (((room IS NULL) OR (room = ANY (ARRAY['open'::text, 'code'::text]))));
alter table public.battles add constraint "battles_run_kind" CHECK (((kind = 'streak'::text) = (run_id IS NOT NULL)));
alter table public.battles add constraint "battles_status_check" CHECK ((status = ANY (ARRAY['waiting'::text, 'active'::text, 'ended'::text])));
alter table public.battles add constraint "battles_winner_check" CHECK ((winner = ANY (ARRAY['p1'::text, 'p2'::text, 'tie'::text])));
alter table public.battles add constraint "battles_p1_auth_user_id_fkey" FOREIGN KEY (p1_auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.battles add constraint "battles_p2_auth_user_id_fkey" FOREIGN KEY (p2_auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.battles add constraint "battles_run_fk" FOREIGN KEY (run_id) REFERENCES streak_runs(id) ON DELETE SET NULL;
alter table public.battles add constraint "battles_pkey" PRIMARY KEY (id);
alter table public.community_authors add constraint "community_authors_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.community_authors add constraint "community_authors_item_id_fkey" FOREIGN KEY (item_id) REFERENCES community_items(id) ON DELETE CASCADE;
alter table public.community_authors add constraint "community_authors_pkey" PRIMARY KEY (item_id);
alter table public.community_items add constraint "community_items_board_check" CHECK ((board = ANY (ARRAY['free'::text, 'showcase'::text, 'private_bracket'::text])));
alter table public.community_items add constraint "community_items_payload_check" CHECK (((jsonb_typeof(payload) = 'object'::text) AND (octet_length((payload)::text) <= 32768)));
alter table public.community_items add constraint "community_items_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES community_items(id) ON DELETE CASCADE;
alter table public.community_items add constraint "community_items_pkey" PRIMARY KEY (id);
alter table public.community_items add constraint "push_community_reply" TRIGGER DEFERRABLE INITIALLY DEFERRED;
alter table public.cpu_battles add constraint "cpu_battles_ended_by_check" CHECK ((ended_by = ANY (ARRAY['battle'::text, 'forfeit'::text])));
alter table public.cpu_battles add constraint "cpu_battles_format_id_check" CHECK ((format_id ~ '^[a-z0-9]{1,40}$'::text));
alter table public.cpu_battles add constraint "cpu_battles_id_check" CHECK ((id ~ '^[0-9a-f]{64}$'::text));
alter table public.cpu_battles add constraint "cpu_battles_input_log_check" CHECK ((octet_length(input_log) <= 262144));
alter table public.cpu_battles add constraint "cpu_battles_level_check" CHECK (((level IS NULL) OR (level ~ '^[a-z0-9-]{1,20}$'::text)));
alter table public.cpu_battles add constraint "cpu_battles_turns_check" CHECK ((turns >= 0));
alter table public.cpu_battles add constraint "cpu_battles_winner_check" CHECK ((winner = ANY (ARRAY['p1'::text, 'p2'::text, 'tie'::text])));
alter table public.cpu_battles add constraint "cpu_battles_pkey" PRIMARY KEY (id);
alter table public.form_private_answers add constraint "form_private_answers_pkey" PRIMARY KEY (subject);
alter table public.player_accounts add constraint "player_accounts_requested_name_check" CHECK (((char_length(btrim(requested_name)) >= 1) AND (char_length(btrim(requested_name)) <= 40)));
alter table public.player_accounts add constraint "player_accounts_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
alter table public.player_accounts add constraint "player_accounts_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.player_accounts add constraint "player_accounts_player_id_fkey" FOREIGN KEY (player_id) REFERENCES ypl_schema_validation.players(id) ON DELETE SET NULL;
alter table public.player_accounts add constraint "player_accounts_pkey" PRIMARY KEY (auth_user_id);
alter table public.push_outbox add constraint "push_outbox_body_check" CHECK ((char_length(body) <= 200));
alter table public.push_outbox add constraint "push_outbox_kind_check" CHECK ((kind = ANY (ARRAY['notice'::text, 'schedule'::text, 'match'::text, 'tower'::text, 'record'::text, 'reply'::text, 'daily'::text])));
alter table public.push_outbox add constraint "push_outbox_title_check" CHECK ((char_length(title) <= 40));
alter table public.push_outbox add constraint "push_outbox_url_check" CHECK ((url ~ '^\?view='::text));
alter table public.push_outbox add constraint "push_outbox_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.push_outbox add constraint "push_outbox_pkey" PRIMARY KEY (id);
alter table public.push_outbox add constraint "push_outbox_dedup_key" UNIQUE (dedup);
alter table public.push_subscriptions add constraint "push_subscriptions_auth_check" CHECK ((length(auth) <= 64));
alter table public.push_subscriptions add constraint "push_subscriptions_endpoint_check" CHECK (((length(endpoint) <= 1024) AND (endpoint ~ '^https://(fcm\.googleapis\.com|[a-z0-9.-]+\.push\.apple\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com)/'::text)));
alter table public.push_subscriptions add constraint "push_subscriptions_kinds" CHECK ((kinds <@ ARRAY['notice'::text, 'board'::text, 'schedule'::text, 'match'::text, 'tower'::text, 'record'::text, 'reply'::text, 'daily'::text]));
alter table public.push_subscriptions add constraint "push_subscriptions_p256dh_check" CHECK ((length(p256dh) <= 256));
alter table public.push_subscriptions add constraint "push_subscriptions_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.push_subscriptions add constraint "push_subscriptions_pkey" PRIMARY KEY (endpoint);
alter table public.site_data add constraint "site_data_max_512kb" CHECK ((octet_length((value)::text) <= 524288));
alter table public.site_data add constraint "site_data_no_inline_images" CHECK ((POSITION(('data:image'::text) IN ((value)::text)) = 0));
alter table public.site_data add constraint "site_data_pkey" PRIMARY KEY (key);
alter table public.streak_runs add constraint "streak_runs_check" CHECK (((status = 'ended'::text) = (ended_at IS NOT NULL)));
alter table public.streak_runs add constraint "streak_runs_check1" CHECK (((wins = 0) = (last_win_at IS NULL)));
alter table public.streak_runs add constraint "streak_runs_lives_check" CHECK (((lives >= 0) AND (lives <= 3)));
alter table public.streak_runs add constraint "streak_runs_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'ended'::text])));
alter table public.streak_runs add constraint "streak_runs_trainer_name_check" CHECK (((char_length(btrim(trainer_name)) >= 1) AND (char_length(btrim(trainer_name)) <= 40)));
alter table public.streak_runs add constraint "streak_runs_wins_check" CHECK ((wins >= 0));
alter table public.streak_runs add constraint "streak_runs_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.streak_runs add constraint "streak_runs_battle_id_fkey" FOREIGN KEY (battle_id) REFERENCES battles(id) ON DELETE SET NULL;
alter table public.streak_runs add constraint "streak_runs_pkey" PRIMARY KEY (id);
alter table public.tower_archive add constraint "tower_archive_pkey" PRIMARY KEY (battle_id);
alter table public.tower_cup_players add constraint "tower_cup_players_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.tower_cup_players add constraint "tower_cup_players_cup_id_fkey" FOREIGN KEY (cup_id) REFERENCES tower_cups(id) ON DELETE CASCADE;
alter table public.tower_cup_players add constraint "tower_cup_players_pkey" PRIMARY KEY (cup_id, auth_user_id);
alter table public.tower_cup_runs add constraint "tower_cup_runs_cup_id_fkey" FOREIGN KEY (cup_id) REFERENCES tower_cups(id) ON DELETE CASCADE;
alter table public.tower_cup_runs add constraint "tower_cup_runs_run_id_fkey" FOREIGN KEY (run_id) REFERENCES streak_runs(id) ON DELETE CASCADE;
alter table public.tower_cup_runs add constraint "tower_cup_runs_pkey" PRIMARY KEY (cup_id, run_id);
alter table public.tower_cups add constraint "tower_cups_check" CHECK ((((room = 'code'::text) AND (code ~ '^[0-9]{4}$'::text)) OR ((room = 'open'::text) AND (code IS NULL))));
alter table public.tower_cups add constraint "tower_cups_check1" CHECK (((ends_at > starts_at) AND (ends_at <= (starts_at + '31 days'::interval))));
alter table public.tower_cups add constraint "tower_cups_room_check" CHECK ((room = ANY (ARRAY['open'::text, 'code'::text])));
alter table public.tower_cups add constraint "tower_cups_run_limit_check" CHECK (((run_limit IS NULL) OR ((run_limit >= 1) AND (run_limit <= 20))));
alter table public.tower_cups add constraint "tower_cups_title_check" CHECK (((char_length(btrim(title)) >= 1) AND (char_length(btrim(title)) <= 24)));
alter table public.tower_cups add constraint "tower_cups_host_user_fkey" FOREIGN KEY (host_user) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.tower_cups add constraint "tower_cups_pkey" PRIMARY KEY (id);
alter table public.visitor_pins add constraint "visitor_pins_scope_check" CHECK ((scope = ANY (ARRAY['submission'::text, 'community'::text])));
alter table public.visitor_pins add constraint "visitor_pins_pkey" PRIMARY KEY (scope, subject);
alter table ypl_audit.change_log add constraint "change_log_op_check" CHECK ((op = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])));
alter table ypl_audit.change_log add constraint "change_log_pkey" PRIMARY KEY (id);
alter table ypl_schema_validation.bracket_entry_slots add constraint "bracket_entry_slots_pool_no_check" CHECK ((pool_no >= 0));
alter table ypl_schema_validation.bracket_entry_slots add constraint "bracket_entry_slots_slot_no_check" CHECK ((slot_no > 0));
alter table ypl_schema_validation.bracket_entry_slots add constraint "bracket_entry_slots_stage_kind_check" CHECK ((stage_kind = ANY (ARRAY['elimination'::text, 'group'::text])));
alter table ypl_schema_validation.bracket_entry_slots add constraint "bracket_entry_slots_stage_no_check" CHECK ((stage_no > 0));
alter table ypl_schema_validation.bracket_entry_slots add constraint "ck_bracket_entry_slots_pool" CHECK ((((stage_kind = 'elimination'::text) AND (pool_no = 0)) OR ((stage_kind = 'group'::text) AND (pool_no > 0))));
alter table ypl_schema_validation.bracket_entry_slots add constraint "fk_bracket_entry_slots_entry" FOREIGN KEY (entry_id, event_id) REFERENCES ypl_schema_validation.entries(id, event_id) ON DELETE RESTRICT;
alter table ypl_schema_validation.bracket_entry_slots add constraint "fk_bracket_entry_slots_runtime" FOREIGN KEY (bracket_runtime_id, event_id) REFERENCES ypl_schema_validation.bracket_runtimes(id, event_id) ON DELETE RESTRICT;
alter table ypl_schema_validation.bracket_entry_slots add constraint "pk_bracket_entry_slots" PRIMARY KEY (bracket_runtime_id, stage_kind, stage_no, pool_no, slot_no);
alter table ypl_schema_validation.bracket_entry_slots add constraint "uq_bracket_entry_slots_entry" UNIQUE (bracket_runtime_id, stage_kind, stage_no, entry_id);
alter table ypl_schema_validation.bracket_identity_changes add constraint "ck_bracket_identity_changes_changed_player" CHECK (((NOT registration_player_was_changed) OR (previous_registration_player_id IS DISTINCT FROM player_id)));
alter table ypl_schema_validation.bracket_identity_changes add constraint "ck_bracket_identity_changes_entry_origin" CHECK (((NOT entry_was_created) OR entry_participant_was_created));
alter table ypl_schema_validation.bracket_identity_changes add constraint "ck_bracket_identity_changes_previous_player" CHECK ((registration_player_was_changed OR (previous_registration_player_id IS NULL)));
alter table ypl_schema_validation.bracket_identity_changes add constraint "ck_bracket_identity_changes_registration_origin" CHECK (((NOT registration_was_created) OR (NOT registration_player_was_changed)));
alter table ypl_schema_validation.bracket_identity_changes add constraint "fk_bracket_identity_changes_entry" FOREIGN KEY (entry_id, event_id) REFERENCES ypl_schema_validation.entries(id, event_id) ON DELETE RESTRICT;
alter table ypl_schema_validation.bracket_identity_changes add constraint "fk_bracket_identity_changes_participant" FOREIGN KEY (entry_participant_id, event_id, entry_id, registration_id, player_id) REFERENCES ypl_schema_validation.entry_participants(id, event_id, entry_id, registration_id, player_id) ON DELETE RESTRICT;
alter table ypl_schema_validation.bracket_identity_changes add constraint "fk_bracket_identity_changes_player" FOREIGN KEY (player_id) REFERENCES ypl_schema_validation.players(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.bracket_identity_changes add constraint "fk_bracket_identity_changes_previous_player" FOREIGN KEY (previous_registration_player_id) REFERENCES ypl_schema_validation.players(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.bracket_identity_changes add constraint "fk_bracket_identity_changes_registration" FOREIGN KEY (registration_id, event_id, player_id) REFERENCES ypl_schema_validation.event_registrations(id, event_id, player_id) ON DELETE RESTRICT;
alter table ypl_schema_validation.bracket_identity_changes add constraint "fk_bracket_identity_changes_runtime" FOREIGN KEY (bracket_runtime_id, event_id) REFERENCES ypl_schema_validation.bracket_runtimes(id, event_id) ON DELETE RESTRICT;
alter table ypl_schema_validation.bracket_identity_changes add constraint "pk_bracket_identity_changes" PRIMARY KEY (bracket_runtime_id, entry_participant_id);
alter table ypl_schema_validation.bracket_identity_changes add constraint "uq_bracket_identity_changes_player" UNIQUE (bracket_runtime_id, player_id);
alter table ypl_schema_validation.bracket_identity_changes add constraint "uq_bracket_identity_changes_registration" UNIQUE (bracket_runtime_id, registration_id);
alter table ypl_schema_validation.bracket_runtimes add constraint "bracket_runtimes_previous_event_status_check" CHECK ((previous_event_status = ANY (ARRAY['open'::text, 'running'::text])));
alter table ypl_schema_validation.bracket_runtimes add constraint "bracket_runtimes_projection_version_check" CHECK ((projection_version > 0));
alter table ypl_schema_validation.bracket_runtimes add constraint "bracket_runtimes_round_schedule_object" CHECK ((jsonb_typeof(round_schedule) = 'object'::text));
alter table ypl_schema_validation.bracket_runtimes add constraint "bracket_runtimes_topology_kind_check" CHECK ((((topology_kind = ANY (ARRAY['single_elimination'::text, 'double_elimination'::text])) AND (group_advance IS NULL) AND (group_final_format IS NULL)) OR ((topology_kind = 'groups_then_elimination'::text) AND (group_advance IS NOT NULL) AND (group_advance > 0) AND (group_final_format IS NOT NULL) AND (group_final_format = ANY (ARRAY['single_elimination'::text, 'double_elimination'::text])))));
alter table ypl_schema_validation.bracket_runtimes add constraint "fk_bracket_runtimes_event" FOREIGN KEY (event_id) REFERENCES ypl_schema_validation.events(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.bracket_runtimes add constraint "bracket_runtimes_pkey" PRIMARY KEY (id);
alter table ypl_schema_validation.bracket_runtimes add constraint "uq_bracket_runtimes_event" UNIQUE (event_id);
alter table ypl_schema_validation.bracket_runtimes add constraint "uq_bracket_runtimes_id_event" UNIQUE (id, event_id);
alter table ypl_schema_validation.championship_advancements add constraint "championship_advancements_advancement_type_check" CHECK ((advancement_type = ANY (ARRAY['ranking'::text, 'qualifier'::text, 'manual'::text])));
alter table ypl_schema_validation.championship_advancements add constraint "chk_championship_advancement_source" CHECK ((((advancement_type = 'ranking'::text) AND (source_entry_id IS NULL)) OR ((advancement_type = 'qualifier'::text) AND (source_entry_id IS NOT NULL)) OR (advancement_type = 'manual'::text)));
alter table ypl_schema_validation.championship_advancements add constraint "championship_advancements_direct_selection_id_fkey" FOREIGN KEY (direct_selection_id) REFERENCES ypl_schema_validation.championship_qualifier_direct_selections(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.championship_advancements add constraint "championship_advancements_final_registration_id_fkey" FOREIGN KEY (final_registration_id) REFERENCES ypl_schema_validation.event_registrations(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.championship_advancements add constraint "championship_advancements_source_entry_id_fkey" FOREIGN KEY (source_entry_id) REFERENCES ypl_schema_validation.entries(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.championship_advancements add constraint "championship_advancements_pkey" PRIMARY KEY (id);
alter table ypl_schema_validation.championship_advancements add constraint "uq_championship_advancement_final_registration" UNIQUE (final_registration_id);
alter table ypl_schema_validation.championship_qualifier_direct_selections add constraint "championship_qualifier_direct_se_qualifier_registration_id_fkey" FOREIGN KEY (qualifier_registration_id) REFERENCES ypl_schema_validation.event_registrations(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.championship_qualifier_direct_selections add constraint "championship_qualifier_direct_selection_qualifier_event_id_fkey" FOREIGN KEY (qualifier_event_id) REFERENCES ypl_schema_validation.events(id) ON DELETE CASCADE;
alter table ypl_schema_validation.championship_qualifier_direct_selections add constraint "championship_qualifier_direct_selections_player_id_fkey" FOREIGN KEY (player_id) REFERENCES ypl_schema_validation.players(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.championship_qualifier_direct_selections add constraint "championship_qualifier_direct_selections_pkey" PRIMARY KEY (id);
alter table ypl_schema_validation.championship_qualifier_direct_selections add constraint "championship_qualifier_direct__qualifier_event_id_player_id_key" UNIQUE (qualifier_event_id, player_id);
alter table ypl_schema_validation.championship_qualifier_direct_selections add constraint "championship_qualifier_direct_qualifier_event_id_qualifier__key" UNIQUE (qualifier_event_id, qualifier_registration_id);
alter table ypl_schema_validation.competition_editions add constraint "competition_editions_family_check" CHECK ((family = ANY (ARRAY['regular'::text, 'champions'::text, 'light'::text])));
alter table ypl_schema_validation.competition_editions add constraint "competition_editions_round_number_check" CHECK ((round_number > 0));
alter table ypl_schema_validation.competition_editions add constraint "competition_editions_pkey" PRIMARY KEY (id);
alter table ypl_schema_validation.competition_editions add constraint "competition_editions_family_round_number_key" UNIQUE (family, round_number);
alter table ypl_schema_validation.entries add constraint "entries_entry_type_check" CHECK ((entry_type = ANY (ARRAY['individual'::text, 'team'::text])));
alter table ypl_schema_validation.entries add constraint "entries_seed_check" CHECK (((seed IS NULL) OR (seed > 0)));
alter table ypl_schema_validation.entries add constraint "entries_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'withdrawn'::text])));
alter table ypl_schema_validation.entries add constraint "entries_event_id_fkey" FOREIGN KEY (event_id) REFERENCES ypl_schema_validation.events(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.entries add constraint "entries_pkey" PRIMARY KEY (id);
alter table ypl_schema_validation.entries add constraint "entries_id_event_id_key" UNIQUE (id, event_id);
alter table ypl_schema_validation.entry_participants add constraint "entry_participants_member_order_check" CHECK ((member_order > 0));
alter table ypl_schema_validation.entry_participants add constraint "entry_participants_entry_id_event_id_fkey" FOREIGN KEY (entry_id, event_id) REFERENCES ypl_schema_validation.entries(id, event_id) ON DELETE RESTRICT;
alter table ypl_schema_validation.entry_participants add constraint "entry_participants_event_id_fkey" FOREIGN KEY (event_id) REFERENCES ypl_schema_validation.events(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.entry_participants add constraint "entry_participants_player_id_fkey" FOREIGN KEY (player_id) REFERENCES ypl_schema_validation.players(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.entry_participants add constraint "entry_participants_registration_id_event_id_player_id_fkey" FOREIGN KEY (registration_id, event_id, player_id) REFERENCES ypl_schema_validation.event_registrations(id, event_id, player_id) ON DELETE RESTRICT;
alter table ypl_schema_validation.entry_participants add constraint "entry_participants_pkey" PRIMARY KEY (id);
alter table ypl_schema_validation.entry_participants add constraint "entry_participants_entry_id_member_order_key" UNIQUE (entry_id, member_order);
alter table ypl_schema_validation.entry_participants add constraint "entry_participants_entry_id_player_id_key" UNIQUE (entry_id, player_id);
alter table ypl_schema_validation.entry_participants add constraint "entry_participants_event_id_player_id_key" UNIQUE (event_id, player_id);
alter table ypl_schema_validation.entry_participants add constraint "entry_participants_registration_id_key" UNIQUE (registration_id);
alter table ypl_schema_validation.entry_participants add constraint "uq_entry_participants_event_identity" UNIQUE (id, event_id, entry_id, registration_id, player_id);
alter table ypl_schema_validation.event_registrations add constraint "event_registrations_data_size" CHECK ((octet_length((registration_data)::text) <= 16384));
alter table ypl_schema_validation.event_registrations add constraint "event_registrations_name_length" CHECK ((char_length(registration_name) <= 100));
alter table ypl_schema_validation.event_registrations add constraint "event_registrations_registration_source_check" CHECK ((registration_source = ANY (ARRAY['application'::text, 'advancement'::text, 'manual'::text, 'migration'::text])));
alter table ypl_schema_validation.event_registrations add constraint "event_registrations_event_id_fkey" FOREIGN KEY (event_id) REFERENCES ypl_schema_validation.events(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.event_registrations add constraint "event_registrations_player_id_fkey" FOREIGN KEY (player_id) REFERENCES ypl_schema_validation.players(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.event_registrations add constraint "fk_event_registration_final_submission" FOREIGN KEY (final_submission_id, id) REFERENCES ypl_schema_validation.registration_submissions(id, registration_id) ON DELETE RESTRICT;
alter table ypl_schema_validation.event_registrations add constraint "event_registrations_pkey" PRIMARY KEY (id);
alter table ypl_schema_validation.event_registrations add constraint "event_registrations_event_id_player_id_key" UNIQUE (event_id, player_id);
alter table ypl_schema_validation.event_registrations add constraint "event_registrations_id_event_id_player_id_key" UNIQUE (id, event_id, player_id);
alter table ypl_schema_validation.events add constraint "chk_events_championship_only" CHECK (((championship_phase IS NULL) OR (event_type = 'champions'::text)));
alter table ypl_schema_validation.events add constraint "chk_events_championship_phase" CHECK (((championship_phase IS NULL) OR (championship_phase = ANY (ARRAY['qualifier'::text, 'final'::text]))));
alter table ypl_schema_validation.events add constraint "chk_events_championship_stage_shape" CHECK ((((championship_phase IS NULL) AND (championship_final_event_id IS NULL) AND (qualification_slots IS NULL)) OR ((championship_phase = 'qualifier'::text) AND (championship_final_event_id IS NOT NULL) AND (championship_final_event_id <> id) AND ((qualification_slots IS NULL) OR (qualification_slots > 0))) OR ((championship_phase = 'final'::text) AND (championship_final_event_id IS NULL) AND (qualification_slots IS NULL))));
alter table ypl_schema_validation.events add constraint "events_check" CHECK (((team_reveal_mode <> 'scheduled'::text) OR (team_reveal_at IS NOT NULL)));
alter table ypl_schema_validation.events add constraint "events_date_precision_check" CHECK ((date_precision = ANY (ARRAY['exact'::text, 'month'::text, 'year'::text, 'unknown'::text])));
alter table ypl_schema_validation.events add constraint "events_name_clean" CHECK (((name = btrim(name)) AND (name <> ''::text) AND (name !~ '[|·•]'::text) AND (name !~ '\s{2,}'::text) AND (name !~ '(마스터|루키)리그'::text)));
alter table ypl_schema_validation.events add constraint "events_record_completeness_check" CHECK ((record_completeness = ANY (ARRAY['full_match'::text, 'placement'::text, 'winner_only'::text, 'partial'::text])));
alter table ypl_schema_validation.events add constraint "events_round_number_check" CHECK (((round_number IS NULL) OR (round_number > 0)));
alter table ypl_schema_validation.events add constraint "events_status_check" CHECK ((status = ANY (ARRAY['planned'::text, 'open'::text, 'running'::text, 'completed'::text, 'cancelled'::text])));
alter table ypl_schema_validation.events add constraint "events_team_reveal_mode_check" CHECK ((team_reveal_mode = ANY (ARRAY['on_record_apply'::text, 'scheduled'::text, 'manual'::text])));
alter table ypl_schema_validation.events add constraint "events_competition_edition_id_fkey" FOREIGN KEY (competition_edition_id) REFERENCES ypl_schema_validation.competition_editions(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.events add constraint "events_season_id_fkey" FOREIGN KEY (season_id) REFERENCES ypl_schema_validation.seasons(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.events add constraint "fk_events_championship_final_event" FOREIGN KEY (championship_final_event_id) REFERENCES ypl_schema_validation.events(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.events add constraint "events_pkey" PRIMARY KEY (id);
alter table ypl_schema_validation.hall_of_fame_entries add constraint "hall_of_fame_entries_generation_number_check" CHECK ((generation_number > 0));
alter table ypl_schema_validation.hall_of_fame_entries add constraint "hall_of_fame_entries_event_id_fkey" FOREIGN KEY (event_id) REFERENCES ypl_schema_validation.events(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.hall_of_fame_entries add constraint "hall_of_fame_entries_player_id_fkey" FOREIGN KEY (player_id) REFERENCES ypl_schema_validation.players(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.hall_of_fame_entries add constraint "hall_of_fame_entries_result_id_event_id_fkey" FOREIGN KEY (result_id, event_id) REFERENCES ypl_schema_validation.results(id, event_id) ON DELETE RESTRICT;
alter table ypl_schema_validation.hall_of_fame_entries add constraint "hall_of_fame_entries_result_id_fkey" FOREIGN KEY (result_id) REFERENCES ypl_schema_validation.results(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.hall_of_fame_entries add constraint "hall_of_fame_entries_pkey" PRIMARY KEY (id);
alter table ypl_schema_validation.hall_of_fame_entries add constraint "hall_of_fame_entries_event_id_key" UNIQUE (event_id);
alter table ypl_schema_validation.league_intakes add constraint "league_intakes_announcement_id_check" CHECK ((btrim(announcement_id) <> ''::text));
alter table ypl_schema_validation.league_intakes add constraint "league_intakes_check" CHECK ((master_event_id <> rookie_event_id));
alter table ypl_schema_validation.league_intakes add constraint "league_intakes_master_event_id_fkey" FOREIGN KEY (master_event_id) REFERENCES ypl_schema_validation.events(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.league_intakes add constraint "league_intakes_rookie_event_id_fkey" FOREIGN KEY (rookie_event_id) REFERENCES ypl_schema_validation.events(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.league_intakes add constraint "league_intakes_pkey" PRIMARY KEY (id);
alter table ypl_schema_validation.league_intakes add constraint "league_intakes_announcement_id_key" UNIQUE (announcement_id);
alter table ypl_schema_validation.league_intakes add constraint "league_intakes_master_event_id_key" UNIQUE (master_event_id);
alter table ypl_schema_validation.league_intakes add constraint "league_intakes_rookie_event_id_key" UNIQUE (rookie_event_id);
alter table ypl_schema_validation.matches add constraint "matches_check" CHECK (((entry_a_id IS NULL) OR (entry_b_id IS NULL) OR (entry_a_id <> entry_b_id)));
alter table ypl_schema_validation.matches add constraint "matches_check1" CHECK (((player_a_id IS NULL) OR (player_b_id IS NULL) OR (player_a_id <> player_b_id)));
alter table ypl_schema_validation.matches add constraint "matches_check2" CHECK (((winner_entry_id IS NULL) OR (winner_entry_id = entry_a_id) OR (winner_entry_id = entry_b_id)));
alter table ypl_schema_validation.matches add constraint "matches_check3" CHECK (((winner_player_id IS NULL) OR (winner_player_id = player_a_id) OR (winner_player_id = player_b_id)));
alter table ypl_schema_validation.matches add constraint "matches_check4" CHECK ((((match_kind = 'bracket'::text) AND (parent_match_id IS NULL) AND (entry_a_id IS NOT NULL) AND (entry_b_id IS NOT NULL) AND (player_a_id IS NULL) AND (player_b_id IS NULL) AND (winner_player_id IS NULL)) OR ((match_kind = ANY (ARRAY['team_bout'::text, 'ace'::text])) AND (parent_match_id IS NOT NULL) AND (player_a_id IS NOT NULL) AND (player_b_id IS NOT NULL) AND (entry_a_id IS NULL) AND (entry_b_id IS NULL) AND (winner_entry_id IS NULL))));
alter table ypl_schema_validation.matches add constraint "matches_match_kind_check" CHECK ((match_kind = ANY (ARRAY['bracket'::text, 'team_bout'::text, 'ace'::text])));
alter table ypl_schema_validation.matches add constraint "matches_resolution_check" CHECK ((resolution = ANY (ARRAY['played'::text, 'forfeit'::text, 'admin'::text, 'draw'::text, 'cancelled'::text, 'unknown'::text])));
alter table ypl_schema_validation.matches add constraint "matches_round_number_check" CHECK (((round_number IS NULL) OR (round_number > 0)));
alter table ypl_schema_validation.matches add constraint "matches_scores_pair" CHECK (((score_a IS NULL) = (score_b IS NULL)));
alter table ypl_schema_validation.matches add constraint "matches_scores_range" CHECK (((score_a IS NULL) OR (((score_a >= 0) AND (score_a <= 99)) AND ((score_b >= 0) AND (score_b <= 99)))));
alter table ypl_schema_validation.matches add constraint "matches_sequence_no_check" CHECK (((sequence_no IS NULL) OR (sequence_no > 0)));
alter table ypl_schema_validation.matches add constraint "matches_table_label_shape" CHECK (((table_label IS NULL) OR (((char_length(table_label) >= 1) AND (char_length(table_label) <= 12)) AND (table_label = btrim(table_label)))));
alter table ypl_schema_validation.matches add constraint "matches_entry_a_id_event_id_fkey" FOREIGN KEY (entry_a_id, event_id) REFERENCES ypl_schema_validation.entries(id, event_id) ON DELETE RESTRICT;
alter table ypl_schema_validation.matches add constraint "matches_entry_a_id_fkey" FOREIGN KEY (entry_a_id) REFERENCES ypl_schema_validation.entries(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.matches add constraint "matches_entry_b_id_event_id_fkey" FOREIGN KEY (entry_b_id, event_id) REFERENCES ypl_schema_validation.entries(id, event_id) ON DELETE RESTRICT;
alter table ypl_schema_validation.matches add constraint "matches_entry_b_id_fkey" FOREIGN KEY (entry_b_id) REFERENCES ypl_schema_validation.entries(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.matches add constraint "matches_event_id_fkey" FOREIGN KEY (event_id) REFERENCES ypl_schema_validation.events(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.matches add constraint "matches_parent_match_id_event_id_fkey" FOREIGN KEY (parent_match_id, event_id) REFERENCES ypl_schema_validation.matches(id, event_id) ON DELETE RESTRICT;
alter table ypl_schema_validation.matches add constraint "matches_parent_match_id_fkey" FOREIGN KEY (parent_match_id) REFERENCES ypl_schema_validation.matches(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.matches add constraint "matches_player_a_id_fkey" FOREIGN KEY (player_a_id) REFERENCES ypl_schema_validation.players(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.matches add constraint "matches_player_b_id_fkey" FOREIGN KEY (player_b_id) REFERENCES ypl_schema_validation.players(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.matches add constraint "matches_winner_entry_id_event_id_fkey" FOREIGN KEY (winner_entry_id, event_id) REFERENCES ypl_schema_validation.entries(id, event_id) ON DELETE RESTRICT;
alter table ypl_schema_validation.matches add constraint "matches_winner_entry_id_fkey" FOREIGN KEY (winner_entry_id) REFERENCES ypl_schema_validation.entries(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.matches add constraint "matches_winner_player_id_fkey" FOREIGN KEY (winner_player_id) REFERENCES ypl_schema_validation.players(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.matches add constraint "matches_pkey" PRIMARY KEY (id);
alter table ypl_schema_validation.matches add constraint "matches_id_event_id_key" UNIQUE (id, event_id);
alter table ypl_schema_validation.player_partners add constraint "player_partners_check" CHECK (((revoked_at IS NULL) OR (revoked_at >= created_at)));
alter table ypl_schema_validation.player_partners add constraint "player_partners_player_id_fkey" FOREIGN KEY (player_id) REFERENCES ypl_schema_validation.players(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.player_partners add constraint "player_partners_pkey" PRIMARY KEY (id);
alter table ypl_schema_validation.players add constraint "players_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));
alter table ypl_schema_validation.players add constraint "players_pkey" PRIMARY KEY (id);
alter table ypl_schema_validation.ranking_awards add constraint "ranking_awards_award_kind_check" CHECK ((award_kind = ANY (ARRAY['placement'::text, 'adjustment'::text, 'reversal'::text])));
alter table ypl_schema_validation.ranking_awards add constraint "ranking_awards_check" CHECK (((related_award_id IS NULL) OR (related_award_id <> id)));
alter table ypl_schema_validation.ranking_awards add constraint "ranking_awards_event_id_fkey" FOREIGN KEY (event_id) REFERENCES ypl_schema_validation.events(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.ranking_awards add constraint "ranking_awards_player_id_fkey" FOREIGN KEY (player_id) REFERENCES ypl_schema_validation.players(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.ranking_awards add constraint "ranking_awards_related_award_id_fkey" FOREIGN KEY (related_award_id) REFERENCES ypl_schema_validation.ranking_awards(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.ranking_awards add constraint "ranking_awards_result_id_event_id_fkey" FOREIGN KEY (result_id, event_id) REFERENCES ypl_schema_validation.results(id, event_id) ON DELETE RESTRICT;
alter table ypl_schema_validation.ranking_awards add constraint "ranking_awards_result_id_fkey" FOREIGN KEY (result_id) REFERENCES ypl_schema_validation.results(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.ranking_awards add constraint "ranking_awards_pkey" PRIMARY KEY (id);
alter table ypl_schema_validation.ranking_baselines add constraint "ranking_baselines_check" CHECK ((((scope = 'series'::text) AND (series IS NOT NULL) AND (season_id IS NULL)) OR ((scope = 'season'::text) AND (series IS NULL) AND (season_id IS NOT NULL))));
alter table ypl_schema_validation.ranking_baselines add constraint "ranking_baselines_runner_ups_check" CHECK ((runner_ups >= 0));
alter table ypl_schema_validation.ranking_baselines add constraint "ranking_baselines_scope_check" CHECK ((scope = ANY (ARRAY['series'::text, 'season'::text])));
alter table ypl_schema_validation.ranking_baselines add constraint "ranking_baselines_top4s_check" CHECK ((top4s >= 0));
alter table ypl_schema_validation.ranking_baselines add constraint "ranking_baselines_wins_check" CHECK ((wins >= 0));
alter table ypl_schema_validation.ranking_baselines add constraint "ranking_baselines_player_id_fkey" FOREIGN KEY (player_id) REFERENCES ypl_schema_validation.players(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.ranking_baselines add constraint "ranking_baselines_season_id_fkey" FOREIGN KEY (season_id) REFERENCES ypl_schema_validation.seasons(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.ranking_baselines add constraint "ranking_baselines_pkey" PRIMARY KEY (id);
alter table ypl_schema_validation.registration_submissions add constraint "registration_submissions_revision_check" CHECK ((revision > 0));
alter table ypl_schema_validation.registration_submissions add constraint "registration_submissions_registration_id_fkey" FOREIGN KEY (registration_id) REFERENCES ypl_schema_validation.event_registrations(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.registration_submissions add constraint "registration_submissions_snapshot_id_fkey" FOREIGN KEY (snapshot_id) REFERENCES ypl_schema_validation.team_snapshots(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.registration_submissions add constraint "registration_submissions_pkey" PRIMARY KEY (id);
alter table ypl_schema_validation.registration_submissions add constraint "registration_submissions_id_registration_id_key" UNIQUE (id, registration_id);
alter table ypl_schema_validation.registration_submissions add constraint "registration_submissions_registration_id_revision_key" UNIQUE (registration_id, revision);
alter table ypl_schema_validation.registration_submissions add constraint "registration_submissions_snapshot_id_key" UNIQUE (snapshot_id);
alter table ypl_schema_validation.results add constraint "results_check" CHECK (((rank_min IS NULL) OR (rank_max IS NULL) OR (rank_min <= rank_max)));
alter table ypl_schema_validation.results add constraint "results_rank_max_check" CHECK (((rank_max IS NULL) OR (rank_max > 0)));
alter table ypl_schema_validation.results add constraint "results_rank_min_check" CHECK (((rank_min IS NULL) OR (rank_min > 0)));
alter table ypl_schema_validation.results add constraint "results_entry_id_event_id_fkey" FOREIGN KEY (entry_id, event_id) REFERENCES ypl_schema_validation.entries(id, event_id) ON DELETE RESTRICT;
alter table ypl_schema_validation.results add constraint "results_entry_id_fkey" FOREIGN KEY (entry_id) REFERENCES ypl_schema_validation.entries(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.results add constraint "results_event_id_fkey" FOREIGN KEY (event_id) REFERENCES ypl_schema_validation.events(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.results add constraint "results_pkey" PRIMARY KEY (id);
alter table ypl_schema_validation.results add constraint "results_event_id_entry_id_key" UNIQUE (event_id, entry_id);
alter table ypl_schema_validation.results add constraint "results_id_event_id_key" UNIQUE (id, event_id);
alter table ypl_schema_validation.seasons add constraint "seasons_check" CHECK (((starts_on IS NULL) OR (ends_on IS NULL) OR (starts_on <= ends_on)));
alter table ypl_schema_validation.seasons add constraint "seasons_number_check" CHECK (((number IS NULL) OR (number > 0)));
alter table ypl_schema_validation.seasons add constraint "seasons_status_check" CHECK ((status = ANY (ARRAY['past'::text, 'current'::text, 'planned'::text])));
alter table ypl_schema_validation.seasons add constraint "seasons_pkey" PRIMARY KEY (id);
alter table ypl_schema_validation.seasons add constraint "seasons_code_key" UNIQUE (code);
alter table ypl_schema_validation.team_snapshot_members add constraint "team_snapshot_members_slot_check" CHECK (((slot >= 1) AND (slot <= 6)));
alter table ypl_schema_validation.team_snapshot_members add constraint "team_snapshot_members_stat_atk_check" CHECK ((stat_atk >= 0));
alter table ypl_schema_validation.team_snapshot_members add constraint "team_snapshot_members_stat_def_check" CHECK ((stat_def >= 0));
alter table ypl_schema_validation.team_snapshot_members add constraint "team_snapshot_members_stat_hp_check" CHECK ((stat_hp >= 0));
alter table ypl_schema_validation.team_snapshot_members add constraint "team_snapshot_members_stat_spa_check" CHECK ((stat_spa >= 0));
alter table ypl_schema_validation.team_snapshot_members add constraint "team_snapshot_members_stat_spd_check" CHECK ((stat_spd >= 0));
alter table ypl_schema_validation.team_snapshot_members add constraint "team_snapshot_members_stat_spe_check" CHECK ((stat_spe >= 0));
alter table ypl_schema_validation.team_snapshot_members add constraint "team_snapshot_members_text_size" CHECK ((octet_length(concat(pokemon_id, pokemon_name_snapshot, ability_id, nature_id, item_id, move_1_id, move_2_id, move_3_id, move_4_id)) <= 1024));
alter table ypl_schema_validation.team_snapshot_members add constraint "team_snapshot_members_snapshot_id_fkey" FOREIGN KEY (snapshot_id) REFERENCES ypl_schema_validation.team_snapshots(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.team_snapshot_members add constraint "team_snapshot_members_pkey" PRIMARY KEY (id);
alter table ypl_schema_validation.team_snapshot_members add constraint "team_snapshot_members_snapshot_id_slot_key" UNIQUE (snapshot_id, slot);
alter table ypl_schema_validation.team_snapshots add constraint "team_snapshots_schema_version_check" CHECK ((schema_version > 0));
alter table ypl_schema_validation.team_snapshots add constraint "team_snapshots_source_type_check" CHECK ((source_type = ANY (ARRAY['manual'::text, 'replica_import'::text, 'historical'::text])));
alter table ypl_schema_validation.team_snapshots add constraint "team_snapshots_pkey" PRIMARY KEY (id);
alter table ypl_schema_validation.title_awards add constraint "title_awards_check" CHECK (((result_id IS NULL) OR (event_id IS NOT NULL)));
alter table ypl_schema_validation.title_awards add constraint "title_awards_check1" CHECK (((revoked_at IS NULL) OR (revoked_at >= awarded_at)));
alter table ypl_schema_validation.title_awards add constraint "title_awards_event_id_fkey" FOREIGN KEY (event_id) REFERENCES ypl_schema_validation.events(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.title_awards add constraint "title_awards_player_id_fkey" FOREIGN KEY (player_id) REFERENCES ypl_schema_validation.players(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.title_awards add constraint "title_awards_result_id_event_id_fkey" FOREIGN KEY (result_id, event_id) REFERENCES ypl_schema_validation.results(id, event_id) ON DELETE RESTRICT;
alter table ypl_schema_validation.title_awards add constraint "title_awards_result_id_fkey" FOREIGN KEY (result_id) REFERENCES ypl_schema_validation.results(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.title_awards add constraint "title_awards_title_id_fkey" FOREIGN KEY (title_id) REFERENCES ypl_schema_validation.title_definitions(id) ON DELETE RESTRICT;
alter table ypl_schema_validation.title_awards add constraint "title_awards_pkey" PRIMARY KEY (id);
alter table ypl_schema_validation.title_definitions add constraint "title_definitions_award_mode_check" CHECK ((award_mode = ANY (ARRAY['auto'::text, 'review'::text, 'manual'::text])));
alter table ypl_schema_validation.title_definitions add constraint "title_definitions_pkey" PRIMARY KEY (id);
alter table ypl_schema_validation.title_definitions add constraint "title_definitions_code_key" UNIQUE (code);

-- ===== 색인 (제약이 만들지 않은 것) =====
CREATE INDEX account_teams_recent ON public.account_teams USING btree (auth_user_id, updated_at DESC);
CREATE INDEX battle_secrets_room_code_idx ON public.battle_secrets USING btree (room_code) WHERE (room_code IS NOT NULL);
CREATE INDEX battles_created_idx ON public.battles USING btree (created_at DESC);
CREATE INDEX battles_event_idx ON public.battles USING btree (event_id) WHERE (event_id IS NOT NULL);
CREATE UNIQUE INDEX battles_open_official_match ON public.battles USING btree (event_id, source_node_key) WHERE ((kind = 'official'::text) AND (status = ANY (ARRAY['waiting'::text, 'active'::text])));
CREATE INDEX battles_p1_account ON public.battles USING btree (p1_auth_user_id, updated_at DESC) WHERE (p1_auth_user_id IS NOT NULL);
CREATE INDEX battles_p2_account ON public.battles USING btree (p2_auth_user_id, updated_at DESC) WHERE (p2_auth_user_id IS NOT NULL);
CREATE INDEX battles_players_idx ON public.battles USING btree (p1_player_id, p2_player_id) WHERE (kind = 'official'::text);
CREATE INDEX battles_run_id ON public.battles USING btree (run_id) WHERE (run_id IS NOT NULL);
CREATE INDEX battles_waiting_rooms_idx ON public.battles USING btree (created_at DESC) WHERE ((status = 'waiting'::text) AND (room IS NOT NULL));
CREATE INDEX community_authors_account ON public.community_authors USING btree (auth_user_id);
CREATE INDEX community_items_board_created_idx ON public.community_items USING btree (board, created_at DESC);
CREATE INDEX community_items_parent_idx ON public.community_items USING btree (parent_id);
CREATE INDEX cpu_battles_created_idx ON public.cpu_battles USING btree (created_at DESC);
CREATE UNIQUE INDEX player_accounts_name_approved ON public.player_accounts USING btree (name_key) WHERE (status = 'approved'::text);
CREATE UNIQUE INDEX player_accounts_one_approved ON public.player_accounts USING btree (player_id) WHERE (status = 'approved'::text);
CREATE INDEX push_outbox_due ON public.push_outbox USING btree (created_at) WHERE (taken_at IS NULL);
CREATE INDEX push_subscriptions_account ON public.push_subscriptions USING btree (auth_user_id) WHERE (auth_user_id IS NOT NULL);
CREATE INDEX streak_runs_battle_id ON public.streak_runs USING btree (battle_id) WHERE (battle_id IS NOT NULL);
CREATE INDEX streak_runs_board ON public.streak_runs USING btree (month, wins DESC, last_win_at);
CREATE UNIQUE INDEX streak_runs_one_active_kind ON public.streak_runs USING btree (auth_user_id, ((daily IS NULL))) WHERE (status = 'active'::text);
CREATE UNIQUE INDEX streak_runs_one_daily ON public.streak_runs USING btree (auth_user_id, daily) WHERE (daily IS NOT NULL);
CREATE INDEX tower_cup_players_user ON public.tower_cup_players USING btree (auth_user_id);
CREATE INDEX tower_cup_runs_board ON public.tower_cup_runs USING btree (cup_id, auth_user_id);
CREATE INDEX tower_cup_runs_run ON public.tower_cup_runs USING btree (run_id);
CREATE INDEX tower_cups_ends ON public.tower_cups USING btree (ends_at);
CREATE INDEX tower_cups_host ON public.tower_cups USING btree (host_user, ends_at);
CREATE INDEX change_log_at_idx ON ypl_audit.change_log USING btree (at DESC);
CREATE INDEX change_log_row_idx ON ypl_audit.change_log USING btree (table_name, row_id, at DESC);
CREATE INDEX idx_bracket_entry_slots_entry_event ON ypl_schema_validation.bracket_entry_slots USING btree (entry_id, event_id);
CREATE INDEX idx_bracket_entry_slots_event_id ON ypl_schema_validation.bracket_entry_slots USING btree (event_id);
CREATE INDEX idx_bracket_identity_changes_entry_event ON ypl_schema_validation.bracket_identity_changes USING btree (entry_id, event_id);
CREATE INDEX idx_bracket_identity_changes_event_id ON ypl_schema_validation.bracket_identity_changes USING btree (event_id);
CREATE INDEX idx_bracket_identity_changes_participant_event ON ypl_schema_validation.bracket_identity_changes USING btree (entry_participant_id, event_id);
CREATE UNIQUE INDEX uq_bracket_identity_changes_created_entry ON ypl_schema_validation.bracket_identity_changes USING btree (bracket_runtime_id, event_id, entry_id) WHERE entry_was_created;
CREATE INDEX idx_bracket_runtimes_event_id ON ypl_schema_validation.bracket_runtimes USING btree (event_id);
CREATE INDEX idx_championship_advancements_source_entry ON ypl_schema_validation.championship_advancements USING btree (source_entry_id) WHERE (source_entry_id IS NOT NULL);
CREATE INDEX idx_championship_advancements_type ON ypl_schema_validation.championship_advancements USING btree (advancement_type);
CREATE INDEX idx_entries_event_id ON ypl_schema_validation.entries USING btree (event_id);
CREATE INDEX idx_entry_participants_entry_id ON ypl_schema_validation.entry_participants USING btree (entry_id);
CREATE INDEX idx_entry_participants_player_id ON ypl_schema_validation.entry_participants USING btree (player_id);
CREATE INDEX idx_entry_participants_registration_id ON ypl_schema_validation.entry_participants USING btree (registration_id);
CREATE UNIQUE INDEX event_registrations_application_name_key ON ypl_schema_validation.event_registrations USING btree (event_id, lower(regexp_replace(registration_name, '\s'::text, ''::text, 'g'::text))) WHERE (registration_source = 'application'::text);
CREATE INDEX idx_event_registrations_event_id ON ypl_schema_validation.event_registrations USING btree (event_id);
CREATE INDEX idx_event_registrations_name ON ypl_schema_validation.event_registrations USING btree (event_id, registration_name);
CREATE INDEX idx_event_registrations_player_id ON ypl_schema_validation.event_registrations USING btree (player_id);
CREATE INDEX idx_event_registrations_source ON ypl_schema_validation.event_registrations USING btree (registration_source);
CREATE INDEX events_competition_edition_idx ON ypl_schema_validation.events USING btree (competition_edition_id);
CREATE UNIQUE INDEX events_edition_variant_key ON ypl_schema_validation.events USING btree (competition_edition_id, (
CASE
    WHEN (event_type = 'champions'::text) THEN ((battle_format || ':'::text) || championship_phase)
    WHEN ((event_type = 'light'::text) OR (division = 'light'::text)) THEN 'light'::text
    WHEN is_team_event THEN 'team'::text
    ELSE COALESCE(division, 'regular'::text)
END)) WHERE (competition_edition_id IS NOT NULL);
CREATE INDEX idx_events_championship_final_event ON ypl_schema_validation.events USING btree (championship_final_event_id) WHERE (championship_final_event_id IS NOT NULL);
CREATE INDEX idx_events_held_on ON ypl_schema_validation.events USING btree (held_on);
CREATE INDEX idx_events_season_id ON ypl_schema_validation.events USING btree (season_id);
CREATE INDEX idx_events_type_format ON ypl_schema_validation.events USING btree (event_type, battle_format);
CREATE INDEX idx_hall_of_fame_generation ON ypl_schema_validation.hall_of_fame_entries USING btree (generation_number);
CREATE INDEX idx_hall_of_fame_player_id ON ypl_schema_validation.hall_of_fame_entries USING btree (player_id);
CREATE INDEX idx_matches_event_id ON ypl_schema_validation.matches USING btree (event_id);
CREATE INDEX idx_matches_parent_match_id ON ypl_schema_validation.matches USING btree (parent_match_id);
CREATE INDEX idx_matches_players ON ypl_schema_validation.matches USING btree (player_a_id, player_b_id);
CREATE UNIQUE INDEX uq_matches_source_node ON ypl_schema_validation.matches USING btree (event_id, source, source_node_key) WHERE (source_node_key IS NOT NULL);
CREATE INDEX idx_player_partners_player_id ON ypl_schema_validation.player_partners USING btree (player_id);
CREATE INDEX idx_player_partners_pokemon_id ON ypl_schema_validation.player_partners USING btree (pokemon_id);
CREATE UNIQUE INDEX uq_player_partners_active_name ON ypl_schema_validation.player_partners USING btree (player_id, pokemon_name_snapshot) WHERE (revoked_at IS NULL);
CREATE INDEX idx_players_display_name ON ypl_schema_validation.players USING btree (display_name);
CREATE UNIQUE INDEX uq_players_name_key ON ypl_schema_validation.players USING btree (lower(regexp_replace(display_name, '\s'::text, ''::text, 'g'::text)));
CREATE INDEX idx_ranking_awards_event_id ON ypl_schema_validation.ranking_awards USING btree (event_id);
CREATE INDEX idx_ranking_awards_player_id ON ypl_schema_validation.ranking_awards USING btree (player_id);
CREATE INDEX idx_ranking_awards_related_award_id ON ypl_schema_validation.ranking_awards USING btree (related_award_id);
CREATE INDEX idx_ranking_awards_result_id ON ypl_schema_validation.ranking_awards USING btree (result_id);
CREATE UNIQUE INDEX uq_ranking_awards_placement_result_player ON ypl_schema_validation.ranking_awards USING btree (result_id, player_id) WHERE ((award_kind = 'placement'::text) AND (result_id IS NOT NULL));
CREATE INDEX idx_ranking_baselines_season_id ON ypl_schema_validation.ranking_baselines USING btree (season_id);
CREATE UNIQUE INDEX uq_ranking_baseline_season ON ypl_schema_validation.ranking_baselines USING btree (player_id, season_id) WHERE (scope = 'season'::text);
CREATE UNIQUE INDEX uq_ranking_baseline_series ON ypl_schema_validation.ranking_baselines USING btree (player_id, series) WHERE (scope = 'series'::text);
CREATE INDEX idx_registration_submissions_registration_id ON ypl_schema_validation.registration_submissions USING btree (registration_id);
CREATE INDEX idx_registration_submissions_submitted_at ON ypl_schema_validation.registration_submissions USING btree (submitted_at);
CREATE INDEX idx_results_entry_id ON ypl_schema_validation.results USING btree (entry_id);
CREATE INDEX idx_results_event_id ON ypl_schema_validation.results USING btree (event_id);
CREATE INDEX idx_results_placement_code ON ypl_schema_validation.results USING btree (placement_code);
CREATE INDEX idx_seasons_sort_order ON ypl_schema_validation.seasons USING btree (sort_order);
CREATE UNIQUE INDEX uq_seasons_one_current_ypl ON ypl_schema_validation.seasons USING btree (status) WHERE ((series = 'ypl'::text) AND (status = 'current'::text));
CREATE INDEX idx_team_snapshot_members_pokemon_id ON ypl_schema_validation.team_snapshot_members USING btree (pokemon_id);
CREATE INDEX idx_team_snapshot_members_snapshot_id ON ypl_schema_validation.team_snapshot_members USING btree (snapshot_id);
CREATE INDEX idx_title_awards_player_id ON ypl_schema_validation.title_awards USING btree (player_id);
CREATE INDEX idx_title_awards_title_id ON ypl_schema_validation.title_awards USING btree (title_id);
CREATE UNIQUE INDEX uq_title_awards_active ON ypl_schema_validation.title_awards USING btree (player_id, title_id) WHERE (revoked_at IS NULL);
CREATE INDEX idx_title_definitions_group_code ON ypl_schema_validation.title_definitions USING btree (group_code, sort_order);

-- ===== RLS =====
alter table public.account_teams enable row level security;
alter table public.battle_secrets enable row level security;
alter table public.battles enable row level security;
alter table public.community_authors enable row level security;
alter table public.community_items enable row level security;
alter table public.cpu_battles enable row level security;
alter table public.form_private_answers enable row level security;
alter table public.player_accounts enable row level security;
alter table public.push_outbox enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.site_data enable row level security;
alter table public.streak_runs enable row level security;
alter table public.tower_archive enable row level security;
alter table public.tower_cup_players enable row level security;
alter table public.tower_cup_runs enable row level security;
alter table public.tower_cups enable row level security;
alter table public.visitor_pins enable row level security;
alter table ypl_audit.change_log enable row level security;
alter table ypl_backup.event_registrations_20261104 enable row level security;
alter table ypl_backup.site_data_20261005 enable row level security;
alter table ypl_backup.site_data_20261103 enable row level security;
alter table ypl_backup.site_data_20261104 enable row level security;
alter table ypl_backup.site_data_20261106_notice_copy enable row level security;
alter table ypl_schema_validation.bracket_entry_slots enable row level security;
alter table ypl_schema_validation.bracket_identity_changes enable row level security;
alter table ypl_schema_validation.bracket_runtimes enable row level security;
alter table ypl_schema_validation.championship_advancements enable row level security;
alter table ypl_schema_validation.championship_qualifier_direct_selections enable row level security;
alter table ypl_schema_validation.competition_editions enable row level security;
alter table ypl_schema_validation.entries enable row level security;
alter table ypl_schema_validation.entry_participants enable row level security;
alter table ypl_schema_validation.event_registrations enable row level security;
alter table ypl_schema_validation.events enable row level security;
alter table ypl_schema_validation.hall_of_fame_entries enable row level security;
alter table ypl_schema_validation.league_intakes enable row level security;
alter table ypl_schema_validation.matches enable row level security;
alter table ypl_schema_validation.player_partners enable row level security;
alter table ypl_schema_validation.players enable row level security;
alter table ypl_schema_validation.ranking_awards enable row level security;
alter table ypl_schema_validation.ranking_baselines enable row level security;
alter table ypl_schema_validation.registration_submissions enable row level security;
alter table ypl_schema_validation.results enable row level security;
alter table ypl_schema_validation.seasons enable row level security;
alter table ypl_schema_validation.team_snapshot_members enable row level security;
alter table ypl_schema_validation.team_snapshots enable row level security;
alter table ypl_schema_validation.title_awards enable row level security;
alter table ypl_schema_validation.title_definitions enable row level security;

create policy "account_teams_own" on public.account_teams as permissive for all to authenticated using ((auth_user_id = ( SELECT auth.uid() AS uid))) with check ((auth_user_id = ( SELECT auth.uid() AS uid)));
create policy "battles_read" on public.battles as permissive for select to anon, authenticated using (true);
create policy "community_items_read" on public.community_items as permissive for select to anon, authenticated using (((NOT secret) OR ( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin) OR community_mine(COALESCE(parent_id, id))));
create policy "form_private_answers_admin" on public.form_private_answers as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "player_accounts_read" on public.player_accounts as permissive for select to authenticated using (((auth_user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)));
create policy "site_data_admin" on public.site_data as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "site_data_read" on public.site_data as permissive for select to anon, authenticated using (true);
create policy "tower_archive_read" on public.tower_archive as permissive for select to anon, authenticated using (true);
create policy "admin_write" on ypl_schema_validation.bracket_entry_slots as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "public_read" on ypl_schema_validation.bracket_entry_slots as permissive for select to anon, authenticated using (true);
create policy "admin_write" on ypl_schema_validation.bracket_identity_changes as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "public_read" on ypl_schema_validation.bracket_identity_changes as permissive for select to anon, authenticated using (true);
create policy "admin_write" on ypl_schema_validation.bracket_runtimes as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "public_read" on ypl_schema_validation.bracket_runtimes as permissive for select to anon, authenticated using (true);
create policy "admin_write" on ypl_schema_validation.championship_advancements as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "public_read" on ypl_schema_validation.championship_advancements as permissive for select to anon, authenticated using (true);
create policy "admin_write" on ypl_schema_validation.championship_qualifier_direct_selections as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "public_read" on ypl_schema_validation.championship_qualifier_direct_selections as permissive for select to anon, authenticated using (true);
create policy "admin_insert" on ypl_schema_validation.competition_editions as permissive for insert to authenticated with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "public_read" on ypl_schema_validation.competition_editions as permissive for select to anon, authenticated using (true);
create policy "admin_write" on ypl_schema_validation.entries as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "public_read" on ypl_schema_validation.entries as permissive for select to anon, authenticated using (true);
create policy "admin_write" on ypl_schema_validation.entry_participants as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "public_read" on ypl_schema_validation.entry_participants as permissive for select to anon, authenticated using (true);
create policy "admin_write" on ypl_schema_validation.event_registrations as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "public_read" on ypl_schema_validation.event_registrations as permissive for select to anon, authenticated using (true);
create policy "visitor_apply" on ypl_schema_validation.event_registrations as permissive for insert to anon with check (((registration_source = 'application'::text) AND (final_submission_id IS NULL) AND (EXISTS ( SELECT 1
   FROM ypl_schema_validation.events e
  WHERE ((e.id = event_registrations.event_id) AND (e.status = 'open'::text) AND (e.record_applied_at IS NULL)))) AND ((player_id IS NULL) OR (EXISTS ( SELECT 1
   FROM ypl_schema_validation.players p
  WHERE ((p.id = event_registrations.player_id) AND (p.display_name = event_registrations.registration_name)))))));
create policy "admin_write" on ypl_schema_validation.events as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "public_read" on ypl_schema_validation.events as permissive for select to anon, authenticated using (true);
create policy "admin_write" on ypl_schema_validation.hall_of_fame_entries as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "public_read" on ypl_schema_validation.hall_of_fame_entries as permissive for select to anon, authenticated using (true);
create policy "admin_write" on ypl_schema_validation.league_intakes as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "public_read" on ypl_schema_validation.league_intakes as permissive for select to anon, authenticated using (true);
create policy "admin_write" on ypl_schema_validation.matches as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "public_read" on ypl_schema_validation.matches as permissive for select to anon, authenticated using (true);
create policy "admin_write" on ypl_schema_validation.player_partners as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "public_read" on ypl_schema_validation.player_partners as permissive for select to anon, authenticated using (true);
create policy "admin_write" on ypl_schema_validation.players as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "public_read" on ypl_schema_validation.players as permissive for select to anon, authenticated using (true);
create policy "admin_write" on ypl_schema_validation.ranking_awards as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "public_read" on ypl_schema_validation.ranking_awards as permissive for select to anon, authenticated using (true);
create policy "admin_write" on ypl_schema_validation.ranking_baselines as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "public_read" on ypl_schema_validation.ranking_baselines as permissive for select to anon, authenticated using (true);
create policy "admin_write" on ypl_schema_validation.registration_submissions as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "public_read" on ypl_schema_validation.registration_submissions as permissive for select to anon, authenticated using (true);
create policy "admin_write" on ypl_schema_validation.results as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "public_read" on ypl_schema_validation.results as permissive for select to anon, authenticated using (true);
create policy "admin_write" on ypl_schema_validation.seasons as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "public_read" on ypl_schema_validation.seasons as permissive for select to anon, authenticated using (true);
create policy "admin_write" on ypl_schema_validation.team_snapshot_members as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "public_read" on ypl_schema_validation.team_snapshot_members as permissive for select to anon, authenticated using ((ypl_schema_validation.snapshot_revealed(snapshot_id) OR ( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)));
create policy "admin_write" on ypl_schema_validation.team_snapshots as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "public_read" on ypl_schema_validation.team_snapshots as permissive for select to anon, authenticated using ((ypl_schema_validation.snapshot_revealed(id) OR ( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)));
create policy "admin_write" on ypl_schema_validation.title_awards as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "public_read" on ypl_schema_validation.title_awards as permissive for select to anon, authenticated using (true);
create policy "admin_write" on ypl_schema_validation.title_definitions as permissive for all to authenticated using (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin)) with check (( SELECT ypl_schema_validation.is_ypl_admin() AS is_ypl_admin));
create policy "public_read" on ypl_schema_validation.title_definitions as permissive for select to anon, authenticated using (true);

-- ===== 트리거 =====
CREATE TRIGGER account_teams_cap BEFORE INSERT ON public.account_teams FOR EACH ROW EXECUTE FUNCTION account_teams_cap();
CREATE TRIGGER battles_deadline BEFORE INSERT OR UPDATE ON public.battles FOR EACH ROW EXECUTE FUNCTION battle_set_deadline();
CREATE TRIGGER battles_keep_official BEFORE DELETE ON public.battles FOR EACH ROW EXECUTE FUNCTION battles_keep_official();
CREATE TRIGGER battles_official_submission BEFORE INSERT OR UPDATE OF p1_entry_id, p2_entry_id, p1_player_id, p2_player_id ON public.battles FOR EACH ROW EXECUTE FUNCTION battles_official_submission();
CREATE TRIGGER battles_stamp_times BEFORE INSERT OR UPDATE OF status ON public.battles FOR EACH ROW EXECUTE FUNCTION battles_stamp_times();
CREATE TRIGGER push_match_waiting AFTER INSERT ON public.battles FOR EACH ROW WHEN (((new.kind = 'official'::text) AND (new.status = 'waiting'::text))) EXECUTE FUNCTION push_match_waiting();
CREATE TRIGGER tower_archive_keep BEFORE DELETE ON public.battles FOR EACH ROW EXECUTE FUNCTION tower_archive_keep();
CREATE CONSTRAINT TRIGGER push_community_reply AFTER INSERT ON public.community_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN ((new.parent_id IS NOT NULL)) EXECUTE FUNCTION push_community_reply();
CREATE TRIGGER log_change AFTER INSERT OR DELETE OR UPDATE ON public.player_accounts FOR EACH ROW EXECUTE FUNCTION ypl_audit.log_change();
CREATE TRIGGER log_change AFTER INSERT OR DELETE OR UPDATE ON public.site_data FOR EACH ROW EXECUTE FUNCTION ypl_audit.log_change();
CREATE TRIGGER site_data_bump_revision BEFORE UPDATE ON public.site_data FOR EACH ROW EXECUTE FUNCTION bump_site_data_revision();
CREATE TRIGGER push_tower_passed AFTER UPDATE OF wins ON public.streak_runs FOR EACH ROW WHEN (((new.daily IS NULL) AND (new.wins = (old.wins + 1)) AND (new.wins >= 2))) EXECUTE FUNCTION push_tower_passed();
CREATE TRIGGER push_tower_record AFTER UPDATE OF wins ON public.streak_runs FOR EACH ROW WHEN (((new.daily IS NULL) AND (new.wins = (old.wins + 1)) AND (new.wins >= 2))) EXECUTE FUNCTION push_tower_record();
CREATE TRIGGER tower_cup_climb AFTER UPDATE OF wins ON public.streak_runs FOR EACH ROW WHEN (((new.daily IS NULL) AND (new.wins > old.wins))) EXECUTE FUNCTION tower_cup_climb();
CREATE TRIGGER tower_cup_enter AFTER INSERT ON public.streak_runs FOR EACH ROW WHEN ((new.daily IS NULL)) EXECUTE FUNCTION tower_cup_enter();
CREATE TRIGGER log_change AFTER INSERT OR DELETE OR UPDATE ON ypl_schema_validation.bracket_entry_slots FOR EACH ROW EXECUTE FUNCTION ypl_audit.log_change();
CREATE TRIGGER championship_qualifier_direct_selection_runtime_cleanup BEFORE DELETE ON ypl_schema_validation.bracket_runtimes FOR EACH ROW EXECUTE FUNCTION ypl_schema_validation.clear_qualifier_direct_selections_on_runtime_delete();
CREATE TRIGGER log_change AFTER INSERT OR DELETE OR UPDATE ON ypl_schema_validation.bracket_runtimes FOR EACH ROW EXECUTE FUNCTION ypl_audit.log_change();
CREATE TRIGGER log_change AFTER INSERT OR DELETE OR UPDATE ON ypl_schema_validation.championship_advancements FOR EACH ROW EXECUTE FUNCTION ypl_audit.log_change();
CREATE TRIGGER log_change AFTER INSERT OR DELETE OR UPDATE ON ypl_schema_validation.championship_qualifier_direct_selections FOR EACH ROW EXECUTE FUNCTION ypl_audit.log_change();
CREATE TRIGGER log_change AFTER INSERT OR DELETE OR UPDATE ON ypl_schema_validation.competition_editions FOR EACH ROW EXECUTE FUNCTION ypl_audit.log_change();
CREATE TRIGGER log_change AFTER INSERT OR DELETE OR UPDATE ON ypl_schema_validation.entries FOR EACH ROW EXECUTE FUNCTION ypl_audit.log_change();
CREATE TRIGGER guard_league_intake_participant BEFORE INSERT OR UPDATE ON ypl_schema_validation.entry_participants FOR EACH ROW EXECUTE FUNCTION ypl_schema_validation.guard_league_intake_participant();
CREATE TRIGGER log_change AFTER INSERT OR DELETE OR UPDATE ON ypl_schema_validation.entry_participants FOR EACH ROW EXECUTE FUNCTION ypl_audit.log_change();
CREATE TRIGGER guard_account_name BEFORE INSERT ON ypl_schema_validation.event_registrations FOR EACH ROW EXECUTE FUNCTION guard_account_name();
CREATE TRIGGER guard_application_close BEFORE INSERT ON ypl_schema_validation.event_registrations FOR EACH ROW EXECUTE FUNCTION ypl_schema_validation.guard_application_close();
CREATE TRIGGER guard_league_intake_registration BEFORE INSERT OR UPDATE ON ypl_schema_validation.event_registrations FOR EACH ROW EXECUTE FUNCTION ypl_schema_validation.guard_league_intake_registration();
CREATE TRIGGER log_change AFTER INSERT OR DELETE OR UPDATE ON ypl_schema_validation.event_registrations FOR EACH ROW EXECUTE FUNCTION ypl_audit.log_change();
CREATE TRIGGER split_registration_answers BEFORE INSERT OR UPDATE OF registration_data ON ypl_schema_validation.event_registrations FOR EACH ROW EXECUTE FUNCTION ypl_schema_validation.split_registration_answers();
CREATE TRIGGER assign_competition_edition BEFORE INSERT OR UPDATE ON ypl_schema_validation.events FOR EACH ROW EXECUTE FUNCTION ypl_schema_validation.assign_competition_edition();
CREATE TRIGGER guard_group_record_apply BEFORE UPDATE OF record_applied_at ON ypl_schema_validation.events FOR EACH ROW EXECUTE FUNCTION ypl_schema_validation.guard_group_record_apply();
CREATE TRIGGER guard_league_event_identity BEFORE INSERT OR UPDATE ON ypl_schema_validation.events FOR EACH ROW EXECUTE FUNCTION ypl_schema_validation.guard_league_event_identity();
CREATE TRIGGER log_change AFTER INSERT OR DELETE OR UPDATE ON ypl_schema_validation.events FOR EACH ROW EXECUTE FUNCTION ypl_audit.log_change();
CREATE TRIGGER log_change AFTER INSERT OR DELETE OR UPDATE ON ypl_schema_validation.hall_of_fame_entries FOR EACH ROW EXECUTE FUNCTION ypl_audit.log_change();
CREATE TRIGGER log_change AFTER INSERT OR DELETE OR UPDATE ON ypl_schema_validation.league_intakes FOR EACH ROW EXECUTE FUNCTION ypl_audit.log_change();
CREATE TRIGGER championship_qualifier_match_stop_guard BEFORE INSERT OR UPDATE OF winner_entry_id ON ypl_schema_validation.matches FOR EACH ROW EXECUTE FUNCTION ypl_schema_validation.championship_qualifier_match_stop_guard();
CREATE TRIGGER guard_group_stage_winner BEFORE UPDATE OF winner_entry_id ON ypl_schema_validation.matches FOR EACH ROW EXECUTE FUNCTION ypl_schema_validation.guard_group_stage_winner();
CREATE TRIGGER log_change AFTER INSERT OR DELETE OR UPDATE ON ypl_schema_validation.matches FOR EACH ROW EXECUTE FUNCTION ypl_audit.log_change();
CREATE TRIGGER matches_clear_outcome_on_winner_change BEFORE UPDATE ON ypl_schema_validation.matches FOR EACH ROW EXECUTE FUNCTION ypl_schema_validation.matches_clear_outcome_on_winner_change();
CREATE TRIGGER log_change AFTER INSERT OR DELETE OR UPDATE ON ypl_schema_validation.player_partners FOR EACH ROW EXECUTE FUNCTION ypl_audit.log_change();
CREATE TRIGGER link_new_player_account AFTER INSERT ON ypl_schema_validation.players FOR EACH ROW EXECUTE FUNCTION link_new_player_account();
CREATE TRIGGER log_change AFTER INSERT OR DELETE OR UPDATE ON ypl_schema_validation.players FOR EACH ROW EXECUTE FUNCTION ypl_audit.log_change();
CREATE TRIGGER log_change AFTER INSERT OR DELETE OR UPDATE ON ypl_schema_validation.ranking_awards FOR EACH ROW EXECUTE FUNCTION ypl_audit.log_change();
CREATE TRIGGER log_change AFTER INSERT OR DELETE OR UPDATE ON ypl_schema_validation.ranking_baselines FOR EACH ROW EXECUTE FUNCTION ypl_audit.log_change();
CREATE TRIGGER log_change AFTER INSERT OR DELETE OR UPDATE ON ypl_schema_validation.results FOR EACH ROW EXECUTE FUNCTION ypl_audit.log_change();
CREATE TRIGGER log_change AFTER INSERT OR DELETE OR UPDATE ON ypl_schema_validation.seasons FOR EACH ROW EXECUTE FUNCTION ypl_audit.log_change();

-- ===== 뷰 =====
-- 네 스키마에 뷰와 구체화 뷰가 없다.

-- ===== 권한 (anon, authenticated, service_role) =====
grant delete, insert, maintain, references, select, trigger, truncate, update on public.site_data to service_role;
grant delete, insert, select on ypl_schema_validation.bracket_entry_slots to authenticated;
grant delete, insert, select on ypl_schema_validation.bracket_identity_changes to authenticated;
grant delete, insert, select on ypl_schema_validation.bracket_runtimes to authenticated;
grant delete, insert, select on ypl_schema_validation.championship_qualifier_direct_selections to authenticated;
grant delete, insert, select on ypl_schema_validation.entries to authenticated;
grant delete, insert, select on ypl_schema_validation.entry_participants to authenticated;
grant delete, insert, select on ypl_schema_validation.players to authenticated;
grant delete, insert, select on ypl_schema_validation.team_snapshots to authenticated;
grant delete, insert, select, update on public.account_teams to authenticated;
grant delete, insert, select, update on public.site_data to authenticated;
grant delete, insert, select, update on ypl_schema_validation.championship_advancements to authenticated;
grant delete, insert, select, update on ypl_schema_validation.event_registrations to authenticated;
grant delete, insert, select, update on ypl_schema_validation.hall_of_fame_entries to authenticated;
grant delete, insert, select, update on ypl_schema_validation.matches to authenticated;
grant delete, insert, select, update on ypl_schema_validation.ranking_awards to authenticated;
grant delete, insert, select, update on ypl_schema_validation.results to authenticated;
grant delete, maintain, references, select, trigger, truncate on public.push_subscriptions to service_role;
grant delete, select on public.form_private_answers to authenticated;
grant insert, select on ypl_schema_validation.competition_editions to authenticated;
grant insert, select on ypl_schema_validation.registration_submissions to authenticated;
grant insert, select on ypl_schema_validation.team_snapshot_members to authenticated;
grant insert, select, update on ypl_schema_validation.events to authenticated;
grant insert, select, update on ypl_schema_validation.league_intakes to authenticated;
grant maintain, references, select, trigger, truncate on public.account_teams to service_role;
grant maintain, references, select, trigger, truncate on public.battle_secrets to service_role;
grant maintain, references, select, trigger, truncate on public.battles to service_role;
grant maintain, references, select, trigger, truncate on public.community_authors to service_role;
grant maintain, references, select, trigger, truncate on public.community_items to service_role;
grant maintain, references, select, trigger, truncate on public.cpu_battles to service_role;
grant maintain, references, select, trigger, truncate on public.form_private_answers to service_role;
grant maintain, references, select, trigger, truncate on public.player_accounts to service_role;
grant maintain, references, select, trigger, truncate on public.streak_runs to service_role;
grant maintain, references, select, trigger, truncate on public.tower_archive to service_role;
grant maintain, references, select, trigger, truncate on public.tower_cup_players to service_role;
grant maintain, references, select, trigger, truncate on public.tower_cup_runs to service_role;
grant maintain, references, select, trigger, truncate on public.tower_cups to service_role;
grant maintain, references, select, trigger, truncate on public.visitor_pins to service_role;
grant select on public.community_items to anon;
grant select on public.community_items to authenticated;
grant select on public.form_private_answers to anon;
grant select on public.player_accounts to authenticated;
grant select on public.push_outbox to service_role;
grant select on public.site_data to anon;
grant select on public.tower_archive to anon;
grant select on public.tower_archive to authenticated;
grant select on ypl_schema_validation.bracket_entry_slots to anon;
grant select on ypl_schema_validation.bracket_entry_slots to service_role;
grant select on ypl_schema_validation.bracket_identity_changes to anon;
grant select on ypl_schema_validation.bracket_identity_changes to service_role;
grant select on ypl_schema_validation.bracket_runtimes to anon;
grant select on ypl_schema_validation.bracket_runtimes to service_role;
grant select on ypl_schema_validation.championship_advancements to anon;
grant select on ypl_schema_validation.championship_advancements to service_role;
grant select on ypl_schema_validation.championship_qualifier_direct_selections to anon;
grant select on ypl_schema_validation.championship_qualifier_direct_selections to service_role;
grant select on ypl_schema_validation.competition_editions to anon;
grant select on ypl_schema_validation.competition_editions to service_role;
grant select on ypl_schema_validation.entries to anon;
grant select on ypl_schema_validation.entries to service_role;
grant select on ypl_schema_validation.entry_participants to anon;
grant select on ypl_schema_validation.entry_participants to service_role;
grant select on ypl_schema_validation.event_registrations to anon;
grant select on ypl_schema_validation.event_registrations to service_role;
grant select on ypl_schema_validation.events to anon;
grant select on ypl_schema_validation.events to service_role;
grant select on ypl_schema_validation.hall_of_fame_entries to anon;
grant select on ypl_schema_validation.hall_of_fame_entries to service_role;
grant select on ypl_schema_validation.league_intakes to anon;
grant select on ypl_schema_validation.league_intakes to service_role;
grant select on ypl_schema_validation.matches to anon;
grant select on ypl_schema_validation.matches to service_role;
grant select on ypl_schema_validation.player_partners to anon;
grant select on ypl_schema_validation.player_partners to authenticated;
grant select on ypl_schema_validation.player_partners to service_role;
grant select on ypl_schema_validation.players to anon;
grant select on ypl_schema_validation.players to service_role;
grant select on ypl_schema_validation.ranking_awards to anon;
grant select on ypl_schema_validation.ranking_awards to service_role;
grant select on ypl_schema_validation.ranking_baselines to anon;
grant select on ypl_schema_validation.ranking_baselines to authenticated;
grant select on ypl_schema_validation.ranking_baselines to service_role;
grant select on ypl_schema_validation.registration_submissions to anon;
grant select on ypl_schema_validation.registration_submissions to service_role;
grant select on ypl_schema_validation.results to anon;
grant select on ypl_schema_validation.results to service_role;
grant select on ypl_schema_validation.seasons to anon;
grant select on ypl_schema_validation.seasons to authenticated;
grant select on ypl_schema_validation.seasons to service_role;
grant select on ypl_schema_validation.team_snapshot_members to anon;
grant select on ypl_schema_validation.team_snapshot_members to service_role;
grant select on ypl_schema_validation.team_snapshots to anon;
grant select on ypl_schema_validation.team_snapshots to service_role;
grant select on ypl_schema_validation.title_awards to anon;
grant select on ypl_schema_validation.title_awards to authenticated;
grant select on ypl_schema_validation.title_awards to service_role;
grant select on ypl_schema_validation.title_definitions to anon;
grant select on ypl_schema_validation.title_definitions to authenticated;
grant select on ypl_schema_validation.title_definitions to service_role;

-- 열 단위 권한
grant insert (event_id, player_id, registered_at, registration_data, registration_name, registration_source, updated_at) on ypl_schema_validation.event_registrations to anon;
grant select (applied_at, apply_error, created_at, deadline_at, ended_at, ended_by, engine, event_id, format_id, id, kind, p1_entry_id, p1_name, p1_player_id, p1_submission_id, p2_entry_id, p2_name, p2_player_id, p2_submission_id, regulation, rematch_id, room, run_id, source_node_key, spectator_log, started_at, status, turn, updated_at, version, winner) on public.battles to anon;
grant select (applied_at, apply_error, created_at, deadline_at, ended_at, ended_by, engine, event_id, format_id, id, kind, p1_entry_id, p1_name, p1_player_id, p1_submission_id, p2_entry_id, p2_name, p2_player_id, p2_submission_id, regulation, rematch_id, room, run_id, source_node_key, spectator_log, started_at, status, turn, updated_at, version, winner) on public.battles to authenticated;
grant select (round_schedule) on ypl_schema_validation.bracket_runtimes to anon;
grant select (round_schedule) on ypl_schema_validation.bracket_runtimes to authenticated;
grant select (table_label) on ypl_schema_validation.matches to anon;
grant select (table_label) on ypl_schema_validation.matches to authenticated;
grant update (round_schedule, updated_at) on ypl_schema_validation.bracket_runtimes to authenticated;

-- ===== 함수 서명 (본문 제외) =====
-- public.account_delete() returns boolean, plpgsql, security definer, acl: {postgres=X/postgres,authenticated=X/postgres}
-- public.account_teams_cap() returns trigger, plpgsql, security definer, acl: {postgres=X/postgres}
-- public.account_unlink() returns boolean, plpgsql, security definer, acl: {postgres=X/postgres,authenticated=X/postgres}
-- public.admin_change_log(p_limit integer, p_before bigint, p_table text) returns TABLE(id bigint, at timestamp with time zone, actor_email text, actor_role text, table_name text, op text, row_id text, old jsonb, new jsonb), plpgsql, security definer, acl: {postgres=X/postgres,authenticated=X/postgres}
-- public.admin_unlink_player(p_user uuid) returns boolean, plpgsql, security definer, acl: {postgres=X/postgres,authenticated=X/postgres}
-- public.announcement_form_fields(p_announcement_id text) returns jsonb, sql, security invoker, acl: {postgres=X/postgres}
-- public.apply_with_account(p_event_id uuid, p_registration_data jsonb) returns uuid, plpgsql, security definer, acl: {postgres=X/postgres,authenticated=X/postgres}
-- public.battle_apply_result(p_battle_id text, p_expected_stamp text, p_mode text, p_runtime_id uuid, p_updates jsonb, p_inserts jsonb, p_delete_ids uuid[]) returns text, plpgsql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.battle_apply_team_series(p_battle_id text, p_parent_key text, p_winner_entry_id uuid, p_expected_stamp text, p_parent_updates jsonb, p_parent_inserts jsonb, p_parent_delete_ids uuid[], p_child_updates jsonb, p_child_inserts jsonb, p_child_delete_ids uuid[], p_battle_ids text[]) returns text, plpgsql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.battle_bracket_facts(p_event_id uuid) returns jsonb, plpgsql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.battle_cancel(p_id text) returns boolean, sql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.battle_create(p_id text, p_regulation text, p_format_id text, p_engine text, p_p1_name text, p_p1_token_hash text, p_p1_team jsonb) returns void, plpgsql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.battle_create_official(p_id text, p_regulation text, p_format_id text, p_engine text, p_p1_name text, p_p1_token_hash text, p_p1_team jsonb, p_event_id uuid, p_source_node_key text, p_p1_entry_id uuid, p_p1_player_id uuid) returns void, plpgsql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.battle_create_room(p_id text, p_regulation text, p_format_id text, p_engine text, p_p1_name text, p_p1_token_hash text, p_p1_team jsonb, p_room text, p_room_code text) returns void, plpgsql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.battle_full_log(p_id text) returns jsonb, plpgsql, security definer, acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- public.battle_housekeeping() returns jsonb, plpgsql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.battle_mark_apply_error(p_battle_id text, p_error text) returns void, sql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.battle_match_stamp(p_event_id uuid) returns text, sql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.battle_official_seat(p_event_id uuid, p_source_node_key text, p_side text, p_pin text) returns jsonb, plpgsql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.battle_save(p_id text, p_version integer, p_status text, p_p2_name text, p_turn integer, p_winner text, p_ended_by text, p_spectator_log text, p_log text, p_input_log text, p_p2_token_hash text, p_state jsonb, p_pending jsonb) returns boolean, plpgsql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.battle_seat_submission(p_entry_id uuid, p_player_id uuid) returns uuid, sql, security definer, acl: {postgres=X/postgres}
-- public.battle_set_account(p_id text, p_side text, p_user uuid) returns void, plpgsql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.battle_set_cpu_memory(p_id text, p_memory jsonb) returns void, plpgsql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.battle_set_deadline() returns trigger, plpgsql, security invoker, acl: (default)
-- public.battle_set_rematch(p_id text, p_rematch text, p_expected text) returns boolean, plpgsql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.battle_set_seat(p_id text, p_side text, p_entry_id uuid, p_player_id uuid, p_token_hash text) returns void, plpgsql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.battle_start_official(p_id text, p_version integer, p_p2_name text, p_turn integer, p_spectator_log text, p_p2_token_hash text, p_state jsonb, p_p2_entry_id uuid, p_p2_player_id uuid) returns boolean, plpgsql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.battle_team_seat(p_event_id uuid, p_bout_key text, p_side text, p_player_id uuid, p_pin text) returns jsonb, plpgsql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.battle_void(p_id text) returns text, plpgsql, security definer, acl: {postgres=X/postgres,authenticated=X/postgres}
-- public.battle_void_now(p_id text, p_reason text) returns text, plpgsql, security definer, acl: {postgres=X/postgres}
-- public.battles_keep_official() returns trigger, plpgsql, security invoker, acl: (default)
-- public.battles_official_submission() returns trigger, plpgsql, security invoker, acl: (default)
-- public.battles_stamp_times() returns trigger, plpgsql, security invoker, acl: (default)
-- public.bump_site_data_revision() returns trigger, plpgsql, security invoker, acl: {postgres=X/postgres}
-- public.community_mine(p_post text) returns boolean, sql, security definer, acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}
-- public.community_write(p_action text, p_board text, p_id text, p_parent_id text, p_payload jsonb, p_secret boolean, p_pin text) returns text, plpgsql, security definer, acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}
-- public.cpu_battle_record(p_id text, p_format_id text, p_engine text, p_winner text, p_ended_by text, p_turns integer, p_input_log text) returns boolean, plpgsql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.cpu_battle_record(p_id text, p_format_id text, p_engine text, p_winner text, p_ended_by text, p_turns integer, p_input_log text, p_level text) returns boolean, plpgsql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.decide_player_link(p_user uuid, p_approve boolean) returns player_accounts, plpgsql, security definer, acl: {postgres=X/postgres,authenticated=X/postgres}
-- public.delete_push_subscription(p_endpoint text) returns void, sql, security definer, acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}
-- public.form_answers_split(p_fields jsonb, p_answers jsonb, OUT public_answers jsonb, OUT private_answers jsonb) returns record, sql, security invoker, acl: {postgres=X/postgres}
-- public.guard_account_name() returns trigger, plpgsql, security definer, acl: {postgres=X/postgres}
-- public.keep_private_answers(p_subject text, p_answers jsonb) returns void, sql, security definer, acl: {postgres=X/postgres}
-- public.link_new_player_account() returns trigger, plpgsql, security definer, acl: {postgres=X/postgres}
-- public.my_battles(p_limit integer, p_offset integer) returns TABLE(id text, status text, regulation text, format_id text, p1_name text, p2_name text, turn integer, winner text, ended_by text, kind text, created_at timestamp with time zone, updated_at timestamp with time zone, my_side text), sql, security definer, acl: {postgres=X/postgres,authenticated=X/postgres}
-- public.push_closes_at(p_value text) returns timestamp with time zone, plpgsql, security invoker, acl: {postgres=X/postgres}
-- public.push_community_reply() returns trigger, plpgsql, security definer, acl: {postgres=X/postgres}
-- public.push_inbox(p_kinds text[]) returns TABLE(kind text, body text, url text, created_at timestamp with time zone), sql, security definer, acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}
-- public.push_match_waiting() returns trigger, plpgsql, security definer, acl: {postgres=X/postgres}
-- public.push_queue_notice(p_id text, p_title text) returns void, sql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.push_settings(p_endpoint text) returns jsonb, sql, security definer, acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}
-- public.push_take(p_sweep boolean, p_now timestamp with time zone) returns TABLE(kind text, endpoint text, p256dh text, auth text, title text, body text, url text), plpgsql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.push_tower_passed() returns trigger, plpgsql, security definer, acl: {postgres=X/postgres}
-- public.push_tower_record() returns trigger, plpgsql, security definer, acl: {postgres=X/postgres}
-- public.request_player_link(p_name text) returns player_accounts, plpgsql, security definer, acl: {postgres=X/postgres,authenticated=X/postgres}
-- public.reset_submission_pin(p_registration_id uuid) returns void, plpgsql, security definer, acl: {postgres=X/postgres,authenticated=X/postgres}
-- public.rls_auto_enable() returns event_trigger, plpgsql, security definer, acl: {postgres=X/postgres}
-- public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void, plpgsql, security definer, acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}
-- public.set_push_kinds(p_endpoint text, p_kinds text[]) returns jsonb, plpgsql, security definer, acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}
-- public.streak_active_run(p_user uuid, p_daily boolean) returns jsonb, sql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.streak_after_battle(p_battle_id text, p_id text, p_regulation text, p_format_id text, p_engine text, p_token_hash text, p_p1_team jsonb, p_state jsonb, p_pending jsonb, p_turn integer, p_spectator_log text) returns jsonb, plpgsql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.streak_begin(p_user uuid, p_format_id text, p_offer jsonb, p_daily boolean) returns jsonb, plpgsql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.streak_board(p_month date) returns TABLE(place integer, trainer_name text, wins integer, live boolean, battle_id text, reached_at timestamp with time zone, mine boolean), sql, security definer, acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- public.streak_clear_secret(p_id text) returns void, sql, security definer, acl: {postgres=X/postgres}
-- public.streak_daily_board(p_day date) returns TABLE(place integer, trainer_name text, wins integer, live boolean, battle_id text, reached_at timestamp with time zone, mine boolean), sql, security definer, acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- public.streak_first(p_run uuid, p_id text, p_regulation text, p_format_id text, p_engine text, p_token_hash text, p_p1_team jsonb, p_state jsonb, p_pending jsonb, p_turn integer, p_spectator_log text) returns jsonb, plpgsql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.streak_month_tops() returns TABLE(month date, place integer, trainer_name text, wins integer, run_id uuid, reached_at timestamp with time zone), sql, security definer, acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}
-- public.streak_my_runs(p_limit integer, p_offset integer) returns TABLE(run_id uuid, month date, daily date, wins integer, lives integer, status text, started_at timestamp with time zone, ended_at timestamp with time zone), sql, security definer, acl: {postgres=X/postgres,authenticated=X/postgres}
-- public.streak_next(p_battle_id text, p_id text, p_regulation text, p_format_id text, p_engine text, p_token_hash text, p_p1_team jsonb, p_state jsonb, p_pending jsonb, p_turn integer, p_spectator_log text) returns jsonb, plpgsql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.streak_open_battle(p_run uuid, p_id text, p_regulation text, p_format_id text, p_engine text, p_p1_name text, p_token_hash text, p_p1_team jsonb, p_state jsonb, p_pending jsonb, p_turn integer, p_spectator_log text) returns void, plpgsql, security definer, acl: {postgres=X/postgres}
-- public.streak_run_public(p_battle_id text) returns jsonb, sql, security definer, acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- public.streak_run_state(p_battle_id text) returns jsonb, sql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.streak_run_wins(p_battle_id text) returns integer, sql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.streak_settle(p_battle_id text, p_relight boolean, p_offer jsonb) returns jsonb, plpgsql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.streak_start(p_user uuid, p_id text, p_regulation text, p_format_id text, p_engine text, p_token_hash text, p_p1_team jsonb, p_state jsonb, p_pending jsonb, p_turn integer, p_spectator_log text) returns jsonb, plpgsql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.streak_trainer_name(p_user uuid) returns text, sql, security definer, acl: {postgres=X/postgres,service_role=X/postgres}
-- public.submit_announcement_response(p_announcement_id text, p_answers jsonb) returns void, plpgsql, security definer, acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}
-- public.tower_archive_keep() returns trigger, plpgsql, security definer, acl: {postgres=X/postgres}
-- public.tower_cup_board(p_id uuid) returns jsonb, sql, security definer, acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}
-- public.tower_cup_climb() returns trigger, plpgsql, security definer, acl: {postgres=X/postgres}
-- public.tower_cup_close(p_id uuid) returns jsonb, plpgsql, security definer, acl: {postgres=X/postgres,authenticated=X/postgres}
-- public.tower_cup_create(p_title text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_room text, p_limit integer) returns jsonb, plpgsql, security definer, acl: {postgres=X/postgres,authenticated=X/postgres}
-- public.tower_cup_enter() returns trigger, plpgsql, security definer, acl: {postgres=X/postgres}
-- public.tower_cup_join(p_id uuid, p_code text) returns jsonb, plpgsql, security definer, acl: {postgres=X/postgres,authenticated=X/postgres}
-- public.tower_cup_name() returns text, plpgsql, security definer, acl: {postgres=X/postgres}
-- public.tower_cups() returns TABLE(id uuid, title text, host_name text, starts_at timestamp with time zone, ends_at timestamp with time zone, room text, run_limit integer, players integer, joined boolean, hosting boolean), sql, security definer, acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}
-- public.visitor_pin_check(p_scope text, p_subject text, p_pin text) returns text, plpgsql, security invoker, acl: {postgres=X/postgres}
-- public.visitor_pin_hash(p_subject text, p_pin text) returns text, sql, security invoker, acl: {postgres=X/postgres}
-- ypl_audit.claims() returns jsonb, sql, security invoker, acl: (default)
-- ypl_audit.log_change() returns trigger, plpgsql, security definer, acl: {postgres=X/postgres}
-- ypl_schema_validation.add_bracket_manual_registration(p_event_id uuid, p_name text) returns ypl_schema_validation.event_registrations, plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.add_championship_qualifier_manual_registration(p_qualifier_event_id uuid, p_player_id uuid) returns TABLE(registration_id uuid, created boolean), plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.application_closed(p_form jsonb) returns boolean, plpgsql, security invoker, acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.application_edit_gate(p_registration_id uuid, p_registration_name text, p_pin text) returns text, plpgsql, security definer, acl: {postgres=X/postgres}
-- ypl_schema_validation.apply_event_record(p_event_id uuid, p_result_plan jsonb, p_award_plan jsonb, p_reveal_rosters boolean, p_championship_ordinal integer, p_hall_of_fame_id uuid) returns jsonb, plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.assign_competition_edition() returns trigger, plpgsql, security invoker, acl: {postgres=X/postgres}
-- ypl_schema_validation.cancel_championship_advancement(p_advancement_id uuid) returns TABLE(advancement_id uuid, registration_id uuid), plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.cancel_championship_application_event_pair(p_qualifier_event_id uuid, p_final_event_id uuid) returns TABLE(qualifier_event_id uuid, final_event_id uuid, cancelled boolean), plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.cancel_league_intake(p_intake_id uuid) returns boolean, plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.championship_qualifier_match_stop_guard() returns trigger, plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.check_draw_rookie_candidates(p_event_id uuid, p_players uuid[]) returns void, plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.clear_qualifier_direct_selections_on_runtime_delete() returns trigger, plpgsql, security definer, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.complete_championship_final_record_application(p_final_event_id uuid, p_ordinal integer) returns TABLE(id uuid, qualifier_event_id uuid, status text, record_applied_at timestamp with time zone, team_revealed_at timestamp with time zone, round_number integer), plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.correct_pristine_event_round(p_event_id uuid, p_round integer) returns uuid, plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.create_championship_advancement(p_advancement_id uuid, p_registration_id uuid, p_final_event_id uuid, p_player_id uuid, p_advancement_type text, p_source_entry_id uuid, p_reason text) returns TABLE(advancement_id uuid, registration_id uuid), plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.create_group_final(p_event_id uuid, p_runtime_id uuid, p_slots jsonb, p_matches jsonb) returns void, plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.create_group_playoff(p_event_id uuid, p_runtime_id uuid, p_pool integer) returns text, plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.create_individual_bracket_draw(p_runtime_id uuid, p_event_id uuid, p_topology text, p_participants jsonb, p_slots jsonb, p_advance integer, p_final_format text, p_rookie_players uuid[], p_initial_matches jsonb) returns uuid, plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.create_normalized_bracket_runtime(p_runtime_id uuid, p_event_id uuid, p_topology_kind text, p_participants jsonb, p_slots jsonb) returns TABLE(runtime_id uuid, event_id uuid, topology_kind text, participant_count integer, slot_count integer, created boolean), plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.create_normalized_single_bracket_runtime(p_runtime_id uuid, p_event_id uuid, p_participants jsonb, p_slots jsonb) returns TABLE(runtime_id uuid, event_id uuid, participant_count integer, slot_count integer, match_count integer, created boolean), plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.create_selected_bracket_runtime(p_runtime_id uuid, p_event_id uuid, p_topology_kind text, p_participants jsonb, p_slots jsonb) returns TABLE(runtime_id uuid, event_id uuid, topology_kind text, participant_count integer, slot_count integer, created boolean), plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.delete_league_intake_notice(p_intake_id uuid, p_announcement_id text) returns jsonb, plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.delete_normalized_bracket_runtime(p_runtime_id uuid, p_event_id uuid) returns TABLE(runtime_id uuid, event_id uuid, deleted_match_count integer, deleted boolean), plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.delete_normalized_single_bracket_runtime(p_runtime_id uuid, p_event_id uuid) returns TABLE(runtime_id uuid, event_id uuid, deleted_match_count integer, deleted_slot_count integer, deleted_identity_count integer, restored_event_status text), plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.edit_event_application(p_registration_id uuid, p_registration_name text, p_answers jsonb, p_pin text) returns text, plpgsql, security definer, acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.ensure_championship_final_hall_of_fame(p_event_id uuid, p_hall_of_fame_id uuid) returns TABLE(hall_of_fame_id uuid, result_id uuid, player_id uuid, generation_number integer, created boolean), plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.ensure_current_ypl_season() returns ypl_schema_validation.seasons, plpgsql, security definer, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.ensure_current_ypl_season_for_date(p_at timestamp with time zone) returns ypl_schema_validation.seasons, plpgsql, security definer, acl: {postgres=X/postgres}
-- ypl_schema_validation.finalize_championship_qualifier(p_qualifier_event_id uuid) returns TABLE(qualifier_event_id uuid, final_event_id uuid, alive_entry_ids uuid[], qualifier_advancement_count integer, created boolean), plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.freeze_event_final_submissions(p_event_id uuid) returns TABLE(registration_id uuid, previous_final_submission_id uuid, final_submission_id uuid), plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.group_pool_qualification(p_event_id uuid, p_pool integer) returns jsonb, plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.group_rank_bands(p_members uuid[], p_matches jsonb) returns jsonb, plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.guard_application_close() returns trigger, plpgsql, security invoker, acl: {postgres=X/postgres}
-- ypl_schema_validation.guard_group_record_apply() returns trigger, plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.guard_group_stage_winner() returns trigger, plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- ypl_schema_validation.guard_league_event_identity() returns trigger, plpgsql, security invoker, acl: {postgres=X/postgres}
-- ypl_schema_validation.guard_league_intake_participant() returns trigger, plpgsql, security invoker, acl: {postgres=X/postgres}
-- ypl_schema_validation.guard_league_intake_registration() returns trigger, plpgsql, security invoker, acl: {postgres=X/postgres}
-- ypl_schema_validation.has_individual_master_eligibility(p_player_id uuid) returns boolean, sql, security invoker, acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.insert_group_final_matches(p_event_id uuid, p_runtime_id uuid, p_rows jsonb) returns void, plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.is_completed_rookie_champion(p_event_id uuid, p_player_id uuid) returns boolean, sql, security invoker, acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.is_ypl_admin() returns boolean, sql, security invoker, acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.league_intake_has_downstream(p_event_ids uuid[], p_ignore_registrations boolean) returns boolean, sql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.list_same_round_rookie_champions(p_event_id uuid) returns TABLE(player_id uuid, display_name text, registration_id uuid, registration_name text), sql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.lock_group_draw(p_event_id uuid, p_runtime_id uuid) returns ypl_schema_validation.bracket_runtimes, plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.matches_clear_outcome_on_winner_change() returns trigger, plpgsql, security invoker, acl: {postgres=X/postgres}
-- ypl_schema_validation.open_event_application(p_registration_id uuid, p_registration_name text, p_pin text) returns TABLE(answers jsonb, denied text), plpgsql, security definer, acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.recommend_championship_direct_entrants(p_qualifier_event_id uuid, p_count integer) returns TABLE(registration_id uuid, registration_name text, season_rank integer, points numeric), sql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.release_championship_final_record_application(p_final_event_id uuid) returns TABLE(id uuid, status text, record_applied_at timestamp with time zone, team_revealed_at timestamp with time zone, round_number integer), plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.release_event_final_submissions(p_event_id uuid) returns TABLE(id uuid, status text, record_applied_at timestamp with time zone, team_revealed_at timestamp with time zone), plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.remove_championship_final_hall_of_fame(p_event_id uuid) returns TABLE(hall_of_fame_id uuid, result_id uuid, player_id uuid, generation_number integer, removed boolean), plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.reopen_championship_qualifier(p_qualifier_event_id uuid) returns TABLE(qualifier_event_id uuid, final_event_id uuid, removed_advancement_count integer, reopened boolean), plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.reopen_group_stage(p_event_id uuid, p_runtime_id uuid, p_pool integer) returns void, plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.reserve_competition_edition(p_family text, p_existing_id uuid) returns ypl_schema_validation.competition_editions, plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.resolve_ypl_season_for_date(p_at timestamp with time zone) returns TABLE(season_number smallint, starts_on date, ends_on date), sql, security invoker, acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.restore_event_final_submissions(p_event_id uuid, p_snapshot jsonb) returns void, plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.revert_event_record(p_event_id uuid) returns jsonb, plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.save_championship_application_event_pair(p_qualifier_event_id uuid, p_final_event_id uuid, p_season_id uuid, p_announcement_id text, p_base_name text, p_round_number integer, p_battle_format text, p_generation integer, p_final_capacity integer, p_qualification_slots integer, p_regulation_id text, p_cup_rule_id text, p_cup_rule_settings jsonb, p_registration_settings jsonb, p_competition_settings jsonb, p_qualifier_held_on date, p_final_held_on date, p_qualifier_submission_target_at timestamp with time zone, p_final_submission_target_at timestamp with time zone) returns TABLE(qualifier_event_id uuid, final_event_id uuid, created boolean), plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.save_group_final_matches(p_event_id uuid, p_runtime_id uuid, p_expected jsonb, p_updates jsonb, p_inserts jsonb, p_deletes uuid[]) returns void, plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.save_league_intake(p_announcement_id text, p_season_id uuid, p_existing_master_event_id uuid, p_settings jsonb) returns ypl_schema_validation.league_intakes, plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.set_championship_qualifier_direct_selections(p_qualifier_event_id uuid, p_registration_ids uuid[]) returns TABLE(qualifier_event_id uuid, direct_count integer, qualification_slots integer), plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.set_group_stage_winner(p_event_id uuid, p_runtime_id uuid, p_key text, p_winner uuid, p_expected_winner uuid) returns void, plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.set_normalized_match_outcome(p_event_id uuid, p_source_node_key text, p_score_a smallint, p_score_b smallint, p_forfeit boolean) returns TABLE(outcome_match_id uuid, outcome_score_a smallint, outcome_score_b smallint, outcome_resolution text), plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.set_normalized_match_table(p_event_id uuid, p_source_node_key text, p_table_label text) returns TABLE(table_match_id uuid, table_source_node_key text, match_table_label text), plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.set_normalized_round_schedule(p_runtime_id uuid, p_event_id uuid, p_schedule jsonb) returns jsonb, plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.set_normalized_single_bracket_winner(p_runtime_id uuid, p_event_id uuid, p_source_node_key text, p_winner_entry_id uuid) returns TABLE(runtime_id uuid, event_id uuid, source_node_key text, previous_winner_entry_id uuid, winner_entry_id uuid, deleted_downstream_count integer, created_downstream_count integer, changed boolean), plpgsql, security invoker, acl: {postgres=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.snapshot_revealed(p_snapshot_id uuid) returns boolean, sql, security invoker, acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}
-- ypl_schema_validation.split_registration_answers() returns trigger, plpgsql, security definer, acl: {postgres=X/postgres}
-- ypl_schema_validation.submit_registration_team_snapshot(p_event_id uuid, p_registration_id uuid, p_registration_name text, p_snapshot jsonb, p_members jsonb) returns TABLE(submission_id uuid, snapshot_id uuid, revision integer, submitted_at timestamp with time zone), plpgsql, security definer, acl: {postgres=X/postgres}
-- ypl_schema_validation.submit_registration_team_snapshot(p_event_id uuid, p_registration_id uuid, p_registration_name text, p_snapshot jsonb, p_members jsonb, p_pin text) returns TABLE(submission_id uuid, snapshot_id uuid, revision integer, submitted_at timestamp with time zone, denied text), plpgsql, security definer, acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}

-- ===== 확장 =====
-- extension http 1.6 (schema extensions)
-- extension pg_cron 1.6.4 (schema pg_catalog)
-- extension pg_stat_statements 1.11 (schema extensions)
-- extension pgcrypto 1.3 (schema extensions)
-- extension plpgsql 1.0 (schema pg_catalog)
-- extension supabase_vault 0.3.1 (schema vault)
-- extension uuid-ossp 1.1 (schema extensions)

-- ===== 예약 작업 (cron.job: 이름 | 일정 | 명령) =====
-- battle-housekeeping | 10 19 * * * | select public.battle_housekeeping()
