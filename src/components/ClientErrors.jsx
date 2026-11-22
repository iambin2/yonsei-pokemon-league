import React, { useEffect, useState } from "react";
import { Row, SectionHead } from "./common/Board.jsx";
import { supa } from "../storage.js";
import { formatDate } from "../services/dateFormat.js";

/* 화면 오류 (docs/db/handover_features.sql, 2026-11-22): what broke on visitors' screens, newest first, for operators only, so a fault
   nobody reported is still seen. Rows as 최근 변경 beside it. Until that SQL has run (no such function), or with nothing to show, none. */
async function readClientErrors() {
  if (!supa) return null;
  const { data, error } = await supa.rpc("admin_client_errors", { p_limit: 20 });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") return null;
    throw new Error("화면 오류를 불러오지 못했습니다.");
  }
  return data || [];
}

export default function ClientErrors({ id = "ad-errors-h" }) {
  const [rows, setRows] = useState(null);
  const [note, setNote] = useState("");
  useEffect(() => { readClientErrors().then(setRows, error => setNote(error.message)); }, []);
  if (!note && !rows?.length) return null;
  return <section className="ad-block" aria-labelledby={id}>
    <SectionHead id={id} title="화면 오류" />
    {note ? <div className="pn ad-none"><span className="t15">{note}</span></div>
      : <div className="stack">{rows.map(row => <Row key={row.id} title={row.message.split("\n")[0].slice(0, 120)}
        line={[formatDate(row.created_at, { time: true }), row.url, row.build].filter(Boolean).join(", ")} />)}</div>}
  </section>;
}
