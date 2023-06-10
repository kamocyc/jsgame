import { StateUpdater, useState } from 'preact/hooks';
import { Switch } from '../model';
import { EditorMode, Station, Timetable, Train } from '../uiEditorModel';
import { StationEditor, SwitchEditor } from './stationEditor';

export const globalObject = {
  editorMode: null as EditorMode | null,
  timetable: null as Timetable | null,
  trains: null as Train[] | null,
  station: null as Station | null,
  Switch: null as Switch | null,
  setUpdate: null as StateUpdater<never[]> | null,
};

export function App() {
  const [_, setUpdate_] = useState([]);
  globalObject.setUpdate = setUpdate_;
  const { editorMode, timetable, trains, station, Switch } = globalObject;

  return (
    <>
      {timetable !== null && trains !== null ? (
        <div style={{ borderStyle: 'solid', borderWidth: '1px' }}>
          {editorMode === 'StationEditor' ? (
            <StationEditor timetable={timetable} station={station!} trains={trains} />
          ) : editorMode === 'SwitchEditor' ? (
            <SwitchEditor timetable={timetable} Switch={Switch!} trains={trains} />
          ) : (
            <></>
          )}
        </div>
      ) : (
        <></>
      )}
    </>
  );
}
