import { assert } from '../../common';
import {
  AppStates,
  Cell,
  CellHeight,
  CellWidth,
  ExtendedGameMap,
  LineDirection,
  LineType,
  LineTypeBranch,
  LineTypeCurve,
  LineTypeStraight,
  LineTypeTerminal,
  MapContext,
  RailwayLine,
  addVector,
  timesVector,
} from '../../mapEditorModel';
import { Point, Station, Track } from '../../model';
import { perlin2 } from '../../perlin';
import { getDistance, getMidPoint } from '../../trackUtil';
import { CellPoint } from '../extendedMapModel';
import { AgentManagerBase } from './agentManager';
import { PlacedTrain } from './trainMoveBase';

const fontName = 'Meiryo';

function toCY(cellPoint: CellPoint): Point {
  return {
    x: cellPoint.cx,
    y: cellPoint.cy,
  };
}

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

function drawStraightSub(
  ctx: CanvasRenderingContext2D,
  mapContext: MapContext,
  begin: Point,
  end: Point,
  lineDirection: LineDirection,
  isBeginCurve: boolean,
  drawSleeper: boolean
) {
  // ここらへんの値は1セルの大きさに依存するので、CellWidthを使うほうがいいけど、とりあえず固定値で
  switch (lineDirection) {
    case 'Horizontal': {
      if (drawSleeper) {
        // 枕木
        ctx.lineWidth = 4 * mapContext.scale;
        ctx.strokeStyle = 'rgb(145, 145, 145)';
        const begin_ = begin.x < end.x ? begin : end;
        const end_ = begin.x < end.x ? end : begin;
        for (let i = 0; i < getDistance(begin_, end_) / 8; i++) {
          drawLine(
            ctx,
            mapContext,
            { x: begin_.x + i * 8 + 4, y: begin_.y + 6 },
            { x: begin_.x + i * 8 + 4, y: begin_.y - 6 }
          );
        }
      } else {
        // 線路
        ctx.lineWidth = 2 * mapContext.scale;
        ctx.strokeStyle = 'rgb(89, 47, 24)';
        drawLine(ctx, mapContext, { ...begin, y: begin.y + 3 }, { ...end, y: end.y + 3 });
        drawLine(ctx, mapContext, { ...begin, y: begin.y - 3 }, { ...end, y: end.y - 3 });
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
      }
      break;
    }
    case 'Vertical': {
      if (drawSleeper) {
        // 枕木
        ctx.lineWidth = 4 * mapContext.scale;
        ctx.strokeStyle = 'rgb(145, 145, 145)';
        const begin_ = begin.y < end.y ? begin : end;
        const end_ = begin.y < end.y ? end : begin;
        for (let i = 0; i < getDistance(begin_, end_) / 8; i++) {
          drawLine(
            ctx,
            mapContext,
            { x: begin_.x - 6, y: begin_.y + i * 8 + 4 },
            { x: begin_.x + 6, y: begin_.y + i * 8 + 4 }
          );
        }
      } else {
        // 線路
        ctx.lineWidth = 2 * mapContext.scale;
        ctx.strokeStyle = 'rgb(89, 47, 24)';
        drawLine(ctx, mapContext, { ...begin, x: begin.x + 3 }, { ...end, x: end.x + 3 });
        drawLine(ctx, mapContext, { ...begin, x: begin.x - 3 }, { ...end, x: end.x - 3 });
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
      }
      break;
    }
    case 'TopBottom': {
      if (drawSleeper) {
        // 枕木
        ctx.lineWidth = 4 * mapContext.scale;
        ctx.strokeStyle = 'rgb(145, 145, 145)';
        const begin_ = begin.x < end.x ? begin : end;
        const end_ = begin.x < end.x ? end : begin;
        for (let i = 0; i < getDistance(begin_, end_) / 9; i++) {
          drawLine(
            ctx,
            mapContext,
            { x: begin_.x + i * 5 - 5 + 2, y: begin_.y - i * 5 - 5 - 2 },
            { x: begin_.x + i * 5 + 5 + 2, y: begin_.y - i * 5 + 5 - 2 }
          );
        }
      } else {
        // 線路
        ctx.lineWidth = 2 * mapContext.scale;
        ctx.strokeStyle = 'rgb(89, 47, 24)';
        const begin1 = isBeginCurve ? { x: begin.x - 0, y: begin.y - 4 } : { x: begin.x - 2, y: begin.y - 2 };
        const end1 = { x: end.x - 2, y: end.y - 2 };
        const begin2 = isBeginCurve ? { x: begin.x - 0, y: begin.y + 4 } : { x: begin.x + 2, y: begin.y + 2 };
        const end2 = { x: end.x + 2, y: end.y + 2 };
        drawLine(ctx, mapContext, begin1, end1);
        drawLine(ctx, mapContext, begin2, end2);
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
      }
      break;
    }
    case 'BottomTop': {
      if (drawSleeper) {
        // 枕木
        ctx.lineWidth = 4 * mapContext.scale;
        ctx.strokeStyle = 'rgb(145, 145, 145)';
        const begin_ = begin.x < end.x ? begin : end;
        const end_ = begin.x < end.x ? end : begin;
        for (let i = 0; i < getDistance(begin_, end_) / 9; i++) {
          drawLine(
            ctx,
            mapContext,
            { x: begin_.x + i * 5 - 5 + 2, y: begin_.y + i * 5 + 5 + 2 },
            { x: begin_.x + i * 5 + 5 + 2, y: begin_.y + i * 5 - 5 + 2 }
          );
        }
      } else {
        // 線路
        ctx.lineWidth = 2 * mapContext.scale;
        ctx.strokeStyle = 'rgb(89, 47, 24)';
        const begin1 = isBeginCurve ? { x: begin.x - 0, y: begin.y + 4 } : { x: begin.x - 2, y: begin.y + 2 };
        const end1 = { x: end.x - 2, y: end.y + 2 };
        const begin2 = isBeginCurve ? { x: begin.x + 0, y: begin.y - 4 } : { x: begin.x + 2, y: begin.y - 2 };
        const end2 = { x: end.x + 2, y: end.y - 2 };
        drawLine(ctx, mapContext, begin1, end1);
        drawLine(ctx, mapContext, begin2, end2);
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
      }
      break;
    }
  }
}

