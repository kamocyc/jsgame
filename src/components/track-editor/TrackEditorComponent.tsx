import { StateUpdater, useEffect, useState } from 'preact/hooks';
import { removeDuplicates } from '../../common';
import { JSON_decycle, JSON_retrocycle } from '../../cycle';
import { loadUtf8File } from '../../file';
import { AppStates, Cell, EditMode, createMapContext } from '../../mapEditorModel';
import { DetailedTimetable, Point, Station, Switch, Train } from '../../model';
import { getInitialAppStates } from '../AppComponent';
import { ConstructType } from '../extendedMapModel';
import { toStringFromSeconds } from '../timetable-editor/common-component';
import { getInitialTimetable } from '../timetable-editor/timetable-util';
import { SeekBarComponent } from './SeekBarComponent';
import { CanvasComponent } from './TrackEditorContainerComponent';
import { SearchPath } from './agentManager';
import { drawEditor } from './trackEditorDrawer';
import { TrainMove2 } from './trainMove2';

export function ModeOptionRadioComponent({
  mode,
  text,
  checked,
  setEditorMode,
}: {
  mode: EditMode;
  text: string;
  checked: boolean;
  setEditorMode: (mode: EditMode) => void;
}) {
  return (
    <label>
      <input
        type='radio'
        value={mode}
        checked={checked}
        onChange={() => {
          setEditorMode(mode);
        }}
      />
      {text}
    </label>
  );
}

interface SerializedPlacedTrain {
  trainId: string;
  train: Train;
  speed: number;
  trackId: string;
  position: Point;
  stationWaitTime: number;
  stationStatus: 'Arrived' | 'Departed' | 'NotArrived';
}

function saveEditorDataLocalStorage(appStates: AppStates) {
  const buf = toStringEditorData(appStates);
  localStorage.setItem('editorData', buf);
}

