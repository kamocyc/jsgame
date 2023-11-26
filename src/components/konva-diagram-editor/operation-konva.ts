import Konva from 'konva';
import { assert, lst } from '../../common';
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

        const prevTrainTimeDatas = createPositionDiaTimeMap(
          prevTrain.diaTimes,
          this.diagramKonvaContext.viewStateManager,
          direction
        );

        const isLastStationExpanded = this.diagramKonvaContext.viewStateManager.isStationExpanded(
          lst(prevTrain.diaTimes).station.stationId
        );
        const prevTrainTimeData = isLastStationExpanded
          ? prevTrainTimeDatas[prevTrainTimeDatas.length - 4]
          : prevTrainTimeDatas[prevTrainTimeDatas.length - 1];
        const currTrainTimeDatas = createPositionDiaTimeMap(
          currTrain.diaTimes,
          this.diagramKonvaContext.viewStateManager,
          direction
        );
        const currTrainTimeData = currTrainTimeDatas[0];

        const stationIndex = this.diagramKonvaContext.diagramProps.stations.findIndex(
          (station) => station.stationId === currTrain.diaTimes[0].station.stationId
        );
        const isTop = stationIndex === 0;

        const line = new Konva.Line({
          points: [
            prevTrainTimeData.x,
            prevTrainTimeData.y,
            prevTrainTimeData.x,
            isTop ? prevTrainTimeData.y - 10 : prevTrainTimeData.y + 10,
            currTrainTimeData.x,
            isTop ? currTrainTimeData.y - 10 : currTrainTimeData.y + 10,
            currTrainTimeData.x,
            currTrainTimeData.y,
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
