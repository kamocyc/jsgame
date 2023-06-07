import { jsonDecycle, jsonRetrocycle } from './common';
import { fromJSON, toJSON } from './jsonSerialize';
import { Cell, CellHeight, CellWidth, Map, MapHeight, MapWidth } from './mapEditorModel';
import { DiaTrain, Point, Switch, generateId } from './model';
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
let trains: DiaTrain[] = [
  {
    trainId: 1,
    name: 'A',
    color: 'red',
    trainTimetable: [],
  },
  {
    trainId: 2,
    name: 'B',
    color: 'black',
    trainTimetable: [],
  },
];

interface SwitchEditorModel {
  switch: Switch;
  cell: Cell;
  operatingTrainId: number;
  switchType: 'Straight' | 'Branch';
}

function saveData() {
  // map = map.map((row) =>
  //   row.map((cell) => ({
  //     ...cell,
  //     lineType: cell.lineType === null ? null : { ...cell.lineType, switch: cell.lineType?.tracks[0]._nextSwitch },
  //   }))
  // );
  const trainMoveJson = toJSON(trainMove);
  localStorage.setItem('map', JSON.stringify(jsonDecycle(map)));
  localStorage.setItem('trainMove', trainMoveJson);
  localStorage.setItem('timetable', JSON.stringify(jsonDecycle(timetable)));
  console.log('保存しました');
}

function loadData() {
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
    (switchRadioButtons[1].firstChild as HTMLInputElement).checked = false;
    (switchRadioButtons[0].firstChild as HTMLInputElement).checked = true;
  } else {
    (switchRadioButtons[0].firstChild as HTMLInputElement).checked = false;
    (switchRadioButtons[1].firstChild as HTMLInputElement).checked = true;
  }

  const switchRadioButtonDiv = createRadioButtonDiv('switch-radio-button-div', ...switchRadioButtons);

  // 列車の選択
  const trainSelect = document.createElement('select');
  trainSelect.id = 'train-select';
  for (const train of trains) {
    const option = document.createElement('option');
    option.value = train.trainId.toString();
    option.innerText = train.name;
    trainSelect.appendChild(option);
  }
  trainSelect.onchange = () => {
    onSaveCallback(switchEditorModel);

    const trainId = parseInt(trainSelect.value);
    const train = trains.find((train) => train.trainId === trainId);
    if (train === undefined) {
      return;
    }
    switchEditorModel.operatingTrainId = trainId;

    const sw = getTimetableSwitch(timetable, switchEditorModel.operatingTrainId, switchEditorModel.switch.switchId);
    if (sw === undefined) {
      return;
    }
    switchEditorModel.switchType = sw.branch;
    if (switchEditorModel.switchType === 'Straight') {
      (switchRadioButtons[1].firstChild as HTMLInputElement).checked = false;
      (switchRadioButtons[0].firstChild as HTMLInputElement).checked = true;
    } else {
      (switchRadioButtons[0].firstChild as HTMLInputElement).checked = false;
      (switchRadioButtons[1].firstChild as HTMLInputElement).checked = true;
    }
  };

  infoPanel.appendChild(trainSelect);
  infoPanel.appendChild(switchRadioButtonDiv);
}

interface StationEditorModel {
  operatingTrainId: number;
  cell: Cell;
  stationName: string;
  stationId: number;
  operation: 'Stop' | 'Pass' | 'NoOperation';
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

