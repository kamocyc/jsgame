import { RailwayLine, RailwayLineStop } from '../../mapEditorModel';
import { Track } from '../../model';
import { getDistance, getMidPoint, getTrackDirection, isTrainOutTrack } from '../../trackUtil';
import { GlobalTimeManager } from './globalTimeManager';
import { shouldStopTrain } from './trainMove';
import { ITrainMove, PlacedTrain, StoredTrain } from './trainMoveBase';

function getAllPathOfRailwayLine(railwayLine: RailwayLine) {
  const paths: (readonly [Track, string])[] = [];
  for (const stop of railwayLine.stops) {
    if (stop.platformPaths === null) {
      throw new Error('platformPaths is null');
    }
    if (stop.platformPaths.length === 0) continue;
    // 同じ方向で進むとき、次のパスで重複するので、重複を除外
    let newPath = stop.platformPaths;
    if (paths.length > 0) {
      if (newPath[0].trackId === paths[paths.length - 1][0].trackId) {
        newPath = newPath.slice(1);
      }
    }
    paths.push(...newPath.map((p) => [p, stop.stopId] as const));
  }
  return paths;
}

function isTrackOccupied(track: Track, placedTrains: PlacedTrain[]): boolean {
  for (const placedTrain of placedTrains) {
    if (placedTrain.track.trackId === track.trackId) {
      return true;
    }
  }
  return false;
}

export function getRailwayLineAndStopOfPlacedTrain(
  placedTrain: PlacedTrain,
  railwayLines: RailwayLine[]
): readonly [RailwayLine, RailwayLineStop] {
  if (placedTrain.placedRailwayLineId == null) {
    throw new Error('placedRailwayLineId is null');
  }
  if (placedTrain.stopId == null) {
    throw new Error('stopId is null');
  }
  const railwayLine = railwayLines.find((r) => r.railwayLineId === placedTrain.placedRailwayLineId);
  if (railwayLine === undefined) {
    throw new Error('railwayLine is undefined');
  }
  const stop = railwayLine.stops.find((stop) => stop.stopId === placedTrain.stopId);
  if (stop === undefined) {
    throw new Error('stop is undefined');
  }
  return [railwayLine, stop] as const;
}

export class TrainRailwayMove implements ITrainMove {
  readonly maxStationWaitTime: number = 3;

  placedTrains: PlacedTrain[] = [];

  constructor(private railwayLines: RailwayLine[], private storedTrains: StoredTrain[]) {}
  getTrainMoveType() {
    return 'TrainRailwayMove' as const;
  }

  getPlacedTrains(): PlacedTrain[] {
    return this.placedTrains;
  }
  resetTrainMove(globalTimeManager: GlobalTimeManager): void {
    this.placedTrains = []; // TODO: ここで初期化するのはおかしい？
    globalTimeManager.resetGlobalTime(0);
  }

  tick() {
    // TODO: 毎回は求めないようにすべき
    const notPlacedTrains = this.storedTrains.filter(
      (train) => this.placedTrains.find((p) => p.placedTrainId === train.placedTrainId) == null
    );
    for (const train of notPlacedTrains) {
      const railwayLine = this.railwayLines.find((r) => r.railwayLineId === train.placedRailwayLineId);
      if (railwayLine === undefined) continue;

      if (railwayLine.stops.length === 0) {
        throw new Error('railwayLine.stops.length === 0');
      }

      // 配置済みの車両と衝突しないなら配置する
      const firstTrack = railwayLine.stops[0].platformTrack;
      if (
        this.placedTrains.find(
          (p) => p.track.trackId === firstTrack.trackId || p.track.reverseTrack.trackId === firstTrack.trackId
        ) != null
      ) {
        // 同じtrackにいるならスキップ（位置で判定するべき？）
        continue;
      }

      const placedTrain: PlacedTrain = {
        placedTrainId: train.placedTrainId,
        placedTrainName: train.placedTrainName,
        placedRailwayLineId: train.placedRailwayLineId,
        train: null,
        operation: null,
        speed: 10,
        track: firstTrack,
        stopId: railwayLine.stops[0].stopId,
        position: getMidPoint(firstTrack.begin, firstTrack.end),
        stationWaitTime: 0,
        stationStatus: 'Arrived',
      };
      this.placedTrains.push(placedTrain);
    }

    for (const placedTrain of this.placedTrains) {
      this.moveTrain(placedTrain);
    }
  }

