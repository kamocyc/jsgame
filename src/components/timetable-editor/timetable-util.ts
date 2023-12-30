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
): string {
  const { preStops, postStops } = splitStops(railwayLine.stops, nn(railwayLine.returnStopId));

  const stops = firstHalfOrLastHalf === 'First' ? preStops : postStops;
  const stop = stops.find((stop) => stop.platform.stationId === stationId);
  assert(stop !== undefined);

  return stop.platform.platformId;
}

export function getPlatformIdAndTrackId(
  railwayLine: DeepReadonly<RailwayLine>,
  stationId: string,
  timetableDirection: TimetableDirection,
  inboundIsFirstHalf: boolean
) {
  const platformId = getRailwayPlatform(railwayLine, stationId, getFirstOrLast(timetableDirection, inboundIsFirstHalf));
  const stop = railwayLine.stops.find((stop) => stop.platform.platformId === platformId);
  assert(stop !== undefined);

  return {
    platformId: platformId,
    trackId: stop.platformTrack.trackId,
  };
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
  diaTimes: DiaTime[],
  trainCode: string
): Train {
  const trainId = generateId();
  return {
    trainId: trainId,
    trainType: undefined,
    trainName: '',
    trainCode: trainCode,
    diaTimes: diaTimes,
    firstStationOperation: {
      stationOperationType: 'InOut',
      stationId: diaTimes[0].stationId,
      platformId: nn(diaTimes[0].platformId),
      trackId: firstStop.platformTrack?.trackId,
      operationTime: nn(diaTimes[0].departureTime),
    },
    lastStationOperation: {
      stationOperationType: 'InOut',
      stationId: diaTimes[diaTimes.length - 1].stationId,
      platformId: nn(diaTimes[diaTimes.length - 1].platformId),
      trackId: lastStop.platformTrack?.trackId,
      operationTime: nn(diaTimes[diaTimes.length - 1].arrivalTime) + 60,
    },
  };
}

function showStops(stops: DeepReadonly<RailwayLineStop[]>) {
  return stops.map((stop) => stop.platform.stationId).join(' ');
}

// 路線から初期のダイヤを作成する
export function getInitialTimetable(
  stations: DeepReadonly<Map<string, StationLike>>,
  railwayLine: DeepReadonly<RailwayLine>
): [OutlinedTimetable, Train[]] {
  const baseTime = 10 * 60 * 60;

  function createDiaTime(stop: DeepReadonly<RailwayLineStop>, index: number, maxStopLength: number): DiaTime {
    return {
      diaTimeId: generateId(),
      arrivalTime: index === 0 ? null : currentTime,
      departureTime: index === maxStopLength - 1 ? null : currentTime + 60,
      isPassing: false,
      stationId: stop.platform.stationId,
      platformId: stop.platform.platformId,
      trackId: stop.platformTrack?.trackId,
      isInService: true,
    };
  }

  const { preStops, postStops } = splitStops(railwayLine.stops, nn(railwayLine.returnStopId));

  console.log({ stops: showStops(railwayLine.stops), preStops: showStops(preStops), postStops: showStops(postStops) });

  let currentTime: number;
  let inboundDiaTimes: DiaTime[];
  let outboundDiaTimes: DiaTime[];
  {
    currentTime = baseTime;
    inboundDiaTimes = preStops.map((stop, index) => {
      const newDiaTime = createDiaTime(stop, index, preStops.length);
      const platformPaths = preStops[index]?.platformPaths;
      if (index !== preStops.length - 1) {
        if (platformPaths != null) {
          currentTime += platformPaths.length * 0.5 * 60;
        } else {
          currentTime += 180;
        }
      }
      return newDiaTime;
    });
  }
  {
    currentTime = baseTime;
    outboundDiaTimes = postStops.map((stop, index) => {
      const newDiaTime = createDiaTime(stop, index, postStops.length);
      const platformPaths = postStops[index + 1]?.platformPaths;
      if (index !== postStops.length - 1) {
        if (platformPaths != null) {
          currentTime += platformPaths.length * 0.5 * 60;
        } else {
          currentTime += 180;
        }
      }
      return newDiaTime;
    });
  }

  const stationIds = preStops.map((stop) => stop.platform.stationId);

  const inboundTrains: Train[] = [createTrain(preStops[0], preStops[preStops.length - 1], inboundDiaTimes, '001M')];
  const outboundTrains: Train[] = [
    createTrain(postStops[0], postStops[postStops.length - 1], outboundDiaTimes, '002M'),
  ];

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

// 足りない駅の時刻を補完と削除する stationIdsを正とする
export function fillMissingTimes(diaTimes: DeepReadonly<DiaTime[]>, stationIds: DeepReadonly<string[]>) {
  const newDiaTimes: DiaTime[] = [];
  for (const stationId of stationIds) {
    const diaTime = diaTimes.find((diaTime) => diaTime.stationId === stationId);
    if (diaTime !== undefined) {
      newDiaTimes.push(diaTime);
    } else {
      newDiaTimes.push({
        diaTimeId: generateId(),
        arrivalTime: null,
        departureTime: null,
        isPassing: false,
        stationId: stationId,
        platformId: null,
        trackId: null,
        isInService: true,
      });
    }
  }

  return newDiaTimes;
}
