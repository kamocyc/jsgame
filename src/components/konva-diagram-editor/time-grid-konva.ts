import Konva from 'konva';
import { assert } from '../../common';
import { DiagramKonvaContext, generateKonvaId, gridColor, virtualCanvasHeight } from './konva-util';

export class TimeGridKonva {
  private timeGrid: Konva.Group;
  private timeGridTextGroup: Konva.Group;

  constructor(private context: DiagramKonvaContext) {
    this.timeGridTextGroup = new Konva.Group();
    this.timeGrid = new Konva.Group({
      id: generateKonvaId(),
    });
    context.topLayer.add(this.timeGrid);

    this.createTimeGrid(virtualCanvasHeight, context.viewStateManager.getSecondWidth());
  }

  updateShape() {
    const topStage = this.context.topLayer.parent;
    assert(topStage != null);
    const y = topStage.y();
    const scale = topStage.scaleX();
    this.timeGridTextGroup.y(-y / scale);

    assert(this.timeGridTextGroup.children != null);
    for (const text of this.timeGridTextGroup.children) {
      (text as Konva.Text).fontSize(20 / scale);
    }

    // これは更新不要かも
    assert(this.timeGrid.children != null);
    for (const line of this.timeGrid.children) {
      if (line instanceof Konva.Line) {
        const [x1, y1, x2, _] = line.points();
        line.points([x1, y1, x2, virtualCanvasHeight]);
      }
    }
  }

  createTimeGrid(layerHeight: number, secondWidth: number) {
    this.timeGrid.destroyChildren();
    this.timeGridTextGroup = new Konva.Group({ id: 'time-grid-text-group' });
    this.timeGrid.add(this.timeGridTextGroup);

    let offset = 0;
    while (offset <= 24 * 60 * 60) {
      const hour = Math.floor(offset / 60 / 60);
      const hourText = new Konva.Text({
        x: offset * secondWidth + 2,
        y: 0,
        text: hour.toString(),
        fontSize: 20,
        fontFamily: 'Calibri',
        fill: gridColor,
        id: generateKonvaId(),
      });
      this.timeGridTextGroup.add(hourText);

      const hourLine = new Konva.Line({
        points: [offset * secondWidth, 0, offset * secondWidth, layerHeight],
        stroke: gridColor,
        strokeWidth: 1,
        id: generateKonvaId(),
      });
      this.timeGrid.add(hourLine);

      const drawMinuteLine = (i: number) => {
        // 2分ごとの線を引く
        for (let j = 1; j < 5; j++) {
          const line = new Konva.Line({
            points: [
              (offset + i * 60 * 10 + j * 2 * 60) * secondWidth,
              0,
              (offset + i * 60 * 10 + j * 2 * 60) * secondWidth,
              layerHeight,
            ],
            // alpha: 0.5,
            stroke: gridColor + '88',
            strokeWidth: 1,
            dash: [2, 2],
            id: generateKonvaId(),
          });
          this.timeGrid.add(line);
        }
      };

      drawMinuteLine(0);

      if (offset < 24 * 60 * 60) {
        // 10分ごとの線を引く
        for (let i = 1; i < 6; i++) {
          const line = new Konva.Line({
            points: [(offset + i * 60 * 10) * secondWidth, 0, (offset + i * 60 * 10) * secondWidth, layerHeight],
            stroke: gridColor + '88',
            strokeWidth: 1,
            id: generateKonvaId(),
          });
          this.timeGrid.add(line);

          drawMinuteLine(i);
        }
      }

      offset += 60 * 60;
    }
  }
}
