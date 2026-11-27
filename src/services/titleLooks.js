import { TYPE_OPTIONS } from "../data/teamBuilderCupRules.js";

/* ============================== 칭호의 메달 (DESIGN.md "Titles and hall of fame") ==============================
   모든 칭호는 메달이다. 메달 가운데의 언덕은 칭호의 색(타입 1~3개), 그 위에 솟은 장식(device)은 흰 덩어리다.
   타입 엑스퍼트는 게임의 그 타입 문양, 지방 엘리트는 그 지방의 풍경, 파트너는 그 포켓몬의 실루엣, 챔피언은 금 테와 왕관과 로마 숫자,
   그 밖의 칭호는 운영자가 고른 색과 장식(없으면 이름과 설명에서 자동 추천). 몽키매직은 야나프, 바오프, 앗차프의 실루엣, 메가 문양은 받은 그림의 제 색 그대로.
   문장은 칭호 항목의 look 에 산다 { bands: [타입 id], device?: 장식 id, pokemon?: 포켓몬 이름, text?: 짧은 글자, mark?: "mega" }.
   여기서는 표현만 정하고 기록은 건드리지 않는다. */

export const TITLE_TYPES = TYPE_OPTIONS.map(({ id, korean }) => ({ id, korean }));
const TYPE_IDS = new Set(TITLE_TYPES.map(type => type.id));
const VIVID_TYPES = TITLE_TYPES.map(t => t.id).filter(id => id !== "normal");

/* 지방: 그 지방의 풍경 하나와 에나멜 색 하나 (titleMedal.js 의 SCENES 가 같은 이름으로 그린다) */
export const REGIONS = [
  ["관동", "fire"], ["성도", "flying"], ["호연", "ground"], ["신오", "steel"], ["하나", "dragon"],
  ["칼로스", "fairy"], ["알로라", "psychic"], ["가라르", "ice"], ["히스이", "normal"], ["팔데아", "fighting"],
];

export const MAX_BANDS = 3;
export const MAX_TEXT = 4;
export const TITLE_MARKS = ["mega"];

/* 운영자가 고를 수 있는 장식 (그린 것만). 없으면 색의 타입 문양이 선다. */
export const TITLE_DEVICES = [
  // 범용 장식 (새 칭호 제작과 자동 추천용)
  ["trophy", "트로피"], ["laurel", "월계관"], ["sword", "검"], ["shield", "방패"],
  ["sun", "태양"], ["moon", "초승달"], ["snowflake", "눈꽃"], ["blossom", "벚꽃"],
  ["bolt", "번개"], ["wing", "날개"], ["gem", "보석"], ["dice", "주사위"],
  ["hourglass", "모래시계"], ["heart", "하트"], ["note", "음표"], ["flag", "깃발"],
  ["target", "과녁"], ["compass", "나침반"],
  // 기존 고유 칭호 장식
  ["hangul", "한글 책"], ["nova", "새 별"], ["rookie", "별똥별"], ["n151", "151"],
  ["torch", "횃불"], ["sprout", "새싹"], ["bus", "운전대"], ["indigo", "불을 이은 새싹"],
  ["paw", "발자국"], ["engineering", "칩과 플라스크와 톱니"], ["monkey", "세 원숭이"], ["tower", "탑"],
];
const DEVICE_IDS = new Set(TITLE_DEVICES.map(([id]) => id));
const FALLBACK_DEVICES = [
  "trophy", "laurel", "sword", "shield", "sun", "moon", "snowflake", "blossom",
  "bolt", "wing", "gem", "dice", "hourglass", "heart", "note", "flag", "target", "compass",
  "nova", "torch", "sprout", "rookie",
];

/* 운영자가 문장을 고르기 전의 기본 문장. 뜻은 운영진에게 들은 대로(2026-11-12, 11-13):
   끝말잇기는 한글날의 대회, 몽키매직은 세 원숭이(풀, 불꽃, 물), 전화기는 전자공학, 화학공학, 기계공학의 준말(전화를 거는 기계가 아니다)로 그 세 모노타입 팀,
   초신성은 뉴비 대회의 우승(슈퍼루키와 같은 뜻), RED 는 1세대 151마리만 쓴 대회, 스승과 제자는 팀전 멘토와 멘티, 청출어람은 팀전 멘토로 전승 우승(스승의 횃불을 이어받아 더 크게 태우는 새싹, 스승보다 나아간 제자). */
