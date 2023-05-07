interface Point {
  x: number;
  y: number;
}

// 同じ点では同じオブジェクトを共有する
interface Switch {
  switchId: number;
  fromTracks: HalfTrack[];
  toTracks: HalfTrack[]; // switchがbeginのtrackのみ入れる
  _branchedTrackFrom: HalfTrack;
  _branchedTrackTo: HalfTrack;
}

interface Station {
  stationId: number;
  stationName: string;
  shouldDepart: (train: Train, globalTime: number) => boolean;
}

interface HalfTrack {
  trackId: number;
  _begin: Point;
  _end: Point;
  _nextSwitch: Switch;
  _prevSwitch: Switch;
  reverseTrack: HalfTrack;
  track: Track_
}

interface HalfTrackWip {
  trackId?: number;
  _begin: Point;
  _end: Point;
  _nextSwitch?: Switch;
  _prevSwitch?: Switch;
  reverseTrack?: HalfTrack;
  track: Track_
}

interface Track_ {
  station: Station | null;
}

interface Train {
  trainId: number;
  diaTrain?: DiaTrain;
  currentTimetableIndex: number;
  speed: number;
  track: HalfTrack;
  position: Point;
  stationWaitTime: number;
  wasDeparted: boolean;
}

interface OperationTrain {
  train: Train;
}

interface TimetableItem {
  station: Station;
  operatingTrain: OperationTrain;
  departTime: number
}

let _currentId = 0;
function generateId(): number {
  return ++_currentId;
}
