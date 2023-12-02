import { DeepReadonly } from 'ts-essentials';
import { assert, nn } from '../../common';
import { RailwayLine, RailwayLineStop, splitStops } from '../../mapEditorModel';
import { DiaTime, Platform, Station, StationLike, TimetableDirection, Train, TrainType, generateId } from '../../model';
import { OutlinedTimetable } from '../../outlinedTimetableData';
import { checkStationTrackOccupation } from '../track-editor/checkOperation';
import './timetable-editor.css';

export function getFirstOrLast(direction: TimetableDirection, inboundIsFirstHalf: boolean) {
  return direction === 'Inbound' ? (inboundIsFirstHalf ? 'First' : 'Last') : inboundIsFirstHalf ? 'Last' : 'First';
}

export function getRailwayPlatform(
  railwayLine: DeepReadonly<RailwayLine>,
  stationId: string,
  firstHalfOrLastHalf: 'First' | 'Last'
) {
  const { preStops, postStops } = splitStops(railwayLine.stops, railwayLine.returnStopId);

  const stops = firstHalfOrLastHalf === 'First' ? preStops : postStops;
  const stop = stops.find((stop) => stop.platform.stationId === stationId);
  assert(stop !== undefined);

  return stop.platform;
}

// export function getDefaultPlatform(station: DeepReadonly<StationLike>, direction: TimetableDirection): PlatformLike {
//   if (station.stationType === 'Station') {
//     const result =
//       direction === 'Outbound'
//         ? station.platforms.find((diaPlatform) => diaPlatform.platformId === station.defaultOutboundPlatformId)
//         : station.platforms.find((diaPlatform) => diaPlatform.platformId === station.defaultInboundPlatformId);
//     if (result == null) {
//       throw new Error('default platform not found');
//     }
//     return { ...result } as PlatformLike;
//   } else if (station.stationType === 'Depot') {
//     assert(station.platforms.length > 0);
//     const result = station.platforms[0];
//     return { ...result } as PlatformLike;
//   }
//   assert(false);
// }

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
    // defaultInboundPlatformId: newPlatforms[0].platformId,
    // defaultOutboundPlatformId: newPlatforms[1].platformId,
    // distance: DefaultStationDistance,
  };
  newPlatforms[0].stationId = newStation.stationId;
  newPlatforms[1].stationId = newStation.stationId;

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

function createTrain(
  firstStop: DeepReadonly<RailwayLineStop>,
  lastStop: DeepReadonly<RailwayLineStop>,
  diaTimes: DiaTime[]
): Train {
  const trainId = generateId();
  return {
    trainId: trainId,
    trainType: undefined,
    trainName: '',
    trainCode: '001M',
    diaTimes: diaTimes,
    firstStationOperation: {
      stationOperationType: 'InOut',
      stationId: diaTimes[0].stationId,
      platformId: nn(diaTimes[0].platformId),
      trackId: firstStop.platformTrack.trackId,
      operationTime: nn(diaTimes[0].departureTime),
    },
    lastStationOperation: {
      stationOperationType: 'InOut',
      stationId: diaTimes[diaTimes.length - 1].stationId,
      platformId: nn(diaTimes[diaTimes.length - 1].platformId),
      trackId: lastStop.platformTrack.trackId,
      operationTime: nn(diaTimes[diaTimes.length - 1].arrivalTime) + 60,
    },
  };
}

function showStops(stops: DeepReadonly<RailwayLineStop[]>) {
  return stops.map((stop) => stop.platform.stationId).join(' ');
}

// 路線から初期のダイヤを作成する
export function getInitialTimetable(
  stations: Map<string, StationLike>,
  railwayLine: DeepReadonly<RailwayLine>
): [OutlinedTimetable, Train[]] {
  const baseTime = 10 * 60 * 60;

  function createDiaTime(stop: DeepReadonly<RailwayLineStop>, index: number, maxStopLength: number): DiaTime {
    return {
      diaTimeId: generateId(),
      arrivalTime: index === 0 ? null : currentTime,
      departureTime: index === maxStopLength - 1 ? null : currentTime + 1,
      isPassing: false,
      stationId: stop.platform.stationId,
      platformId: stop.platform.platformId,
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

  const stationIds = preStops.map((stop) => stop.platform.stationId);

  const inboundTrains: Train[] = [createTrain(preStops[0], preStops[preStops.length - 1], inboundDiaTimes)];
  const outboundTrains: Train[] = [createTrain(postStops[0], postStops[postStops.length - 1], outboundDiaTimes)];

  const trains = inboundTrains.concat(outboundTrains);

  const timetable: OutlinedTimetable = {
    timetableId: generateId(),
    inboundTrainIds: inboundTrains.map((diaTime) => diaTime.trainId),
    outboundTrainIds: outboundTrains.map((diaTime) => diaTime.trainId),
    operations: checkStationTrackOccupation(trains, stationIds.map((s) => nn(stations.get(s)).platforms).flat())
      .operations,
    railwayLineId: railwayLine.railwayLineId,
    stationIds: stationIds,
    trainTypes: getInitialTrainTypes(),
    inboundIsFirstHalf: true,
  };

  return [timetable, trains];
}

// 足りない駅の時刻を補完する
export function fillMissingTimes(train: Train, stations: StationLike[]): void {
  for (const station of stations) {
    const diaTime = train.diaTimes.find((diaTime) => diaTime.stationId === station.stationId);
    if (diaTime === undefined) {
      train.diaTimes.push({
        diaTimeId: generateId(),
        stationId: station.stationId,
        platformId: null,
        arrivalTime: null,
        departureTime: null,
        isPassing: false,
        isInService: false,
        trackId: null,
      });
    }
  }
}
