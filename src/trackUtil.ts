import { assert } from "./common.js";
import { HalfTrack, HalfTrackWip, Point, Station, Switch, generateId } from "./model.js";

export function getMidPoint(point1: Point, point2: Point): Point {
  return {
    x: (point1.x + point2.x) / 2,
    y: (point1.y + point2.y) / 2
  };
}

export function getDistance(pointA: Point, pointB: Point): number {
  return Math.sqrt(
    (pointA.x - pointB.x) * (pointA.x - pointB.x) +
    (pointA.y - pointB.y) * (pointA.y - pointB.y)
  );
}

export function getTrackDistance(point: Point, track: HalfTrack) {
  const a = (track._end.y - track._begin.y) / (track._end.x - track._begin.x);
  const b = track._begin.y - a * track._begin.x;
  return Math.abs(a * point.x - point.y + b) / Math.sqrt(a * a + 1);
}

export function getTrackDirection(track: HalfTrack) {
  const trackLength = getDistance(track._begin, track._end);
  const trackDirection = {
    x: (track._end.x - track._begin.x) / trackLength,
    y: (track._end.y - track._begin.y) / trackLength,
  };
  return trackDirection;
}

// pointと最も近いtrackを返す
export function getTrackByPoint(tracks: HalfTrack[], point: Point) {
  let minDistance = Number.MAX_VALUE;
  let minTrack = null;
  for (const track of tracks) {
    const distance = getTrackDistance(point, track);
    if (distance < minDistance) {
      minDistance = distance;
      minTrack = track;
    }
  }

  return minTrack;
}

export function isTrainOutTrack(position: Point, track: HalfTrack) {
  const trackMinX = Math.min(track._begin.x, track._end.x);
  const trackMaxX = Math.max(track._begin.x, track._end.x);
  const trackMinY = Math.min(track._begin.y, track._end.y);
  const trackMaxY = Math.max(track._begin.y, track._end.y);
  return (
    position.x < trackMinX ||
    position.x > trackMaxX ||
    position.y < trackMinY ||
    position.y > trackMaxY
  );
}

export function getRadian(track1: { _begin: Point, _end: Point }, track2: { _begin: Point, _end: Point }) {
  const r1 = Math.atan2(track1._end.y - track1._begin.y, track1._end.x - track1._begin.x);
  const r2 = Math.atan2(track2._end.y - track2._begin.y, track2._end.x - track2._begin.x);
  const diffR = r1 - r2;
  const diffR_ = (diffR + 2 * Math.PI) % (2 * Math.PI);
  return diffR_ - Math.PI;
}

export function getNearestTrackPoint(tracks: HalfTrack[], point: Point) {
  let minDistance = Number.MAX_VALUE;
  let minTrackPoint = null;
  for (const track of tracks) {
    const distanceBegin = getDistance(point, track._begin);
    if (distanceBegin < minDistance) {
      minDistance = distanceBegin;
      minTrackPoint = track._begin;
    }
  }

  return minTrackPoint as Point;
}

