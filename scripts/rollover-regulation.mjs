// Unified CLI for periodic Pokémon regulation & Battle Tower season refresh.
// Usage:
//   npm run regulation:rollover -- --reg m-c --seasons 6-8 [--dry-run] [--skip-ranker]
// Runs the documented refresh steps in order so a successor does not have to hunt across scripts.
import { execFileSync } from "node:child_process";
import { REGULATIONS, DEFAULT_REGULATION_ID } from "../src/data/teamBuilderRegulations.js";

function parseArgs(argv) {
  const opts = { reg: DEFAULT_REGULATION_ID, seasons: "6-8", dryRun: false, skipRanker: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--reg" && argv[i + 1]) opts.reg = argv[++i].toLowerCase();
    else if (a === "--seasons" && argv[i + 1]) opts.seasons = argv[++i];
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--skip-ranker") opts.skipRanker = true;
    else if (a === "--help" || a === "-h") {
      console.log("Usage: npm run regulation:rollover -- --reg <id> --seasons <start>-<end> [--dry-run] [--skip-ranker]");
      process.exit(0);
    }
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
if (!REGULATIONS[opts.reg]) {
  console.error(`알 수 없는 레귤레이션입니다: ${opts.reg}`);
  console.error(`등록된 레귤레이션: ${Object.keys(REGULATIONS).join(", ")}`);
  console.error("새 레귤레이션 풀을 추가하려면 먼저 src/data/teamBuilderRegulations.js에 등록하세요.");
  process.exit(1);
}
if (!/^\d+-\d+$/.test(opts.seasons)) {
  console.error(`--seasons 형식이 올바르지 않습니다: ${opts.seasons} (예: 9-11)`);
  process.exit(1);
}

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const steps = [
  ["포켓몬 데이터 갱신 (Showdown, PokeAPI)", npmCmd, ["run", "data:champions"]],
  ["한국어 기술·특성·도구 설명 갱신", npmCmd, ["run", "data:battle-info"]],
  ["신규 포켓몬 기본 샘플 보충", npmCmd, ["run", "data:fill-samples", "--", "--reg", opts.reg]],
  ...(opts.skipRanker ? [] : [["도전의 탑 랭커 팀과 티어 갱신", process.execPath, ["scripts/build-ranker-teams.mjs", "--reg", opts.reg, "--seasons", opts.seasons]]]),
  ["샘플 세트 정합성 검사", process.execPath, ["scripts/check-sets.mjs"]],
  ["전체 회귀 테스트", npmCmd, ["test"]],
];

console.log(`레귤레이션 갱신 계획: reg=${opts.reg}, seasons=${opts.seasons}${opts.dryRun ? " (dry-run)" : ""}`);
for (const [label, cmd, args] of steps) {
  console.log(`\n[단계] ${label}\n  > ${cmd} ${args.join(" ")}`);
  if (!opts.dryRun) {
    execFileSync(cmd, args, { stdio: "inherit" });
  }
}
console.log(opts.dryRun
  ? "\ndry-run을 마쳤습니다. 실제 실행하려면 --dry-run을 빼고 다시 실행하세요."
  : "\n레귤레이션 갱신과 전체 테스트를 마쳤습니다. 변경된 파일을 확인한 뒤 커밋하고 배포하세요.");
