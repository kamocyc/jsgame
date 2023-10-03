import { ArrivalAndDepartureStatus, DetailedTimetable, Operation, Point, Track, Train } from '../../model.js';
import { GlobalTimeManager } from './globalTimeManager.js';
import { TrainMove, TrainMoveProps } from './trainMove.js';
import { TrainRailwayMove, TrainRailwayMoveProps } from './trainRailwayMove.js';

// 継承させるので名称はPlacedTrainに合わせた（それでいいのかは不明）
export interface StoredTrain {
  placedTrainId: string; // 車両ID（物理的な車両）
  placedTrainName: string;
  placedRailwayLineId: string | null;
}

export interface PlacedTrain extends StoredTrain {
  train: Train | null; // train.trainIdは列車ID（物理的な車両ではなく、スジのID）
  operation: Operation | null;
  speed: number;
  track: Track;
  stopId: string | null;
  position: Point;
  stationWaitTime: number;
  stationStatus: ArrivalAndDepartureStatus;
}

export type TrainMoveCommonProps = TrainMoveProps & TrainRailwayMoveProps;

export interface ITrainMove {
  tick(props: TrainMoveCommonProps): void;
  getPlacedTrains(): PlacedTrain[];
  resetTrainMove(globalTimeManager: GlobalTimeManager): void;
  getTrainMoveType(): 'TrainMove' | 'TrainRailwayMove';
}

export function createTrainMove(detailedTimetable: DetailedTimetable | null) {
  if (true) {
    return new TrainRailwayMove();
  } else {
    if (detailedTimetable === null) {
      throw new Error('detailedTimetable === null');
    }
    return new TrainMove(detailedTimetable!);
  }
}
