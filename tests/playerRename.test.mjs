import test from "node:test";
import assert from "node:assert/strict";
import { renameInSiteData } from "../src/services/playerRename.js";

test("a name changes wherever it stands whole in the records' text, and nowhere else", () => {
  const data = {
    titleGroups: [{ key: "etc", items: [{ name: "초신성", holders: ["김 채운", "이진우"] }, { name: "x", holders: ["김채운", "김 채운"] }] }],
    champions: [{ gen: "6대", name: "김 채운", team: [{ name: "김 채운" }] }],
    rankings: [{ key: "s1", rows: [{ name: "김 채운", points: 10 }] }],
    announcements: [{ title: "김 채운", body: "김 채운 님 축하" }],
    tournaments: [{ rounds: [{ win: "김 채운", note: "김 채운의 첫 우승" }] }],
  };
  const out = renameInSiteData(data, "김 채운", "김채운");
  assert.deepEqual(out.titleGroups[0].items[0].holders, ["김채운", "이진우"]);
  assert.deepEqual(out.titleGroups[0].items[1].holders, ["김채운"]); // the kept name stands once
  assert.equal(out.champions[0].name, "김채운");
  assert.equal(out.rankings[0].rows[0].name, "김채운");
  assert.equal(out.tournaments[0].rounds[0].win, "김채운");
  assert.equal(out.tournaments[0].rounds[0].note, "김 채운의 첫 우승");
  assert.equal(out.announcements, data.announcements);
  assert.equal(renameInSiteData(data, "a", "a"), data);
});
