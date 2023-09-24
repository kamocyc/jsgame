import { useState } from 'preact/hooks';
import { deepEqual } from '../../common';
import {
  AppStates,
  Cell,
  CellHeight,
  CellWidth,
  EditorDialogMode,
  ExtendedGameMap,
  GameMap,
  MapContext,
} from '../../mapEditorModel';
import {
  DefaultStationDistance,
  Depot,
  DetailedTimetable,
  Platform,
  Point,
  Station,
  Switch,
  Track,
  generateId,
} from '../../model';
import { getMidPoint, isHitLine } from '../../trackUtil';
import { ConstructType, ExtendedCell, ExtendedCellConstruct, ExtendedCellRoad } from '../extendedMapModel';
import { StationEditor, SwitchEditor, TrainSelector } from './StationSwitchEditorComponent';
import { searchTrackPath } from './timetableConverter';
import { createLine, deleteLine, deleteStation, getAllTracks, validateAppState } from './trackEditor';
import { drawEditor } from './trackEditorDrawer';
import { StoredTrain, TrainMove } from './trainMove';
import { LineInfoPanel } from './LineInfoPanelComponent';

type MouseDragMode = 'Create' | 'Delete' | 'MoveMap' | 'SetPlatform' | 'Road';

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

function placeTrain(
  trainMove: TrainMove,
  mapTotalHeight: number,
  cell: Cell,
  mousePoint: Point,
  selectedTrain: StoredTrain
) {
  const hitTracks = getHitTracks(mapTotalHeight, cell, mousePoint);
  if (hitTracks.length === 0) {
    // trackがないところには置けない
    return false;
  }
  const hitTrack = hitTracks[0];

  if (trainMove.placedTrains.some((placedTrain) => placedTrain.track.trackId === hitTrack.trackId)) {
    // すでに置かれているところには置けない
    return false;
  }

  const position = getMidPoint(hitTrack.begin, hitTrack.end);

  trainMove.placedTrains.push({
    ...selectedTrain,
    train: null,
    speed: 10,  /* 加速す料にしたいところ*/
    stationWaitTime: 0,
    stationStatus: 'NotArrived',
    track: hitTrack,
    position: position,
    operation: null,
  });

  return true;
}

function createDepot(
  map: GameMap,
  position: Point,
  mapWidth: number,
  mapHeight: number,
  setToast: (message: string) => void
): [Track[], Switch[], Depot] | null {
  const newTracks: Track[] = [];
  const newSwitches: Switch[] = [];
  // const newDepot: Depot[] = [];

  position = { x: position.x, y: position.y };

  if (position.x < 0 || position.x >= mapWidth - 1 || position.y < 0 || position.y >= mapHeight - 1) {
    setToast('positionが範囲外');
    return null;
  }

  const cell1 = map[position.x][position.y];
  const cell2 = map[position.x + 1][position.y];
  const result = createLine(map, cell1, cell2);
  if ('error' in result) {
    setToast(result.error);
    return null;
  }

  const [tracks, switches] = result;

  const newDepot: Depot = {
    depotId: generateId(),
  };

  tracks[0].track.depot = newDepot;
  tracks[0].reverseTrack.track.depot = tracks[0].track.depot;

  newTracks.push(...tracks);
  newSwitches.push(...switches);

  return [newTracks, newSwitches, newDepot];
}

