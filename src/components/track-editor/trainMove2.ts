import { assert } from '../../common.js';
import { ArrivalAndDepartureStatus, HalfTrack, Point, Switch } from '../../model.js';
import {
  getDistance,
  getMidPoint,
  getOccupyingTracks,
  getRadian,
  getTrackDirection,
  isTrainOutTrack,
} from '../../trackUtil.js';
import { BranchDirection, Timetable, Train } from './uiEditorModel.js';

function getStopPosition(_train: PlacedTrain, stationTrack: HalfTrack): Point | undefined {
  if (!stationTrack.track.platform) return undefined;

  const midPoint = getMidPoint(stationTrack._begin, stationTrack._end);
  return midPoint;
}

function shouldStopTrain(train: PlacedTrain): false | Point {
  if (
    !train.track.track.platform ||
    train.stationStatus !== 'NotArrived' /*|| train.stationWaitTime >= this.maxStationWaitTime*/
  )
    return false;

  const stationTrack = train.track;
  const stopPosition = getStopPosition(train, stationTrack);
  if (!stopPosition) return false;

  // 列車の進行方向から、すでにstopPositionを過ぎたかどうかを判定
  if (getDistance(train.position, stopPosition) < 3) return stopPosition; // 近すぎる場合はstopと判定

  const r = getRadian(train.track, { _begin: train.position, _end: stopPosition });
  if (Math.abs(r) > Math.PI / 2) {
    return false;
  }

  return stopPosition;
}

class TrainOccupy {
  /* trackId => train */
  // readonly occupyingTrain: Map<number, Train> = new Map<number, Train>();
  readonly occupyingTracks: Map<string, HalfTrack[]> = new Map<string, HalfTrack[]>();

  addTrain(train: PlacedTrain) {
    this.occupyingTracks.set(train.trainId, [train.track]);
  }

  deleteTrain(train: PlacedTrain) {
    this.occupyingTracks.delete(train.trainId);
  }

  isOccupiedTrack(train: PlacedTrain, toOccupyTracks: HalfTrack[]): boolean {
    const override = [];
    for (const [trainId, tracks] of this.occupyingTracks) {
      if (trainId !== train.trainId) {
        override.push(...tracks.filter((t) => toOccupyTracks.filter((t2) => t2.trackId === t.trackId).length > 0));
      }
    }

    if (override.length > 0) {
      console.warn({ train, override });
    }

    return override.length > 0;
  }

  updateOccupyingTrack(train: PlacedTrain, toOccupyTracks: HalfTrack[]) {
    this.occupyingTracks.delete(train.trainId);

    this.occupyingTracks.set(train.trainId, toOccupyTracks);
  }
}

function getNextTrackOfSwitchPattern(
  Switch: Switch,
  currentTrack: HalfTrack,
  switchPatternIndex: [number, number]
): HalfTrack | null {
  const [index1, index2] = switchPatternIndex;
  if (Switch.switchPatterns[index1][0] === currentTrack) {
    return Switch.switchPatterns[index1][1];
  } else if (Switch.switchPatterns[index2][0].trackId === currentTrack.trackId) {
    return Switch.switchPatterns[index2][1];
  } else {
    // 定位の方向ではないtrackからswitchに侵入している
    return null;
  }
}

// 定位のtrackを返す
export function getNextTrackOfStraightPattern(currentSwitch: Switch, track: HalfTrack): HalfTrack | null {
  assert(currentSwitch.straightPatternIndex !== null);
  return getNextTrackOfSwitchPattern(currentSwitch, track, currentSwitch.straightPatternIndex);
}

// 反位のtrackを返す
export function getNextTrackOfBranchPattern(Switch: Switch, currentTrack: HalfTrack): HalfTrack | null {
  assert(Switch.straightPatternIndex !== null);
  const [straightPatternIndex1, straightPatternIndex2] = Switch.straightPatternIndex;
  const candidatePatterns = Switch.switchPatterns
    .filter(
      // straightPatternIndexの2つ以外
      (_, i) => i !== straightPatternIndex1 && i !== straightPatternIndex2
    )
    .filter(
      ([t, _]) =>
        // 分岐の始点がcurrentTrackと一致するもの
        t.trackId === currentTrack.trackId
    );

  if (candidatePatterns.length === 0) {
    return null;
  }

  if (candidatePatterns.length !== 1) {
    // 一般のレイアウトだと2つ以上分岐がありうるが、とりあえず1つのみの制約とする
    throw new Error('candidatePatterns.length !== 1');
  }

  return candidatePatterns[0][1];
}

interface PlacedTrain {
  trainId: string;
  diaTrain: Train;
  speed: number;
  track: HalfTrack;
  position: Point;
  stationWaitTime: number;
  stationStatus: ArrivalAndDepartureStatus;
}

const TimeActionMode: 'Just' | 'After' = 'After';

export class TrainMove2 {
  trains: PlacedTrain[] = [];
  timetable: Timetable;
  readonly trainOccupy = new TrainOccupy();
  readonly globalTimeSpeed = 10; // 1サイクルで進む秒数
  readonly maxStationWaitTime = Number.MAX_VALUE;

  globalTime = 0;

