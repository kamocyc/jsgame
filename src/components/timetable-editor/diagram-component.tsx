import { useEffect, useRef } from 'preact/hooks';
import { DiagramProps, copyTrains, deleteTrains, initializeKonva, pasteTrains } from './diagram-konva-drawer';
import { StationKonvaManager } from './station-konva';

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
      const stationKonvaManager = new StationKonvaManager(
        stationsCanvas as HTMLDivElement,
        stationCanvasWidth,
        props.diaStations
      );
      initializeKonva(mainCanvas as HTMLDivElement, props, stationKonvaManager);
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
            destroySelections();
            copyTrains(props);
          }
          // delete keyを取得
          if (e.key === 'Delete') {
            destroySelections();
            deleteTrains(props);
          }
        }}
        // Ctrl+Vを取得する
        onKeyUp={(e) => {
          if (e.ctrlKey && e.key === 'v') {
            const newTrains = pasteTrains(props);
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
