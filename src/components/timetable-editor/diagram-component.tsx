import { useEffect } from 'react';
import { Stage } from 'react-konva';
import { useRecoilState, useRecoilValue } from 'recoil';
import { DeepReadonly } from 'ts-essentials';
import { nn } from '../../common';
import { StationLike, Train } from '../../model';
import { copyTrains, deleteTrains, pasteTrains } from '../konva-diagram-editor/diagram-core';
import { DiagramProps } from '../konva-diagram-editor/drawer-util';
import {
  allTrainsMapAtom,
  canvasHeight,
  isStationExpandedAtom,
  mouseState,
  stageStateAtom,
  stationCanvasWidthAtom,
  stationIdsAtom,
  stationsAtom,
} from '../konva-diagram-editor/konva-util';
import { MainViewKonva } from '../konva-diagram-editor/stage-konva';
import { StationViewKonva } from '../konva-diagram-editor/station-view-konva';
import { getDragStartTimes, setDraggingPoint } from '../konva-diagram-editor/train-collection-konva';

export function KonvaCanvas(
  props: DiagramProps & { trains: DeepReadonly<Map<string, Train>> } & { stations: DeepReadonly<StationLike[]> }
) {
  const [, setIsStationExpanded] = useRecoilState(isStationExpandedAtom);
  const [stations, setStationsAtom] = useRecoilState(stationsAtom);
  const [selectedTrainIds, setSelectedTrainIds] = useRecoilState(stationIdsAtom);
  const stageState = useRecoilValue(stageStateAtom);
  const stageY = stageState.y;
  const [trains, setTrains] = useRecoilState(allTrainsMapAtom);
  const stationCanvasWidth = useRecoilValue(stationCanvasWidthAtom);

  const minTime = Math.min(
    ...(
      [...trains.values()].map((train) =>
        train.diaTimes
          .map((diaTime) => [diaTime.arrivalTime, diaTime.departureTime])
          .flat()
          .filter((t) => t !== null)
      ) as number[][]
    ).flat()
  );

  useEffect(() => {
    setTrains(props.trains);
  }, [props.trains]);

  useEffect(() => {
    setStationsAtom(props.stations);
    setSelectedTrainIds(props.stationIds);
    setIsStationExpanded(new Map<string, boolean>(stations.map((s) => [s.stationId, false])));
  }, [props.stations]);

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
      }}
      // Ctrl+Cを取得する
      onKeyDown={(e) => {
        if (e.ctrlKey && e.key === 'c') {
          const trains = selectedTrainIds.map((id) => nn(props.trains.get(id)));
          copyTrains(props, trains);
        }
        // delete keyを取得
        if (e.key === 'Delete') {
          const trains = selectedTrainIds.map((id) => nn(props.trains.get(id)));
          deleteTrains(props, trains);
          setSelectedTrainIds([]);
        }
        if (e.key === 'ArrowLeft') {
          const startTimes = getDragStartTimes(selectedTrainIds, props.trains);
          const timeDiff = -1 * 15;
          props.crudTrain.setTrains((trains) => {
            setDraggingPoint(selectedTrainIds, trains, timeDiff, startTimes);
          });

          e.preventDefault();
        }
        if (e.key === 'ArrowRight') {
          const startTimes = getDragStartTimes(selectedTrainIds, props.trains);
          const timeDiff = 1 * 15;
          props.crudTrain.setTrains((trains) => {
            setDraggingPoint(selectedTrainIds, trains, timeDiff, startTimes);
          });

          e.preventDefault();
        }
      }}
      // Ctrl+Vを取得する
      onKeyUp={(e) => {
        if (e.ctrlKey && e.key === 'v') {
          pasteTrains(props);
        }
      }}
      onMouseDown={() => {
        mouseState.isMouseDown = true;
      }}
      onMouseUp={() => {
        mouseState.isMouseDown = false;
      }}
      tabIndex={-1}
      style={{ display: 'flex' }}
    >
      {stations.length === 0 ? (
        <></>
      ) : (
        <>
          <Stage y={stageY} width={stationCanvasWidth} height={canvasHeight}>
            <StationViewKonva />
          </Stage>
          <MainViewKonva
            diagramProps={props}
            minTime={minTime}
            clientHeight={canvasHeight}
            clientWidth={1000 /*dummy*/}
          />
        </>
      )}
    </div>
  );
}
