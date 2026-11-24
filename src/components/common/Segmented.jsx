import React, { useLayoutEffect, useRef } from "react";
import { forgetLine, reduced, slideLine } from "./motion.js";

/* A choice (DESIGN.md "Controls"): a few options as 44 entries in a row, the chosen one lit over a 2px line that slides to it as the
   page tabs' does (motion.js slideLine). Page tabs are TabsLine. 넘치면 스크롤 막대 없이 가로로 넘기고 고른 칸을 보이는 곳으로 당긴다. */
export default function Segmented({ value, onChange, options, ariaLabel, className = "" }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const track = ref.current, on = track?.querySelector('[aria-selected="true"]');
    slideLine(track);
    if (on && track.scrollWidth > track.clientWidth) track.scrollTo({ left: on.offsetLeft - track.clientWidth / 2 + on.offsetWidth / 2, behavior: reduced() ? "auto" : "smooth" });
  }, [value]);
  useLayoutEffect(() => { const track = ref.current; return () => forgetLine(track); }, []);
  return (
    <div className={"ypl-seg" + (className ? " " + className : "")}>
      <div className="seg-track" role="tablist" aria-label={ariaLabel} ref={ref} data-own-line="">
        {options.map(([key, label]) => (
          <button key={String(key)} type="button" role="tab" aria-selected={key === value} onClick={() => onChange(key)}>{label}</button>
        ))}
      </div>
    </div>
  );
}
