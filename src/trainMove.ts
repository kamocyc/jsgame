import { assert, min } from "./common.js";
import { DiaTrain, Diagram, HalfTrack, OperationTrain, Point, SerializedTrain, Station, Switch, TimedPositionData, Train, generateId } from "./model.js";
import { getDistance, getMidPoint, getOccupyingTracks, getRadian, getTrackDirection, isTrainOutTrack, searchTrack } from "./trackUtil.js";

interface DiaOperatingTrain extends DiaTrain {
  operatingTrain: Train
}

function getStopPosition(_train: Train, stationTrack: HalfTrack): Point | undefined {
  if (!stationTrack.track.station) return undefined;

  const midPoint = getMidPoint(stationTrack._begin, stationTrack._end);
  return midPoint;
}

function shouldStopTrain(train: Train): false | Point {
  if (!train.track.track.station || train.stationStatus !== 'NotArrived' /*|| train.stationWaitTime >= this.maxStationWaitTime*/) return false;
  
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

// 今のtrackへのendの距離 + pathの距離（ただし最後は、stationStopPointを利用）
function getPathDistance(train: Train, path: HalfTrack[]): number {
  let distance = getDistance(train.position, train.track._end);

  const lastTrack = path[path.length - 1];
  const stopPosition = getStopPosition(train, lastTrack);
  if (!stopPosition) throw new Error('stopPostition');
  distance += getDistance(lastTrack._begin, stopPosition);

  distance += path.slice(0, -1).map(track => getDistance(track._begin, track._end)).reduce((acc, v) => acc + v, 0);

  return distance;
}

class TrainOccupy {
  /* trackId => train */
  // readonly occupyingTrain: Map<number, Train> = new Map<number, Train>();
  readonly occupyingTracks: Map<number, HalfTrack[]> = new Map<number, HalfTrack[]>();

  addTrain(train: Train) {
    this.occupyingTracks.set(train.trainId, [train.track])
  }

  deleteTrain(train: Train) {
    this.occupyingTracks.delete(train.trainId);
  }

  isOccupiedTrack(train: Train, toOccupyTracks: HalfTrack[]): boolean {
    const override = [];
    for (const [trainId, tracks] of this.occupyingTracks) {
      if (trainId !== train.trainId) {
        override.push(...tracks.filter(t => toOccupyTracks.filter(t2 => t2.trackId === t.trackId).length > 0));
      }
    }

    if (override.length > 0) {
      console.warn({train, override});
    }

    return override.length > 0;
  }

  updateOccupyingTrack(train: Train, toOccupyTracks: HalfTrack[]) {
    this.occupyingTracks.delete(train.trainId);

    this.occupyingTracks.set(train.trainId, toOccupyTracks);
  }
  
  // updateOccupyingTrack(train: Train, nextTrack: HalfTrack) {
  //   if (this.occupyingTrain.has(nextTrack.trackId) && this.occupyingTrain.get(nextTrack.trackId)?.trainId !== train.trainId) {
  //     console.warn({
  //       trackId: nextTrack.trackId,
  //       occTrainId: this.occupyingTrain.get(nextTrack.trackId),
  //       train: train
  //     })
  //   }

  //   assert(this.occupyingTrain.has(train.track.trackId));
  //   this.occupyingTrain.delete(train.track.trackId);

  //   this.occupyingTrain.set(nextTrack.trackId, train);
  // }
}

export class TrainMove {
  readonly switches: Switch[] = [];
  readonly stations: Station[] = [];
  readonly tracks: HalfTrack[] = [];
  readonly trains: Train[] = [];
  readonly operatingTrains: OperationTrain[] = [];
  readonly timetable: DiaOperatingTrain[] = [];
  readonly trainOccupy = new TrainOccupy();
  
  globalTime = 0;
  mode: 'SwitchMode' | 'TimetableMode' = 'SwitchMode';
  
  readonly globalTimeSpeed = 10;  // 1サイクルで進む秒数
  readonly maxStationWaitTime = Number.MAX_VALUE;

  getNextTrack(track: HalfTrack, train: Train, bannedTrack: HalfTrack | undefined): [HalfTrack, number] {
    if (this.mode === 'SwitchMode') {
      // if (track._nextSwitch._branchedTrackTo === track.reverseTrack) {
      //   if (track._nextSwitch.toTracks.length === 1) {
      //     return track._nextSwitch._branchedTrackTo;
      //   }
    
      //   return track._nextSwitch._branchedTrackFrom.reverseTrack;
      // }
  
      // return track._nextSwitch._branchedTrackTo;
      // TODO
      return [track, getDistance(track._begin, track._end)];
    } else {
      const nextTracks = track._nextSwitch.switchPatterns.filter(([t, _]) => t === track).map(([_, t]) => t);
      if (nextTracks.length === 0) {
        return [track.reverseTrack, getDistance(track.reverseTrack._begin, track.reverseTrack._end)];
      }
      if (nextTracks.length === 1) {
        return [nextTracks[0], getDistance(nextTracks[0]._begin, nextTracks[0]._end)];
      }
  
      const timetableItems = this.timetable.filter(t => t.operatingTrain === train);
      if (timetableItems.length !== 1) throw new Error('timetableItems.length');
      const timetableItem = timetableItems[0];
      
      // 次の駅に向かう方向に進む（つまり現在よりも「先の」方向で、一番近い位置の駅）
      // まずはtoのtoのみ見る
      let nextTrackPath = searchTrack(train.track, timetableItem.trainTimetable[train.currentTimetableIndex].stationId, bannedTrack);
      // console.log({nextTrack});
      if (!nextTrackPath) {
        throw new Error('not reachable station ' + JSON.stringify({
          stationId: timetableItem.trainTimetable[train.currentTimetableIndex].stationId,
          stationName: this.tracks.filter(t => t.track.station?.stationId === timetableItem.trainTimetable[train.currentTimetableIndex].stationId)[0]?.track.station?.stationName,
          train: train.diaTrain?.name,
        }, null, '  '));
      }

      const nextTrack = nextTrackPath[0];
      return [nextTrack, getPathDistance(train, nextTrackPath)];
    }
  }

  moveTrain(train: Train): void {
    // 現在stationだったら出発条件を満たすまで停止する
    if (train.track.track.station !== null && train.stationStatus === 'Arrived' && train.stationWaitTime < this.maxStationWaitTime) {
      const timetableItems = this.timetable.filter(t => t.operatingTrain === train);
      if (timetableItems.length !== 1) throw new Error('timetableItems.length');
      const timetableItem = timetableItems[0];
  
      if (timetableItem.trainTimetable[train.currentTimetableIndex].stationId === train.track.track.station.stationId) {
        // 時刻表の駅に到着した
        const currentTimetable = timetableItem.trainTimetable[train.currentTimetableIndex];
        if (this.globalTime < currentTimetable.departureTime) {
          // console.log('WAIT');
          return;
        } else if (this.globalTime >= currentTimetable.departureTime) {
          if (this.globalTime > currentTimetable.departureTime) {
            // なんで遅れるのだろう？？誤差？遅れ幅を表示してみたり、ログで見たりしたい。まあ、細かいことかも
            console.log('PASSED');
            console.log({
              train,
              currentTimetable,
              globalTime: this.globalTime,
              departureTime: currentTimetable.departureTime,
              delay: this.globalTime - currentTimetable.departureTime
            })
          }
        }
  
        // 出発する => 次のindexに進める
        if (timetableItem.trainTimetable.length - 1 === train.currentTimetableIndex) {
          // TODO: 運用が終わったとき: 時刻表の運用データを元になんとかする
          // とりあえず、運用が終わったら削除する
          this.trainOccupy.deleteTrain(train);
          this.trains.splice(this.trains.map((a, i) => [a, i] as const).filter(([t, i]) => t === train)[0][1], 1);
          return;
        }
        train.currentTimetableIndex ++;
  
        const nextStationTimetable = timetableItem.trainTimetable[train.currentTimetableIndex];
        // console.log('train:' + train.diaTrain?.name + ', stationId:' + nextStationTimetable.stationId);
        let result = searchTrack(train.track, nextStationTimetable.stationId);
        if (!result) {
          const reverseResult = searchTrack(train.track.reverseTrack, nextStationTimetable.stationId);
          if (!reverseResult) {
            throw new Error('not reachable station ' + JSON.stringify({
              stationId: nextStationTimetable.stationId,
              stationName: this.tracks.filter(t => t.track.station?.stationId === nextStationTimetable.stationId)[0]?.track.station?.stationName,
              train: train.diaTrain?.name,
            }, null, '  '));
          }
          console.warn('reverse');
          train.track = train.track.reverseTrack;
          result = reverseResult;
        }
        
        // timeは秒単位

        const distance = getPathDistance(train, result);
        train.speed = distance / (nextStationTimetable.arrivalTime - this.globalTime - this.globalTimeSpeed) * this.globalTimeSpeed;
        if (train.speed < 0.01) train.speed = 0.01;
      }
      
      // const stationCenter = getMidPoint(train.track._begin, train.track._end);
      if (!train.track.track.station!.shouldDepart(train, this.globalTime)) {
        train.stationWaitTime ++;
        return;
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
    
        let [nextTrack, nextPathDistance] = this.getNextTrack(train.track, train, undefined);

        if (this.trainOccupy.isOccupiedTrack(train, getOccupyingTracks(nextTrack))) {
          try {
            const [altNextTrack, altNextPathDistance] = this.getNextTrack(train.track, train, nextTrack);
            if (altNextPathDistance > nextPathDistance + 5) {
              console.warn('alt path too long');
            } else {
              if (nextTrack.trackId !== altNextTrack.trackId) {
                console.log('use alt track');
                nextTrack = altNextTrack;
              }
            }
          }catch(e) {
            console.warn('no alt path')
          }
        }
        if (nextTrack) {
          // trackの終点から行き過ぎた距離を求める
          const distance = getDistance(train.track._end, train.position);
    
          train.position.x = nextTrack._begin.x + distance * getTrackDirection(nextTrack).x;
          train.position.y = nextTrack._begin.y + distance * getTrackDirection(nextTrack).y;
          
          this.trainOccupy.updateOccupyingTrack(train, getOccupyingTracks(train.track));
          train.track = nextTrack;

          // 線路内に入るまでループ
          continue;
        } else {
          console.warn('reverse (2)');
          // 次の線路が無い場合は、逆転する
          train.track = train.track.reverseTrack;
          train.position.x = train.track._begin.x;
          train.position.y = train.track._begin.y;
          break;
        }
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

  showGlobalTime(): string {
    const m = Math.floor(this.globalTime / 60 % 60);
    return Math.floor(this.globalTime / 60 / 60) + ':' + (m < 10 ? '0' + m : '' + m)
  }

  getRecords(diagram: Diagram, minGlobalTime: number, maxGlobalTime: number): TimedPositionData {
    const records: SerializedTrain[][] = [];
    for (this.globalTime = minGlobalTime; this.globalTime <= maxGlobalTime;) {
      this.addTrainFromDiagramAndTime(diagram);
      this.main();
      records.push(
        this.trains.map(train => toSerializable(train))
      );
    }
  
    const tracks_ = this.tracks.map(track => ({
      _begin: track._begin,
      _end: track._end,
      track: { station: track.track.station != null ? {stationName: track.track.station.stationName} : null}
    } as HalfTrack))
  
    return {
      minGlobalTime,
      maxGlobalTime,
      globalTimeSpeed: this.globalTimeSpeed,
      records,
      tracks: tracks_
    };
  }
  
  addTrain(train: DiaTrain) {  
    const trainToAdd: Train = {
      trainId: generateId(),
      speed: 15,
      currentTimetableIndex: 0,
      track: this.tracks[0], // dummy
      position: {...this.tracks[0]._end},  // dummy
      stationWaitTime: 0,
      stationStatus: 'NotArrived',
    };
  
    {
      // 初期位置は駅に置く
      // 最初の駅の到着時間までは表示しない
      let track = this.tracks.filter(track => track.track.station?.stationId === train.trainTimetable[0].stationId)[0];
      if (!searchTrack(track, train.trainTimetable[1].stationId)) {
        // 逆方向
        track = track.reverseTrack;
      }
      trainToAdd.track = track;
      trainToAdd.position = {...getMidPoint(trainToAdd.track._begin, trainToAdd.track._end)};
    }
  
    const train_ = {
      ...train,
      operatingTrain: trainToAdd,
      trainTimetable: train.trainTimetable.map(t => t)
    };
    this.timetable.push(...[train_]);
    train_.operatingTrain.diaTrain = train_;
  
    this.trains.push(trainToAdd);

    this.trainOccupy.addTrain(trainToAdd);
  }

  addTrainFromDiagramAndTime(diagram: Diagram) {
    for (const train of diagram.trains) {
      if (min(train.trainTimetable.map(t => t.arrivalTime)) === this.globalTime) {
        this.addTrain(train);
      }
    }
  }

  main() {
    for (const train of this.trains) {
      this.moveTrain(train);
    }

    this.globalTime += this.globalTimeSpeed; // TODO
  }
}

function roundPoint(point: Point): Point {
  const roundFactor = 10;
  return {
    x: Math.round(point.x * roundFactor) / roundFactor,
    y: Math.round(point.y * roundFactor) / roundFactor
  }
}

function toSerializable(train: Train): SerializedTrain {
  return {
    trainId: train.trainId,
    name: train.diaTrain?.name,
    color: train.diaTrain?.color,
    position: roundPoint(train.position),
  };
}
