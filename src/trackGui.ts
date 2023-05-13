import { assert, deepEqual } from "./common.js";
import { HalfTrack, HalfTrackWip, Point, Station, Switch, generateId } from "./model.js";
import { changeSwitch, createNewTrack, getDistance, getNearestTrackPoint } from "./trackUtil.js";

let currentMousePosition = { x: 0, y: 0 };

let mouseDownStartPoint: Point | null = null;
let mouseDownStartTracks: HalfTrack[] = [];

export function initializeMouseEvents(canvas: HTMLCanvasElement, tracks: HalfTrack[], switches: Switch[]) {
  const thresholdTrackDistance = 10;

  // const button = document.getElementById('button-slow-speed') as HTMLInputElement;
  // button.onclick = function () {
  //   toJSON();
  //   clearInterval(timeoutId);
  //   if (button.value === 'slow') {
  //     button.value = 'fast';
  //     timeoutId = setInterval(main, 100);
  //   } else {
  //     button.value = 'slow';
  //     timeoutId = setInterval(main, 1000);
  //   }
  // }
  // const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  canvas.onmousedown = function (e) {
    if (e.button === 0) {
      // 左クリックのとき、近くのtrackから始まるtrackを作成する
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const nearestTrackPoint = getNearestTrackPoint(tracks, { x, y });
      if (getDistance(nearestTrackPoint, { x, y }) < thresholdTrackDistance) {
        mouseDownStartPoint = nearestTrackPoint;
        // TODO: 複数の無関係な点が同じ距離だった場合に対応する
        mouseDownStartTracks = tracks.filter(track => deepEqual(track._end, mouseDownStartPoint));
      } else {
        // 近くのtrackが存在しない場合は独立した線路を作成する
        mouseDownStartPoint = { x, y };
        mouseDownStartTracks = [];
      }
    } else if (e.button === 2) {
      // 右クリックのとき、近くのswitchを切り替える
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const nearestTrackPoint = getNearestTrackPoint(tracks, { x, y });
      if (getDistance(nearestTrackPoint, { x, y }) < thresholdTrackDistance) {
        changeSwitch(nearestTrackPoint);
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

    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
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
    const nearestTrackPoint = getNearestTrackPoint(tracks, { x, y });
    if (getDistance(nearestTrackPoint, { x, y }) < thresholdTrackDistance) {
      // 吸着したtrackの始点または終点がmouseDownStartPointと同じ場合は新たなtrackを作らない
      if (deepEqual(nearestTrackPoint, mouseDownStartPoint)) {
        mouseDownStartPoint = null;
        mouseDownStartTracks = [];
        return;
      }

      end.x = nearestTrackPoint.x;
      end.y = nearestTrackPoint.y;
      
      const nextTracks = tracks.filter(track => deepEqual(track._begin, nearestTrackPoint));
      
      const [track1, track2, switches_] = createNewTrack(begin, end, nextTracks, mouseDownStartTracks, null);
      tracks.push(track1, track2);
      switches.push(...switches_);
    } else {
      // 離れているときは新たに線路を作る
      const [track1, track2, switches_] = createNewTrack(begin, end, [], mouseDownStartTracks, null);
      tracks.push(track1, track2);
      switches.push(...switches_);
    }

    mouseDownStartPoint = null;
    mouseDownStartTracks = [];
  }

  canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); })
}
