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
import { DetailedTimetable, Station, Switch } from '../../model';
import { getInitialAppStates } from '../AppComponent';
import { ConstructType, ExtendedCellConstruct, TerrainType } from '../extendedMapModel';
import { getInitialTimetable } from '../timetable-editor/timetable-util';
import { LineInfoPanel } from './LineInfoPanelComponent';
import { SeekBarComponent } from './SeekBarComponent';
import { CanvasComponent } from './TrackEditorContainerComponent';
import { createAgentManager } from './agentManager';
import { generateTerrain } from './generateExtendedMap';
import { MoneyManager } from './moneyManager';
import { drawEditor } from './trackEditorDrawer';
import { TrainMove } from './trainMove';
import { PlacedTrain, StoredTrain, createTrainMove } from './trainMoveBase';

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
    timetableData: appStates.outlinedTimetableData,
    extendedMap: appStates.extendedMap,
    placedTrains: appStates.trainMove.getPlacedTrains(),
    railwayLines: appStates.railwayLines,
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

  for (let i = 0; i < mapWidth; i++) {
    for (let j = 0; j < mapHeight; j++) {
      const extendedCell = extendedMap[i][j];
      if (mapData[i][j].lineType) {
        extendedCell.type = 'Railway';
      }
    }
  }

  const storedTrains: StoredTrain[] = obj['storedTrains'] ?? [];
  const placedTrains: PlacedTrain[] = obj['placedTrains'] ?? [];
  const timetable = (obj['timetable'] ?? { stationTTItems: [], switchTTItems: [] }) as DetailedTimetable;
  const timetableData = obj['timetableData'] ?? { timetable: getInitialTimetable(null) };
  const railwayLines = obj['railwayLines'] ?? [];

  const trainMove = createTrainMove(timetable);
  // trainMove.placedTrains = placedTrains;
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

  // generateTerrain(extendedMap);

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
    agentManager: createAgentManager(),
    mapWidth: mapWidth,
    mapHeight: mapHeight,
    outlinedTimetableData: timetableData,
    railwayLines: railwayLines,
    mapContext: createMapContext(mapWidth, mapHeight),
    moneyManager: new MoneyManager(),
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
  const agents = [...appStates.agentManager.getAgents()];
  for (const agent of agents) {
    if (agent.inDestination) {
      appStates.agentManager.remove(agent.id);
    }
  }

  // 追加
  const constructs = appStates.extendedMap
    .map((row) => row.filter((cell) => cell.type === 'Construct'))
    .flat() as ExtendedCellConstruct[];
  const agentManager = appStates.agentManager;

  for (const construct of constructs) {
    agentManager.addAgentsRandomly(timesVector({ x: construct.position.cx, y: construct.position.cy }, CellHeight), construct, {...appStates, gameMap: appStates.map, placedTrains: appStates.trainMove.getPlacedTrains()});
    // if (Math.random() < 0.1) {
    //   agentManager.add(timesVector({ x: house.position.cx, y: house.position.cy }, CellHeight));
    // }
  }
}

const SearchMode: 'TimetableBased' | 'RailwayLineBased' = 'RailwayLineBased';

