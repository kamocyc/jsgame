import { Platform, Station } from '../../model';

export interface DiaTime {
  diaTimeId: string;
  arrivalTime: number | null;
  departureTime: number | null;
  isPassing: boolean;
  diaStation: Station;
  diaPlatform: Platform | null;
}

export interface TrainType {
  trainTypeId: string;
  trainTypeName: string;
  trainTypeColor: string;
}

export type Operation =
  | {
      operationType: 'Connection';
    }
  | {
      operationType: 'InOut';
      operationTime: number;
      operationCode: string;
    };

export interface DiaTrain {
  trainId: string;
  trainCode: string; // 列車番号
  trainName: string;
  trainType?: TrainType;
  diaTimes: DiaTime[];
  firstOperation?: Operation;
  lastOperation?: Operation;
}

export type TimetableDirection = 'Outbound' | 'Inbound';

export interface Timetable {
  inboundDiaTrains: DiaTrain[];
  outboundDiaTrains: DiaTrain[];
  stations: Station[];
  trainTypes: TrainType[];
}

// Timetableを含む全てのデータ
export interface TimetableData {
  timetable: Timetable;
}

export interface Clipboard {
  diaTrain: DiaTrain | null;
}

export interface ContextData {
  visible: boolean;
  posX: number;
  posY: number;
}

export interface StationSettingData {
  settingType: 'StationSetting';
  diaStation: Station;
}

export type SettingData = StationSettingData;
