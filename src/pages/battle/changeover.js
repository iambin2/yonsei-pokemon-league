/* going into a battle from the team preview (DESIGN.md "Battle", Going in; docs/BATTLE_TRANSITIONS.md). Rebuilt for the almanac
   (2026-11-24; the scoreboard's board of modules running in from both edges, meeting and ringing out went with the scoreboard): the
   preview's entries leave top to bottom, 38 apart, each over 260 (ease-in), their words and pictures first and their hairlines last;
   the stage keeps its box, and once the battle's frame stands in it one 2px lit rule draws in from the start edge across the stage's
   top (420) while the frame's strips rise into place; the court then tones in under it out of the page's own ground (stageFx opening),
   and the rule leaves. It runs for every 도전의 탑 game too. Transform and opacity only. Reduced motion: things stand at once. */
import { DUR, EASE_IN, EASE_OUT, STAGGER, reduced } from "../../components/common/motion.js";

const settled = anim => anim.finished.then(() => {}, () => {});
const step = i => Math.min(i * STAGGER.row, DUR.leave);
const OUT = [{ opacity: 1 }, { opacity: 0 }];
/* what arrives rises the last 12 as it lights; the end of its light is left to the page (an implicit keyframe), so a locked key comes
   up to its locked light and never past it (2026-11-24: the deck lit through the page's own light() stood at full colour, then
   dropped to the locked light) */
const RISE = [{ opacity: 0, transform: "translateY(12px)" }, { transform: "none" }];

/* the team preview's entries in reading order: a run's stake, the foe's strip, the court, our strip, the cards, and the pick (the dock
   under a phone's cards, the column's head on a desktop) last. Each entry's words and pictures go first, its hairline (the entry
   itself) after them */
export async function previewLeaves(box) {
  if (!box || reduced()) return;
  const pv = box.querySelector(".bt-preview");
  if (!pv) return;
  const entries = [...pv.querySelectorAll(":scope > .streak-band, .bt-pv-strip, .bt-pv-room, .bt-pick, :scope > .bt-cards > .bt-card"),
    ...document.querySelectorAll(".bt-match .bt-pickdock")];
  const inner = el => (el.classList.contains("bt-pick") ? [...el.querySelectorAll(":scope > .bt-card > *, :scope > .bt-info-key")] : [...el.children]);
  const words = entries.flatMap((el, i) => inner(el).map(c => settled(c.animate(OUT, { duration: DUR.leave, delay: step(i), easing: EASE_IN, fill: "forwards" }))));
  const last = step(entries.length - 1);
  const lines = entries.map(el => settled(el.animate(OUT, { duration: DUR.leave, delay: last, easing: EASE_IN, fill: "forwards" })));
  await Promise.all([...words, ...lines]);
}

/* things that arrive together, one after another 38 apart from start, rising the last 12 (motion.js light, here with the end of their
   light left to the page) */
export function arrive(els, start = 0) {
  if (reduced()) return;
  els.filter(Boolean).forEach((el, i) => el.animate(RISE, { duration: DUR.light, delay: start + step(i), easing: EASE_OUT, fill: "backwards" }));
}

/* the battle's frame stands in the stage's box: its strips rise into place and one 2px lit rule draws in from the start edge across the
   stage's top (420). Resolves with the rule once drawn; ruleLeaves takes it away once the court has toned in */
export async function stageOpens(stage) {
  const arena = stage?.closest(".bt-arena");
  if (!arena || reduced()) return null;
  arrive([...arena.querySelectorAll(":scope > .bt-strip")]);
  const over = stage.querySelector(".bs-over");
  if (!over) return null;
  const rule = document.createElement("i");
  rule.className = "bt-turnline";
  over.appendChild(rule);
  await settled(rule.animate([{ transform: "scaleX(0)" }, { transform: "none" }], { duration: DUR.light, easing: EASE_OUT, fill: "backwards" }));
  return rule;
}
export async function ruleLeaves(rule) {
  if (!rule) return;
  await settled(rule.animate(OUT, { duration: DUR.leave, easing: EASE_IN, fill: "forwards" }));
  rule.remove();
}
