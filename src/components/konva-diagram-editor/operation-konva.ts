import Konva from 'konva';
import { assert } from '../../common';
import { getDirection } from '../../outlinedTimetableData';
import { hitStrokeWidth } from './drawer-util';
import { DiagramKonvaContext, createPositionDiaTimeMap, generateKonvaId } from './konva-util';

export class OperationCollectionKonva {
  private operationGroup: Konva.Group;

  constructor(private diagramKonvaContext: DiagramKonvaContext) {
    this.operationGroup = new Konva.Group({ id: generateKonvaId() });
    diagramKonvaContext.topLayer.add(this.operationGroup);

    this.updateShape();
  }

  updateShape() {
    const operations = this.diagramKonvaContext.diagramProps.operations;
    if (operations.length === 0) return;

    this.operationGroup.destroyChildren();

    for (const operation of operations) {
      let prevTrain = operation.trains[0];
      for (let trainIndex = 1; trainIndex < operation.trains.length; trainIndex++) {
        let currTrain = operation.trains[trainIndex]!;
        assert(prevTrain !== undefined);

        const direction = getDirection(this.diagramKonvaContext.diagramProps.timetable, currTrain.trainId);
        const prevTrainTimeData_ = createPositionDiaTimeMap(
          prevTrain.diaTimes,
          this.diagramKonvaContext.viewStateManager,
          direction
        );
        const prevTrainTimeData = prevTrainTimeData_[prevTrainTimeData_.length - 1];
        const currTrainTimeData = createPositionDiaTimeMap(
          currTrain.diaTimes,
          this.diagramKonvaContext.viewStateManager,
          direction
        )[0];

        const stationIndex = this.diagramKonvaContext.diagramProps.stations.findIndex(
          (station) => station.stationId === currTrain.diaTimes[0].station.stationId
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
          id: generateKonvaId(),
        });
        this.operationGroup.add(line);

        prevTrain = currTrain;
      }
    }
  }
}
