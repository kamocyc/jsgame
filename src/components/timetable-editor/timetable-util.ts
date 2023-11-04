import { assert, nn } from '../../common';
import { RailwayLine, RailwayLineStop } from '../../mapEditorModel';
import {
  DefaultStationDistance,
  DiaTime,
  Platform,
  PlatformLike,
  Station,
  StationLike,
  TimetableDirection,
  Train,
  TrainType,
  generateId,
} from '../../model';
import { OutlinedTimetable } from '../../outlinedTimetableData';
import { createOperations } from '../track-editor/timetableConverter';
import './timetable-editor.css';

export function getDefaultPlatform(station: StationLike, direction: TimetableDirection): PlatformLike {
  if (station.stationType === 'Station') {
    const result =
      direction === 'Outbound'
        ? station.platforms.find((diaPlatform) => diaPlatform.platformId === station.defaultOutboundPlatformId)
        : station.platforms.find((diaPlatform) => diaPlatform.platformId === station.defaultInboundPlatformId);
    if (result == null) {
      throw new Error('default platform not found');
    }
    return result;
  } else if (station.stationType === 'Depot') {
    assert(station.platforms.length > 0);
    const result = station.platforms[0];
    return result;
  }
  assert(false);
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
    stationType: 'Station',
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

function createTrain(stops: RailwayLineStop[], diaTimes: DiaTime[]): Train {
  const trainId = generateId();
  return {
    trainId: trainId,
    trainName: '',
    trainCode: '001M',
    diaTimes: diaTimes,
    firstStationOperation: {
      stationOperationType: 'InOut',
      stationId: diaTimes[0].station.stationId,
      platformId: nn(diaTimes[0].platform).platformId,
      trackId: stops[0].platformTrack.trackId,
      operationTime: nn(diaTimes[0].departureTime),
    },
    lastStationOperation: {
      stationOperationType: 'InOut',
      stationId: diaTimes[diaTimes.length - 1].station.stationId,
      platformId: nn(diaTimes[diaTimes.length - 1].platform).platformId,
      trackId: stops[stops.length - 1].platformTrack.trackId,
      operationTime: nn(diaTimes[diaTimes.length - 1].arrivalTime) + 60,
    },
    direction: 'Inbound',
  };
}

export function getInitialTimetable(railwayLine: RailwayLine): [OutlinedTimetable, Train[]] {
  const baseTime = 10 * 60 * 60;

  function createDiaTime(stop: RailwayLineStop, index: number): DiaTime {
    return {
      diaTimeId: generateId(),
      arrivalTime: index === 0 ? null : currentTime,
      departureTime: index === stops.length - 1 ? null : currentTime + 1,
      isPassing: false,
      station: stop.platform.station,
      platform: stop.platform,
      isInService: true,
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
        currentTime += stops[index].platformPaths!.length * 0.5 * 60;
      }
      return newDiaTime;
    });
  }
  {
    currentTime = baseTime;
    outboundDiaTimes = [...stops].reverse().map((stop, index) => {
      const newDiaTime = createDiaTime(stop, index);
      if (index !== stops.length - 1 && stops[index + 1].platformPaths != null) {
        currentTime += stops[index + 1].platformPaths!.length * 0.5 * 60;
      }
      return newDiaTime;
    });
  }

  const stations = stops.map((stop) => stop.platform.station);

  const trainId = generateId();
  const inboundTrains: Train[] = [createTrain(stops, inboundDiaTimes)];

  const trainId2 = generateId();
  const outboundTrains: Train[] = [createTrain([...stops].reverse(), outboundDiaTimes)];

  const trains = inboundTrains.concat(outboundTrains);

  const timetable: OutlinedTimetable = {
    timetableId: generateId(),
    inboundTrainIds: inboundTrains.map((diaTime) => diaTime.trainId),
    outboundTrainIds: outboundTrains.map((diaTime) => diaTime.trainId),
    operations: createOperations(trains),
    railwayLineId: railwayLine.railwayLineId,
    stations: stations,
    trainTypes: getInitialTrainTypes(),
  };

  return [timetable, trains];
}

// 足りない駅の時刻を補完する
export function fillMissingTimes(train: Train, stations: StationLike[]): void {
  for (const station of stations) {
    const diaTime = train.diaTimes.find((diaTime) => diaTime.station.stationId === station.stationId);
    if (diaTime === undefined) {
      train.diaTimes.push({
        diaTimeId: generateId(),
        station: station,
        platform: null,
        arrivalTime: null,
        departureTime: null,
        isPassing: false,
        isInService: false,
      });
    }
  }
}
