const tracks = [
  {
    begin: { x: 0, y: 0 },
    end: { x: 100, y: 100 },
    nextTracks: [],
    prevTracks: [],
    nextSwitch: { trackIndex: 0 },
    prevSwitch: { trackIndex: -1 },
    isStation: false,
  },
  {
    begin: { x: 100, y: 100 },
    end: { x: 200, y: 100 },
    nextTracks: [],
    prevTracks: [],
    nextSwitch: { trackIndex: -1 },
    prevSwitch: { trackIndex: 0 },
    isStation: true,
  }
];

tracks[0].nextTracks.push(tracks[1]);
tracks[1].prevTracks.push(tracks[0]);

const train = {
  speed: 10,
  track: tracks[0],
  position: { x: 0, y: 0 },
  trackDirection: 1,
};

const maxStationWaitTime = 5;

let currentMousePosition = { x: 0, y: 0 };

let mouseDownStartPoint = null;
let mouseDownStartTracks = [];

const railImage = new Image();

function getDistance(pointA, pointB) {
  return Math.sqrt(
    (pointA.x - pointB.x) * (pointA.x - pointB.x) +
    (pointA.y - pointB.y) * (pointA.y - pointB.y)
  );
}

function deepEqual(x, y) {
  const ok = Object.keys, tx = typeof x, ty = typeof y;
  return x && y && tx === 'object' && tx === ty ? (
    ok(x).length === ok(y).length &&
      ok(x).every(key => deepEqual(x[key], y[key]))
  ) : (x === y);
}

function getTrackDistance(point, track) {
  const a = (track.end.y - track.begin.y) / (track.end.x - track.begin.x);
  const b = track.begin.y - a * track.begin.x;
  return Math.abs(a * point.x - point.y + b) / Math.sqrt(a * a + 1);
}

function getTrackDirection(track) {
  const trackLength = getDistance(track.begin, track.end);
  const trackDirection = {
    x: (track.end.x - track.begin.x) / trackLength,
    y: (track.end.y - track.begin.y) / trackLength,
  };
  return trackDirection;
}

// pointと最も近いtrackを返す
function getTrackByPoint(point) {
  let minDistance = Number.MAX_VALUE;
  let minTrack = null;
  for (const track of tracks) {
    const distance = getTrackDistance(point, track);
    if (distance < minDistance) {
      minDistance = distance;
      minTrack = track;
    }
  }

  return minTrack;
}

