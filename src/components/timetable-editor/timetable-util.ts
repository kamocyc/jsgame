import { Platform, Station, generateId } from '../../model';
import { Timetable, TimetableData, TimetableDirection } from './model';
import './timetable-editor.css';

export function getDefaultPlatform(diaStation: Station, direction: TimetableDirection): Platform {
  const result =
    direction === 'Outbound'
      ? diaStation.platforms.find((diaPlatform) => diaPlatform.platformId === diaStation.defaultOutboundDiaPlatformId)
      : diaStation.platforms.find((diaPlatform) => diaPlatform.platformId === diaStation.defaultInboundDiaPlatformId);
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
    defaultInboundDiaPlatformId: newPlatforms[0].platformId,
    defaultOutboundDiaPlatformId: newPlatforms[1].platformId,
  };
  newPlatforms[0].station = newStation;
  newPlatforms[1].station = newStation;

  return newStation;
}

export function getInitialTimetable(): TimetableData {
  const diaStations: Station[] = [createNewStation('東京'), createNewStation('横浜')];

  const timetable: Timetable = {
    inboundDiaTrains: [
      {
        diaTrainId: generateId(),
        diaTimes: [
          {
            diaTimeId: generateId(),
            arrivalTime: null,
            departureTime: 7 * 60 * 60,
            isPassing: false,
            diaStation: diaStations[0],
            diaPlatform: getDefaultPlatform(diaStations[0], 'Inbound'),
          },
          {
            diaTimeId: generateId(),
            arrivalTime: 8 * 60 * 60,
            departureTime: null,
            isPassing: false,
            diaStation: diaStations[1],
            diaPlatform: getDefaultPlatform(diaStations[1], 'Inbound'),
          },
        ],
      },
    ],
    outboundDiaTrains: [
      {
        diaTrainId: generateId(),
        diaTimes: [
          {
            diaTimeId: generateId(),
            arrivalTime: null,
            departureTime: 7 * 60 * 60 + 30 * 60,
            isPassing: false,
            diaStation: diaStations[1],
            diaPlatform: getDefaultPlatform(diaStations[1], 'Outbound'),
          },
          {
            diaTimeId: generateId(),
            arrivalTime: 8 * 60 * 60 + 30 * 60,
            departureTime: null,
            isPassing: false,
            diaStation: diaStations[0],
            diaPlatform: getDefaultPlatform(diaStations[0], 'Outbound'),
          },
        ],
      },
    ],
    stations: diaStations,
  };

  return { timetable };
}
