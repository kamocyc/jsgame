import { Switch } from './model';

export type BranchDirection = 'Straight' | 'Branch';

export interface Train {
  trainId: number;
  trainName: string;
}

export interface Station {
  stationId: number;
  stationName: string;
}

// 1つのtrain, stationに対して、複数のtimetableItemが存在する

export interface StationTimetableItem {
  train: Train;
  station: Station;
  departureTime: number;
}

export interface SwitchTimetableItem {
  train: Train;
  Switch: Switch;
  changeTime: number;
  branchDirection: BranchDirection;
}

export interface Timetable {
  stationTTItems: StationTimetableItem[];
  switchTTItems: SwitchTimetableItem[];
}

export type EditorMode = 'StationEditor' | 'SwitchEditor';
