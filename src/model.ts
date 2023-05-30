export interface Point {
  x: number;
  y: number;
}

// 同じ点では同じオブジェクトを共有する
export interface Switch {
  switchId: number;
  endTracks: HalfTrack[];
  beginTracks: HalfTrack[]; // switchがbeginのtrackのみ入れる
  switchPatterns: [HalfTrack, HalfTrack][]; // 切り替わるswitchの組み合わせ
  switchPatternIndex: [number, number] | null;
}

export interface Station {
  stationId: number;
  stationName: string;
  shouldDepart: (train: Train, globalTime: number) => boolean;
}

export interface HalfTrack {
  trackId: number;
  _begin: Point;
  _end: Point;
  _nextSwitch: Switch;
  _prevSwitch: Switch;
  reverseTrack: HalfTrack;
  track: Track_;
}

export interface HalfTrackWip {
  trackId?: number;
  _begin: Point;
  _end: Point;
  _nextSwitch?: Switch;
  _prevSwitch?: Switch;
  reverseTrack?: HalfTrack;
  track: Track_;
}

export interface Track_ {
  station: Station | null;
}

export type StationStatus = 'NotArrived' | 'Arrived' | 'Departed';

export interface Train {
  trainId: number;
  diaTrain?: DiaTrain;
  currentTimetableIndex: number;
  speed: number;
  track: HalfTrack;
  position: Point;
  stationWaitTime: number;
  stationStatus: StationStatus;
}

export interface OperationTrain {
  train: Train;
}

export interface TimetableItem {
  station: Station;
  operatingTrain: OperationTrain;
  departTime: number;
}

export interface Platform {
  platformId: number /* platformId */;
  name?: string /* name */;
}

export interface DiaStation {
  stationId: number /* stationId */;
  name: string /* name */;
  distance: number /* distance */;
  platforms: Platform[] /* platforms */;
}

export interface StationTrain {
  stationId: number /* stationId */;
  platformId: number /* platformId */;
  arrivalTime: number /* arrivalTime */;
  departureTime: number /* departureTime */;
}

export interface DiaTrain {
  trainId: number /* trainId */;
  color?: string;
  name: string /* name */;
  trainTimetable: StationTrain[];
}

export interface Diagram {
  stations: DiaStation[];
  trains: DiaTrain[];
}

let _currentId = 0;
export function generateId(): number {
  return ++_currentId;
}

export interface SerializedTrain {
  trainId: number;
  name: string | undefined;
  color: string | undefined;
  position: Point;
}

export interface TimedPositionData {
  minGlobalTime: number;
  maxGlobalTime: number;
  globalTimeSpeed: number;
  tracks: HalfTrack[];
  records: SerializedTrain[][];
}
