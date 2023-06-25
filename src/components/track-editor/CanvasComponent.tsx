import { useState } from 'preact/hooks';
import { Cell, CellHeight, CellWidth, GameMap, MapHeight, MapWidth } from '../../mapEditorModel';
import { HalfTrack, Platform, Point, Station, Switch, generateId } from '../../model';
import { getMidPoint } from '../../trackUtil';
import { StationEditor, SwitchEditor, TrainSelector } from './StationEditorComponent';
import { createLine } from './trackEditor';
import { drawEditor } from './trackEditorDrawer';
import { TrainMove2 } from './trainMove2';
import { AppStates, EditorDialogMode, Timetable, Train } from './uiEditorModel';

type MouseDragMode = 'Create' | 'Delete' | 'SetPlatform';

function mouseToMapPosition(mousePoint: Point): null | Point {
  const mapPosition = {
    x: Math.floor(mousePoint.x / CellWidth),
    y: Math.floor((MapHeight * CellHeight - mousePoint.y) / CellHeight),
  };
  if (mapPosition.x >= 0 && mapPosition.x < MapWidth && mapPosition.y >= 0 && mapPosition.y < MapHeight) {
    return mapPosition;
  } else {
    return null;
  }
}

function onmousemove(e: MouseEvent, appStates: AppStates, mouseStartCell: null | Cell) {
  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const mapPosition = mouseToMapPosition({ x, y });
  if (mapPosition != null) {
    const mouseMoveCell = appStates.map[mapPosition.x][mapPosition.y];
    drawEditor(appStates, mouseStartCell, mouseMoveCell);
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
      defaultInboundDiaPlatformId: id,
      defaultOutboundDiaPlatformId: id,
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
  const position = getMidPoint(track._begin, track._end);

  const moveTrain = trainMove.trains.find((train) => train.diaTrain.trainId === selectedTrain.trainId);
  if (moveTrain === undefined) {
    trainMove.trains.push({
      trainId: selectedTrain.trainId,
      diaTrain: selectedTrain,
      speed: 10,
      stationWaitTime: 0,
      stationStatus: 'NotArrived',
      track: cell.lineType?.tracks[0],
      position: position,
    });
  } else {
    moveTrain.track = cell.lineType?.tracks[0];
    moveTrain.position = position;
  }

  return true;
}

function placeStation(map: GameMap, position: Point): [HalfTrack[], Switch[], Station] | null {
  const numberOfPlatforms = 2;

  const newTracks: HalfTrack[] = [];
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
    position.x >= MapWidth - 1 ||
    position.y < 0 ||
    position.y >= MapHeight + numberOfPlatforms - 1
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
  newStation.defaultOutboundDiaPlatformId = newPlatforms[0].platformId;
  newStation.defaultInboundDiaPlatformId =
    newPlatforms.length >= 1 ? newPlatforms[1].platformId : newPlatforms[0].platformId;

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
  setEditorDialogMode: (mode: EditorDialogMode | null) => void,
  setPlatform: (platform: Platform | null) => void,
  setSwitch: (Switch: Switch | null) => void,
  setMouseStartCell: (cell: Cell | null) => void,
  setMouseDragMode: (mode: MouseDragMode | null) => void
) {
  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const mapPosition = mouseToMapPosition({ x, y });
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
      const result = placeStation(appStates.map, mapPosition);
      if (result) {
        const [newTracks, newSwitches, newStation] = result;
        appStates.tracks.push(...newTracks);
        appStates.switches.push(...newSwitches);
        appStates.stations.push(newStation);
      }
    } else {
      setMouseDragMode('Create');
      setMouseStartCell(appStates.map[mapPosition.x][mapPosition.y]);
    }
  }
}

function onmouseup(
  e: MouseEvent,
  appStates: AppStates,
  mouseStartCell: null | Cell,
  mouseDragMode: MouseDragMode | null,
  update: () => void,
  setMouseStartCell: (cell: Cell | null) => void,
  setMouseDragMode: (mode: MouseDragMode | null) => void
) {
  if (!mouseStartCell) return;

  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const mapPosition = mouseToMapPosition({ x, y });
  if (mapPosition != null) {
    const mouseEndCell = appStates.map[mapPosition.x][mapPosition.y];

    if (mouseDragMode === 'Create') {
      const result = createLine(appStates.map, mouseStartCell, mouseEndCell);
      // console.warn(result?.error);
      if ('error' in result) {
        console.warn(result.error);
      } else {
        const [tracks, switches] = result;
        appStates.tracks.push(...tracks);
        appStates.switches.push(...switches);
      }
    } else if (mouseDragMode === 'Delete') {
      // deleteLine(map, mouseStartCell, mouseEndCell)
    }
    drawEditor(appStates);
  }
  drawEditor(appStates);

  update();

  setMouseStartCell(null);
  setMouseDragMode(null);
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
  timetable: Timetable | null;
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

export function CanvasComponent({ appStates, update }: { appStates: AppStates; update: () => void }) {
  const [editorDialogMode, setEditorDialogMode] = useState<EditorDialogMode | null>(null);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [Switch, setSwitch] = useState<Switch | null>(null);
  const [mouseStartCell, setMouseStartCell] = useState<Cell | null>(null);
  const [mouseDragMode, setMouseDragMode] = useState<MouseDragMode | null>(null);
  const [selectedTrain, setSelectedTrain] = useState<Train>(appStates.trains[0]);

  return (
    <>
      <canvas
        id='canvas'
        width='610'
        height='310'
        onMouseDown={(e) => {
          onmousedown(
            e,
            appStates,
            selectedTrain,
            setEditorDialogMode,
            setPlatform,
            setSwitch,
            setMouseStartCell,
            setMouseDragMode
          );
          update();
        }}
        onMouseUp={(e) =>
          onmouseup(e, appStates, mouseStartCell, mouseDragMode, update, setMouseStartCell, setMouseDragMode)
        }
        onMouseMove={(e) => onmousemove(e, appStates, mouseStartCell)}
      ></canvas>
      <EditorContainer
        timetable={appStates.timetable}
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
