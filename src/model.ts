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
}

export type ArrivalAndDepartureStatus = 'NotArrived' | 'Arrived' | 'Departed';

function getInitialId(): number {
  return Math.floor((new Date().getTime() - 1600000000000) / 1000);
}

let _currentId = getInitialId();
export function generateId(): string {
  return (++_currentId).toString();
}

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
      operationType: 'Connection';
    }
  | {
      operationType: 'InOut';
      operationTime: number;
      operationCode: string | undefined;
    };

export interface Train {
  trainId: string;
  trainCode: string; // 列車番号
  trainName: string;
  trainType?: TrainType;
  diaTimes: DiaTime[];
  firstStationOperation?: StationOperation;
  lastStationOperation?: StationOperation;
}

export type TimetableDirection = 'Outbound' | 'Inbound';

export interface Timetable {
  inboundTrains: Train[];
  outboundTrains: Train[];
  stations: Station[];
  trainTypes: TrainType[];
}

// Timetableを含む全てのデータ
export interface TimetableData {
  timetable: Timetable;
}

export interface Clipboard {
  train: Train | null;
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
  train: Train;
  platform: Platform;
  arrivalTime: number | null;
  departureTime: number | null;
  track: Track | null;
}

export interface SwitchTimetableItem {
  train: Train;
  Switch: Switch;
  changeTime: number | null;
  branchDirection: BranchDirection;
}

export interface Operation {
  operationId: string;
  operationCode: string;
  trains: Train[];
}

export interface DetailedTimetable {
  platformTTItems: PlatformTimetableItem[];
  switchTTItems: SwitchTimetableItem[];
  operations: Operation[];
}
