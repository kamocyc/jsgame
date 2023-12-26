import React, { useEffect } from 'react';
import { AppStates, RailwayLine, RailwayLineStop } from '../mapEditorModel';
import { StationLike, Train } from '../model';
import { HistoryManager, OutlinedTimetableData } from '../outlinedTimetableData';
import { getStationMap } from './timetable-editor/common-component';
import { TimetableEditorParentComponent } from './timetable-editor/timetable-editor-parent-component';
import { getInitialTimetable } from './timetable-editor/timetable-util';

// サーバに置く
// outlineTimetableData
// railwayLines

const domain = 'http://localhost:3000';

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    mode: 'cors',
  });
  if (response.ok) {
    return response.json() as T;
  } else {
    throw new Error(response.statusText);
  }
}

// stopsのtrackIdはnullでいい
export function TimetableEditorAppContainer({ setToastMessage }: { setToastMessage: (message: string) => void }) {
  const timetableData: OutlinedTimetableData = {
    _errors: [],
    _timetables: [],
    _trains: new Map<string, Train>(),
  };

  const [appStates, setAppStates] = React.useState<Omit<AppStates, 'mapState'>>({
    outlinedTimetableData: timetableData,
    railwayLines: [],
    selectedRailwayLineId: null,
    historyManager: new HistoryManager(),
  });
  const [stations, setStations] = React.useState<StationLike[]>([]);

  useEffect(() => {
    (async () => {
      if (appStates.outlinedTimetableData._timetables.length === 0) {
        const railwayLinesWeb = await fetchJson<RailwayLine[] | null>(domain + '/railway_lines.json');
        const timetableDataWeb = await fetchJson<OutlinedTimetableData | null>(domain + '/timetable_data.json');
        const stationsWeb = await fetchJson<StationLike[] | null>(domain + '/stations.json');

        const stations: StationLike[] =
          stationsWeb !== null && stationsWeb.length >= 2
            ? stationsWeb
            : [
                {
                  stationId: '20',
                  stationName: '品川',
                  stationType: 'Station',
                  platforms: [
                    {
                      platformId: '21',
                      platformName: '1',
                      platformType: 'Platform',
                      stationId: '20',
                    },
                  ],
                },
                {
                  stationId: '22',
                  stationName: '横浜',
                  stationType: 'Station',
                  platforms: [
                    {
                      platformId: '23',
                      platformName: '1',
                      platformType: 'Platform',
                      stationId: '22',
                    },
                  ],
                },
              ];

        const stops = stations
          .map((station) => ({
            stopId: '1' + station.stationId,
            platform: {
              platformId: station.platforms[0].platformId,
              stationId: station.stationId,
            },
          }))
          .concat(
            stations
              .filter((_, i) => i !== 0 && i !== stations.length - 1)
              .map((station) => ({
                stopId: '2' + station.stationId,
                platform: {
                  platformId: station.platforms[0].platformId,
                  stationId: station.stationId,
                },
              }))
          ) as RailwayLineStop[];

        const railwayLines =
          railwayLinesWeb !== null && railwayLinesWeb.length > 0
            ? railwayLinesWeb
            : [
                {
                  railwayLineId: '1',
                  railwayLineName: '路線１',
                  railwayLineColor: '#000000',
                  stops: stops,
                  returnStopId: stops[stations.length - 1].stopId,
                },
              ];

        const timetableData: OutlinedTimetableData =
          timetableDataWeb !== null && timetableDataWeb._timetables.length > 0
            ? timetableDataWeb
            : ((): OutlinedTimetableData => {
                const [outlinedTimetable, trains] = getInitialTimetable(getStationMap(stations), railwayLines[0]);
                return {
                  _errors: [],
                  _timetables: [outlinedTimetable],
                  _trains: new Map(trains.map((train) => [train.trainId, train])),
                };
              })();

        setStations(stations);
        setAppStates({
          outlinedTimetableData: timetableData,
          railwayLines: railwayLines,
          selectedRailwayLineId: railwayLines[0].railwayLineId,
          historyManager: new HistoryManager(),
        });
      }
    })();
  }, []);

  return (
    <>
      <TimetableEditorParentComponent
        appStates={appStates}
        stations={stations}
        defaultSelectedRailwayLineId={appStates.selectedRailwayLineId}
        setAppStates={setAppStates}
        applyDetailedTimetable={async () => {
          const timetables = await fetch(domain + '/timetable_data.json', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(appStates.outlinedTimetableData),
            mode: 'cors',
          }).then((response) => {
            if (response.ok) {
              return response.json();
            } else {
              throw new Error(response.statusText);
            }
          });

          if (timetables?.errors?.length && timetables.errors.length > 0) {
            setToastMessage(timetables.errors[0].message);
          } else {
            setToastMessage('保存しました');
          }
        }}
        setToast={setToastMessage}
      />
    </>
  );
}
