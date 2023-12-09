import { assert, deepEqual, generatePlaceName, getNewName, getRandomColor, stationDbg } from '../../common';
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
import { Depot, DepotLine, Platform, PlatformLike, Point, Station, Switch, Track, generateId } from '../../model';
import { OutlinedTimetableFunc } from '../../outlinedTimetableData';
import { getMidPoint, isHitLine } from '../../trackUtil';
import { ConstructType, ExtendedCell, ExtendedCellConstruct, ExtendedCellRoad, TerrainType } from '../extendedMapModel';
import { getStationMap } from '../timetable-editor/common-component';
import { getInitialTimetable } from '../timetable-editor/timetable-util';
import { searchTrackPath } from './timetableConverter';
import { createLine, deleteLine, deleteStation, getAllTracks, validateAppState } from './trackEditor';
import { drawEditor } from './trackEditorDrawer';
import { ITrainMove, StoredTrain } from './trainMoveBase';

export type MouseDragMode = 'Create' | 'Delete' | 'MoveMap' | 'SetPlatform' | 'Road';

function rrx(x: number, mapContext: MapContext) {
  return x / mapContext.scale - mapContext.offsetX;
}
function rry(y: number, mapContext: MapContext) {
  return y / mapContext.scale - mapContext.offsetY;
}
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
  if (tracks[0] !== undefined) {
    const track = tracks[0];

    const id = generateId();

    const newStation: Station = {
      stationType: 'Station',
      stationId: generateId(),
      stationName: '駅' + generateId(),
      platforms: [],
      // distance: DefaultStationDistance,
      // defaultInboundPlatformId: id,
      // defaultOutboundPlatformId: id,
    };

    const newPlatform: Platform = {
      platformType: 'Platform',
      platformId: id,
      platformName: '駅' + id,
      stationId: newStation.stationId,
    };
    track.track.platform = newPlatform;
    track.reverseTrack.track.platform = track.track.platform;

    newStation.platforms.push(newPlatform);

    return [newPlatform, newStation];
  }

  return undefined;
}

// 種度づえ連射を置くのはアレだが、後で取り入れるか？
function placeTrain(
  trainMove: ITrainMove,
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

  if (trainMove.getPlacedTrains().some((placedTrain) => placedTrain.track.trackId === hitTrack.trackId)) {
    // すでに置かれているところには置けない
    return false;
  }

  const position = getMidPoint(hitTrack.begin, hitTrack.end);

  // TODO: よくないが。
  // trainMove.getPlacedTrains().push({
  //   ...selectedTrain,
  //   train: null,
  //   speed: 10 /* 加速す料にしたいところ*/,
  //   stationWaitTime: 0,
  //   stationStatus: 'Arrived',
  //   stopId: null,
  //   track: hitTrack,
  //   position: position,
  //   operation: null,
  // });

  return true;
}

function createDepot(
  map: GameMap,
  extendedMap: ExtendedGameMap,
  position: Point,
  mapWidth: number,
  mapHeight: number,
  numberOfLines: number,
  setToast: (message: string) => void
): [Track[], Switch[], Depot] | null {
  const newTracks: Track[] = [];
  const newSwitches: Switch[] = [];
  const newDepotLines: DepotLine[] = [];

  const newDepot: Depot = {
    stationType: 'Depot',
    stationId: generateId(),
    stationName: generatePlaceName(),
    platforms: [],
  };

  position = { x: position.x, y: position.y - numberOfLines + 1 };

  if (position.x < 0 || position.x >= mapWidth - 1 || position.y < 0 || position.y >= mapHeight + numberOfLines - 1) {
    setToast('positionが範囲外');
    return null;
  }

  for (let i = 0; i < numberOfLines; i++) {
    const cell1 = map[position.x][position.y + i];
    const cell2 = map[position.x + 1][position.y + i];
    const result = createLine(map, cell1, cell2, extendedMap);
    if ('error' in result) {
      setToast(result.error);
      return null;
    }

    const [tracks, switches] = result;

    const newDepotLine: DepotLine = {
      platformType: 'DepotLine',
      platformId: generateId(),
      platformName: (i + 1).toString(),
      stationId: newDepot.stationId,
    };
    tracks[0].track.platform = newDepotLine;
    tracks[0].reverseTrack.track.platform = tracks[0].track.platform;

    newDepot.platforms.push(newDepotLine);

    newTracks.push(...tracks);
    newSwitches.push(...switches);
    newDepotLines.push(newDepotLine);
  }

  return [newTracks, newSwitches, newDepot];
}