function drawStraight(
  ctx: CanvasRenderingContext2D,
  mapContext: MapContext,
  position: Point,
  lineType: LineTypeStraight,
  drawSleeper: boolean
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

  drawStraightSub(ctx, mapContext, begin, end, lineType.straightType, false, drawSleeper);

  // ctx.strokeStyle = 'green';
  // drawLine(ctx, mapContext, begin, end);
  // ctx.strokeStyle = 'black';
}

function xyToLineDirection(xy: Point): LineDirection {
  if (xy.x === 1 && xy.y === 0) return 'Horizontal';
  if (xy.x === 1 && xy.y === 1) return 'BottomTop';
  if (xy.x === 0 && xy.y === 1) return 'Vertical';
  if (xy.x === -1 && xy.y === 1) return 'TopBottom';
  if (xy.x === -1 && xy.y === 0) return 'Horizontal';
  if (xy.x === -1 && xy.y === -1) return 'BottomTop';
  if (xy.x === 0 && xy.y === -1) return 'Vertical';
  if (xy.x === 1 && xy.y === -1) return 'TopBottom';

  throw new Error('xyToLineDirection: invalid xy');
}

function drawTerminal(
  ctx: CanvasRenderingContext2D,
  mapContext: MapContext,
  position: Point,
  lineType: LineTypeTerminal,
  drawSleeper: boolean
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
  } as const;

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
  drawStraightSub(
    ctx,
    mapContext,
    begin,
    end,
    xyToLineDirection(angleToPositionMap[lineType.angle]),
    false,
    drawSleeper
  );
  // drawLine(ctx, mapContext, begin, end);
}

