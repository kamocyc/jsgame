import { assert, removeDuplicates, sum } from '../../common';
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
import { Depot, Point, Station, Track } from '../../model';
import { getDistance, getMidPoint } from '../../trackUtil';
import { CellPoint } from '../extendedMapModel';
import { AgentBase, AgentManagerBase } from './agentManager';
import { AgentManager2 } from './agentManager2';
import { PlacedTrain } from './trainMoveBase';

const hideDraw = false;
const fontName = 'Meiryo';
const imageCache = new Map<string, HTMLImageElement>();

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

type DrawMode = 'Sleeper' | 'Rail' | 'Bridge';

function drawStraightSub(
  ctx: CanvasRenderingContext2D,
  mapContext: MapContext,
  begin: Point,
  end: Point,
  lineDirection: LineDirection,
  isBeginCurve: boolean,
  drawMode: DrawMode
) {
  // ここらへんの値は1セルの大きさに依存するので、CellWidthを使うほうがいいけど、調整が大変なのでとりあえず固定値で
  switch (lineDirection) {
    case 'Horizontal': {
      if (drawMode === 'Sleeper') {
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
      } else if (drawMode === 'Bridge') {
        // 橋
        ctx.fillStyle = 'rgb(230, 230, 230)';
        ctx.beginPath();
        ctx.moveTo(rx(begin.x, mapContext), ry(begin.y + 12, mapContext));
        ctx.lineTo(rx(end.x, mapContext), ry(end.y + 12, mapContext));
        ctx.lineTo(rx(end.x, mapContext), ry(end.y - 12, mapContext));
        ctx.lineTo(rx(begin.x, mapContext), ry(begin.y - 12, mapContext));
        ctx.fill();
      } else if (drawMode === 'Rail') {
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
      if (drawMode === 'Sleeper') {
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
      } else if (drawMode === 'Bridge') {
        // 橋
        ctx.fillStyle = 'rgb(230, 230, 230)';
        ctx.beginPath();
        ctx.moveTo(rx(begin.x + 12, mapContext), ry(begin.y, mapContext));
        ctx.lineTo(rx(end.x + 12, mapContext), ry(end.y, mapContext));
        ctx.lineTo(rx(end.x - 12, mapContext), ry(end.y, mapContext));
        ctx.lineTo(rx(begin.x - 12, mapContext), ry(begin.y, mapContext));
        ctx.fill();
      } else if (drawMode === 'Rail') {
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
      if (drawMode === 'Sleeper') {
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
      } else if (drawMode === 'Bridge') {
        // 橋
        ctx.fillStyle = 'rgb(230, 230, 230)';
        ctx.beginPath();
        ctx.moveTo(rx(begin.x - 9, mapContext), ry(begin.y - 9, mapContext));
        ctx.lineTo(rx(end.x - 9, mapContext), ry(end.y - 9, mapContext));
        ctx.lineTo(rx(end.x + 9, mapContext), ry(end.y + 9, mapContext));
        ctx.lineTo(rx(begin.x + 9, mapContext), ry(begin.y + 9, mapContext));
        ctx.fill();
      } else if (drawMode === 'Rail') {
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
      if (drawMode === 'Sleeper') {
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
      } else if (drawMode === 'Bridge') {
        // 橋
        ctx.fillStyle = 'rgb(230, 230, 230)';
        ctx.beginPath();
        ctx.moveTo(rx(begin.x - 9, mapContext), ry(begin.y + 9, mapContext));
        ctx.lineTo(rx(end.x - 9, mapContext), ry(end.y + 9, mapContext));
        ctx.lineTo(rx(end.x + 9, mapContext), ry(end.y - 9, mapContext));
        ctx.lineTo(rx(begin.x + 9, mapContext), ry(begin.y - 9, mapContext));
        ctx.fill();
      } else if (drawMode === 'Rail') {
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
  drawMode: DrawMode
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

  drawStraightSub(ctx, mapContext, begin, end, lineType.straightType, false, drawMode);
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
  drawMode: DrawMode
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
    drawMode
  );
}

function drawCurve(
  ctx: CanvasRenderingContext2D,
  mapContext: MapContext,
  position: Point,
  lineType: LineTypeCurve,
  drawMode: DrawMode
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
    drawMode
  );
  drawStraightSub(
    ctx,
    mapContext,
    center,
    end,
    xyToLineDirection(curveTypeToPositionMap[lineType.curveType].end),
    true,
    drawMode
  );
}

function drawBranch(
  ctx: CanvasRenderingContext2D,
  mapContext: MapContext,
  position: Point,
  lineType: LineTypeBranch,
  drawMode: DrawMode
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
    drawMode
  );
  drawStraightSub(
    ctx,
    mapContext,
    center,
    end2,
    xyToLineDirection(branchTypeToPositionMap[lineType.branchType].end2),
    true,
    drawMode
  );
}

function drawLineType(
  ctx: CanvasRenderingContext2D,
  mapContext: MapContext,
  position: Point,
  lineType: LineType,
  drawMode: DrawMode
) {
  if (lineType.lineClass === 'Branch') {
    drawBranch(ctx, mapContext, position, lineType as LineTypeBranch, drawMode);
  } else if (lineType.lineClass === 'Straight') {
    drawStraight(ctx, mapContext, position, lineType as LineTypeStraight, drawMode);
  } else if (lineType.lineClass === 'Terminal') {
    drawTerminal(ctx, mapContext, position, lineType as LineTypeTerminal, drawMode);
  } else if (lineType.lineClass === 'Curve') {
    drawCurve(ctx, mapContext, position, lineType as LineTypeCurve, drawMode);
  }
}

function drawText(ctx: CanvasRenderingContext2D, mapContext: MapContext, text: string, position: Point) {
  const metrics = ctx.measureText(text);
  
  const fillColor = ctx.fillStyle;
  ctx.fillStyle = 'rgb(64, 64, 64, 0.8)';
  ctx.fillRect(rx(position.x, mapContext) - metrics.width / 2, ry(position.y, mapContext) - 15, metrics.width, 20);
  ctx.fillStyle = fillColor;
  ctx.fillText(text, rx(position.x, mapContext) - metrics.width / 2, ry(position.y, mapContext));
}

function getPlatformAgentNumber(agentManager_: AgentManagerBase, platformId: string) {
  if (agentManager_.agentManagerType !== 'AgentManager2') return;
  const agentManager = agentManager_ as AgentManager2;

  const counts = agentManager.getNumberOfAgentsInPlatform();
  return sum(counts.entries().filter(([keys, v]) => keys[1] === platformId).map(([keys, v]) => v));
}

function drawDepots(
  ctx: CanvasRenderingContext2D,
  mapContext: MapContext,
  tracks: Track[],
  showInfo: boolean
) {
  const fontSize = 14;
  const depots = removeDuplicates(tracks.filter((track) => track.track.depotLine != null).map((track) => track.track.depotLine!.depot), (d1, d2) => d1.depotId === d2.depotId);
  const drawnDepotPoints: Map<string, Point[]> = new Map(depots.map((d) => [d.depotId, []]));

  for (const track of tracks) {
    if (track.track.depotLine) {
      const leftX = track.begin.x < track.end.x ? track.begin.x : track.end.x;
      ctx.fillStyle = 'yellow';
      ctx.fillRect(
        rx(leftX + 2, mapContext),
        ry((track.begin.y + track.end.y) / 2 - 6, mapContext),
        (CellWidth - 4) * mapContext.scale,
        3 * mapContext.scale
      );

      if (showInfo) {
        ctx.fillStyle = 'white';

        // platformの名前を描画
        const name = track.track.depotLine.depotLineName;
        ctx.font = 'bold ' + fontSize.toString() + 'px ' + fontName;
        drawText(ctx, mapContext, name, {
          x: (track.begin.x + track.end.x) / 2 - 10,
          y: (track.begin.y + track.end.y) / 2 - 5,
        });
      }

      const depot = depots.find((depot) => depot.depotId === track.track.depotLine!.depot.depotId);
      assert(depot !== undefined);

      drawnDepotPoints.get(depot.depotId)!.push(track.begin);
    }
  }

  // 車庫名を描画
  ctx.fillStyle = '#ffcccc';
  for (const [depotId, points] of drawnDepotPoints) {
    const depot = depots.find((depot) => depot.depotId === depotId)!;
    const name = depot.depotName;
    const x = points.reduce((acc, p) => acc + p.x, 0) / points.length;
    const y = Math.max(...points.map((p) => p.y));
    drawText(ctx, mapContext, name, { x: x, y: y + 10 });
  }
  ctx.fillStyle = 'black'
}

function drawStations(
  ctx: CanvasRenderingContext2D,
  mapContext: MapContext,
  stations: Station[],
  tracks: Track[],
  agentManager: AgentManagerBase,
  showInfo: boolean,
) {
  const fontSize = 14;

  const drawnStationPoints: Map<string, Point[]> = new Map(stations.map((s) => [s.stationId, []]));

  for (const track of tracks) {
    if (track.track.platform) {
      const image = imageCache.get('platform')!;
      ctx.drawImage(
        image,
        rx((track.begin.x + track.end.x) / 2 - image.width / 2, mapContext),
        ry((track.begin.y + track.end.y) / 2 - 6, mapContext),
        image.width * mapContext.scale,
        image.height * mapContext.scale
      );

      if (showInfo) {
        ctx.fillStyle = 'white';

        // platformの名前を描画
        const name = track.track.platform.platformName;
        ctx.font = 'bold ' + fontSize.toString() + 'px ' + fontName;
        drawText(ctx, mapContext, name, {
          x: (track.begin.x + track.end.x) / 2 - 10,
          y: (track.begin.y + track.end.y) / 2 - 5,
        });

        // platformにいるagentの数を描画
        const numberOfAgents = getPlatformAgentNumber(agentManager, track.track.platform.platformId);
        if (numberOfAgents !== undefined) {
          ctx.font = 'bold ' + fontSize.toString() + 'px ' + fontName;
          drawText(ctx, mapContext, '(' + numberOfAgents.toString() + ')', {
            x: (track.begin.x + track.end.x) / 2 + 10,
            y: (track.begin.y + track.end.y) / 2 - 5,
          });
        }
      }

      const station = stations.find((station) =>
        station.platforms.some((platform) => platform.platformId === track.track.platform!.platformId)
      );
      assert(station !== undefined);

      drawnStationPoints.get(station.stationId)!.push(track.begin);
    }
  }

  // 駅名を描画
  ctx.fillStyle = '#ffcccc';
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

function drawExtendedMap(
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
        } else if (extendedCell.crossRoad) {
          image.src = './images/road_cross.png';
          drawCellImage(mapContext, ctx, image, toCY(position));
        }
      } else if (extendedCell.type === 'Construct') {
        if (extendedCell.constructType === 'House') {
          if (hideDraw) {
            ctx.fillStyle = '#ffffff'
            drawText(ctx, mapContext, '家', toCY(position))
          } else {
            drawCellImage(mapContext, ctx, imageCache.get('house')!, toCY(position));
          }
        } else if (extendedCell.constructType === 'Shop') {
          if (hideDraw) {
            ctx.fillStyle = '#ffffff'
            drawText(ctx, mapContext, '店', toCY(position));
          } else {
            drawCellImage(mapContext, ctx, imageCache.get('shop')!, toCY(position));
          }
        } else if (extendedCell.constructType === 'Office') {
          if (hideDraw) {
            ctx.fillStyle = '#ffffff'
            drawText(ctx, mapContext, '職', toCY(position));
          } else {
            drawCellImage(mapContext, ctx, imageCache.get('office')!, toCY(position));
          }
        }
      }
    }
  }
}

