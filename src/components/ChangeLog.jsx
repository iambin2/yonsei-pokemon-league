import React, { useEffect, useState } from "react";
import { Row, SectionHead } from "./common/Board.jsx";
import { supa } from "../storage.js";
import { describeChange } from "../services/changeLog.js";

/* 최근 변경 (docs/db/change_log.sql, 2026-11-22): what was written to the league's records, newest first, read by operators only, so a
   result entered twice or a notice gone can be traced to when and by whom. Rows as the 운영 page's other lists; 더 보기 continues
   under the last. Until that SQL has run (no such function) the block is not drawn. */
const PAGE = 20;
async function readChangeLog(before) {
  if (!supa) return null;
  const { data, error } = await supa.rpc("admin_change_log", { p_limit: PAGE, p_before: before });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") return null;
    throw new Error("최근 변경을 불러오지 못했습니다.");
  }
  return data || [];
}

export default function ChangeLog({ id = "ad-changes-h" }) {
  const [rows, setRows] = useState([]);
  const [off, setOff] = useState(false);
  const [more, setMore] = useState(false);
  const [note, setNote] = useState("");
  const load = before => readChangeLog(before).then(page => {
    if (page === null) { setOff(true); return; }
    setRows(list => (before ? [...list, ...page] : page));
    setMore(page.length === PAGE);
  }, error => setNote(error.message));
  useEffect(() => { load(null); }, []);
  if (off || (!rows.length && !note)) return null;
  return <section className="ad-block" aria-labelledby={id}>
    <SectionHead id={id} title="최근 변경" link={more ? "더 보기" : undefined} onLink={() => load(rows[rows.length - 1]?.id)} />
    {note ? <div className="pn ad-none"><span className="t15">{note}</span></div>
      : <div className="stack">{rows.map(row => { const { title, line } = describeChange(row); return <Row key={row.id} title={title} line={line} />; })}</div>}
  </section>;
}
