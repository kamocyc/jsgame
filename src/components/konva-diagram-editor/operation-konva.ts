import Konva from 'konva';
import { hitStrokeWidth } from './drawer-util';
import { DiagramKonvaContext, createPositionDiaTimeMap } from './konva-util';

export class OperationCollectionKonva {
  private operationGroup: Konva.Group;

  constructor(private diagramKonvaContext: DiagramKonvaContext) {
    this.operationGroup = new Konva.Group();
    diagramKonvaContext.topLayer.add(this.operationGroup);

    this.updateShape();
  }

  updateShape() {
    const operations = this.diagramKonvaContext.diagramProps.operations;
    if (operations.length === 0) return;

    this.operationGroup.destroyChildren();

    const [secondWidth, stationPositions] = [
      this.diagramKonvaContext.viewStateManager.getSecondWidth(),
      this.diagramKonvaContext.viewStateManager.getStationPositions(),
    ];

    for (const operation of operations) {
      let prevTrain = operation.trains[0];
      for (let trainIndex = 1; trainIndex < operation.trains.length; trainIndex++) {
        let currTrain = operation.trains[trainIndex];

        const prevTrainTimeData_ = createPositionDiaTimeMap(prevTrain.diaTimes, secondWidth, stationPositions);
        const prevTrainTimeData = prevTrainTimeData_[prevTrainTimeData_.length - 1];
        const currTrainTimeData = createPositionDiaTimeMap(currTrain.diaTimes, secondWidth, stationPositions)[0];

        const stationIndex = stationPositions.findIndex(
          (station) => station.station.stationId === currTrain.diaTimes[0].station.stationId
        );
        const isTop = stationIndex === 0;

        const line = new Konva.Line({
          points: [
            prevTrainTimeData[2][0],
            prevTrainTimeData[2][1],
            prevTrainTimeData[2][0],
            isTop ? prevTrainTimeData[2][1] - 10 : prevTrainTimeData[2][1] + 10,
            currTrainTimeData[2][0],
            isTop ? currTrainTimeData[2][1] - 10 : currTrainTimeData[2][1] + 10,
            currTrainTimeData[2][0],
            currTrainTimeData[2][1],
          ],
          stroke: 'orange',
          strokeWidth: 1,
          hitStrokeWidth: hitStrokeWidth,
        });
        this.operationGroup.add(line);

        prevTrain = currTrain;
      }
    }
  }
}
