import { generateId } from '../../model';
import { DiaPlatform, DiaStation, Timetable, TimetableData, TimetableDirection } from './model';
import './timetable-editor.css';

export function getDefaultPlatform(diaStation: DiaStation, direction: TimetableDirection): DiaPlatform {
  const result =
    direction === 'Outbound'
      ? diaStation.diaPlatforms.find(
          (diaPlatform) => diaPlatform.diaPlatformId === diaStation.defaultOutboundDiaPlatformId
        )
      : diaStation.diaPlatforms.find(
          (diaPlatform) => diaPlatform.diaPlatformId === diaStation.defaultInboundDiaPlatformId
        );
  if (result == null) {
    throw new Error('default platform not found');
  }
  return result;
}

export function createNewStation(stationName: string): DiaStation {
  const newPlatforms = [
    {
      diaPlatformId: generateId(),
      diaPlatformName: '1',
    },
    {
      diaPlatformId: generateId(),
      diaPlatformName: '2',
    },
  ];
  const newStation: DiaStation = {
    diaStationId: generateId(),
    diaStationName: stationName,
    diaPlatforms: newPlatforms,
    defaultInboundDiaPlatformId: newPlatforms[0].diaPlatformId,
    defaultOutboundDiaPlatformId: newPlatforms[1].diaPlatformId,
  };

  return newStation;
}

export function getInitialTimetable(): TimetableData {
  const diaStations: DiaStation[] = [createNewStation('東京'), createNewStation('横浜')];

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
    diaStations: diaStations,
  };

  return { timetable };
}
