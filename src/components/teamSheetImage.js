import { WORDMARK_PATH } from "./layout/SiteHeader.jsx";
import { formatDate } from "../services/dateFormat.js";

/* 팀 시트 한 장을 PNG로 그린다(쇼다운 팀 이미지와 같은 쓰임). 사이트와 같은 토큰, 같은 글꼴과 워드마크,
   지금 보고 있는 테마 그대로, 리그 연감의 꼴로: 판 없이 바탕 위에, 포켓몬마다 굵은 줄 하나로 열고 항목은 가는 줄로 나눈다.
   타입 색은 사이트처럼 네모 하나로만 쓴다(타입 색은 내용). 스프라이트는 같은 출처라 캔버스가 오염되지 않는다. */
const FONT = '"Albert Sans", "Freesentation", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const FIG = '"Albert Sans", sans-serif';
/* 색은 값을 따로 들고 있지 않고 지금 테마의 토큰을 읽는다: 이미지가 사이트와 어긋날 수 없다 */
const palette = () => {
  const css = getComputedStyle(document.documentElement), v = name => css.getPropertyValue(name).trim();
  return { bg: v("--ground"), fg: v("--lit"), fg2: v("--dim"), fg3: v("--mute"), bar: v("--rule"), barOn: v("--lit"), line: v("--rule") };
};
// team-builder.css 의 타입 점 색과 같은 값
const TYPE_DOT = { normal: "#9FA19F", fire: "#E62829", water: "#2980EF", electric: "#FAC000", grass: "#3FA129", ice: "#3FD8FF", fighting: "#FF8000", poison: "#9141CB", ground: "#915121", flying: "#81B9EF", psychic: "#EF4179", bug: "#91A119", rock: "#AFA981", ghost: "#704170", dragon: "#5060E1", dark: "#624D4E", steel: "#60A1B8", fairy: "#EF70EF" };

const PAD = 52, GAP = 2, CARD_W = 576, CARD_H = 576, CARD_PAD = 32, HEAD_H = 136, FOOT_H = 84;

/* a rule: the 2px lit one opens a block, the 1px hairline parts its entries */
function rule(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
function clip(ctx, text, max) {
  const t = String(text || "");
  if (ctx.measureText(t).width <= max) return t;
  let s = t; while (s.length > 1 && ctx.measureText(s + "…").width > max) s = s.slice(0, -1);
  return s + "…";
}
function wordmark(ctx, x, y, h, color) {
  const k = h / 100;
  ctx.save(); ctx.translate(x, y - h); ctx.scale(k, k);
  ctx.transform(1, 0, Math.tan(-12 * Math.PI / 180), 1, 0, 0); ctx.translate(21, 0);
  ctx.fillStyle = color; ctx.fill(new Path2D(WORDMARK_PATH), "evenodd");
  ctx.restore();
  return 310 * k;
}
function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img); img.onerror = () => resolve(null);
    img.src = src;
  });
}
async function fontsReady() {
  try { await Promise.all(["700 32px", "600 16px", "400 16px"].map(f => document.fonts.load(`${f} "Freesentation"`, "가").then(() => document.fonts.load(`${f} "Albert Sans"`)))); await document.fonts.ready; } catch { /* system font */ }
}
/* a type's mark: an 8 square in its colour, centred on the 12 line it stands in (the page's type tag, DESIGN.md) */
function tick(ctx, x, y, color) {
  ctx.fillStyle = color; ctx.fillRect(Math.round(x + 2), Math.round(y + 2), 8, 8);
}
function typePill(ctx, c, x, y, type) {
  ctx.font = `700 13px ${FONT}`;
  const w = ctx.measureText(type.label).width + 26;
  tick(ctx, x - 2, y + 6, TYPE_DOT[type.id] || c.fg3);
  ctx.fillStyle = c.fg; ctx.textBaseline = "middle"; ctx.fillText(type.label, x + 14, y + 12.5); ctx.textBaseline = "alphabetic";
  return w;
}

