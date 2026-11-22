import test from "node:test";
import assert from "node:assert/strict";
import { buildExportCsvs, toCsv } from "../src/services/recordsExport.js";

test("csv quotes what needs quoting and starts with a BOM", () => {
  const csv = toCsv(["a", "b"], [["x,y", 'say "hi"'], [null, 3]]);
  assert.equal(csv, '﻿a,b\r\n"x,y","say ""hi"""\r\n,3\r\n');
});

test("results, matches, ranking and roster name entries by their players", () => {
  const t = {
    seasons: [{ id: "s1", name: "2026 시즌", sort_order: 1 }],
    events: [{ id: "e1", name: "1회 파이컵", held_on: "2026-11-01", season_id: "s1" }],
    players: [{ id: "p1", display_name: "가" }, { id: "p2", display_name: "나" }],
    entries: [{ id: "n1", display_name: null }, { id: "n2", display_name: null }],
    entry_participants: [{ entry_id: "n1", player_id: "p1" }, { entry_id: "n2", player_id: "p2" }],
    event_registrations: [{ event_id: "e1", registration_name: "가", player_id: "p1", registration_source: "application", created_at: "2026-10-30" }],
    matches: [{ event_id: "e1", stage_label: "결승", source_node_key: "single:r1:m1", match_kind: "bracket", entry_a_id: "n1", entry_b_id: "n2", winner_entry_id: "n1", score_a: 2, score_b: 1, resolution: "played" }],
    results: [{ event_id: "e1", entry_id: "n2", placement_label: "준우승", rank_min: 2, rank_max: 2 }, { event_id: "e1", entry_id: "n1", placement_label: "우승", rank_min: 1, rank_max: 1 }],
    ranking_awards: [{ event_id: "e1", player_id: "p1", points_delta: "10", win_delta: 1, runner_up_delta: 0, top4_delta: 0 }],
    ranking_baselines: [{ scope: "season", season_id: "s1", player_id: "p2", points: 3, wins: 0, runner_ups: 0, top4s: 1 }],
  };
  const out = buildExportCsvs(t);
  const lines = s => s.replace("﻿", "").trim().split("\r\n");
  assert.deepEqual(lines(out.results).slice(1), ["1회 파이컵,2026-11-01,우승,1,1,가,가", "1회 파이컵,2026-11-01,준우승,2,2,나,나"]);
  assert.equal(lines(out.matches)[1], "1회 파이컵,2026-11-01,결승,single:r1:m1,bracket,가,나,가,2,1,경기,");
  assert.deepEqual(lines(out.ranking).slice(1), ["2026 시즌,가,10,1,0,0", "2026 시즌,나,3,0,0,1"]);
  assert.equal(lines(out.roster)[1], "1회 파이컵,2026-11-01,가,가,application,2026-10-30");
});
