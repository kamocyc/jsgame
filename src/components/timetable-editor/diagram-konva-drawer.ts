import Konva from 'konva';
import { Shape, ShapeConfig } from 'konva/lib/Shape';
import { Stage } from 'konva/lib/Stage';
import { DiaTime, Station, Train, generateId } from '../../model';
import { fillMissingTimes } from '../../oudParser';
import { toStringFromSeconds } from './common-component';
import { getDefaultPlatform } from './timetable-util';

export interface DiagramProps {
  diaStations: Station[];
  setUpdate: () => void;
  inboundDiaTrains: Train[];
  outboundDiaTrains: Train[];
}

const hitStrokeWidth = 10;

let editMode: 'Edit' | 'Create' = 'Edit';

// 線を伸ばしている途中の線
let drawingLine: Konva.Line | null = null;
let drawingLineTimes: { diaStation: Station; time: number }[] = [];

const selection: {
  shape: Shape<ShapeConfig> | null;
  lineGroup: Konva.Group;
} = {
  shape: null,
  lineGroup: new Konva.Group(),
};

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

    function drawMinuteLine(i: number) {
      // 2分ごとの線を引く
      for (let j = 1; j < 6; j++) {
        const line = new Konva.Line({
          points: [
            (offset + i * 60 * 10 + j * 2 * 60) * secondWidth,
            0,
            (offset + i * 60 * 10 + j * 2 * 60) * secondWidth,
            layerHeight,
          ],
          stroke: 'lightgray',
          strokeWidth: 1,
          dash: [2, 2],
        });
        timeGrid.add(line);
      }
    }

    drawMinuteLine(0);

    if (offset < 24 * 60 * 60) {
      // 10分ごとの線を引く
      for (let i = 1; i < 6; i++) {
        const line = new Konva.Line({
          points: [(offset + i * 60 * 10) * secondWidth, 0, (offset + i * 60 * 10) * secondWidth, layerHeight],
          stroke: 'lightgray',
          strokeWidth: 1,
        });
        timeGrid.add(line);

        drawMinuteLine(i);
      }
    }

    offset += 60 * 60;
  }
}

function positionToTime(position: number, secondWidth: number) {
  return Math.round(position / secondWidth);
}

function commitDrawingLine(props: DiagramProps): Train | null {
  if (drawingLine === null) {
    return null;
  }

  drawingLine.destroy();
  drawingLine = null;

  if (drawingLineTimes.length >= 2) {
    // 1番目のstationのindexと2番目のstationのindexを比較し、inbound / outboundを判定する
    const firstStationIndex = props.diaStations.findIndex(
      (diaStation) => diaStation.stationId === drawingLineTimes[0].diaStation.stationId
    );
    const secondStationIndex = props.diaStations.findIndex(
      (diaStation) => diaStation.stationId === drawingLineTimes[1].diaStation.stationId
    );
    const direction = firstStationIndex < secondStationIndex ? 'Inbound' : 'Outbound';
    const trains = direction === 'Inbound' ? props.inboundDiaTrains : props.outboundDiaTrains;

    const diaTimes = drawingLineTimes.map(
      (drawingLineTime) =>
        ({
          station: drawingLineTime.diaStation,
          departureTime: drawingLineTime.time,
          arrivalTime: null,
          diaTimeId: generateId(),
          isPassing: false,
          platform: getDefaultPlatform(drawingLineTime.diaStation, direction),
        } as DiaTime)
    );

    trains.push({
      trainId: generateId(),
      trainName: '',
      trainType: undefined,
      diaTimes: diaTimes,
      trainCode: '',
    });

    fillMissingTimes(trains, props.diaStations);

    props.setUpdate();

    drawingLineTimes = [];

    return trains[trains.length - 1];
  }

  drawingLineTimes = [];
  return null;
}

function getPointerPosition(stage: Stage) {
  const vec = stage.getPointerPosition()!;
  return { x: (vec.x - stage.x()) / stage.scaleX(), y: (vec.y - stage.y()) / stage.scaleY() };
}

