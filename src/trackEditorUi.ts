import { globalObject } from './components/app';
import { JSON_decycle, JSON_retrocycle } from './cycle';
import { fromJSON, toJSON } from './jsonSerialize';
import { Cell, CellHeight, CellWidth, Map, MapHeight, MapWidth } from './mapEditorModel';
import { DiaTrain, Point, generateId } from './model';
import { createLine } from './trackEditor';
import { drawEditor } from './trackEditorDrawer';
import { TrainMove } from './trainMove';
import { Timetable } from './uiEditorModel';

function mouseToMapPosition(mousePoint: Point) {
  return {
    x: Math.floor(mousePoint.x / CellWidth),
    y: Math.floor((MapHeight * CellHeight - mousePoint.y) / CellHeight),
  };
}

let mouseStartCell: null | Cell = null;
let mouseDragMode: 'Create' | 'Delete' | 'Station' | null = null;

function initializeMap(): Map {
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

// ラジオボタンを作成
const createRadioButton = (
  name: string,
  value: string,
  text: string,
  onchangeHandler: (this: GlobalEventHandlers, ev: Event) => any
) => {
  const label = document.createElement('label');
  const radioButton = document.createElement('input');
  radioButton.type = 'radio';
  radioButton.name = name;
  radioButton.value = value;
  radioButton.onchange = onchangeHandler;
  label.appendChild(radioButton);
  label.appendChild(document.createTextNode(text));
  return label;
};

const createRadioButtonDiv = (name: string, ...radioButtons: HTMLLabelElement[]) => {
  const div = document.createElement('div');
  div.id = name;
  for (const radioButton of radioButtons) {
    div.appendChild(radioButton);
  }
  return div;
};

export let map = initializeMap();
export let trainMove = new TrainMove();
let editorMode = 'Create' as 'Create' | 'Delete' | 'Station' | 'Info';
let trains: DiaTrain[] = [
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
];

function saveData() {
  const trainMoveJson = toJSON(trainMove);
  localStorage.setItem('map', JSON.stringify(JSON_decycle(map)));
  localStorage.setItem('trainMove', trainMoveJson);
  localStorage.setItem('timetable', JSON.stringify(JSON_decycle(timetable)));
  console.log('保存しました');
}

function loadData() {
  const mapData = JSON_retrocycle(JSON.parse(localStorage.getItem('map') ?? '[]')) as Cell[][];
  const trainMoveJson = localStorage.getItem('trainMove') ?? '{}';
  const trainMove_ = fromJSON(trainMoveJson) as unknown as TrainMove;
  if (mapData.length !== MapWidth || mapData[0].length !== MapHeight) {
    alert('マップデータが不正です');
    return;
  }
  map = mapData;
  trainMove = trainMove_;
  timetable = JSON_retrocycle(
    JSON.parse(localStorage.getItem('timetable') ?? '{"stationTTItems": [], "switchTTItems": []}')
  ) as Timetable;

  drawEditor(trainMove, map);
}

export function initializeTrackEditor() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  canvas.onmousedown = onmousedown;
  canvas.onmouseup = onmouseup;
  canvas.onmousemove = onmousemove;

  const controlDiv = document.getElementById('control-div') as HTMLDivElement;
  const saveButton = document.createElement('button');
  saveButton.innerText = '保存';
  saveButton.onclick = () => {
    saveData();
  };

  const loadButton = document.createElement('button');
  loadButton.innerText = '読み込み';
  loadButton.onclick = () => {
    loadData();
  };

  controlDiv.appendChild(saveButton);
  controlDiv.appendChild(loadButton);

  const radioButtons = [
    createRadioButton('mode', 'Create', '作成', () => {
      editorMode = 'Create';
    }),
    createRadioButton('mode', 'Delete', '削除', () => {
      editorMode = 'Delete';
    }),
    createRadioButton('mode', 'Station', '駅', () => {
      editorMode = 'Station';
    }),
    createRadioButton('mode', 'Info', '情報', () => {
      editorMode = 'Info';
    }),
  ];

  const radioButtonDiv = createRadioButtonDiv('radio-button-div', ...radioButtons);
  controlDiv.appendChild(radioButtonDiv);
  // デフォルトで作成モードにする
  (radioButtons[0].firstChild as Element).setAttribute('checked', '');

  // 空のinfoPanelを作成
  const infoPanel = document.createElement('div');
  infoPanel.id = 'info-panel';
  controlDiv.appendChild(infoPanel);

  drawEditor(trainMove, map);

  loadData();
}

