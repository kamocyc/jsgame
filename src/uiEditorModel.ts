import { GameMap } from './mapEditorModel';
import { DiaTrain, HalfTrack, Switch } from './model';
import { TrainMove2 } from './trainMove2';

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

export type EditorDialogMode = 'StationEditor' | 'SwitchEditor';

export type EditMode = 'Create' | 'Delete' | 'PlaceTrain' | 'Station' | 'Info';

export interface AppStates {
  editMode: EditMode;
  timetable: Timetable;
  trains: DiaTrain[];
  switches: Switch[];
  tracks: HalfTrack[];
  map: GameMap;
  trainMove: TrainMove2;
}