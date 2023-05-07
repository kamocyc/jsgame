
function addPoint(point1: Point, point2: Point) {
  return {
    x: point1.x + point2.x,
    y: point1.y + point2.y,
  };
}

// 最初に何か線路を引いたほうがとりあえず楽そう？
// 順にしたにずらす感じでいいかと。platformはとりあえず別駅の扱いで
function generateLine(stations: DiaStation[]) {
  const xTimes = 10;
  let xOffset = 15;
  const platformSpan = 30;

  const [startTrack] = createNewTrack({x: 0, y: 50}, {x: xOffset, y: 50}, [], [], null);
  let prevTrack = startTrack;

  const stationIdMap = new Map<string, Station>();

  for (let stationIndex = 0; stationIndex < stations.length; stationIndex ++) {
    const station = stations[stationIndex];
    const newTracks: HalfTrack[] = [];
    for (let platformIndex = 0; platformIndex < station.platforms.length; platformIndex ++) {
      // 中継の線路
      const [branchTrack] = createNewTrack(prevTrack._end, addPoint(prevTrack._end, {x: 15, y: platformIndex * platformSpan}), [], [prevTrack], null);
      const [stationTrack] = createNewTrack(branchTrack._end, addPoint(branchTrack._end, {x: 50, y: 0}), [], [branchTrack], {
        shouldDepart: () => true,
        stationId: generateId(),
        stationName: station.name + (station.platforms[platformIndex].name ?? ''),
      });
      const [afterBranchTrack] = createNewTrack(stationTrack._end, addPoint(stationTrack._end, {x: 15, y: -platformIndex * platformSpan}), newTracks.map(t => t.reverseTrack), [stationTrack], null);
      newTracks.push(afterBranchTrack);

      stationIdMap.set(station.stationId + '__' + station.platforms[platformIndex].platformId, stationTrack.track.station!);
    }
    const distance = stationIndex === stations.length - 1 ? 15 : (stations[stationIndex + 1].distance - station.distance) * xTimes;
    const [newTrack2] = createNewTrack(newTracks[0]._end, addPoint(newTracks[0]._end, {x: distance, y: 0}), [], newTracks, null);
    prevTrack = newTrack2;
  }

  return stationIdMap;
}

function getNextTrackToReach(track: HalfTrack, stationId: number, found: Map<number, boolean> = new Map()): HalfTrack | undefined {
  if (track.track.station?.stationId === stationId) return track;
  
  found.set(track.trackId, true);

  for (const toTrack of track._nextSwitch.toTracks) {
    if (!found.has(toTrack.trackId) && Math.abs(getRadian(track, toTrack)) <= Math.PI / 2) {
      const r = getNextTrackToReach(toTrack, stationId, found);  
      if (r) return toTrack;
    }
  }

  found.delete(track.trackId);

  return undefined;
}

function addTrain(stationIdMap: Map<string, Station>, train: DiaTrain) {
  function convert(obj: {stationId: number, platformId: number, arrivalTime: number, departureTime: number}) {
    return {
      stationId: stationIdMap.get(obj.stationId + '__' + obj.platformId)!.stationId,
      platformId: obj.platformId,
      arrivalTime: obj.arrivalTime,
      departureTime: obj.departureTime
    };
  }

  const trainToAdd: Train = {
    trainId: generateId(),
    speed: 15,
    currentTimetableIndex: 0,
    track: tracks[0], // dummy
    position: {...tracks[0]._end},  // dummy
    stationWaitTime: 0,
    wasDeparted: false,
  };

  // 初期位置は駅に置く
  // 方向の情報が無いので、決める必要がある。
  // 最初の駅の到着時間までは表示しない
  trainToAdd.track = tracks.filter(track => track.track.station?.stationId === convert(train.trainTimetable[0]).stationId)[0];
  if (train.trainTimetable[0].stationId > train.trainTimetable[1].stationId) trainToAdd.track = trainToAdd.track.reverseTrack;
  trainToAdd.position = {...trainToAdd.track._begin};

  const train_ = {
    ...train,
    operatingTrain: trainToAdd,
    trainTimetable: train.trainTimetable.map(t => convert(t))
  };
  timetable.push(...[train_]);
  train_.operatingTrain.diaTrain = train_;

  trains.push(trainToAdd);
}

let stationIdMap: Map<string, Station>;
let diagram: Diagram;

function initialize2() {
  fetch('./sample-diagram.json').then(data => data.text()).then(diaRawData => {
    diagram = getDiaFreaks(diaRawData);
    diagram.stations.sort((a, b) => a.distance - b.distance);
    
    stationIdMap = generateLine(diagram.stations);

    mode = 'TimetableMode';

    globalTime = 26700;
    globalTime = min(diagram.trains.map(t => t.trainTimetable.map(tt => tt.arrivalTime)).flat());

    initialize();
  });
}
