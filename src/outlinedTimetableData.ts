import { assert } from './common';
import { createOperations } from './components/track-editor/timetableConverter';
import { Operation, StationLike, StationOperation, Train, TrainType, generateId } from './model';

export interface OutlinedTimetable {
  railwayLineId: string;
  inboundIsFirstHalf: boolean;
  timetableId: string;
  inboundTrainIds: string[];
  outboundTrainIds: string[];
  stations: StationLike[];
  trainTypes: TrainType[];
  operations: Operation[];
}

export function getDirection(timetable: OutlinedTimetable, trainId: string): 'Inbound' | 'Outbound' {
  if (timetable.inboundTrainIds.some((id) => id === trainId)) {
    return 'Inbound';
  } else if (timetable.outboundTrainIds.some((id) => id === trainId)) {
    return 'Outbound';
  } else {
    assert(false);
  }
}

export interface HistoryItem {
  this: unknown;
  undo: () => void;
  redo: () => void;
}

export class HistoryManager {
  private histories: HistoryItem[] = [];
  private currentIndex: number = 0;
  private maxHistoryNumber: number = 100;

  push(item: HistoryItem) {
    this.histories.splice(this.currentIndex);
    this.histories.push(item);
    this.currentIndex = this.histories.length;

    if (this.histories.length > this.maxHistoryNumber) {
      this.histories.shift();
      this.currentIndex--;
    }
  }

  undo() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.histories[this.currentIndex].undo.bind(this.histories[this.currentIndex].this)();
    }
  }

  clearHistory() {
    this.histories = [];
    this.currentIndex = 0;
  }

  canUndo() {
    return this.currentIndex > 0;
  }

  canRedo() {
    return this.currentIndex < this.histories.length;
  }

  redo() {
    if (this.currentIndex < this.histories.length) {
      this.histories[this.currentIndex].redo.bind(this.histories[this.currentIndex].this)();
      this.currentIndex++;
    }
  }
}

export interface AddingNewTrain {
  train: Train;
  beforeTrainId: string | null;
  direction: 'Inbound' | 'Outbound';
}

export interface UpdatingTrain {
  trainId: string;
  updater: (train: Train) => void;
}

function updateOperationTime(operation: StationOperation, newTime: number | null) {
  assert(newTime != null);
  if (operation.stationOperationType === 'InOut') {
    return {
      ...operation,
      operationTime: newTime,
    };
  } else {
    return {
      ...operation,
    };
  }
}

function repeatTrains(trains: Train[]): Train[] {
  const minTime = trains.map((train) => train.diaTimes[0].departureTime ?? 0).reduce((a, b) => Math.min(a, b));
  const maxTime = trains
    .map((train) => train.diaTimes[train.diaTimes.length - 1].arrivalTime ?? 0)
    .reduce((a, b) => Math.max(a, b));
  const timeDiff = maxTime - minTime;
  if (timeDiff <= 0) {
    return [];
  }

  const newTrains: Train[] = [];
  for (const train of trains) {
    const newTrain: Train = {
      ...train,
      trainId: generateId(),
      firstStationOperation: updateOperationTime(train.firstStationOperation, train.diaTimes[0].arrivalTime),
      lastStationOperation: updateOperationTime(
        train.lastStationOperation,
        train.diaTimes[train.diaTimes.length - 1].departureTime
      ),
      diaTimes: train.diaTimes.map((diaTime) => {
        return {
          ...diaTime,
          arrivalTime: diaTime.arrivalTime !== null ? diaTime.arrivalTime + timeDiff + 3 * 60 : null,
          departureTime: diaTime.departureTime !== null ? diaTime.departureTime + timeDiff + 3 * 60 : null,
        };
      }),
    };
    newTrains.push(newTrain);
  }

  return newTrains;
}

// Timetableを含む全てのデータ
export class OutlinedTimetableData {
  constructor(
    private historyManager: HistoryManager,
    private trains: Train[] = [],
    private timetables: OutlinedTimetable[] = []
  ) {}

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

  repeatTimetable(timetableId: string) {
    const timetable = this.timetables.find((t) => t.timetableId === timetableId);
    assert(timetable !== undefined);

    {
      const newTrains = repeatTrains(timetable.inboundTrainIds.map((trainId) => this.getTrain(trainId)));
      this.trains.push(...newTrains);
      timetable.inboundTrainIds.push(...newTrains.map((t) => t.trainId));
    }

    {
      const newTrains = repeatTrains(timetable.outboundTrainIds.map((trainId) => this.getTrain(trainId)));
      this.trains.push(...newTrains);
      timetable.outboundTrainIds.push(...newTrains.map((t) => t.trainId));
    }
  }

