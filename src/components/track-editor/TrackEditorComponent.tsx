import { StateUpdater, useEffect, useState } from 'preact/hooks';
import { removeDuplicates } from '../../common';
import { JSON_decycle, JSON_retrocycle } from '../../cycle';
import { loadUtf8File } from '../../file';
import {
  AppStates,
  Cell,
  CellHeight,
  EditMode,
  ExtendedGameMap,
  createMapContext,
  timesVector,
} from '../../mapEditorModel';
import { DetailedTimetable, Point, Station, Switch, Train } from '../../model';
import { getInitialAppStates } from '../AppComponent';
import { ConstructType, ExtendedCellConstruct } from '../extendedMapModel';
import { toStringFromSeconds } from '../timetable-editor/common-component';
import { getInitialTimetable } from '../timetable-editor/timetable-util';
import { LineInfoPanel } from './LineInfoPanelComponent';
import { SeekBarComponent } from './SeekBarComponent';
import { CanvasComponent } from './TrackEditorContainerComponent';
import { AgentManager, SearchPath } from './agentManager';
import { drawEditor } from './trackEditorDrawer';
import { PlacedTrain, StoredTrain, TrainMove, getMinTimetableTime } from './trainMove';

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
    storedTrains: appStates.storedTrains,
    timetable: appStates.detailedTimetable,
    timetableData: appStates.timetableData,
    extendedMap: appStates.extendedMap,
    operations: appStates.operations,
    placedTrains: appStates.trainMove.placedTrains,
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
  const extendedMap = obj['extendedMap'] as ExtendedGameMap;

  const storedTrains: StoredTrain[] = obj['storedTrains'] ?? [];
  const placedTrains: PlacedTrain[] = obj['placedTrains'] ?? [];
  const timetable = (obj['timetable'] ?? { stationTTItems: [], switchTTItems: [] }) as DetailedTimetable;
  const timetableData = obj['timetableData'] ?? { timetable: getInitialTimetable() };
  const operations = obj['operations'] ?? [];

  const trainMove = new TrainMove(timetable);
  trainMove.placedTrains = placedTrains;
  const switches = mapData.flatMap(
    (row) =>
      row
        .map((cell) => (cell.lineType?.lineClass === 'Branch' ? cell.lineType.switch : null))
        .filter((x) => x != null) as Switch[]
  );
  const tracks = mapData.flatMap((row) =>
    row.map((cell) => cell.lineType?.tracks ?? []).reduce((a, b) => a.concat(b), [])
  );

  const stations = removeDuplicates(
    mapData.flatMap(
      (row) =>
        row
          .flatMap((cell) => cell.lineType?.tracks.map((track) => track.track.platform?.station))
          .filter((x) => x != null) as Station[]
    ),
    (s1, s2) => s1.stationId === s2.stationId
  );

  setAppStates((appStates) => ({
    ...appStates,
    map: mapData,
    extendedMap: extendedMap,
    switches: switches,
    tracks: tracks,
    trainMove: trainMove,
    storedTrains: storedTrains,
    detailedTimetable: timetable,
    stations: stations,
    agentManager: new AgentManager(appStates.extendedMap, stations, mapData, timetableData.timetable, trainMove),
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

function addAgents(appStates: AppStates) {
  // 目的地に到着したら消す
  const agents = [...appStates.agentManager.agents];
  for (const agent of agents) {
    if (agent.inDestination) {
      appStates.agentManager.remove(agent);
    }
  }

  // 追加
  const houses = appStates.extendedMap
    .map((row) => row.filter((cell) => cell.type === 'Construct' && cell.constructType === 'House'))
    .flat() as ExtendedCellConstruct[];
  const agentManager = appStates.agentManager;

  for (const house of houses) {
    if (Math.random() < 0.1) {
      agentManager.add(timesVector({ x: house.position.cx, y: house.position.cy }, CellHeight));
    }
  }
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
  const [showLineInfoPanel, setShowLineInfoPanel] = useState<boolean>(false);

  const update = () => {
    setAppStates((s) => ({ ...s }));
    setUpdate_([]);
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
      appStates.globalTimeManager.tick();
      appStates.trainMove.tick(appStates.globalTimeManager);
      addAgents(appStates);
      appStates.agentManager.tick(appStates.globalTimeManager.globalTime);
      setPositionPercentage(appStates.globalTimeManager.globalTime / (24 * 60 * 60));
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
      {showLineInfoPanel ? (
        <div className='dialog'>
          <LineInfoPanel
            railwayLines={appStates.railwayLines}
            selectedRailwayLineId={appStates.selectedRailwayLineId}
            setSelectedRailwayLineId={(id) => {
              appStates.selectedRailwayLineId = id;
              update();
            }}
          />
        </div>
      ) : (
        <></>
      )}
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
            title={'プラットフォーム数'}
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
            mode='PlaceTrain'
            text='列車を配置'
            checked={appStates.editMode === 'PlaceTrain'}
            setEditorMode={setEditMode}
          />
          <ModeOptionRadioComponent
            mode='Info'
            text='情報を表示'
            checked={appStates.editMode === 'Info'}
            setEditorMode={setEditMode}
          />
          <ModeOptionRadioComponent
            mode='LineCreate'
            text='路線を作成'
            checked={appStates.editMode === 'LineCreate'}
            setEditorMode={setEditMode}
          />
          <ModeOptionRadioComponent
            mode='DepotCreate'
            text='車庫を作成'
            checked={appStates.editMode === 'DepotCreate'}
            setEditorMode={setEditMode}
          />
          <ModeOptionRadioComponent
            mode='ShowLine'
            text='路線を表示'
            checked={appStates.editMode === 'ShowLine'}
            setEditorMode={(mode) => {
              setEditMode(mode);
              setShowLineInfoPanel(true);
            }}
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
          // appStates.agentManager.add({ x: 100, y: 400 });
          appStates.agentManager.add({ x: 200, y: 400 });
          startTop(100);
        }}
      >
        agentManagerを開始
      </button>
      <br />
      <button
        title={'一時停止'}
        onClick={(e) => {
          stopInterval();
        }}
      >
        ||
      </button>
      <button
        onClick={() => {
          stopInterval();
          startTop(100);
        }}
        title={'開始'}
      >
        ▸
      </button>
      <button
        onClick={() => {
          stopInterval();
          appStates.trainMove.placedTrains = [];
          appStates.globalTimeManager.resetGlobalTime(getMinTimetableTime(appStates.trainMove.timetable));
          startTop(100);
        }}
      >
        0:00から開始
      </button>
      {/* <button id='button-speed-fast' title={'早送り'}>
        ▸▸▸
      </button> */}
      <div style={{ display: 'inline-block', margin: '3px' }}>{appStates.globalTimeManager.toStringGlobalTime()}</div>
      <br />

      <SeekBarComponent
        positionPercentage={positionPercentage}
        width={600}
        setPositionPercentage={(p) => {
          appStates.globalTimeManager.resetGlobalTime(24 * 60 * 60 * p);
          setPositionPercentage(p);
        }}
      />
      <div>{Math.round(positionPercentage * 100 * 100) / 100}%</div>
    </>
  );
}