  constructor(timetable: Timetable) {
    this.timetable = timetable;
    this.resetGlobalTime();
  }

  resetGlobalTime() {
    const minTimetableTime = Math.min(
      ...this.timetable.platformTTItems.filter((t) => t.departureTime !== null).map((t) => t.departureTime! - 60)
    );
    this.globalTime = minTimetableTime === Infinity ? 0 : minTimetableTime;
  }

  getNextTrack(track: HalfTrack): HalfTrack {
    const currentSwitch = track._nextSwitch;
    const nextTracks = currentSwitch.switchPatterns.filter(([t, _]) => t.trackId === track.trackId).map(([_, t]) => t);
    if (nextTracks.length === 0) {
      // 進行方向に進めるトラックがない場合、逆方向に進む
      return track.reverseTrack;
    }
    if (nextTracks.length === 1) {
      // 進行方向に進めるトラックが1つの場合、それを返す
      return nextTracks[0];
    }

    const ttItems = this.timetable.switchTTItems.filter((t) => t.Switch.switchId === currentSwitch.switchId);
    let branchDirection: BranchDirection;
    if (ttItems.length === 0) {
      // 進行方向を設定していないとき
      console.warn('ttItems.length === 0');
      // 定位に進む
      branchDirection = 'Straight';
    } else {
      if (ttItems.length > 1) {
        console.warn('ttItems.length > 1');
      }
      branchDirection = ttItems[0].branchDirection;
    }

    if (branchDirection === 'Straight') {
      const nextTrack = getNextTrackOfStraightPattern(currentSwitch, track);
      assert(nextTrack !== null, 'nextTrack !== null'); // TODO: 3分岐以上になった場合、進行方向に進めるtrackが2つ以上かつ定位方向ではない方向から進入する場合がある。といってもその場合は、Straight/Branchという区別ではどちらにしても足りなくなる。
      return nextTrack;
    } else {
      const nextTrack = getNextTrackOfBranchPattern(currentSwitch, track);
      assert(nextTrack !== null, 'nextTrack !== null'); // 分岐方向に設定されていたら分岐が無いといけないはずなので、nullはありえない
      return nextTrack;
    }
  }

  moveTrain(train: PlacedTrain): void {
    // 現在stationだったら出発条件を満たすまで停止する
    if (
      train.track.track.platform !== null &&
      train.stationStatus === 'Arrived' &&
      train.stationWaitTime < this.maxStationWaitTime
    ) {
      const timetableItems = this.timetable.platformTTItems.filter(
        (t) => t.platform.platformId === train.track.track.platform!.platformId && t.train.trainId === train.trainId
      );
      if (timetableItems.length === 0) {
        // 時刻が設定されていないときは即座に発車
        console.warn('timetableItems.length === 0');
      } else {
        if (TimeActionMode === 'Just') {
          // ちょうど発車時間になったら出発する
          const departureItems = timetableItems.filter(
            (tt) =>
              tt.departureTime !== null &&
              tt.departureTime > this.globalTime - this.globalTimeSpeed &&
              tt.departureTime <= this.globalTime
          );
          if (departureItems.length === 0) {
            // 発車時間ではない
            return;
          }

          console.log('departureItems.length >= 1', departureItems);
        } else {
          // TODO: 別のモードを実装
        }
      }
      // 発車
      train.stationStatus = 'Departed';
    }

    const { x: directionX, y: directionY } = getTrackDirection(train.track);
    train.position.x += directionX * train.speed;
    train.position.y += directionY * train.speed;

    while (true) {
      // trainがtrackの外に出たら、次の線路に移動する
      if (isTrainOutTrack(train.position, train.track)) {
        train.stationWaitTime = 0;
        train.stationStatus = 'NotArrived';

        let nextTrack = this.getNextTrack(train.track);

        // trackの終点から行き過ぎた距離を求める
        const distance = getDistance(train.track._end, train.position);

        train.position.x = nextTrack._begin.x + distance * getTrackDirection(nextTrack).x;
        train.position.y = nextTrack._begin.y + distance * getTrackDirection(nextTrack).y;

        this.trainOccupy.updateOccupyingTrack(train, getOccupyingTracks(train.track));
        train.track = nextTrack;

        // 線路内に入るまでループ
        continue;
      }

      // stationの停止位置か、それを過ぎた場合 => 停止位置に止めて停止状態にする
      const stopPosition = shouldStopTrain(train);
      if (stopPosition) {
        train.position.x = stopPosition.x;
        train.position.y = stopPosition.y;
        train.stationStatus = 'Arrived';
        break;
      }

      // track内を移動しただけ
      break;
    }
  }

  toStringGlobalTime(): string {
    const m = Math.floor((this.globalTime / 60) % 60);
    return Math.floor(this.globalTime / 60 / 60) + ':' + (m < 10 ? '0' + m : '' + m);
  }

  // 1フレームごとに呼び出す関数
  tick(): void {
    for (const train of this.trains) {
      this.moveTrain(train);
    }

    this.globalTime += this.globalTimeSpeed;
    if (this.globalTime >= 24 * 60 * 60) {
      this.globalTime = 24 * 60 * 60 - 1;
    }
  }
}
