import { assert, nn } from '../../common';
import { RailwayLine, RailwayLineStop, splitStops } from '../../mapEditorModel';
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

export function getFirstOrLast(direction: TimetableDirection, inboundIsFirstHalf: boolean) {
  return direction === 'Inbound' ? (inboundIsFirstHalf ? 'First' : 'Last') : inboundIsFirstHalf ? 'Last' : 'First';
}

export function getRailwayPlatform(railwayLine: RailwayLine, stationId: string, firstHalfOrLastHalf: 'First' | 'Last') {
  const { preStops, postStops } = splitStops(railwayLine.stops, railwayLine.returnStopId);

  const stops = firstHalfOrLastHalf === 'First' ? preStops : postStops;
  const stop = stops.find((stop) => stop.platform.station.stationId === stationId);
  assert(stop !== undefined);

  return stop.platform;
}

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

function createTrain(firstStop: RailwayLineStop, lastStop: RailwayLineStop, diaTimes: DiaTime[]): Train {
  const trainId = generateId();
  return {
    trainId: trainId,
    trainType: undefined,
    trainName: '',
    trainCode: '001M',
    diaTimes: diaTimes,
    firstStationOperation: {
      stationOperationType: 'InOut',
      stationId: diaTimes[0].station.stationId,
      platformId: nn(diaTimes[0].platform).platformId,
      trackId: firstStop.platformTrack.trackId,
      operationTime: nn(diaTimes[0].departureTime),
    },
    lastStationOperation: {
      stationOperationType: 'InOut',
      stationId: diaTimes[diaTimes.length - 1].station.stationId,
      platformId: nn(diaTimes[diaTimes.length - 1].platform).platformId,
      trackId: lastStop.platformTrack.trackId,
      operationTime: nn(diaTimes[diaTimes.length - 1].arrivalTime) + 60,
    },
  };
}

function showStops(stops: RailwayLineStop[]) {
  return stops.map((stop) => stop.platform.station.stationName).join(' ');
}

// 路線から初期のダイヤを作成する
export function getInitialTimetable(railwayLine: RailwayLine): [OutlinedTimetable, Train[]] {
  const baseTime = 10 * 60 * 60;

  function createDiaTime(stop: RailwayLineStop, index: number, maxStopLength: number): DiaTime {
    return {
      diaTimeId: generateId(),
      arrivalTime: index === 0 ? null : currentTime,
      departureTime: index === maxStopLength - 1 ? null : currentTime + 1,
      isPassing: false,
      station: stop.platform.station,
      platform: stop.platform,
      trackId: stop.platformTrack.trackId,
      isInService: true,
    };
  }

  const { preStops, postStops } = splitStops(railwayLine.stops, railwayLine.returnStopId);

  console.log({ stops: showStops(railwayLine.stops), preStops: showStops(preStops), postStops: showStops(postStops) });

  let currentTime: number;
  let inboundDiaTimes: DiaTime[];
  let outboundDiaTimes: DiaTime[];
  {
    currentTime = baseTime;
    inboundDiaTimes = preStops.map((stop, index) => {
      const newDiaTime = createDiaTime(stop, index, preStops.length);
      const platformPaths = preStops[index]?.platformPaths;
      if (index !== preStops.length - 1 && platformPaths != null) {
        currentTime += platformPaths.length * 0.5 * 60;
      }
      return newDiaTime;
    });
  }
  {
    currentTime = baseTime;
    outboundDiaTimes = postStops.map((stop, index) => {
      const newDiaTime = createDiaTime(stop, index, postStops.length);
      const platformPaths = postStops[index + 1]?.platformPaths;
      if (index !== postStops.length - 1 && platformPaths != null) {
        currentTime += platformPaths.length * 0.5 * 60;
      }
      return newDiaTime;
    });
  }

  const stations = preStops.map((stop) => stop.platform.station);

  const inboundTrains: Train[] = [createTrain(preStops[0], preStops[preStops.length - 1], inboundDiaTimes)];
  const outboundTrains: Train[] = [createTrain(postStops[0], postStops[postStops.length - 1], outboundDiaTimes)];

  const trains = inboundTrains.concat(outboundTrains);

  const timetable: OutlinedTimetable = {
    timetableId: generateId(),
    inboundTrainIds: inboundTrains.map((diaTime) => diaTime.trainId),
    outboundTrainIds: outboundTrains.map((diaTime) => diaTime.trainId),
    operations: createOperations(trains).operations,
    railwayLineId: railwayLine.railwayLineId,
    stations: stations,
    trainTypes: getInitialTrainTypes(),
    inboundIsFirstHalf: true,
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
        trackId: null,
      });
    }
  }
}
