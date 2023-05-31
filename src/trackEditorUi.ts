import { jsonDecycle, jsonRetrocycle } from './common';
import { fromJSON, toJSON } from './jsonSerialize';
import { Cell, CellHeight, CellWidth, Map, MapHeight, MapWidth } from './mapEditorModel';
import { Point, Switch, generateId } from './model';
import { createLine } from './trackEditor';
import { drawEditor } from './trackEditorDrawer';
import { TrainMove } from './trainMove';

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

interface SwitchEditorModel {
  switch: Switch;
  cell: Cell;
  switchType: 'Straight' | 'Branch';
}

let switchEditorModel: SwitchEditorModel | null = null;

export function initializeTrackEditor() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  canvas.onmousedown = onmousedown;
  canvas.onmouseup = onmouseup;
  canvas.onmousemove = onmousemove;

  const controlDiv = document.getElementById('control-div') as HTMLDivElement;
  const saveButton = document.createElement('button');
  saveButton.innerText = '保存';
  saveButton.onclick = () => {
    const trainMoveJson = toJSON(trainMove);
    localStorage.setItem('map', JSON.stringify(jsonDecycle(map)));
    localStorage.setItem('trainMove', trainMoveJson);
    localStorage.setItem('timetable', JSON.stringify(jsonDecycle(timetable)));
    console.log('保存しました');
  };

  const loadButton = document.createElement('button');
  loadButton.innerText = '読み込み';
  loadButton.onclick = () => {
    const mapData = jsonRetrocycle(JSON.parse(localStorage.getItem('map') ?? '[]')) as Cell[][];
    const trainMoveJson = localStorage.getItem('trainMove') ?? '{}';
    const trainMove_ = fromJSON(trainMoveJson) as unknown as TrainMove;
    if (mapData.length !== MapWidth || mapData[0].length !== MapHeight) {
      alert('マップデータが不正です');
      return;
    }
    map = mapData;
    trainMove = trainMove_;
    timetable = jsonRetrocycle(
      JSON.parse(localStorage.getItem('timetable') ?? '{"switchBranches": [], "stationOperations": []}')
    ) as Timetable;

    drawEditor(trainMove, map);
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

function createSwitchEditorUi(
  switchEditorModel: SwitchEditorModel,
  onSaveCallback: (model: SwitchEditorModel) => void
) {
  const infoPanel = document.getElementById('info-panel') as HTMLDivElement;
  infoPanel.innerHTML = '';

  // 分岐方向を選択するラジオボタンを作成
  const switchRadioButtons = [
    createRadioButton('switch', 'Straight', '直進', () => {
      switchEditorModel.switchType = 'Straight';
      onSaveCallback(switchEditorModel);
    }),
    createRadioButton('switch', 'Branch', '分岐', () => {
      switchEditorModel.switchType = 'Branch';
      onSaveCallback(switchEditorModel);
    }),
  ];

  // modelのswitchTypeに応じてラジオボタンを選択する
  if (switchEditorModel.switchType === 'Straight') {
    (switchRadioButtons[0].firstChild as Element).setAttribute('checked', '');
  } else {
    (switchRadioButtons[1].firstChild as Element).setAttribute('checked', '');
  }

  const switchRadioButtonDiv = createRadioButtonDiv('switch-radio-button-div', ...switchRadioButtons);
  infoPanel.appendChild(switchRadioButtonDiv);
}

interface StationEditorModel {
  cell: Cell;
  stationName: string;
  stationId: number;
  operation: 'Stop' | 'Pass';
  startTime: number;
  intervalTime: number;
}

function createStationEditorUi(
  stationEditorModel: StationEditorModel,
  onSaveCallback: (model: StationEditorModel) => void
) {
  const infoPanel = document.getElementById('info-panel') as HTMLDivElement;
  infoPanel.innerHTML = '';

  // 駅名
  const stationNameInput = document.createElement('input');
  stationNameInput.type = 'text';
  stationNameInput.value = stationEditorModel.stationName;
  stationNameInput.onchange = () => {
    stationEditorModel.stationName = stationNameInput.value;
    onSaveCallback(stationEditorModel);
  };
  infoPanel.appendChild(stationNameInput);

  // operation
  const operationRadioButtons = [
    createRadioButton('operation', 'Stop', '停車', () => {
      stationEditorModel.operation = 'Stop';
      onSaveCallback(stationEditorModel);
    }),
    createRadioButton('operation', 'Pass', '通過', () => {
      stationEditorModel.operation = 'Pass';
      onSaveCallback(stationEditorModel);
    }),
  ];

  // modelのoperationに応じてラジオボタンを選択する
  if (stationEditorModel.operation === 'Stop') {
    (operationRadioButtons[0].firstChild as Element).setAttribute('checked', '');
  } else {
    (operationRadioButtons[1].firstChild as Element).setAttribute('checked', '');
  }

  const operationRadioButtonDiv = createRadioButtonDiv('operation-radio-button-div', ...operationRadioButtons);
  infoPanel.appendChild(operationRadioButtonDiv);

  // startTime
  const startTimeInput = document.createElement('input');
  startTimeInput.type = 'number';
  startTimeInput.value = stationEditorModel.startTime.toString();
  startTimeInput.onchange = () => {
    stationEditorModel.startTime = Number(startTimeInput.value);
    onSaveCallback(stationEditorModel);
  };
  infoPanel.appendChild(startTimeInput);

  // intervalTime
  const intervalTimeInput = document.createElement('input');
  intervalTimeInput.type = 'number';
  intervalTimeInput.value = stationEditorModel.intervalTime.toString();
  intervalTimeInput.onchange = () => {
    stationEditorModel.intervalTime = Number(intervalTimeInput.value);
    onSaveCallback(stationEditorModel);
  };
  infoPanel.appendChild(intervalTimeInput);
}

let timetable: Timetable = {
  switchBranches: [],
  stationOperations: [],
};

type BranchSetting = 'Straight' | 'Branch';

interface SwitchBranch {
  switchId: number;
  branch: BranchSetting;
}

interface StationOperation {
  stationId: number;
  operation: 'Stop' | 'Pass';
  startTime: number;
  intervalTime: number;
}

interface Timetable {
  switchBranches: SwitchBranch[];
  stationOperations: StationOperation[];
}

function getTimetableSwitch(timetable: Timetable, switchId: number): SwitchBranch {
  const switchBranch = timetable.switchBranches.find((x) => x.switchId === switchId);
  if (switchBranch) {
    return switchBranch;
  }
  return {
    switchId: switchId,
    branch: 'Straight',
  };
}

function setTimetableSwitch(timetable: Timetable, switchId: number, branch: BranchSetting) {
  const switchBranch = timetable.switchBranches.find((x) => x.switchId === switchId);
  if (switchBranch) {
    switchBranch.branch = branch;
  } else {
    timetable.switchBranches.push({
      switchId: switchId,
      branch: branch,
    });
  }
}

function getTimetableStation(timetable: Timetable, stationId: number): StationOperation {
  const stationOperation = timetable.stationOperations.find((x) => x.stationId === stationId);
  if (stationOperation) {
    return stationOperation;
  }
  return {
    stationId: stationId,
    operation: 'Stop',
    startTime: 0,
    intervalTime: 0,
  };
}

function setTimetableStation(timetable: Timetable, stationId: number, operation: StationOperation) {
  const stationOperation = timetable.stationOperations.find((x) => x.stationId === stationId);
  if (stationOperation) {
    stationOperation.operation = operation.operation;
    stationOperation.startTime = operation.startTime;
    stationOperation.intervalTime = operation.intervalTime;
  } else {
    timetable.stationOperations.push({
      stationId: stationId,
      operation: operation.operation,
      startTime: operation.startTime,
      intervalTime: operation.intervalTime,
    });
  }
}

function showInfoPanel(cell: Cell, timetable: Timetable) {
  if (cell.lineType?.lineClass === 'Branch') {
    const timetableSwitch = getTimetableSwitch(timetable, cell.lineType.switch.switchId);
    const branch = timetableSwitch.branch;
    const switchEditorModel: SwitchEditorModel = {
      cell: cell,
      switch: cell.lineType.switch,
      switchType: branch,
    };

    createSwitchEditorUi(switchEditorModel, (model: SwitchEditorModel) => {
      setTimetableSwitch(timetable, model.switch.switchId, model.switchType);
    });
  } else if (
    cell.lineType?.lineClass != null &&
    cell.lineType?.tracks.length > 0 &&
    cell.lineType?.tracks[0].track.station !== null
  ) {
    const station = cell.lineType.tracks[0].track.station;
    const timetableStation = getTimetableStation(timetable, station.stationId);
    const stationEditorModel: StationEditorModel = {
      cell: cell,
      stationId: station.stationId,
      stationName: station.stationName,
      operation: timetableStation.operation,
      startTime: timetableStation.startTime,
      intervalTime: timetableStation.intervalTime,
    };

    createStationEditorUi(stationEditorModel, (model: StationEditorModel) => {
      station.stationName = model.stationName;
      setTimetableStation(timetable, model.stationId, {
        stationId: model.stationId,
        operation: model.operation,
        startTime: model.startTime,
        intervalTime: model.intervalTime,
      });
    });
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
