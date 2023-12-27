import { DeepReadonly } from 'ts-essentials';
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
type StationTimes = DeepReadonly<StationTimeItem>[];

export function checkStationTrackOccupation(
  trains: DeepReadonly<Train[]>,
  platforms: DeepReadonly<PlatformLike[]>
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
        if (diaTime.platformId === null) {
          console.warn('diaTime.platformId === null');
        } else {
          nn(platformTimesMap.get(diaTime.platformId)).push({
            arrivalOrDeparture: 'Arrival',
            diaTimeId: diaTime.diaTimeId,
            train: train,
            time: diaTime.arrivalTime,
          });
        }
      }

      if (diaTime.departureTime !== null) {
        if (diaTime.platformId === null) {
          console.warn('diaTime.platform === null');
        } else {
          nn(platformTimesMap.get(diaTime.platformId)).push({
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
          // station: platforms.find((p) => p.platformId === platform.platformId)?.station.stationName,
          stationId: platform.stationId,
          platform: platform.platformName,
          platformId: platform.platformId,
          train: times[index].train,
          diaTimeId: times[index].diaTimeId,
          second: times[index].time,
          time: toStringFromSeconds(times[index].time),
        });
        errors.push({
          type: 'DoubleArrival',
          stationId: platform.stationId,
          arrivalOrDeparture: 'arrivalTime',
          platformId: platform.platformId,
          diaTimeId: times[index].diaTimeId,
          trainId: times[index].train.trainId,
        });
      }

      if (!isOccupied && times[index].arrivalOrDeparture === 'Departure') {
        errors.push({
          type: 'DoubleDeparture',
          stationId: platform.stationId,
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

  // 詳細ダイヤ変換時にエラーになる点をチェックしたい。まずは、時刻がnull
  const detailedTimetableErrors = checkDetailedTimetable(trains);
  errors.push(...detailedTimetableErrors);
  return { errors, operations };
}

function checkDetailedTimetable(trains: DeepReadonly<Train[]>): OperationError[] {
  const errors: OperationError[] = [];
  for (const train of trains) {
    const minIndex = Math.min(
      ...train.diaTimes
        .map((diaTime, i) => [diaTime, i] as const)
        .filter(([diaTime, _]) => diaTime.arrivalTime !== null || diaTime.departureTime !== null)
        .map(([_, i]) => i)
    );
    const maxIndex = Math.max(
      ...train.diaTimes
        .map((diaTime, i) => [diaTime, i] as const)
        .filter(([diaTime, _]) => diaTime.arrivalTime !== null || diaTime.departureTime !== null)
        .map(([_, i]) => i)
    );

    let index = 0;

    for (const diaTime of train.diaTimes) {
      if (index >= minIndex && index <= maxIndex) {
        // 条件は見直したいところ
        if (diaTime.arrivalTime === null && index !== minIndex) {
          errors.push({
            type: 'NullArrivalTime',
            trainId: train.trainId,
            diaTimeId: diaTime.diaTimeId,
            arrivalOrDeparture: 'arrivalTime',
            platformId: diaTime.platformId,
            stationId: diaTime.stationId,
          });
        }
        if (diaTime.departureTime === null && index !== maxIndex) {
          errors.push({
            type: 'NullDepartureTime',
            trainId: train.trainId,
            diaTimeId: diaTime.diaTimeId,
            arrivalOrDeparture: 'departureTime',
            platformId: diaTime.platformId,
            stationId: diaTime.stationId,
          });
        }
        if (diaTime.arrivalTime !== null || diaTime.departureTime !== null) {
          if (diaTime.platformId === null) {
            errors.push({
              type: 'NullPlatform',
              trainId: train.trainId,
              diaTimeId: diaTime.diaTimeId,
              arrivalOrDeparture: null,
              platformId: null,
              stationId: diaTime.stationId,
            });
          }
          // if (diaTime.trackId === null) {
          //   errors.push({
          //     type: 'NullTrack',
          //     trainId: train.trainId,
          //     diaTimeId: diaTime.diaTimeId,
          //     arrivalOrDeparture: null,
          //     platformId: diaTime.platformId,
          //     stationId: diaTime.stationId,
          //   });
          // }
        }
      }

      index++;
    }
  }

  return errors;
}

type OperationSimple = DeepReadonly<{
  operationId: string;
  trainIds: string[];
}>;

function createOperations(trains: DeepReadonly<Train[]>, platformTimesMap: Map<string, StationTimes>): Operation[] {
  const platformIds = platformTimesMap.keys();
  const trainIdToOperationId = new Map<string, string>();
  const operations = new Map<string, OperationSimple>();
  for (const train of trains) {
    const operationId = generateId();
    trainIdToOperationId.set(train.trainId, operationId);
    operations.set(operationId, { operationId, trainIds: [train.trainId] });
  }

  const isFirstDiaTime = (train: DeepReadonly<Train>, diaTimeId: string) => {
    return train.diaTimes[0].diaTimeId === diaTimeId;
  };
  const isLastDiaTime = (train: DeepReadonly<Train>, diaTimeId: string) => {
    return train.diaTimes[train.diaTimes.length - 1].diaTimeId === diaTimeId;
  };

  const mergeOperations = (prevTrainId: string, currTrainId: string) => {
    const operationIdOfPrevTrain = nn(trainIdToOperationId.get(prevTrainId));
    const operationIdOfCurrTrain = nn(trainIdToOperationId.get(currTrainId));
    assert(operationIdOfPrevTrain !== operationIdOfCurrTrain);
    const prevOperationTrainIds = nn(operations.get(operationIdOfPrevTrain)).trainIds;
    const currOperationTrainIds = nn(operations.get(operationIdOfCurrTrain)).trainIds;

    const mergedOperations = [...prevOperationTrainIds, ...currOperationTrainIds];
    for (const trainId of mergedOperations) {
      trainIdToOperationId.set(trainId, operationIdOfPrevTrain);
    }
    operations.set(operationIdOfPrevTrain, {
      operationId: operationIdOfPrevTrain,
      trainIds: mergedOperations,
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
      trainIds: operation.trainIds,
    });
  }
  return result;
}
