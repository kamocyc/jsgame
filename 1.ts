interface DiaOperatingTrain extends DiaTrain {
  operatingTrain: Train
}

const switches: Switch[] = [];
const stations: Station[] = [];
const tracks: HalfTrack[] = [];
const trains: Train[] = [];
const operatingTrains: OperationTrain[] = [];
const timetable: DiaOperatingTrain[] = []

let globalTime = 0;

const maxStationWaitTime = Number.MAX_VALUE;

let currentMousePosition = { x: 0, y: 0 };

let mouseDownStartPoint: Point | null = null;
let mouseDownStartTracks: HalfTrack[] = [];

let mode: 'SwitchMode' | 'TimetableMode' = 'SwitchMode';

const railImage = new Image();

function getDistance(pointA: Point, pointB: Point): number {
  return Math.sqrt(
    (pointA.x - pointB.x) * (pointA.x - pointB.x) +
    (pointA.y - pointB.y) * (pointA.y - pointB.y)
  );
}

function deepEqual(x: any, y: any): boolean {
  const ok = Object.keys, tx = typeof x, ty = typeof y;
  return x && y && tx === 'object' && tx === ty ? (
    ok(x).length === ok(y).length &&
      ok(x).every(key => deepEqual(x[key], y[key]))
  ) : (x === y);
}

function getTrackDistance(point: Point, track: HalfTrack) {
  const a = (track._end.y - track._begin.y) / (track._end.x - track._begin.x);
  const b = track._begin.y - a * track._begin.x;
  return Math.abs(a * point.x - point.y + b) / Math.sqrt(a * a + 1);
}

function getTrackDirection(track: HalfTrack) {
  const trackLength = getDistance(track._begin, track._end);
  const trackDirection = {
    x: (track._end.x - track._begin.x) / trackLength,
    y: (track._end.y - track._begin.y) / trackLength,
  };
  return trackDirection;
}

