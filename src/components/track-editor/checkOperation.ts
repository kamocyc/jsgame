import { nn } from '../../common';
import { StationLike, Train } from '../../model';

type StationTimeItem = {
  arrivalOrDeparture: 'Arrival' | 'Departure';
  diaTimeId: string;
  trainId: string;
  time: number;
};
type StationTimes = StationTimeItem[];

export function checkStationTrackOccupation(
  trains: Train[],
  stations: StationLike[]
): {
  type: string;
  trainId: string;
  diaTimeId: string | null;
  stationId: string | null;
}[] {
  const errors = [];

  // 駅 -> 出発、到着時刻の一覧を作る。
  const stationTimesMap = new Map<string, StationTimes>();
  for (const station of stations) {
    stationTimesMap.set(station.stationId, []);
  }

  for (const train of trains) {
    for (const diaTime of train.diaTimes) {
      if (diaTime.arrivalTime !== null) {
        nn(stationTimesMap.get(diaTime.station.stationId)).push({
          arrivalOrDeparture: 'Arrival',
          diaTimeId: diaTime.diaTimeId,
          trainId: train.trainId,
          time: diaTime.arrivalTime,
        });
      }

      if (diaTime.departureTime !== null) {
        nn(stationTimesMap.get(diaTime.station.stationId)).push({
          arrivalOrDeparture: 'Departure',
          diaTimeId: diaTime.diaTimeId,
          trainId: train.trainId,
          time: diaTime.departureTime,
        });
      }
    }
  }

  // 駅 -> 出発、到着時刻の一覧をソートする。
  for (const station of stations) {
    const times = nn(stationTimesMap.get(station.stationId));
    times.sort((a, b) => a.time - b.time);
  }

  // 駅 -> 出発、到着時刻の一覧を元に、駅の使用状況をチェックする。
  for (const station of stations) {
    const times = nn(stationTimesMap.get(station.stationId));

    if (times.length <= 1) {
      continue;
    }

    let isOccupied = times[0].arrivalOrDeparture === 'Departure';
    for (let index = 1; index < times.length; index++) {
      if (isOccupied && times[index].arrivalOrDeparture === 'Arrival') {
        errors.push({
          type: 'DoubleArrival',
          stationId: station.stationId,
          diaTimeId: times[index].diaTimeId,
          trainId: times[index].trainId,
        });
      }

      if (!isOccupied && times[index].arrivalOrDeparture === 'Departure') {
        errors.push({
          type: 'DoubleDeparture',
          stationId: station.stationId,
          diaTimeId: times[index].diaTimeId,
          trainId: times[index].trainId,
        });
      }
    }
  }

  return errors;
}
