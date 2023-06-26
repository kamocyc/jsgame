import { Platform, Station } from '../../model';

export interface DiaTime {
  diaTimeId: string;
  arrivalTime: number | null;
  departureTime: number | null;
  isPassing: boolean;
  diaStation: Station;
  diaPlatform: Platform;
}

export interface TrainType {
  trainTypeId: string;
  trainTypeName: string;
  trainTypeColor: string;
}

export interface DiaTrain {
  trainId: string;
  trainName: string;
  trainType?: TrainType;
  diaTimes: DiaTime[];
}

export type TimetableDirection = 'Outbound' | 'Inbound';

// Timetableを含む全てのデータ
export interface TimetableData {
  timetable: Timetable;
}

export interface Timetable {
  inboundDiaTrains: DiaTrain[];
  outboundDiaTrains: DiaTrain[];
  stations: Station[];
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
