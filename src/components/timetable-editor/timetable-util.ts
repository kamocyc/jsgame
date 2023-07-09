import {
  DefaultStationDistance,
  Platform,
  Station,
  Timetable,
  TimetableData,
  TimetableDirection,
  generateId,
} from '../../model';
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

export function getInitialTimetable(): TimetableData {
  const diaStations: Station[] = [createNewStation('東京'), createNewStation('横浜')];

  const timetable: Timetable = {
    inboundTrains: [
      {
        trainId: generateId(),
        trainName: '001M',
        diaTimes: [
          {
            diaTimeId: generateId(),
            arrivalTime: null,
            departureTime: 7 * 60 * 60,
            isPassing: false,
            station: diaStations[0],
            platform: getDefaultPlatform(diaStations[0], 'Inbound'),
          },
          {
            diaTimeId: generateId(),
            arrivalTime: 8 * 60 * 60,
            departureTime: null,
            isPassing: false,
            station: diaStations[1],
            platform: getDefaultPlatform(diaStations[1], 'Inbound'),
          },
        ],
        trainCode: '',
      },
    ],
    outboundTrains: [
      {
        trainId: generateId(),
        trainName: '002M',
        diaTimes: [
          {
            diaTimeId: generateId(),
            arrivalTime: null,
            departureTime: 7 * 60 * 60 + 30 * 60,
            isPassing: false,
            station: diaStations[1],
            platform: getDefaultPlatform(diaStations[1], 'Outbound'),
          },
          {
            diaTimeId: generateId(),
            arrivalTime: 8 * 60 * 60 + 30 * 60,
            departureTime: null,
            isPassing: false,
            station: diaStations[0],
            platform: getDefaultPlatform(diaStations[0], 'Outbound'),
          },
        ],
        trainCode: '',
      },
    ],
    stations: diaStations,
    trainTypes: [],
  };

  return { timetable };
}
