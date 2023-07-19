import { useState } from 'preact/hooks';
import { AppStates, Cell, CellHeight, CellWidth, EditorDialogMode, GameMap, MapContext } from '../../mapEditorModel';
import {
  DefaultStationDistance,
  DetailedTimetable,
  Platform,
  Point,
  Station,
  Switch,
  Track,
  Train,
  generateId,
} from '../../model';
import { getMidPoint } from '../../trackUtil';
import { StationEditor, SwitchEditor, TrainSelector } from './StationSwitchEditorComponent';
import { createLine, deleteLine, deleteStation, validateAppState } from './trackEditor';
import { drawEditor } from './trackEditorDrawer';
import { TrainMove2 } from './trainMove2';

type MouseDragMode = 'Create' | 'Delete' | 'MoveMap' | 'SetPlatform' | 'StationDelete';

function mouseToMapPosition(
  mousePoint: Point,
  mapWidth: number,
  mapHeight: number,
  mapContext: MapContext
): null | Point {
  const mapPosition = {
    x: Math.floor(mousePoint.x / CellWidth),
    y: Math.floor((mapContext.mapTotalHeight - mousePoint.y) / CellHeight),
  };
  if (mapPosition.x >= 0 && mapPosition.x < mapWidth && mapPosition.y >= 0 && mapPosition.y < mapHeight) {
    return mapPosition;
  } else {
    return null;
  }
}

function createPlatform(cell: Cell): [Platform, Station] | undefined {
  const tracks = cell.lineType?.tracks ?? [];
  if (tracks.length > 0) {
    const track = tracks[0];

    const id = generateId();

    const newStation: Station = {
      stationId: generateId(),
      stationName: '駅' + generateId(),
      platforms: [],
      distance: DefaultStationDistance,
      defaultInboundPlatformId: id,
      defaultOutboundPlatformId: id,
    };

    const newPlatform = {
      platformId: id,
      platformName: '駅' + id,
      station: newStation,
      shouldDepart: null,
    };
    track.track.platform = newPlatform;
    track.reverseTrack.track.platform = track.track.platform;

    newStation.platforms.push(newPlatform);

    return [newPlatform, newStation];
  }
}

function placeTrain(cell: Cell, trainMove: TrainMove2, selectedTrain: Train) {
  if (!cell.lineType?.tracks[0]) {
    return false;
  }

  const track = cell.lineType?.tracks[0];
  const position = getMidPoint(track.begin, track.end);

  const moveTrain = trainMove.placedTrains.find((train) => train.train.trainId === selectedTrain.trainId);
  if (moveTrain === undefined) {
    trainMove.placedTrains.push({
      train: selectedTrain,
      speed: 10,
      stationWaitTime: 0,
      stationStatus: 'NotArrived',
      track: cell.lineType?.tracks[0],
      position: position,
      placedTrainId: generateId(),
    });
  } else {
    moveTrain.track = cell.lineType?.tracks[0];
    moveTrain.position = position;
  }

  return true;
}

function placeStation(
  map: GameMap,
  position: Point,
  mapWidth: number,
  mapHeight: number,
  numberOfPlatforms: number
): [Track[], Switch[], Station] | null {
  const newTracks: Track[] = [];
  const newSwitches: Switch[] = [];
  const newPlatforms: Platform[] = [];

  const newStation = {
    stationId: generateId(),
    stationName: '-',
    platforms: [],
  } as unknown as Station;

  position = { x: position.x, y: position.y - numberOfPlatforms + 1 };

  if (
    position.x < 0 ||
    position.x >= mapWidth - 1 ||
    position.y < 0 ||
    position.y >= mapHeight + numberOfPlatforms - 1
  ) {
    console.warn('positionが範囲外');
    return null;
  }

  // TODO: 下から順に番号が振られるので逆にしてもいい
  for (let i = 0; i < numberOfPlatforms; i++) {
    const cell1 = map[position.x][position.y + i];
    const cell2 = map[position.x + 1][position.y + i];
    const result = createLine(map, cell1, cell2);
    if ('error' in result) {
      console.warn(result.error);
      return null;
    }

    const [tracks, switches] = result;

    const newPlatform = {
      platformId: generateId(),
      platformName: (i + 1).toString(),
      station: newStation,
      shouldDepart: null,
    };
    tracks[0].track.platform = newPlatform;
    tracks[0].reverseTrack.track.platform = tracks[0].track.platform;

    newStation.platforms.push(newPlatform);

    newTracks.push(...tracks);
    newSwitches.push(...switches);
    newPlatforms.push(newPlatform);
  }

  // stationを完成させる
  newStation.defaultOutboundPlatformId = newPlatforms[0].platformId;
  newStation.defaultInboundPlatformId =
    newPlatforms.length >= 2 ? newPlatforms[1].platformId : newPlatforms[0].platformId;

  return [newTracks, newSwitches, newStation];
}

