import { useEffect, useState } from 'preact/hooks';
import { AppStates, Cell, GameMap, createMapContext } from '../mapEditorModel';
import { DetailedTimetable } from '../model';
import { Polygon, sat } from '../sat';
import { ExtendedCell } from './extendedMapModel';
import { SplitViewComponent } from './timetable-editor/common-component';
import { TimetableEditorComponent } from './timetable-editor/timetable-editor-component';
import { getInitialTimetable } from './timetable-editor/timetable-util';
import { ToastComponent } from './toast';
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
  platformTTItems: [],
  switchTTItems: [],
};

const defaultMapWidth = 100;
const defaultMapHeight = 20;

export function getInitialAppStates(): AppStates {
  const gameMap = initializeMap(defaultMapWidth, defaultMapHeight);
  const extendedMap = initializeExtendedMap(defaultMapWidth, defaultMapHeight);
  const timetableData = getInitialTimetable();
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
  return {
    editMode: 'Create',
    globalTimeManager: new GlobalTimeManager(),
    detailedTimetable: timetable,
    timetableData: timetableData,
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
  };
}

export function App() {
  const [appStates, setAppStates] = useState<AppStates>(() => getInitialAppStates());

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
            component: () => <TrackEditorComponent appStates={appStates} setAppStates={setAppStates} />,
          },
          {
            splitViewId: 2,
            component: () => <TimetableEditorComponent appStates={appStates} setAppStates={setAppStates} />,
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
