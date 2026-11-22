/* 게시판 신고 (docs/db/handover_features.sql, 2026-11-22, the owner's draft 10 A): a visitor's report and the reasons it may give.
   Kept apart from communityStore.js, whose only write is community_write (tests/community.test.mjs). */
import { supa } from "../storage.js";

export const REPORT_REASONS = [["abuse", "욕설과 비방"], ["ad", "광고"], ["privacy", "개인정보"], ["other", "그 밖의 이유"]];

export async function reportCommunityItem(id, reason) {
  const { error } = await supa.rpc("report_community_item", { p_item_id: id, p_reason: reason });
  if (error) throw new Error(error.message || "신고하지 못했습니다.");
}
