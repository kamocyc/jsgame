import { StateUpdater, useEffect, useState } from 'preact/hooks';
import { JSON_decycle, JSON_retrocycle } from '../cycle';
import { fromJSON, toJSON } from '../jsonSerialize';
import { Cell, GameMap, MapHeight, MapWidth } from '../mapEditorModel';
import { drawEditor } from '../trackEditorDrawer';
import { TrainMove } from '../trainMove';
import { AppStates, EditMode, Timetable } from '../uiEditorModel';
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

function saveMapData(appStates: AppStates) {
  if (appStates.timetable == null) {
    return;
  }
  const trainMoveJson = toJSON(appStates.trainMove);
  localStorage.setItem('map', JSON.stringify(JSON_decycle(appStates.map)));
  localStorage.setItem('trainMove', trainMoveJson);
  localStorage.setItem('timetable', JSON.stringify(JSON_decycle(appStates.timetable)));
  console.log('保存しました');
}

function loadMapData(setAppStates: StateUpdater<AppStates>) {
  const mapData = JSON_retrocycle(JSON.parse(localStorage.getItem('map') ?? '[]')) as Cell[][];
  const trainMoveJson = localStorage.getItem('trainMove') ?? '{}';
  const trainMove = fromJSON(trainMoveJson) as unknown as TrainMove;
  if (mapData.length !== MapWidth || mapData[0].length !== MapHeight) {
    alert('マップデータが不正です');
    return;
  }
  const timetable = JSON_retrocycle(
    JSON.parse(localStorage.getItem('timetable') ?? '{"stationTTItems": [], "switchTTItems": []}')
  ) as Timetable;

  setAppStates((appStates) => ({
    ...appStates,
    map: mapData,
    trainMove: trainMove,
    timetable: timetable,
  }));
}

export function App() {
  const [appStates, setAppStates] = useState<AppStates>(() => ({
    editMode: 'Create',
    timetable: {
      stationTTItems: [],
      switchTTItems: [],
    },
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
    trainMove: new TrainMove(),
  }));

  const setEditMode = (mode: EditMode) => {
    setAppStates((appStates) => ({ ...appStates, editMode: mode }));
  };

  useEffect(() => {
    loadMapData(setAppStates);
  }, []);

  useEffect(() => {
    drawEditor(appStates.trainMove, appStates.map);
  }, [appStates]);

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
            text='作成'
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
            text='駅'
            checked={appStates.editMode === 'Station'}
            setEditorMode={setEditMode}
          />
          <ModeOptionRadioComponent
            mode='Info'
            text='情報'
            checked={appStates.editMode === 'Info'}
            setEditorMode={setEditMode}
          />
        </div>
      </div>
      <button id='button-slow-speed'>停止/再開</button>
      <br />
      <button id='button-slow-speed-2'>早くする</button>
      <br />
      <button id='button-speed-slow'>＜＜</button>
      <button id='button-speed-fast'>＞＞</button>
      <div id='speed-text'></div>
      <br />

      <div id='seek-bar' style='width: 1000px; height: 20px; background-color: aquamarine'>
        <div id='seek-bar-item' style='width: 6px; height: 20px; background-color: black; position: relative'></div>
      </div>
      <div id='time'></div>

      <div id='timetable-root'></div>

      <input type='file' id='file-selector' accept='.oud, .oud2, .json' />
    </>
  );
}
