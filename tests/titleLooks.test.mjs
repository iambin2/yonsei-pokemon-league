import test from "node:test";
import assert from "node:assert/strict";
import { championMedal, generationOfTitle, normalizeTitleLook, ownMedal, partnerMedal, regionMedal, regionOfTitle, suggestTitleLook, titleLook, typeMedal, typeOfTitle } from "../src/services/titleLooks.js";

test("a title's look keeps only what can be drawn", () => {
  assert.equal(normalizeTitleLook(null), null);
  assert.equal(normalizeTitleLook({ bands: [] }), null, "a look needs a colour");
  assert.deepEqual(normalizeTitleLook({ bands: ["fire", "nope", "water", "grass", "ice"] }), { bands: ["fire", "water", "grass"] }, "three known bands at most");
  assert.deepEqual(normalizeTitleLook({ bands: ["fire"], device: "torch", mons: ["피카츄"] }), { bands: ["fire"], device: "torch" }, "a drawn device; no Pokémon picture");
  assert.deepEqual(normalizeTitleLook({ bands: ["fire"], device: "pikachu" }), { bands: ["fire"] }, "an unknown device is none");
  assert.deepEqual(normalizeTitleLook({ bands: ["fire"], mark: "mega", device: "torch" }), { bands: [], mark: "mega" }, "the Mega emblem brings its own colours");
  assert.deepEqual(normalizeTitleLook({ bands: ["electric"], pokemon: "피카츄", device: "bolt" }), { bands: ["electric"], pokemon: "피카츄" }, "a Pokémon silhouette overrides device");
  assert.deepEqual(normalizeTitleLook({ bands: ["steel"], text: "  S12345 " }), { bands: ["steel"], text: "S123" }, "a short monogram is trimmed to 4 characters");
});

test("a title without a look falls back to its preset, then to one plain band", () => {
  assert.deepEqual(titleLook({ name: "버스 드라이버" }), { bands: ["steel"], device: "bus" }, "a preset is found whatever the spacing");
  assert.deepEqual(titleLook({ name: "메가진화의 계승자" }), { bands: [], mark: "mega" });
  assert.deepEqual(titleLook({ name: "전화기", look: { bands: ["dark"] } }), { bands: ["dark"] }, "the operators' choice wins");
  assert.deepEqual(titleLook({ name: "새 칭호" }), { bands: ["normal"] });
});

test("every title becomes a medal of its own kind", () => {
  assert.deepEqual(typeMedal("fire"), { glyphs: ["fire"], enamel: ["fire"] });
  assert.deepEqual(regionMedal("성도"), { scene: "성도", enamel: ["flying"] });
  assert.deepEqual(partnerMedal("fire"), { device: "paw", enamel: ["fire"] });
  assert.deepEqual(partnerMedal(undefined).enamel, ["normal"]);
  assert.deepEqual(partnerMedal("normal", "/sprites/pokemon/lopunny.webp"), { partner: "/sprites/pokemon/lopunny.webp", enamel: ["normal"] }, "a partner carries its Pokémon's picture");
  assert.notDeepEqual(partnerMedal("normal", "/sprites/pokemon/lopunny.webp"), partnerMedal("normal", "/sprites/pokemon/blissey.webp"), "two partners of one type are told apart");
  assert.deepEqual(ownMedal({ name: "RED" }), { device: "n151", enamel: ["fire"] });
  assert.deepEqual(ownMedal({ name: "몽키매직" }), { device: "monkey", enamel: ["grass", "fire", "water"] });
  assert.deepEqual(ownMedal({ name: "전화기" }), { device: "engineering", enamel: ["electric", "poison", "steel"] },
    "전화기 is 전자공학, 화학공학, 기계공학: a chip, a flask and a gear on their three colours, never a telephone");
  assert.deepEqual(ownMedal({ name: "메가진화의 계승자" }), { mark: "mega" });
  assert.notDeepEqual(ownMedal({ name: "스승" }), ownMedal({ name: "제자" }), "a teacher and a pupil are told apart");
  assert.deepEqual(championMedal(2), { champ: { gen: 2 }, tier: "gold" }, "every champion wears the crown, whatever the season");
});

test("a title's name gives its type, region or generation", () => {
  assert.equal(typeOfTitle("에스퍼 엑스퍼트"), "psychic");
  assert.equal(typeOfTitle("슈퍼루키"), null);
  assert.equal(regionOfTitle("히스이 엘리트"), "히스이");
  assert.equal(generationOfTitle("초대 챔피언"), 1);
  assert.equal(generationOfTitle("6대 챔피언"), 6);
  assert.equal(generationOfTitle("챔피언"), null);
});

test("suggestTitleLook derives fitting, non-colliding looks from name and desc", () => {
  const mons = [
    { displayName: "피카츄", type: "electric" },
    { displayName: "한카리아스", type: "dragon" },
    { displayName: "뮤", type: "psychic" },
  ];
  assert.deepEqual(suggestTitleLook({ name: "피카츄 컵", pokemonList: mons }), { bands: ["electric"], pokemon: "피카츄" });
  assert.deepEqual(suggestTitleLook({ name: "봄맞이 벚꽃 대회" }), { bands: ["fairy", "grass"], device: "blossom" });
  assert.deepEqual(suggestTitleLook({ name: "겨울 눈꽃 토너먼트" }), { bands: ["ice"], device: "snowflake" });
  assert.deepEqual(suggestTitleLook({ name: "랜덤 주사위 배틀" }), { bands: ["psychic", "fairy"], device: "dice" });
  assert.deepEqual(suggestTitleLook({ name: "불꽃 얼음 대결" }), { bands: ["fire", "ice"], device: "sword" });
  assert.deepEqual(suggestTitleLook({ name: "드래곤 페어리" }), { bands: ["dragon", "fairy"] });
  assert.deepEqual(suggestTitleLook({ name: "통산 100승 달성" }).text, "100");
  assert.deepEqual(suggestTitleLook({ name: "2v2 특수전" }).text, "2V2");

  const first = suggestTitleLook({ name: "랜덤 배틀" });
  const second = suggestTitleLook({ name: "랜덤 배틀", existingLooks: [first] });
  assert.notDeepEqual(second, first, "collision avoidance shifts look when already taken");

  const fallback = suggestTitleLook({ name: "연세의 별다른 기록" });
  assert.ok(fallback.bands.length === 1 && fallback.bands[0] !== "normal", "unknown title gets a vivid colour");
  assert.ok(fallback.device, "unknown title gets a general device");
});

test("ownMedal resolves pokemon silhouettes, short text monograms, and automatic suggestions", () => {
  assert.deepEqual(
    ownMedal({ name: "피카츄 컵", look: { bands: ["electric"], pokemon: "피카츄" } }, { pokemonPicture: name => name === "피카츄" ? "/sprites/pokemon/pikachu.webp" : "" }),
    { partner: "/sprites/pokemon/pikachu.webp", enamel: ["electric"] },
  );
  assert.deepEqual(
    ownMedal({ name: "100승", look: { bands: ["dragon"], text: "100" } }),
    { text: "100", enamel: ["dragon"] },
  );
  const autoSpec = ownMedal({ name: "겨울 빙결 컵" });
  assert.deepEqual(autoSpec, { device: "snowflake", enamel: ["ice"] });
});
