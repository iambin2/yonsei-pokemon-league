/* 컴퓨터의 난이도 (2026-11-06). 이름은 프로그램 코드로 만들어진 포켓몬의 진화 순서, 약한 것부터. 폴리곤Z가 지금까지 만들고 잰 컴퓨터
   그대로이고(docs/BATTLE_COMPUTER.md), 아래 둘은 덜 생각하고 더 실수한다. options는 battleCpu.js createCpu에 그대로 간다:
   slack은 최선과 이만큼 가까운 수를 고르게 두는 폭, mistake는 한 턴을 그럴듯한 수 아무것으로나 두는 확률.
   2026-11-24 사용자: "난이도도 직관적이게 상중하로", 대표 포켓몬도 그 세기에 어울리게(하 이브이, 중 루카리오, 상 한카리아스).
   id(porygon…)는 저장된 배틀과 도전의 탑이 읽는 이름이라 그대로 둔다.
   로비(화면)와 워커(컴퓨터)가 함께 읽으므로 무거운 것을 들이지 않는다. 세기는 docs/BATTLE_COMPUTER.md 5장에 잰 대로다: 폴리곤2는 폴리곤Z에 100판 34%, 폴리곤은 폴리곤2에 60판 32%. */
export const LEVELS = {
  porygon: { label: "하", species: "Eevee", options: { reads: false, rollout: false, budgetMs: 300, slack: 0.6, mistake: 0.3 } },
  porygon2: { label: "중", species: "Lucario", options: { reads: false, budgetMs: 500, slack: 0.35, mistake: 0.18 } },
  porygonz: { label: "상", species: "Garchomp", options: {} },
};
export const LEVEL_IDS = Object.keys(LEVELS);
// a battle kept from before the levels (or with an unknown one) is played at the computer's full strength, as it was started
export const DEFAULT_LEVEL = "porygonz";
export const levelOf = id => LEVELS[id] || LEVELS[DEFAULT_LEVEL];