function drawCurve(
  ctx: CanvasRenderingContext2D,
  mapContext: MapContext,
  position: Point,
  lineType: LineTypeCurve,
  drawSleeper: boolean
) {
  const curveTypeToPositionMap = {
    Bottom_TopLeft: {
      begin: { x: 0, y: -1 },
      end: { x: -1, y: 1 },
    },
    Bottom_TopRight: {
      begin: { x: 0, y: -1 },
      end: { x: 1, y: 1 },
    },
    Top_BottomLeft: {
      begin: { x: 0, y: 1 },
      end: { x: -1, y: -1 },
    },
    Top_BottomRight: {
      begin: { x: 0, y: 1 },
      end: { x: 1, y: -1 },
    },
    Left_TopRight: {
      begin: { x: -1, y: 0 },
      end: { x: 1, y: 1 },
    },
    Left_BottomRight: {
      begin: { x: -1, y: 0 },
      end: { x: 1, y: -1 },
    },
    Right_TopLeft: {
      begin: { x: 1, y: 0 },
      end: { x: -1, y: 1 },
    },
    Right_BottomLeft: {
      begin: { x: 1, y: 0 },
      end: { x: -1, y: -1 },
    },
  } as const;

  const curveType = curveTypeToPositionMap[lineType.curveType];
  const center = addVector(timesVector(position, CellWidth), {
    x: CellWidth / 2,
    y: CellWidth / 2,
  });
  const begin = addVector(center, timesVector(curveType.begin, CellWidth / 2));
  const end = addVector(center, timesVector(curveType.end, CellWidth / 2));

  drawStraightSub(
    ctx,
    mapContext,
    begin,
    center,
    xyToLineDirection(curveTypeToPositionMap[lineType.curveType].begin),
    false,
    drawSleeper
  );
  drawStraightSub(
    ctx,
    mapContext,
    center,
    end,
    xyToLineDirection(curveTypeToPositionMap[lineType.curveType].end),
    true,
    drawSleeper
  );

  // ctx.strokeStyle = 'red';
  // drawLine(ctx, mapContext, begin, center);
  // drawLine(ctx, mapContext, center, end);
  // ctx.strokeStyle = 'black';
}

function drawBranch(
  ctx: CanvasRenderingContext2D,
  mapContext: MapContext,
  position: Point,
  lineType: LineTypeBranch,
  drawSleeper: boolean
) {
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

  drawStraightSub(
    ctx,
    mapContext,
    begin,
    end1,
    xyToLineDirection(branchTypeToPositionMap[lineType.branchType].end1),
    false,
    drawSleeper
  );
  drawStraightSub(
    ctx,
    mapContext,
    center,
    end2,
    xyToLineDirection(branchTypeToPositionMap[lineType.branchType].end2),
    true,
    drawSleeper
  );

  // ctx.strokeStyle = 'blue';
  // drawLine(ctx, mapContext, begin, end1);
  // drawLine(ctx, mapContext, center, end2);
  // ctx.strokeStyle = 'black';
}

function drawLineType(
  ctx: CanvasRenderingContext2D,
  mapContext: MapContext,
  position: Point,
  lineType: LineType,
  drawSleeper: boolean
) {
  if (lineType.lineClass === 'Branch') {
    drawBranch(ctx, mapContext, position, lineType as LineTypeBranch, drawSleeper);
  } else if (lineType.lineClass === 'Straight') {
    drawStraight(ctx, mapContext, position, lineType as LineTypeStraight, drawSleeper);
  } else if (lineType.lineClass === 'Terminal') {
    drawTerminal(ctx, mapContext, position, lineType as LineTypeTerminal, drawSleeper);
  } else if (lineType.lineClass === 'Curve') {
    drawCurve(ctx, mapContext, position, lineType as LineTypeCurve, drawSleeper);
  }
}

function drawText(ctx: CanvasRenderingContext2D, mapContext: MapContext, text: string, position: Point) {
  const metrics = ctx.measureText(text);
  ctx.fillText(text, rx(position.x - metrics.width / 2, mapContext), ry(position.y, mapContext));
}

