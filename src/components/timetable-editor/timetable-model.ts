export interface DiaPlatform {
  diaPlatformId: number;
  diaPlatformName: string;
}

export interface DiaStation {
  diaStationId: number;
  diaStationName: string;
  diaPlatforms: DiaPlatform[];
  defaultOutboundDiaPlatformId: number;
  defaultInboundDiaPlatformId: number;
}

export interface DiaTime {
  diaTimeId: number;
  arrivalTime: number | null;
  departureTime: number | null;
  isPassing: boolean;
  diaStation: DiaStation;
  diaPlatform: DiaPlatform;
}

export interface TrainType {
  trainTypeId: number;
  trainTypeName: string;
  trainTypeColor: string;
}

export interface DiaTrain {
  diaTrainId: number;
  trainName?: string;
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
  diaStations: DiaStation[];
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
  diaStation: DiaStation;
}

export type SettingData = StationSettingData;
