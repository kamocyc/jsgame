
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

  const [startTrack] = createNewTrack({x: 0, y: 50}, {x: xOffset, y: 50}, undefined, undefined, [], [], null);
  let prevTrack = startTrack;

  const stationIdMap = new Map<string, Station>();

  for (let stationIndex = 0; stationIndex < stations.length; stationIndex ++) {
    const station = stations[stationIndex];
    const newTracks: HalfTrack[] = [];
    for (let platformIndex = 0; platformIndex < station.platforms.length; platformIndex ++) {
      // 中継の線路
      const [branchTrack] = createNewTrack(prevTrack._end, addPoint(prevTrack._end, {x: 15, y: platformIndex * platformSpan}), undefined, prevTrack._nextSwitch, [], [prevTrack], null);
      const [stationTrack] = createNewTrack(branchTrack._end, addPoint(branchTrack._end, {x: 50, y: 0}), undefined, branchTrack._nextSwitch, [], [branchTrack], {
        shouldDepart: () => true,
        stationId: generateId(),
        stationName: station.name + (station.platforms[platformIndex].name ?? ''),
      });
      const [afterBranchTrack] =
        createNewTrack(
          stationTrack._end,
          addPoint(stationTrack._end, {x: 15, y: -platformIndex * platformSpan}),
          newTracks.length === 0 ? undefined : newTracks[0]._nextSwitch,
          stationTrack._nextSwitch,
          [], [stationTrack], null);
      newTracks.push(afterBranchTrack);

      stationIdMap.set(station.stationId + '__' + station.platforms[platformIndex].platformId, stationTrack.track.station!);
    }
    const distance = stationIndex === stations.length - 1 ? 15 : (stations[stationIndex + 1].distance - station.distance) * xTimes;
    const [newTrack2] = createNewTrack(newTracks[0]._end, addPoint(newTracks[0]._end, {x: distance, y: 0}), undefined, newTracks[0]._nextSwitch, [], newTracks, null);
    prevTrack = newTrack2;
  }

  return stationIdMap;
}

function getNextTrackToReach(track: HalfTrack, stationId: number, length: number = 0, count: number = 0, found: Map<number, boolean> = new Map()): [HalfTrack, number, number] | undefined {
  if (track.track.station?.stationId === stationId) return [track, length, count];
  
  found.set(track.trackId, true);

  for (const toTrack of track._nextSwitch.switchPatterns.filter(([t, _]) => t === track).map(([_, toTrack]) => toTrack)) {
    if (!found.has(toTrack.trackId)) {
      const r = getNextTrackToReach(toTrack, stationId, length + getDistance(toTrack._end, toTrack._begin), count + 1, found);
      if (r) return [toTrack, r[1], r[2]];
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

function saveTime() {
  const minGlobalTime = min(diagram.trains.map(t => t.trainTimetable.map(tt => tt.arrivalTime)).flat());
  const maxGlobalTime = max(diagram.trains.map(t => t.trainTimetable.map(tt => tt.departureTime)).flat());

  const records = getRecords(minGlobalTime, maxGlobalTime);
  console.log(records);
  console.log(JSON.stringify(records));
}

function loadTime() {

  let timeSpeed: number;

  fetch('./saved_time.json').then(data => data.json()).then((savedData : TimedPositionData) => {
    globalTime = savedData.minGlobalTime;
    timeSpeed = savedData.globalTimeSpeed;

    const slowButton = document.getElementById('button-speed-slow') as HTMLInputElement;
    slowButton.onclick = () => {
      timeSpeed -= 10;
    }
    const fastButton = document.getElementById('button-speed-fast') as HTMLInputElement;
    fastButton.onclick = () => {
      timeSpeed += 10;
    }


    tracks.slice(0);
    tracks.push(...savedData.tracks);

    let i = 0;

    let inClick = false;
    const seekBar = document.getElementById('seek-bar') as HTMLInputElement;
    const seekBarWidth = 1000;
    function moveSeekBar(mouseX: number) {
      globalTime = Math.round((savedData.maxGlobalTime - savedData.minGlobalTime) * (mouseX / seekBarWidth) + savedData.minGlobalTime);
      i = Math.floor((globalTime - savedData.minGlobalTime) / savedData.globalTimeSpeed);
    }
    seekBar.onmousedown = (e) => {
      inClick = true;
      const mouseX = e.clientX - seekBar.getBoundingClientRect().left;
      moveSeekBar(mouseX);
    }
    seekBar.onmousemove = (e) => {
      if (inClick) {
        const mouseX = e.clientX - seekBar.getBoundingClientRect().left;
        moveSeekBar(mouseX);
      }
    }
    seekBar.onmouseup = (e) => {
      inClick = false;
    }

    setInterval(() => {
      trains.splice(0);
      const rawTrains = savedData.records[i];

      trains.push(...rawTrains.map(rawTrain => ({
        trainId: rawTrain.trainId,
        diaTrain: {
          color: rawTrain.color,
          name: rawTrain.name,
        },
        position: rawTrain.position,
      } as Train)));

      draw({x: 0, y: 0}, null);

      globalTime += timeSpeed / 10;
      i = Math.floor((globalTime - savedData.minGlobalTime) / savedData.globalTimeSpeed);

      const seekBar = document.getElementById('seek-bar-item') as HTMLDivElement;
      seekBar.style.left = Math.round(seekBarWidth * i / savedData.records.length) + 'px';
    }, 100 / 10 /* TODO */);
  })
}

function initialize2() {
  fetch('./sample-diagram.json').then(data => data.text()).then(diaRawData => {
    diagram = getDiaFreaks(diaRawData);
    
    stationIdMap = generateLine(diagram.stations);

    mode = 'TimetableMode';

    normalizeDia(diagram);

    globalTime = min(diagram.trains.map(t => t.trainTimetable.map(tt => tt.arrivalTime)).flat());
    // globalTime = 26700;
    saveTime();
    initialize();
  });
}
