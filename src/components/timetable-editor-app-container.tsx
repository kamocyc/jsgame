import { produce } from 'immer';
import { useEffect, useState } from 'react';
import { DeepReadonly } from 'ts-essentials';
import { nn } from '../common';
import { AppStates, RailwayLine, RailwayLineStop } from '../mapEditorModel';
import { StationLike, Train } from '../model';
import { HistoryManager, OutlinedTimetable, OutlinedTimetableData } from '../outlinedTimetableData';
import { getStationMap } from './timetable-editor/common-component';
import { StationEditorListEntryComponent } from './timetable-editor/station-edit-component';
import { TimetableEditorParentComponent } from './timetable-editor/timetable-editor-parent-component';
import { getInitialTimetable } from './timetable-editor/timetable-util';
import { checkStationTrackOccupation } from './track-editor/checkOperation';

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

async function loadDataFromLocalStorage() {
  const jsonData = localStorage.getItem('timetableEditorStandalone');
  if (jsonData) {
    const data = JSON.parse(jsonData) as {
      stationMap: { [key: string]: StationLike };
      outlinedTimetableDataToSave: {
        _timetables: OutlinedTimetable[];
        _trains: Train[];
      };
    };
    const timetableData = data.outlinedTimetableDataToSave;
    const appStates: Omit<AppStates, 'mapState'> = {
      outlinedTimetableData: {
        _errors: [],
        _timetables: timetableData._timetables,
        _trains: new Map(Object.keys(timetableData._trains).map((k) => [k, timetableData._trains[k as any]])),
      },
      railwayLines: await getRailwayLines(),
      selectedRailwayLineId: '__DUMMY__',
      historyManager: new HistoryManager(),
    };
    return {
      appStates: appStates,
      stationMap: new Map(Object.entries(data.stationMap)),
    };
  } else {
    const { stationMap, appStates } = await loadData();
    return { stationMap, appStates };
  }
}

async function getRailwayLines(): Promise<RailwayLine[]> {
  const railwayLinesWeb = await fetchJson<RailwayLine[] | null>(domain + '/railway_lines.json');

  const railwayLines =
    railwayLinesWeb !== null && railwayLinesWeb.length > 0
      ? railwayLinesWeb
      : [
          {
            railwayLineId: '__DUMMY__',
            railwayLineName: '路線1',
            railwayLineColor: '#000000',
            stops: [
              {
                stopId: '120',
                platform: { platformId: '21', stationId: '20' },
              },
              {
                stopId: '122',
                platform: { platformId: '23', stationId: '22' },
              },
            ] as RailwayLineStop[],
            returnStopId: '122',
          },
        ];

  return railwayLines;
}

async function loadData() {
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
            defaultInboundPlatformId: '21',
            defaultOutboundPlatformId: '21',
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
            defaultInboundPlatformId: '23',
            defaultOutboundPlatformId: '23',
          },
        ];

  const railwayLines = await getRailwayLines();
  const stationMap = getStationMap(stations);

  const timetableData: OutlinedTimetableData =
    timetableDataWeb !== null && timetableDataWeb._timetables.length > 0
      ? timetableDataWeb
      : ((): OutlinedTimetableData => {
          const [outlinedTimetable, trains] = getInitialTimetable(stationMap, railwayLines[0]);
          return {
            _errors: [],
            _timetables: [outlinedTimetable],
            _trains: new Map(trains.map((train) => [train.trainId, train])),
          };
        })();

  return {
    stationMap,
    appStates: {
      outlinedTimetableData: timetableData,
      railwayLines: railwayLines,
      selectedRailwayLineId: railwayLines[0].railwayLineId,
      historyManager: new HistoryManager(),
    },
  };
}

type AppStateBag = {
  appStates: Omit<AppStates, 'mapState'>;
  stationMap: DeepReadonly<Map<string, StationLike>>;
};

// stopsのtrackIdはnullでいい
export function TimetableEditorAppContainer({ setToastMessage }: { setToastMessage: (message: string) => void }) {
  const timetableData: OutlinedTimetableData = {
    _errors: [],
    _timetables: [],
    _trains: new Map<string, Train>(),
  };

  // const [appStates, setAppStates] = useState<Omit<AppStates, 'mapState'>>();
  // const [stations, setStations] = useState<DeepReadonly<StationLike[]>>([]);
  const [appStateBag, setAppStateBag] = useState<AppStateBag>({
    appStates: {
      outlinedTimetableData: timetableData,
      railwayLines: [],
      selectedRailwayLineId: null,
      historyManager: new HistoryManager(),
    },
    stationMap: new Map<string, StationLike>(),
  });

  const { appStates, stationMap } = appStateBag;

  function setStations(stationMap: DeepReadonly<Map<string, StationLike>>) {
    setAppStateBag((d) => ({
      appStates: d.appStates,
      stationMap: stationMap,
    }));
  }

  function setAppStates(updater: (appStates: Omit<AppStates, 'mapState'>) => Omit<AppStates, 'mapState'>) {
    setAppStateBag((d) => ({
      appStates: updater(d.appStates),
      stationMap: d.stationMap,
    }));
  }

  useEffect(() => {
    (async () => {
      if (appStates.outlinedTimetableData._timetables.length === 0) {
        const { stationMap, appStates } = await loadDataFromLocalStorage();
        const platforms = [...stationMap.values()].map((station) => station.platforms).flat();
        const { errors } = checkStationTrackOccupation(
          [...appStates.outlinedTimetableData._trains.entries()].map(([k, v]) => v),
          platforms
        );
        appStates.outlinedTimetableData._errors = errors;
        setStations(stationMap);
        setAppStates((_) => appStates);
      }
    })();
  }, []);

  if (
    appStates.outlinedTimetableData._timetables.length == 0 ||
    stationMap.size !== appStates.outlinedTimetableData._timetables[0].stationIds.length
  ) {
    return <></>;
  } else {
    return (
      <>
        <StationEditorListEntryComponent
          stationIds={appStates.outlinedTimetableData._timetables[0].stationIds}
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
            setStations(newTimetable.stations);

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
        />
        <TimetableEditorParentComponent
          appStates={appStates}
          stationMap={stationMap}
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
}
