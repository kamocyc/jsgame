import { assert } from './common';
import { createOperations } from './components/track-editor/timetableConverter';
import { Operation, StationLike, Train, TrainType, generateId } from './model';

export interface OutlinedTimetable {
  railwayLineId: string;
  timetableId: string;
  inboundTrainIds: string[];
  outboundTrainIds: string[];
  stations: StationLike[];
  trainTypes: TrainType[];
  operations: Operation[];
}

// Timetableを含む全てのデータ
export class OutlinedTimetableData {
  constructor(private trains: Train[] = [], private timetables: OutlinedTimetable[] = []) {}

  public getTrains(): Train[] {
    return this.trains;
  }
  public getTimetables(): OutlinedTimetable[] {
    return this.timetables;
  }
  public toDataToSave() {
    return {
      trains: this.trains,
      timetables: this.timetables,
    };
  }

  public addTimetable(timetable: OutlinedTimetable, trains: Train[]) {
    this.timetables.push(timetable);
    for (const train of trains) {
      if (!this.trains.find((t) => t.trainId === train.trainId)) {
        this.trains.push(train);
      }
    }
  }

  deleteTrains(trainIds: string[]) {
    const notUedTrainIds: string[] = [];
    for (const trainId of trainIds) {
      // 他で使われていなければ、trainIdを削除
      let used = false;
      for (const tt of this.timetables) {
        if (tt.inboundTrainIds.concat(tt.outboundTrainIds).some((id) => id === trainId)) {
          used = true;
          break;
        }
      }

      if (!used) {
        notUedTrainIds.push(trainId);
      }
    }

    this.trains = this.trains.filter((train) => !notUedTrainIds.some((id) => id === train.trainId));
  }

  clearTimetable(timetableId: string) {
    const timetable = this.timetables.find((t) => t.timetableId === timetableId);
    assert(timetable !== undefined);

    timetable.inboundTrainIds = [];
    timetable.outboundTrainIds = [];
    timetable.operations = [];
    timetable.trainTypes = [];

    this.deleteNotUsedTrains();
  }

  setTrains(timetableId: string, trains: Train[], direction: 'Inbound' | 'Outbound') {
    const timetable = this.timetables.find((t) => t.timetableId === timetableId);
    assert(timetable !== undefined);

    if (direction === 'Inbound') {
      timetable.inboundTrainIds = trains.map((train) => train.trainId);
    } else {
      timetable.outboundTrainIds = trains.map((train) => train.trainId);
    }

    this.trains.push(...trains);

    this.deleteNotUsedTrains();
  }

  getTrain(trainId: string): Train {
    const train = this.getTrains().find((train) => train.trainId === trainId);
    assert(train !== undefined);
    return train;
  }

  reverseTimetableDirection(timetableId: string): void {
    const timetable = this.timetables.find((t) => t.timetableId === timetableId);
    assert(timetable !== undefined);

    const oldInboundTrains = timetable.inboundTrainIds.map((trainId) => this.getTrain(trainId));
    const oldOutboundTrains = timetable.outboundTrainIds.map((trainId) => this.getTrain(trainId));

    const inboundTrains: Train[] = [];
    const outboundTrains: Train[] = [];
    for (const train of oldInboundTrains) {
      outboundTrains.push({
        ...train,
        trainId: generateId(),
        direction: 'Outbound',
      });
    }
    for (const train of oldOutboundTrains) {
      inboundTrains.push({
        ...train,
        trainId: generateId(),
        direction: 'Inbound',
      });
    }

    const trains = outboundTrains.concat(inboundTrains);

    timetable.inboundTrainIds = inboundTrains.map((train) => train.trainId);
    timetable.outboundTrainIds = outboundTrains.map((train) => train.trainId);
    timetable.stations = timetable.stations.slice().reverse();
    timetable.operations = createOperations(trains);

    this.trains.push(...trains);
    this.deleteNotUsedTrains();
  }

  // 重複を削除し、使用されていないtrainを削除する
  private deleteNotUsedTrains() {
    const trainMap = new Map<string, Train>();
    for (const train of this.trains) {
      trainMap.set(train.trainId, train);
    }

    this.trains.splice(0, this.trains.length);
    const usedTrainIds = this.timetables.flatMap((t) => [...t.inboundTrainIds, ...t.outboundTrainIds]);
    for (const usedTrainId of usedTrainIds) {
      const train = trainMap.get(usedTrainId);
      assert(train !== undefined);
      this.trains.push(train);
    }
  }

  public deleteTimetable(timetableId: string) {
    const index = this.timetables.findIndex((t) => t.timetableId === timetableId);
    if (index !== -1) {
      this.timetables.splice(index, 1);

      this.deleteNotUsedTrains();
    }
  }
}