function drawCard(ctx, c, x, y, row, sprite) {
  const ix = x + CARD_PAD, iw = CARD_W - CARD_PAD * 2;
  // 머리: 굵은 줄로 열고, 줄 위에 선 스프라이트, 이름, 영문 이름과 도감 번호, 타입
  rule(ctx, ix, y + CARD_PAD, iw, 2, c.fg);
  const top = y + CARD_PAD + 2;
  if (sprite) { const s = Math.min(96 / sprite.width, 96 / sprite.height); const w = sprite.width * s, h = sprite.height * s; ctx.drawImage(sprite, ix + 52 - w / 2, top + 102 - h, w, h); }
  rule(ctx, ix, top + 102, 104, 1, c.line);
  const tx = ix + 104 + 16, tw = iw - 120;
  ctx.textAlign = "left"; ctx.fillStyle = c.fg; ctx.font = `700 20px ${FONT}`;
  ctx.fillText(clip(ctx, row.name, tw), tx, top + 30);
  ctx.fillStyle = c.fg3; ctx.font = `400 13px ${FONT}`;
  const sub = [row.english !== row.name ? row.english : "", row.num != null ? `No. ${String(row.num).padStart(4, "0")}` : ""].filter(Boolean).join("   ");
  ctx.fillText(clip(ctx, sub, tw), tx, top + 52);
  let px = tx + 2; for (const type of row.types) px += typePill(ctx, c, px, top + 66, type) + 12;

  // 특성, 도구, 성격: 항목마다 가는 줄 아래
  let cy = top + 102 + 30;
  for (const [label, value] of [["특성", row.ability || "없음"], ["도구", row.item || "없음"], ["성격", row.nature ? `${row.nature}, ${row.natureEffect}` : "없음"]]) {
    ctx.fillStyle = c.fg3; ctx.font = `400 13px ${FONT}`; ctx.fillText(label, ix, cy);
    ctx.fillStyle = c.fg; ctx.font = `700 16px ${FONT}`; ctx.fillText(clip(ctx, value, iw - 56), ix + 56, cy);
    rule(ctx, ix, cy + 9, iw, 1, c.line);
    cy += 26;
  }

  // 능력치: the points' label and total over the table, then each row its name, 종족값 and the base, the points on their bar, the
  // stat itself in Albert Sans (DESIGN.md "Composing a screen" 25: no header row of column names)
  cy += 14;
  ctx.fillStyle = c.fg3; ctx.font = `400 13px ${FONT}`; ctx.fillText("능력 포인트", ix, cy);
  ctx.textAlign = "right"; ctx.fillStyle = c.fg; ctx.font = `700 13px ${FONT}`; ctx.fillText(`${row.spTotal} / 66`, ix + iw, cy); ctx.textAlign = "left";
  cy += 10;
  const barX = ix + 148, barW = iw - 148 - 92;
  for (const stat of row.stats) {
    cy += 26;
    ctx.fillStyle = c.fg; ctx.font = `700 16px ${FONT}`;
    ctx.fillText(stat.label + (stat.mark === "+" ? " ↑" : stat.mark === "-" ? " ↓" : ""), ix, cy);
    if (stat.base != null) {
      ctx.fillStyle = c.fg3; ctx.font = `400 13px ${FONT}`; ctx.fillText("종족값", ix + 64, cy);
      const lw = ctx.measureText("종족값 ").width;
      ctx.fillStyle = c.fg2; ctx.font = `400 16px ${FIG}`; ctx.fillText(String(stat.base), ix + 64 + lw, cy);
    }
    rule(ctx, barX, cy - 7, barW, 2, c.bar);
    if (stat.sp) rule(ctx, barX, cy - 7, Math.max(2, barW * stat.sp / 32), 2, c.barOn);
    ctx.fillStyle = stat.sp ? c.fg : c.fg3; ctx.font = `${stat.sp ? 700 : 400} 13px ${FIG}`; ctx.fillText(String(stat.sp), barX + barW + 12, cy);
    ctx.textAlign = "right"; ctx.fillStyle = c.fg; ctx.font = `400 20px ${FIG}`; ctx.fillText(String(stat.final), ix + iw, cy + 1); ctx.textAlign = "left";
  }

  // 기술 넷: 두 줄 두 칸, 칸마다 가는 줄 위에
  cy += 24;
  const mw = (iw - 20) / 2;
  for (let i = 0; i < 4; i += 1) {
    const move = row.moves[i];
    const mx = ix + (i % 2) * (mw + 20), my = cy + Math.floor(i / 2) * 52;
    rule(ctx, mx, my + 43, mw, 1, c.line);
    if (!move) { ctx.fillStyle = c.fg3; ctx.font = `400 13px ${FONT}`; ctx.fillText("기술 없음", mx, my + 27); continue; }
    tick(ctx, mx - 2, my + 16, TYPE_DOT[move.type?.id] || c.fg3);
    const cat = [move.type?.label, move.category].filter(Boolean).join(" ");
    ctx.font = `400 13px ${FONT}`; const cw = ctx.measureText(cat).width;
    ctx.fillStyle = c.fg3; ctx.textAlign = "right"; ctx.fillText(cat, mx + mw, my + 27); ctx.textAlign = "left";
    ctx.fillStyle = c.fg; ctx.font = `700 16px ${FONT}`; ctx.fillText(clip(ctx, move.name, mw - 30 - cw), mx + 16, my + 27);
  }
}