// pointと最も近いtrackを返す
function getTrackByPoint(point: Point) {
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

function isTrainOutTrack(position: Point, track: HalfTrack) {
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

function getRadian(track1: HalfTrack, track2: HalfTrack) {
  const r1 = Math.atan2(track1._end.y - track1._begin.y, track1._end.x - track1._begin.x);
  const r2 = Math.atan2(track2._end.y - track2._begin.y, track2._end.x - track2._begin.x);
  const diffR = r1 - r2;
  const diffR_ = (diffR + 2 * Math.PI) % (2 * Math.PI);
  return diffR_ < 2 * Math.PI - diffR_ ? diffR_ : 2 * Math.PI - diffR_;
}

function getNextTrack(track: HalfTrack, train: Train): HalfTrack {
  if (mode === 'SwitchMode') {
    if (track._nextSwitch._branchedTrackTo === track.reverseTrack) {
      if (track._nextSwitch.toTracks.length === 1) {
        return track._nextSwitch._branchedTrackTo;
      }
  
      return track._nextSwitch._branchedTrackFrom.reverseTrack;
    }

    return track._nextSwitch._branchedTrackTo;
  } else {
    if (track._nextSwitch._branchedTrackTo === track.reverseTrack && track._nextSwitch.toTracks.length === 1) {
      return track._nextSwitch._branchedTrackTo;
    }

    const timetableItems = timetable.filter(t => t.operatingTrain === train);
    if (timetableItems.length !== 1) throw new Error('timetableItems.length');
    const timetableItem = timetableItems[0];
    
    // 次の駅に向かう方向に進む（つまり現在よりも「先の」方向で、一番近い位置の駅）
    // まずはtoのtoのみ見る
    let nextTrack = getNextTrackToReach(train.track, timetableItem.trainTimetable[train.currentTimetableIndex].stationId);
    if (!nextTrack) {
      nextTrack = train.track._nextSwitch.toTracks.filter(branchTrack =>
        Math.abs(getRadian(track, branchTrack)) <= Math.PI / 2)[0];
    }
    // console.log({nextTrack});
    if (nextTrack) {
      return nextTrack;
    } else {
      throw new Error('end');
    }

  }
}

function getMidPoint(point1: Point, point2: Point): Point {
  return {
    x: (point1.x + point2.x) / 2,
    y: (point1.y + point2.y) / 2
  };
}

function moveTrain(train: Train) {
  // 現在stationだったら出発条件を満たすまで停止する
  if (train.track.track.station && !train.wasDeparted && train.stationWaitTime < maxStationWaitTime) {
    const timetableItems = timetable.filter(t => t.operatingTrain === train);
    if (timetableItems.length !== 1) throw new Error('timetableItems.length');
    const timetableItem = timetableItems[0];

    if (timetableItem.trainTimetable[train.currentTimetableIndex].stationId === train.track.track.station.stationId) {
      // 時刻表の駅に到着した
      const currentTimetable = timetableItem.trainTimetable[train.currentTimetableIndex];
      if (globalTime < currentTimetable.departureTime) {
        // console.log('WAIT');
        return;
      } else if (globalTime >= currentTimetable.departureTime) {
        if (globalTime > currentTimetable.departureTime) {
          console.log('PASSED');
          console.log({
            train,
            currentTimetable
          })
        }
      }

      // 出発する => 次のindexに進める
      if (timetableItem.trainTimetable.length - 1 === train.currentTimetableIndex) {
        // TODO: 運用が終わったとき: 時刻表の運用データを元になんとかする
        trains.splice(trains.map((a, i) => [a, i] as const).filter(([t, i]) => t === train)[0][1], 1);
        return;
      }
      train.currentTimetableIndex ++;
    }
    
    // const stationCenter = getMidPoint(train.track._begin, train.track._end);
    if (!train.track.track.station.shouldDepart(train, globalTime)) {
      train.stationWaitTime ++;
      return;
    }
    train.wasDeparted = true;
  }

  const { x: directionX, y: directionY } = getTrackDirection(train.track);
  train.position.x += directionX * train.speed;
  train.position.y += directionY * train.speed;
  
  // trainがtrackの外に出たら、次の線路に移動する
  if (isTrainOutTrack(train.position, train.track)) {
    train.stationWaitTime = 0;
    train.wasDeparted = false;

    const nextTrack = getNextTrack(train.track, train);
    if (nextTrack) {
      // trackの終点から行き過ぎた距離を求める
      const distance = getDistance(train.track._end, train.position);

      train.position.x = nextTrack._begin.x + distance * getTrackDirection(nextTrack).x;
      train.position.y = nextTrack._begin.y + distance * getTrackDirection(nextTrack).y;
      
      train.track = nextTrack;
    } else {
      train.track = train.track.reverseTrack;
      train.position.x = train.track._begin.x;
      train.position.y = train.track._begin.y;
    }
  }
}

function showGlobalTime() {
  const m = Math.floor(globalTime / 60 % 60);
  return Math.floor(globalTime / 60 / 60) + ':' + (m < 10 ? '0' + m : '' + m)
}

function main() {
  for (const train of diagram.trains) {
    if (min(train.trainTimetable.map(t => t.arrivalTime)) === globalTime) {
      addTrain(stationIdMap, train);
    }
  }

  draw();
  for (const train of trains) {
    moveTrain(train);
  }

  globalTime += 10; // TODO
  // document.getElementById('time')!.innerText = globalTime.toString();
  document.getElementById('time')!.innerText = globalTime.toString()  + ' / ' + showGlobalTime();
}

function getNearestTrackPoint(point: Point) {
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

function changeSwitch(nearestTrackPoint: Point) {
  const nearestTracks = tracks
    .filter(track => deepEqual(track._begin, nearestTrackPoint));
  const targetSwitch = nearestTracks[0]._prevSwitch;
  
  if (targetSwitch.fromTracks.length === 1 && targetSwitch.toTracks.length === 1) return;

  // とりあえず適当にランダムに選ぶ
  while (true) {
    targetSwitch._branchedTrackFrom = getRandomElementOfArray(targetSwitch.fromTracks);
    targetSwitch._branchedTrackTo = getRandomElementOfArray(targetSwitch.toTracks);
    
    if (targetSwitch._branchedTrackFrom !== targetSwitch._branchedTrackTo.reverseTrack) break;
  }
}

function initialize() {
  const thresholdTrackDistance = 10;

  railImage.src = 'rail.png';
  railImage.onload = () => {
    let timeoutId = setInterval(main, 100);

    const button = document.getElementById('button-slow-speed') as HTMLInputElement;
    button.onclick = function () {
      toJSON();
      clearInterval(timeoutId);
      if (button.value === 'slow') {
        button.value = 'fast';
        timeoutId = setInterval(main, 100);
      } else {
        button.value = 'slow';
        timeoutId = setInterval(main, 1000);
      }
    }
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    canvas.onmousedown = function (e) {
      if (e.button === 0) {
        // 左クリックのとき、近くのtrackから始まるtrackを作成する
        const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const nearestTrackPoint = getNearestTrackPoint({ x, y });
        if (getDistance(nearestTrackPoint, { x, y }) < thresholdTrackDistance) {
          mouseDownStartPoint = nearestTrackPoint;
          // TODO: 複数の無関係な点が同じ距離だった場合に対応する
          mouseDownStartTracks = tracks.filter(track => deepEqual(track._end, mouseDownStartPoint));
        } else {
          // 近くのtrackが存在しない場合は独立した線路を作成する
          mouseDownStartPoint = { x, y };
          mouseDownStartTracks = [];
        }
      } else if (e.button === 2) {
        // 右クリックのとき、近くのswitchを切り替える
        const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const nearestTrackPoint = getNearestTrackPoint({ x, y });
        if (getDistance(nearestTrackPoint, { x, y }) < thresholdTrackDistance) {
          changeSwitch(nearestTrackPoint);
        }
      }
    }

    canvas.onmousemove = function (e) {
      currentMousePosition = { x: e.clientX, y: e.clientY };
    }

    canvas.onmouseup = function (e) {
      if (mouseDownStartPoint === null) {
        return;
      }

      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // newTrackの長さが短いときは作らない
      if (getDistance(mouseDownStartPoint, { x, y }) < thresholdTrackDistance) {
        mouseDownStartPoint = null;
        mouseDownStartTracks = [];
        return;
      }

      const begin = { x: mouseDownStartPoint.x, y: mouseDownStartPoint.y };
      const end = { x, y };
      
      // 最も近いtrackの始点または終点に吸着する
      const nearestTrackPoint = getNearestTrackPoint({ x, y });
      if (getDistance(nearestTrackPoint, { x, y }) < thresholdTrackDistance) {
        // 吸着したtrackの始点または終点がmouseDownStartPointと同じ場合は新たなtrackを作らない
        if (deepEqual(nearestTrackPoint, mouseDownStartPoint)) {
          mouseDownStartPoint = null;
          mouseDownStartTracks = [];
          return;
        }

        end.x = nearestTrackPoint.x;
        end.y = nearestTrackPoint.y;
        
        const nextTracks = tracks.filter(track => deepEqual(track._begin, nearestTrackPoint));
        
        createNewTrack(begin, end, nextTracks, mouseDownStartTracks, null);
      } else {
        // 離れているときは新たに線路を作る
        createNewTrack(begin, end, [], mouseDownStartTracks, null);
      }

      mouseDownStartPoint = null;
      mouseDownStartTracks = [];
    }

    canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); })
  }
}

