import { assert } from '../../common.js';
import { CellWidth } from '../../mapEditorModel.js';
import { BranchDirection, DetailedTimetable, Operation, Train, generateId } from '../../model';
import { ArrivalAndDepartureStatus, Point, Switch, Track } from '../../model.js';
import {
  getDistance,
  getMidPoint,
  getOccupyingTracks,
  getRadian,
  getTrackDirection,
  isTrainOutTrack,
} from '../../trackUtil.js';

function getStopPosition(_train: PlacedTrain, stationTrack: Track): Point | undefined {
  if (!stationTrack.track.platform) return undefined;

  const midPoint = getMidPoint(stationTrack.begin, stationTrack.end);
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

  const r = getRadian(train.track, { begin: train.position, end: stopPosition });
  if (Math.abs(r) > Math.PI / 2) {
    return false;
  }

  return stopPosition;
}

class TrainOccupy {
  /* trackId => train */
  // readonly occupyingTrain: Map<number, Train> = new Map<number, Train>();
  readonly occupyingTracks: Map<string, Track[]> = new Map<string, Track[]>();

  addTrain(placedTrain: PlacedTrain) {
    this.occupyingTracks.set(placedTrain.placedTrainId, [placedTrain.track]);
  }

  deleteTrain(placedTrain: PlacedTrain) {
    this.occupyingTracks.delete(placedTrain.placedTrainId);
  }

  isOccupiedTrack(placedTrain: PlacedTrain, toOccupyTracks: Track[]): boolean {
    const override = [];
    for (const [trainId, tracks] of this.occupyingTracks) {
      if (trainId !== placedTrain.placedTrainId) {
        override.push(...tracks.filter((t) => toOccupyTracks.filter((t2) => t2.trackId === t.trackId).length > 0));
      }
    }

    if (override.length > 0) {
      console.warn({ train: placedTrain, override });
    }

    return override.length > 0;
  }

  updateOccupyingTrack(placedTrain: PlacedTrain, toOccupyTracks: Track[]) {
    this.occupyingTracks.delete(placedTrain.placedTrainId);

    this.occupyingTracks.set(placedTrain.placedTrainId, toOccupyTracks);
  }
}

