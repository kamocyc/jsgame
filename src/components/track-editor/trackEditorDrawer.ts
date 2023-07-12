import { assert } from '../../common';
import {
  AppStates,
  Cell,
  CellHeight,
  CellWidth,
  LineType,
  LineTypeBranch,
  LineTypeCurve,
  LineTypeStraight,
  LineTypeTerminal,
  MapContext,
  addVector,
  timesVector,
} from '../../mapEditorModel';
import { Point, Station, Track } from '../../model';

function rx(x: number, mapContext: MapContext) {
  return (x + mapContext.offsetX) * mapContext.scale;
}
function ry(y: number, mapContext: MapContext) {
  return (mapContext.mapTotalHeight - y + mapContext.offsetY) * mapContext.scale;
}
function r_(position: Point, mapContext: MapContext): Point {
  return { x: rx(position.x, mapContext), y: ry(position.y, mapContext) };
}

function fillRect(
  ctx: CanvasRenderingContext2D,
  mapContext: MapContext,
  x: number,
  y: number,
  width: number,
  height: number
) {
  ctx.fillRect(rx(x, mapContext), ry(y + height, mapContext), width * mapContext.scale, height * mapContext.scale);
}

function drawLine(ctx: CanvasRenderingContext2D, mapContext: MapContext, begin: Point, end: Point) {
  ctx.beginPath();
  ctx.moveTo(rx(begin.x, mapContext), ry(begin.y, mapContext));
  ctx.lineTo(rx(end.x, mapContext), ry(end.y, mapContext));
  ctx.stroke();
}

function drawStraight(
  ctx: CanvasRenderingContext2D,
  mapContext: MapContext,
  position: Point,
  lineType: LineTypeStraight
) {
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
  drawLine(ctx, mapContext, begin, end);
  ctx.strokeStyle = 'black';
}

function drawTerminal(
  ctx: CanvasRenderingContext2D,
  mapContext: MapContext,
  position: Point,
  lineType: LineTypeTerminal
) {
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
  drawLine(ctx, mapContext, begin, end);
}

function drawCurve(ctx: CanvasRenderingContext2D, mapContext: MapContext, position: Point, lineType: LineTypeCurve) {
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
  drawLine(ctx, mapContext, begin, center);
  drawLine(ctx, mapContext, center, end);
  ctx.strokeStyle = 'black';
}

function drawBranch(ctx: CanvasRenderingContext2D, mapContext: MapContext, position: Point, lineType: LineTypeBranch) {
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
  drawLine(ctx, mapContext, begin, end1);
  drawLine(ctx, mapContext, center, end2);
  ctx.strokeStyle = 'black';
}

function drawLineType(ctx: CanvasRenderingContext2D, mapContext: MapContext, position: Point, lineType: LineType) {
  if (lineType.lineClass === 'Branch') {
    drawBranch(ctx, mapContext, position, lineType as LineTypeBranch);
  } else if (lineType.lineClass === 'Straight') {
    drawStraight(ctx, mapContext, position, lineType as LineTypeStraight);
  } else if (lineType.lineClass === 'Terminal') {
    drawTerminal(ctx, mapContext, position, lineType as LineTypeTerminal);
  } else if (lineType.lineClass === 'Curve') {
    drawCurve(ctx, mapContext, position, lineType as LineTypeCurve);
  }
}

function drawStations(ctx: CanvasRenderingContext2D, mapContext: MapContext, stations: Station[], tracks: Track[]) {
  const fontSize = 15;

  const drawnStationPoints: Map<string, Point[]> = new Map(stations.map((s) => [s.stationId, []]));

  for (const track of tracks) {
    ctx.strokeStyle = 'gray';
    drawLine(ctx, mapContext, addVector(track.begin, { x: 1, y: 5 }), addVector(track.end, { x: 1, y: 5 }));

    // 駅はtrackに対応するが、それは2セルにまたがるので、調整が必要。。。
    if (track.track.platform) {
      ctx.strokeStyle = 'red';
      drawLine(ctx, mapContext, track.begin, track.end);
      drawLine(ctx, mapContext, track.begin, track.end);

      const name = track.track.platform.platformName;
      const metrics = ctx.measureText(name);

      // platformの名前を描画
      ctx.font = '10px sans-serif';
      ctx.fillText(
        name,
        rx((track.begin.x + track.end.x) / 2 - metrics.width / 2, mapContext),
        ry((track.begin.y + track.end.y) / 2 - 10, mapContext)
      );

      const station = stations.find((station) =>
        station.platforms.some((platform) => platform.platformId === track.track.platform!.platformId)
      );
      assert(station !== undefined);

      drawnStationPoints.get(station.stationId)!.push(track.begin);
    }
  }

  // 駅名を描画
  ctx.font = fontSize.toString() + 'px sans-serif';
  ctx.fillStyle = '#aa0000';
  for (const [stationId, points] of drawnStationPoints) {
    const station = stations.find((station) => station.stationId === stationId)!;
    const name = station.stationName;
    const metrics = ctx.measureText(name);
    const x = points.reduce((acc, p) => acc + p.x, 0) / points.length;
    const y = Math.max(...points.map((p) => p.y));
    ctx.fillText(name, rx(x - metrics.width / 2, mapContext), ry(y + 10, mapContext));
  }

  ctx.strokeStyle = 'black';
}

export function drawEditor(appStates: AppStates, mouseStartCell: Cell | null = null, mouseEndCell: Cell | null = null) {
  const { stations, tracks, trainMove, map, mapWidth, mapHeight, mapContext } = appStates;

  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;

  // clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 罫線を描画
  ctx.strokeStyle = 'rgb(0, 0, 0, 0.2)';
  for (let x = 0; x <= mapWidth; x++) {
    drawLine(ctx, mapContext, { x: x * CellWidth, y: 0 }, { x: x * CellWidth, y: mapHeight * CellHeight });
  }
  for (let y = 0; y <= mapHeight; y++) {
    drawLine(ctx, mapContext, { x: 0, y: y * CellHeight }, { x: mapWidth * CellWidth, y: y * CellHeight });
  }

  ctx.strokeStyle = 'black';

  drawStations(ctx, mapContext, stations, tracks);

  if (mouseStartCell !== null) {
    ctx.fillStyle = 'rgba(0, 0, 255, 0.3)';
    fillRect(
      ctx,
      mapContext,
      mouseStartCell.position.x * CellWidth,
      mouseStartCell.position.y * CellHeight,
      CellWidth,
      CellHeight
    );
  }
  if (mouseEndCell !== null) {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    fillRect(
      ctx,
      mapContext,
      mouseEndCell.position.x * CellWidth,
      mouseEndCell.position.y * CellHeight,
      CellWidth,
      CellHeight
    );
  }

  if (!map) return;

  for (let x = 0; x < mapWidth; x++) {
    for (let y = 0; y < mapHeight; y++) {
      const cell = map[x][y];
      if (cell.lineType) {
        drawLineType(ctx, mapContext, cell.position, cell.lineType);
      }
    }
  }

  for (const train of trainMove.placedTrains) {
    const position = train.position;

    // 塗りつぶした円を描画
    ctx.beginPath();
    ctx.strokeStyle = 'red';
    ctx.fillStyle = 'red';
    ctx.arc(rx(position.x, mapContext), ry(position.y, mapContext), 10, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fill();

    ctx.strokeStyle = 'black';
    ctx.fillStyle = 'black';
  }
}
