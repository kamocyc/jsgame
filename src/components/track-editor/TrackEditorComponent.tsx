import { StateUpdater, useEffect, useState } from 'preact/hooks';
import { JSON_decycle, JSON_retrocycle } from '../../cycle';
import { loadUtf8File } from '../../file';
import { AppStates, Cell, EditMode, createMapContext } from '../../mapEditorModel';
import { DetailedTimetable, Point, Station, Switch, Train } from '../../model';
import { SeekBarComponent } from './SeekBarComponent';
import { CanvasComponent } from './TrackEditorContainerComponent';
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

function saveMapData(appStates: AppStates) {
  if (appStates.timetable == null) {
    return;
  }
  const trainsJson = JSON.stringify(appStates.trains);
  localStorage.setItem('map', JSON.stringify(JSON_decycle(appStates.map)));
  localStorage.setItem('trains', trainsJson);
  localStorage.setItem('timetable', JSON.stringify(JSON_decycle(appStates.timetable)));
  localStorage.setItem(
    'placedTrains',
    JSON.stringify(
      appStates.trainMove.placedTrains.map((t) => ({
        trainId: t.placedTrainId,
        train: t.train,
        speed: t.speed,
        trackId: t.track.trackId,
        position: t.position,
        stationWaitTime: t.stationWaitTime,
        stationStatus: t.stationStatus,
      }))
    )
  );
  console.log('保存しました');
}

function saveMapDataFile(appStates: AppStates) {
  if (appStates.timetable == null) {
    return;
  }
  const obj = {
    map: appStates.map,
    trains: appStates.trains,
    timetable: appStates.timetable,
  };

  const link = document.createElement('a');
  const content = JSON.stringify(JSON_decycle(obj));
  const file = new Blob([content], { type: 'application/json' });
  link.href = URL.createObjectURL(file);
  link.download = 'data.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

function loadMapDataFile(buf: string, setAppStates: StateUpdater<AppStates>) {
  const obj = JSON_retrocycle(JSON.parse(buf));

  const mapData = (obj['map'] ?? []) as Cell[][];
  const mapWidth = mapData.length;
  const mapHeight = mapData[0].length;
  if (mapData.some((row) => row.length !== mapHeight)) {
    alert('マップデータが不正です');
    return;
  }
  const trainsJson = obj['trains'] ?? [];
  const timetable = (obj['timetable'] ?? { stationTTItems: [], switchTTItems: [] }) as DetailedTimetable;

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
    timetable: timetable,
    stations: stations,
    mapWidth: mapWidth,
    mapHeight: mapHeight,
    mapContext: createMapContext(mapWidth, mapHeight),
  }));
}

function loadMapData(setAppStates: StateUpdater<AppStates>) {
  const mapData = JSON_retrocycle(JSON.parse(localStorage.getItem('map') ?? '[]')) as Cell[][];
  const mapWidth = mapData.length;
  const mapHeight = mapData[0].length;
  if (mapData.some((row) => row.length !== mapHeight)) {
    alert('マップデータが不正です');
    return;
  }
  const trainsJson = localStorage.getItem('trains') ?? '[]';
  const timetable = JSON_retrocycle(
    JSON.parse(localStorage.getItem('timetable') ?? '{"stationTTItems": [], "switchTTItems": []}')
  ) as DetailedTimetable;

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
    timetable: timetable,
    stations: stations,
    mapWidth: mapWidth,
    mapHeight: mapHeight,
    mapContext: createMapContext(mapWidth, mapHeight),
  }));
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
  const update = () => {
    setUpdate_([]);
    drawEditor(appStates);
  };

  const setEditMode = (mode: EditMode) => {
    setAppStates((appStates) => ({ ...appStates, editMode: mode }));
  };

  useEffect(() => {
    // loadMapData(setAppStates);
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
      setPositionPercentage(appStates.trainMove.globalTime / (24 * 60 * 60));
      drawEditor(appStates);
    }, interval);
    setRunningIntervalId(intervalId);
  }

  return (
    <>
      <CanvasComponent appStates={appStates} update={update} numberOfPlatforms={numberOfPlatforms} />
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
            text='線路を削除'
            checked={appStates.editMode === 'Delete'}
            setEditorMode={setEditMode}
          />
          <ModeOptionRadioComponent
            mode='StationDelete'
            text='駅を削除'
            checked={appStates.editMode === 'StationDelete'}
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
        </div>
        <button onClick={() => saveMapData(appStates)}>保存</button>
        <button onClick={() => loadMapData(setAppStates)}>読み込み</button>
        <button onClick={() => saveMapDataFile(appStates)}>保存（ファイル）</button>
        読み込み（ファイル）:
        <input
          type='file'
          accept='.json'
          onChange={async (event) => {
            const buf = await loadUtf8File(event);
            if (buf == null) {
              return;
            }
            loadMapDataFile(buf, setAppStates);
          }}
        />
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
          startTop(1000);
        }}
      >
        最初から開始
      </button>
      <br />
      <button
        id='button-slow-speed-2'
        onClick={() => {
          stopInterval();
          startTop(100);
        }}
      >
        早くする
      </button>
      <br />
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
