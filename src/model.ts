export interface Point {
  x: number;
  y: number;
}

// 同じ点では同じオブジェクトを共有する
export interface Switch {
  switchId: string;
  endTracks: HalfTrack[];
  beginTracks: HalfTrack[]; // switchがbeginのtrackのみ入れる
  switchPatterns: [HalfTrack, HalfTrack][]; // 切り替わるswitchの組み合わせ
  switchPatternIndex: [number, number] | null; // 現在切り替えられているswitchPatternのindex。reverseTrackの分があるので要素が2つ
  straightPatternIndex: [number, number] | null; // 定位のpatternのIndex
}

export interface Platform {
  platformId: string;
  platformName: string;
  station: Station;
}

export interface Station {
  stationId: string;
  stationName: string;
  platforms: Platform[];
  defaultOutboundDiaPlatformId: string;
  defaultInboundDiaPlatformId: string;
}

export interface HalfTrack {
  trackId: string;
  _begin: Point;
  _end: Point;
  _nextSwitch: Switch;
  _prevSwitch: Switch;
  reverseTrack: HalfTrack;
  track: Track_;
}

export interface HalfTrackWip {
  trackId?: string;
  _begin: Point;
  _end: Point;
  _nextSwitch?: Switch;
  _prevSwitch?: Switch;
  reverseTrack?: HalfTrack;
  track: Track_;
}

export interface Track_ {
  platform: Platform | null;
}

export type ArrivalAndDepartureStatus = 'NotArrived' | 'Arrived' | 'Departed';

export interface Train {
  trainId: string;
  diaTrain?: DiaTrain;
  currentTimetableIndex: number;
  speed: number;
  track: HalfTrack;
  position: Point;
  platformWaitTime: number;
  arrivalAndDepartureStatus: ArrivalAndDepartureStatus;
}

export interface OperationTrain {
  train: Train;
}

export interface TimetableItem {
  platform: Platform;
  operatingTrain: OperationTrain;
  departTime: number;
}

export interface DiaStation {
  stationId: string /* stationId */;
  name: string /* name */;
  distance: number /* distance */;
  platforms: Platform[] /* platforms */;
}

export interface StationTrain {
  stationId: string /* stationId */;
  platformId: string /* platformId */;
  arrivalTime: number /* arrivalTime */;
  departureTime: number /* departureTime */;
}

export interface DiaTrain {
  trainId: string /* trainId */;
  color?: string;
  trainName: string /* name */;
  trainTimetable: StationTrain[];
}

export interface Diagram {
  stations: DiaStation[];
  trains: DiaTrain[];
}

function getInitialId(): number {
  return Math.floor((new Date().getTime() - 1600000000000) / 1000);
}

let _currentId = getInitialId();
export function generateId(): string {
  return (++_currentId).toString();
}

export interface SerializedTrain {
  trainId: string;
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