function showInfoPanel(
  cell: Cell,
  setEditorDialogMode: (mode: EditorDialogMode | null) => void,
  setPlatform: (platform: Platform | null) => void,
  setSwitch: (Switch: Switch | null) => void
) {
  if (cell.lineType?.lineClass === 'Branch') {
    const Switch = cell.lineType.switch;

    setSwitch(Switch);
    setEditorDialogMode('SwitchEditor');
  } else if (
    cell.lineType?.lineClass != null &&
    cell.lineType?.tracks.length > 0 &&
    cell.lineType?.tracks[0].track.platform !== null
  ) {
    const platform = cell.lineType.tracks[0].track.platform;

    setPlatform(platform as Platform);
    setEditorDialogMode('StationEditor');
  }
}

function onmousedown(
  e: MouseEvent,
  appStates: AppStates,
  selectedTrain: Train,
  numberOfPlatforms: number,
  setEditorDialogMode: (mode: EditorDialogMode | null) => void,
  setPlatform: (platform: Platform | null) => void,
  setSwitch: (Switch: Switch | null) => void,
  setMouseStartCell: (cell: Cell | null) => void,
  setMouseStartPoint: (point: Point | null) => void,
  setMouseDragMode: (mode: MouseDragMode | null) => void
) {
  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
  const x = rrx(e.clientX - rect.left, appStates.mapContext);
  const y = rry(e.clientY - rect.top, appStates.mapContext);

  // 右クリックでドラッグするときは、マップを移動させる
  if (e.button === 2) {
    setMouseStartCell(null);
    setMouseStartPoint({ x, y });
    setMouseDragMode('MoveMap');
    return;
  }

  const mapPosition = mouseToMapPosition({ x, y }, appStates.mapWidth, appStates.mapHeight, appStates.mapContext);
  if (mapPosition != null) {
    if (appStates.editMode === 'Info') {
      showInfoPanel(appStates.map[mapPosition.x][mapPosition.y], setEditorDialogMode, setPlatform, setSwitch);
      return;
    } else if (appStates.editMode === 'PlaceTrain') {
      placeTrain(appStates.map[mapPosition.x][mapPosition.y], appStates.trainMove, selectedTrain);
      return;
    } else if (appStates.editMode === 'SetPlatform') {
      setMouseDragMode('SetPlatform');
      const newPlatform = createPlatform(appStates.map[mapPosition.x][mapPosition.y]);
    } else if (appStates.editMode === 'Station') {
      const result = placeStation(
        appStates.map,
        mapPosition,
        appStates.mapWidth,
        appStates.mapHeight,
        numberOfPlatforms
      );
      if (result) {
        const [newTracks, newSwitches, newStation] = result;
        appStates.tracks.push(...newTracks);
        appStates.switches.push(...newSwitches);
        appStates.stations.push(newStation);
      }
    } else if (appStates.editMode === 'Create') {
      setMouseDragMode('Create');
      setMouseStartCell(appStates.map[mapPosition.x][mapPosition.y]);
    } else if (appStates.editMode === 'Delete') {
      setMouseDragMode('Delete');
      setMouseStartCell(appStates.map[mapPosition.x][mapPosition.y]);
    } else if (appStates.editMode === 'StationDelete') {
      setMouseDragMode('StationDelete');
      setMouseStartCell(appStates.map[mapPosition.x][mapPosition.y]);
    } else {
      console.error('editModeが不正');
    }
  }
}