function createNewTrack(_begin: Point, _end: Point, _nextTracks: HalfTrack[], _prevTracks: HalfTrack[], station: Station | null): [HalfTrack, HalfTrack] {
  const newTrack = createBothTrack({
    _begin,
    _end,
    _nextSwitch: _nextTracks.length > 0 ? _nextTracks[0]._prevSwitch : undefined,
    _prevSwitch: _prevTracks.length > 0 ? _prevTracks[0]._nextSwitch : undefined,
    track: {
      station: station,
    }
  });

  if (_prevTracks.length > 0) {
    _prevTracks[0]._nextSwitch.toTracks.push(newTrack[0]);
    _prevTracks[0]._nextSwitch.fromTracks.push(newTrack[1]);
  }

  if (_nextTracks.length > 0) {
    _nextTracks[0]._prevSwitch.toTracks.push(newTrack[1]);
    _nextTracks[0]._prevSwitch.fromTracks.push(newTrack[0]);
  }
  
  // 始点または終点のtrackがちょうど2つになったとき => わたるようにする
  if (_nextTracks.length === 1) {
    _nextTracks[0]._prevSwitch._branchedTrackFrom = _nextTracks[0]._prevSwitch.fromTracks.filter(t => t !== _nextTracks[0].reverseTrack)[0];
  }
  if (_prevTracks.length === 1) {
    _prevTracks[0]._nextSwitch._branchedTrackTo = _prevTracks[0]._nextSwitch.toTracks.filter(t => t !== _prevTracks[0].reverseTrack)[0];
  }

  tracks.push(...newTrack);

  return newTrack;
}

function createBothTrack(trackBase: HalfTrackWip, skipCreateSwitch: boolean = false): [HalfTrack, HalfTrack] {
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

  if (!skipCreateSwitch && !trackBase._nextSwitch) {
    trackBase._nextSwitch = {
      switchId: generateId(),
      fromTracks: [trackBase as HalfTrack],
      toTracks: [reverseTrack as HalfTrack],
      _branchedTrackFrom: trackBase as HalfTrack,
      _branchedTrackTo: reverseTrack as HalfTrack,
    };
    reverseTrack._prevSwitch = trackBase._nextSwitch;
    switches.push(trackBase._nextSwitch);
  }

  if (!skipCreateSwitch && !reverseTrack._nextSwitch) {
    reverseTrack._nextSwitch = {
      switchId: generateId(),
      fromTracks: [reverseTrack as HalfTrack],
      toTracks: [trackBase as HalfTrack],
      _branchedTrackFrom: reverseTrack as HalfTrack,
      _branchedTrackTo: trackBase as HalfTrack
    };
    trackBase._prevSwitch = reverseTrack._nextSwitch;
    switches.push(reverseTrack._nextSwitch);
  }

  return [trackBase as HalfTrack, reverseTrack as HalfTrack];
}

function syncBothTrack(trackBase: HalfTrack) {
  const rTrack = trackBase.reverseTrack;
  rTrack._begin = trackBase._end;
  rTrack._end = trackBase._begin;
  rTrack._nextSwitch = trackBase._prevSwitch;
  rTrack._prevSwitch = trackBase._nextSwitch;
  rTrack.reverseTrack = trackBase as HalfTrack;
  rTrack.track = trackBase.track;
}

function getRandomElementOfArray<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}