function toCellPosition(position: Point): CellPoint {
  return {
    cx: Math.floor(position.x / CellWidth),
    cy: Math.floor(position.y / CellHeight),
  };
}
function drawStations(
  ctx: CanvasRenderingContext2D,
  mapContext: MapContext,
  stations: Station[],
  tracks: Track[],
  agentManager: AgentManagerBase
) {
  const fontSize = 15;

  const drawnStationPoints: Map<string, Point[]> = new Map(stations.map((s) => [s.stationId, []]));

  for (const track of tracks) {
    ctx.strokeStyle = 'gray';
    drawLine(ctx, mapContext, addVector(track.begin, { x: 1, y: 5 }), addVector(track.end, { x: 1, y: 5 }));

    if (track.track.platform) {
      ctx.strokeStyle = 'red';
      drawLine(ctx, mapContext, track.begin, track.end);
      drawLine(ctx, mapContext, track.begin, track.end);

      const image = new Image();
      image.src = './images/platform.png';
      ctx.drawImage(
        image,
        rx((track.begin.x + track.end.x) / 2 - image.width / 2, mapContext),
        ry((track.begin.y + track.end.y) / 2 - 6, mapContext),
        image.width * mapContext.scale,
        image.height * mapContext.scale
      );

      // platformの名前を描画
      const name = track.track.platform.platformName;
      ctx.font = fontSize.toString() + 'px ' + fontName;
      drawText(ctx, mapContext, name, {
        x: (track.begin.x + track.end.x) / 2,
        y: (track.begin.y + track.end.y) / 2 - 10,
      });

      // platformにいるagentの数を描画
      const numberOfAgents = agentManager
        .getAgents()
        .filter(
          (agent) =>
            getDistance(agent.position, getMidPoint(track.begin, track.end)) < CellHeight && agent.status === 'Idle'
        ).length;

      ctx.font = fontSize.toString() + 'px ' + fontName;
      drawText(ctx, mapContext, numberOfAgents.toString(), {
        x: (track.begin.x + track.end.x) / 2 + 10,
        y: (track.begin.y + track.end.y) / 2,
      });

      const station = stations.find((station) =>
        station.platforms.some((platform) => platform.platformId === track.track.platform!.platformId)
      );
      assert(station !== undefined);

      drawnStationPoints.get(station.stationId)!.push(track.begin);
    }
  }

  // 駅名を描画
  ctx.fillStyle = '#aa0000';
  for (const [stationId, points] of drawnStationPoints) {
    const station = stations.find((station) => station.stationId === stationId)!;
    const name = station.stationName;
    const x = points.reduce((acc, p) => acc + p.x, 0) / points.length;
    const y = Math.max(...points.map((p) => p.y));
    drawText(ctx, mapContext, name, { x: x, y: y + 10 });
  }

  ctx.strokeStyle = 'black';
}

function drawCellImage(
  mapContext: MapContext,
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  position: Point
) {
  ctx.drawImage(
    image,
    rx(position.x * CellWidth, mapContext),
    ry(position.y * CellHeight + CellHeight, mapContext),
    CellWidth * mapContext.scale,
    CellHeight * mapContext.scale
  );
}

export function drawExtendedMap(
  mapContext: MapContext,
  ctx: CanvasRenderingContext2D,
  mapWidth: number,
  mapHeight: number,
  extendedMap: ExtendedGameMap
) {
  for (let x = 0; x < mapWidth; x++) {
    for (let y = 0; y < mapHeight; y++) {
      const position = extendedMap[x][y].position;
      const extendedCell = extendedMap[x][y];
      if (extendedCell.type === 'Road') {
        const image = new Image();
        if (extendedCell.bottomRoad || extendedCell.topRoad) {
          image.src = './images/road_v.png';
          drawCellImage(mapContext, ctx, image, toCY(position));
        } else if (extendedCell.leftRoad || extendedCell.rightRoad) {
          image.src = './images/road_h.png';
          drawCellImage(mapContext, ctx, image, toCY(position));
        }
      } else if (extendedCell.type === 'Construct') {
        if (extendedCell.constructType === 'House') {
          const image = new Image();
          image.src = './images/house.png';
          drawCellImage(mapContext, ctx, image, toCY(position));
        } else if (extendedCell.constructType === 'Shop') {
          const image = new Image();
          image.src = './images/shop.png';
          drawCellImage(mapContext, ctx, image, toCY(position));
        } else if (extendedCell.constructType === 'Office') {
          const image = new Image();
          image.src = './images/office.png';
          drawCellImage(mapContext, ctx, image, toCY(position));
        }
      }
    }
  }
}