function placeStation(
  map: GameMap,
  position: Point,
  mapWidth: number,
  mapHeight: number,
  numberOfPlatforms: number,
  setToast: (message: string) => void
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
    setToast('positionが範囲外');
    return null;
  }

  // TODO: 下から順に番号が振られるので逆にしてもいい
  for (let i = 0; i < numberOfPlatforms; i++) {
    const cell1 = map[position.x][position.y + i];
    const cell2 = map[position.x + 1][position.y + i];
    const result = createLine(map, cell1, cell2);
    if ('error' in result) {
      setToast(result.error);
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
  if (newPlatforms.length === 1) {
    newStation.defaultOutboundPlatformId = newPlatforms[0].platformId;
    newStation.defaultInboundPlatformId = newPlatforms[0].platformId;
  } else {
    newStation.defaultOutboundPlatformId = newPlatforms[newPlatforms.length / 2 - 1].platformId;
    newStation.defaultInboundPlatformId = newPlatforms[newPlatforms.length / 2].platformId;
  }

  return [newTracks, newSwitches, newStation];
}

function getHitTracks(mapTotalHeight: number, cell: Cell, mousePoint: Point): Track[] {
  const hitStrokeWidth = CellWidth * 0.8;
  
  const results: Track[] = [];

  if (cell.lineType?.lineClass != null) {
    for (const track of cell.lineType.tracks) {
      const isHit = isHitLine(
        mousePoint,
        [track.begin.x, track.begin.y, track.end.x, track.end.y],
        mapTotalHeight,
        hitStrokeWidth
      );
      if (isHit) {
        results.push(track);
      }
    }
  }

  return results;
}

function getPlatformOfCell(mapTotalHeight: number, cell: Cell, mousePoint: Point): [Track, Platform] | null {
  const tracks = getHitTracks(mapTotalHeight, cell, mousePoint);
  const stationTrack = tracks.find((track) => track.track.platform != null);
  if (stationTrack != null) {
    return [stationTrack, stationTrack.track.platform!];
  } else {
    return null;
  }
}

function showInfoPanel(
  mapTotalHeight: number,
  cell: Cell,
  mousePoint: Point,
  setEditorDialogMode: (mode: EditorDialogMode | null) => void,
  setPlatform: (platform: Platform | null) => void,
  setSwitch: (Switch: Switch | null) => void
) {
  const trackAndPlatform = getPlatformOfCell(mapTotalHeight, cell, mousePoint);
  if (trackAndPlatform !== null) {
    setPlatform(trackAndPlatform[1]);
    setEditorDialogMode('StationEditor');
    return;
  }

  if (cell.lineType?.lineClass === 'Branch') {
    const Switch = cell.lineType.switch;
    setSwitch(Switch);
    setEditorDialogMode('SwitchEditor');
    return;
  }
}

function createExtendedMapCell(mapCell: ExtendedCell, constructType: ConstructType) {
  mapCell.type = 'Construct';
  (mapCell as ExtendedCellConstruct).constructType = constructType;
}

function onmousedown(
  e: MouseEvent,
  appStates: AppStates,
  selectedTrain: StoredTrain,
  numberOfPlatforms: number,
  constructType: ConstructType,
  setEditorDialogMode: (mode: EditorDialogMode | null) => void,
  setPlatform: (platform: Platform | null) => void,
  setSwitch: (Switch: Switch | null) => void,
  setMouseStartCell: (cell: Cell | null) => void,
  setMouseStartPoint: (point: Point | null) => void,
  setMouseDragMode: (mode: MouseDragMode | null) => void,
  setShowLineInfoPanel: (show: boolean) => void,
  setToast: (message: string) => void
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
      showInfoPanel(
        appStates.mapContext.mapTotalHeight,
        appStates.map[mapPosition.x][mapPosition.y],
        { x, y },
        setEditorDialogMode,
        setPlatform,
        setSwitch
      );
      return;
    } else if (appStates.editMode === 'PlaceTrain') {
      placeTrain(
        appStates.trainMove,
        appStates.mapContext.mapTotalHeight,
        appStates.map[mapPosition.x][mapPosition.y],
        { x, y },
        selectedTrain
      );
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
        numberOfPlatforms,
        setToast
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
    } else if (appStates.editMode === 'ExtendedMap') {
      createExtendedMapCell(appStates.extendedMap[mapPosition.x][mapPosition.y], constructType);
    } else if (appStates.editMode === 'Road') {
      setMouseDragMode('Road');
      setMouseStartCell(appStates.map[mapPosition.x][mapPosition.y]);
    } else if (appStates.editMode === 'DepotCreate') {
      createDepot(appStates.map, mapPosition, appStates.mapWidth, appStates.mapHeight, setToast);
    } else if (appStates.editMode === 'ShowLine') {
      setShowLineInfoPanel(true);
    } else if (appStates.editMode === 'LineCreate') {
           /* LineCreateは右クリックも使うため、mouseupで処理する */}
    else {
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

function deleteVariousThings(
  mouseStartCell: Cell,
  mouseEndCell: Cell,
  appStates: AppStates,
  setToast: (message: string) => void
) {
  const getPlatformId = (cell1: Cell, cell2: Cell): string | null => {
    const platformId1 =
      cell1.lineType?.tracks.map((track) => track.track.platform?.platformId).filter((x) => x != null) ?? [];
    const platformId2 =
      cell2.lineType?.tracks.map((track) => track.track.platform?.platformId).filter((x) => x != null) ?? [];
    if (platformId1.length === 1 && platformId2.length === 1 && platformId1[0] === platformId2[0]) {
      return platformId1[0] as string;
    } else {
      return null;
    }
  };
  const platformId = getPlatformId(mouseStartCell, mouseEndCell);
  if (platformId !== null) {
    // 駅の削除
    const station = appStates.stations.filter((s) => s.platforms.some((p) => p.platformId === platformId))[0];
    const result = deleteStation(appStates.map, station);
    if (result !== true && 'error' in result) {
      setToast(result.error);
    } else {
      appStates.stations.splice(appStates.stations.indexOf(station), 1);
      appStates.tracks = appStates.map.map((row) => row.map((cell) => cell.lineType?.tracks ?? []).flat()).flat();
      validateAppState(appStates);
    }
    return;
  }

  if (mouseStartCell.lineType !== null || mouseEndCell.lineType !== null) {
    // 線路の削除
    const result = deleteLine(appStates.map, mouseStartCell, mouseEndCell);
    if ('error' in result) {
      setToast(result.error);
    } else {
      appStates.tracks = getAllTracks(appStates.map);
      validateAppState(appStates);
    }
    return;
  }

  const extendedCell = appStates.extendedMap[mouseStartCell.position.x][mouseStartCell.position.y];
  if (extendedCell.type === 'Construct') {
    appStates.extendedMap[mouseStartCell.position.x][mouseStartCell.position.y] = {
      position: { ...extendedCell.position },
      type: 'None',
    };
    return;
  }

  setToast('何も削除できない');
}

function onmouseup(
  e: MouseEvent,
  appStates: AppStates,
  mouseStartCell: null | Cell,
  mouseDragMode: MouseDragMode | null,
  update: () => void,
  setMouseStartCell: (cell: Cell | null) => void,
  setMouseStartPoint: (point: Point | null) => void,
  setMouseDragMode: (mode: MouseDragMode | null) => void,
  setToast: (message: string) => void,
  dragMoved: boolean
) {
  if (mouseDragMode === 'MoveMap') {
    setMouseDragMode(null);
    setMouseStartPoint(null);
    if (dragMoved) {
      return;
    }
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
        setToast(result.error);
      } else {
        const [_tracks, switches] = result;
        appStates.tracks = getAllTracks(appStates.map);
        appStates.switches.push(...switches);
        validateAppState(appStates);
      }
    } else if (mouseDragMode === 'Delete') {
      deleteVariousThings(mouseStartCell, mouseEndCell, appStates, setToast);
    } else if (mouseDragMode === 'Road') {
      const result = createRoad(appStates.extendedMap, mouseStartCell, mouseEndCell);
      if (result !== null && 'error' in result) {
        setToast(result.error);
      } else {
        validateAppState(appStates);
      }
    } else if (appStates.editMode === 'LineCreate') {
      if (e.button === 2) {
        // 選択終了
        if (appStates.currentRailwayLine !== null) {
          appStates.railwayLines.push(appStates.currentRailwayLine);
          appStates.currentRailwayLine = null;
        }
      } else {
      const trackAndPlatform = getPlatformOfCell(
        appStates.mapContext.mapTotalHeight,
        appStates.map[mapPosition.x][mapPosition.y],
        { x, y }
      );
      if (trackAndPlatform === null) {
        console.error('platformがnull');
      } else {
        const error = addPlatformToLine(
          trackAndPlatform[0],
          trackAndPlatform[1],
          appStates.map[mapPosition.x][mapPosition.y],
          appStates
        );
        if (error !== null) {
          setToast(error.error);
        } else {
        }
      }
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
  trains: StoredTrain[] | null;
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
  constructType,
  update,
}: {
  appStates: AppStates;
  numberOfPlatforms: number;
  constructType: ConstructType;
  update: () => void;
}) {
  const [editorDialogMode, setEditorDialogMode] = useState<EditorDialogMode | null>(null);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [Switch, setSwitch] = useState<Switch | null>(null);
  const [mouseStartCell, setMouseStartCell] = useState<Cell | null>(null);
  const [mouseStartPoint, setMouseStartPoint] = useState<Point | null>(null);
  const [mouseDragMode, setMouseDragMode] = useState<MouseDragMode | null>(null);
  const [dragMoved, setDragMoved] = useState<boolean>(false);
  const [selectedTrain, setSelectedTrain] = useState<StoredTrain>(appStates.storedTrains[0]);
  const [showLineInfoPanel, setShowLineInfoPanel] = useState<boolean>(false);

  const setToast = (message: string) => {
    console.warn({ setToast: message });
    appStates.message = message;
    update();

    setTimeout(() => {
      appStates.message = '';
      update();
    }, 3000);
  };

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
            constructType,
            setEditorDialogMode,
            setPlatform,
            setSwitch,
            setMouseStartCell,
            setMouseStartPoint,
            setMouseDragMode,
            setShowLineInfoPanel,
            setToast
          );
          setDragMoved(false);
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
            setMouseDragMode,
            setToast,
            dragMoved
          )
        }
        onMouseMove={(e) => {
          onmousemove(e, appStates, mouseStartCell, mouseStartPoint, mouseDragMode, setMouseStartPoint, update);
          setDragMoved(true);
        }}
        onContextMenu={(e) => e.preventDefault()}
        onWheel={(e) => {
          /* TODO: 邪魔なのでいったんコメントアウト */
          onwheel(e, appStates, update);
        }}
      ></canvas>
      <EditorContainer
        timetable={appStates.detailedTimetable}
        update={update}
        trains={appStates.storedTrains}
        Switch={Switch}
        editorDialogMode={editorDialogMode}
        setPlatform={setPlatform}
        platform={platform}
      />
      (showLineInfoPanel ? (
        <div className='dialog'>
          <LineInfoPanel
            railwayLines={appStates.railwayLines}
            selectedRailwayLineId={appStates.selectedRailwayLineId}
            setSelectedRailwayLineId={(id) => {
              appStates.selectedRailwayLineId = id;
              update();
            }}
            />
            </div>
      ) : (<></>)
      )

      <div>
        {appStates.editMode === 'PlaceTrain' ? (
          <TrainSelector trains={appStates.storedTrains} selectedTrain={selectedTrain} setSelectedTrain={setSelectedTrain} />
        ) : (
          <> </>
        )}
      </div>
    </>
  );
}

