import { GameMap } from '../../mapEditorModel';
import { HalfTrack, Platform, Station, Switch } from '../../model';
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
  track: HalfTrack | null;
}

export interface SwitchTimetableItem {
  train: Train;
  Switch: Switch;
  changeTime: number | null;
  branchDirection: BranchDirection;
}

export interface Timetable {
  platformTTItems: PlatformTimetableItem[];
  switchTTItems: SwitchTimetableItem[];
}

export type EditorDialogMode = 'StationEditor' | 'SwitchEditor';

export type EditMode = 'Create' | 'Delete' | 'PlaceTrain' | 'SetPlatform' | 'Station' | 'Info';

export interface MapContext {
  scale: number;
  offsetX: number;
  offsetY: number;
  mapTotalWidth: number;
  mapTotalHeight: number;
}

export function createMapContext(mapWidth: number, mapHeight: number): MapContext {
  return {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    mapTotalWidth: mapWidth * 30,
    mapTotalHeight: mapHeight * 30,
  };
}

export interface AppStates {
  editMode: EditMode;
  timetable: Timetable;
  trains: Train[];
  switches: Switch[]; // 今は使っていない
  stations: Station[];
  tracks: HalfTrack[];
  map: GameMap;
  mapWidth: number;
  mapHeight: number;
  mapContext: MapContext;
  trainMove: TrainMove2;
}
