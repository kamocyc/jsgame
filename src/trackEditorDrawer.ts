import { drawLine as drawLine_ } from './drawer';
import {
  Cell,
  CellHeight,
  CellWidth,
  GameMap,
  LineType,
  LineTypeBranch,
  LineTypeCurve,
  LineTypeStraight,
  LineTypeTerminal,
  MapHeight,
  MapWidth,
  addVector,
  timesVector,
} from './mapEditorModel';
import { HalfTrack, Point } from './model';
import { TrainMove2 } from './trainMove2';

function r_(position: Point) {
  return { x: position.x, y: MapHeight * CellHeight - position.y };
}
function fillRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  ctx.fillRect(x, MapHeight * CellHeight - y - height, width, height);
}

function drawLine(ctx: CanvasRenderingContext2D, begin: Point, end: Point) {
  drawLine_(ctx, r_(begin), r_(end));
}

function drawStraight(ctx: CanvasRenderingContext2D, position: Point, lineType: LineTypeStraight) {
  const straightTypeToPositionMap = {
    Horizontal: { begin: { x: -1, y: 0 }, end: { x: 1, y: 0 } },
    Vertical: { begin: { x: 0, y: -1 }, end: { x: 0, y: 1 } },
    BottomTop: { begin: { x: -1, y: -1 }, end: { x: 1, y: 1 } },
    TopBottom: { begin: { x: -1, y: 1 }, end: { x: 1, y: -1 } },
  };
  const straightType = straightTypeToPositionMap[lineType.straightType];

  const begin = addVector(
    addVector(timesVector(position, CellWidth), {
      x: CellWidth / 2,
      y: CellWidth / 2,
    }),
    timesVector(straightType.begin, CellWidth / 2)
  );
  const end = addVector(
    addVector(timesVector(position, CellWidth), {
      x: CellWidth / 2,
      y: CellWidth / 2,
    }),
    timesVector(straightType.end, CellWidth / 2)
  );

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

  const begin = addVector(timesVector(position, CellWidth), {
    x: CellWidth / 2,
    y: CellWidth / 2,
  });
  const end = addVector(
    addVector(timesVector(position, CellWidth), {
      x: CellWidth / 2,
      y: CellWidth / 2,
    }),
    timesVector(angleToPositionMap[lineType.angle], CellWidth / 2)
  );
  drawLine(ctx, begin, end);
}

function drawCurve(ctx: CanvasRenderingContext2D, position: Point, lineType: LineTypeCurve) {
  const curveTypeToPositionMap = {
    Bottom_TopLeft: { begin: { x: 0, y: -1 }, end: { x: -1, y: 1 } },
    Bottom_TopRight: { begin: { x: 0, y: -1 }, end: { x: 1, y: 1 } },
    Top_BottomLeft: { begin: { x: 0, y: 1 }, end: { x: -1, y: -1 } },
    Top_BottomRight: { begin: { x: 0, y: 1 }, end: { x: 1, y: -1 } },
    Left_TopRight: { begin: { x: -1, y: 0 }, end: { x: 1, y: 1 } },
    Left_BottomRight: { begin: { x: -1, y: 0 }, end: { x: 1, y: -1 } },
    Right_TopLeft: { begin: { x: 1, y: 0 }, end: { x: -1, y: 1 } },
    Right_BottomLeft: { begin: { x: 1, y: 0 }, end: { x: -1, y: -1 } },
  };

  const curveType = curveTypeToPositionMap[lineType.curveType];
  const center = addVector(timesVector(position, CellWidth), {
    x: CellWidth / 2,
    y: CellWidth / 2,
  });
  const begin = addVector(center, timesVector(curveType.begin, CellWidth / 2));
  const end = addVector(center, timesVector(curveType.end, CellWidth / 2));

  // カーブはとりあえず色は赤にする
  ctx.strokeStyle = 'red';
  drawLine(ctx, begin, center);
  drawLine(ctx, center, end);
  ctx.strokeStyle = 'black';
}