function createRoad(
  map: ExtendedGameMap,
  mouseStartCell: Cell,
  mouseEndCell: Cell
): {
  error: string;
} | null {
  if (deepEqual(mouseStartCell.position, mouseEndCell.position)) {
    return { error: '同じセル' };
  }

  if (mouseStartCell.position.x === mouseEndCell.position.x) {
    if (mouseStartCell.position.y > mouseEndCell.position.y) {
      const tmp = mouseStartCell;
      mouseStartCell = mouseEndCell;
      mouseEndCell = tmp;
    }

    const x = mouseStartCell.position.x;
    for (let y = mouseStartCell.position.y; y <= mouseEndCell.position.y; y++) {
      map[x][y].type = 'Road';
      const cell = map[x][y] as ExtendedCellRoad;
      if (y !== mouseStartCell.position.y) {
        cell.topRoad = true;
      }
      if (y !== mouseEndCell.position.y) {
        cell.bottomRoad = true;
      }
    }

    return null; // OK
  } else if (mouseStartCell.position.y === mouseEndCell.position.y) {
    if (mouseStartCell.position.x > mouseEndCell.position.x) {
      const tmp = mouseStartCell;
      mouseStartCell = mouseEndCell;
      mouseEndCell = tmp;
    }

    const y = mouseStartCell.position.y;
    for (let x = mouseStartCell.position.x; x <= mouseEndCell.position.x; x++) {
      map[x][y].type = 'Road';
      const cell = map[x][y] as ExtendedCellRoad;
      if (x !== mouseStartCell.position.x) {
        cell.leftRoad = true;
      }
      if (x !== mouseEndCell.position.x) {
        cell.rightRoad = true;
      }
    }

    return null; // OK
  } else {
    return { error: '斜め' };
  }
}

