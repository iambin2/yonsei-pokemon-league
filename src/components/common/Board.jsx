import React, { useEffect, useLayoutEffect, useRef } from "react";
import Icon from "./Icon.jsx";
import Fig from "./Fig.jsx";
import { standInk } from "./inkCentre.js";
import { drawRule, forgetLine, light, lightAfter, place, slideLine } from "./motion.js";

/* a number with its thousands marked (12,345), from one formatter: toLocaleString makes a new one for every number, 43 ms of the frame a
   ranking stood up in at a phone's speed (2026-11-18, the 도전의 탑 tab) */
const KO_NUMBER = new Intl.NumberFormat("ko-KR");
export const koNumber = n => KO_NUMBER.format(n);

/* the chosen word's line slides from the word before it (motion.js slideLine); the line itself is the word's own ::before.
   lights: a change of word also lights what the row swaps, even when the page drew the row afresh for the new word. */
export function useSlideLine(key, lights = false) {
  const ref = useRef(null);
  useLayoutEffect(() => { if (slideLine(ref.current) && lights) lightAfter(ref.current); }, [key]);
  useLayoutEffect(() => { const row = ref.current; return () => forgetLine(row); }, []);
  return ref;
}
/* what a page reads after it stands (a list of brackets, the records) lights the moment it arrives, once, as the page did; content that
   was already there when the page lit is left alone, so nothing lights twice. Returns the ref for the part that waits. */
export function useArrival(ready) {
  const ref = useRef(null), waited = useRef(!ready);
  useLayoutEffect(() => { if (ready && waited.current) { waited.current = false; light(ref.current); } }, [ready]);
  return ref;
}
/* the first page of a visit lights when its code and content are actually in place (inside the lazy boundary), not when the site's
   data arrives: a page whose code was still loading used to light its loader and then appear unlit */
export function Arrived({ onArrive }) {
  useLayoutEffect(() => { onArrive(); }, []);
  return null;
}

/* after the first render, a change of value lights what the control swaps (motion.js lightAfter) */
function useLightOnChange(ref, value) {
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } lightAfter(ref.current); }, [value]);
}
/* after the first render, a change of choice draws the chosen one's rule in (motion.js drawRule) */
function useDrawChosen(value) {
  const ref = useRef(null), first = useRef(true);
  useLayoutEffect(() => { if (first.current) { first.current = false; return; } drawRule(ref.current?.querySelector(":scope > .inv")); }, [value]);
  return ref;
}

/* The almanac's shared parts (DESIGN.md). A screen is built from these, board.css and the entry classes of tokens.css (.pn, .pn2,
   .stack, .inv, .lamp). An entry is a door: given onClick it is a button. */
/* A door with an address (href) is a link, so it opens in a new tab, copies by a long press and is found by a search engine;
   a plain click on it is still the site's own move (follow). */
export const follow = fn => e => {
  if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  fn(e);
};
const door = (onClick, href) => href && onClick ? { as: "a", props: { href, onClick: follow(onClick) } }
  : onClick ? { as: "button", props: { type: "button", onClick } } : { as: "div", props: {} };

/* A section is a title (20) and its link (a 12px underlined word on the right), 12 above its stack. */
/* a bar on its track, the one bar of the site (DESIGN.md "Show it"). It is drawn as an SVG with crisp edges and a height rounded to whole
   device pixels (--dpx, set in main.jsx): at 125% or 150% a 2px box falls on half a pixel, so one ranking row drew its line 2 thick and
   the next 3 (2026-11-19, measured on the owner's screen). value and under are 0 to 1; under is a second, dim reach beneath it (the
   calculator's roll). thick is the 8 of a thing a finger takes (a slider, its range input the child) or a gauge; otherwise the line of 2. */
const reach = v => Math.min(1, Math.max(0, Number(v) || 0));
export function Bar({ value, under, thick = false, className = "", children }) {
  return <span className={"bar" + (thick ? " thick" : "") + (className ? " " + className : "")} aria-hidden={children ? undefined : "true"}>
    <svg viewBox="0 0 1 1" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      <rect width="1" height="1" />
      {under != null && <rect className="under" width="1" height="1" style={{ transform: `scaleX(${reach(under)})` }} />}
      <rect className="on" width="1" height="1" style={{ transform: `scaleX(${reach(value)})` }} />
    </svg>{children}
  </span>;
}

export function SectionHead({ id, title, link, onLink }) {
  return (
    <div className="sh">
      <h2 className="t20" id={id}>{title}</h2>
      {link && <button type="button" className="sh-link" onClick={onLink}>{link}</button>}
    </div>
  );
}

