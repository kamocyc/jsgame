import { useState } from 'preact/hooks';
import { Cell, GameMap, MapHeight, MapWidth } from '../mapEditorModel';
import { TimetableEditorComponent } from './timetable-editor/TimetableEditorComponent';
import { SplitViewComponent } from './timetable-editor/common-component';
import { TrackEditorComponent } from './track-editor/TrackEditorComponent';
import { TrainMove2 } from './track-editor/trainMove2';
import { AppStates, Timetable } from './track-editor/uiEditorModel';

function initializeMap(): GameMap {
  const map: Cell[][] = [];
  for (let x = 0; x < MapWidth; x++) {
    map.push([]);
    for (let y = 0; y < MapHeight; y++) {
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
    map: initializeMap(),
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