export function commitRailwayLine(appStates: AppStates) {
  const railwayLine = appStates.currentRailwayLine;
  if (railwayLine !== null) {
    appStates.railwayLines.push(railwayLine);
    appStates.currentRailwayLine = null;
  }
}

// まずはTFベースの仕組み。そのうち改良
// 環状線はとりあえずは無いとする。（片側だけは無い）。駅単位で追加する。駅と駅の間の経路はどうするか。 => いずれか経路があればいいとする。いや、プラットフォーム指定。
// 「路線」
// appStates.currentRailwayLine を破壊的に変更する
export function addPlatformToLine(
  platformTrack: Track,
  platform: Platform,
  cell: Cell,
  appStates: AppStates
): { error: string } | null {
  if (appStates.currentRailwayLine === null) {
    const id = generateId();

    appStates.currentRailwayLine = {
      railwayLineId: id,
      railwayLineName: '路線' + id,
      railwayLineColor: 'black',
      stops: [
        {
          platform: platform,
          platformPaths: null,
          platformTrack: platformTrack,
        },
      ],
    };
  } else {
    const stops = appStates.currentRailwayLine.stops;
    const pathToNewStop = searchTrackPath(stops[stops.length - 1].platformTrack, platformTrack);
    if (pathToNewStop == null) {
      return {
        error: 'addPlatformToLine (no path)',
      };
    }
    // １つ前のパスを、現在の駅までのパスにする。
    stops[stops.length - 1].platformPaths = pathToNewStop;

    // 1周するパスを取得
    const pathToLoop = searchTrackPath(platformTrack, stops[0].platformTrack);
    stops.push({
      platform: platform,
      platformPaths: pathToLoop ?? null,
      platformTrack: platformTrack,
    });
  }

  return null;
}