const PRESETS = {
  끝말잇기: { bands: ["psychic"], device: "hangul" },
  몽키매직: { bands: ["grass", "fire", "water"], device: "monkey" },
  전화기: { bands: ["electric", "poison", "steel"], device: "engineering" },
  초신성: { bands: ["dragon", "fairy"], device: "nova" },
  메가진화의계승자: { bands: [], mark: "mega" },
  RED: { bands: ["fire"], device: "n151" },
  슈퍼루키: { bands: ["ice"], device: "rookie" },
  버스드라이버: { bands: ["steel"], device: "bus" },
  청출어람: { bands: ["water"], device: "indigo" },
  스승: { bands: ["fighting"], device: "torch" },
  제자: { bands: ["grass"], device: "sprout" },
  // 도전의 탑의 달 1위(tower_history.sql streak_month_tops), 운영 화면에서 달마다 준다
  탑의정상: { bands: ["dragon"], device: "tower" },
};
const nameKey = name => String(name || "").replace(/\s+/g, "");
const trimText = value => [...String(value || "").trim()].slice(0, MAX_TEXT).join("");

/* 저장할 수 있는 문장만 남긴다: 알려진 타입 1~3개, 그린 장식/포켓몬 실루엣/짧은 글자 하나, 또는 메가 문양. */
export function normalizeTitleLook(look) {
  if (!look || typeof look !== "object") return null;
  const mark = TITLE_MARKS.includes(look.mark) ? look.mark : null;
  const bands = (Array.isArray(look.bands) ? look.bands : []).filter(id => TYPE_IDS.has(id)).slice(0, MAX_BANDS);
  if (!bands.length && mark !== "mega") return null;
  if (mark) return { bands: [], mark };
  const pokemon = typeof look.pokemon === "string" ? look.pokemon.trim() : "";
  if (pokemon) return { bands, pokemon };
  const text = typeof look.text === "string" ? trimText(look.text) : "";
  if (text) return { bands, text };
  return { bands, ...(DEVICE_IDS.has(look.device) ? { device: look.device } : {}) };
}

export function titleLook(item) {
  return normalizeTitleLook(item?.look) || normalizeTitleLook(PRESETS[nameKey(item?.name)]) || { bands: ["normal"] };
}

/* ---------- 자동 추천: 이름과 설명만으로 어울리고 기존 칭호와 겹치지 않는 문장을 고른다 ---------- */
const LOOK_SIG = look => {
  const norm = normalizeTitleLook(look);
  if (!norm) return "";
  return JSON.stringify([norm.bands, norm.device || "", norm.pokemon || "", norm.text || "", norm.mark || ""]);
};

const hashText = text => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/* 컨셉 키워드 사전: 이름이나 설명에서 어울리는 장식과 기본 타입 색을 찾는다 */
const SUGGEST_RULES = [
  { pattern: /벚꽃|봄맞이|봄철|개화|꽃잎|봄날|스프링|spring|blossom/i, device: "blossom", bands: ["fairy", "grass"] },
  { pattern: /겨울|눈꽃|눈사람|크리스마스|성탄|빙결|서리|한파|윈터|winter|snow/i, device: "snowflake", bands: ["ice"] },
  { pattern: /여름|태양|한여름|바캉스|해변|바다|해수욕|서머|summer|solar|sun/i, device: "sun", bands: ["water", "fire"] },
  { pattern: /가을|단풍|추석|수확|어텀|autumn|fall/i, device: "laurel", bands: ["fire", "ground"] },
  { pattern: /랜덤|무작위|주사위|운빨|뽑기|가챠|드래프트|random|dice|luck/i, device: "dice", bands: ["psychic", "fairy"] },
  { pattern: /번개|스피드|속전|쾌속|질주|블리츠|초고속|speed|blitz|flash/i, device: "bolt", bands: ["electric"] },
  { pattern: /할로윈|halloween/i, device: "moon", bands: ["ghost", "dark"] },
  { pattern: /밤|초승달|보름달|월식|야간|달빛|황혼|미드나잇|moon|lunar|night/i, device: "moon", bands: ["dark", "ghost"] },
  { pattern: /우주|은하|성운|유성|신성|별빛|스타|nova|star|galaxy/i, device: "nova", bands: ["psychic", "dragon"] },
  { pattern: /하늘|날개|비상|창공|바람|자유|wing|sky|wind/i, device: "wing", bands: ["flying"] },
  { pattern: /보석|다이아|루비|사파이어|에메랄드|크리스탈|보물|이로치|반짝|gem|crystal|shiny/i, device: "gem", bands: ["fairy", "rock"] },
  { pattern: /검객|결투|검|전사|격돌|승부|대결|토너먼트|배틀|duel|sword|clash/i, device: "sword", bands: ["fighting", "steel"] },
  { pattern: /방패|수비|방어|철벽|수호|가드|막이|shield|guard|wall/i, device: "shield", bands: ["steel", "rock"] },
  { pattern: /시간|마라톤|연승|기념|역사|연대기|모래시계|타임|time|streak|marathon/i, device: "hourglass", bands: ["steel", "psychic"] },
  { pattern: /팀전|우정|커플|듀오|페어(?!리)|유대|동료|협력|하트|사랑|발렌타인|heart|bond|duo|pair/i, device: "heart", bands: ["fairy", "fire"] },
  { pattern: /축제|페스티벌|파티|음악|노래|콘서트|음표|festival|music|party/i, device: "note", bands: ["electric", "fairy"] },
  { pattern: /깃발|정복|원정|점령|레이드|개척|선봉|flag|raid|conquest/i, device: "flag", bands: ["fire", "fighting"] },
  { pattern: /과녁|저격|명중|정밀|스나이퍼|원샷|target|sniper|ace/i, device: "target", bands: ["steel", "fire"] },
  { pattern: /모험|탐험|항해|나침반|입문|신입|뉴비|루키|rookie|adventure|compass/i, device: "compass", bands: ["water", "grass"] },
  { pattern: /한글|국어|퀴즈|끝말|독서|도감|지식|quiz|book/i, device: "hangul", bands: ["psychic"] },
  { pattern: /탑|등반|정상|tower/i, device: "tower", bands: ["dragon"] },
  { pattern: /전설|명예|마스터|그랜드|위업|영웅|달인|월계관|legend|master|grand/i, device: "laurel", bands: ["dragon", "steel"] },
  { pattern: /우승|트로피|챔프|최강|왕중왕|제패|올스타|컵|trophy|champ|cup/i, device: "trophy", bands: ["dragon", "fire"] },
];

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function matchPokemonInText(text, pokemonList) {
  if (!text || !Array.isArray(pokemonList) || !pokemonList.length) return null;
  const sorted = [...pokemonList]
    .filter(p => p && p.displayName)
    .sort((a, b) => b.displayName.length - a.displayName.length);
  for (const p of sorted) {
    const name = String(p.displayName).trim();
    if (!name) continue;
    if (name.length === 1) {
      if (new RegExp(`(?:^|\\s)${escapeRegExp(name)}(?:$|\\s|컵|배|전|의)`).test(text)) return p;
    } else if (text.includes(name)) {
      return p;
    }
  }
  return null;
}

