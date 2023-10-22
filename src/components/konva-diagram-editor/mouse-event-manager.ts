import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { Shape, ShapeConfig } from 'konva/lib/Shape';
import { Stage } from 'konva/lib/Stage';
import { Point } from '../../model';
import { getPointerPosition } from './konva-util';

export class MouseEventManager {
  private mousedownStartPoint: null | Point = null;
  private mousedownStartShape: Shape<ShapeConfig> | Stage | null = null;
  private didDragStartCalled: boolean = false;
  private clickHandlerMap: Map<string, (e: KonvaEventObject<MouseEvent>) => void> = new Map();
  private dragStartHandlerMap: Map<string, (e: KonvaEventObject<MouseEvent>) => void> = new Map();
  private dragMoveHandlerMap: Map<string, (e: KonvaEventObject<MouseEvent>) => void> = new Map();
  private dragEndHandlerMap: Map<string, (e: KonvaEventObject<MouseEvent>) => void> = new Map();
  private lastDragMoveTime: number = 0;

  private getHandler(map: Map<string, (e: KonvaEventObject<MouseEvent>) => void>, target: Shape<ShapeConfig> | Stage) {
    while (true) {
      const targetId = target.id();
      const handler = map.get(targetId);
      if (handler !== undefined) {
        return handler;
      }
      const parent = target.getParent();
      if (parent === target) {
        console.log('parent === target');
        return null;
      }
      target = parent;
    }
  }

  constructor(private layer: Konva.Layer) {
    layer.getStage().on('mousedown', (e) => {
      console.log('mousedown');
      this.mousedownStartPoint = getPointerPosition(layer.getStage());
      this.mousedownStartShape = e.target;
      this.didDragStartCalled = false;
    });
    layer.getStage().on('mousemove', (e) => {
      if (this.mousedownStartPoint === null || this.mousedownStartShape === null) return;

      if (!this.didDragStartCalled && this.isClick(this.mousedownStartPoint!, getPointerPosition(layer.getStage()))) {
        return;
      }

      // throttling
      if (Date.now() < this.lastDragMoveTime + 100) return;
      this.lastDragMoveTime = Date.now();

      // console.log({ targetId: e.target.id() });
      if (!this.didDragStartCalled) {
        const handler = this.getHandler(this.dragStartHandlerMap, this.mousedownStartShape);
        if (handler != null) {
          handler(e);
        }
        this.didDragStartCalled = true;
      }

      const handler = this.getHandler(this.dragMoveHandlerMap, this.mousedownStartShape);
      if (handler != null) {
        handler(e);
      }
    });
    layer.getStage().on('mouseup', (e) => {
      if (this.mousedownStartPoint === null || this.mousedownStartShape === null) return;

      if (this.isClick(this.mousedownStartPoint!, getPointerPosition(layer.getStage()))) {
        const handler = this.getHandler(this.clickHandlerMap, this.mousedownStartShape);
        if (handler != null) {
          handler(e);
        }
      } else {
        const handler = this.getHandler(this.dragEndHandlerMap, this.mousedownStartShape);
        if (handler != null) {
          handler(e);
        }
      }

      this.mousedownStartPoint = null;
      this.didDragStartCalled = false;
    });
  }

  private isClick(startPosition: Point, endPosition: Point) {
    return Math.abs(startPosition.x - endPosition.x) < 2 && Math.abs(startPosition.y - endPosition.y) < 2;
  }

  registerClickHandler(shapeId: string, handler: (e: KonvaEventObject<MouseEvent>) => void) {
    this.clickHandlerMap.set(shapeId, handler);
  }
  registerDragStartHandler(shapeId: string, handler: (e: KonvaEventObject<MouseEvent>) => void) {
    this.dragStartHandlerMap.set(shapeId, handler);
  }
  registerDragMoveHandler(shapeId: string, handler: (e: KonvaEventObject<MouseEvent>) => void) {
    this.dragMoveHandlerMap.set(shapeId, handler);
  }
  registerDragEndHandler(shapeId: string, handler: (e: KonvaEventObject<MouseEvent>) => void) {
    this.dragEndHandlerMap.set(shapeId, handler);
  }
}
