let offsetX = 0;
let offsetY = 0;

const fontSize = 20;
const canvasWidth = 2000;
const canvasHeight = 500;

function _x(x: number): number {
  return x + offsetX;
}

function _y(y: number): number {
  return y + offsetY;
}

function drawLine(ctx: CanvasRenderingContext2D, pointBegin: Point, pointEnd: Point) {
  ctx.beginPath();
  ctx.moveTo(_x(pointBegin.x), _y(pointBegin.y));
  ctx.lineTo(_x(pointEnd.x), _y(pointEnd.y));
  ctx.stroke();
}

// // railの描画
// const railPattern = ctx.createPattern(railImage, 'repeat');
// ctx.fillStyle = railPattern;

// ctx.translate(pointBegin.x, pointBegin.y);
// ctx.rotate(Math.atan2(pointEnd.y - pointBegin.y, pointEnd.x - pointBegin.x));
// ctx.fillRect(0, 0, Math.sqrt((pointEnd.x - pointBegin.x) * (pointEnd.x - pointBegin.x) + (pointEnd.y - pointBegin.y) * (pointEnd.y - pointBegin.y)), 16);
// ctx.rotate(-Math.atan2(pointEnd.y - pointBegin.y, pointEnd.x - pointBegin.x));
// ctx.translate(-pointBegin.x, -pointBegin.y);

// function timesVector(vector: Point, times: number): Point {
//   return {
//     x: vector.x * times,
//     y: vector.y * times,
//   };
// }

function draw() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const track of tracks) {
    drawLine(ctx, track._begin, track._end);
    if (track.track.station) {
      ctx.beginPath();
      ctx.strokeStyle = 'red';
      ctx.arc(_x((track._begin.x + track._end.x) / 2), _y((track._begin.y + track._end.y) / 2), 5, 0, 2 * Math.PI);
      ctx.stroke();

      // stationの名前を描画
      ctx.font = fontSize + 'px sans-serif';
      ctx.fillText(track.track.station.stationName, _x((track._begin.x + track._end.x) / 2 - 10), _y((track._begin.y + track._end.y) / 2 - 10));

      ctx.strokeStyle = 'black';
    }
  }

  // switchを描画
  const switchDrawLength = 10;
  for (const sw of switches) {
    const track = sw._branchedTrackFrom;
    const trackDirection = getTrackDirection(track);
    const trackDirection2 = getTrackDirection(sw._branchedTrackTo);
    ctx.beginPath();
    ctx.moveTo(_x(track._end.x - trackDirection.x * switchDrawLength), _y(track._end.y - trackDirection.y * switchDrawLength));
    ctx.lineTo(_x(track._end.x), _y(track._end.y));
    ctx.lineTo(_x(track._end.x + trackDirection2.x * switchDrawLength), _y(track._end.y + trackDirection2.y * switchDrawLength));
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'green'
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'black'
  }

  if (mouseDownStartPoint !== null) {
    const rect = canvas.getBoundingClientRect();
    const mouseDownEndPoint = {
      x: currentMousePosition.x - rect.left,
      y: currentMousePosition.y - rect.top,
    };
    drawLine(ctx, mouseDownStartPoint, mouseDownEndPoint);
  }

  for (const train of trains) {
    ctx.beginPath();
    ctx.arc(_x(train.position.x), _y(train.position.y), 5, 0, 2 * Math.PI);
    ctx.stroke();
  }
}
