import { produce } from 'immer';
import { useEffect, useState } from 'react';
import { DeepReadonly } from 'ts-essentials';
import { StateUpdater } from '../../common';
import { JSON_decycle } from '../../cycle';
import { loadCustomFile } from '../../file';
import { AppStates, OperationError } from '../../mapEditorModel';
import { StationLike } from '../../model';
import { OutlinedTimetableData, OutlinedTimetableFunc } from '../../outlinedTimetableData';
import { TimetableEditorComponent } from './timetable-editor-component';

function saveTimetableDataFile(timetableData: OutlinedTimetableData) {
  const buf = toStringTimeTableData(timetableData);

  const link = document.createElement('a');
  const content = buf;
  const file = new Blob([content], { type: 'application/json' });
  link.href = URL.createObjectURL(file);
  link.download = 'timetable_data.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

function toStringTimeTableData(timetableData: OutlinedTimetableData) {
  const obj = {
    timetableData: timetableData,
  };

  return JSON.stringify(JSON_decycle(obj), null, 2);
}

export function TimetableEditorParentComponent({
  appStates,
  stations,
  defaultSelectedRailwayLineId,
  applyDetailedTimetable,
  setAppStates,
  setToast,
}: {
  appStates: Omit<AppStates, 'mapState'>;
  stations: DeepReadonly<StationLike[]>;
  defaultSelectedRailwayLineId: string | null;
  applyDetailedTimetable: () => void;
  setAppStates: StateUpdater<Omit<AppStates, 'mapState'>>;
  setToast: (toast: string) => void;
}) {
  const [selectedRailwayLineId, setSelectedRailwayLineId] = useState<string | null>(defaultSelectedRailwayLineId);
  const [errors, setErrors] = useState<OperationError[]>([]);

  useEffect(() => {
    if (selectedRailwayLineId == null && appStates.railwayLines[0] !== undefined) {
      setSelectedRailwayLineId(appStates.railwayLines[0].railwayLineId);
    }
  });

  const selectedTimetable = appStates.outlinedTimetableData._timetables.find(
    (timetable) => timetable.railwayLineId === selectedRailwayLineId
  );

  const setTimetableData: (f: (draftTimetableData: OutlinedTimetableData) => void) => void = (
    timetableDataFunction: (oldTimetableData: OutlinedTimetableData) => void
  ) => {
    const newTimetableData = produce(
      appStates.outlinedTimetableData,
      (d) => {
        timetableDataFunction(d);
        OutlinedTimetableFunc.updateOperations(d, stations);
      },
      (patches, inversePatches) => {
        appStates.historyManager.push(patches, inversePatches);
      }
    );
    appStates.outlinedTimetableData = newTimetableData;

    setErrors([...newTimetableData._errors]);
  };

  const railwayLine = appStates.railwayLines.find((railwayLine) => railwayLine.railwayLineId === selectedRailwayLineId);
  const update = () => {
    setAppStates((appStates) => ({
      ...appStates,
    }));
  };

  return (
    <>
      <>
        <button
          onClick={() => {
            saveTimetableDataFile(appStates.outlinedTimetableData);
          }}
        >
          保存
        </button>
        <button
          onClick={() => {
            function mapToObject<V>(map: Map<string, V>) {
              return [...map.entries()].reduce((obj, [key, value]) => {
                // @ts-ignore
                obj[key] = value;
                return obj;
              }, {});
            }
            function convertOutlinedTimetableDataToSave(outlinedTimetableData: OutlinedTimetableData) {
              return {
                _trains: mapToObject(outlinedTimetableData._trains),
                _timetables: outlinedTimetableData._timetables,
                _error: outlinedTimetableData._errors,
              };
            }
            const data = {
              outlinedTimetableDataToSave: convertOutlinedTimetableDataToSave(appStates.outlinedTimetableData),
              stations: stations,
            };
            const jsonData = JSON.stringify(data);
            localStorage.setItem('timetableEditorStandalone', jsonData);
          }}
        >
          保存（localStorage）
        </button>
        <div
          style={{
            display: 'inline-block',
            borderStyle: 'solid',
            borderWidth: '1px',
            padding: '2px',
          }}
        >
          読み込み
          <input
            type='file'
            id='file-selector'
            accept='.json'
            onChange={async (event) => {
              // TODO
              const file = (event.target as HTMLInputElement).files![0];
              const diagram = await loadCustomFile(file);
              if (diagram != null) {
                appStates.outlinedTimetableData = diagram;
                appStates.historyManager.clearHistory();
                update();
              }
            }}
          />
        </div>
        <button
          onClick={() => {
            applyDetailedTimetable();
          }}
        >
          ⇑詳細ダイヤに反映
        </button>
      </>
      <>
        <span>
          路線:
          <select
            onChange={(e) => {
              setSelectedRailwayLineId(e.currentTarget.value);
            }}
          >
            {appStates.railwayLines.map((railwayLine) => (
              <option key={railwayLine.railwayLineId} value={railwayLine.railwayLineId}>
                {railwayLine.railwayLineName}
              </option>
            ))}
          </select>
        </span>
        <button
          onClick={() => {
            appStates.outlinedTimetableData = appStates.historyManager.undo(appStates.outlinedTimetableData);
            update();
          }}
          disabled={!appStates.historyManager.canUndo()}
        >
          undo
        </button>
        <button
          onClick={() => {
            appStates.outlinedTimetableData = appStates.historyManager.redo(appStates.outlinedTimetableData);
            update();
          }}
          disabled={!appStates.historyManager.canRedo()}
        >
          redo
        </button>
        {selectedTimetable !== undefined && railwayLine !== undefined ? (
          <TimetableEditorComponent
            railwayLine={railwayLine}
            stations={stations}
            timetableData={appStates.outlinedTimetableData}
            setTimetableData={setTimetableData}
            timetable={selectedTimetable}
            setToast={setToast}
            errors={errors}
          />
        ) : (
          <></>
        )}
      </>
    </>
  );
}

// immer
// patchを使った方式にする。
// その方が人間が把握しやすそう
// operationがかさばるので、差分が無いときは更新しないようにする
