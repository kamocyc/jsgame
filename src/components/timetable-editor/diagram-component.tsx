import { useEffect, useRef } from 'preact/hooks';
import { DiagramProps } from '../konva-diagram-editor/drawer-util';
import { KonvaManager } from '../konva-diagram-editor/konva-manager';

export function KonvaCanvas(props: DiagramProps) {
  const stationCanvasWidth = 100;

  const containerRef = useRef<HTMLDivElement>(null);
  const konvaManagerRef = useRef<KonvaManager | null>(null);
  useEffect(() => {
    const canvas = containerRef.current;
    if (canvas) {
      const stationContainer = document.getElementById('stationsCanvas');
      const mainContainer = document.getElementById('mainCanvas');
      if (!stationContainer || !mainContainer) {
        throw new Error('Canvas not found');
      }

      const konvaManager = new KonvaManager(stationContainer as HTMLDivElement, props, mainContainer as HTMLDivElement);
      konvaManagerRef.current = konvaManager;
    }
  }, [containerRef]);

  return (
    <div ref={containerRef} style={{ display: 'flex' }}>
      <div id='stationsCanvas' style={{ width: stationCanvasWidth + 'px', backgroundColor: '#f9f9f9' }}></div>
      <div
        id='mainCanvas'
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
      ></div>
    </div>
  );
}

export function DiagramPageComponent(props: DiagramProps) {
  return <KonvaCanvas {...props} />;
}
