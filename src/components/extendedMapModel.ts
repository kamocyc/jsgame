import { CellHeight, CellWidth } from '../mapEditorModel';
import { Point } from '../model';

export interface CellPoint {
  cx: number;
  cy: number;
}

export type CellType = 'Road' | 'Construct';

export interface ExtendedCellBase {
  position: CellPoint;
  type: CellType | 'None';
  terrain: 'Grass' | 'Water' | 'Sand' | 'Mountain';
}

export interface ExtendedCellRoad extends ExtendedCellBase {
  type: 'Road';
  rightRoad: boolean;
  leftRoad: boolean;
  topRoad: boolean;
  bottomRoad: boolean;
}

export type ConstructType = 'House' | 'Shop' | 'Office';

export interface ExtendedCellConstruct extends ExtendedCellBase {
  type: 'Construct';
  constructType: ConstructType;
}

export interface ExtendedCellNone extends ExtendedCellBase {
  type: 'None';
}

export type ExtendedCell = ExtendedCellNone | ExtendedCellRoad | ExtendedCellConstruct;

export function toPixelPosition(position: CellPoint): Point {
  return {
    x: position.cx * CellWidth,
    y: position.cy * CellHeight,
  };
}

export function toCellPosition(position: Point): CellPoint {
  return {
    cx: Math.floor(position.x / CellWidth),
    cy: Math.floor(position.y / CellHeight),
  };
}