function drawTerrain(ctx: CanvasRenderingContext2D, extendedMap: ExtendedGameMap, mapContext: MapContext) {
  console.log(perlin2(Math.random() * 10, Math.random() * 10));

  for (let x = 0; x < extendedMap.length; x++) {
    for (let y = 0; y < extendedMap[0].length; y++) {
      if (extendedMap[x][y].terrain !== 'Grass' && extendedMap[x][y].terrainDirection !== 'Center') {
        ctx.fillStyle = '#cfffcb';
        ctx.fillRect(
          rx(x * CellWidth, mapContext),
          ry(y * CellHeight + CellHeight, mapContext),
          CellWidth * mapContext.scale,
          CellHeight * mapContext.scale
        );
      }

      switch (extendedMap[x][y].terrain) {
        case 'Grass':
          ctx.fillStyle = '#cfffcb';
          break;
        case 'Water':
          ctx.fillStyle = '#5fc8e5';
          break;
        case 'Mountain':
          ctx.fillStyle = '#b77f2f';
          break;
        default:
          throw new Error('drawTerrain: invalid terrain (' + extendedMap[x][y].terrain + ')');
      }

      switch (extendedMap[x][y].terrainDirection) {
        case 'Center':
          ctx.fillRect(
            rx(x * CellWidth, mapContext),
            ry(y * CellHeight + CellHeight, mapContext),
            CellWidth * mapContext.scale,
            CellHeight * mapContext.scale
          );
          break;
        case 'Top':
          ctx.fillRect(
            rx(x * CellWidth, mapContext),
            ry(y * CellHeight + CellHeight, mapContext),
            CellWidth * mapContext.scale,
            (CellHeight * mapContext.scale) / 2
          );
          break;
        case 'Bottom':
          ctx.fillRect(
            rx(x * CellWidth, mapContext),
            ry(y * CellHeight + CellHeight / 2, mapContext),
            CellWidth * mapContext.scale,
            (CellHeight * mapContext.scale) / 2
          );
          break;
        case 'Left':
          ctx.fillRect(
            rx(x * CellWidth, mapContext),
            ry(y * CellHeight + CellHeight, mapContext),
            (CellWidth * mapContext.scale) / 2,
            CellHeight * mapContext.scale
          );
          break;
        case 'Right':
          ctx.fillRect(
            rx(x * CellWidth + CellWidth / 2, mapContext),
            ry(y * CellHeight + CellHeight, mapContext),
            (CellWidth * mapContext.scale) / 2,
            CellHeight * mapContext.scale
          );
          break;
        case 'TopLeft':
          ctx.fillRect(
            rx(x * CellWidth, mapContext),
            ry(y * CellHeight + CellHeight, mapContext),
            (CellWidth * mapContext.scale) / 2,
            (CellHeight * mapContext.scale) / 2
          );
          break;
        case 'TopRight':
          ctx.fillRect(
            rx(x * CellWidth + CellWidth / 2, mapContext),
            ry(y * CellHeight + CellHeight, mapContext),
            (CellWidth * mapContext.scale) / 2,
            (CellHeight * mapContext.scale) / 2
          );
          break;
        case 'BottomLeft':
          ctx.fillRect(
            rx(x * CellWidth, mapContext),
            ry(y * CellHeight + CellHeight / 2, mapContext),
            (CellWidth * mapContext.scale) / 2,
            (CellHeight * mapContext.scale) / 2
          );
          break;
        case 'BottomRight':
          ctx.fillRect(
            rx(x * CellWidth + CellWidth / 2, mapContext),
            ry(y * CellHeight + CellHeight / 2, mapContext),
            (CellWidth * mapContext.scale) / 2,
            (CellHeight * mapContext.scale) / 2
          );
          break;
        case 'RevTopLeft':
          ctx.fillRect(
            rx(x * CellWidth + CellWidth / 2, mapContext),
            ry(y * CellHeight + CellHeight, mapContext),
            (CellWidth * mapContext.scale) / 2,
            CellHeight * mapContext.scale
          );
          ctx.fillRect(
            rx(x * CellWidth, mapContext),
            ry(y * CellHeight + CellHeight / 2, mapContext),
            CellWidth * mapContext.scale,
            (CellHeight * mapContext.scale) / 2
          );
          break;
        case 'RevTopRight':
          ctx.fillRect(
            rx(x * CellWidth, mapContext),
            ry(y * CellHeight + CellHeight / 2, mapContext),
            CellWidth * mapContext.scale,
            (CellHeight * mapContext.scale) / 2
          );
          ctx.fillRect(
            rx(x * CellWidth, mapContext),
            ry(y * CellHeight + CellHeight, mapContext),
            (CellWidth * mapContext.scale) / 2,
            CellHeight * mapContext.scale
          );
          break;
        case 'RevBottomLeft':
          ctx.fillRect(
            rx(x * CellWidth, mapContext),
            ry(y * CellHeight + CellHeight, mapContext),
            CellWidth * mapContext.scale,
            (CellHeight * mapContext.scale) / 2
          );
          ctx.fillRect(
            rx(x * CellWidth + CellWidth / 2, mapContext),
            ry(y * CellHeight + CellHeight, mapContext),
            (CellWidth * mapContext.scale) / 2,
            CellHeight * mapContext.scale
          );
          break;
        case 'RevBottomRight':
          ctx.fillRect(
            rx(x * CellWidth, mapContext),
            ry(y * CellHeight + CellHeight, mapContext),
            CellWidth * mapContext.scale,
            (CellHeight * mapContext.scale) / 2
          );
          ctx.fillRect(
            rx(x * CellWidth, mapContext),
            ry(y * CellHeight + CellHeight, mapContext),
            (CellWidth * mapContext.scale) / 2,
            CellHeight * mapContext.scale
          );
          break;
      }
    }
  }
}