function onmousemove(e: MouseEvent) {
  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const mapPosition = mouseToMapPosition({ x, y });
  if (mapPosition.x >= 0 && mapPosition.x < MapWidth && mapPosition.y >= 0 && mapPosition.y < MapHeight) {
    const mouseMoveCell = map[mapPosition.x][mapPosition.y];
    drawEditor(trainMove, map, mouseStartCell, mouseMoveCell);
  }
}

function setStation(cell: Cell) {
  const tracks = cell.lineType?.tracks ?? [];
  if (tracks.length > 0) {
    const track = tracks[0];

    const id = generateId();
    track.track.station = {
      stationId: id,
      stationName: '駅' + id,
      shouldDepart: () => false,
    };
    track.reverseTrack.track.station = track.track.station;
  }
}

let timetable: Timetable = {
  stationTTItems: [],
  switchTTItems: [],
};

function showInfoPanel(cell: Cell, timetable: Timetable) {
  if (cell.lineType?.lineClass === 'Branch') {
    const Switch = cell.lineType.switch;

    globalObject.Switch = Switch;
    globalObject.timetable = timetable;
    globalObject.trains = trains;
    globalObject.editorMode = 'SwitchEditor';
    globalObject.setUpdate!([]);
  } else if (
    cell.lineType?.lineClass != null &&
    cell.lineType?.tracks.length > 0 &&
    cell.lineType?.tracks[0].track.station !== null
  ) {
    const station = cell.lineType.tracks[0].track.station;

    globalObject.station = station;
    globalObject.timetable = timetable;
    globalObject.trains = trains;
    globalObject.editorMode = 'StationEditor';
    globalObject.setUpdate!([]);
  }
}

function onmousedown(e: MouseEvent) {
  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const mapPosition = mouseToMapPosition({ x, y });
  if (mapPosition.x >= 0 && mapPosition.x < MapWidth && mapPosition.y >= 0 && mapPosition.y < MapHeight) {
    if (editorMode === 'Info') {
      showInfoPanel(map[mapPosition.x][mapPosition.y], timetable);
      return;
    } else if (editorMode === 'Station') {
      mouseDragMode = 'Station';
    } else {
      mouseDragMode = 'Create';
    }

    if (mouseDragMode === 'Station') {
      setStation(map[mapPosition.x][mapPosition.y]);
    } else {
      mouseStartCell = map[mapPosition.x][mapPosition.y];
    }
  }

  drawEditor(trainMove, map, mouseStartCell);
}

function onmouseup(e: MouseEvent) {
  if (!mouseStartCell) return;

  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const mapPosition = mouseToMapPosition({ x, y });
  if (mapPosition.x >= 0 && mapPosition.x < MapWidth && mapPosition.y >= 0 && mapPosition.y < MapHeight) {
    const mouseEndCell = map[mapPosition.x][mapPosition.y];

    if (mouseDragMode === 'Create') {
      const result = createLine(map, mouseStartCell, mouseEndCell);
      // console.warn(result?.error);
      if ('error' in result) {
        console.warn(result.error);
      } else {
        const [tracks, switches] = result;
        trainMove.tracks.push(...tracks);
        trainMove.switches.push(...switches);
      }
    } else if (mouseDragMode === 'Delete') {
      // deleteLine(map, mouseStartCell, mouseEndCell)
    }
    drawEditor(trainMove, map);
    // draw(trainMove, null, null);
  }
  drawEditor(trainMove, map);

  mouseStartCell = null;
}
