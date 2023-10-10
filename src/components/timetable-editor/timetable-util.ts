import { assert } from '../../common';
import { RailwayLine, RailwayLineStop } from '../../mapEditorModel';
import {
  DefaultStationDistance,
  DiaTime,
  OutlinedTimetable,
  OutlinedTimetableData,
  Platform,
  Station,
  TimetableDirection,
  Train,
  TrainType,
  generateId,
} from '../../model';
import { createOperations } from '../track-editor/timetableConverter';
import './timetable-editor.css';

export function getDefaultPlatform(diaStation: Station, direction: TimetableDirection): Platform {
  const result =
    direction === 'Outbound'
      ? diaStation.platforms.find((diaPlatform) => diaPlatform.platformId === diaStation.defaultOutboundPlatformId)
      : diaStation.platforms.find((diaPlatform) => diaPlatform.platformId === diaStation.defaultInboundPlatformId);
  if (result == null) {
    throw new Error('default platform not found');
  }
  return result;
}

export function createNewStation(stationName: string): Station {
  const newPlatforms = [
    {
      platformId: generateId(),
      platformName: '1',
    },
    {
      platformId: generateId(),
      platformName: '2',
    },
  ] as Platform[];
  const newStation: Station = {
    stationId: generateId(),
    stationName: stationName,
    platforms: newPlatforms,
    defaultInboundPlatformId: newPlatforms[0].platformId,
    defaultOutboundPlatformId: newPlatforms[1].platformId,
    distance: DefaultStationDistance,
  };
  newPlatforms[0].station = newStation;
  newPlatforms[1].station = newStation;

  return newStation;
}

export function getInitialTrainTypes(): TrainType[] {
  return [
    {
      trainTypeId: '1',
      trainTypeName: '普通',
      trainTypeColor: '#000000',
    },
    {
      trainTypeId: '2',
      trainTypeName: '急行',
      trainTypeColor: '#ff0000',
    },
  ];
}

export function getInitialTimetable(railwayLine: RailwayLine): [OutlinedTimetable, Train[]] {
  const baseTime = 7 * 60 * 60;

  function createDiaTime(stop: RailwayLineStop, index: number) {
    return {
      diaTimeId: generateId(),
      arrivalTime: index === 0 ? null : currentTime,
      departureTime: index === stops.length - 1 ? null : currentTime + 1,
      isPassing: false,
      station: stop.platform.station,
      platform: stop.platform,
    };
  }

  const stops = railwayLine.stops;

  let currentTime: number;
  let inboundDiaTimes: DiaTime[];
  let outboundDiaTimes: DiaTime[];
  {
    currentTime = baseTime;
    inboundDiaTimes = stops.map((stop, index) => {
      const newDiaTime = createDiaTime(stop, index);
      if (index !== stops.length - 1 && stops[index].platformPaths != null) {
        currentTime += stops[index].platformPaths!.length * 3 * 60;
      }
      return newDiaTime;
    });
  }
  {
    currentTime = baseTime;
    outboundDiaTimes = [...stops].reverse().map((stop, index) => {
      const newDiaTime = createDiaTime(stop, index);
      if (index !== stops.length - 1 && stops[index + 1].platformPaths != null) {
        currentTime += stops[index + 1].platformPaths!.length * 3 * 60;
      }
      return newDiaTime;
    });
  }

  const stations = stops.map((stop) => stop.platform.station);

  const inboundTrains: Train[] = [
    {
      trainId: generateId(),
      trainName: '',
      trainCode: '001M',
      diaTimes: inboundDiaTimes,
      direction: 'Inbound',
    },
  ];

  const outboundTrains: Train[] = [
    {
      trainId: generateId(),
      trainName: '',
      trainCode: '002M',
      diaTimes: outboundDiaTimes,
      direction: 'Outbound',
    },
  ];

  const trains = inboundTrains.concat(outboundTrains);

  const timetable: OutlinedTimetable = {
    inboundTrainIds: inboundTrains.map((diaTime) => diaTime.trainId),
    outboundTrainIds: outboundTrains.map((diaTime) => diaTime.trainId),
    operations: createOperations(trains),
    railwayLineId: railwayLine.railwayLineId,
    stations: stations,
    trainTypes: getInitialTrainTypes(),
  };

  return [timetable, trains];
}

export function getTrain(timetableData: OutlinedTimetableData, trainId: string): Train {
  const train = timetableData.trains.find((train) => train.trainId === trainId);
  assert(train !== undefined);
  return train;
}

export function reverseTimetableDirection(
  timetableData: OutlinedTimetableData,
  timetable: OutlinedTimetable
): [OutlinedTimetable, Train[]] {
  const oldInboundTrains = timetable.inboundTrainIds.map((trainId) => getTrain(timetableData, trainId));
  const oldOutboundTrains = timetable.outboundTrainIds.map((trainId) => getTrain(timetableData, trainId));

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
  return [
    {
      railwayLineId: timetable.railwayLineId,
      inboundTrainIds: inboundTrains.map((train) => train.trainId),
      outboundTrainIds: outboundTrains.map((train) => train.trainId),
      stations: timetable.stations.slice().reverse(),
      trainTypes: timetable.trainTypes,
      operations: createOperations(trains),
    },
    trains,
  ];
}

export function deleteTrains(outlinedTimetableData: OutlinedTimetableData, trainIds: string[]) {
  const notUedTrainIds: string[] = [];
  for (const trainId of trainIds) {
    // 他で使われていなければ、trainIdを削除
    let used = false;
    for (const tt of outlinedTimetableData.timetables) {
      if (tt.inboundTrainIds.concat(tt.outboundTrainIds).some((id) => id === trainId)) {
        used = true;
        break;
      }
    }

    if (!used) {
      notUedTrainIds.push(trainId);
    }
  }

  outlinedTimetableData.trains = outlinedTimetableData.trains.filter(
    (train) => !notUedTrainIds.some((id) => id === train.trainId)
  );
}

export function clearTimetable(outlinedTimetableData: OutlinedTimetableData, timetable: OutlinedTimetable) {
  // trainを削除
  deleteTrains(outlinedTimetableData, timetable.inboundTrainIds.concat(timetable.outboundTrainIds));

  timetable.inboundTrainIds = [];
  timetable.outboundTrainIds = [];
  timetable.operations = [];
  timetable.trainTypes = [];
}
