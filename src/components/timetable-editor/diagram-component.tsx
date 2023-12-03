import { useEffect } from 'react';
import { Stage } from 'react-konva';
import { useRecoilState, useRecoilValue } from 'recoil';
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

export function KonvaCanvas(props: DiagramProps) {
  const [, setIsStationExpanded] = useRecoilState(isStationExpandedAtom);
  const [stations, setStationsAtom] = useRecoilState(stationsAtom);
  const [, setStationIdsAtom] = useRecoilState(stationIdsAtom);
  const stageState = useRecoilValue(stageStateAtom);
  const stageY = stageState.y;

  useEffect(() => {
    setStationsAtom(props.stations);
    setStationIdsAtom(props.stationIds);
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
          konvaManagerRef.current?.copySelections();
        }
        // delete keyを取得
        if (e.key === 'Delete') {
          konvaManagerRef.current?.deleteSelections();
        }
        if (e.key === 'ArrowLeft') {
          konvaManagerRef.current?.moveSelections(-1, 0);
          e.preventDefault();
        }
        if (e.key === 'ArrowRight') {
          konvaManagerRef.current?.moveSelections(1, 0);
          e.preventDefault();
        }
      }}
      // Ctrl+Vを取得する
      onKeyUp={(e) => {
        if (e.ctrlKey && e.key === 'v') {
          konvaManagerRef.current?.pasteTrains();
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
