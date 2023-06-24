import { _x, _y, canvasHeight, canvasWidth, drawLine, fontSize } from '../../drawer';
import { DiaTrain } from '../../model';
import { Platform } from '../../uiEditorModel';

interface DiaStation {
  diaStationId: string;
  station: Platform;
  distance: number;
}

const timeOffset = 10000;
const timeWidth = 20000;
let zoomY = 10;
let zoomX = 1;

function timeToX(time: number) {
  return ((time - timeOffset) / timeWidth) * canvasWidth * zoomX;
}

function drawStation(ctx: CanvasRenderingContext2D, diaStation: DiaStation, distance: number) {
  ctx.font = fontSize + 'px sans-serif';
  ctx.fillText(diaStation.station.platformName, _x(0), _y(distance));

  ctx.beginPath();
  ctx.moveTo(_x(0), _y(distance));
  ctx.lineTo(_x(canvasWidth), _y(distance));
  ctx.stroke();
}

// 0字から経過した秒数
function drawTimeLine(ctx: CanvasRenderingContext2D) {
  // 60 * 60 * hour ごとに線を引く
  // offsetはちゃんとやる

  let startHour = Math.floor(timeOffset / 3600);
  let offset = timeOffset;
  while (true) {
    // ずれているので治す
    ctx.font = fontSize + 'px sans-serif';
    ctx.fillText('' + startHour, _x(timeToX(offset)), _y(fontSize));

    ctx.beginPath();
    ctx.moveTo(_x(timeToX(offset)), _y(fontSize));
    ctx.lineTo(_x(timeToX(offset)), _y(canvasHeight));
    ctx.stroke();

    // 10分毎
    for (let i = 0; i <= 5; i++) {
      const time = offset + i * 60 * 10;
      ctx.beginPath();
      ctx.strokeStyle = 'rgb(128, 128, 128)';
      ctx.moveTo(_x(timeToX(time)), _y(fontSize));
      ctx.lineTo(_x(timeToX(time)), _y(canvasHeight));
      ctx.stroke();
      ctx.strokeStyle = 'black';

      for (let j = 0; j <= 5; j++) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgb(198, 198, 198)';
        ctx.moveTo(_x(timeToX(time + j * 60 * 2)), _y(fontSize));
        ctx.lineTo(_x(timeToX(time + j * 60 * 2)), _y(canvasHeight));
        ctx.stroke();
        ctx.strokeStyle = 'black';
      }
    }
    offset += 3600;
    startHour++;

    if (timeToX(offset) > canvasWidth) break;
  }
}

// ダイヤの駅情報は、路線とはまた別の情報がある。
function drawStations(ctx: CanvasRenderingContext2D, diaStations: DiaStation[]) {
  // let stationDistance = 30;

  for (const diaStation of diaStations) {
    drawStation(ctx, diaStation, diaStation.distance * zoomY + fontSize);
  }
}

function drawTrain(ctx: CanvasRenderingContext2D, diaStations: DiaStation[], train: DiaTrain) {
  let previousTime = null;
  let previousDistance = null;
  let isFirstLine = true;

  for (const trainStation of train.trainTimetable) {
    const diaStations_ = diaStations.filter((s) => s.station.platformId === trainStation.stationId);
    if (diaStations_.length !== 1) throw new Error('illegal station id');
    const diaStation = diaStations_[0];

    if (previousTime != null && previousDistance != null) {
      const beginPoint = {
        x: _x(timeToX(previousTime)),
        y: _y(previousDistance * zoomY + fontSize),
      };
      const endPoint = {
        x: _x(timeToX(trainStation.departureTime)),
        y: _y(diaStation.distance * zoomY + fontSize),
      };
      drawLine(ctx, beginPoint, endPoint);

      if (isFirstLine) {
        isFirstLine = false;

        // 列車番号を表示する
        if (train.trainName) {
          const r = Math.atan2(endPoint.y - beginPoint.y, endPoint.x - beginPoint.x);

          ctx.save();
          ctx.translate(beginPoint.x, beginPoint.y);
          ctx.rotate(r);
          ctx.fillText(train.trainName, 0, -2);
          ctx.restore();
        }
      }
    }

    previousTime = trainStation.departureTime;
    previousDistance = diaStation.distance;
  }
}

export function drawDiagram(ctx: CanvasRenderingContext2D, stations: DiaStation[], trains: DiaTrain[]) {
  drawTimeLine(ctx);

  const maxDistance = Math.max(...stations.map((s) => s.distance));
  zoomY = (canvasHeight - fontSize - 10) / maxDistance;
  drawStations(ctx, stations);
  for (const train of trains) {
    drawTrain(ctx, stations, train);
  }
}
