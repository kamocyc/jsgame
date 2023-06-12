import { StateUpdater, useEffect, useState } from 'preact/hooks';
import { JSON_decycle, JSON_retrocycle } from '../cycle';
import { fromJSON } from '../jsonSerialize';
import { Cell, GameMap, MapHeight, MapWidth } from '../mapEditorModel';
import { DiaTrain, Point, Switch } from '../model';
import { drawEditor } from '../trackEditorDrawer';
import { TrainMove2 } from '../trainMove2';
import { AppStates, EditMode, Timetable, Train } from '../uiEditorModel';
import { CanvasComponent } from './CanvasComponent';

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

function initializeMap(): GameMap {
  const map: Cell[][] = [];
  for (let x = 0; x < MapWidth; x++) {
    map.push([]);
    for (let y = 0; y < MapHeight; y++) {
      map[x].push({
        position: { x, y },
        lineType: null,
      } as Cell);
    }
  }
  return map;
}

interface SerializedPlacedTrain {
  trainId: number;
  diaTrain: Train;
  speed: number;
  trackId: number;
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
      appStates.trainMove.trains.map((t) => ({
        trainId: t.trainId,
        diaTrain: t.diaTrain,
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

function loadMapData(setAppStates: StateUpdater<AppStates>) {
  const mapData = JSON_retrocycle(JSON.parse(localStorage.getItem('map') ?? '[]')) as Cell[][];
  if (mapData.length !== MapWidth || mapData[0].length !== MapHeight) {
    alert('マップデータが不正です');
    return;
  }
  const trainsJson = localStorage.getItem('trains') ?? '[]';
  const trains = fromJSON(trainsJson) as unknown as DiaTrain[];
  const timetable = JSON_retrocycle(
    JSON.parse(localStorage.getItem('timetable') ?? '{"stationTTItems": [], "switchTTItems": []}')
  ) as Timetable;

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

  const placedTrains = (JSON.parse(localStorage.getItem('placedTrains') ?? '[]') as SerializedPlacedTrain[]).map(
    (t) => ({
      trainId: t.trainId,
      diaTrain: t.diaTrain,
      speed: t.speed,
      track: tracks.find((track) => track.trackId === t.trackId)!,
      position: t.position,
      stationWaitTime: t.stationWaitTime,
      stationStatus: t.stationStatus,
    })
  );
  trainMove.trains = placedTrains;

  setAppStates((appStates) => ({
    ...appStates,
    map: mapData,
    switches: switches,
    tracks: tracks,
    trainMove: trainMove,
    timetable: timetable,
  }));
}

const timetable: Timetable = {
  stationTTItems: [],
  switchTTItems: [],
};

export function App() {
  const [appStates, setAppStates] = useState<AppStates>(() => ({
    editMode: 'Create',
    timetable: timetable,
    trains: [
      {
        trainId: 1,
        trainName: 'A',
        color: 'red',
        trainTimetable: [],
      },
      {
        trainId: 2,
        trainName: 'B',
        color: 'black',
        trainTimetable: [],
      },
    ],
    map: initializeMap(),
    trainMove: new TrainMove2(timetable),
    switches: [],
    tracks: [],
  }));
  const [runningIntervalId, setRunningIntervalId] = useState<number | null>(null);

  const setEditMode = (mode: EditMode) => {
    setAppStates((appStates) => ({ ...appStates, editMode: mode }));
  };

  // useEffect(() => {
  //   loadMapData(setAppStates);
  // }, []);

  useEffect(() => {
    drawEditor(appStates.trainMove, appStates.tracks, appStates.map);
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
      drawEditor(appStates.trainMove, appStates.tracks, appStates.map);
    }, interval);
    setRunningIntervalId(intervalId);
  }

  return (
    <>
      <CanvasComponent appStates={appStates} setAppStates={setAppStates} />
      <div id='control-div'>
        <button id='save-button' onClick={() => saveMapData(appStates)}>
          保存
        </button>
        <button id='load-button' onClick={() => loadMapData(setAppStates)}>
          読み込み
        </button>
        <div style={{ borderStyle: 'solid', borderWidth: '1px' }}>
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
            mode='PlaceTrain'
            text='列車を配置'
            checked={appStates.editMode === 'PlaceTrain'}
            setEditorMode={setEditMode}
          />
          <ModeOptionRadioComponent
            mode='Station'
            text='駅を作成'
            checked={appStates.editMode === 'Station'}
            setEditorMode={setEditMode}
          />
          <ModeOptionRadioComponent
            mode='Info'
            text='情報を表示'
            checked={appStates.editMode === 'Info'}
            setEditorMode={setEditMode}
          />
        </div>
      </div>
      <button
        id='button-slow-speed'
        onClick={() => {
          stopInterval();
          startTop(1000);
        }}
      >
        {runningIntervalId == null ? '再生' : '停止'}
      </button>
      <button
        onClick={() => {
          stopInterval();
          appStates.trainMove.resetGlobalTime();
          startTop(1000);
        }}
      >
        リスタート
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

      <div id='seek-bar' style='width: 1000px; height: 20px; background-color: aquamarine'>
        <div id='seek-bar-item' style='width: 6px; height: 20px; background-color: black; position: relative'></div>
      </div>
      <div id='time'>{appStates.trainMove.toStringGlobalTime()}</div>

      <div id='timetable-root'></div>

      <input type='file' id='file-selector' accept='.oud, .oud2, .json' />
    </>
  );
}
