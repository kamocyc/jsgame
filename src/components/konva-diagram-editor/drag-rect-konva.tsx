import Konva from 'konva';

import { Rect } from 'react-konva';
import { DeepReadonly } from 'ts-essentials';
import { RectState, generateKonvaId } from './konva-util';

export type DragRectKonvaProps = DeepReadonly<{
  isDragging: boolean;
  dragStartX: number;
  dragStartY: number;
  width: number;
  height: number;
}>;

export function DragRectKonva(props: DragRectKonvaProps) {
  const { isDragging, dragStartX, dragStartY, width, height } = props;
  return isDragging ? (
    <Rect
      stroke='black'
      strokeWidth={1}
      dash={[4, 4]}
      id={generateKonvaId()}
      x={dragStartX}
      y={dragStartY}
      width={width}
      height={height}
    />
  ) : (
    <></>
  );
}

export class DragRectKonva_ {
  private dragRect: Konva.Rect;
  private dragStartPoint: { x: number; y: number } | null = null;
  private width: number = 0;
  private height: number = 0;

  constructor(private parent: Konva.Layer) {
    this.dragRect = new Konva.Rect({
      stroke: 'black',
      strokeWidth: 1,
      dash: [4, 4],
      id: generateKonvaId(),
    });
  }

  getDragRect(): RectState | null {
    if (this.dragStartPoint == null) {
      return null;
    }

    return {
      x: this.dragStartPoint.x,
      y: this.dragStartPoint.y,
      width: this.width,
      height: this.height,
    };
  }

  // setDragStartPoint(point: { x: number; y: number }) {
  //   this.dragStartPoint = {
  //     x: point.x,
  //     y: point.y,
  //   };
  //   this.width = 0;
  //   this.height = 0;

  //   this.parent.add(this.dragRect);

  //   this.updateShape();
  // }

  // isDragging() {
  //   return this.dragStartPoint != null;
  // }

  // setDraggingPoint(point: { x: number; y: number }) {
  //   if (this.dragStartPoint == null) return;

  //   this.width = point.x - this.dragStartPoint.x;
  //   this.height = point.y - this.dragStartPoint.y;

  //   this.updateShape();
  // }
  // getDragStartPoint() {
  //   return this.dragStartPoint;
  // }

  // finishDragging() {
  //   this.dragStartPoint = null;
  //   this.dragRect?.remove();
  // }

  // updateShape() {
  //   if (this.dragStartPoint != null) {
  //     this.dragRect.x(this.dragStartPoint.x);
  //     this.dragRect.y(this.dragStartPoint.y);
  //     this.dragRect.width(this.width);
  //     this.dragRect.height(this.height);
  //   }
  // }
}
