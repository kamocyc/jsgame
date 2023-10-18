import Konva from 'konva';
import { DiagramKonvaContext } from './konva-util';

export class TimeGridKonva {
  private timeGrid: Konva.Group;

  constructor(private context: DiagramKonvaContext) {
    this.timeGrid = new Konva.Group();
    context.topLayer.add(this.timeGrid);

    const stationPositions = context.viewStateManager.getStationPositions();
    this.createTimeGrid(
      stationPositions[stationPositions.length - 1].diagramPosition + 50,
      context.viewStateManager.getSecondWidth()
    );
  }

  createTimeGrid(layerHeight: number, secondWidth: number) {
    let offset = 0;
    while (offset <= 24 * 60 * 60) {
      const hour = Math.floor(offset / 60 / 60);
      const hourText = new Konva.Text({
        x: offset * secondWidth,
        y: 0,
        text: hour.toString(),
        fontSize: 20,
        fontFamily: 'Calibri',
        fill: 'black',
      });
      this.timeGrid.add(hourText);

      const hourLine = new Konva.Line({
        points: [offset * secondWidth, 0, offset * secondWidth, layerHeight],
        stroke: 'black',
        strokeWidth: 1,
      });
      this.timeGrid.add(hourLine);

      const drawMinuteLine = (i: number) => {
        // 2分ごとの線を引く
        for (let j = 1; j < 6; j++) {
          const line = new Konva.Line({
            points: [
              (offset + i * 60 * 10 + j * 2 * 60) * secondWidth,
              0,
              (offset + i * 60 * 10 + j * 2 * 60) * secondWidth,
              layerHeight,
            ],
            stroke: 'lightgray',
            strokeWidth: 1,
            dash: [2, 2],
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
            stroke: 'lightgray',
            strokeWidth: 1,
          });
          this.timeGrid.add(line);

          drawMinuteLine(i);
        }
      }

      offset += 60 * 60;
    }
  }
}
