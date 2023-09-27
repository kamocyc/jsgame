import { RailwayLine, RailwayLineStop } from "../../mapEditorModel";
import { Track } from "../../model";
import { getDistance, getTrackDirection, isTrainOutTrack } from "../../trackUtil";
import { PlacedTrain, shouldStopTrain } from "./trainMove";

function getAllPathOfRailwayLine(railwayLine: RailwayLine) {
  const paths: (readonly [Track, string])[] = [];
  for (const stop of railwayLine.stops) {
    if (stop.platformPaths === null) {
      throw new Error('platformPaths is null');
    }
    // TODO: これは次のパスで重複するのか？
    paths.push(...stop.platformPaths.map(p => [p, stop.stopId] as const));
  }
  return paths;
}

export class TrainRailwayMove {
  readonly maxStationWaitTime: number = 3;

  placedTrains: PlacedTrain[] = []

  constructor(private railwayLines: RailwayLine[]) {
  }
  
  tick() {
    for (const placedTrain of this.placedTrains) {
      this.moveTrain(placedTrain);
    }
  }

  getNextTrack(track: Track, placedTrain: PlacedTrain, railwayLine: RailwayLine, stop: RailwayLineStop): readonly [Track, string] {
    const currentSwitch = track.nextSwitch;
    const nextTracks = currentSwitch.switchPatterns.filter(([t, _]) => t.trackId === track.trackId).map(([_, t]) => t);
    // if (nextTracks.length === 0) {
    //   console.warn('逆方向')  // TODO?
    //   // 進行方向に進めるトラックがない場合、逆方向に進む
    //   return track.reverseTrack;
    // }
    // if (nextTracks.length === 1) {
    //   // 進行方向に進めるトラックが1つの場合、それを返す
    //   return nextTracks[0];
    // }

    if (stop.platformPaths === null) {
      throw new Error('platformPaths is null');
    }

    const allPaths = getAllPathOfRailwayLine(railwayLine);
    const trackIndexInPath = allPaths.findIndex(([t, stopId]) => t.trackId === track.trackId && stopId === placedTrain.stopId);
    if (trackIndexInPath === -1) {
      throw new Error('trackIndexInPath is -1');
    }

    const nextTrackIndex = trackIndexInPath === allPaths.length - 1 ? 0 : trackIndexInPath + 1;      
    const nextTrack = allPaths[nextTrackIndex];

    // TODO: 逆に行くときとかはないはず
    if (nextTracks.find(t => t.trackId === nextTrack[0].trackId) === null) {
      console.warn({nextTrack});
    }
    return nextTrack;
  }
  
  moveTrain(placedTrain: PlacedTrain) {
    if (placedTrain.placedRailwayLineId === null) {
      throw new Error('placedRailwayLineId is null');
    }
    if (placedTrain.stopId === null) {
      throw new Error('stopId is null');
    }
    const railwayLine = this.railwayLines.find(r => r.railwayLineId === placedTrain.placedRailwayLineId);
    if (railwayLine === undefined) {
      throw new Error('railwayLine is undefined');
    }
    const stop = railwayLine.stops.find(stop => stop.stopId === placedTrain.stopId);
    if (stop === undefined) {
      throw new Error('stop is undefined');
    }

    if (placedTrain.stationStatus === 'Arrived' && placedTrain.track.track.platform !== null) {
      if (placedTrain.stationWaitTime < this.maxStationWaitTime) {
        placedTrain.stationWaitTime ++;
        return;
      }

      // 発車
      placedTrain.stationStatus = 'Departed';
    }

    const { x: directionX, y: directionY } = getTrackDirection(placedTrain.track);
    placedTrain.position.x += directionX * placedTrain.speed;
    placedTrain.position.y += directionY * placedTrain.speed;
    placedTrain.stationWaitTime = 0;

    while (true) {
      // trainがtrackの外に出たら、次の線路に移動する
      if (isTrainOutTrack(placedTrain.position, placedTrain.track)) {
        placedTrain.stationWaitTime = 0;
        placedTrain.stationStatus = 'NotArrived';

        const nextTrackAndStopId = this.getNextTrack(placedTrain.track, placedTrain, railwayLine, stop);
        const nextTrack = nextTrackAndStopId[0];
        placedTrain.stopId = nextTrackAndStopId[1]

        // trackの終点から行き過ぎた距離を求める
        const distance = getDistance(placedTrain.track.end, placedTrain.position);

        placedTrain.position.x = nextTrack.begin.x + distance * getTrackDirection(nextTrack).x;
        placedTrain.position.y = nextTrack.begin.y + distance * getTrackDirection(nextTrack).y;

        placedTrain.track = nextTrack;

        // 線路内に入るまでループ
        continue;
      }

      // stationの停止位置か、それを過ぎた場合 => 停止位置に止めて停止状態にする
      const stopPosition = shouldStopTrain(placedTrain);
      if (stopPosition) {
        placedTrain.position.x = stopPosition.x;
        placedTrain.position.y = stopPosition.y;
        placedTrain.stationStatus = 'Arrived';
        break;
      }

      // track内を移動しただけ
      break;
    }
  }
}