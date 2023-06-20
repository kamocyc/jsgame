import Konva from 'konva';
import { generateId } from '../../model';
import { DiaStation, DiaTime, DiaTrain } from './timetable-model';

export interface DiagramProps {
  diaStations: DiaStation[];
  inboundDiaTrains: DiaTrain[];
  outboundDiaTrains: DiaTrain[];
}

const canvasHeight = 600;
const virtualCanvasWidth = 2000;
const hitStrokeWidth = 10;

let editMode: 'Edit' | 'Create' = 'Edit';

// 線を伸ばしている途中の線
let drawingLine: Konva.Line | null = null;
let drawingLineTimes: { diaStation: DiaStation; time: number }[] = [];

function drawTimeGrid(layer: Konva.Layer, layerHeight: number, secondWidth: number) {
  const timeGrid = new Konva.Group();
  layer.add(timeGrid);

  let offset = 0;
  while (offset <= 24 * 60 * 60) {
    const hour = Math.floor(offset / 60 / 60);
    const hourText = new Konva.Text({
      x: offset * secondWidth,
      y: 0,
      text: hour.toString(),
      fontSize: 20,
      fontFamily: 'Calibri',
      fill: 'black',
    });
    timeGrid.add(hourText);

    const hourLine = new Konva.Line({
      points: [offset * secondWidth, 0, offset * secondWidth, layerHeight],
      stroke: 'black',
      strokeWidth: 1,
    });
    timeGrid.add(hourLine);

    if (offset < 24 * 60 * 60) {
      // 10分ごとの線を引く
      for (let i = 1; i < 6; i++) {
        const line = new Konva.Line({
          points: [(offset + i * 60 * 10) * secondWidth, 0, (offset + i * 60 * 10) * secondWidth, layerHeight],
          stroke: 'lightgray',
          strokeWidth: 1,
        });
        timeGrid.add(line);
      }
    }

    offset += 60 * 60;
  }
}

function positionToTime(position: number, secondWidth: number) {
  return Math.round(position / secondWidth);
}

function drawStations(
  layer: Konva.Layer,
  stationPositions: (DiaStation & { diagramPosition: number })[],
  secondWidth: number
) {
  const stations = new Konva.Group();
  layer.add(stations);

  for (const stationPosition of stationPositions) {
    const station = new Konva.Group();
    stations.add(station);

    const stationText = new Konva.Text({
      x: 0,
      y: stationPosition.diagramPosition,
      text: stationPosition.diaStationName,
      fontSize: 20,
      fontFamily: 'Calibri',
      fill: 'black',
    });
    station.add(stationText);

    const stationLine = new Konva.Line({
      points: [0, stationPosition.diagramPosition, virtualCanvasWidth, stationPosition.diagramPosition],
      stroke: 'black',
      strokeWidth: 1,
      hitStrokeWidth: hitStrokeWidth,
    });
    station.add(stationLine);

    stationLine.on('click', function (e) {
      if (e.evt.button === 2) {
        // 右クリック
        drawingLine?.stroke('black');
        drawingLine = null;

        if (drawingLineTimes.length >= 2) {
          diaTrain.diaTimes.push(
            drawingLineTimes.map(
              (drawingLineTime) =>
                ({
                  diaStation: drawingLineTime.diaStation,
                  departureTime: drawingLineTime.time,
                  arrivalTime: null,
                  diaTimeId: generateId(),

                  isPassing: false,
                } as DiaTime)
            )
          );
        }
        drawingLineTimes = [];
        return;
      }
      if (drawingLine === null) {
        // クリックしたマウスカーソルを基にした位置を返す
        const mousePosition = e.target.getStage()!.getPointerPosition()!;
        drawingLine = new Konva.Line({
          points: [mousePosition.x, stationPosition.diagramPosition],
          stroke: 'red',
          strokeWidth: 1,
          hitStrokeWidth: hitStrokeWidth,
        });
        layer.add(drawingLine);

        drawingLineTimes.push({
          diaStation: stationPosition,
          time: positionToTime(mousePosition.x, secondWidth),
        });
      } else {
        // 線に駅を追加する

        const mousePosition = e.target.getStage()!.getPointerPosition()!;
        const points = drawingLine.points();

        // 整合性チェック
        if (
          drawingLineTimes.some(
            (drawingLineTime) => drawingLineTime.diaStation.diaStationId === stationPosition.diaStationId
          )
        ) {
          // 既に同じ駅が追加されている。 => 分けないとデータ構造上。。
          return;
        }

        const newTime = positionToTime(mousePosition.x, secondWidth);

        if (drawingLineTimes.length >= 2) {
          const lastTime = drawingLineTimes[drawingLineTimes.length - 1].time;

          if (drawingLineTimes[1].time < drawingLineTimes[0].time) {
            // 時間が少なくなる方向に線を引いている
            if (newTime > lastTime) {
              // 既に線に追加されている駅の時刻よりも遅い時刻を追加しようとしている
              return;
            }
          } else {
            if (lastTime > newTime) {
              // 既に線に追加されている駅の時刻よりも早い時刻を追加しようとしている
              return;
            }
          }
        }

        drawingLineTimes.push({
          diaStation: stationPosition,
          time: newTime,
        });

        points.push(mousePosition.x);
        points.push(stationPosition.diagramPosition);

        drawingLine.points(points);
      }
    });
  }
}

