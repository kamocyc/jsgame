import { ComponentChildren, VNode } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

interface LineProps {
  points: number[];
  stroke: string;
  strokeWidth: number;
}

type ShapeProps = LineProps;

export function Line(props: LineProps) {
  return <></>;
}

interface LayerCanvasProps {
  width: number;
  height: number;
  children: ComponentChildren;
}

export function LayerCanvas(props: LayerCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        (props.children as VNode<ShapeProps>[]).forEach((child) => {
          if ((child.type as any).name === 'Line') {
            const props = child.props as LineProps;

            ctx.beginPath();
            ctx.strokeStyle = props.stroke;
            ctx.lineWidth = props.strokeWidth;
            ctx.moveTo(props.points[0], props.points[1]);
            for (let i = 2; i < props.points.length; i += 2) {
              ctx.lineTo(props.points[i], props.points[i + 1]);
            }
            ctx.stroke();
          }
        });
      }
    }
  }, [ref]);

  return <canvas ref={ref} width={props.width} height={props.height}></canvas>;
}