function drawTerrain(ctx: CanvasRenderingContext2D, extendedMap: ExtendedGameMap, mapContext: MapContext) {
  for (let x = 0; x < extendedMap.length; x++) {
    for (let y = 0; y < extendedMap[0].length; y++) {
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
      ctx.fillRect(
        rx(x * CellWidth, mapContext),
        ry(y * CellHeight + CellHeight, mapContext),
        CellWidth * mapContext.scale,
        CellHeight * mapContext.scale
      );
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

function drawAgent(ctx: CanvasRenderingContext2D, mapContext: MapContext, agent: AgentBase) {
  const position = agent.position;

  // 塗りつぶした円を描画
  ctx.beginPath();
  ctx.strokeStyle = 'blue';
  ctx.fillStyle = 'blue';
  ctx.arc(rx(position.x, mapContext), ry(position.y, mapContext), 5 * mapContext.scale, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.fill();

  ctx.strokeStyle = 'black';
  ctx.fillStyle = 'black';
}

export function drawEditor(appStates: AppStates, mouseStartCell: Cell | null = null, mouseEndCell: Cell | null = null) {
  const { stations, tracks, trainMove, map, extendedMap, mapWidth, mapHeight, mapContext, agentManager } = appStates;

  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;

  if (imageCache.size === 0) {
    // 画像をキャッシュ
    const imageNames = ['house', 'shop', 'office', 'platform', 'train'];
    for (const imageName of imageNames) {
      const image = new Image();
      image.src = './images/' + imageName + '.png';
      imageCache.set(imageName, image);
    }
  }

  // clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 背景色を描画
  drawTerrain(ctx, extendedMap, mapContext);

  // extended Mapを描画
  drawExtendedMap(mapContext, ctx, mapWidth, mapHeight, extendedMap);

  if (appStates.showInfo) {
    // 罫線を描画
    ctx.strokeStyle = 'rgb(0, 0, 0, 0.2)';
    for (let x = 0; x <= mapWidth; x++) {
      drawLine(ctx, mapContext, { x: x * CellWidth, y: 0 }, { x: x * CellWidth, y: mapHeight * CellHeight });
    }
    for (let y = 0; y <= mapHeight; y++) {
      drawLine(ctx, mapContext, { x: 0, y: y * CellHeight }, { x: mapWidth * CellWidth, y: y * CellHeight });
    }
    ctx.strokeStyle = 'black';
  }

  // マップを描画
  for (let x = 0; x < mapWidth; x++) {
    for (let y = 0; y < mapHeight; y++) {
      const cell = map[x][y];
      if (cell.lineType && (extendedMap[x][y].terrain === 'Water' || hideDraw)) {
        drawLineType(ctx, mapContext, cell.position, cell.lineType, 'Bridge');
      }
    }
  }
  if (!hideDraw) {
    for (let x = 0; x < mapWidth; x++) {
      for (let y = 0; y < mapHeight; y++) {
        const cell = map[x][y];
        if (cell.lineType) {
          drawLineType(ctx, mapContext, cell.position, cell.lineType, 'Sleeper');
        }
      }
    }
    for (let x = 0; x < mapWidth; x++) {
      for (let y = 0; y < mapHeight; y++) {
        const cell = map[x][y];
        if (cell.lineType) {
          drawLineType(ctx, mapContext, cell.position, cell.lineType, 'Rail');
        }
      }
    }
  }

  // 駅
  drawStations(ctx, mapContext, stations, tracks, appStates.agentManager, appStates.showInfo);
  
  // 車庫
  drawDepots(ctx, mapContext, tracks, appStates.showInfo);

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
    drawTrain(ctx, mapContext, train, appStates.agentManager, appStates.showInfo);
  }

  // エージェントを描画
  for (const agent of agentManager.getAgents()) {
    drawAgent(ctx, mapContext, agent);
  }
}

function drawTrain(
  ctx: CanvasRenderingContext2D,
  mapContext: MapContext,
  train: PlacedTrain,
  agentManager: AgentManagerBase,
  showInfo: boolean
) {
  const position = train.position;

  if (!hideDraw) {
    const image = imageCache.get('train')!;
    ctx.drawImage(
      image,
      rx(position.x - image.width / 2, mapContext),
      ry(position.y + image.height / 2, mapContext),
      image.width * mapContext.scale,
      image.height * mapContext.scale
    );

    if (showInfo) {
      // 車両名を表示
      ctx.fillStyle = '#ffcccc';
      ctx.font = '15px ' + fontName + ' bold';
      drawText(ctx, mapContext, train.placedTrainName, position);

      // 乗っている人数
      const numberOfAgents = agentManager
        .getAgents()
        .filter((agent) => agent.placedTrain?.placedTrainId === train.placedTrainId).length;
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px ' + fontName;
      drawText(ctx, mapContext, numberOfAgents.toString(), { x: position.x, y: position.y + 15 });
    }
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
