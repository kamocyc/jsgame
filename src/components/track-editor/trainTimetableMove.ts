import { DeepReadonly } from 'ts-essentials';
import { assert, fst_, lst_, nn } from '../../common.js';
import { DetailedTimetable, DiaTime, Operation, Point, Track, Train, generateId } from '../../model.js';
import {
  getDistance,
  getMidPoint,
  getNextTrackOfBranchPattern,
  getNextTrackOfStraightPattern,
  getRadian,
  getTrackDirection,
  isTrainOutTrack,
} from '../../trackUtil.js';
import { GlobalTimeManager } from './globalTimeManager.js';
import {
  ITrainMove,
  PlacedTrain,
  TrainMoveProps,
  getFirstTimeOfTrain,
  getLastTimeOfTrain,
  getMinTimetableTime,
  getStopPosition,
} from './trainMoveBase.js';

function getNextTrain(operation: Operation, currentTrainId: string): string | null {
  const index = operation.trainIds.findIndex((trainId) => trainId === currentTrainId);
  if (index === -1) {
    throw new Error('currentTrainIdが見つからない');
  }

  if (index === operation.trainIds.length - 1) {
    return null;
  }

  return operation.trainIds[index + 1];
}

export class TrainTimetableMove implements ITrainMove {
  placedTrains: PlacedTrain[] = [];
  timetable: DetailedTimetable;
  readonly maxStationWaitTime = Number.MAX_VALUE;

  constructor(timetable: DetailedTimetable) {
    this.timetable = timetable;
  }

  getPlacedTrains(): PlacedTrain[] {
    return this.placedTrains;
  }

  getTrainMoveType() {
    return 'TrainMove' as const;
  }

  resetTrainMove(globalTimeManager: GlobalTimeManager, trains: DeepReadonly<Map<string, Train>>): void {
    this.placedTrains = [];
    globalTimeManager.resetGlobalTime(getMinTimetableTime(trains, this.timetable));
  }

  private getNextTrack(track: Track, placedTrain: PlacedTrain): Track {
    const currentSwitch = track.nextSwitch;
    const nextTracks = currentSwitch.switchPatterns.filter(([t, _]) => t.trackId === track.trackId).map(([_, t]) => t);
    if (nextTracks.length === 0) {
      throw new Error('進行方向に進めるトラックがない');
    }
    if (nextTracks.length === 1) {
      // 進行方向に進めるトラックが1つの場合、それを返す
      return nextTracks[0];
    }

    const ttItem = this.timetable.switchTimetableMap.get(currentSwitch.switchId);
    assert(ttItem !== undefined, '時刻情報が設定されていない');

    const branchDirection = ttItem.getBranchDirection(placedTrain.trainId);
    if (branchDirection === 'Straight') {
      const nextTrack = getNextTrackOfStraightPattern(currentSwitch, track);
      assert(nextTrack !== null, 'nextTrack !== null');
      return nextTrack;
    } else {
      const nextTrack = getNextTrackOfBranchPattern(currentSwitch, track);
      assert(nextTrack !== null, 'nextTrack !== null'); // 分岐方向に設定されていたら分岐が無いといけないはずなので、nullはありえない
      return nextTrack;
    }
  }

  private setTrainForOperation(placedTrain: PlacedTrain, operationTrainId: string, props: TrainMoveProps) {
    const operationTrain = nn(props.trains.get(operationTrainId));
    const firstDiaTime = operationTrain.diaTimes[0];
    const track = props.tracks.find((t) => t.trackId === firstDiaTime.trackId);
    assert(track != undefined);

    placedTrain.train = operationTrain;
    placedTrain.placedTrainName = operationTrain.trainName;
    placedTrain.trainId = operationTrainId;
    placedTrain.speed = 10;
    placedTrain.stationWaitTime = 0;
    placedTrain.stationStatus = 'Arrived';
    placedTrain.operatingStatus = firstDiaTime.isInService ? 'InService' : 'OutOfService';
    placedTrain.track = track;
    placedTrain.position = getMidPoint(track.begin, track.end);
    placedTrain.placedRailwayLineId = null;
    placedTrain.stopId = null;
    placedTrain.justDepartedPlatformId = null;
    placedTrain.diaTimeId = firstDiaTime.diaTimeId;
  }

