import { StateUpdater, useState } from 'preact/hooks';
import { Cell, CellHeight, CellWidth, MapHeight, MapWidth } from '../../mapEditorModel';
import { Point, Switch, generateId } from '../../model';
import { createLine } from '../../trackEditor';
import { drawEditor } from '../../trackEditorDrawer';
import { getMidPoint } from '../../trackUtil';
import { TrainMove2 } from '../../trainMove2';
import { AppStates, EditorDialogMode, Platform, Timetable, Train } from '../../uiEditorModel';
import { StationEditor, SwitchEditor, TrainSelector } from './StationEditorComponent';

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
    drawEditor(appStates.trainMove, appStates.tracks, appStates.map, mouseStartCell, mouseMoveCell);
  }
}

function createStation(cell: Cell) {
  const tracks = cell.lineType?.tracks ?? [];
  if (tracks.length > 0) {
    const track = tracks[0];

    const id = generateId();
    track.track.platform = {
      platformId: id,
      platformName: '駅' + id,
      shouldDepart: () => false,
    };
    track.reverseTrack.track.platform = track.track.platform;
  }
}

function showInfoPanel(
  cell: Cell,
  setEditorDialogMode: (mode: EditorDialogMode | null) => void,
  setStation: (station: Platform | null) => void,
  setSwitch: (station: Switch | null) => void
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

    setStation(platform);
    setEditorDialogMode('StationEditor');
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

function placeStation(cell: Cell, timetable: Timetable) {
  const platformNumber = 2;

  const id = generateId();
  // track.track.station = {
  //   stationId: id,
  //   stationName: '駅' + id,
  //   shouldDepart: () => false,
  // };
  // track.reverseTrack.track.station = track.track.station;
}

function onmousedown(
  e: MouseEvent,
  appStates: AppStates,
  selectedTrain: Train,
  setEditorDialogMode: (mode: EditorDialogMode | null) => void,
  setStation: (station: Platform | null) => void,
  setSwitch: (station: Switch | null) => void,
  setMouseStartCell: (cell: Cell | null) => void,
  setMouseDragMode: (mode: 'Create' | 'Delete' | 'Station' | null) => void
) {
  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const mapPosition = mouseToMapPosition({ x, y });
  if (mapPosition != null) {
    if (appStates.editMode === 'Info') {
      showInfoPanel(appStates.map[mapPosition.x][mapPosition.y], setEditorDialogMode, setStation, setSwitch);
      return;
    } else if (appStates.editMode === 'PlaceTrain') {
      placeTrain(appStates.map[mapPosition.x][mapPosition.y], appStates.trainMove, selectedTrain);
      return;
    } else if (appStates.editMode === 'Station') {
      setMouseDragMode('Station');
      createStation(appStates.map[mapPosition.x][mapPosition.y]);
    } else if (appStates.editMode === 'Station2') {
      placeStation(appStates.map[mapPosition.x][mapPosition.y], appStates.timetable);
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
  mouseDragMode: 'Create' | 'Delete' | 'Station' | null,
  setAppStates: (appStates: AppStates) => void,
  setMouseStartCell: (cell: Cell | null) => void,
  setMouseDragMode: (mode: 'Create' | 'Delete' | 'Station' | null) => void
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
    drawEditor(appStates.trainMove, appStates.tracks, appStates.map);
  }
  drawEditor(appStates.trainMove, appStates.tracks, appStates.map);

  setAppStates(appStates);

  setMouseStartCell(null);
  setMouseDragMode(null);
}

export function EditorContainer({
  editorDialogMode,
  timetable,
  trains,
  station,
  Switch,
}: {
  editorDialogMode: EditorDialogMode | null;
  timetable: Timetable | null;
  trains: Train[] | null;
  station: Platform | null;
  Switch: Switch | null;
}) {
  return (
    <>
      {timetable !== null && trains !== null ? (
        <div style={{ borderStyle: 'solid', borderWidth: '1px' }}>
          {editorDialogMode === 'StationEditor' ? (
            <StationEditor timetable={timetable} station={station!} trains={trains} />
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
  setAppStates,
}: {
  appStates: AppStates;
  setAppStates: StateUpdater<AppStates>;
}) {
  const [editorDialogMode, setEditorDialogMode] = useState<EditorDialogMode | null>(null);
  const [station, setStation] = useState<Platform | null>(null);
  const [Switch, setSwitch] = useState<Switch | null>(null);
  const [mouseStartCell, setMouseStartCell] = useState<Cell | null>(null);
  const [mouseDragMode, setMouseDragMode] = useState<'Create' | 'Delete' | 'Station' | null>(null);
  const [selectedTrain, setSelectedTrain] = useState<Train>(appStates.trains[0]);

  return (
    <>
      <canvas
        id='canvas'
        width='610'
        height='310'
        onMouseDown={(e) =>
          onmousedown(
            e,
            appStates,
            selectedTrain,
            setEditorDialogMode,
            setStation,
            setSwitch,
            setMouseStartCell,
            setMouseDragMode
          )
        }
        onMouseUp={(e) =>
          onmouseup(
            e,
            appStates,
            mouseStartCell,
            mouseDragMode,
            (newAppStates) => {
              setAppStates((appStates: AppStates) => ({ ...appStates, ...newAppStates }));
            },
            setMouseStartCell,
            setMouseDragMode
          )
        }
        onMouseMove={(e) => onmousemove(e, appStates, mouseStartCell)}
      ></canvas>
      <EditorContainer
        timetable={appStates.timetable}
        Switch={Switch}
        editorDialogMode={editorDialogMode}
        station={station}
        trains={appStates.trains}
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