export async function renderTeamSheetCanvas(sheet, { title = "", meta = "", author = "", date = new Date() } = {}) {
  await fontsReady();
  const c = palette();
  const cols = sheet.length > 1 ? 2 : 1, rows = Math.max(1, Math.ceil(sheet.length / cols));
  const W = PAD * 2 + cols * CARD_W + (cols - 1) * GAP;
  const H = HEAD_H + rows * CARD_H + (rows - 1) * GAP + FOOT_H + PAD;
  const S = 2, cv = document.createElement("canvas");
  cv.width = W * S; cv.height = H * S;
  const ctx = cv.getContext("2d"); ctx.scale(S, S);
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H);

  // the head and the foot stand on the cards' inner edge, so every line of the sheet starts on one left
  const L = PAD + CARD_PAD;
  ctx.textAlign = "left"; ctx.fillStyle = c.fg; ctx.font = `700 32px ${FONT}`;
  ctx.fillText(clip(ctx, title || "이름 없는 팀", W - L * 2), L, PAD + 32);
  ctx.fillStyle = c.fg3; ctx.font = `400 16px ${FONT}`;
  ctx.fillText(clip(ctx, meta, W - L * 2), L, PAD + 62);
  rule(ctx, L, H - FOOT_H - PAD + 28, W - L * 2, 1, c.line);

  const sprites = await Promise.all(sheet.map(row => loadImage(row.sprite)));
  sheet.forEach((row, i) => drawCard(ctx, c, PAD + (i % cols) * (CARD_W + GAP), HEAD_H + Math.floor(i / cols) * (CARD_H + GAP), row, sprites[i]));

  const fy = H - PAD + 4;
  const wm = wordmark(ctx, L, fy, 14, c.fg);
  ctx.fillStyle = c.fg3; ctx.font = `400 13px ${FONT}`;
  ctx.fillText([author ? `${author} 작성` : "", formatDate(date.toISOString())].filter(Boolean).join(", "), L + wm + 12, fy - 1);
  ctx.textAlign = "right"; ctx.font = `700 13px ${FONT}`; ctx.fillText("YPL 팀 빌더", W - L, fy - 1); ctx.textAlign = "left";
  return cv;
}

/* 폰은 공유 시트(사진에 저장)를 먼저, 데스크톱과 공유가 안 되는 브라우저는 파일 다운로드 */
export async function saveTeamSheetImage(sheet, options = {}) {
  if (!sheet.length) throw new Error("포켓몬을 1마리 이상 추가해 주세요.");
  const canvas = await renderTeamSheetCanvas(sheet, options);
  const blob = await new Promise(done => canvas.toBlob(done, "image/png"));
  if (!blob) throw new Error("잠시 뒤 다시 시도해 주세요.");
  const filename = `${String(options.title || "YPL 팀").replace(/[\\/:*?"<>|]+/g, " ").trim()}.png`;
  const file = typeof File === "function" ? new File([blob], filename, { type: "image/png" }) : null;
  if (file && matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: options.title || "YPL 팀" }); return "shared"; }
    catch (error) { if (error?.name === "AbortError") return "cancelled"; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return "downloaded";
}