  private waitInStation(placedTrain: PlacedTrain, props: TrainMoveProps): boolean {
    const platformTimetable = this.timetable.platformTimetableMap.get(placedTrain.track.track.platform!.platformId);
    assert(platformTimetable !== undefined, 'platformTimetable !== undefined');
    const ttItem = platformTimetable.getPlatformTTItem(placedTrain.trainId);
    if (ttItem.departureTime === null) {
      // 出発時刻が設定されていないときは、運用の次の列車に付け替える
      // {
      //   const nextDiaTime = this.getNextDiaTime(placedTrain);
      //   assert(nextDiaTime !== null, 'nextDiaTime !== null');
      //   assert(
      //     this.getNextDiaTime({ ...placedTrain, diaTimeId: nextDiaTime.diaTimeId }) === null,
      //     'this.getNextDiaTime({ ...placedTrain, diaTimeId: nextDiaTime.diaTimeId }) === null'
      //   );
      // }
      // assert(platformTimetable.isLastTTItem(ttItem));

      const operation = this.timetable.operations.find((o) => o.operationId === placedTrain.operationId);
      assert(operation !== undefined, 'operation !== undefined');
      const nextTrainId = getNextTrain(operation, placedTrain.trainId);
      if (nextTrainId === null) {
        // 次の運用がないときは、留置にする
        placedTrain.operatingStatus = 'Parking';
        return false;
      }

      // 次の運用に設定
      this.setTrainForOperation(placedTrain, nextTrainId, props);
      return false;
    }

    if (props.globalTimeManager.globalTime >= ttItem.departureTime) {
      console.log(
        'departed: globalTime=' + props.globalTimeManager.globalTime + ' / departureTime=' + ttItem.departureTime
      );
      // 出発時刻を過ぎたら出発する
      placedTrain.stationStatus = 'Running';
      const nextDiaTime = this.getNextDiaTime(placedTrain, props)?.diaTimeId;
      assert(nextDiaTime !== undefined, 'nextDiaTime !== undefined');
      placedTrain.diaTimeId = nextDiaTime;
      placedTrain.justDepartedPlatformId = nn(placedTrain.track.track.platform).platformId;
      return true;
    }

    return false;
  }

  private getDiaTimes(placedTrain: PlacedTrain, props: TrainMoveProps): DeepReadonly<DiaTime[]> {
    const trainId = this.timetable.operations
      .find((o) => o.operationId === placedTrain.operationId)
      ?.trainIds.find((trainId) => trainId === placedTrain.trainId);
    const diaTimes = trainId !== undefined ? props.trains.get(trainId)?.diaTimes : undefined;
    assert(diaTimes !== undefined, 'diaTimes !== undefined');
    return diaTimes;
  }

  private getNextDiaTime(placedTrain: PlacedTrain, props: TrainMoveProps): DiaTime | null {
    const diaTimes = this.getDiaTimes(placedTrain, props);
    const diaTimeIndex = diaTimes.findIndex((d) => d.diaTimeId === placedTrain.diaTimeId);
    assert(diaTimeIndex !== -1, 'diaTimeIndex !== -1');

    const nextNotPassingDiaTime = diaTimes.slice(diaTimeIndex + 1).find((d) => !d.isPassing);
    if (nextNotPassingDiaTime !== undefined) {
      return nextNotPassingDiaTime;
    }
    return null;
  }

  private shouldStopTrain(train: PlacedTrain, props: TrainMoveProps): false | Point {
    if (!train.track.track.platform || train.stationStatus === 'Arrived') return false;

    const stationTrack = train.track;
    const stopPosition = getStopPosition(train, stationTrack);
    if (!stopPosition) return false;

    // 直前に出発した駅なら停止しない
    if (train.justDepartedPlatformId === stationTrack.track.platform?.platformId) {
      return false;
    }

    const diaTime = this.getDiaTimes(train, props).find((diaTime) => diaTime.diaTimeId === train.diaTimeId);
    assert(diaTime !== undefined);
    const nextStopPlatform = diaTime.platformId;
    if (nextStopPlatform !== stationTrack.track.platform?.platformId) {
      return false;
    }

    // 列車の進行方向から、すでにstopPositionを過ぎたかどうかを判定
    if (getDistance(train.position, stopPosition) < 3) return stopPosition; // 近すぎる場合はstopと判定

    const r = getRadian(train.track, { begin: train.position, end: stopPosition });
    if (Math.abs(r) > Math.PI / 2) {
      return false;
    }

    return stopPosition;
  }

