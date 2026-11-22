import React, { useEffect, useState } from "react";
import { Row, SectionHead } from "./common/Board.jsx";
import Button from "./common/Button.jsx";
import { supa } from "../storage.js";
import { REPORT_REASONS } from "../services/communityReports.js";
import { formatDate } from "../services/dateFormat.js";

/* 신고 (docs/db/handover_features.sql, 2026-11-22, the owner's draft 10 A): posts and comments visitors reported, newest first, for
   operators only. A row opens the post (to delete it, which takes its reports with it); 신고 지우기 keeps the post and drops the reports.
   Until that SQL has run (no such function), or with nothing reported, nothing shows. */
const WORD = Object.fromEntries(REPORT_REASONS);
async function readReports(clear = null) {
  if (!supa) return null;
  const { data, error } = await supa.rpc("admin_community_reports", { p_clear: clear });
  if (error) { if (error.code === "PGRST202" || error.code === "42883") return null; throw new Error("신고를 불러오지 못했습니다."); }
  // a sample or party post opens in its own tab and format: read the kind of each reported showcase post (a comment, of its post)
  const roots = [...new Set((data || []).filter(r => r.board === "showcase").map(r => r.parent_id || r.item_id))];
  const kinds = roots.length ? (await supa.from("community_items").select("id, kind:payload->>kind, format:payload->>format").in("id", roots)).data || [] : [];
  const kindOf = new Map(kinds.map(k => [k.id, k]));
  return (data || []).map(r => ({ ...r, post: kindOf.get(r.parent_id || r.item_id) || null }));
}
const where = r => {
  const post = r.parent_id || r.item_id;
  if (r.board === "free") return { post };
  return { tab: r.post?.kind || "sample", ...(r.post?.format === "double" && { format: "double" }), post };
};

export default function CommunityReports({ go, id = "ad-reports-h" }) {
  const [rows, setRows] = useState(null);
  const [note, setNote] = useState("");
  const load = clear => readReports(clear).then(setRows, error => setNote(error.message));
  useEffect(() => { load(null); }, []);
  if (!note && !rows?.length) return null;
  return <section className="ad-block" aria-labelledby={id}>
    <SectionHead id={id} title="신고" />
    {note ? <div className="pn ad-none"><span className="t15">{note}</span></div>
      : <div className="stack">{rows.map(r => <React.Fragment key={r.item_id}>
        <Row title={r.title || (r.parent_id ? "(댓글)" : "(제목 없음)")} lamp
          line={[Object.entries(r.reasons || {}).map(([k, n]) => `${WORD[k] || k} ${n}`).join(", "), formatDate(r.last_at, { time: true })].filter(Boolean).join(", ")}
          onClick={() => go("board", where(r))} />
        <Button variant="link" size="sm" onClick={() => load(r.item_id)}>신고 지우기</Button>
      </React.Fragment>)}</div>}
  </section>;
}
