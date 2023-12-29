import { DeepReadonly } from 'ts-essentials';
import { assert, nn, toStringFromSeconds } from '../../common';
import { OperationError } from '../../mapEditorModel';
import { Operation, PlatformLike, Train, generateId } from '../../model';
import { DiaTimePartial } from '../konva-diagram-editor/konva-util';
import { generateOperationCode } from './timetableConverter';

type PlatformTimeItem = {
  arrivalOrDeparture: 'Arrival' | 'Departure';
  diaTimeId: string;
  train: Train;
  time: number;
};
type PlatformTimes = DeepReadonly<PlatformTimeItem>[];

export function checkStationTrackOccupation(
  trains: DeepReadonly<Train[]>,
  platforms: DeepReadonly<PlatformLike[]>
): { errors: OperationError[]; operations: Operation[] } {
  const errors: OperationError[] = [];

  // プラットフォーム -> 出発、到着時刻の一覧を作る。
  const platformTimesMap = new Map<string, PlatformTimes>();
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
    const platformTimes = nn(platformTimesMap.get(platform.platformId));
    platformTimes.sort((a, b) => a.time - b.time);
  }

  // プラットフォーム -> 出発、到着時刻の一覧を元に、駅の使用状況をチェックする。
  for (const platform of platforms) {
    const platformTimes = nn(platformTimesMap.get(platform.platformId));

    if (platformTimes.length <= 1) {
      continue;
    }

    let isOccupied = platformTimes[0].arrivalOrDeparture === 'Arrival';
    for (let index = 1; index < platformTimes.length; index++) {
      if (isOccupied && platformTimes[index].arrivalOrDeparture === 'Arrival') {
        console.log({
          // station: platforms.find((p) => p.platformId === platform.platformId)?.station.stationName,
          stationId: platform.stationId,
          platform: platform.platformName,
          platformId: platform.platformId,
          train: platformTimes[index].train,
          diaTimeId: platformTimes[index].diaTimeId,
          second: platformTimes[index].time,
          time: toStringFromSeconds(platformTimes[index].time),
        });
        errors.push({
          type: 'DoubleArrival',
          message: '同じプラットフォームへの到着が連続しています',
          stationId: platform.stationId,
          arrivalOrDeparture: 'arrivalTime',
          platformId: platform.platformId,
          diaTimeId: platformTimes[index].diaTimeId,
          trainId: platformTimes[index].train.trainId,
        });
      }

      if (!isOccupied && platformTimes[index].arrivalOrDeparture === 'Departure') {
        errors.push({
          type: 'DoubleDeparture',
          message: '同じプラットフォームからの出発が連続しています',
          stationId: platform.stationId,
          arrivalOrDeparture: 'departureTime',
          platformId: platform.platformId,
          diaTimeId: platformTimes[index].diaTimeId,
          trainId: platformTimes[index].train.trainId,
        });
      }

      if (platformTimes[index].arrivalOrDeparture === 'Arrival') {
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

export function getMinAndMaxDiaTimeIndex(diaTimes: DeepReadonly<DiaTimePartial[]>): {
  minIndex: number;
  maxIndex: number;
} {
  const minIndex = Math.min(
    ...diaTimes
      .map((diaTime, i) => [diaTime, i] as const)
      .filter(([diaTime, _]) => diaTime.arrivalTime !== null || diaTime.departureTime !== null)
      .map(([_, i]) => i)
  );
  const maxIndex = Math.max(
    ...diaTimes
      .map((diaTime, i) => [diaTime, i] as const)
      .filter(([diaTime, _]) => diaTime.arrivalTime !== null || diaTime.departureTime !== null)
      .map(([_, i]) => i)
  );
  return { minIndex, maxIndex };
}

function checkDetailedTimetable(trains: DeepReadonly<Train[]>): OperationError[] {
  const errors: OperationError[] = [];
  for (const train of trains) {
    let index = 0;
    const { minIndex, maxIndex } = getMinAndMaxDiaTimeIndex(train.diaTimes);

    let previousTime = -1;
    for (const diaTime of train.diaTimes) {
      if (index >= minIndex && index <= maxIndex) {
        if (diaTime.arrivalTime !== null && diaTime.departureTime !== null) {
          if (diaTime.arrivalTime > diaTime.departureTime) {
            errors.push({
              type: 'ArrivalTimeGreaterThanDepartureTime',
              message: '到着時刻が出発時刻よりも後になっています。',
              trainId: train.trainId,
              diaTimeId: diaTime.diaTimeId,
              arrivalOrDeparture: null,
              platformId: diaTime.platformId,
              stationId: diaTime.stationId,
            });
          }
        }
        if (diaTime.arrivalTime !== null) {
          if (diaTime.arrivalTime <= previousTime) {
            errors.push({
              type: 'ArrivalTimeLessThanPreviousTime',
              message: '到着時刻が前駅の時刻よりも前になっています。',
              trainId: train.trainId,
              diaTimeId: diaTime.diaTimeId,
              arrivalOrDeparture: null,
              platformId: diaTime.platformId,
              stationId: diaTime.stationId,
            });
          }
        }
        if (diaTime.departureTime !== null) {
          if (diaTime.departureTime <= previousTime) {
            errors.push({
              type: 'DepartureTimeLessThanPreviousTime',
              message: '出発時刻が前駅の時刻よりも前になっています。',
              trainId: train.trainId,
              diaTimeId: diaTime.diaTimeId,
              arrivalOrDeparture: null,
              platformId: diaTime.platformId,
              stationId: diaTime.stationId,
            });
          }
        }

        if (diaTime.arrivalTime !== null) previousTime = diaTime.arrivalTime;
        if (diaTime.departureTime !== null) previousTime = diaTime.departureTime;

        // 条件は見直したいところ
        if (diaTime.arrivalTime === null && index !== minIndex) {
          errors.push({
            type: 'NullArrivalTime',
            message: '到着時刻が入力されていません。',
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
            message: '出発時刻が入力されていません。',
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
              message: 'プラットフォームが入力されていません。',
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

function createOperations(trains: DeepReadonly<Train[]>, platformTimesMap: Map<string, PlatformTimes>): Operation[] {
  const platformIds = platformTimesMap.keys();
  const trainIdToOperationId = new Map<string, string>();
  const operations = new Map<string, OperationSimple>();
  for (const train of trains) {
    const operationId = generateId();
    trainIdToOperationId.set(train.trainId, operationId);
    operations.set(operationId, { operationId, trainIds: [train.trainId] });
  }

  const isFirstDiaTime = (train: DeepReadonly<Train>, diaTimeId: string) => {
    const { minIndex } = getMinAndMaxDiaTimeIndex(train.diaTimes);
    return train.diaTimes[minIndex].diaTimeId === diaTimeId;
  };
  const isLastDiaTime = (train: DeepReadonly<Train>, diaTimeId: string) => {
    const { maxIndex } = getMinAndMaxDiaTimeIndex(train.diaTimes);
    return train.diaTimes[maxIndex].diaTimeId === diaTimeId;
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
    const platformTimes = nn(platformTimesMap.get(platformId));

    if (platformTimes.length <= 1) {
      continue;
    }

    // 接続する列車のoperationをマージする。
    let prevTrain = platformTimes[0].train;
    for (let index = 1; index < platformTimes.length; index++) {
      if (prevTrain.trainId !== platformTimes[index].train.trainId) {
        if (
          platformTimes[index - 1].arrivalOrDeparture === 'Arrival' &&
          platformTimes[index].arrivalOrDeparture === 'Departure' &&
          isLastDiaTime(prevTrain, platformTimes[index - 1].diaTimeId) &&
          isFirstDiaTime(platformTimes[index].train, platformTimes[index].diaTimeId)
        ) {
          mergeOperations(prevTrain.trainId, platformTimes[index].train.trainId);
        }
      }

      prevTrain = platformTimes[index].train;
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