function placeStation(
  map: GameMap,
  extendedMap: ExtendedGameMap,
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
    stationType: 'Station',
    stationId: generateId(),
    stationName: generatePlaceName(),
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
    const result = createLine(map, cell1, cell2, extendedMap);
    if ('error' in result) {
      setToast(result.error);
      return null;
    }

    const [tracks, switches] = result;

    const newPlatform: Platform = {
      platformType: 'Platform',
      platformId: generateId(),
      platformName: (i + 1).toString(),
      stationId: newStation.stationId,
    };
    tracks[0].track.platform = newPlatform;
    tracks[0].reverseTrack.track.platform = tracks[0].track.platform;

    newStation.platforms.push(newPlatform);

    newTracks.push(...tracks);
    newSwitches.push(...switches);
    newPlatforms.push(newPlatform);
  }

  // // stationを完成させる
  // if (newPlatforms.length === 1) {
  //   newStation.defaultOutboundPlatformId = newPlatforms[0].platformId;
  //   newStation.defaultInboundPlatformId = newPlatforms[0].platformId;
  // } else {
  //   newStation.defaultOutboundPlatformId = newPlatforms[newPlatforms.length / 2 - 1].platformId;
  //   newStation.defaultInboundPlatformId = newPlatforms[newPlatforms.length / 2].platformId;
  // }

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