function drawStationLines(
  layer: Konva.Layer,
  stationPositions: (Station & { diagramPosition: number })[],
  secondWidth: number,
  props: DiagramProps
) {
  const station = new Konva.Group();
  layer.add(station);

  for (const stationPosition of stationPositions) {
    const stationLine = new Konva.Line({
      points: [0, stationPosition.diagramPosition, virtualCanvasWidth, stationPosition.diagramPosition],
      stroke: 'black',
      strokeWidth: 1,
      hitStrokeWidth: hitStrokeWidth,
    });
    station.add(stationLine);

    stationLine.on('mousemove', function (e) {
      if (drawingLine !== null) {
        const mousePosition = getPointerPosition(e.target.getStage()!);
        const points = drawingLine.points();
        points.splice(drawingLineTimes.length * 2);
        points.push(mousePosition.x, stationPosition.diagramPosition);
        drawingLine.points(points);
      }
    });

    stationLine.on('click', function (e) {
      destroySelection();

      if (e.evt.button === 2) {
        // 右クリック
        const train = commitDrawingLine(props);

        if (train !== null) {
          drawTrain(layer, stationPositions, secondWidth, train);
        }
        return;
      }

      if (drawingLine === null) {
        // クリックしたマウスカーソルを基にした位置を返す
        const mousePosition = getPointerPosition(e.target.getStage()!);

        drawingLine = new Konva.Line({
          points: [mousePosition.x, stationPosition.diagramPosition],
          stroke: 'red',
          strokeWidth: 1,
          hitFunc: function (context, shape) {},
        });
        layer.add(drawingLine);

        drawingLineTimes.push({
          diaStation: stationPosition,
          time: positionToTime(mousePosition.x, secondWidth),
        });
      } else {
        // 線に駅を追加する

        const mousePosition = getPointerPosition(e.target.getStage()!);
        const points = drawingLine.points();

        // 整合性チェック
        if (
          drawingLineTimes.some((drawingLineTime) => drawingLineTime.diaStation.stationId === stationPosition.stationId)
        ) {
          // 既に同じ駅が追加されている。 => 分けないとデータ構造上。。
          // TODO: 直前と同じなら、停車時間、発車時間
          commitDrawingLine(props);
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

function drawStations(
  layer: Konva.Layer,
  stationPositions: (Station & { diagramPosition: number })[],
  canvasWidth: number
) {
  const stations = new Konva.Group();
  layer.add(stations);

  for (const stationPosition of stationPositions) {
    const station = new Konva.Group();
    stations.add(station);

    const stationText = new Konva.Text({
      x: 0,
      y: stationPosition.diagramPosition - 20,
      text: stationPosition.stationName,
      fontSize: 20,
      fontFamily: 'Calibri',
      fill: 'black',
    });
    station.add(stationText);

    const stationLine = new Konva.Line({
      points: [0, stationPosition.diagramPosition, canvasWidth, stationPosition.diagramPosition],
      stroke: 'black',
      strokeWidth: 1,
      hitStrokeWidth: hitStrokeWidth,
    });
    station.add(stationLine);
  }
}

type StationPosition = Station & { diagramPosition: number };

function createPositionDiaTimeMap(diaTimes: DiaTime[], secondWidth: number, stationPositions: StationPosition[]) {
  const positionDiaTimeMap = diaTimes.flatMap((diaTime) => {
    const stationPosition = stationPositions.find((station) => station.stationId === diaTime.station.stationId);
    if (!stationPosition) {
      throw new Error(`station ${diaTime.station.stationId} not found`);
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
  return positionDiaTimeMap;
}

function clickTrainLine(
  trainLine: Konva.Line,
  diaTimes: DiaTime[],
  secondWidth: number,
  layer: Konva.Layer,
  stationPositions: StationPosition[]
) {
  destroySelection();

  selection.shape = trainLine;
  selection.shape.stroke('red');
  selection.shape.draggable(true);

  const trainClickedGroup = new Konva.Group();
  layer.add(trainClickedGroup);
  selection.lineGroup = trainClickedGroup;

  const positionDiaTimeMap = createPositionDiaTimeMap(diaTimes, secondWidth, stationPositions);

  for (const [diaTime, arrivalOrDeparture, position] of positionDiaTimeMap) {
    const square = new Konva.Rect({
      x: position[0] - 5,
      y: position[1] - 5,
      width: 10,
      height: 10,
      fill: 'blue',
      stroke: 'black',
      strokeWidth: 0,
      draggable: true,
      id: `timePoint-${diaTime.diaTimeId}-${arrivalOrDeparture}`,
    });
    trainClickedGroup.add(square);

    const timeLabel = new Konva.Text({
      x: position[0] - 5,
      y: position[1] - 20,
      text:
        arrivalOrDeparture === 'arrivalTime'
          ? toStringFromSeconds(diaTime.arrivalTime!)
          : toStringFromSeconds(diaTime.departureTime!),
      fontSize: 20,
      fill: 'black',
      id: `timeLabel-${diaTime.diaTimeId}-${arrivalOrDeparture}`,
      hitFunc: function (context, shape) {},
    });
    trainClickedGroup.add(timeLabel);

    square.on('dragmove', function (e) {
      // const x = Math.round(e.target.x() / secondWidth) * secondWidth;
      // e.target.x(x);
      e.target.y(position[1] - 5);

      const [diaTimeId, arrivalOrDeparture] = e.target.id().split('-').slice(1);
      const diaTime = diaTimes.find((diaTime) => diaTime.diaTimeId === diaTimeId)!;

      const time = Math.round((e.target.x() + 5) / secondWidth);
      if (arrivalOrDeparture === 'arrivalTime') {
        diaTime.arrivalTime = time;
      }
      if (arrivalOrDeparture === 'departureTime') {
        diaTime.departureTime = time;
      }
      timeLabel.text(toStringFromSeconds(time));
      timeLabel.x(e.target.x());

      const points = trainLine.points();
      const index = createPositionDiaTimeMap(diaTimes, secondWidth, stationPositions).findIndex(
        ([diaTime_, arrivalOrDeparture_]) =>
          diaTime_.diaTimeId === diaTimeId && arrivalOrDeparture_ === arrivalOrDeparture
      );
      points[index * 2] = e.target.x() + 5;
      trainLine.points(points);

      e.cancelBubble = true;
    });
  }
}

// 列車線（スジ）を描画
function drawTrain(
  layer: Konva.Layer,
  stationPositions: (Station & { diagramPosition: number })[],
  secondWidth: number,
  train: Train
) {
  const trainGroup = new Konva.Group();
  layer.add(trainGroup);

  const positions = createPositionDiaTimeMap(train.diaTimes, secondWidth, stationPositions)
    .map(([_, __, position]) => position)
    .flat();
  const line = new Konva.Line({
    points: positions,
    stroke: train.trainType?.trainTypeColor ?? 'black',
    strokeWidth: 1,
    hitStrokeWidth: 10,
  });
  trainGroup.add(line);

  line.on('click', function (e) {
    if (e.target === line) {
      console.log(train.diaTimes);
      clickTrainLine(line, train.diaTimes, secondWidth, layer, stationPositions);
    }
    e.cancelBubble = true;
  });

  line.on('dragmove', function (e) {
    if (e.target === selection.shape) {
      // 横方向にのみ動く
      const x = Math.round(e.target.x() / secondWidth) * secondWidth;
      e.target.x(x);
      e.target.y(0);

      const positionDiaTimeMap = createPositionDiaTimeMap(train.diaTimes, secondWidth, stationPositions);

      let diaTimeIndex = 0;
      for (const [diaTime_, timeType, _] of positionDiaTimeMap) {
        const diaTime = train.diaTimes.find((diaTime) => diaTime.diaTimeId === diaTime_.diaTimeId)!;
        const time = Math.round((e.target.attrs.points[diaTimeIndex] + e.target.x()) / secondWidth);

        if (timeType === 'arrivalTime') {
          diaTime.arrivalTime = time;
        }
        if (timeType === 'departureTime') {
          diaTime.departureTime = time;
        }

        const timeLabel = layer.findOne(`#timeLabel-${diaTime.diaTimeId}-${timeType}`) as Konva.Text;
        timeLabel.text(toStringFromSeconds(time));
        timeLabel.x(e.target.attrs.points[diaTimeIndex] + e.target.x() - 5);

        const timePoint = layer.findOne(`#timePoint-${diaTime.diaTimeId}-${timeType}`) as Konva.Rect;
        timePoint.x(e.target.attrs.points[diaTimeIndex] + e.target.x() - 5);

        diaTimeIndex += 2;
      }
    }

    e.cancelBubble = true;
  });

  line.on('dragend', function (e) {
    if (e.target === selection.shape) {
      destroySelection();
      e.target.destroy();

      const line = drawTrain(layer, stationPositions, secondWidth, train);
      clickTrainLine(line, train.diaTimes, secondWidth, layer, stationPositions);
    }
  });

  return line;
}

const canvasHeight = 600;
const canvasWidth = 600; // dummy width (will be set by initializeKonva)
const virtualCanvasHeight = 2000;
const virtualCanvasWidth = 10000;
export const stagePosition = {
  x: 0,
  y: 0,
  zoom: 0.8,
};

export function initializeStationKonva(container: HTMLDivElement, canvasWidth: number, props: DiagramProps): Stage {
  const stage = new Konva.Stage({
    container: container,
    width: canvasWidth * 2,
    height: canvasHeight,
    // draggable: true,
  });

  const layer = new Konva.Layer();
  stage.add(layer);

  const stationPositions = props.diaStations.map((station, index) => ({
    ...station,
    diagramPosition: index * 50 + 50,
  }));

  drawStations(layer, stationPositions, canvasWidth * 2);

  return stage;
}

export function initializeKonva(container: HTMLDivElement, props: DiagramProps, stationStage: Stage) {
  const stage = new Konva.Stage({
    container: container,
    width: canvasWidth,
    height: canvasHeight,
    draggable: true,
    id: 'mainStage',
  });

  const layer = new Konva.Layer();
  stage.add(layer);

  stage.x(stagePosition.x);
  stage.y(stagePosition.y);
  stage.scale({ x: stagePosition.zoom, y: stagePosition.zoom });

  stationStage.x(0);
  stationStage.y(stagePosition.y);
  stationStage.scale({ x: stagePosition.zoom, y: stagePosition.zoom });

  const stationPositions = props.diaStations.map((station, index) => ({
    ...station,
    diagramPosition: index * 50 + 50,
  }));

  const secondWidth = virtualCanvasWidth / 24 / 60 / 60;

  drawTimeGrid(layer, stationPositions[stationPositions.length - 1].diagramPosition + 50, secondWidth);
  drawStationLines(layer, stationPositions, secondWidth, props);

  for (const train of props.inboundDiaTrains) {
    drawTrain(layer, stationPositions, secondWidth, train);
  }
  for (const train of props.outboundDiaTrains) {
    drawTrain(layer, stationPositions, secondWidth, train);
  }

  function fitStageIntoParentContainer() {
    const clientWidth = document.documentElement.clientWidth - 30; /* この値はなんとかして設定する */
    container.style.width = clientWidth + 'px';
    stage.width(clientWidth);
  }

  fitStageIntoParentContainer();

  // TODO:邪魔なのでいったんコメントアウト
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

    let newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    if (newScale < 0.5) {
      newScale = 0.5;
    }
    if (newScale > 2.5) {
      newScale = 2.5;
    }

    const newX = -(mousePointTo.x - stage.getPointerPosition()!.x / newScale) * newScale;
    const newY = -(mousePointTo.y - stage.getPointerPosition()!.y / newScale) * newScale;

    stage.scale({ x: newScale, y: newScale });
    stage.x(newX);
    stage.y(newY);

    stationStage.scale({ x: newScale, y: newScale });
    stationStage.x(0);
    stationStage.y(newY);

    adjustStagePosition(stage as Stage, stationStage);

    stagePosition.x = stage.x();
    stagePosition.y = stage.y();
    stagePosition.zoom = stage.scaleX();
  });

  // ウィンドウリサイズ時にサイズを合わせる
  window.addEventListener('resize', fitStageIntoParentContainer);

  // TODO: zoomが考慮できていないので直す
  // stageのドラッグ範囲をcanvas内に制限する
  stage.on('dragmove', function (e) {
    const stage = e.target;
    if (stage.id() !== 'mainStage') return;

    stationStage.y(stage.y());
    adjustStagePosition(stage as Stage, stationStage);

    stagePosition.x = stage.x();
    stagePosition.y = stage.y();
    stagePosition.zoom = stage.scaleX();
  });

  stage.on('click', function (e) {
    destroySelection();
  });
}

function destroySelection() {
  if (selection.shape !== null) {
    selection.shape.draggable(false);
    selection.shape.stroke('black');
    selection.shape = null;

    selection.lineGroup.destroyChildren();
    selection.lineGroup.destroy();

    console.log('deselect');
  }
}

function adjustStagePosition(stage: Stage, stationStage: Stage) {
  if (!stage.container) return;

  const container = stage.container();

  const containerWidth = container.clientWidth;
  const scale = stage.scaleX();
  const stageX = stage.x();
  const stageRight = stageX + virtualCanvasWidth * scale;

  if (stageX > 0) {
    stage.x(0);
  }
  if (stageRight < containerWidth) {
    stage.x(containerWidth - virtualCanvasWidth * scale);
  }

  const containerHeight = container.clientHeight;
  const stageY = stage.y();
  const stageBottom = stageY + virtualCanvasHeight * scale;

  if (stageY > 0) {
    stage.y(0);
    stationStage.y(0);
  }
  if (stageBottom < containerHeight) {
    stage.y(containerHeight - virtualCanvasHeight * scale);
    stationStage.y(containerHeight - virtualCanvasHeight * scale);
  }
}
