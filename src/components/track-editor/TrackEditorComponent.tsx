import { StateUpdater, useEffect, useState } from 'preact/hooks';
import { assert, merge, nn, removeDuplicates } from '../../common';
import { JSON_decycle, JSON_retrocycle } from '../../cycle';
import { loadUtf8File } from '../../file';
import {
  AppStates,
  Cell,
  CellHeight,
  EditMode,
  ExtendedGameMap,
  MapState,
  createMapContext,
  timesVector,
} from '../../mapEditorModel';
import { DetailedTimetable, Station, Switch, Train } from '../../model';
import { OutlinedTimetable, OutlinedTimetableData } from '../../outlinedTimetableData';
import { getInitialAppStates } from '../AppComponent';
import { ConstructType, ExtendedCellConstruct, TerrainType } from '../extendedMapModel';
import { LineInfoPanel } from './LineInfoPanelComponent';
import { SeekBarComponent } from './SeekBarComponent';
import { CanvasComponent } from './TrackEditorContainerComponent';
import { createAgentManager } from './agentManager';
import { generateTerrain } from './generateExtendedMap';
import { MoneyManager } from './moneyManager';
import { drawEditor } from './trackEditorDrawer';
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
    timetableData: appStates.outlinedTimetableData.toDataToSave(),
    extendedMap: appStates.mapState.extendedMap,
    placedTrains: appStates.mapState.trainMove.getPlacedTrains(),
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
  assert(mapWidth !== undefined && mapHeight !== undefined);

  const extendedMap = obj['extendedMap'] as ExtendedGameMap;

  for (let i = 0; i < mapWidth; i++) {
    for (let j = 0; j < mapHeight; j++) {
      const extendedCell = nn(nn(extendedMap[i])[j]);
      if (nn(nn(mapData[i])[j]).lineType) {
        extendedCell.type = 'Railway';
      }
    }
  }

  const storedTrains: StoredTrain[] = obj['storedTrains'] ?? [];
  const placedTrains: PlacedTrain[] = obj['placedTrains'] ?? [];
  const timetable = (obj['timetable'] ?? { stationTTItems: [], switchTTItems: [] }) as DetailedTimetable;
  const timetableDataRaw = obj['timetableData'];
  const timetableData: OutlinedTimetableData =
    timetableDataRaw.trains && timetableDataRaw.timetables
      ? {
          _trains: timetableDataRaw.trains as Train[],
          _timetables: timetableDataRaw.timetables as OutlinedTimetable[],
          _errors: [],
        }
      : {
          _trains: [],
          _timetables: [],
          _errors: [],
        };
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

  setAppStates((appStates) =>
    merge(appStates, {
      map: mapData,
      tracks: tracks,
      storedTrains: storedTrains,
      detailedTimetable: timetable,
      outlinedTimetableData: timetableData,
      railwayLines: railwayLines,
      mapState: merge(appStates.mapState, {
        extendedMap: extendedMap,
        trainMove: trainMove,
        stations: stations,
        agentManager: createAgentManager(),
        mapWidth: mapWidth,
        mapHeight: mapHeight,
        mapContext: createMapContext(mapWidth, mapHeight),
        moneyManager: new MoneyManager(),
      }),
    })
  );
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
  const agents = [...appStates.mapState.agentManager.getAgents()];
  for (const agent of agents) {
    if (agent.inDestination) {
      appStates.mapState.agentManager.remove(agent.id);
    }
  }

  // 追加
  const constructs = appStates.mapState.extendedMap
    .map((row) => row.filter((cell) => cell.type === 'Construct'))
    .flat() as ExtendedCellConstruct[];
  const agentManager = appStates.mapState.agentManager;

  for (const construct of constructs) {
    agentManager.addAgentsRandomly(
      timesVector({ x: construct.position.cx, y: construct.position.cy }, CellHeight),
      construct,
      {
        extendedMap: appStates.mapState.extendedMap,
        stations: appStates.mapState.stations,
        gameMap: appStates.map,
        placedTrains: appStates.mapState.trainMove.getPlacedTrains(),
        railwayLines: appStates.railwayLines,
        outlinedTimetableData: appStates.outlinedTimetableData,
        moneyManager: appStates.mapState.moneyManager,
        globalTimeManager: appStates.globalTimeManager,
      }
    );
    // if (Math.random() < 0.1) {
    //   agentManager.add(timesVector({ x: house.position.cx, y: house.position.cy }, CellHeight));
    // }
  }
}

