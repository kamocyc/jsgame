import { GameMap } from '../../mapEditorModel';
import { DiaTrain, HalfTrack, Platform, Station, Switch } from '../../model';
import { TrainMove2 } from './trainMove2';

export type BranchDirection = 'Straight' | 'Branch';

export interface Train {
  trainId: string;
  trainName: string;
}

// 1つのtrain, platformに対して、複数のtimetableItemが存在する

export interface PlatformTimetableItem {
  train: Train;
  platform: Platform;
  arrivalTime: number | null;
  departureTime: number | null;
}

export interface SwitchTimetableItem {
  train: Train;
  Switch: Switch;
  changeTime: number;
  branchDirection: BranchDirection;
}

export interface Timetable {
  platformTTItems: PlatformTimetableItem[];
  switchTTItems: SwitchTimetableItem[];
}

export type EditorDialogMode = 'StationEditor' | 'SwitchEditor';

export type EditMode = 'Create' | 'Delete' | 'PlaceTrain' | 'SetPlatform' | 'Station' | 'Info';

export interface AppStates {
  editMode: EditMode;
  timetable: Timetable;
  trains: DiaTrain[];
  switches: Switch[]; // 今は使っていない
  stations: Station[];
  tracks: HalfTrack[];
  map: GameMap;
  trainMove: TrainMove2;
}
