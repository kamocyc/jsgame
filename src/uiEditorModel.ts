import { GameMap } from './mapEditorModel';
import { DiaTrain, Switch } from './model';
import { TrainMove } from './trainMove';

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

export type EditMode = 'Create' | 'Delete' | 'Station' | 'Info';

export interface AppStates {
  editMode: EditMode;
  timetable: Timetable | null;
  trains: DiaTrain[] | null;
  map: GameMap;
  trainMove: TrainMove;
}