  private moveTrain(placedTrain: PlacedTrain, props: TrainMoveProps) {
    // 現在stationだったら出発条件を満たすまで停止する
    if (placedTrain.track.track.platform !== null && placedTrain.stationStatus === 'Arrived') {
      const shouldProceed = this.waitInStation(placedTrain, props);
      if (!shouldProceed) {
        return;
      }
    }

    const { x: directionX, y: directionY } = getTrackDirection(placedTrain.track);
    placedTrain.position.x += directionX * placedTrain.speed;
    placedTrain.position.y += directionY * placedTrain.speed;
    placedTrain.stationWaitTime = 0;

    while (true) {
      // stationの停止位置か、それを過ぎた場合 => 停止位置に止めて停止状態にする
      const stopPosition = this.shouldStopTrain(placedTrain, props);
      if (stopPosition) {
        placedTrain.position.x = stopPosition.x;
        placedTrain.position.y = stopPosition.y;
        placedTrain.stationStatus = 'Arrived';
        break;
      }

      // trainがtrackの外に出たら、次の線路に移動する
      if (isTrainOutTrack(placedTrain.position, placedTrain.track)) {
        placedTrain.stationWaitTime = 0;
        placedTrain.stationStatus = 'Running';
        placedTrain.justDepartedPlatformId = null;

        const nextTrack = this.getNextTrack(placedTrain.track, placedTrain);

        // trackの終点から行き過ぎた距離を求める
        const distance = getDistance(placedTrain.track.end, placedTrain.position);

        placedTrain.position.x = nextTrack.begin.x + distance * getTrackDirection(nextTrack).x;
        placedTrain.position.y = nextTrack.begin.y + distance * getTrackDirection(nextTrack).y;

        placedTrain.track = nextTrack;

        // 線路内に入るまでループ
        continue;
      }

      // track内を移動しただけ
      break;
    }
  }

  // 1フレームごとに呼び出す関数
  tick(props: TrainMoveProps): void {
    const placedTrains = [...this.placedTrains]; // 一応中で破壊的にremoveするので、コピーを作る

    // 初期位置に列車を配置
    for (const operation of this.timetable.operations) {
      const firstTrainId = fst_(operation.trainIds);
      const firstTrain = nn(props.trains.get(firstTrainId));
      const firstDiaTime = firstTrain.diaTimes[0];
      const nextDiaTime = firstTrain.diaTimes[1];
      if (
        getFirstTimeOfTrain(props.trains, firstTrainId) <= props.globalTimeManager.globalTime &&
        getLastTimeOfTrain(nn(props.trains.get(lst_(operation.trainIds)))) >= props.globalTimeManager.globalTime &&
        !placedTrains.some((placedTrain) => placedTrain.trainId === firstTrain.trainId) &&
        (nextDiaTime.arrivalTime != null || nextDiaTime.departureTime != null) &&
        (nextDiaTime.arrivalTime ?? nextDiaTime.departureTime)! >= props.globalTimeManager.globalTime
      ) {
        const operationTrackId = fst_(firstTrain.diaTimes).trackId;
        const track = props.tracks.find((t) => t.trackId === operationTrackId);
        assert(track != null);

        const existingPlacedTrain = placedTrains.find(
          (t) => t.track.trackId === track.trackId || t.track.reverseTrack.trackId === track.trackId
        );
        if (existingPlacedTrain === undefined) {
          // この場合は無くすべき
          placedTrains.push({
            placedTrainId: generateId(),
            train: firstTrain,
            placedTrainName: firstTrain.trainName,
            operationId: operation.operationId,
            trainId: firstTrain.trainId,
            speed: 10,
            stationWaitTime: 0,
            stationStatus: 'Arrived',
            operatingStatus: firstDiaTime.isInService ? 'InService' : 'OutOfService',
            track: track,
            position: getMidPoint(track.begin, track.end),
            operation: operation,
            placedRailwayLineId: null,
            stopId: null,
            justDepartedPlatformId: null,
            diaTimeId: firstDiaTime.diaTimeId,
          });
        }
      }
    }

    for (const train of placedTrains) {
      this.moveTrain(train, props);
      // 運行費を消費する
      props.moneyManager.addMoney(-10);
    }

    this.placedTrains = placedTrains;

    // const collided = this.getCollidedTrains();
    // if (collided !== null) {
    //   const [train1, train2] = collided;
    //   console.log(`collide`);
    //   console.log(train1);
    //   console.log(train2);
    // }
  }
}