function onmousemove(
  e: MouseEvent,
  appStates: AppStates,
  mouseStartCell: null | Cell,
  mouseStartPoint: Point | null,
  mouseDragMode: MouseDragMode | null,
  setMouseStartPoint: (point: Point) => void,
  update: () => void
) {
  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
  const x = rrx(e.clientX - rect.left, appStates.mapContext);
  const y = rry(e.clientY - rect.top, appStates.mapContext);

  if (mouseDragMode === 'MoveMap' && mouseStartPoint != null) {
    appStates.mapContext.offsetX += x - mouseStartPoint.x;
    appStates.mapContext.offsetY += y - mouseStartPoint.y;
    const canvasWidth = (e.target as HTMLCanvasElement).clientWidth;
    const canvasHeight = (e.target as HTMLCanvasElement).clientHeight;
    if (appStates.mapContext.mapTotalWidth + appStates.mapContext.offsetX < canvasWidth) {
      appStates.mapContext.offsetX = canvasWidth - appStates.mapContext.mapTotalWidth;
    }
    if (appStates.mapContext.mapTotalHeight + appStates.mapContext.offsetY < canvasHeight) {
      appStates.mapContext.offsetY = canvasHeight - appStates.mapContext.mapTotalHeight;
    }
    if (appStates.mapContext.offsetX > 0) {
      appStates.mapContext.offsetX = 0;
    }
    if (appStates.mapContext.offsetY > 0) {
      appStates.mapContext.offsetY = 0;
    }
    setMouseStartPoint({ x, y });
    update();
    return;
  }

  const mapPosition = mouseToMapPosition({ x, y }, appStates.mapWidth, appStates.mapHeight, appStates.mapContext);
  if (mapPosition != null) {
    const mouseMoveCell = appStates.map[mapPosition.x][mapPosition.y];
    drawEditor(appStates, mouseStartCell, mouseMoveCell);
  }
}

function rrx(x: number, mapContext: MapContext) {
  return x / mapContext.scale - mapContext.offsetX;
}
function rry(y: number, mapContext: MapContext) {
  return y / mapContext.scale - mapContext.offsetY;
}

function onmouseup(
  e: MouseEvent,
  appStates: AppStates,
  mouseStartCell: null | Cell,
  mouseDragMode: MouseDragMode | null,
  update: () => void,
  setMouseStartCell: (cell: Cell | null) => void,
  setMouseStartPoint: (point: Point | null) => void,
  setMouseDragMode: (mode: MouseDragMode | null) => void
) {
  if (mouseDragMode === 'MoveMap') {
    setMouseDragMode(null);
    setMouseStartPoint(null);
    return;
  }

  if (!mouseStartCell) return;

  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
  const x = rrx(e.clientX - rect.left, appStates.mapContext);
  const y = rry(e.clientY - rect.top, appStates.mapContext);

  const mapPosition = mouseToMapPosition({ x, y }, appStates.mapWidth, appStates.mapHeight, appStates.mapContext);
  if (mapPosition != null) {
    const mouseEndCell = appStates.map[mapPosition.x][mapPosition.y];

    if (mouseDragMode === 'Create') {
      const result = createLine(appStates.map, mouseStartCell, mouseEndCell);
      // console.warn(result?.error);
      if ('error' in result) {
        console.warn(result.error);
      } else {
        const [tracks, switches] = result;
        appStates.tracks = appStates.map.map((row) => row.map((cell) => cell.lineType?.tracks ?? []).flat()).flat();
        // appStates.tracks.push(...tracks);
        appStates.switches.push(...switches);
        validateAppState(appStates);
      }
    } else if (mouseDragMode === 'Delete') {
      const result = deleteLine(mouseStartCell, mouseEndCell);
      if ('error' in result) {
        console.warn(result.error);
      } else {
        const [newCell1, newCell2] = result;
        appStates.map[mouseStartCell.position.x][mouseStartCell.position.y].lineType = newCell1;
        appStates.map[mouseEndCell.position.x][mouseEndCell.position.y].lineType = newCell2;
        appStates.tracks = appStates.map.map((row) => row.map((cell) => cell.lineType?.tracks ?? []).flat()).flat();
        validateAppState(appStates);
      }
    } else if (mouseDragMode === 'StationDelete') {
      const platformId1 =
        mouseStartCell.lineType?.tracks.map((track) => track.track.platform?.platformId).filter((x) => x != null) ?? [];
      const platformId2 =
        mouseEndCell.lineType?.tracks.map((track) => track.track.platform?.platformId).filter((x) => x != null) ?? [];

      if (platformId1.length === 1 && platformId2.length === 1 && platformId1[0] === platformId2[0]) {
        const station = appStates.stations.filter((s) => s.platforms.some((p) => p.platformId === platformId1[0]))[0];
        const result = deleteStation(appStates.map, station);
        if (result !== true && 'error' in result) {
          console.warn(result.error);
        } else {
          appStates.stations.splice(appStates.stations.indexOf(station), 1);
          appStates.tracks = appStates.map.map((row) => row.map((cell) => cell.lineType?.tracks ?? []).flat()).flat();
          validateAppState(appStates);
        }
      } else {
        console.warn('駅の削除に失敗しました');
      }
    }
    drawEditor(appStates);
  }
  drawEditor(appStates);

  update();

  setMouseStartCell(null);
  setMouseDragMode(null);
}

