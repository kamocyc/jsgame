import { ArrivalAndDepartureStatus, DetailedTimetable, Operation, Point, Track, Train } from '../../model.js';
import { getDistance, getMidPoint, getRadian } from '../../trackUtil.js';
import { GlobalTimeManager } from './globalTimeManager.js';
import { MoneyManager } from './moneyManager.js';
import { TrainRailwayMove, TrainRailwayMoveProps } from './trainRailwayMove.js';
import { TrainTimetableMove } from './trainTImetableMove.js';

// 継承させるので名称はPlacedTrainに合わせた（それでいいのかは不明）
export interface StoredTrain {
  placedTrainId: string; // 車両ID（物理的な車両）
  placedTrainName: string;
  placedRailwayLineId: string | null;
}

export interface PlacedTrain extends StoredTrain {
  train: Train | null; // train.trainIdは列車ID（物理的な車両ではなく、スジのID）
  trainId: string;
  diaTimeId: string;
  operationId: string;
  operation: Operation | null;
  speed: number;
  track: Track;
  stopId: string | null;
  position: Point;
  stationWaitTime: number;
  stationStatus: ArrivalAndDepartureStatus;
  operatingStatus: 'OutOfService' | 'InService' | 'Parking';
  justDepartedPlatformId: string | null;
}

export type TrainMoveCommonProps = TrainMoveProps & TrainRailwayMoveProps;

export interface ITrainMove {
  tick(props: TrainMoveCommonProps): void;
  getPlacedTrains(): PlacedTrain[];
  resetTrainMove(globalTimeManager: GlobalTimeManager): void;
  getTrainMoveType(): 'TrainMove' | 'TrainRailwayMove';
}

const trainMoveType: 'Railway' | 'Timetable' = 'Timetable';

export function createTrainMove(detailedTimetable: DetailedTimetable | null) {
  if (trainMoveType === 'Railway') {
    return new TrainRailwayMove();
  } else {
    if (detailedTimetable === null) {
      throw new Error('detailedTimetable === null');
    }
    return new TrainTimetableMove(detailedTimetable!);
  }
}

export function getStopPosition(_train: PlacedTrain, stationTrack: Track): Point | undefined {
  if (!stationTrack.track.platform) return undefined;

  const midPoint = getMidPoint(stationTrack.begin, stationTrack.end);
  return midPoint;
}

export function shouldStopTrain(train: PlacedTrain): false | Point {
  if (
    !train.track.track.platform ||
    train.stationStatus === 'Arrived' /*|| train.stationWaitTime >= this.maxStationWaitTime*/
  )
    return false;

  const stationTrack = train.track;
  const stopPosition = getStopPosition(train, stationTrack);
  if (!stopPosition) return false;

  // 列車の進行方向から、すでにstopPositionを過ぎたかどうかを判定
  if (getDistance(train.position, stopPosition) < 3) return stopPosition; // 近すぎる場合はstopと判定

  const r = getRadian(train.track, { begin: train.position, end: stopPosition });
  if (Math.abs(r) > Math.PI / 2) {
    return false;
  }

  return stopPosition;
}
const TimeActionMode: 'Just' | 'After' = 'After';
const StartIfNoTimetable = true;

export function getMinTimetableTime(timetable: DetailedTimetable): number {
  const minTimetableTime = Math.min(...timetable.operations.map((o) => o.firstOperation.operationTime - 60));
  return minTimetableTime;
}

export interface TrainMoveProps {
  globalTimeManager: GlobalTimeManager;
  moneyManager: MoneyManager;
  tracks: Track[];
}
