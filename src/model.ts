export interface Point {
  x: number;
  y: number;
}

// 同じ点では同じオブジェクトを共有する
export interface Switch {
  switchId: string;
  endTracks: Track[];
  beginTracks: Track[]; // switchがbeginのtrackのみ入れる
  switchPatterns: [Track, Track][]; // 切り替わるswitchの組み合わせ
  switchPatternIndex: [number, number] | null; // 現在切り替えられているswitchPatternのindex。reverseTrackの分があるので要素が2つ
  straightPatternIndex: [number, number] | null; // 定位のpatternのIndex
}

export interface Platform {
  platformId: string;
  platformName: string;
  station: Station;
}

export interface Depot {
  depotId: string;
  depotName: string;
  depotLines: DepotLine[];
}

export interface DepotLine {
  depotLineId: string;
  depotLineName: string;
  depot: Depot;
}

export interface Station {
  stationId: string;
  stationName: string;
  platforms: Platform[];
  distance: number;
  defaultOutboundPlatformId: string;
  defaultInboundPlatformId: string;
}

export const DefaultStationDistance = 100;

export interface Track {
  trackId: string;
  begin: Point;
  end: Point;
  nextSwitch: Switch;
  prevSwitch: Switch;
  reverseTrack: Track;
  track: TrackProperty;
}

export interface TrackProperty {
  platform: Platform | null;
  depotLine: DepotLine | null;
}

export type ArrivalAndDepartureStatus = 'NotArrived' | 'Arrived' | 'Departed';

function getInitialId(): number {
  return Math.floor((new Date().getTime() - 1600000000000) / 1000);
}

let _currentId = getInitialId();
export function generateId(): string {
  return (++_currentId).toString();
}

// trainを可変にするのは困難なのでやはり諦める。
// 後で再構築処理を実装する
export interface DiaTime {
  diaTimeId: string;
  arrivalTime: number | null;
  departureTime: number | null;
  isPassing: boolean;
  station: Station;
  platform: Platform | null;
}

export interface TrainType {
  trainTypeId: string;
  trainTypeName: string;
  trainTypeColor: string;
}

export type StationOperation =
  | {
      // 前列車との接続
      operationType: 'Connection';
    }
  | {
      // 入出区
      operationType: 'InOut';
      // とりあえず未使用
      operationTime: number;
      operationCode: string | undefined;
    };

export type TimetableDirection = 'Outbound' | 'Inbound';

export interface Train {
  trainId: string;
  trainCode: string; // 列車番号
  trainName: string;
  trainType?: TrainType;
  diaTimes: DiaTime[];
  firstStationOperation?: StationOperation;
  lastStationOperation?: StationOperation;
  direction: TimetableDirection | null;
}

export function cloneTrain(train: Train): Train {
  return {
    trainId: generateId(),
    trainCode: train.trainCode,
    trainName: train.trainName,
    trainType: train.trainType,
    diaTimes: train.diaTimes.map((diaTime) => ({ ...diaTime, diaTimeId: generateId() })),
    firstStationOperation: train.firstStationOperation,
    lastStationOperation: train.lastStationOperation,
    direction: train.direction,
  };
}

export interface AppClipboard {
  trains: Train[];
  originalTrains: Train[];
}

export interface ContextData {
  visible: boolean;
  posX: number;
  posY: number;
}

export interface StationSettingData {
  settingType: 'StationSetting';
  station: Station;
}

export type SettingData = StationSettingData;

export type BranchDirection = 'Straight' | 'Branch';

// 1つのtrain, platformに対して、複数のtimetableItemが存在する
export interface PlatformTimetableItem {
  placedTrainId: string;
  platformId: string;
  trainId: string | null;
  arrivalTime: number | null;
  departureTime: number | null;
  track: Track | null;
}

export interface SwitchTimetableItem {
  placedTrainId: string;
  switchId: string;
  changeTime: number | null;
  branchDirection: BranchDirection;
}

// interface ST {
//   trainId: string;
//   branchDirection: BranchDirection;
// }

// interface STs {
//   sts: ST[];
//   currentIndex: number;
//   switchId: string;
// }

export interface Operation {
  operationId: string;
  operationCode: string;
  trains: Train[];
}

export interface DetailedTimetable {
  platformTTItems: PlatformTimetableItem[];
  switchTTItems: SwitchTimetableItem[];
}
