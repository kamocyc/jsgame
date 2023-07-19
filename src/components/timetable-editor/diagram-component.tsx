import { useEffect, useRef } from 'preact/hooks';
import {
  DiagramProps,
  copyTrains,
  deleteTrains,
  initializeKonva,
  initializeStationKonva,
  pasteTrains,
} from './diagram-konva-drawer';

export function KonvaCanvas(props: DiagramProps) {
  const stationCanvasWidth = 100;

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const canvas = containerRef.current;
    if (canvas) {
      const stationsCanvas = document.getElementById('stationsCanvas');
      const mainCanvas = document.getElementById('mainCanvas');
      if (!stationsCanvas || !mainCanvas) {
        throw new Error('Canvas not found');
      }
      const stationStage = initializeStationKonva(stationsCanvas as HTMLDivElement, stationCanvasWidth, props);
      initializeKonva(mainCanvas as HTMLDivElement, props, stationStage);
    }
  }, [containerRef]);

  return (
    <div ref={containerRef} style={{ display: 'flex' }}>
      <div id='stationsCanvas' style={{ width: stationCanvasWidth + 'px' }}></div>
      <div
        id='mainCanvas'
        onContextMenu={(e) => {
          e.preventDefault();
        }}
        // Ctrl+Cを取得する
        onKeyDown={(e) => {
          if (e.ctrlKey && e.key === 'c') {
            copyTrains(props);
          }
          // delete keyを取得
          if (e.key === 'Delete') {
            deleteTrains(props);
          }
        }}
        // Ctrl+Vを取得する
        onKeyUp={(e) => {
          if (e.ctrlKey && e.key === 'v') {
            pasteTrains(props);
          }
        }}
        tabIndex={-1}
      ></div>
    </div>
  );
}

export function DiagramPageComponent(props: DiagramProps) {
  return <KonvaCanvas {...props} />;
}
