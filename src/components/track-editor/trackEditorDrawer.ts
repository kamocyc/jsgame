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
import { getDistance, getMidPoint } from '../../trackUtil';
import { CellPoint } from '../extendedMapModel';
import { PlacedTrain } from './trainMove2';

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
  isBeginCurve: boolean = false,
  isEndCurve: boolean = false
) {
  // ここらへんの値は1セルの大きさに依存するので、CellWidthを使うほうがいいけど、とりあえず固定値で
  switch (lineDirection) {
    case 'Horizontal':
      ctx.lineWidth = 4 * mapContext.scale;
      // 枕木
      ctx.strokeStyle = 'rgb(145, 145, 145)';
      for (let i = 0; i < getDistance(begin, end) / 8; i++) {
        drawLine(
          ctx,
          mapContext,
          { x: begin.x + i * 8 + 4, y: begin.y + 12 },
          { x: begin.x + i * 8 + 4, y: begin.y - 12 }
        );
      }

      // 線路
      ctx.strokeStyle = 'rgb(89, 47, 24)';
      drawLine(ctx, mapContext, { ...begin, y: begin.y + 8 }, { ...end, y: end.y + 8 });
      drawLine(ctx, mapContext, { ...begin, y: begin.y - 8 }, { ...end, y: end.y - 8 });
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 1;
      break;
    case 'Vertical':
      ctx.lineWidth = 4 * mapContext.scale;
      // 枕木
      ctx.strokeStyle = 'rgb(145, 145, 145)';
      for (let i = 0; i < getDistance(begin, end) / 8; i++) {
        drawLine(
          ctx,
          mapContext,
          { x: begin.x - 12, y: begin.y + i * 8 + 2 },
          { x: begin.x + 12, y: begin.y + i * 8 + 2 }
        );
      }

      // 線路
      ctx.strokeStyle = 'rgb(89, 47, 24)';
      drawLine(ctx, mapContext, { ...begin, x: begin.x + 8 }, { ...end, x: end.x + 8 });
      drawLine(ctx, mapContext, { ...begin, x: begin.x - 8 }, { ...end, x: end.x - 8 });
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 1;
      break;
    case 'TopBottom':
      // 枕木
      ctx.lineWidth = 4 * mapContext.scale;
      ctx.strokeStyle = 'rgb(145, 145, 145)';
      for (let i = 0; i < getDistance(begin, end) / 9; i++) {
        drawLine(
          ctx,
          mapContext,
          { x: begin.x + i * 5 - 7 + 2, y: begin.y - i * 5 - 7 - 2 },
          { x: begin.x + i * 5 + 7 + 2, y: begin.y - i * 5 + 7 - 2 }
        );
      }

      ctx.lineWidth = 3 * mapContext.scale;
      // 線路
      ctx.strokeStyle = 'rgb(89, 47, 24)';
      const begin1 = isBeginCurve ? { x: begin.x - 1, y: begin.y - 7 } : { x: begin.x - 4, y: begin.y - 4 };
      const end1 = { x: end.x - 4, y: end.y - 4 };
      const begin2 = isBeginCurve ? { x: begin.x - 1, y: begin.y + 9 } : { x: begin.x + 4, y: begin.y + 4 };
      const end2 = { x: end.x + 4, y: end.y + 4 };
      drawLine(ctx, mapContext, begin1, end1);
      drawLine(ctx, mapContext, begin2, end2);
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 1;
      break;
    case 'BottomTop':
      if (Math.random() < 0.5) {
        ctx.lineWidth = 3 * mapContext.scale;

        // 線路
        ctx.strokeStyle = 'rgb(89, 47, 24)';
        drawLine(ctx, mapContext, { x: begin.x - 4, y: begin.y + 4 }, { x: end.x - 4, y: end.y + 4 });
        drawLine(ctx, mapContext, { x: begin.x + 4, y: begin.y - 4 }, { x: end.x + 4, y: end.y - 4 });
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
      } else {
        const center = getMidPoint(begin, end);
        const straightTypeToImage = {
          Horizontal: './images/rail_s_0.png',
          Vertical: './images/rail_s_90.png',
          BottomTop: './images/rail_s_45.png',
          TopBottom: './images/rail_s_135.png',
        };
        const image = new Image();
        image.src = straightTypeToImage[lineDirection];
        ctx.drawImage(
          image,
          rx(center.x - image.width / 2, mapContext),
          ry(center.y + image.height / 2, mapContext),
          image.width * mapContext.scale,
          image.height * mapContext.scale
        );
      }
      break;
  }
}

