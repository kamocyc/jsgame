import { useEffect, useState } from 'react';
import { DeepReadonly } from 'ts-essentials';
import { StateUpdater, assert, mapToObject, merge, nn, removeDuplicates } from '../../common';
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
import { DetailedTimetable, StationLike, Train } from '../../model';
import { OutlinedTimetable, OutlinedTimetableData, OutlinedTimetableFunc } from '../../outlinedTimetableData';
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

type SaveData = {
  map: Cell[][];
  storedTrains: StoredTrain[];
  timetable: DetailedTimetable;
  timetableData: DeepReadonly<{
    trains: Train[];
    timetables: OutlinedTimetable[];
  }>;
  extendedMap: ExtendedGameMap;
  placedTrains: PlacedTrain[];
  railwayLines: any[];
  stations: { [key: string]: StationLike };
};

function toStringEditorData(appStates: AppStates) {
  // if (appStates.detailedTimetable == null) {
  //   return;
  // }
  const obj: SaveData = {
    map: appStates.mapState.map,
    storedTrains: appStates.mapState.storedTrains,
    timetable: appStates.mapState.detailedTimetable,
    timetableData: OutlinedTimetableFunc.toDataToSave(appStates.outlinedTimetableData),
    extendedMap: appStates.mapState.extendedMap,
    placedTrains: appStates.mapState.trainMove.getPlacedTrains(),
    railwayLines: appStates.railwayLines,
    stations: mapToObject(appStates.mapState.stationMap),
  };

  return JSON.stringify(JSON_decycle(obj), null, 2);
}

function loadEditorDataBuf(buf: string, setAppStates: StateUpdater<AppStates>) {
  const obj = JSON_retrocycle(JSON.parse(buf)) as SaveData;

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

  const extendedMap = obj.extendedMap;

  for (let i = 0; i < mapWidth; i++) {
    for (let j = 0; j < mapHeight; j++) {
      const extendedCell = nn(nn(extendedMap[i])[j]);
      if (nn(nn(mapData[i])[j]).lineType) {
        extendedCell.type = 'Railway';
      }
    }
  }

  const stationIds = removeDuplicates(
    mapData.flatMap(
      (row) =>
        row
          .flatMap((cell) => cell.lineType?.tracks.map((track) => track.track.platform?.stationId))
          .filter((x) => x != null) as string[]
    ),
    (s1, s2) => s1 === s2
  );

  const stations = new Map(Object.entries(obj.stations)) ?? new Map();

  assert(
    [...stations.values()].map((station) => station.stationId).every((stationId) => stationIds.includes(stationId))
  );
  const storedTrains: StoredTrain[] = obj.storedTrains ?? [];
  // const placedTrains: PlacedTrain[] = obj.placedTrains ?? [];
  const timetable = (obj.timetable ?? { stationTTItems: [], switchTTItems: [] }) as DetailedTimetable;
  const timetableDataRaw = obj.timetableData;
  const timetableData: OutlinedTimetableData =
    timetableDataRaw.trains && timetableDataRaw.timetables
      ? {
          _trains: new Map<string, Train>((timetableDataRaw.trains as Train[]).map((train) => [train.trainId, train])),
          _timetables: timetableDataRaw.timetables as OutlinedTimetable[],
          _errors: [],
        }
      : {
          _trains: new Map(),
          _timetables: [],
          _errors: [],
        };
  const railwayLines = obj['railwayLines'] ?? [];

  const trainMove = createTrainMove();
  const tracks = mapData.flatMap((row) =>
    row.map((cell) => cell.lineType?.tracks ?? []).reduce((a, b) => a.concat(b), [])
  );

  // generateTerrain(extendedMap);

  setAppStates((appStates) =>
    merge(appStates, {
      outlinedTimetableData: timetableData,
      railwayLines: railwayLines,
      mapState: merge(appStates.mapState, {
        map: mapData,
        tracks: tracks,
        storedTrains: storedTrains,
        detailedTimetable: timetable,
        extendedMap: extendedMap,
        trainMove: trainMove,
        stationMap: stations,
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
        stationMap: appStates.mapState.stationMap,
        gameMap: appStates.mapState.map,
        placedTrains: appStates.mapState.trainMove.getPlacedTrains(),
        railwayLines: appStates.railwayLines,
        outlinedTimetableData: appStates.outlinedTimetableData,
        moneyManager: appStates.mapState.moneyManager,
        globalTimeManager: appStates.mapState.globalTimeManager,
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
      appStates.mapState.globalTimeManager.tick();
      const updated = appStates.mapState.mapManager.tick(
        appStates.mapState.extendedMap,
        appStates.railwayLines,
        appStates.mapState.trainMove.getPlacedTrains(),
        appStates.mapState.shouldAutoGrow
      );
      appStates.mapState.trainMove.tick({
        globalTimeManager: appStates.mapState.globalTimeManager,
        moneyManager: appStates.mapState.moneyManager,
        tracks: appStates.mapState.tracks,
        trains: appStates.outlinedTimetableData._trains,
        timetable: appStates.mapState.detailedTimetable,
      });
      addAgents(appStates);
      appStates.mapState.agentManager.tick({
        extendedMap: appStates.mapState.extendedMap,
        stationMap: appStates.mapState.stationMap,
        gameMap: appStates.mapState.map,
        placedTrains: appStates.mapState.trainMove.getPlacedTrains(),
        railwayLines: appStates.railwayLines,
        outlinedTimetableData: appStates.outlinedTimetableData,
        moneyManager: appStates.mapState.moneyManager,
        globalTimeManager: appStates.mapState.globalTimeManager,
      });
      setPositionPercentage(appStates.mapState.globalTimeManager.globalTime / (24 * 60 * 60));
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
            stations={appStates.mapState.stationMap}
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
              // TODO
              // @ts-ignore
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
          appStates.mapState.trainMove.resetTrainMove(
            appStates.mapState.globalTimeManager,
            appStates.outlinedTimetableData._trains,
            appStates.mapState.detailedTimetable
          );
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
      <div style={{ display: 'inline-block', margin: '3px' }}>
        {appStates.mapState.globalTimeManager.toStringGlobalTime()}
      </div>
      <div>¥{appStates.mapState.moneyManager.toStringMoney()}</div>
      <br />

      <SeekBarComponent
        positionPercentage={positionPercentage}
        width={600}
        setPositionPercentage={(p) => {
          appStates.mapState.globalTimeManager.resetGlobalTime(24 * 60 * 60 * p);
          setPositionPercentage(p);
        }}
      />
      <div>{Math.round(positionPercentage * 100 * 100) / 100}%</div>
    </>
  );
}
