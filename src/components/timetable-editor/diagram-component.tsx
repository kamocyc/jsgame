import { useEffect } from 'react';
import { Stage } from 'react-konva';
import { useRecoilState, useRecoilValue } from 'recoil';
import { nn } from '../../common';
import { copyTrains, deleteTrains, pasteTrains } from '../konva-diagram-editor/diagram-core';
import { DiagramProps } from '../konva-diagram-editor/drawer-util';
import {
  canvasHeight,
  isStationExpandedAtom,
  stageStateAtom,
  stationIdsAtom,
  stationsAtom,
} from '../konva-diagram-editor/konva-util';
import { MainViewKonva } from '../konva-diagram-editor/stage-konva';
import { StationViewKonva } from '../konva-diagram-editor/station-view-konva';
import { getDragStartTimes, setDraggingPoint } from '../konva-diagram-editor/train-collection-konva';

export function KonvaCanvas(props: DiagramProps) {
  const [, setIsStationExpanded] = useRecoilState(isStationExpandedAtom);
  const [stations, setStationsAtom] = useRecoilState(stationsAtom);
  const [selectedTrainIds, setSelectedTrainIds] = useRecoilState(stationIdsAtom);
  const stageState = useRecoilValue(stageStateAtom);
  const stageY = stageState.y;

  useEffect(() => {
    setStationsAtom(props.stations);
    setSelectedTrainIds(props.stationIds);
    setIsStationExpanded(new Map<string, boolean>([...props.stations.values()].map((s) => [s.stationId, false])));
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
          setDraggingPoint(selectedTrainIds, props.trains, timeDiff, startTimes);

          e.preventDefault();
        }
        if (e.key === 'ArrowRight') {
          const startTimes = getDragStartTimes(selectedTrainIds, props.trains);
          const timeDiff = 1 * 15;
          setDraggingPoint(selectedTrainIds, props.trains, timeDiff, startTimes);

          e.preventDefault();
        }
      }}
      // Ctrl+Vを取得する
      onKeyUp={(e) => {
        if (e.ctrlKey && e.key === 'v') {
          pasteTrains(props);
        }
      }}
      tabIndex={-1}
      style={{ display: 'flex' }}
    >
      {stations.size === 0 ? (
        <></>
      ) : (
        <>
          <Stage y={stageY} width={200} height={canvasHeight}>
            <StationViewKonva />
          </Stage>
          <MainViewKonva diagramProps={props} clientHeight={1000 /*dummy*/} clientWidth={canvasHeight} />
        </>
      )}
    </div>
  );
}
