export type CellType = 'Road' | 'Construct';

export type ExtendedCellRoad = {
  type: 'Road';
  rightRoad: boolean;
  leftRoad: boolean;
  topRoad: boolean;
  bottomRoad: boolean;
};

export type ExtendedCellConstruct = {
  type: 'Construct';
};
