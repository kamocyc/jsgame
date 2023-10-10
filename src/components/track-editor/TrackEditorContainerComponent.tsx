import { useState } from 'preact/hooks';
import { AppStates, Cell, EditorDialogMode } from '../../mapEditorModel';
import { DetailedTimetable, Platform, Point, Switch } from '../../model';
import { ConstructType, TerrainType } from '../extendedMapModel';
import { StationEditor, SwitchEditor } from './StationSwitchEditorComponent';
import { StoreTrainInfoPanel } from './StoredTrainInfoPanel';
import { MouseDragMode, onmousedown, onmousemove, onmouseup, onwheel } from './trackEditorContainerCore';
import { StoredTrain } from './trainMoveBase';

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
  numberOfLines,
  constructType,
  terrainType,
  update,
  setToast,
}: {
  appStates: AppStates;
  numberOfPlatforms: number;
  numberOfLines: number;
  constructType: ConstructType;
  terrainType: TerrainType;
  update: () => void;
  setToast: (toast: string) => void;
}) {
  const [editorDialogMode, setEditorDialogMode] = useState<EditorDialogMode | null>(null);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [Switch, setSwitch] = useState<Switch | null>(null);
  const [mouseStartCell, setMouseStartCell] = useState<Cell | null>(null);
  const [mouseStartPoint, setMouseStartPoint] = useState<Point | null>(null);
  const [mouseDragMode, setMouseDragMode] = useState<MouseDragMode | null>(null);
  const [dragMoved, setDragMoved] = useState<boolean>(false);
  const [selectedTrain, setSelectedTrain] = useState<StoredTrain | null>(null);

  return (
    <>
      <canvas
        id='canvas'
        width='1010'
        // width='600'
        height='310'
        onMouseDown={(e) => {
          onmousedown(
            e,
            appStates,
            selectedTrain,
            numberOfPlatforms,
            numberOfLines,
            constructType,
            terrainType,
            setEditorDialogMode,
            setPlatform,
            setSwitch,
            setMouseStartCell,
            setMouseStartPoint,
            setMouseDragMode,
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

      <div>
        {appStates.editMode === 'PlaceTrain' ? (
          <StoreTrainInfoPanel
            storedTrains={appStates.storedTrains}
            railwayLines={appStates.railwayLines}
            setStoredTrains={(storedTrains) => {
              appStates.storedTrains = storedTrains;
              update();
            }}
            selectedPlacedTrainId={selectedTrain?.placedTrainId ?? null}
            setSelectedPlacedTrainId={(id) => {
              setSelectedTrain(appStates.storedTrains.find((train) => train.placedTrainId === id) ?? null);
            }}
          />
        ) : (
          <> </>
        )}
      </div>
    </>
  );
}
