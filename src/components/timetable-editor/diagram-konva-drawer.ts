import Konva from 'konva';
import { Stage } from 'konva/lib/Stage';
import { AppClipboard, DiaTime, Operation, Point, Station, Train, generateId } from '../../model';
import { fillMissingTimes } from '../../oudParser';
import { Polygon, sat } from '../../sat';
import { createOperations, getReasonOfNotConnected } from '../track-editor/timetableConverter';
import { toStringFromSeconds } from './common-component';
import { StationKonvaManager } from './station-konva';
import { getDefaultPlatform } from './timetable-util';

export interface DiagramProps {
  diaStations: Station[];
  setUpdate: () => void;
  inboundDiaTrains: Train[];
  outboundDiaTrains: Train[];
  clipboard: AppClipboard;
  setClipboard: (clipboard: AppClipboard) => void;
}

const hitStrokeWidth = 10;

let editMode: 'Edit' | 'Create' = 'Edit';

interface StationPosition {
  station: Station;
  diagramPosition: number;
}

interface TrainSelection {
  shape: Konva.Line;
  lineGroup: Konva.Group;
  train: Train;
}
interface DiagramState {
  // props: DiagramProps;
  // stationCanvasWidth: number;
  // stationCanvas: HTMLCanvasElement;
  // mainCanvas: HTMLCanvasElement;
  layer: Konva.Layer;
  stationPositions: { station: Station; diagramPosition: number }[];
  secondWidth: number;
  // 線を伸ばしている途中の線
  drawingLine: Konva.Line | null;
  drawingLineTimes: { station: Station; time: number }[];
  selections: TrainSelection[];
  selectionGroup: Konva.Group;
  dragStartPoint: Point | null;
  dragRect: Konva.Rect | null;
}

const diagramState: DiagramState = {
  drawingLine: null,
  drawingLineTimes: [],
  layer: null as any,
  stationPositions: [],
  secondWidth: 0,
  selections: [],
  selectionGroup: new Konva.Group({
    draggable: true,
  }),
  dragStartPoint: null,
  dragRect: null,
};

function drawTimeGrid(layer: Konva.Layer, layerHeight: number, secondWidth: number) {
  const timeGrid = new Konva.Group();
  layer.add(timeGrid);
  const scale = layer.getStage()!.scaleX();

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
  if (diagramState.drawingLine === null) {
    return null;
  }

  diagramState.drawingLine.destroy();
  diagramState.drawingLine = null;

  if (diagramState.drawingLineTimes.length >= 2) {
    // 1番目のstationのindexと2番目のstationのindexを比較し、inbound / outboundを判定する
    const firstStationIndex = props.diaStations.findIndex(
      (station) => station.stationId === diagramState.drawingLineTimes[0].station.stationId
    );
    const secondStationIndex = props.diaStations.findIndex(
      (station) => station.stationId === diagramState.drawingLineTimes[1].station.stationId
    );
    const direction = firstStationIndex < secondStationIndex ? 'Inbound' : 'Outbound';
    const trains = direction === 'Inbound' ? props.inboundDiaTrains : props.outboundDiaTrains;

    const diaTimes = diagramState.drawingLineTimes.map(
      (drawingLineTime) =>
        ({
          station: drawingLineTime.station,
          departureTime: drawingLineTime.time,
          arrivalTime: null,
          diaTimeId: generateId(),
          isPassing: false,
          platform: getDefaultPlatform(drawingLineTime.station, direction),
        } as DiaTime)
    );

    trains.push({
      trainId: generateId(),
      trainName: '',
      trainType: undefined,
      diaTimes: diaTimes,
      trainCode: '',
      direction: direction,
    });

    fillMissingTimes(trains, props.diaStations);

    props.setUpdate();
    updateTrains(trains /*, trains[trains.length - 1]*/);

    diagramState.drawingLineTimes = [];

    return trains[trains.length - 1];
  }

  diagramState.drawingLineTimes = [];
  return null;
}

function getPointerPosition(stage: Stage) {
  const vec = stage.getPointerPosition()!;
  return { x: (vec.x - stage.x()) / stage.scaleX(), y: (vec.y - stage.y()) / stage.scaleY() };
}

