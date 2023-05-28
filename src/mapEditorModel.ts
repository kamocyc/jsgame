import { HalfTrack, Point } from "./model";

export const mapWidth = 5;
export const mapHeight = 5;

export type Map = Cell[][];

export const CellWidth = 50;
export const CellHeight = 50;

export interface LineType {
  lineClass: 'Straight' | 'Curve' | 'Branch' | 'Terminal';
}

export type LineDirection = 'Horizontal' | 'Vertical' | 'BottomTop' | 'TopBottom';
// 角度は、セル内でLine片がある方向を表す
export type LineAngle = 0 | 45 | 90 | 135 | 180 | 225 | 270 | 315;
export type CurveType = 'Bottom_TopLeft' | 'Bottom_TopRight' | 'Top_BottomLeft' | 'Top_BottomRight' | 'Left_TopRight' | 'Left_BottomRight' | 'Right_TopLeft' | 'Right_BottomLeft';
export type BranchType = 'Horizontal_TopLeft' | 'Horizontal_TopRight' | 'Horizontal_BottomLeft' | 'Horizontal_BottomRight' | 'Vertical_TopLeft' | 'Vertical_TopRight' | 'Vertical_BottomLeft' | 'Vertical_BottomRight'
  | 'DownUp_Top' | 'DownUp_Bottom' | 'DownUp_Left' | 'DownUp_Right' | 'UpDown_Top' | 'UpDown_Bottom' | 'UpDown_Left' | 'UpDown_Right';

export type LineTypeStraight = {
  lineClass: 'Straight';
  straightType: LineDirection;
  tracks: HalfTrack[];
}

export type LineTypeTerminal = {
  lineClass: 'Terminal';
  angle: LineAngle;
  tracks: HalfTrack[];
}

export type LineTypeCurve = {
  lineClass: 'Curve';
  curveType: CurveType;
  tracks: HalfTrack[];
}

export type LineTypeBranch = {
  lineClass: 'Branch';
  branchType: BranchType;
  tracks: HalfTrack[];
}

export interface Cell {
  position: Point;
  lineType: null | LineTypeStraight | LineTypeTerminal | LineTypeCurve | LineTypeBranch;
}

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