// } else {
//   const center = getMidPoint(begin, end);
//   const straightTypeToImage = {
//     Horizontal: './images/rail_s_0.png',
//     Vertical: './images/rail_s_90.png',
//     BottomTop: './images/rail_s_45.png',
//     TopBottom: './images/rail_s_135.png',
//   };
//   const image = new Image();
//   image.src = straightTypeToImage[lineType.straightType];
//   ctx.drawImage(
//     image,
//     rx(center.x - image.width / 2, mapContext),
//     ry(center.y + image.height / 2, mapContext),
//     image.width * mapContext.scale,
//     image.height * mapContext.scale
//   );
// }
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

  // ctx.strokeStyle = 'green';
  // drawLine(ctx, mapContext, begin, end);

  drawStraightSub(ctx, mapContext, begin, end, lineType.straightType);

  // const center = getMidPoint(begin, end);
  // const straightTypeToImage = {
  //   Horizontal: './images/rail_s_0.png',
  //   Vertical: './images/rail_s_90.png',
  //   BottomTop: './images/rail_s_45.png',
  //   TopBottom: './images/rail_s_135.png',
  // };
  // const image = new Image();
  // image.src = straightTypeToImage[lineType.straightType];
  // ctx.drawImage(
  //   image,
  //   rx(center.x - image.width / 2, mapContext),
  //   ry(center.y + image.height / 2, mapContext),
  //   image.width * mapContext.scale,
  //   image.height * mapContext.scale
  // );

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

  drawStraightSub(ctx, mapContext, begin, center, 'Horizontal');
  drawStraightSub(ctx, mapContext, center, end, 'TopBottom', true, false);

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

  if (lineType.branchType === 'BottomTop_Right') {
    const image = new Image();
    image.src = './images/rail_s_45 - コピー.png';
    ctx.drawImage(
      image,
      rx(center.x - image.width / 2, mapContext),
      ry(center.y + image.height / 2, mapContext),
      image.width * mapContext.scale,
      image.height * mapContext.scale
    );
  } else {
    ctx.strokeStyle = 'blue';
    drawLine(ctx, mapContext, begin, end1);
    drawLine(ctx, mapContext, center, end2);
    ctx.strokeStyle = 'black';
  }
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

function drawBackground(ctx: CanvasRenderingContext2D, mapContext: MapContext) {
  // 草の色にする
  ctx.fillStyle = 'rgb(200, 255, 200)';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = 'rgb(0, 0, 0)';
}

function drawTrainLine(ctx: CanvasRenderingContext2D, mapContext: MapContext, railwayLine: RailwayLine) {
  for (const stop of railwayLine.stops) {
    if (stop.platformPaths !== null) {
      for (const path of stop.platformPaths) {
        ctx.strokeStyle = 'rgb(255, 0, 0)';
        drawLine(ctx, mapContext, path.begin, path.end);
        ctx.strokeStyle = 'rgb(0, 0, 0)';
      }
    }
  }
}

export function drawEditor(appStates: AppStates, mouseStartCell: Cell | null = null, mouseEndCell: Cell | null = null) {
  const { stations, tracks, trainMove, map, extendedMap, mapWidth, mapHeight, mapContext, agentManager } = appStates;

  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;

  // clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 背景色を描画
  drawBackground(ctx, mapContext);

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
  drawStations(ctx, mapContext, stations, tracks);

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
        drawLineType(ctx, mapContext, cell.position, cell.lineType);
      }
    }
  }

  // 選択中の路線
  if (appStates.currentRailwayLine != null) {
    drawTrainLine(ctx, mapContext, appStates.currentRailwayLine);

    for (const stop of appStates.currentRailwayLine.stops) {
      const midPoint = getMidPoint(stop.platformTrack.begin, stop.platformTrack.end);

      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = 'orange';
      ctx.fillText('●', rx(midPoint.x - 8, mapContext), ry(midPoint.y, mapContext));
      ctx.fillStyle = 'black';
    }
  }

  // 作成した路線
  for (const railwayLine of appStates.railwayLines) {
    drawTrainLine(ctx, mapContext, railwayLine);
  }

  // 列車を描画
  for (const train of trainMove.placedTrains) {
    drawTrain(ctx, mapContext, train);
  }

  // エージェントを描画
  for (const agent of agentManager.agents) {
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
function drawTrain(ctx: CanvasRenderingContext2D, mapContext: MapContext, train: PlacedTrain) {
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