function onwheel(e: WheelEvent, appStates: AppStates, update: () => void) {
  e.preventDefault();

  const scaleBy = 1.05;
  const delta = e.deltaY;

  const oldScale = appStates.mapContext.scale;
  const newScale = delta > 0 ? oldScale / scaleBy : oldScale * scaleBy;
  appStates.mapContext.scale = newScale;

  update();
}

export function EditorContainer({
  editorDialogMode,
  timetable,
  trains,
  setPlatform,
  platform,
  Switch,
  update,
}: {
  editorDialogMode: EditorDialogMode | null;
  timetable: DetailedTimetable | null;
  trains: Train[] | null;
  setPlatform: (platform: Platform) => void;
  platform: Platform | null;
  Switch: Switch | null;
  update: () => void;
}) {
  return (
    <>
      {timetable !== null &&
      trains !== null &&
      (editorDialogMode === 'StationEditor' || editorDialogMode === 'SwitchEditor') ? (
        <div className='dialog'>
          {editorDialogMode === 'StationEditor' ? (
            <StationEditor
              update={update}
              timetable={timetable}
              platform={platform!}
              setPlatform={setPlatform}
              trains={trains}
            />
          ) : editorDialogMode === 'SwitchEditor' ? (
            <SwitchEditor timetable={timetable} Switch={Switch!} trains={trains} />
          ) : (
            <></>
          )}
        </div>
      ) : (
        <></>
      )}
    </>
  );
}

export function CanvasComponent({
  appStates,
  numberOfPlatforms,
  update,
}: {
  appStates: AppStates;
  numberOfPlatforms: number;
  update: () => void;
}) {
  const [editorDialogMode, setEditorDialogMode] = useState<EditorDialogMode | null>(null);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [Switch, setSwitch] = useState<Switch | null>(null);
  const [mouseStartCell, setMouseStartCell] = useState<Cell | null>(null);
  const [mouseStartPoint, setMouseStartPoint] = useState<Point | null>(null);
  const [mouseDragMode, setMouseDragMode] = useState<MouseDragMode | null>(null);
  const [selectedTrain, setSelectedTrain] = useState<Train>(appStates.trains[0]);

  return (
    <>
      <canvas
        id='canvas'
        width='1010'
        height='310'
        onMouseDown={(e) => {
          onmousedown(
            e,
            appStates,
            selectedTrain,
            numberOfPlatforms,
            setEditorDialogMode,
            setPlatform,
            setSwitch,
            setMouseStartCell,
            setMouseStartPoint,
            setMouseDragMode
          );
          update();
        }}
        onMouseUp={(e) =>
          onmouseup(
            e,
            appStates,
            mouseStartCell,
            mouseDragMode,
            update,
            setMouseStartCell,
            setMouseStartPoint,
            setMouseDragMode
          )
        }
        onMouseMove={(e) =>
          onmousemove(e, appStates, mouseStartCell, mouseStartPoint, mouseDragMode, setMouseStartPoint, update)
        }
        onContextMenu={(e) => e.preventDefault()}
        onWheel={(e) => {
          /* TODO: 邪魔なのでいったんコメントアウト */
          onwheel(e, appStates, update);
        }}
      ></canvas>
      <EditorContainer
        timetable={appStates.detailedTimetable}
        update={update}
        trains={appStates.trains}
        Switch={Switch}
        editorDialogMode={editorDialogMode}
        setPlatform={setPlatform}
        platform={platform}
      />

      <div>
        {appStates.editMode === 'PlaceTrain' ? (
          <TrainSelector trains={appStates.trains} selectedTrain={selectedTrain} setSelectedTrain={setSelectedTrain} />
        ) : (
          <> </>
        )}
      </div>
    </>
  );
}
