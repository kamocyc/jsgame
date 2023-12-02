import { DeepReadonly } from 'ts-essentials';
import { ExtendedCell } from './components/extendedMapModel';
import { AgentManagerBase } from './components/track-editor/agentManager';
import { GlobalTimeManager } from './components/track-editor/globalTimeManager';
import { MapManager } from './components/track-editor/mapManager';
import { MoneyManager } from './components/track-editor/moneyManager';
import { ITrainMove, StoredTrain } from './components/track-editor/trainMoveBase';
import { DetailedTimetable, PlatformLike, Point, StationLike, Switch, Track } from './model';
import { HistoryManager, OutlinedTimetableData } from './outlinedTimetableData';

export const CellWidth = 32;
export const CellHeight = 32;

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
export type ExtendedGameMap = ExtendedCell[][];

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

export type EditMode =
  | 'Create'
  | 'Delete'
  | 'PlaceTrain'
  | 'SetPlatform'
  | 'Station'
  | 'Info'
  | 'ExtendedMap'
  | 'Road'
  | 'LineCreate'
  | 'DepotCreate'
  | 'ShowLine'
  | 'SetTerrain';

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
    mapTotalWidth: mapWidth * CellWidth,
    mapTotalHeight: mapHeight * CellHeight,
  };
}

export interface RailwayLineStop {
  stopId: string;
  platform: PlatformLike;
  platformTrack: Track;
  platformPaths: Track[] | null;
}

export interface RailwayLine {
  railwayLineId: string;
  railwayLineName: string;
  railwayLineColor: string;
  stops: RailwayLineStop[];
  /**
   * 折り返しのStop
   */
  returnStopId: string;
}

export type OperationError = {
  type: string;
  trainId: string;
  diaTimeId: string | null;
  stationId: string | null;
  arrivalOrDeparture: 'arrivalTime' | 'departureTime' | null;
  platformId: string | null;
};

export interface MapState {
  readonly editMode: EditMode;
  readonly showInfo: boolean;
  readonly shouldAutoGrow: boolean;
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly mapContext: MapContext;
  readonly stations: Map<string, StationLike>;
  readonly extendedMap: ExtendedGameMap;
  readonly agentManager: AgentManagerBase;
  currentRailwayLine: RailwayLine | null;
  readonly trainMove: ITrainMove;
  readonly moneyManager: MoneyManager;
  readonly mapManager: MapManager;
}

export interface AppStates {
  readonly globalTimeManager: GlobalTimeManager;
  readonly detailedTimetable: DetailedTimetable;
  outlinedTimetableData: OutlinedTimetableData;
  readonly historyManager: HistoryManager;
  readonly railwayLines: RailwayLine[];
  readonly selectedRailwayLineId: string | null;
  storedTrains: StoredTrain[];

  readonly map: GameMap;
  tracks: Track[];
  readonly mapState: MapState;
}

export function splitStops(
  stops: DeepReadonly<RailwayLineStop[]>,
  returnStopId: string
): { preStops: DeepReadonly<RailwayLineStop>[]; postStops: DeepReadonly<RailwayLineStop>[] } {
  const preStops: DeepReadonly<RailwayLineStop>[] = [];
  const postStops: DeepReadonly<RailwayLineStop>[] = [];

  let isPre = true;
  for (const stop of stops) {
    if (isPre) {
      preStops.push(stop);
    } else {
      postStops.push(stop);
    }

    if (stop.stopId === returnStopId) {
      isPre = false;
      postStops.push(stop);
    }
  }

  if (stops[0] !== undefined) {
    postStops.push(stops[0]);
  }

  return { preStops, postStops };
}
