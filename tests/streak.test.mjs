import test from "node:test";
import assert from "node:assert/strict";
import { STREAK_BAN, STREAK_DRAFT, STREAK_LIVES, STREAK_START_LIVES, doorsOf, runTrack, seeded, streakReach, streakRelights, STREAK_BATTLE_FORMAT, STREAK_STEPS, STREAK_FORMAT_ID, STREAK_REGULATION, floorGame, streakCpuOptions, streakFloor, streakFresh, streakStep, streakMaster, swapParty, swapTier, gameWords } from "../src/services/streak.js";
import { LEVELS } from "../src/services/cpuLevels.js";
import TOWER_TIERS from "../src/data/tower-tiers.json" with { type: "json" };
import { keyRating, ratingOf, setKey } from "../src/services/partyBalance.js";
import { towerPool } from "../supabase/functions/battle/towerBuild.mjs";
/* the tiers hold sample sets since 19장 (tower-tiers.json is keyed by setKey). The swap rules below are checked on species alone, as a
   function from before then sends them: a member with no moves trades in the tier of its species' mean share */
const POOL = [...towerPool(STREAK_BAN).keys()];

test("a floor is five games, the fifth its master, and a new floor brings a new party", () => {
  assert.deepEqual([0, 4, 5, 9, 10].map(streakFloor), [1, 1, 2, 2, 3]);
  assert.deepEqual([0, 3, 4, 5].map(floorGame), [1, 4, 5, 1]);
  assert.deepEqual([3, 4, 5, 9, 14].map(streakMaster), [false, true, false, true, true]);
  assert.deepEqual([0, 1, 5, 6, 10].map(streakFresh), [true, false, true, false, true]);
});

test("the screen's format id is the engine's", async () => {
  const { formatId } = await import("../supabase/functions/battle/engine.mjs");
  assert.equal(STREAK_FORMAT_ID, formatId(STREAK_REGULATION, STREAK_BATTLE_FORMAT));
});

test("a floor is one 난이도, its master included, and the last step stays", () => {
  // a floor's even games stand on its step, its gatekeeper and a strong door one over; the third floor and up at the top (15.7)
  assert.deepEqual([0, 3, 4, 5, 9, 10, 15, 100].map(w => STREAK_STEPS[streakStep(w)].id), ["porygon", "porygon", "porygon2", "porygon2", "porygonz", "porygonz", "porygonz", "porygonz"]);
  assert.deepEqual([0, 5, 20].map(w => STREAK_STEPS[streakStep(w, true)].id), ["porygon2", "porygonz", "porygonz"]);
  assert.ok(STREAK_STEPS.filter(s => s.id in LEVELS).every(s => s.options === LEVELS[s.id].options), "the site's levels are played as they are");
});

test("the doors: two before an even game, the gatekeeper's alone before its game; only a gatekeeper beaten lights the spare, a strong door reaches a tier up", () => {
  assert.deepEqual(doorsOf(0), ["even", "hard"]);
  assert.deepEqual(doorsOf(4), ["gate"]);
  assert.deepEqual([streakRelights(2), streakRelights(4)], [false, true]);
  assert.deepEqual([streakReach(2), streakReach(2, true), streakReach(4)], [false, true, true]);
});

test("a trade reaches a tier up only when it may, and never down", () => {
  const rated = POOL.filter(s => !s.includes("-"));
  const of = t => rated.find(s => swapTier(s) === t);
  const party = [{ species: of(3), item: "Leftovers" }];
  assert.equal(swapParty(party, [{ species: of(2), item: "Life Orb" }], of(3), of(2)), "tier", "one up needs the reach");
  assert.equal(swapParty(party, [{ species: of(2), item: "Life Orb" }], of(3), of(2), 1)[0].species, of(2));
  assert.equal(swapParty(party, [{ species: of(1), item: "Life Orb" }], of(3), of(1), 1), "tier", "two up is too far");
  assert.equal(swapParty(party, [{ species: of(4), item: "Life Orb" }], of(3), of(4), 1), "tier", "never down");
});

test("a seeded draw is the same for the same key and differs between keys (오늘의 탑)", () => {
  const a = seeded("2026-11-11:draft"), b = seeded("2026-11-11:draft"), c = seeded("2026-11-12:draft");
  const take = r => Array.from({ length: 5 }, r);
  assert.deepEqual(take(a), take(b));
  assert.notDeepEqual(take(seeded("2026-11-11:draft")), take(c));
  assert.ok(take(seeded("x")).every(v => v >= 0 && v < 1));
});

