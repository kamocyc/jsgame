import { produce } from 'immer';
import React, { useEffect } from 'react';
import { DeepReadonly } from 'ts-essentials';
import { nn } from '../common';
import { AppStates, RailwayLine, RailwayLineStop } from '../mapEditorModel';
import { StationLike, Train } from '../model';
import { HistoryManager, OutlinedTimetableData } from '../outlinedTimetableData';
import { getStationMap } from './timetable-editor/common-component';
import { StationEditListComponent } from './timetable-editor/station-edit-component';
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

async function loadData() {
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

  return {
    stations,
    appStates: {
      outlinedTimetableData: timetableData,
      railwayLines: railwayLines,
      selectedRailwayLineId: railwayLines[0].railwayLineId,
      historyManager: new HistoryManager(),
    },
  };
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
  const [stations, setStations] = React.useState<DeepReadonly<StationLike[]>>([]);

  useEffect(() => {
    (async () => {
      if (appStates.outlinedTimetableData._timetables.length === 0) {
        const { stations, appStates } = await loadData();
        setStations(stations);
        setAppStates(appStates);
      }
    })();
  }, []);

  const stationMap = getStationMap(stations);

  return (
    <>
      <StationEditListComponent
        stationIds={stations.map((s) => s.stationId)}
        setTimetable={(timetableUpdater) => {
          const timetable = appStates.outlinedTimetableData._timetables[0];
          const trainsBag = {
            trains: timetable.inboundTrainIds.map((id) => nn(appStates.outlinedTimetableData._trains.get(id))),
            otherDirectionTrains: timetable.outboundTrainIds.map((id) =>
              nn(appStates.outlinedTimetableData._trains.get(id))
            ),
          };
          const newTimetable = produce(
            {
              outlinedTimetable: appStates.outlinedTimetableData._timetables[0],
              trainsBag: trainsBag,
              stations: stationMap,
            },
            (draft) => {
              timetableUpdater(draft.outlinedTimetable, draft.trainsBag, draft.stations);
            }
          );
          setStations([...newTimetable.stations.entries()].map(([_, station]) => station));

          setAppStates((appStates) => ({
            ...appStates,
            outlinedTimetableData: {
              _errors: appStates.outlinedTimetableData._errors,
              _trains: new Map(
                newTimetable.trainsBag.trains
                  .concat(newTimetable.trainsBag.otherDirectionTrains)
                  .map((train) => [train.trainId, train])
              ),
              _timetables: [newTimetable.outlinedTimetable],
            },
          }));
        }}
        stations={stationMap}
        setSettingData={() => {}}
      />
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