/* A counter: an 84 entry, its label 12 on top, a figure under it (Figures). value null is a place still waiting for its figure: a
   muted dash. lamp "sig" puts the amber mark before the label, for what is live; nothing else is marked (Marks). The unit stands in type
   on the figure's baseline, and after replaces it where the words differ (/ 32). */
export function Counter({ label, value, unit = "", onClick, lamp, after, h = 40, keepZero = false }) {
  const { as: Box, props } = door(onClick);
  const lit = value != null;
  return (
    <Box className="pn counter" {...props} aria-label={lit ? `${label} ${value}${unit}` : label}>
      <span className="t12 dim counter-label">{lamp === "sig" && <i className="lamp sig" aria-hidden="true" />}{label}</span>
      <span className="counter-board"><Fig value={lit ? value : ""} h={h} label={lit ? `${value}${unit}` : ""} keepZero={keepZero} />{after ?? (unit && <span className="t15">{unit}</span>)}</span>
    </Box>
  );
}

/* A row of a stack: 52 for one line, 64 with a grey line. lead is the cell on the left (a rank, a date), value the figure on the right,
   lamp the column at the end: a word stands there (새 글, 진행 중), and with sig the amber mark before it, for what is live (Marks); a
   boolean keeps the column and marks it only when both it and sig are true. className sets the columns. */
export function Row({ lead, title, line, value, lamp, sig = false, onClick, href, className = "", label }) {
  const { as: Box, props } = door(onClick, href);
  return (
    <Box className={"pn row" + (line ? " row--2" : "") + (className ? " " + className : "")} {...props} aria-label={label}>
      {lead != null && <span className="row-lead">{lead}</span>}
      <span className="row-main"><b className="t15">{title}</b>{line && <span className="t12 dim reg">{line}</span>}</span>
      {value != null && <span className="row-value">{value}</span>}
      {typeof lamp === "string" ? <span className="row-lamp-word t12">{sig && <i className="lamp sig" aria-hidden="true" />}{lamp}</span>
        : lamp != null && <span className="row-lamp">{lamp && sig && <i className="lamp sig" aria-hidden="true" />}</span>}
    </Box>
  );
}

/* A lead entry: the first of a list stands large so the list has a beat. The date as 월 and 일 figures at 32, the word at the right
   (sig puts the amber mark before it), the title at 20 in two lines, a grey line. date is "10.28" (dotDate's day). */
export function Lead({ date, title, line, lamp, sig = false, onClick, href, label }) {
  const { as: Box, props } = door(onClick, href);
  const [m, d] = String(date || "").split(".");
  return (
    <Box className="pn lead" {...props} aria-label={label}>
      <span className="lead-top">
        {m && d ? <span className="lead-date" aria-hidden="true"><Fig value={m} h={32} label="" /><span className="t15">월</span><Fig value={d} h={32} label="" /><span className="t15">일</span></span> : <span />}
        {lamp && <span className="t12 lead-lamp">{sig && <i className="lamp sig" aria-hidden="true" />}{lamp}</span>}
      </span>
      <b className="t20 lead-title">{title}</b>
      {line && <span className="t12 dim reg">{line}</span>}
    </Box>
  );
}

/* The live strip: on event day every page but the home and the bracket opens with it: the amber lamp, the event's name with
   진행 중, and 대진표 → at the right. An entry on its hairline, never filled: amber on a lit fill would fall under the mark's contrast of 3. */
export function LiveStrip({ name, onGo }) {
  return (
    <button type="button" className="pn live-strip" onClick={onGo}>
      <span className="live-strip-say t12"><i className="lamp sig" aria-hidden="true" />{name} 진행 중</span>
      <span className="live-strip-go t12"><Icon n="arrow" size={16} />대진표</span>
    </button>
  );
}

/* Pictures that arrive late come on together: those set down in one commit (a party's six, a board's row) wait unseen for the last of
   them, at most WAIT, so a party never lights one Pokémon at a time (2026-11-22). A lazy picture waits for the scroll, not for the
   others, and comes on by itself. */
