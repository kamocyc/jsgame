import { DeepReadonly } from 'ts-essentials';
import { assert } from './common';
import { checkStationTrackOccupation } from './components/track-editor/checkOperation';
import { OperationError } from './mapEditorModel';
import { Operation, StationLike, StationOperation, Train, TrainType, cloneTrain, generateId } from './model';

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

export function getDirection(timetable: DeepReadonly<OutlinedTimetable>, trainId: string): 'Inbound' | 'Outbound' {
  if (timetable.inboundTrainIds.some((id) => id === trainId)) {
    return 'Inbound';
  } else if (timetable.outboundTrainIds.some((id) => id === trainId)) {
    return 'Outbound';
  } else {
    assert(false);
  }
}

export interface HistoryItem {
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
      this.histories[this.currentIndex].undo();
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
      this.histories[this.currentIndex].redo();
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

function updateOperationTime(operation: StationOperation, timeDiff: number) {
  if (operation.stationOperationType === 'InOut') {
    return {
      ...operation,
      operationTime: operation.operationTime + timeDiff,
    };
  } else {
    return {
      ...operation,
    };
  }
}

function repeatTrains(trains: DeepReadonly<Train[]>): DeepReadonly<Train>[] {
  const minTime = trains.map((train) => train.diaTimes[0].departureTime ?? 0).reduce((a, b) => Math.min(a, b));
  const maxTime = trains
    .map((train) => train.diaTimes[train.diaTimes.length - 1].arrivalTime ?? 0)
    .reduce((a, b) => Math.max(a, b));
  const timeDiff = maxTime - minTime;
  if (timeDiff <= 0) {
    return [];
  }

  const newTrains = trains.map((train) => {
    const clonedTrain = cloneTrain(train);
    const newTrain = {
      ...clonedTrain,
      firstStationOperation: updateOperationTime(clonedTrain.firstStationOperation, timeDiff),
      lastStationOperation: updateOperationTime(clonedTrain.lastStationOperation, timeDiff),
      diaTimes: clonedTrain.diaTimes.map((diaTime) => {
        return {
          ...diaTime,
          arrivalTime: diaTime.arrivalTime !== null ? diaTime.arrivalTime + timeDiff + 3 * 60 : null,
          departureTime: diaTime.departureTime !== null ? diaTime.departureTime + timeDiff + 3 * 60 : null,
        };
      }),
    };
    return newTrain;
  });

  return newTrains;
}

export function repeatTrains_(trains: Train[]): Train[] {
  return repeatTrains(trains) as Train[];
}

// Timetableを含む全てのデータ
export interface OutlinedTimetableData {
  _trains: Train[];
  _timetables: OutlinedTimetable[];
  _errors: OperationError[];
}

export const OutlinedTimetableFunc = {
  getTrains(that: DeepReadonly<OutlinedTimetableData>): DeepReadonly<Train[]> {
    return (that as OutlinedTimetableData)._trains;
  },
  getTimetables(that: DeepReadonly<OutlinedTimetableData>): DeepReadonly<OutlinedTimetable[]> {
    return (that as OutlinedTimetableData)._timetables;
  },
  toDataToSave(that: DeepReadonly<OutlinedTimetableData>) {
    return {
      trains: OutlinedTimetableFunc.getTrains(that),
      timetables: OutlinedTimetableFunc.getTimetables(that),
    };
  },

  // update
  getTrain(that_: { _trains: Train[] }, trainId: string): Train {
    const that = that_ as OutlinedTimetableData;
    const train = that._trains.find((train) => train.trainId === trainId);
    assert(train !== undefined);
    return train;
  },
  repeatTrainsInTimetable(that_: OutlinedTimetableData, timetableId: string) {
    const that = that_ as OutlinedTimetableData;
    const timetable = that._timetables.find((t) => t.timetableId === timetableId);
    assert(timetable !== undefined);

    const newInboundTrains = repeatTrains_(timetable.inboundTrainIds.map((trainId) => this.getTrain(that, trainId)));
    that._trains.push(...newInboundTrains);
    timetable.inboundTrainIds.push(...newInboundTrains.map((t) => t.trainId));

    const newOutboundTrains = repeatTrains_(timetable.outboundTrainIds.map((trainId) => this.getTrain(that, trainId)));
    that._trains.push(...newOutboundTrains);
    timetable.outboundTrainIds.push(...newOutboundTrains.map((t) => t.trainId));
  },
  updateOperations(that_: OutlinedTimetableData) {
    const that = that_ as OutlinedTimetableData;
    const errors: OperationError[] = [];
    for (const timetable of that._timetables) {
      const trains = timetable.inboundTrainIds.concat(timetable.outboundTrainIds).map((id) => this.getTrain(that, id));
      const platforms = timetable.stations.map((station) => station.platforms).flat();
      const { errors: occupationErrors, operations } = checkStationTrackOccupation(trains, platforms);
      errors.push(...occupationErrors);
      timetable.operations = operations;
    }

    return errors;
  },
  deleteTrains(that_: OutlinedTimetableData, timetableId: string, trainIds: ReadonlyArray<string>) {
    const that = that_ as OutlinedTimetableData;
    const timetable = that._timetables.find((t) => t.timetableId === timetableId);
    assert(timetable !== undefined);

    // undo用に、削除される前の状態を保存
    const allTrains = that._trains;

    const historyItem: HistoryItem = {
      redo: () => {
        timetable.inboundTrainIds = timetable.inboundTrainIds.filter((id) => !trainIds.some((tid) => tid === id));
        timetable.outboundTrainIds = timetable.outboundTrainIds.filter((id) => !trainIds.some((tid) => tid === id));

        this.deleteNotUsedTrains(that);
      },
      undo: () => {
        timetable.inboundTrainIds.push(...trainIds);
        timetable.outboundTrainIds.push(...trainIds);

        that._trains.push(
          ...trainIds.map((id) => {
            const train = allTrains.find((train) => train.trainId === id);
            assert(train !== undefined);
            return train;
          })
        );
      },
    };

    historyItem.redo();

    return historyItem;
  },

  clearTimetable(that: OutlinedTimetableData, timetableId: string) {
    const timetable = that._timetables.find((t) => t.timetableId === timetableId);
    assert(timetable !== undefined);

    timetable.inboundTrainIds = [];
    timetable.outboundTrainIds = [];
    timetable.operations = [];
    timetable.trainTypes = [];
    timetable.inboundIsFirstHalf = true;

    this.deleteNotUsedTrains(that);
  },

  addTrain(that: OutlinedTimetableData, timetableId: string, train: Train, direction: 'Inbound' | 'Outbound') {
    return this.addTrains(that, timetableId, [{ train: train, beforeTrainId: null, direction: direction }]);
  },

  addTrains(that: OutlinedTimetableData, timetableId: string, newTrains: AddingNewTrain[]) {
    const timetable = that._timetables.find((t) => t.timetableId === timetableId);
    assert(timetable !== undefined);

    const historyItem: HistoryItem = {
      redo: () => {
        that._trains.push(...newTrains.map((train) => train.train));

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
        const trainsAfterDeleted = that._trains.filter(
          (train) => !newTrains.some((t) => t.train.trainId === train.trainId)
        );
        that._trains.splice(0, that._trains.length);
        that._trains.push(...trainsAfterDeleted);
      },
    };

    historyItem.redo();

    return historyItem;
  },

  updateTrain(
    that: OutlinedTimetableData,
    timetableId: string,
    trainId: string,
    redo: (train: Train) => void,
    undo: (train: Train) => void
  ) {
    const timetable = that._timetables.find((t) => t.timetableId === timetableId);
    assert(timetable !== undefined);

    const train = this.getTrain(that, trainId);

    const historyItem: HistoryItem = {
      redo: () => {
        redo(train);
      },
      undo: () => {
        undo(train);
      },
    };

    historyItem.redo();

    return historyItem;
  },
  // commitTrain(that: OutlinedTimetableData, historyItem: HistoryItem) {
  //   historyItem.redo.bind(historyItem.this)();

  //   this.historyManager.push(historyItem);
  // }

  reverseTimetableDirection(that: OutlinedTimetableData, timetableId: string) {
    const timetable = that._timetables.find((t) => t.timetableId === timetableId);
    assert(timetable !== undefined);

    const oldInboundTrains = timetable.inboundTrainIds.map((trainId) => this.getTrain(that, trainId));
    const oldOutboundTrains = timetable.outboundTrainIds.map((trainId) => this.getTrain(that, trainId));

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
    timetable.operations = checkStationTrackOccupation(
      trains,
      timetable.stations.map((s) => s.platforms).flat()
    ).operations;

    that._trains.push(...trains);
    this.deleteNotUsedTrains(that);

    return undefined;
  },
  updateTimetable(
    that: OutlinedTimetableData,
    timetableId: string,
    updateTimetable: (draftTimetable: OutlinedTimetable) => void
  ) {
    const oldTimetable = that._timetables.find((t) => t.timetableId === timetableId);
    assert(oldTimetable !== undefined);

    const historyItem: HistoryItem = {
      redo: () => {
        updateTimetable(oldTimetable);
      },
      undo: () => {
        const timetableIndex = that._timetables.findIndex((t) => t.timetableId === timetableId);
        assert(timetableIndex !== -1);
        that._timetables[timetableIndex] = oldTimetable;
      },
    };

    historyItem.redo();
    return historyItem;
  },

  addTimetable(that: OutlinedTimetableData, timetable: OutlinedTimetable, trains: Train[]) {
    that._timetables.push(timetable);
    for (const train of trains) {
      if (!that._trains.find((t) => t.trainId === train.trainId)) {
        that._trains.push(train);
      }
    }
  },
  deleteNotUsedTrains(that_: OutlinedTimetableData) {
    const that = that_ as OutlinedTimetableData;
    const trainMap = new Map<string, Train>();
    for (const train of that._trains) {
      trainMap.set(train.trainId, train);
    }

    that._trains.splice(0, that._trains.length);
    const usedTrainIds = that._timetables.flatMap((t) => [...t.inboundTrainIds, ...t.outboundTrainIds]);
    for (const usedTrainId of usedTrainIds) {
      const train = trainMap.get(usedTrainId);
      assert(train !== undefined);
      that._trains.push(train);
    }
  },
};
