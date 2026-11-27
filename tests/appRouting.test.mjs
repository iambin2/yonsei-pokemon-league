import assert from "node:assert/strict";
import test from "node:test";
import { buildViewSearch, isUnknownPath, isUnknownView, viewHref } from "../src/services/appRouting.js";

const BASE = "/yonsei-pokemon-league/";

test("the site's own addresses are known", () => {
  assert.equal(isUnknownPath("/yonsei-pokemon-league/", BASE), false);
  assert.equal(isUnknownPath("/yonsei-pokemon-league/index.html", BASE), false);
});

test("anything else under the base is a 404", () => {
  assert.equal(isUnknownPath("/yonsei-pokemon-league/news", BASE), true);
  assert.equal(isUnknownPath("/yonsei-pokemon-league/404.html", BASE), true);
});

test("outside the base nothing is judged", () => {
  assert.equal(isUnknownPath("/", BASE), false);
});

test("a view the site does not have is a 404, no view is the home", () => {
  assert.equal(isUnknownView("?view=calculator"), true);
  assert.equal(isUnknownView("?view=calc"), false);
  assert.equal(isUnknownView(""), false);
  assert.equal(isUnknownView("?notice=abc"), false);
});

test("buildViewSearch and viewHref share identical query serialization", () => {
  assert.equal(viewHref("home"), "/");
  assert.equal(viewHref("bracket", { eventId: "ev1", m: "M1" }), "/?view=bracket&eventId=ev1&m=M1");
  assert.equal(viewHref("bracket", { pb: "priv1" }), "/?view=bracket&pb=priv1");
  assert.equal(viewHref("board", { tab: "sample", format: "double" }), "/?view=board&tab=sample&format=double");
  assert.equal(buildViewSearch("records", { trainer: "Ash", me: "1" }, "?view=builder&reg=m-c&cup=none"), "?view=records&trainer=Ash&me=1");
  assert.equal(buildViewSearch("bracket", { eventId: "ev2" }, "?view=battle&id=b1&match=m1"), "?view=bracket&eventId=ev2");
});