// 接続しているtrackは、必ずswitchを共有することで、switchにより、列車のtrack間の移動を実現する。
// prevTrack / nextTrackは、作るtrackの前後に移動できるtrackを指定する
// prevTrack / nextTrackがあるときは、そのtrackのswitchを使う必要があるので、自動でそのswitchを使う
// しかし、prevTrack / nextTrackが無くても既存のswitchを共有したい場合がある（同じ地点に合流する線路を作るなど）。そのときは引数でswitchを指定する。
export function createNewTrack(_begin: Point, _end: Point, nextTracks: HalfTrack[], prevTracks: HalfTrack[], station: Station | null, explicitNextSwitch?: Switch, explicitPrevSwitch?: Switch): [HalfTrack, HalfTrack, Switch[]] {
  const _nextSwitch = explicitNextSwitch ?? nextTracks.length === 0 ? undefined : nextTracks[0]._prevSwitch;
  const _prevSwitch = explicitPrevSwitch ?? prevTracks.length === 0 ? undefined : prevTracks[0]._nextSwitch;
  const newTrack = createBothTrack({
    _begin,
    _end,
    _nextSwitch: _nextSwitch,
    _prevSwitch: _prevSwitch,
    track: {
      station: station,
    }
  });
  
  const prevSwitch_ = newTrack[0]._prevSwitch;
  const nextSwitch_ = newTrack[0]._nextSwitch;

  // 整合性チェック
  prevTracks.forEach(track => assert(track._nextSwitch === prevSwitch_));
  nextTracks.forEach(track => assert(track._prevSwitch === nextSwitch_));

  prevSwitch_.switchPatterns.push(...prevTracks.map(track => [track, newTrack[0]] as [HalfTrack, HalfTrack]));
  nextSwitch_.switchPatterns.push(...nextTracks.map(track => [newTrack[0], track] as [HalfTrack, HalfTrack]));

  // reverse
  prevSwitch_.switchPatterns.push(...prevTracks.map(track => [newTrack[1], track.reverseTrack] as [HalfTrack, HalfTrack]));
  nextSwitch_.switchPatterns.push(...nextTracks.map(track => [track.reverseTrack, newTrack[1]] as [HalfTrack, HalfTrack]));

  // 整合性チェック
  prevSwitch_.switchPatterns.forEach(([track1, track2]) => assert(prevSwitch_.endTracks.filter(t => t === track1).length === 1 && prevSwitch_.beginTracks.filter(t => t === track2).length === 1));
  nextSwitch_.switchPatterns.forEach(([track1, track2]) => assert(nextSwitch_.endTracks.filter(t => t === track1).length === 1 && nextSwitch_.beginTracks.filter(t => t === track2).length === 1));

  return [newTrack[0], newTrack[1], newTrack[2]];
}

export function createBothTrack(trackBase: HalfTrackWip): [HalfTrack, HalfTrack, Switch[]] {
  const newSwitches: Switch[] = [];

  const reverseTrack = {
    trackId: generateId(),
    _begin: trackBase._end,
    _end: trackBase._begin,
    _nextSwitch: trackBase._prevSwitch,
    _prevSwitch: trackBase._nextSwitch,
    reverseTrack: trackBase as HalfTrack,
    track: trackBase.track,
  };
  trackBase.reverseTrack = reverseTrack as HalfTrack;
  trackBase.trackId = generateId();

  if (!trackBase._nextSwitch) {
    trackBase._nextSwitch = {
      switchId: generateId(),
      endTracks: [trackBase as HalfTrack],
      beginTracks: [reverseTrack as HalfTrack],
      switchPatterns: [],
      switchPatternIndex: null,
    };
    reverseTrack._prevSwitch = trackBase._nextSwitch;
    newSwitches.push(trackBase._nextSwitch);
  } else {
    trackBase._nextSwitch.endTracks.push(trackBase as HalfTrack);
    trackBase._nextSwitch.beginTracks.push(reverseTrack as HalfTrack);
  }

  if (!reverseTrack._nextSwitch) {
    reverseTrack._nextSwitch = {
      switchId: generateId(),
      endTracks: [reverseTrack as HalfTrack],
      beginTracks: [trackBase as HalfTrack],
      switchPatterns: [],
      switchPatternIndex: null,
    };
    trackBase._prevSwitch = reverseTrack._nextSwitch;
    newSwitches.push(reverseTrack._nextSwitch);
  } else {
    reverseTrack._nextSwitch.endTracks.push(reverseTrack as HalfTrack);
    reverseTrack._nextSwitch.beginTracks.push(trackBase as HalfTrack);
  }

  return [trackBase as HalfTrack, reverseTrack as HalfTrack, newSwitches];
}

export function getRandomElementOfArray<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function changeSwitch(nearestTrackPoint: Point) {
  // TODO
  // const nearestTracks = tracks
  //   .filter(track => deepEqual(track._begin, nearestTrackPoint));
  // const targetSwitch = nearestTracks[0]._prevSwitch;
  
  // if (targetSwitch.fromTracks.length === 1 && targetSwitch.toTracks.length === 1) return;

  // // とりあえず適当にランダムに選ぶ
  // while (true) {
  //   targetSwitch._branchedTrackFrom = getRandomElementOfArray(targetSwitch.fromTracks);
  //   targetSwitch._branchedTrackTo = getRandomElementOfArray(targetSwitch.toTracks);
    
  //   if (targetSwitch._branchedTrackFrom !== targetSwitch._branchedTrackTo.reverseTrack) break;
  // }
}