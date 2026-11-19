// How easily the computer is read (docs/BATTLE_COMPUTER.md 3장): it plays a reader, a player who has seen its whole party and, each
// turn, asks a second copy of the same computer (its own luck, its own reading of the battle) what the computer will play, then
// plays the best answer to exactly that. A computer that always makes the same choice loses to its reader; one that mixes does not.
//
//   node scripts/cpu-readability.mjs [--ref HEAD] [--games 200] [--ms 400] [--opts '{}']
//     --ref   the version read: a git ref, or nothing for this folder
// It prints how often the reader guessed the computer's choice, how often it guessed a switch and its target, and the computer's
// share of the games. Each pair of games plays the same two parties with the sides traded.
import { execFileSync, fork } from "node:child_process";
import { cpus } from "node:os";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith("--") ? [a.slice(2), all[i + 1]] : null)).filter(Boolean));
const ROOT = new URL("../", import.meta.url);

if (process.argv.includes("--worker")) {
  const job = await new Promise(resolve => process.once("message", resolve));
  const { formatId, startBattle, randomTeam } = await import(new URL("supabase/functions/battle/engine.mjs", ROOT));
  const C = await import(new URL(job.file, ROOT));
  const formatid = formatId("m-c", "singles");
  for (const pair of job.pairs) {
    let n = pair * 7919 + 1;
    const rnd = () => { n = (n * 16807) % 2147483647; return n / 2147483647; };
    const teams = [randomTeam(formatid, rnd, { even: true }), randomTeam(formatid, rnd, { even: true })];
    for (const flip of [0, 1]) {
      const make = () => C.createCpu(formatid, { budgetMs: job.ms, ...job.opts });
      const cpu = make(), own = make(), copy = make();
      const battle = startBattle({ formatid, seed: [pair, 7, 11, 13], p1: { name: "reader", team: teams[flip] }, p2: { name: "cpu", team: teams[1 - flip] } });
      const out = { pair, turns: 0, guessed: 0, switches: 0, switchGuessed: 0, called: 0, calledRight: 0 };
      for (let step = 0; step < 500 && !battle.ended; step++) {
        const [r1, r2] = [battle.p1.activeRequest, battle.p2.activeRequest];
        const open = r => r && !r.wait;
        if (!open(r1) && !open(r2)) break;
        let guess = null;
        if (open(r2)) {
          const turnOfMoves = open(r1) && !r1.forceSwitch && !r1.teamPreview && !r2.forceSwitch;
          if (turnOfMoves) guess = copy.decide(battle, "p2");
          const played = cpu.decide(battle, "p2");
          if (turnOfMoves) {
            out.turns++;
            if (guess === played) out.guessed++;
            if (/^switch/.test(played)) { out.switches++; if (guess === played) out.switchGuessed++; }
            if (/^switch/.test(guess)) { out.called++; if (guess === played) out.calledRight++; }
          }
          if (open(r1)) {
            let mine = own.decide(battle, "p1");
            if (guess) {
              // the best answer to the guess, on the battle as it is (the reader has seen the computer's sets)
              const state = C.calcOn(C.revive(C.strip(battle)));
              const text = C.strip(state);
              const rows = { active: r1.active.map(a => ({ ...a, canMegaEvo: Boolean(a.canMegaEvo) })), mons: r1.side.pokemon.map(p => ({ fainted: p.condition.endsWith(" fnt"), active: p.active })) };
              let best = -Infinity;
              for (const o of C.wholeChoices(state, "p1", rows, 12, 12)) {
                const value = C.play(text, "p1", o.choice, guess, [1, 2, 3, 4], true);
                if (value != null && value > best) { best = value; mine = o.choice; }
              }
            }
            if (!battle.choose("p1", mine)) battle.choose("p1", C.quickChoice(battle, "p1"));
          }
          if (!battle.choose("p2", played)) battle.choose("p2", C.quickChoice(battle, "p2"));
        } else if (!battle.choose("p1", own.decide(battle, "p1"))) battle.choose("p1", C.quickChoice(battle, "p1"));
      }
      process.send({ ...out, cpu: battle.winnerSide === "p2" ? 1 : battle.winnerSide === "p1" ? 0 : 0.5 });
    }
  }
  process.disconnect();
} else {
  const games = Number(args.games || 200), ms = Number(args.ms || 400);
  const file = `src/services/.cpu-read-${(args.ref || "here").replace(/[^\w.-]/g, "_")}.js`;
  const source = args.ref ? execFileSync("git", ["show", `${args.ref}:src/services/battleCpu.js`], { cwd: fileURLToPath(ROOT) }).toString() : readFileSync(new URL("src/services/battleCpu.js", ROOT), "utf8");
  writeFileSync(new URL(file, ROOT), `${source}\nexport { play, strip, revive, calcOn, wholeChoices };\n`);
  const pairs = Array.from({ length: Math.ceil(games / 2) }, (_, i) => i);
  const lanes = Math.max(1, Math.min(Number(args.lanes || cpus().length / 2), pairs.length));
  console.log(`${pairs.length * 2} games, ${ms} ms, the computer of ${args.ref || "this folder"} against its reader, ${lanes} at once`);
  const results = [];
  await Promise.all(Array.from({ length: lanes }, (_, lane) => new Promise((resolve, reject) => {
    const child = fork(fileURLToPath(import.meta.url), ["--worker"], { stdio: ["ignore", "ignore", "inherit", "ipc"] });
    child.send({ file, ms, opts: JSON.parse(args.opts || "{}"), pairs: pairs.filter(p => p % lanes === lane) });
    child.on("message", r => { results.push(r); process.stdout.write(r.cpu === 1 ? "W" : r.cpu === 0 ? "L" : "="); });
    child.on("exit", code => (code ? reject(new Error(`lane ${lane} failed`)) : resolve()));
  }))).finally(() => rmSync(new URL(file, ROOT), { force: true }));
  const sum = key => results.reduce((s, r) => s + r[key], 0);
  const share = (a, b) => (b ? `${(100 * a / b).toFixed(1)}% (${a}/${b})` : "-");
  const byPair = Object.values(results.reduce((m, r) => ((m[r.pair] ||= []).push(r.cpu), m), {})).map(g => g.reduce((a, b) => a + b, 0) / g.length);
  const mean = byPair.reduce((a, b) => a + b, 0) / byPair.length;
  const margin = 1.96 * Math.sqrt(byPair.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, byPair.length - 1)) / Math.sqrt(byPair.length);
  console.log(`\nthe reader guessed the choice ${share(sum("guessed"), sum("turns"))}`);
  console.log(`the computer switched ${share(sum("switches"), sum("turns"))} of its turns; the reader had called that very switch ${share(sum("switchGuessed"), sum("switches"))}`);
  console.log(`a switch the reader called came ${share(sum("calledRight"), sum("called"))}`);
  console.log(`the computer scored ${(100 * sum("cpu") / results.length).toFixed(1)}% ± ${(100 * margin).toFixed(1)} against its reader`);
}
