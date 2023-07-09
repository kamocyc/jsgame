import { useEffect, useRef } from 'preact/hooks';
import { DiagramProps, initializeKonva } from './diagram-konva-drawer';

export function KonvaCanvas(props: DiagramProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (canvas) {
      initializeKonva(canvas, props);
    }
  }, [ref]);

  return <div ref={ref}></div>;
}

export function DiagramPageComponent(props: DiagramProps) {
  return <KonvaCanvas {...props} />;
}
