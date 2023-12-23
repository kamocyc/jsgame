import { produce } from 'immer';
import { useEffect, useState } from 'react';
import { StateUpdater } from '../../common';
import { JSON_decycle } from '../../cycle';
import { loadCustomFile } from '../../file';
import { AppStates, OperationError } from '../../mapEditorModel';
import { PlatformLike } from '../../model';
import { OutlinedTimetableData, OutlinedTimetableFunc } from '../../outlinedTimetableData';
import { createAgentManager } from '../track-editor/agentManager';
import { toDetailedTimetable } from '../track-editor/timetableConverter';
import { createTrainMove } from '../track-editor/trainMoveBase';
import { MapInfo } from './common-component';
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
  defaultSelectedRailwayLineId,
  setAppStates,
  setToast,
}: {
  appStates: AppStates;
  defaultSelectedRailwayLineId: string | null;
  setAppStates: StateUpdater<AppStates>;
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
        OutlinedTimetableFunc.updateOperations(d);
      },
      (patches, inversePatches) => {
        appStates.historyManager.push(patches, inversePatches);
      }
    );
    appStates.outlinedTimetableData = newTimetableData;

    // TODO: UIに表示する
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
              // @ts-ignore
              const diagram = await loadCustomFile(event);
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
            const platforms = appStates.map
              .map((row) =>
                row
                  .filter((cell) => cell.lineType)
                  .map((cell) => cell.lineType?.tracks)
                  .flat()
                  .map((track) => track?.track.platform)
              )
              .flat()
              .filter((p) => p);
            const timetableAndOperations = toDetailedTimetable(
              platforms as PlatformLike[],
              appStates.outlinedTimetableData,
              appStates.tracks,
              appStates.railwayLines
            );

            if (timetableAndOperations === null) {
              return;
            }

            // console.log('timetable');
            // console.log(timetable);

            const trainMove = createTrainMove();
            setAppStates((appStates) => ({
              ...appStates,
              trainMove: trainMove,
              agentManager: createAgentManager(),
              detailedTimetable: timetableAndOperations,
            }));
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
              const railwayLine = appStates.railwayLines.find(
                (railwayLine) => railwayLine.railwayLineId === e.currentTarget.value
              );
              // if (railwayLine != null) {
              //   update();
              // }
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
            timetableData={appStates.outlinedTimetableData}
            setTimetableData={setTimetableData}
            timetable={selectedTimetable}
            mapInfo={new MapInfo(appStates.tracks)}
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