const WAIT = 1200, groups = new WeakMap();
let group = null;
function reveal(imgs) { const here = imgs.filter(img => img.isConnected); here.forEach(img => { delete img.dataset.late; }); place(here); }
function flush(g) { reveal(g.ready.splice(0)); }
function late(img) {
  img.dataset.late = "";
  if (img.loading === "lazy") return;
  if (!group) { const g = group = { wait: new Set(), ready: [], over: false }; queueMicrotask(() => { group = null; }); setTimeout(() => { g.over = true; flush(g); }, WAIT); }
  group.wait.add(img); groups.set(img, group);
  img.addEventListener("error", () => arrived(img), { once: true });
}
function arrived(img) {
  const g = groups.get(img);
  if (!g) { reveal([img]); return; }
  groups.delete(img); g.wait.delete(img); g.ready.push(img);
  if (g.over || !g.wait.size) flush(g);
}

/* A Pokémon standing on its line (DESIGN.md "Where a Pokémon stands"): the parent is a .stand entry with a .floor place; the picture
   stands with its ink's feet on the band's top edge. Pictures that fail to load leave the floor empty. */
export function Mon({ src, small = false, className = "", ...rest }) {
  if (!src) return null;
  // a cell at most 64 across takes the picture's small copy (192: half the bytes and a seventh of the pixels to decode; scripts/build-sprites.py writes both)
  if (small) src = src.replace("/sprites/pokemon/", "/sprites/pokemon-s/");
  // a picture still loading when its entry lit comes on by tone once it has loaded, instead of popping in (DESIGN.md "Motion")
  const stand = img => { if (!img) return; if (img.complete && img.naturalWidth) standInk(img); else if (img.dataset.late == null) late(img); };
  const loaded = img => { standInk(img); if (img.dataset.late != null) arrived(img); };
  return <img className={"mon" + (className ? " " + className : "")} src={src} alt="" decoding="async" {...rest} ref={stand} onLoad={e => loaded(e.currentTarget)} />;
}

/* ---------- controls (DESIGN.md "Controls") ---------- */

/* the ! square an error starts with: the error reads by it and a sentence, never by a colour */
export const Bang = () => <span className="bang" aria-hidden="true">!</span>;

/* A back link: 12 dim with a chevron, naming where it goes. */
export function BackLink({ to, onClick }) {
  return <button type="button" className="back t12 dim" onClick={onClick}><Icon n="back" size={16} />{to}</button>;
}

/* A field: its label 12 dim, 8 above the control; an error keeps the 2px line and adds the ! square and a sentence under it.
   group is true for a row of choices, which a label cannot point at. */
export function Question({ id, label, required = false, error, group = false, children }) {
  const Label = group ? "span" : "label";
  return (
    <div className={"q" + (error ? " has-error" : "")} role={group ? "group" : undefined} aria-labelledby={group ? `${id}-label` : undefined}>
      <Label className="q-label t12 dim" id={`${id}-label`} htmlFor={group ? undefined : id}>{label}{required && " *"}</Label>
      {children}
      {error && <p className="q-error t12" id={`${id}-error`} role="alert"><Bang />{error}</p>}
    </div>
  );
}

/* Choice: a few options as 44 entries in a row, the chosen one lit over the 2px rule. multiple turns it into checks: 20 squares beside their words. */
export function Choice({ name, options, value, onChange, multiple = false }) {
  const chosen = useDrawChosen(multiple ? null : value);
  if (multiple) {
    const list = Array.isArray(value) ? value : [];
    return (
      <div className="checks">
        {options.map((op, i) => <label className="check-row" key={i}>
          <input type="checkbox" className="sr-only" checked={list.includes(op)} onChange={() => onChange(list.includes(op) ? list.filter(x => x !== op) : [...list, op])} />
          <span className={"box" + (list.includes(op) ? " on" : "")} aria-hidden="true">{list.includes(op) && <Icon n="check" size={16} />}</span>
          <span className="t15 reg">{op}</span>
        </label>)}
      </div>
    );
  }
  return (
    <div className="choice stack" role="radiogroup" ref={chosen}>
      {options.map((op, i) => <label className={"choice-opt " + (value === op ? "inv" : "pn")} key={i}>
        <input type="radio" className="sr-only" name={name} checked={value === op} onChange={() => onChange(op)} />{op}
      </label>)}
    </div>
  );
}

/* The main action's strip: on a phone it docks above the tab bar on the ground with a hairline, so it never scrolls away. toast stands
   above it: a filled 52 strip, an error starting with the ! square, its one action an underlined word. */