function drawBranch(ctx: CanvasRenderingContext2D, position: Point, lineType: LineTypeBranch) {
  const branchTypeToPositionMap = {
    Horizontal_TopLeft: {
      begin: { x: 1, y: 0 },
      end1: { x: -1, y: 0 },
      end2: { x: -1, y: 1 },
    },
    Horizontal_TopRight: {
      begin: { x: 1, y: 0 },
      end1: { x: -1, y: 0 },
      end2: { x: 1, y: 1 },
    },
    Horizontal_BottomLeft: {
      begin: { x: 1, y: 0 },
      end1: { x: -1, y: 0 },
      end2: { x: -1, y: -1 },
    },
    Horizontal_BottomRight: {
      begin: { x: 1, y: 0 },
      end1: { x: -1, y: 0 },
      end2: { x: 1, y: -1 },
    },
    Vertical_TopLeft: {
      begin: { x: 0, y: -1 },
      end1: { x: 0, y: 1 },
      end2: { x: -1, y: 1 },
    },
    Vertical_TopRight: {
      begin: { x: 0, y: -1 },
      end1: { x: 0, y: 1 },
      end2: { x: 1, y: 1 },
    },
    Vertical_BottomLeft: {
      begin: { x: 0, y: -1 },
      end1: { x: 0, y: 1 },
      end2: { x: -1, y: -1 },
    },
    Vertical_BottomRight: {
      begin: { x: 0, y: -1 },
      end1: { x: 0, y: 1 },
      end2: { x: 1, y: -1 },
    },
    BottomTop_Top: {
      begin: { x: -1, y: -1 },
      end1: { x: 1, y: 1 },
      end2: { x: 0, y: 1 },
    },
    BottomTop_Bottom: {
      begin: { x: -1, y: -1 },
      end1: { x: 1, y: 1 },
      end2: { x: 0, y: -1 },
    },
    BottomTop_Left: {
      begin: { x: -1, y: -1 },
      end1: { x: 1, y: 1 },
      end2: { x: -1, y: 0 },
    },
    BottomTop_Right: {
      begin: { x: -1, y: -1 },
      end1: { x: 1, y: 1 },
      end2: { x: 1, y: 0 },
    },
    TopBottom_Top: {
      begin: { x: 1, y: -1 },
      end1: { x: -1, y: 1 },
      end2: { x: 0, y: 1 },
    },
    TopBottom_Bottom: {
      begin: { x: 1, y: -1 },
      end1: { x: -1, y: 1 },
      end2: { x: 0, y: -1 },
    },
    TopBottom_Left: {
      begin: { x: 1, y: -1 },
      end1: { x: -1, y: 1 },
      end2: { x: -1, y: 0 },
    },
    TopBottom_Right: {
      begin: { x: 1, y: -1 },
      end1: { x: -1, y: 1 },
      end2: { x: 1, y: 0 },
    },
  };

  const curveType = branchTypeToPositionMap[lineType.branchType];
  const center = addVector(timesVector(position, CellWidth), {
    x: CellWidth / 2,
    y: CellWidth / 2,
  });
  const begin = addVector(center, timesVector(curveType.begin, CellWidth / 2));
  const end1 = addVector(center, timesVector(curveType.end1, CellWidth / 2));
  const end2 = addVector(center, timesVector(curveType.end2, CellWidth / 2));

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

function _y(y: number) {
  return y + 10;
}
function _x(x: number) {
  return x + 10;
}

function drawTracks(ctx: CanvasRenderingContext2D, tracks: HalfTrack[]) {
  const fontSize = 15;

  for (const track of tracks) {
    // ctx.strokeStyle = 'gray';
    // drawLine(ctx, addVector(track._begin, { x: 10, y: 10 }), addVector(track._end, { x: 10, y: 10 }));
    // 駅はtrackに対応するが、それは2セルにまたがるので、調整が必要。。。
    if (track.track.station) {
      ctx.beginPath();
      ctx.strokeStyle = 'red';
      ctx.arc(
        (track._begin.x + track._end.x) / 2,
        MapHeight * CellHeight - (track._begin.y + track._end.y) / 2,
        5,
        0,
        2 * Math.PI
      );
      ctx.stroke();

      // stationの名前を描画
      ctx.font = fontSize.toString() + 'px sans-serif';

      const name = track.track.station.stationName;
      const metrics = ctx.measureText(name);
      ctx.fillText(
        name,
        _x((track._begin.x + track._end.x) / 2 - metrics.width / 2),
        MapHeight * CellHeight - _y((track._begin.y + track._end.y) / 2 + 30)
      );

      ctx.strokeStyle = 'gray';
    }
  }
  ctx.strokeStyle = 'black';
}

export function drawEditor(
  trainMove: TrainMove2,
  tracks: HalfTrack[],
  map?: GameMap,
  mouseStartCell: Cell | null = null,
  mouseEndCell: Cell | null = null
) {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;

  // clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 罫線を描画
  for (let x = 0; x <= MapWidth; x++) {
    drawLine(ctx, { x: x * CellWidth, y: 0 }, { x: x * CellWidth, y: MapHeight * CellHeight });
  }
  for (let y = 0; y <= MapHeight; y++) {
    drawLine(ctx, { x: 0, y: y * CellHeight }, { x: MapWidth * CellWidth, y: y * CellHeight });
  }

  drawTracks(ctx, tracks);

  if (mouseStartCell !== null) {
    ctx.fillStyle = 'rgba(0, 0, 255, 0.3)';
    fillRect(ctx, mouseStartCell.position.x * CellWidth, mouseStartCell.position.y * CellHeight, CellWidth, CellHeight);
  }
  if (mouseEndCell !== null) {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    fillRect(ctx, mouseEndCell.position.x * CellWidth, mouseEndCell.position.y * CellHeight, CellWidth, CellHeight);
  }

  if (!map) return;

  for (let x = 0; x < MapWidth; x++) {
    for (let y = 0; y < MapHeight; y++) {
      const cell = map[x][y];
      if (cell.lineType) {
        drawLineType(ctx, cell.position, cell.lineType);
      }
    }
  }

  for (const train of trainMove.trains) {
    const position = train.position;

    // 塗りつぶした円を描画
    ctx.beginPath();
    ctx.strokeStyle = 'red';
    ctx.fillStyle = 'red';
    ctx.arc(position.x, MapHeight * CellHeight - position.y, 10, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fill();

    ctx.strokeStyle = 'black';
    ctx.fillStyle = 'black';
  }

  // if (document.getElementById('time')) {
  //   document.getElementById('time')!.innerHTML = trainMove.toStringGlobalTime();
  // }
}
