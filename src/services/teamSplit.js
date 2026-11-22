/* 팀 나누기 (2026-11-22, the owner's draft 5 A): a team event's applicants split into n teams as evenly as their ranking points allow.
   Strongest first, dealt in a snake (1, 2, ..., n, n, ..., 2, 1) so no team takes every first pick; equal points fall in a random order,
   so 다시 나누기 gives another even split. Returns [{ members: [name], points }]. */
export function splitTeams(names, pointsOf, n, random = Math.random) {
  const count = Math.max(1, Math.min(n, names.length || 1));
  const keyed = [...new Set(names.map(x => String(x || "").trim()).filter(Boolean))].map(name => ({ name, points: Number(pointsOf(name)) || 0, r: random() }));
  keyed.sort((a, b) => b.points - a.points || a.r - b.r);
  const teams = Array.from({ length: count }, () => ({ members: [], points: 0 }));
  keyed.forEach((p, i) => {
    const lap = Math.floor(i / count), at = i % count, t = teams[lap % 2 ? count - 1 - at : at];
    t.members.push(p.name); t.points += p.points;
  });
  return teams;
}
