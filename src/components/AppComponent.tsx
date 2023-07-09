import { useState } from 'preact/hooks';
import { AppStates, Cell, GameMap, createMapContext } from '../mapEditorModel';
import { DetailedTimetable } from '../model';
import { TimetableEditorComponent } from './timetable-editor/TimetableEditorComponent';
import { SplitViewComponent } from './timetable-editor/common-component';
import { TrackEditorComponent } from './track-editor/TrackEditorComponent';
import { TrainMove2 } from './track-editor/trainMove2';

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

const timetable: DetailedTimetable = {
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
        diaTimes: [],
        trainId: '1',
        trainName: 'A',
        trainCode: '',
      },
      {
        diaTimes: [],
        trainId: '2',
        trainName: 'B',
        trainCode: '',
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
