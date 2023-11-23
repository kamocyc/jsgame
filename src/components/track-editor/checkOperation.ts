import { nn, toStringFromSeconds } from '../../common';
import { OperationError } from '../../mapEditorModel';
import { PlatformLike, Train } from '../../model';

type StationTimeItem = {
  arrivalOrDeparture: 'Arrival' | 'Departure';
  diaTimeId: string;
  trainId: string;
  time: number;
};
type StationTimes = StationTimeItem[];

export function checkStationTrackOccupation(trains: Train[], platforms: PlatformLike[]): OperationError[] {
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
            trainId: train.trainId,
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
            trainId: train.trainId,
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
          trainId: times[index].trainId,
          diaTimeId: times[index].diaTimeId,
          second: times[index].time,
          time: toStringFromSeconds(times[index].time),
        });
        errors.push({
          type: 'DoubleArrival',
          stationId: platform.station.stationId,
          platformId: platform.platformId,
          diaTimeId: times[index].diaTimeId,
          trainId: times[index].trainId,
        });
      }

      if (!isOccupied && times[index].arrivalOrDeparture === 'Departure') {
        errors.push({
          type: 'DoubleDeparture',
          stationId: platform.station.stationId,
          platformId: platform.platformId,
          diaTimeId: times[index].diaTimeId,
          trainId: times[index].trainId,
        });
      }

      if (times[index].arrivalOrDeparture === 'Arrival') {
        isOccupied = true;
      } else {
        isOccupied = false;
      }
    }
  }

  return errors;
}