function drawStationLines(
  layer: Konva.Layer,
  stationPositions: StationPosition[],
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
      if (diagramState.drawingLine !== null) {
        const mousePosition = getPointerPosition(e.target.getStage()!);
        const points = diagramState.drawingLine.points();
        points.splice(diagramState.drawingLineTimes.length * 2);
        points.push(mousePosition.x, stationPosition.diagramPosition);
        diagramState.drawingLine.points(points);
      }
    });

    stationLine.on('click', function (e) {
      destroySelections(diagramState.selections);

      if (e.evt.button === 2) {
        // 右クリック
        const train = commitDrawingLine(props);

        if (train !== null) {
          drawTrain(train);
        }
        return;
      }

      if (diagramState.drawingLine === null) {
        // クリックしたマウスカーソルを基にした位置を返す
        const mousePosition = getPointerPosition(e.target.getStage()!);

        diagramState.drawingLine = new Konva.Line({
          points: [mousePosition.x, stationPosition.diagramPosition],
          stroke: 'red',
          strokeWidth: 1,
          hitFunc: function (context, shape) {},
        });
        layer.add(diagramState.drawingLine);

        diagramState.drawingLineTimes.push({
          station: stationPosition.station,
          time: positionToTime(mousePosition.x, secondWidth),
        });
      } else {
        // 線に駅を追加する

        const mousePosition = getPointerPosition(e.target.getStage()!);
        const points = diagramState.drawingLine.points();

        // 整合性チェック
        if (
          diagramState.drawingLineTimes.some(
            (drawingLineTime) => drawingLineTime.station.stationId === stationPosition.station.stationId
          )
        ) {
          // 既に同じ駅が追加されている。 => 分けないとデータ構造上。。
          // TODO: 直前と同じなら、停車時間、発車時間
          commitDrawingLine(props);
          return;
        }

        const newTime = positionToTime(mousePosition.x, secondWidth);

        if (diagramState.drawingLineTimes.length >= 2) {
          const lastTime = diagramState.drawingLineTimes[diagramState.drawingLineTimes.length - 1].time;

          if (diagramState.drawingLineTimes[1].time < diagramState.drawingLineTimes[0].time) {
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

        diagramState.drawingLineTimes.push({
          station: stationPosition.station,
          time: newTime,
        });

        points.push(mousePosition.x);
        points.push(stationPosition.diagramPosition);

        diagramState.drawingLine.points(points);
      }
    });
  }
}