test("the draft: three of each tier, all species and all items apart, so any picks make a legal party of the sets shown", async () => {
  const { draftParty } = await import("../supabase/functions/battle/engine.mjs");
  const { draftOffer } = await import("../supabase/functions/battle/streakEngine.mjs");
  for (let i = 0; i < 20; i++) {
    const offer = draftOffer(seeded(`draft:${i}`), { ban: STREAK_BAN, count: STREAK_DRAFT });
    assert.equal(offer.length, 6);
    assert.ok(offer.every(row => row.length === STREAK_DRAFT));
    const all = offer.flat().map(c => c.species);
    assert.equal(new Set(all).size, all.length);
    assert.ok(offer.every((row, t) => row.every(c => swapTier(c) === t)), "each row is its tier, the tier of the set shown");
    assert.ok(offer.flat().every(c => setKey(c.species, c) in TOWER_TIERS), "only sets of the species the ladder's top teams bring");
    const items = offer.flat().map(c => c.item);
    assert.equal(new Set(items).size, items.length, "no two candidates hold one item");
    assert.ok(offer.flat().every(c => !("items" in c)), "no back-up items");
    // every row's last, so Megas come along whenever a row offers them (two or more may be held)
    const picks = offer.map((row, k) => row[(i + k) % row.length].species);
    const team = draftParty(STREAK_FORMAT_ID, offer, picks);
    assert.ok(Array.isArray(team), String(team));
    assert.deepEqual(team.map(m => m.item), picks.map((sp, k) => offer[k].find(c => c.species === sp).item), "each holds the item it was shown with");
    assert.ok(team.every(m => !STREAK_BAN.items.includes(m.item)));
  }
  const offer = draftOffer(seeded("draft:x"), { ban: STREAK_BAN });
  assert.equal(draftParty(STREAK_FORMAT_ID, offer, offer.map(() => "Mew")), "pick");
  assert.equal(draftParty(STREAK_FORMAT_ID, offer, offer.slice(1).map(r => r[0].species)), "pick");
});

test("a game is said with Korean ordinals, and the fifth is the floor's gatekeeper", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(gameWords), ["1층 첫 번째 판", "1층 두 번째 판", "1층 세 번째 판", "1층 네 번째 판", "1층 수문장", "2층 첫 번째 판"]);
});

test("a foe is built for its game: legal, free of the ban, and the second door does not bring back the first's six (15장)", async () => {
  const { foeTeam, streakDoors, shownDoors, seenWith } = await import("../supabase/functions/battle/streakEngine.mjs");
  const { validateTeam } = await import("../supabase/functions/battle/engine.mjs");
  for (let i = 0; i < 20; i++) {
    const foe = foeTeam(seeded(`foe:${i}`));
    assert.equal(validateTeam(STREAK_FORMAT_ID, foe.team), null);
    assert.ok(foe.team.every(m => !STREAK_BAN.items.includes(m.item) && !m.moves.some(move => STREAK_BAN.moves.includes(move))));
    const doors = streakDoors(i, seeded(`doors:${i}`));
    assert.deepEqual(doors.map(d => d.kind), doorsOf(i));
    if (doors.length === 2) assert.ok(doors[1].team.filter(m => doors[0].team.some(x => x.species === m.species)).length <= 1, "the doors stand apart");
    assert.ok(shownDoors(doors).every(d => !("rank" in d) && (d.kind === "gate" ? d.species.length === 0 : d.species.length === 6)));
  }
  assert.deepEqual(streakDoors(3, seeded("same")), streakDoors(3, seeded("same")), "a daily run's doors are the same for everyone");
  assert.deepEqual(seenWith(["a", "b"], ["b", "c"]), ["a", "b", "c"]);
  assert.equal(seenWith([], Array.from({ length: 50 }, (_, i) => `s${i}`)).length, 36);
});

test("a species outside the ladder's pool trades in the tier its measured share reaches, and a second Mega Stone may come", () => {
  const outside = ["Arbok", "Houndstone", "Empoleon"].filter(s => !POOL.includes(s));
  assert.ok(outside.length);
  for (const s of outside) {
    const t = swapTier(s);
    const inTier = Object.keys(TOWER_TIERS).filter(k => TOWER_TIERS[k] === t).map(k => keyRating(STREAK_FORMAT_ID, k));
    assert.ok(ratingOf(STREAK_FORMAT_ID, s) >= Math.min(...inTier) || t === 5, `${s} in tier ${t}`);
  }
  const rated = POOL.filter(s => !s.includes("-"));
  const a = rated[0], b = rated.find(s => s !== a && swapTier(s) === swapTier(a)), other = rated.find(s => swapTier(s) !== swapTier(a));
  assert.deepEqual(swapParty([{ species: a, item: "Leftovers" }, { species: other, item: "Gengarite" }], [{ species: b, item: "Garchompite" }], a, b).map(m => m.item), ["Garchompite", "Gengarite"]);
});

