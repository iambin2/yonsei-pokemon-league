/* 몬스터볼이 한 바퀴 구르는 24프레임의 픽셀 (stageFx.js throwBall). 정해진 값이라 작업 스레드(paint.worker.js)가 그려 보내고, 그럴 수
   없으면 페이지가 걸음으로 그린다. 페이지에도 작업 스레드에도 실리므로 DOM에 기대지 않는다. */
export const FRAMES = 24, BALL_PX = 160;
export function* ballFrames() {
  const out = [], R = BALL_PX / 2 - 3, C = BALL_PX / 2;
  const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
  const L = norm([-.55, .62, .56]), Hv = norm([L[0], L[1], L[2] + 1]), axis = norm([1, .28, .22]);
  const RED = [222, 38, 52], WHITE = [240, 243, 248], BAND = [26, 30, 42], RING = [34, 39, 56], BUTTON = [246, 247, 250];
  for (let f = 0; f < FRAMES; f++) {
    const th = -f / FRAMES * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th), [ax, ay, az] = axis;
    // the ball's own frame: a point on the screen's sphere turned back by the spin (Rodrigues)
    const local = ([x, y, z]) => { const d = ax * x + ay * y + az * z, cx = ay * z - az * y, cy = az * x - ax * z, cz = ax * y - ay * x;
      return [x * cs + cx * sn + ax * d * (1 - cs), y * cs + cy * sn + ay * d * (1 - cs), z * cs + cz * sn + az * d * (1 - cs)]; };
    const px = new Uint8ClampedArray(BALL_PX * BALL_PX * 4);
    for (let j = 0; j < BALL_PX; j++) for (let i = 0; i < BALL_PX; i++) {
      // a step every 5 rows: a whole frame was a step of up to 60 ms at a phone's speed, and 20 rows still 35 to 48 (2026-11-18)
      if (i === 0 && j && j % 5 === 0) yield;
      const nx = (i + .5 - C) / R, ny = -(j + .5 - C) / R, d2 = nx * nx + ny * ny, edge = (1 - Math.sqrt(d2)) * R + .5;
      if (edge <= 0) continue;
      const nz = Math.sqrt(Math.max(0, 1 - d2)), n = [nx, ny, nz], q = local(n);
      const fromFront = Math.acos(Math.max(-1, Math.min(1, q[2])));
      let col, shine = .55;
      if (fromFront < .17) { col = BUTTON; }
      else if (fromFront < .27) { col = RING; shine = .3; }
      else if (fromFront < .31 || Math.abs(q[1]) < .07) { col = BAND; shine = .3; }
      else col = q[1] > 0 ? RED : WHITE;
      const diff = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
      const spec = Math.pow(Math.max(0, n[0] * Hv[0] + n[1] * Hv[1] + n[2] * Hv[2]), 60) * shine;
      const rim = Math.pow(1 - nz, 3) * .22, k = .34 + .74 * diff, a = Math.min(1, edge) * 255, o = (j * BALL_PX + i) * 4;
      px[o] = Math.min(255, col[0] * k + 255 * spec + 90 * rim); px[o + 1] = Math.min(255, col[1] * k + 255 * spec + 130 * rim); px[o + 2] = Math.min(255, col[2] * k + 255 * spec + 230 * rim); px[o + 3] = a;
    }
    out.push(px);
    yield;
  }
  return out;
}
