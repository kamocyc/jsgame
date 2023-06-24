export interface DiaPlatform {
  diaPlatformId: string;
  diaPlatformName: string;
}

export interface DiaStation {
  diaStationId: string;
  diaStationName: string;
  diaPlatforms: DiaPlatform[];
  defaultOutboundDiaPlatformId: string;
  defaultInboundDiaPlatformId: string;
}

export interface DiaTime {
  diaTimeId: string;
  arrivalTime: number | null;
  departureTime: number | null;
  isPassing: boolean;
  diaStation: DiaStation;
  diaPlatform: DiaPlatform;
}

export interface TrainType {
  trainTypeId: string;
  trainTypeName: string;
  trainTypeColor: string;
}

export interface DiaTrain {
  diaTrainId: string;
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