function drawLine(ctx, pointBegin, pointEnd) {
  ctx.beginPath();
  ctx.moveTo(pointBegin.x, pointBegin.y);
  ctx.lineTo(pointEnd.x, pointEnd.y);
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

function draw() {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const track of tracks) {
    drawLine(ctx, track.begin, track.end);
    if (track.isStation) {
      ctx.beginPath();
      ctx.strokeStyle = 'red';
      ctx.arc((track.begin.x + track.end.x) / 2, (track.begin.y + track.end.y) / 2, 5, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.strokeStyle = 'black';
    }
  }

  // switchを描画
  const switchDrawLength = 10;
  for (const track of tracks) {
    if (track.nextTracks.length > 1) {
      const trackDirection = getTrackDirection(track);
      const switchedTrackDirection = getTrackDirection(track.nextTracks[track.nextSwitch.trackIndex]);
      ctx.beginPath();
      ctx.moveTo(track.end.x - trackDirection.x * switchDrawLength, track.end.y - trackDirection.y * switchDrawLength);
      ctx.lineTo(track.end.x, track.end.y);
      ctx.lineTo(track.end.x + switchedTrackDirection.x * switchDrawLength, track.end.y + switchedTrackDirection.y * switchDrawLength);
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'green'
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'black'
    }
  }

  if (mouseDownStartPoint !== null) {
    const rect = canvas.getBoundingClientRect();
    const mouseDownEndPoint = {
      x: currentMousePosition.x - rect.left,
      y: currentMousePosition.y - rect.top,
    };
    drawLine(ctx, mouseDownStartPoint, mouseDownEndPoint);
  }

  ctx.beginPath();
  ctx.arc(train.position.x, train.position.y, 5, 0, 2 * Math.PI);
  ctx.stroke();
}

function isTrainOutTrack(position, track) {
  const trackMinX = Math.min(track.begin.x, track.end.x);
  const trackMaxX = Math.max(track.begin.x, track.end.x);
  const trackMinY = Math.min(track.begin.y, track.end.y);
  const trackMaxY = Math.max(track.begin.y, track.end.y);
  return (
    position.x < trackMinX ||
    position.x > trackMaxX ||
    position.y < trackMinY ||
    position.y > trackMaxY
  );
}

function getEndOfTrack(track, trackDirection) {
  return trackDirection === 1 ? track.end : track.begin;
}
function getBeginOfTrack(track, trackDirection) {
  return trackDirection === 1 ? track.begin : track.end;
}

function getRandomElementOfArray(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function moveTrain() {
  // 現在stationだったら一定時間停止する
  if (train.track.isStation && train.stationWaitTime < maxStationWaitTime) {
    train.stationWaitTime ++;
    return;
  }

  const { x: directionX, y: directionY } = getTrackDirection(train.track);
  train.position.x += directionX * train.trackDirection * train.speed;
  train.position.y += directionY * train.trackDirection * train.speed;
  
  // trainがtrackの外に出たら
  if (isTrainOutTrack(train.position, train.track)) {
    train.stationWaitTime = 0;

    const nextTrack = train.trackDirection === 1 ? train.track.nextTracks[train.track.nextSwitch.trackIndex] : train.track.prevTracks[train.track.prevSwitch.trackIndex];
    if (nextTrack) {
      // trackの終点から行き過ぎた距離を求める
      const distance = getDistance(getEndOfTrack(train.track, train.trackDirection), train.position);

      if (deepEqual(getEndOfTrack(train.track, train.trackDirection), getBeginOfTrack(nextTrack, 1))) {
        train.trackDirection = 1;
        train.position.x = nextTrack.begin.x + distance * getTrackDirection(nextTrack).x;
        train.position.y = nextTrack.begin.y + distance * getTrackDirection(nextTrack).y;
      } else {
        train.trackDirection = -1;
        train.position.x = nextTrack.end.x - distance * getTrackDirection(nextTrack).x;
        train.position.y = nextTrack.end.y - distance * getTrackDirection(nextTrack).y;
      }
      
      train.track = nextTrack;
    } else {
      train.position.x = getEndOfTrack(train.track, train.trackDirection).x;
      train.position.y = getEndOfTrack(train.track, train.trackDirection).y;
      train.trackDirection = -train.trackDirection;
    }
  }
}

function main() {
  draw();
  moveTrain();
}

function getNearestTrackPoint(point) {
  let minDistance = Number.MAX_VALUE;
  let minTrackPoint = null;
  for (const track of tracks) {
    const distanceBegin = getDistance(point, track.begin);
    const distanceEnd = getDistance(point, track.end);
    if (distanceBegin < minDistance) {
      minDistance = distanceBegin;
      minTrackPoint = track.begin;
    }
    if (distanceEnd < minDistance) {
      minDistance = distanceEnd;
      minTrackPoint = track.end;
    }
  }

  return minTrackPoint;
}

onload = function () {
  const thresholdTrackDistance = 10;

  railImage.src = 'rail.png';
  railImage.onload = () => {
    let timeoutId = setInterval(main, 100);

    const button = document.getElementById('button-slow-speed');
    button.onclick = function () {
      clearInterval(timeoutId);
      if (button.value === 'slow') {
        button.value = 'fast';
        timeoutId = setInterval(main, 100);
      } else {
        button.value = 'slow';
        timeoutId = setInterval(main, 1000);
      }
    }
    const canvas = document.getElementById('canvas');
    canvas.onmousedown = function (e) {
      if (e.button === 0) {
        // 左クリックのとき、近くのtrackから始まるtrackを作成する
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const nearestTrackPoint = getNearestTrackPoint({ x, y });
        if (getDistance(nearestTrackPoint, { x, y }) < thresholdTrackDistance) {
          mouseDownStartPoint = nearestTrackPoint;
          // TODO: 複数の無関係な点が同じ距離だった場合に対応する
          mouseDownStartTracks = tracks.filter(track => deepEqual(track.begin, mouseDownStartPoint) || deepEqual(track.end, mouseDownStartPoint));
        } else {
          mouseDownStartPoint = null;
          mouseDownStartTracks = [];
        }
      } else if (e.button === 2) {
        // 右クリックのとき、近くのswitchを切り替える
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const nearestTrackPoint = getNearestTrackPoint({ x, y });
        if (getDistance(nearestTrackPoint, { x, y }) < thresholdTrackDistance) {
          const nearestTracks = tracks.map(track => deepEqual(track.begin, nearestTrackPoint) ? { beginOrEnd: 'begin', track } : deepEqual(track.end, nearestTrackPoint) ? { beginOrEnd: 'end', track } : null).filter(track => track !== null);
          const baseTrack = nearestTracks[0];
          const baseSwitch = nearestTracks[0].beginOrEnd === 'begin' ? nearestTracks[0].track.prevSwitch : nearestTracks[0].track.nextSwitch;
          const adjacentTracks = nearestTracks[0].beginOrEnd === 'begin' ? nearestTracks[0].track.prevTracks : nearestTracks[0].track.nextTracks;
          baseSwitch.trackIndex = (baseSwitch.trackIndex + 1) % adjacentTracks.length;
          nearestTracks.slice(1).forEach(track => {
            const adjacentTrack = adjacentTracks.find(adjacentTrack => adjacentTrack === track.track);
            if (adjacentTrack) {
              if (track.beginOrEnd === 'begin') {
                track.track.prevSwitch.trackIndex = track.track.prevTracks.indexOf(baseTrack.track);
              } else {
                track.track.nextSwitch.trackIndex = track.track.nextTracks.indexOf(baseTrack.track);
              }
            }
          });
        }
      }
    }

    canvas.onmousemove = function (e) {
      currentMousePosition = { x: e.clientX, y: e.clientY };
    }

    canvas.onmouseup = function (e) {
      if (mouseDownStartPoint === null) {
        return;
      }

      const rect = e.target.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // newTrackの長さが短いときは作らない
      if (getDistance(mouseDownStartPoint, { x, y }) < thresholdTrackDistance) {
        mouseDownStartPoint = null;
        mouseDownStartTracks = [];
        return;
      }

      const begin = { x: mouseDownStartPoint.x, y: mouseDownStartPoint.y };
      const end = { x, y };
      
      // 最も近いtrackの始点または終点に吸着する
      const nearestTrackPoint = getNearestTrackPoint({ x, y });
      if (getDistance(nearestTrackPoint, { x, y }) < thresholdTrackDistance) {
        // 吸着したtrackの始点または終点がmouseDownStartPointと同じ場合は新たなtrackを作らない
        if (deepEqual(nearestTrackPoint, mouseDownStartPoint)) {
          mouseDownStartPoint = null;
          mouseDownStartTracks = [];
          return;
        }

        if (deepEqual(nearestTrackPoint, begin)) {
          end.x = nearestTrackPoint.x;
          end.y = nearestTrackPoint.y;
        } else {
          begin.x = nearestTrackPoint.x;
          begin.y = nearestTrackPoint.y;
        }
      } else {
        createNewTrack(begin, end);
      }
    }
  }
}

function createNewTrack(begin, end) {
  const newTrack = {
    begin,
    end,
    nextTracks: [],
    prevTracks: mouseDownStartTracks,
    nextSwitch: { trackIndex: -1 },
    prevSwitch: { trackIndex: 0 },
    isStation: false,
  };

  tracks.push(newTrack);

  for (const track of mouseDownStartTracks) {
    if (deepEqual(track.begin, mouseDownStartPoint)) {
      track.prevTracks.push(newTrack);
      if (track.prevSwitch.trackIndex === -1) {
        track.prevSwitch.trackIndex = 0;
      }
    } else {
      track.nextTracks.push(newTrack);
      if (track.nextSwitch.trackIndex === -1) {
        track.nextSwitch.trackIndex = 0;
      }
    }
  }

  mouseDownStartPoint = null;
  mouseDownStartTracks = [];
}