// TODO: 変更を反映する
function drawTrain(
  layer: Konva.Layer,
  stationPositions: { diaStationId: number; diagramPosition: number }[],
  secondWidth: number,
  diaTrain: DiaTrain
) {
  const train = new Konva.Group();
  layer.add(train);

  const positionDiaTimeMap = diaTrain.diaTimes.flatMap((diaTime) => {
    const stationPosition = stationPositions.find(
      (station) => station.diaStationId === diaTime.diaStation.diaStationId
    );
    if (!stationPosition) {
      throw new Error(`station ${diaTime.diaStation.diaStationId} not found`);
    }

    if (diaTime.departureTime == null && diaTime.arrivalTime == null) {
      return [];
    } else if (diaTime.departureTime != null && diaTime.arrivalTime == null) {
      return [
        [diaTime, 'departureTime', [diaTime.departureTime * secondWidth, stationPosition.diagramPosition]] as const,
      ];
    } else if (diaTime.departureTime == null && diaTime.arrivalTime != null) {
      return [[diaTime, 'arrivalTime', [diaTime.arrivalTime * secondWidth, stationPosition.diagramPosition]] as const];
    } else {
      return [
        [diaTime, 'arrivalTime', [diaTime.arrivalTime! * secondWidth, stationPosition.diagramPosition]] as const,
        [diaTime, 'departureTime', [diaTime.departureTime! * secondWidth, stationPosition.diagramPosition]] as const,
      ];
    }
  });

  const positions = positionDiaTimeMap.map(([_, __, position]) => position).flat();
  const line = new Konva.Line({
    points: positions,
    stroke: 'black',
    strokeWidth: 1,
    hitStrokeWidth: 10,
    draggable: true,
  });
  train.add(line);

  line.on('dragmove', function (e) {
    // 横方向にのみ動く
    const x = Math.round(e.target.x() / secondWidth) * secondWidth;
    e.target.x(x);
    e.target.y(0);

    let diaTimeIndex = 0;
    for (const [diaTime_, timeType, _] of positionDiaTimeMap) {
      const diaTime = diaTrain.diaTimes.find((diaTime) => diaTime.diaTimeId === diaTime_.diaTimeId)!;

      if (timeType === 'arrivalTime') {
        diaTime.arrivalTime = Math.round(
          (e.target.attrs.points[diaTimeIndex] + e.target.absolutePosition().x) / secondWidth
        );
      }
      if (timeType === 'departureTime') {
        diaTime.departureTime = Math.round(
          (e.target.attrs.points[diaTimeIndex] + e.target.absolutePosition().x) / secondWidth
        );
      }

      diaTimeIndex += 2;
    }
  });
}

export function initializeKonva(container: HTMLDivElement, props: DiagramProps) {
  const stage = new Konva.Stage({
    container: container,
    // dummy width
    width: 100,
    height: canvasHeight,
    draggable: true,
  });

  const layer = new Konva.Layer();
  stage.add(layer);

  const stationPositions = props.diaStations.map((station, index) => ({
    ...station,
    diagramPosition: index * 50 + 50,
  }));

  const secondWidth = virtualCanvasWidth / 24 / 60 / 60;

  drawTimeGrid(layer, canvasHeight, secondWidth);
  drawStations(layer, stationPositions);

  for (const diaTrain of props.inboundDiaTrains) {
    drawTrain(layer, stationPositions, secondWidth, diaTrain);
  }
  for (const diaTrain of props.outboundDiaTrains) {
    drawTrain(layer, stationPositions, secondWidth, diaTrain);
  }

  function fitStageIntoParentContainer() {
    // TODO: サイズを縮小したときに動作しないので直す
    const containerWidth = (container.parentNode! as HTMLDivElement).offsetWidth;

    stage.width(containerWidth);
    stage.draw();
  }

  fitStageIntoParentContainer();

  // zooming on scroll
  stage.on('wheel', function (e) {
    e.evt.preventDefault();

    const scaleBy = 1.05;
    const stage = e.target.getStage();
    if (stage == null || stage.getPointerPosition() == null) return;

    const oldScale = stage.scaleX();
    const mousePointTo = {
      x: stage.getPointerPosition()!.x / oldScale - stage.x() / oldScale,
      y: stage.getPointerPosition()!.y / oldScale - stage.y() / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

    stage.scale({ x: newScale, y: newScale });
    stage.x(-(mousePointTo.x - stage.getPointerPosition()!.x / newScale) * newScale);
    stage.y(-(mousePointTo.y - stage.getPointerPosition()!.y / newScale) * newScale);
  });

  // TODO: zoomが考慮できていないので直す
  // // stageのドラッグ範囲をcanvas内に制限する
  // stage.on('dragmove', function (e) {
  //   const stage = e.target;
  //   const container = (stage as Stage).container();
  //   const containerWidth = container.clientWidth;
  //   const stageWidth = stage.width();
  //   const stageX = stage.x();
  //   const stageRight = stageX + stageWidth;

  //   if (stageX > 0) {
  //     stage.x(0);
  //   }
  //   if (stageRight < containerWidth) {
  //     stage.x(containerWidth - stageWidth);
  //   }

  //   const stageHeight = stage.height();
  //   const stageY = stage.y();
  //   const stageBottom = stageY + stageHeight;
  //   if (stageY > 0) {
  //     stage.y(0);
  //   }
  //   if (stageBottom < canvasHeight) {
  //     stage.y(canvasHeight - stageHeight);
  //   }
  // });
}
