import React, { useLayoutEffect, useRef } from "react";
import { tone } from "./motion.js";

/* A figure the page announces (DESIGN.md "Figures"): a number set large in Albert Sans, the larger the thinner, as an almanac sets its
   standing figures. h is the height of the digits' ink; a leading zero is dropped (05 reads 5) except in a clock (13:00). value holds
   digits, '-', ' ' and ':'; nothing to show stands as a muted dash. label is what assistive technology reads. When the value changes the
   figure brightens once (tone). Any other prop (an older caller's cells) is not read. */
const weightOf = h => (h >= 84 ? 200 : h >= 40 ? 300 : 400);
export function figText(value, keepZero = false) {
  const v = String(value ?? "").trim();
  if (!v || !/\d/.test(v)) return "";
  return keepZero || v.includes(":") ? v : v.replace(/^(-?)0+(?=\d)/, "$1");
}
export default function Fig({ value, h = 40, label, className = "", keepZero = false }) {
  const text = figText(value, keepZero);
  const el = useRef(null), last = useRef(null);
  useLayoutEffect(() => {
    const was = last.current;
    last.current = text;
    if (was != null && was !== text && text) tone(el.current);
  }, [text]);
  return (
    <span ref={el} className={"fig" + (text ? "" : " fig-none") + (className ? " " + className : "")} role="img" aria-label={label ?? (text || "")}
      style={{ "--fig-h": `${h}px`, fontWeight: weightOf(h) }}>{text || "–"}</span>
  );
}