function createPositionDiaTimeMap(diaTimes: DiaTime[], secondWidth: number, stationPositions: StationPosition[]) {
  const positionDiaTimeMap = diaTimes.flatMap((diaTime) => {
    const stationPosition = stationPositions.find((station) => station.station.stationId === diaTime.station.stationId);
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

function addTrainSelection(trainLine: Konva.Line, train: Train) {
  const { layer, secondWidth, stationPositions } = diagramState;

  trainLine.stroke('red');
  // trainLine.draggable(true);

  const trainClickedGroup = new Konva.Group();
  diagramState.selectionGroup.add(trainClickedGroup);
  diagramState.selectionGroup.add(trainLine);

  const newSelection: TrainSelection = {
    shape: trainLine,
    lineGroup: trainClickedGroup,
    train: train,
  };

  diagramState.selections.push(newSelection);

  const diaTimes = train.diaTimes;
  const positionDiaTimeMap = createPositionDiaTimeMap(diaTimes, secondWidth, stationPositions);

  const scale = layer.getStage()!.scaleX();

  for (const [diaTime, arrivalOrDeparture, position] of positionDiaTimeMap) {
    const square = new Konva.Rect({
      x: position[0] - 5 / scale,
      y: position[1] - 5 / scale,
      width: 10 / scale,
      height: 10 / scale,
      fill: 'blue',
      stroke: 'black',
      strokeWidth: 0,
      draggable: true,
      id: `timePoint-${diaTime.diaTimeId}-${arrivalOrDeparture}`,
    });
    trainClickedGroup.add(square);

    const textPosition =
      arrivalOrDeparture === 'arrivalTime'
        ? { x: position[0] - 30 / scale, y: position[1] + 5 / scale }
        : { x: position[0], y: position[1] - 20 / scale };
    const timeLabel = new Konva.Text({
      x: textPosition.x,
      y: textPosition.y,
      text:
        arrivalOrDeparture === 'arrivalTime'
          ? toStringFromSeconds(diaTime.arrivalTime!)
          : toStringFromSeconds(diaTime.departureTime!),
      fontSize: Math.round(22 / scale),
      fill: 'black',
      id: `timeLabel-${diaTime.diaTimeId}-${arrivalOrDeparture}`,
      hitFunc: function (context, shape) {},
    });
    trainClickedGroup.add(timeLabel);

    // 時刻のマーカーをドラッグしたときの処理
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

      updateTrains(train);

      e.cancelBubble = true;
    });
  }
}

function clickTrainLine(trainLine: Konva.Line, train: Train) {
  destroySelections(diagramState.selections);
  addTrainSelection(trainLine, train);
}

function processTrainDragMove(trainSelection: TrainSelection) {
  const { secondWidth, stationPositions, layer, selectionGroup } = diagramState;

  const { train, shape } = trainSelection;

  const positionDiaTimeMap = createPositionDiaTimeMap(train.diaTimes, secondWidth, stationPositions);

  const offsetX = shape.x() + selectionGroup.x();
  let diaTimeIndex = 0;
  for (const [diaTime_, timeType, _] of positionDiaTimeMap) {
    const diaTime = train.diaTimes.find((diaTime) => diaTime.diaTimeId === diaTime_.diaTimeId)!;
    const time = Math.round((shape.points()[diaTimeIndex] + offsetX) / secondWidth);

    if (timeType === 'arrivalTime') {
      diaTime.arrivalTime = time;
    }
    if (timeType === 'departureTime') {
      diaTime.departureTime = time;
    }

    const timeLabel = layer.findOne(`#timeLabel-${diaTime.diaTimeId}-${timeType}`) as Konva.Text;
    timeLabel.text(toStringFromSeconds(time));
    // timeLabel.x(shape.points()[diaTimeIndex] + offsetX - 5);

    // const timePoint = layer.findOne(`#timePoint-${diaTime.diaTimeId}-${timeType}`) as Konva.Rect;
    // timePoint.x(shape.points()[diaTimeIndex] + offsetX - 5);

    diaTimeIndex += 2;
  }

  updateTrains(trains /*, train*/);
}

function drawOperations(operations: Operation[]) {
  const { layer, secondWidth, stationPositions } = diagramState;

  const operationGroup = new Konva.Group();
  layer.add(operationGroup);

  if (operations.length === 0) return;

  for (const operation of operations) {
    let prevTrain = operation.trains[0];
    for (let trainIndex = 1; trainIndex < operation.trains.length; trainIndex++) {
      let currTrain = operation.trains[trainIndex];

      const prevTrainTimeData_ = createPositionDiaTimeMap(prevTrain.diaTimes, secondWidth, stationPositions);
      const prevTrainTimeData = prevTrainTimeData_[prevTrainTimeData_.length - 1];
      const currTrainTimeData = createPositionDiaTimeMap(currTrain.diaTimes, secondWidth, stationPositions)[0];

      const stationIndex = stationPositions.findIndex(
        (station) => station.station.stationId === currTrain.diaTimes[0].station.stationId
      );
      const isTop = stationIndex === 0;

      const line = new Konva.Line({
        points: [
          prevTrainTimeData[2][0],
          prevTrainTimeData[2][1],
          prevTrainTimeData[2][0],
          isTop ? prevTrainTimeData[2][1] - 10 : prevTrainTimeData[2][1] + 10,
          currTrainTimeData[2][0],
          isTop ? currTrainTimeData[2][1] - 10 : currTrainTimeData[2][1] + 10,
          currTrainTimeData[2][0],
          currTrainTimeData[2][1],
        ],
        stroke: 'orange',
        strokeWidth: 1,
        hitStrokeWidth: hitStrokeWidth,
      });
      operationGroup.add(line);

      prevTrain = currTrain;
    }
  }
}

// 列車線（スジ）を描画
function drawTrain(train: Train) {
  const { layer, secondWidth, stationPositions } = diagramState;

  const positions = createPositionDiaTimeMap(train.diaTimes, secondWidth, stationPositions)
    .map(([_, __, position]) => position)
    .flat();
  const line = new Konva.Line({
    points: positions,
    stroke: train.trainType?.trainTypeColor ?? 'black',
    strokeWidth: 1,
    hitStrokeWidth: 10,
    name: `trainLine`,
    id: `trainLine-${train.trainId}`,
  });
  layer.add(line);

  line.on('click', function (e) {
    if (e.target === line) {
      console.log(train.diaTimes);
      if (e.evt.ctrlKey) {
        addTrainSelection(line, train);
      } else {
        clickTrainLine(line, train);
      }
    }
    e.cancelBubble = true;
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

function areOverlapped(rect: Konva.Rect, trainLine: Konva.Line) {
  // rectの頂点の配列
  const width = rect.width() !== 0 ? rect.width() : 0.001;
  const height = rect.height() !== 0 ? rect.height() : 0.001;

  const rectPoints = [
    { x: rect.x(), y: rect.y() },
    { x: rect.x() + width, y: rect.y() },
    { x: rect.x() + width, y: rect.y() + height },
    { x: rect.x(), y: rect.y() + height },
  ];
  const rectPolygon = new Polygon(rectPoints);

  const segments = [];
  let previousPoint = { x: trainLine.points()[0] + trainLine.x(), y: trainLine.points()[1] + trainLine.y() };
  for (let i = 2; i < trainLine.points().length; i += 2) {
    const currentPoint = { x: trainLine.points()[i] + trainLine.x(), y: trainLine.points()[i + 1] + trainLine.y() };
    segments.push([previousPoint, currentPoint]);
    previousPoint = currentPoint;
  }

  for (const segment of segments) {
    const overlapped = sat(rectPolygon, new Polygon(segment));
    if (overlapped) {
      return true;
    }
  }

  return false;
}

function getOverlappedTrainLines(rect: Konva.Rect) {
  const { layer } = diagramState;
  const trainLines: Konva.Line[] = layer.find('.trainLine');
  const overlappedTrainLines = trainLines.filter((trainLine) => areOverlapped(rect, trainLine as Konva.Line));
  return overlappedTrainLines;
}

function updateTrains() {}

export function initializeKonva(
  container: HTMLDivElement,
  props: DiagramProps,
  stationKonvaManager: StationKonvaManager
) {
  const minTime = Math.min(
    ...(props.inboundDiaTrains
      .map((train) => train.diaTimes.map((diaTime) => [diaTime.arrivalTime, diaTime.departureTime]).flat())
      .concat(
        props.outboundDiaTrains.map((train) =>
          train.diaTimes.map((diaTime) => [diaTime.arrivalTime, diaTime.departureTime]).flat()
        )
      )
      .flat()
      .filter((t) => t != null) as number[])
  );

  diagramState.secondWidth = virtualCanvasWidth / 24 / 60 / 60;
  stagePosition.x = Math.min(0, -(minTime - 10 * 60) * diagramState.secondWidth * stagePosition.zoom);

  const stage = new Konva.Stage({
    container: container,
    width: canvasWidth,
    height: canvasHeight,
    id: 'mainStage',
  });

  diagramState.layer = new Konva.Layer();
  const layer = diagramState.layer;
  stage.add(layer);

  stage.x(stagePosition.x);
  stage.y(stagePosition.y);
  stage.scale({ x: stagePosition.zoom, y: stagePosition.zoom });

  stationKonvaManager.adjustStationPosition(stage);

  diagramState.stationPositions = props.diaStations.map((station, index) => ({
    station,
    diagramPosition: index * 50 + 50,
  }));
  const stationPositions = diagramState.stationPositions;

  drawTimeGrid(layer, stationPositions[stationPositions.length - 1].diagramPosition + 50, diagramState.secondWidth);
  drawStationLines(layer, stationPositions, diagramState.secondWidth, props);

  for (const train of props.inboundDiaTrains) {
    drawTrain(train);
  }
  for (const train of props.outboundDiaTrains) {
    drawTrain(train);
  }

  const operations = createOperations(props.inboundDiaTrains, props.outboundDiaTrains);
  drawOperations(operations);

  function fitStageIntoParentContainer() {
    const clientWidth = document.documentElement.clientWidth - 30; /* この値はなんとかして設定する */
    container.style.width = clientWidth + 'px';
    stage.width(clientWidth);
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

    adjustStagePosition(stage as Stage);
    stationKonvaManager.adjustStationPosition(stage);

    stagePosition.x = stage.x();
    stagePosition.y = stage.y();
    stagePosition.zoom = stage.scaleX();
  });

  // ウィンドウリサイズ時にサイズを合わせる
  window.addEventListener('resize', fitStageIntoParentContainer);

  // stageに対するイベント
  stage.on('mousedown', function (e) {
    if (e.evt.button === 2) {
      stage.startDrag();
    } else if (e.evt.button === 0) {
      // 範囲選択開始
      diagramState.dragStartPoint = getPointerPosition(stage);
      diagramState.dragRect = new Konva.Rect({
        x: diagramState.dragStartPoint.x,
        y: diagramState.dragStartPoint.y,
        width: 0,
        height: 0,
        stroke: 'black',
        strokeWidth: 1,
        dash: [4, 4],
      });

      diagramState.layer.add(diagramState.dragRect);
    }
  });

  stage.on('mousemove', function (e) {
    if (diagramState.dragStartPoint == null) return;

    const stage_ = e.target;
    if (stage_.id() !== 'mainStage') return;

    const dragEndPoint = getPointerPosition(stage);

    // 四角を描画
    const rect = diagramState.dragRect!;
    rect.width(dragEndPoint.x - diagramState.dragStartPoint.x);
    rect.height(dragEndPoint.y - diagramState.dragStartPoint.y);
  });

  stage.on('click', function (e) {
    if (e.evt.button === 2) {
      // 右クリック
      const train = commitDrawingLine(props);

      if (train !== null) {
        drawTrain(train);
      }
      return;
    }
  });

  stage.on('mouseup', function (e) {
    if (diagramState.dragStartPoint == null || diagramState.dragRect == null) return;

    destroySelections(diagramState.selections);

    const overlappedTrainLines = getOverlappedTrainLines(diagramState.dragRect);

    for (const trainLine of overlappedTrainLines) {
      const trainId = trainLine.id().split('-')[1];
      const train = props.inboundDiaTrains.concat(props.outboundDiaTrains).find((train) => train.trainId === trainId);
      if (train == null) continue;

      addTrainSelection(trainLine, train);
      console.log(train);
    }

    if (diagramState.selections.length === 2) {
      console.log({
        reason: getReasonOfNotConnected(diagramState.selections[0].train, diagramState.selections[1].train),
      });
    }

    diagramState.dragStartPoint = null;
    diagramState.dragRect?.destroy();
    diagramState.dragRect = null;
  });

  stage.on('dragmove', function (e) {
    const stage = e.target;
    if (stage.id() !== 'mainStage') return;

    adjustStagePosition(stage as Stage);
    stationKonvaManager.adjustStationPosition(stage as Stage);

    stagePosition.x = stage.x();
    stagePosition.y = stage.y();
    stagePosition.zoom = stage.scaleX();
  });

  stage.on('click', function (e) {
    destroySelections(diagramState.selections);
  });

  // 選択グループに対するイベント
  diagramState.selectionGroup.on('dragmove', function (e) {
    diagramState.dragRect = null;
    diagramState.dragStartPoint = null;

    // 横方向にのみ動く
    const x = Math.round(e.target.x() / diagramState.secondWidth) * diagramState.secondWidth;
    e.target.x(x);
    e.target.y(0);

    for (const selection of diagramState.selections) {
      processTrainDragMove(selection);
    }

    // e.cancelBubble = true;
  });

  diagramState.selectionGroup.on('dragend', function (e) {
    const prevSelections = [...diagramState.selections];
    destroySelections(diagramState.selections);
    const offsetX = diagramState.selectionGroup.x();
    diagramState.selectionGroup.x(0);

    for (const selection of prevSelections) {
      selection.shape.x(selection.shape.x() + offsetX);
      addTrainSelection(selection.shape, selection.train);
    }
  });

  layer.add(diagramState.selectionGroup);
}

function destroySelection(selection: TrainSelection) {
  selection.shape.draggable(false);
  selection.shape.stroke('black');
  selection.shape.remove();
  diagramState.layer.add(selection.shape);

  selection.lineGroup.destroy();
}

function destroySelections(selections: TrainSelection[]) {
  for (const selection of selections) {
    destroySelection(selection);
  }
  selections.splice(0, selections.length);
}

function adjustStagePosition(stage: Stage) {
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
  }
  if (stageBottom < containerHeight) {
    stage.y(containerHeight - virtualCanvasHeight * scale);
  }
}