/* a cell: a label 12 over its value 15 in a 52 entry; a dropdown or pick field inside fills the cell (spec cells, fields) */
export function Cell({ label, wide = false, className = "", children }) {
  return <div className={"cell" + (wide ? " wide" : "") + (className ? " " + className : "")}><span className="cell-label">{label}</span>{children}</div>;
}
/* options as rows of 64: a title and a grey line, the chosen one lit over the 2px rule with a check (rules, settings) */
export function OptionRows({ name, options, value, onChange, disabled = false }) {
  const chosen = useDrawChosen(value);
  return (
    <div className="stack" role="radiogroup" ref={chosen}>
      {options.map(op => <label key={op.value} className={"opt-row " + (value === op.value ? "inv" : "pn") + (disabled ? " off" : "")}>
        <input type="radio" className="sr-only" name={name} checked={value === op.value} disabled={disabled} onChange={() => onChange(op.value)} />
        <span className="opt-copy"><b className="t15">{op.title}</b>{op.line && <span className="t12 reg opt-line">{op.line}</span>}</span>
        {value === op.value && <Icon n="check" size={20} />}
      </label>)}
    </div>
  );
}
export function Dock({ toast, children }) {
  return <div className="dock" data-still>{toast}{children}</div>;
}
export function Toast({ error = false, action, onAction, children }) {
  return (
    <div className="toast-panel inv" role={error ? "alert" : "status"}>
      <span className="toast-say">{error && <Bang />}{children}</span>
      {action && <button type="button" className="toast-act" onClick={onAction}>{action}</button>}
    </div>
  );
}

/* Page tabs: words 15 on a 44 line with a hairline under the row; the chosen word is 700, lit, with a 2px line under it. */
export function TabsLine({ value, onChange, options, label }) {
  const ref = useSlideLine(value, true);
  return (
    <div className="tabsline-frame">
      <div className="tabsline" role="tablist" aria-label={label} ref={ref}>
        {options.map(([key, text]) => <button type="button" role="tab" key={key} aria-selected={value === key} className={value === key ? "on" : undefined} onClick={() => onChange(key)}>{text}</button>)}
      </div>
    </div>
  );
}

/* Steps of a flow (DESIGN.md "Controls"): a row of entries, 44; done dim with a check, current lit over the 2px rule, next muted. at is 1-based;
   past the last step every step is done. */
export function Steps({ labels, at }) {
  const chosen = useDrawChosen(at);
  return (
    <ol className="stack steps" style={{ "--n": labels.length }} ref={chosen}>
      {labels.map((label, i) => {
        const n = i + 1, state = n < at ? "done" : n === at ? "inv" : "next";
        return <li key={label} className={"step " + (state === "inv" ? "inv" : "pn " + state)} aria-current={state === "inv" ? "step" : undefined}>
          <span className="num">{n}</span>{state === "done" && <Icon n="check" size={16} />}{label}</li>;
      })}
    </ol>
  );
}

/* A status at a row's end: the amber lamp beside 진행 중 for what is live, otherwise the words dim. */
export function Status({ live, children }) {
  return <span className={"status t12" + (live ? "" : " dim")}>{live && <i className="lamp sig" aria-hidden="true" />}{children}</span>;
}

/* Chips: filters and counts as 32 entries in a row, 12px, the applied one lit over the 2px rule, the count in its word (전체 59). */
export function Chips({ value, onChange, options, label }) {
  const ref = useDrawChosen(value);
  useLightOnChange(ref, value);
  return (
    <div className="chips" role="group" aria-label={label} ref={ref}>
      {options.map(([key, text]) => <button type="button" key={key} aria-pressed={value === key} className={value === key ? "inv" : "pn"} onClick={() => onChange(key)}>{text}</button>)}
    </div>
  );
}

/* A type picker: the 18 types as cells of one size joined by the seam, each with its colour square; the chosen one decided. all, when
   given, is the "every type" cell (key ""), two cells wide so the board stays a full rectangle (DESIGN.md "Composing a screen" 12). */
export function TypeGrid({ value, onChange, types, label, all, disabled = false }) {
  const ref = useRef(null);
  useLightOnChange(ref, value);
  const cell = (key, text, cls = "") => (
    <button type="button" key={key || "all"} role="radio" aria-checked={value === key} disabled={disabled}
      className={"tb-type-opt " + (value === key ? "inv" : "pn") + cls} onClick={() => onChange(key)}>{text}</button>
  );
  return (
    <div className={"stack tb-type-grid" + (all ? " has-all" : "")} role="radiogroup" aria-label={label} ref={ref}>
      {all && cell("", all, " all")}
      {types.map(type => cell(type.id, <span className={`tb-type type-${type.id}`}>{type.korean}</span>))}
    </div>
  );
}
