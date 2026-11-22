// docs/db/third_place_best_of.sql on the real normalized schema (run from verify-league-intake-db.mjs after the group checks).
// A four-player single elimination with a 3위 결정전 and N선승: the third-place match follows the semifinals, its winner goes in,
// scores keep to the wins asked for, rules lock once a result exists, a series of site battles leaves its score, and the bracket
// with its third-place row can still be deleted.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { projectRuntimeFacts } from "../src/services/bracketWinnerPlan.js";

export async function verifyThirdPlaceBestOf({ pg, q, scalar, as, check, season }) {
  await as("postgres");
  await pg.exec(`create table if not exists public.battles (id text primary key, kind text, event_id uuid, source_node_key text, status text, winner text,
    ended_by text, p1_entry_id uuid, p2_entry_id uuid, applied_at timestamptz)`);
  const sql = readFileSync("docs/db/third_place_best_of.sql", "utf8");
  await pg.exec(sql);
  await pg.exec(sql);
  await as("authenticated");

  const event = () => scalar("insert into events(season_id,name,event_type,division,status,date_precision,regulation_id,cup_rule_id) values($1,'3위전 검증','pokecup','light','open','unknown','m-c','none') returning id", [season]);
  async function single(eid, count) {
    const people = [];
    for (let i = 0; i < count; i++) {
      const name = "삼위-" + randomUUID().slice(0, 8);
      const pid = await scalar("insert into players(display_name) values($1) returning id", [name]);
      const rid = await scalar("insert into event_registrations(event_id,player_id,registration_name,registration_source) values($1,$2,$3,'manual') returning id", [eid, pid, name]);
      people.push({ participant_key: randomUUID(), display_name: name, player_id: pid, registration_id: rid, entry_id: randomUUID(), entry_participant_id: randomUUID() });
    }
    const runtimeId = randomUUID();
    await q("select * from create_selected_bracket_runtime($1,$2,'single_elimination',$3,$4)", [runtimeId, eid, people, people.map((p, i) => ({ slot_no: i + 1, entry_id: p.entry_id }))]);
    return { runtimeId, people };
  }
  async function facts(eid) {
    const [e, rt] = await Promise.all([scalar("select to_jsonb(e) from events e where id=$1", [eid]), scalar("select to_jsonb(rt) from bracket_runtimes rt where event_id=$1", [eid])]);
    const [slots, entries, participants, matches, registrations] = await Promise.all(
      ["bracket_entry_slots", "entries", "entry_participants", "matches", "event_registrations"].map(t => q("select * from " + t + " where event_id=$1", [eid])));
    return projectRuntimeFacts(rt, e, { slots: { data: slots }, entries: { data: entries }, participants: { data: participants }, matches: { data: matches }, registrations: { data: registrations } });
  }
  const win = (rt, eid, key, entry) => q("select * from set_normalized_single_bracket_winner($1,$2,$3,$4)", [rt, eid, key, entry]);
  const row = (eid, key) => q("select * from matches where event_id=$1 and source_node_key=$2", [eid, key]).then(r => r[0] || null);

  await check("a single elimination's 3위 결정전 follows its semifinals, takes a winner, and is rebuilt when a semifinal changes", async () => {
    const eid = await event(), { runtimeId: rt, people } = await single(eid, 4);
    await q("select set_bracket_rules($1,$2,true,2,3)", [rt, eid]);
    let f = await facts(eid);
    assert.equal(f.bracket.graph.third.id, "single:third");
    assert.deepEqual(f.bracket.rules, { thirdPlace: true, winsTo: 2, finalWinsTo: 3 });
    const [m1, m2] = [await row(eid, "single:r1:m1"), await row(eid, "single:r1:m2")];
    await win(rt, eid, "single:r1:m1", m1.entry_a_id);
    assert.equal(await row(eid, "single:third"), null, "one semifinal is not enough");
    await win(rt, eid, "single:r1:m2", m2.entry_a_id);
    let third = await row(eid, "single:third");
    assert.deepEqual([third.entry_a_id, third.entry_b_id], [m1.entry_b_id, m2.entry_b_id]);
    await win(rt, eid, "single:third", m1.entry_b_id);
    f = await facts(eid);
    assert.equal(f.bracket.graph.third.winner, "a");
    // N선승: a semifinal's winner scores 2, the final's 3
    await q("select * from set_normalized_match_outcome($1::uuid,'single:r1:m1',2::smallint,1::smallint)", [eid]);
    await assert.rejects(q("select * from set_normalized_match_outcome($1::uuid,'single:r1:m2',1::smallint,0::smallint)", [eid]), /선승/);
    await assert.rejects(q("select set_bracket_rules($1,$2,false,1,1)", [rt, eid]), /결과가 들어간/);
    // the first semifinal goes the other way: the third-place match is made again between the new losers, without a winner
    await win(rt, eid, "single:r1:m1", m1.entry_b_id);
    third = await row(eid, "single:third");
    assert.deepEqual([third.entry_a_id, third.entry_b_id, third.winner_entry_id], [m1.entry_a_id, m2.entry_b_id, null]);
    await facts(eid);
    await q("select * from delete_normalized_single_bracket_runtime($1,$2)", [rt, eid]);
    assert.equal(await scalar("select count(*)::int from matches where event_id=$1", [eid]), 0);
  });

  await check("a series of site battles leaves its score on the match once the deciding battle goes in", async () => {
    const eid = await event(), { runtimeId: rt } = await single(eid, 2);
    await q("select set_bracket_rules($1,$2,false,2,2)", [rt, eid]);
    const m = await row(eid, "single:r1:m1");
    await as("postgres");
    await q(`insert into public.battles values ('s1','official',$1,'single:r1:m1','ended','p1','battle',$2,$3,null),
      ('s2','official',$1,'single:r1:m1','ended','p1','battle',$3,$2,null), ('s3','official',$1,'single:r1:m1','ended','p2','forfeit',$3,$2,null)`, [eid, m.entry_a_id, m.entry_b_id]);
    await as("authenticated");
    await win(rt, eid, "single:r1:m1", m.entry_a_id);
    await as("postgres");
    await q("update public.battles set applied_at = now() where id = 's3'");
    const after = await row(eid, "single:r1:m1");
    assert.deepEqual([after.score_a, after.score_b, after.resolution], [2, 1, "played"]);
    await as("authenticated");
  });

  await check("only operators set rules, and only from one to three wins", async () => {
    const eid = await event(), { runtimeId: rt } = await single(eid, 4);
    await as("anon");
    await assert.rejects(q("select set_bracket_rules($1,$2,true,1,1)", [rt, eid]));
    await as("authenticated");
    await assert.rejects(q("select set_bracket_rules($1,$2,false,4,1)", [rt, eid]), /1에서 3/);
  });
}
