import { DefaultStationDistance, Platform, Station, generateId } from './model';

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

export function removeNull<T>(array: (T | null)[]): T[] {
  return array.filter((x) => x !== null) as T[];
}

export function assert(b: boolean, message?: string): asserts b {
  if (!b) throw new Error('assert' + (message ? ': ' + message : ''));
}

export function deepEqual(x: any, y: any): boolean {
  const ok = Object.keys,
    tx = typeof x,
    ty = typeof y;
  return x && y && tx === 'object' && tx === ty
    ? ok(x).length === ok(y).length && ok(x).every((key) => deepEqual(x[key], y[key]))
    : x === y;
}

export function getStationIdMapKey(stationId: string, platformId: string): string {
  return stationId + '__' + platformId;
}

export function moduloRoundDown(value: number, mod: number): number {
  if (value % mod !== 0) {
    return Math.floor(value / mod) * mod;
  } else {
    return value;
  }
}

export function createNewStationWithPlatform({
  platformId,
  platformName,
}: {
  platformId: string;
  platformName: string;
}): Platform {
  const newStation: Station = {
    stationId: generateId(),
    stationName: platformName,
    platforms: [],
    defaultInboundPlatformId: platformId,
    defaultOutboundPlatformId: platformId,
    distance: DefaultStationDistance,
  };

  const newPlatform = {
    platformId: platformId,
    platformName: platformName,
    station: newStation,
  };

  newStation.platforms.push(newPlatform);

  return newPlatform;
}

export function removeDuplicates<T>(array: T[], compare: (a: T, b: T) => boolean): T[] {
  const result: T[] = [];
  for (const a of array) {
    if (!result.some((b) => compare(a, b))) {
      result.push(a);
    }
  }
  return result;
}
