import Konva from 'konva';
import { Train } from '../../model';
import { Polygon, sat } from '../../sat';
import { DiagramKonvaContext, RectState, createPositionDiaTimeMap } from './konva-util';

export class TrainKonva {
  private trainLine: Konva.Line;
  private stroke: string = 'black';

  constructor(private context: DiagramKonvaContext, private train: Train) {
    this.stroke = this.train.trainType?.trainTypeColor ?? 'black';
    this.trainLine = new Konva.Line({
      stroke: this.stroke,
      strokeWidth: 1,
      hitStrokeWidth: 10,
      name: 'trainLine',
      id: `trainLine-${this.train.trainId}`,
    });
    this.trainLine.on('click', this.onClick.bind(this));

    context.topLayer.add(this.trainLine);

    this.updateShape();
  }

  getTrainLine() {
    return this.trainLine;
  }
  getTrain() {
    return this.train;
  }

  onClick(e: Konva.KonvaEventObject<MouseEvent>) {
    console.log(this.train.diaTimes);
    if (e.evt.ctrlKey) {
      this.context.selectionGroupManager.addTrainSelection(this.trainLine, this.train);
    } else {
      this.context.selectionGroupManager.destroySelections();
      this.context.selectionGroupManager.addTrainSelection(this.trainLine, this.train);
    }
    e.cancelBubble = true;
  }

  setSelectTrainLine(isSelected: boolean) {
    this.stroke = isSelected ? 'red' : this.train.trainType?.trainTypeColor ?? 'black';
  }

  private getPoints() {
    return createPositionDiaTimeMap(
      this.train.diaTimes,
      this.context.viewStateManager.getSecondWidth(),
      this.context.viewStateManager.getStationPositions()
    )
      .map(([_, __, position]) => position)
      .flat();
  }

  updateShape() {
    // 列車線（スジ）を描画
    const positions = this.getPoints();
    this.trainLine.points(positions);
    this.trainLine.stroke(this.stroke);
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
