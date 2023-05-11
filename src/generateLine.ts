import { getStationIdMapKey, max, min } from "./common.js";
import { getDiaFreaks } from "./diaFreaksParser.js";
import { draw } from "./drawer.js";
import { DiaStation, DiaTrain, Diagram, HalfTrack, Point, Station, StationTrain, Switch, Train, generateId } from "./model.js";
import { normalizeDia } from "./normalizeDia.js";
import { saveTime } from "./recordTime.js";
import { createNewTrack, getDistance } from "./trackUtil.js";
import { TrainMove } from "./trainMove.js";

export function addPoint(point1: Point, point2: Point) {
  return {
    x: point1.x + point2.x,
    y: point1.y + point2.y,
  };
}

// 最初に何か線路を引いたほうがとりあえず楽そう？
// 順にしたにずらす感じでいいかと。platformはとりあえず別駅の扱いで
export function generateLines(tracks: HalfTrack[], switches: Switch[], stations: DiaStation[], stationIdMap: Map<string, number>) {
  const xTimes = 10;
  let xOffset = 15;
  const platformSpan = 30;

  const [startTrack] = createNewTrack(tracks, switches, {x: 0, y: 50}, {x: xOffset, y: 50}, undefined, undefined, [], [], null);
  let prevTrack = startTrack;

  for (let stationIndex = 0; stationIndex < stations.length; stationIndex ++) {
    const station = stations[stationIndex];
    const newTracks: HalfTrack[] = [];
    for (let platformIndex = 0; platformIndex < station.platforms.length; platformIndex ++) {
      // 中継の線路
      const [branchTrack] = createNewTrack(tracks, switches, prevTrack._end, addPoint(prevTrack._end, {x: 15, y: platformIndex * platformSpan}), undefined, prevTrack._nextSwitch, [], [prevTrack], null);
      const [stationTrack] = createNewTrack(tracks, switches, branchTrack._end, addPoint(branchTrack._end, {x: 50, y: 0}), undefined, branchTrack._nextSwitch, [], [branchTrack], {
        shouldDepart: () => true,
        stationId: stationIdMap.get(getStationIdMapKey(station.stationId, station.platforms[platformIndex].platformId))!,
        stationName: station.name + (station.platforms[platformIndex].name ?? ''),
      });
      const [afterBranchTrack] =
        createNewTrack(
          tracks, switches, 
          stationTrack._end,
          addPoint(stationTrack._end, {x: 15, y: -platformIndex * platformSpan}),
          newTracks.length === 0 ? undefined : newTracks[0]._nextSwitch,
          stationTrack._nextSwitch,
          [], [stationTrack], null);
      newTracks.push(afterBranchTrack);
    }
    const distance = stationIndex === stations.length - 1 ? 15 : (stations[stationIndex + 1].distance - station.distance) * xTimes;
    const [newTrack2] = createNewTrack(tracks, switches, newTracks[0]._end, addPoint(newTracks[0]._end, {x: distance, y: 0}), undefined, newTracks[0]._nextSwitch, [], newTracks, null);
    prevTrack = newTrack2;
  }
}

export function getNextTrackToReach(track: HalfTrack, stationId: number, length: number = 0, count: number = 0, found: Map<number, boolean> = new Map()): [HalfTrack, number, number] | undefined {
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

function convertTimetableItem(obj: StationTrain, stationIdMap: Map<string, number>): StationTrain {
  return {
    stationId: stationIdMap.get(getStationIdMapKey(obj.stationId, obj.platformId))!,
    platformId: obj.platformId,
    arrivalTime: obj.arrivalTime,
    departureTime: obj.departureTime
  };
}

function getStationIdMap(stations: DiaStation[]): Map<string, number> {
  const stationIdMap = new Map<string, number>();

  for (let stationIndex = 0; stationIndex < stations.length; stationIndex ++) {
    const station = stations[stationIndex];
    for (let platformIndex = 0; platformIndex < station.platforms.length; platformIndex ++) {
      const newId = generateId();
      stationIdMap.set(getStationIdMapKey(station.stationId, station.platforms[platformIndex].platformId), newId);
    }
  }

  return stationIdMap;
}

export function prepare(diagram: Diagram) {
  normalizeDia(diagram);
  const stationIdMap = getStationIdMap(diagram.stations);
  diagram.trains.forEach(train => {
    train.trainTimetable = train.trainTimetable.map(t => convertTimetableItem(t, stationIdMap));
  });
  return stationIdMap;
}