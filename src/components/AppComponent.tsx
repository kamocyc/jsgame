import { useState } from 'preact/hooks';
import { AppStates, Cell, GameMap, createMapContext } from '../mapEditorModel';
import { DetailedTimetable } from '../model';
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
  const timetableData = new OutlinedTimetableData(new HistoryManager());
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
  const trainMove = createTrainMove(timetable);
  const errors = timetableData.updateOperations();
  return {
    editMode: 'Create',
    globalTimeManager: new GlobalTimeManager(),
    detailedTimetable: timetable,
    outlinedTimetableData: timetableData,
    storedTrains: storedTrains,
    showInfo: true,
    trainPlaceDirection: 'Up',
    map: gameMap,
    mapWidth: defaultMapWidth,
    mapHeight: defaultMapHeight,
    mapContext: createMapContext(defaultMapWidth, defaultMapHeight),
    extendedMap: extendedMap,
    shouldAutoGrow: true,
    trainMove: trainMove,
    agentManager: createAgentManager(),
    switches: [],
    stations: [],
    tracks: [],
    message: null,
    currentRailwayLine: null,
    railwayLines: [],
    selectedRailwayLineId: null,
    moneyManager: new MoneyManager(),
    mapManager: new MapManager(),
    errors: errors,
  };
}

export function App() {
  const [appStates, setAppStates] = useState<AppStates>(() => getInitialAppStates());
  const setToast = (message: string) => {
    console.warn({ setToast: message });
    appStates.message = message;
    setAppStates((prev) => {
      return {
        ...prev,
        message,
      };
    });

    // なぜか効いていないのでコメントアウト
    // setTimeout(() => {
    //   appStates.message = '';
    //   update();
    // }, 3000);
  };

  return (
    <>
      <ToastComponent
        message={appStates.message}
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
              <TrackEditorComponent appStates={appStates} setAppStates={setAppStates} setToast={setToast} />
            ),
          },
          {
            splitViewId: 2,
            component: () => (
              <TimetableEditorParentComponent
                appStates={appStates}
                defaultSelectedRailwayLineId={appStates.selectedRailwayLineId}
                setAppStates={setAppStates}
                setToast={setToast}
              />
            ),
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
