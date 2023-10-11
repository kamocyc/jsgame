import { assert } from './common';
import { createOperations } from './components/track-editor/timetableConverter';

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

export interface OutlinedTimetable {
  railwayLineId: string;
  timetableId: string;
  inboundTrainIds: string[];
  outboundTrainIds: string[];
  stations: Station[];
  trainTypes: TrainType[];
  operations: Operation[];
}

// Timetableを含む全てのデータ
export class OutlinedTimetableData {
  constructor(private trains: Train[] = [], private timetables: OutlinedTimetable[] = []) {
  }
  
  public getTrains(): Train[] {
    return this.trains;
  }
  public getTimetables(): OutlinedTimetable[] {
    return this.timetables;
  }
  public toDataToSave() {
    return {
      trains: this.trains,
      timetables: this.timetables,
    };
  }

  public addTimetable(timetable: OutlinedTimetable, trains: Train[]) {
    this.timetables.push(timetable);
    for (const train of trains) {
      if (!this.trains.find((t) => t.trainId === train.trainId)) {
        this.trains.push(train);
      }
    }
  }

  deleteTrains(trainIds: string[]) {
    const notUedTrainIds: string[] = [];
    for (const trainId of trainIds) {
      // 他で使われていなければ、trainIdを削除
      let used = false;
      for (const tt of this.timetables) {
        if (tt.inboundTrainIds.concat(tt.outboundTrainIds).some((id) => id === trainId)) {
          used = true;
          break;
        }
      }

      if (!used) {
        notUedTrainIds.push(trainId);
      }
    }

    this.trains = this.trains.filter((train) => !notUedTrainIds.some((id) => id === train.trainId));
  }

  clearTimetable(timetableId: string) {
    const timetable = this.timetables.find((t) => t.timetableId === timetableId);
    assert(timetable !== undefined);

    timetable.inboundTrainIds = [];
    timetable.outboundTrainIds = [];
    timetable.operations = [];
    timetable.trainTypes = [];

    this.deleteNotUsedTrains();
  }

  setTrains(timetableId: string, trains: Train[], direction: 'Inbound' | 'Outbound') {
    const timetable = this.timetables.find((t) => t.timetableId === timetableId);
    assert(timetable !== undefined);

    if (direction === 'Inbound') {
      timetable.inboundTrainIds = trains.map((train) => train.trainId);
    } else {
      timetable.outboundTrainIds = trains.map((train) => train.trainId);
    }

    this.trains.push(...trains);

    this.deleteNotUsedTrains();
  }

  getTrain(trainId: string): Train {
    const train = this.getTrains().find((train) => train.trainId === trainId);
    assert(train !== undefined);
    return train;
  }

  reverseTimetableDirection(timetableId: string): void {
    const timetable = this.timetables.find((t) => t.timetableId === timetableId);
    assert(timetable !== undefined);

    const oldInboundTrains = timetable.inboundTrainIds.map((trainId) => this.getTrain(trainId));
    const oldOutboundTrains = timetable.outboundTrainIds.map((trainId) => this.getTrain(trainId));

    const inboundTrains: Train[] = [];
    const outboundTrains: Train[] = [];
    for (const train of oldInboundTrains) {
      outboundTrains.push({
        ...train,
        trainId: generateId(),
        direction: 'Outbound',
      });
    }
    for (const train of oldOutboundTrains) {
      inboundTrains.push({
        ...train,
        trainId: generateId(),
        direction: 'Inbound',
      });
    }

    const trains = outboundTrains.concat(inboundTrains);

    timetable.inboundTrainIds = inboundTrains.map((train) => train.trainId);
    timetable.outboundTrainIds = outboundTrains.map((train) => train.trainId);
    timetable.stations = timetable.stations.slice().reverse();
    timetable.operations = createOperations(trains);

    this.trains.push(...trains);
    this.deleteNotUsedTrains();
  }

  // 重複を削除し、使用されていないtrainを削除する
  private deleteNotUsedTrains() {
    const trainMap = new Map<string, Train>();
    for (const train of this.trains) {
      trainMap.set(train.trainId, train);
    }

    this.trains.splice(0, this.trains.length);
    const usedTrainIds = this.timetables.flatMap((t) => [...t.inboundTrainIds, ...t.outboundTrainIds]);
    for (const usedTrainId of usedTrainIds) {
      const train = trainMap.get(usedTrainId);
      assert(train !== undefined);
      this.trains.push(train);
    }
  }

  public deleteTimetable(timetableId: string) {
    const index = this.timetables.findIndex((t) => t.timetableId === timetableId);
    if (index !== -1) {
      this.timetables.splice(index, 1);

      this.deleteNotUsedTrains();
    }
  }
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
  platform: Platform;
  train: Train | null;
  arrivalTime: number | null;
  departureTime: number | null;
  track: Track | null;
}

export interface SwitchTimetableItem {
  placedTrainId: string;
  train: Train | null;
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
}
