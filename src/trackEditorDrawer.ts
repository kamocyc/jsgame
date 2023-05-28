import { drawLine } from "./drawer";
import { CellHeight, CellWidth, LineType, LineTypeStraight, LineTypeTerminal, addVector, mapHeight, mapWidth, timesVector, Map } from "./mapEditorModel";
import { Point } from "./model";


function drawStraight(ctx: CanvasRenderingContext2D, position: Point, lineType: LineTypeStraight) {
  const straightTypeToPositionMap = {
    'Horizontal': { begin: { x: -1, y: 0 }, end: { x: 1, y: 0 } },
    'Vertical': { begin: { x: 0, y: -1 }, end: { x: 0, y: 1 } },
    'BottomTop': { begin: { x: -1, y: 1 }, end: { x: 1, y: -1 } },
    'TopBottom': { begin: { x: -1, y: -1 }, end: { x: 1, y: 1 } },
  };
  const straightType = straightTypeToPositionMap[lineType.straightType];

  const begin = addVector(addVector(timesVector(position, 50), { x: 25, y: 25 }), timesVector(straightType.begin, 25));
  const end = addVector(addVector(timesVector(position, 50), { x: 25, y: 25 }), timesVector(straightType.end, 25));
  drawLine(ctx, begin, end);
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

function drawLineType(ctx: CanvasRenderingContext2D, position: Point, lineType: LineType) {
  if (lineType.lineClass === 'Branch') {
    // drawBranch(ctx, lineType);
  } else if (lineType.lineClass === 'Straight') {
    drawStraight(ctx, position, lineType as LineTypeStraight);
  } else if (lineType.lineClass === 'Terminal') {
    drawTerminal(ctx, position, lineType as LineTypeTerminal);
  }
}

export function drawEditor(map?: Map) {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;

  for (let x = 0; x < mapWidth; x ++) {
    drawLine(ctx, { x: x * CellWidth, y: 0 }, { x: x * CellWidth, y: mapHeight * CellHeight });
  }

  for (let y = 0; y < mapHeight; y ++) {
    drawLine(ctx, { x: 0, y: y * CellHeight }, { x: mapWidth * CellWidth, y: y * CellHeight });
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
