/* 방문자 화면의 오류를 운영진에게 (docs/db/handover_features.sql, 2026-11-22): 처리되지 않은 오류, 거절된 약속, 화면을 멈춘 오류를
   report_client_error 로 보낸다. 배포된 사이트(window.__YPL_BUILD__)에서만, 한 페이지에 다섯 번까지, 같은 글은 한 번.
   그 SQL 전에는 함수가 없어 첫 보고가 실패하고, 그 뒤로는 보내지 않는다. 보내기가 실패해도 화면은 아무것도 하지 않는다. */
import { supa } from "../storage.js";

const sent = new Set();
let left = 5;
let off = false;

export function reportError(error, where = "") {
  if (off || !supa || !window.__YPL_BUILD__ || left <= 0) return;
  const message = String(error?.message || error || "").trim();
  // a stale chunk after a deploy reloads itself (LazyContent); a request cut off by leaving the page is not a fault
  if (!message || sent.has(message) || /Failed to fetch dynamically imported module|AbortError|signal is aborted/i.test(message)) return;
  sent.add(message);
  left -= 1;
  supa.rpc("report_client_error", {
    p_message: where ? `${message}\n${where}` : message,
    p_stack: String(error?.stack || "").slice(0, 4000) || null,
    p_url: location.pathname + location.search,
    p_build: String(window.__YPL_BUILD__),
    p_agent: navigator.userAgent,
  }).then(({ error: failed }) => { if (failed) off = true; }, () => { off = true; });
}

export function watchErrors() {
  window.addEventListener("error", e => reportError(e.error || e.message));
  window.addEventListener("unhandledrejection", e => reportError(e.reason));
}