function matchTypesInText(text) {
  const found = [];
  for (const t of TITLE_TYPES) {
    if (t.korean.length === 1) {
      // 1-char Korean types (물, 풀, 독, 땅, 악): require clear boundary or common compound
      if (new RegExp(`(?:^|[\\s/·,+])${t.korean}(?:타입|모노|컵|배|전|속성|[\\s/·,+]|$)`).test(text)) found.push(t.id);
    } else if (text.includes(t.korean)) {
      found.push(t.id);
    }
    if (found.length >= MAX_BANDS) break;
  }
  return found;
}

function extractShortToken(name) {
  const clean = String(name || "").trim();
  const season = clean.match(/\b(S\d{1,2}|[1-9]\d?v[1-9]\d?|MVP|ACE|PRO|TOP\d)\b/i);
  if (season) return season[1].toUpperCase().slice(0, MAX_TEXT);
  const numbered = clean.match(/(\d{1,4})(?:\s*(?:회|승|연승|주년|기|세대|강|인))/);
  if (numbered) return numbered[1].slice(0, MAX_TEXT);
  const bareNum = clean.match(/(?:^|\s)(\d{2,4})(?:\s|$)/);
  if (bareNum) return bareNum[1].slice(0, MAX_TEXT);
  return "";
}

function avoidCollision(candidate, seedText, existingLooks) {
  const used = new Set((existingLooks || []).map(LOOK_SIG).filter(Boolean));
  if (!used.size || !used.has(LOOK_SIG(candidate))) return candidate;
  const h = hashText(seedText || "title");
  // First try rotating bands while preserving the chosen device / pokemon / text
  for (let i = 0; i < VIVID_TYPES.length; i++) {
    const band = VIVID_TYPES[(h + i) % VIVID_TYPES.length];
    const next = normalizeTitleLook({ ...candidate, bands: [band] });
    if (next && !used.has(LOOK_SIG(next))) return next;
  }
  // Then try rotating both device and color
  for (let d = 0; d < FALLBACK_DEVICES.length; d++) {
    for (let i = 0; i < VIVID_TYPES.length; i++) {
      const next = normalizeTitleLook({
        bands: [VIVID_TYPES[(h + i) % VIVID_TYPES.length]],
        device: FALLBACK_DEVICES[(h + d) % FALLBACK_DEVICES.length],
      });
      if (next && !used.has(LOOK_SIG(next))) return next;
    }
  }
  return candidate;
}

