import { TrainMove2 } from './components/track-editor/trainMove2';
import { DetailedTimetable, Point, Station, Switch, Track, Train } from './model';

export const CellWidth = 30;
export const CellHeight = 30;

export interface LineType {
  lineClass: 'Straight' | 'Curve' | 'Branch' | 'Terminal';
}

export type LineDirection = 'Horizontal' | 'Vertical' | 'BottomTop' | 'TopBottom';
// 角度は、セル内でLine片がある方向を表す
export type LineAngle = 0 | 45 | 90 | 135 | 180 | 225 | 270 | 315;
export type CurveType =
  | 'Bottom_TopLeft'
  | 'Bottom_TopRight'
  | 'Top_BottomLeft'
  | 'Top_BottomRight'
  | 'Left_TopRight'
  | 'Left_BottomRight'
  | 'Right_TopLeft'
  | 'Right_BottomLeft';
export type BranchType =
  | 'Horizontal_TopLeft'
  | 'Horizontal_TopRight'
  | 'Horizontal_BottomLeft'
  | 'Horizontal_BottomRight'
  | 'Vertical_TopLeft'
  | 'Vertical_TopRight'
  | 'Vertical_BottomLeft'
  | 'Vertical_BottomRight'
  | 'BottomTop_Top'
  | 'BottomTop_Bottom'
  | 'BottomTop_Left'
  | 'BottomTop_Right'
  | 'TopBottom_Top'
  | 'TopBottom_Bottom'
  | 'TopBottom_Left'
  | 'TopBottom_Right';

export type LineTypeStraight = {
  lineClass: 'Straight';
  straightType: LineDirection;
  tracks: Track[];
  switch: Switch;
};

export type LineTypeTerminal = {
  lineClass: 'Terminal';
  angle: LineAngle;
  tracks: Track[];
  switch: Switch;
};

export type LineTypeCurve = {
  lineClass: 'Curve';
  curveType: CurveType;
  tracks: Track[];
  switch: Switch;
};

export type LineTypeBranch = {
  lineClass: 'Branch';
  branchType: BranchType;
  tracks: Track[];
  switch: Switch;
};

export interface Cell {
  position: Point;
  lineType: null | LineTypeStraight | LineTypeTerminal | LineTypeCurve | LineTypeBranch;
}

export type GameMap = Cell[][];

export function timesVector(vector: Point, times: number): Point {
  return {
    x: vector.x * times,
    y: vector.y * times,
  };
}
export function addVector(vector: Point, add: Point): Point {
  return {
    x: vector.x + add.x,
    y: vector.y + add.y,
  };
}

export type EditorDialogMode = 'StationEditor' | 'SwitchEditor';

export type EditMode = 'Create' | 'Delete' | 'PlaceTrain' | 'SetPlatform' | 'Station' | 'Info' | 'StationDelete';

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
  timetable: DetailedTimetable;
  trains: Train[];
  switches: Switch[]; // 今は使っていない
  stations: Station[];
  tracks: Track[];
  map: GameMap;
  mapWidth: number;
  mapHeight: number;
  mapContext: MapContext;
  trainMove: TrainMove2;
}
