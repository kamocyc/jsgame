import { MinPriorityQueue } from '@datastructures-js/priority-queue';
import { assert, deepEqual } from './common.js';
import { Point, Switch, Track, TrackProperty, generateId } from './model.js';
import { Queue } from './queue.js';

interface TrackWip {
  trackId?: string;
  begin: Point;
  end: Point;
  nextSwitch?: Switch;
  prevSwitch?: Switch;
  reverseTrack?: Track;
  track: TrackProperty;
}

export function getMidPoint(point1: Point, point2: Point): Point {
  return {
    x: (point1.x + point2.x) / 2,
    y: (point1.y + point2.y) / 2,
  };
}

export function getDistance(pointA: Point, pointB: Point): number {
  return Math.sqrt((pointA.x - pointB.x) * (pointA.x - pointB.x) + (pointA.y - pointB.y) * (pointA.y - pointB.y));
}

export function getTrackDistance(point: Point, track: Track) {
  const a = (track.end.y - track.begin.y) / (track.end.x - track.begin.x);
  const b = track.begin.y - a * track.begin.x;
  return Math.abs(a * point.x - point.y + b) / Math.sqrt(a * a + 1);
}

// x^2 + y^2 = 1 となるようなtrackの方向を表すベクトルを返す
export function getTrackDirection(track: Track) {
  const trackLength = getDistance(track.begin, track.end);
  const trackDirection = {
    x: (track.end.x - track.begin.x) / trackLength,
    y: (track.end.y - track.begin.y) / trackLength,
  };
  return trackDirection;
}

