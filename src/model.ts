import { assert } from './common';
import { AddingNewTrain, HistoryItem } from './outlinedTimetableData';

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

export type StationLike = Station | Depot;

export type PlatformLike = Platform | DepotLine;

export interface Depot {
  stationType: 'Depot';
  stationId: string;
  stationName: string;
  platforms: DepotLine[];
}

export interface DepotLine {
  platformType: 'DepotLine';
  platformId: string;
  platformName: string;
  station: Depot;
}

export interface Station {
  stationType: 'Station';
  stationId: string;
  stationName: string;
  platforms: Platform[];
  distance: number;
  defaultOutboundPlatformId: string;
  defaultInboundPlatformId: string;
}

export interface Platform {
  platformType: 'Platform';
  platformId: string;
  platformName: string;
  station: Station;
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
  platform: PlatformLike | null;
}

export type ArrivalAndDepartureStatus = 'Arrived' | 'Running';

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
  isInService: boolean;
  trackId: string | null;
  station: StationLike;
  platform: PlatformLike | null;
}

export interface TrainType {
  trainTypeId: string;
  trainTypeName: string;
  trainTypeColor: string;
}

// 入出区
export interface InOutOperation {
  stationOperationType: 'InOut';
  stationId: string;
  platformId: string;
  trackId: string;
  operationTime: number;
}

export interface ConnectionOperation {
  // 前列車との接続
  stationOperationType: 'Connection';
}

export type StationOperation = ConnectionOperation | InOutOperation;

export type TimetableDirection = 'Outbound' | 'Inbound';

export function getDefaultConnectionType(): ConnectionOperation {
  return { stationOperationType: 'Connection' };
}

export function getDefaultTime(): number {
  return 10 * 60 * 60;
}
export interface Train {
  trainId: string;
  trainCode: string; // 列車番号
  trainName: string;
  trainType?: TrainType;
  diaTimes: DiaTime[];
  firstStationOperation: StationOperation;
  lastStationOperation: StationOperation;
}

function cloneOperation(operation: StationOperation): StationOperation {
  if (operation.stationOperationType === 'InOut') {
    return {
      ...operation,
      stationOperationType: 'InOut',
    };
  } else {
    return {
      ...operation,
      stationOperationType: 'Connection',
    };
  }
}

export function cloneTrain(train: Train): Train {
  return {
    trainId: generateId(),
    trainCode: train.trainCode,
    trainName: train.trainName,
    trainType: train.trainType,
    diaTimes: train.diaTimes.map((diaTime) => ({ ...diaTime, diaTimeId: generateId() })),
    firstStationOperation: cloneOperation(train.firstStationOperation),
    lastStationOperation: cloneOperation(train.lastStationOperation),
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
  station: StationLike;
}

export interface StationOperationSettingData {
  settingType: 'StationOperationSetting';
  firstOrLast: 'First' | 'Last';
  train: Train;
}

export type SettingData = StationSettingData | StationOperationSettingData;

export type BranchDirection = 'Straight' | 'Branch';

// // 1つのtrain, platformに対して、複数のtimetableItemが存在する
// export interface PlatformTimetableItem {
//   placedTrainId: string;
//   platformId: string;
//   trainId: string | null;
//   arrivalTime: number | null;
//   departureTime: number | null;
//   track: Track | null;
// }

// export interface SwitchTimetableItem {
//   placedTrainId: string;
//   switchId: string;
//   changeTime: number | null;
//   branchDirection: BranchDirection;
// }

export interface Operation {
  operationId: string;
  operationCode: string;
  trains: Train[];
  firstOperation: InOutOperation;
  lastOperation: InOutOperation;
}

export interface PlatformTTItem {
  trainId: string;
  diaTimeId: string;
  platformId: string;
  isPassing: boolean;
  isInService: boolean;
  arrivalTime: number | null;
  departureTime: number | null;
}

export class PlatformTimetable {
  constructor(private platformTTItems: PlatformTTItem[]) {}

  getPlatformTTItem(trainId: string) {
    const ttItem = this.platformTTItems.find((ttItem) => ttItem.trainId === trainId);
    assert(ttItem !== undefined, 'ttItem !== undefined');
    return ttItem;
  }

  isLastTTItem(ttItem: PlatformTTItem): boolean {
    const index = this.platformTTItems.findIndex((item) => item.trainId === ttItem.trainId);
    assert(index !== -1, 'index !== -1');
    return index === this.platformTTItems.length - 1;
  }
}

// 本来的には単に順番を記録しておいて、補足として列車や時刻情報を持つべき。とはいえ正確な位置はけっきょくのところ一度シミュレーションを回さないとわからない。ので妥協
// とりあえずは、列車 -> 分岐方向 の情報で処理しておく
export interface SwitchTTItem {
  trainId: string;
  switchId: string;
  branchDirection: BranchDirection;
}
// export interface SwitchTTItemData {
//   switchId: string;
//   switchTTItems: SwitchTTItem[];
// }
export class SwitchTimetable {
  // private currentIndex: number = 0;

  constructor(private switchId: string, private switchTTItems: SwitchTTItem[]) {}

  getSwitchId(): string {
    return this.switchId;
  }

  getBranchDirection(trainId: string): BranchDirection {
    const item = this.switchTTItems.find((item) => item.trainId === trainId);
    if (item === undefined) {
      throw new Error('分岐方向が見つからない');
    }
    return item.branchDirection;
  }
}

export type PlatformTimetableMap = Map<string, PlatformTimetable>;
export type SwitchTimetableMap = Map<string, SwitchTimetable>;

export interface DetailedTimetable {
  platformTimetableMap: PlatformTimetableMap;
  switchTimetableMap: SwitchTimetableMap;
  operations: Operation[];
}

export interface CrudTrain {
  addTrains: (addingNewTrains: AddingNewTrain[]) => void;
  addTrain: (train: Train, direction: 'Inbound' | 'Outbound') => void;
  deleteTrains: (trainIds: string[]) => void;
  updateTrain: (historyItem: HistoryItem) => void;
}