test("the server's computer keeps its 난이도's play and thinks within the time that keeps its slowest choice under a second", () => {
  for (const wins of [0, 3, 5, 8, 10, 20]) for (const hard of [false, true]) {
    const step = STREAK_STEPS[streakStep(wins, hard)], options = streakCpuOptions(wins, hard);
    assert.ok(options.budgetMs <= 400, `${step.id} thinks ${options.budgetMs} ms`);
    assert.deepEqual(options, { ...step.options, budgetMs: step.budgetMs });
  }
});

test("a swap is tier for tier, never brings two of a species, and the one coming keeps its own set: an item twice is refused", () => {
  // species from the measured table: two of one tier and one of another (partyBalance.js)
  const rated = POOL.filter(s => !s.includes("-"));
  const a = rated[0], same = rated.filter(s => s !== a && swapTier(s) === swapTier(a)), other = rated.find(s => swapTier(s) !== swapTier(a));
  const [b, c] = same;
  const party = [{ species: a, item: "Focus Sash" }, { species: other, item: "Leftovers" }];
  const foes = [{ species: b, item: "Choice Scarf", name: "x" }, { species: c, item: "Leftovers" }, { species: rated.find(s => swapTier(s) !== swapTier(a) && s !== other), item: "Life Orb" }];
  assert.deepEqual(swapParty(party, foes, a, b), [{ species: b, item: "Choice Scarf", name: "" }, party[1]]);
  assert.equal(swapParty(party, foes, a, foes[2].species), "tier", "another tier");
  assert.equal(swapParty(party, foes, a, c), "item", "a second Leftovers");
  assert.equal(swapParty([{ species: a, item: "Leftovers" }, { species: other, item: "Focus Sash" }], foes, a, c)[0].item, "Leftovers", "the one it replaces held it");
  assert.equal(swapParty([{ species: a, item: "Focus Sash" }, { species: b, item: "Leftovers" }], [{ species: b, item: "Life Orb" }, ...foes], a, b), "clash", "a second species");
  assert.equal(swapParty(party, foes, "Mew", b), "missing");
});

test("a swap finds a form the team preview hides (Gourgeist-*) by its species", () => {
  const party = [{ species: "Gourgeist-Small", item: "Sitrus Berry" }];
  const foes = [{ species: "Mew", item: "Life Orb" }];
  assert.notEqual(swapParty(party, foes, "Gourgeist-*", "Mew"), "missing", "found by the hidden form's species");
  assert.equal(swapParty(party, foes, "Pumpkaboo-*", "Mew"), "missing", "the species must match, not only the mark");
});

test("a form is one species however it is spelled: the input log's 'Squawkabilly Blue' is the sample sets' 'Squawkabilly-Blue'", () => {
  assert.equal(swapTier("Squawkabilly Blue"), swapTier("Squawkabilly-Blue"));
  const party = [{ species: "Squawkabilly-Blue", item: "Choice Scarf" }];
  assert.notEqual(swapParty(party, [{ species: "Squawkabilly Blue", item: "Leftovers" }], "Squawkabilly-Blue", "Squawkabilly-Blue"), "missing");
});

test("a run's games are read with the wins before each and the lamps it was gone into with: two to start, a loss puts one out, a gatekeeper beaten lights one again, two at most (14장)", () => {
  const g = (id, winner, status = "ended") => ({ id, winner, status });
  // a loss (the same game again), four wins and the gatekeeper (a lamp lit again), then a game being played
  const track = runTrack([g("a", "p2"), g("b", "p1"), g("c", "p1"), g("d", "p1"), g("e", "p1"), g("f", "p1"), g("h", null, "active")]);
  assert.deepEqual(track.map(x => [x.id, x.at, x.lives]), [["a", 0, 2], ["b", 0, 1], ["c", 1, 1], ["d", 2, 1], ["e", 3, 1], ["f", 4, 1], ["h", 5, 2]]);
  assert.equal(track.over, false);
  assert.equal(STREAK_START_LIVES, 2);
  // a tie is a lost game too; two lost games end a run
  assert.equal(runTrack([g("a", "tie")]).over, false);
  assert.equal(runTrack([g("a", "p2"), g("b", "tie")]).over, true);
  // a lamp is never lit past two: two gatekeepers beaten with no loss
  const ten = Array.from({ length: 10 }, (_, i) => g(String(i), "p1"));
  assert.equal(runTrack([...ten, g("x", null, "active")]).at(-1).lives, STREAK_LIVES);
  assert.deepEqual([...runTrack([])], []);
});

