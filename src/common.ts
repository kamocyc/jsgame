
export function max(arr: number[]): number {
  let cur = Number.MIN_SAFE_INTEGER;
  for (const n of arr) {
    if (n > cur) cur = n;
  }
  return cur;
}

export function min(arr: number[]): number {
  let cur = Number.MAX_SAFE_INTEGER;
  for (const n of arr) {
    if (n < cur) cur = n;
  }
  return cur;
}

export function assert(b: boolean) {
  if (!b) throw new Error('assert');
}

export function deepEqual(x: any, y: any): boolean {
  const ok = Object.keys, tx = typeof x, ty = typeof y;
  return x && y && tx === 'object' && tx === ty ? (
    ok(x).length === ok(y).length &&
      ok(x).every(key => deepEqual(x[key], y[key]))
  ) : (x === y);
}

export function getStationIdMapKey(stationId: number, platformId: number): string {
  return stationId + '__' + platformId;
}