  // 列車の選択
  const trainSelect = document.createElement('select');
  trainSelect.id = 'train-select';
  for (const train of trains) {
    const option = document.createElement('option');
    option.value = train.trainId.toString();
    option.innerText = train.name;
    trainSelect.appendChild(option);
  }
  infoPanel.appendChild(trainSelect);

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
    createRadioButton('operation', 'NoOp', '運行無し', () => {
      stationEditorModel.operation = 'NoOperation';
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
  const startTimeGroup = document.createElement('div');
  infoPanel.appendChild(startTimeGroup);

  const startTimeLabel = document.createElement('label');
  startTimeLabel.innerText = '開始時刻';
  startTimeGroup.appendChild(startTimeLabel);

  const startTimeInput = document.createElement('input');
  startTimeInput.type = 'number';
  startTimeInput.style.width = '50px';
  startTimeInput.value = stationEditorModel.startTime.toString();
  startTimeInput.onchange = () => {
    stationEditorModel.startTime = Number(startTimeInput.value);
    onSaveCallback(stationEditorModel);
  };
  startTimeGroup.appendChild(startTimeInput);

  // intervalTime
  const intervalTimeGroup = document.createElement('div');
  infoPanel.appendChild(intervalTimeGroup);

  const intervalTimeLabel = document.createElement('label');
  intervalTimeLabel.innerText = '発車間隔';
  intervalTimeGroup.appendChild(intervalTimeLabel);

  const intervalTimeInput = document.createElement('input');
  intervalTimeInput.type = 'number';
  intervalTimeInput.style.width = '50px';
  intervalTimeInput.value = stationEditorModel.intervalTime.toString();
  intervalTimeInput.onchange = () => {
    stationEditorModel.intervalTime = Number(intervalTimeInput.value);
    onSaveCallback(stationEditorModel);
  };
  intervalTimeGroup.appendChild(intervalTimeInput);
}

let timetable: Timetable = {
  switchBranches: [],
  stationOperations: [],
};

type BranchSetting = 'Straight' | 'Branch';

interface SwitchBranch {
  switchId: number;
  operatingTrainId: number;
  branch: BranchSetting;
}

interface StationOperation {
  stationId: number;
  operatingTrainId: number;
  operation: 'Stop' | 'Pass' | 'NoOperation';
  startTime: number;
  intervalTime: number;
}

interface Timetable {
  switchBranches: SwitchBranch[];
  stationOperations: StationOperation[];
}

function getTimetableSwitch(timetable: Timetable, trainId: number, switchId: number): SwitchBranch {
  const switchBranch = timetable.switchBranches.find((x) => x.operatingTrainId === trainId && x.switchId === switchId);
  if (switchBranch) {
    return switchBranch;
  }
  return {
    switchId: switchId,
    operatingTrainId: trainId,
    branch: 'Straight',
  };
}

function setTimetableSwitch(timetable: Timetable, trainId: number, switchId: number, branch: BranchSetting) {
  const switchBranch = timetable.switchBranches.find((x) => x.operatingTrainId === trainId && x.switchId === switchId);
  if (switchBranch) {
    switchBranch.branch = branch;
  } else {
    timetable.switchBranches.push({
      switchId: switchId,
      operatingTrainId: trainId,
      branch: branch,
    });
  }
}

function getTimetableStation(timetable: Timetable, trainId: number, stationId: number): StationOperation {
  const stationOperation = timetable.stationOperations.find(
    (x) => x.operatingTrainId === trainId && x.stationId === stationId
  );
  if (stationOperation) {
    return stationOperation;
  }
  return {
    stationId: stationId,
    operatingTrainId: trainId,
    operation: 'Stop',
    startTime: 0,
    intervalTime: 0,
  };
}

function setTimetableStation(
  timetable: Timetable,
  operatingTrainId: number,
  stationId: number,
  operation: StationOperation
) {
  const stationOperation = timetable.stationOperations.find(
    (x) => x.operatingTrainId === operatingTrainId && x.stationId === stationId
  );
  if (stationOperation) {
    stationOperation.operation = operation.operation;
    stationOperation.startTime = operation.startTime;
    stationOperation.intervalTime = operation.intervalTime;
  } else {
    timetable.stationOperations.push({
      stationId: stationId,
      operatingTrainId: operatingTrainId,
      operation: operation.operation,
      startTime: operation.startTime,
      intervalTime: operation.intervalTime,
    });
  }
}

function showInfoPanel(cell: Cell, timetable: Timetable) {
  if (cell.lineType?.lineClass === 'Branch') {
    const firstTrainId = trains[0].trainId;
    const timetableSwitch = getTimetableSwitch(timetable, firstTrainId, cell.lineType.switch.switchId);
    const branch = timetableSwitch.branch;
    const switchEditorModel: SwitchEditorModel = {
      operatingTrainId: firstTrainId,
      cell: cell,
      switch: cell.lineType.switch,
      switchType: branch,
    };

    createSwitchEditorUi(switchEditorModel, (model: SwitchEditorModel) => {
      setTimetableSwitch(timetable, model.operatingTrainId, model.switch.switchId, model.switchType);
    });
  } else if (
    cell.lineType?.lineClass != null &&
    cell.lineType?.tracks.length > 0 &&
    cell.lineType?.tracks[0].track.station !== null
  ) {
    const firstTrainId = trains[0].trainId;
    const station = cell.lineType.tracks[0].track.station;
    const timetableStation = getTimetableStation(timetable, firstTrainId, station.stationId);
    const stationEditorModel: StationEditorModel = {
      operatingTrainId: firstTrainId,
      cell: cell,
      stationId: station.stationId,
      stationName: station.stationName,
      operation: timetableStation.operation,
      startTime: timetableStation.startTime,
      intervalTime: timetableStation.intervalTime,
    };

    createStationEditorUi(stationEditorModel, (model: StationEditorModel) => {
      station.stationName = model.stationName;
      setTimetableStation(timetable, model.operatingTrainId, model.stationId, model);
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
