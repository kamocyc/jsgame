import { assert, nn, toStringFromSeconds } from '../../common';
import { OperationError } from '../../mapEditorModel';
import { Operation, PlatformLike, Train, generateId } from '../../model';
import { generateOperationCode } from './timetableConverter';

type StationTimeItem = {
  arrivalOrDeparture: 'Arrival' | 'Departure';
  diaTimeId: string;
  train: Train;
  time: number;
};
type StationTimes = StationTimeItem[];

export function checkStationTrackOccupation(
  trains: Train[],
  platforms: PlatformLike[]
): { errors: OperationError[]; operations: Operation[] } {
  const errors: OperationError[] = [];

  // プラットフォーム -> 出発、到着時刻の一覧を作る。
  const platformTimesMap = new Map<string, StationTimes>();
  for (const platform of platforms) {
    platformTimesMap.set(platform.platformId, []);
  }

  for (const train of trains) {
    for (const diaTime of train.diaTimes) {
      if (diaTime.arrivalTime !== null) {
        if (diaTime.platform === null) {
          console.warn('diaTime.platform === null');
        } else {
          nn(platformTimesMap.get(diaTime.platform?.platformId)).push({
            arrivalOrDeparture: 'Arrival',
            diaTimeId: diaTime.diaTimeId,
            train: train,
            time: diaTime.arrivalTime,
          });
        }
      }

      if (diaTime.departureTime !== null) {
        if (diaTime.platform === null) {
          console.warn('diaTime.platform === null');
        } else {
          nn(platformTimesMap.get(diaTime.platform?.platformId)).push({
            arrivalOrDeparture: 'Departure',
            diaTimeId: diaTime.diaTimeId,
            train: train,
            time: diaTime.departureTime,
          });
        }
      }
    }
  }

  // プラットフォーム -> 出発、到着時刻の一覧をソートする。
  for (const platform of platforms) {
    const times = nn(platformTimesMap.get(platform.platformId));
    times.sort((a, b) => a.time - b.time);
  }

  // プラットフォーム -> 出発、到着時刻の一覧を元に、駅の使用状況をチェックする。
  for (const platform of platforms) {
    const times = nn(platformTimesMap.get(platform.platformId));

    if (times.length <= 1) {
      continue;
    }

    let isOccupied = times[0].arrivalOrDeparture === 'Arrival';
    for (let index = 1; index < times.length; index++) {
      if (isOccupied && times[index].arrivalOrDeparture === 'Arrival') {
        console.log({
          station: platforms.find((p) => p.platformId === platform.platformId)?.station.stationName,
          stationId: platform.station.stationId,
          platform: platform.platformName,
          platformId: platform.platformId,
          train: times[index].train,
          diaTimeId: times[index].diaTimeId,
          second: times[index].time,
          time: toStringFromSeconds(times[index].time),
        });
        errors.push({
          type: 'DoubleArrival',
          stationId: platform.station.stationId,
          arrivalOrDeparture: 'arrivalTime',
          platformId: platform.platformId,
          diaTimeId: times[index].diaTimeId,
          trainId: times[index].train.trainId,
        });
      }

      if (!isOccupied && times[index].arrivalOrDeparture === 'Departure') {
        errors.push({
          type: 'DoubleDeparture',
          stationId: platform.station.stationId,
          arrivalOrDeparture: 'departureTime',
          platformId: platform.platformId,
          diaTimeId: times[index].diaTimeId,
          trainId: times[index].train.trainId,
        });
      }

      if (times[index].arrivalOrDeparture === 'Arrival') {
        isOccupied = true;
      } else {
        isOccupied = false;
      }
    }
  }

  const operations = createOperations(trains, platformTimesMap);
  return { errors, operations };
}

type OperationSimple = {
  operationId: string;
  trains: Train[];
};

function createOperations(trains: Train[], platformTimesMap: Map<string, StationTimes>): Operation[] {
  const platformIds = platformTimesMap.keys();
  const trainIdToOperationId = new Map<string, string>();
  const operations = new Map<string, OperationSimple>();
  for (const train of trains) {
    const operationId = generateId();
    trainIdToOperationId.set(train.trainId, operationId);
    operations.set(operationId, { operationId, trains: [train] });
  }

  const isFirstDiaTime = (train: Train, diaTimeId: string) => {
    return train.diaTimes[0].diaTimeId === diaTimeId;
  };
  const isLastDiaTime = (train: Train, diaTimeId: string) => {
    return train.diaTimes[train.diaTimes.length - 1].diaTimeId === diaTimeId;
  };

  const mergeOperations = (prevTrainId: string, currTrainId: string) => {
    const operationIdOfPrevTrain = nn(trainIdToOperationId.get(prevTrainId));
    const operationIdOfCurrTrain = nn(trainIdToOperationId.get(currTrainId));
    assert(operationIdOfPrevTrain !== operationIdOfCurrTrain);
    const prevOperationTrains = nn(operations.get(operationIdOfPrevTrain)).trains;
    const currOperationTrains = nn(operations.get(operationIdOfCurrTrain)).trains;

    const mergedOperations = [...prevOperationTrains, ...currOperationTrains];
    for (const train of mergedOperations) {
      trainIdToOperationId.set(train.trainId, operationIdOfPrevTrain);
    }
    operations.set(operationIdOfPrevTrain, {
      operationId: operationIdOfPrevTrain,
      trains: mergedOperations,
    });

    operations.delete(operationIdOfCurrTrain);
  };

  for (const platformId of platformIds) {
    const times = nn(platformTimesMap.get(platformId));

    if (times.length <= 1) {
      continue;
    }

    // 接続する列車のoperationをマージする。
    let prevTrain = times[0].train;
    for (let index = 1; index < times.length; index++) {
      if (prevTrain.trainId !== times[index].train.trainId) {
        if (
          times[index - 1].arrivalOrDeparture === 'Arrival' &&
          times[index].arrivalOrDeparture === 'Departure' &&
          isLastDiaTime(prevTrain, times[index - 1].diaTimeId) &&
          isFirstDiaTime(times[index].train, times[index].diaTimeId)
        ) {
          mergeOperations(prevTrain.trainId, times[index].train.trainId);
        }
      }

      prevTrain = times[index].train;
    }
  }

  const result: Operation[] = [];
  for (const operation of operations.values()) {
    result.push({
      operationId: operation.operationId,
      operationCode: generateOperationCode(result),
      trains: operation.trains,
    });
  }
  return result;
}