function getNextTrackOfSwitchPattern(
  Switch: Switch,
  currentTrack: Track,
  switchPatternIndex: [number, number]
): Track | null {
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
export function getNextTrackOfStraightPattern(currentSwitch: Switch, track: Track): Track | null {
  assert(currentSwitch.straightPatternIndex !== null);
  return getNextTrackOfSwitchPattern(currentSwitch, track, currentSwitch.straightPatternIndex);
}

// 反位のtrackを返す
export function getNextTrackOfBranchPattern(Switch: Switch, currentTrack: Track): Track | null {
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

export interface PlacedTrain {
  placedTrainId: string; // 車両ID（物理的な車両）
  train: Train; // train.trainIdは列車ID（物理的な車両ではなく、スジのID）
  operation: Operation;
  speed: number;
  track: Track;
  position: Point;
  stationWaitTime: number;
  stationStatus: ArrivalAndDepartureStatus;
}

const TimeActionMode: 'Just' | 'After' = 'After';

export const defaultGlobalTimeSpeed = 5; // 1サイクルで進む秒数

export class TrainMove2 {
  placedTrains: PlacedTrain[] = [];
  timetable: DetailedTimetable;
  readonly trainOccupy = new TrainOccupy();
  readonly globalTimeSpeed = defaultGlobalTimeSpeed;
  readonly maxStationWaitTime = Number.MAX_VALUE;

  globalTime = 0;

  constructor(timetable: DetailedTimetable) {
    this.timetable = timetable;
    this.resetGlobalTime();
  }

  resetGlobalTime() {
    const minTimetableTime = Math.min(
      ...this.timetable.platformTTItems.filter((t) => t.departureTime !== null).map((t) => t.departureTime! - 60)
    );
    this.globalTime = minTimetableTime === Infinity ? 0 : minTimetableTime;
  }

  private getNextTrack(track: Track, placedTrain: PlacedTrain): Track {
    const currentSwitch = track.nextSwitch;
    const nextTracks = currentSwitch.switchPatterns.filter(([t, _]) => t.trackId === track.trackId).map(([_, t]) => t);
    if (nextTracks.length === 0) {
      // 進行方向に進めるトラックがない場合、逆方向に進む
      return track.reverseTrack;
    }
    if (nextTracks.length === 1) {
      // 進行方向に進めるトラックが1つの場合、それを返す
      return nextTracks[0];
    }

    const ttItems = this.timetable.switchTTItems.filter(
      (t) => t.Switch.switchId === currentSwitch.switchId && t.train.trainId === placedTrain.train.trainId
    );
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

  private moveTrain(placedTrain: PlacedTrain): void {
    // 現在stationだったら出発条件を満たすまで停止する
    if (
      placedTrain.track.track.platform !== null &&
      placedTrain.stationStatus === 'Arrived' /* &&
      train.stationWaitTime < this.maxStationWaitTime */
    ) {
      const timetableItems = this.timetable.platformTTItems.filter(
        (t) =>
          t.platform.platformId === placedTrain.track.track.platform!.platformId &&
          t.train.trainId === placedTrain.train.trainId
      );
      if (timetableItems.length === 0) {
        // 時刻が設定されていないときは発車しない
        console.warn('timetableItems.length === 0');
        placedTrain.stationWaitTime++;
        return;
      } else {
        if (TimeActionMode === 'Just') {
          const possibleTTItems = timetableItems.filter(
            (tt) => tt.departureTime !== null && tt.departureTime > this.globalTime - this.globalTimeSpeed
          );
          // if (possibleTTItems.length === 0) {
          //   // 可能な時刻が無いときは、列車を削除する
          //   this.placedTrains = this.placedTrains.filter((t) => t.trainId !== train.trainId);
          //   return;
          // }

          // ちょうど発車時間になったら出発する
          const departureItems = possibleTTItems.filter(
            (tt) => tt.departureTime !== null && tt.departureTime <= this.globalTime
          );
          if (departureItems.length === 0) {
            // 発車時間ではない
            placedTrain.stationWaitTime++;
            return;
          }

          console.log('departureItems.length >= 1', departureItems);
        } else if (TimeActionMode === 'After') {
          // TODO: 別のモードを実装
          // 「過ぎていたら」を実装する、。「通ったフラグ」が欲しいが、同じ駅を通る前に列車番号を変えるようにするとかで無くてもなんとかなるのかな。

          if (timetableItems.some((tt) => tt.departureTime !== null && tt.departureTime <= this.globalTime)) {
            console.log('after departure time');
            if (placedTrain.stationWaitTime === 0) {
              // 1回以上は待つ
              placedTrain.stationWaitTime++;
              return;
            }
          } else {
            // 列車の時刻がそこで最後であるときの処理
            const timeIndex = timetableItems[0].train.diaTimes.findIndex(
              (diaTime) =>
                diaTime.platform?.platformId === placedTrain.track.track.platform!.platformId ||
                (diaTime.platform?.station.stationName === placedTrain.track.track.platform!.station.stationName &&
                  diaTime.platform?.platformName === placedTrain.track.track.platform!.platformName)
            );
            if (timeIndex === timetableItems[0].train.diaTimes.length - 1) {
              // そもそも候補の時間がない => 別の運用に付け替える。列車を削除は物理的に無いので、できればやめたい。。
              // TODO: 環状線がうまくいかないと思う。
              // TODO: 一定時間後に運用を付け替えるほうが自然

              let nextTrain: Train | null = null;
              for (const operation of this.timetable.operations) {
                const index = operation.trains.findIndex((train) => train.trainId === placedTrain.train.trainId);
                if (index !== -1 && index !== operation.trains.length - 1) {
                  nextTrain = operation.trains[index + 1];
                  break;
                }
              }

              if (nextTrain === null) {
                // 次列車がない => とりあえず何もしないで放置
                console.warn('nextTrain === null');
                return;
              }

              const nextTrack = this.timetable.platformTTItems.find(
                (ttItem) => ttItem.train.trainId === nextTrain!.trainId
              )?.track;
              if (nextTrack == null) {
                throw new Error('ttItem.track == null');
              }

              placedTrain.train = nextTrain;
              placedTrain.speed = 10;
              placedTrain.stationWaitTime = 0;
              placedTrain.stationStatus = 'NotArrived';
              placedTrain.track = nextTrack;

              return;
            } else {
              // 発車時間ではない
              placedTrain.stationWaitTime++;
              return;
            }
          }
        }
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

        const nextTrack = this.getNextTrack(placedTrain.track, placedTrain);

        // trackの終点から行き過ぎた距離を求める
        const distance = getDistance(placedTrain.track.end, placedTrain.position);

        placedTrain.position.x = nextTrack.begin.x + distance * getTrackDirection(nextTrack).x;
        placedTrain.position.y = nextTrack.begin.y + distance * getTrackDirection(nextTrack).y;

        this.trainOccupy.updateOccupyingTrack(placedTrain, getOccupyingTracks(placedTrain.track));
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

  // 衝突判定
  // 専有しているtrackをベースにしても良い気がする。（ただし、クロスの場合だけは交差している判定にすべきだが、交差していないので特別対応が必要）
  // とはいっても、当たり判定ベースのほうが、融通が聞く？ちゃんとサイズを決めて、交差の判定をしないと
  // セルの対角線の長さの4分の1未満ならたぶんOK
  // 座標ベースのほうが実装簡単そうなのでいったん
  // TODO: 複数が同時に衝突した場合は対応していない。
  getCollidedTrains(): [PlacedTrain, PlacedTrain] | null {
    const collisionDistance = (CellWidth * Math.SQRT2) / 4;
    function isCollided(train1: PlacedTrain, train2: PlacedTrain): boolean {
      if (getDistance(train1.position, train2.position) < collisionDistance) {
        return true;
      }
      return false;
    }

    for (let i = 0; i < this.placedTrains.length; i++) {
      for (let j = i + 1; j < this.placedTrains.length; j++) {
        if (isCollided(this.placedTrains[i], this.placedTrains[j])) {
          return [this.placedTrains[i], this.placedTrains[j]];
        }
      }
    }

    return null;
  }

  toStringGlobalTime(): string {
    const m = Math.floor((this.globalTime / 60) % 60);
    return Math.floor(this.globalTime / 60 / 60).toString() + ':' + (m < 10 ? '0' + m.toString() : '' + m.toString());
  }

  // 必要な列車を配置する
  private placeTrainFromPlatformTimetable(): void {
    // まだ設置していない列車で、かつ、設置が必要な列車
    const operations = this.timetable.operations.filter((operation) => {
      if (operation.trains.length === 0 || operation.trains[0].diaTimes.length === 0) return;
      // 設置済みなら除外
      if (this.placedTrains.some((placeTrain) => placeTrain.operation.operationId === operation.operationId)) return;

      // 時間の条件
      const ttItem = operation.trains[0].diaTimes[0];
      return (
        (ttItem.arrivalTime !== null &&
          ttItem.departureTime !== null &&
          ttItem.arrivalTime <= this.globalTime &&
          ttItem.departureTime >
            this.globalTime - this.globalTimeSpeed - 15 - 20) /* 始発駅で到着時間が設定されていた場合*/ ||
        (ttItem.departureTime !== null &&
          ttItem.departureTime - 15 /* 到着時間が設定されていない場合は、15秒前には到着しているようにする */ <=
            this.globalTime &&
          ttItem.departureTime > this.globalTime - this.globalTimeSpeed - 15 - 20)
      ); /* 既に到着時間を20sec以上過ぎた場合はスキップ */
    });

    for (const operation of operations) {
      const ttItem = this.timetable.platformTTItems.find(
        (ttItem) => ttItem.train.trainId === operation.trains[0].trainId
      );
      assert(ttItem !== undefined, 'ttItem !== undefined');
      // trackがnullのときは、ダイヤ上、終着であることを意味するべきであるので、nullになることはありえないはず
      assert(ttItem.track !== null, 'ttItem.track !== null');

      this.placedTrains.push({
        placedTrainId: generateId(),
        train: operation.trains[0],
        speed: 10,
        stationWaitTime: 0,
        stationStatus: 'NotArrived',
        track: ttItem.track,
        position: getMidPoint(ttItem.track.begin, ttItem.track.end),
        operation: operation,
      });
    }
  }

  // 1フレームごとに呼び出す関数
  tick(): void {
    this.placeTrainFromPlatformTimetable();

    const placedTrains = [...this.placedTrains]; // 一応中で破壊的にremoveするので、コピーを作る
    for (const train of placedTrains) {
      this.moveTrain(train);
    }

    const collided = this.getCollidedTrains();
    if (collided !== null) {
      const [train1, train2] = collided;
      console.log(`collide`);
      console.log(train1);
      console.log(train2);
    }

    this.globalTime += this.globalTimeSpeed;
    if (this.globalTime >= 24 * 60 * 60) {
      this.globalTime = 24 * 60 * 60 - 1;
    }
  }
}
