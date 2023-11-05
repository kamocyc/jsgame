import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { Shape, ShapeConfig } from 'konva/lib/Shape';
import { Stage } from 'konva/lib/Stage';
import { Point } from '../../model';
import { getPointerPosition } from './konva-util';

type HandlerType = (e: KonvaEventObject<MouseEvent>, target: Shape<ShapeConfig> | Stage) => void;

export class MouseEventManager {
  private mousedownStartPoint: null | Point = null;
  private mousedownStartShape: Shape<ShapeConfig> | Stage | null = null;
  private didDragStartCalled: boolean = false;
  private clickHandlerMap: Map<string, HandlerType> = new Map();
  private dragStartHandlerMap: Map<string, HandlerType> = new Map();
  private dragMoveHandlerMap: Map<string, HandlerType> = new Map();
  private dragEndHandlerMap: Map<string, HandlerType> = new Map();
  private lastDragMoveTime: number = 0;

  private getHandler(map: Map<string, HandlerType>, target: Shape<ShapeConfig> | Stage) {
    while (true) {
      const targetId = target.id();
      const handler = map.get(targetId);
      if (handler !== undefined) {
        return handler;
      }
      const parent = target.getParent();
      if (parent === target || parent === null) {
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
          handler(e, this.mousedownStartShape);
        }
        this.didDragStartCalled = true;
      }

      const handler = this.getHandler(this.dragMoveHandlerMap, this.mousedownStartShape);
      if (handler != null) {
        handler(e, this.mousedownStartShape);
      }
    });
    layer.getStage().on('mouseup', (e) => {
      if (this.mousedownStartPoint === null || this.mousedownStartShape === null) return;

      if (this.isClick(this.mousedownStartPoint!, getPointerPosition(layer.getStage()))) {
        const handler = this.getHandler(this.clickHandlerMap, this.mousedownStartShape);
        if (handler != null) {
          handler(e, this.mousedownStartShape);
        }
      } else {
        const handler = this.getHandler(this.dragEndHandlerMap, this.mousedownStartShape);
        if (handler != null) {
          handler(e, this.mousedownStartShape);
        }
      }

      this.mousedownStartPoint = null;
      this.didDragStartCalled = false;
    });
  }

  deleteDestroyedShape(shapeId: string, map: Map<string, HandlerType>) {
    const results = this.layer.find('#' + shapeId);
    if (results.length === 0) {
      // TODO: 直す
      // console.log('deleted')
      // map.delete(shapeId);
    }
  }

  deleteDestroyedShapes() {
    for (const [shapeId, _] of this.clickHandlerMap.entries()) this.deleteDestroyedShape(shapeId, this.clickHandlerMap);
    for (const [shapeId, _] of this.dragStartHandlerMap.entries())
      this.deleteDestroyedShape(shapeId, this.dragStartHandlerMap);
    for (const [shapeId, _] of this.dragMoveHandlerMap.entries())
      this.deleteDestroyedShape(shapeId, this.dragMoveHandlerMap);
    for (const [shapeId, _] of this.dragEndHandlerMap.entries())
      this.deleteDestroyedShape(shapeId, this.dragEndHandlerMap);
  }

  private isClick(startPosition: Point, endPosition: Point) {
    return Math.abs(startPosition.x - endPosition.x) < 2 && Math.abs(startPosition.y - endPosition.y) < 2;
  }

  registerClickHandler(shapeId: string, handler: HandlerType) {
    this.clickHandlerMap.set(shapeId, handler);
  }
  registerDragStartHandler(shapeId: string, handler: HandlerType) {
    this.dragStartHandlerMap.set(shapeId, handler);
  }
  registerDragMoveHandler(shapeId: string, handler: HandlerType) {
    this.dragMoveHandlerMap.set(shapeId, handler);
  }
  registerDragEndHandler(shapeId: string, handler: HandlerType) {
    this.dragEndHandlerMap.set(shapeId, handler);
  }
}