  public addTimetable(timetable: OutlinedTimetable, trains: Train[]) {
    this.timetables.push(timetable);
    for (const train of trains) {
      if (!this.trains.find((t) => t.trainId === train.trainId)) {
        this.trains.push(train);
      }
    }
  }

  undo() {
    this.historyManager.undo();
  }
  redo() {
    this.historyManager.redo();
  }
  canUndo() {
    return this.historyManager.canUndo();
  }
  canRedo() {
    return this.historyManager.canRedo();
  }
  clearHistory() {
    this.historyManager.clearHistory();
  }

  deleteTrains(timetableId: string, trainIds: string[]) {
    const timetable = this.timetables.find((t) => t.timetableId === timetableId);
    assert(timetable !== undefined);

    // undo用に、削除される前の状態を保存
    const allTrains = this.trains;

    const historyItem: HistoryItem = {
      this: this,
      redo: () => {
        timetable.inboundTrainIds = timetable.inboundTrainIds.filter((id) => !trainIds.some((tid) => tid === id));
        timetable.outboundTrainIds = timetable.outboundTrainIds.filter((id) => !trainIds.some((tid) => tid === id));

        this.deleteNotUsedTrains();
      },
      undo: () => {
        timetable.inboundTrainIds.push(...trainIds);
        timetable.outboundTrainIds.push(...trainIds);

        this.trains.push(
          ...trainIds.map((id) => {
            const train = allTrains.find((train) => train.trainId === id);
            assert(train !== undefined);
            return train;
          })
        );
      },
    };

    historyItem.redo.bind(historyItem.this)();

    this.historyManager.push(historyItem);
  }

  clearTimetable(timetableId: string) {
    const timetable = this.timetables.find((t) => t.timetableId === timetableId);
    assert(timetable !== undefined);

    timetable.inboundTrainIds = [];
    timetable.outboundTrainIds = [];
    timetable.operations = [];
    timetable.trainTypes = [];
    timetable.inboundIsFirstHalf = true;

    this.deleteNotUsedTrains();
  }

  addTrain(timetableId: string, train: Train, direction: 'Inbound' | 'Outbound') {
    this.addTrains(timetableId, [{ train: train, beforeTrainId: null, direction: direction }]);
  }

  addTrains(timetableId: string, newTrains: AddingNewTrain[]) {
    const timetable = this.timetables.find((t) => t.timetableId === timetableId);
    assert(timetable !== undefined);

    const historyItem = {
      this: this,
      redo: () => {
        this.trains.push(...newTrains.map((train) => train.train));

        for (const { train, beforeTrainId, direction } of newTrains) {
          if (direction === 'Inbound') {
            if (beforeTrainId === null) {
              timetable.inboundTrainIds.push(train.trainId);
            } else {
              const index = timetable.inboundTrainIds.findIndex((id) => id === beforeTrainId);
              assert(index !== -1);
              timetable.inboundTrainIds.splice(index, 0, train.trainId);
            }
          } else {
            if (beforeTrainId === null) {
              timetable.outboundTrainIds.push(train.trainId);
            } else {
              const index = timetable.outboundTrainIds.findIndex((id) => id === beforeTrainId);
              assert(index !== -1);
              timetable.outboundTrainIds.splice(index, 0, train.trainId);
            }
          }
        }
      },
      undo: () => {
        const trainsAfterDeleted = this.trains.filter(
          (train) => !newTrains.some((t) => t.train.trainId === train.trainId)
        );
        this.trains.splice(0, this.trains.length);
        this.trains.push(...trainsAfterDeleted);
      },
    };

    historyItem.redo.bind(historyItem.this)();

    this.historyManager.push(historyItem);
  }

  commitTrain(historyItem: HistoryItem) {
    historyItem.redo.bind(historyItem.this)();

    this.historyManager.push(historyItem);
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
      });
    }
    for (const train of oldOutboundTrains) {
      inboundTrains.push({
        ...train,
        trainId: generateId(),
      });
    }

    const trains = outboundTrains.concat(inboundTrains);

    timetable.inboundTrainIds = inboundTrains.map((train) => train.trainId);
    timetable.outboundTrainIds = outboundTrains.map((train) => train.trainId);
    timetable.stations = timetable.stations.slice().reverse();
    timetable.inboundIsFirstHalf = !timetable.inboundIsFirstHalf;
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

  updateOperations() {
    for (const timetable of this.timetables) {
      timetable.operations = createOperations(
        timetable.inboundTrainIds.concat(timetable.outboundTrainIds).map((id) => this.getTrain(id))
      );
    }
  }
}
