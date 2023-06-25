import { createNewStationWithPlatform, getStationIdMapKey } from './common.js';
import { DiaStation, Diagram, HalfTrack, Point, StationTrain, Switch, generateId } from './model.js';
import { createNewTrack } from './trackUtil.js';
import { TrainMove } from './trainMove.js';

export function addPoint(point1: Point, point2: Point) {
  return {
    x: point1.x + point2.x,
    y: point1.y + point2.y,
  };
}

// 最初に何か線路を引いたほうがとりあえず楽そう？
// 順にしたにずらす感じでいいかと。platformはとりあえず別駅の扱いで
export function generateLines(trainMove: TrainMove, stations: DiaStation[], stationIdMap: Map<string, string>) {
  function add_(x: [HalfTrack, HalfTrack, Switch[]]) {
    trainMove.tracks.push(x[0], x[1]);
    trainMove.switches.push(...x[2]);
    return [x[0], x[1]];
  }

  const xTimes = 10;
  let xOffset = 15;
  const platformSpan = 30;

  const [startTrack] = add_(createNewTrack({ x: 0, y: 50 }, { x: xOffset, y: 50 }, [], [], null));
  let prevTrack = startTrack;

  for (let stationIndex = 0; stationIndex < stations.length; stationIndex++) {
    const station = stations[stationIndex];
    const newTracks: HalfTrack[] = [];
    for (let platformIndex = 0; platformIndex < station.platforms.length; platformIndex++) {
      // 中継の線路
      const [branchTrack] = add_(
        createNewTrack(
          prevTrack._end,
          addPoint(prevTrack._end, { x: 15, y: platformIndex * platformSpan }),
          [],
          [prevTrack],
          null
        )
      );
      const [stationTrack] = add_(
        createNewTrack(
          branchTrack._end,
          addPoint(branchTrack._end, { x: 50, y: 0 }),
          [],
          [branchTrack],
          createNewStationWithPlatform({
            platformId: stationIdMap.get(
              getStationIdMapKey(station.stationId, station.platforms[platformIndex].platformId)
            )!,
            platformName: station.name + (station.platforms[platformIndex].platformName ?? ''),
          })
        )
      );
      const [afterBranchTrack] = add_(
        createNewTrack(
          stationTrack._end,
          addPoint(stationTrack._end, { x: 15, y: -platformIndex * platformSpan }),
          [],
          [stationTrack],
          null,
          newTracks.length === 0 ? undefined : newTracks[0]._nextSwitch
        )
      );
      newTracks.push(afterBranchTrack);
    }
    const distance =
      stationIndex === stations.length - 1 ? 15 : (stations[stationIndex + 1].distance - station.distance) * xTimes;
    const [newTrack2] = add_(
      createNewTrack(newTracks[0]._end, addPoint(newTracks[0]._end, { x: distance, y: 0 }), [], newTracks, null)
    );
    prevTrack = newTrack2;
  }
}

function convertTimetableItem(obj: StationTrain, stationIdMap: Map<string, string>): StationTrain {
  return {
    stationId: stationIdMap.get(getStationIdMapKey(obj.stationId, obj.platformId))!,
    platformId: obj.platformId,
    arrivalTime: obj.arrivalTime,
    departureTime: obj.departureTime,
  };
}

function getStationIdMap(stations: DiaStation[]): Map<string, string> {
  const stationIdMap = new Map<string, string>();

  for (let stationIndex = 0; stationIndex < stations.length; stationIndex++) {
    const station = stations[stationIndex];
    for (let platformIndex = 0; platformIndex < station.platforms.length; platformIndex++) {
      const newId = generateId();
      stationIdMap.set(getStationIdMapKey(station.stationId, station.platforms[platformIndex].platformId), newId);
    }
  }

  return stationIdMap;
}

export function prepare(diagram: Diagram) {
  // normalizeDia(diagram);
  const stationIdMap = getStationIdMap(diagram.stations);
  console.log(stationIdMap);
  diagram.trains.forEach((train) => {
    train.trainTimetable = train.trainTimetable.map((t) => convertTimetableItem(t, stationIdMap));
  });
  return stationIdMap;
}