function saveEditorDataFile(appStates: AppStates) {
  const buf = toStringEditorData(appStates);

  const link = document.createElement('a');
  const content = buf;
  const file = new Blob([content], { type: 'application/json' });
  link.href = URL.createObjectURL(file);
  link.download = 'map_data.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

function toStringEditorData(appStates: AppStates) {
  // if (appStates.detailedTimetable == null) {
  //   return;
  // }
  const obj = {
    map: appStates.map,
    trains: appStates.trains,
    timetable: appStates.detailedTimetable,
    timetableData: appStates.timetableData,
  };

  return JSON.stringify(JSON_decycle(obj), null, 2);
}

function loadEditorDataBuf(buf: string, setAppStates: StateUpdater<AppStates>) {
  const obj = JSON_retrocycle(JSON.parse(buf));

  if (obj['map'] === undefined) {
    alert('マップデータが不正です');
    return;
  }
  const mapData = obj['map'] as Cell[][];
  const mapWidth = mapData.length;
  const mapHeight = mapData[0]?.length;
  if (mapData.some((row) => row.length !== mapHeight)) {
    alert('マップデータが不正です');
    return;
  }
  const trainsJson = obj['trains'] ?? [];
  const timetable = (obj['timetable'] ?? { stationTTItems: [], switchTTItems: [] }) as DetailedTimetable;
  const timetableData = obj['timetableData'] ?? { timetable: getInitialTimetable() };

  const trainMove = new TrainMove2(timetable);
  const switches = mapData.flatMap(
    (row) =>
      row
        .map((cell) => (cell.lineType?.lineClass === 'Branch' ? cell.lineType.switch : null))
        .filter((x) => x != null) as Switch[]
  );
  const tracks = mapData.flatMap((row) =>
    row.map((cell) => cell.lineType?.tracks ?? []).reduce((a, b) => a.concat(b), [])
  );

  const stations = mapData.flatMap((row) =>
    row.flatMap((cell) => cell.lineType?.tracks.map((track) => track.track.platform?.station)).filter((x) => x != null)
  ) as Station[];

  setAppStates((appStates) => ({
    ...appStates,
    map: mapData,
    switches: switches,
    tracks: tracks,
    trainMove: trainMove,
    detailedTimetable: timetable,
    stations: removeDuplicates(stations, (s1, s2) => s1.stationId === s2.stationId),
    mapWidth: mapWidth,
    mapHeight: mapHeight,
    timetableData: timetableData,
    mapContext: createMapContext(mapWidth, mapHeight),
  }));
}

function loadEditorDataLocalStorage(setAppStates: StateUpdater<AppStates>) {
  const data = localStorage.getItem('editorData');
  if (data == null) {
    return;
  }
  loadEditorDataBuf(data, setAppStates);
}

export function TrackEditorComponent({
  appStates,
  setAppStates,
}: {
  appStates: AppStates;
  setAppStates: StateUpdater<AppStates>;
}) {
  const [runningIntervalId, setRunningIntervalId] = useState<number | null>(null);
  const [positionPercentage, setPositionPercentage] = useState<number>(0);
  const [numberOfPlatforms, setNumberOfPlatforms] = useState<number>(2);
  const [_, setUpdate_] = useState<never[]>([]);
  const [constructType, setConstructType] = useState<ConstructType>('House');

  const update = () => {
    setUpdate_([]);
    setAppStates((s) => ({ ...s }));
    drawEditor(appStates);
  };

  const setEditMode = (mode: EditMode) => {
    setAppStates((appStates) => ({ ...appStates, editMode: mode }));
  };

  useEffect(() => {
    loadEditorDataLocalStorage(setAppStates);
  }, []);

  useEffect(() => {
    drawEditor(appStates);
  }, [appStates]);

  function stopInterval() {
    if (runningIntervalId != null) {
      clearInterval(runningIntervalId);
      setRunningIntervalId(null);
    }
  }

  function startTop(interval: number) {
    const intervalId = setInterval(() => {
      appStates.trainMove.tick();
      appStates.agentManager.tick();
      setPositionPercentage(appStates.trainMove.globalTime / (24 * 60 * 60));
      drawEditor(appStates);
    }, interval);
    setRunningIntervalId(intervalId);
  }

  return (
    <>
      <CanvasComponent
        appStates={appStates}
        update={update}
        numberOfPlatforms={numberOfPlatforms}
        constructType={constructType}
      />
      <div id='control-div'>
        <div className='dialog'>
          <ModeOptionRadioComponent
            mode='Create'
            text='線路を作成'
            checked={appStates.editMode === 'Create'}
            setEditorMode={setEditMode}
          />
          <ModeOptionRadioComponent
            mode='Delete'
            text='削除'
            checked={appStates.editMode === 'Delete'}
            setEditorMode={setEditMode}
          />
          <ModeOptionRadioComponent
            mode='Station'
            text='駅を作成'
            checked={appStates.editMode === 'Station'}
            setEditorMode={setEditMode}
          />
          <input
            style={{ width: '30px' }}
            type='number'
            value={numberOfPlatforms}
            onChange={(event) => {
              const value = parseInt((event.target as HTMLInputElement).value);
              if (value > 0) {
                setNumberOfPlatforms(value);
              }
            }}
          />
          <ModeOptionRadioComponent
            mode='Info'
            text='情報を表示'
            checked={appStates.editMode === 'Info'}
            setEditorMode={setEditMode}
          />
          <div
            style={{
              border: '1px solid black',
              display: 'inline-block',
              padding: '2px',
            }}
          >
            <ModeOptionRadioComponent
              mode='ExtendedMap'
              text='建物を作成'
              checked={appStates.editMode === 'ExtendedMap'}
              setEditorMode={setEditMode}
            />
            <select
              value={constructType}
              onChange={(event) => {
                const value = (event.target as HTMLSelectElement).value;
                setConstructType(value as ConstructType);
              }}
            >
              <option value='House'>家</option>
              <option value='Shop'>店</option>
              <option value='Office'>職場</option>
            </select>
          </div>
          <ModeOptionRadioComponent
            mode='Road'
            text='道路'
            checked={appStates.editMode === 'Road'}
            setEditorMode={setEditMode}
          />
        </div>
        <button onClick={() => saveEditorDataLocalStorage(appStates)}>保存</button>
        <button onClick={() => loadEditorDataLocalStorage(setAppStates)}>読み込み</button>
        <button onClick={() => saveEditorDataFile(appStates)}>保存（ファイル）</button>
        <div
          style={{
            border: '1px solid black',
            display: 'inline-block',
            padding: '2px',
          }}
        >
          読み込み（ファイル）:
          <input
            type='file'
            accept='.json'
            onChange={async (event) => {
              const buf = await loadUtf8File(event);
              if (buf == null) {
                return;
              }
              loadEditorDataBuf(buf, setAppStates);
            }}
          />
        </div>
        <button
          onClick={() => {
            setAppStates(getInitialAppStates());
            drawEditor(appStates);
          }}
        >
          クリア
        </button>
      </div>
      <button
        id='button-slow-speed'
        onClick={() => {
          stopInterval();
        }}
      >
        停止
      </button>
      <button
        onClick={() => {
          stopInterval();
          appStates.trainMove.placedTrains = [];
          appStates.trainMove.resetGlobalTime();
          startTop(100);
        }}
      >
        最初から開始
      </button>
      <button
        onClick={() => {
          (() => {
            const station1 = appStates.stations[0];
            const station2 = appStates.stations[3];
            const startTime = 0;
            const timetable = appStates.timetableData.timetable;
            const result = SearchPath(station1, startTime, station2, timetable);
            console.log({ result });
            console.log(result[0].map(([station, time]) => station.stationName + ': ' + toStringFromSeconds(time)));
          })();
          stopInterval();
          appStates.agentManager.clear();
          appStates.agentManager.add({ x: 100, y: 400 });
          appStates.agentManager.add({ x: 200, y: 400 });
          startTop(100);
        }}
      >
        agentManagerを開始
      </button>
      <br />
      {/* <button
        id='button-slow-speed-2'
        onClick={() => {
          stopInterval();
          startTop(100);
        }}
      >
        早くする
      </button>
      <br /> */}
      <button id='button-speed-slow'>＜＜</button>
      <button id='button-speed-fast'>＞＞</button>
      <div id='speed-text'></div>
      <br />

      <SeekBarComponent
        positionPercentage={positionPercentage}
        width={600}
        setPositionPercentage={(p) => {
          appStates.trainMove.globalTime = 24 * 60 * 60 * p;
          setPositionPercentage(p);
        }}
      />
      <div id='time'>{appStates.trainMove.toStringGlobalTime()}</div>
      <div>{positionPercentage}</div>
    </>
  );
}
