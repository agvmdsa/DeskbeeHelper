// version.js — semantic version helpers (pure; unit tested).

const parse = (v) => {
  const m = String(v ?? "").trim().replace(/^v/i, "").match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  return m ? [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)] : null;
};

/** -1 if a < b, 0 if equal, 1 if a > b. Invalid versions compare as equal. */
export function compareVersions(a, b) {
  const pa = parse(a), pb = parse(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1;
  }
  return 0;
}

/** True only when `candidate` is a valid version strictly newer than `current`. */
export const isNewer = (candidate, current) =>
  parse(candidate) !== null && compareVersions(candidate, current) > 0;