// pointと最も近いtrackを返す
export function getTrackByPoint(tracks: Track[], point: Point) {
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

export function isTrainOutTrack(position: Point, track: Track) {
  const trackMinX = Math.min(track.begin.x, track.end.x);
  const trackMaxX = Math.max(track.begin.x, track.end.x);
  const trackMinY = Math.min(track.begin.y, track.end.y);
  const trackMaxY = Math.max(track.begin.y, track.end.y);
  return position.x < trackMinX || position.x > trackMaxX || position.y < trackMinY || position.y > trackMaxY;
}

// 返す値の範囲: [Math.PI, Math.PI)
export function getRadian(track1: { begin: Point; end: Point }, track2: { begin: Point; end: Point }) {
  const r1 = Math.atan2(track1.end.y - track1.begin.y, track1.end.x - track1.begin.x);
  const r2 = Math.atan2(track2.end.y - track2.begin.y, track2.end.x - track2.begin.x);
  const diffR = r1 - r2;
  const diffR_ = (diffR + 2 * Math.PI) % (2 * Math.PI);
  return diffR_ - Math.PI;
}

export function getNearestTrackPoint(tracks: Track[], point: Point) {
  let minDistance = Number.MAX_VALUE;
  let minTrackPoint = null;
  for (const track of tracks) {
    const distanceBegin = getDistance(point, track.begin);
    if (distanceBegin < minDistance) {
      minDistance = distanceBegin;
      minTrackPoint = track.begin;
    }
  }

  return minTrackPoint as Point;
}

// 接続しているtrackは、必ずswitchを共有することで、switchにより、列車のtrack間の移動を実現する。
// prevTrack / nextTrackは、作るtrackの前後に移動できるtrackを指定する
// prevTrack / nextTrackがあるときは、そのtrackのswitchを使う必要があるので、自動でそのswitchを使う
// しかし、prevTrack / nextTrackが無くても既存のswitchを共有したい場合がある（同じ地点に合流する線路を作るなど）。そのときは引数でswitchを指定する。
export function createNewTrack(
  _begin: Point,
  _end: Point,
  nextTracks: Track[],
  prevTracks: Track[],
  explicitNextSwitch?: Switch,
  explicitPrevSwitch?: Switch
): [Track, Track, Switch[]] {
  assert(nextTracks.every((t) => deepEqual(_end, t.begin)));
  assert(prevTracks.every((t) => deepEqual(_begin, t.end)));

  const _nextSwitch = explicitNextSwitch ?? (nextTracks.length === 0 ? undefined : nextTracks[0].prevSwitch);
  const _prevSwitch = explicitPrevSwitch ?? (prevTracks.length === 0 ? undefined : prevTracks[0].nextSwitch);
  const newTrack = createBothTrack({
    trackId: undefined,
    begin: _begin,
    end: _end,
    nextSwitch: _nextSwitch,
    prevSwitch: _prevSwitch,
    track: {
      platform: null,
      depotLine: null,
    },
  });

  const prevSwitch_ = newTrack[0].prevSwitch;
  const nextSwitch_ = newTrack[0].nextSwitch;

  // 整合性チェック
  prevTracks.forEach((track) => assert(track.nextSwitch === prevSwitch_));
  nextTracks.forEach((track) => assert(track.prevSwitch === nextSwitch_));
  assert(newTrack[0].reverseTrack === newTrack[1]);
  assert(newTrack[1].reverseTrack === newTrack[0]);

  prevSwitch_.switchPatterns.push(...prevTracks.map((track) => [track, newTrack[0]] as [Track, Track]));
  nextSwitch_.switchPatterns.push(...nextTracks.map((track) => [newTrack[0], track] as [Track, Track]));

  // reverse
  prevSwitch_.switchPatterns.push(...prevTracks.map((track) => [newTrack[1], track.reverseTrack] as [Track, Track]));
  nextSwitch_.switchPatterns.push(...nextTracks.map((track) => [track.reverseTrack, newTrack[1]] as [Track, Track]));

  // 整合性チェック
  prevSwitch_.switchPatterns.forEach(([track1, track2]) =>
    assert(
      prevSwitch_.endTracks.filter((t) => t === track1).length === 1 &&
        prevSwitch_.beginTracks.filter((t) => t === track2).length === 1
    )
  );
  nextSwitch_.switchPatterns.forEach(([track1, track2]) =>
    assert(
      nextSwitch_.endTracks.filter((t) => t === track1).length === 1 &&
        nextSwitch_.beginTracks.filter((t) => t === track2).length === 1
    )
  );

  return [newTrack[0], newTrack[1], newTrack[2]];
}

export function validateSwitch(Switch: Switch) {
  Switch.switchPatterns.forEach(([track1, track2]) =>
    assert(
      Switch.endTracks.filter((t) => t.trackId === track1.trackId).length === 1 &&
        Switch.beginTracks.filter((t) => t.trackId === track2.trackId).length === 1
    )
  );

  assert(
    Switch.straightPatternIndex === null ||
      (Switch.straightPatternIndex[0] >= 0 &&
        Switch.straightPatternIndex[0] < Switch.switchPatterns.length &&
        Switch.straightPatternIndex[1] >= 0 &&
        Switch.straightPatternIndex[1] < Switch.switchPatterns.length)
  );
}

export function createBothTrack(trackBase: TrackWip): [Track, Track, Switch[]] {
  const newSwitches: Switch[] = [];

  const reverseTrack = {
    trackId: generateId(),
    begin: trackBase.end,
    end: trackBase.begin,
    nextSwitch: trackBase.prevSwitch,
    prevSwitch: trackBase.nextSwitch,
    reverseTrack: trackBase as Track,
    track: trackBase.track,
  };
  trackBase.reverseTrack = reverseTrack as Track;
  trackBase.trackId = generateId();

  if (!trackBase.nextSwitch) {
    trackBase.nextSwitch = {
      switchId: generateId(),
      endTracks: [trackBase as Track],
      beginTracks: [reverseTrack as Track],
      switchPatterns: [],
      switchPatternIndex: null,
      straightPatternIndex: null,
    };
    reverseTrack.prevSwitch = trackBase.nextSwitch;
    newSwitches.push(trackBase.nextSwitch);
  } else {
    trackBase.nextSwitch.endTracks.push(trackBase as Track);
    trackBase.nextSwitch.beginTracks.push(reverseTrack as Track);
  }

  if (!reverseTrack.nextSwitch) {
    reverseTrack.nextSwitch = {
      switchId: generateId(),
      endTracks: [reverseTrack as Track],
      beginTracks: [trackBase as Track],
      switchPatterns: [],
      switchPatternIndex: null,
      straightPatternIndex: null,
    };
    trackBase.prevSwitch = reverseTrack.nextSwitch;
    newSwitches.push(reverseTrack.nextSwitch);
  } else {
    reverseTrack.nextSwitch.endTracks.push(reverseTrack as Track);
    reverseTrack.nextSwitch.beginTracks.push(trackBase as Track);
  }

  return [trackBase as Track, reverseTrack as Track, newSwitches];
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

interface NodeWithDistance<T> {
  node: T;
  previousNode: NodeWithDistance<T> | undefined;
  distance: number;
}

// ダイクストラ法で各点の最短距離を求める。ついでにgoalまでの最短経路を返す
export function abstractSearch<T>(
  startNode: T,
  idGetter: (node: T) => string,
  nextNodeGetter: (node: T) => T[],
  distanceGetter: (node1: T, node2: T) => number,
  goalDeterminer: (node: T) => boolean
): [T[] | undefined, Map<string, NodeWithDistance<T>>] {
  function reconstructPath<T>(nodeWithDistance: NodeWithDistance<T>): T[] {
    const prev = nodeWithDistance.previousNode;
    if (prev) {
      const path = reconstructPath(prev);
      path.push(nodeWithDistance.node);
      return path;
    } else {
      return [nodeWithDistance.node];
    }
  }

  const queue = new MinPriorityQueue((a: NodeWithDistance<T>) => a.distance);
  queue.push({ node: startNode, previousNode: undefined, distance: 0 });

  // 決定済みのノード
  const determined = new Map<string, NodeWithDistance<T>>();

  while (!queue.isEmpty()) {
    const nodeWithDistance = queue.dequeue();
    const { node } = nodeWithDistance;
    if (determined.has(idGetter(node))) continue; // 既に最短経路で決定済み

    determined.set(idGetter(node), nodeWithDistance);

    if (goalDeterminer(node)) {
      const path = reconstructPath(nodeWithDistance);
      return [path, determined];
    }

    const nextNodes = nextNodeGetter(node);
    for (const nextNode of nextNodes) {
      if (!determined.has(idGetter(nextNode))) {
        const newDistance = nodeWithDistance.distance + distanceGetter(node, nextNode);
        // 1つの頂点につき距離の更新ごとにqueueにpushされる。最短のエントリがpopされるので動くが、効率は？
        queue.push({ node: nextNode, previousNode: nodeWithDistance, distance: newDistance });
      }
    }
  }

  return [undefined, determined];
}

export function getNextTracks(track: Track): Track[] {
  return track.nextSwitch.switchPatterns.filter(([t, _]) => t.trackId === track.trackId).map(([_, t]) => t);
}

export function searchTrack(startTrack: Track, stationId: string, bannedTrack?: Track): Track[] | undefined {
  return abstractSearch(
    startTrack,
    (track) => track.trackId,
    (track) => getNextTracks(track).filter((t) => !bannedTrack || t.trackId !== bannedTrack.trackId),
    (_, track) => getDistance(track.begin, track.end),
    (track) => track.track.platform?.platformId === stationId
  )[0]?.slice(1);
}

// 次の停車駅まで別の経路でも行けて（所要時間が大きく変わらないなら）別の経路で行くなど
export function getOccupyingTracks(track: Track): Track[] {
  function getOccupyingTracksSub(track: Track) {
    // 推移的に分岐（あるいは信号モードのときは信号）にぶつかるまで隣接するtrackを含める。
    // ただし、信号があって分岐があるときは、列車の進路が決まらないとわからない。

    // 単にポイント基準だと側線があるとそこまでで閉塞が切れてしまうので、やはり信号機が必要か
    const queue = new Queue<Track>();
    queue.enqueue(track);

    let stationEncountered = false;

    const occupying = [];
    while (!queue.isEmpty()) {
      const track = queue.dequeue();

      // 駅を2回見たときは、その直前までにする
      if (track.track.platform) {
        if (!stationEncountered) {
          stationEncountered = true;
        } else {
          break;
        }
      }

      occupying.push(track);

      if (track.nextSwitch.switchPatterns.length === 2) {
        const nextTracks = getNextTracks(track);
        assert(nextTracks.length === 1);
        queue.enqueue(nextTracks[0]);
      }
    }

    return occupying;
  }

  const forwardTracks = getOccupyingTracksSub(track);
  const backwardTracks = getOccupyingTracksSub(track.reverseTrack);
  return forwardTracks.concat(backwardTracks);
}

function isInLine(lineStart: Point, lineEnd: Point, targetPoint: Point): boolean {
  // targetPointから線分に下した垂線との交点が、線分の始点と終点の間にあるかどうかを判定する
  const a = lineStart.y - lineEnd.y;
  const b = lineEnd.x - lineStart.x;
  const c = lineStart.x * lineEnd.y - lineEnd.x * lineStart.y;

  const k = (a * targetPoint.x + b * targetPoint.y + c) / (a * a + b * b);
  const intersectionPoint = { x: targetPoint.x - a * k, y: targetPoint.y - b * k };

  const minX = Math.min(lineStart.x, lineEnd.x);
  const maxX = Math.max(lineStart.x, lineEnd.x);
  const minY = Math.min(lineStart.y, lineEnd.y);
  const maxY = Math.max(lineStart.y, lineEnd.y);

  return (
    minX <= intersectionPoint.x &&
    intersectionPoint.x <= maxX &&
    minY <= intersectionPoint.y &&
    intersectionPoint.y <= maxY
  );
}

function getLineDistance(lineStart: Point, lineEnd: Point, targetPoint: Point): number {
  const a = lineStart.y - lineEnd.y;
  const b = lineEnd.x - lineStart.x;
  const c = lineStart.x * lineEnd.y - lineEnd.x * lineStart.y;

  const distance = Math.abs(a * targetPoint.x + b * targetPoint.y + c) / Math.sqrt(a * a + b * b);
  return distance;
}

// 点と線分の交差判定
export function isHitLine(point: Point, points: number[], mapTotalHeight: number, hitStrokeWidth: number): boolean {
  point = { ...point };
  point.y = mapTotalHeight - point.y;
  let hitFlag = false;
  for (let i = 0; i <= points.length - 4; i += 2) {
    const lineStart = { x: points[i], y: points[i + 1] };
    const lineEnd = { x: points[i + 2], y: points[i + 3] };
    if (isInLine(lineStart, lineEnd, point)) {
      const distance = getLineDistance(lineStart, lineEnd, point);
      if (distance < hitStrokeWidth / 2) {
        hitFlag = true;
        break;
      }
    }
  }
  return hitFlag;
}

function getNextTrackOfSwitchPattern(
  Switch: Switch,
  currentTrack: Track,
  switchPatternIndex: [number, number]
): Track | null {
  const [index1, index2] = switchPatternIndex;
  if (Switch.switchPatterns[index1][0] === currentTrack) {
    return Switch.switchPatterns[index1][1];
  } else if (Switch.switchPatterns[index2][0].trackId === currentTrack.trackId) {
    return Switch.switchPatterns[index2][1];
  } else {
    // 定位の方向ではないtrackからswitchに侵入している
    return null;
  }
}

// 定位のtrackを返す
export function getNextTrackOfStraightPattern(currentSwitch: Switch, track: Track): Track | null {
  assert(currentSwitch.straightPatternIndex !== null);
  return getNextTrackOfSwitchPattern(currentSwitch, track, currentSwitch.straightPatternIndex);
}

// 反位のtrackを返す
export function getNextTrackOfBranchPattern(Switch: Switch, currentTrack: Track): Track | null {
  assert(Switch.straightPatternIndex !== null);
  const [straightPatternIndex1, straightPatternIndex2] = Switch.straightPatternIndex;
  const candidatePatterns = Switch.switchPatterns
    .filter(
      // straightPatternIndexの2つ以外
      (_, i) => i !== straightPatternIndex1 && i !== straightPatternIndex2
    )
    .filter(
      ([t, _]) =>
        // 分岐の始点がcurrentTrackと一致するもの
        t.trackId === currentTrack.trackId
    );

  if (candidatePatterns.length === 0) {
    return null;
  }

  if (candidatePatterns.length !== 1) {
    // 一般のレイアウトだと2つ以上分岐がありうるが、とりあえず1つのみの制約とする
    throw new Error('candidatePatterns.length !== 1');
  }

  return candidatePatterns[0][1];
}
