import Konva from 'konva';
import { Train } from '../../model';
import { getDirection } from '../../outlinedTimetableData';
import { Polygon, sat } from '../../sat';
import { DiagramKonvaContext, RectState, createPositionDiaTimeMap } from './konva-util';

export type TrainKonvaProps = Readonly<{ context: DiagramKonvaContext; train: Train }>;

export function TrainKonvaComponent({ context, train }: TrainKonvaProps) {}

export class TrainKonva {
  private trainLine: Konva.Line;
  private isSelected: boolean = false;

  constructor(private context: DiagramKonvaContext, private train: Train) {
    this.trainLine = new Konva.Line({
      strokeWidth: 1,
      hitStrokeWidth: 10,
      name: 'trainLine',
      id: `trainLine-${this.train.trainId}`,
    });
    context.mouseEventManager.registerClickHandler(this.trainLine.id(), this.onClick.bind(this));

    context.topLayer.add(this.trainLine);

    this.updateShape();
  }

  moveShapesToTop() {
    this.trainLine.moveToTop();
  }

  getTrainLine() {
    return this.trainLine;
  }
  getTrain() {
    return this.train;
  }

  onClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.evt.ctrlKey) {
      this.context.selectionGroupManager.addTrainSelection(this);
    } else {
      this.context.selectionGroupManager.destroySelections();
      this.context.selectionGroupManager.addTrainSelection(this);
    }
    e.cancelBubble = true;
  }

  setSelectTrainLine(isSelected: boolean) {
    this.isSelected = isSelected;

    const stroke = this.isSelected ? 'red' : this.train.trainType?.trainTypeColor ?? '#5a5a5a';
    this.trainLine.stroke(stroke);

    if (this.isSelected) {
      this.trainLine.moveToTop();
    }
  }

  private getPoints() {
    const direction = getDirection(this.context.diagramProps.timetable, this.train.trainId);
    return createPositionDiaTimeMap(this.train.diaTimes, this.context.viewStateManager, direction)
      .map(({ x, y }) => [x, y])
      .flat();
  }

  updateShape() {
    // 列車線（スジ）を描画
    const positions = this.getPoints();
    this.trainLine.points(positions);
    const stroke = this.isSelected ? 'red' : this.train.trainType?.trainTypeColor ?? '#5a5a5a';
    this.trainLine.stroke(stroke);
  }

  destroy() {
    this.trainLine.destroy();
  }

  areOverlapped(rect: RectState) {
    // rectの頂点の配列
    const width = rect.width !== 0 ? rect.width : 0.001;
    const height = rect.height !== 0 ? rect.height : 0.001;

    const rectPoints = [
      { x: rect.x, y: rect.y },
      { x: rect.x + width, y: rect.y },
      { x: rect.x + width, y: rect.y + height },
      { x: rect.x, y: rect.y + height },
    ];
    const rectPolygon = new Polygon(rectPoints);

    const points = this.getPoints();
    const segments = [];
    let previousPoint = { x: points[0], y: points[1] };
    for (let i = 2; i < points.length; i += 2) {
      const currentPoint = { x: points[i], y: points[i + 1] };
      segments.push([previousPoint, currentPoint]);
      previousPoint = currentPoint;
    }

    for (const segment of segments) {
      const overlapped = sat(rectPolygon, new Polygon(segment));
      if (overlapped) {
        return true;
      }
    }

    return false;
  }
}