function getPlatformOfCell(mapTotalHeight: number, cell: Cell, mousePoint: Point): [Track, PlatformLike] | null {
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
  setPlatform: (platform: PlatformLike | null) => void,
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

export function onmousedown(
  e: React.MouseEvent,
  appStates: AppStates,
  selectedTrain: StoredTrain | null,
  numberOfPlatforms: number,
  numberOfLines: number,
  constructType: ConstructType,
  terrainType: TerrainType,
  setEditorDialogMode: (mode: EditorDialogMode | null) => void,
  setPlatform: (platform: PlatformLike | null) => void,
  setSwitch: (Switch: Switch | null) => void,
  setMouseStartCell: (cell: Cell | null) => void,
  setMouseStartPoint: (point: Point | null) => void,
  setMouseDragMode: (mode: MouseDragMode | null) => void,
  setToast: (message: string) => void
) {
  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
  const x = rrx(e.clientX - rect.left, appStates.mapState.mapContext);
  const y = rry(e.clientY - rect.top, appStates.mapState.mapContext);

  const mapPosition = mouseToMapPosition(
    { x, y },
    appStates.mapState.mapWidth,
    appStates.mapState.mapHeight,
    appStates.mapState.mapContext
  );

  // 右クリックでドラッグするときは、マップを移動させる
  if (e.button === 2) {
    if (mapPosition != null) {
      setMouseStartCell(appStates.map[mapPosition.x][mapPosition.y]);
    }
    setMouseStartPoint({ x, y });
    setMouseDragMode('MoveMap');
    return;
  }

  if (mapPosition != null) {
    if (appStates.mapState.editMode === 'Info') {
      showInfoPanel(
        appStates.mapState.mapContext.mapTotalHeight,
        appStates.map[mapPosition.x][mapPosition.y],
        { x, y },
        setEditorDialogMode,
        setPlatform,
        setSwitch
      );
      return;
    } else if (appStates.mapState.editMode === 'PlaceTrain') {
      if (selectedTrain === null) {
        console.error('selectedTrainがnull');
        return;
      } else {
        placeTrain(
          appStates.mapState.trainMove,
          appStates.mapState.mapContext.mapTotalHeight,
          appStates.map[mapPosition.x][mapPosition.y],
          { x, y },
          selectedTrain
        );
        return;
      }
    } else if (appStates.mapState.editMode === 'SetPlatform') {
      setMouseDragMode('SetPlatform');
      const newPlatform = createPlatform(appStates.map[mapPosition.x][mapPosition.y]);
    } else if (appStates.mapState.editMode === 'Station') {
      const result = placeStation(
        appStates.map,
        appStates.mapState.extendedMap,
        mapPosition,
        appStates.mapState.mapWidth,
        appStates.mapState.mapHeight,
        numberOfPlatforms,
        setToast
      );
      if (result) {
        const [newTracks, _, newStation] = result;
        appStates.tracks.push(...newTracks);
        appStates.mapState.stations.push(newStation);
        appStates.outlinedTimetableData._stations = appStates.mapState.stations;
        stationDbg.set(newStation.stationId, newStation);
      }
    } else if (appStates.mapState.editMode === 'Create') {
      setMouseDragMode('Create');
      setMouseStartCell(appStates.map[mapPosition.x][mapPosition.y]);
    } else if (appStates.mapState.editMode === 'Delete') {
      setMouseDragMode('Delete');
      setMouseStartCell(appStates.map[mapPosition.x][mapPosition.y]);
    } else if (appStates.mapState.editMode === 'ExtendedMap') {
      createExtendedMapCell(appStates.mapState.extendedMap[mapPosition.x][mapPosition.y], constructType);
    } else if (appStates.mapState.editMode === 'Road') {
      setMouseDragMode('Road');
      setMouseStartCell(appStates.map[mapPosition.x][mapPosition.y]);
    } else if (appStates.mapState.editMode === 'DepotCreate') {
      const result = createDepot(
        appStates.map,
        appStates.mapState.extendedMap,
        mapPosition,
        appStates.mapState.mapWidth,
        appStates.mapState.mapHeight,
        numberOfLines,
        setToast
      );
      if (result) {
        const [newTracks, newSwitches, _] = result;
        appStates.tracks.push(...newTracks);
      }
    } else if (appStates.mapState.editMode === 'LineCreate') {
      /* LineCreateは右クリックも使うため、mouseupで処理する */
      setMouseStartCell(appStates.map[mapPosition.x][mapPosition.y]);
    } else if (appStates.mapState.editMode === 'SetTerrain') {
      setTerrain(appStates.mapState.extendedMap[mapPosition.x][mapPosition.y], terrainType);
    } else {
      console.error('editModeが不正');
    }
  }
}

export function onmousemove(
  e: React.MouseEvent,
  appStates: AppStates,
  mouseStartCell: null | Cell,
  mouseStartPoint: Point | null,
  mouseDragMode: MouseDragMode | null,
  setMouseStartPoint: (point: Point) => void,
  update: () => void
) {
  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
  const x = rrx(e.clientX - rect.left, appStates.mapState.mapContext);
  const y = rry(e.clientY - rect.top, appStates.mapState.mapContext);

  if (mouseDragMode === 'MoveMap' && mouseStartPoint != null) {
    appStates.mapState.mapContext.offsetX += x - mouseStartPoint.x;
    appStates.mapState.mapContext.offsetY += y - mouseStartPoint.y;
    const canvasWidth = (e.target as HTMLCanvasElement).clientWidth;
    const canvasHeight = (e.target as HTMLCanvasElement).clientHeight;
    if (appStates.mapState.mapContext.mapTotalWidth + appStates.mapState.mapContext.offsetX < canvasWidth) {
      appStates.mapState.mapContext.offsetX = canvasWidth - appStates.mapState.mapContext.mapTotalWidth;
    }
    if (appStates.mapState.mapContext.mapTotalHeight + appStates.mapState.mapContext.offsetY < canvasHeight) {
      appStates.mapState.mapContext.offsetY = canvasHeight - appStates.mapState.mapContext.mapTotalHeight;
    }
    if (appStates.mapState.mapContext.offsetX > 0) {
      appStates.mapState.mapContext.offsetX = 0;
    }
    if (appStates.mapState.mapContext.offsetY > 0) {
      appStates.mapState.mapContext.offsetY = 0;
    }
    setMouseStartPoint({ x, y });
    update();
    return;
  }
  // TODO: まとめて削除とか、線路を引いている間にプレビューとかしたい。

  const mapPosition = mouseToMapPosition(
    { x, y },
    appStates.mapState.mapWidth,
    appStates.mapState.mapHeight,
    appStates.mapState.mapContext
  );
  if (mapPosition != null) {
    const mouseMoveCell = appStates.map[mapPosition.x][mapPosition.y];
    drawEditor(appStates, mouseStartCell, mouseMoveCell);
  }
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
    const station = appStates.mapState.stations.filter((s) => s.platforms.some((p) => p.platformId === platformId))[0];
    const result = deleteStation(appStates.map, station);
    if (result !== true && 'error' in result) {
      setToast(result.error);
    } else {
      assert(appStates.mapState.stations.indexOf(station) !== -1);
      appStates.mapState.stations.splice(appStates.mapState.stations.indexOf(station), 1);
      appStates.outlinedTimetableData._stations = appStates.mapState.stations;
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

  // 建物の削除
  const extendedCell = appStates.mapState.extendedMap[mouseStartCell.position.x][mouseStartCell.position.y];
  if (extendedCell.type === 'Construct') {
    appStates.mapState.extendedMap[mouseStartCell.position.x][mouseStartCell.position.y] = {
      position: { ...extendedCell.position },
      type: 'None',
      terrain: extendedCell.terrain,
    };
    return;
  }

  setToast('何も削除できない');
}

export function onmouseup(
  e: React.MouseEvent,
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
  const x = rrx(e.clientX - rect.left, appStates.mapState.mapContext);
  const y = rry(e.clientY - rect.top, appStates.mapState.mapContext);

  const mapPosition = mouseToMapPosition(
    { x, y },
    appStates.mapState.mapWidth,
    appStates.mapState.mapHeight,
    appStates.mapState.mapContext
  );
  if (mapPosition != null) {
    const mouseEndCell = appStates.map[mapPosition.x][mapPosition.y];

    if (mouseDragMode === 'Create') {
      const result = createLine(appStates.map, mouseStartCell, mouseEndCell, appStates.mapState.extendedMap);
      // console.warn(result?.error);
      if ('error' in result) {
        setToast(result.error);
      } else {
        const [tracks, _] = result;
        appStates.mapState.moneyManager.addMoney(-tracks.length * 10000);
        appStates.tracks = getAllTracks(appStates.map);
        validateAppState(appStates);
      }
    } else if (mouseDragMode === 'Delete') {
      deleteVariousThings(mouseStartCell, mouseEndCell, appStates, setToast);
    } else if (mouseDragMode === 'Road') {
      const result = createRoad(appStates.mapState.extendedMap, mouseStartCell, mouseEndCell);
      if (result !== null && 'error' in result) {
        setToast(result.error);
      } else {
        validateAppState(appStates);
      }
    } else if (appStates.mapState.editMode === 'LineCreate') {
      if (e.button === 2) {
        // 選択終了
        if (appStates.mapState.currentRailwayLine !== null) {
          appStates.railwayLines.push(appStates.mapState.currentRailwayLine);
          const stationMap = getStationMap(appStates.mapState.stations);
          const [timetable, newTrains] = getInitialTimetable(stationMap, appStates.mapState.currentRailwayLine);
          OutlinedTimetableFunc.addTimetable(appStates.outlinedTimetableData, timetable, newTrains);
          appStates.mapState.currentRailwayLine = null;
        }
      } else {
        const trackAndPlatform = getPlatformOfCell(
          appStates.mapState.mapContext.mapTotalHeight,
          appStates.map[mapPosition.x][mapPosition.y],
          { x, y }
        );
        if (trackAndPlatform === null) {
          setToast('プラットフォームがありません');
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

export function onwheel(e: React.WheelEvent, appStates: AppStates, update: () => void) {
  const scaleBy = 1.05;
  const delta = e.deltaY;

  const oldScale = appStates.mapState.mapContext.scale;
  const newScale = delta > 0 ? oldScale / scaleBy : oldScale * scaleBy;
  appStates.mapState.mapContext.scale = newScale;

  update();
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
  const railwayLine = appStates.mapState.currentRailwayLine;
  if (railwayLine !== null) {
    appStates.railwayLines.push(railwayLine);
    appStates.mapState.currentRailwayLine = null;
  }
}

function searchTrackPath2(track1: Track, track2: Track): Track[] | undefined {
  const path = searchTrackPath(track1, track2);
  if (!path) return undefined;

  if (path.length >= 2) {
    if (path[0].end.x !== path[1].begin.x || path[0].end.y !== path[1].begin.y) {
      path[0] = path[0].reverseTrack;
    }
  }

  return path;
}

// まずはTFベースの仕組み。そのうち改良
// 環状線はとりあえずは無いとする。（片側だけは無い）。駅単位で追加する。駅と駅の間の経路はどうするか。 => いずれか経路があればいいとする。いや、プラットフォーム指定。
// 「路線」
// appStates.mapState.currentRailwayLine を破壊的に変更する
export function addPlatformToLine(
  platformTrack: Track,
  platform: PlatformLike,
  cell: Cell,
  appStates: AppStates
): { error: string } | null {
  if (appStates.mapState.currentRailwayLine === null) {
    const id = generateId();

    const newName = getNewName(
      appStates.railwayLines.map((line) => line.railwayLineName),
      '路線'
    );
    const newStop = {
      stopId: generateId(),
      platform: platform,
      platformPaths: null,
      platformTrack: platformTrack,
    };
    appStates.mapState.currentRailwayLine = {
      railwayLineId: id,
      railwayLineName: newName,
      railwayLineColor: getRandomColor(),
      stops: [newStop],
      returnStopId: newStop.stopId,
    };
  } else {
    const stops = appStates.mapState.currentRailwayLine.stops;

    assert(platformTrack.track.platform !== null);
    if (platformTrack.track.platform.platformId === stops[stops.length - 1].platform.platformId) {
      return {
        error: 'addPlatformToLine (same platform)',
      };
    }
    const pathToNewStop = searchTrackPath2(stops[stops.length - 1].platformTrack, platformTrack);
    if (pathToNewStop == null) {
      return {
        error: 'addPlatformToLine (no path)',
      };
    }

    // １つ前のパスを、現在の駅までのパスにする。
    stops[stops.length - 1].platformPaths = pathToNewStop;
    stops[stops.length - 1].platformTrack = pathToNewStop[0];

    // 1周するパスを取得
    const pathToLoop = searchTrackPath2(platformTrack, stops[0].platformTrack);
    stops.push({
      stopId: generateId(),
      platform: platform,
      platformPaths: pathToLoop ?? null,
      platformTrack: pathToLoop === undefined ? platformTrack : pathToLoop[0],
    });

    if (pathToLoop !== undefined) {
      if (pathToNewStop[pathToNewStop.length - 1].trackId === pathToLoop[0].reverseTrack.trackId) {
        appStates.mapState.currentRailwayLine.returnStopId = stops[stops.length - 1].stopId;
      }
    }
  }

  return null;
}

function setTerrain(extendedCell: ExtendedCell, terrainType: TerrainType) {
  extendedCell.terrain = terrainType;
}
