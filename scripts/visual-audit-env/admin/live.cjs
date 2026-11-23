// The event-day fixture: 38회 파이컵 마스터 (double elimination, 7 entrants, really finished) is patched in the GET answers to be RUNNING TODAY.
// Nothing is written anywhere: only the JSON the page receives is changed.
const fs = require("fs"), path = require("path");
const j = f => JSON.parse(fs.readFileSync(path.join(__dirname, "data", f)));
const EV = "c34f3629-ad49-4d32-82fb-38d1f989fa13", NOTICE = "1tkq3h4";
const today = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 10);
const entries = j("entries.json").filter(e => e.event_id === EV);
const E = Object.fromEntries(entries.map(e => [e.display_name, e.id]));
const ME = { name: "이제빈", playerId: "4b8fe65f-5e75-5f59-ad54-3c19112ee28a", entry: E["이제빈"] };
const eventRow = j("events_30.json")[0];
const CLEAR = ["double:w:r3:m1", "double:l:r3:m1"], DROP = ["double:gf:m1", "double:l:r4:m1"];
const FORFEIT = ["double:w:r1:m2", "double:w:r1:m4", "double:l:r2:m2", "double:l:r1:m1"];
const SCORE = { "double:w:r2:m1": [2, 1], "double:w:r2:m2": [2, 0] };
const TABLE = { "double:w:r3:m1": "1", "double:l:r3:m1": "2" };
/* o: reports "none"|"one"|"agree"|"differ", start "HH:MM", battle (true | "waiting": l:r3 is a site battle), checkin "open"|"done"|null,
   report {status,mine}, visitor (bool: 이제빈 signed in and linked), requests [] (player_accounts rows the admin reads), due "HH:MM", heldOn, closesAt */
function live(o = {}) {
  const patches = [
    { re: /tbl:site_data/, fn: rows => { const a = rows[0]?.value?.announcements?.find(x => x.id === NOTICE); if (a) { a.form.eventDraft.heldOn = o.heldOn || today; a.form.eventDraft.startTime = o.start || "16:00"; if (o.due) a.form.eventDraft.submissionTargetAt = `${today}T${o.due}`; else delete a.form.eventDraft.submissionTargetAt; if (o.closesAt) a.form.closesAt = o.closesAt; } return rows; } },
    { re: /tbl:events/, fn: (rows, u) => { if (!Array.isArray(rows)) return rows; for (const r of rows) if (r.id === EV) { if ("record_applied_at" in r) r.record_applied_at = null; if ("status" in r) r.status = "running"; if ("held_on" in r) r.held_on = today; }
        if (/record_applied_at=is\.null/.test(u) && !/held_on=lt/.test(u) && !rows.some(r => r.id === EV)) rows.unshift({ ...eventRow, record_applied_at: null, status: "running", held_on: today }); return rows; } },
    { re: /tbl:matches/, fn: (rows, u) => { if (!Array.isArray(rows)) return rows; const mine = r => (r.event_id ? r.event_id === EV : u.includes(EV));
        return rows.filter(r => !(mine(r) && DROP.includes(r.source_node_key))).map(r => { if (!mine(r)) return r; const k = r.source_node_key;
          if (CLEAR.includes(k)) { for (const f of ["winner_entry_id", "winner_player_id", "played_at", "score_a", "score_b"]) if (f in r) r[f] = null; }
          if (FORFEIT.includes(k) && "resolution" in r) r.resolution = "forfeit";
          if (SCORE[k] && "score_a" in r) { r.score_a = SCORE[k][0]; r.score_b = SCORE[k][1]; }
          if (TABLE[k] && "table_label" in r) r.table_label = TABLE[k]; return r; }); } },
    { re: /tbl:bracket_runtimes/, fn: rows => { for (const r of rows) if (r.event_id === EV) r.round_schedule = { "double:w:r3": `${today}T${o.roundAt || "08:30"}:00+09:00`, "double:l:r3": `${today}T${o.roundAt || "08:30"}:00+09:00` }; return rows; } },
    { re: /tbl:entry_departures/, fn: (rows, u) => (u.includes(EV) ? [{ entry_id: E["구태욱"], kind: "withdrew" }, { entry_id: E["이상준"], kind: "disqualified" }] : rows) },
    { re: /tbl:battles/, fn: (rows, u) => { if (!u.includes("event_id=eq." + EV)) return rows; const base = { kind: "official", event_id: EV, turn: 7, applied_at: null, apply_error: null, updated_at: new Date().toISOString(), deadline_at: null, p1_player_id: null, p2_player_id: null };
        return [...(o.battle ? [{ ...base, id: "00000000-0000-4000-8000-0000000000b1", status: o.battle === "waiting" ? "waiting" : "active", p1_name: "강진영", p2_name: "정두호", winner: null, ended_by: null, source_node_key: "double:l:r3:m1", p1_entry_id: E["강진영"], p2_entry_id: E["정두호"] }] : []),
          { ...base, id: "00000000-0000-4000-8000-0000000000b2", status: "ended", p1_name: "정두호", p2_name: "이제빈", winner: "p2", ended_by: "timeout", source_node_key: "double:w:r1:m4", p1_entry_id: E["정두호"], p2_entry_id: E["이제빈"], applied_at: new Date().toISOString() }]; } },
    { re: /tbl:match_reports/, fn: (rows, u) => { if (!u.includes(EV)) return rows; const k = "double:w:r3:m1", a = E["김성빈"], b = E["이제빈"];
        return { none: [], one: [{ source_node_key: k, entry_id: a, winner_entry_id: a }], agree: [{ source_node_key: k, entry_id: a, winner_entry_id: a }, { source_node_key: k, entry_id: b, winner_entry_id: a }], differ: [{ source_node_key: k, entry_id: a, winner_entry_id: a }, { source_node_key: k, entry_id: b, winner_entry_id: b }] }[o.reports || "none"]; } },
  ];
  const requests = o.requests || [];
  const mocks = {
    streak_month_tops: [], admin_change_log: [], admin_client_errors: [], admin_community_reports: [], "fn:battle": {}, match_outcome_more_ready: true, bracket_rules_ready: true, handover_features_ready: true,
    my_checkin: o.checkin ?? null, report_match_result: o.report ?? null,
    "tbl:player_accounts": (b, u) => { const q = decodeURIComponent(u); return /select=auth_user_id&limit=1/.test(q) ? { __status: 403, body: { code: "42501", message: "permission denied" } }
      : /select=requested_name,status,player_id,email/.test(q) ? (o.visitor ? [{ requested_name: ME.name, status: "approved", player_id: ME.playerId, email: "tester@example.com" }] : []) : requests; },
  };
  const visitor = o.visitor ? { access: "fake-visitor", refresh: "fake-visitor-r", until: Date.now() + 3.6e6 } : null;
  return { patches, mocks, visitor, storage: o.visitor ? { "ypl-me": { name: ME.name, playerId: ME.playerId }, "ypl-accounts-ready": "1" } : null };
}
module.exports = { live, EV, NOTICE, E, ME, today };
