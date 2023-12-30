import { DeepReadonly } from 'ts-essentials';
import { StationLike } from './model';
import namesJson from './names.json';

export type StateUpdater<T> = React.Dispatch<React.SetStateAction<T>>;

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

// export function moduloRoundDown(value: number, mod: number): number {
//   if (value % mod !== 0) {
//     return Math.floor(value / mod) * mod;
//   } else {
//     return value;
//   }
// }

export function mapToObject<V>(map: DeepReadonly<Map<string, V>>) {
  return [...map.entries()].reduce((obj, [key, value]) => {
    // @ts-ignore
    obj[key] = value;
    return obj;
  }, {});
}

// export function createNewStationWithPlatform({
//   platformId,
//   platformName,
// }: {
//   platformId: string;
//   platformName: string;
// }): Platform {
//   const newStation: Station = {
//     stationType: 'Station',
//     stationId: generateId(),
//     stationName: platformName,
//     platforms: [],
//     defaultInboundPlatformId: platformId,
//     defaultOutboundPlatformId: platformId,
//     distance: DefaultStationDistance,
//   };

//   const newPlatform: Platform = {
//     platformType: 'Platform',
//     platformId: platformId,
//     platformName: platformName,
//     stationId: newStation.stationId,
//   };

//   newStation.platforms.push(newPlatform);

//   return newPlatform;
// }

export function removeDuplicates<T>(array: T[], compare: (a: T, b: T) => boolean): T[] {
  const result: T[] = [];
  for (const a of array) {
    if (!result.some((b) => compare(a, b))) {
      result.push(a);
    }
  }
  return result;
}

export function getNewName(existingNames: string[], stem: string): string {
  let i = 1;
  while (existingNames.includes(stem + ' ' + i.toString())) {
    i++;
  }
  return stem + ' ' + i.toString();
}

export function getRandomColor(): string {
  const rgb = hslToRgb(Math.random(), 1, 0.5);
  const color = '#' + rgb.map((x) => x.toString(16).padStart(2, '0')).join('');
  return color;
}

// https://stackoverflow.com/a/9493060
/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from https://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   {number}  h       The hue
 * @param   {number}  s       The saturation
 * @param   {number}  l       The lightness
 * @return  {Array}           The RGB representation
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, h + 1 / 3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function hueToRgb(p: number, q: number, t: number) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

export function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

export function fst<T>(arr: T[]): T {
  return arr[0];
}

export function lst<T>(arr: T[]): T {
  return arr[arr.length - 1] as T;
}

export function fst_<T>(arr: DeepReadonly<T[]>): DeepReadonly<T> {
  return arr[0];
}

export function lst_<T>(arr: DeepReadonly<T[]>): DeepReadonly<T> {
  return arr[arr.length - 1];
}

export function generatePlaceName(): string {
  const names = namesJson.names as string[];
  const name = getRandomElement(names);
  return name;
}

type NumberPair = [number, number];
export type FunctionDefinition = NumberPair[];

export function getInterpolatedFunctionValue(funcDefinition: FunctionDefinition, x: number): number {
  if (funcDefinition.length === 0) return 0;
  if (funcDefinition.length === 1) return funcDefinition[0][1];

  const xs: number[] = funcDefinition.map((p) => p[0]);
  const ys: number[] = funcDefinition.map((p) => p[1]);

  const i = xs.findIndex((x0) => x0 > x);
  if (i === -1) {
    return ys[ys.length - 1];
  } else if (i === 0) {
    return ys[0];
  } else {
    const x0 = xs[i - 1];
    const x1 = xs[i];
    const y0 = ys[i - 1];
    const y1 = ys[i];
    const t = (x - x0) / (x1 - x0);
    return y0 + (y1 - y0) * t;
  }
}

export class CountBag {
  private counts: Map<string, number> = new Map<string, number>();
  private readonly separator = '___';

  add(keys: string[]) {
    const key = keys.join(this.separator);
    if (!this.counts.has(key)) {
      this.counts.set(key, 0);
    }
    this.counts.set(key, this.counts.get(key)! + 1);
  }

  get(keys: string[]) {
    const key = keys.join(this.separator);
    return this.counts.get(key) ?? 0;
  }

  entries(): [string[], number][] {
    return [...this.counts.entries()].map(([key, count]) => [key.split(this.separator), count]);
  }
}

export function merge<T>(obj: T, partial: Partial<T>): T {
  return { ...obj, ...partial };
}

export function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

// showTime
export function toStringFromSeconds(timeSeconds: number, shouldDisplaySecond: boolean): string {
  const s = timeSeconds % 60;
  const m = Math.floor((timeSeconds / 60) % 60);
  return (
    '' +
    Math.floor(timeSeconds / 60 / 60) +
    (m < 10 ? '0' + m : '' + m) +
    (shouldDisplaySecond ? (s < 10 ? '0' + s : '' + s) : '')
  );
}

export function parseTimeHM(text: string): number | undefined {
  if (text === '') {
    return undefined;
  }
  if (text.length === 3) {
    text = '0' + text;
  }
  const hour = parseInt(text.substring(0, 2));
  const minute = parseInt(text.substring(2, 4));

  if (isNaN(hour) || isNaN(minute)) {
    return undefined;
  }
  // 1日の範囲害ならundefinedを返す
  if (hour >= 24 || minute >= 60 || hour < 0 || minute < 0) {
    return undefined;
  }

  return hour * 60 * 60 + minute * 60;
}

export function parseTimeHMS(text: string): number | undefined {
  if (text === '') {
    return undefined;
  }
  if (text.length < 6) {
    text = '0' + text;
  }
  const hour = parseInt(text.substring(0, 2));
  const minute = parseInt(text.substring(2, 4));
  const second = parseInt(text.substring(4, 6));

  if (isNaN(hour) || isNaN(minute) || isNaN(second)) {
    return undefined;
  }
  // 1日の範囲害ならundefinedを返す
  if (hour >= 24 || minute >= 60 || second >= 60 || hour < 0 || minute < 0 || second < 0) {
    return undefined;
  }

  return hour * 60 * 60 + minute * 60 + second;
}

export function parseTime(text: string, shouldDisplaySecond: boolean): number | undefined {
  text = text.replace(':', '');
  if (shouldDisplaySecond && text.length >= 5) {
    return parseTimeHMS(text);
  } else {
    return parseTimeHM(text);
  }
}

export function nn<T>(v: T | undefined | null): T {
  assert(v != null);
  return v;
}

export function upto(n: number): number[] {
  return [...Array(n).keys()].map((i) => i);
}

export function toMap<T>(arr: readonly T[], key: (v: T) => string | undefined): Map<string, T> {
  const map = new Map<string, T>();
  for (const v of arr) {
    const k = key(v);
    if (k !== undefined) {
      map.set(k, v);
    }
  }
  return map;
}

export const stationDbg = new Map<string, StationLike>();

export function* whileLoop<T>(initial: T, cond: (x: T) => boolean, next: (x: T) => T) {
  let x = initial;
  while (cond(x)) {
    yield x;
    x = next(x);
  }
}