function getAngle(begin: Point, end: Point) {
  const dx = end.x - begin.x;
  const dy = end.y - begin.y;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function subVector(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function normalizeVector(a: Point): Point {
  const length = Math.sqrt(a.x * a.x + a.y * a.y);
  return { x: a.x / length, y: a.y / length };
}

function drawArrowedLine(ctx: CanvasRenderingContext2D, mapContext: MapContext, begin: Point, end: Point) {
  drawLine(ctx, mapContext, begin, end);

  // どっちが見やすいのかな
  if (true) {
    // 一定間隔に矢印を描画
    const arrowInterval = 16 / mapContext.scale;
    const arrowSize = 10 / mapContext.scale;
    const arrowAngle = 30;

    const distance = getDistance(begin, end);
    const angle = getAngle(begin, end);
    const angle1 = angle + arrowAngle;
    const angle2 = angle - arrowAngle;

    for (let i = 0; i < distance / arrowInterval; i++) {
      const p = addVector(begin, timesVector(normalizeVector(subVector(end, begin)), arrowInterval * i));
      const end1 = addVector(p, {
        x: -arrowSize * Math.cos((angle1 * Math.PI) / 180),
        y: -arrowSize * Math.sin((angle1 * Math.PI) / 180),
      });
      const end2 = addVector(p, {
        x: -arrowSize * Math.cos((angle2 * Math.PI) / 180),
        y: -arrowSize * Math.sin((angle2 * Math.PI) / 180),
      });
      drawLine(ctx, mapContext, p, end1);
      drawLine(ctx, mapContext, p, end2);
    }
  } else {
    // 終点のみに矢印を描画
    const arrowSize = 5 / mapContext.scale;
    const arrowAngle = 30;

    const angle = getAngle(begin, end);
    const angle1 = angle + arrowAngle;
    const angle2 = angle - arrowAngle;

    const end1 = addVector(end, {
      x: -arrowSize * Math.cos((angle1 * Math.PI) / 180),
      y: -arrowSize * Math.sin((angle1 * Math.PI) / 180),
    });
    const end2 = addVector(end, {
      x: -arrowSize * Math.cos((angle2 * Math.PI) / 180),
      y: -arrowSize * Math.sin((angle2 * Math.PI) / 180),
    });

    drawLine(ctx, mapContext, end, end1);
    drawLine(ctx, mapContext, end, end2);
  }
}

function drawTrainLine(ctx: CanvasRenderingContext2D, mapContext: MapContext, railwayLine: RailwayLine) {
  for (const stop of railwayLine.stops) {
    if (stop.platformPaths !== null) {
      for (const path of stop.platformPaths) {
        ctx.strokeStyle = railwayLine.railwayLineColor;
        ctx.lineWidth = 2;
        if (getDistance(path.begin, path.end) < 3) {
          console.log({ path });
          // drawLine(ctx, mapContext, path.begin, path.end);
        }
        drawArrowedLine(ctx, mapContext, path.begin, path.end);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgb(0, 0, 0)';
      }
    }
  }

  for (const stop of railwayLine.stops) {
    const midPoint = getMidPoint(stop.platformTrack.begin, stop.platformTrack.end);

    ctx.font = 'bold 16px ' + fontName;
    ctx.fillStyle = railwayLine.railwayLineColor;
    ctx.fillText('●', rx(midPoint.x - 8, mapContext), ry(midPoint.y, mapContext));
    ctx.fillStyle = 'black';
  }
}

export function drawEditor(appStates: AppStates, mouseStartCell: Cell | null = null, mouseEndCell: Cell | null = null) {
  const { stations, tracks, trainMove, map, extendedMap, mapWidth, mapHeight, mapContext, agentManager } = appStates;

  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;

  // clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 背景色を描画
  drawTerrain(ctx, extendedMap, mapContext);

  // extended Mapを描画
  drawExtendedMap(mapContext, ctx, mapWidth, mapHeight, extendedMap);

  // 罫線を描画
  ctx.strokeStyle = 'rgb(0, 0, 0, 0.2)';
  for (let x = 0; x <= mapWidth; x++) {
    drawLine(ctx, mapContext, { x: x * CellWidth, y: 0 }, { x: x * CellWidth, y: mapHeight * CellHeight });
  }
  for (let y = 0; y <= mapHeight; y++) {
    drawLine(ctx, mapContext, { x: 0, y: y * CellHeight }, { x: mapWidth * CellWidth, y: y * CellHeight });
  }

  ctx.strokeStyle = 'black';

  // 駅
  drawStations(ctx, mapContext, stations, tracks, appStates.agentManager);

  // マウスがある場所
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

  // マップを描画
  for (let x = 0; x < mapWidth; x++) {
    for (let y = 0; y < mapHeight; y++) {
      const cell = map[x][y];
      if (cell.lineType) {
        drawLineType(ctx, mapContext, cell.position, cell.lineType, true);
      }
    }
  }
  for (let x = 0; x < mapWidth; x++) {
    for (let y = 0; y < mapHeight; y++) {
      const cell = map[x][y];
      if (cell.lineType) {
        drawLineType(ctx, mapContext, cell.position, cell.lineType, false);
      }
    }
  }

  // 選択中の路線
  if (appStates.currentRailwayLine != null) {
    drawTrainLine(ctx, mapContext, appStates.currentRailwayLine);
  }

  // 作成した路線
  for (const railwayLine of appStates.railwayLines) {
    if (
      appStates.selectedRailwayLineId === '__ALL__' ||
      appStates.selectedRailwayLineId === railwayLine.railwayLineId
    ) {
      drawTrainLine(ctx, mapContext, railwayLine);
    }
  }

  // 列車を描画
  for (const train of trainMove.getPlacedTrains()) {
    drawTrain(ctx, mapContext, train, appStates.agentManager);
  }

  // エージェントを描画
  for (const agent of agentManager.getAgents()) {
    const position = agent.position;

    // 塗りつぶした円を描画
    ctx.beginPath();
    ctx.strokeStyle = 'blue';
    ctx.fillStyle = 'blue';
    ctx.arc(rx(position.x, mapContext), ry(position.y, mapContext), 5, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fill();

    ctx.strokeStyle = 'black';
    ctx.fillStyle = 'black';
  }
}

function drawTrain(
  ctx: CanvasRenderingContext2D,
  mapContext: MapContext,
  train: PlacedTrain,
  agentManager: AgentManagerBase
) {
  const position = train.position;

  if (true) {
    const image = new Image();
    image.src = './images/train.png';
    ctx.drawImage(
      image,
      rx(position.x - image.width / 2, mapContext),
      ry(position.y + image.height / 2, mapContext),
      image.width * mapContext.scale,
      image.height * mapContext.scale
    );

    // 車両名を表示
    ctx.fillStyle = 'red';
    ctx.font = '15px ' + fontName + ' bold';
    drawText(ctx, mapContext, train.placedTrainName, position);

    const numberOfAgents = agentManager
      .getAgents()
      .filter((agent) => agent.placedTrain?.placedTrainId === train.placedTrainId).length;
    ctx.fillStyle = 'black';
    ctx.font = '12px ' + fontName;
    drawText(ctx, mapContext, numberOfAgents.toString(), { x: position.x, y: position.y + 15 });
  } else {
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