test("the tower's random parties (a screen from before the draft) hold none of the banned items or moves, and every tier still has its species", async () => {
  const { randomTeam, setPool } = await import("../supabase/functions/battle/engine.mjs");
  const held = team => team.filter(m => STREAK_BAN.items.includes(m.item) || m.moves.some(move => STREAK_BAN.moves.includes(move)));
  // the pool does hold them, so the test would catch a ban that stopped working
  assert.ok(setPool(STREAK_FORMAT_ID).some(e => e.sets.some(s => s.items.some(i => STREAK_BAN.items.includes(i)) || s.moves.some(m => STREAK_BAN.moves.includes(m)))));
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 150; i++) {
    const team = randomTeam(STREAK_FORMAT_ID, random, { ban: STREAK_BAN });
    assert.equal(team.length, 6);
    assert.deepEqual(held(team), []);
  }
  // an unbanned draw is untouched by the banned pool (the tiers are kept for each pool)
  assert.equal(randomTeam(STREAK_FORMAT_ID, random).length, 6);
});

test("a tier is a sample set's: each set of the tower's pool stands where tower-tiers.json puts it, and the six tiers are alike in size (19장)", () => {
  const sets = [...towerPool(STREAK_BAN).values()].flatMap(e => e.sets.map(set => ({ species: e.species, item: set.items[0], moves: [...set.moves] })));
  assert.equal(sets.length, Object.keys(TOWER_TIERS).length, "every set of the pool is in the table, and nothing else");
  for (const m of sets) assert.equal(swapTier(m), TOWER_TIERS[setKey(m.species, m)]);
  const size = [0, 1, 2, 3, 4, 5].map(t => sets.filter(m => swapTier(m) === t).length);
  assert.ok(Math.max(...size) - Math.min(...size) <= 1, `tier sizes ${size}`);
  // the stronger tier holds the stronger sets: every set's share is at least every share of the tier below
  for (let t = 0; t < 5; t++) {
    const low = Math.min(...sets.filter(m => swapTier(m) === t).map(m => ratingOf(STREAK_FORMAT_ID, m.species, m)));
    const high = Math.max(...sets.filter(m => swapTier(m) === t + 1).map(m => ratingOf(STREAK_FORMAT_ID, m.species, m)));
    assert.ok(low >= high, `tier ${t} reaches down to ${low}, tier ${t + 1} up to ${high}`);
  }
});

test("a gatekeeper is led by a Mega and stronger than the even foes: the leader first, the only Mega Stone, the rest from the stronger half (19장)", async () => {
  const { foeTeam, streakDoors, withLeader } = await import("../supabase/functions/battle/streakEngine.mjs");
  const { validateTeam } = await import("../supabase/functions/battle/engine.mjs");
  const { MEGA_STONE } = await import("../src/services/streak.js");
  const share = team => team.reduce((s, m) => s + ratingOf(STREAK_FORMAT_ID, m.species, m), 0);
  let gates = 0, evens = 0;
  for (let i = 0; i < 40; i++) {
    const [gate] = streakDoors(4, seeded(`gate:${i}`));
    assert.equal(gate.kind, "gate");
    assert.equal(validateTeam(STREAK_FORMAT_ID, gate.team), null);
    assert.match(gate.team[0].item, MEGA_STONE, "the leader holds a Mega Stone");
    assert.ok(gate.team.slice(1).every(m => !MEGA_STONE.test(m.item)), "the leader is the only Mega");
    gates += share(gate.team);
    evens += share(foeTeam(seeded(`even:${i}`)).team);
  }
  // measured 2026-11-19: 0.75 apart, and the drafted party won 52.7% against a 1층 gatekeeper where it won 68.0% before (19장)
  assert.ok(gates / 40 - evens / 40 >= 0.5, `a gatekeeper's six share ${(gates / 40).toFixed(2)}, an even foe's ${(evens / 40).toFixed(2)}`);
  assert.equal(withLeader("team 3, 4, 5"), "team 3, 4, 1", "a preview without the leader brings it in the last place");
  assert.equal(withLeader("team 2, 1, 6"), "team 2, 1, 6");
});
