import { StateUpdater, useState } from "preact/hooks";
import { AppStates } from "../../mapEditorModel";
import { TimetableEditorComponent } from "./timetable-editor-component";
import { OutlinedTimetableData } from "../../model";
import { JSON_decycle } from "../../cycle";
import { loadCustomFile } from "../../file";
import { toDetailedTimetable } from "../track-editor/timetableConverter";
import { createTrainMove } from "../track-editor/trainMoveBase";
import { createAgentManager } from "../track-editor/agentManager";

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

export function TimetableEditorParentComponent(
  {
    appStates,
    defaultSelectedRailwayLineId,
    setAppStates,
    setToast,
  }
  : { appStates: AppStates; defaultSelectedRailwayLineId: string | null; setAppStates: StateUpdater<AppStates>; setToast: (toast: string) => void; }) {
  const [selectedRailwayLineId, setSelectedRailwayLineId] = useState<string | null>(defaultSelectedRailwayLineId);
  const selectedTimetable = appStates.outlinedTimetableData.timetables.find((timetable) => timetable.railwayLineId === selectedRailwayLineId);
  const railwayLine = appStates.railwayLines.find((railwayLine) => railwayLine.railwayLineId === selectedRailwayLineId) ?? (appStates.railwayLines.length > 0 ? appStates.railwayLines[0] : null)
  const update = () => {
    setAppStates(appStates => ({
      ...appStates,
    }));
  }

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
              const diagram = await loadCustomFile(event);
              if (diagram != null) {
                appStates.outlinedTimetableData = diagram;
                update(); 
              }
            }}
          />
        </div>
        <button
          onClick={() => {
            const timetableAndOperations = toDetailedTimetable(
              appStates.stations,
              appStates.outlinedTimetableData,
              appStates.tracks
            );

            if (timetableAndOperations === null) {
              return;
            }

            const [timetable, _] = timetableAndOperations;

            // console.log('timetable');
            // console.log(timetable);

            const trainMove = createTrainMove(timetable);
            setAppStates((appStates) => ({
              ...appStates,
              trainMove: trainMove,
              agentManager: createAgentManager(),
              detailedTimetable: timetable,
              // placedTrains: trains, // これは使っているのか？
            }));
          }}
        >
          ⇑詳細ダイヤに反映
        </button>
        </>
      <>
    <span>
    路線:<select
      onChange={(e) => {
        setSelectedRailwayLineId(e.currentTarget.value);
      }}>
      {appStates.railwayLines.map((railwayLine) => (
        <option value={railwayLine.railwayLineId}>{railwayLine.railwayLineName}</option>
      ))}
    </select>
    </span>
    {selectedTimetable !== undefined ? 
    (<TimetableEditorComponent
      railwayLine={railwayLine}
      outlinedTimetableData={appStates.outlinedTimetableData}
      timetable={selectedTimetable}
      tracks={appStates.tracks}
      update={update}
      setOutlinedTimetableData={(timetableData) => {
        setAppStates((prev) => {
          return {
            ...prev,
            timetableData,
          };
        });
      }}
      setToast={setToast}
      />) :
      <></>
    }</>
  </>)
}
