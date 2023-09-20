import { CellHeight, CellWidth } from '../mapEditorModel';
import { Point } from '../model';

export interface CellPoint {
  cx: number;
  cy: number;
}

export type CellType = 'Road' | 'Construct';

export type ExtendedCellRoad = { position: CellPoint } & {
  type: 'Road';
  rightRoad: boolean;
  leftRoad: boolean;
  topRoad: boolean;
  bottomRoad: boolean;
};

export type ConstructType = 'House' | 'Shop' | 'Office';

export type ExtendedCellConstruct = { position: CellPoint } & {
  type: 'Construct';
  constructType: ConstructType;
};

export type ExtendedCellNone = { position: CellPoint } & {
  type: 'None';
};

export type ExtendedCell = ExtendedCellNone | ExtendedCellRoad | ExtendedCellConstruct;

export function toPixelPosition(position: CellPoint): Point {
  return {
    x: position.cx * CellWidth,
    y: position.cy * CellHeight,
  };
}