export function TrackEditorComponent({
  appStates,
  setAppStates,
  setToast,
}: {
  appStates: AppStates;
  setAppStates: StateUpdater<AppStates>;
  setToast: (message: string) => void;
}) {
  const [runningIntervalId, setRunningIntervalId] = useState<number | null>(null);
  const [positionPercentage, setPositionPercentage] = useState<number>(0);
  const [numberOfPlatforms, setNumberOfPlatforms] = useState<number>(2);
  const [numberOfLines, setNumberOfLines] = useState<number>(5);
  const [_, setUpdate_] = useState<never[]>([]);
  const [constructType, setConstructType] = useState<ConstructType>('House');
  const [terrainType, setTerrainType] = useState<TerrainType>('Grass');
  const [showLineInfoPanel, setShowLineInfoPanel] = useState<boolean>(false);

  const update = () => {
    setAppStates((s) => ({ ...s }));
    setUpdate_([]);
    drawEditor(appStates);
  };

  const setEditMode = (mode: EditMode) => {
    if (mode === 'LineCreate') {
      setShowLineInfoPanel(true);
    } else {
      setShowLineInfoPanel(false);
      appStates.selectedRailwayLineId = null;
    }
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
      const updated = appStates.mapManager.tick(
        appStates.extendedMap,
        appStates.railwayLines,
        appStates.trainMove.getPlacedTrains(),
        appStates.shouldAutoGrow
      );
      appStates.trainMove.tick({
        globalTimeManager: appStates.globalTimeManager,
        railwayLines: appStates.railwayLines,
        storedTrains: appStates.storedTrains,
        moneyManager: appStates.moneyManager,
      });
      addAgents(appStates);
      appStates.agentManager.tick({
        currentTime: appStates.globalTimeManager.globalTime,
        extendedMap: appStates.extendedMap,
        stations: appStates.stations,
        gameMap: appStates.map,
        placedTrains: appStates.trainMove.getPlacedTrains(),
        railwayLines: appStates.railwayLines,
        timetableData: appStates.outlinedTimetableData,
        trainMove: appStates.trainMove as TrainMove,
        moneyManager: appStates.moneyManager,
        globalTimeManager: appStates.globalTimeManager,
      });
      setPositionPercentage(appStates.globalTimeManager.globalTime / (24 * 60 * 60));
      drawEditor(appStates);
      if (updated) {
        update();
      }
    }, interval);
    setRunningIntervalId(intervalId);
  }

  return (
    <>
      <CanvasComponent
        appStates={appStates}
        update={update}
        numberOfPlatforms={numberOfPlatforms}
        numberOfLines={numberOfLines}
        constructType={constructType}
        terrainType={terrainType}
        setToast={setToast}
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
            setRailwayLines={(railwayLines) => {
              appStates.railwayLines = railwayLines;
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
            text='車両情報'
            checked={appStates.editMode === 'PlaceTrain'}
            setEditorMode={setEditMode}
          />
          <ModeOptionRadioComponent
            mode='Info'
            text='クリックしたものの情報を表示'
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
          <input
            title={'車庫の線路数'}
            style={{ width: '30px' }}
            type='number'
            value={numberOfLines}
            onChange={(event) => {
              const value = parseInt((event.target as HTMLInputElement).value);
              if (value > 0) {
                setNumberOfLines(value);
              }
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
          <div>
            <ModeOptionRadioComponent
              mode='SetTerrain'
              text='地形を設定'
              checked={appStates.editMode === 'SetTerrain'}
              setEditorMode={setEditMode}
            />
            <select
              value={terrainType}
              onChange={(event) => {
                const value = (event.target as HTMLSelectElement).value;
                setTerrainType(value as TerrainType);
              }}
            >
              <option value='Grass'>草原</option>
              <option value='Water'>水</option>
              <option value='Mountain'>山</option>
            </select>
          </div>
          <button
            onClick={() => {
              generateTerrain(appStates.extendedMap);
              update();
            }}
          >
            地形を生成
          </button>
          <label style={{ border: '1px solid #000'}}>情報を表示
            <input type='checkbox' checked={appStates.showInfo} onChange={() => {appStates.showInfo = !appStates.showInfo}} />
          </label>
          <label style={{ border: '1px solid #000'}}>自動発展
            <input type='checkbox' checked={appStates.shouldAutoGrow} onChange={() => {
              appStates.shouldAutoGrow = !appStates.shouldAutoGrow;
            }} />
          </label>
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
      {/* <button
        onClick={() => {
          (() => {
            const station1 = appStates.stations[0];
            const station2 = appStates.stations[3];
            const startTime = 0;
            const timetable = appStates.timetableData.timetable;
            const result = searchPath(station1, startTime, station2, timetable);
            console.log({ result });
            console.log(result[0].map(([station, time]) => station.stationName + ': ' + toStringFromSeconds(time)));
          })();
          stopInterval();
          appStates.agentManager.clear();
          // appStates.agentManager.add({ x: 100, y: 400 });
          appStates.agentManager.addAgentsRandomly({ x: 200, y: 400 }, );
          startTop(100);
        }}
      >
        agentManagerを開始
      </button> */}
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
          appStates.trainMove.resetTrainMove(appStates.globalTimeManager);
          startTop(100);
        }}
      >
        0:00から開始
      </button>
      <button title={'早送り'} onClick={() => {
        stopInterval();
        startTop(1);
      }}>
        ▸▸▸
      </button>
      <div style={{ display: 'inline-block', margin: '3px' }}>{appStates.globalTimeManager.toStringGlobalTime()}</div>
      <div>¥{appStates.moneyManager.toStringMoney()}</div>
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
