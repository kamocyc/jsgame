import { useState } from 'preact/hooks';
import { Cell, GameMap } from '../mapEditorModel';
import { TimetableEditorComponent } from './timetable-editor/TimetableEditorComponent';
import { SplitViewComponent } from './timetable-editor/common-component';
import { TrackEditorComponent } from './track-editor/TrackEditorComponent';
import { TrainMove2 } from './track-editor/trainMove2';
import { AppStates, Timetable, createMapContext } from './track-editor/uiEditorModel';

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

const timetable: Timetable = {
  platformTTItems: [],
  switchTTItems: [],
};

const defaultMapWidth = 40;
const defaultMapHeight = 10;

export function App() {
  const [appStates, setAppStates] = useState<AppStates>(() => ({
    editMode: 'Create',
    timetable: timetable,
    trains: [
      {
        trainId: '1',
        trainName: 'A',
        color: 'red',
        trainTimetable: [],
      },
      {
        trainId: '2',
        trainName: 'B',
        color: 'black',
        trainTimetable: [],
      },
    ],
    map: initializeMap(defaultMapWidth, defaultMapHeight),
    mapWidth: defaultMapWidth,
    mapHeight: defaultMapHeight,
    mapContext: createMapContext(defaultMapWidth, defaultMapHeight),
    trainMove: new TrainMove2(timetable),
    switches: [],
    stations: [],
    tracks: [],
  }));

  return (
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
      ]}
    />
  );
}
