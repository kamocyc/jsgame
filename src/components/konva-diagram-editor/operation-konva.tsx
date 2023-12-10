import { Line } from 'react-konva';
import { useRecoilValue } from 'recoil';
import { DeepReadonly } from 'ts-essentials';
import { assert, lst_, nn, whileLoop } from '../../common';
import { Operation } from '../../model';
import { getDirection } from '../../outlinedTimetableData';
import { DiagramProps, hitStrokeWidth } from './drawer-util';
import { allTrainsMapAtom, createPositionDiaTimeMap, stationMapSelector, useViewStateValues } from './konva-util';

// export class OperationCollectionKonva_ {
//   private operationGroup: Konva.Group;

//   constructor(private diagramKonvaContext: DiagramKonvaContext) {
//     this.operationGroup = new Konva.Group({ id: generateKonvaId() });
//     diagramKonvaContext.topLayer.add(this.operationGroup);

//     this.updateShape();
//   }

//   updateShape() {
//     const operations = this.diagramKonvaContext.diagramProps.timetable.operations;
//     if (operations.length === 0) return;

//     this.operationGroup.destroyChildren();

//     for (const operation of operations) {
//       let prevTrain = operation.trains[0];
//       for (let trainIndex = 1; trainIndex < operation.trains.length; trainIndex++) {
//         let currTrain = operation.trains[trainIndex]!;
//         assert(prevTrain !== undefined);

//         const direction = getDirection(this.diagramKonvaContext.diagramProps.timetable, currTrain.trainId);

//         const prevTrainTimeDatas = createPositionDiaTimeMap(
//           prevTrain.diaTimes,
//           this.diagramKonvaContext.viewStateManager,
//           direction
//         );

//         const isLastStationExpanded = this.diagramKonvaContext.viewStateManager.isStationExpanded(
//           lst(prevTrain.diaTimes).station.stationId
//         );
//         const prevTrainTimeData = isLastStationExpanded
//           ? prevTrainTimeDatas[prevTrainTimeDatas.length - 1]
//           : prevTrainTimeDatas[prevTrainTimeDatas.length - 1];
//         const currTrainTimeDatas = createPositionDiaTimeMap(
//           currTrain.diaTimes,
//           this.diagramKonvaContext.viewStateManager,
//           direction
//         );
//         const currTrainTimeData = isLastStationExpanded ? currTrainTimeDatas[0] : currTrainTimeDatas[0];

//         const line = new Konva.Line({
//           points: [prevTrainTimeData.x, prevTrainTimeData.y, currTrainTimeData.x, currTrainTimeData.y],
//           stroke: 'orange',
//           strokeWidth: 5,
//           hitStrokeWidth: hitStrokeWidth,
//           id: generateKonvaId(),
//         });
//         this.operationGroup.add(line);

//         prevTrain = currTrain;
//       }
//     }
//   }
// }

export type OperationKonvaProps = DeepReadonly<{
  diagramProps: DiagramProps;
  operation: Operation;
}>;

export function OperationKonva(props: OperationKonvaProps) {
  const { diagramProps, operation } = props;
  const viewStateValues = useViewStateValues();
  const trains = useRecoilValue(allTrainsMapAtom);
  const stationMap = useRecoilValue(stationMapSelector);

  let prevTrainId = operation.trainIds[0];
  assert(prevTrainId !== undefined);

  return (
    <>
      {[
        ...whileLoop(
          1,
          (trainIndex) => trainIndex < operation.trainIds.length,
          (trainIndex) => trainIndex + 1
        ),
      ].map((trainIndex) => {
        let currTrainId = operation.trainIds[trainIndex]!;
        assert(currTrainId !== undefined);

        if (trains.get(currTrainId) === undefined) return <></>;

        const direction = getDirection(diagramProps.timetable, currTrainId);

        const prevTrainTimeDatas = createPositionDiaTimeMap(
          stationMap,
          viewStateValues,
          nn(trains.get(prevTrainId)).diaTimes,
          direction
        );

        const isLastStationExpanded = viewStateValues.isStationExpanded.get(
          lst_(nn(trains.get(prevTrainId)).diaTimes).stationId
        );
        const prevTrainTimeData = isLastStationExpanded
          ? prevTrainTimeDatas[prevTrainTimeDatas.length - 1]
          : prevTrainTimeDatas[prevTrainTimeDatas.length - 1];
        const currTrainTimeDatas = createPositionDiaTimeMap(
          stationMap,
          viewStateValues,
          nn(trains.get(currTrainId)).diaTimes,
          direction
        );
        const currTrainTimeData = isLastStationExpanded ? currTrainTimeDatas[0] : currTrainTimeDatas[0];

        prevTrainId = currTrainId;

        return (
          <Line
            key={operation.operationId + '-' + prevTrainId + '-' + currTrainId}
            points={[prevTrainTimeData.x, prevTrainTimeData.y, currTrainTimeData.x, currTrainTimeData.y]}
            stroke='orange'
            strokeWidth={5}
            hitStrokeWidth={hitStrokeWidth}
          />
        );
      })}
    </>
  );
}

export type OperationCollectionKonvaProps = DeepReadonly<{
  diagramProps: DiagramProps;
}>;

export function OperationCollectionKonva(props: OperationCollectionKonvaProps, ref: any) {
  const { diagramProps } = props;
  return (
    <>
      {diagramProps.timetable.operations.map((operation) => (
        <OperationKonva key={operation.operationId} diagramProps={diagramProps} operation={operation} />
      ))}
    </>
  );
}