export function suggestTitleLook({ name = "", desc = "", pokemonList = [], existingLooks = [] } = {}) {
  const cleanName = String(name || "").trim();
  const cleanDesc = String(desc || "").trim();
  const fullText = `${cleanName} ${cleanDesc}`.trim();
  if (!fullText) return { bands: ["normal"] };

  // 1. Known preset
  const preset = normalizeTitleLook(PRESETS[nameKey(cleanName)]);
  if (preset) return preset;

  // 2. Pokémon name in title or description -> Pokémon silhouette on its type color
  const matchedMon = matchPokemonInText(cleanName, pokemonList) || matchPokemonInText(cleanDesc, pokemonList);
  if (matchedMon) {
    const monType = TYPE_IDS.has(matchedMon.type) ? matchedMon.type : "normal";
    return avoidCollision({ bands: [monType], pokemon: matchedMon.displayName }, cleanName, existingLooks);
  }

  // 3. Explicit types + concept keywords
  const explicitTypes = matchTypesInText(fullText);
  const concept = SUGGEST_RULES.find(rule => rule.pattern.test(cleanName))
    || SUGGEST_RULES.find(rule => rule.pattern.test(cleanDesc));

  if (explicitTypes.length && concept) {
    return avoidCollision({ bands: explicitTypes, device: concept.device }, cleanName, existingLooks);
  }
  if (explicitTypes.length) {
    return avoidCollision({ bands: explicitTypes }, cleanName, existingLooks);
  }
  if (concept) {
    return avoidCollision({ bands: concept.bands, device: concept.device }, cleanName, existingLooks);
  }

  // 4. Short numeral or code monogram (e.g. 100승, S6, 2v2, MVP)
  const token = extractShortToken(cleanName);
  const h = hashText(cleanName || fullText);
  if (token) {
    const band = VIVID_TYPES[h % VIVID_TYPES.length];
    return avoidCollision({ bands: [band], text: token }, cleanName, existingLooks);
  }

  // 5. Deterministic fallback: vivid type color + general device (never bland normal monochrome)
  const band = VIVID_TYPES[h % VIVID_TYPES.length];
  const device = FALLBACK_DEVICES[(h >>> 5) % FALLBACK_DEVICES.length];
  return avoidCollision({ bands: [band], device }, cleanName, existingLooks);
}

/* 이름에서 분류의 꼬리를 덜어낸 열쇠: "물 엑스퍼트" → "물", "성도 엘리트" → "성도", "3대 챔피언"/"초대 챔피언" → 3/1 */
export const typeOfTitle = name => TITLE_TYPES.find(type => String(name || "").replace(/\s*엑스퍼트$/, "").trim() === type.korean)?.id || null;
export const regionOfTitle = name => REGIONS.find(([region]) => String(name || "").replace(/\s*엘리트$/, "").trim() === region)?.[0] || null;
export function generationOfTitle(name) {
  const text = String(name || "").trim();
  if (/^초대/.test(text)) return 1;
  const n = parseInt(text, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/* ---------- 메달 한 개의 설계도 (titleMedal.js 가 그린다). 색은 타입 id 로만 적고, 실제 색은 그릴 때 토큰에서 읽는다. ---------- */
export const typeMedal = id => ({ glyphs: [id], enamel: [id] });
export const regionMedal = region => ({ scene: region, enamel: [REGIONS.find(([r]) => r === region)?.[1] || "normal"] });
/* 파트너는 제 타입의 언덕 위에 그 포켓몬의 실루엣(picture: 그 그림의 주소)이 서, 같은 타입의 두 파트너도 메달이 겹치지 않는다.
   그림을 모르면 발자국 */
export const partnerMedal = (type, picture) => {
  const t = TYPE_IDS.has(type) ? type : "normal";
  return picture ? { partner: picture, enamel: [t] } : { device: "paw", enamel: [t] };
};
/* 챔피언은 시즌과 상관없이 모두 왕관 아래 그 대의 로마 숫자 */
export const championMedal = generation => ({ champ: { gen: generation }, tier: "gold" });

export function ownMedal(item, { pokemonPicture, pokemonList, existingLooks } = {}) {
  const explicit = normalizeTitleLook(item?.look) || normalizeTitleLook(PRESETS[nameKey(item?.name)]);
  const look = explicit || (item?.name ? suggestTitleLook({ name: item.name, desc: item.desc, pokemonList, existingLooks }) : { bands: ["normal"] });
  if (look.mark === "mega") return { mark: "mega" };
  if (look.pokemon) {
    const picture = typeof pokemonPicture === "function" ? pokemonPicture(look.pokemon) : "";
    return picture ? { partner: picture, enamel: look.bands } : { device: "paw", enamel: look.bands };
  }
  if (look.text) return { text: look.text, enamel: look.bands };
  return look.device ? { device: look.device, enamel: look.bands } : { glyphs: look.bands, enamel: look.bands };
}
