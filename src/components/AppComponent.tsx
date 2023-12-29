import { useState } from 'react';
import { assert } from 'ts-essentials';
import { AppStates, Cell, GameMap, MapState, createMapContext } from '../mapEditorModel';
import { DetailedTimetable, PlatformLike, Train } from '../model';
import { HistoryManager, OutlinedTimetableData } from '../outlinedTimetableData';
import { ExtendedCell } from './extendedMapModel';
import { SplitViewComponent } from './timetable-editor/common-component';
import { TimetableEditorParentComponent } from './timetable-editor/timetable-editor-parent-component';
import { ToastComponent } from './toast-component';
import { TrackEditorComponent } from './track-editor/TrackEditorComponent';
import { createAgentManager } from './track-editor/agentManager';
import { GlobalTimeManager } from './track-editor/globalTimeManager';
import { MapManager } from './track-editor/mapManager';
import { MoneyManager } from './track-editor/moneyManager';
import { toDetailedTimetable } from './track-editor/timetableConverter';
import { createTrainMove } from './track-editor/trainMoveBase';

function initializeMap(mapWidth: number, mapHeight: number): GameMap {
  const map: Cell[][] = [];
  for (let x = 0; x < mapWidth; x++) {
    map.push([]);
    for (let y = 0; y < mapHeight; y++) {
      map[x].push({
        position: { x, y },
        lineType: null,
      } as Cell);
    }
  }
  return map;
}

function initializeExtendedMap(mapWidth: number, mapHeight: number): ExtendedCell[][] {
  const map: ExtendedCell[][] = [];
  for (let x = 0; x < mapWidth; x++) {
    map.push([]);
    for (let y = 0; y < mapHeight; y++) {
      map[x].push({
        position: { cx: x, cy: y },
        type: 'None',
        terrain: 'Grass',
      });
    }
  }

  return map;
}

const timetable: DetailedTimetable = {
  platformTimetableMap: new Map(),
  switchTimetableMap: new Map(),
  operations: [],
};

const defaultMapWidth = 100;
const defaultMapHeight = 20;

export function getInitialAppStates(): AppStates {
  const gameMap = initializeMap(defaultMapWidth, defaultMapHeight);
  const extendedMap = initializeExtendedMap(defaultMapWidth, defaultMapHeight);
  const timetableData: OutlinedTimetableData = {
    _errors: [],
    _timetables: [],
    _trains: new Map<string, Train>(),
  };
  const storedTrains = [
    {
      placedTrainId: '1',
      placedTrainName: 'A',
      placedRailwayLineId: null,
    },
    {
      placedTrainId: '2',
      placedTrainName: 'B',
      placedRailwayLineId: null,
    },
  ];
  const trainMove = createTrainMove();
  // const errors = timetableData.updateOperations();
  const mapEditorState: MapState = {
    editMode: 'Create',
    showInfo: true,
    mapWidth: defaultMapWidth,
    mapHeight: defaultMapHeight,
    mapContext: createMapContext(defaultMapWidth, defaultMapHeight),
    extendedMap: extendedMap,
    shouldAutoGrow: true,
    trainMove: trainMove,
    agentManager: createAgentManager(),
    stationMap: new Map(),
    currentRailwayLine: null,
    moneyManager: new MoneyManager(),
    mapManager: new MapManager(),
    detailedTimetable: timetable,
    storedTrains: storedTrains,
    map: gameMap,
    tracks: [],
    globalTimeManager: new GlobalTimeManager(),
  };

  return {
    outlinedTimetableData: timetableData,
    railwayLines: [],
    selectedRailwayLineId: null,
    mapState: mapEditorState,
    historyManager: new HistoryManager(),
  };
}

export function App() {
  const [appStates, setAppStates] = useState<AppStates>(() => getInitialAppStates());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  return (
    <>
      <ToastComponent
        message={toastMessage}
        setMessage={(message) => {
          setAppStates((prev) => {
            return {
              ...prev,
              message,
            };
          });
        }}
      />
      <SplitViewComponent
        splitViews={[
          {
            splitViewId: 1,
            component: () => (
              <TrackEditorComponent appStates={appStates} setAppStates={setAppStates} setToast={setToastMessage} />
            ),
          },
          {
            splitViewId: 2,
            component: () => {
              return (
                <TimetableEditorParentComponent
                  appStates={appStates}
                  stationMap={appStates.mapState.stationMap}
                  applyDetailedTimetable={() => {
                    const platforms = appStates.mapState.tracks
                      .map((track) => track?.track.platform)
                      .flat()
                      .filter((p) => p);
                    const detailedTimetable = toDetailedTimetable(
                      platforms as PlatformLike[],
                      appStates.outlinedTimetableData,
                      appStates.mapState.tracks,
                      appStates.railwayLines
                    );

                    if (detailedTimetable === null) {
                      return;
                    }

                    // console.log('timetable');
                    // console.log(timetable);

                    const trainMove = createTrainMove();
                    const agentManager = createAgentManager();

                    setAppStates((prev) => {
                      return {
                        ...prev,
                        mapState: {
                          ...prev.mapState,
                          trainMove: trainMove,
                          agentManager: agentManager,
                          detailedTimetable: detailedTimetable,
                        },
                      };
                    });
                  }}
                  defaultSelectedRailwayLineId={appStates.selectedRailwayLineId}
                  setAppStates={(arg) => {
                    if (typeof arg === 'function') {
                      setAppStates((prev) => {
                        return {
                          ...prev,
                          ...arg(prev),
                        };
                      });
                    } else {
                      assert(false);
                    }
                  }}
                  setToast={setToastMessage}
                />
              );
            },
          },
          // {
          //   splitViewId: 3,
          //   component: () => <TestComponent />,
          // },
        ]}
      />
    </>
  );
}