  private getNextTrack(
    track: Track,
    placedTrain: PlacedTrain,
    railwayLine: RailwayLine,
    stop: RailwayLineStop
  ): readonly [Track, string] {
    // if (nextTracks.length === 0) {
    //   console.warn('逆方向')  // TODO?
    //   // 進行方向に進めるトラックがない場合、逆方向に進む
    //   return track.reverseTrack;
    // }
    // if (nextTracks.length === 1) {
    //   // 進行方向に進めるトラックが1つの場合、それを返す
    //   return nextTracks[0];
    // }

    if (stop.platformPaths == null) {
      throw new Error('platformPaths is null');
    }

    const allPaths = getAllPathOfRailwayLine(railwayLine);
    const trackIndexInPath = allPaths.findIndex(
      ([t, stopId]) => t.trackId === track.trackId && stopId === placedTrain.stopId
    );
    if (trackIndexInPath === -1) {
      throw new Error('trackIndexInPath is -1');
    }

    const nextTrackIndex = trackIndexInPath === allPaths.length - 1 ? 0 : trackIndexInPath + 1;
    const nextTrack = allPaths[nextTrackIndex];

    {
      // デバッグ用。折り返すときとかはnextに無い
      const currentSwitch = track.nextSwitch;
      const nextTracks = currentSwitch.switchPatterns
        .filter(([t, _]) => t.trackId === track.trackId)
        .map(([_, t]) => t);
      if (nextTracks.find((t) => t.trackId === nextTrack[0].trackId) == null) {
        console.warn({ nextTrack });
      }
    }
    return nextTrack;
  }

  private moveTrain(placedTrain: PlacedTrain) {
    if (placedTrain.placedRailwayLineId == null) {
      throw new Error('placedRailwayLineId is null');
    }
    if (placedTrain.stopId == null) {
      throw new Error('stopId is null');
    }
    const railwayLine = this.railwayLines.find((r) => r.railwayLineId === placedTrain.placedRailwayLineId);
    if (railwayLine === undefined) {
      throw new Error('railwayLine is undefined');
    }
    const stop = railwayLine.stops.find((stop) => stop.stopId === placedTrain.stopId);
    if (stop === undefined) {
      throw new Error('stop is undefined');
    }

    const result = getRailwayLineAndStopOfPlacedTrain(placedTrain, this.railwayLines);
    const [railwayLine2, stop2] = result;

    if (placedTrain.stationStatus === 'Arrived' && placedTrain.track.track.platform !== null) {
      if (placedTrain.stationWaitTime < this.maxStationWaitTime) {
        placedTrain.stationWaitTime++;
        return;
      }

      // 発車
      placedTrain.stationStatus = 'Departed';
    }

    const previousPosition = { ...placedTrain.position };
    const { x: directionX, y: directionY } = getTrackDirection(placedTrain.track);
    placedTrain.position.x += directionX * placedTrain.speed;
    placedTrain.position.y += directionY * placedTrain.speed;
    placedTrain.stationWaitTime = 0;

    // 移動先が衝突していたら、移動しない => なんか動いていない
    // if (this.isCollidedWithSomeTrain(placedTrain)) {
    //   console.log('collided')
    //   placedTrain.position = previousPosition;
    //   return;
    // }

    while (true) {
      // trainがtrackの外に出たら、次の線路に移動する
      if (isTrainOutTrack(placedTrain.position, placedTrain.track)) {
        placedTrain.stationWaitTime = 0;
        placedTrain.stationStatus = 'NotArrived';

        const nextTrackAndStopId = this.getNextTrack(placedTrain.track, placedTrain, railwayLine, stop);
        const nextTrack = nextTrackAndStopId[0];

        if (isTrackOccupied(nextTrack, this.placedTrains)) {
          // 次の線路がすでに占有されていたら、移動せずに止まる
          console.log('stop: ' + placedTrain.track.end.x + ', ' + placedTrain.track.end.y);
          placedTrain.position = previousPosition;
          break;
        }
        placedTrain.stopId = nextTrackAndStopId[1];

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

        // 次の線路がreverseのときは、reverseの線路にうつる
        const nextTrackAndStopId = this.getNextTrack(placedTrain.track, placedTrain, railwayLine, stop);
        if (nextTrackAndStopId[0].trackId === placedTrain.track.reverseTrack.trackId) {
          console.log('reverse');
          placedTrain.stopId = nextTrackAndStopId[1];
          placedTrain.track = placedTrain.track.reverseTrack;
        }
        break;
      }

      // track内を移動しただけ
      break;
    }
  }

  // private isCollidedWithSomeTrain(train1: PlacedTrain): boolean {
  //   const collisionDistance = (CellWidth * Math.SQRT2) / 4;
  //   function isCollided(train1: PlacedTrain, train2: PlacedTrain): boolean {
  //     if (getDistance(train1.position, train2.position) < collisionDistance) {
  //       return true;
  //     }
  //     return false;
  //   }
  //   for (const train2 of this.placedTrains) {
  //     if (train1.placedTrainId === train2.placedTrainId) continue;
  //     if (train1.track.trackId !== train2.track.trackId) continue;
  //     if (isCollided(train1, train2)) {
  //       return true;
  //     }
  //   }
  //   return false;
  // }
}
