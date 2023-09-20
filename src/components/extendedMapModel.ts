import { Point } from '../model';

export type CellType = 'Road' | 'Construct';

export type ExtendedCellRoad = { position: Point } & {
  type: 'Road';
  rightRoad: boolean;
  leftRoad: boolean;
  topRoad: boolean;
  bottomRoad: boolean;
};

export type ConstructType = 'House' | 'Shop' | 'Office';

export type ExtendedCellConstruct = { position: Point } & {
  type: 'Construct';
  constructType: ConstructType;
};

export type ExtendedCellNone = { position: Point } & {
  type: 'None';
};

export type ExtendedCell = ExtendedCellNone | ExtendedCellRoad | ExtendedCellConstruct;
