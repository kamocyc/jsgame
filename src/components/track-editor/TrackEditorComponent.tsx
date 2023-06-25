import { StateUpdater, useEffect, useState } from 'preact/hooks';
import { JSON_decycle, JSON_retrocycle } from '../../cycle';
import { fromJSON } from '../../jsonSerialize';
import { Cell } from '../../mapEditorModel';
import { DiaTrain, Point, Station, Switch } from '../../model';
import { CanvasComponent } from './CanvasComponent';
import { SeekBarComponent } from './SeekBarComponent';
import { drawEditor } from './trackEditorDrawer';
import { TrainMove2 } from './trainMove2';
import { AppStates, EditMode, Timetable, Train, createMapContext } from './uiEditorModel';

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
        trainId: t.trainId,
        diaTrain: t.train,
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
  const mapWidth = mapData.length;
  const mapHeight = mapData[0].length;
  if (mapData.some((row) => row.length !== mapHeight)) {
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

  // TODO: とりあえずダイヤから生成するのに統一する。
  // const placedTrains = (JSON.parse(localStorage.getItem('placedTrains') ?? '[]') as SerializedPlacedTrain[]).map(
  //   (t) => ({
  //     trainId: t.trainId,
  //     train: t.train,
  //     speed: t.speed,
  //     track: tracks.find((track) => track.trackId === t.trackId)!,
  //     position: t.position,
  //     stationWaitTime: t.stationWaitTime,
  //     stationStatus: t.stationStatus,
  //   })
  // );
  // trainMove.placedTrains = placedTrains;
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
      <CanvasComponent appStates={appStates} update={update} />
      <div id='control-div'>
        <div className='dialog'>
          <ModeOptionRadioComponent
            mode='Create'
            text='線路を作成'
            checked={appStates.editMode === 'Create'}
            setEditorMode={setEditMode}
          />
          {/* <ModeOptionRadioComponent
            mode='Delete'
            text='線路を削除(未実装)'
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
            text='駅を作成(旧)'
            checked={appStates.editMode === 'Station'}
            setEditorMode={setEditMode}
          /> */}
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
        <button id='save-button' onClick={() => saveMapData(appStates)}>
          保存
        </button>
        <button id='load-button' onClick={() => loadMapData(setAppStates)}>
          読み込み
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

      <div id='timetable-root'></div>

      <input type='file' id='file-selector' accept='.oud, .oud2, .json' />
    </>
  );
}
