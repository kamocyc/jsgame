import { drawLine as drawLine_ } from "./drawer";
import { CellHeight, CellWidth, LineType, LineTypeStraight, LineTypeTerminal, addVector, mapHeight, mapWidth, timesVector, Map, LineTypeCurve, BranchType, LineTypeBranch, Cell } from "./mapEditorModel";
import { Point } from "./model";

function r_(position: Point) {
  return { x: position.x, y: mapHeight * CellHeight - position.y };
}
function fillRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number,) {
  ctx.fillRect(x, mapHeight * CellHeight - y - height, width, height);
}


function drawLine(ctx: CanvasRenderingContext2D, begin: Point, end: Point) {
  drawLine_(ctx, r_(begin), r_(end));
}

function drawStraight(ctx: CanvasRenderingContext2D, position: Point, lineType: LineTypeStraight) {
  const straightTypeToPositionMap = {
    'Horizontal': { begin: { x: -1, y: 0 }, end: { x: 1, y: 0 } },
    'Vertical': { begin: { x: 0, y: -1 }, end: { x: 0, y: 1 } },
    'BottomTop': { begin: { x: -1, y: -1 }, end: { x: 1, y: 1 } },
    'TopBottom': { begin: { x: -1, y: 1 }, end: { x: 1, y: -1 } },
  };
  const straightType = straightTypeToPositionMap[lineType.straightType];

  const begin = addVector(addVector(timesVector(position, 50), { x: 25, y: 25 }), timesVector(straightType.begin, 25));
  const end = addVector(addVector(timesVector(position, 50), { x: 25, y: 25 }), timesVector(straightType.end, 25));

  ctx.strokeStyle = 'green';
  drawLine(ctx, begin, end);
  ctx.strokeStyle = 'black';
}

function drawTerminal(ctx: CanvasRenderingContext2D, position: Point, lineType: LineTypeTerminal) {
  const angleToPositionMap = {
    0: { x: 1, y: 0 },
    45: { x: 1, y: 1 },
    90: { x: 0, y: 1 },
    135: { x: -1, y: 1 },
    180: { x: -1, y: 0 },
    225: { x: -1, y: -1 },
    270: { x: 0, y: -1 },
    315: { x: 1, y: -1 },
  };

  const begin = addVector(timesVector(position, 50), { x: 25, y: 25 });
  const end = addVector(addVector(timesVector(position, 50), { x: 25, y: 25 }), timesVector(angleToPositionMap[lineType.angle], 25));
  drawLine(ctx, begin, end);
}

function drawCurve(ctx: CanvasRenderingContext2D, position: Point, lineType: LineTypeCurve) {
  const curveTypeToPositionMap = {
    'Bottom_TopLeft': { begin: { x: 0, y: -1 }, end: { x: -1, y: 1 }},
    'Bottom_TopRight': { begin: { x: 0, y: -1 }, end: { x: 1, y: 1 }},
    'Top_BottomLeft': { begin: { x: 0, y: 1 }, end: { x: -1, y: -1 }},
    'Top_BottomRight': { begin: { x: 0, y: 1 }, end: { x: 1, y: -1 }},
    'Left_TopRight': { begin: { x: -1, y: 0 }, end: { x: 1, y: 1 }},
    'Left_BottomRight': { begin: { x: -1, y: 0 }, end: { x: 1, y: -1 }},
    'Right_TopLeft': { begin: { x: 1, y: 0 }, end: { x: -1, y: 1 }},
    'Right_BottomLeft': { begin: { x: 1, y: 0 }, end: { x: -1, y: -1 }},
  };

  const curveType = curveTypeToPositionMap[lineType.curveType];
  const center = addVector(timesVector(position, 50), { x: 25, y: 25 });
  const begin = addVector(center, timesVector(curveType.begin, 25));
  const end = addVector(center, timesVector(curveType.end, 25));

  // カーブはとりあえず色は赤にする
  ctx.strokeStyle = 'red';
  drawLine(ctx, begin, center);
  drawLine(ctx, center, end);
  ctx.strokeStyle = 'black';
}

