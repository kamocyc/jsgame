import { produce } from 'immer';
import { useEffect, useState } from 'react';
import { RecoilRoot } from 'recoil';
import { DeepReadonly } from 'ts-essentials';
import { mapToObject } from '../../common';
import { JSON_decycle } from '../../cycle';
import { loadCustomFile } from '../../file';
import { AppStates } from '../../mapEditorModel';
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
  stationMap,
  defaultSelectedRailwayLineId,
  applyDetailedTimetable,
  setAppStates,
  setToast,
}: {
  appStates: Omit<AppStates, 'mapState'>;
  stationMap: DeepReadonly<Map<string, StationLike>>;
  defaultSelectedRailwayLineId: string | null;
  applyDetailedTimetable: () => void;
  setAppStates: (f: (data: Omit<AppStates, 'mapState'>) => Omit<AppStates, 'mapState'>) => void;
  setToast: (toast: string) => void;
}) {
  const [selectedRailwayLineId, setSelectedRailwayLineId] = useState<string | null>(defaultSelectedRailwayLineId);

  useEffect(() => {
    if (selectedRailwayLineId == null && appStates.railwayLines[0] !== undefined) {
      setSelectedRailwayLineId(appStates.railwayLines[0].railwayLineId);
    }
  });

  const selectedTimetable = appStates.outlinedTimetableData._timetables.find(
    (timetable) =>
      timetable.railwayLineId === selectedRailwayLineId ||
      (defaultSelectedRailwayLineId === '__DUMMY__' && timetable.railwayLineId === defaultSelectedRailwayLineId)
  );

  const update = () => {
    setAppStates((appStates) => ({
      ...appStates,
    }));
  };

  const setTimetableData: (f: (draftTimetableData: OutlinedTimetableData) => void) => void = (
    timetableDataFunction: (oldTimetableData: OutlinedTimetableData) => void
  ) => {
    const newTimetableData = produce(
      appStates.outlinedTimetableData,
      (d) => {
        timetableDataFunction(d);
        OutlinedTimetableFunc.updateOperations(d, stationMap);
      },
      (patches, inversePatches) => {
        appStates.historyManager.push(patches, inversePatches);
      }
    );
    appStates.outlinedTimetableData = newTimetableData;

    update();
  };

  const railwayLine = appStates.railwayLines.find(
    (railwayLine) =>
      railwayLine.railwayLineId === selectedRailwayLineId ||
      (defaultSelectedRailwayLineId === '__DUMMY__' && railwayLine.railwayLineId === defaultSelectedRailwayLineId)
  );

  return (
    <RecoilRoot>
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
            function convertOutlinedTimetableDataToSave(outlinedTimetableData: DeepReadonly<OutlinedTimetableData>) {
              return {
                _trains: mapToObject(outlinedTimetableData._trains),
                _timetables: outlinedTimetableData._timetables,
                _error: outlinedTimetableData._errors,
              };
            }
            const data = {
              outlinedTimetableDataToSave: convertOutlinedTimetableDataToSave(appStates.outlinedTimetableData),
              stationMap: mapToObject(stationMap),
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
            stationMap={stationMap}
            timetableData={appStates.outlinedTimetableData}
            setTimetableData={setTimetableData}
            timetable={selectedTimetable}
            setToast={setToast}
            errors={appStates.outlinedTimetableData._errors}
          />
        ) : (
          <></>
        )}
      </>
    </RecoilRoot>
  );
}

// immer
// patchを使った方式にする。
// その方が人間が把握しやすそう
// operationがかさばるので、差分が無いときは更新しないようにする
