import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { Shape, ShapeConfig } from 'konva/lib/Shape';
import { Stage } from 'konva/lib/Stage';
import { Point } from '../../model';
import { getPointerPosition, mouseState } from './konva-util';

type HandlerType = (e: KonvaEventObject<MouseEvent>, target: Shape<ShapeConfig> | Stage) => void;
type DragHandlerType = (
  e: KonvaEventObject<MouseEvent>,
  target: Shape<ShapeConfig> | Stage,
  dragStartPoint: Point,
  dragStartData: unknown
) => void;
type DragStartHandlerType = (e: KonvaEventObject<MouseEvent>, target: Shape<ShapeConfig> | Stage) => unknown;

export class MouseEventManager {
  private mousedownStartPoint: null | Point = null;
  private mousedownStartShape: Shape<ShapeConfig> | Stage | null = null;
  private mousedownStartButton: number | null = null;
  private didDragStartCalled: boolean = false;

  private clickHandlerMap: Map<string, HandlerType> = new Map();
  private mousemoveHandlerMap: Map<string, HandlerType> = new Map();
  private dblClickHandlerMap: Map<string, HandlerType> = new Map();
  private dragStartHandlerMap: Map<string, DragStartHandlerType> = new Map();
  private dragStartDataMap: Map<string, unknown> = new Map();
  private dragMoveHandlerMap: Map<string, DragHandlerType> = new Map();
  private dragEndHandlerMap: Map<string, DragHandlerType> = new Map();

  private lastDragMoveTime: number = 0;
  private stage: Konva.Stage | null = null;

  private getHandler<T>(map: Map<string, T>, target: Shape<ShapeConfig> | Stage): [T, string] | null {
    while (true) {
      const targetId = target.id();
      const handler = map.get(targetId);
      if (handler != null) {
        return [handler, targetId];
      }
      const parent = target.getParent();
      if (parent === target || parent === null) {
        console.log('parent === target');
        return null;
      }
      target = parent as Shape<ShapeConfig> | Stage;
    }
  }

  setStage(stage: Konva.Stage) {
    this.stage = stage;

    this.removeEventHandlers(stage);
    this.setEventHandlers(stage);
  }

  private removeEventHandlers(stage: Konva.Stage) {
    stage.off('mousedown');
    stage.off('mousemove');
    stage.off('mouseup');
    stage.off('dblclick');
  }

  private setEventHandlers(stage: Konva.Stage) {
    stage.on('dblclick', (e) => {
      const handler = this.getHandler(this.dblClickHandlerMap, e.target);
      if (handler != null) {
        handler[0](e, e.target);
      }
    });

    stage.on('mousedown', (e) => {
      this.mousedownStartPoint = getPointerPosition(stage);
      this.mousedownStartShape = e.target;
      this.didDragStartCalled = false;
      this.mousedownStartButton = e.evt.button;
    });

    const mouseupHandler = (e: KonvaEventObject<MouseEvent>) => {
      if (this.mousedownStartPoint === null || this.mousedownStartShape === null) return;

      if (this.isClick(this.mousedownStartPoint!, getPointerPosition(stage))) {
        const handler = this.getHandler(this.clickHandlerMap, this.mousedownStartShape);
        if (handler != null) {
          handler[0](e, this.mousedownStartShape);
        }
      } else {
        const handler = this.getHandler(this.dragEndHandlerMap, this.mousedownStartShape);
        if (handler != null) {
          handler[0](e, this.mousedownStartShape, this.mousedownStartPoint, this.dragStartDataMap.get(handler[1]));
        }
      }

      this.mousedownStartButton = null;
      this.mousedownStartPoint = null;
      this.didDragStartCalled = false;
    };
    stage.on('mouseup', mouseupHandler);

    stage.on('mousemove', (e) => {
      {
        // mousemove handler
        // 別に組み込みのmousemoveイベントでもいいが、統一性のためにここでやる
        const handler = this.getHandler(this.mousemoveHandlerMap, e.target);
        if (handler != null) {
          handler[0](e, e.target);
        }
      }

      if (this.mousedownStartPoint === null || this.mousedownStartShape === null) return;

      if (!this.didDragStartCalled && this.isClick(this.mousedownStartPoint!, getPointerPosition(stage))) {
        return;
      }

      // throttling
      if (Date.now() < this.lastDragMoveTime + 50) return;
      this.lastDragMoveTime = Date.now();

      if (!mouseState.isMouseDown) {
        mouseupHandler(e);
      }

      // console.log({ targetId: e.target.id() });
      // TODO: eventがbubbleしないので、子要素に乗った時にstageがドラッグされない
      if (!this.didDragStartCalled) {
        const handler = this.getHandler(this.dragStartHandlerMap, this.mousedownStartShape);
        if (handler != null) {
          const result = handler[0](
            { ...e, evt: { ...e.evt, button: this.mousedownStartButton! } },
            this.mousedownStartShape
          );
          this.dragStartDataMap.set(handler[1], result);
        }
        this.didDragStartCalled = true;
      }

      const handler = this.getHandler(this.dragMoveHandlerMap, this.mousedownStartShape);
      if (handler != null) {
        handler[0](e, this.mousedownStartShape, this.mousedownStartPoint, this.dragStartDataMap.get(handler[1]));
      }
    });
  }

  deleteDestroyedShape(shapeId: string, map: Map<string, unknown>) {
    if (this.stage === null) return;

    const results = this.stage.find('#' + shapeId);
    if (results.length === 0) {
      // TODO: 直す
      // console.log('deleted')
      // map.delete(shapeId);
    }
  }

  deleteDestroyedShapes() {
    for (const [shapeId, _] of this.clickHandlerMap.entries()) this.deleteDestroyedShape(shapeId, this.clickHandlerMap);
    for (const [shapeId, _] of this.mousemoveHandlerMap.entries())
      this.deleteDestroyedShape(shapeId, this.mousemoveHandlerMap);
    for (const [shapeId, _] of this.dblClickHandlerMap.entries())
      this.deleteDestroyedShape(shapeId, this.dblClickHandlerMap);
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
  registerMousemoveHandler(shapeId: string, handler: HandlerType) {
    this.mousemoveHandlerMap.set(shapeId, handler);
  }
  registerDblClickHandler(shapeId: string, handler: HandlerType) {
    this.dblClickHandlerMap.set(shapeId, handler);
  }
  registerDragStartHandler(shapeId: string, handler: DragStartHandlerType) {
    this.dragStartHandlerMap.set(shapeId, handler);
  }
  registerDragMoveHandler(shapeId: string, handler: DragHandlerType) {
    this.dragMoveHandlerMap.set(shapeId, handler);
  }
  registerDragEndHandler(shapeId: string, handler: DragHandlerType) {
    this.dragEndHandlerMap.set(shapeId, handler);
  }
}