// const SearchMode: 'TimetableBased' | 'RailwayLineBased' = 'RailwayLineBased';

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
  // const [_, setUpdate_] = useState<never[]>([]);
  const [constructType, setConstructType] = useState<ConstructType>('House');
  const [terrainType, setTerrainType] = useState<TerrainType>('Grass');
  const [showLineInfoPanel, setShowLineInfoPanel] = useState<boolean>(false);

  const update = () => {
    setAppStates((s) => ({ ...s }));
    // setUpdate_([]);
    // drawEditor(appStates);
  };
  const setMapState = (mapState: MapState) => {
    setAppStates((appStates) => merge(appStates, { mapState: mapState }));
  };

  const setEditMode = (mode: EditMode) => {
    if (mode === 'LineCreate') {
      setShowLineInfoPanel(true);
      setAppStates((appStates) => merge(appStates, { mapState: merge(appStates.mapState, { editMode: mode }) }));
    } else {
      setShowLineInfoPanel(false);
      setAppStates((appStates) =>
        merge(appStates, { selectedRailwayLineId: null, mapState: merge(appStates.mapState, { editMode: mode }) })
      );
    }
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
      const updated = appStates.mapState.mapManager.tick(
        appStates.mapState.extendedMap,
        appStates.railwayLines,
        appStates.mapState.trainMove.getPlacedTrains(),
        appStates.mapState.shouldAutoGrow
      );
      appStates.mapState.trainMove.tick({
        globalTimeManager: appStates.globalTimeManager,
        railwayLines: appStates.railwayLines,
        storedTrains: appStates.storedTrains,
        moneyManager: appStates.mapState.moneyManager,
        tracks: appStates.tracks,
      });
      addAgents(appStates);
      appStates.mapState.agentManager.tick({
        extendedMap: appStates.mapState.extendedMap,
        stations: appStates.mapState.stations,
        gameMap: appStates.map,
        placedTrains: appStates.mapState.trainMove.getPlacedTrains(),
        railwayLines: appStates.railwayLines,
        outlinedTimetableData: appStates.outlinedTimetableData,
        moneyManager: appStates.mapState.moneyManager,
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
            timetableData={appStates.outlinedTimetableData}
            railwayLines={appStates.railwayLines}
            selectedRailwayLineId={appStates.selectedRailwayLineId}
            setSelectedRailwayLineId={(id) => {
              setAppStates((appStates) => merge(appStates, { selectedRailwayLineId: id }));
            }}
            setRailwayLines={(railwayLines) => {
              setAppStates((appStates) => merge(appStates, { railwayLines: railwayLines }));
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
            checked={appStates.mapState.editMode === 'Create'}
            setEditorMode={setEditMode}
          />
          <ModeOptionRadioComponent
            mode='Delete'
            text='削除'
            checked={appStates.mapState.editMode === 'Delete'}
            setEditorMode={setEditMode}
          />
          <ModeOptionRadioComponent
            mode='Station'
            text='駅を作成'
            checked={appStates.mapState.editMode === 'Station'}
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
            checked={appStates.mapState.editMode === 'PlaceTrain'}
            setEditorMode={setEditMode}
          />
          <ModeOptionRadioComponent
            mode='Info'
            text='クリックしたものの情報を表示'
            checked={appStates.mapState.editMode === 'Info'}
            setEditorMode={setEditMode}
          />
          <ModeOptionRadioComponent
            mode='LineCreate'
            text='路線を作成'
            checked={appStates.mapState.editMode === 'LineCreate'}
            setEditorMode={setEditMode}
          />
          <ModeOptionRadioComponent
            mode='DepotCreate'
            text='車庫を作成'
            checked={appStates.mapState.editMode === 'DepotCreate'}
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
              checked={appStates.mapState.editMode === 'ExtendedMap'}
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
            checked={appStates.mapState.editMode === 'Road'}
            setEditorMode={setEditMode}
          />
          <div>
            <ModeOptionRadioComponent
              mode='SetTerrain'
              text='地形を設定'
              checked={appStates.mapState.editMode === 'SetTerrain'}
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
              generateTerrain(appStates.mapState.extendedMap);
              update();
            }}
          >
            地形を生成
          </button>
          <label style={{ border: '1px solid #000' }}>
            情報を表示
            <input
              type='checkbox'
              checked={appStates.mapState.showInfo}
              onChange={() => {
                setMapState({ ...appStates.mapState, showInfo: !appStates.mapState.showInfo });
              }}
            />
          </label>
          <label style={{ border: '1px solid #000' }}>
            自動発展
            <input
              type='checkbox'
              checked={appStates.mapState.shouldAutoGrow}
              onChange={() => {
                setMapState({ ...appStates.mapState, shouldAutoGrow: !appStates.mapState.shouldAutoGrow });
              }}
            />
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
          appStates.mapState.trainMove.resetTrainMove(appStates.globalTimeManager);
          startTop(100);
        }}
      >
        0:00から開始
      </button>
      <button
        title={'早送り'}
        onClick={() => {
          stopInterval();
          startTop(1);
        }}
      >
        ▸▸▸
      </button>
      <div style={{ display: 'inline-block', margin: '3px' }}>{appStates.globalTimeManager.toStringGlobalTime()}</div>
      <div>¥{appStates.mapState.moneyManager.toStringMoney()}</div>
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
