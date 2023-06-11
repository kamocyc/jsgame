import { StateUpdater, useState } from 'preact/hooks';
import { Cell, CellHeight, CellWidth, MapHeight, MapWidth } from '../mapEditorModel';
import { Point, Switch, generateId } from '../model';
import { createLine } from '../trackEditor';
import { drawEditor } from '../trackEditorDrawer';
import { AppStates, EditorDialogMode, Station, Timetable, Train } from '../uiEditorModel';
import { StationEditor, SwitchEditor } from './stationEditor';

function mouseToMapPosition(mousePoint: Point) {
  return {
    x: Math.floor(mousePoint.x / CellWidth),
    y: Math.floor((MapHeight * CellHeight - mousePoint.y) / CellHeight),
  };
}

function onmousemove(e: MouseEvent, appStates: AppStates, mouseStartCell: null | Cell) {
  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const mapPosition = mouseToMapPosition({ x, y });
  if (mapPosition.x >= 0 && mapPosition.x < MapWidth && mapPosition.y >= 0 && mapPosition.y < MapHeight) {
    const mouseMoveCell = appStates.map[mapPosition.x][mapPosition.y];
    drawEditor(appStates.trainMove, appStates.map, mouseStartCell, mouseMoveCell);
  }
}

function createStation(cell: Cell) {
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

function showInfoPanel(
  cell: Cell,
  setEditorDialogMode: (mode: EditorDialogMode | null) => void,
  setStation: (station: Station | null) => void,
  setSwitch: (station: Switch | null) => void
) {
  if (cell.lineType?.lineClass === 'Branch') {
    const Switch = cell.lineType.switch;

    setSwitch(Switch);
    setEditorDialogMode('SwitchEditor');
  } else if (
    cell.lineType?.lineClass != null &&
    cell.lineType?.tracks.length > 0 &&
    cell.lineType?.tracks[0].track.station !== null
  ) {
    const station = cell.lineType.tracks[0].track.station;

    setStation(station);
    setEditorDialogMode('StationEditor');
  }
}

function onmousedown(
  e: MouseEvent,
  appStates: AppStates,
  setEditorDialogMode: (mode: EditorDialogMode | null) => void,
  setStation: (station: Station | null) => void,
  setSwitch: (station: Switch | null) => void,
  setMouseStartCell: (cell: Cell | null) => void,
  setMouseDragMode: (mode: 'Create' | 'Delete' | 'Station' | null) => void
) {
  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const mapPosition = mouseToMapPosition({ x, y });
  if (mapPosition.x >= 0 && mapPosition.x < MapWidth && mapPosition.y >= 0 && mapPosition.y < MapHeight) {
    if (appStates.editMode === 'Info') {
      showInfoPanel(appStates.map[mapPosition.x][mapPosition.y], setEditorDialogMode, setStation, setSwitch);
      return;
    } else if (appStates.editMode === 'Station') {
      setMouseDragMode('Station');
      createStation(appStates.map[mapPosition.x][mapPosition.y]);
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
  if (mapPosition.x >= 0 && mapPosition.x < MapWidth && mapPosition.y >= 0 && mapPosition.y < MapHeight) {
    const mouseEndCell = appStates.map[mapPosition.x][mapPosition.y];

    if (mouseDragMode === 'Create') {
      const result = createLine(appStates.map, mouseStartCell, mouseEndCell);
      // console.warn(result?.error);
      if ('error' in result) {
        console.warn(result.error);
      } else {
        const [tracks, switches] = result;
        appStates.trainMove.tracks.push(...tracks);
        appStates.trainMove.switches.push(...switches);
      }
    } else if (mouseDragMode === 'Delete') {
      // deleteLine(map, mouseStartCell, mouseEndCell)
    }
    drawEditor(appStates.trainMove, appStates.map);
    // draw(trainMove, null, null);
  }
  drawEditor(appStates.trainMove, appStates.map);

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
  station: Station | null;
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
  const [station, setStation] = useState<Station | null>(null);
  const [Switch, setSwitch] = useState<Switch | null>(null);
  const [mouseStartCell, setMouseStartCell] = useState<Cell | null>(null);
  const [mouseDragMode, setMouseDragMode] = useState<'Create' | 'Delete' | 'Station' | null>(null);

  return (
    <>
      <canvas
        id='canvas'
        width='2000'
        height='500'
        onMouseDown={(e) =>
          onmousedown(e, appStates, setEditorDialogMode, setStation, setSwitch, setMouseStartCell, setMouseDragMode)
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
    </>
  );
}
