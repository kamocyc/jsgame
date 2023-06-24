import Konva from 'konva';
import { Stage } from 'konva/lib/Stage';
import { generateId } from '../../model';
import { DiaStation, DiaTime, DiaTrain } from './model';
import { getDefaultPlatform } from './timetable-util';

export interface DiagramProps {
  diaStations: DiaStation[];
  setUpdate: () => void;
  inboundDiaTrains: DiaTrain[];
  outboundDiaTrains: DiaTrain[];
}

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

function commitDrawingLine(props: DiagramProps) {
  if (drawingLine === null) {
    return;
  }

  drawingLine?.stroke('black');
  drawingLine = null;

  if (drawingLineTimes.length >= 2) {
    // 1番目のstationのindexと2番目のstationのindexを比較し、inbound / outboundを判定する
    const firstStationIndex = props.diaStations.findIndex(
      (diaStation) => diaStation.diaStationId === drawingLineTimes[0].diaStation.diaStationId
    );
    const secondStationIndex = props.diaStations.findIndex(
      (diaStation) => diaStation.diaStationId === drawingLineTimes[1].diaStation.diaStationId
    );
    const direction = firstStationIndex < secondStationIndex ? 'Inbound' : 'Outbound';
    const diaTrain = direction === 'Inbound' ? props.inboundDiaTrains : props.outboundDiaTrains;

    diaTrain.push({
      diaTrainId: generateId(),
      trainName: '',
      trainType: undefined,
      diaTimes: drawingLineTimes.map(
        (drawingLineTime) =>
          ({
            diaStation: drawingLineTime.diaStation,
            departureTime: drawingLineTime.time,
            arrivalTime: null,
            diaTimeId: generateId(),
            isPassing: false,
            diaPlatform: getDefaultPlatform(drawingLineTime.diaStation, direction),
          } as DiaTime)
      ),
    });
    props.setUpdate();
  }
  drawingLineTimes = [];
}

function getPointerPosition(stage: Stage) {
  const vec = stage.getPointerPosition()!;
  return { x: (vec.x - stage.x()) / stage.scaleX(), y: (vec.y - stage.y()) / stage.scaleY() };
}

function drawStations(
  layer: Konva.Layer,
  stationPositions: (DiaStation & { diagramPosition: number })[],
  secondWidth: number,
  props: DiagramProps
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
        commitDrawingLine(props);
        return;
      }
      if (drawingLine === null) {
        // クリックしたマウスカーソルを基にした位置を返す
        const mousePosition = getPointerPosition(e.target.getStage()!);

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

        const mousePosition = getPointerPosition(e.target.getStage()!);
        const points = drawingLine.points();

        // 整合性チェック
        if (
          drawingLineTimes.some(
            (drawingLineTime) => drawingLineTime.diaStation.diaStationId === stationPosition.diaStationId
          )
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

// TODO: 変更を反映する
function drawTrain(
  layer: Konva.Layer,
  stationPositions: { diaStationId: string; diagramPosition: number }[],
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

let canvasHeight = 600;
let canvasWidth = 600; // dummy width
let virtualCanvasHeight = 2000;
let virtualCanvasWidth = 2000;

export function initializeKonva(container: HTMLDivElement, props: DiagramProps) {
  const stage = new Konva.Stage({
    container: container,
    width: canvasWidth,
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
  drawStations(layer, stationPositions, secondWidth, props);

  for (const diaTrain of props.inboundDiaTrains) {
    drawTrain(layer, stationPositions, secondWidth, diaTrain);
  }
  for (const diaTrain of props.outboundDiaTrains) {
    drawTrain(layer, stationPositions, secondWidth, diaTrain);
  }

  function fitStageIntoParentContainer() {
    const clientWidth = document.documentElement.clientWidth - 30; /* この値はなんとかして設定する */
    container.style.width = clientWidth + 'px';
    stage.width(clientWidth);
  }

  fitStageIntoParentContainer();

  stage.scaleX(0.8);
  stage.scaleY(0.8);

  // TODO:邪魔なのでいったんコメントアウト
  // // zooming on scroll
  // stage.on('wheel', function (e) {
  //   e.evt.preventDefault();

  //   const scaleBy = 1.05;
  //   const stage = e.target.getStage();
  //   if (stage == null || stage.getPointerPosition() == null) return;

  //   const oldScale = stage.scaleX();
  //   const mousePointTo = {
  //     x: stage.getPointerPosition()!.x / oldScale - stage.x() / oldScale,
  //     y: stage.getPointerPosition()!.y / oldScale - stage.y() / oldScale,
  //   };

  //   const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

  //   stage.scale({ x: newScale, y: newScale });
  //   stage.x(-(mousePointTo.x - stage.getPointerPosition()!.x / newScale) * newScale);
  //   stage.y(-(mousePointTo.y - stage.getPointerPosition()!.y / newScale) * newScale);

  //   adjustStagePosition(stage as Stage);
  // });

  // ウィンドウリサイズ時にサイズを合わせる
  window.addEventListener('resize', fitStageIntoParentContainer);

  // TODO: zoomが考慮できていないので直す
  // stageのドラッグ範囲をcanvas内に制限する
  stage.on('dragmove', function (e) {
    const stage = e.target;
    adjustStagePosition(stage as Stage);
  });
}

function adjustStagePosition(stage: Stage) {
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
