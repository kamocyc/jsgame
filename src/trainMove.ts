import { min } from "./common.js";
import { DiaTrain, Diagram, HalfTrack, OperationTrain, Point, SerializedTrain, Station, StationTrain, Switch, TimedPositionData, Train, generateId } from "./model.js";
import { Queue } from "./queue.js";
import { getDistance, getTrackDirection, isTrainOutTrack } from "./trackUtil.js";

interface DiaOperatingTrain extends DiaTrain {
  operatingTrain: Train
}

// 辺の数の最短を返すので、ダイクストラ法で求めたい。そんなに難しくない
function bfsTrack(startTrack: HalfTrack, stationId: number): [HalfTrack, number] | undefined {
  const queue = new Queue<HalfTrack>();
  const found = new Map<number, HalfTrack | undefined>();

  queue.enqueue(startTrack);
  found.set(startTrack.trackId, undefined);

  let i = 0;
  while (!queue.isEmpty()) {
    const track = queue.front();
    queue.dequeue();
    i ++;

    for (const toTrack of track._nextSwitch.switchPatterns.filter(([t, _]) => t === track).map(([_, toTrack]) => toTrack)) {
      if (!found.has(toTrack.trackId)) {
        found.set(toTrack.trackId, track);

        if (toTrack.track.station?.stationId === stationId) {
          // 最初のパスを返す
          let prevTrack: HalfTrack = toTrack;
          let distance = 0;
          while (true) {
            i ++;
            const track = found.get(prevTrack.trackId)!;
            distance += getDistance(track._begin, track._end);
            if (track?.trackId === startTrack.trackId) {
              if (i > 10) console.log(i);
              return [prevTrack, distance];
            }
            prevTrack = track;
          }
        }

        queue.enqueue(toTrack);
      }
    }
  }
}

export class TrainMove {
  readonly switches: Switch[] = [];
  readonly stations: Station[] = [];
  readonly tracks: HalfTrack[] = [];
  readonly trains: Train[] = [];
  readonly operatingTrains: OperationTrain[] = [];
  readonly timetable: DiaOperatingTrain[] = []
  
  globalTime = 0;
  mode: 'SwitchMode' | 'TimetableMode' = 'SwitchMode';
  
  readonly globalTimeSpeed = 10;
  readonly maxStationWaitTime = Number.MAX_VALUE;
  
  getNextTrack(track: HalfTrack, train: Train): HalfTrack {
    if (this.mode === 'SwitchMode') {
      // if (track._nextSwitch._branchedTrackTo === track.reverseTrack) {
      //   if (track._nextSwitch.toTracks.length === 1) {
      //     return track._nextSwitch._branchedTrackTo;
      //   }
    
      //   return track._nextSwitch._branchedTrackFrom.reverseTrack;
      // }
  
      // return track._nextSwitch._branchedTrackTo;
      // TODO
      return track;
    } else {
      const nextTracks = track._nextSwitch.switchPatterns.filter(([t, _]) => t === track).map(([_, t]) => t);
      if (nextTracks.length === 0) {
        return track.reverseTrack;
      }
      if (nextTracks.length === 1) {
        return nextTracks[0];
      }
  
      const timetableItems = this.timetable.filter(t => t.operatingTrain === train);
      if (timetableItems.length !== 1) throw new Error('timetableItems.length');
      const timetableItem = timetableItems[0];
      
      // 次の駅に向かう方向に進む（つまり現在よりも「先の」方向で、一番近い位置の駅）
      // まずはtoのtoのみ見る
      let nextTrack = bfsTrack(train.track, timetableItem.trainTimetable[train.currentTimetableIndex].stationId);
      // console.log({nextTrack});
      if (nextTrack) {  
        return nextTrack[0];
      } else {
        throw new Error('end');
      }
  
    }
  }
  
  moveTrain(train: Train): void {
    // 現在stationだったら出発条件を満たすまで停止する
    if (train.track.track.station && !train.wasDeparted && train.stationWaitTime < this.maxStationWaitTime) {
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
            console.log('PASSED');
            console.log({
              train,
              currentTimetable
            })
          }
        }
  
        // 出発する => 次のindexに進める
        if (timetableItem.trainTimetable.length - 1 === train.currentTimetableIndex) {
          // TODO: 運用が終わったとき: 時刻表の運用データを元になんとかする
          // とりあえず、運用が終わったら削除する
          this.trains.splice(this.trains.map((a, i) => [a, i] as const).filter(([t, i]) => t === train)[0][1], 1);
          return;
        }
        train.currentTimetableIndex ++;
  
        const nextStationTimetable = timetableItem.trainTimetable[train.currentTimetableIndex];
        const distance = bfsTrack(train.track, nextStationTimetable.stationId)![1];
        train.speed = distance / (nextStationTimetable.arrivalTime - 30 - this.globalTime) * this.globalTimeSpeed;
        if (train.speed < 0.1) train.speed = 1;
      }
      
      // const stationCenter = getMidPoint(train.track._begin, train.track._end);
      if (!train.track.track.station.shouldDepart(train, this.globalTime)) {
        train.stationWaitTime ++;
        return;
      }
      train.wasDeparted = true;
    }
  
    const { x: directionX, y: directionY } = getTrackDirection(train.track);
    train.position.x += directionX * train.speed;
    train.position.y += directionY * train.speed;
    
    // trainがtrackの外に出たら、次の線路に移動する
    if (isTrainOutTrack(train.position, train.track)) {
      train.stationWaitTime = 0;
      train.wasDeparted = false;
  
      const nextTrack = this.getNextTrack(train.track, train);
      if (nextTrack) {
        // trackの終点から行き過ぎた距離を求める
        const distance = getDistance(train.track._end, train.position);
  
        train.position.x = nextTrack._begin.x + distance * getTrackDirection(nextTrack).x;
        train.position.y = nextTrack._begin.y + distance * getTrackDirection(nextTrack).y;
        
        train.track = nextTrack;
      } else {
        train.track = train.track.reverseTrack;
        train.position.x = train.track._begin.x;
        train.position.y = train.track._begin.y;
      }
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
      wasDeparted: false,
    };
  
    // 初期位置は駅に置く
    // 方向の情報が無いので、決める必要がある。
    // 最初の駅の到着時間までは表示しない
    trainToAdd.track = this.tracks.filter(track => track.track.station?.stationId === train.trainTimetable[0].stationId)[0];
    if (train.trainTimetable[0].stationId > train.trainTimetable[1].stationId) trainToAdd.track = trainToAdd.track.reverseTrack;
    trainToAdd.position = {...trainToAdd.track._begin};
  
    const train_ = {
      ...train,
      operatingTrain: trainToAdd,
      trainTimetable: train.trainTimetable.map(t => t)
    };
    this.timetable.push(...[train_]);
    train_.operatingTrain.diaTrain = train_;
  
    this.trains.push(trainToAdd);
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