function drawBranch(ctx: CanvasRenderingContext2D, position: Point, lineType: LineTypeBranch) {
  const branchTypeToPositionMap = {
    'Horizontal_TopLeft': { begin: { x: 1, y: 0 }, end1: { x: -1, y: 0}, end2: { x: -1, y: 1 }},
    'Horizontal_TopRight': { begin: { x: 1, y: 0 }, end1: { x: -1, y: 0}, end2: { x: 1, y: 1 }},
    'Horizontal_BottomLeft': { begin: { x: 1, y: 0 }, end1: { x: -1, y: 0}, end2: { x: -1, y: -1 }},
    'Horizontal_BottomRight': { begin: { x: 1, y: 0 }, end1: { x: -1, y: 0}, end2: { x: 1, y: -1 }},
    'Vertical_TopLeft': { begin: { x: 0, y: -1 }, end1: { x: 0, y: 1 }, end2: { x: -1, y: 1 }},
    'Vertical_TopRight': { begin: { x: 0, y: -1 }, end1: { x: 0, y: 1 }, end2: { x: 1, y: 1 }},
    'Vertical_BottomLeft': { begin: { x: 0, y: -1 }, end1: { x: 0, y: 1 }, end2: { x: -1, y: -1 }},
    'Vertical_BottomRight': { begin: { x: 0, y: -1 }, end1: { x: 0, y: 1 }, end2: { x: 1, y: -1 }},
    'BottomTop_Top': { begin: { x: -1, y: -1 }, end1: { x: 1, y: 1 }, end2: { x: 0, y: 1 }},
    'BottomTop_Bottom': { begin: { x: -1, y: -1 }, end1: { x: 1, y: 1 }, end2: { x: 0, y: -1 }},
    'BottomTop_Left': { begin: { x: -1, y: -1 }, end1: { x: 1, y: 1 }, end2: { x: -1, y: 0 }},
    'BottomTop_Right': { begin: { x: -1, y: -1 }, end1: { x: 1, y: 1 }, end2: { x: 1, y: 0 }},
    'TopBottom_Top': { begin: { x: 1, y: -1 }, end1: { x: -1, y: 1 }, end2: { x: 0, y: 1 }},
    'TopBottom_Bottom': { begin: { x: 1, y: -1 }, end1: { x: -1, y: 1 }, end2: { x: 0, y: -1 }},
    'TopBottom_Left': { begin: { x: 1, y: -1 }, end1: { x: -1, y: 1 }, end2: { x: -1, y: 0 }},
    'TopBottom_Right': { begin: { x: 1, y: -1 }, end1: { x: -1, y: 1 }, end2: { x: 1, y: 0 }},
  };
  
  const curveType = branchTypeToPositionMap[lineType.branchType];
  const center = addVector(timesVector(position, 50), { x: 25, y: 25 });
  const begin = addVector(center, timesVector(curveType.begin, 25));
  const end1 = addVector(center, timesVector(curveType.end1, 25));
  const end2 = addVector(center, timesVector(curveType.end2, 25));

  ctx.strokeStyle = 'blue';
  drawLine(ctx, begin, end1);
  drawLine(ctx, center, end2);
  ctx.strokeStyle = 'black';
}

function drawLineType(ctx: CanvasRenderingContext2D, position: Point, lineType: LineType) {
  if (lineType.lineClass === 'Branch') {
    drawBranch(ctx, position, lineType as LineTypeBranch);
  } else if (lineType.lineClass === 'Straight') {
    drawStraight(ctx, position, lineType as LineTypeStraight);
  } else if (lineType.lineClass === 'Terminal') {
    drawTerminal(ctx, position, lineType as LineTypeTerminal);
  } else if (lineType.lineClass === 'Curve') {
    drawCurve(ctx, position, lineType as LineTypeCurve);
  }
}

export function drawEditor(map?: Map, mouseStartCell: Cell | null = null, mouseEndCell: Cell | null = null) {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;

  // clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let x = 0; x <= mapWidth; x ++) {
    drawLine(ctx, { x: x * CellWidth, y: 0 }, { x: x * CellWidth, y: mapHeight * CellHeight });
  }

  for (let y = 0; y <= mapHeight; y ++) {
    drawLine(ctx, { x: 0, y: y * CellHeight }, { x: mapWidth * CellWidth, y: y * CellHeight });
  }

  if (mouseStartCell !== null) {
    ctx.fillStyle = 'rgba(0, 0, 255, 0.3)';
    fillRect(ctx, mouseStartCell.position.x * CellWidth, mouseStartCell.position.y * CellHeight, CellWidth, CellHeight);
  }
  if (mouseEndCell !== null) {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    fillRect(ctx, mouseEndCell.position.x * CellWidth, mouseEndCell.position.y * CellHeight, CellWidth, CellHeight);
  }

  if (!map) return;

  for (let x = 0; x < mapWidth; x ++) {
    for (let y = 0; y < mapHeight; y ++) {
      const cell = map[x][y];
      if (cell.lineType) {
        drawLineType(ctx, cell.position, cell.lineType);
      }
    }
  }
}

